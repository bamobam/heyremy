import { afterEach, describe, expect, it, vi } from 'vitest'
import { FakeSpeechSynthesis, FakeUtterance, voice } from '../test/fakes/audio.ts'
import { createBrowserSpeech, pickVoice, type SpeechEngine } from './browserSpeech.ts'

const FR = voice('Thomas', 'fr-FR', true)
const GB = voice('Daniel', 'en-GB')
const US = voice('Samantha', 'en-US')
const US_DEFAULT = voice('Alex', 'en-US', true)

function setup(voices: SpeechSynthesisVoice[] = [US]) {
  const engine = new FakeSpeechSynthesis(voices)
  const speech = createBrowserSpeech({
    engine: engine as unknown as SpeechEngine,
    makeUtterance: (text) => new FakeUtterance(text) as unknown as SpeechSynthesisUtterance,
  })
  return { engine, speech }
}

describe('pickVoice', () => {
  it('prefers en-US over other English voices', () => {
    expect(pickVoice([FR, GB, US])).toBe(US)
  })

  it('prefers the default voice among equals', () => {
    expect(pickVoice([US, US_DEFAULT])).toBe(US_DEFAULT)
  })

  it('falls back to any English voice', () => {
    expect(pickVoice([FR, GB])).toBe(GB)
  })

  it('accepts underscore language tags', () => {
    const android = voice('English', 'en_US')
    expect(pickVoice([GB, android])).toBe(android)
  })

  it('returns null when there is no English voice', () => {
    expect(pickVoice([FR])).toBeNull()
    expect(pickVoice([])).toBeNull()
  })
})

describe('browserSpeech', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reads text in English with the picked voice and resolves when done', async () => {
    const { engine, speech } = setup([FR, US])
    let done = false
    const said = speech.say('Looks smooth, next step.').then(() => (done = true))
    const [u] = engine.spoken
    expect(u.text).toBe('Looks smooth, next step.')
    expect(u.lang).toBe('en-US')
    expect(u.voice).toBe(US)
    await Promise.resolve()
    expect(done).toBe(false)
    engine.finish()
    await said
    expect(done).toBe(true)
  })

  it('picks the voice once, waiting for voices that load late', () => {
    const { engine, speech } = setup([])
    engine.loadVoices([US])
    engine.loadVoices([GB]) // a later change doesn't re-pick
    speech.say('hi')
    expect(engine.spoken[0].voice).toBe(US)
  })

  it('still speaks English when no voice is available', () => {
    const { engine, speech } = setup([])
    speech.say('hi')
    expect(engine.spoken[0].voice).toBeNull()
    expect(engine.spoken[0].lang).toBe('en-US')
  })

  it('resolves instead of rejecting when speech fails', async () => {
    const { engine, speech } = setup()
    const said = speech.say('hi')
    engine.spoken[0].onerror?.({ error: 'synthesis-failed' })
    await expect(said).resolves.toBeUndefined()
  })

  it('cancel stops speech and resolves the pending say', async () => {
    const { engine, speech } = setup()
    const said = speech.say('a long sentence')
    const before = engine.cancelCount
    speech.cancel()
    await expect(said).resolves.toBeUndefined()
    expect(engine.cancelCount).toBe(before + 1)
    expect(engine.pending).toBe(0)
  })

  it('a new say cuts off the previous one', async () => {
    const { engine, speech } = setup()
    const first = speech.say('first')
    speech.say('second')
    await expect(first).resolves.toBeUndefined()
    expect(engine.pending).toBe(1)
    expect(engine.spoken.map((u) => u.text)).toEqual(['first', 'second'])
  })

  it('skips empty text', async () => {
    const { engine, speech } = setup()
    await speech.say('  ')
    expect(engine.spoken).toHaveLength(0)
  })

  it('unlock speaks a silent utterance', () => {
    const { engine, speech } = setup()
    speech.unlock()
    expect(engine.spoken).toHaveLength(1)
    expect(engine.spoken[0].volume).toBe(0)
  })

  it('does nothing when the browser has no speechSynthesis', async () => {
    const speech = createBrowserSpeech({ engine: null })
    speech.unlock()
    speech.cancel()
    await expect(speech.say('hi')).resolves.toBeUndefined()
  })

  it('uses window.speechSynthesis by default', () => {
    const engine = new FakeSpeechSynthesis([US])
    vi.stubGlobal('speechSynthesis', engine)
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
    createBrowserSpeech().say('hi')
    expect(engine.spoken[0]).toBeInstanceOf(FakeUtterance)
    expect(engine.spoken[0].voice).toBe(US)
  })
})
