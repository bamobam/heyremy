import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hangingFetch } from '../test/fakes/fetch.ts'
import { ApiError } from './errors.ts'
import { postJson } from './http.ts'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const opts = { timeoutMs: 5000 }

describe('postJson', () => {
  it('posts the body as JSON and returns the parsed answer', async () => {
    const fetchFn = vi.fn(async () => json({ ok: true }))
    const result = await postJson('/api/parse', { recipe: 'x' }, opts, fetchFn)
    expect(result).toEqual({ ok: true })
    expect(fetchFn).toHaveBeenCalledWith(
      '/api/parse',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe: 'x' }),
      }),
    )
  })

  it('throws the error the server describes, with its status', async () => {
    const fetchFn = vi.fn(async () => json({ error: { kind: 'unprocessable', message: 'No steps found.' } }, 422))
    await expect(postJson('/api/parse', {}, opts, fetchFn)).rejects.toMatchObject({
      name: 'ApiError',
      kind: 'unprocessable',
      message: 'No steps found.',
      status: 422,
    })
  })

  it('works out the kind from the status when the body is not an API error', async () => {
    const fetchFn = vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 }))
    await expect(postJson('/api/parse', {}, opts, fetchFn)).rejects.toMatchObject({ kind: 'upstream', status: 502 })
  })

  it('ignores a kind in the body that it does not know', async () => {
    const fetchFn = vi.fn(async () => json({ error: { kind: 'on_fire', message: 'x' } }, 429))
    await expect(postJson('/api/parse', {}, opts, fetchFn)).rejects.toMatchObject({ kind: 'rate_limited' })
  })

  it('surfaces the server message on a 429, which is how the daily cap tells the cook to come back tomorrow', async () => {
    const message = "Remy has reached today's limit. Try again tomorrow."
    const fetchFn = vi.fn(async () => json({ error: { kind: 'rate_limited', message } }, 429))
    await expect(postJson('/api/parse', {}, opts, fetchFn)).rejects.toMatchObject({ kind: 'rate_limited', message, status: 429 })
  })

  it('keeps the default rate-limit message when a 429 comes with no message (or no JSON at all)', async () => {
    const bare = vi.fn(async () => json({ error: { kind: 'rate_limited' } }, 429))
    await expect(postJson('/api/parse', {}, opts, bare)).rejects.toMatchObject({
      kind: 'rate_limited',
      message: 'Too many requests, wait a few seconds.',
    })
    const html = vi.fn(async () => new Response('<html>Too Many Requests</html>', { status: 429 }))
    await expect(postJson('/api/parse', {}, opts, html)).rejects.toMatchObject({
      kind: 'rate_limited',
      message: 'Too many requests, wait a few seconds.',
    })
  })

  it('treats a network failure as unknown', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(postJson('/api/parse', {}, opts, fetchFn)).rejects.toMatchObject({ kind: 'unknown' })
  })

  it('treats an OK answer that is not JSON as unprocessable', async () => {
    const fetchFn = vi.fn(async () => new Response('not json', { status: 200 }))
    await expect(postJson('/api/parse', {}, opts, fetchFn)).rejects.toMatchObject({ kind: 'unprocessable' })
  })

  it('gives up after the timeout, as a timeout', async () => {
    const fetchFn = hangingFetch()
    const result = postJson('/api/check', {}, { timeoutMs: 8000 }, fetchFn)
    const outcome = result.catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(7999)
    expect(fetchFn).toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2)
    expect(await outcome).toMatchObject({ kind: 'timeout' })
  })

  it('stops the wait when the caller cancels, as aborted', async () => {
    const abort = new AbortController()
    const result = postJson('/api/check', {}, { timeoutMs: 8000, signal: abort.signal }, hangingFetch())
    const outcome = result.catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(100)
    abort.abort()
    expect(await outcome).toMatchObject({ kind: 'aborted' })
  })

  it('does not call the server at all if already cancelled', async () => {
    const abort = new AbortController()
    abort.abort()
    const fetchFn = vi.fn(async () => json({}))
    await expect(postJson('/api/check', {}, { timeoutMs: 8000, signal: abort.signal }, fetchFn)).rejects.toMatchObject({
      kind: 'aborted',
    })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('cleans up its timer once it has an answer', async () => {
    await postJson('/api/parse', {}, opts, vi.fn(async () => json({})))
    expect(vi.getTimerCount()).toBe(0)
  })

  it('throws ApiError instances', async () => {
    const fetchFn = vi.fn(async () => json({}, 500))
    await expect(postJson('/x', {}, opts, fetchFn)).rejects.toBeInstanceOf(ApiError)
  })
})
