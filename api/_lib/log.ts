// One JSON line per request. Never pass recipe text, images or keys here.

import type { Verdict } from '../../src/types.ts'

export interface LogEntry {
  route: string
  status: number
  latencyMs: number
  /** Time spent waiting on Gemini or ElevenLabs. */
  modelMs?: number
  /** /check only. */
  verdict?: Verdict['status']
}

/** Builds the line from known fields only, so stray data can't leak into logs. */
export function formatLog(e: LogEntry): string {
  const { route, status, latencyMs, modelMs, verdict } = e
  return JSON.stringify({ route, status, latencyMs, modelMs, verdict })
}

export function log(e: LogEntry): void {
  console.log(formatLog(e))
}
