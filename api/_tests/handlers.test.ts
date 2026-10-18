// @vitest-environment node -- server code runs on Node, not in the browser
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProviderError, generateJson } from '../_lib/gemini.js'
import { sharedLimiter } from '../_lib/ratelimit.js'
import { synthesize } from '../_lib/elevenlabs.js'
import { FetchRecipeError, fetchRecipeText } from '../_lib/fetchRecipe.js'
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

async function call(
  h: Handler,
  body: unknown,
  opts: { method?: string; type?: string; length?: string; ip?: string } = {},
) {
  const headers: Record<string, string> = { 'content-type': opts.type ?? 'application/json' }
  if (opts.length) headers['content-length'] = opts.length
  if (opts.ip) headers['x-forwarded-for'] = opts.ip
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

// Every setting the limiter reads. Cleared before each test so what the shell exports cannot change a result.
const LIMIT_ENV = [
  'RATE_LIMIT_OFF',
  'RATE_PARSE_PER_MIN',
  'RATE_CHECK_PER_MIN',
  'RATE_SPEAK_PER_MIN',
  'DAILY_CAP_PARSE',
  'DAILY_CAP_CHECK',
  'DAILY_CAP_SPEAK',
]

let logSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  for (const name of LIMIT_ENV) vi.stubEnv(name, undefined)
  sharedLimiter.reset()
})
afterEach(() => {
  vi.resetAllMocks()
  vi.unstubAllEnvs()
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
})

