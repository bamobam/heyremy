import type { ApiClient } from '../cooking/ports.ts'
import { DEFAULT_PERSONA } from '../cooking/settings.ts'
import { blobToBase64 } from './base64.ts'
import { ApiError } from './errors.ts'
import { isParsedRecipe, isVerdict } from './guards.ts'
import { postJson } from './http.ts'

const MAX_RECIPE_CHARS = 10_000
const PARSE_TIMEOUT_MS = 20_000
const CHECK_TIMEOUT_MS = 8_000
// Several frames are more to upload and for the model to read.
const CHECK_BURST_TIMEOUT_MS = 10_000
/** The server takes 2 to 4 frames; a list of one is sent as a single image. */
const MAX_CHECK_FRAMES = 4

/** The real client: talks to /api/parse and /api/check. Pass a fetch to test it. */
export function createApiClient(fetchFn?: typeof fetch): ApiClient {
  return {
    async parseRecipe(recipe) {
      const text = recipe.trim()
      // Too short or too long never reaches the server.
      if (!text || text.length > MAX_RECIPE_CHARS) throw new ApiError('bad_request')
      const data = await postJson<unknown>('/api/parse', { recipe: text }, { timeoutMs: PARSE_TIMEOUT_MS }, fetchFn)
      if (!isParsedRecipe(data)) throw new ApiError('unprocessable')
      return data
    },

    async checkStep(frame, step, opts) {
      const frames = Array.isArray(frame) ? frame : [frame]
      if (frames.length === 0 || frames.length > MAX_CHECK_FRAMES) throw new ApiError('bad_request')
      const images = await Promise.all(frames.map(blobToBase64))
      const burst = images.length > 1
      // Remy's is the default the server assumes, so his request is the one it always was.
      const persona = opts?.persona !== undefined && opts.persona !== DEFAULT_PERSONA ? { persona: opts.persona } : {}
      const data = await postJson<unknown>(
        '/api/check',
        burst ? { images, cue: step.cue, step: step.text, ...persona } : { image: images[0], cue: step.cue, step: step.text, ...persona },
        { timeoutMs: burst ? CHECK_BURST_TIMEOUT_MS : CHECK_TIMEOUT_MS, signal: opts?.signal },
        fetchFn,
      )
      if (!isVerdict(data)) throw new ApiError('unprocessable')
      return data
    },
  }
}
