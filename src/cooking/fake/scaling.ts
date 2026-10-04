// TEMPORARY (fake, replaced by Nam's cooking/scaling.ts): amounts and placeholders per SYSTEM_DESIGN §6.7. Pure.
// Ported from the prototype's formatAmount (src/prototype/remy-ui/data.ts) and extended for kitchen splits,
// spoken amounts and {ingredientId} placeholders.
import type { Ingredient, Step } from '../../types.ts'

export type AmountForm = 'screen' | 'spoken'

interface Fraction {
  value: number
  screen: string
  spoken: string
}

const F = {
  eighth: { value: 1 / 8, screen: '⅛', spoken: 'an eighth' },
  quarter: { value: 1 / 4, screen: '¼', spoken: 'a quarter' },
  third: { value: 1 / 3, screen: '⅓', spoken: 'a third' },
  half: { value: 1 / 2, screen: '½', spoken: 'half' },
  twoThirds: { value: 2 / 3, screen: '⅔', spoken: 'two thirds' },
  threeQuarters: { value: 3 / 4, screen: '¾', spoken: 'three quarters' },
} satisfies Record<string, Fraction>

const ALL_FRACTIONS: Fraction[] = [F.eighth, F.quarter, F.third, F.half, F.twoThirds, F.threeQuarters]

/** Spoon-and-cup units, smallest last. `next` is the smaller unit an awkward remainder is written in. */
interface KitchenUnit {
  fractions: Fraction[]
  next?: { unit: string; per: number }
  one: string
  many: string
}

const KITCHEN: Record<string, KitchenUnit> = {
  cup: { fractions: [F.quarter, F.third, F.half, F.twoThirds, F.threeQuarters], next: { unit: 'tbsp', per: 16 }, one: 'cup', many: 'cups' },
  tbsp: { fractions: [F.half], next: { unit: 'tsp', per: 3 }, one: 'tablespoon', many: 'tablespoons' },
  tsp: { fractions: ALL_FRACTIONS, one: 'teaspoon', many: 'teaspoons' },
}

const SPOKEN_UNITS: Record<string, [one: string, many: string]> = {
  g: ['gram', 'grams'],
  kg: ['kilogram', 'kilograms'],
  ml: ['millilitre', 'millilitres'],
  l: ['litre', 'litres'],
  oz: ['ounce', 'ounces'],
  lb: ['pound', 'pounds'],
}

/** A kitchen quantity: whole part plus one of the unit's fractions (or none). */
interface Quantity {
  whole: number
  fraction: Fraction | null
}

const qtyValue = (q: Quantity) => q.whole + (q.fraction?.value ?? 0)

/** Nearest whole-plus-fraction to v. */
function snapNearest(v: number, fractions: Fraction[]): Quantity {
  const whole = Math.floor(v)
  const rest = v - whole
  let best: Quantity = { whole, fraction: null }
  let err = rest
  for (const f of fractions) {
    if (Math.abs(f.value - rest) < err) { best = { whole, fraction: f }; err = Math.abs(f.value - rest) }
  }
  if (1 - rest < err) best = { whole: whole + 1, fraction: null }
  return best
}

/** Largest whole-plus-fraction that is ≤ v. */
function snapDown(v: number, fractions: Fraction[]): Quantity {
  const whole = Math.floor(v + 1e-9)
  const rest = v - whole
  let best: Quantity = { whole, fraction: null }
  for (const f of fractions) if (f.value <= rest + 1e-9) best = { whole, fraction: f }
  return best
}

function quantityScreen(q: Quantity): string {
  return `${q.whole > 0 ? q.whole : ''}${q.fraction?.screen ?? ''}` || '0'
}

/** "2 cups", "half a cup", "a third of a cup", "1 and a half cups". */
function quantitySpoken(q: Quantity, one: string, many: string): string {
  if (!q.fraction) return `${q.whole} ${q.whole === 1 ? one : many}`
  if (q.whole === 0) return q.fraction === F.half ? `half a ${one}` : `${q.fraction.spoken} of a ${one}`
  return `${q.whole} and ${q.fraction === F.half ? 'a half' : q.fraction.spoken} ${many}`
}

/** A kitchen amount in one unit, or split into two ("⅓ cup + 1 tbsp") when no fraction is close enough. */
interface KitchenAmount {
  unit: string
  qty: Quantity
  rest?: { unit: string; count: number }
}

function kitchenAmount(v: number, unit: string): KitchenAmount {
  const k = KITCHEN[unit]
  // Lots of tablespoons read better as cups, when that's a clean fraction (12 tbsp → ¾ cup).
  if (unit === 'tbsp' && v >= 4) {
    const cups = kitchenAmount(v / 16, 'cup')
    if (!cups.rest) return cups
  }
  const nearest = snapNearest(v, k.fractions)
  if (!k.next) return { unit, qty: nearest }
  const { unit: small, per } = k.next
  // Close enough: off by at most half of the smaller unit.
  if (Math.abs(qtyValue(nearest) - v) * per <= 0.5 && qtyValue(nearest) > 0) return { unit, qty: nearest }
  const lower = snapDown(v, k.fractions)
  if (qtyValue(lower) === 0) return kitchenAmount(v * per, small)
  const count = Math.round((v - qtyValue(lower)) * per)
  return count > 0 ? { unit, qty: lower, rest: { unit: small, count } } : { unit, qty: lower }
}

