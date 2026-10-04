import { vi, type Mock } from 'vitest'

type Impl = (url: string, init?: RequestInit) => Promise<Response>

/** A fetch you can hand to code that takes `typeof fetch`, with the mock's call log attached. */
export function fakeFetch(impl: Impl): typeof fetch & { mock: Mock<Impl>['mock'] } {
  return vi.fn(impl) as unknown as typeof fetch & { mock: Mock<Impl>['mock'] }
}

/** A fetch that never answers on its own, but rejects like the real one when aborted. */
export const hangingFetch = () =>
  fakeFetch(
    (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      }),
  )
