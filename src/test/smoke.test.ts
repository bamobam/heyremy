import { describe, expect, it } from 'vitest'
import { FakeMediaDevices } from './fakes/media.ts'

describe('test setup', () => {
  it('runs in a DOM environment', () => {
    expect(document.createElement('video')).toBeInstanceOf(HTMLVideoElement)
  })

  it('has jest-dom matchers', () => {
    const el = document.createElement('p')
    el.textContent = 'hat cam'
    document.body.append(el)
    expect(el).toBeInTheDocument()
    el.remove()
  })
})

describe('FakeMediaDevices', () => {
  it('hides labels until camera access is granted', async () => {
    const devices = new FakeMediaDevices([{ deviceId: 'c270', label: 'UVC Camera (046d:0825)' }])
    expect((await devices.enumerateDevices())[0].label).toBe('')
    await devices.getUserMedia({ video: true })
    expect((await devices.enumerateDevices())[0].label).toBe('UVC Camera (046d:0825)')
  })

  it('opens the camera asked for by exact deviceId', async () => {
    const devices = new FakeMediaDevices([
      { deviceId: 'mac', label: 'MacBook Air Camera' },
      { deviceId: 'c270', label: 'UVC Camera (046d:0825)' },
    ])
    const stream = await devices.getUserMedia({ video: { deviceId: { exact: 'c270' } } })
    expect(stream.getVideoTracks()[0].label).toBe('UVC Camera (046d:0825)')
    expect(devices.calls).toHaveLength(1)
  })

  it('throws a scripted error once', async () => {
    const devices = new FakeMediaDevices([{ deviceId: 'c270', label: 'C270' }])
    devices.failNext('NotAllowedError')
    await expect(devices.getUserMedia({ video: true })).rejects.toMatchObject({ name: 'NotAllowedError' })
    await expect(devices.getUserMedia({ video: true })).resolves.toBeDefined()
  })

  it('stopping a track ends it', async () => {
    const devices = new FakeMediaDevices([{ deviceId: 'c270', label: 'C270' }])
    const track = (await devices.getUserMedia({ video: true })).getVideoTracks()[0]
    track.stop()
    expect(track.readyState).toBe('ended')
  })
})
