import { describe, expect, it } from 'vitest'
import type { Verdict } from '../types.ts'
import { DEMO_RECIPE_TEXT } from './demoRecipe.ts'
import { pancakes } from './fixtures.ts'
import { AUTO_ADVANCE_MS, cookingReducer, initialState, type Action, type CookingState } from './state.ts'

const run = (state: CookingState, ...actions: Action[]) => actions.reduce(cookingReducer, state)

const ready: Verdict = { status: 'ready', feedback: 'Looks smooth. Next step.' }
const notReady: Verdict = { status: 'not_ready', feedback: 'Still some dry flour streaks. Keep whisking.' }
const unsure: Verdict = { status: 'unsure', feedback: "I can't see the bowl." }

const parsing = () => run(initialState(), { type: 'parseStarted' })
const prep = () => run(parsing(), { type: 'parseSucceeded', recipe: pancakes })
/** Cooking at the given step (0-based). Step 1 and 2 and 4 (indexes 0, 1, 3) are checkable. */
const cooking = (stepIndex = 0) => {
  let s = run(prep(), { type: 'startCooking' })
  for (let i = 0; i < stepIndex; i++) s = run(s, { type: 'gestureNext' })
  return s
}
const checking = (stepIndex = 0) => run(cooking(stepIndex), { type: 'checkStarted' })
/** A running check's verdict arriving, with the request id that check was started with. */
const verdictArrives = (s: CookingState, verdict: Verdict, now = 0) =>
  cookingReducer(s, { type: 'checkSucceeded', requestId: s.requestId, verdict, now })

describe('initial state', () => {
  it('starts on the input screen with the demo recipe text and nothing else', () => {
    expect(initialState()).toEqual({
      phase: 'input',
      recipeText: DEMO_RECIPE_TEXT,
      recipe: null,
      servings: 0,
      stepIndex: 0,
      mode: 'idle',
      verdict: null,
      autoAdvanceAt: null,
      requestId: 0,
      voicing: { ready: [], total: 0, servings: 0 },
      stats: { checks: 0, taps: 0 },
      error: null,
    })
  })

  it('can start with other text', () => {
    expect(initialState('my recipe').recipeText).toBe('my recipe')
  })
})

describe('input and parsing', () => {
  it('updates the recipe text', () => {
    expect(run(initialState(), { type: 'recipeTextChanged', text: 'hello' }).recipeText).toBe('hello')
  })

  it('goes to parsing and clears an old error', () => {
    const failed = run(parsing(), { type: 'parseFailed', error: { kind: 'upstream', message: 'down' } })
    expect(failed.error).not.toBeNull()
    const again = run(failed, { type: 'parseStarted' })
    expect(again.phase).toBe('parsing')
    expect(again.error).toBeNull()
  })

  it('starts parsing only from the input screen', () => {
    const s = prep()
    expect(cookingReducer(s, { type: 'parseStarted' })).toBe(s)
  })

  it('shows the prep screen with the recipe, at its own servings', () => {
    const s = prep()
    expect(s).toMatchObject({ phase: 'prep', recipe: pancakes, servings: 4, stepIndex: 0, mode: 'idle', error: null })
    expect(s.voicing).toEqual({ ready: [], total: 0, servings: 4 })
  })

  it('ignores a parse result that arrives when no parse is running', () => {
    const s = initialState()
    expect(cookingReducer(s, { type: 'parseSucceeded', recipe: pancakes })).toBe(s)
    const cookingNow = cooking()
    expect(cookingReducer(cookingNow, { type: 'parseSucceeded', recipe: pancakes })).toBe(cookingNow)
  })

  it('goes back to input on a parse error, keeping the text', () => {
    const s = run(
      initialState('my recipe'),
      { type: 'parseStarted' },
      { type: 'parseFailed', error: { kind: 'unprocessable', message: 'bad recipe' } },
    )
    expect(s).toMatchObject({ phase: 'input', recipeText: 'my recipe', error: { kind: 'unprocessable' } })
  })

  it('ignores a parse error that arrives when no parse is running', () => {
    const s = cooking()
    expect(cookingReducer(s, { type: 'parseFailed', error: { kind: 'timeout', message: 'slow' } })).toBe(s)
  })
})

