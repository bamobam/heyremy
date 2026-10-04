// POST /api/parse { recipe } → ParsedRecipe (SYSTEM_DESIGN 10.7). `recipe` is pasted text or a single recipe link.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { FetchRecipeError, fetchRecipeText, isRecipeUrl } from './_lib/fetchRecipe.js'
import { ProviderError, generateJson } from './_lib/gemini.js'
import { guard, sendError, sendJson } from './_lib/http.js'
import { MAX_RECIPE_CHARS, checkText } from './_lib/limits.js'
import { log } from './_lib/log.js'
import { ValidationError, recipeSchema, validateRecipe } from './_lib/schemas.js'
import { PARSE_MAX_TOKENS, PARSE_SYSTEM, PARSE_TEMPERATURE, buildParseParts } from './_prompts/parse.js'

const GEMINI_TIMEOUT_MS = 18_000 // the client gives up at 20 s
// Parse normally takes 3–4 s; cut the first try at 9 s so the fallback still has ~8 s.
const FIRST_ATTEMPT_MS = 9_000
// After fetching a link, don't start Gemini with less than this left; parse alone takes 3–5 s.
const MIN_GEMINI_MS = 6_000

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const started = Date.now()
  let modelMs: number | undefined
  let model: string | undefined
  let attempts: number | undefined
  let source: 'text' | 'json-ld' | 'page-text' | undefined
  try {
    if (!guard(req, res, { method: 'POST', contentType: 'application/json' })) return
    const body: unknown = req.body
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return sendError(res, 'bad_request', 'Send a JSON object.')
    }
    const { recipe } = body as { recipe?: unknown }
    const bad = checkText(recipe, 'recipe', MAX_RECIPE_CHARS)
    if (bad !== null) return sendError(res, 'bad_request', bad)

    let text = (recipe as string).trim()
    let budget = GEMINI_TIMEOUT_MS
    if (!isRecipeUrl(text)) source = 'text'
    else {
      // The page fetch spends part of the client's 20 s, so Gemini gets what's left.
      const fetchStarted = Date.now()
      const page = await fetchRecipeText(text)
      text = page.text
      source = page.source
      budget = GEMINI_TIMEOUT_MS - (Date.now() - fetchStarted)
      if (budget < MIN_GEMINI_MS) {
        return sendError(res, 'unprocessable', 'That page took too long to load. Paste the recipe text instead.')
      }
    }

    const out = await generateJson({
      system: PARSE_SYSTEM,
      parts: buildParseParts(text),
      schema: recipeSchema,
      temperature: PARSE_TEMPERATURE,
      maxOutputTokens: PARSE_MAX_TOKENS,
      timeoutMs: budget,
      firstAttemptMs: Math.min(FIRST_ATTEMPT_MS, budget),
      retryOnTimeout: true,
    })
    modelMs = out.modelMs
    model = out.model
    attempts = out.attempts
    sendJson(res, validateRecipe(out.data))
  } catch (e) {
    if (e instanceof ValidationError) sendError(res, 'unprocessable', e.message)
    else if (e instanceof FetchRecipeError) sendError(res, e.kind, e.message)
    else if (e instanceof ProviderError) {
      attempts = e.attempts
      sendError(res, e.kind, e.message)
    }
    else sendError(res, 'unknown', 'Something went wrong.')
  } finally {
    log({ route: '/api/parse', status: res.statusCode, latencyMs: Date.now() - started, modelMs, model, attempts, source })
  }
}
