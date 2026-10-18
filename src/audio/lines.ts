// The two spoken lines that are fixed clips rather than step text, and their cache ids. The UI's SAY
// table reuses the text, so the screen and the voice say the same thing.
import type { PersonaId } from '../types.ts'
import { DEFAULT_PERSONA, personaSuffix } from '../cooking/settings.ts'

export const LOOKING_CLIP = 'looking'
export const DONE_CLIP = 'done'

export type FixedClip = typeof LOOKING_CLIP | typeof DONE_CLIP

/** Remy's own lines (the default Persona). */
export const FIXED_LINES = {
  [LOOKING_CLIP]: 'Whiskers on it… hold still!',
  [DONE_CLIP]: 'Bon appétit, chef!',
} as const

/** The same two lines in each Persona's words. Invented characters, never real chefs. */
const PERSONA_LINES: Record<PersonaId, Record<FixedClip, string>> = {
  remy: FIXED_LINES,
  grandma: {
    [LOOKING_CLIP]: 'Let me have a look, dear. Hold still.',
    [DONE_CLIP]: "Lovely work, dear. Enjoy it while it's warm.",
  },
  sergeant: {
    [LOOKING_CLIP]: 'Eyes front! Hold still!',
    [DONE_CLIP]: 'Mission accomplished, cook. Dismissed!',
  },
}

/** What a fixed clip says in this Persona's words. */
export const fixedLine = (clip: FixedClip, persona: PersonaId = DEFAULT_PERSONA): string => PERSONA_LINES[persona][clip]

/** The cache id of a fixed clip in this Persona's voice. Remy's keep their plain ids. */
export const fixedClipId = (clip: FixedClip, persona: PersonaId = DEFAULT_PERSONA): string => `${clip}${personaSuffix(persona)}`
