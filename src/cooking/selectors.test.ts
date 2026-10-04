import { describe, expect, it } from 'vitest'
import type { Verdict } from '../types.ts'
import { pancakes } from './fixtures.ts'
import {
  canCheck,
  canStart,
  currentClipId,
  currentStep,
  gesturesEnabled,
  isAutoAdvanceDue,
  isLastStep,
  scaledIngredients,
  stepLabel,
} from './selectors.ts'
import { cookingReducer, initialState, type Action, type CookingState } from './state.ts'

const run = (state: CookingState, ...actions: Action[]) => actions.reduce(cookingReducer, state)
const ready: Verdict = { status: 'ready', feedback: 'Looks smooth.' }
const notReady: Verdict = { status: 'not_ready', feedback: 'Keep whisking.' }

const prep = (servings?: number) =>
  run(
    initialState(),
    { type: 'parseStarted' },
    { type: 'parseSucceeded', recipe: pancakes },
    ...(servings === undefined ? [] : [{ type: 'servingsChanged', servings } as const]),
  )
const cooking = (stepIndex = 0, servings?: number) => {
  let s = run(prep(servings), { type: 'startCooking' })
  for (let i = 0; i < stepIndex; i++) s = run(s, { type: 'gestureNext' })
  return s
}
const checking = (stepIndex = 0) => run(cooking(stepIndex), { type: 'checkStarted' })

describe('currentStep', () => {
  it('is nothing before cooking starts', () => {
    expect(currentStep(initialState())).toBeNull()
    expect(currentStep(prep())).toBeNull()
  })

  it('is the step being cooked, with amounts filled in at the recipe servings', () => {
    expect(currentStep(cooking(0))).toEqual({
      text: 'Whisk 1 cup flour, 1 cup milk and 2 eggs into a batter.',
      spoken: 'Step 1. Whisk one cup of flour, one cup of milk and two eggs into a batter.',
      cue: 'Batter is smooth with no dry flour streaks',
      checkable: true,
      headsUp: 'Next step needs a hot pan. Turn it on now.',
    })
  })

  it('has the amounts scaled to the chosen servings', () => {
    const step = currentStep(cooking(0, 2))
    expect(step?.text).toBe('Whisk ½ cup flour, ½ cup milk and 1 egg into a batter.')
    expect(step?.spoken).toBe('Step 1. Whisk half a cup of flour, half a cup of milk and one egg into a batter.')
  })

  it('leaves a step with no amounts as it is', () => {
    expect(currentStep(cooking(2, 2))).toMatchObject({
      text: 'Pour a ladle of batter into the pan.',
      cue: null,
      checkable: false,
      headsUp: null,
    })
  })

  it('follows the step index', () => {
    expect(currentStep(cooking(1))?.text).toBe('Heat the pan on medium and melt 2 tbsp melted butter.')
  })

  it('is nothing on the done screen', () => {
    const done = run(cooking(4), { type: 'gestureNext' })
    expect(done.phase).toBe('done')
    expect(currentStep(done)).toBeNull()
  })
})

describe('currentClipId', () => {
  it('is the clip for the step being cooked, tied to the servings when it has amounts', () => {
    expect(currentClipId(cooking(0))).toBe('step-1@4')
    expect(currentClipId(cooking(0, 2))).toBe('step-1@2')
  })

  it('does not carry the servings for a step with no amounts', () => {
    expect(currentClipId(cooking(2))).toBe('step-3')
    expect(currentClipId(cooking(2, 2))).toBe('step-3')
  })

  it('is nothing outside cooking', () => {
    expect(currentClipId(initialState())).toBeNull()
    expect(currentClipId(prep())).toBeNull()
  })
})

describe('isLastStep and stepLabel', () => {
  it('knows the last step', () => {
    expect(isLastStep(cooking(3))).toBe(false)
    expect(isLastStep(cooking(4))).toBe(true)
  })

  it('is false with no recipe', () => {
    expect(isLastStep(initialState())).toBe(false)
  })

  it('labels the step as a position out of the total', () => {
    expect(stepLabel(cooking(0))).toBe('Step 1 of 5')
    expect(stepLabel(cooking(4))).toBe('Step 5 of 5')
  })

  it('has no label with no recipe', () => {
    expect(stepLabel(initialState())).toBe('')
  })
})

describe('canCheck', () => {
  it('is true on a step with a visual cue', () => {
    expect(canCheck(cooking(0))).toBe(true)
  })

  it('is false on a step with no cue', () => {
    expect(canCheck(cooking(2))).toBe(false)
  })

  it('is false while a check is running', () => {
    expect(canCheck(checking())).toBe(false)
  })

  it('is true again while a verdict is showing, to check again', () => {
    const s = run(checking(), { type: 'checkSucceeded', requestId: 1, verdict: notReady, now: 0 })
    expect(canCheck(s)).toBe(true)
  })

  it('is false outside cooking', () => {
    expect(canCheck(initialState())).toBe(false)
    expect(canCheck(prep())).toBe(false)
  })
})

