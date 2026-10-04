import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { C270, IPHONE, MACBOOK, installFakeMediaDevices } from '../test/fakes/media.ts'
import { useHatCam } from './useHatCam.ts'

function Harness() {
  const { attachVideo, status, label, error, reconnects, stalls } = useHatCam()
  return (
    <>
      <video data-testid="video" ref={attachVideo} />
      <p data-testid="status">{status}</p>
      <p data-testid="label">{label}</p>
      <p data-testid="error">{error}</p>
      <p data-testid="reconnects">{reconnects}</p>
      <p data-testid="stalls">{stalls}</p>
    </>
  )
}

const video = () => screen.getByTestId<HTMLVideoElement>('video')
const liveTrack = () => (video().srcObject as MediaStream).getVideoTracks()[0]
const status = () => screen.getByTestId('status')

afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
  delete (HTMLVideoElement.prototype as { requestVideoFrameCallback?: unknown }).requestVideoFrameCallback
})

describe('useHatCam', () => {
  it('goes from connecting to live and shows the C270 stream in the video element', async () => {
    installFakeMediaDevices([MACBOOK, C270, IPHONE])
    render(<Harness />)
    expect(status()).toHaveTextContent('connecting')

    await waitFor(() => expect(status()).toHaveTextContent('live'))
    expect(screen.getByTestId('label')).toHaveTextContent(C270.label)
    expect(liveTrack().label).toBe(C270.label)
  })

  it('waits when the hat cam is not plugged in, and connects by itself when it is', async () => {
    const media = installFakeMediaDevices([MACBOOK, IPHONE])
    render(<Harness />)
    await waitFor(() => expect(status()).toHaveTextContent('reconnecting'))
    expect(screen.getByTestId('error')).toHaveTextContent('not_found')

    act(() => media.plug(C270))
    await waitFor(() => expect(status()).toHaveTextContent('live'))
    expect(screen.getByTestId('error')).toBeEmptyDOMElement()
  })

  it('reconnects by itself after the cable is pulled and shows the new stream', async () => {
    const media = installFakeMediaDevices([C270])
    render(<Harness />)
    await waitFor(() => expect(status()).toHaveTextContent('live'))
    const firstTrack = liveTrack()

    act(() => media.unplug('c270'))
    await waitFor(() => expect(status()).toHaveTextContent('reconnecting'))
    expect(screen.getByTestId('error')).toHaveTextContent('lost')
    expect(screen.getByTestId('reconnects')).toHaveTextContent('1')

    act(() => media.plug(C270))
    await waitFor(() => expect(status()).toHaveTextContent('live'))
    expect(liveTrack()).not.toBe(firstTrack)
    expect(firstTrack.readyState).toBe('ended')
    expect(screen.getByTestId('reconnects')).toHaveTextContent('1')
  })

  it('stops the camera when unmounted', async () => {
    installFakeMediaDevices([C270])
    const { unmount } = render(<Harness />)
    await waitFor(() => expect(status()).toHaveTextContent('live'))
    const track = liveTrack()
    unmount()
    expect(track.readyState).toBe('ended')
  })

  describe('a frozen stream', () => {
    const settle = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

    it('is restarted when the video stops delivering frames', async () => {
      vi.useFakeTimers()
      installFakeMediaDevices([C270])
      render(<Harness />)
      await settle(10)
      expect(status()).toHaveTextContent('live')

      await settle(2600)
      expect(screen.getByTestId('stalls')).toHaveTextContent('1')
      expect(status()).toHaveTextContent('live')
    })

    it('is left alone while the video keeps delivering frames', async () => {
      vi.useFakeTimers()
      const callbacks: (() => void)[] = []
      Object.defineProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback', {
        configurable: true,
        value: (cb: () => void) => callbacks.push(cb),
      })
      Object.defineProperty(HTMLVideoElement.prototype, 'cancelVideoFrameCallback', {
        configurable: true,
        value: () => {},
      })
      installFakeMediaDevices([C270])
      render(<Harness />)
      await settle(10)

      for (let i = 0; i < 40; i++) {
        act(() => callbacks.splice(0).forEach((cb) => cb())) // a frame arrives
        await settle(250)
      }
      expect(screen.getByTestId('stalls')).toHaveTextContent('0')
      expect(status()).toHaveTextContent('live')
    })
  })
})
