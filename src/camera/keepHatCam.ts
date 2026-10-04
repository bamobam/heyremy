// Keeps the hat cam stream alive: opens it, notices when it drops or freezes,
// and reopens it. The decisions are in watchdog.ts; this runs them against the
// real camera APIs. It only ever reopens the hat cam, never another camera.

import { CameraError, openHatCam, type CameraErrorKind } from './openHatCam.ts'
import { pickHatCam } from './selectHatCam.ts'
import { initialWatchdog, stepWatchdog, type WatchdogAction, type WatchdogEvent, type WatchdogState } from './watchdog.ts'

export type KeeperStatus = 'connecting' | 'live' | 'reconnecting' | 'busy' | 'error'

export interface KeeperState {
  status: KeeperStatus
  /** Why the camera is not live, while it is not. */
  error: CameraErrorKind | null
  /** The label Chrome gives the hat cam, while live. */
  label: string | null
  stream: MediaStream | null
  /** Times the stream dropped. */
  reconnects: number
  /** Times a frozen stream was restarted. */
  stalls: number
}

export interface Keeper {
  /** Call for every video frame shown; a stream with no frames for 2 s is restarted. */
  frame(): void
  /** Release the camera and stop watching. */
  stop(): void
}

export interface KeeperDeps {
  media?: MediaDevices
  open?: typeof openHatCam
  /** Whether the tab is hidden. Browsers send no video frames to a hidden tab, so that is not a freeze. */
  isHidden?: () => boolean
}

/** How often the watchdog checks for stalls and retries. */
const TICK_MS = 500

const STATUS: Record<WatchdogState['phase'], KeeperStatus> = {
  connecting: 'connecting',
  live: 'live',
  reconnecting: 'reconnecting',
  busy: 'busy',
  denied: 'error',
  stopped: 'error',
}

export function keepHatCam(
  onChange: (state: KeeperState) => void,
  { media = navigator.mediaDevices, open = openHatCam, isHidden = () => document.hidden }: KeeperDeps = {},
): Keeper {
  let watchdog = initialWatchdog(Date.now())
  let stopped = false
  /** Bumped on every release, so an open that finishes late is recognised as stale and discarded. */
  let attempt = 0
  let current: { stream: MediaStream; label: string; detach: () => void } | null = null
  let reported = ''
  let reportedStream: MediaStream | null = null

  const publish = () => {
    if (stopped) return
    const state: KeeperState = {
      status: STATUS[watchdog.phase],
      error: watchdog.error,
      label: current?.label ?? null,
      stream: current?.stream ?? null,
      reconnects: watchdog.reconnects,
      stalls: watchdog.stalls,
    }
    // Skip repeats so listeners only re-render on a real change.
    const key = [state.status, state.error, state.label, state.reconnects, state.stalls, current?.stream ? 'stream' : 'none'].join('|')
    if (key === reported && current?.stream === reportedStream) return
    reported = key
    reportedStream = current?.stream ?? null
    onChange(state)
  }

  function release() {
    attempt++
    if (!current) return
    current.detach()
    current.stream.getTracks().forEach((t) => t.stop())
    current = null
  }

  function openCamera() {
    const id = ++attempt
    open(media)
      .then(({ stream, label }) => {
        if (id !== attempt || stopped) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const track = stream.getVideoTracks()[0]
        const onEnded = () => {
          if (current?.stream === stream) dispatch({ type: 'track_ended' })
        }
        track.addEventListener('ended', onEnded)
        current = { stream, label, detach: () => track.removeEventListener('ended', onEnded) }
        dispatch({ type: 'opened' })
      })
      .catch((error: unknown) => {
        if (id !== attempt || stopped) return
        dispatch({ type: 'open_failed', kind: error instanceof CameraError ? error.kind : 'unknown' })
      })
  }

  function pollDevices() {
    media
      .enumerateDevices()
      .then((devices) => {
        if (!stopped) dispatch({ type: 'devices', hatCamPresent: pickHatCam(devices) !== null })
      })
      .catch(() => {})
  }

  function run(action: WatchdogAction) {
    if (action.type === 'open') openCamera()
    else if (action.type === 'release') release()
    else pollDevices()
  }

  function dispatch(event: WatchdogEvent) {
    const out = stepWatchdog(watchdog, event, Date.now())
    watchdog = out.state
    out.actions.forEach(run)
    publish()
  }

  const onDeviceChange = () => pollDevices()
  media.addEventListener('devicechange', onDeviceChange)
  // While the tab is hidden no frames arrive, so count the tick as a frame instead of a possible freeze.
  const timer = setInterval(() => dispatch(isHidden() ? { type: 'frame' } : { type: 'tick' }), TICK_MS)

  publish()
  openCamera()

  return {
    frame: () => dispatch({ type: 'frame' }),
    stop() {
      if (stopped) return
      dispatch({ type: 'stop' })
      stopped = true
      clearInterval(timer)
      media.removeEventListener('devicechange', onDeviceChange)
    },
  }
}
