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

  it('hands back the narration at every Level and timeDependent as the server sent them', async () => {
    const fetchFn = fakeFetch(async () => json(pancakes))
    const recipe = await createApiClient(fetchFn).parseRecipe('pancakes')
    expect(recipe.steps[0].spokenIntermediate).toBe(pancakes.steps[0].spokenIntermediate)
    expect(recipe.steps[0].spokenMaster).toBe(pancakes.steps[0].spokenMaster)
    expect(recipe.steps[3].timeDependent).toBe(true)
  })

  it('accepts a recipe from before Levels existed, with no other narrations', async () => {
    const old = structuredClone(pancakes)
    for (const step of old.steps) {
      delete step.spokenIntermediate
      delete step.spokenMaster
      delete step.timeDependent
    }
    const fetchFn = fakeFetch(async () => json(old))
    await expect(createApiClient(fetchFn).parseRecipe('pancakes')).resolves.toEqual(old)
  })

  it('does not send the Level or Persona with a recipe: one parse serves every Level', async () => {
    const fetchFn = fakeFetch(async () => json(pancakes))
    await createApiClient(fetchFn).parseRecipe('pancakes')
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

describe('when the server limits the cook', () => {
  const perMinute = 'Too many requests. Wait a minute and try again.'
  const daily = "Remy has reached today's limit. Try again tomorrow."
  const limited = (message: string) => fakeFetch(async () => json({ error: { kind: 'rate_limited', message } }, 429))
  const frame = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])], { type: 'image/jpeg' })

  it('parseRecipe throws a rate_limited error carrying the server message', async () => {
    await expect(createApiClient(limited(perMinute)).parseRecipe('pancakes')).rejects.toMatchObject({ kind: 'rate_limited', message: perMinute })
    await expect(createApiClient(limited(daily)).parseRecipe('pancakes')).rejects.toMatchObject({ kind: 'rate_limited', message: daily })
  })

  it('checkStep throws a rate_limited error carrying the server message', async () => {
    const outcome = createApiClient(limited(daily)).checkStep(frame, { text: 'Whisk.', cue: 'Smooth' }).catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(10)
    expect(await outcome).toMatchObject({ kind: 'rate_limited', message: daily })
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

  it('sends the Persona so the verdict is worded in character, unless it is Remy\'s', async () => {
    for (const persona of ['grandma', 'sergeant'] as const) {
      const fetchFn = fakeFetch(async () => json({ status: 'ready', feedback: 'Perfect.' }))
      const result = createApiClient(fetchFn).checkStep(frame, step, { persona })
      await vi.advanceTimersByTimeAsync(10)
      await result
      expect(lastBody(fetchFn)).toEqual({ image: '/9j/4AAQ', cue: 'Batter is smooth', step: step.text, persona })
    }
  })

  it('sends no persona for Remy or when none is given, so the request is the one it always was', async () => {
    for (const opts of [{ persona: 'remy' as const }, {}, undefined]) {
      const fetchFn = fakeFetch(async () => json({ status: 'ready', feedback: 'Perfect.' }))
      const result = createApiClient(fetchFn).checkStep(frame, step, opts)
      await vi.advanceTimersByTimeAsync(10)
      await result
      expect(lastBody(fetchFn)).toEqual({ image: '/9j/4AAQ', cue: 'Batter is smooth', step: step.text })
    }
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

  describe('with several frames', () => {
    const jpegBlob = (last: number) => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, last])], { type: 'image/jpeg' })
    // The base64 of each blob above, by its last byte.
    const b64 = { 0x10: '/9j/4AAQ', 0x11: '/9j/4AAR', 0x12: '/9j/4AAS' } as const
    const burst = [jpegBlob(0x10), jpegBlob(0x11), jpegBlob(0x12)]

    it('posts the frames as base64, in order, as images and with no image', async () => {
      const fetchFn = fakeFetch(async () => json({ status: 'ready', feedback: 'A rolling boil. Go on.' }))
      const result = createApiClient(fetchFn).checkStep(burst, step)
      await vi.advanceTimersByTimeAsync(10)
      expect(await result).toEqual({ status: 'ready', feedback: 'A rolling boil. Go on.' })
      expect(fetchFn.mock.calls[0][0]).toBe('/api/check')
      expect(lastBody(fetchFn)).toEqual({ images: [b64[0x10], b64[0x11], b64[0x12]], cue: 'Batter is smooth', step: step.text })
    })

    it('sends the Persona with the frames, unless it is Remy\'s', async () => {
      for (const [persona, extra] of [['grandma', { persona: 'grandma' }], ['remy', {}]] as const) {
        const fetchFn = fakeFetch(async () => json({ status: 'ready', feedback: 'A rolling boil. Go on.' }))
        const result = createApiClient(fetchFn).checkStep(burst, step, { persona })
        await vi.advanceTimersByTimeAsync(10)
        await result
        expect(lastBody(fetchFn)).toEqual({ images: [b64[0x10], b64[0x11], b64[0x12]], cue: 'Batter is smooth', step: step.text, ...extra })
      }
    })

    it('sends the Persona with a list of one frame too', async () => {
      const fetchFn = fakeFetch(async () => json({ status: 'ready', feedback: 'Smooth.' }))
      const result = createApiClient(fetchFn).checkStep([frame], step, { persona: 'sergeant' })
      await vi.advanceTimersByTimeAsync(10)
      await result
      expect(lastBody(fetchFn)).toEqual({ image: '/9j/4AAQ', cue: 'Batter is smooth', step: step.text, persona: 'sergeant' })
    })

    it('posts a list of one frame as a single image', async () => {
      const fetchFn = fakeFetch(async () => json({ status: 'ready', feedback: 'Smooth.' }))
      const result = createApiClient(fetchFn).checkStep([frame], step)
      await vi.advanceTimersByTimeAsync(10)
      await result
      expect(lastBody(fetchFn)).toEqual({ image: '/9j/4AAQ', cue: 'Batter is smooth', step: step.text })
    })

    it.each([
      ['no frames', []],
      ['more than 4 frames', Array.from({ length: 5 }, () => frame)],
    ])('refuses %s without calling the server', async (_name, frames) => {
      const fetchFn = fakeFetch(async () => json({}))
      await expect(createApiClient(fetchFn).checkStep(frames, step)).rejects.toMatchObject({ kind: 'bad_request' })
      expect(fetchFn).not.toHaveBeenCalled()
    })

    it('rejects an answer that is not a verdict, as unprocessable', async () => {
      const fetchFn = fakeFetch(async () => json({ nope: true }))
      const outcome = createApiClient(fetchFn).checkStep(burst, step).catch((e: unknown) => e)
      await vi.advanceTimersByTimeAsync(10)
      expect(await outcome).toMatchObject({ kind: 'unprocessable' })
    })

    it('can be cancelled', async () => {
      const abort = new AbortController()
      const fetchFn = hangingFetch()
      const outcome = createApiClient(fetchFn).checkStep(burst, step, { signal: abort.signal }).catch((e: unknown) => e)
      await vi.advanceTimersByTimeAsync(50)
      abort.abort()
      expect(await outcome).toMatchObject({ kind: 'aborted' })
    })

    it('waits 10 s, not 8, for the answer', async () => {
      const fetchFn = hangingFetch()
      let settled = false
      const outcome = createApiClient(fetchFn).checkStep(burst, step).catch((e: unknown) => e)
      void outcome.then(() => (settled = true))
      await vi.advanceTimersByTimeAsync(9_900)
      expect(settled).toBe(false)
      await vi.advanceTimersByTimeAsync(200)
      expect(await outcome).toMatchObject({ kind: 'timeout' })
    })
  })
})
