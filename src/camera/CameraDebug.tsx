// Developer page for the camera track, at /?debug=camera.
// Each camera branch adds a panel here so it can be checked on the real hat cam.

import { useEffect, useState } from 'react'
import { CAMERA_ERROR_MESSAGES } from './cameraMessages.ts'
import { useHatCam } from './useHatCam.ts'
import './CameraDebug.css'

/** Frames per second actually delivered to the video element. */
function useFrameRate(video: HTMLVideoElement | null, live: boolean): number | null {
  const [fps, setFps] = useState<number | null>(null)

  useEffect(() => {
    if (!video || !live || !('requestVideoFrameCallback' in video)) return
    let frames = 0
    let handle = 0
    const onFrame = () => {
      frames++
      handle = video.requestVideoFrameCallback(onFrame)
    }
    handle = video.requestVideoFrameCallback(onFrame)
    const timer = setInterval(() => {
      setFps(frames)
      frames = 0
    }, 1000)
    return () => {
      video.cancelVideoFrameCallback(handle)
      clearInterval(timer)
    }
  }, [video, live])

  return fps
}

export default function CameraDebug() {
  const { attachVideo, video, status, error, label, stream } = useHatCam()
  const live = status === 'live'
  const fps = useFrameRate(video, live)
  const settings = stream?.getVideoTracks()[0]?.getSettings()

  return (
    <main className="camera-debug">
      <h1>Hat cam</h1>

      <div className="camera-debug__layout">
        <video
          data-testid="preview"
          className="camera-debug__preview"
          ref={attachVideo}
          autoPlay
          muted
          playsInline
        />

        <section className="camera-debug__panel">
          <h2>Stream</h2>
          <dl>
            <dt>Status</dt>
            <dd className={`camera-debug__status camera-debug__status--${status}`}>{status}</dd>
            <dt>Camera</dt>
            <dd>{label ?? '—'}</dd>
            <dt>Resolution</dt>
            <dd>{settings?.width ? `${settings.width} × ${settings.height}` : '—'}</dd>
            <dt>Frame rate</dt>
            <dd>{fps === null ? '—' : `${fps} fps`}</dd>
          </dl>
          {error && <p className="camera-debug__error">{CAMERA_ERROR_MESSAGES[error]}</p>}
        </section>
      </div>
    </main>
  )
}
