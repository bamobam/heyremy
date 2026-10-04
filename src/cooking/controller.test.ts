import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ParsedRecipe, Verdict } from '../types.ts'
import { createController } from './controller.ts'
import { pancakes } from './fixtures.ts'
import type { ApiClient, CameraPort } from './ports.ts'
import { canStart } from './selectors.ts'
import { cookingReducer, initialState, type Action, type CookingState } from './state.ts'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

const ready: Verdict = { status: 'ready', feedback: 'Looks smooth. Next step.' }
const notReady: Verdict = { status: 'not_ready', feedback: 'Still lumpy. Keep whisking.' }
const unsure: Verdict = { status: 'unsure', feedback: "I can't see the bowl." }

const flush = () => vi.advanceTimersByTimeAsync(0)

/** A promise the test resolves by hand. */
function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function setup({ recipe = pancakes }: { recipe?: ParsedRecipe } = {}) {
  let state: CookingState = initialState('my recipe')
  const dispatch = (a: Action) => {
    state = cookingReducer(state, a)
  }
  let clock = 0

  const api = {
    parseRecipe: vi.fn(async (_text: string) => recipe),
    checkStep: vi.fn(async (_frame: Blob, _step: { text: string; cue: string }, _opts?: { signal?: AbortSignal }) => ready),
  } satisfies ApiClient

  const camera = {
    grabForCheck: vi.fn(async () => ({ blob: new Blob(['jpeg']) })),
    isHolding: vi.fn(() => false),
  } satisfies CameraPort

  const voice = { isSpeaking: vi.fn(() => false) }

  const controller = createController({ getState: () => state, dispatch, api, camera, now: () => clock, voice })

  return {
    controller,
    api,
    camera,
    voice,
    get state() {
      return state
    },
    /** Moves the controller's clock and the timers forward together. */
    async advance(ms: number) {
      clock += ms
      await vi.advanceTimersByTimeAsync(ms)
    },
    setClock: (ms: number) => void (clock = ms),
  }
}

type Harness = ReturnType<typeof setup>

async function onPrep(h = setup()) {
  await h.controller.submitRecipe('pancake recipe')
  return h
}
async function onCooking(h = setup()) {
  await onPrep(h)
  h.controller.start()
  return h
}

describe('submitting a recipe', () => {
  it('parses it and shows the prep screen at the recipe servings', async () => {
    const h = setup()
    await h.controller.submitRecipe('pancake recipe')
    expect(h.api.parseRecipe).toHaveBeenCalledWith('pancake recipe')
    expect(h.state).toMatchObject({ phase: 'prep', recipe: pancakes, servings: 4, error: null })
  })

  it('goes back to the input screen with an error, keeping the text, when the parse fails', async () => {
    const h = setup()
    h.api.parseRecipe.mockRejectedValueOnce(Object.assign(new Error('bad recipe'), { kind: 'unprocessable' }))
    await h.controller.submitRecipe('???')
    expect(h.state).toMatchObject({
      phase: 'input',
      recipeText: 'my recipe',
      error: { kind: 'unprocessable', message: 'bad recipe' },
    })
  })

  it('reports an unknown error for something that is not an API error', async () => {
    const h = setup()
    h.api.parseRecipe.mockRejectedValueOnce(new TypeError('boom'))
    await h.controller.submitRecipe('x')
    expect(h.state.error).toMatchObject({ kind: 'unknown' })
  })

  it('ignores the result if the cook started over while it was parsing', async () => {
    const h = setup()
    const slow = deferred<ParsedRecipe>()
    h.api.parseRecipe.mockReturnValueOnce(slow.promise)
    const submitted = h.controller.submitRecipe('pancake recipe')
    await flush()
    h.controller.restart()
    slow.resolve(pancakes)
    await submitted
    expect(h.state.phase).toBe('input')
  })
})

describe('the prep screen', () => {
  it('can start cooking straight away, with nothing to wait for', async () => {
    const h = await onPrep()
    expect(canStart(h.state)).toBe(true)
  })

  it('changes the servings', async () => {
    const h = await onPrep()
    h.controller.setServings(2)
    expect(h.state.servings).toBe(2)
    expect(canStart(h.state)).toBe(true)
  })

  it('does nothing to the servings once cooking has started', async () => {
    const h = await onCooking()
    h.controller.setServings(2)
    expect(h.state.servings).toBe(4)
  })

  it('starts at the first step', async () => {
    const h = await onPrep()
    h.controller.start()
    expect(h.state).toMatchObject({ phase: 'cooking', stepIndex: 0, mode: 'idle' })
  })

  it('does nothing when started from any other screen', () => {
    const h = setup()
    h.controller.start()
    expect(h.state.phase).toBe('input')
  })
})

