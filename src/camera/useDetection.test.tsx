import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Detection, Recognizer } from './recognizer.ts'
import { useDetection, type DetectionDeps } from './useDetection.ts'

const none: Detection = { label: 'None', score: 0, handPresent: false, landmarks: null }
const thumbsUp: Detection = { label: 'Thumb_Up', score: 0.9, handPresent: true, landmarks: [] }

function setup() {
  const close = vi.fn()
  let next = none
  const recognizer: Recognizer = { recognize: vi.fn(() => next), close }
  const stopLoop = vi.fn()
  let frame: (t: number) => void = () => {}
  const deps: DetectionDeps = {
    createRecognizer: vi.fn(async () => recognizer),
    startLoop: vi.fn((_video, onFrame) => {
      frame = onFrame
      return stopLoop
    }),
  }
  return {
    deps,
    recognizer,
    close,
    stopLoop,
    show: (d: Detection) => (next = d),
    tick: (t = 0) => act(() => frame(t)),
  }
}

function Harness({
  video,
  deps,
  enabled,
  onDetection,
}: {
  video: HTMLVideoElement | null
  deps: DetectionDeps
  enabled?: boolean
  onDetection?: (d: Detection) => void
}) {
  const { detection, status, error } = useDetection(video, { enabled, deps, onDetection })
  return (
    <>
      <p data-testid="status">{status}</p>
      <p data-testid="label">{detection?.label ?? 'nothing'}</p>
      <p data-testid="error">{error}</p>
    </>
  )
}

const video = () => document.createElement('video')

describe('useDetection', () => {
  it('loads the recognizer, then reports each frame', async () => {
    const s = setup()
    render(<Harness video={video()} deps={s.deps} />)
    expect(screen.getByTestId('status')).toHaveTextContent('loading')

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))
    expect(screen.getByTestId('label')).toHaveTextContent('nothing')

    s.show(thumbsUp)
    s.tick(1000)
    expect(screen.getByTestId('label')).toHaveTextContent('Thumb_Up')
    expect(s.recognizer.recognize).toHaveBeenCalledWith(expect.any(HTMLVideoElement), 1000)
  })

  it('calls onDetection for every frame, using the latest callback', async () => {
    const s = setup()
    const first = vi.fn()
    const second = vi.fn()
    const el = video()
    const { rerender } = render(<Harness video={el} deps={s.deps} onDetection={first} />)
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))

    s.show(thumbsUp)
    s.tick(1)
    expect(first).toHaveBeenCalledWith(thumbsUp)

    rerender(<Harness video={el} deps={s.deps} onDetection={second} />)
    s.tick(2)
    expect(second).toHaveBeenCalledWith(thumbsUp)
    expect(first).toHaveBeenCalledTimes(1)
    expect(s.deps.createRecognizer).toHaveBeenCalledTimes(1)
  })

  it('does nothing until a video element exists', () => {
    const s = setup()
    render(<Harness video={null} deps={s.deps} />)
    expect(s.deps.createRecognizer).not.toHaveBeenCalled()
  })

  it('does nothing while disabled', () => {
    const s = setup()
    render(<Harness video={video()} deps={s.deps} enabled={false} />)
    expect(s.deps.createRecognizer).not.toHaveBeenCalled()
  })

  it('reports an error if the recognizer fails to load', async () => {
    const s = setup()
    s.deps.createRecognizer = vi.fn(async () => {
      throw new Error('model missing')
    })
    render(<Harness video={video()} deps={s.deps} />)
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'))
    expect(screen.getByTestId('error')).toHaveTextContent('model missing')
  })

  it('reports an error if recognizing a frame throws, and keeps going', async () => {
    const s = setup()
    s.recognizer.recognize = vi.fn(() => {
      throw new Error('bad frame')
    })
    render(<Harness video={video()} deps={s.deps} />)
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))
    s.tick()
    expect(screen.getByTestId('error')).toHaveTextContent('bad frame')
    expect(screen.getByTestId('status')).toHaveTextContent('ready')
  })

  it('stops the loop and closes the recognizer on unmount', async () => {
    const s = setup()
    const { unmount } = render(<Harness video={video()} deps={s.deps} />)
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))
    unmount()
    expect(s.stopLoop).toHaveBeenCalled()
    expect(s.close).toHaveBeenCalled()
  })

  it('closes a recognizer that finishes loading after unmount', async () => {
    const s = setup()
    const { unmount } = render(<Harness video={video()} deps={s.deps} />)
    unmount()
    await waitFor(() => expect(s.close).toHaveBeenCalled())
    expect(s.deps.startLoop).not.toHaveBeenCalled()
  })
})
