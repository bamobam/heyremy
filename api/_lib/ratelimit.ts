// A best-effort limiter for the tester link: a sliding window per client and route, and a daily cap
// per route across all clients (counted by UTC day).
//
// Be clear about what this is. The counters live in the memory of one function instance. Vercel can run
// several instances of a function at once and starts new ones with empty counters, so the real limits
// are looser than the numbers here (roughly the numbers times the instances running). That is enough to
// stop a tab stuck in a loop or a casual abuser. It is NOT a spending cap: set real budgets with Gemini
// and ElevenLabs themselves.
//
// Pure: the clock is injected and nothing here reads process.env, a request or a response.
// See http.ts `rateLimit` for the part that does.

export const ROUTES = ['parse', 'check', 'speak'] as const
export type LimitedRoute = (typeof ROUTES)[number]

export interface RouteLimits {
  /** Requests one client may make in any 60 seconds. */
  perMinute: number
  /** Requests all clients together may make in one UTC day. */
  daily: number
}

export interface LimitConfig {
  /** RATE_LIMIT_OFF=1: let everything through (tests, local dev). */
  off: boolean
  routes: Record<LimitedRoute, RouteLimits>
}

// A recipe voices about 17 clips in a burst, plus live lines, hence speak's allowance.
export const DEFAULT_LIMITS: Record<LimitedRoute, RouteLimits> = {
  parse: { perMinute: 6, daily: 300 },
  check: { perMinute: 20, daily: 1500 },
  speak: { perMinute: 60, daily: 8000 },
}

export type LimitReason = 'per_minute' | 'daily'

export type LimitResult = { ok: true } | { ok: false; reason: LimitReason; retryAfterSec: number }

/** What the cook reads. The two differ on purpose: waiting a minute does not help once the day is used up. */
export const LIMIT_MESSAGES: Record<LimitReason, string> = {
  per_minute: 'Too many requests. Wait a minute and try again.',
  daily: "Remy has reached today's limit. Try again tomorrow.",
}

/** A whole number above zero, or null. Anything else (empty, "abc", "0", "-5", "1.5", "1e3") is not a limit. */
function positiveInt(raw: string | undefined): number | null {
  const text = raw?.trim() ?? ''
  if (!/^\d+$/.test(text)) return null
  const n = Number(text)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

/**
 * The limits to enforce: the defaults, with any of these overridden from the environment:
 * RATE_PARSE_PER_MIN, RATE_CHECK_PER_MIN, RATE_SPEAK_PER_MIN, DAILY_CAP_PARSE, DAILY_CAP_CHECK,
 * DAILY_CAP_SPEAK, and RATE_LIMIT_OFF=1. A value that is not a whole number above zero is ignored.
 */
export function limitsFromEnv(env: Record<string, string | undefined>): LimitConfig {
  const routes = {} as Record<LimitedRoute, RouteLimits>
  for (const route of ROUTES) {
    const name = route.toUpperCase()
    routes[route] = {
      perMinute: positiveInt(env[`RATE_${name}_PER_MIN`]) ?? DEFAULT_LIMITS[route].perMinute,
      daily: positiveInt(env[`DAILY_CAP_${name}`]) ?? DEFAULT_LIMITS[route].daily,
    }
  }
  return { off: env.RATE_LIMIT_OFF?.trim() === '1', routes }
}

type Headers = Record<string, string | string[] | undefined>

/** An address from one header value: the first of a comma-separated list, lower-cased, trimmed. */
function firstAddress(value: string | string[] | undefined): string {
  const text = Array.isArray(value) ? value[0] : value
  return (text ?? '').split(',')[0].trim().toLowerCase()
}

/** Longest address (IPv6 with a zone) is under 64 characters; this keeps a hostile header from filling memory. */
const MAX_KEY_CHARS = 64

/**
 * Who is asking: the first address in x-forwarded-for, else x-real-ip, else 'unknown'. On Vercel the
 * platform sets these itself. Never log the result; it is an IP address.
 */
export function clientKey(headers: Headers): string {
  const key = firstAddress(headers['x-forwarded-for']) || firstAddress(headers['x-real-ip']) || 'unknown'
  return key.slice(0, MAX_KEY_CHARS)
}

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS
/** Clients tracked per route before the least recently seen is forgotten. */
const MAX_CLIENTS = 5_000

export interface RateLimiter {
  /** Counts the request and says so when it may go ahead; counts nothing when it may not. */
  take(route: LimitedRoute, client: string, limits: RouteLimits): LimitResult
  /** Forgets every count. For tests. */
  reset(): void
}

interface RouteState {
  /** Request times per client, oldest first. The Map is ordered by last use, oldest first. */
  clients: Map<string, number[]>
  day: number
  count: number
  sweptAt: number
}

const freshState = (): RouteState => ({ clients: new Map(), day: 0, count: 0, sweptAt: 0 })

const secondsUntil = (target: number, now: number) => Math.max(1, Math.ceil((target - now) / 1000))

export function createRateLimiter({ now = () => Date.now(), maxClients = MAX_CLIENTS }: { now?: () => number; maxClients?: number } = {}): RateLimiter {
  const state = {} as Record<LimitedRoute, RouteState>
  const reset = () => {
    for (const route of ROUTES) state[route] = freshState()
  }
  reset()

  /** Makes room for one more client: drops the ones whose window is empty, then the least recently seen. */
  function makeRoom(s: RouteState, t: number) {
    if (t - s.sweptAt >= MINUTE_MS) {
      s.sweptAt = t
      for (const [client, hits] of s.clients) {
        if (hits.length === 0 || hits[hits.length - 1] <= t - MINUTE_MS) s.clients.delete(client)
      }
    }
    if (s.clients.size >= maxClients) {
      const oldest = s.clients.keys().next()
      if (!oldest.done) s.clients.delete(oldest.value)
    }
  }

  return {
    take(route, client, limits) {
      const t = now()
      const s = state[route]

      const day = Math.floor(t / DAY_MS)
      if (s.day !== day) {
        s.day = day
        s.count = 0
      }
      // The daily cap is checked first: its message is the one that matters when both apply.
      if (s.count >= limits.daily) return { ok: false, reason: 'daily', retryAfterSec: secondsUntil((day + 1) * DAY_MS, t) }

      let hits = s.clients.get(client)
      if (hits) {
        while (hits.length > 0 && hits[0] <= t - MINUTE_MS) hits.shift()
        if (hits.length >= limits.perMinute) {
          // Room appears when enough of the oldest requests have left the window to get under the limit.
          const freesRoom = hits[hits.length - limits.perMinute]
          return { ok: false, reason: 'per_minute', retryAfterSec: secondsUntil(freesRoom + MINUTE_MS, t) }
        }
        s.clients.delete(client) // re-added below, so the Map stays ordered by last use
      } else {
        if (s.clients.size >= maxClients) makeRoom(s, t)
        hits = []
      }

      hits.push(t)
      s.clients.set(client, hits)
      s.count++
      return { ok: true }
    },
    reset,
  }
}

/** The limiter every handler in this function instance shares. */
export const sharedLimiter = createRateLimiter()
