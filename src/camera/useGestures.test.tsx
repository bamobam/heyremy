import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { GestureEvent } from '../types.ts'
import { FALLBACK_MAPPING, type Mapping } from './gestureMapper.ts'
import type { Detection, Recognizer } from './recognizer.ts'
import type { DetectionDeps } from './useDetection.ts'
import { useGestures } from './useGestures.ts'

const det = (label: string, score = 0.9, handPresent = true): Detection => ({
  label,
  score,
  handPresent,
  landmarks: handPresent ? [] : null,
})
const none = det('None', 0, false)
const thumbsUp = det('Thumb_Up')
const thumbsDown = det('Thumb_Down')
const openPalm = det('Open_Palm')

/** Fake MediaPipe and frame loop: `at(t, reading)` plays one frame at time t. */
function setup() {
  let current = none
  let frame: (t: number) => void = () => {}
  const recognizer: Recognizer = { recognize: () => current, close: vi.fn() }
  const deps: DetectionDeps = {
    createRecognizer: vi.fn(async () => recognizer),
    startLoop: vi.fn((_video, onFrame) => {
      frame = onFrame
      return vi.fn()
    }),
  }
  return {
    deps,
    at(t: number, reading: Detection) {
      current = reading
      act(() => frame(t))
    },
    /** One frame every 67 ms (about 15 per second) of the same reading. */
    holdFor(from: number, to: number, reading: Detection) {
      for (let t = from; t <= to; t += 67) this.at(t, reading)
    },
  }
}

interface Props {
  video: HTMLVideoElement | null
  deps: DetectionDeps
  onGesture?: (e: GestureEvent) => void
  enabled?: boolean
  mapping?: Mapping
}

function Harness({ video, deps, onGesture, enabled, mapping }: Props) {
  const g = useGestures(video, { enabled, onGesture, deps, mapping })
  return (
    <>
      <p data-testid="status">{g.status}</p>
      <p data-testid="progress">{`${g.holdProgress.intent ?? 'none'}:${g.holdProgress.progress.toFixed(2)}`}</p>
      <p data-testid="hand">{String(g.handVisible)}</p>
      <p data-testid="error">{g.error}</p>
      <p data-testid="label">{g.detection?.label ?? 'nothing'}</p>
    </>
  )
}

const video = () => document.createElement('video')
const ready = () => waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))

async function mount(props: Partial<Props> = {}) {
  const s = setup()
  const onGesture = vi.fn()
  const el = video()
  const view = render(<Harness video={el} deps={s.deps} onGesture={onGesture} {...props} />)
  await ready()
  return { s, onGesture, el, view }
}

