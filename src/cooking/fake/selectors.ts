// TEMPORARY (fake, replaced by Nam's cooking/selectors.ts): read-only views of CookingState for the UI,
// per SYSTEM_DESIGN §6.6. Pure — no React, no camera, no network.
import type { CookingState, FilledStep, ScaledIngredient } from '../contract.ts'
import { fillPlaceholders, formatAmount, ingredientLabel, ingredientName, roundingNote } from './scaling.ts'

/** Chosen servings over the recipe's own. Amounts are code, not AI (§1). */
function factor(s: CookingState): number {
  return s.recipe && s.recipe.servings > 0 ? s.servings / s.recipe.servings : 1
}

/** Every step with its {ingredientId} placeholders filled in at the chosen servings. */
export function filledSteps(s: CookingState): FilledStep[] {
  if (!s.recipe) return []
  const f = factor(s)
  const { ingredients } = s.recipe
  return s.recipe.steps.map(step => ({
    id: step.id,
    text: fillPlaceholders(step.text, ingredients, f, 'screen'),
    spoken: fillPlaceholders(step.spoken, ingredients, f, 'spoken'),
    cue: step.cue,
    checkable: step.checkable,
    headsUp: step.headsUp,
  }))
}

/** The step on screen, or null before a recipe is parsed. */
export function currentStep(s: CookingState): FilledStep | null {
  return filledSteps(s)[s.stepIndex] ?? null
}

export function isLastStep(s: CookingState): boolean {
  return !!s.recipe && s.stepIndex >= s.recipe.steps.length - 1
}

/** ✋ is offered only on a checkable step, and never while a check is already running (§6.5). */
export function canCheck(s: CookingState): boolean {
  return s.phase === 'cooking' && s.mode !== 'checking' && (currentStep(s)?.checkable ?? false)
}

/** "Step 3 of 8". */
export function stepLabel(s: CookingState): string {
  return `Step ${s.stepIndex + 1} of ${s.recipe?.steps.length ?? 0}`
}

/** One row per ingredient at the chosen servings, for the prep list. */
export function scaledIngredients(s: CookingState): ScaledIngredient[] {
  if (!s.recipe) return []
  const f = factor(s)
  const changedServings = f !== 1
  return s.recipe.ingredients.map(i => {
    const amount = formatAmount(i, f, 'screen')
    const name = ingredientName(i, f)
    return {
      id: i.id,
      label: ingredientLabel(i, f, 'screen'),
      amount: i.amount === null ? 'a little' : amount,
      name,
      // Only amounts that actually read differently count; "a little" never changes.
      changed: changedServings && i.amount !== null && amount !== formatAmount(i, 1, 'screen'),
      note: roundingNote(i, f),
    }
  })
}

/**
 * The Start button is live once every clip for the chosen servings is cached: navigation never
 * touches the network (§1). A servings change invalidates the run until its clips arrive.
 */
export function canStart(s: CookingState): boolean {
  if (s.phase !== 'prep') return false
  const { ready, total, servings } = s.voicing
  return servings === s.servings && ready.length >= total && total > 0
}

/** Gestures are off while a check runs, so a half-held gesture can't fight the verdict (§6.5). */
export function gesturesEnabled(s: CookingState): boolean {
  return s.phase === 'cooking' && s.mode !== 'checking'
}