import type { ApiClient } from '../cooking/ports.ts'
import { blobToBase64 } from './base64.ts'
import { ApiError } from './errors.ts'
import { isParsedRecipe, isVerdict } from './guards.ts'
import { postJson } from './http.ts'

const MAX_RECIPE_CHARS = 10_000
const PARSE_TIMEOUT_MS = 20_000
const CHECK_TIMEOUT_MS = 8_000

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
      const image = await blobToBase64(frame)
      const data = await postJson<unknown>(
        '/api/check',
        { image, cue: step.cue, step: step.text },
        { timeoutMs: CHECK_TIMEOUT_MS, signal: opts?.signal },
        fetchFn,
      )
      if (!isVerdict(data)) throw new ApiError('unprocessable')
      return data
    },
  }
}
