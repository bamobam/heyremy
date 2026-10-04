// TEMPORARY (fake): a working cooking state and controller so the §9 UI can be built and demoed
// before Nam's cooking/reducer.ts, selectors.ts and controller.ts land. The reducer below follows
// §6.2/§6.3 and the flows follow §6.8, but the API is faked (./fakeApi.ts) while the camera and the
// audio module are the real ones. When Nam's modules arrive, delete this folder and point the two
// re-exports at the bottom of contract.ts at them; nothing above the seam changes.
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { grabSharpestFrame } from '../../camera/grabSharpestFrame.ts'
import { useHatCam } from '../../camera/useHatCam.ts'
import { useGestures } from '../../camera/useGestures.ts'
import { createAudioPlayer } from '../../audio/player.ts'
import { clipCache } from '../../audio/clipCache.ts'
import { useAnyCam, USE_ANY_CAMERA } from '../../ui/useAnyCam.ts'
import type { GestureEvent, ParsedRecipe } from '../../types.ts'
import { CookingContext, HoldProgressContext, type Controller, type CookingContextValue, type UiAction } from '../contract.ts'
import { currentStep, gesturesEnabled } from './selectors.ts'
import { fakeReducer, initialState } from './reducer.ts'
import { fillPlaceholders, stepClipId } from './scaling.ts'
import { fakeApi, SILENT_WAV } from './fakeApi.ts'
import { SAY } from '../../ui/say.ts'
import { FIXED_CLIP_IDS } from './fixtures.ts'

// Chosen once at load, so the hook order never changes between renders (?cam=any skips the hat cam).
const useCamera = USE_ANY_CAMERA ? useAnyCam : useHatCam

const wait = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms))

/** How long a check waits for the hand to leave the frame before grabbing (§6.8 checkFlow). */
const HAND_OUT_MS = 1500
/** How often the auto-advance loop wakes (§6.8 Auto-advance). */
const ADVANCE_TICK_MS = 100

/** Every clip the recipe needs at these servings: the fixed ones, plus one per step (§6.8 voiceFlow). */
function wantedClips(recipe: ParsedRecipe, servings: number): { id: string; text: string }[] {
  const fixed = FIXED_CLIP_IDS.map(id => ({ id, text: '' }))
  const factor = recipe.servings > 0 ? servings / recipe.servings : 1
  const steps = recipe.steps.map(step => ({
    id: stepClipId(step, servings),
    text: fillPlaceholders(step.spoken, recipe.ingredients, factor, 'spoken'),
  }))
  return [...fixed, ...steps]
}

/** What the browser speaks if a step's clip is missing, so the step is never silent. */
function stepSpeech(recipe: ParsedRecipe | null, step: ParsedRecipe['steps'][number], servings: number): string {
  if (!recipe) return step.spoken
  const factor = recipe.servings > 0 ? servings / recipe.servings : 1
  return fillPlaceholders(step.spoken, recipe.ingredients, factor, 'spoken')
}

