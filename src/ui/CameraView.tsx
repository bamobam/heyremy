// The live hat-cam view (§9.3 CameraView). One useHatCam() runs per tree and every view reuses its
// stream. In the app the provider keeps one hidden video that gestures and photos read, so these are
// all plain windows; `primary` is for a page with no provider (the camera debug page), where a view
// registers itself with the hook, and it is the one whose frames the keeper watches for freezes.
import { useCallback, useEffect, useRef, type CSSProperties } from 'react'
import type { HatCam } from '../camera/useHatCam.ts'
import { CAMERA_MODE } from '../cooking/contract.ts'
import { cameraProblemText, cameraStatusText } from './cameraHelp.ts'

export function CameraView({ cam, primary = false, caption = "Remy's view", className = '', style }: { cam: HatCam; primary?: boolean; caption?: string; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (primary || !ref.current) return
    ref.current.srcObject = cam.stream
    if (cam.stream) void ref.current.play().catch(() => {})
  }, [cam.stream, primary])

  // Stable, so React doesn't detach and re-attach the video on every render.
  const attachVideo = cam.attachVideo
  const setRef = useCallback(
    (el: HTMLVideoElement | null) => {
      ref.current = el
      if (primary) attachVideo(el)
    },
    [primary, attachVideo],
  )

  const live = cam.status === 'live' && cam.stream !== null

  return (
    <figure className={`ui-cam is-${cam.status} ${className}`} style={style}>
      <video ref={setRef} muted playsInline autoPlay aria-label={caption} />
      {!live && (
        <div className="ui-cam__empty">
          <span className="ui-cam__spinner" aria-hidden />
          <p>{cam.error ? cameraProblemText(CAMERA_MODE, cam.error) : cameraStatusText(CAMERA_MODE, cam.status)}</p>
        </div>
      )}
      <figcaption>
        <i className="ui-cam__dot" aria-hidden />
        <span>{live ? caption : cameraStatusText(CAMERA_MODE, cam.status)}</span>
        {live && cam.label && <small className="ui-cam__label">{cam.label}</small>}
      </figcaption>
    </figure>
  )
}