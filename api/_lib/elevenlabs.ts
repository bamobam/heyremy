// ElevenLabs text-to-speech (SYSTEM_DESIGN 10.5). Which voice speaks is chosen in voices.ts.

import { BUSY_MESSAGE, ProviderError } from './gemini.js'
import { DEFAULT_VOICE_ID } from './voices.js'

export const VOICE_ID = DEFAULT_VOICE_ID
export const ELEVEN_MODEL = 'eleven_flash_v2_5'
const TIMEOUT_MS = 5000

export async function synthesize(text: string, voiceId: string = VOICE_ID): Promise<Buffer> {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) throw new ProviderError('upstream', 'ELEVENLABS_API_KEY is not set.')

  let res: Response
  try {
    res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': key, Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: ELEVEN_MODEL }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    const timedOut = e instanceof Error && e.name === 'TimeoutError'
    throw new ProviderError('upstream', timedOut ? 'ElevenLabs timed out.' : 'ElevenLabs request failed.')
  }

  if (res.status === 429) throw new ProviderError('rate_limited', BUSY_MESSAGE)
  if (!res.ok) throw new ProviderError('upstream', `ElevenLabs returned ${res.status}.`)

  try {
    return Buffer.from(await res.arrayBuffer())
  } catch {
    throw new ProviderError('upstream', 'ElevenLabs audio could not be read.')
  }
}
