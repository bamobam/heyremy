// @vitest-environment node -- server code runs on Node, not in the browser
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProviderError, generateJson } from '../_lib/gemini.js'
import { synthesize } from '../_lib/elevenlabs.js'
import { FetchRecipeError, fetchRecipeText } from '../_lib/fetchRecipe.js'
import { DEFAULT_VOICE_ID as VOICE_ID } from '../_lib/voices.js'
import { CHECK_SYSTEM } from '../_prompts/check.js'
import { PERSONA_STYLE } from '../_prompts/persona.js'
import check from '../check.js'
import parse from '../parse.js'
import speak from '../speak.js'

vi.mock('../_lib/gemini.js', async (orig) => ({ ...(await orig<typeof import('../_lib/gemini.js')>()), generateJson: vi.fn() }))
vi.mock('../_lib/elevenlabs.js', () => ({ synthesize: vi.fn() }))
// Keep the real isRecipeUrl and FetchRecipeError; only the network fetch is faked.
vi.mock('../_lib/fetchRecipe.js', async (orig) => ({ ...(await orig<typeof import('../_lib/fetchRecipe.js')>()), fetchRecipeText: vi.fn() }))

const gen = vi.mocked(generateJson)
const synth = vi.mocked(synthesize)
const fetchPage = vi.mocked(fetchRecipeText)

function fakeRes() {
  const r = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(k: string, v: string) { r.headers[k] = v; return r },
    status(code: number) { r.statusCode = code; return r },
    json(b: unknown) { r.body = b; return r },
    send(b: unknown) { r.body = b; return r },
  }
  return r
}

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>

async function call(h: Handler, body: unknown, opts: { method?: string; type?: string; length?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': opts.type ?? 'application/json' }
  if (opts.length) headers['content-length'] = opts.length
  const req = { method: opts.method ?? 'POST', headers, body } as unknown as VercelRequest
  const res = fakeRes()
  await h(req, res as unknown as VercelResponse)
  return res
}

const RECIPE_TEXT = 'Secret family pancakes: whisk 1 cup flour with milk.'
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString('base64')
const NOT_JPEG = Buffer.from('hello!').toString('base64')
const RECIPE = {
  title: 'Pancakes',
  servings: 2,
  ingredients: [{ id: 'flour', amount: 1, unit: 'cup', name: 'flour' }],
  prep: [],
  steps: [{ id: 1, text: 'Whisk {flour}.', spoken: 'Step 1. Whisk {flour}.', cue: 'Smooth', checkable: true, headsUp: null }],
}
const CHECK_BODY = { image: JPEG, cue: 'Smooth, no lumps', step: 'Whisk the batter.' }

let logSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => {
  vi.resetAllMocks()
  logSpy.mockRestore()
})

/** Asserts exactly one log line, returns it parsed. */
function oneLog(): Record<string, unknown> {
  expect(logSpy).toHaveBeenCalledTimes(1)
  return JSON.parse(String(logSpy.mock.calls[0][0]))
}

const routes: [string, Handler, unknown][] = [
  ['parse', parse, { recipe: RECIPE_TEXT }],
  ['check', check, CHECK_BODY],
  ['speak', speak, { text: 'Step 1. Whisk.' }],
]

describe.each(routes)('%s: shared guards and errors', (_name, h, body) => {
  it('405 on GET', async () => {
    expect((await call(h, body, { method: 'GET' })).statusCode).toBe(405)
    oneLog()
  })
  it('415 on a non-JSON content type', async () => {
    expect((await call(h, body, { type: 'text/plain' })).statusCode).toBe(415)
    oneLog()
  })
  it('400 on a non-object body', async () => {
    expect((await call(h, 'just a string')).statusCode).toBe(400)
    oneLog()
  })
  it('429 on a rate-limited provider', async () => {
    gen.mockRejectedValue(new ProviderError('rate_limited', 'slow down'))
    synth.mockRejectedValue(new ProviderError('rate_limited', 'slow down'))
    const res = await call(h, body)
    expect(res.statusCode).toBe(429)
    expect(res.body).toEqual({ error: { kind: 'rate_limited', message: 'slow down' } })
    expect(oneLog().status).toBe(429)
  })
  it('502 on an upstream failure', async () => {
    gen.mockRejectedValue(new ProviderError('upstream', 'down'))
    synth.mockRejectedValue(new ProviderError('upstream', 'down'))
    expect((await call(h, body)).statusCode).toBe(502)
    oneLog()
  })
  it('500 with a generic message on an unexpected throw', async () => {
    gen.mockRejectedValue(new Error('boom: internal detail'))
    synth.mockRejectedValue(new Error('boom: internal detail'))
    const res = await call(h, body)
    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: { kind: 'unknown', message: 'Something went wrong.' } })
    oneLog()
  })
})

