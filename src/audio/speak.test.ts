// POST /api/speak from the browser: the text, the Persona whose voice should read it, and how a failure reads.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { speak } from './speak.ts'

// The real backend unless a test turns the stand-in on: ?mock and VITE_MOCK_API would hand back silence instead of calling fetch.
const mock = vi.hoisted(() => ({ on: false }))
vi.mock('../api/index.ts', () => ({ isMockApi: () => mock.on }))

afterEach(() => {
  vi.unstubAllGlobals()
  mock.on = false
})

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('speak', () => {
  let fetchFn: ReturnType<typeof vi.fn>
  beforeEach(() => {
    fetchFn = vi.fn()
    vi.stubGlobal('fetch', fetchFn)
  })
  const audio = () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } })
  const sent = () => JSON.parse(fetchFn.mock.calls.at(-1)?.[1].body as string)

  it('posts the text and returns the audio', async () => {
    fetchFn.mockResolvedValue(audio())
    const blob = await speak('Step 1. Whisk.')
    expect(blob.size).toBe(3)
    expect(fetchFn.mock.calls[0][0]).toBe('/api/speak')
    expect(sent()).toEqual({ text: 'Step 1. Whisk.' })
  })

  it('sends the Persona so its voice reads the line, unless it is Remy, whose request stays as it always was', async () => {
    fetchFn.mockImplementation(async () => audio())
    await speak('Hello.', 'grandma')
    expect(sent()).toEqual({ text: 'Hello.', persona: 'grandma' })
    await speak('Hello.', 'sergeant')
    expect(sent()).toEqual({ text: 'Hello.', persona: 'sergeant' })
    await speak('Hello.', 'remy')
    expect(sent()).toEqual({ text: 'Hello.' })
    await speak('Hello.', undefined)
    expect(sent()).toEqual({ text: 'Hello.' })
  })

  it('gives silence without calling the network when the stand-in backend is on', async () => {
    mock.on = true
    const blob = await speak('Hello.', 'sergeant')
    expect(fetchFn).not.toHaveBeenCalled()
    expect(blob.size).toBeGreaterThan(0)
  })

  it('carries the server message on a 429, so the daily cap can say "tomorrow"', async () => {
    const message = "Remy has reached today's limit. Try again tomorrow."
    fetchFn.mockResolvedValue(json({ error: { kind: 'rate_limited', message } }, 429))
    await expect(speak('hi')).rejects.toMatchObject({ name: 'ApiError', kind: 'rate_limited', message, status: 429 })
  })

  it('keeps the default message on a 429 that says nothing', async () => {
    fetchFn.mockResolvedValue(new Response('Too Many Requests', { status: 429 }))
    await expect(speak('hi', 'grandma')).rejects.toMatchObject({ kind: 'rate_limited', message: 'Too many requests, wait a few seconds.' })
  })

  it('keeps the default message for other failures, whatever the server wrote', async () => {
    fetchFn.mockResolvedValue(json({ error: { kind: 'upstream', message: 'ElevenLabs returned 500.' } }, 502))
    await expect(speak('hi')).rejects.toMatchObject({ kind: 'upstream', message: 'Something went wrong on our side. Try again.' })
  })

  it('treats a network failure as unknown', async () => {
    fetchFn.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(speak('hi')).rejects.toMatchObject({ kind: 'unknown' })
  })
})
