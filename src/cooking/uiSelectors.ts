// Selectors the screens need beyond selectors.ts: every step with its amounts filled in (for the
// carousel), and each ingredient split into amount and name (for the prep tiles). Pure.
import type { CookingState } from './state.ts'
import { describeIngredient, fillPlaceholders, scaleFactor } from './scaling.ts'
import type { ShownStep } from './selectors.ts'

/** A step with its placeholders filled in at the chosen servings. */
export interface FilledStep extends ShownStep {
  id: number
}

/** One ingredient at the chosen servings, for the prep list. */
export interface ScaledIngredient {
  id: string
  /** Amount, unit and name, e.g. "⅓ cup + 1 tbsp milk". */
  label: string
  /** Just the amount and unit, e.g. "⅓ cup + 1 tbsp", or "a little" when the recipe gives none. */
  amount: string
  name: string
  /** True when the amount differs from the recipe's (servings changed). */
  changed: boolean
  /** Shown under the list when rounding is big, e.g. "½ egg rounds to 1 small egg". */
  note: string | null
}

/** Every step, for the carousel. Empty until there is a recipe. */
export function filledSteps(s: CookingState): FilledStep[] {
  if (!s.recipe) return []
  const factor = scaleFactor(s.servings, s.recipe.servings)
  const { ingredients } = s.recipe
  return s.recipe.steps.map(step => ({
    id: step.id,
    text: fillPlaceholders(step.text, ingredients, factor, 'screen'),
    spoken: fillPlaceholders(step.spoken, ingredients, factor, 'spoken'),
    cue: step.cue,
    checkable: step.checkable,
    headsUp: step.headsUp,
  }))
}

/** The ingredients at the chosen servings, each split into its amount and its name. */
export function scaledIngredients(s: CookingState): ScaledIngredient[] {
  if (!s.recipe) return []
  const factor = scaleFactor(s.servings, s.recipe.servings)
  return s.recipe.ingredients.map(i => {
    const d = describeIngredient(i, factor)
    if (i.amount === null) {
      // "a pinch of salt" reads as the amount "a pinch" and the name "salt"; anything else is "a little".
      const lead = i.name.match(/^(a pinch|a splash|a dash|a little|some)(?: of)?\s+(.+)$/i)
      return { id: i.id, label: d.screen, amount: lead?.[1] ?? 'a little', name: lead?.[2] ?? i.name, changed: d.changed, note: d.note }
    }
    // The name may be pluralised ("2 eggs"), so a whole item splits at its first space; the rest end in the name as given.
    const cut = d.screen.endsWith(i.name) ? d.screen.length - i.name.length : d.screen.indexOf(' ') + 1
    return {
      id: i.id,
      label: d.screen,
      amount: d.screen.slice(0, cut).trim(),
      name: d.screen.slice(cut).trim(),
      changed: d.changed,
      note: d.note,
    }
  })
}
