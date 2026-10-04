import { describe, expect, it, vi } from 'vitest'
import { startFrameLoop, type FrameEnv } from './frameLoop.ts'

/** A fake requestAnimationFrame that runs at 60 Hz when advanced by hand. */
function fakeEnv() {
  let nextId = 1
  let pending: { id: number; cb: (t: number) => void } | null = null
  let now = 0
  const env: FrameEnv & { hidden: boolean } = {
    hidden: false,
    raf: (cb) => {
      pending = { id: nextId++, cb }
      return pending.id
    },
    caf: (id) => {
      if (pending?.id === id) pending = null
    },
    isHidden: () => env.hidden,
  }
  return {
    env,
    /** Advances the clock by ms, firing a frame every 1000/60 ms. */
    run(ms: number) {
      const end = now + ms
      while (now < end) {
        now += 1000 / 60
        const frame = pending
        pending = null
        frame?.cb(now)
      }
    },
    get hasPending() {
      return pending !== null
    },
  }
}

function video(readyState = 4) {
  const el = document.createElement('video')
  Object.defineProperty(el, 'readyState', { value: readyState, configurable: true })
  return el
}

describe('startFrameLoop', () => {
  it('calls onFrame about 15 times a second on a 60 Hz display', () => {
    const { env, run } = fakeEnv()
    const onFrame = vi.fn()
    startFrameLoop(video(), onFrame, 15, env)
    run(1000)
    expect(onFrame.mock.calls.length).toBeGreaterThanOrEqual(14)
    expect(onFrame.mock.calls.length).toBeLessThanOrEqual(16)
  })

  it('passes the frame timestamp, increasing', () => {
    const { env, run } = fakeEnv()
    const times: number[] = []
    startFrameLoop(video(), (t) => times.push(t), 15, env)
    run(500)
    expect(times.length).toBeGreaterThan(2)
    expect([...times].sort((a, b) => a - b)).toEqual(times)
  })

  it('skips frames until the video has data', () => {
    const { env, run } = fakeEnv()
    const onFrame = vi.fn()
    startFrameLoop(video(1), onFrame, 15, env)
    run(500)
    expect(onFrame).not.toHaveBeenCalled()
  })

  it('pauses while the tab is hidden and resumes when it is visible again', () => {
    const { env, run } = fakeEnv()
    const onFrame = vi.fn()
    startFrameLoop(video(), onFrame, 15, env)
    run(300)
    const before = onFrame.mock.calls.length

    env.hidden = true
    run(500)
    expect(onFrame.mock.calls.length).toBe(before)

    env.hidden = false
    run(300)
    expect(onFrame.mock.calls.length).toBeGreaterThan(before)
  })

  it('stop() ends the loop', () => {
    const fake = fakeEnv()
    const onFrame = vi.fn()
    const stop = startFrameLoop(video(), onFrame, 15, fake.env)
    fake.run(200)
    const before = onFrame.mock.calls.length
    stop()
    fake.run(500)
    expect(onFrame.mock.calls.length).toBe(before)
    expect(fake.hasPending).toBe(false)
  })

  it('keeps running if onFrame throws', () => {
    const { env, run } = fakeEnv()
    const onFrame = vi.fn(() => {
      throw new Error('boom')
    })
    startFrameLoop(video(), onFrame, 15, env)
    expect(() => run(500)).not.toThrow()
    expect(onFrame.mock.calls.length).toBeGreaterThan(3)
  })
})
