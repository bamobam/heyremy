// @vitest-environment node
import { Readable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { synthesize } from '../api/_lib/elevenlabs.js'
import { sharedLimiter } from '../api/_lib/ratelimit.js'
import { devApi } from './devApi.ts'

// The real speak handler runs; only the call out to ElevenLabs is replaced.
vi.mock('../api/_lib/elevenlabs.js', () => ({ synthesize: vi.fn(async () => Buffer.from([1, 2, 3])) }))

const LIMIT_ENV = ['RATE_LIMIT_OFF', 'RATE_PARSE_PER_MIN', 'RATE_CHECK_PER_MIN', 'RATE_SPEAK_PER_MIN', 'DAILY_CAP_PARSE', 'DAILY_CAP_CHECK', 'DAILY_CAP_SPEAK']

beforeEach(() => {
  // vi.stubEnv puts these back after the test, including the RATE_LIMIT_OFF the dev middleware sets.
  for (const name of LIMIT_ENV) vi.stubEnv(name, undefined)
  sharedLimiter.reset()
})
afterEach(() => {
  vi.unstubAllEnvs()
  sharedLimiter.reset()
  vi.mocked(synthesize).mockClear()
})

type Middleware = (req: unknown, res: unknown) => Promise<void>

/** Starts the plugin on a fake Vite server and returns a function that sends one speak request through it. */
function devServer() {
  let middleware!: Middleware
  const info = vi.fn()
  const server = {
    config: { root: process.cwd(), env: {}, logger: { info, warn: vi.fn() } },
    middlewares: { use: (_path: string, fn: Middleware) => void (middleware = fn) },
    ssrLoadModule: (path: string) => import(/* @vite-ignore */ `..${path}`),
  }
  const plugin = devApi() as unknown as { configureServer(server: unknown): void }
  plugin.configureServer(server)

  async function speak(headers: Record<string, string> = {}) {
    const req = Object.assign(Readable.from([Buffer.from(JSON.stringify({ text: 'Step 1.' }))]), {
      url: '/speak',
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
    })
    const sent = { statusCode: 0, headers: {} as Record<string, string>, body: '' as unknown }
    const res = {
      set statusCode(code: number) { sent.statusCode = code },
      setHeader: (name: string, value: string) => void (sent.headers[name] = value),
      end: (body: unknown) => void (sent.body = body),
    }
    await middleware(req, res)
    return sent
  }
  return { speak, info }
}

describe('the dev server and the rate limits', () => {
  it('does not block normal use: far more than a minute allows, from one client with no address', async () => {
    const { speak } = devServer()
    for (let i = 0; i < 100; i++) expect((await speak()).statusCode).toBe(200)
    expect(synthesize).toHaveBeenCalledTimes(100)
  })

  it('says once that the limits are off', async () => {
    const { speak, info } = devServer()
    await speak()
    await speak()
    expect(info.mock.calls.filter(([m]) => /Rate limits are off/.test(String(m)))).toHaveLength(1)
  })

  it('applies the limits, with Retry-After through to the browser, when the developer turns them on', async () => {
    vi.stubEnv('RATE_LIMIT_OFF', '0')
    vi.stubEnv('RATE_SPEAK_PER_MIN', '2')
    const { speak } = devServer()
    expect((await speak({ 'x-forwarded-for': '203.0.113.7' })).statusCode).toBe(200)
    expect((await speak({ 'x-forwarded-for': '203.0.113.7' })).statusCode).toBe(200)
    const limited = await speak({ 'x-forwarded-for': '203.0.113.7' })
    expect(limited.statusCode).toBe(429)
    expect(Number(limited.headers['Retry-After'])).toBeGreaterThanOrEqual(1)
    expect(JSON.parse(String(limited.body)).error).toMatchObject({ kind: 'rate_limited' })
    expect((await speak({ 'x-forwarded-for': '198.51.100.4' })).statusCode).toBe(200)
  })
})
