import { useEffect, useRef, useState } from 'react'
import { GrabError, grabSharpestFrame, type GrabResult } from './grabSharpestFrame.ts'

/** The JPEG size the check endpoint is tuned for. */
const MIN_KB = 80
const MAX_KB = 150

interface GrabState {
  busy: boolean
  result: GrabResult | null
  url: string | null
  error: string | null
}

const NOT_READY = 'Camera not ready. Wait a moment and try again.'
const FAILED = 'Could not grab a frame. Try again.'

/** Debug panel: captures the sharpest of several frames and shows what was kept. */
export function GrabPanel({
  video,
  live,
  grab = grabSharpestFrame,
}: {
  video: HTMLVideoElement | null
  live: boolean
  grab?: (video: HTMLVideoElement) => Promise<GrabResult>
}) {
  const [state, setState] = useState<GrabState>({ busy: false, result: null, url: null, error: null })
  const urlRef = useRef<string | null>(null)

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    [],
  )

  async function run() {
    if (!video) return
    setState((s) => ({ ...s, busy: true, error: null }))
    try {
      const result = await grab(video)
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      const url = URL.createObjectURL(result.blob)
      urlRef.current = url
      setState({ busy: false, result, url, error: null })
    } catch (error) {
      const message = error instanceof GrabError && error.kind === 'camera_unavailable' ? NOT_READY : FAILED
      setState((s) => ({ ...s, busy: false, error: message }))
    }
  }

  const { result, url } = state
  const kb = result ? Math.round(result.blob.size / 1024) : 0
  const inTarget = kb >= MIN_KB && kb <= MAX_KB

  return (
    <section className="camera-debug__panel">
      <h2>Grab</h2>
      <p className="camera-debug__hint">Keeps the sharpest of 6 frames taken over 0.5 s. Shake your head while pressing to test it.</p>
      <button type="button" onClick={run} disabled={!live || !video || state.busy}>
        {state.busy ? 'Grabbing...' : 'Grab frame'}
      </button>
      {state.error && <p className="camera-debug__error">{state.error}</p>}
      {result && url && (
        <>
          <img className="camera-debug__grab" src={url} alt="Grabbed frame" />
          <dl>
            <dt>Size</dt>
            <dd data-testid="grab-size">{inTarget ? `${kb} KB` : `${kb} KB, outside ${MIN_KB}-${MAX_KB} KB target`}</dd>
            <dt>Dimensions</dt>
            <dd data-testid="grab-dimensions">{`${result.width} × ${result.height}`}</dd>
          </dl>
          <ol className="camera-debug__scores">
            {result.scores.map((score, i) => (
              <li key={i} data-testid={`grab-score-${i}`} className={i === result.chosen ? 'camera-debug__chosen' : undefined}>
                {`Frame ${i + 1}: ${score.toFixed(1)}${i === result.chosen ? ' chosen' : ''}`}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}
