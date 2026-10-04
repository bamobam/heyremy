// Request guards and response helpers shared by every handler.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { ApiErrorBody, ApiErrorKind } from '../../src/types.ts'

const STATUS: Record<ApiErrorKind, number> = {
  bad_request: 400,
  unprocessable: 422,
  upstream: 502,
  rate_limited: 429,
  timeout: 504,
  aborted: 499,
  unknown: 500,
}

export function statusFor(kind: ApiErrorKind): number {
  return STATUS[kind]
}

export function sendError(res: VercelResponse, kind: ApiErrorKind, message: string, status = statusFor(kind)): void {
  const body: ApiErrorBody = { error: { kind, message } }
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).json(body)
}

export function sendJson(res: VercelResponse, body: unknown): void {
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json(body)
}

export function sendAudio(res: VercelResponse, audio: Buffer): void {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'audio/mpeg')
  res.setHeader('Content-Length', String(audio.length))
  res.status(200).send(audio)
}

/** Returns true when the request may proceed; otherwise sends 405 or 415 and returns false. */
export function guard(
  req: VercelRequest,
  res: VercelResponse,
  opts: { method: string; contentType: string },
): boolean {
  if (req.method !== opts.method) {
    res.setHeader('Allow', opts.method)
    sendError(res, 'bad_request', `Use ${opts.method}.`, 405)
    return false
  }
  const type = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
  if (type !== opts.contentType) {
    // No ApiErrorKind for 415; the status carries the distinction.
    sendError(res, 'bad_request', `Send ${opts.contentType}.`, 415)
    return false
  }
  return true
}
