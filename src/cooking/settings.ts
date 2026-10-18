// Cook settings (CONTEXT.md): the Level and Persona the cook chose, kept in this browser. Pure apart
// from the storage it is handed, and never throws: a blocked store or damaged saved data just means
// the defaults (beginner, Remy), which is how Remy always behaved before settings existed.
//
// A Level changes only what is said; a Persona changes only the voice and the live lines (ADR 0003).
// Neither ever changes a Recipe.

import type { Level, PersonaId } from '../types.ts'
import { pageStorage, readItem, writeItem, type Store } from './storage.ts'

export interface CookSettings {
  level: Level
  persona: PersonaId
}

export const DEFAULT_LEVEL: Level = 'beginner'
export const DEFAULT_PERSONA: PersonaId = 'remy'
export const DEFAULT_SETTINGS: CookSettings = { level: DEFAULT_LEVEL, persona: DEFAULT_PERSONA }

export const SETTINGS_KEY = 'remy.settings'

export interface SettingOption<Id extends string> {
  id: Id
  label: string
  /** One line, for the cook choosing. */
  description: string
}

/** The Levels in the order they are offered, the default first. */
export const LEVELS: readonly SettingOption<Level>[] = [
  { id: 'beginner', label: 'Beginner', description: 'Explains technique and what to watch for.' },
  { id: 'intermediate', label: 'Intermediate', description: 'Shorter, skips the basics.' },
  { id: 'master', label: 'Master', description: 'Brief, trusts you to know how.' },
]

/** The Personas in the order they are offered, the default first. */
export const PERSONAS: readonly SettingOption<PersonaId>[] = [
  { id: 'remy', label: 'Remy', description: 'Cheerful kitchen buddy.' },
  { id: 'grandma', label: 'Grandma', description: 'Calm and warm.' },
  { id: 'sergeant', label: 'Sergeant', description: 'Brisk, drill-sergeant energy.' },
]

/** What a Persona adds to the id of an audio clip: nothing for the default voice, so ids cached before settings existed still hold. */
export const personaSuffix = (persona: PersonaId): string => (persona === DEFAULT_PERSONA ? '' : `~${persona}`)

export const isLevel = (x: unknown): x is Level => LEVELS.some((l) => l.id === x)
export const isPersonaId = (x: unknown): x is PersonaId => PERSONAS.some((p) => p.id === x)

/** The settings in a saved string. A missing, damaged or unknown field is that field's default. */
export function parseSettings(raw: string | null): CookSettings {
  let saved: unknown
  try {
    saved = raw === null ? null : JSON.parse(raw)
  } catch {
    saved = null
  }
  const fields = typeof saved === 'object' && saved !== null && !Array.isArray(saved) ? (saved as Record<string, unknown>) : {}
  const own = (key: string) => (Object.hasOwn(fields, key) ? fields[key] : undefined)
  const level = own('level')
  const persona = own('persona')
  return {
    level: isLevel(level) ? level : DEFAULT_LEVEL,
    persona: isPersonaId(persona) ? persona : DEFAULT_PERSONA,
  }
}

/**
 * `current` with the fields of `change` that are real Levels and Personas applied. When nothing ends up
 * different it is `current` itself, so a caller can tell "no change" by identity.
 */
export function mergeSettings(current: CookSettings, change: Partial<CookSettings>): CookSettings {
  const level = isLevel(change.level) ? change.level : current.level
  const persona = isPersonaId(change.persona) ? change.persona : current.persona
  return level === current.level && persona === current.persona ? current : { level, persona }
}

const labelOf = <Id extends string>(options: readonly SettingOption<Id>[], id: Id) => options.find((o) => o.id === id)?.label ?? id

/** What is chosen, in a few words: "Master · Grandma". */
export const summarizeSettings = (settings: CookSettings): string => `${labelOf(LEVELS, settings.level)} · ${labelOf(PERSONAS, settings.persona)}`

export const loadSettings = (store: Store = pageStorage()): CookSettings => parseSettings(readItem(store, SETTINGS_KEY))

/** True if the settings were stored. */
export const saveSettings = (store: Store, settings: CookSettings): boolean =>
  writeItem(store, SETTINGS_KEY, JSON.stringify({ level: settings.level, persona: settings.persona }))