describe('servings and voicing on the prep screen', () => {
  it('changes the servings', () => {
    expect(run(prep(), { type: 'servingsChanged', servings: 2 }).servings).toBe(2)
  })

  it.each([
    [0, 1],
    [-3, 1],
    [30, 24],
    [2.6, 3],
  ])('turns %f servings into %i', (asked, got) => {
    expect(run(prep(), { type: 'servingsChanged', servings: asked }).servings).toBe(got)
  })

  it('changes nothing when the servings are the same', () => {
    const s = prep()
    expect(cookingReducer(s, { type: 'servingsChanged', servings: 4 })).toBe(s)
  })

  it('only works on the prep screen', () => {
    const s = cooking()
    expect(cookingReducer(s, { type: 'servingsChanged', servings: 2 })).toBe(s)
  })

  it('drops the clips that have amounts in them, and keeps the rest', () => {
    const s = run(
      prep(),
      { type: 'voicingStarted', servings: 4, total: 5 },
      { type: 'clipReady', id: 'step-1@4', servings: 4 },
      { type: 'clipReady', id: 'step-3', servings: 4 },
      { type: 'clipReady', id: 'step-2@4', servings: 4 },
      { type: 'servingsChanged', servings: 2 },
    )
    expect(s.voicing.ready).toEqual(['step-3'])
    expect(s.voicing.servings).toBe(2)
  })

  it('records how many clips are needed, keeping those already ready', () => {
    const s = run(
      prep(),
      { type: 'clipReady', id: 'step-3', servings: 4 },
      { type: 'voicingStarted', servings: 4, total: 6 },
    )
    expect(s.voicing).toEqual({ ready: ['step-3'], total: 6, servings: 4 })
  })

  it('adds a clip that finishes for the current servings', () => {
    const s = run(prep(), { type: 'clipReady', id: 'step-3', servings: 4 })
    expect(s.voicing.ready).toEqual(['step-3'])
  })

  it('drops a clip that finishes for servings the cook has since changed', () => {
    const s = run(prep(), { type: 'servingsChanged', servings: 2 })
    expect(cookingReducer(s, { type: 'clipReady', id: 'step-1@4', servings: 4 })).toBe(s)
  })

  it('ignores a clip it already has', () => {
    const s = run(prep(), { type: 'clipReady', id: 'step-3', servings: 4 })
    expect(cookingReducer(s, { type: 'clipReady', id: 'step-3', servings: 4 })).toBe(s)
  })

  it('stays on prep with an error when voice generation fails', () => {
    const s = run(prep(), { type: 'voicingFailed', error: { kind: 'upstream', message: 'voice down' } })
    expect(s.phase).toBe('prep')
    expect(s.error).toMatchObject({ kind: 'upstream' })
  })
})

describe('starting to cook', () => {
  it('starts at the first step in idle mode', () => {
    expect(cooking()).toMatchObject({ phase: 'cooking', stepIndex: 0, mode: 'idle', verdict: null, autoAdvanceAt: null })
  })

  it('clears the stats for this cook', () => {
    expect(cooking().stats).toEqual({ checks: 0, taps: 0 })
  })

  it('only starts from the prep screen', () => {
    const s = initialState()
    expect(cookingReducer(s, { type: 'startCooking' })).toBe(s)
  })

  it('keeps the chosen servings', () => {
    const s = run(prep(), { type: 'servingsChanged', servings: 2 }, { type: 'startCooking' })
    expect(s.servings).toBe(2)
  })
})

describe('gestureNext', () => {
  it('moves to the next step and bumps the request id', () => {
    const before = cooking()
    const s = cookingReducer(before, { type: 'gestureNext' })
    expect(s).toMatchObject({ stepIndex: 1, mode: 'idle', verdict: null, autoAdvanceAt: null })
    expect(s.requestId).toBe(before.requestId + 1)
  })

  it('clears a verdict and a countdown: move on anyway', () => {
    const s = run(checking(), { type: 'checkSucceeded', requestId: 1, verdict: ready, now: 1000 }, { type: 'gestureNext' })
    expect(s).toMatchObject({ stepIndex: 1, mode: 'idle', verdict: null, autoAdvanceAt: null })
  })

  it('finishes after the last step', () => {
    const last = cooking(pancakes.steps.length - 1)
    expect(last.stepIndex).toBe(4)
    expect(cookingReducer(last, { type: 'gestureNext' })).toMatchObject({ phase: 'done', mode: 'idle', verdict: null })
  })

  it('is ignored while a check is running', () => {
    const s = checking()
    expect(cookingReducer(s, { type: 'gestureNext' })).toBe(s)
  })

  it('is ignored outside cooking', () => {
    const s = prep()
    expect(cookingReducer(s, { type: 'gestureNext' })).toBe(s)
  })
})

