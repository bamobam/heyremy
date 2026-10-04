import { useEffect, useRef, useState } from 'react'
import { startFrameLoop } from './frameLoop.ts'
import { createRecognizer, type Detection, type Recognizer } from './recognizer.ts'

export type DetectionStatus = 'loading' | 'ready' | 'error'

export interface DetectionDeps {
  createRecognizer: () => Promise<Recognizer>
  startLoop: (video: HTMLVideoElement, onFrame: (t: number) => void) => () => void
}

const defaultDeps: DetectionDeps = {
  createRecognizer,
  startLoop: (video, onFrame) => startFrameLoop(video, onFrame),
}

export interface DetectionState {
  /** The latest reading, or null before the first frame. */
  detection: Detection | null
  status: DetectionStatus
  error: string | null
}

/**
 * Runs hand and gesture recognition on a live video element, about 15 times a
 * second. Starts once the video element exists and `enabled` is true.
 */
export function useDetection(
  video: HTMLVideoElement | null,
  {
    enabled = true,
    deps = defaultDeps,
    onDetection,
  }: { enabled?: boolean; deps?: DetectionDeps; onDetection?: (detection: Detection, t: number) => void } = {},
): DetectionState {
  const [state, setState] = useState<DetectionState>({ detection: null, status: 'loading', error: null })

  // Always call the latest callback without restarting detection when it changes.
  const onDetectionRef = useRef(onDetection)
  useEffect(() => {
    onDetectionRef.current = onDetection
  })

  useEffect(() => {
    if (!video || !enabled) return
    let cancelled = false
    let recognizer: Recognizer | null = null
    let stopLoop: (() => void) | null = null

    deps
      .createRecognizer()
      .then((created) => {
        if (cancelled) {
          created.close()
          return
        }
        recognizer = created
        setState({ detection: null, status: 'ready', error: null })
        stopLoop = deps.startLoop(video, (t) => {
          try {
            const detection = created.recognize(video, t)
            setState((s) => ({ ...s, detection, error: null }))
            onDetectionRef.current?.(detection, t)
          } catch (error) {
            setState((s) => ({ ...s, error: String(error instanceof Error ? error.message : error) }))
          }
        })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState({
          detection: null,
          status: 'error',
          error: String(error instanceof Error ? error.message : error),
        })
      })

    return () => {
      cancelled = true
      stopLoop?.()
      recognizer?.close()
    }
  }, [video, enabled, deps])

  return state
}
