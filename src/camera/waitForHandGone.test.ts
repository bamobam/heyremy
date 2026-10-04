import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitForHandGone } from './waitForHandGone.ts'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('waitForHandGone', () => {
  it('returns at once when there is no hand', async () => {
    const result = waitForHandGone(() => false)
    await vi.advanceTimersByTimeAsync(0)
    await expect(result).resolves.toBe('gone')
  })

  it('waits for the hand to leave, then returns', async () => {
    let visible = true
    let settled = false
    const result = waitForHandGone(() => visible).then((r) => {
      settled = true
      return r
    })

    await vi.advanceTimersByTimeAsync(300)
    expect(settled).toBe(false)

    visible = false
    await vi.advanceTimersByTimeAsync(60)
    expect(settled).toBe(true)
    await expect(result).resolves.toBe('gone')
  })

  it('gives up after 1.5 s if the hand stays, so the photo is taken anyway', async () => {
    let settled = false
    const result = waitForHandGone(() => true).then((r) => {
      settled = true
      return r
    })

    await vi.advanceTimersByTimeAsync(1450)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(100)
    expect(settled).toBe(true)
    await expect(result).resolves.toBe('timeout')
  })

  it('uses the time limit it is given', async () => {
    const result = waitForHandGone(() => true, { maxMs: 400 })
    await vi.advanceTimersByTimeAsync(450)
    await expect(result).resolves.toBe('timeout')
  })

  it('checks the hand about every 50 ms, reading the current value each time', async () => {
    const isVisible = vi.fn(() => true)
    void waitForHandGone(isVisible, { maxMs: 500 })
    await vi.advanceTimersByTimeAsync(500)
    expect(isVisible.mock.calls.length).toBeGreaterThanOrEqual(9)
    expect(isVisible.mock.calls.length).toBeLessThanOrEqual(12)
  })

  it('stops checking once it has returned', async () => {
    let visible = true
    const isVisible = vi.fn(() => visible)
    const result = waitForHandGone(isVisible)
    await vi.advanceTimersByTimeAsync(100)
    visible = false
    await vi.advanceTimersByTimeAsync(100)
    await result
    const calls = isVisible.mock.calls.length
    await vi.advanceTimersByTimeAsync(5000)
    expect(isVisible.mock.calls.length).toBe(calls)
  })
})
