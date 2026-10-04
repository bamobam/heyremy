import { useCallback, useEffect, useRef, useState } from 'react'
import { CameraError, openHatCam, type CameraErrorKind } from './openHatCam.ts'

export type HatCamStatus = 'connecting' | 'live' | 'error'

export interface HatCam {
  /** Callback ref: put it on the <video> element that shows the hat cam. */
  attachVideo: (video: HTMLVideoElement | null) => void
  /** The attached <video> element, once mounted. Detection and frame grabs read from it. */
  video: HTMLVideoElement | null
  status: HatCamStatus
  /** Set when status is 'error'. */
  error: CameraErrorKind | null
  /** The label Chrome gives the hat cam, e.g. "UVC Camera (046d:0825)". */
  label: string | null
  stream: MediaStream | null
}

type StreamState = Pick<HatCam, 'status' | 'error' | 'label' | 'stream'>

/** Opens the hat cam on mount, plays it in the attached video element, and closes it on unmount. */
export function useHatCam(): HatCam {
  // The element is kept in a ref (to set its stream) and in state (to re-render users when it mounts).
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el
    setVideo(el)
  }, [])
  const [state, setState] = useState<StreamState>({
    status: 'connecting',
    error: null,
    label: null,
    stream: null,
  })

  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | null = null

    openHatCam()
      .then((opened) => {
        stream = opened.stream
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        stream.getVideoTracks()[0].addEventListener('ended', () => {
          if (!cancelled) setState((s) => ({ ...s, status: 'error', error: 'lost', stream: null }))
        })
        setState({ status: 'live', error: null, label: opened.label, stream })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const kind = error instanceof CameraError ? error.kind : 'unknown'
        setState({ status: 'error', error: kind, label: null, stream: null })
      })

    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // Show the stream once both the stream and the video element exist.
  useEffect(() => {
    const el = videoRef.current
    if (!el || !state.stream) return
    el.srcObject = state.stream
    void el.play().catch(() => {})
  }, [video, state.stream])

  return { attachVideo, video, ...state }
}
