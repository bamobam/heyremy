// The Personas the server knows (CONTEXT.md **Persona**): the character Remy speaks as. A Persona
// changes the voice and the wording of lines produced live (verdicts, later answers); it never changes
// a Recipe or a step's narration (ADR 0003). Pure.

import type { PersonaId } from '../../src/types.js'

export const DEFAULT_PERSONA: PersonaId = 'remy'

// Typed so a Persona added to PersonaId in src/types.ts cannot be forgotten here: a missing key is a compile error.
const KNOWN: Record<PersonaId, true> = { remy: true, grandma: true, sergeant: true }

export const PERSONA_IDS = Object.keys(KNOWN) as PersonaId[]

export const isPersonaId = (x: unknown): x is PersonaId => typeof x === 'string' && Object.hasOwn(KNOWN, x)

/** Returns an error message, or null when `persona` is missing (the default) or a known id. */
export function checkPersona(value: unknown): string | null {
  if (value === undefined || value === null) return null
  return isPersonaId(value) ? null : `persona must be ${PERSONA_IDS.slice(0, -1).join(', ')} or ${PERSONA_IDS.at(-1)}.`
}
