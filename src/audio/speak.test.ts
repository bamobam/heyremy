// POST /api/speak from the browser: the text, and the Persona whose voice should read it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { speak } from './speak.ts'

type Fetch = (url: string, init?: RequestInit) => Promise<Response>
const answer = () => vi.fn<Fetch>(async () => new Response('mp3', { status: 200 }))
const sent = (fetchFn: ReturnType<typeof answer>) => JSON.parse(fetchFn.mock.calls.at(-1)?.[1]?.body as string)

beforeEach(() => {
  window.history.replaceState(null, '', '/') // the real backend, not ?mock
})
afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

describe('speak', () => {
  it('posts the text and returns the audio', async () => {
    const fetchFn = answer()
    vi.stubGlobal('fetch', fetchFn)
    const blob = await speak('Step 1. Whisk.')
    expect(fetchFn.mock.calls[0][0]).toBe('/api/speak')
    expect(sent(fetchFn)).toEqual({ text: 'Step 1. Whisk.' })
    expect(await blob.text()).toBe('mp3')
  })

  it('sends the Persona so its voice reads the line, unless it is Remy, whose request stays as it always was', async () => {
    const fetchFn = answer()
    vi.stubGlobal('fetch', fetchFn)
    await speak('Hello.', 'grandma')
    expect(sent(fetchFn)).toEqual({ text: 'Hello.', persona: 'grandma' })
    await speak('Hello.', 'sergeant')
    expect(sent(fetchFn)).toEqual({ text: 'Hello.', persona: 'sergeant' })
    await speak('Hello.', 'remy')
    expect(sent(fetchFn)).toEqual({ text: 'Hello.' })
    await speak('Hello.', undefined)
    expect(sent(fetchFn)).toEqual({ text: 'Hello.' })
  })

  it('fails with the kind of error the status means', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 429 })))
    await expect(speak('Hello.', 'grandma')).rejects.toMatchObject({ kind: 'rate_limited' })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 502 })))
    await expect(speak('Hello.')).rejects.toMatchObject({ kind: 'upstream' })
  })

  it('gives silence without calling the network when the stand-in backend is on', async () => {
    window.history.replaceState(null, '', '/?mock')
    const fetchFn = vi.fn()
    vi.stubGlobal('fetch', fetchFn)
    const blob = await speak('Hello.', 'sergeant')
    expect(fetchFn).not.toHaveBeenCalled()
    expect(blob.size).toBeGreaterThan(0)
  })
})
