import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { C270, FakeMediaDevices, FakeTrack, IPHONE, MACBOOK, type FakeCamera } from '../test/fakes/media.ts'
import { keepHatCam, type KeeperState } from './keepHatCam.ts'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

/** Starts a keeper on fake cameras and records every state it reports. */
async function start(
  cameras: FakeCamera[],
  { granted = true, isHidden = () => false }: { granted?: boolean; isHidden?: () => boolean } = {},
) {
  const media = new FakeMediaDevices(cameras)
  media.permissionGranted = granted
  const states: KeeperState[] = []
  const streams: MediaStream[] = []
  const getUserMedia = media.getUserMedia.bind(media)
  media.getUserMedia = async (c) => {
    const stream = await getUserMedia(c)
    streams.push(stream)
    return stream
  }
  const keeper = keepHatCam((s) => states.push(s), { media: media as unknown as MediaDevices, isHidden })
  await vi.advanceTimersByTimeAsync(10)
  return {
    media,
    keeper,
    states,
    streams,
    get last() {
      return states.at(-1)!
    },
    /** Tracks that are still running. */
    get liveTracks() {
      return streams.flatMap((s) => s.getVideoTracks()).filter((t) => t.readyState === 'live')
    },
    advance: (ms: number) => vi.advanceTimersByTimeAsync(ms),
  }
}

const trackOf = (state: KeeperState) => state.stream!.getVideoTracks()[0] as unknown as FakeTrack

describe('opening', () => {
  it('connects to the hat cam and reports it live', async () => {
    const k = await start([MACBOOK, C270, IPHONE])
    expect(k.states[0].status).toBe('connecting')
    expect(k.last).toMatchObject({ status: 'live', error: null, label: C270.label, reconnects: 0, stalls: 0 })
    expect(k.last.stream).not.toBeNull()
    expect(k.liveTracks).toHaveLength(1)
    k.keeper.stop()
  })

  it('waits for the hat cam when it is not plugged in, and connects by itself when it is', async () => {
    const k = await start([MACBOOK, IPHONE])
    expect(k.last).toMatchObject({ status: 'reconnecting', error: 'not_found', stream: null })

    k.media.plug(C270)
    await k.advance(10)
    expect(k.last).toMatchObject({ status: 'live', error: null, label: C270.label })
    k.keeper.stop()
  })

  it('never opens the MacBook or iPhone camera while waiting', async () => {
    const k = await start([MACBOOK, IPHONE])
    await k.advance(10_000)
    expect(k.liveTracks).toHaveLength(0)
    k.keeper.stop()
  })

  it('stops with an error when camera access is denied, and does not retry', async () => {
    const media = new FakeMediaDevices([C270])
    media.permissionGranted = true
    media.failNext('NotAllowedError')
    const states: KeeperState[] = []
    const keeper = keepHatCam((s) => states.push(s), { media: media as unknown as MediaDevices })
    await vi.advanceTimersByTimeAsync(30_000)
    expect(states.at(-1)).toMatchObject({ status: 'error', error: 'denied' })
    expect(media.calls).toHaveLength(1)
    keeper.stop()
  })

  it('retries every 2 s while another app holds the camera, and connects when it lets go', async () => {
    const media = new FakeMediaDevices([C270])
    media.permissionGranted = true
    media.failNext('NotReadableError')
    const states: KeeperState[] = []
    const keeper = keepHatCam((s) => states.push(s), { media: media as unknown as MediaDevices })
    await vi.advanceTimersByTimeAsync(10)
    expect(states.at(-1)).toMatchObject({ status: 'busy', error: 'busy' })

    await vi.advanceTimersByTimeAsync(2000)
    expect(states.at(-1)).toMatchObject({ status: 'live', error: null })
    keeper.stop()
  })
})

