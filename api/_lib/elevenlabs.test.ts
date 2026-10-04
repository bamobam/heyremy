// @vitest-environment node -- server code runs on Node, not in the browser
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ELEVEN_MODEL, VOICE_ID, synthesize } from './elevenlabs.ts'
import { ProviderError } from './gemini.ts'

async function kindOf(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    expect(e).toBeInstanceOf(ProviderError)
    return (e as ProviderError).kind
  }
  throw new Error('expected a rejection')
}

beforeEach(() => vi.stubEnv('ELEVENLABS_API_KEY', 'test-key'))
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('synthesize', () => {
  it('sends the expected request and returns the audio bytes', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    const audio = await synthesize('Step 1. Whisk.')

    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_64`)
    expect(init.method).toBe('POST')
    expect(init.headers['xi-api-key']).toBe('test-key')
    expect(JSON.parse(init.body)).toEqual({ text: 'Step 1. Whisk.', model_id: ELEVEN_MODEL })
    expect([...audio]).toEqual([1, 2, 3])
  })

  it('maps 429 to rate_limited and 500 to upstream', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })))
    expect(await kindOf(synthesize('hi'))).toBe('rate_limited')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })))
    expect(await kindOf(synthesize('hi'))).toBe('upstream')
  })

  it('rejects when the key is missing, without calling fetch', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', '')
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect(await kindOf(synthesize('hi'))).toBe('upstream')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('maps a timeout to upstream', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError')))
    expect(await kindOf(synthesize('hi'))).toBe('upstream')
  })
})
