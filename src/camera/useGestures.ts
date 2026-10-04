import { useCallback, useEffect, useRef, useState } from 'react'
import type { GestureEvent, HoldProgress } from '../types.ts'
import { DEFAULT_FILTER_CONFIG, idleFilter, stepFilter, type FilterConfig, type FilterState } from './gestureFilter.ts'
import { mapDetection, MAPPING, type Mapping } from './gestureMapper.ts'
import { initialPresence, stepPresence, type Presence } from './handPresence.ts'
import type { Detection } from './recognizer.ts'
import { useDetection, type DetectionDeps, type DetectionStatus } from './useDetection.ts'

/** Frames further apart than this mean something stopped (hidden tab, paused video): start over. */
export const MAX_FRAME_GAP_MS = 500

const NO_PROGRESS: HoldProgress = { intent: null, progress: 0 }

export interface Gestures {
  /** The latest reading, or null before the first frame. */
  detection: Detection | null
  /** Which gesture is being held and how far along, for the hold ring. */
  holdProgress: HoldProgress
  /** Whether a hand is in front of the camera (steadier than one frame's reading). */
  handVisible: boolean
  status: DetectionStatus
  error: string | null
}

export interface GesturesOptions {
  /** Turn gestures off, e.g. while a check is running. Anything half-held is forgotten. */
  enabled?: boolean
  /** Called once each time a gesture has been held long enough. */
  onGesture?: (event: GestureEvent) => void
  /** Called with every frame's reading, after it has been handled. */
  onDetection?: (detection: Detection, t: number) => void
  mapping?: Mapping
  config?: FilterConfig
  deps?: DetectionDeps
}

/**
 * Turns the live hat cam into gesture events: detection on every frame, the
 * mapper, the hold-and-cooldown filter and hand presence, wired together.
 */
export function useGestures(
  video: HTMLVideoElement | null,
  { enabled = true, onGesture, onDetection, mapping = MAPPING, config = DEFAULT_FILTER_CONFIG, deps }: GesturesOptions = {},
): Gestures {
  const [holdProgress, setHoldProgress] = useState<HoldProgress>(NO_PROGRESS)
  const [handVisible, setHandVisible] = useState(false)

  const filter = useRef<FilterState>(idleFilter)
  const presence = useRef<Presence>(initialPresence())
  const lastFrame = useRef<number | null>(null)

  // Always call the latest callbacks without restarting detection when they change.
  const onGestureRef = useRef(onGesture)
  const onDetectionRef = useRef(onDetection)
  useEffect(() => {
    onGestureRef.current = onGesture
    onDetectionRef.current = onDetection
  })

  // A hold that was cut off must never carry over: forget it whenever gestures are switched off.
  useEffect(() => {
    if (enabled) return
    filter.current = idleFilter
    presence.current = initialPresence()
    lastFrame.current = null
  }, [enabled])

  const onFrame = useCallback(
    (detection: Detection, t: number) => {
      if (lastFrame.current !== null && t - lastFrame.current > MAX_FRAME_GAP_MS) {
        filter.current = idleFilter
        presence.current = initialPresence()
      }
      lastFrame.current = t

      presence.current = stepPresence(presence.current, detection.handPresent, t)
      setHandVisible(presence.current.visible)

      const out = stepFilter(filter.current, { intent: mapDetection(detection, mapping), score: detection.score, t }, config)
      filter.current = out.state
      setHoldProgress((prev) =>
        prev.intent === out.progress.intent && prev.progress === out.progress.progress ? prev : out.progress,
      )

      if (out.fire) onGestureRef.current?.({ intent: out.fire, at: t })
      onDetectionRef.current?.(detection, t)
    },
    [mapping, config],
  )

  const { detection, status, error } = useDetection(video, { enabled, deps, onDetection: onFrame })

  return {
    detection,
    holdProgress: enabled ? holdProgress : NO_PROGRESS,
    handVisible: enabled && handVisible,
    status,
    error,
  }
}
