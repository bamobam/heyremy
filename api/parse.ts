// POST /api/parse { recipe } → ParsedRecipe (SYSTEM_DESIGN 10.7).

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ProviderError, generateJson } from './_lib/gemini.ts'
import { guard, sendError, sendJson } from './_lib/http.ts'
import { MAX_RECIPE_CHARS, checkText } from './_lib/limits.ts'
import { log } from './_lib/log.ts'
import { ValidationError, recipeSchema, validateRecipe } from './_lib/schemas.ts'
import { PARSE_SYSTEM, PARSE_TEMPERATURE, buildParseParts } from './_prompts/parse.ts'

const GEMINI_TIMEOUT_MS = 18_000 // the client gives up at 20 s

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const started = Date.now()
  let modelMs: number | undefined
  try {
    if (!guard(req, res, { method: 'POST', contentType: 'application/json' })) return
    const body: unknown = req.body
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return sendError(res, 'bad_request', 'Send a JSON object.')
    }
    const { recipe } = body as { recipe?: unknown }
    const bad = checkText(recipe, 'recipe', MAX_RECIPE_CHARS)
    if (bad !== null) return sendError(res, 'bad_request', bad)

    const out = await generateJson({
      system: PARSE_SYSTEM,
      parts: buildParseParts((recipe as string).trim()),
      schema: recipeSchema,
      temperature: PARSE_TEMPERATURE,
      timeoutMs: GEMINI_TIMEOUT_MS,
    })
    modelMs = out.modelMs
    sendJson(res, validateRecipe(out.data))
  } catch (e) {
    if (e instanceof ValidationError) sendError(res, 'unprocessable', e.message)
    else if (e instanceof ProviderError) sendError(res, e.kind, e.message)
    else sendError(res, 'unknown', 'Something went wrong.')
  } finally {
    log({ route: '/api/parse', status: res.statusCode, latencyMs: Date.now() - started, modelMs })
  }
}
