import { describe, expect, it } from 'vitest'
import { BURST_FRAMES, BURST_SPACING_MS, MAX_BURST_FRAMES, grabBurst, type BurstEnv } from './grabBurst.ts'
import { GrabError, type GrabResult } from './grabSharpestFrame.ts'

const video = document.createElement('video')

/**
 * Fake clock, sleep and single-frame grab that move time together: a grab takes `grabMs` of fake time,
 * a sleep takes as long as it is asked to. Each grab returns a blob named by its position.
 */
function fakeEnv({ grabMs = 500, failAt }: { grabMs?: number; failAt?: number } = {}) {
  let clock = 0
  const log = { starts: [] as number[], sleeps: [] as number[], grabs: 0 }
  const env: BurstEnv = {
    now: () => clock,
    sleep: async (ms) => {
      log.sleeps.push(ms)
      clock += ms
    },
    grab: async () => {
      const n = log.grabs++
      log.starts.push(clock)
      clock += grabMs
      if (n === failAt) throw new GrabError('camera_unavailable')
      return { blob: new Blob([`frame-${n}`]), width: 768, height: 432, scores: [1], chosen: 0 } satisfies GrabResult
    },
  }
  return { env, log }
}

const text = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.readAsText(blob)
  })

describe('grabBurst', () => {
  it('takes 3 frames, about 700 ms apart, by default', () => {
    expect(BURST_FRAMES).toBe(3)
    expect(BURST_SPACING_MS).toBe(700)
  })

  it('returns the frames in time order', async () => {
    const { env } = fakeEnv()
    const frames = await grabBurst(video, {}, env)
    expect(frames).toHaveLength(3)
    expect(await Promise.all(frames.map((f) => text(f.blob)))).toEqual(['frame-0', 'frame-1', 'frame-2'])
  })

  it('starts each frame 700 ms after the one before, counting the time the capture itself takes', async () => {
    const { env, log } = fakeEnv({ grabMs: 500 })
    await grabBurst(video, {}, env)
    expect(log.starts).toEqual([0, 700, 1400])
    expect(log.sleeps).toEqual([200, 200])
  })

  it('does not wait before the first frame or after the last', async () => {
    const { env, log } = fakeEnv()
    await grabBurst(video, { frames: 2 }, env)
    expect(log.grabs).toBe(2)
    expect(log.sleeps).toHaveLength(1)
  })

  it('does not wait when a capture already took longer than the spacing', async () => {
    const { env, log } = fakeEnv({ grabMs: 900 })
    await grabBurst(video, {}, env)
    expect(log.sleeps).toEqual([])
    expect(log.starts).toEqual([0, 900, 1800])
  })

  it('takes the number of frames and the spacing it is asked for', async () => {
    const { env, log } = fakeEnv({ grabMs: 100 })
    const frames = await grabBurst(video, { frames: 4, spacingMs: 400 }, env)
    expect(frames).toHaveLength(4)
    expect(log.starts).toEqual([0, 400, 800, 1200])
  })

  it('takes one frame, without waiting, when asked for one', async () => {
    const { env, log } = fakeEnv()
    expect(await grabBurst(video, { frames: 1 }, env)).toHaveLength(1)
    expect(log.sleeps).toEqual([])
  })

  it.each([
    [0, 1],
    [-3, 1],
    [2.9, 2],
    [9, MAX_BURST_FRAMES],
    [Number.NaN, BURST_FRAMES],
  ])('treats %s frames as %s', async (asked, taken) => {
    const { env, log } = fakeEnv({ grabMs: 0 })
    await grabBurst(video, { frames: asked }, env)
    expect(log.grabs).toBe(taken)
  })

  it('rejects with the capture error and takes no more frames when one fails', async () => {
    const { env, log } = fakeEnv({ failAt: 1 })
    await expect(grabBurst(video, {}, env)).rejects.toMatchObject({ kind: 'camera_unavailable' })
    expect(log.grabs).toBe(2)
  })
})
