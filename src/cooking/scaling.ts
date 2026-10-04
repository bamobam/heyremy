// Scales a recipe to a different number of servings, with no AI. Amounts are
// rounded to what a cook can actually measure, and every amount comes in two
// forms: how it is shown on screen and how it is read aloud.
//
// Steps hold placeholders like {flour} instead of "1 cup flour", and they are
// filled in here at the chosen servings.

import type { Ingredient, Step } from '../types.ts'

export type Form = 'screen' | 'spoken'

export interface IngredientText {
  /** For the screen, e.g. "½ cup flour". */
  screen: string
  /** For the voice, e.g. "half a cup of flour". */
  spoken: string
  /** Set when rounding moved the amount a lot, e.g. "½ egg rounds to 1 egg". */
  note: string | null
  /** Whether the amount shown differs from the original recipe's. */
  changed: boolean
}

/** How many times the recipe's amounts to make. */
export const scaleFactor = (servings: number, recipeServings: number) => servings / recipeServings

/** Null amounts ("a pinch", "to taste") are never scaled. */
export const scaleAmount = (amount: number | null, factor: number): number | null =>
  amount === null ? null : amount * factor

// ---------- Quantities: whole numbers and kitchen fractions ----------

/** Kitchen fractions: value, symbol, and how it is said on its own. */
const FRACTIONS: [value: number, symbol: string, words: string][] = [
  [0, '', ''],
  [1 / 8, '⅛', 'an eighth'],
  [1 / 4, '¼', 'a quarter'],
  [1 / 3, '⅓', 'a third'],
  [1 / 2, '½', 'half'],
  [2 / 3, '⅔', 'two thirds'],
  [3 / 4, '¾', 'three quarters'],
  [1, '', ''],
]

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
const numberWord = (n: number) => (Number.isInteger(n) && n >= 0 && n <= 12 ? NUMBER_WORDS[n] : String(n))

/** The nearest whole-plus-kitchen-fraction to n. */
function nearestQuantity(n: number) {
  const whole = Math.floor(n + 1e-9)
  const frac = n - whole
  let best = FRACTIONS[0]
  for (const f of FRACTIONS) if (Math.abs(f[0] - frac) < Math.abs(best[0] - frac)) best = f
  return best[0] === 1 ? { whole: whole + 1, fraction: FRACTIONS[0] } : { whole, fraction: best }
}

/** n written to the nearest kitchen fraction: "1½" on screen, "one and a half" aloud. */
export function formatQuantity(n: number, form: Form): string {
  const { whole, fraction } = nearestQuantity(n)
  const [, symbol, words] = fraction
  if (form === 'screen') return whole === 0 && !symbol ? '0' : `${whole || ''}${symbol}`
  if (!symbol) return numberWord(whole)
  if (whole === 0) return words
  return `${numberWord(whole)} and ${words === 'half' ? 'a half' : words}`
}

// ---------- Volume: cups, tablespoons, teaspoons ----------

const TSP_PER = { cup: 48, tbsp: 3, tsp: 1 } as const
type VolumeUnit = keyof typeof TSP_PER

