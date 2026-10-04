import { describe, expect, it } from 'vitest'
import {
  initialWatchdog,
  POLL_MS,
  RETRY_MS,
  STALL_MS,
  stepWatchdog,
  type WatchdogEvent,
  type WatchdogState,
} from './watchdog.ts'

/** Plays events through the watchdog; each is [time, event]. Returns the state after each and every action. */
function play(events: [number, WatchdogEvent][], start: WatchdogState = initialWatchdog(0)) {
  let state = start
  const states: WatchdogState[] = []
  const actions: string[] = []
  for (const [now, event] of events) {
    const out = stepWatchdog(state, event, now)
    state = out.state
    states.push(state)
    actions.push(...out.actions.map((a) => a.type))
  }
  return { states, actions, final: state }
}

const live = (at = 0) => play([[at, { type: 'opened' }]]).final

describe('connecting', () => {
  it('starts out connecting', () => {
    expect(initialWatchdog(0).phase).toBe('connecting')
  })

  it('goes live when the stream opens, and starts watching for frames from then', () => {
    const { final } = play([[100, { type: 'opened' }]])
    expect(final).toMatchObject({ phase: 'live', lastFrameAt: 100, error: null })
  })

  it('goes to busy when another app holds the camera, and retries after 2 s', () => {
    const { states, actions } = play([
      [0, { type: 'open_failed', kind: 'busy' }],
      [RETRY_MS - 1, { type: 'tick' }],
      [RETRY_MS, { type: 'tick' }],
    ])
    expect(states.map((s) => s.phase)).toEqual(['busy', 'busy', 'connecting'])
    expect(states[0].error).toBe('busy')
    expect(actions).toEqual(['open'])
  })

  it('keeps retrying while busy', () => {
    const { actions } = play([
      [0, { type: 'open_failed', kind: 'busy' }],
      [2000, { type: 'tick' }],
      [2100, { type: 'open_failed', kind: 'busy' }],
      [4100, { type: 'tick' }],
    ])
    expect(actions).toEqual(['open', 'open'])
  })

  it('stops for good when camera access is denied, with no retries', () => {
    const { states, actions } = play([
      [0, { type: 'open_failed', kind: 'denied' }],
      [10_000, { type: 'tick' }],
      [20_000, { type: 'devices', hatCamPresent: true }],
    ])
    expect(states.map((s) => s.phase)).toEqual(['denied', 'denied', 'denied'])
    expect(states[0].error).toBe('denied')
    expect(actions).toEqual([])
  })

  it.each(['not_found', 'unknown'] as const)('waits for the camera to be listed when opening fails with %s', (kind) => {
    const { final } = play([[0, { type: 'open_failed', kind }]])
    expect(final).toMatchObject({ phase: 'reconnecting', error: kind })
  })

  it('goes back to reconnecting and releases if the cable drops before it is live', () => {
    const { final, actions } = play([[0, { type: 'track_ended' }]])
    expect(final.phase).toBe('reconnecting')
    expect(actions).toContain('release')
  })

  it('never opens a second time while an open is already pending', () => {
    const { actions } = play([
      [0, { type: 'devices', hatCamPresent: true }],
      [1, { type: 'devices', hatCamPresent: true }],
      [2, { type: 'tick' }],
    ])
    expect(actions).toEqual([])
  })
})

