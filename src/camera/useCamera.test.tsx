import { act, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { C270, IPHONE, MACBOOK, installFakeMediaDevices } from '../test/fakes/media.ts'
import { GrabError, type GrabResult } from './grabSharpestFrame.ts'
import type { Detection, Recognizer } from './recognizer.ts'
import type { DetectionDeps } from './useDetection.ts'
import { useCamera, type Camera, type CameraOptions } from './useCamera.ts'

const det = (label: string, score = 0.9, handPresent = true): Detection => ({
  label,
  score,
  handPresent,
  landmarks: handPresent ? [] : null,
})
const none = det('None', 0, false)
const thumbsUp = det('Thumb_Up')
const openPalm = det('Open_Palm')

/** Fake MediaPipe and frame loop. */
function fakeDetection() {
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
    holdFor(from: number, to: number, reading: Detection) {
      for (let t = from; t <= to; t += 67) this.at(t, reading)
    },
  }
}

const grabbed = (): GrabResult => ({ blob: new Blob(['jpeg']), width: 768, height: 432, scores: [1, 2], chosen: 1 })

/** The latest return value of the hook. */
let camera: Camera

function Harness(props: CameraOptions) {
  const c = useCamera(props)
  const { attachVideo } = c
  useEffect(() => {
    camera = c
  })
  return (
    <>
      <video ref={attachVideo} />
      <p data-testid="status">{c.status}</p>
      <p data-testid="ready">{String(c.ready)}</p>
      <p data-testid="progress">{`${c.holdProgress.intent ?? 'none'}:${c.holdProgress.progress.toFixed(2)}`}</p>
    </>
  )
}

const ready = () => waitFor(() => expect(screen.getByTestId('ready')).toHaveTextContent('true'))

afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
})

