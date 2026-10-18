import type { GestureIntent } from '../types.ts'
import { DEFAULT_FILTER_CONFIG, minScoreFor, type FilterConfig } from './gestureFilter.ts'
import type { HandShape } from './handShape.ts'
import type { Detection } from './recognizer.ts'

/** MediaPipe gesture name to what it asks for. */
export type Mapping = Record<string, GestureIntent>

export const MAPPING: Mapping = {
  Thumb_Up: 'next',
  Thumb_Down: 'back',
  Open_Palm: 'check',
}

/** Hour-1 fallback, if thumbs read badly from the hat cam (below about 70% of tries). */
export const FALLBACK_MAPPING: Mapping = {
  Closed_Fist: 'next',
  Victory: 'back',
  Open_Palm: 'check',
}

/** The intent for a MediaPipe gesture name, or null if it asks for nothing. */
export function mapGesture(label: string, mapping: Mapping = MAPPING): GestureIntent | null {
  return Object.hasOwn(mapping, label) ? mapping[label] : null
}

/** The intent for a detection; null with no hand in view. */
export function mapDetection(detection: Detection, mapping: Mapping = MAPPING): GestureIntent | null {
  return detection.handPresent ? mapGesture(detection.label, mapping) : null
}

/** A gesture reading: what it asks for, how sure we are, and who read it. */
export interface GestureReading {
  intent: GestureIntent
  /** 0..1, the score the gesture filter judges. */
  score: number
  /** 'model' is MediaPipe's label; 'shape' is the hand-shape fallback (`classifyHandShape`). */
  source: 'model' | 'shape'
}

/**
 * The MediaPipe label each hand shape stands in for. The shape fallback goes through the same mapping as
 * the labels, so it asks for exactly what that label would, and a mapping that drops a gesture (the hour-1
 * fallback has no thumbs) drops its shape too.
 */
const SHAPE_LABEL: Record<Exclude<HandShape, 'other'>, string> = {
  open: 'Open_Palm',
  thumb_up: 'Thumb_Up',
  thumb_down: 'Thumb_Down',
}

/**
 * What a detection asks for, or null for nothing. MediaPipe's label is used exactly as before when it maps
 * and is sure enough for the gesture filter (its own `minScore` for that gesture). Otherwise the hand's
 * shape, read from the landmarks, steps in with its own confidence, so a back of the hand that MediaPipe
 * misses still counts. If both have a view and disagree, the more confident one is returned and the
 * filter drops it if it is too weak. A label that maps but is not sure enough, with nothing better, comes
 * back as it was, for the filter to drop.
 */
export function readGesture(
  detection: Detection,
  mapping: Mapping = MAPPING,
  config: FilterConfig = DEFAULT_FILTER_CONFIG,
): GestureReading | null {
  if (!detection.handPresent) return null

  const modelIntent = mapGesture(detection.label, mapping)
  const model: GestureReading | null =
    modelIntent === null ? null : { intent: modelIntent, score: detection.score, source: 'model' }
  if (model && model.score >= minScoreFor(model.intent, config)) return model

  const read = detection.shape
  const shapeIntent = read && read.shape !== 'other' ? mapGesture(SHAPE_LABEL[read.shape], mapping) : null
  const fromShape: GestureReading | null =
    read && shapeIntent !== null ? { intent: shapeIntent, score: read.confidence, source: 'shape' } : null

  if (fromShape && model) return fromShape.score > model.score ? fromShape : model
  return fromShape ?? model
}
