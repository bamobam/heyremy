import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pancakes } from '../cooking/fixtures.ts'
import { fakeFetch, hangingFetch } from '../test/fakes/fetch.ts'
import { createApiClient } from './client.ts'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const lastBody = (fetchFn: ReturnType<typeof fakeFetch>) => JSON.parse(fetchFn.mock.calls.at(-1)?.[1]?.body as string)

describe('parseRecipe', () => {
  it('posts the recipe text and returns the parsed recipe', async () => {
    const fetchFn = fakeFetch(async () => json(pancakes))
    const recipe = await createApiClient(fetchFn).parseRecipe('  pancakes  ')
    expect(recipe).toEqual(pancakes)
    expect(fetchFn.mock.calls[0][0]).toBe('/api/parse')
    expect(lastBody(fetchFn)).toEqual({ recipe: 'pancakes' })
  })

  it('refuses empty text without calling the server', async () => {
    const fetchFn = fakeFetch(async () => json({}))
    await expect(createApiClient(fetchFn).parseRecipe('   ')).rejects.toMatchObject({ kind: 'bad_request' })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('refuses text over 10,000 characters without calling the server', async () => {
    const fetchFn = fakeFetch(async () => json({}))
    await expect(createApiClient(fetchFn).parseRecipe('x'.repeat(10_001))).rejects.toMatchObject({ kind: 'bad_request' })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('accepts text of exactly 10,000 characters', async () => {
    const fetchFn = fakeFetch(async () => json(pancakes))
    await createApiClient(fetchFn).parseRecipe('x'.repeat(10_000))
    expect(fetchFn).toHaveBeenCalled()
  })

  it('rejects an answer that is not a recipe, as unprocessable', async () => {
    const fetchFn = fakeFetch(async () => json({ title: 'Pancakes' }))
    await expect(createApiClient(fetchFn).parseRecipe('pancakes')).rejects.toMatchObject({ kind: 'unprocessable' })
  })

  it('passes a server error through', async () => {
    const fetchFn = fakeFetch(async () => json({ error: { kind: 'upstream', message: 'Gemini is down.' } }, 502))
    await expect(createApiClient(fetchFn).parseRecipe('pancakes')).rejects.toMatchObject({
      kind: 'upstream',
      message: 'Gemini is down.',
    })
  })

  it('times out after 20 s', async () => {
    const fetchFn = hangingFetch()
    const outcome = createApiClient(fetchFn).parseRecipe('pancakes').catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(19_900)
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    await vi.advanceTimersByTimeAsync(200)
    expect(await outcome).toMatchObject({ kind: 'timeout' })
  })
})

describe('checkStep', () => {
  const frame = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])], { type: 'image/jpeg' })
  const step = { text: 'Whisk 1 cup flour and 2 eggs into a batter.', cue: 'Batter is smooth' }

  it('posts the photo as base64 with the cue and the step as shown, and returns the verdict', async () => {
    const fetchFn = fakeFetch(async () => json({ status: 'not_ready', feedback: 'Still lumpy.' }))
    const result = createApiClient(fetchFn).checkStep(frame, step)
    await vi.advanceTimersByTimeAsync(10) // lets the file reader finish under fake timers
    const verdict = await result
    expect(verdict).toEqual({ status: 'not_ready', feedback: 'Still lumpy.' })
    expect(fetchFn.mock.calls[0][0]).toBe('/api/check')
    expect(lastBody(fetchFn)).toEqual({ image: '/9j/4AAQ', cue: 'Batter is smooth', step: step.text })
  })

  it('rejects an answer that is not a verdict, as unprocessable', async () => {
    const fetchFn = fakeFetch(async () => json({ ready: true, feedback: 'x' }))
    const outcome = createApiClient(fetchFn).checkStep(frame, step).catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(10)
    expect(await outcome).toMatchObject({ kind: 'unprocessable' })
  })

  it('can be cancelled', async () => {
    const abort = new AbortController()
    const fetchFn = hangingFetch()
    const outcome = createApiClient(fetchFn).checkStep(frame, step, { signal: abort.signal }).catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(50)
    abort.abort()
    expect(await outcome).toMatchObject({ kind: 'aborted' })
  })

  it('times out after 8 s', async () => {
    const fetchFn = hangingFetch()
    const outcome = createApiClient(fetchFn).checkStep(frame, step).catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(8100)
    expect(await outcome).toMatchObject({ kind: 'timeout' })
  })
})
