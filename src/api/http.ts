import type { ApiErrorKind } from '../types.ts'
import { ApiError, fromStatus } from './errors.ts'

const KINDS = new Set<string>(['bad_request', 'unprocessable', 'upstream', 'rate_limited', 'timeout', 'aborted', 'unknown'])

const isAbort = (error: unknown) => typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError'

/** The error a failed response describes: the server's own if it sent one, else one worked out from the status. */
async function errorFromResponse(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { error?: { kind?: unknown; message?: unknown } }
    const { kind, message } = body.error ?? {}
    if (typeof kind === 'string' && KINDS.has(kind)) {
      return new ApiError(kind as ApiErrorKind, {
        message: typeof message === 'string' && message ? message : undefined,
        status: response.status,
      })
    }
  } catch {
    // not JSON: fall through to the status
  }
  return new ApiError(fromStatus(response.status), { status: response.status })
}

/**
 * POST a JSON body and read a JSON answer. Every failure is an ApiError: the
 * server's own, a timeout, a cancel by the caller, or unknown (network down).
 * There are no retries: a failure goes straight to the screen.
 */
export async function postJson<T>(
  path: string,
  body: unknown,
  { timeoutMs, signal }: { timeoutMs: number; signal?: AbortSignal },
  fetchFn: typeof fetch = (...args) => fetch(...args),
): Promise<T> {
  if (signal?.aborted) throw new ApiError('aborted')

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const onCallerAbort = () => controller.abort()
  signal?.addEventListener('abort', onCallerAbort, { once: true })

  try {
    const response = await fetchFn(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!response.ok) throw await errorFromResponse(response)
    try {
      return (await response.json()) as T
    } catch (error) {
      if (controller.signal.aborted) throw error
      throw new ApiError('unprocessable')
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (timedOut) throw new ApiError('timeout')
    if (signal?.aborted || isAbort(error)) throw new ApiError('aborted')
    throw new ApiError('unknown')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onCallerAbort)
  }
}
