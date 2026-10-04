import type { ApiErrorKind } from '../types.ts'

/** The kind of error for an HTTP status the server answered with. */
export function fromStatus(status: number): ApiErrorKind {
  if (status === 400) return 'bad_request'
  if (status === 422) return 'unprocessable'
  if (status === 429) return 'rate_limited'
  if (status >= 500 && status < 600) return 'upstream'
  return 'unknown'
}

const MESSAGES: Record<ApiErrorKind, string> = {
  bad_request: 'That recipe is too long or empty.',
  unprocessable: "I couldn't make sense of that recipe.",
  upstream: 'Something went wrong on our side. Try again.',
  rate_limited: 'Too many requests, wait a few seconds.',
  timeout: 'That took too long. Try again.',
  aborted: '', // the cook moved on; nothing to say
  unknown: 'Something went wrong.',
}

/** What the cook should read for an error of this kind. */
export const userMessage = (kind: ApiErrorKind): string => MESSAGES[kind]

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number

  constructor(kind: ApiErrorKind, { message, status }: { message?: string; status?: number } = {}) {
    super(message ?? userMessage(kind))
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }
}
