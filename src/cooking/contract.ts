// The seam between the UI and the cooking state (SYSTEM_DESIGN §6). Screens import from here only.
//
// Types, actions and the controller shape follow §6.1, §6.2, §6.6 and §6.8 (Nam owns those).
// The implementation behind the seam is the TEMPORARY fake in ./fake/: when Nam's real
// provider and selectors land, swap the two re-exports at the bottom of this file.
import type { HatCam } from '../camera/useHatCam.ts'
import type { ApiErrorKind, GestureEvent, ParsedRecipe, Verdict } from '../types.ts'

export type { GestureEvent, GestureIntent, HoldProgress, Ingredient, ParsedRecipe, Step, Verdict } from '../types.ts'
export type { HatCam } from '../camera/useHatCam.ts'

// ---------- State (§6.1) ----------

export type Phase =
  /** Recipe text box. */
  | 'input'
  /** Waiting on /api/parse. */
  | 'parsing'
  /** Ingredients, servings, before-you-start; clips generate in the background. */
  | 'prep'
  /** Step-by-step, hands-free. */
  | 'cooking'
  /** After the last step. */
  | 'done'

/** Only meaningful while phase === 'cooking'. */
export type CookMode =
  /** Showing a step. */
  | 'idle'
  /** Palm held; waiting for the photo and the verdict. */
  | 'checking'
  /** Verdict on screen. */
  | 'verdict'

export interface CookingError {
  kind: ApiErrorKind | 'camera'
  message: string
}

export interface Voicing {
  /** Clip ids cached for `servings`. */
  ready: string[]
  total: number
  servings: number
}

export interface CookingStats {
  checks: number
  taps: number
}

export interface CookingState {
  phase: Phase
  /** What the cook pasted, kept across errors. */
  recipeText: string
  recipe: ParsedRecipe | null
  /** Chosen servings; starts at recipe.servings. */
  servings: number
  /** 0-based into recipe.steps. */
  stepIndex: number
  mode: CookMode
  /** Set in 'verdict' mode, cleared on any step change. */
  verdict: Verdict | null
  /** Clock time (ms) the 'ready' countdown ends; cleared by back or any step change. */
  autoAdvanceAt: number | null
  /** Increments per step change or check; stale responses are dropped. */
  requestId: number
  voicing: Voicing
  /** For the done screen. */
  stats: CookingStats
  error: CookingError | null
}

/** Servings the cook can pick (§6.2 servingsChanged). */
export const MIN_SERVINGS = 1
export const MAX_SERVINGS = 24

/** How long a 'ready' verdict stays before moving on (§6.2 checkSucceeded). */
export const AUTO_ADVANCE_MS = 2000

// ---------- Actions (§6.2) ----------

export type Action =
  | { type: 'recipeTextChanged'; text: string }
  | { type: 'parseStarted' }
  | { type: 'parseSucceeded'; recipe: ParsedRecipe }
  | { type: 'parseFailed'; error: CookingError }
  | { type: 'servingsChanged'; servings: number }
  | { type: 'voicingStarted'; servings: number; total: number }
  | { type: 'clipReady'; id: string; servings: number }
  | { type: 'voicingFailed'; error: CookingError }
  | { type: 'startCooking' }
  | { type: 'gestureNext' }
  | { type: 'gestureBack' }
  | { type: 'checkStarted' }
  | { type: 'checkSucceeded'; requestId: number; verdict: Verdict; now: number }
  | { type: 'checkFailed'; requestId: number; error: CookingError }
  | { type: 'screenTapped' }
  | { type: 'errorDismissed' }
  | { type: 'restart' }

/** The actions screens may dispatch directly. Everything else goes through the controller. */
export type UiAction = Extract<Action, { type: 'recipeTextChanged' | 'screenTapped' | 'errorDismissed' }>

// ---------- Controller (§6.8) ----------

export interface Controller {
  /** parseFlow: input → parsing → prep (or back to input with an error). */
  submitRecipe(text: string): Promise<void>
  /** servingsChanged, then re-voice the steps whose amounts changed. Only applies in prep. */
  setServings(n: number): void
  /** Retry voicing after voicingFailed (the "Try again" button on the prep screen). */
  retryVoicing(): void
  /** Unlock audio, startCooking, play step 1. Call from the Start button's click handler. */
  start(): void
  /** Next / back / check, from the camera (or the keyboard in the fake). */
  onGesture(e: GestureEvent): void
  restart(): void
}

// ---------- Selectors (§6.6) ----------

/** A step with its placeholders filled in at the chosen servings. */
export interface FilledStep {
  id: number
  text: string
  spoken: string
  cue: string | null
  checkable: boolean
  headsUp: string | null
}

/** One ingredient at the chosen servings, for the prep list. */
export interface ScaledIngredient {
  id: string
  /** Amount, unit and name, e.g. "⅓ cup + 1 tbsp milk". */
  label: string
  /** Just the amount and unit, e.g. "⅓ cup + 1 tbsp", or "a little" when the recipe gives none. */
  amount: string
  name: string
  /** True when the amount differs from the recipe's (servings changed). */
  changed: boolean
  /** Shown under the list when rounding is big, e.g. "½ egg rounds to 1 small egg". */
  note: string | null
}

// ---------- Context (§6.9, §9.5) ----------

/**
 * What useCooking() returns. Read-only state plus the ways to change it.
 * Hold progress updates ~15×/s, so it lives in its own context: read it with useHoldProgress().
 */
export interface CookingContextValue {
  state: CookingState
  controller: Controller
  dispatch: (action: UiAction) => void
  /** The single hat cam (or the default camera with ?cam=any). Pass it to <CameraView>. */
  camera: HatCam
}

export { CookingContext, HoldProgressContext, NO_HOLD, useCooking, useHoldProgress } from './context.ts'

// ---------- Implementation (TEMPORARY: swap these two lines for Nam's real modules) ----------

export { FakeCookingProvider as CookingProvider } from './fake/FakeCookingProvider.tsx'
export { PANCAKE_RECIPE_TEXT as DEMO_RECIPE_TEXT } from './fake/fixtures.ts'
export { canCheck, canStart, currentStep, filledSteps, gesturesEnabled, isLastStep, scaledIngredients, stepLabel } from './fake/selectors.ts'
