import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProviderError, generateJson } from '../_lib/gemini.ts'
import { synthesize } from '../_lib/elevenlabs.ts'
import check from '../check.ts'
import parse from '../parse.ts'
import speak from '../speak.ts'

vi.mock('../_lib/gemini.ts', async (orig) => ({ ...(await orig<typeof import('../_lib/gemini.ts')>()), generateJson: vi.fn() }))
vi.mock('../_lib/elevenlabs.ts', () => ({ synthesize: vi.fn() }))

const gen = vi.mocked(generateJson)
const synth = vi.mocked(synthesize)

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
    gen.mockResolvedValue({ data: RECIPE, modelMs: 42 })
    const res = await call(parse, { recipe: `  ${RECIPE_TEXT}  ` })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(RECIPE)
    const args = gen.mock.calls[0][0]
    expect(args.parts[0]).toContain(`<recipe>\n${RECIPE_TEXT}\n</recipe>`)
    expect(args.timeoutMs).toBeLessThan(20_000)
    const line = oneLog()
    expect(line).toMatchObject({ route: '/api/parse', status: 200, modelMs: 42 })
    expect(JSON.stringify(line)).not.toContain('pancakes')
  })
  it('400 on a missing or too-long recipe', async () => {
    expect((await call(parse, {})).statusCode).toBe(400)
    expect((await call(parse, { recipe: 'x'.repeat(10_001) })).statusCode).toBe(400)
    expect(gen).not.toHaveBeenCalled()
  })
  it('422 when the model returns junk', async () => {
    gen.mockResolvedValue({ data: { title: 'x', steps: [] }, modelMs: 1 })
    const res = await call(parse, { recipe: RECIPE_TEXT })
    expect(res.statusCode).toBe(422)
    expect(oneLog().status).toBe(422)
  })
})

describe('/api/check', () => {
  it('returns the verdict and logs its status without image data', async () => {
    gen.mockResolvedValue({ data: { status: 'not_ready', feedback: 'Still lumpy. Keep whisking.' }, modelMs: 900 })
    const res = await call(check, CHECK_BODY)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ status: 'not_ready', feedback: 'Still lumpy. Keep whisking.' })
    const parts = gen.mock.calls[0][0].parts
    expect(parts.at(-1)).toEqual({ inlineData: { mimeType: 'image/jpeg', data: JPEG } })
    const line = oneLog()
    expect(line).toMatchObject({ route: '/api/check', status: 200, verdict: 'not_ready', modelMs: 900 })
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
    gen.mockResolvedValue({ data: { status: 'maybe', feedback: 'hm' }, modelMs: 1 })
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
