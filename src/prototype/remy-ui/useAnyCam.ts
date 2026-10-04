// PROTOTYPE (throwaway): test without the hat cam. With ?cam=any the prototype uses the default camera
// (e.g. the MacBook's) instead of useHatCam, which only ever opens the Logitech. Same shape as HatCam.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { HatCam } from '../../camera/useHatCam'

export const USE_ANY_CAMERA = new URLSearchParams(location.search).get('cam') === 'any'

export function useAnyCam(): HatCam {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [status, setStatus] = useState<HatCam['status']>('connecting')
  const [error, setError] = useState<HatCam['error']>(null)
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const attachVideo = useCallback((el: HTMLVideoElement | null) => { videoRef.current = el; setVideo(el) }, [])

  useEffect(() => {
    let s: MediaStream | null = null
    let cancelled = false
    navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then(got => { if (cancelled) { got.getTracks().forEach(t => t.stop()); return } s = got; setStream(got); setStatus('live') })
      .catch((e: DOMException) => { setStatus('error'); setError(e.name === 'NotAllowedError' ? 'denied' : e.name === 'NotFoundError' ? 'not_found' : 'unknown') })
    return () => { cancelled = true; s?.getTracks().forEach(t => t.stop()) }
  }, [])

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.srcObject = stream
    if (stream) void el.play().catch(() => {})
  }, [video, stream])

  return { attachVideo, video, status, error, stream, label: stream?.getVideoTracks()[0]?.label ?? null, reconnects: 0, stalls: 0 }
}
