import { beforeEach, describe, expect, it, vi } from 'vitest'

const recognizeForVideo = vi.fn()
const close = vi.fn()
const forVisionTasks = vi.fn(async (path: string) => ({ wasmPath: path }))
const createFromOptions = vi.fn(async () => ({ recognizeForVideo, close }))

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks },
  GestureRecognizer: { createFromOptions },
}))

const { createRecognizer, toDetection, MODEL_PATH, WASM_PATH } = await import('./recognizer.ts')
const { openHand, thumbsUp } = await import('../test/fakes/hand.ts')

// Shaped like real GestureRecognizerResult objects.
const hand = Array.from({ length: 21 }, (_, i) => ({ x: i / 21, y: 0.5, z: 0 }))
const category = (categoryName: string, score: number) => ({
  categoryName,
  score,
  index: 0,
  displayName: '',
})
const result = (gestures: ReturnType<typeof category>[][], landmarks: (typeof hand)[]) => ({
  gestures,
  landmarks,
  worldLandmarks: landmarks,
  handedness: landmarks.map(() => [category('Right', 0.99)]),
})

describe('toDetection', () => {
  it('reads the top gesture, its score and the landmarks', () => {
    const d = toDetection(result([[category('Thumb_Up', 0.93)]], [hand]) as never)
    expect(d).toMatchObject({ label: 'Thumb_Up', score: 0.93, handPresent: true })
    expect(d.landmarks).toHaveLength(21)
    expect(d.landmarks?.[1]).toEqual({ x: 1 / 21, y: 0.5 })
  })

  it('returns None with no hand', () => {
    expect(toDetection(result([], []) as never)).toEqual({
      label: 'None',
      score: 0,
      handPresent: false,
      landmarks: null,
    })
  })

  it('returns None with a hand when MediaPipe sees no known gesture', () => {
    const d = toDetection(result([[category('None', 0.52)]], [hand]) as never)
    expect(d).toMatchObject({ label: 'None', score: 0.52, handPresent: true })
  })

  it('treats a hand with an empty gesture list as None, hand present', () => {
    const d = toDetection(result([[]], [hand]) as never)
    expect(d).toMatchObject({ label: 'None', score: 0, handPresent: true })
  })

  it('uses only the first hand', () => {
    const d = toDetection(
      result([[category('Open_Palm', 0.8)], [category('Thumb_Up', 0.99)]], [hand, hand]) as never,
    )
    expect(d.label).toBe('Open_Palm')
  })
})

describe('toDetection hand shape', () => {
  const withZ = (landmarks: { x: number; y: number }[]) => landmarks.map(({ x, y }) => ({ x, y, z: 0 }))

  it('reads the shape from the landmarks, whatever MediaPipe called it', () => {
    // The back of an open hand is what MediaPipe tends to miss: no known gesture, but the shape is plain.
    const d = toDetection(result([[category('None', 0.4)]], [withZ(openHand({ facing: 'back' }))]) as never)
    expect(d).toMatchObject({ label: 'None', score: 0.4, handPresent: true })
    expect(d.shape?.shape).toBe('open')
    expect(d.shape?.confidence).toBeGreaterThan(0.8)
  })

  it('reads a shape when MediaPipe returns no gesture at all', () => {
    const d = toDetection(result([[]], [withZ(thumbsUp({ facing: 'back' }))]) as never)
    expect(d.label).toBe('None')
    expect(d.shape?.shape).toBe('thumb_up')
  })

  it('calls an unreadable hand other rather than leaving the shape out', () => {
    expect(toDetection(result([[category('None', 0.5)]], [hand]) as never).shape).toMatchObject({ shape: 'other' })
  })

  it('has no shape when there is no hand', () => {
    expect(toDetection(result([], []) as never)).not.toHaveProperty('shape')
  })

  it('uses the frame aspect, so a wide frame does not turn a sideways thumb into a thumbs-up', () => {
    const wide = 16 / 9
    const sideways = withZ(thumbsUp({ aspect: wide }, 65))
    expect(toDetection(result([[]], [sideways]) as never, wide).shape?.shape).toBe('other')
    expect(toDetection(result([[]], [withZ(thumbsUp({ aspect: wide }, 20))]) as never, wide).shape?.shape).toBe('thumb_up')
  })
})

describe('createRecognizer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads the wasm and model from the app, not a CDN', async () => {
    await createRecognizer()
    expect(WASM_PATH).toBe('/wasm')
    expect(MODEL_PATH).toBe('/models/gesture_recognizer.task')
    expect(forVisionTasks).toHaveBeenCalledWith('/wasm')
    expect(createFromOptions).toHaveBeenCalledWith(
      { wasmPath: '/wasm' },
      expect.objectContaining({
        baseOptions: expect.objectContaining({ modelAssetPath: '/models/gesture_recognizer.task' }),
        runningMode: 'VIDEO',
        numHands: 1,
      }),
    )
  })

  it('recognizes a video frame and returns a detection', async () => {
    recognizeForVideo.mockReturnValue(result([[category('Open_Palm', 0.88)]], [hand]))
    const recognizer = await createRecognizer()
    const video = document.createElement('video')

    const d = recognizer.recognize(video, 1234)
    expect(recognizeForVideo).toHaveBeenCalledWith(video, 1234)
    expect(d).toMatchObject({ label: 'Open_Palm', score: 0.88, handPresent: true })
  })

  it('reads the shape with the video frame\'s aspect', async () => {
    const wide = 16 / 9
    recognizeForVideo.mockReturnValue(result([[]], [thumbsUp({ aspect: wide }, 65).map(({ x, y }) => ({ x, y, z: 0 }))]))
    const recognizer = await createRecognizer()
    const video = document.createElement('video')
    Object.defineProperty(video, 'videoWidth', { value: 1280 })
    Object.defineProperty(video, 'videoHeight', { value: 720 })

    expect(recognizer.recognize(video, 1).shape?.shape).toBe('other')
  })

  it('treats a video with no size yet as square', async () => {
    recognizeForVideo.mockReturnValue(result([[]], [openHand().map(({ x, y }) => ({ x, y, z: 0 }))]))
    const recognizer = await createRecognizer()
    expect(recognizer.recognize(document.createElement('video'), 1).shape?.shape).toBe('open')
  })

  it('closes the underlying recognizer', async () => {
    const recognizer = await createRecognizer()
    recognizer.close()
    expect(close).toHaveBeenCalledOnce()
  })
})
