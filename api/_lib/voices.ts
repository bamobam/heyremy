// Which ElevenLabs voice speaks for a Persona (CONTEXT.md **Persona**). One default voice; Grandma and the
// Sergeant can have voices of their own, set by the owner in the environment. No voice ids are built in
// beyond the default, so nothing changes until the owner configures them. Pure.
// (Kept apart from elevenlabs.ts, which makes the network call, so this can be used without it.)

import type { PersonaId } from '../../src/types.js'

// Premade voice "Alice" (clear, British); free plans can't use library voices via the API. Not a secret.
export const DEFAULT_VOICE_ID = 'Xb7hH8MSUJpSbSDYk0k2'

/** The environment variable that sets each Persona's voice. Remy has none: his voice is the default. */
export const VOICE_ENV: Partial<Record<PersonaId, string>> = {
  grandma: 'ELEVENLABS_VOICE_GRANDMA',
  sergeant: 'ELEVENLABS_VOICE_SERGEANT',
}

// ElevenLabs voice ids are short alphanumeric strings. The id goes into the request address, so anything
// else (a slash, a query, a space) is ignored rather than trusted.
const VOICE_ID_SHAPE = /^[A-Za-z0-9_-]{8,64}$/

/** The voice for a Persona: its own when the owner has set one up, otherwise the default voice. */
export function voiceIdFor(persona: PersonaId | undefined, env: Record<string, string | undefined> = process.env): string {
  const name = persona === undefined ? undefined : VOICE_ENV[persona]
  const set = name === undefined ? undefined : env[name]?.trim()
  return set !== undefined && VOICE_ID_SHAPE.test(set) ? set : DEFAULT_VOICE_ID
}
