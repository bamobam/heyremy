// ElevenLabs text-to-speech, one fixed voice (SYSTEM_DESIGN 10.5).

import { ProviderError } from './gemini.js'

// Premade voice "Alice" (clear, British); free plans can't use library voices via the API. Not a secret.
export const VOICE_ID = 'Xb7hH8MSUJpSbSDYk0k2'
export const ELEVEN_MODEL = 'eleven_flash_v2_5'
const TIMEOUT_MS = 5000

export async function synthesize(text: string): Promise<Buffer> {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) throw new ProviderError('upstream', 'ELEVENLABS_API_KEY is not set.')

  let res: Response
  try {
    res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': key, Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: ELEVEN_MODEL }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    const timedOut = e instanceof Error && e.name === 'TimeoutError'
    throw new ProviderError('upstream', timedOut ? 'ElevenLabs timed out.' : 'ElevenLabs request failed.')
  }

  if (res.status === 429) throw new ProviderError('rate_limited', 'ElevenLabs rate limit hit.')
  if (!res.ok) throw new ProviderError('upstream', `ElevenLabs returned ${res.status}.`)

  try {
    return Buffer.from(await res.arrayBuffer())
  } catch {
    throw new ProviderError('upstream', 'ElevenLabs audio could not be read.')
  }
}
