// §6.6: the read-only views the UI renders from. Pure, so these run with no React and no camera.
import { describe, expect, it } from 'vitest'
import { initialState } from './reducer.ts'
import { PANCAKE_RECIPE } from './fixtures.ts'
import { canCheck, canStart, currentStep, filledSteps, gesturesEnabled, isLastStep, scaledIngredients, stepLabel } from './selectors.ts'
import type { CookingState } from '../contract.ts'

const LAST = PANCAKE_RECIPE.steps.length - 1

const at = (over: Partial<CookingState> = {}): CookingState => ({
  ...initialState(),
  phase: 'cooking',
  recipe: PANCAKE_RECIPE,
  servings: PANCAKE_RECIPE.servings,
  ...over,
})

describe('filledSteps', () => {
  it('fills every placeholder and leaves nothing behind', () => {
    for (const step of filledSteps(at())) {
      expect(step.text).not.toMatch(/\{/)
      expect(step.spoken).not.toMatch(/\{/)
    }
  })

  it('scales the amounts with the chosen servings', () => {
    const text = filledSteps(at({ servings: 8 }))[0].text
    expect(text).toContain('2 cups flour')
    expect(text).toContain('4 tsp baking powder')
  })

  it('writes 4 tbsp as ¼ cup, which is how a cook measures it', () => {
    expect(filledSteps(at({ servings: 8 }))[0].text).toContain('¼ cup sugar')
  })

  it('speaks fractions as words, not ¾ (§4)', () => {
    expect(filledSteps(at())[1].spoken).toContain('three quarters of a cup of milk')
    expect(filledSteps(at())[1].spoken).not.toMatch(/[⅛¼⅓½⅔¾]/)
  })

  it('is empty before a recipe is parsed', () => {
    expect(filledSteps(initialState())).toEqual([])
    expect(currentStep(initialState())).toBeNull()
  })
})

describe('currentStep', () => {
  it('points at the step the cook is on', () => {
    expect(currentStep(at({ stepIndex: 2 }))?.id).toBe(3)
  })

  it('is null past the last step, so the UI cannot read off the end', () => {
    expect(currentStep(at({ stepIndex: LAST + 1 }))).toBeNull()
  })
})

describe('isLastStep', () => {
  it('knows when there is nowhere left to go', () => {
    expect(isLastStep(at({ stepIndex: LAST }))).toBe(true)
    expect(isLastStep(at({ stepIndex: LAST - 1 }))).toBe(false)
    expect(isLastStep(initialState())).toBe(false)
  })
})

describe('canCheck', () => {
  it('is offered only on a checkable step', () => {
    expect(canCheck(at({ stepIndex: 0 }))).toBe(false)
    expect(canCheck(at({ stepIndex: 1 }))).toBe(true)
  })

  it('is withheld while a check is already running (§6.5)', () => {
    expect(canCheck(at({ stepIndex: 1, mode: 'checking' }))).toBe(false)
  })

  it('is withheld outside cooking mode', () => {
    expect(canCheck(at({ stepIndex: 1, phase: 'prep' }))).toBe(false)
  })
})

describe('canStart', () => {
  const prep = (voicing: Partial<CookingState['voicing']>): CookingState =>
    at({ phase: 'prep', stepIndex: 0, voicing: { ready: [], total: 2, servings: 4, ...voicing } })

  it('needs every clip for the chosen servings before Start is live', () => {
    expect(canStart(prep({}))).toBe(false)
    expect(canStart(prep({ ready: ['step-1'], total: 2 }))).toBe(false)
    expect(canStart(prep({ ready: ['step-1', 'step-2'], total: 2 }))).toBe(true)
  })

  it('goes dead when the cook changes servings, because those clips are not cached yet', () => {
    expect(canStart(at({ phase: 'prep', voicing: { ready: ['step-1', 'step-2'], total: 2, servings: 2 } }))).toBe(false)
  })

  it('never counts an empty run as ready', () => {
    expect(canStart(prep({ ready: [], total: 0 }))).toBe(false)
  })
})

describe('gesturesEnabled', () => {
  it('is off while a check runs, so a held gesture cannot fight the verdict (§6.5)', () => {
    expect(gesturesEnabled(at())).toBe(true)
    expect(gesturesEnabled(at({ mode: 'checking' }))).toBe(false)
    expect(gesturesEnabled(at({ phase: 'prep' }))).toBe(false)
  })
})

describe('stepLabel', () => {
  it('counts from one so the cook is never told they are on step zero', () => {
    expect(stepLabel(at({ stepIndex: 0 }))).toBe('Step 1 of 6')
    expect(stepLabel(at({ stepIndex: LAST }))).toBe('Step 6 of 6')
  })
})

describe('scaledIngredients', () => {
  it('lists one row per ingredient at the recipe’s own servings', () => {
    const rows = scaledIngredients(at())
    expect(rows).toHaveLength(PANCAKE_RECIPE.ingredients.length)
    expect(rows.find(r => r.id === 'flour')?.amount).toBe('1 cup')
  })

  it('scales and marks the rows as changed', () => {
    const rows = scaledIngredients(at({ servings: 8 }))
    expect(rows.find(r => r.id === 'flour')?.amount).toBe('2 cups')
    expect(rows.every(r => r.changed)).toBe(true)
  })

  it('says "a little" for the unmeasured oil rather than inventing 0', () => {
    expect(scaledIngredients(at()).find(r => r.id === 'oil')?.amount).toBe('a little')
  })
})