describe('live', () => {
  it('stays live while frames keep arriving', () => {
    const { final, actions } = play([
      [0, { type: 'opened' }],
      [500, { type: 'frame' }],
      [1500, { type: 'frame' }],
      [3000, { type: 'frame' }],
      [3500, { type: 'tick' }],
    ])
    expect(final.phase).toBe('live')
    expect(actions).toEqual([])
  })

  it('treats a stream with no frames for 2 s as frozen, and reopens it', () => {
    const { final, actions } = play([
      [0, { type: 'opened' }],
      [STALL_MS - 1, { type: 'tick' }],
      [STALL_MS, { type: 'tick' }],
    ])
    expect(final).toMatchObject({ phase: 'connecting', stalls: 1 })
    expect(actions).toEqual(['release', 'open'])
  })

  it('measures the stall from the last frame, not from when it opened', () => {
    const { final } = play([
      [0, { type: 'opened' }],
      [1900, { type: 'frame' }],
      [3800, { type: 'tick' }], // 1.9 s since the last frame
    ])
    expect(final.phase).toBe('live')
  })

  it('goes to reconnecting when the track ends, releases it, and checks for the camera right away', () => {
    const { final, actions } = play([
      [0, { type: 'opened' }],
      [1000, { type: 'track_ended' }],
    ])
    expect(final).toMatchObject({ phase: 'reconnecting', error: 'lost', reconnects: 1 })
    expect(actions).toEqual(['release', 'poll_devices'])
  })

  it('ignores device changes while the stream is fine', () => {
    const { actions, final } = play([
      [0, { type: 'opened' }],
      [100, { type: 'devices', hatCamPresent: false }],
      [200, { type: 'devices', hatCamPresent: true }],
    ])
    expect(final.phase).toBe('live')
    expect(actions).toEqual([])
  })
})

describe('reconnecting', () => {
  const dropped = () =>
    play([
      [0, { type: 'opened' }],
      [1000, { type: 'track_ended' }],
    ]).final

  it('reopens as soon as the hat cam is listed again', () => {
    const { final, actions } = play([[1500, { type: 'devices', hatCamPresent: true }]], dropped())
    expect(final.phase).toBe('connecting')
    expect(actions).toEqual(['open'])
  })

  it('does not open anything while only other cameras are listed', () => {
    const { final, actions } = play([[1500, { type: 'devices', hatCamPresent: false }]], dropped())
    expect(final.phase).toBe('reconnecting')
    expect(actions).toEqual([])
  })

  it('checks for the camera every 2 s, in case a device change event was missed', () => {
    const { actions } = play(
      [
        [1000 + POLL_MS - 1, { type: 'tick' }],
        [1000 + POLL_MS, { type: 'tick' }],
        [1000 + POLL_MS + 500, { type: 'tick' }],
        [1000 + 2 * POLL_MS, { type: 'tick' }],
      ],
      dropped(),
    )
    expect(actions).toEqual(['poll_devices', 'poll_devices'])
  })

  it('goes live again after a successful reopen, and counts the reconnect once', () => {
    const { final } = play(
      [
        [1500, { type: 'devices', hatCamPresent: true }],
        [1600, { type: 'opened' }],
      ],
      dropped(),
    )
    expect(final).toMatchObject({ phase: 'live', error: null, reconnects: 1, lastFrameAt: 1600 })
  })

  it('survives rapid drops and reconnects without opening twice', () => {
    const { final, actions } = play(
      [
        [1100, { type: 'devices', hatCamPresent: true }], // open #1
        [1150, { type: 'devices', hatCamPresent: true }], // ignored: already opening
        [1200, { type: 'track_ended' }], // dropped again before it was live
        [1300, { type: 'devices', hatCamPresent: true }], // open #2
        [1400, { type: 'opened' }],
      ],
      dropped(),
    )
    expect(actions.filter((a) => a === 'open')).toHaveLength(2)
    expect(final.phase).toBe('live')
  })
})

describe('stopping', () => {
  it.each([
    ['live', () => live()],
    ['connecting', () => initialWatchdog(0)],
  ] as const)('releases the camera when stopped while %s', (_name, start) => {
    const { final, actions } = play([[5, { type: 'stop' }]], start())
    expect(final.phase).toBe('stopped')
    expect(actions).toEqual(['release'])
  })

  it('does nothing after it has stopped', () => {
    const { actions, final } = play(
      [
        [1, { type: 'stop' }],
        [2, { type: 'track_ended' }],
        [3, { type: 'devices', hatCamPresent: true }],
        [9000, { type: 'tick' }],
        [9001, { type: 'opened' }],
      ],
      live(),
    )
    expect(final.phase).toBe('stopped')
    expect(actions).toEqual(['release'])
  })
})

it('does not change the state it was given', () => {
  const before = live()
  const copy = { ...before }
  stepWatchdog(before, { type: 'track_ended' }, 500)
  expect(before).toEqual(copy)
})
