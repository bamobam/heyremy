// The two spoken lines that are fixed clips rather than step text, and their cache ids. The UI's SAY
// table reuses the text, so the screen and the voice say the same thing.
export const LOOKING_CLIP = 'looking'
export const DONE_CLIP = 'done'

export const FIXED_LINES = {
  [LOOKING_CLIP]: 'Whiskers on it… hold still!',
  [DONE_CLIP]: 'Bon appétit, chef!',
} as const
