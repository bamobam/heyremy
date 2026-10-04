// Checks that what came back from the server has the shape the app expects.
// A server bug then becomes a clean error, not a crash on screen.

import type { Ingredient, ParsedRecipe, Step, Verdict } from '../types.ts'
import { hasPlaceholders } from '../cooking/scaling.ts'

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const isTextOrNull = (v: unknown): v is string | null => v === null || typeof v === 'string'

export function isVerdict(v: unknown): v is Verdict {
  return isObject(v) && (v.status === 'ready' || v.status === 'not_ready' || v.status === 'unsure') && isText(v.feedback)
}

function isIngredient(v: unknown): v is Ingredient {
  return (
    isObject(v) &&
    isText(v.id) &&
    (v.amount === null || (typeof v.amount === 'number' && Number.isFinite(v.amount))) &&
    isTextOrNull(v.unit) &&
    isText(v.name)
  )
}

function isStep(v: unknown): v is Step {
  return (
    isObject(v) &&
    typeof v.id === 'number' &&
    isText(v.text) &&
    isText(v.spoken) &&
    isTextOrNull(v.cue) &&
    isTextOrNull(v.headsUp) &&
    typeof v.checkable === 'boolean' &&
    // A step can only be checked if there is something to look for.
    (!v.checkable || typeof v.cue === 'string')
  )
}

const PLACEHOLDER = /\{([^{}]+)\}/g

/** Every {id} in the text names an ingredient the recipe has. */
const placeholdersKnown = (text: string, ids: Set<string>) =>
  !hasPlaceholders(text) || [...text.matchAll(PLACEHOLDER)].every((m) => ids.has(m[1]))

export function isParsedRecipe(v: unknown): v is ParsedRecipe {
  if (!isObject(v)) return false
  if (!isText(v.title) || typeof v.servings !== 'number' || !(v.servings > 0)) return false
  if (!Array.isArray(v.ingredients) || !v.ingredients.every(isIngredient)) return false
  if (!Array.isArray(v.prep) || !v.prep.every((p) => typeof p === 'string')) return false
  if (!Array.isArray(v.steps) || v.steps.length === 0 || !v.steps.every(isStep)) return false

  const ids = new Set((v.ingredients as Ingredient[]).map((i) => i.id))
  return (v.steps as Step[]).every((s) => placeholdersKnown(s.text, ids) && placeholdersKnown(s.spoken, ids))
}
