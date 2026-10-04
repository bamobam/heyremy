// Runs the flows: parse a recipe, move between steps on gestures, check a step
// with a photo, and move on by itself after a "ready" verdict. This is the only
// place with side effects; everything it needs comes in through `deps`, so tests
// use fakes. `getState` must reflect a dispatch straight away.
//
// Audio is not here yet: the verdict and the steps are shown on screen only.

import type { ApiErrorKind, GestureEvent } from '../types.ts'
import type { ApiClient, CameraPort } from './ports.ts'
import { canCheck, canStart, currentStep, gesturesEnabled, isAutoAdvanceDue } from './selectors.ts'
import type { Action, AppError, CookingState } from './state.ts'

export interface ControllerDeps {
  getState(): CookingState
  dispatch(action: Action): void
  api: ApiClient
  camera: CameraPort
  /** Milliseconds, on the same clock the "ready" countdown is set with. */
  now(): number
}

export interface Controller {
  /** Parse the recipe and show the prep screen. */
  submitRecipe(text: string): Promise<void>
  /** Prep screen only. */
  setServings(servings: number): void
  /** Prep screen only; does nothing unless Start is allowed. */
  start(): void
  /** A gesture that has been held long enough. Resolves when what it started is done. */
  onGesture(event: GestureEvent): Promise<void>
  restart(): void
  /** Stop timers and cancel anything in flight, e.g. when the screen goes away. */
  dispose(): void
}

/** How often a "ready" countdown is checked. */
const TICK_MS = 100

const API_ERROR_KINDS = new Set<string>(['bad_request', 'unprocessable', 'upstream', 'rate_limited', 'timeout', 'aborted', 'unknown'])

/** Whatever was thrown, as an error the state can hold. */
export function toAppError(error: unknown): AppError {
  if (typeof error === 'object' && error !== null && 'kind' in error && typeof error.kind === 'string' && API_ERROR_KINDS.has(error.kind)) {
    const message = error instanceof Error ? error.message : error.kind
    return { kind: error.kind as ApiErrorKind, message }
  }
  return { kind: 'unknown', message: 'Something went wrong.' }
}

export function createController({ getState, dispatch, api, camera, now }: ControllerDeps): Controller {
  let checkAbort: AbortController | null = null
  let autoAdvance: ReturnType<typeof setInterval> | null = null

  const cancelCheck = () => {
    checkAbort?.abort()
    checkAbort = null
  }
  const stopAutoAdvance = () => {
    if (autoAdvance !== null) clearInterval(autoAdvance)
    autoAdvance = null
  }

  async function submitRecipe(text: string) {
    dispatch({ type: 'parseStarted' })
    if (getState().phase !== 'parsing') return
    try {
      const recipe = await api.parseRecipe(text)
      dispatch({ type: 'parseSucceeded', recipe }) // ignored if the cook started over meanwhile
    } catch (error) {
      dispatch({ type: 'parseFailed', error: toAppError(error) })
    }
  }

  function navigate(intent: 'next' | 'back') {
    const before = getState()
    // While a "ready" countdown runs, back only cancels it; the countdown timer notices and stops.
    if (intent === 'back' && before.mode === 'verdict' && before.autoAdvanceAt !== null) {
      dispatch({ type: 'gestureBack' })
      return
    }
    cancelCheck()
    stopAutoAdvance()
    dispatch({ type: intent === 'next' ? 'gestureNext' : 'gestureBack' })
  }

  /** After a "ready" verdict, move on 2 s later, unless the cook gestures back, or is mid-gesture. */
  function startAutoAdvance(id: number) {
    stopAutoAdvance()
    let heldMs = 0
    autoAdvance = setInterval(() => {
      const s = getState()
      if (s.requestId !== id || s.mode !== 'verdict' || s.autoAdvanceAt === null) return stopAutoAdvance()
      // A gesture being held pauses the countdown: a thumbs-down takes a second of the two.
      if (camera.isHolding()) {
        heldMs += TICK_MS
        return
      }
      if (isAutoAdvanceDue(s, now() - heldMs)) {
        stopAutoAdvance()
        navigate('next')
      }
    }, TICK_MS)
  }

  async function check() {
    if (!canCheck(getState())) return
    stopAutoAdvance()
    cancelCheck()
    dispatch({ type: 'checkStarted' })

    const started = getState()
    const step = currentStep(started)
    if (started.mode !== 'checking' || !step) return
    const id = started.requestId
    const abort = new AbortController()
    checkAbort = abort
    const stale = () => abort.signal.aborted || getState().requestId !== id

    let frame: { blob: Blob }
    try {
      frame = await camera.grabForCheck()
    } catch {
      if (stale()) return
      dispatch({ type: 'checkFailed', requestId: id, error: { kind: 'camera', message: 'Camera not ready. Try again.' } })
      return
    }

    try {
      const verdict = await api.checkStep(frame.blob, { text: step.text, cue: step.cue ?? '' }, { signal: abort.signal })
      if (stale()) return
      dispatch({ type: 'checkSucceeded', requestId: id, verdict, now: now() })
      if (verdict.status === 'ready') startAutoAdvance(id)
    } catch (error) {
      const appError = toAppError(error)
      if (stale() || appError.kind === 'aborted') return
      dispatch({ type: 'checkFailed', requestId: id, error: appError })
    } finally {
      if (checkAbort === abort) checkAbort = null
    }
  }

  return {
    submitRecipe,

    setServings: (servings) => dispatch({ type: 'servingsChanged', servings }),

    start() {
      if (canStart(getState())) dispatch({ type: 'startCooking' })
    },

    async onGesture(event) {
      if (!gesturesEnabled(getState())) return
      if (event.intent === 'check') await check()
      else navigate(event.intent)
    },

    restart() {
      cancelCheck()
      stopAutoAdvance()
      dispatch({ type: 'restart' })
    },

    dispose() {
      cancelCheck()
      stopAutoAdvance()
    },
  }
}
