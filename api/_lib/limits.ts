// Input limits from SYSTEM_DESIGN 10.2. Pure: values in, error message or null out.

export const MAX_RECIPE_CHARS = 10_000
export const MAX_IMAGE_BYTES = 1024 * 1024 // decoded JPEG
export const MAX_CHECK_BODY_BYTES = 1.5 * 1024 * 1024
// A check with several frames (a step whose cue changes with time). Frames are 768 px at quality 0.8,
// usually well under 150 KB, so each is capped at half the single-image limit. Four of them are about
// 2.7 MB as base64, and the whole body stays under 3 MB: Vercel refuses a body over about 4.5 MB before
// our code runs.
export const MIN_CHECK_IMAGES = 2
export const MAX_CHECK_IMAGES = 4
export const MAX_BURST_IMAGE_BYTES = 512 * 1024 // decoded JPEG, each
export const MAX_CHECK_BURST_BODY_BYTES = 3 * 1024 * 1024
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

const sizeLabel = (bytes: number) => (bytes % (1024 * 1024) === 0 ? `${bytes / (1024 * 1024)} MB` : `${Math.round(bytes / 1024)} KB`)

/**
 * Returns an error message, or null when value is base64 (no data: prefix) of a JPEG up to maxBytes
 * decoded. `field` names the value in the message.
 */
export function checkJpegBase64(value: unknown, field = 'image', maxBytes = MAX_IMAGE_BYTES): string | null {
  if (typeof value !== 'string' || value === '') return `${field} is required.`
  if (value.length % 4 !== 0 || !BASE64.test(value)) return `${field} must be base64 with no data: prefix.`
  if (decodedSize(value) > maxBytes) return `${field} is over ${sizeLabel(maxBytes)}.`
  // JPEG magic bytes FF D8 FF; the first 4 base64 chars decode to the first 3 bytes.
  const head = Buffer.from(value.slice(0, 4), 'base64')
  if (head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) return `${field} must be a JPEG.`
  return null
}

/** Returns an error message, or null when value is a list of 2 to 4 JPEGs (base64), each up to MAX_BURST_IMAGE_BYTES. */
export function checkJpegList(value: unknown): string | null {
  if (!Array.isArray(value) || value.length < MIN_CHECK_IMAGES || value.length > MAX_CHECK_IMAGES) {
    return `images must be a list of ${MIN_CHECK_IMAGES} to ${MAX_CHECK_IMAGES} JPEGs.`
  }
  for (let i = 0; i < value.length; i++) {
    const bad = checkJpegBase64(value[i], `images[${i}]`, MAX_BURST_IMAGE_BYTES)
    if (bad !== null) return bad
  }
  return null
}
