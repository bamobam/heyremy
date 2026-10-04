import { useCallback, useEffect, useRef } from 'react'
import type { GestureEvent, HoldProgress } from '../types.ts'
import type { FilterConfig } from './gestureFilter.ts'
import type { Mapping } from './gestureMapper.ts'
import { GrabError, grabSharpestFrame, type GrabResult } from './grabSharpestFrame.ts'
import type { Detection } from './recognizer.ts'
import type { DetectionDeps, DetectionStatus } from './useDetection.ts'
import { useGestures } from './useGestures.ts'
import { useHatCam, type HatCam, type HatCamStatus } from './useHatCam.ts'
import type { CameraErrorKind } from './openHatCam.ts'
import { waitForHandGone } from './waitForHandGone.ts'

export interface CameraOptions {
  /** Turn gesture reading off. The camera itself stays connected. */
  enabled?: boolean
  /**
   * Stop gestures from firing but keep watching the hand. Set while a check runs, so a
   * second gesture cannot fire and `grabForCheck` can still tell when the palm has left.
   */
  paused?: boolean
  /** Called once each time a gesture has been held long enough. */
  onGesture?: (event: GestureEvent) => void
  /** Called with every frame's reading. */
  onDetection?: (detection: Detection, t: number) => void
  mapping?: Mapping
  config?: FilterConfig
  /** The camera connection to read. Defaults to the hat cam; the UI passes the default camera for ?cam=any. */
  source?: () => HatCam
  /** Replacements for the real MediaPipe and frame capture, for tests. */
  deps?: {
    detection?: DetectionDeps
    grab?: (video: HTMLVideoElement) => Promise<GrabResult>
  }
}

export interface Camera {
  /** Callback ref: put it on the <video> element that shows the hat cam. */
  attachVideo: (video: HTMLVideoElement | null) => void
  video: HTMLVideoElement | null

  /** The camera connection. It reconnects by itself after an unplug. */
  status: HatCamStatus
  error: CameraErrorKind | null
  label: string | null
  stream: MediaStream | null
  reconnects: number
  stalls: number

  /** Gestures. They only run while the camera is live. */
  detection: Detection | null
  /** Which gesture is being held and how far along, for the hold ring. */
  holdProgress: HoldProgress
  handVisible: boolean
  /** The current value, for async code. */
  isHandVisible: () => boolean
  detectionStatus: DetectionStatus
  detectionError: string | null

  /** The camera is live and gestures are being read. */
  ready: boolean

  /**
   * For a check: waits for the palm that asked for it to leave the frame (up to 1.5 s),
   * then captures the sharpest of several frames as a JPEG. Rejects with
   * `camera_unavailable` if the camera is not live, or drops while waiting.
   */
  grabForCheck: () => Promise<GrabResult>
}

/**
 * Everything the app needs from the hat cam in one place: the connection, gesture
 * events and hold progress, and the photo for a check.
 */
export function useCamera({
  enabled = true,
  paused,
  onGesture,
  onDetection,
  mapping,
  config,
  source = useHatCam,
  deps,
}: CameraOptions = {}): Camera {
  const hat = source()
  const live = hat.status === 'live'

  const gestures = useGestures(hat.video, {
    enabled: enabled && live,
    paused,
    onGesture,
    onDetection,
    mapping,
    config,
    deps: deps?.detection,
  })

  // Async code (the wait for the palm to leave) must see the camera as it is then, not as it was when called.
  const latest = useRef({ video: hat.video, live })
  const grabRef = useRef(deps?.grab ?? grabSharpestFrame)
  useEffect(() => {
    latest.current = { video: hat.video, live }
    grabRef.current = deps?.grab ?? grabSharpestFrame
  })

  const { isHandVisible } = gestures
  const grabForCheck = useCallback(async () => {
    if (!latest.current.video || !latest.current.live) throw new GrabError('camera_unavailable')
    await waitForHandGone(isHandVisible)
    const { video, live: stillLive } = latest.current
    if (!video || !stillLive) throw new GrabError('camera_unavailable')
    return grabRef.current(video)
  }, [isHandVisible])

  return {
    attachVideo: hat.attachVideo,
    video: hat.video,
    status: hat.status,
    error: hat.error,
    label: hat.label,
    stream: hat.stream,
    reconnects: hat.reconnects,
    stalls: hat.stalls,
    detection: gestures.detection,
    holdProgress: gestures.holdProgress,
    handVisible: gestures.handVisible,
    isHandVisible,
    detectionStatus: gestures.status,
    detectionError: gestures.error,
    ready: live && gestures.status === 'ready',
    grabForCheck,
  }
}
