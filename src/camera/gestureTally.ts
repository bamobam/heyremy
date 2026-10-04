// Counts gesture attempts on the debug page, for the hour-1 test: try each
// gesture 20 times and see how many register.

import { DEFAULT_FILTER_CONFIG, minScoreFor } from './gestureFilter.ts'
import { mapGesture } from './gestureMapper.ts'
import type { Detection } from './recognizer.ts'

/** Same threshold the gesture filter uses, for gestures without their own. */
export const MIN_SCORE = DEFAULT_FILTER_CONFIG.minScore

/** The filter's threshold for this MediaPipe label (open palm has a lower one). */
const thresholdFor = (label: string): number => {
  const intent = mapGesture(label)
  return intent === null ? MIN_SCORE : minScoreFor(intent, DEFAULT_FILTER_CONFIG)
}

export interface Tally {
  /** Times each gesture was started: a held gesture counts once. */
  hits: Record<string, number>
  /** Frames each gesture was seen in. */
  frames: Record<string, number>
  /** The gesture being held right now. */
  current: string | null
}

export const emptyTally = (): Tally => ({ hits: {}, frames: {}, current: null })

export function stepTally(tally: Tally, d: Detection): Tally {
  const counted = d.handPresent && d.label !== 'None' && d.score >= thresholdFor(d.label)
  if (!counted) return tally.current === null ? tally : { ...tally, current: null }

  const started = tally.current !== d.label
  return {
    hits: started ? { ...tally.hits, [d.label]: (tally.hits[d.label] ?? 0) + 1 } : tally.hits,
    frames: { ...tally.frames, [d.label]: (tally.frames[d.label] ?? 0) + 1 },
    current: d.label,
  }
}
