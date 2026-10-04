// PROTOTYPE (throwaway): live hat-cam view for the prototype, built on Nam's useHatCam (src/camera).
// One useHatCam() runs per screen tree; extra views just reuse its stream.
import { useEffect, useRef, type CSSProperties } from 'react'
import type { HatCam } from '../../camera/useHatCam'
import { CAMERA_ERROR_MESSAGES } from '../../camera/cameraMessages'
import './camera.css'

const STATUS_TEXT: Record<HatCam['status'], string> = {
  connecting: 'Connecting to the hat cam…',
  live: 'Live',
  reconnecting: 'Reconnecting…',
  busy: 'Camera busy',
  error: 'Hat cam offline',
}

/** `primary` views register with the hook (it watches their frames for freezes); others just show the stream. */
export function CameraView({ cam, primary = false, caption = "Remy's view", className = '', style }: { cam: HatCam; primary?: boolean; caption?: string; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    if (primary || !ref.current) return
    ref.current.srcObject = cam.stream
    if (cam.stream) void ref.current.play().catch(() => {})
  }, [cam.stream, primary])
  const live = cam.status === 'live' && cam.stream
  return (
    <figure className={`cam-view is-${cam.status} ${className}`} style={style}>
      <video
        ref={el => { ref.current = el; if (primary) cam.attachVideo(el) }}
        muted playsInline autoPlay
        aria-label={caption}
      />
      {!live && (
        <div className="cam-view__empty">
          <span className="cam-view__spinner" aria-hidden />
          <p>{cam.error ? CAMERA_ERROR_MESSAGES[cam.error] : STATUS_TEXT[cam.status]}</p>
        </div>
      )}
      <figcaption>
        <i className="cam-view__dot" aria-hidden />
        <span>{live ? caption : STATUS_TEXT[cam.status]}</span>
        {live && cam.label && <small className="cam-view__label">{cam.label}</small>}
      </figcaption>
    </figure>
  )
}