describe('/api/parse', () => {
  it('returns the validated recipe and logs without recipe text', async () => {
    gen.mockResolvedValue({ data: RECIPE, modelMs: 42, model: 'gemini-test', attempts: 1 })
    const res = await call(parse, { recipe: `  ${RECIPE_TEXT}  ` })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(RECIPE)
    const args = gen.mock.calls[0][0]
    expect(args.parts[0]).toContain(`<recipe>\n${RECIPE_TEXT}\n</recipe>`)
    expect(args.timeoutMs).toBeLessThan(20_000)
    // The fallback gets whatever the first attempt leaves of the budget.
    expect(args.firstAttemptMs).toBeLessThan(args.timeoutMs)
    expect(args.retryOnTimeout).toBe(true)
    expect(args.maxOutputTokens).toBeGreaterThan(0)
    const line = oneLog()
    expect(line).toMatchObject({ route: '/api/parse', status: 200, modelMs: 42, model: 'gemini-test', attempts: 1, source: 'text' })
    expect(JSON.stringify(line)).not.toContain('pancakes')
    expect(fetchPage).not.toHaveBeenCalled()
  })
  it('fetches a lone recipe link and parses the page text, with the remaining budget', async () => {
    const URL = 'https://example.com/secret-pancakes'
    fetchPage.mockResolvedValue({ text: 'Pancakes\nIngredients:\n- 1 cup flour', source: 'json-ld' })
    gen.mockResolvedValue({ data: RECIPE, modelMs: 42, model: 'gemini-test', attempts: 1 })
    const res = await call(parse, { recipe: `  ${URL}  ` })
    expect(res.statusCode).toBe(200)
    expect(fetchPage).toHaveBeenCalledWith(URL)
    const args = gen.mock.calls[0][0]
    expect(args.parts[0]).toBe('<recipe>\nPancakes\nIngredients:\n- 1 cup flour\n</recipe>')
    expect(args.timeoutMs).toBeLessThanOrEqual(18_000)
    expect(args.firstAttemptMs).toBeLessThanOrEqual(args.timeoutMs)
    const line = oneLog()
    expect(line).toMatchObject({ status: 200, source: 'json-ld' })
    expect(JSON.stringify(line)).not.toMatch(/example\.com|flour/)
  })
  it('treats text containing a link as a pasted recipe', async () => {
    gen.mockResolvedValue({ data: RECIPE, modelMs: 1, model: 'gemini-test', attempts: 1 })
    await call(parse, { recipe: 'From https://example.com: whisk 1 cup flour.' })
    expect(fetchPage).not.toHaveBeenCalled()
  })
  it.each([
    ['bad_request', 400],
    ['unprocessable', 422],
  ] as const)('maps a %s page error to %i without calling Gemini', async (kind, status) => {
    fetchPage.mockRejectedValue(new FetchRecipeError(kind, 'nope'))
    const res = await call(parse, { recipe: 'https://example.com/r' })
    expect(res.statusCode).toBe(status)
    expect(res.body).toEqual({ error: { kind, message: 'nope' } })
    expect(gen).not.toHaveBeenCalled()
    const line = oneLog()
    expect(line.status).toBe(status)
    expect(line.source).toBeUndefined()
  })
  it('gives up before Gemini when the fetch used too much of the budget', async () => {
    const now = vi.spyOn(Date, 'now')
    let t = 0
    now.mockImplementation(() => t)
    fetchPage.mockImplementation(async () => {
      t += 13_000
      return { text: 'x', source: 'page-text' as const }
    })
    const res = await call(parse, { recipe: 'https://example.com/slow' })
    expect(res.statusCode).toBe(422)
    expect(gen).not.toHaveBeenCalled()
    now.mockRestore()
  })
  it('400 on a missing or too-long recipe', async () => {
    expect((await call(parse, {})).statusCode).toBe(400)
    expect((await call(parse, { recipe: 'x'.repeat(10_001) })).statusCode).toBe(400)
    expect(gen).not.toHaveBeenCalled()
  })
  it('422 when the model returns junk', async () => {
    gen.mockResolvedValue({ data: { title: 'x', steps: [] }, modelMs: 1, model: 'gemini-test', attempts: 1 })
    const res = await call(parse, { recipe: RECIPE_TEXT })
    expect(res.statusCode).toBe(422)
    expect(oneLog().status).toBe(422)
  })
  it('sends each step\'s narration at all three Levels, and timeDependent, as the model wrote them', async () => {
    const leveled = {
      ...RECIPE,
      steps: [
        {
          ...RECIPE.steps[0],
          spoken: 'Step 1. Whisk {flour} until smooth. A few lumps are fine.',
          spokenIntermediate: 'Step 1. Whisk {flour} until smooth.',
          spokenMaster: 'Step 1. Whisk {flour}.',
          timeDependent: true,
        },
      ],
    }
    gen.mockResolvedValue({ data: leveled, modelMs: 1, model: 'gemini-test', attempts: 1 })
    const res = await call(parse, { recipe: RECIPE_TEXT })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(leveled)
    // The model is asked for these fields through the response schema, not only the prompt.
    const step = (gen.mock.calls[0][0].schema as { properties: { steps: { items: { required: string[] } } } }).properties.steps.items
    expect(step.required).toEqual(expect.arrayContaining(['spokenIntermediate', 'spokenMaster', 'timeDependent']))
    expect(gen.mock.calls[0][0].system).toContain('"spokenMaster"')
  })
  it('still works when the model leaves the other Levels out, which the client reads as the beginner narration', async () => {
    gen.mockResolvedValue({ data: RECIPE, modelMs: 1, model: 'gemini-test', attempts: 1 })
    const res = await call(parse, { recipe: RECIPE_TEXT })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(RECIPE)
  })
})