interface Piece {
  qty: number
  unit: VolumeUnit
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step

/** n as a whole-plus-fraction quantity, if it is within `tolerance` of one. */
function cleanQuantity(n: number, tolerance: number): number | null {
  const { whole, fraction } = nearestQuantity(n)
  const q = whole + fraction[0]
  return Math.abs(q - n) <= tolerance ? q : null
}

/** An amount under a cup, as tablespoons and teaspoons. */
function smallPieces(tsp: number): Piece[] {
  if (tsp < 3) return [{ qty: tsp, unit: 'tsp' }]
  const tbsp = Math.floor(tsp / 3 + 1e-9)
  const rest = tsp - tbsp * 3
  if (rest === 0) return [{ qty: tbsp, unit: 'tbsp' }]
  if (rest === 1.5) return [{ qty: tbsp + 0.5, unit: 'tbsp' }]
  return [{ qty: tbsp, unit: 'tbsp' }, { qty: rest, unit: 'tsp' }]
}

/**
 * An amount in teaspoons, as the fewest pieces a cook can measure. Cups only when
 * it is a clean fraction (¼ cup or more), otherwise tablespoons: halving ¾ cup is
 * exactly 6 tbsp.
 */
function volumePieces(tsp: number): Piece[] | 'pinch' {
  if (tsp < 1 / 16) return 'pinch'
  const t = tsp < 1 ? roundTo(tsp, 1 / 8) : roundTo(tsp, 1 / 4)
  if (t >= 12) {
    const cups = t / TSP_PER.cup
    const clean = cleanQuantity(cups, 0.01)
    if (clean !== null) return [{ qty: clean, unit: 'cup' }]
    if (t >= TSP_PER.cup) {
      let whole = Math.floor(cups + 1e-9)
      let restTbsp = roundTo((t - whole * TSP_PER.cup) / 3, 0.5)
      if (restTbsp >= 16) {
        whole += 1
        restTbsp = 0
      }
      const pieces: Piece[] = [{ qty: whole, unit: 'cup' }]
      if (restTbsp > 0) pieces.push(...smallPieces(restTbsp * 3))
      return pieces
    }
  }
  return smallPieces(t)
}

// ---------- Singular and plural for whole items ----------

/** Words that read the same either way, such as watercress and asparagus. */
const SAME_EITHER_WAY = /(ss|us|is)$/

const looksPlural = (name: string) => name.endsWith('s') && !SAME_EITHER_WAY.test(name)

function singular(name: string): string {
  if (!looksPlural(name)) return name
  if (/ies$/.test(name)) return `${name.slice(0, -3)}y`
  if (/(oes|ches|shes|xes|sses)$/.test(name)) return name.slice(0, -2)
  return name.slice(0, -1)
}

function plural(name: string): string {
  if (looksPlural(name) || SAME_EITHER_WAY.test(name)) return name
  if (/[^aeiou]y$/.test(name)) return `${name.slice(0, -1)}ies`
  if (/(s|x|ch|sh|tomato|potato)$/.test(name)) return `${name}es`
  return `${name}s`
}

/** The name of a whole item for this many of it: "1 egg", "2 eggs". Anything not above one is singular. */
const nounFor = (name: string, count: number) => (count > 1 ? plural(name) : singular(name))

// ---------- Words for units ----------

const SPOKEN_UNITS: Record<string, string> = {
  cup: 'cup',
  tbsp: 'tablespoon',
  tsp: 'teaspoon',
  g: 'gram',
  kg: 'kilogram',
  ml: 'milliliter',
  l: 'liter',
  oz: 'ounce',
  lb: 'pound',
}

const spokenUnit = (unit: string) => SPOKEN_UNITS[unit] ?? unit

/** A volume piece said aloud: "half a cup", "one and a half cups", "six tablespoons". */
function spokenPiece({ qty, unit }: Piece): string {
  const word = spokenUnit(unit)
  const spoken = formatQuantity(qty, 'spoken')
  if (qty > 1) return `${spoken} ${word}s`
  if (qty === 1) return `one ${word}`
  return spoken === 'half' ? `half a ${word}` : `${spoken} of a ${word}`
}

const screenPiece = ({ qty, unit }: Piece) => `${formatQuantity(qty, 'screen')} ${unit === 'cup' && qty > 1 ? 'cups' : unit}`

// ---------- One ingredient ----------

const METRIC = new Set(['g', 'kg', 'ml', 'l'])

type Rendered = Omit<IngredientText, 'changed'>

function render(i: Ingredient, factor: number): Rendered {
  const scaled = scaleAmount(i.amount, factor)
  if (scaled === null) return { screen: i.name, spoken: i.name, note: null }

  if (i.unit === null) {
    if (!Number.isInteger(i.amount)) {
      // A fraction to begin with, such as half an onion: keep it a fraction.
      return {
        screen: `${formatQuantity(scaled, 'screen')} ${nounFor(i.name, scaled)}`,
        spoken: `${formatQuantity(scaled, 'spoken')} ${nounFor(i.name, scaled)}`,
        note: null,
      }
    }
    // Whole items such as eggs: whole numbers, never below one.
    const rounded = Math.max(1, Math.round(scaled))
    const note =
      Math.abs(scaled - rounded) >= 0.25
        ? `${formatQuantity(scaled, 'screen')} ${nounFor(i.name, scaled)} rounds to ${rounded} ${nounFor(i.name, rounded)}`
        : null
    const name = nounFor(i.name, rounded)
    return { screen: `${rounded} ${name}`, spoken: `${numberWord(rounded)} ${name}`, note }
  }

  if (i.unit in TSP_PER) {
    const pieces = volumePieces(scaled * TSP_PER[i.unit as VolumeUnit])
    if (pieces === 'pinch') return { screen: `a pinch of ${i.name}`, spoken: `a pinch of ${i.name}`, note: null }
    return {
      screen: `${pieces.map(screenPiece).join(' + ')} ${i.name}`,
      spoken: `${pieces.map(spokenPiece).join(' plus ')} of ${i.name}`,
      note: null,
    }
  }

  if (METRIC.has(i.unit)) {
    const value = scaled >= 10 ? Math.round(scaled) : Math.round(scaled * 10) / 10
    const word = spokenUnit(i.unit)
    return {
      screen: `${value} ${i.unit} ${i.name}`,
      spoken: `${numberWord(value)} ${value === 1 ? word : `${word}s`} of ${i.name}`,
      note: null,
    }
  }

  // Any other unit (oz, lb, clove, can...): kitchen fractions, unit as given.
  const word = spokenUnit(i.unit)
  return {
    screen: `${formatQuantity(scaled, 'screen')} ${i.unit} ${i.name}`,
    spoken: `${formatQuantity(scaled, 'spoken')} ${scaled > 1 ? `${word}s` : word} of ${i.name}`,
    note: null,
  }
}

/** One ingredient at `factor` times its recipe amount, in both forms. */
export function describeIngredient(i: Ingredient, factor: number): IngredientText {
  const now = render(i, factor)
  return { ...now, changed: factor !== 1 && now.screen !== render(i, 1).screen }
}

/** One ingredient's amount in one form. */
export const formatAmount = (i: Ingredient, factor: number, form: Form): string => describeIngredient(i, factor)[form]

// ---------- Placeholders in steps ----------

const PLACEHOLDER = /\{([^{}]+)\}/g

export const hasPlaceholders = (text: string) => /\{[^{}]+\}/.test(text)

/** Replaces each {id} with that ingredient's scaled amount. An id not in the recipe becomes the bare id. */
export function fillPlaceholders(text: string, ingredients: Ingredient[], factor: number, form: Form): string {
  return text.replace(PLACEHOLDER, (_match, id: string) => {
    const ingredient = ingredients.find((i) => i.id === id)
    return ingredient ? formatAmount(ingredient, factor, form) : id
  })
}

/**
 * The id of a step's audio clip. A clip with amounts in it is different at every
 * servings, so it carries the servings; any other clip is the same at all of them
 * and survives a servings change.
 */
export const stepClipId = (step: Step, servings: number) =>
  hasPlaceholders(step.spoken) ? `step-${step.id}@${servings}` : `step-${step.id}`
