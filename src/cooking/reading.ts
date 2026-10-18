// What the dev tag shows of a frame: the MediaPipe label and score, and, when the gesture came from the
// hand's shape instead, which shape and how sure.
import { readGesture } from '../camera/gestureMapper.ts'
import type { Detection } from '../camera/recognizer.ts'
import type { DetectionReading } from './context.ts'

// The camera runs with the default mapping and filter config (the provider passes none), so this reads the
// frame the way useGestures did.
export function toReading(detection: Detection): DetectionReading {
  const { label, score, handPresent } = detection
  const reading: DetectionReading = { label, score, handPresent }
  const gesture = readGesture(detection)
  if (gesture?.source === 'shape' && detection.shape && detection.shape.shape !== 'other') {
    reading.shape = { name: detection.shape.shape, score: gesture.score }
  }
  return reading
}
