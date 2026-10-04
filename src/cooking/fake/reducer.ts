// TEMPORARY (fake, replaced by Nam's cooking/state.ts): the cooking state and the §6.2 action →
// §6.3 rules. Pure — no React, no camera, no network — so the rules can be tested on their own.
import { MAX_SERVINGS, MIN_SERVINGS, AUTO_ADVANCE_MS, type Action, type CookingState } from '../contract.ts'
import { PANCAKE_RECIPE_TEXT } from './fixtures.ts'

export function initialState(): CookingState {
  return {
    phase: 'input',
    recipeText: PANCAKE_RECIPE_TEXT,
    recipe: null,
    servings: 4,
    stepIndex: 0,
    mode: 'idle',
    verdict: null,
    autoAdvanceAt: null,
    requestId: 0,
    voicing: { ready: [], total: 0, servings: 4 },
    stats: { checks: 0, taps: 0 },
    error: null,
  }
}

/** gestureNext, gestureBack and checkStarted only apply while cooking, and not mid-check (§6.3). */
function canNavigate(s: CookingState): boolean {
  return s.phase === 'cooking' && s.mode !== 'checking'
}

/** The §6.2 action → §6.3 state rules. Pure, so they can be tested without React. */
export function fakeReducer(s: CookingState, a: Action): CookingState {
  switch (a.type) {
    case 'recipeTextChanged':
      return { ...s, recipeText: a.text }

    case 'parseStarted':
      return { ...s, phase: 'parsing', error: null }

    case 'parseSucceeded':
      return {
        ...s,
        phase: 'prep',
        recipe: a.recipe,
        servings: a.recipe.servings,
        stepIndex: 0,
        mode: 'idle',
        verdict: null,
        autoAdvanceAt: null,
        requestId: s.requestId + 1,
        error: null,
      }

    // The pasted text stays put, so a retry never loses the recipe.
    case 'parseFailed':
      return { ...s, phase: 'input', error: a.error }

    case 'servingsChanged':
      if (s.phase !== 'prep') return s
      return { ...s, servings: Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, Math.round(a.servings))) }

    case 'voicingStarted':
      return { ...s, voicing: { ready: [], total: a.total, servings: a.servings } }

    // A clip from an abandoned servings run is dropped, and never counted twice.
    case 'clipReady':
      if (a.servings !== s.voicing.servings || s.voicing.ready.includes(a.id)) return s
      return { ...s, voicing: { ...s.voicing, ready: [...s.voicing.ready, a.id] } }

    case 'voicingFailed':
      return { ...s, error: a.error }

    case 'startCooking':
      return {
        ...s,
        phase: 'cooking',
        stepIndex: 0,
        mode: 'idle',
        verdict: null,
        autoAdvanceAt: null,
        requestId: s.requestId + 1,
      }

    // A verdict never blocks next: the cook can always move on (§6.5).
    case 'gestureNext': {
      if (!s.recipe || !canNavigate(s)) return s
      if (s.stepIndex >= s.recipe.steps.length - 1) {
        return { ...s, phase: 'done', mode: 'idle', verdict: null, autoAdvanceAt: null }
      }
      return {
        ...s,
        stepIndex: s.stepIndex + 1,
        mode: 'idle',
        verdict: null,
        autoAdvanceAt: null,
        requestId: s.requestId + 1,
      }
    }

    // 👎 during a ready countdown cancels it and stays put; otherwise it goes back a step (§6.5).
    case 'gestureBack':
      if (!canNavigate(s)) return s
      if (s.autoAdvanceAt !== null) return { ...s, autoAdvanceAt: null }
      return {
        ...s,
        stepIndex: Math.max(0, s.stepIndex - 1),
        mode: 'idle',
        verdict: null,
        requestId: s.requestId + 1,
      }

    // Bumps requestId, so a verdict still in flight for the previous check is dropped, and clears a
    // ready countdown that "check again" interrupts (§6.2).
    case 'checkStarted':
      if (!canNavigate(s) || !s.recipe?.steps[s.stepIndex]?.checkable) return s
      return {
        ...s,
        mode: 'checking',
        verdict: null,
        autoAdvanceAt: null,
        requestId: s.requestId + 1,
        stats: { ...s.stats, checks: s.stats.checks + 1 },
      }

    // A verdict for a step the cook already left is dropped (§6.8 checkFlow).
    case 'checkSucceeded':
      if (a.requestId !== s.requestId) return s
      return {
        ...s,
        mode: 'verdict',
        verdict: a.verdict,
        autoAdvanceAt: a.verdict.status === 'ready' ? a.now + AUTO_ADVANCE_MS : null,
      }

    case 'checkFailed':
      if (a.requestId !== s.requestId) return s
      return { ...s, mode: 'idle', error: a.error }

    case 'screenTapped':
      if (s.phase !== 'cooking') return s
      return { ...s, stats: { ...s.stats, taps: s.stats.taps + 1 } }

    case 'errorDismissed':
      return { ...s, error: null }

    // Back to the input screen with the pasted text kept (§6.2).
    case 'restart':
      return { ...initialState(), recipeText: s.recipeText }
  }
}