describe('moving between steps', () => {
  it('goes to the next step', async () => {
    const h = await onCooking()
    await h.controller.onGesture({ intent: 'next', at: 0 })
    expect(h.state.stepIndex).toBe(1)
  })

  it('goes back a step', async () => {
    const h = await onCooking()
    await h.controller.onGesture({ intent: 'next', at: 0 })
    await h.controller.onGesture({ intent: 'next', at: 0 })
    await h.controller.onGesture({ intent: 'back', at: 0 })
    expect(h.state.stepIndex).toBe(1)
  })

  it('stays on the first step when going back from it', async () => {
    const h = await onCooking()
    await h.controller.onGesture({ intent: 'back', at: 0 })
    expect(h.state.stepIndex).toBe(0)
  })

  it('finishes after the last step', async () => {
    const h = await onCooking()
    for (let i = 0; i < 5; i++) await h.controller.onGesture({ intent: 'next', at: 0 })
    expect(h.state.phase).toBe('done')
  })

  it('ignores gestures outside cooking', async () => {
    const h = await onPrep()
    await h.controller.onGesture({ intent: 'next', at: 0 })
    expect(h.state.phase).toBe('prep')
  })
})

describe('checking a step', () => {
  it('takes the photo, sends it with the step, and shows the verdict', async () => {
    const h = await onCooking()
    await h.controller.onGesture({ intent: 'check', at: 0 })

    expect(h.camera.grabForCheck).toHaveBeenCalledTimes(1)
    expect(h.api.checkStep).toHaveBeenCalledWith(
      expect.any(Blob),
      { text: 'Whisk 1 cup flour, 1 cup milk and 2 eggs into a batter.', cue: 'Batter is smooth with no dry flour streaks' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(h.state).toMatchObject({ mode: 'verdict', verdict: ready })
    expect(h.state.stats.checks).toBe(1)
  })

  it('sends the step text at the chosen servings', async () => {
    const h = await onPrep()
    h.controller.setServings(2)
    h.controller.start()
    await h.controller.onGesture({ intent: 'check', at: 0 })
    expect(h.api.checkStep.mock.calls[0][1].text).toBe('Whisk ½ cup flour, ½ cup milk and 1 egg into a batter.')
  })

  it('shows the state as checking while the photo and verdict are pending', async () => {
    const h = await onCooking()
    const pending = deferred<Verdict>()
    h.api.checkStep.mockReturnValueOnce(pending.promise)
    const checked = h.controller.onGesture({ intent: 'check', at: 0 })
    await flush()
    expect(h.state.mode).toBe('checking')
    pending.resolve(notReady)
    await checked
    expect(h.state.mode).toBe('verdict')
  })

  it('ignores gestures while a check is running', async () => {
    const h = await onCooking()
    const pending = deferred<Verdict>()
    h.api.checkStep.mockReturnValueOnce(pending.promise)
    const checked = h.controller.onGesture({ intent: 'check', at: 0 })
    await flush()

    await h.controller.onGesture({ intent: 'next', at: 0 })
    await h.controller.onGesture({ intent: 'check', at: 0 })
    expect(h.state.stepIndex).toBe(0)
    expect(h.camera.grabForCheck).toHaveBeenCalledTimes(1)

    pending.resolve(ready)
    await checked
  })

  it('does not check a step that has no visual cue', async () => {
    const h = await onCooking()
    await h.controller.onGesture({ intent: 'next', at: 0 })
    await h.controller.onGesture({ intent: 'next', at: 0 }) // "Pour a ladle of batter": no cue
    await h.controller.onGesture({ intent: 'check', at: 0 })
    expect(h.state.mode).toBe('idle')
    expect(h.camera.grabForCheck).not.toHaveBeenCalled()
  })

  it.each([
    ['not ready', notReady],
    ['unsure', unsure],
  ])('shows a %s verdict and does not move on by itself', async (_name, verdict) => {
    const h = await onCooking()
    h.api.checkStep.mockResolvedValueOnce(verdict)
    await h.controller.onGesture({ intent: 'check', at: 0 })
    await h.advance(10_000)
    expect(h.state).toMatchObject({ stepIndex: 0, mode: 'verdict', verdict })
  })

  it('can check again from a verdict', async () => {
    const h = await onCooking()
    h.api.checkStep.mockResolvedValueOnce(notReady).mockResolvedValueOnce(ready)
    await h.controller.onGesture({ intent: 'check', at: 0 })
    await h.controller.onGesture({ intent: 'check', at: 0 })
    expect(h.api.checkStep).toHaveBeenCalledTimes(2)
    expect(h.state).toMatchObject({ mode: 'verdict', verdict: ready })
    expect(h.state.stats.checks).toBe(2)
  })

  it('goes back to idle with an error if the check fails', async () => {
    const h = await onCooking()
    h.api.checkStep.mockRejectedValueOnce(Object.assign(new Error('slow'), { kind: 'timeout' }))
    await h.controller.onGesture({ intent: 'check', at: 0 })
    expect(h.state).toMatchObject({ mode: 'idle', error: { kind: 'timeout' } })
  })

  it('goes back to idle with a camera error if the photo cannot be taken', async () => {
    const h = await onCooking()
    h.camera.grabForCheck.mockRejectedValueOnce(new Error('camera_unavailable'))
    await h.controller.onGesture({ intent: 'check', at: 0 })
    expect(h.state).toMatchObject({ mode: 'idle', error: { kind: 'camera' } })
    expect(h.api.checkStep).not.toHaveBeenCalled()
  })

  it('drops a verdict that arrives after the cook has started over', async () => {
    const h = await onCooking()
    const pending = deferred<Verdict>()
    h.api.checkStep.mockReturnValueOnce(pending.promise)
    const checked = h.controller.onGesture({ intent: 'check', at: 0 })
    await flush()

    h.controller.restart()
    pending.resolve(ready)
    await checked
    expect(h.state.phase).toBe('input')
  })

  it('cancels the request in flight when the cook starts over', async () => {
    const h = await onCooking()
    let signal: AbortSignal | undefined
    h.api.checkStep.mockImplementationOnce((_f, _s, opts) => {
      signal = opts?.signal
      return new Promise(() => {})
    })
    void h.controller.onGesture({ intent: 'check', at: 0 })
    await flush()
    expect(signal?.aborted).toBe(false)
    h.controller.restart()
    expect(signal?.aborted).toBe(true)
  })

  it('stays quiet about a request that was cancelled', async () => {
    const h = await onCooking()
    h.api.checkStep.mockImplementationOnce(
      (_f, _s, opts) =>
        new Promise((_res, rej) =>
          opts?.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { kind: 'aborted' }))),
        ),
    )
    const checked = h.controller.onGesture({ intent: 'check', at: 0 })
    await flush()
    h.controller.restart()
    await checked
    expect(h.state.error).toBeNull()
  })
})

