// Remy's lines, in one table so the speech and the screen always say the same thing
// (SYSTEM_DESIGN §9.3). The audio player reuses these as its browser-speech fallback.
export const SAY = {
  hello: "Hey, I'm Remy! Let's cook!",
  ask: 'What are we making today, chef?',
  reading: 'Sniffing out the steps…',
  prep: 'Mise en place, chef! Ready when you are.',
  go: 'Remy ready! Aprons on.',
  look: 'Whiskers on it… hold still!',
  headsUp: 'Psst, chef!',
  done: 'Bon appétit, chef!',
  verdict: {
    ready: 'Oui, chef!',
    not_ready: 'Almost, chef!',
    unsure: "Hmm, my whiskers can't see that",
  },
} as const

export type VerdictStatus = keyof typeof SAY.verdict

/** What the gesture legend promises, in the order it is shown. */
export const GESTURE_HINTS = [
  { intent: 'back', icon: '👎', label: 'back' },
  { intent: 'check', icon: '✋', label: 'is it ready?' },
  { intent: 'next', icon: '👍', label: 'next' },
] as const