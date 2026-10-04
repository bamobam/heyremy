// Input limits from SYSTEM_DESIGN 10.2. Pure: values in, error message or null out.

export const MAX_RECIPE_CHARS = 10_000
export const MAX_IMAGE_BYTES = 1024 * 1024 // decoded JPEG
export const MAX_CHECK_BODY_BYTES = 1.5 * 1024 * 1024
export const MAX_CUE_CHARS = 300
export const MAX_STEP_CHARS = 300
export const MAX_SPEAK_CHARS = 300

/** Returns an error message, or null when the text is a non-empty string within max characters. */
export function checkText(value: unknown, field: string, max: number): string | null {
  if (typeof value !== 'string' || value.trim() === '') return `${field} is required.`
  if (value.length > max) return `${field} is over ${max} characters.`
  return null
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/

/** Bytes a base64 string decodes to, without decoding it. */
export function decodedSize(b64: string): number {
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return (b64.length / 4) * 3 - padding
}

/** Returns an error message, or null when value is base64 (no data: prefix) of a JPEG up to MAX_IMAGE_BYTES. */
export function checkJpegBase64(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return 'image is required.'
  if (value.length % 4 !== 0 || !BASE64.test(value)) return 'image must be base64 with no data: prefix.'
  if (decodedSize(value) > MAX_IMAGE_BYTES) return 'image is over 1 MB.'
  // JPEG magic bytes FF D8 FF; the first 4 base64 chars decode to the first 3 bytes.
  const head = Buffer.from(value.slice(0, 4), 'base64')
  if (head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) return 'image must be a JPEG.'
  return null
}
