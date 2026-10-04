// Turns noisy per-frame readings into one deliberate gesture: the cook has to
// hold it, then it fires once, then nothing fires for a while. No clocks or
// timers in here: every sample carries its own time, so tests use fake time.

import type { GestureIntent, HoldProgress } from '../types.ts'

export interface FilterConfig {
  /** How long a gesture must be held before it fires. */
  holdMs: number
  /** Readings below this score count as no gesture. */
  minScore: number
  /** After firing, nothing new fires for this long. */
  cooldownMs: number
  /** Frames in a row the hand may drop out without breaking a hold. */
  dropToleranceFrames: number
}

export const DEFAULT_FILTER_CONFIG: FilterConfig = {
  holdMs: 1000,
  minScore: 0.7,
  cooldownMs: 2000,
  dropToleranceFrames: 3,
}

export type FilterState =
  | { kind: 'idle' }
  | { kind: 'holding'; intent: GestureIntent; since: number; misses: number }
  /** After a fire. `released` once the gesture has been gone for more than the drop tolerance. */
  | { kind: 'cooldown'; until: number; intent: GestureIntent; misses: number; released: boolean }
  /** Cooldown is over but the fired gesture is still being held: wait for the cook to let go. */
  | { kind: 'rearm'; intent: GestureIntent; misses: number }

export const idleFilter: FilterState = { kind: 'idle' }

export interface Sample {
  /** What the mapper made of this frame, or null for no hand or an unmapped gesture. */
  intent: GestureIntent | null
  score: number
  /** Milliseconds, any clock that only goes forward. */
  t: number
}

export interface FilterOutput {
  state: FilterState
  /** Set on the one frame where a held gesture completes. */
  fire: GestureIntent | null
  progress: HoldProgress
}

const NO_PROGRESS: HoldProgress = { intent: null, progress: 0 }

const result = (state: FilterState, progress: HoldProgress = NO_PROGRESS, fire: GestureIntent | null = null): FilterOutput => ({
  state,
  fire,
  progress,
})

/** One frame in, the next state out. */
export function stepFilter(state: FilterState, sample: Sample, cfg: FilterConfig): FilterOutput {
  const intent = sample.intent !== null && sample.score >= cfg.minScore ? sample.intent : null

  const fromIdle = (): FilterOutput =>
    intent === null
      ? result(idleFilter)
      : result({ kind: 'holding', intent, since: sample.t, misses: 0 }, { intent, progress: 0 })

  const fromRearm = (rearm: Extract<FilterState, { kind: 'rearm' }>): FilterOutput => {
    if (intent === rearm.intent) return result({ ...rearm, misses: 0 })
    if (intent !== null) return fromIdle() // a different gesture: start it
    const misses = rearm.misses + 1
    return misses > cfg.dropToleranceFrames ? result(idleFilter) : result({ ...rearm, misses })
  }

  switch (state.kind) {
    case 'idle':
      return fromIdle()

    case 'holding': {
      const elapsed = sample.t - state.since
      if (intent === state.intent) {
        if (elapsed >= cfg.holdMs) {
          return result(
            { kind: 'cooldown', until: sample.t + cfg.cooldownMs, intent: state.intent, misses: 0, released: false },
            NO_PROGRESS,
            state.intent,
          )
        }
        return result({ ...state, misses: 0 }, { intent: state.intent, progress: elapsed / cfg.holdMs })
      }
      if (intent !== null) return fromIdle() // switched to another gesture: restart the clock
      const misses = state.misses + 1
      if (misses > cfg.dropToleranceFrames) return result(idleFilter)
      return result({ ...state, misses }, { intent: state.intent, progress: Math.min(elapsed / cfg.holdMs, 1) })
    }

    case 'cooldown': {
      if (sample.t < state.until) {
        if (state.released) return result(state)
        const misses = intent === state.intent ? 0 : state.misses + 1
        return result({ ...state, misses, released: misses > cfg.dropToleranceFrames })
      }
      // Cooldown over. If the gesture was let go meanwhile, a new hold can start now;
      // if it is still being held, it must be let go first, or one long hold would fire twice.
      return state.released ? fromIdle() : fromRearm({ kind: 'rearm', intent: state.intent, misses: state.misses })
    }

    case 'rearm':
      return fromRearm(state)
  }
}
