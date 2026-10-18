// @vitest-environment node -- server code runs on Node, not in the browser
import { describe, expect, it } from 'vitest'
import { DEFAULT_LIMITS, LIMIT_MESSAGES, clientKey, createRateLimiter, limitsFromEnv, type RouteLimits } from './ratelimit.js'

const SECOND = 1000
const MINUTE = 60 * SECOND
const DAY = 24 * 60 * MINUTE

/** A clock the test moves by hand. Starts at 12:00 UTC on 2026-10-18, so a day rollover is 12 hours away. */
function fakeClock(start = Date.UTC(2026, 9, 18, 12, 0, 0)) {
  let t = start
  return { now: () => t, set: (ms: number) => void (t = ms), advance: (ms: number) => void (t += ms) }
}

const roomy: RouteLimits = { perMinute: 1000, daily: 100_000 }

describe('clientKey', () => {
  it('uses the first address in x-forwarded-for', () => {
    expect(clientKey({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1, 10.0.0.2' })).toBe('203.0.113.7')
  })
  it('uses the first element when the header arrives as a list', () => {
    expect(clientKey({ 'x-forwarded-for': ['203.0.113.7, 10.0.0.1', '10.0.0.2'] })).toBe('203.0.113.7')
  })
  it('falls back to x-real-ip', () => {
    expect(clientKey({ 'x-real-ip': '198.51.100.4' })).toBe('198.51.100.4')
    expect(clientKey({ 'x-forwarded-for': ' ', 'x-real-ip': '198.51.100.4' })).toBe('198.51.100.4')
  })
  it("is 'unknown' when neither header says", () => {
    expect(clientKey({})).toBe('unknown')
    expect(clientKey({ 'x-forwarded-for': '' })).toBe('unknown')
  })
  it('treats IPv6 spelled in upper or lower case as one client', () => {
    expect(clientKey({ 'x-forwarded-for': '2001:DB8::1' })).toBe(clientKey({ 'x-forwarded-for': '2001:db8::1' }))
  })
  it('cuts an absurdly long value so it cannot fill memory', () => {
    expect(clientKey({ 'x-forwarded-for': 'a'.repeat(5000) }).length).toBeLessThanOrEqual(64)
  })
})

describe('limitsFromEnv', () => {
  it('has the defaults when nothing is set', () => {
    const config = limitsFromEnv({})
    expect(config.off).toBe(false)
    expect(config.routes).toEqual({
      parse: { perMinute: 6, daily: 300 },
      check: { perMinute: 20, daily: 1500 },
      speak: { perMinute: 60, daily: 8000 },
    })
    expect(config.routes).toEqual(DEFAULT_LIMITS)
  })
  it('reads overrides for each route, per minute and per day', () => {
    const config = limitsFromEnv({
      RATE_PARSE_PER_MIN: '2',
      RATE_CHECK_PER_MIN: '3',
      RATE_SPEAK_PER_MIN: '4',
      DAILY_CAP_PARSE: '5',
      DAILY_CAP_CHECK: '6',
      DAILY_CAP_SPEAK: '7',
    })
    expect(config.routes).toEqual({
      parse: { perMinute: 2, daily: 5 },
      check: { perMinute: 3, daily: 6 },
      speak: { perMinute: 4, daily: 7 },
    })
  })
  it('overrides one value without touching the rest', () => {
    const config = limitsFromEnv({ DAILY_CAP_CHECK: '10' })
    expect(config.routes.check).toEqual({ perMinute: 20, daily: 10 })
    expect(config.routes.parse).toEqual(DEFAULT_LIMITS.parse)
  })
  it('trims spaces around a value', () => {
    expect(limitsFromEnv({ RATE_PARSE_PER_MIN: ' 9 ' }).routes.parse.perMinute).toBe(9)
  })
  it.each(['', '  ', 'abc', '0', '-5', '1.5', '1e3', 'Infinity', 'NaN', '12abc', '99999999999999999999'])(
    'ignores the invalid value %j and keeps the default',
    (bad) => {
      const config = limitsFromEnv({ RATE_PARSE_PER_MIN: bad, DAILY_CAP_SPEAK: bad })
      expect(config.routes.parse.perMinute).toBe(DEFAULT_LIMITS.parse.perMinute)
      expect(config.routes.speak.daily).toBe(DEFAULT_LIMITS.speak.daily)
    },
  )
  it('is off only for RATE_LIMIT_OFF=1', () => {
    expect(limitsFromEnv({ RATE_LIMIT_OFF: '1' }).off).toBe(true)
    for (const other of ['0', '', 'true', 'yes', 'on']) expect(limitsFromEnv({ RATE_LIMIT_OFF: other }).off).toBe(false)
  })
})

describe('per-minute window', () => {
  const three: RouteLimits = { perMinute: 3, daily: 1000 }

  it('lets a client make its allowance, then says how long to wait', () => {
    const clock = fakeClock()
    const limiter = createRateLimiter({ now: clock.now })
    for (let i = 0; i < 3; i++) {
      expect(limiter.take('parse', 'a', three)).toEqual({ ok: true })
      clock.advance(10 * SECOND)
    }
    // The first request was 30 s ago, so it leaves the window in 30 s.
    expect(limiter.take('parse', 'a', three)).toEqual({ ok: false, reason: 'per_minute', retryAfterSec: 30 })
  })

  it('slides: each request frees its slot exactly one minute after it was made', () => {
    const clock = fakeClock()
    const limiter = createRateLimiter({ now: clock.now })
    const start = clock.now()
    limiter.take('parse', 'a', three) // t = 0
    clock.set(start + 20 * SECOND)
    limiter.take('parse', 'a', three) // t = 20 s
    clock.set(start + 40 * SECOND)
    limiter.take('parse', 'a', three) // t = 40 s
    clock.set(start + MINUTE - 1)
    expect(limiter.take('parse', 'a', three).ok).toBe(false)
    clock.set(start + MINUTE) // the t = 0 request is a full minute old
    expect(limiter.take('parse', 'a', three).ok).toBe(true)
    // Slots are back one at a time, not all at once: t = 20 s is still inside the window.
    clock.set(start + MINUTE + 1)
    expect(limiter.take('parse', 'a', three)).toEqual({ ok: false, reason: 'per_minute', retryAfterSec: 20 })
    clock.set(start + 80 * SECOND)
    expect(limiter.take('parse', 'a', three).ok).toBe(true)
  })

  it('rounds the wait up to whole seconds, and never says 0', () => {
    const clock = fakeClock()
    const limiter = createRateLimiter({ now: clock.now })
    limiter.take('parse', 'a', { perMinute: 1, daily: 1000 })
    clock.advance(MINUTE - 1)
    expect(limiter.take('parse', 'a', { perMinute: 1, daily: 1000 })).toEqual({ ok: false, reason: 'per_minute', retryAfterSec: 1 })
    clock.advance(-MINUTE + 1500)
    expect(limiter.take('parse', 'a', { perMinute: 1, daily: 1000 })).toMatchObject({ retryAfterSec: 59 })
  })

  it('does not count a refused request, so waiting the stated time always works', () => {
    const clock = fakeClock()
    const limiter = createRateLimiter({ now: clock.now })
    limiter.take('parse', 'a', { perMinute: 1, daily: 1000 })
    for (let i = 0; i < 20; i++) {
      clock.advance(SECOND)
      limiter.take('parse', 'a', { perMinute: 1, daily: 1000 }) // hammering
    }
    clock.advance(40 * SECOND) // now 60 s after the one that counted
    expect(limiter.take('parse', 'a', { perMinute: 1, daily: 1000 }).ok).toBe(true)
  })

  it('keeps clients apart', () => {
    const clock = fakeClock()
    const limiter = createRateLimiter({ now: clock.now })
    const one: RouteLimits = { perMinute: 1, daily: 1000 }
    expect(limiter.take('parse', 'a', one).ok).toBe(true)
    expect(limiter.take('parse', 'a', one).ok).toBe(false)
    expect(limiter.take('parse', 'b', one).ok).toBe(true)
  })

  it('keeps routes apart', () => {
    const clock = fakeClock()
    const limiter = createRateLimiter({ now: clock.now })
    const one: RouteLimits = { perMinute: 1, daily: 1000 }
    expect(limiter.take('parse', 'a', one).ok).toBe(true)
    expect(limiter.take('check', 'a', one).ok).toBe(true)
    expect(limiter.take('speak', 'a', one).ok).toBe(true)
    expect(limiter.take('parse', 'a', one).ok).toBe(false)
  })

  it('uses the limits it is given on each call, so an env change takes effect at once', () => {
    const clock = fakeClock()
    const limiter = createRateLimiter({ now: clock.now })
    limiter.take('parse', 'a', { perMinute: 5, daily: 1000 })
    limiter.take('parse', 'a', { perMinute: 5, daily: 1000 })
    expect(limiter.take('parse', 'a', { perMinute: 2, daily: 1000 }).ok).toBe(false)
    expect(limiter.take('parse', 'a', { perMinute: 3, daily: 1000 }).ok).toBe(true)
  })

  it('when the limit was lowered under a busy client, waits only until it is under the new limit', () => {
    const clock = fakeClock()
    const limiter = createRateLimiter({ now: clock.now })
    const start = clock.now()
    for (const offset of [0, 10, 20, 30]) {
      clock.set(start + offset * SECOND)
      limiter.take('parse', 'a', { perMinute: 10, daily: 1000 })
    }
    clock.set(start + 40 * SECOND)
    // Limit is now 2 and 4 requests are in the window: three must leave before there is room, and the
    // third of them (made at 20 s) is gone at 80 s, which is 40 s from now.
    expect(limiter.take('parse', 'a', { perMinute: 2, daily: 1000 })).toEqual({ ok: false, reason: 'per_minute', retryAfterSec: 40 })
  })
})

describe('daily cap', () => {
  const cap2: RouteLimits = { perMinute: 1000, daily: 2 }

  it('is shared by every client of a route', () => {
    const clock = fakeClock()
    const limiter = createRateLimiter({ now: clock.now })
    expect(limiter.take('check', 'a', cap2).ok).toBe(true)
    expect(limiter.take('check', 'b', cap2).ok).toBe(true)
    expect(limiter.take('check', 'c', cap2)).toMatchObject({ ok: false, reason: 'daily' })
    expect(limiter.take('check', 'a', cap2)).toMatchObject({ ok: false, reason: 'daily' })
  })

  it('is counted per route', () => {
    const clock = fakeClock()
    const limiter = createRateLimiter({ now: clock.now })
    limiter.take('check', 'a', cap2)
    limiter.take('check', 'a', cap2)
    expect(limiter.take('parse', 'a', cap2).ok).toBe(true)
  })

  it('says to retry at the next UTC midnight', () => {
    const clock = fakeClock() // 12:00 UTC
    const limiter = createRateLimiter({ now: clock.now })
    limiter.take('check', 'a', cap2)
    limiter.take('check', 'a', cap2)
    expect(limiter.take('check', 'a', cap2)).toEqual({ ok: false, reason: 'daily', retryAfterSec: 12 * 60 * 60 })
  })

  it('starts a fresh day at UTC midnight, not a minute before', () => {
    const clock = fakeClock(Date.UTC(2026, 9, 18, 23, 59, 59, 0))
    const limiter = createRateLimiter({ now: clock.now })
    limiter.take('check', 'a', cap2)
    limiter.take('check', 'b', cap2)
    clock.set(Date.UTC(2026, 9, 18, 23, 59, 59, 999))
    expect(limiter.take('check', 'c', cap2)).toEqual({ ok: false, reason: 'daily', retryAfterSec: 1 })
    clock.set(Date.UTC(2026, 9, 19, 0, 0, 0, 0))
    expect(limiter.take('check', 'c', cap2).ok).toBe(true)
    expect(limiter.take('check', 'd', cap2).ok).toBe(true)
    expect(limiter.take('check', 'e', cap2)).toMatchObject({ ok: false, reason: 'daily' })
  })

  it('rolls over after a quiet stretch of several days too', () => {
    const clock = fakeClock()
    const limiter = createRateLimiter({ now: clock.now })
    limiter.take('check', 'a', cap2)
    limiter.take('check', 'a', cap2)
    clock.advance(3 * DAY)
    expect(limiter.take('check', 'a', cap2).ok).toBe(true)
  })

  it('wins over the per-minute message when both apply, since waiting a minute would not help', () => {
    const clock = fakeClock()
    const limiter = createRateLimiter({ now: clock.now })
    const both: RouteLimits = { perMinute: 1, daily: 1 }
    limiter.take('speak', 'a', both)
    expect(limiter.take('speak', 'a', both)).toMatchObject({ reason: 'daily' })
  })

  it('does not spend the cap on requests the per-minute limit refused', () => {
    const clock = fakeClock()
    const limiter = createRateLimiter({ now: clock.now })
    const limits: RouteLimits = { perMinute: 1, daily: 3 }
    expect(limiter.take('speak', 'a', limits).ok).toBe(true) // 1 of 3
    for (let i = 0; i < 10; i++) expect(limiter.take('speak', 'a', limits)).toMatchObject({ reason: 'per_minute' })
    expect(limiter.take('speak', 'b', limits).ok).toBe(true) // 2 of 3
    expect(limiter.take('speak', 'c', limits).ok).toBe(true) // 3 of 3
    expect(limiter.take('speak', 'd', limits)).toMatchObject({ reason: 'daily' })
  })

  it('does not spend the per-minute allowance on requests the cap refused', () => {
    const clock = fakeClock()
    const limiter = createRateLimiter({ now: clock.now })
    limiter.take('speak', 'a', { perMinute: 5, daily: 1 })
    expect(limiter.take('speak', 'b', { perMinute: 5, daily: 1 })).toMatchObject({ reason: 'daily' })
    // The cap was raised: b has used nothing yet.
    for (let i = 0; i < 5; i++) expect(limiter.take('speak', 'b', { perMinute: 5, daily: 100 }).ok).toBe(true)
  })
})

describe('memory', () => {
  const one: RouteLimits = { perMinute: 1, daily: 1_000_000 }

  it('forgets the client it saw longest ago when it is tracking too many', () => {
    const clock = fakeClock()
    const limiter = createRateLimiter({ now: clock.now, maxClients: 2 })
    limiter.take('parse', 'a', one)
    clock.advance(SECOND)
    limiter.take('parse', 'b', one)
    clock.advance(SECOND)
    limiter.take('parse', 'c', one) // full: a is forgotten
    clock.advance(SECOND)
    expect(limiter.take('parse', 'b', one).ok).toBe(false) // still tracked
    expect(limiter.take('parse', 'c', one).ok).toBe(false) // still tracked
    expect(limiter.take('parse', 'a', one).ok).toBe(true) // forgotten, so a fresh start
  })

  it('counts a client that keeps coming back as recent, not as the oldest', () => {
    const clock = fakeClock()
    const limiter = createRateLimiter({ now: clock.now, maxClients: 2 })
    const two: RouteLimits = { perMinute: 2, daily: 1_000_000 }
    limiter.take('parse', 'a', two)
    clock.advance(SECOND)
    limiter.take('parse', 'b', two)
    clock.advance(SECOND)
    limiter.take('parse', 'a', two) // a is now the most recent
    clock.advance(SECOND)
    limiter.take('parse', 'c', two) // forgets b, not a
    clock.advance(SECOND)
    expect(limiter.take('parse', 'a', two).ok).toBe(false) // a: 2 in the window
    expect(limiter.take('parse', 'b', two).ok).toBe(true)
  })

  it('does not drop a live client to make room when others have expired', () => {
    const clock = fakeClock()
    const limiter = createRateLimiter({ now: clock.now, maxClients: 2 })
    limiter.take('parse', 'a', one)
    clock.advance(30 * SECOND)
    limiter.take('parse', 'b', one)
    clock.advance(31 * SECOND) // a is a minute old; b is not
    limiter.take('parse', 'c', one)
    expect(limiter.take('parse', 'b', one).ok).toBe(false)
  })

  it('reset() clears every counter', () => {
    const clock = fakeClock()
    const limiter = createRateLimiter({ now: clock.now })
    limiter.take('parse', 'a', { perMinute: 1, daily: 1 })
    expect(limiter.take('parse', 'a', { perMinute: 1, daily: 1 }).ok).toBe(false)
    limiter.reset()
    expect(limiter.take('parse', 'a', { perMinute: 1, daily: 1 }).ok).toBe(true)
  })

  it('works with the real clock when none is given', () => {
    const limiter = createRateLimiter()
    expect(limiter.take('parse', 'a', roomy)).toEqual({ ok: true })
  })
})

describe('messages', () => {
  it('words the daily cap differently from the per-minute limit', () => {
    expect(LIMIT_MESSAGES.daily).toBe("Remy has reached today's limit. Try again tomorrow.")
    expect(LIMIT_MESSAGES.per_minute).not.toBe(LIMIT_MESSAGES.daily)
    expect(LIMIT_MESSAGES.per_minute).toMatch(/minute|moment|seconds/i)
  })
})