describe('gesturesEnabled', () => {
  it('is on while cooking and idle, or showing a verdict', () => {
    expect(gesturesEnabled(cooking())).toBe(true)
    expect(gesturesEnabled(run(checking(), { type: 'checkSucceeded', requestId: 1, verdict: ready, now: 0 }))).toBe(true)
  })

  it('is off while a check is running', () => {
    expect(gesturesEnabled(checking())).toBe(false)
  })

  it('is off outside cooking', () => {
    expect(gesturesEnabled(initialState())).toBe(false)
    expect(gesturesEnabled(prep())).toBe(false)
  })
})

describe('scaledIngredients', () => {
  it('is empty with no recipe', () => {
    expect(scaledIngredients(initialState())).toEqual([])
  })

  it('lists every ingredient at the recipe servings, none marked changed', () => {
    const list = scaledIngredients(prep())
    expect(list.map((i) => i.label)).toEqual([
      '1 cup flour',
      '1 cup milk',
      '2 eggs',
      '2 tbsp melted butter',
      'a pinch of salt',
    ])
    expect(list.every((i) => !i.changed)).toBe(true)
    expect(list.map((i) => i.id)).toEqual(['flour', 'milk', 'egg', 'butter', 'salt'])
  })

  it('scales them to the chosen servings and marks the ones that changed', () => {
    const list = scaledIngredients(prep(2))
    expect(list.map((i) => i.label)).toEqual(['½ cup flour', '½ cup milk', '1 egg', '1 tbsp melted butter', 'a pinch of salt'])
    expect(list.map((i) => i.changed)).toEqual([true, true, true, true, false])
  })

  it('carries the rounding note for a whole item', () => {
    const odd = scaledIngredients(prep(1)) // 2 eggs at a quarter: 0.5, rounded to 1
    expect(odd.find((i) => i.id === 'egg')?.note).toContain('rounds to')
    expect(odd.find((i) => i.id === 'flour')?.note).toBeNull()
  })
})

describe('canStart', () => {
  const withClips = (ids: string[], total: number, servings = 4) =>
    run(
      prep(servings === 4 ? undefined : servings),
      { type: 'voicingStarted', servings, total },
      ...ids.map((id) => ({ type: 'clipReady', id, servings }) as const),
    )

  it('is true when there are no clips to wait for, as when there is no voice', () => {
    expect(canStart(prep())).toBe(true)
  })

  it('is false until every clip is ready', () => {
    expect(canStart(withClips(['step-1@4', 'step-2@4'], 5))).toBe(false)
  })

  it('is true once every clip is ready', () => {
    expect(canStart(withClips(['a', 'b', 'c', 'd', 'e'], 5))).toBe(true)
  })

  it('goes false again when the servings change and the clips with amounts are dropped', () => {
    const s = run(withClips(['step-1@4', 'step-2@4', 'step-3', 'step-4', 'step-5'], 5), {
      type: 'servingsChanged',
      servings: 2,
    })
    expect(canStart(s)).toBe(false)
  })

  it('is true again once the clips for the new servings are made', () => {
    const s = run(
      withClips(['step-1@4', 'step-2@4', 'step-3', 'step-4', 'step-5'], 5),
      { type: 'servingsChanged', servings: 2 },
      { type: 'voicingStarted', servings: 2, total: 5 },
      { type: 'clipReady', id: 'step-1@2', servings: 2 },
      { type: 'clipReady', id: 'step-2@2', servings: 2 },
    )
    expect(canStart(s)).toBe(true)
  })

  it('is false outside the prep screen', () => {
    expect(canStart(initialState())).toBe(false)
    expect(canStart(cooking())).toBe(false)
  })
})

describe('isAutoAdvanceDue', () => {
  const counting = () => run(checking(), { type: 'checkSucceeded', requestId: 1, verdict: ready, now: 1000 })

  it('is false with no countdown', () => {
    expect(isAutoAdvanceDue(cooking(), 99_999)).toBe(false)
  })

  it('is false before the time and true at and after it', () => {
    const s = counting()
    expect(s.autoAdvanceAt).toBe(3000)
    expect(isAutoAdvanceDue(s, 2999)).toBe(false)
    expect(isAutoAdvanceDue(s, 3000)).toBe(true)
    expect(isAutoAdvanceDue(s, 5000)).toBe(true)
  })

  it('is false once the countdown is cancelled by back', () => {
    const s = run(counting(), { type: 'gestureBack' })
    expect(isAutoAdvanceDue(s, 99_999)).toBe(false)
  })
})
