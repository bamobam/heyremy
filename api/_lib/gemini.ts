// Gemini REST call that returns parsed JSON (SYSTEM_DESIGN 10.4). Never logs the image or recipe.

import type { ApiErrorKind } from '../../src/types.ts'
import type { Part } from '../_prompts/check.ts'

// gemini-2.5-flash is closed to new users (404); the API recommends 3.8 Flash.
export const GEMINI_MODEL = 'gemini-3.8-flash'

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

/** A provider failure the handler maps straight to an ApiErrorBody. */
export class ProviderError extends Error {
  kind: ApiErrorKind
  constructor(kind: ApiErrorKind, message: string) {
    super(message)
    this.name = 'ProviderError'
    this.kind = kind
  }
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[]
  promptFeedback?: { blockReason?: string }
}

export async function generateJson(opts: {
  system: string
  parts: Part[]
  schema: object
  temperature: number
  timeoutMs: number
}): Promise<{ data: unknown; modelMs: number }> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new ProviderError('upstream', 'GEMINI_API_KEY is not set.')

  const body = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: 'user', parts: opts.parts.map((p) => (typeof p === 'string' ? { text: p } : p)) }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: opts.schema,
      temperature: opts.temperature,
      // Default thinking made /parse take 20–60+ s; low answers in ~4 s with the same output.
      thinkingConfig: { thinkingLevel: 'low' },
    },
  }

  const started = Date.now()
  let res: Response
  try {
    res = await fetch(`${ENDPOINT}/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs),
    })
  } catch (e) {
    const timedOut = e instanceof Error && e.name === 'TimeoutError'
    throw new ProviderError('upstream', timedOut ? 'Gemini timed out.' : 'Gemini request failed.')
  }
  const modelMs = Date.now() - started

  if (res.status === 429) throw new ProviderError('rate_limited', 'Gemini rate limit hit.')
  if (!res.ok) throw new ProviderError('upstream', `Gemini returned ${res.status}.`)

  let json: GeminiResponse
  try {
    json = (await res.json()) as GeminiResponse
  } catch {
    throw new ProviderError('upstream', 'Gemini response was not JSON.')
  }
  if (json.promptFeedback?.blockReason) {
    throw new ProviderError('upstream', `Gemini blocked the request: ${json.promptFeedback.blockReason}.`)
  }

  const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('')
  if (text.trim() === '') throw new ProviderError('upstream', 'Gemini returned no content.')

  try {
    return { data: JSON.parse(text), modelMs }
  } catch {
    throw new ProviderError('upstream', 'Gemini output was not valid JSON.')
  }
}
