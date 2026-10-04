// POST /api/speak { text } → audio/mpeg (SYSTEM_DESIGN 10.7).

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { synthesize } from './_lib/elevenlabs.js'
import { ProviderError } from './_lib/gemini.js'
import { guard, sendAudio, sendError } from './_lib/http.js'
import { MAX_SPEAK_CHARS, checkText } from './_lib/limits.js'
import { log } from './_lib/log.js'

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const started = Date.now()
  let modelMs: number | undefined
  try {
    if (!guard(req, res, { method: 'POST', contentType: 'application/json' })) return
    const body: unknown = req.body
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return sendError(res, 'bad_request', 'Send a JSON object.')
    }
    const { text } = body as { text?: unknown }
    const bad = checkText(text, 'text', MAX_SPEAK_CHARS)
    if (bad !== null) return sendError(res, 'bad_request', bad)

    const t = Date.now()
    const audio = await synthesize((text as string).trim())
    modelMs = Date.now() - t
    sendAudio(res, audio)
  } catch (e) {
    if (e instanceof ProviderError) sendError(res, e.kind, e.message)
    else sendError(res, 'unknown', 'Something went wrong.')
  } finally {
    log({ route: '/api/speak', status: res.statusCode, latencyMs: Date.now() - started, modelMs })
  }
}
