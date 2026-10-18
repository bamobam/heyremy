// @vitest-environment node -- server code runs on Node, not in the browser
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VOICE_ID } from './elevenlabs.js'
import { DEFAULT_VOICE_ID, VOICE_ENV, voiceIdFor } from './voices.js'

afterEach(() => vi.unstubAllEnvs())

it('keeps the default voice the app has always used', () => {
  expect(DEFAULT_VOICE_ID).toBe('Xb7hH8MSUJpSbSDYk0k2')
  expect(VOICE_ID).toBe(DEFAULT_VOICE_ID)
})

describe('voiceIdFor', () => {
  const GRANDMA = 'GrandmaVoice1234567890'
  const SERGEANT = 'SergeantVoice123456789'

  it('names the two override variables', () => {
    expect(VOICE_ENV).toEqual({ grandma: 'ELEVENLABS_VOICE_GRANDMA', sergeant: 'ELEVENLABS_VOICE_SERGEANT' })
  })

  it('is the default voice until the owner sets a voice up, for every persona', () => {
    for (const persona of [undefined, 'remy', 'grandma', 'sergeant'] as const) expect(voiceIdFor(persona, {})).toBe(VOICE_ID)
  })

  it('is the persona\'s own voice once its variable is set', () => {
    const env = { ELEVENLABS_VOICE_GRANDMA: GRANDMA, ELEVENLABS_VOICE_SERGEANT: SERGEANT }
    expect(voiceIdFor('grandma', env)).toBe(GRANDMA)
    expect(voiceIdFor('sergeant', env)).toBe(SERGEANT)
  })

  it('leaves Remy and a missing persona on the default voice, whatever else is set', () => {
    const env = { ELEVENLABS_VOICE_GRANDMA: GRANDMA, ELEVENLABS_VOICE_SERGEANT: SERGEANT }
    expect(voiceIdFor('remy', env)).toBe(VOICE_ID)
    expect(voiceIdFor(undefined, env)).toBe(VOICE_ID)
  })

  it('sets one voice without the other', () => {
    expect(voiceIdFor('grandma', { ELEVENLABS_VOICE_GRANDMA: GRANDMA })).toBe(GRANDMA)
    expect(voiceIdFor('sergeant', { ELEVENLABS_VOICE_GRANDMA: GRANDMA })).toBe(VOICE_ID)
  })

  it('trims a value copied with spaces, and ignores a blank one', () => {
    expect(voiceIdFor('grandma', { ELEVENLABS_VOICE_GRANDMA: `  ${GRANDMA}\n` })).toBe(GRANDMA)
    expect(voiceIdFor('grandma', { ELEVENLABS_VOICE_GRANDMA: '   ' })).toBe(VOICE_ID)
  })

  it('ignores a value that could not be a voice id, so it can never change the request address', () => {
    for (const bad of ['../../v1/user', 'abc/def', 'abc?x=1', 'abc def', 'a', 'x'.repeat(65), 'voice#1', '%2e%2e']) {
      expect(voiceIdFor('grandma', { ELEVENLABS_VOICE_GRANDMA: bad }), bad).toBe(VOICE_ID)
    }
  })

  it('reads the real environment by default', () => {
    vi.stubEnv('ELEVENLABS_VOICE_SERGEANT', SERGEANT)
    expect(voiceIdFor('sergeant')).toBe(SERGEANT)
  })
})
