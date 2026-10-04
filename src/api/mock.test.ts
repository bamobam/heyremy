import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pancakes } from '../cooking/fixtures.ts'
import { createMockApi } from './mock.ts'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

const frame = new Blob(['jpeg'])
const step = { text: 'Whisk.', cue: 'Smooth' }

describe('mock API', () => {
  it('returns the sample recipe for any text, after a short delay', async () => {
    const api = createMockApi({ delayMs: 400 })
    let done = false
    const result = api.parseRecipe('anything').then((r) => {
      done = true
      return r
    })
    await vi.advanceTimersByTimeAsync(399)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    expect(await result).toEqual(pancakes)
  })

  it('gives a verdict for each step check, walking through not ready, unsure and ready', async () => {
    const api = createMockApi({ delayMs: 0 })
    const statuses: string[] = []
    for (let i = 0; i < 4; i++) {
      const p = api.checkStep(frame, step)
      await vi.advanceTimersByTimeAsync(0)
      statuses.push((await p).status)
    }
    expect(statuses).toEqual(['not_ready', 'unsure', 'ready', 'not_ready'])
  })

  it('always says ready when asked to', async () => {
    const api = createMockApi({ delayMs: 0, verdicts: ['ready'] })
    for (let i = 0; i < 3; i++) {
      const p = api.checkStep(frame, step)
      await vi.advanceTimersByTimeAsync(0)
      expect((await p).status).toBe('ready')
    }
  })

  it('gives feedback to speak, under 15 words', async () => {
    const api = createMockApi({ delayMs: 0 })
    for (let i = 0; i < 3; i++) {
      const p = api.checkStep(frame, step)
      await vi.advanceTimersByTimeAsync(0)
      const { feedback } = await p
      expect(feedback.split(/\s+/).length).toBeLessThan(15)
      expect(feedback.trim().length).toBeGreaterThan(0)
    }
  })

  it('fails every request when asked to, like a backend that is down', async () => {
    const api = createMockApi({ delayMs: 0, fail: true })
    const parse = api.parseRecipe('x').catch((e: unknown) => e)
    const check = api.checkStep(frame, step).catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(0)
    expect(await parse).toMatchObject({ kind: 'upstream' })
    expect(await check).toMatchObject({ kind: 'upstream' })
  })

  it('can be cancelled while it waits', async () => {
    const api = createMockApi({ delayMs: 5000 })
    const abort = new AbortController()
    const outcome = api.checkStep(frame, step, { signal: abort.signal }).catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(100)
    abort.abort()
    expect(await outcome).toMatchObject({ kind: 'aborted' })
  })

  it('does not wait at all when already cancelled', async () => {
    const api = createMockApi({ delayMs: 5000 })
    const abort = new AbortController()
    abort.abort()
    await expect(api.checkStep(frame, step, { signal: abort.signal })).rejects.toMatchObject({ kind: 'aborted' })
  })
})