function unitScreen(unit: string, qty: Quantity): string {
  return unit === 'cup' && qtyValue(qty) > 1 ? 'cups' : unit
}

function kitchenScreen(a: KitchenAmount): string {
  const main = `${quantityScreen(a.qty)} ${unitScreen(a.unit, a.qty)}`
  return a.rest ? `${main} + ${a.rest.count} ${a.rest.unit}` : main
}

function kitchenSpoken(a: KitchenAmount): string {
  const k = KITCHEN[a.unit]
  const main = quantitySpoken(a.qty, k.one, k.many)
  if (!a.rest) return main
  const r = KITCHEN[a.rest.unit]
  return `${main} plus ${a.rest.count === 1 ? `a ${r.one}` : `${a.rest.count} ${r.many}`}`
}

/** Metric and other units: sensible rounding, no fractions. */
function roundPlain(v: number): number {
  if (v >= 100) return Math.round(v / 5) * 5
  if (v >= 10) return Math.round(v)
  return Math.round(v * 10) / 10
}

/** Whole items (eggs): whole numbers, never below 1. */
function wholeCount(v: number): number {
  return Math.max(1, Math.round(v))
}

/** Simple English plural for whole-item names: egg → eggs, berry → berries, tomato → tomatoes. */
export function pluralize(name: string, count: number): string {
  if (count === 1 || /s$/i.test(name)) return name
  if (/[^aeiou]y$/i.test(name)) return `${name.slice(0, -1)}ies`
  if (/(ch|sh|x|o)$/i.test(name)) return `${name}es`
  return `${name}s`
}

export function scaleAmount(amount: number | null, factor: number): number | null {
  return amount === null ? null : amount * factor
}

/**
 * Amount and unit only, without the name: "⅓ cup + 1 tbsp", "2" (eggs), "a little" (no amount).
 * Spoken: "a third of a cup plus a tablespoon".
 */
export function formatAmount(i: Ingredient, factor: number, as: AmountForm): string {
  const v = scaleAmount(i.amount, factor)
  if (v === null) return 'a little'
  if (i.unit === null) return String(wholeCount(v))
  const unit = i.unit.toLowerCase()
  if (unit in KITCHEN) {
    if (v <= 0) return as === 'screen' ? `0 ${unit}` : `no ${unit}`
    const a = kitchenAmount(v, unit)
    if (a.unit === 'tsp' && qtyValue(a.qty) === 0) return 'a pinch'
    return as === 'screen' ? kitchenScreen(a) : kitchenSpoken(a)
  }
  const n = roundPlain(v)
  if (as === 'screen') return `${n} ${i.unit}`
  const words = SPOKEN_UNITS[unit]
  return `${n} ${words ? words[n === 1 ? 0 : 1] : i.unit}`
}

/** The name as shown next to the amount: pluralized for whole items ("2 eggs"). */
export function ingredientName(i: Ingredient, factor: number): string {
  const v = scaleAmount(i.amount, factor)
  return v !== null && i.unit === null ? pluralize(i.name, wholeCount(v)) : i.name
}

/** Amount + unit + name, as a placeholder fills in: "½ cup flour", "2 eggs"; spoken "half a cup of flour". */
export function ingredientLabel(i: Ingredient, factor: number, as: AmountForm): string {
  const name = ingredientName(i, factor)
  if (i.amount === null) return name
  const amount = formatAmount(i, factor, as)
  if (i.unit === null) return `${amount} ${name}`
  if (amount === 'a pinch') return `a pinch of ${name}`
  return as === 'spoken' ? `${amount} of ${name}` : `${amount} ${name}`
}

/** Approximate fraction for notes: "½", "1¼". */
function roughNumber(v: number): string {
  return quantityScreen(snapNearest(v, ALL_FRACTIONS))
}

/** "½ egg rounds to 1 small egg" when a whole item rounds by a quarter or more; null otherwise. */
export function roundingNote(i: Ingredient, factor: number): string | null {
  const v = scaleAmount(i.amount, factor)
  if (v === null || i.unit !== null) return null
  const n = wholeCount(v)
  if (Math.abs(n - v) < 0.25) return null
  const size = n > v ? 'small' : 'large'
  const from = `${roughNumber(v)} ${pluralize(i.name, v > 1 ? 2 : 1)}`
  return `${from} ${v > 1 ? 'round' : 'rounds'} to ${n} ${size} ${pluralize(i.name, n)}`
}

const PLACEHOLDER = /\{([A-Za-z0-9_-]+)\}/g

export function hasPlaceholders(text: string): boolean {
  return new RegExp(PLACEHOLDER.source).test(text)
}

/** Fills each {ingredientId} with amount + unit + name at the factor. An unknown id is left as the bare id. */
export function fillPlaceholders(text: string, ingredients: Ingredient[], factor: number, as: AmountForm): string {
  return text.replace(PLACEHOLDER, (_, id: string) => {
    const i = ingredients.find(x => x.id === id)
    return i ? ingredientLabel(i, factor, as) : id
  })
}

/** "step-3", or "step-3@2" when the spoken text has placeholders (its clip depends on servings). */
export function stepClipId(step: Step, servings: number): string {
  return hasPlaceholders(step.spoken) ? `step-${step.id}@${servings}` : `step-${step.id}`
}
