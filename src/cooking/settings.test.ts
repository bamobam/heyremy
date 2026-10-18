// Cook settings: the Level and Persona the cook chose, kept in this browser. Pure, and never throws.
import { describe, expect, it } from 'vitest'
import { blocked, memory } from '../test/fakes/storage.ts'
import {
  DEFAULT_LEVEL,
  DEFAULT_PERSONA,
  DEFAULT_SETTINGS,
  LEVELS,
  PERSONAS,
  SETTINGS_KEY,
  loadSettings,
  mergeSettings,
  parseSettings,
  saveSettings,
  summarizeSettings,
  personaSuffix,
} from './settings.ts'

describe('the defaults', () => {
  it('are beginner and Remy, which is how Remy behaved before settings existed', () => {
    expect(DEFAULT_LEVEL).toBe('beginner')
    expect(DEFAULT_PERSONA).toBe('remy')
    expect(DEFAULT_SETTINGS).toEqual({ level: 'beginner', persona: 'remy' })
  })

  it('has a label and a one-line description for every Level and Persona, with the default first', () => {
    expect(LEVELS.map((l) => l.id)).toEqual(['beginner', 'intermediate', 'master'])
    expect(PERSONAS.map((p) => p.id)).toEqual(['remy', 'grandma', 'sergeant'])
    for (const option of [...LEVELS, ...PERSONAS]) {
      expect(option.label.trim()).not.toBe('')
      expect(option.description.trim()).not.toBe('')
      expect(option.description).not.toContain('\n')
    }
  })
})

describe('parseSettings', () => {
  it('reads what saveSettings writes', () => {
    expect(parseSettings(JSON.stringify({ level: 'master', persona: 'sergeant' }))).toEqual({ level: 'master', persona: 'sergeant' })
  })

  it.each([null, '', 'not json', '[]', 'null', '42', '"master"', '{', 'undefined'])('falls back to the defaults for %j', (raw) => {
    expect(parseSettings(raw)).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps the good field when the other one is unknown or the wrong type', () => {
    expect(parseSettings('{"level":"master","persona":"gordon"}')).toEqual({ level: 'master', persona: 'remy' })
    expect(parseSettings('{"level":"expert","persona":"grandma"}')).toEqual({ level: 'beginner', persona: 'grandma' })
    expect(parseSettings('{"level":3,"persona":["grandma"]}')).toEqual(DEFAULT_SETTINGS)
  })

  it('fills in a missing field and ignores extra ones', () => {
    expect(parseSettings('{"persona":"grandma"}')).toEqual({ level: 'beginner', persona: 'grandma' })
    expect(parseSettings('{"level":"intermediate","theme":"dark"}')).toEqual({ level: 'intermediate', persona: 'remy' })
  })

  it('does not trust inherited keys', () => {
    expect(parseSettings('{"level":"__proto__","persona":"constructor"}')).toEqual(DEFAULT_SETTINGS)
  })
})

describe('mergeSettings', () => {
  it('changes only the fields given', () => {
    expect(mergeSettings(DEFAULT_SETTINGS, { level: 'master' })).toEqual({ level: 'master', persona: 'remy' })
    expect(mergeSettings({ level: 'master', persona: 'remy' }, { persona: 'grandma' })).toEqual({ level: 'master', persona: 'grandma' })
  })

  it('hands back the same object when nothing changes, so a state update can be skipped', () => {
    const now = { level: 'master', persona: 'grandma' } as const
    expect(mergeSettings(now, {})).toBe(now)
    expect(mergeSettings(now, { level: 'master' })).toBe(now)
    expect(mergeSettings(now, { level: 'master', persona: 'grandma' })).toBe(now)
  })

  it('ignores a value that is not a Level or a Persona', () => {
    const now = DEFAULT_SETTINGS
    expect(mergeSettings(now, { level: 'expert' as never })).toBe(now)
    expect(mergeSettings(now, { persona: 'gordon' as never })).toBe(now)
    expect(mergeSettings(now, { level: undefined })).toBe(now)
  })
})

describe('loadSettings and saveSettings', () => {
  it('start from the defaults, and remember a choice', () => {
    const store = memory()
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS)
    expect(saveSettings(store, { level: 'intermediate', persona: 'grandma' })).toBe(true)
    expect(loadSettings(store)).toEqual({ level: 'intermediate', persona: 'grandma' })
    expect(store.getItem(SETTINGS_KEY)).toBe('{"level":"intermediate","persona":"grandma"}')
  })

  it('use the key remy.settings', () => {
    expect(SETTINGS_KEY).toBe('remy.settings')
  })

  it('read damaged saved data as the defaults', () => {
    expect(loadSettings(memory({ [SETTINGS_KEY]: '{"level":' }))).toEqual(DEFAULT_SETTINGS)
  })

  it('never throw where storage is blocked or missing', () => {
    expect(loadSettings(blocked)).toEqual(DEFAULT_SETTINGS)
    expect(saveSettings(blocked, DEFAULT_SETTINGS)).toBe(false)
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(saveSettings(null, DEFAULT_SETTINGS)).toBe(false)
  })
})

describe('summarizeSettings', () => {
  it('names the Level and the Persona', () => {
    expect(summarizeSettings(DEFAULT_SETTINGS)).toBe('Beginner · Remy')
    expect(summarizeSettings({ level: 'master', persona: 'grandma' })).toBe('Master · Grandma')
    expect(summarizeSettings({ level: 'intermediate', persona: 'sergeant' })).toBe('Intermediate · Sergeant')
  })
})

describe('personaSuffix', () => {
  it('adds nothing for Remy, so the ids cached before settings existed still hold, and names any other Persona', () => {
    expect(personaSuffix('remy')).toBe('')
    expect(personaSuffix('grandma')).toBe('~grandma')
    expect(personaSuffix('sergeant')).toBe('~sergeant')
  })
})
