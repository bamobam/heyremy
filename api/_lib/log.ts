// One JSON line per request. Never pass recipe text, images or keys here.

import type { Verdict } from '../../src/types.js'

export interface LogEntry {
  route: string
  status: number
  latencyMs: number
  /** Time spent waiting on Gemini or ElevenLabs. */
  modelMs?: number
  /** Gemini model that answered, or the last one tried on failure. */
  model?: string
  /** Gemini calls made; 2 means the fallback ran. */
  attempts?: number
  /** /parse only: pasted text, or a fetched page's JSON-LD or visible text. Never the URL. */
  source?: 'text' | 'json-ld' | 'page-text'
  /** /check only. */
  verdict?: Verdict['status']
}

/** Builds the line from known fields only, so stray data can't leak into logs. */
export function formatLog(e: LogEntry): string {
  const { route, status, latencyMs, modelMs, model, attempts, source, verdict } = e
  return JSON.stringify({ route, status, latencyMs, modelMs, model, attempts, source, verdict })
}

export function log(e: LogEntry): void {
  console.log(formatLog(e))
}
