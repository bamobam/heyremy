// Decides what to do when the hat cam stream misbehaves: the cable is pulled,
// the stream freezes, another app grabs the camera. Pure: events and the
// current time go in, the next state and the actions to run come out.
//
// It only ever reopens the hat cam. It never falls back to another camera.

import type { CameraErrorKind } from './openHatCam.ts'

/** No new frame for this long means the stream is frozen even though it has not ended. */
export const STALL_MS = 2000
/** How long to wait before trying again when another app holds the camera. */
export const RETRY_MS = 2000
/** How often to check whether the camera is back, in case a device change event was missed. */
export const POLL_MS = 2000

export type Phase =
  | 'connecting' // an open is in progress
  | 'live'
  | 'reconnecting' // the camera is gone; waiting for it to be listed again
  | 'busy' // another app holds it; retrying
  | 'denied' // camera access refused; nothing more to try
  | 'stopped'

export interface WatchdogState {
  phase: Phase
  /** The last frame seen (or when the stream opened). */
  lastFrameAt: number
  /** The next time to retry or poll, while busy or reconnecting. */
  retryAt: number
  /** Times the stream dropped. */
  reconnects: number
  /** Times a frozen stream was restarted. */
  stalls: number
  error: CameraErrorKind | null
}

export type WatchdogEvent =
  | { type: 'opened' }
  | { type: 'open_failed'; kind: CameraErrorKind }
  | { type: 'track_ended' }
  /** The camera list changed (or was checked), and whether the hat cam is in it. */
  | { type: 'devices'; hatCamPresent: boolean }
  | { type: 'frame' }
  | { type: 'tick' }
  | { type: 'stop' }

export type WatchdogAction =
  | { type: 'open' }
  /** Stop the current stream, if any, and cancel any open in progress. */
  | { type: 'release' }
  | { type: 'poll_devices' }

export interface WatchdogOutput {
  state: WatchdogState
  actions: WatchdogAction[]
}

export const initialWatchdog = (now: number): WatchdogState => ({
  phase: 'connecting',
  lastFrameAt: now,
  retryAt: now,
  reconnects: 0,
  stalls: 0,
  error: null,
})

const out = (state: WatchdogState, ...actions: WatchdogAction[]): WatchdogOutput => ({ state, actions })

export function stepWatchdog(state: WatchdogState, event: WatchdogEvent, now: number): WatchdogOutput {
  if (state.phase === 'stopped') return out(state)
  if (event.type === 'stop') return out({ ...state, phase: 'stopped' }, { type: 'release' })

  switch (state.phase) {
    case 'connecting':
      switch (event.type) {
        case 'opened':
          return out({ ...state, phase: 'live', lastFrameAt: now, error: null })
        case 'open_failed':
          if (event.kind === 'busy') return out({ ...state, phase: 'busy', retryAt: now + RETRY_MS, error: 'busy' })
          if (event.kind === 'denied') return out({ ...state, phase: 'denied', error: 'denied' })
          return out({ ...state, phase: 'reconnecting', retryAt: now + POLL_MS, error: event.kind })
        case 'track_ended':
          // Dropped before it was even live: the pending open is cancelled by the release.
          return out(
            { ...state, phase: 'reconnecting', retryAt: now + POLL_MS, reconnects: state.reconnects + 1, error: 'lost' },
            { type: 'release' },
          )
        default:
          return out(state) // never start a second open while one is pending
      }

    case 'live':
      switch (event.type) {
        case 'frame':
          return out({ ...state, lastFrameAt: now })
        case 'track_ended':
          return out(
            { ...state, phase: 'reconnecting', retryAt: now + POLL_MS, reconnects: state.reconnects + 1, error: 'lost' },
            { type: 'release' },
            { type: 'poll_devices' },
          )
        case 'tick':
          if (now - state.lastFrameAt >= STALL_MS) {
            return out({ ...state, phase: 'connecting', stalls: state.stalls + 1 }, { type: 'release' }, { type: 'open' })
          }
          return out(state)
        default:
          return out(state)
      }

    case 'reconnecting':
      switch (event.type) {
        case 'devices':
          return event.hatCamPresent ? out({ ...state, phase: 'connecting' }, { type: 'open' }) : out(state)
        case 'tick':
          return now >= state.retryAt ? out({ ...state, retryAt: now + POLL_MS }, { type: 'poll_devices' }) : out(state)
        default:
          return out(state)
      }

    case 'busy':
      if (event.type === 'tick' && now >= state.retryAt) return out({ ...state, phase: 'connecting' }, { type: 'open' })
      return out(state)

    case 'denied':
      return out(state)
  }
}
