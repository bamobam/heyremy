// The cooking state and the one function that changes it. Pure: no camera, no
// network, no timers. Everything that happens (a gesture, a response, a tap)
// arrives as an action, and the reducer is the only writer.

import type { ApiErrorKind, ParsedRecipe, Verdict } from '../types.ts'
import { DEMO_RECIPE_TEXT } from './demoRecipe.ts'

/** After a "ready" verdict, move on by itself this long later unless the cook says back. */
export const AUTO_ADVANCE_MS = 2000

export const MIN_SERVINGS = 1
export const MAX_SERVINGS = 24

export type Phase =
  | 'input' // the recipe text box
  | 'parsing' // waiting on /api/parse
  | 'prep' // ingredients, servings, before-you-start; step clips are generated in the background
  | 'cooking' // step by step
  | 'done' // after the last step

export type CookMode =
  | 'idle' // showing a step
  | 'checking' // palm held; waiting for the photo and the verdict
  | 'verdict' // a verdict is on screen

export interface AppError {
  kind: ApiErrorKind | 'camera'
  message: string
}

export interface CookingState {
  phase: Phase
  /** What the cook pasted. Kept across errors and restarts. */
  recipeText: string
  recipe: ParsedRecipe | null
  /** The servings chosen; starts at the recipe's own. */
  servings: number
  /** 0-based into recipe.steps. */
  stepIndex: number
  /** Only meaningful while cooking. */
  mode: CookMode
  /** Set in verdict mode; cleared on any step change. */
  verdict: Verdict | null
  /** When to move on by itself after a "ready" verdict. Cleared by "back" or any step change. */
  autoAdvanceAt: number | null
  /** Goes up on every step change and every check, so a response for an old one can be recognised and dropped. */
  requestId: number
  /** Step clips that are cached for the current servings. */
  voicing: { ready: string[]; total: number; servings: number }
  /** For the done screen. */
  stats: { checks: number; taps: number }
  error: AppError | null
}

export function initialState(recipeText: string = DEMO_RECIPE_TEXT): CookingState {
  return {
    phase: 'input',
    recipeText,
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
  }
}

export type Action =
  | { type: 'recipeTextChanged'; text: string }
  | { type: 'parseStarted' }
  | { type: 'parseSucceeded'; recipe: ParsedRecipe }
  | { type: 'parseFailed'; error: AppError }
  | { type: 'servingsChanged'; servings: number }
  | { type: 'voicingStarted'; servings: number; total: number }
  | { type: 'clipReady'; id: string; servings: number }
  | { type: 'voicingFailed'; error: AppError }
  | { type: 'startCooking' }
  | { type: 'gestureNext' }
  | { type: 'gestureBack' }
  | { type: 'checkStarted' }
  | { type: 'checkSucceeded'; requestId: number; verdict: Verdict; now: number }
  | { type: 'checkFailed'; requestId: number; error: AppError }
  | { type: 'screenTapped' }
  | { type: 'errorDismissed' }
  | { type: 'restart' }

/** A clip that has an amount in it is for one servings value only (see stepClipId in scaling.ts). */
const isScaledClip = (id: string) => id.includes('@')

/** Cooking, and not waiting on a check: gestures can move the cook along. */
const canNavigate = (s: CookingState) => s.phase === 'cooking' && s.mode !== 'checking'

const currentStep = (s: CookingState) => s.recipe?.steps[s.stepIndex] ?? null

