// TEMPORARY (fake): stands in for Nam's api/client.ts so the UI can be built and demoed on its own.
// Every call waits a beat so loading states are real, and the check cycles the three verdicts.
import type { ParsedRecipe, Verdict } from '../../types.ts'
import { FAKE_VERDICTS, PANCAKE_RECIPE } from './fixtures.ts'

/** A 50 ms silent WAV. A playable blob, so the clip cache and canStart are exercised for real. */
export const SILENT_WAV: Blob = (() => {
  const samples = 400
  const bytes = new Uint8Array(44 + samples)
  const view = new DataView(bytes.buffer)
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)))
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples, true)
  text(8, 'WAVEfmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, 8000, true) // sample rate
  view.setUint32(28, 8000, true) // byte rate
  view.setUint16(32, 1, true) // block align
  view.setUint16(34, 8, true) // bits per sample
  text(36, 'data')
  view.setUint32(40, samples, true)
  bytes.fill(0x80, 44) // 8-bit silence
  return new Blob([bytes], { type: 'audio/wav' })
})()

const wait = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms))

let verdictIndex = 0

export const fakeApi = {
  /** Whatever was pasted, the pancakes come back — there is no model behind this yet. */
  async parseRecipe(_text: string): Promise<ParsedRecipe> {
    await wait(2600) // long enough to see the parsing screen and its ticker
    return PANCAKE_RECIPE
  },

  /** Silent: real speech is /api/speak (audio/player.ts takes a `speak` function, so this is the one line to swap). */
  async speak(_text: string): Promise<Blob> {
    await wait(120)
    return SILENT_WAV
  },

  /** Cycles not_ready → unsure → ready so all three §9.3 verdict variants are reachable by hand. */
  async checkStep(_blob: Blob, _step: string, _cue: string): Promise<Verdict> {
    await wait(2000) // the pause the cook sees as Remy looking
    const verdict = FAKE_VERDICTS[verdictIndex % FAKE_VERDICTS.length]
    verdictIndex++
    return verdict
  },
}