import { act, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { GestureEvent } from '../types.ts'
import { FALLBACK_MAPPING, type Mapping } from './gestureMapper.ts'
import type { HandShape } from './handShape.ts'
import type { Detection, Recognizer } from './recognizer.ts'
import type { DetectionDeps } from './useDetection.ts'
import { useGestures } from './useGestures.ts'

const det = (label: string, score = 0.9, handPresent = true): Detection => ({
  label,
  score,
  handPresent,
  landmarks: handPresent ? [] : null,
})
/** A reading MediaPipe did not name (or named wrongly) whose landmarks make a plain hand shape. */
const shaped = (shape: HandShape, confidence: number, label = 'None', score = 0): Detection => ({
  label,
  score,
  handPresent: true,
  landmarks: [],
  shape: { shape, confidence },
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
  paused?: boolean
  mapping?: Mapping
}

/** The latest return value of the hook, for reading functions like isHandVisible. */
let latest: ReturnType<typeof useGestures>

function Harness({ video, deps, onGesture, enabled, paused, mapping }: Props) {
  const g = useGestures(video, { enabled, paused, onGesture, deps, mapping })
  useEffect(() => {
    latest = g
  })
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

  describe('hand shape, for the backs of hands MediaPipe misses', () => {
    it.each([
      ['open', 'check'],
      ['thumb_up', 'next'],
      ['thumb_down', 'back'],
    ] as const)('fires %s as %s once the shape has been held, though MediaPipe saw nothing', async (shape, intent) => {
      const { s, onGesture } = await mount()
      s.holdFor(0, 933, shaped(shape, 0.9))
      expect(onGesture).not.toHaveBeenCalled()
      s.holdFor(1000, 1100, shaped(shape, 0.9))
      expect(onGesture).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ intent }))
    })

    it('fires a thumbs-up that MediaPipe called a closed fist', async () => {
      const { s, onGesture } = await mount()
      s.holdFor(0, 1100, shaped('thumb_up', 0.85, 'Closed_Fist', 0.95))
      expect(onGesture).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ intent: 'next' }))
    })

    it('judges the shape by its own confidence, thumbs from 0.7 and the open hand from 0.6', async () => {
      const { s, onGesture } = await mount()
      s.holdFor(0, 2000, shaped('thumb_up', 0.65))
      expect(onGesture).not.toHaveBeenCalled()
      s.holdFor(2100, 3200, shaped('open', 0.65))
      expect(onGesture).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ intent: 'check' }))
    })

    it('does not use MediaPipe\'s score for a shape reading', async () => {
      const { s, onGesture } = await mount()
      // The label is not one that maps and its score is high; the shape is weak.
      s.holdFor(0, 2000, shaped('thumb_up', 0.4, 'Closed_Fist', 0.99))
      expect(onGesture).not.toHaveBeenCalled()
    })

    it('prefers MediaPipe when it is sure of a gesture the shape disagrees with', async () => {
      const { s, onGesture } = await mount()
      s.holdFor(0, 1100, shaped('open', 0.95, 'Thumb_Up', 0.9))
      expect(onGesture).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ intent: 'next' }))
    })

    it('ignores a shape that is other', async () => {
      const { s, onGesture } = await mount()
      s.holdFor(0, 3000, shaped('other', 0.95))
      expect(onGesture).not.toHaveBeenCalled()
    })

    it('shows the hold ring for a shape gesture, like any other', async () => {
      const { s } = await mount()
      s.at(0, shaped('open', 0.9))
      s.at(500, shaped('open', 0.9))
      expect(screen.getByTestId('progress')).toHaveTextContent('check:0.50')
    })

    it('restarts the hold when the shape flickers to something else', async () => {
      const { s, onGesture } = await mount()
      s.holdFor(0, 600, shaped('open', 0.9))
      s.holdFor(667, 1000, shaped('other', 0.9)) // a few dropped frames is fine, this is longer
      s.holdFor(1067, 1900, shaped('open', 0.9))
      expect(onGesture).not.toHaveBeenCalled()
    })

    it('fires only once for one long hold of a shape', async () => {
      const { s, onGesture } = await mount()
      s.holdFor(0, 8000, shaped('thumb_up', 0.9))
      expect(onGesture).toHaveBeenCalledTimes(1)
    })

    it('does not fire on resume for a shape that was already being held, until it is let go', async () => {
      const { s, onGesture, el, view } = await mount()
      s.holdFor(0, 600, shaped('open', 0.9))

      view.rerender(<Harness video={el} deps={s.deps} onGesture={onGesture} paused />)
      s.holdFor(667, 1500, shaped('open', 0.9)) // palm still up during the check

      view.rerender(<Harness video={el} deps={s.deps} onGesture={onGesture} />)
      s.holdFor(1567, 4000, shaped('open', 0.9))
      expect(onGesture).not.toHaveBeenCalled()

      s.holdFor(4067, 4400, none)
      s.holdFor(4467, 5600, shaped('open', 0.9))
      expect(onGesture).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ intent: 'check' }))
    })

    it('counts a held open palm at 0.65 as held through a pause, as the filter does', async () => {
      // 0.65 is enough for a check (0.6) though under the thumbs' 0.7: held through a pause, it must not re-fire.
      const { s, onGesture, el, view } = await mount()
      view.rerender(<Harness video={el} deps={s.deps} onGesture={onGesture} paused />)
      s.holdFor(0, 1500, shaped('open', 0.65))
      view.rerender(<Harness video={el} deps={s.deps} onGesture={onGesture} />)
      s.holdFor(1567, 4000, shaped('open', 0.65))
      expect(onGesture).not.toHaveBeenCalled()
    })

    it('respects the mapping: no thumbs from the shape under the hour-1 fallback', async () => {
      const { s, onGesture } = await mount({ mapping: FALLBACK_MAPPING })
      s.holdFor(0, 2000, shaped('thumb_up', 0.95))
      expect(onGesture).not.toHaveBeenCalled()
      s.holdFor(2100, 3200, shaped('open', 0.95))
      expect(onGesture).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ intent: 'check' }))
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

  describe('paused', () => {
    it('does not fire while paused, even for a gesture that is held', async () => {
      const { s, onGesture } = await mount({ paused: true })
      s.holdFor(0, 3000, thumbsUp)
      expect(onGesture).not.toHaveBeenCalled()
      expect(screen.getByTestId('progress')).toHaveTextContent('none:0.00')
    })

    it('still sees the hand while paused, so a check can wait for it to leave', async () => {
      const { s } = await mount({ paused: true })
      s.at(0, thumbsUp)
      expect(screen.getByTestId('hand')).toHaveTextContent('true')
      expect(latest.isHandVisible()).toBe(true)
      s.holdFor(67, 500, none)
      expect(screen.getByTestId('hand')).toHaveTextContent('false')
      expect(latest.isHandVisible()).toBe(false)
    })

    it('does not fire on resume for a gesture that was already being held, until it is let go', async () => {
      const { s, onGesture, el, view } = await mount()
      s.holdFor(0, 600, openPalm)

      view.rerender(<Harness video={el} deps={s.deps} onGesture={onGesture} paused />)
      s.holdFor(667, 1500, openPalm) // palm still up during the pause

      view.rerender(<Harness video={el} deps={s.deps} onGesture={onGesture} />)
      s.holdFor(1567, 4000, openPalm) // and still up after it
      expect(onGesture).not.toHaveBeenCalled()

      s.holdFor(4067, 4400, none) // let go
      s.holdFor(4467, 5600, openPalm) // a fresh hold
      expect(onGesture).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ intent: 'check' }))
    })

    it('fires normally after resuming if the hand left during the pause', async () => {
      const { s, onGesture, el, view } = await mount({ paused: true })
      s.holdFor(0, 500, none)
      view.rerender(<Harness video={el} deps={s.deps} onGesture={onGesture} />)
      s.holdFor(567, 1700, thumbsUp)
      expect(onGesture).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ intent: 'next' }))
    })

    it('does not restart detection when paused or resumed', async () => {
      const { s, onGesture, el, view } = await mount()
      view.rerender(<Harness video={el} deps={s.deps} onGesture={onGesture} paused />)
      view.rerender(<Harness video={el} deps={s.deps} onGesture={onGesture} />)
      expect(s.deps.createRecognizer).toHaveBeenCalledTimes(1)
    })
  })

  describe('isHandVisible', () => {
    it('reads the current value, not the one from the last render', async () => {
      const { s } = await mount()
      const read = latest.isHandVisible // an old reference, as an async flow would hold
      s.at(0, thumbsUp)
      expect(read()).toBe(true)
      s.holdFor(67, 500, none)
      expect(read()).toBe(false)
    })

    it('is false when gestures are disabled', async () => {
      const { s, onGesture, el, view } = await mount()
      s.at(0, thumbsUp)
      view.rerender(<Harness video={el} deps={s.deps} onGesture={onGesture} enabled={false} />)
      expect(latest.isHandVisible()).toBe(false)
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
