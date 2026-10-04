// Values worked out from the cooking state. Pure; the screens read these
// instead of digging into the state themselves.

import { describeIngredient, fillPlaceholders, scaleFactor, stepClipId } from './scaling.ts'
import type { CookingState } from './state.ts'

/** The step being cooked, with amounts filled in at the chosen servings. */
export interface ShownStep {
  text: string
  spoken: string
  cue: string | null
  checkable: boolean
  headsUp: string | null
}

/** The recipe's amounts times this make the chosen servings. */
const factorOf = (s: CookingState) => (s.recipe ? scaleFactor(s.servings, s.recipe.servings) : 1)

export function currentStep(s: CookingState): ShownStep | null {
  if (s.phase !== 'cooking' || !s.recipe) return null
  const step = s.recipe.steps[s.stepIndex]
  if (!step) return null
  const factor = factorOf(s)
  return {
    text: fillPlaceholders(step.text, s.recipe.ingredients, factor, 'screen'),
    spoken: fillPlaceholders(step.spoken, s.recipe.ingredients, factor, 'spoken'),
    cue: step.cue,
    checkable: step.checkable,
    headsUp: step.headsUp,
  }
}

/** The id of the audio clip for the step being cooked, at the chosen servings. */
export function currentClipId(s: CookingState): string | null {
  if (s.phase !== 'cooking' || !s.recipe) return null
  const step = s.recipe.steps[s.stepIndex]
  return step ? stepClipId(step, s.servings) : null
}

export const isLastStep = (s: CookingState) => !!s.recipe && s.stepIndex === s.recipe.steps.length - 1

export const stepLabel = (s: CookingState) => (s.recipe ? `Step ${s.stepIndex + 1} of ${s.recipe.steps.length}` : '')

/** A check can be asked for: cooking, not already checking, and the step has a visual cue. */
export function canCheck(s: CookingState): boolean {
  return s.phase === 'cooking' && s.mode !== 'checking' && !!s.recipe?.steps[s.stepIndex]?.checkable
}

/** Gestures move the cook along: cooking, and not waiting on a check. */
export const gesturesEnabled = (s: CookingState) => s.phase === 'cooking' && s.mode !== 'checking'

export interface ScaledIngredient {
  id: string
  /** For the prep list, e.g. "½ cup flour". */
  label: string
  /** Set when rounding moved the amount a lot, e.g. "½ egg rounds to 1 egg". */
  note: string | null
  /** The amount shown differs from the recipe's own. */
  changed: boolean
}

/** The ingredient list at the chosen servings. */
export function scaledIngredients(s: CookingState): ScaledIngredient[] {
  if (!s.recipe) return []
  const factor = factorOf(s)
  return s.recipe.ingredients.map((i) => {
    const d = describeIngredient(i, factor)
    return { id: i.id, label: d.screen, note: d.note, changed: d.changed }
  })
}

/**
 * Start cooking turns on once every step clip for the chosen servings is cached.
 * With no clips to make (no voice) there is nothing to wait for, so it is on straight away.
 */
export function canStart(s: CookingState): boolean {
  const { ready, total, servings } = s.voicing
  return s.phase === 'prep' && servings === s.servings && ready.length >= total
}

/** A "ready" verdict's countdown has run out, so it is time to move on by itself. */
export const isAutoAdvanceDue = (s: CookingState, now: number) => s.autoAdvanceAt !== null && now >= s.autoAdvanceAt
