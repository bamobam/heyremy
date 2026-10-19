// The screen-facing selectors: steps with amounts filled in, and ingredients split into amount and name.
import { describe, expect, it } from 'vitest'
import { pancakes } from './fixtures.ts'
import { initialState, type CookingState } from './state.ts'
import { filledSteps, scaledIngredients } from './uiSelectors.ts'

const prep = (servings = pancakes.servings): CookingState => ({ ...initialState(), phase: 'prep', recipe: pancakes, servings })

describe('filledSteps', () => {
  it('is empty with no recipe', () => {
    expect(filledSteps(initialState())).toEqual([])
  })

  it('fills the amounts in at the chosen servings, for the screen and for the voice', () => {
    const [first] = filledSteps(prep(8))
    expect(first.id).toBe(1)
    expect(first.text).toContain('2 cups flour')
    expect(first.spoken).toContain('two cups of flour')
  })
})

describe('filledSteps at each Level', () => {
  const at = (level: 'beginner' | 'intermediate' | 'master'): CookingState => ({ ...prep(8), settings: { level, persona: 'remy' } })

  it('voices the chosen Level, and shows the same text, cue and heads-up at all three', () => {
    const [b, i, m] = (['beginner', 'intermediate', 'master'] as const).map((level) => filledSteps(at(level))[0])
    expect(b.spoken).toBe('Step 1. Whisk two cups of flour, two cups of milk and four eggs into a batter.')
    expect(i.spoken).toBe('Step 1. Whisk two cups of flour, two cups of milk and four eggs.')
    expect(m.spoken).toBe('Step 1. Whisk two cups of flour, two cups of milk, four eggs.')
    for (const step of [i, m]) expect({ ...step, spoken: '', narration: '' }).toEqual({ ...b, spoken: '', narration: '' })
  })

  it('falls back to the beginner narration for a step without one for that Level', () => {
    expect(filledSteps(at('intermediate')).at(-1)?.spoken).toBe('Step 5. Serve with butter and syrup.')
    expect(filledSteps(at('master')).at(-1)?.spoken).toBe('Step 5. Serve.')
  })
})

describe('filledSteps at each Level', () => {
  const at = (level: 'beginner' | 'intermediate' | 'master') => ({ ...prep(), settings: { ...initialState().settings, level } })

  it("gives each step's instruction in the Level's own wording, with amounts as on the card (2 cups, not two cups of)", () => {
    expect(filledSteps(at('beginner'))[0].narration).toBe('Step 1. Whisk 1 cup flour, 1 cup milk and 2 eggs into a batter.')
    expect(filledSteps(at('master'))[0].narration).toBe('Step 1. Whisk 1 cup flour, 1 cup milk, 2 eggs.')
  })

  it('is shorter at Master than at Beginner for every step, which is the point of a Level', () => {
    const beginner = filledSteps(at('beginner'))
    const master = filledSteps(at('master'))
    beginner.forEach((step, i) => expect(master[i].narration.length).toBeLessThanOrEqual(step.narration.length))
  })

  it('leaves the card text, amounts and cue alone: only the wording changes', () => {
    const beginner = filledSteps(at('beginner'))
    const master = filledSteps(at('master'))
    expect(master.map(s => [s.text, s.cue, s.checkable])).toEqual(beginner.map(s => [s.text, s.cue, s.checkable]))
  })
})

describe('scaledIngredients', () => {
  it('splits a measured ingredient into amount and name', () => {
    const flour = scaledIngredients(prep()).find(i => i.id === 'flour')!
    expect(flour).toMatchObject({ amount: '1 cup', name: 'flour', label: '1 cup flour', changed: false })
  })

  it('keeps a plural whole item together with its count', () => {
    const eggs = scaledIngredients(prep(8)).find(i => i.id === 'egg')!
    expect(eggs).toMatchObject({ amount: '4', name: 'eggs', changed: true })
  })

  it('marks only the measured rows as changed, and never an unmeasured one', () => {
    const rows = scaledIngredients(prep(8))
    expect(rows.find(i => i.id === 'flour')!.changed).toBe(true)
    expect(rows.find(i => i.id === 'salt')!.changed).toBe(false)
  })

  it('reads "a pinch of salt" as amount and name', () => {
    expect(scaledIngredients(prep()).find(i => i.id === 'salt')).toMatchObject({ amount: 'a pinch', name: 'salt' })
  })

  it('scales to the chosen servings', () => {
    expect(scaledIngredients(prep(8)).find(i => i.id === 'milk')!.amount).toBe('2 cups')
  })
})
