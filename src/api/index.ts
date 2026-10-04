import type { ApiClient } from '../cooking/ports.ts'
import { createApiClient } from './client.ts'
import { createMockApi } from './mock.ts'

/**
 * The API client the app uses. The real one, unless the URL has ?mock (or
 * ?mock=slow, ?mock=fail) or VITE_MOCK_API=1, which swap in a stand-in backend
 * so the screens can run before the real endpoints exist.
 */
export function createApi(): ApiClient {
  const asked = new URLSearchParams(window.location.search).get('mock')
  const mock = asked ?? (import.meta.env.VITE_MOCK_API === '1' ? '' : null)
  if (mock === null) return createApiClient()
  return createMockApi({ delayMs: mock === 'slow' ? 6000 : 800, fail: mock === 'fail' })
}
