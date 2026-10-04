import { describe, expect, it, vi } from 'vitest'
import { GrabError, grabSharpestFrame, type GrabEnv, type Surface } from './grabSharpestFrame.ts'

const SIZE = 16

/** RGBA pixels of a gray checkerboard; higher contrast scores as sharper. */
function checkerboardRgba(contrast: number) {
  const rgba = new Uint8ClampedArray(SIZE * SIZE * 4)
  for (let i = 0; i < SIZE * SIZE; i++) {
    const v = ((i % SIZE) + Math.floor(i / SIZE)) % 2 === 0 ? 128 + contrast : 128 - contrast
    rgba.set([v, v, v, 255], i * 4)
  }
  return rgba
}

function video(width = 1280, height = 720, readyState = 4) {
  const el = document.createElement('video')
  Object.defineProperty(el, 'readyState', { value: readyState, configurable: true })
  Object.defineProperty(el, 'videoWidth', { value: width, configurable: true })
  Object.defineProperty(el, 'videoHeight', { value: height, configurable: true })
  return el
}

/**
 * Fake canvases. `contrasts[i]` is how sharp the i-th captured frame is.
 * The output surface remembers which frame it was last asked to draw.
 */
function fakeEnv(contrasts: number[]) {
  let frame = -1
  const sleeps: number[] = []
  const analysis = {
    sizes: [] as [number, number][],
    draws: 0,
    resize(w: number, h: number) {
      this.sizes.push([w, h])
    },
    draw() {
      frame++
      this.draws++
    },
    getPixels: () => ({ data: checkerboardRgba(contrasts[frame]), width: SIZE, height: SIZE }),
    toBlob: async () => new Blob(),
  }
  const output = {
    sizes: [] as [number, number][],
    drawnFrames: [] as number[],
    qualities: [] as number[],
    resize(w: number, h: number) {
      this.sizes.push([w, h])
    },
    draw() {
      this.drawnFrames.push(frame)
    },
    getPixels: () => ({ data: new Uint8ClampedArray(0), width: 0, height: 0 }),
    async toBlob(quality: number) {
      this.qualities.push(quality)
      return new Blob([`frame-${this.drawnFrames.at(-1)}`], { type: 'image/jpeg' })
    },
  }
  const env: GrabEnv = {
    analysis: analysis as Surface,
    output: output as Surface,
    sleep: async (ms) => {
      sleeps.push(ms)
    },
  }
  return { env, analysis, output, sleeps }
}

const text = (blob: Blob) => new Promise<string>((resolve) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.readAsText(blob)
})

describe('grabSharpestFrame', () => {
  it('captures 6 frames spread over 500 ms by default', async () => {
    const { env, analysis, sleeps } = fakeEnv([10, 10, 10, 10, 10, 10])
    await grabSharpestFrame(video(), {}, env)
    expect(analysis.draws).toBe(6)
    expect(sleeps).toHaveLength(5)
    expect(sleeps.reduce((a, b) => a + b, 0)).toBe(500)
  })

  it('returns the sharpest of the frames', async () => {
    const { env } = fakeEnv([20, 40, 60, 120, 50, 30])
    const result = await grabSharpestFrame(video(), {}, env)
    expect(result.chosen).toBe(3)
    expect(await text(result.blob)).toBe('frame-3')
    expect(result.scores).toHaveLength(6)
    expect(result.scores[3]).toBe(Math.max(...result.scores))
  })

  it('returns the first frame when all are equally sharp', async () => {
    const { env } = fakeEnv([50, 50, 50, 50, 50, 50])
    const result = await grabSharpestFrame(video(), {}, env)
    expect(result.chosen).toBe(0)
  })

  it('only redraws the full-size image when a frame beats the best so far', async () => {
    const { env, output } = fakeEnv([20, 40, 30, 120, 50, 10])
    await grabSharpestFrame(video(), {}, env)
    expect(output.drawnFrames).toEqual([0, 1, 3])
  })

  it('analyzes a small copy and outputs 768 px on the long side', async () => {
    const { env, analysis, output } = fakeEnv([10, 10, 10, 10, 10, 10])
    const result = await grabSharpestFrame(video(1280, 720), {}, env)
    expect(analysis.sizes[0]).toEqual([160, 90])
    expect(output.sizes[0]).toEqual([768, 432])
    expect(result.width).toBe(768)
    expect(result.height).toBe(432)
  })

  it('encodes a JPEG at quality 0.8', async () => {
    const { env, output } = fakeEnv([10, 10, 10, 10, 10, 10])
    const result = await grabSharpestFrame(video(), {}, env)
    expect(output.qualities).toEqual([0.8])
    expect(result.blob.type).toBe('image/jpeg')
  })

  it('honours custom frame count, span and output size', async () => {
    const { env, analysis, output, sleeps } = fakeEnv([10, 90, 20])
    const result = await grabSharpestFrame(video(1280, 720), { frames: 3, spanMs: 200, maxSide: 400 }, env)
    expect(analysis.draws).toBe(3)
    expect(sleeps).toEqual([100, 100])
    expect(output.sizes[0]).toEqual([400, 225])
    expect(result.chosen).toBe(1)
  })

  it('takes one frame without waiting when frames is 1', async () => {
    const { env, analysis, sleeps } = fakeEnv([10])
    const result = await grabSharpestFrame(video(), { frames: 1 }, env)
    expect(analysis.draws).toBe(1)
    expect(sleeps).toHaveLength(0)
    expect(result.chosen).toBe(0)
  })

  it('rejects with camera_unavailable when the video has no data', async () => {
    const { env, analysis } = fakeEnv([10])
    const error = await grabSharpestFrame(video(1280, 720, 1), {}, env).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(GrabError)
    expect(error).toMatchObject({ kind: 'camera_unavailable' })
    expect(analysis.draws).toBe(0)
  })

  it('rejects with camera_unavailable when the video has no size', async () => {
    const { env } = fakeEnv([10])
    await expect(grabSharpestFrame(video(0, 0), {}, env)).rejects.toMatchObject({ kind: 'camera_unavailable' })
  })

  it('rejects with camera_unavailable if the camera stops mid-capture', async () => {
    const { env } = fakeEnv([10, 10, 10, 10, 10, 10])
    const el = video()
    const sleep = vi.fn(async () => {
      Object.defineProperty(el, 'readyState', { value: 0, configurable: true })
    })
    await expect(grabSharpestFrame(el, {}, { ...env, sleep })).rejects.toMatchObject({
      kind: 'camera_unavailable',
    })
  })
})
