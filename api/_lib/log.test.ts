// @vitest-environment node -- server code runs on Node, not in the browser
import { describe, expect, it } from 'vitest'
import { formatLog, type LogEntry } from './log.js'

describe('formatLog', () => {
  it('writes one JSON line with the known fields', () => {
    const line = formatLog({ route: '/api/check', status: 200, latencyMs: 1800, modelMs: 1500, verdict: 'ready' })
    expect(line).not.toContain('\n')
    expect(JSON.parse(line)).toEqual({ route: '/api/check', status: 200, latencyMs: 1800, modelMs: 1500, verdict: 'ready' })
  })
  it('drops any extra fields, such as recipe text or images', () => {
    const leaky = { route: '/api/parse', status: 200, latencyMs: 10, recipe: 'secret', image: 'abc' } as LogEntry
    expect(formatLog(leaky)).not.toMatch(/secret|abc/)
  })
})