describe('gestureBack', () => {
  it('moves to the previous step', () => {
    expect(cookingReducer(cooking(2), { type: 'gestureBack' })).toMatchObject({ stepIndex: 1, mode: 'idle', verdict: null })
  })

  it('bumps the request id', () => {
    const before = cooking(2)
    expect(cookingReducer(before, { type: 'gestureBack' }).requestId).toBe(before.requestId + 1)
  })

  it('does nothing on the first step when idle, though the controller still replays the clip', () => {
    const s = cooking(0)
    expect(cookingReducer(s, { type: 'gestureBack' })).toBe(s)
  })

  it('on the first step with a verdict showing, clears it and stays', () => {
    const s = run(checking(), { type: 'checkSucceeded', requestId: 1, verdict: notReady, now: 0 }, { type: 'gestureBack' })
    expect(s).toMatchObject({ stepIndex: 0, mode: 'idle', verdict: null })
  })

  it('cancels a ready countdown and stays on the step, leaving the verdict up', () => {
    const counting = verdictArrives(checking(1), ready, 5000)
    expect(counting.autoAdvanceAt).toBe(5000 + AUTO_ADVANCE_MS)

    const s = cookingReducer(counting, { type: 'gestureBack' })
    expect(s).toMatchObject({ stepIndex: 1, mode: 'verdict', autoAdvanceAt: null })
    expect(s.verdict).toEqual(ready)
    expect(s.requestId).toBe(counting.requestId)
  })

  it('goes to the previous step on a second back, once the countdown is cancelled', () => {
    const s = run(verdictArrives(checking(1), ready), { type: 'gestureBack' }, { type: 'gestureBack' })
    expect(s).toMatchObject({ stepIndex: 0, mode: 'idle', verdict: null })
  })

  it('goes to the previous step from a not-ready verdict', () => {
    const s = run(verdictArrives(checking(1), notReady), { type: 'gestureBack' })
    expect(s).toMatchObject({ stepIndex: 0, mode: 'idle', verdict: null })
  })

  it('is ignored while a check is running and outside cooking', () => {
    const c = checking()
    expect(cookingReducer(c, { type: 'gestureBack' })).toBe(c)
    const p = prep()
    expect(cookingReducer(p, { type: 'gestureBack' })).toBe(p)
  })
})

