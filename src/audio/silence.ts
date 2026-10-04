// A 50 ms silent WAV: played inside a click to satisfy the autoplay rule, and standing in for a voice
// clip when the speech API is mocked.

/** The raw bytes of 400 samples of 8-bit silence at 8 kHz. */
function silentWavBytes(): Uint8Array {
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
  return bytes
}

export const silentWavBlob = (): Blob => new Blob([silentWavBytes() as BlobPart], { type: 'audio/wav' })

export const silentWavUrl = (): string => `data:audio/wav;base64,${btoa(String.fromCharCode(...silentWavBytes()))}`
