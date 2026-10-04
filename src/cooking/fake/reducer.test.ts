// The §6.2 action → §6.3 rules, and the §6.5 gesture table. Pure, so no React and no camera here.
import { describe, expect, it } from 'vitest'
import { fakeReducer, initialState } from './reducer.ts'
import { PANCAKE_RECIPE } from './fixtures.ts'
import type { Verdict } from '../../types.ts'
import type { Action, CookingState } from '../contract.ts'

const LAST = PANCAKE_RECIPE.steps.length - 1

const run = (actions: Action[], from: CookingState = initialState()) => actions.reduce(fakeReducer, from)

const onStep = (stepIndex: number, over: Partial<CookingState> = {}): CookingState => ({
  ...initialState(),
  phase: 'cooking',
  recipe: PANCAKE_RECIPE,
  servings: PANCAKE_RECIPE.servings,
  stepIndex,
  ...over,
})

const verdict = (status: Verdict['status']): Verdict => ({ status, feedback: 'because' })

describe('parse', () => {
  it('keeps the pasted text on a failure, so a retry does not lose the recipe', () => {
    const s = run([
      { type: 'recipeTextChanged', text: 'pancakes' },
      { type: 'parseStarted' },
      { type: 'parseFailed', error: { kind: 'upstream', message: 'nope' } },
    ])
    expect(s.phase).toBe('input')
    expect(s.recipeText).toBe('pancakes')
    expect(s.error?.message).toBe('nope')
  })

  it('lands on prep with the recipe’s own servings', () => {
    const s = run([{ type: 'parseStarted' }, { type: 'parseSucceeded', recipe: PANCAKE_RECIPE }])
    expect(s.phase).toBe('prep')
    expect(s.servings).toBe(PANCAKE_RECIPE.servings)
    expect(s.stepIndex).toBe(0)
  })
})

describe('servings', () => {
  it('clamps to the allowed range', () => {
    expect(run([{ type: 'servingsChanged', servings: 0 }]).servings).toBe(1)
    expect(run([{ type: 'servingsChanged', servings: 999 }]).servings).toBe(24)
  })

  it('drops a clip from an abandoned servings run', () => {
    const s = run(
      [
        { type: 'voicingStarted', servings: 4, total: 8 },
        { type: 'clipReady', id: 'step-1', servings: 4 },
        { type: 'clipReady', id: 'step-2', servings: 2 },
      ],
      { ...initialState(), servings: 2 },
    )
    expect(s.voicing.ready).toEqual(['step-1'])
  })

  it('never counts the same clip twice', () => {
    const s = run([
      { type: 'voicingStarted', servings: 4, total: 8 },
      { type: 'clipReady', id: 'step-1', servings: 4 },
      { type: 'clipReady', id: 'step-1', servings: 4 },
    ])
    expect(s.voicing.ready).toEqual(['step-1'])
  })
})

describe('the gesture table (§6.5)', () => {
  it('goes forward and clears the verdict, so next always works', () => {
    const s = run([{ type: 'gestureNext' }], onStep(1, { mode: 'verdict', verdict: verdict('not_ready') }))
    expect(s.stepIndex).toBe(2)
    expect(s.verdict).toBeNull()
    expect(s.mode).toBe('idle')
  })

  it('goes back a step normally', () => {
    expect(run([{ type: 'gestureBack' }], onStep(2)).stepIndex).toBe(1)
  })

  it('repeats step 1 rather than going off the start', () => {
    expect(run([{ type: 'gestureBack' }], onStep(0)).stepIndex).toBe(0)
  })

  it('👎 during a ready countdown cancels it and stays put', () => {
    const s = run([{ type: 'gestureBack' }], onStep(2, { mode: 'verdict', autoAdvanceAt: 5000 }))
    expect(s.stepIndex).toBe(2)
    expect(s.autoAdvanceAt).toBeNull()
    expect(s.mode).toBe('verdict')
  })

  it('finishes on the last step', () => {
    const s = run([{ type: 'gestureNext' }], onStep(LAST))
    expect(s.phase).toBe('done')
    expect(s.verdict).toBeNull()
  })
})

describe('checks', () => {
  it('counts the check and dims the card', () => {
    const s = run([{ type: 'checkStarted' }], onStep(1))
    expect(s.mode).toBe('checking')
    expect(s.stats.checks).toBe(1)
  })

  it('sets the countdown only for ready', () => {
    const ready = run([{ type: 'checkStarted' }, { type: 'checkSucceeded', requestId: 0, verdict: verdict('ready'), now: 1000 }], onStep(1))
    expect(ready.autoAdvanceAt).toBe(3000)
    for (const status of ['not_ready', 'unsure'] as const) {
      const s = run([{ type: 'checkStarted' }, { type: 'checkSucceeded', requestId: 0, verdict: verdict(status), now: 1000 }], onStep(1))
      expect(s.autoAdvanceAt).toBeNull()
    }
  })

  it('drops a verdict for a step the cook already left', () => {
    const s = run([{ type: 'checkStarted' }, { type: 'checkSucceeded', requestId: 99, verdict: verdict('ready'), now: 0 }], onStep(1))
    expect(s.mode).toBe('checking')
    expect(s.verdict).toBeNull()
  })

  it('goes back to idle when a check fails', () => {
    const s = run([{ type: 'checkStarted' }, { type: 'checkFailed', requestId: 0, error: { kind: 'camera', message: 'no photo' } }], onStep(1))
    expect(s.mode).toBe('idle')
    expect(s.error?.kind).toBe('camera')
  })
})

describe('the session', () => {
  it('counts taps, for the done screen', () => {
    const s = run([{ type: 'screenTapped' }, { type: 'screenTapped' }, { type: 'screenTapped' }])
    expect(s.stats.taps).toBe(3)
  })

  it('dismisses the error without touching anything else', () => {
    const s = run([{ type: 'parseFailed', error: { kind: 'upstream', message: 'nope' } }, { type: 'errorDismissed' }])
    expect(s.error).toBeNull()
    expect(s.phase).toBe('input')
  })

  it('restarts back to a clean session', () => {
    const s = run([{ type: 'restart' }], onStep(3, { stats: { checks: 2, taps: 9 } }))
    expect(s).toEqual(initialState())
  })
})