export function cookingReducer(state: CookingState, action: Action): CookingState {
  switch (action.type) {
    case 'recipeTextChanged':
      return state.recipeText === action.text ? state : { ...state, recipeText: action.text }

    case 'parseStarted':
      return state.phase === 'input' ? { ...state, phase: 'parsing', error: null } : state

    case 'parseSucceeded':
      if (state.phase !== 'parsing') return state
      return {
        ...state,
        phase: 'prep',
        recipe: action.recipe,
        servings: action.recipe.servings,
        stepIndex: 0,
        mode: 'idle',
        verdict: null,
        autoAdvanceAt: null,
        voicing: { ready: [], total: 0, servings: action.recipe.servings },
        error: null,
      }

    case 'parseFailed':
      return state.phase === 'parsing' ? { ...state, phase: 'input', error: action.error } : state

    case 'servingsChanged': {
      if (state.phase !== 'prep') return state
      const servings = Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, Math.round(action.servings)))
      if (servings === state.servings) return state
      // Clips with amounts in them were for the old servings; the rest are still good.
      return {
        ...state,
        servings,
        voicing: { ...state.voicing, ready: state.voicing.ready.filter((id) => !isScaledClip(id)), servings },
      }
    }

    case 'voicingStarted':
      if (state.phase !== 'prep' || action.servings !== state.servings) return state
      return { ...state, voicing: { ...state.voicing, servings: action.servings, total: action.total } }

    case 'clipReady':
      // A clip made for servings the cook has since changed is dropped.
      if (action.servings !== state.voicing.servings || state.voicing.ready.includes(action.id)) return state
      return { ...state, voicing: { ...state.voicing, ready: [...state.voicing.ready, action.id] } }

    case 'voicingFailed':
      return state.phase === 'prep' ? { ...state, error: action.error } : state

    case 'startCooking':
      if (state.phase !== 'prep' || !state.recipe) return state
      return {
        ...state,
        phase: 'cooking',
        stepIndex: 0,
        mode: 'idle',
        verdict: null,
        autoAdvanceAt: null,
        stats: { checks: 0, taps: 0 },
      }

    case 'gestureNext': {
      if (!canNavigate(state) || !state.recipe) return state
      const last = state.stepIndex >= state.recipe.steps.length - 1
      return {
        ...state,
        phase: last ? 'done' : 'cooking',
        stepIndex: last ? state.stepIndex : state.stepIndex + 1,
        mode: 'idle',
        verdict: null,
        autoAdvanceAt: null,
        requestId: state.requestId + 1,
      }
    }

    case 'gestureBack': {
      if (!canNavigate(state)) return state
      // While a "ready" countdown runs, back means "stay": cancel it and keep the verdict up.
      if (state.mode === 'verdict' && state.autoAdvanceAt !== null) return { ...state, autoAdvanceAt: null }
      // Nothing to change on the first step with nothing showing (the controller still replays the clip).
      if (state.stepIndex === 0 && state.mode === 'idle' && state.verdict === null) return state
      return {
        ...state,
        stepIndex: Math.max(0, state.stepIndex - 1),
        mode: 'idle',
        verdict: null,
        autoAdvanceAt: null,
        requestId: state.requestId + 1,
      }
    }

    case 'checkStarted':
      if (!canNavigate(state) || !currentStep(state)?.checkable) return state
      return {
        ...state,
        mode: 'checking',
        verdict: null,
        autoAdvanceAt: null,
        requestId: state.requestId + 1,
        stats: { ...state.stats, checks: state.stats.checks + 1 },
      }

    case 'checkSucceeded':
      if (state.mode !== 'checking' || action.requestId !== state.requestId) return state
      return {
        ...state,
        mode: 'verdict',
        verdict: action.verdict,
        autoAdvanceAt: action.verdict.status === 'ready' ? action.now + AUTO_ADVANCE_MS : null,
      }

    case 'checkFailed':
      if (state.mode !== 'checking' || action.requestId !== state.requestId) return state
      return { ...state, mode: 'idle', error: action.error }

    case 'screenTapped':
      return state.phase === 'cooking' ? { ...state, stats: { ...state.stats, taps: state.stats.taps + 1 } } : state

    case 'errorDismissed':
      return state.error === null ? state : { ...state, error: null }

    case 'restart':
      return initialState(state.recipeText)

    default:
      return state
  }
}
