import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { C270, IPHONE, MACBOOK, installFakeMediaDevices } from '../test/fakes/media.ts'
import { useHatCam } from './useHatCam.ts'

function Harness() {
  const { attachVideo, status, label, error } = useHatCam()
  return (
    <>
      <video data-testid="video" ref={attachVideo} />
      <p data-testid="status">{status}</p>
      <p data-testid="label">{label}</p>
      <p data-testid="error">{error}</p>
    </>
  )
}

const video = () => screen.getByTestId<HTMLVideoElement>('video')
const liveTrack = () => (video().srcObject as MediaStream).getVideoTracks()[0]

afterEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
})

describe('useHatCam', () => {
  it('goes from connecting to live and shows the C270 stream in the video element', async () => {
    installFakeMediaDevices([MACBOOK, C270, IPHONE])
    render(<Harness />)
    expect(screen.getByTestId('status')).toHaveTextContent('connecting')

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('live'))
    expect(screen.getByTestId('label')).toHaveTextContent(C270.label)
    expect(liveTrack().label).toBe(C270.label)
  })

  it('reports not_found when the hat cam is not plugged in', async () => {
    installFakeMediaDevices([MACBOOK, IPHONE])
    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'))
    expect(screen.getByTestId('error')).toHaveTextContent('not_found')
  })

  it('reports lost when the camera stream ends', async () => {
    installFakeMediaDevices([C270])
    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('live'))

    const track = liveTrack() as unknown as { end(): void }
    track.end()
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('lost'))
    expect(screen.getByTestId('status')).toHaveTextContent('error')
  })

  it('stops the camera when unmounted', async () => {
    installFakeMediaDevices([C270])
    const { unmount } = render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('live'))
    const track = liveTrack()
    unmount()
    expect(track.readyState).toBe('ended')
  })
})