describe('/api/speak', () => {
  it('returns mp3 audio', async () => {
    synth.mockResolvedValue(Buffer.from([1, 2, 3]))
    const res = await call(speak, { text: '  Step 1. Whisk.  ' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['Content-Type']).toBe('audio/mpeg')
    expect(synth).toHaveBeenCalledWith('Step 1. Whisk.')
    expect(oneLog()).toMatchObject({ route: '/api/speak', status: 200 })
  })
  it('400 on a missing or too-long text', async () => {
    expect((await call(speak, {})).statusCode).toBe(400)
    expect((await call(speak, { text: 'x'.repeat(301) })).statusCode).toBe(400)
    expect(synth).not.toHaveBeenCalled()
  })
})

describe.each(routes)('%s: rate limits', (name, h, body) => {
  const route = name as 'parse' | 'check' | 'speak'
  const PER_MIN = { parse: 6, check: 20, speak: 60 }[route]
  const ok = () => {
    gen.mockResolvedValue({ data: route === 'check' ? { status: 'ready', feedback: 'Smooth.' } : RECIPE, modelMs: 1, model: 'gemini-test', attempts: 1 })
    synth.mockResolvedValue(Buffer.from([1, 2, 3]))
  }
  const calls = () => (route === 'speak' ? synth.mock.calls.length : gen.mock.calls.length)

  beforeEach(() => {
    ok()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.UTC(2026, 9, 18, 12, 0, 0))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows the default per-minute number of requests from one client, then answers 429', async () => {
    for (let i = 0; i < PER_MIN; i++) expect((await call(h, body, { ip: '203.0.113.7' })).statusCode).toBe(200)
    const res = await call(h, body, { ip: '203.0.113.7' })
    expect(res.statusCode).toBe(429)
    expect(res.body).toEqual({ error: { kind: 'rate_limited', message: 'Too many requests. Wait a minute and try again.' } })
    expect(Number(res.headers['Retry-After'])).toBeGreaterThanOrEqual(1)
    expect(Number(res.headers['Retry-After'])).toBeLessThanOrEqual(60)
    expect(calls()).toBe(PER_MIN) // the refused request never reached the provider
  })

  it('lets the same client back in once the minute has passed', async () => {
    vi.stubEnv(`RATE_${route.toUpperCase()}_PER_MIN`, '2')
    await call(h, body, { ip: '203.0.113.7' })
    await call(h, body, { ip: '203.0.113.7' })
    expect((await call(h, body, { ip: '203.0.113.7' })).statusCode).toBe(429)
    vi.advanceTimersByTime(60_000)
    expect((await call(h, body, { ip: '203.0.113.7' })).statusCode).toBe(200)
  })

  it('does not hold one client back for another', async () => {
    vi.stubEnv(`RATE_${route.toUpperCase()}_PER_MIN`, '1')
    expect((await call(h, body, { ip: '203.0.113.7, 10.0.0.1' })).statusCode).toBe(200)
    expect((await call(h, body, { ip: '203.0.113.7, 10.0.0.2' })).statusCode).toBe(429)
    expect((await call(h, body, { ip: '198.51.100.4, 10.0.0.1' })).statusCode).toBe(200)
  })

  it('answers the daily cap for everyone with a different message, until the next UTC day', async () => {
    vi.stubEnv(`DAILY_CAP_${route.toUpperCase()}`, '2')
    expect((await call(h, body, { ip: '203.0.113.7' })).statusCode).toBe(200)
    expect((await call(h, body, { ip: '198.51.100.4' })).statusCode).toBe(200)
    const res = await call(h, body, { ip: '192.0.2.99' })
    expect(res.statusCode).toBe(429)
    expect(res.body).toEqual({ error: { kind: 'rate_limited', message: "Remy has reached today's limit. Try again tomorrow." } })
    expect(res.headers['Retry-After']).toBe(String(12 * 60 * 60))
    expect(calls()).toBe(2)
    vi.setSystemTime(Date.UTC(2026, 9, 19, 0, 0, 0))
    expect((await call(h, body, { ip: '192.0.2.99' })).statusCode).toBe(200)
  })

  it('logs the route, status and reason, and never the address', async () => {
    vi.stubEnv(`RATE_${route.toUpperCase()}_PER_MIN`, '1')
    await call(h, body, { ip: '203.0.113.7' })
    logSpy.mockClear()
    await call(h, body, { ip: '203.0.113.7' })
    const line = oneLog()
    expect(line).toMatchObject({ route: `/api/${route}`, status: 429, limit: 'per_minute' })
    expect(JSON.stringify(line)).not.toContain('203.0.113.7')
    vi.stubEnv(`DAILY_CAP_${route.toUpperCase()}`, '1')
    logSpy.mockClear()
    await call(h, body, { ip: '198.51.100.4' })
    expect(oneLog()).toMatchObject({ status: 429, limit: 'daily' })
  })

  it('does not put a limit field in the log of a request that was allowed', async () => {
    await call(h, body, { ip: '203.0.113.7' })
    expect(oneLog().limit).toBeUndefined()
  })

  it('refuses before reading the body, so a bad body from a limited client is a 429, not a 400', async () => {
    vi.stubEnv(`RATE_${route.toUpperCase()}_PER_MIN`, '1')
    await call(h, body, { ip: '203.0.113.7' })
    expect((await call(h, 'not an object', { ip: '203.0.113.7' })).statusCode).toBe(429)
  })

  it('does not count a wrong method or content type against the client', async () => {
    vi.stubEnv(`RATE_${route.toUpperCase()}_PER_MIN`, '1')
    for (let i = 0; i < 3; i++) {
      expect((await call(h, body, { method: 'GET', ip: '203.0.113.7' })).statusCode).toBe(405)
      expect((await call(h, body, { type: 'text/plain', ip: '203.0.113.7' })).statusCode).toBe(415)
    }
    expect((await call(h, body, { ip: '203.0.113.7' })).statusCode).toBe(200)
  })

  it('does nothing when RATE_LIMIT_OFF=1', async () => {
    vi.stubEnv('RATE_LIMIT_OFF', '1')
    vi.stubEnv(`RATE_${route.toUpperCase()}_PER_MIN`, '1')
    vi.stubEnv(`DAILY_CAP_${route.toUpperCase()}`, '1')
    for (let i = 0; i < 4; i++) expect((await call(h, body, { ip: '203.0.113.7' })).statusCode).toBe(200)
  })

  it('falls back to the defaults for an invalid override', async () => {
    vi.stubEnv(`RATE_${route.toUpperCase()}_PER_MIN`, '0')
    vi.stubEnv(`DAILY_CAP_${route.toUpperCase()}`, 'many')
    for (let i = 0; i < PER_MIN; i++) expect((await call(h, body, { ip: '203.0.113.7' })).statusCode).toBe(200)
    expect((await call(h, body, { ip: '203.0.113.7' })).statusCode).toBe(429)
  })

  it('tells a provider that is out of capacity apart from our own limit', async () => {
    gen.mockRejectedValue(new ProviderError('rate_limited', 'provider slow down'))
    synth.mockRejectedValue(new ProviderError('rate_limited', 'provider slow down'))
    const res = await call(h, body, { ip: '203.0.113.7' })
    expect(res.statusCode).toBe(429)
    expect(res.headers['Retry-After']).toBeUndefined()
    expect(oneLog().limit).toBeUndefined()
  })
})