describe('useCamera', () => {
  it('is ready once the camera is live and detection has loaded', async () => {
    installFakeMediaDevices([MACBOOK, C270, IPHONE])
    const d = fakeDetection()
    render(<Harness deps={{ detection: d.deps }} />)
    expect(screen.getByTestId('ready')).toHaveTextContent('false')
    await ready()
    expect(screen.getByTestId('status')).toHaveTextContent('live')
  })

  it('does not load detection until the camera is live, and starts it when the camera appears', async () => {
    const media = installFakeMediaDevices([MACBOOK, IPHONE])
    const d = fakeDetection()
    render(<Harness deps={{ detection: d.deps }} />)
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('reconnecting'))
    expect(d.deps.createRecognizer).not.toHaveBeenCalled()
    expect(screen.getByTestId('ready')).toHaveTextContent('false')

    act(() => media.plug(C270))
    await ready()
    expect(d.deps.createRecognizer).toHaveBeenCalledTimes(1)
  })

  it('reports gestures once they have been held', async () => {
    installFakeMediaDevices([C270])
    const d = fakeDetection()
    const onGesture = vi.fn()
    render(<Harness onGesture={onGesture} deps={{ detection: d.deps }} />)
    await ready()

    d.holdFor(0, 1100, thumbsUp)
    expect(onGesture).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ intent: 'next' }))
  })

  it('stops reading gestures when the camera drops, and needs a fresh hold after it returns', async () => {
    const media = installFakeMediaDevices([C270])
    const d = fakeDetection()
    const onGesture = vi.fn()
    render(<Harness onGesture={onGesture} deps={{ detection: d.deps }} />)
    await ready()

    d.holdFor(0, 600, thumbsUp) // part-way through a hold
    act(() => media.unplug('c270'))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('reconnecting'))
    expect(screen.getByTestId('progress')).toHaveTextContent('none:0.00')

    act(() => media.plug(C270))
    await ready()
    d.holdFor(700, 1100, thumbsUp) // the old hold would have fired by now
    expect(onGesture).not.toHaveBeenCalled()
    d.holdFor(1167, 1900, thumbsUp)
    expect(onGesture).toHaveBeenCalledTimes(1)
  })

  it('does not fire gestures while paused', async () => {
    installFakeMediaDevices([C270])
    const d = fakeDetection()
    const onGesture = vi.fn()
    render(<Harness paused onGesture={onGesture} deps={{ detection: d.deps }} />)
    await ready()
    d.holdFor(0, 3000, openPalm)
    expect(onGesture).not.toHaveBeenCalled()
  })

  describe('grabForCheck', () => {
    // Fake timers drive both the camera keeper and the wait for the hand to leave.
    const settle = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

    async function mountWithFakeTimers(grab = vi.fn(async () => grabbed())) {
      vi.useFakeTimers()
      installFakeMediaDevices([C270])
      const d = fakeDetection()
      render(<Harness deps={{ detection: d.deps, grab }} />)
      await settle(20)
      expect(screen.getByTestId('ready')).toHaveTextContent('true')
      return { d, grab }
    }

    it('takes the photo straight away when no hand is in view', async () => {
      const { grab } = await mountWithFakeTimers()
      let result: GrabResult | undefined
      void camera.grabForCheck().then((r) => (result = r))
      await settle(10)
      expect(grab).toHaveBeenCalledTimes(1)
      expect(result).toEqual(grabbed())
    })

    it('waits for the palm to leave the frame before taking the photo', async () => {
      const { d, grab } = await mountWithFakeTimers()
      d.at(0, openPalm) // the palm that asked for the check is still up
      let result: GrabResult | undefined
      void camera.grabForCheck().then((r) => (result = r))

      await settle(200)
      expect(grab).not.toHaveBeenCalled()

      d.holdFor(100, 500, none) // palm leaves; after 300 ms of no hand it counts as gone
      await settle(100)
      expect(grab).toHaveBeenCalledTimes(1)
      expect(result).toEqual(grabbed())
    })

    it('takes the photo anyway after 1.5 s if the hand stays', async () => {
      const { d, grab } = await mountWithFakeTimers()
      d.at(0, openPalm)
      void camera.grabForCheck()
      await settle(1400)
      expect(grab).not.toHaveBeenCalled()
      await settle(200)
      expect(grab).toHaveBeenCalledTimes(1)
    })

    it('sees the hand even while gestures are paused for the check', async () => {
      vi.useFakeTimers()
      installFakeMediaDevices([C270])
      const d = fakeDetection()
      const grab = vi.fn(async () => grabbed())
      const view = render(<Harness paused deps={{ detection: d.deps, grab }} />)
      await settle(20)

      d.at(0, openPalm)
      void camera.grabForCheck()
      await settle(100)
      expect(grab).not.toHaveBeenCalled() // the hand is still seen, though paused

      d.holdFor(100, 500, none)
      await settle(100)
      expect(grab).toHaveBeenCalledTimes(1)
      view.unmount()
    })

    it('rejects with camera_unavailable if the camera drops while waiting for the hand to leave', async () => {
      vi.useFakeTimers()
      const media = installFakeMediaDevices([C270])
      const d = fakeDetection()
      const grab = vi.fn(async () => grabbed())
      render(<Harness deps={{ detection: d.deps, grab }} />)
      await settle(20)

      d.at(0, openPalm)
      const result = camera.grabForCheck()
      const outcome = result.then(() => 'photo', (e: unknown) => e)
      await settle(100)
      act(() => media.unplug('c270'))
      await settle(100)
      d.holdFor(100, 500, none)
      await settle(2000)

      expect(await outcome).toMatchObject({ kind: 'camera_unavailable' })
      expect(grab).not.toHaveBeenCalled()
    })

    it('rejects with camera_unavailable when the camera is not live, without taking a photo', async () => {
      vi.useFakeTimers()
      installFakeMediaDevices([MACBOOK, IPHONE])
      const d = fakeDetection()
      const grab = vi.fn(async () => grabbed())
      render(<Harness deps={{ detection: d.deps, grab }} />)
      await settle(20)

      await expect(camera.grabForCheck()).rejects.toBeInstanceOf(GrabError)
      await expect(camera.grabForCheck()).rejects.toMatchObject({ kind: 'camera_unavailable' })
      expect(grab).not.toHaveBeenCalled()
    })
  })
})