export function FakeCookingProvider({ children }: { children: React.ReactNode }) {
  const [state, rawDispatch] = useReducer(fakeReducer, undefined, initialState)

  // Flows read the newest state through this ref, so a gesture never acts on a stale closure.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  })

  const audio = useMemo(() => createAudioPlayer({ speak: text => fakeApi.speak(text) }), [])
  const camera = useCamera()
  const gesturesEnabledNow = gesturesEnabled(state)

  const handVisible = useRef(false)
  const holding = useRef(false)

  const timers = useRef<Set<number>>(new Set())
  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms)
    timers.current.add(id)
    return id
  }, [])
  const clearTimers = useCallback(() => {
    timers.current.forEach(id => {
      clearTimeout(id)
      clearInterval(id)
    })
    timers.current.clear()
  }, [])
  useEffect(() => clearTimers, [clearTimers])

  /** Bumped by every voiceFlow; results from an older run are dropped. */
  const voiceRun = useRef(0)

  const voiceFlow = useCallback(
    async (servings: number, recipe: ParsedRecipe) => {
      const run = ++voiceRun.current
      const clips = wantedClips(recipe, servings)
      rawDispatch({ type: 'voicingStarted', servings, total: clips.length })
      for (const clip of clips) {
        try {
          // The fixed clips ("looking", "done") have no text to speak: they are just cached.
          const blob = clip.text ? await fakeApi.speak(clip.text) : SILENT_WAV
          if (run !== voiceRun.current) return
          audio.preload(clip.id, blob)
          rawDispatch({ type: 'clipReady', id: clip.id, servings })
        } catch (e) {
          if (run !== voiceRun.current) return
          rawDispatch({
            type: 'voicingFailed',
            error: { kind: 'upstream', message: e instanceof Error ? e.message : 'Could not prepare the voice.' },
          })
          return
        }
      }
    },
    [audio],
  )

  const submitRecipe = useCallback(
    async (text: string) => {
      rawDispatch({ type: 'parseStarted' })
      try {
        const recipe = await fakeApi.parseRecipe(text)
        rawDispatch({ type: 'parseSucceeded', recipe })
        await voiceFlow(recipe.servings, recipe)
      } catch (e) {
        rawDispatch({
          type: 'parseFailed',
          error: { kind: 'upstream', message: e instanceof Error ? e.message : 'Could not read that recipe.' },
        })
      }
    },
    [voiceFlow],
  )

  const setServings = useCallback(
    (n: number) => {
      const recipe = stateRef.current.recipe
      if (!recipe) return
      rawDispatch({ type: 'servingsChanged', servings: n })
      // Debounced, so holding the stepper down doesn't start a run per click (§6.8).
      later(() => void voiceFlow(stateRef.current.servings, recipe), 600)
    },
    [later, voiceFlow],
  )

  const retryVoicing = useCallback(() => {
    const recipe = stateRef.current.recipe
    if (recipe) void voiceFlow(stateRef.current.servings, recipe)
  }, [voiceFlow])

  /** gestureNext / gestureBack, plus the clip for the step we land on. From cache, never the network (§1). */
  const navigate = useCallback(
    (action: 'gestureNext' | 'gestureBack') => {
      // 👎 during a ready countdown only cancels it: the step stays and its clip is not replayed (§6.5).
      const cancelsCountdown = action === 'gestureBack' && stateRef.current.autoAdvanceAt !== null
      clearTimers()
      if (cancelsCountdown) {
        rawDispatch({ type: action })
        return
      }
      audio.stop()
      rawDispatch({ type: action })
      later(() => {
        const s = stateRef.current
        if (s.phase === 'done') {
          void audio.play('done', SAY.done)
          return
        }
        const step = s.recipe?.steps[s.stepIndex]
        if (step) void audio.play(stepClipId(step, s.servings), stepSpeech(s.recipe, step, s.servings))
      }, 0)
    },
    [audio, clearTimers, later],
  )

  const check = useCallback(async () => {
    const before = stateRef.current
    const step = currentStep(before)
    if (before.phase !== 'cooking' || before.mode === 'checking' || !step?.checkable) return
    const requestId = before.requestId + 1 // what checkStarted bumps it to
    const video = camera.video

    rawDispatch({ type: 'checkStarted' })
    void audio.play('looking', SAY.look)

    const startedAt = performance.now()
    while (handVisible.current && performance.now() - startedAt < HAND_OUT_MS) await wait(100)

    let blob: Blob
    try {
      if (!video) throw new Error('The hat cam is not ready yet.')
      blob = (await grabSharpestFrame(video)).blob
    } catch (e) {
      rawDispatch({ type: 'checkFailed', requestId, error: { kind: 'camera', message: e instanceof Error ? e.message : 'Could not grab a photo.' } })
      return
    }

    let verdict
    try {
      verdict = await fakeApi.checkStep(blob, step.text, step.cue ?? '')
    } catch (e) {
      rawDispatch({ type: 'checkFailed', requestId, error: { kind: 'upstream', message: e instanceof Error ? e.message : 'Could not check that.' } })
      return
    }
    // The cook moved on while the check was running: drop it (§6.8 checkFlow).
    if (stateRef.current.requestId !== requestId) return

    rawDispatch({ type: 'checkSucceeded', requestId, verdict, now: performance.now() })
    void audio.speakLive(verdict.feedback)
    if (verdict.status !== 'ready') return

    // Auto-advance. A hold in progress pushes the deadline back, or the 1 s 👎 hold would never
    // fit inside the 2 s window (§6.8).
    const tick = window.setInterval(() => {
      const s = stateRef.current
      if (s.requestId !== requestId || s.autoAdvanceAt === null) {
        clearInterval(tick)
        timers.current.delete(tick)
        return
      }
      if (holding.current) {
        rawDispatch({ type: 'checkSucceeded', requestId, verdict, now: s.autoAdvanceAt + ADVANCE_TICK_MS })
        return
      }
      if (performance.now() >= s.autoAdvanceAt) {
        clearInterval(tick)
        timers.current.delete(tick)
        navigate('gestureNext')
      }
    }, ADVANCE_TICK_MS)
    timers.current.add(tick)
  }, [audio, camera.video, navigate])

  const startCooking = useCallback(() => {
    void audio.unlock() // must happen inside the click that started cooking
    rawDispatch({ type: 'startCooking' })
    later(() => {
      const s = stateRef.current
      const step = s.recipe?.steps[0]
      if (step) void audio.play(stepClipId(step, s.servings), stepSpeech(s.recipe, step, s.servings))
    }, 0)
  }, [audio, later])

  const onGesture = useCallback(
    (e: GestureEvent) => {
      const s = stateRef.current
      if (s.phase !== 'cooking' || s.mode === 'checking') return
      if (e.intent === 'check') void check()
      else navigate(e.intent === 'next' ? 'gestureNext' : 'gestureBack')
    },
    [check, navigate],
  )

  // useGestures takes a stable callback, so hand it one that always calls the current flow.
  const onGestureRef = useRef(onGesture)
  useEffect(() => {
    onGestureRef.current = onGesture
  })
  const handleGesture = useCallback((e: GestureEvent) => onGestureRef.current(e), [])

  const gestures = useGestures(camera.video, { enabled: gesturesEnabledNow, onGesture: handleGesture })

  // Keyboard stand-in for gestures (N = 👍 next, B = 👎 back, Space = ✋ check), so the app can be
  // driven without a working hat cam. Ignored while typing in a field.
  useEffect(() => {
    if (!gesturesEnabledNow) return
    const keys: Record<string, GestureEvent['intent']> = { n: 'next', b: 'back', ' ': 'check' }
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable]')) return
      const intent = keys[e.key.toLowerCase()]
      if (!intent) return
      e.preventDefault()
      handleGesture({ intent, at: performance.now() })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [gesturesEnabledNow, handleGesture])
  useEffect(() => {
    handVisible.current = gestures.handVisible
    holding.current = gestures.holdProgress.intent !== null
  })

  const dispatch = useCallback((action: UiAction) => rawDispatch(action), [])
  const restart = useCallback(() => {
    clearTimers()
    voiceRun.current++ // drops a voice run still in flight
    audio.stop()
    clipCache.clear()
    rawDispatch({ type: 'restart' })
  }, [audio, clearTimers])

  const controller = useMemo<Controller>(
    () => ({ submitRecipe, setServings, retryVoicing, start: startCooking, onGesture, restart }),
    [submitRecipe, setServings, retryVoicing, startCooking, onGesture, restart],
  )

  const value = useMemo<CookingContextValue>(
    () => ({ state, controller, dispatch, camera }),
    [state, controller, dispatch, camera],
  )

  return (
    <CookingContext.Provider value={value}>
      <HoldProgressContext.Provider value={gestures.holdProgress}>{children}</HoldProgressContext.Provider>
    </CookingContext.Provider>
  )
}