// Wires Nam's pieces into one provider (§6.9): his reducer and controller, his useCamera, and the API
// client. His controller has no audio, so Remy's voice (§8) is added here, around it: the voice flow
// that caches the clips, and the clips that play as the state changes.
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { createApi } from '../api/index.ts'
import { clipCache } from '../audio/clipCache.ts'
import { createAudioPlayer } from '../audio/player.ts'
import { speak } from '../audio/speak.ts'
import { useCamera } from '../camera/useCamera.ts'
import { SAY } from '../ui/say.ts'
import { USE_ANY_CAMERA, useAnyCam } from '../ui/useAnyCam.ts'
import type { GestureEvent, ParsedRecipe } from '../types.ts'
import { createController, toAppError } from './controller.ts'
import type { CameraPort } from './ports.ts'
import { fillPlaceholders, scaleFactor, stepClipId } from './scaling.ts'
import { currentStep, gesturesEnabled } from './selectors.ts'
import { cookingReducer, initialState, type Action } from './state.ts'
import { CookingContext, HoldProgressContext } from './context.ts'
import type { Controller, CookingContextValue, UiAction } from './contract.ts'

/** Clips with no text of their own: the fixed lines are spoken from SAY when they play. */
const FIXED_CLIPS = [
  { id: 'looking', text: SAY.look },
  { id: 'done', text: SAY.done },
]

/** Changing servings waits this long before voicing again, so holding + doesn't start a run per click (§6.8). */
const REVOICE_DEBOUNCE_MS = 600
/** How many clips are made at once (§6.8). */
const VOICE_CONCURRENCY = 2

/** Every clip the recipe needs at these servings. */
function wantedClips(recipe: ParsedRecipe, servings: number): { id: string; text: string }[] {
  const factor = scaleFactor(servings, recipe.servings)
  const steps = recipe.steps.map(step => ({
    id: stepClipId(step, servings),
    text: fillPlaceholders(step.spoken, recipe.ingredients, factor, 'spoken'),
  }))
  return [...FIXED_CLIPS, ...steps]
}

