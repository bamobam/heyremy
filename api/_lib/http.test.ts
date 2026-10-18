// @vitest-environment node -- server code runs on Node, not in the browser
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { guard, rateLimit, sendAudio, sendError, sendJson } from './http.js'
import { LIMIT_MESSAGES, sharedLimiter } from './ratelimit.js'

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
const asRes = (r: ReturnType<typeof fakeRes>) => r as unknown as VercelResponse
const req = (method: string, contentType?: string) =>
  ({ method, headers: contentType ? { 'content-type': contentType } : {} }) as unknown as VercelRequest

const opts = { method: 'POST', contentType: 'application/json' }

describe('guard', () => {
  it('lets a JSON POST through, ignoring charset', () => {
    const r = fakeRes()
    expect(guard(req('POST', 'application/json; charset=utf-8'), asRes(r), opts)).toBe(true)
    expect(r.statusCode).toBe(0)
  })
  it('rejects the wrong method with 405', () => {
    const r = fakeRes()
    expect(guard(req('GET'), asRes(r), opts)).toBe(false)
    expect(r.statusCode).toBe(405)
    expect(r.headers.Allow).toBe('POST')
  })
  it('rejects the wrong content type with 415', () => {
    const r = fakeRes()
    expect(guard(req('POST', 'text/plain'), asRes(r), opts)).toBe(false)
    expect(r.statusCode).toBe(415)
    expect(r.body).toEqual({ error: { kind: 'bad_request', message: 'Send application/json.' } })
  })
})

describe('sendError', () => {
  it.each([
    ['bad_request', 400],
    ['unprocessable', 422],
    ['upstream', 502],
    ['rate_limited', 429],
    ['unknown', 500],
  ] as const)('%s → %i', (kind, status) => {
    const r = fakeRes()
    sendError(asRes(r), kind, 'msg')
    expect(r.statusCode).toBe(status)
    expect(r.body).toEqual({ error: { kind, message: 'msg' } })
    expect(r.headers['Cache-Control']).toBe('no-store')
  })
})

describe('sendJson and sendAudio', () => {
  it('sends JSON uncached', () => {
    const r = fakeRes()
    sendJson(asRes(r), { ok: true })
    expect(r.statusCode).toBe(200)
    expect(r.headers['Cache-Control']).toBe('no-store')
  })
  it('sends mp3 with type and length', () => {
    const r = fakeRes()
    sendAudio(asRes(r), Buffer.from([1, 2, 3]))
    expect(r.headers['Content-Type']).toBe('audio/mpeg')
    expect(r.headers['Content-Length']).toBe('3')
  })
})

describe('rateLimit', () => {
  const LIMIT_ENV = [
    'RATE_LIMIT_OFF',
    'RATE_PARSE_PER_MIN',
    'RATE_CHECK_PER_MIN',
    'RATE_SPEAK_PER_MIN',
    'DAILY_CAP_PARSE',
    'DAILY_CAP_CHECK',
    'DAILY_CAP_SPEAK',
  ]
  const from = (ip?: string) => ({ method: 'POST', headers: ip ? { 'x-forwarded-for': ip } : {} }) as unknown as VercelRequest

  beforeEach(() => {
    // Whatever the shell exports must not change what these tests see.
    for (const name of LIMIT_ENV) vi.stubEnv(name, undefined)
    sharedLimiter.reset()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.UTC(2026, 9, 18, 12, 0, 0))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    sharedLimiter.reset()
  })

  it('lets a request through without touching the response', () => {
    const r = fakeRes()
    expect(rateLimit(from('203.0.113.7'), asRes(r), 'parse')).toBeUndefined()
    expect(r.statusCode).toBe(0)
  })

  it('answers 429 rate_limited with Retry-After once a client is over the per-minute limit', () => {
    vi.stubEnv('RATE_PARSE_PER_MIN', '2')
    for (let i = 0; i < 2; i++) expect(rateLimit(from('203.0.113.7'), asRes(fakeRes()), 'parse')).toBeUndefined()
    vi.advanceTimersByTime(15_000)
    const r = fakeRes()
    expect(rateLimit(from('203.0.113.7'), asRes(r), 'parse')).toBe('per_minute')
    expect(r.statusCode).toBe(429)
    expect(r.body).toEqual({ error: { kind: 'rate_limited', message: LIMIT_MESSAGES.per_minute } })
    expect(r.headers['Retry-After']).toBe('45')
    expect(r.headers['Cache-Control']).toBe('no-store')
  })

  it('tells clients apart by the first address in x-forwarded-for', () => {
    vi.stubEnv('RATE_CHECK_PER_MIN', '1')
    expect(rateLimit(from('203.0.113.7, 10.0.0.1'), asRes(fakeRes()), 'check')).toBeUndefined()
    // Same first address behind a different proxy: still the same client.
    expect(rateLimit(from('203.0.113.7, 10.9.9.9'), asRes(fakeRes()), 'check')).toBe('per_minute')
    expect(rateLimit(from('198.51.100.4, 10.0.0.1'), asRes(fakeRes()), 'check')).toBeUndefined()
  })

  it('shares one bucket between requests that name no address', () => {
    vi.stubEnv('RATE_SPEAK_PER_MIN', '1')
    expect(rateLimit(from(), asRes(fakeRes()), 'speak')).toBeUndefined()
    expect(rateLimit(from(), asRes(fakeRes()), 'speak')).toBe('per_minute')
  })

  it('answers the daily cap with its own message and a Retry-After to the next UTC midnight', () => {
    vi.stubEnv('DAILY_CAP_CHECK', '1')
    expect(rateLimit(from('203.0.113.7'), asRes(fakeRes()), 'check')).toBeUndefined()
    const r = fakeRes()
    expect(rateLimit(from('198.51.100.4'), asRes(r), 'check')).toBe('daily')
    expect(r.statusCode).toBe(429)
    expect(r.body).toEqual({ error: { kind: 'rate_limited', message: "Remy has reached today's limit. Try again tomorrow." } })
    expect(r.headers['Retry-After']).toBe(String(12 * 60 * 60))
  })

  it('reads the environment on every request, so a change applies without a restart', () => {
    vi.stubEnv('RATE_PARSE_PER_MIN', '1')
    rateLimit(from('203.0.113.7'), asRes(fakeRes()), 'parse')
    expect(rateLimit(from('203.0.113.7'), asRes(fakeRes()), 'parse')).toBe('per_minute')
    vi.stubEnv('RATE_PARSE_PER_MIN', '5')
    expect(rateLimit(from('203.0.113.7'), asRes(fakeRes()), 'parse')).toBeUndefined()
  })

  it('does nothing at all when RATE_LIMIT_OFF=1', () => {
    vi.stubEnv('RATE_LIMIT_OFF', '1')
    vi.stubEnv('RATE_PARSE_PER_MIN', '1')
    vi.stubEnv('DAILY_CAP_PARSE', '1')
    for (let i = 0; i < 5; i++) {
      const r = fakeRes()
      expect(rateLimit(from('203.0.113.7'), asRes(r), 'parse')).toBeUndefined()
      expect(r.statusCode).toBe(0)
    }
  })

  it('uses the defaults when an override is not a valid number', () => {
    vi.stubEnv('RATE_PARSE_PER_MIN', 'lots')
    for (let i = 0; i < 6; i++) expect(rateLimit(from('203.0.113.7'), asRes(fakeRes()), 'parse')).toBeUndefined()
    expect(rateLimit(from('203.0.113.7'), asRes(fakeRes()), 'parse')).toBe('per_minute')
  })
})
