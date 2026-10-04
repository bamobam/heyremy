import { describe, expect, it } from 'vitest'
import { placeholders, slugify, validateRecipe, validateVerdict, ValidationError } from './schemas.ts'

const step = (over: Record<string, unknown> = {}) => ({
  id: 1,
  text: 'Whisk the batter.',
  spoken: 'Step 1. Whisk the batter.',
  cue: null,
  checkable: false,
  headsUp: null,
  ...over,
})

// The pancake example from SYSTEM_DESIGN 10.7.
const pancakes = () => ({
  title: 'Fluffy pancakes',
  servings: 4,
  ingredients: [
    { id: 'flour', amount: 1, unit: 'cup', name: 'flour' },
    { id: 'milk', amount: 0.75, unit: 'cup', name: 'milk' },
    { id: 'egg', amount: 1, unit: null, name: 'egg' },
    { id: 'butter', amount: 2, unit: 'tbsp', name: 'butter, melted' },
  ],
  prep: ['Take the egg and milk out of the fridge', 'Melt the butter', 'Get out a pan, whisk and ladle'],
  steps: [
    step({ id: 3, text: 'Whisk in {milk}, {egg} and {butter} until smooth.',
      spoken: 'Step 3. Whisk in {milk}, {egg} and {butter} until smooth.',
      cue: 'Smooth, no dry flour streaks', checkable: true }),
  ],
})

const rejects = (x: unknown, msg: RegExp) => {
  expect(() => validateRecipe(x)).toThrow(ValidationError)
  expect(() => validateRecipe(x)).toThrow(msg)
}