describe('moving on by itself after a ready verdict', () => {
  async function afterReadyVerdict(): Promise<Harness> {
    const h = await onCooking()
    h.setClock(1000)
    await h.controller.onGesture({ intent: 'check', at: 0 }) // the verdict lands "now" = 1000
    return h
  }

  it('moves to the next step 2 s after the verdict', async () => {
    const h = await afterReadyVerdict()
    expect(h.state.autoAdvanceAt).toBe(3000)
    await h.advance(1900)
    expect(h.state.stepIndex).toBe(0)
    await h.advance(200)
    expect(h.state).toMatchObject({ stepIndex: 1, mode: 'idle', verdict: null })
  })

  it('stays on the step if the cook gestures back in time, leaving the verdict up', async () => {
    const h = await afterReadyVerdict()
    await h.advance(500)
    await h.controller.onGesture({ intent: 'back', at: 0 })
    expect(h.state).toMatchObject({ stepIndex: 0, mode: 'verdict', autoAdvanceAt: null })
    await h.advance(10_000)
    expect(h.state).toMatchObject({ stepIndex: 0, mode: 'verdict' })
  })

  it('does not move on twice if the cook moves on first', async () => {
    const h = await afterReadyVerdict()
    await h.advance(500)
    await h.controller.onGesture({ intent: 'next', at: 0 })
    expect(h.state.stepIndex).toBe(1)
    await h.advance(10_000)
    expect(h.state.stepIndex).toBe(1)
  })

  it('waits while a gesture is being held, so a thumbs-down has its full second', async () => {
    const h = await afterReadyVerdict() // due at 3000
    let holding = true
    h.camera.isHolding.mockImplementation(() => holding)

    await h.advance(2500) // now 3500, past the deadline, but a gesture was held the whole time
    expect(h.state.stepIndex).toBe(0)

    holding = false
    await h.advance(500)
    expect(h.state.stepIndex).toBe(0)
    await h.advance(2500) // the deadline slid back by the time spent holding, then passes
    expect(h.state.stepIndex).toBe(1)
  })

  it('waits for Remy to finish speaking the verdict, then counts its full 2 s', async () => {
    const h = await afterReadyVerdict() // due at 3000
    let speaking = true
    h.voice.isSpeaking.mockImplementation(() => speaking)

    await h.advance(3000) // the verdict is still being read out well past the deadline
    expect(h.state.stepIndex).toBe(0)
    expect(h.state.autoAdvanceAt).toBeGreaterThan(5000) // pushed back, so the on-screen countdown froze too

    speaking = false
    await h.advance(1500)
    expect(h.state.stepIndex).toBe(0) // the countdown resumes where it paused, not from zero
    await h.advance(1000)
    expect(h.state.stepIndex).toBe(1)
  })

  it('stops its timer when the cook starts over', async () => {
    const h = await afterReadyVerdict()
    h.controller.restart()
    await h.advance(10_000)
    expect(h.state.phase).toBe('input')
  })

  it('stops its timer when the controller is disposed', async () => {
    const h = await afterReadyVerdict()
    h.controller.dispose()
    await h.advance(10_000)
    expect(h.state.stepIndex).toBe(0)
  })
})

describe('starting over', () => {
  it('returns to the input screen with the text', async () => {
    const h = await onCooking()
    h.controller.restart()
    expect(h.state).toEqual(initialState('my recipe'))
  })
})
