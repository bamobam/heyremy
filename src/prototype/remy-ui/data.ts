// PROTOTYPE (throwaway): fake pancake recipe for the UI variants. Not wired to /api/parse.
import type { ParsedRecipe } from '../../types'

export const recipe: ParsedRecipe = {
  title: 'Fluffy pancakes',
  servings: 4,
  ingredients: [
    { id: 'flour', amount: 1, unit: 'cup', name: 'flour' },
    { id: 'milk', amount: 0.75, unit: 'cup', name: 'milk' },
    { id: 'egg', amount: 1, unit: null, name: 'egg' },
    { id: 'butter', amount: 2, unit: 'tbsp', name: 'butter, melted' },
    { id: 'sugar', amount: 2, unit: 'tbsp', name: 'sugar' },
    { id: 'bp', amount: 2, unit: 'tsp', name: 'baking powder' },
    { id: 'salt', amount: 0.5, unit: 'tsp', name: 'salt' },
    { id: 'oil', amount: null, unit: null, name: 'oil for the pan' },
  ],
  prep: ['Take the egg and milk out of the fridge', 'Melt the butter', 'Get out a pan, whisk and ladle', 'Put on the hat'],
  steps: [
    { id: 1, text: 'Whisk the flour, sugar, baking powder and salt.', spoken: '', cue: null, checkable: false, headsUp: null },
    { id: 2, text: 'Whisk in the milk, egg and butter until smooth.', spoken: '', cue: 'smooth, no dry flour streaks', checkable: true, headsUp: null },
    { id: 3, text: 'Let the batter rest for 5 minutes.', spoken: '', cue: null, checkable: false, headsUp: 'The next step needs a hot pan. Turn it on to medium now.' },
    { id: 4, text: 'Oil the pan lightly and pour ¼ cup of batter.', spoken: '', cue: null, checkable: false, headsUp: null },
    { id: 5, text: 'Cook until bubbles pop and stay open, then flip.', spoken: '', cue: 'bubbles pop and stay open, edges look dry', checkable: true, headsUp: null },
    { id: 6, text: 'Cook the other side until golden.', spoken: '', cue: 'golden brown underside', checkable: true, headsUp: null },
  ],
}

/** Ingredient look: palette color + a simple drawn shape, so the prep screen isn't emoji. */
export const ingredientLook: Record<string, { color: string; shape: 'sack' | 'jug' | 'egg' | 'block' | 'jar' | 'tin' | 'shaker' | 'bottle' }> = {
  flour: { color: '#EDCEBA', shape: 'sack' },
  milk: { color: '#B7BDB6', shape: 'jug' },
  egg: { color: '#DE9762', shape: 'egg' },
  butter: { color: '#F4905F', shape: 'block' },
  sugar: { color: '#E3BEB2', shape: 'jar' },
  bp: { color: '#9F9593', shape: 'tin' },
  salt: { color: '#657167', shape: 'shaker' },
  oil: { color: '#BE7463', shape: 'bottle' },
}

const FRACTIONS: [number, string][] = [[0, ''], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾'], [1, '']]

export function formatAmount(amount: number | null, unit: string | null, scale: number): string {
  if (amount === null) return 'a little'
  const v = amount * scale
  if (unit === null) return String(Math.max(1, Math.round(v)))
  const whole = Math.floor(v)
  const frac = v - whole
  let best = FRACTIONS[0]
  for (const f of FRACTIONS) if (Math.abs(f[0] - frac) < Math.abs(best[0] - frac)) best = f
  const w = best[0] === 1 ? whole + 1 : whole
  const text = `${w > 0 ? w : ''}${best[1]}` || '0'
  return `${text} ${unit}`
}
