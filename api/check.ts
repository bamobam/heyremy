// POST /api/check { image, cue, step } → Verdict (SYSTEM_DESIGN 10.7).

import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Verdict } from '../src/types.ts'
import { ProviderError, generateJson } from './_lib/gemini.ts'
import { guard, sendError, sendJson } from './_lib/http.ts'
import { MAX_CHECK_BODY_BYTES, MAX_CUE_CHARS, MAX_STEP_CHARS, checkJpegBase64, checkText } from './_lib/limits.ts'
import { log } from './_lib/log.ts'
import { ValidationError, validateVerdict, verdictSchema } from './_lib/schemas.ts'
import { CHECK_SYSTEM, CHECK_TEMPERATURE, buildCheckParts } from './_prompts/check.ts'

const GEMINI_TIMEOUT_MS = 7_000 // the client gives up at 8 s

/** Request size from content-length, or the parsed body re-serialised when the header is missing. */
function bodySize(req: VercelRequest): number {
  const header = Number(req.headers['content-length'])
  return Number.isFinite(header) && header > 0 ? header : JSON.stringify(req.body ?? '').length
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const started = Date.now()
  let modelMs: number | undefined
  let verdict: Verdict | undefined
  try {
    if (!guard(req, res, { method: 'POST', contentType: 'application/json' })) return
    if (bodySize(req) > MAX_CHECK_BODY_BYTES) return sendError(res, 'bad_request', 'Request is over 1.5 MB.')
    const body: unknown = req.body
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return sendError(res, 'bad_request', 'Send a JSON object.')
    }
    const { image, cue, step } = body as { image?: unknown; cue?: unknown; step?: unknown }
    const bad = checkJpegBase64(image) ?? checkText(cue, 'cue', MAX_CUE_CHARS) ?? checkText(step, 'step', MAX_STEP_CHARS)
    if (bad !== null) return sendError(res, 'bad_request', bad)

    const out = await generateJson({
      system: CHECK_SYSTEM,
      parts: buildCheckParts(image as string, (cue as string).trim(), (step as string).trim()),
      schema: verdictSchema,
      temperature: CHECK_TEMPERATURE,
      timeoutMs: GEMINI_TIMEOUT_MS,
    })
    modelMs = out.modelMs
    verdict = validateVerdict(out.data)
    sendJson(res, verdict)
  } catch (e) {
    if (e instanceof ValidationError) sendError(res, 'unprocessable', e.message)
    else if (e instanceof ProviderError) sendError(res, e.kind, e.message)
    else sendError(res, 'unknown', 'Something went wrong.')
  } finally {
    log({ route: '/api/check', status: res.statusCode, latencyMs: Date.now() - started, modelMs, verdict: verdict?.status })
  }
}
