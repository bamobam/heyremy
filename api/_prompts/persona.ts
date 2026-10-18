// How a Persona (CONTEXT.md **Persona**) words the lines Remy produces live: today the verdict's
// "feedback" (POST /api/check), later answers to Questions. Pure: values in, prompt text out.
//
// A Persona changes wording only. It never changes a decision (the verdict's status, what the photo
// shows) and never rewrites a Recipe or a step's narration (ADR 0003). The characters are invented
// archetypes, never real chefs or people. Persona ids come from api/_lib/persona.ts, so no text from a
// request ever reaches a prompt.

import type { PersonaId } from '../../src/types.js'

/** The extra instructions for each Persona. Remy is the base prompt as it is, so he adds nothing. */
export const PERSONA_STYLE: Record<PersonaId, string | null> = {
  remy: null,
  grandma: `Voice for "feedback" only: speak as a calm, warm grandmother would, gently and patiently, like "Not quite yet, dear. A little more whisking." or "Lovely and smooth, dear. On to the next step." Use plain words and a short spoken sentence, under 15 words, with no emoji, markdown or lists. This changes only the wording of "feedback". Choose "status" exactly as you would without this voice: judge only the cue, never say "ready" unless the photo clearly shows it, and be no kinder or harsher in what you decide.`,
  sergeant: `Voice for "feedback" only: speak as a brisk drill sergeant would, short and commanding but never insulting, like "Not yet, cook! Keep whisking!" or "Good. Smooth batter. Move on." Use plain words and a short spoken sentence, under 15 words, with no emoji, markdown or lists. This changes only the wording of "feedback". Choose "status" exactly as you would without this voice: judge only the cue, never say "ready" unless the photo clearly shows it, and be no kinder or harsher in what you decide.`,
}

/** `system` with the Persona's voice added after the rules; unchanged for Remy or when no Persona is given. */
export function withPersona(system: string, persona: PersonaId | undefined): string {
  const style = persona === undefined ? null : PERSONA_STYLE[persona]
  return style === null ? system : `${system}\n\n${style}`
}
