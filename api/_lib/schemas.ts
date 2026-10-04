// Gemini response schemas and runtime validation of model output (SYSTEM_DESIGN 10.3).
// Pure: values in, values out. Small issues are repaired; real problems throw ValidationError (422).

import type { Ingredient, ParsedRecipe, Step, Verdict } from '../../src/types.ts'

export const MAX_STEPS = 40
export const MAX_FEEDBACK_WORDS = 15
const VERDICT_STATUSES = ['ready', 'not_ready', 'unsure'] as const

// ---------- Gemini responseSchema (OpenAPI subset) ----------

const nullableString = { type: 'STRING', nullable: true }

export const recipeSchema = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    servings: { type: 'NUMBER' },
    ingredients: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          amount: { type: 'NUMBER', nullable: true },
          unit: nullableString,
          name: { type: 'STRING' },
        },
        required: ['id', 'amount', 'unit', 'name'],
        propertyOrdering: ['id', 'amount', 'unit', 'name'],
      },
    },
    prep: { type: 'ARRAY', items: { type: 'STRING' } },
    steps: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'INTEGER' },
          text: { type: 'STRING' },
          spoken: { type: 'STRING' },
          cue: nullableString,
          checkable: { type: 'BOOLEAN' },
          headsUp: nullableString,
        },
        required: ['id', 'text', 'spoken', 'cue', 'checkable', 'headsUp'],
        propertyOrdering: ['id', 'text', 'spoken', 'cue', 'checkable', 'headsUp'],
      },
    },
  },
  required: ['title', 'servings', 'ingredients', 'prep', 'steps'],
  propertyOrdering: ['title', 'servings', 'ingredients', 'prep', 'steps'],
}

export const verdictSchema = {
  type: 'OBJECT',
  properties: {
    status: { type: 'STRING', enum: [...VERDICT_STATUSES] },
    feedback: { type: 'STRING' },
  },
  required: ['status', 'feedback'],
  propertyOrdering: ['status', 'feedback'],
}

// ---------- Validation ----------

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

type Obj = Record<string, unknown>

const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x)

/** Trimmed string, or null when missing, not a string, or blank. */
const optText = (x: unknown): string | null => (typeof x === 'string' && x.trim() !== '' ? x.trim() : null)

const PLACEHOLDER = /\{([^{}]+)\}/g

export function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Placeholder names in a string, as a sorted unique list. */
export function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1]))].sort()
}

/**
 * Gives every ingredient a unique slug id. Returns the ingredients and a map from each
 * original id (raw and trimmed) to its new slug; the first ingredient with an id wins it.
 */
function repairIngredients(raw: unknown): { ingredients: Ingredient[]; rename: Map<string, string> } {
  const list = Array.isArray(raw) ? raw.filter(isObj) : []
  const used = new Set<string>()
  const rename = new Map<string, string>()
  const ingredients = list.map((x) => {
    const name = optText(x.name) ?? optText(x.id) ?? 'ingredient'
    const rawId = typeof x.id === 'string' ? x.id : ''
    const base = slugify(rawId) || slugify(name) || 'ingredient'
    let id = base
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`
    used.add(id)
    for (const key of [rawId, rawId.trim()]) {
      if (key !== '' && !rename.has(key)) rename.set(key, id)
    }
    const amount = typeof x.amount === 'number' && Number.isFinite(x.amount) ? x.amount : null
    return { id, amount, unit: optText(x.unit), name }
  })
  return { ingredients, rename }
}

/** Rewrites placeholders to repaired ids in one pass, so renames never chain. */
function rewrite(text: string, rename: Map<string, string>): string {
  return text.replace(PLACEHOLDER, (whole, name: string) => {
    const id = rename.get(name) ?? rename.get(name.trim())
    return id === undefined ? whole : `{${id}}`
  })
}

export function validateRecipe(x: unknown): ParsedRecipe {
  if (!isObj(x)) throw new ValidationError('Recipe is not an object.')

  let servings = 1
  if (x.servings !== undefined && x.servings !== null) {
    if (typeof x.servings !== 'number' || !Number.isFinite(x.servings) || x.servings <= 0) {
      throw new ValidationError('servings must be a positive number.')
    }
    servings = x.servings
  }

  if (!Array.isArray(x.steps) || x.steps.length === 0) throw new ValidationError('Recipe has no steps.')
  if (x.steps.length > MAX_STEPS) throw new ValidationError(`Recipe has over ${MAX_STEPS} steps.`)

  const { ingredients, rename } = repairIngredients(x.ingredients)
  const ids = new Set(ingredients.map((i) => i.id))

  const steps: Step[] = x.steps.map((s: unknown, i: number) => {
    const n = i + 1
    if (!isObj(s)) throw new ValidationError(`Step ${n} is not an object.`)
    const rawText = optText(s.text)
    const rawSpoken = optText(s.spoken)
    if (rawText === null || rawSpoken === null) throw new ValidationError(`Step ${n} has empty text.`)
    const text = rewrite(rawText, rename)
    const spoken = rewrite(rawSpoken, rename)

    const inText = placeholders(text)
    const inSpoken = placeholders(spoken)
    const unknown = [...inText, ...inSpoken].find((p) => !ids.has(p))
    if (unknown !== undefined) throw new ValidationError(`Step ${n} uses unknown ingredient {${unknown}}.`)
    if (inText.join() !== inSpoken.join()) {
      throw new ValidationError(`Step ${n} has different placeholders in text and spoken.`)
    }

    const cue = optText(s.cue)
    return { id: n, text, spoken, cue, checkable: cue !== null && s.checkable === true, headsUp: optText(s.headsUp) }
  })

  const prep = Array.isArray(x.prep) ? x.prep.map(optText).filter((p): p is string => p !== null) : []

  return { title: optText(x.title) ?? 'Recipe', servings, ingredients, prep, steps }
}

export function validateVerdict(x: unknown): Verdict {
  if (!isObj(x)) throw new ValidationError('Verdict is not an object.')
  const status = VERDICT_STATUSES.find((s) => s === x.status)
  if (status === undefined) throw new ValidationError('Verdict status is not ready, not_ready or unsure.')
  const words = typeof x.feedback === 'string' ? x.feedback.trim().split(/\s+/).filter(Boolean) : []
  if (words.length === 0) throw new ValidationError('Verdict feedback is empty.')
  return { status, feedback: words.slice(0, MAX_FEEDBACK_WORDS).join(' ') }
}
