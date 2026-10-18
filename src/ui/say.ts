// Remy's lines, in one table per Persona so the speech and the screen always say the same thing
// (SYSTEM_DESIGN §9.3). The audio player reuses these as its browser-speech fallback.
// A Persona changes the wording of these lines (and, server side, of verdicts); never a Recipe.
// The characters are invented archetypes, never real chefs.
import { DONE_CLIP, LOOKING_CLIP, fixedLine } from '../audio/lines.ts'
import { DEFAULT_PERSONA } from '../cooking/settings.ts'
import type { PersonaId } from '../types.ts'

export type VerdictStatus = 'ready' | 'not_ready' | 'unsure'

export interface Say {
  hello: string
  ask: string
  reading: string
  prep: string
  go: string
  look: string
  headsUp: string
  done: string
  /** The catchline over a verdict's own spoken sentence. */
  verdict: Record<VerdictStatus, string>
}

const PERSONA_SAY: Record<PersonaId, Say> = {
  remy: {
    hello: "Hey, I'm Remy! Let's cook!",
    ask: 'What are we making today, chef?',
    reading: 'Sniffing out the steps…',
    prep: 'Mise en place, chef! Ready when you are.',
    go: 'Remy ready! Aprons on.',
    look: fixedLine(LOOKING_CLIP, 'remy'),
    headsUp: 'Psst, chef!',
    done: fixedLine(DONE_CLIP, 'remy'),
    verdict: {
      ready: 'Oui, chef!',
      not_ready: 'Almost, chef!',
      unsure: "Hmm, my whiskers can't see that",
    },
  },
  grandma: {
    hello: "Hello, dear. Come, let's cook together.",
    ask: 'What shall we make today?',
    reading: 'Reading it slowly, dear…',
    prep: 'Take your time, dear. Gather everything first.',
    go: 'Here we go, dear. Aprons on.',
    look: fixedLine(LOOKING_CLIP, 'grandma'),
    headsUp: 'A little warning, dear.',
    done: fixedLine(DONE_CLIP, 'grandma'),
    verdict: {
      ready: 'Perfect, dear!',
      not_ready: 'Nearly there, dear.',
      unsure: "I can't quite see, dear.",
    },
  },
  sergeant: {
    hello: 'Cook reporting for duty? Good. Move out!',
    ask: "What's the mission today?",
    reading: 'Reading the orders…',
    prep: 'Stations ready, cook! Check your gear.',
    go: 'Aprons on. Move out!',
    look: fixedLine(LOOKING_CLIP, 'sergeant'),
    headsUp: 'Heads up, cook!',
    done: fixedLine(DONE_CLIP, 'sergeant'),
    verdict: {
      ready: 'Outstanding, cook!',
      not_ready: 'Not yet, cook!',
      unsure: "Can't see it, cook!",
    },
  },
}

/** The lines for a Persona; Remy's when none is given. */
export const sayFor = (persona: PersonaId = DEFAULT_PERSONA): Say => PERSONA_SAY[persona]

/** Remy's own lines, for anything that has no Persona to ask. */
export const SAY: Say = PERSONA_SAY[DEFAULT_PERSONA]

/** What the gesture legend promises, in the order it is shown. */
export const GESTURE_HINTS = [
  { intent: 'back', icon: '👎', label: 'back' },
  { intent: 'check', icon: '✋', label: 'is it ready?' },
  { intent: 'next', icon: '👍', label: 'next' },
] as const
