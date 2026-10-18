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

  it('takes a burst of frames for a step whose cue changes with time, and answers as for one', async () => {
    const api = createMockApi({ delayMs: 0 })
    const statuses: string[] = []
    for (const frames of [frame, [frame, frame, frame], frame]) {
      const p = api.checkStep(frames, step)
      await vi.advanceTimersByTimeAsync(0)
      statuses.push((await p).status)
    }
    expect(statuses).toEqual(['not_ready', 'unsure', 'ready'])
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

  it('words the verdict in the Persona\'s voice when asked, with the same status and under 15 words', async () => {
    const said: Record<string, string[]> = {}
    for (const persona of ['remy', 'grandma', 'sergeant'] as const) {
      const api = createMockApi({ delayMs: 0 })
      said[persona] = []
      for (let i = 0; i < 3; i++) {
        const p = api.checkStep(frame, step, { persona })
        await vi.advanceTimersByTimeAsync(0)
        const verdict = await p
        expect(verdict.feedback.split(/\s+/).length).toBeLessThan(15)
        said[persona].push(`${verdict.status}: ${verdict.feedback}`)
      }
    }
    expect(said.grandma.map((l) => l.split(':')[0])).toEqual(said.remy.map((l) => l.split(':')[0]))
    expect(said.sergeant.map((l) => l.split(':')[0])).toEqual(said.remy.map((l) => l.split(':')[0]))
    expect(said.grandma).not.toEqual(said.remy)
    expect(said.sergeant).not.toEqual(said.grandma)
  })

  it('gives Remy\'s wording when no Persona is asked for', async () => {
    const api = createMockApi({ delayMs: 0, verdicts: ['not_ready'] })
    const p = api.checkStep(frame, step)
    await vi.advanceTimersByTimeAsync(0)
    expect((await p).feedback).toBe('Still some dry flour streaks. Keep whisking.')
  })

  it('serves a recipe with the narration at all three Levels, so the Levels can be tried with ?mock', async () => {
    const api = createMockApi({ delayMs: 0 })
    const p = api.parseRecipe('anything')
    await vi.advanceTimersByTimeAsync(0)
    const recipe = await p
    expect(recipe.steps.some((s) => s.spokenIntermediate !== undefined)).toBe(true)
    expect(recipe.steps.every((s) => s.spokenMaster !== undefined)).toBe(true)
    expect(recipe.steps.some((s) => s.timeDependent)).toBe(true)
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
