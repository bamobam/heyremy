import { useCallback, useEffect, useRef, useState } from 'react'
import { keepHatCam, type Keeper, type KeeperState } from './keepHatCam.ts'

export type HatCamStatus = KeeperState['status']

export interface HatCam extends KeeperState {
  /** Callback ref: put it on the <video> element that shows the hat cam. */
  attachVideo: (video: HTMLVideoElement | null) => void
  /** The attached <video> element, once mounted. Detection and frame grabs read from it. */
  video: HTMLVideoElement | null
}

const INITIAL: KeeperState = {
  status: 'connecting',
  error: null,
  label: null,
  stream: null,
  reconnects: 0,
  stalls: 0,
}

/**
 * Opens the hat cam, shows it in the attached video element, and keeps it
 * connected: if the cable is pulled it reconnects once the camera is back, and
 * a frozen stream is restarted. Closes the camera on unmount.
 */
export function useHatCam(): HatCam {
  // The element is kept in a ref (to set its stream) and in state (to re-render users when it mounts).
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el
    setVideo(el)
  }, [])

  const [state, setState] = useState<KeeperState>(INITIAL)
  const keeper = useRef<Keeper | null>(null)

  useEffect(() => {
    const k = keepHatCam(setState)
    keeper.current = k
    return () => {
      k.stop()
      keeper.current = null
    }
  }, [])

  // Show the stream once both the stream and the video element exist; clear it when the stream goes.
  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.srcObject = state.stream
    if (state.stream) void el.play().catch(() => {})
  }, [video, state.stream])

  // Tell the keeper about every frame shown, so it can tell a frozen stream from a healthy one.
  useEffect(() => {
    if (!video || !state.stream || !('requestVideoFrameCallback' in video)) return
    let handle = 0
    const onFrame = () => {
      keeper.current?.frame()
      handle = video.requestVideoFrameCallback(onFrame)
    }
    handle = video.requestVideoFrameCallback(onFrame)
    return () => video.cancelVideoFrameCallback(handle)
  }, [video, state.stream])

  return { attachVideo, video, ...state }
}
