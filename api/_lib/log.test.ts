// @vitest-environment node -- server code runs on Node, not in the browser
import { describe, expect, it } from 'vitest'
import { formatLog, type LogEntry } from './log.js'

describe('formatLog', () => {
  it('writes one JSON line with the known fields', () => {
    const line = formatLog({ route: '/api/check', status: 200, latencyMs: 1800, modelMs: 1500, verdict: 'ready' })
    expect(line).not.toContain('\n')
    expect(JSON.parse(line)).toEqual({ route: '/api/check', status: 200, latencyMs: 1800, modelMs: 1500, verdict: 'ready' })
  })
  it('adds only the reason when a request was limited', () => {
    const line = formatLog({ route: '/api/speak', status: 429, latencyMs: 1, limit: 'daily' })
    expect(JSON.parse(line)).toEqual({ route: '/api/speak', status: 429, latencyMs: 1, limit: 'daily' })
  })
  it('writes how many frames a check carried', () => {
    expect(JSON.parse(formatLog({ route: '/api/check', status: 200, latencyMs: 1, frames: 3 }))).toMatchObject({ frames: 3 })
  })
  it('drops any extra fields, such as recipe text or images', () => {
    const leaky = { route: '/api/parse', status: 200, latencyMs: 10, recipe: 'secret', image: 'abc' } as LogEntry
    expect(formatLog(leaky)).not.toMatch(/secret|abc/)
  })
  it('drops a client address, however it is passed', () => {
    const leaky = { route: '/api/parse', status: 429, latencyMs: 1, limit: 'per_minute', ip: '203.0.113.7', client: '203.0.113.7' } as LogEntry
    expect(formatLog(leaky)).not.toContain('203.0.113.7')
  })
})