describe('checks', () => {
  it('starts a check on a step with a visual cue', () => {
    const before = cooking(0)
    const s = cookingReducer(before, { type: 'checkStarted' })
    expect(s).toMatchObject({ mode: 'checking', verdict: null, autoAdvanceAt: null })
    expect(s.requestId).toBe(before.requestId + 1)
    expect(s.stats.checks).toBe(1)
  })

  it('does not start on a step that cannot be checked', () => {
    const s = cooking(2) // "Pour a ladle of batter": no cue
    expect(cookingReducer(s, { type: 'checkStarted' })).toBe(s)
  })

  it('does not start while another check is running', () => {
    const s = checking()
    expect(cookingReducer(s, { type: 'checkStarted' })).toBe(s)
  })

  it('does not start outside cooking', () => {
    const s = prep()
    expect(cookingReducer(s, { type: 'checkStarted' })).toBe(s)
  })

  it('can check again from a verdict, and cancels any countdown', () => {
    const s = run(
      checking(),
      { type: 'checkSucceeded', requestId: 1, verdict: ready, now: 0 },
      { type: 'checkStarted' },
    )
    expect(s).toMatchObject({ mode: 'checking', verdict: null, autoAdvanceAt: null })
    expect(s.stats.checks).toBe(2)
  })

  it('shows a ready verdict and starts the auto-advance countdown', () => {
    const s = run(checking(), { type: 'checkSucceeded', requestId: 1, verdict: ready, now: 10_000 })
    expect(s).toMatchObject({ mode: 'verdict', verdict: ready, autoAdvanceAt: 10_000 + AUTO_ADVANCE_MS })
  })

  it('pushes a running countdown back, but only for the current check', () => {
    const s = run(checking(), { type: 'checkSucceeded', requestId: 1, verdict: ready, now: 10_000 })
    expect(cookingReducer(s, { type: 'autoAdvanceDelayed', requestId: 1, ms: 100 }).autoAdvanceAt).toBe(10_000 + AUTO_ADVANCE_MS + 100)
    expect(cookingReducer(s, { type: 'autoAdvanceDelayed', requestId: 0, ms: 100 })).toBe(s)
    const notReadyState = run(checking(), { type: 'checkSucceeded', requestId: 1, verdict: notReady, now: 0 })
    expect(cookingReducer(notReadyState, { type: 'autoAdvanceDelayed', requestId: 1, ms: 100 })).toBe(notReadyState)
  })

  it.each([
    ['not ready', notReady],
    ['unsure', unsure],
  ])('shows a %s verdict with no countdown', (_name, verdict) => {
    const s = run(checking(), { type: 'checkSucceeded', requestId: 1, verdict, now: 10_000 })
    expect(s).toMatchObject({ mode: 'verdict', verdict, autoAdvanceAt: null })
  })

  it('drops a verdict that comes back for an old check', () => {
    const s = checking()
    expect(cookingReducer(s, { type: 'checkSucceeded', requestId: s.requestId - 1, verdict: ready, now: 0 })).toBe(s)
  })

  it('drops a verdict when no check is running', () => {
    const s = cooking()
    expect(cookingReducer(s, { type: 'checkSucceeded', requestId: s.requestId, verdict: ready, now: 0 })).toBe(s)
  })

  it('goes back to idle with an error when a check fails', () => {
    const before = checking()
    const s = cookingReducer(before, {
      type: 'checkFailed',
      requestId: before.requestId,
      error: { kind: 'timeout', message: 'slow' },
    })
    expect(s).toMatchObject({ mode: 'idle', error: { kind: 'timeout' } })
  })

  it('drops a failure that comes back for an old check', () => {
    const s = checking()
    expect(
      cookingReducer(s, { type: 'checkFailed', requestId: s.requestId - 1, error: { kind: 'timeout', message: 'slow' } }),
    ).toBe(s)
  })
})

describe('taps, errors and restart', () => {
  it('counts screen taps while cooking', () => {
    expect(run(cooking(), { type: 'screenTapped' }, { type: 'screenTapped' }).stats.taps).toBe(2)
  })

  it('ignores taps outside cooking', () => {
    const s = prep()
    expect(cookingReducer(s, { type: 'screenTapped' })).toBe(s)
  })

  it('dismisses an error, and changes nothing if there is none', () => {
    const withError = run(prep(), { type: 'voicingFailed', error: { kind: 'upstream', message: 'x' } })
    expect(cookingReducer(withError, { type: 'errorDismissed' }).error).toBeNull()
    const clean = prep()
    expect(cookingReducer(clean, { type: 'errorDismissed' })).toBe(clean)
  })

  it('starts over from any screen, keeping the recipe text', () => {
    const s = run(
      initialState('my recipe'),
      { type: 'parseStarted' },
      { type: 'parseSucceeded', recipe: pancakes },
      { type: 'startCooking' },
      { type: 'gestureNext' },
      { type: 'restart' },
    )
    expect(s).toEqual(initialState('my recipe'))
  })

  it('returns the same state for an action it does not know', () => {
    const s = prep()
    expect(cookingReducer(s, { type: 'nonsense' } as never)).toBe(s)
  })

  it('does not change the state it was given', () => {
    const before = cooking()
    const copy = structuredClone(before)
    cookingReducer(before, { type: 'gestureNext' })
    cookingReducer(before, { type: 'checkStarted' })
    expect(before).toEqual(copy)
  })
})
