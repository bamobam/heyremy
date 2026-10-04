import type { VercelRequest, VercelResponse } from '@vercel/node'
import { describe, expect, it } from 'vitest'
import { guard, sendAudio, sendError, sendJson } from './http.ts'

function fakeRes() {
  const r = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(k: string, v: string) { r.headers[k] = v; return r },
    status(code: number) { r.statusCode = code; return r },
    json(b: unknown) { r.body = b; return r },
    send(b: unknown) { r.body = b; return r },
  }
  return r
}
const asRes = (r: ReturnType<typeof fakeRes>) => r as unknown as VercelResponse
const req = (method: string, contentType?: string) =>
  ({ method, headers: contentType ? { 'content-type': contentType } : {} }) as unknown as VercelRequest

const opts = { method: 'POST', contentType: 'application/json' }

describe('guard', () => {
  it('lets a JSON POST through, ignoring charset', () => {
    const r = fakeRes()
    expect(guard(req('POST', 'application/json; charset=utf-8'), asRes(r), opts)).toBe(true)
    expect(r.statusCode).toBe(0)
  })
  it('rejects the wrong method with 405', () => {
    const r = fakeRes()
    expect(guard(req('GET'), asRes(r), opts)).toBe(false)
    expect(r.statusCode).toBe(405)
    expect(r.headers.Allow).toBe('POST')
  })
  it('rejects the wrong content type with 415', () => {
    const r = fakeRes()
    expect(guard(req('POST', 'text/plain'), asRes(r), opts)).toBe(false)
    expect(r.statusCode).toBe(415)
    expect(r.body).toEqual({ error: { kind: 'bad_request', message: 'Send application/json.' } })
  })
})

describe('sendError', () => {
  it.each([
    ['bad_request', 400],
    ['unprocessable', 422],
    ['upstream', 502],
    ['rate_limited', 429],
    ['unknown', 500],
  ] as const)('%s → %i', (kind, status) => {
    const r = fakeRes()
    sendError(asRes(r), kind, 'msg')
    expect(r.statusCode).toBe(status)
    expect(r.body).toEqual({ error: { kind, message: 'msg' } })
    expect(r.headers['Cache-Control']).toBe('no-store')
  })
})

describe('sendJson and sendAudio', () => {
  it('sends JSON uncached', () => {
    const r = fakeRes()
    sendJson(asRes(r), { ok: true })
    expect(r.statusCode).toBe(200)
    expect(r.headers['Cache-Control']).toBe('no-store')
  })
  it('sends mp3 with type and length', () => {
    const r = fakeRes()
    sendAudio(asRes(r), Buffer.from([1, 2, 3]))
    expect(r.headers['Content-Type']).toBe('audio/mpeg')
    expect(r.headers['Content-Length']).toBe('3')
  })
})
