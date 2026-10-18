import { FilesetResolver, GestureRecognizer, type GestureRecognizerResult } from '@mediapipe/tasks-vision'
import { classifyHandShape, type HandShapeReading } from './handShape.ts'

// Served from the app (public/), not a CDN: venue Wi-Fi is slow.
export const WASM_PATH = '/wasm'
export const MODEL_PATH = '/models/gesture_recognizer.task'

export interface Landmark {
  /** 0..1 across the frame */
  x: number
  /** 0..1 down the frame */
  y: number
}

export interface Detection {
  /** MediaPipe gesture name, e.g. Thumb_Up, Thumb_Down, Open_Palm. 'None' when there is no hand or no known gesture. */
  label: string
  /** 0..1 */
  score: number
  handPresent: boolean
  /** The 21 hand landmarks, or null with no hand. */
  landmarks: Landmark[] | null
  /**
   * What the landmarks' geometry says the hand is doing, whatever MediaPipe's label says (it reads backs of
   * hands poorly). Absent with no hand, and on readings built by hand without landmarks.
   */
  shape?: HandShapeReading
}

export interface Recognizer {
  recognize(video: HTMLVideoElement, timestampMs: number): Detection
  close(): void
}

/**
 * Reads the first hand of a MediaPipe result. Never returns null, so later stages have one shape.
 * `aspect` is the frame's width over height, which the hand shape needs to measure angles true (default square).
 */
export function toDetection(result: GestureRecognizerResult, aspect = 1): Detection {
  const hand = result.landmarks[0]
  if (!hand) return { label: 'None', score: 0, handPresent: false, landmarks: null }

  const top = result.gestures[0]?.[0]
  const landmarks = hand.map(({ x, y }) => ({ x, y }))
  return {
    label: top?.categoryName ?? 'None',
    score: top?.score ?? 0,
    handPresent: true,
    landmarks,
    shape: classifyHandShape(landmarks, { aspect }),
  }
}

export async function createRecognizer(): Promise<Recognizer> {
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH)
  const recognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numHands: 1,
  })
  return {
    // MediaPipe needs strictly increasing timestamps; the frame loop's are.
    recognize: (video, timestampMs) =>
      toDetection(recognizer.recognizeForVideo(video, timestampMs), video.videoHeight > 0 ? video.videoWidth / video.videoHeight : 1),
    close: () => recognizer.close(),
  }
}
