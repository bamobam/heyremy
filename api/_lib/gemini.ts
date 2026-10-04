// Gemini REST call that returns parsed JSON (SYSTEM_DESIGN 10.4). Never logs the image or recipe.

import type { ApiErrorKind } from '../../src/types.ts'
import type { Part } from '../_prompts/check.ts'

// gemini-2.5-flash is closed to new users (404); the API recommends 3.8 Flash.
export const GEMINI_MODEL = 'gemini-3.8-flash'
// Tried once when the primary is overloaded or rate limited. Verified live with thinking 'low'.
export const FALLBACK_MODEL = 'gemini-3.5-flash'

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
// Below this much time left, a retry can't finish before the client gives up, so don't start one.
const MIN_RETRY_MS = 2_000

/** Jittered pause before the retry. Tests replace this to run without waiting. */
export const retry = { delayMs: (): number => 500 + Math.random() * 500 }

/** A provider failure the handler maps straight to an ApiErrorBody. */
export class ProviderError extends Error {
  kind: ApiErrorKind
  /** Whether trying again (on the fallback model) could help. */
  retryable: boolean
  timedOut: boolean
  /** Gemini calls made before giving up; set by generateJson for the log. */
  attempts?: number
  constructor(kind: ApiErrorKind, message: string, flags: { retryable?: boolean; timedOut?: boolean } = {}) {
    super(message)
    this.name = 'ProviderError'
    this.kind = kind
    this.retryable = flags.retryable ?? false
    this.timedOut = flags.timedOut ?? false
  }
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
  promptFeedback?: { blockReason?: string }
}

export type GenerateOpts = {
  system: string
  parts: Part[]
  schema: object
  temperature: number
  /** Cap on output tokens; a guard against runaway responses, not a cost control. */
  maxOutputTokens: number
  /** Total budget across both attempts; keep it under the client's timeout. */
  timeoutMs: number
  /** Cap on the first attempt, leaving room for the fallback. Defaults to timeoutMs. */
  firstAttemptMs?: number
  /** Retry after a timeout too. Off for /check, where two slow attempts would outlast the client. */
  retryOnTimeout?: boolean
}

export type GenerateResult = { data: unknown; modelMs: number; model: string; attempts: number }

export async function generateJson(opts: GenerateOpts): Promise<GenerateResult> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new ProviderError('upstream', 'GEMINI_API_KEY is not set.')

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: 'user', parts: opts.parts.map((p) => (typeof p === 'string' ? { text: p } : p)) }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: opts.schema,
      temperature: opts.temperature,
      maxOutputTokens: opts.maxOutputTokens,
      // Default thinking made /parse take 20–60+ s; low answers in ~4 s with the same output.
      thinkingConfig: { thinkingLevel: 'low' },
    },
  })

  const deadline = Date.now() + opts.timeoutMs
  try {
    const out = await callOnce(GEMINI_MODEL, key, body, Math.min(opts.firstAttemptMs ?? opts.timeoutMs, opts.timeoutMs), false)
    return { ...out, model: GEMINI_MODEL, attempts: 1 }
  } catch (e) {
    const canRetry = e instanceof ProviderError && (e.retryable || (e.timedOut && opts.retryOnTimeout === true))
    const delay = retry.delayMs()
    if (!canRetry || deadline - Date.now() - delay < MIN_RETRY_MS) throw withAttempts(e, 1)
    await new Promise((r) => setTimeout(r, delay))
    try {
      const out = await callOnce(FALLBACK_MODEL, key, body, deadline - Date.now(), true)
      return { ...out, model: FALLBACK_MODEL, attempts: 2 }
    } catch (e2) {
      throw withAttempts(e2, 2)
    }
  }
}

function withAttempts(e: unknown, attempts: number): unknown {
  if (e instanceof ProviderError) e.attempts = attempts
  return e
}

async function callOnce(
  model: string,
  key: string,
  body: string,
  timeoutMs: number,
  isFallback: boolean,
): Promise<{ data: unknown; modelMs: number }> {
  const name = isFallback ? 'Gemini (fallback)' : 'Gemini'
  const started = Date.now()
  let res: Response
  try {
    res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'TimeoutError') throw new ProviderError('upstream', `${name} timed out.`, { timedOut: true })
    throw new ProviderError('upstream', `${name} request failed.`, { retryable: true })
  }

  // 429 and 5xx are capacity problems another model may not have; 4xx are our fault and won't change.
  if (res.status === 429) throw new ProviderError('rate_limited', `${name} rate limit hit.`, { retryable: true })
  if (!res.ok) throw new ProviderError('upstream', `${name} returned ${res.status}.`, { retryable: res.status >= 500 })

  let json: GeminiResponse
  try {
    json = (await res.json()) as GeminiResponse
  } catch (e) {
    if (e instanceof Error && e.name === 'TimeoutError') throw new ProviderError('upstream', `${name} timed out.`, { timedOut: true })
    throw new ProviderError('upstream', `${name} response was not JSON.`)
  }
  const modelMs = Date.now() - started

  if (json.promptFeedback?.blockReason) {
    throw new ProviderError('upstream', `${name} blocked the request: ${json.promptFeedback.blockReason}.`)
  }
  const candidate = json.candidates?.[0]
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new ProviderError('upstream', `${name} output was cut off at the token limit.`)
  }
  const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? '').join('')
  if (text.trim() === '') throw new ProviderError('upstream', `${name} returned no content.`)

  try {
    return { data: JSON.parse(text), modelMs }
  } catch {
    throw new ProviderError('upstream', `${name} output was not valid JSON.`)
  }
}
