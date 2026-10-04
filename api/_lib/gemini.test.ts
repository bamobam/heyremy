import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GEMINI_MODEL, ProviderError, generateJson } from './gemini.ts'

const opts = {
  system: 'sys',
  parts: ['hello', { inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } }],
  schema: { type: 'OBJECT' },
  temperature: 0.2,
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
    })
  })

  it('joins text parts and parses JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(candidate('{"status":', '"ready"}'))))
    const { data, modelMs } = await generateJson(opts)
    expect(data).toEqual({ status: 'ready' })
    expect(modelMs).toBeGreaterThanOrEqual(0)
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
