// @vitest-environment node -- server code runs on Node, not in the browser
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_MODEL, GEMINI_MODEL, ProviderError, generateJson, retry } from './gemini.ts'

const opts = {
  system: 'sys',
  parts: ['hello', { inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } }],
  schema: { type: 'OBJECT' },
  temperature: 0.2,
  maxOutputTokens: 256,
  // Too short for a retry (MIN_RETRY_MS), so these tests see one call each.
  timeoutMs: 1000,
}

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
const candidate = (...texts: string[]) => ({ candidates: [{ content: { parts: texts.map((text) => ({ text })) } }] })

async function kindOf(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    expect(e).toBeInstanceOf(ProviderError)
    return (e as ProviderError).kind
  }
  throw new Error('expected a rejection')
}

beforeEach(() => vi.stubEnv('GEMINI_API_KEY', 'test-key'))
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('generateJson', () => {
  it('sends the expected request', async () => {
    const fetch = vi.fn().mockResolvedValue(ok(candidate('{"a":1}')))
    vi.stubGlobal('fetch', fetch)
    await generateJson(opts)

    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`)
    expect(init.method).toBe('POST')
    expect(init.headers['x-goog-api-key']).toBe('test-key')
    const body = JSON.parse(init.body)
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'sys' }] })
    expect(body.contents).toEqual([
      { role: 'user', parts: [{ text: 'hello' }, { inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } }] },
    ])
    expect(body.generationConfig).toEqual({
      responseMimeType: 'application/json',
      responseSchema: { type: 'OBJECT' },
      temperature: 0.2,
      maxOutputTokens: 256,
      thinkingConfig: { thinkingLevel: 'low' },
    })
  })

  it('joins text parts and parses JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(candidate('{"status":', '"ready"}'))))
    const { data, modelMs, model, attempts } = await generateJson(opts)
    expect(data).toEqual({ status: 'ready' })
    expect(modelMs).toBeGreaterThanOrEqual(0)
    expect(model).toBe(GEMINI_MODEL)
    expect(attempts).toBe(1)
  })

  it('maps 429 to rate_limited', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })))
    expect(await kindOf(generateJson(opts))).toBe('rate_limited')
  })

  it('maps 500 to upstream', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })))
    expect(await kindOf(generateJson(opts))).toBe('upstream')
  })

  it('rejects invalid JSON text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(candidate('not json'))))
    expect(await kindOf(generateJson(opts))).toBe('upstream')
  })

  it('rejects output cut off at the token limit', async () => {
    const cut = { candidates: [{ content: { parts: [{ text: '{"status":' }] }, finishReason: 'MAX_TOKENS' }] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(cut)))
    await expect(generateJson(opts)).rejects.toThrow(/token limit/)
  })

  it('rejects a blocked prompt and an empty candidate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ promptFeedback: { blockReason: 'SAFETY' } })))
    expect(await kindOf(generateJson(opts))).toBe('upstream')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ candidates: [] })))
    expect(await kindOf(generateJson(opts))).toBe('upstream')
  })

  it('rejects when the key is missing, without calling fetch', async () => {
    vi.stubEnv('GEMINI_API_KEY', '')
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect(await kindOf(generateJson(opts))).toBe('upstream')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('maps a timeout or network error to upstream', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError')))
    expect(await kindOf(generateJson(opts))).toBe('upstream')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    expect(await kindOf(generateJson(opts))).toBe('upstream')
  })
})

describe('generateJson fallback', () => {
  const roomy = { ...opts, timeoutMs: 10_000 }
  const realDelay = retry.delayMs
  beforeEach(() => {
    retry.delayMs = () => 0
  })
  afterEach(() => {
    retry.delayMs = realDelay
  })
  const status = (code: number) => new Response('', { status: code })
  const modelOf = (fetch: ReturnType<typeof vi.fn>, call: number) => String(fetch.mock.calls[call][0])

  it.each([503, 500, 429])('retries a %i once on the fallback model', async (code) => {
    const fetch = vi.fn().mockResolvedValueOnce(status(code)).mockResolvedValueOnce(ok(candidate('{"a":1}')))
    vi.stubGlobal('fetch', fetch)
    const out = await generateJson(roomy)
    expect(out).toMatchObject({ data: { a: 1 }, model: FALLBACK_MODEL, attempts: 2 })
    expect(modelOf(fetch, 0)).toContain(`/${GEMINI_MODEL}:`)
    expect(modelOf(fetch, 1)).toContain(`/${FALLBACK_MODEL}:`)
  })

  it('retries a network error', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce(ok(candidate('{}')))
    vi.stubGlobal('fetch', fetch)
    expect((await generateJson(roomy)).attempts).toBe(2)
  })

  it('reports the second failure with attempts 2 when both fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(status(503)).mockResolvedValueOnce(status(429)))
    const e = await generateJson(roomy).catch((x: unknown) => x)
    expect(e).toBeInstanceOf(ProviderError)
    expect((e as ProviderError).kind).toBe('rate_limited')
    expect((e as ProviderError).message).toContain('fallback')
    expect((e as ProviderError).attempts).toBe(2)
  })

  it.each([
    ['a 400', () => status(400)],
    ['invalid JSON output', () => ok(candidate('nope'))],
    ['a cut-off output', () => ok({ candidates: [{ content: { parts: [{ text: '{' }] }, finishReason: 'MAX_TOKENS' }] })],
  ])('does not retry %s', async (_, make) => {
    const fetch = vi.fn().mockResolvedValue(make())
    vi.stubGlobal('fetch', fetch)
    const e = await generateJson(roomy).catch((x: unknown) => x)
    expect((e as ProviderError).attempts).toBe(1)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('retries a timeout only when retryOnTimeout is set', async () => {
    const timeout = () => Promise.reject(new DOMException('timed out', 'TimeoutError'))
    let fetch = vi.fn().mockImplementationOnce(timeout).mockResolvedValueOnce(ok(candidate('{}')))
    vi.stubGlobal('fetch', fetch)
    const e = await generateJson(roomy).catch((x: unknown) => x)
    expect((e as ProviderError).timedOut).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)

    fetch = vi.fn().mockImplementationOnce(timeout).mockResolvedValueOnce(ok(candidate('{}')))
    vi.stubGlobal('fetch', fetch)
    expect((await generateJson({ ...roomy, retryOnTimeout: true })).model).toBe(FALLBACK_MODEL)
  })

  it('skips the retry when too little of the budget is left', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(status(503)).mockResolvedValueOnce(ok(candidate('{}')))
    vi.stubGlobal('fetch', fetch)
    const e = await generateJson({ ...roomy, timeoutMs: 1500 }).catch((x: unknown) => x)
    expect((e as ProviderError).attempts).toBe(1)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