describe('/api/check', () => {
  it('logs the attempt count when the fallback also failed', async () => {
    const e = new ProviderError('upstream', 'Gemini (fallback) returned 503.')
    e.attempts = 2
    gen.mockRejectedValue(e)
    expect((await call(check, CHECK_BODY)).statusCode).toBe(502)
    expect(oneLog()).toMatchObject({ status: 502, attempts: 2 })
  })
  it('returns the verdict and logs its status without image data', async () => {
    gen.mockResolvedValue({ data: { status: 'not_ready', feedback: 'Still lumpy. Keep whisking.' }, modelMs: 900, model: 'gemini-test', attempts: 1 })
    const res = await call(check, CHECK_BODY)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ status: 'not_ready', feedback: 'Still lumpy. Keep whisking.' })
    const parts = gen.mock.calls[0][0].parts
    expect(parts.at(-1)).toEqual({ inlineData: { mimeType: 'image/jpeg', data: JPEG } })
    // Two slow attempts would outlast the client's 8 s, so no retry after a timeout.
    expect(gen.mock.calls[0][0].retryOnTimeout).toBeFalsy()
    expect(gen.mock.calls[0][0].timeoutMs).toBeLessThan(8_000)
    const line = oneLog()
    expect(line).toMatchObject({ route: '/api/check', status: 200, verdict: 'not_ready', modelMs: 900, model: 'gemini-test', attempts: 1 })
    expect(JSON.stringify(line)).not.toContain(JPEG)
  })
  it('400 on a missing or too-long field', async () => {
    expect((await call(check, { ...CHECK_BODY, cue: undefined })).statusCode).toBe(400)
    expect((await call(check, { ...CHECK_BODY, step: 'x'.repeat(301) })).statusCode).toBe(400)
    expect(gen).not.toHaveBeenCalled()
  })
  it('400 on a non-JPEG image', async () => {
    expect((await call(check, { ...CHECK_BODY, image: NOT_JPEG })).statusCode).toBe(400)
    expect(gen).not.toHaveBeenCalled()
  })
  it('400 on an oversized body', async () => {
    const res = await call(check, CHECK_BODY, { length: String(2 * 1024 * 1024) })
    expect(res.statusCode).toBe(400)
    expect(gen).not.toHaveBeenCalled()
    oneLog()
  })
  it('422 when the model returns junk', async () => {
    gen.mockResolvedValue({ data: { status: 'maybe', feedback: 'hm' }, modelMs: 1, model: 'gemini-test', attempts: 1 })
    expect((await call(check, CHECK_BODY)).statusCode).toBe(422)
    expect(oneLog().verdict).toBeUndefined()
  })
  describe('persona', () => {
    const answer = { data: { status: 'not_ready', feedback: 'Not quite yet, dear. Keep whisking.' }, modelMs: 1, model: 'gemini-test', attempts: 1 }

    it('uses the plain prompt with no persona, and for Remy', async () => {
      gen.mockResolvedValue(answer)
      await call(check, CHECK_BODY)
      await call(check, { ...CHECK_BODY, persona: 'remy' })
      expect(gen.mock.calls[0][0].system).toBe(CHECK_SYSTEM)
      expect(gen.mock.calls[1][0].system).toBe(CHECK_SYSTEM)
    })
    it.each(['grandma', 'sergeant'] as const)('words feedback as %s, with the same photo, cue and schema', async (persona) => {
      gen.mockResolvedValue(answer)
      const plain = await call(check, CHECK_BODY)
      const res = await call(check, { ...CHECK_BODY, persona })
      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({ status: 'not_ready', feedback: 'Not quite yet, dear. Keep whisking.' })
      const [first, second] = gen.mock.calls.map((c) => c[0])
      expect(second.system).toBe(`${CHECK_SYSTEM}\n\n${PERSONA_STYLE[persona]}`)
      expect(second.parts).toEqual(first.parts)
      expect(second.schema).toBe(first.schema)
      expect(second.temperature).toBe(first.temperature)
      expect(plain.statusCode).toBe(200)
    })
    it('400 on a persona it does not know, without calling Gemini', async () => {
      for (const persona of ['gordon', 7, {}, '']) {
        const res = await call(check, { ...CHECK_BODY, persona })
        expect(res.statusCode).toBe(400)
        expect(res.body).toEqual({ error: { kind: 'bad_request', message: 'persona must be remy, grandma or sergeant.' } })
      }
      expect(gen).not.toHaveBeenCalled()
    })
    it('does not log the persona or the feedback', async () => {
      gen.mockResolvedValue(answer)
      await call(check, { ...CHECK_BODY, persona: 'grandma' })
      expect(JSON.stringify(oneLog())).not.toMatch(/grandma|dear/)
    })
  })
})