describe('when the cable is pulled', () => {
  it('reports reconnecting and releases the dead stream', async () => {
    const k = await start([C270])
    k.media.unplug('c270')
    await k.advance(10)

    expect(k.last).toMatchObject({ status: 'reconnecting', error: 'lost', stream: null, reconnects: 1 })
    expect(k.liveTracks).toHaveLength(0)
    k.keeper.stop()
  })

  it('reopens the same camera as soon as it is plugged back in', async () => {
    const k = await start([MACBOOK, C270])
    k.media.unplug('c270')
    await k.advance(1000)

    k.media.plug(C270)
    await k.advance(10)
    expect(k.last).toMatchObject({ status: 'live', error: null, label: C270.label, reconnects: 1 })
    expect(k.liveTracks).toHaveLength(1)
    k.keeper.stop()
  })

  it('notices the camera is back within 2 s even if the device change event was missed', async () => {
    const k = await start([C270])
    trackOf(k.last).end()
    k.media.cameras = [] // gone, silently
    await k.advance(500)
    expect(k.last.status).toBe('reconnecting')

    k.media.cameras = [C270] // back, with no devicechange event
    await k.advance(2100)
    expect(k.last.status).toBe('live')
    k.keeper.stop()
  })

  it('reopens at once if the track ended but the camera is still listed', async () => {
    const k = await start([C270])
    trackOf(k.last).end()
    await k.advance(10)
    expect(k.last).toMatchObject({ status: 'live', reconnects: 1 })
    k.keeper.stop()
  })

  it('ends up with exactly one stream after rapid unplugs and replugs', async () => {
    const k = await start([C270])
    for (let i = 0; i < 4; i++) {
      k.media.unplug('c270')
      k.media.plug(C270)
      await k.advance(30)
    }
    expect(k.last.status).toBe('live')
    expect(k.liveTracks).toHaveLength(1)
    k.keeper.stop()
  })

  it('keeps waiting if the camera is gone again by the time the reopen runs', async () => {
    const k = await start([C270])
    trackOf(k.last).end() // dropped, but still listed for the moment
    k.media.unplug('c270') // and then really gone before the reopen can happen
    await k.advance(50)
    expect(k.last).toMatchObject({ status: 'reconnecting', error: 'not_found' })
    expect(k.liveTracks).toHaveLength(0)
    k.keeper.stop()
  })
})

describe('when the stream freezes without ending', () => {
  it('restarts it after 2 s with no frames', async () => {
    const k = await start([C270])
    const first = k.last.stream
    await k.advance(2600)
    expect(k.last).toMatchObject({ status: 'live', stalls: 1 })
    expect(k.last.stream).not.toBe(first)
    expect(k.liveTracks).toHaveLength(1)
    k.keeper.stop()
  })

  it('does not treat a hidden tab as a frozen stream, since browsers stop delivering frames to it', async () => {
    let hidden = true
    const k = await start([C270], { isHidden: () => hidden })
    await k.advance(30_000)
    expect(k.last).toMatchObject({ status: 'live', stalls: 0 })

    hidden = false // back on screen: the freeze check starts again from now
    await k.advance(1000)
    expect(k.last.stalls).toBe(0)
    await k.advance(1500)
    expect(k.last.stalls).toBe(1)
    k.keeper.stop()
  })

  it('stays connected while frames keep arriving', async () => {
    const k = await start([C270])
    for (let i = 0; i < 40; i++) {
      k.keeper.frame()
      await k.advance(250)
    }
    expect(k.last).toMatchObject({ status: 'live', stalls: 0 })
    k.keeper.stop()
  })
})

describe('stopping', () => {
  it('releases the camera and goes quiet', async () => {
    const k = await start([C270])
    k.keeper.stop()
    const reported = k.states.length
    expect(k.liveTracks).toHaveLength(0)

    k.media.unplug('c270')
    k.media.plug(C270)
    await k.advance(20_000)
    expect(k.states).toHaveLength(reported)
    expect(k.liveTracks).toHaveLength(0)
  })

  it('does not leak a stream that finishes opening after it was stopped', async () => {
    const media = new FakeMediaDevices([C270])
    media.permissionGranted = true
    const opened: MediaStream[] = []
    const getUserMedia = media.getUserMedia.bind(media)
    let finish: () => void = () => {}
    media.getUserMedia = (c) =>
      new Promise((resolve) => {
        finish = async () => {
          const stream = await getUserMedia(c)
          opened.push(stream)
          resolve(stream)
        }
      })
    const states: KeeperState[] = []
    const keeper = keepHatCam((s) => states.push(s), { media: media as unknown as MediaDevices })
    await vi.advanceTimersByTimeAsync(10)

    keeper.stop()
    finish()
    await vi.advanceTimersByTimeAsync(10)

    expect(opened.flatMap((s) => s.getVideoTracks()).every((t) => t.readyState === 'ended')).toBe(true)
    expect(states.at(-1)?.status).not.toBe('live')
  })
})
