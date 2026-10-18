// POST /api/check { image, cue, step } → Verdict (SYSTEM_DESIGN 10.7).
// For a step whose cue changes with time, `images` (2 to 4 JPEGs in time order) is sent in place of `image`.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Verdict } from '../src/types.js'
import { ProviderError, generateJson } from './_lib/gemini.js'
import { guard, rateLimit, sendError, sendJson } from './_lib/http.js'
import {
  MAX_CHECK_BODY_BYTES,
  MAX_CHECK_BURST_BODY_BYTES,
  MAX_CUE_CHARS,
  MAX_STEP_CHARS,
  checkJpegBase64,
  checkJpegList,
  checkText,
} from './_lib/limits.js'
import { log } from './_lib/log.js'
import type { LimitReason } from './_lib/ratelimit.js'
import { ValidationError, validateVerdict, verdictSchema } from './_lib/schemas.js'
import { CHECK_MAX_TOKENS, CHECK_TEMPERATURE, buildCheckParts, buildCheckSystem } from './_prompts/check.js'

// The client gives up at 8 s. No retry after a timeout: two slow attempts would outlast it,
// but a fast 503/429 still gets one try on the fallback model.
const GEMINI_TIMEOUT_MS = 7_000
// Several frames are more to upload and to read, so they get 2 s more. The client waits 10 s for them
// (src/api/client.ts), and the function may run 15 s (vercel.json).
const GEMINI_BURST_TIMEOUT_MS = 9_000

/** Request size from content-length, or the parsed body re-serialised when the header is missing. */
function bodySize(req: VercelRequest): number {
  const header = Number(req.headers['content-length'])
  return Number.isFinite(header) && header > 0 ? header : JSON.stringify(req.body ?? '').length
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const started = Date.now()
  let modelMs: number | undefined
  let model: string | undefined
  let attempts: number | undefined
  let verdict: Verdict | undefined
  let limit: LimitReason | undefined
  let frames: number | undefined
  try {
    if (!guard(req, res, { method: 'POST', contentType: 'application/json' })) return
    limit = rateLimit(req, res, 'check')
    if (limit) return
    const size = bodySize(req)
    if (size > MAX_CHECK_BURST_BODY_BYTES) return sendError(res, 'bad_request', 'Request is over 3 MB.')
    const body: unknown = req.body
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return sendError(res, 'bad_request', 'Send a JSON object.')
    }
    const { image, images, cue, step } = body as { image?: unknown; images?: unknown; cue?: unknown; step?: unknown }
    const burst = images !== undefined
    if (burst && image !== undefined) return sendError(res, 'bad_request', 'Send image or images, not both.')
    if (!burst && size > MAX_CHECK_BODY_BYTES) return sendError(res, 'bad_request', 'Request is over 1.5 MB.')
    const bad = (burst ? checkJpegList(images) : checkJpegBase64(image)) ?? checkText(cue, 'cue', MAX_CUE_CHARS) ?? checkText(step, 'step', MAX_STEP_CHARS)
    if (bad !== null) return sendError(res, 'bad_request', bad)

    const sent = burst ? (images as string[]) : (image as string)
    frames = burst ? (images as string[]).length : 1
    const out = await generateJson({
      system: buildCheckSystem(frames),
      parts: buildCheckParts(sent, (cue as string).trim(), (step as string).trim()),
      schema: verdictSchema,
      temperature: CHECK_TEMPERATURE,
      maxOutputTokens: CHECK_MAX_TOKENS,
      timeoutMs: burst ? GEMINI_BURST_TIMEOUT_MS : GEMINI_TIMEOUT_MS,
    })
    modelMs = out.modelMs
    model = out.model
    attempts = out.attempts
    verdict = validateVerdict(out.data)
    sendJson(res, verdict)
  } catch (e) {
    if (e instanceof ValidationError) sendError(res, 'unprocessable', e.message)
    else if (e instanceof ProviderError) {
      attempts = e.attempts
      sendError(res, e.kind, e.message)
    }
    else sendError(res, 'unknown', 'Something went wrong.')
  } finally {
    log({ route: '/api/check', status: res.statusCode, latencyMs: Date.now() - started, modelMs, model, attempts, verdict: verdict?.status, limit, frames })
  }
}