describe('useGestures', () => {
  describe('firing', () => {
    it('does not fire before the hold time', async () => {
      const { s, onGesture } = await mount()
      s.holdFor(0, 933, thumbsUp)
      expect(onGesture).not.toHaveBeenCalled()
    })

    it('fires next once a thumbs-up has been held for a second', async () => {
      const { s, onGesture } = await mount()
      s.at(0, thumbsUp)
      s.at(500, thumbsUp)
      s.at(999, thumbsUp)
      expect(onGesture).not.toHaveBeenCalled()
      s.at(1000, thumbsUp)
      expect(onGesture).toHaveBeenCalledExactlyOnceWith({ intent: 'next', at: 1000 })
    })

    it.each([
      ['Thumb_Down', thumbsDown, 'back'],
      ['Open_Palm', openPalm, 'check'],
    ] as const)('maps %s to %s', async (_name, reading, intent) => {
      const { s, onGesture } = await mount()
      s.holdFor(0, 1100, reading)
      expect(onGesture).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ intent }))
    })

    it('ignores gestures that mean nothing here', async () => {
      const { s, onGesture } = await mount()
      s.holdFor(0, 2000, det('Victory'))
      s.holdFor(2100, 4000, det('None', 0.95))
      expect(onGesture).not.toHaveBeenCalled()
    })

    it('ignores a low-confidence reading', async () => {
      const { s, onGesture } = await mount()
      s.holdFor(0, 2000, det('Thumb_Up', 0.6))
      expect(onGesture).not.toHaveBeenCalled()
    })

    it('fires only once for one long hold', async () => {
      const { s, onGesture } = await mount()
      s.holdFor(0, 8000, thumbsUp)
      expect(onGesture).toHaveBeenCalledTimes(1)
    })

    it('uses the mapping it is given', async () => {
      const { s, onGesture } = await mount({ mapping: FALLBACK_MAPPING })
      s.holdFor(0, 1100, det('Closed_Fist'))
      expect(onGesture).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ intent: 'next' }))

      onGesture.mockClear()
      s.holdFor(4000, 5100, thumbsUp) // no longer a gesture
      expect(onGesture).not.toHaveBeenCalled()
    })

    it('calls the latest onGesture without restarting detection', async () => {
      const { s, onGesture, el, view } = await mount()
      const second = vi.fn()
      view.rerender(<Harness video={el} deps={s.deps} onGesture={second} />)
      s.holdFor(0, 1100, thumbsUp)
      expect(second).toHaveBeenCalledTimes(1)
      expect(onGesture).not.toHaveBeenCalled()
      expect(s.deps.createRecognizer).toHaveBeenCalledTimes(1)
    })
  })

  describe('hold progress', () => {
    it('starts at 0 on the first frame and rises as the gesture is held', async () => {
      const { s } = await mount()
      expect(screen.getByTestId('progress')).toHaveTextContent('none:0.00')
      s.at(0, thumbsUp)
      expect(screen.getByTestId('progress')).toHaveTextContent('next:0.00')
      s.at(500, thumbsUp)
      expect(screen.getByTestId('progress')).toHaveTextContent('next:0.50')
    })

    it('is back at nothing after the gesture fires and during the cooldown', async () => {
      const { s } = await mount()
      s.holdFor(0, 1005, thumbsUp)
      expect(screen.getByTestId('progress')).toHaveTextContent('none:0.00')
    })

    it('goes back to nothing when the hand leaves', async () => {
      const { s } = await mount()
      s.holdFor(0, 400, thumbsUp)
      s.holdFor(467, 800, none)
      expect(screen.getByTestId('progress')).toHaveTextContent('none:0.00')
    })
  })

  describe('hand visibility', () => {
    it('is visible while a hand is seen and gone 300 ms after it leaves', async () => {
      const { s } = await mount()
      expect(screen.getByTestId('hand')).toHaveTextContent('false')
      s.at(0, thumbsUp)
      expect(screen.getByTestId('hand')).toHaveTextContent('true')
      s.at(100, none)
      expect(screen.getByTestId('hand')).toHaveTextContent('true')
      s.at(300, none)
      expect(screen.getByTestId('hand')).toHaveTextContent('false')
    })

    it('counts a hand with no known gesture as visible', async () => {
      const { s } = await mount()
      s.at(0, det('None', 0.5, true))
      expect(screen.getByTestId('hand')).toHaveTextContent('true')
    })
  })

  describe('never fires on a stale hold', () => {
    it('starts a fresh hold after a long gap between frames, such as a hidden tab', async () => {
      const { s, onGesture } = await mount()
      s.at(0, thumbsUp)
      s.at(500, thumbsUp)
      s.at(5000, thumbsUp) // 4.5 s later: the old hold must not count
      expect(onGesture).not.toHaveBeenCalled()
      expect(screen.getByTestId('progress')).toHaveTextContent('next:0.00')
      s.holdFor(5067, 6100, thumbsUp) // frames carry on normally: a fresh hold, 1 s from t=5000
      expect(onGesture).toHaveBeenCalledTimes(1)
    })

    it('forgets a half-finished hold when disabled, even if re-enabled quickly', async () => {
      const { s, onGesture, el, view } = await mount()
      s.holdFor(0, 600, thumbsUp)

      view.rerender(<Harness video={el} deps={s.deps} onGesture={onGesture} enabled={false} />)
      view.rerender(<Harness video={el} deps={s.deps} onGesture={onGesture} enabled />)
      await waitFor(() => expect(s.deps.createRecognizer).toHaveBeenCalledTimes(2))
      await ready()

      s.holdFor(700, 1000, thumbsUp) // a new hold starts at 700; the old one would have fired by 1000
      expect(onGesture).not.toHaveBeenCalled()
      s.holdFor(1067, 1800, thumbsUp)
      expect(onGesture).toHaveBeenCalledTimes(1)
    })
  })

  describe('enabled', () => {
    it('does nothing while disabled', () => {
      const s = setup()
      const onGesture = vi.fn()
      render(<Harness video={video()} deps={s.deps} onGesture={onGesture} enabled={false} />)
      expect(s.deps.createRecognizer).not.toHaveBeenCalled()
      expect(screen.getByTestId('progress')).toHaveTextContent('none:0.00')
      expect(screen.getByTestId('hand')).toHaveTextContent('false')
    })

    it('shows no progress or hand once disabled', async () => {
      const { s, onGesture, el, view } = await mount()
      s.at(0, thumbsUp)
      s.at(300, thumbsUp)
      expect(screen.getByTestId('progress')).toHaveTextContent('next:0.30')

      view.rerender(<Harness video={el} deps={s.deps} onGesture={onGesture} enabled={false} />)
      expect(screen.getByTestId('progress')).toHaveTextContent('none:0.00')
      expect(screen.getByTestId('hand')).toHaveTextContent('false')
    })

    it('does nothing until a video element exists', () => {
      const s = setup()
      render(<Harness video={null} deps={s.deps} />)
      expect(s.deps.createRecognizer).not.toHaveBeenCalled()
    })
  })

  describe('status', () => {
    it('is loading, then ready, and exposes the latest reading', async () => {
      const s = setup()
      render(<Harness video={video()} deps={s.deps} />)
      expect(screen.getByTestId('status')).toHaveTextContent('loading')
      await ready()
      s.at(0, thumbsUp)
      expect(screen.getByTestId('label')).toHaveTextContent('Thumb_Up')
    })

    it('reports an error when the recognizer fails to load', async () => {
      const s = setup()
      s.deps.createRecognizer = vi.fn(async () => {
        throw new Error('model missing')
      })
      render(<Harness video={video()} deps={s.deps} />)
      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'))
      expect(screen.getByTestId('error')).toHaveTextContent('model missing')
    })
  })
})