export function CookingProvider({ children }: { children: React.ReactNode }) {
  const [state, rawDispatch] = useReducer(cookingReducer, undefined, () => initialState())

  // The controller reads state straight after it dispatches, so the ref is updated in the same call
  // (the reducer is pure, so applying it here as well as in React gives the same state).
  const stateRef = useRef(state)
  const dispatch = useCallback((action: Action) => {
    stateRef.current = cookingReducer(stateRef.current, action)
    rawDispatch(action)
  }, [])

  const api = useMemo(() => createApi(), [])
  const audio = useMemo(() => createAudioPlayer({ speak }), [])

  // The latest gesture handler, so the camera is handed one stable callback.
  const gestureRef = useRef<(e: GestureEvent) => void>(() => {})
  const camera = useCamera({
    enabled: state.phase === 'cooking',
    paused: state.mode === 'checking',
    onGesture: useCallback((e: GestureEvent) => gestureRef.current(e), []),
    source: USE_ANY_CAMERA ? useAnyCam : undefined,
  })

  // The controller sees the camera through two functions that always read the newest one.
  const cameraRef = useRef(camera)
  useEffect(() => {
    cameraRef.current = camera
  })
  const flow = useMemo(() => {
    const port: CameraPort = {
      grabForCheck: () => cameraRef.current.grabForCheck(),
      isHolding: () => cameraRef.current.holdProgress.intent !== null,
    }
    return createController({ getState: () => stateRef.current, dispatch, api, camera: port, now: () => performance.now() })
  }, [api, dispatch])
  useEffect(() => () => flow.dispose(), [flow])

  // ---------- Voice (§6.8 voiceFlow) ----------

  /** Bumped by every voice run and by restart; a run that is no longer the latest drops its results. */
  const voiceRun = useRef(0)
  const revoiceTimer = useRef<number | null>(null)

  const voiceFlow = useCallback(async () => {
    const { recipe, servings } = stateRef.current
    if (!recipe) return
    const run = ++voiceRun.current
    const clips = wantedClips(recipe, servings)
    dispatch({ type: 'voicingStarted', servings, total: clips.length })

    const queue = [...clips]
    let failed = false
    const worker = async () => {
      for (let clip = queue.shift(); clip && !failed; clip = queue.shift()) {
        try {
          // A clip already made for these servings is reused: 4 → 2 → 4 costs nothing.
          if (!clipCache.has(clip.id)) audio.preload(clip.id, await speak(clip.text))
          if (run !== voiceRun.current) return
          dispatch({ type: 'clipReady', id: clip.id, servings })
        } catch (error) {
          if (run !== voiceRun.current) return
          failed = true
          dispatch({ type: 'voicingFailed', error: toAppError(error) })
        }
      }
    }
    await Promise.all(Array.from({ length: VOICE_CONCURRENCY }, worker))
  }, [audio, dispatch])

  // ---------- Controller: Nam's flows plus the voice ----------

  const playStep = useCallback(() => {
    const s = stateRef.current
    const step = s.recipe?.steps[s.stepIndex]
    const shown = currentStep(s)
    if (step && shown) void audio.play(stepClipId(step, s.servings), shown.spoken)
  }, [audio])

  const controller = useMemo<Controller>(
    () => ({
      ...flow,

      async submitRecipe(text) {
        await flow.submitRecipe(text)
        if (stateRef.current.phase === 'prep') void voiceFlow()
      },

      setServings(n) {
        flow.setServings(n)
        if (revoiceTimer.current !== null) clearTimeout(revoiceTimer.current)
        revoiceTimer.current = window.setTimeout(() => void voiceFlow(), REVOICE_DEBOUNCE_MS)
      },

      retryVoicing() {
        dispatch({ type: 'errorDismissed' })
        void voiceFlow()
      },

      start() {
        void audio.unlock() // must happen inside the click that started cooking
        flow.start()
      },

      async onGesture(e) {
        const before = stateRef.current
        await flow.onGesture(e)
        // 👎 on the first step changes nothing, but the cook still wants it repeated (§6.8 navigateFlow).
        const after = stateRef.current
        if (e.intent === 'back' && after.phase === 'cooking' && after.stepIndex === 0 && after.stepIndex === before.stepIndex && before.mode === 'idle') {
          void playStep()
        }
      },

      restart() {
        if (revoiceTimer.current !== null) clearTimeout(revoiceTimer.current)
        voiceRun.current++ // drops a voice run still in flight
        audio.stop()
        clipCache.clear()
        flow.restart()
      },
    }),
    [flow, voiceFlow, audio, playStep],
  )
  useEffect(() => () => {
    if (revoiceTimer.current !== null) clearTimeout(revoiceTimer.current)
  }, [])

  // ---------- Voice: what plays as the state changes ----------

  // A new step (or the first one) is read aloud, from the cache, never the network (§1).
  const { phase, stepIndex, mode, verdict } = state
  useEffect(() => {
    if (phase === 'cooking') {
      audio.stop()
      playStep()
    } else if (phase === 'done') {
      audio.stop()
      void audio.play('done', SAY.done)
    }
  }, [phase, stepIndex, audio, playStep])

  // A check: "hold still" while it looks, then the verdict in Remy's voice.
  useEffect(() => {
    if (mode === 'checking') void audio.play('looking', SAY.look)
    else if (mode === 'verdict' && verdict) void audio.speakLive(verdict.feedback)
  }, [mode, verdict, audio])

  // ---------- Gestures: the camera's, plus the keyboard as a stand-in (N next, B back, Space check) ----------

  useEffect(() => {
    gestureRef.current = e => void controller.onGesture(e)
  })
  const keysOn = gesturesEnabled(state)
  useEffect(() => {
    if (!keysOn) return
    const keys: Record<string, GestureEvent['intent']> = { n: 'next', b: 'back', ' ': 'check' }
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable]')) return
      const intent = keys[e.key.toLowerCase()]
      if (!intent) return
      e.preventDefault()
      gestureRef.current({ intent, at: performance.now() })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [keysOn])

  const uiDispatch = useCallback((action: UiAction) => dispatch(action), [dispatch])

  const value = useMemo<CookingContextValue>(
    () => ({ state, controller, dispatch: uiDispatch, camera }),
    [state, controller, uiDispatch, camera],
  )

  return (
    <CookingContext.Provider value={value}>
      <HoldProgressContext.Provider value={camera.holdProgress}>{children}</HoldProgressContext.Provider>
    </CookingContext.Provider>
  )
}
