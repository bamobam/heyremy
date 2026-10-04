// @vitest-environment node -- server code runs on Node, not in the browser
import { describe, expect, it } from 'vitest'
import { checkJpegBase64, checkText, decodedSize, MAX_IMAGE_BYTES } from './limits.js'

const jpeg = (bytes: number) => {
  const buf = Buffer.alloc(bytes)
  buf.set([0xff, 0xd8, 0xff, 0xe0])
  return buf.toString('base64')
}

describe('checkText', () => {
  it('accepts text within the limit', () => {
    expect(checkText('pancakes', 'recipe', 10)).toBeNull()
  })
  it('rejects missing, blank and non-string values', () => {
    expect(checkText(undefined, 'recipe', 10)).toMatch(/required/)
    expect(checkText('   ', 'recipe', 10)).toMatch(/required/)
    expect(checkText(42, 'recipe', 10)).toMatch(/required/)
  })
  it('rejects text over the limit', () => {
    expect(checkText('x'.repeat(11), 'recipe', 10)).toMatch(/over 10/)
  })
})

describe('checkJpegBase64', () => {
  it('accepts a small JPEG', () => {
    expect(checkJpegBase64(jpeg(100))).toBeNull()
  })
  it('accepts exactly 1 MB and rejects one byte more', () => {
    expect(checkJpegBase64(jpeg(MAX_IMAGE_BYTES))).toBeNull()
    expect(checkJpegBase64(jpeg(MAX_IMAGE_BYTES + 1))).toMatch(/over 1 MB/)
  })
  it('rejects a data: prefix and non-base64', () => {
    expect(checkJpegBase64('data:image/jpeg;base64,' + jpeg(10))).toMatch(/base64/)
    expect(checkJpegBase64('not base64!')).toMatch(/base64/)
  })
  it('rejects a PNG', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0]).toString('base64')
    expect(checkJpegBase64(png)).toMatch(/JPEG/)
  })
  it('rejects missing input', () => {
    expect(checkJpegBase64(undefined)).toMatch(/required/)
  })
})

describe('decodedSize', () => {
  it('matches Buffer decoding', () => {
    for (const n of [1, 2, 3, 100, 101, 102]) {
      expect(decodedSize(jpeg(n + 4))).toBe(n + 4)
    }
  })
})
