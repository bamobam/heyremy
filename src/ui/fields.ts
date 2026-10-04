// The step colour fields and the three verdict fields (SYSTEM_DESIGN §9.1). Pure data, so the CSS
// token names and the hex values stay in one place and can be checked in a test.
//
// Every colour here has a name in tokens.css. Keep the two in step: a field's `card` is one of the
// six palette tokens, and `back` is that token's darker page backdrop.
export interface Field {
  /** The card's own colour. Also the palette token name. */
  card: string
  /** The page behind the card: a deeper shade of `card`. */
  back: string
  /** Text on the field: cream on dark cards, ink on light ones. */
  fg: string
  /** The step's accent: the step number's shape, the heads-up block, the camera bezel. */
  accent: string
}

/** Six fields, cycling every six steps, so consecutive steps never look alike. */
export const FIELDS: readonly Field[] = [
  { card: '#541B05', back: '#2A0D02', fg: '#FFF7EA', accent: '#DE9762' }, // umber
  { card: '#657167', back: '#343B35', fg: '#FFF7EA', accent: '#EDCEBA' }, // sage
  { card: '#2F3341', back: '#181A22', fg: '#FFF7EA', accent: '#F4905F' }, // slate
  { card: '#BE7463', back: '#5E3127', fg: '#1D1B20', accent: '#FFF7EA' }, // clay
  { card: '#73462F', back: '#3A2317', fg: '#FFF7EA', accent: '#E3BEB2' }, // cocoa
  { card: '#DE9762', back: '#6E4325', fg: '#1D1B20', accent: '#541B05' }, // apricot
]

/** The field for step `index`, cycling every six. */
export function fieldFor(index: number): Field {
  return FIELDS[((index % FIELDS.length) + FIELDS.length) % FIELDS.length]
}

/** The field a verdict paints the screen in: sage, clay, or the unsure grey. */
export const VERDICT_FIELDS = {
  ready: '#657167',
  not_ready: '#BE7463',
  unsure: '#9F9593',
} as const satisfies Record<string, string>

/** The checklist box colours, in order, so prep is not four identical ticks. */
export const CHECKLIST_COLOURS = ['#DE9762', '#BE7463', '#657167', '#2F3341'] as const

/** Every colour the UI paints with, so a test can prove each has a token. */
export const ALL_FIELD_COLOURS: readonly string[] = [
  ...FIELDS.flatMap(f => [f.card, f.back, f.fg, f.accent]),
  ...Object.values(VERDICT_FIELDS),
  ...CHECKLIST_COLOURS,
]