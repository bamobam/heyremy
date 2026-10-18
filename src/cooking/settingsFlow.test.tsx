// Level and Persona through the whole app: chosen on the start screen or on prep, remembered in this
// browser, and used for the voice (only the chosen Level's clips are made, in the chosen Persona's voice).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '../App.tsx'
import { clipCache } from '../audio/clipCache.ts'
import { silentWavBlob } from '../audio/silence.ts'
import { installFakeMediaDevices, MACBOOK } from '../test/fakes/media.ts'
import { SETTINGS_KEY } from './settings.ts'

const speak = vi.hoisted(() => vi.fn())
vi.mock('../audio/speak.ts', () => ({ speak }))

beforeEach(() => {
  installFakeMediaDevices([MACBOOK])
  window.history.replaceState(null, '', '/?mock')
  window.localStorage.clear()
  clipCache.clear()
  speak.mockResolvedValue(silentWavBlob())
})

afterEach(() => {
  cleanup()
  speak.mockReset()
  vi.restoreAllMocks()
  window.localStorage.clear()
  clipCache.clear()
})

const opener = () => screen.getByRole('button', { name: /cook settings/i })
const choose = (name: RegExp) => fireEvent.click(screen.getByRole('radio', { name }))
const spoken = () => speak.mock.calls.map(([text]) => text as string)
const voiceReady = () => screen.findByText(/voice is ready/i, undefined, { timeout: 10_000 })

/** Opens the panel, picks, and closes it again. */
function pick(...names: RegExp[]) {
  fireEvent.click(opener())
  for (const name of names) choose(name)
  fireEvent.click(screen.getByRole('button', { name: 'Done' }))
}

describe('Cook settings on the start screen', () => {
  it('start as beginner with Remy, and say so', () => {
    render(<App />)
    expect(opener().textContent).toContain('Beginner · Remy')
    expect(screen.getByText("Hey, I'm Remy! Let's cook!")).toBeTruthy()
  })

  it('change Remy\'s greeting to the Persona\'s own words, and remember the choice', () => {
    render(<App />)
    pick(/^Master/, /^Grandma/)
    expect(opener().textContent).toContain('Master · Grandma')
    expect(screen.getByText("Hello, dear. Come, let's cook together.")).toBeTruthy()
    expect(JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? 'null')).toEqual({ level: 'master', persona: 'grandma' })
  })

  it('come back the next time the app opens', () => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ level: 'intermediate', persona: 'sergeant' }))
    render(<App />)
    expect(opener().textContent).toContain('Intermediate · Sergeant')
    expect(screen.getByText("What's the mission today?")).toBeTruthy()
  })

  it('fall back to the defaults when the saved choice is damaged', () => {
    window.localStorage.setItem(SETTINGS_KEY, '{"level":"expert"')
    render(<App />)
    expect(opener().textContent).toContain('Beginner · Remy')
  })

  it('work with storage blocked, for this visit only', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('storage is blocked')
    })
    render(<App />)
    expect(opener().textContent).toContain('Beginner · Remy')
    pick(/^Master/)
    expect(opener().textContent).toContain('Master · Remy')
  })
})

describe('the voice', () => {
  it('makes only the chosen Level\'s clips, in the chosen Persona\'s voice', async () => {
    render(<App />)
    pick(/^Master/, /^Grandma/)
    fireEvent.click(screen.getByRole('button', { name: /let'?s cook/i }))
    await voiceReady()

    const texts = spoken()
    // The two fixed lines in Grandma's words, then one master narration per step.
    expect(texts).toEqual(
      expect.arrayContaining([
        'Let me have a look, dear. Hold still.',
        "Lovely work, dear. Enjoy it while it's warm.",
        'Step 1. Whisk one cup of flour, one cup of milk, two eggs.',
        'Step 2. Medium heat, two tablespoons of melted butter.',
        'Step 3. Pour a ladle.',
        'Step 4. Flip on bubbles.',
        'Step 5. Serve.',
      ]),
    )
    expect(texts).toHaveLength(7)
    expect(texts).not.toContain('Step 1. Whisk one cup of flour, one cup of milk and two eggs into a batter.')
    for (const [, persona] of speak.mock.calls) expect(persona).toBe('grandma')
  })

  it('makes the beginner narration in Remy\'s voice by default, as it always did', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /let'?s cook/i }))
    await voiceReady()
    expect(spoken()).toContain('Step 1. Whisk one cup of flour, one cup of milk and two eggs into a batter.')
    expect(spoken()).toContain('Whiskers on it… hold still!')
    for (const [, persona] of speak.mock.calls) expect(persona).toBe('remy')
  })

  it('makes only the clips that are new when the Level changes on the prep screen, and keeps Start waiting for them', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /let'?s cook/i }))
    await voiceReady()
    expect(speak).toHaveBeenCalledTimes(7)
    speak.mockClear()

    pick(/^Intermediate/)
    expect(opener().textContent).toContain('Intermediate · Remy')
    expect(screen.getByRole('button', { name: /remy, let'?s cook/i })).toBeDisabled()
    await waitFor(() => expect(screen.getByRole('button', { name: /remy, let'?s cook/i })).toBeEnabled(), { timeout: 10_000 })

    // Steps 1 to 4 are worded differently at intermediate; step 5 has no narration of its own there, and the
    // two fixed lines are the same, so all three are reused from the cache.
    expect(spoken()).toEqual([
      'Step 1. Whisk one cup of flour, one cup of milk and two eggs.',
      'Step 2. Pan on medium, melt two tablespoons of melted butter.',
      'Step 3. Pour a ladle of batter.',
      'Step 4. Flip at the bubbles.',
    ])
  })

  it('goes back to clips already made for a Level without making them again', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /let'?s cook/i }))
    await voiceReady()
    pick(/^Master/)
    await waitFor(() => expect(speak).toHaveBeenCalledTimes(7 + 5), { timeout: 10_000 })
    await waitFor(() => expect(screen.getByRole('button', { name: /remy, let'?s cook/i })).toBeEnabled(), { timeout: 10_000 })
    speak.mockClear()

    pick(/^Beginner/)
    await waitFor(() => expect(screen.getByRole('button', { name: /remy, let'?s cook/i })).toBeEnabled(), { timeout: 10_000 })
    expect(speak).not.toHaveBeenCalled()
  })

  it('makes every clip again in the new voice when the Persona changes on the prep screen', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /let'?s cook/i }))
    await voiceReady()
    speak.mockClear()

    pick(/^Sergeant/)
    await waitFor(() => expect(speak).toHaveBeenCalledTimes(7), { timeout: 10_000 })
    for (const [, persona] of speak.mock.calls) expect(persona).toBe('sergeant')
    expect(spoken()).toContain('Eyes front! Hold still!')
  })

  it('shows the Persona\'s lines on the prep screen', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /let'?s cook/i }))
    await voiceReady()
    expect(screen.getByText('Mise en place, chef! Ready when you are.')).toBeTruthy()
    pick(/^Sergeant/)
    expect(screen.getByText('Stations ready, cook! Check your gear.')).toBeTruthy()
  })

  it('has no way to change them once cooking has started', async () => {
    render(<App />)
    pick(/^Grandma/)
    fireEvent.click(screen.getByRole('button', { name: /let'?s cook/i }))
    await voiceReady()
    fireEvent.click(screen.getByRole('button', { name: /remy, let'?s cook/i }))
    await screen.findByText(/here we go, dear/i, undefined, { timeout: 10_000 })
    expect(screen.queryByRole('button', { name: /cook settings/i })).toBeNull()
  })
})
