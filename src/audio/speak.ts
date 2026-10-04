// Text → speech audio for the audio player: POST /api/speak (audio/mpeg). With the API mocked
// (?mock or VITE_MOCK_API=1) it returns silence, so the whole flow still runs.
import { ApiError, fromStatus } from '../api/errors.ts'
import { isMockApi } from '../api/index.ts'
import { silentWavBlob } from './silence.ts'

const SPEAK_TIMEOUT_MS = 10_000

export async function speak(text: string): Promise<Blob> {
  if (isMockApi()) return silentWavBlob()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SPEAK_TIMEOUT_MS)
  try {
    const response = await fetch('/api/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    })
    if (!response.ok) throw new ApiError(fromStatus(response.status), { status: response.status })
    return await response.blob()
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(controller.signal.aborted ? 'timeout' : 'unknown')
  } finally {
    clearTimeout(timer)
  }
}
