// A stand-in for the backend, so the app can run before the real endpoints exist.
// Development only.

import { pancakes } from '../cooking/fixtures.ts'
import type { ApiClient } from '../cooking/ports.ts'
import { DEFAULT_PERSONA } from '../cooking/settings.ts'
import type { PersonaId, Verdict } from '../types.ts'
import { ApiError } from './errors.ts'

// What each Persona would say. The server words the real verdict in character; this shows the same on ?mock.
const FEEDBACK: Record<PersonaId, Record<Verdict['status'], string>> = {
  remy: {
    not_ready: 'Still some dry flour streaks. Keep whisking.',
    unsure: "I can't see the bowl. Tilt your head down.",
    ready: 'Looks smooth. Next step.',
  },
  grandma: {
    not_ready: 'Not quite yet, dear. A little more whisking.',
    unsure: "I can't see the bowl, dear. Tilt your head down.",
    ready: 'Lovely and smooth, dear. On we go.',
  },
  sergeant: {
    not_ready: 'Not yet, cook! Keep whisking!',
    unsure: "Can't see the bowl! Head down!",
    ready: 'Smooth. Good. Move on.',
  },
}

export interface MockOptions {
  /** How long each call takes. Default 800 ms. */
  delayMs?: number
  /** The verdicts to give, in turn, then around again. Default: not ready, unsure, ready. */
  verdicts?: Verdict['status'][]
  /** Fail every call, like a backend that is down. */
  fail?: boolean
}

/** Waits `ms`, or throws as aborted if the signal fires first. */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new ApiError('aborted'))
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new ApiError('aborted'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export function createMockApi({ delayMs = 800, verdicts = ['not_ready', 'unsure', 'ready'], fail = false }: MockOptions = {}): ApiClient {
  let checks = 0
  return {
    async parseRecipe() {
      await wait(delayMs)
      if (fail) throw new ApiError('upstream')
      return structuredClone(pancakes)
    },

    async checkStep(_frame, _step, opts) {
      await wait(delayMs, opts?.signal)
      if (fail) throw new ApiError('upstream')
      const status = verdicts[checks++ % verdicts.length]
      return { status, feedback: FEEDBACK[opts?.persona ?? DEFAULT_PERSONA][status] }
    },
  }
}