describe('validateRecipe', () => {
  it('passes the pancake example through, re-numbering the step id', () => {
    const r = validateRecipe(pancakes())
    expect(r.title).toBe('Fluffy pancakes')
    expect(r.servings).toBe(4)
    expect(r.ingredients.map((i) => i.id)).toEqual(['flour', 'milk', 'egg', 'butter'])
    expect(r.steps[0]).toEqual({
      id: 1,
      text: 'Whisk in {milk}, {egg} and {butter} until smooth.',
      spoken: 'Step 3. Whisk in {milk}, {egg} and {butter} until smooth.',
      cue: 'Smooth, no dry flour streaks',
      checkable: true,
      headsUp: null,
    })
  })

  it('rejects malformed model output', () => {
    rejects(null, /not an object/)
    rejects([], /not an object/)
    rejects('{"steps": []}', /not an object/)
    rejects({ steps: 'Whisk' }, /no steps/)
    rejects({ steps: [] }, /no steps/)
    rejects({ steps: [42] }, /Step 1 is not an object/)
  })

  it('rejects over 40 steps', () => {
    expect(validateRecipe({ steps: Array.from({ length: 40 }, () => step()) }).steps).toHaveLength(40)
    rejects({ steps: Array.from({ length: 41 }, () => step()) }, /over 40/)
  })

  it('rejects empty step text or spoken', () => {
    rejects({ steps: [step({ text: '   ' })] }, /Step 1 has empty text/)
    rejects({ steps: [step(), step({ spoken: undefined })] }, /Step 2 has empty text/)
  })

  it('rejects bad servings and defaults missing servings to 1', () => {
    rejects({ servings: 0, steps: [step()] }, /servings/)
    rejects({ servings: -2, steps: [step()] }, /servings/)
    rejects({ servings: '4', steps: [step()] }, /servings/)
    rejects({ servings: Number.NaN, steps: [step()] }, /servings/)
    expect(validateRecipe({ steps: [step()] }).servings).toBe(1)
    expect(validateRecipe({ servings: null, steps: [step()] }).servings).toBe(1)
  })

  it('re-numbers off-by-one and duplicate step ids from 1', () => {
    const r = validateRecipe({ steps: [step({ id: 0 }), step({ id: 0 }), step({ id: 7 })] })
    expect(r.steps.map((s) => s.id)).toEqual([1, 2, 3])
  })

  it('rejects a placeholder that names no ingredient', () => {
    const r = pancakes()
    r.steps[0] = step({ text: 'Add {sugar}.', spoken: 'Step 1. Add {sugar}.' })
    rejects(r, /unknown ingredient \{sugar\}/)
  })

  it('rejects different placeholders in text and spoken', () => {
    const r = pancakes()
    r.steps[0] = step({ text: 'Add {milk} and {egg}.', spoken: 'Step 1. Add {milk}.' })
    rejects(r, /different placeholders/)
  })

  it('allows the same placeholder repeated a different number of times', () => {
    const r = pancakes()
    r.steps[0] = step({ text: 'Add half the {milk}, then the rest of the {milk}.', spoken: 'Step 1. Add the {milk} in two goes.' })
    expect(() => validateRecipe(r)).not.toThrow()
  })

  it('slugifies ids and rewrites placeholders to match', () => {
    const r = validateRecipe({
      ingredients: [{ id: 'Brown Sugar', amount: 2, unit: 'tbsp', name: 'brown sugar' }],
      steps: [step({ text: 'Add {Brown Sugar}.', spoken: 'Step 1. Add {Brown Sugar}.' })],
    })
    expect(r.ingredients[0].id).toBe('brown-sugar')
    expect(r.steps[0].text).toBe('Add {brown-sugar}.')
    expect(r.steps[0].spoken).toBe('Step 1. Add {brown-sugar}.')
  })

  it('suffixes colliding ids; placeholders keep pointing at the first', () => {
    const r = validateRecipe({
      ingredients: [
        { id: 'flour', amount: 1, unit: 'cup', name: 'flour' },
        { id: 'Flour', amount: 2, unit: 'tbsp', name: 'flour for dusting' },
        { id: 'flour', amount: 1, unit: 'tsp', name: 'more flour' },
        { id: 'flour-2', amount: 1, unit: 'g', name: 'yet more flour' },
      ],
      steps: [step({ text: 'Add {flour} and {Flour}.', spoken: 'Step 1. Add {flour} and {Flour}.' })],
    })
    expect(r.ingredients.map((i) => i.id)).toEqual(['flour', 'flour-2', 'flour-3', 'flour-2-2'])
    expect(r.steps[0].text).toBe('Add {flour} and {flour-2}.')
  })

  it('does not chain renames', () => {
    // "a b" becomes "a-b"; the existing "a-b" then becomes "a-b-2". {a-b} must still mean the second one.
    const r = validateRecipe({
      ingredients: [
        { id: 'a b', amount: 1, unit: null, name: 'first' },
        { id: 'a-b', amount: 1, unit: null, name: 'second' },
      ],
      steps: [step({ text: '{a b} then {a-b}', spoken: '{a b} then {a-b}' })],
    })
    expect(r.steps[0].text).toBe('{a-b} then {a-b-2}')
  })

  it('derives an id from the name when the id is unusable', () => {
    const r = validateRecipe({ ingredients: [{ id: '!!!', amount: null, unit: null, name: 'Sea Salt' }], steps: [step()] })
    expect(r.ingredients[0].id).toBe('sea-salt')
  })

  it('forces checkable false when the cue is null or blank', () => {
    const r = validateRecipe({ steps: [step({ cue: null, checkable: true }), step({ cue: '  ', checkable: true })] })
    expect(r.steps.map((s) => [s.cue, s.checkable])).toEqual([[null, false], [null, false]])
  })

  it('trims strings and fills missing fields', () => {
    const r = validateRecipe({
      title: '  Toast ',
      ingredients: [{ id: ' bread ', name: ' bread ', unit: '' }],
      steps: [{ text: ' Toast it. ', spoken: ' Step 1. Toast it. ', cue: ' Golden brown ', checkable: true }],
    })
    expect(r).toEqual({
      title: 'Toast',
      servings: 1,
      ingredients: [{ id: 'bread', amount: null, unit: null, name: 'bread' }],
      prep: [],
      steps: [{ id: 1, text: 'Toast it.', spoken: 'Step 1. Toast it.', cue: 'Golden brown', checkable: true, headsUp: null }],
    })
  })
})

describe('validateVerdict', () => {
  it('passes a good verdict through, trimmed', () => {
    expect(validateVerdict({ status: 'not_ready', feedback: ' Still some dry flour streaks. Keep whisking. ' }))
      .toEqual({ status: 'not_ready', feedback: 'Still some dry flour streaks. Keep whisking.' })
  })

  it('cuts feedback to 15 words', () => {
    const long = Array.from({ length: 20 }, (_, i) => `w${i}`).join(' ')
    expect(validateVerdict({ status: 'ready', feedback: long }).feedback.split(' ')).toHaveLength(15)
  })

  it('rejects a bad status or empty feedback', () => {
    expect(() => validateVerdict({ status: 'done', feedback: 'ok' })).toThrow(ValidationError)
    expect(() => validateVerdict({ status: 'ready', feedback: '   ' })).toThrow(/empty/)
    expect(() => validateVerdict({ status: 'ready' })).toThrow(/empty/)
    expect(() => validateVerdict(null)).toThrow(/not an object/)
  })
})

describe('helpers', () => {
  it('slugify', () => {
    expect(slugify('  Brown Sugar! ')).toBe('brown-sugar')
    expect(slugify('Crème fraîche')).toBe('cr-me-fra-che')
  })
  it('placeholders', () => {
    expect(placeholders('{b} and {a} and {b}')).toEqual(['a', 'b'])
  })
})