describe('/api/speak', () => {
  it('returns mp3 audio', async () => {
    synth.mockResolvedValue(Buffer.from([1, 2, 3]))
    const res = await call(speak, { text: '  Step 1. Whisk.  ' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['Content-Type']).toBe('audio/mpeg')
    expect(synth).toHaveBeenCalledWith('Step 1. Whisk.', VOICE_ID)
    expect(oneLog()).toMatchObject({ route: '/api/speak', status: 200 })
  })
  describe('persona', () => {
    const GRANDMA = 'GrandmaVoice1234567890'
    const SERGEANT = 'SergeantVoice123456789'
    afterEach(() => vi.unstubAllEnvs())

    it('speaks in the default voice for Remy and when no persona is given', async () => {
      synth.mockResolvedValue(Buffer.from([1]))
      vi.stubEnv('ELEVENLABS_VOICE_GRANDMA', GRANDMA)
      await call(speak, { text: 'Hello.' })
      await call(speak, { text: 'Hello.', persona: 'remy' })
      expect(synth.mock.calls).toEqual([['Hello.', VOICE_ID], ['Hello.', VOICE_ID]])
    })
    it('speaks in the persona\'s own voice once the owner has set it up', async () => {
      synth.mockResolvedValue(Buffer.from([1]))
      vi.stubEnv('ELEVENLABS_VOICE_GRANDMA', GRANDMA)
      vi.stubEnv('ELEVENLABS_VOICE_SERGEANT', SERGEANT)
      await call(speak, { text: 'Hello.', persona: 'grandma' })
      await call(speak, { text: 'Hello.', persona: 'sergeant' })
      expect(synth.mock.calls).toEqual([['Hello.', GRANDMA], ['Hello.', SERGEANT]])
    })
    it('falls back to the default voice for a persona whose voice is not set up, so nothing changes until it is', async () => {
      synth.mockResolvedValue(Buffer.from([1]))
      vi.stubEnv('ELEVENLABS_VOICE_GRANDMA', '')
      vi.stubEnv('ELEVENLABS_VOICE_SERGEANT', '')
      expect((await call(speak, { text: 'Hello.', persona: 'grandma' })).statusCode).toBe(200)
      expect((await call(speak, { text: 'Hello.', persona: 'sergeant' })).statusCode).toBe(200)
      expect(synth.mock.calls).toEqual([['Hello.', VOICE_ID], ['Hello.', VOICE_ID]])
    })
    it('400 on a persona it does not know, without calling ElevenLabs', async () => {
      for (const persona of ['gordon', 7, {}, '']) {
        const res = await call(speak, { text: 'Hello.', persona })
        expect(res.statusCode).toBe(400)
        expect(res.body).toEqual({ error: { kind: 'bad_request', message: 'persona must be remy, grandma or sergeant.' } })
      }
      expect(synth).not.toHaveBeenCalled()
    })
    it('does not log the persona, the text or the voice id', async () => {
      synth.mockResolvedValue(Buffer.from([1]))
      vi.stubEnv('ELEVENLABS_VOICE_GRANDMA', GRANDMA)
      await call(speak, { text: 'Secret words.', persona: 'grandma' })
      expect(JSON.stringify(oneLog())).not.toMatch(/grandma|Secret|GrandmaVoice/i)
    })
  })
  it('400 on a missing or too-long text', async () => {
    expect((await call(speak, {})).statusCode).toBe(400)
    expect((await call(speak, { text: 'x'.repeat(301) })).statusCode).toBe(400)
    expect(synth).not.toHaveBeenCalled()
  })
})
