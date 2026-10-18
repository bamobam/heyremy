// @vitest-environment node -- server code runs on Node, not in the browser
import { describe, expect, it } from 'vitest'
import {
  checkJpegBase64,
  checkJpegList,
  checkText,
  decodedSize,
  MAX_BURST_IMAGE_BYTES,
  MAX_CHECK_BODY_BYTES,
  MAX_CHECK_BURST_BODY_BYTES,
  MAX_CHECK_IMAGES,
  MAX_IMAGE_BYTES,
  MIN_CHECK_IMAGES,
} from './limits.js'

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
  it('names the field and the size it is given', () => {
    expect(checkJpegBase64(undefined, 'frame')).toBe('frame is required.')
    expect(checkJpegBase64(jpeg(2000), 'frame', 1024)).toBe('frame is over 1 KB.')
    expect(checkJpegBase64(jpeg(MAX_IMAGE_BYTES + 1), 'frame')).toBe('frame is over 1 MB.')
  })
})

describe('checkJpegList', () => {
  const frames = (n: number, bytes = 100) => Array.from({ length: n }, () => jpeg(bytes))

  it.each([2, 3, 4])('accepts %i small JPEGs', (n) => {
    expect(checkJpegList(frames(n))).toBeNull()
  })
  it('allows 2 to 4 images', () => {
    expect([MIN_CHECK_IMAGES, MAX_CHECK_IMAGES]).toEqual([2, 4])
  })
  it.each([0, 1, 5])('rejects %i images', (n) => {
    expect(checkJpegList(frames(n))).toMatch(/2 to 4/)
  })
  it.each([undefined, null, 'abc', jpeg(10), {}, 3])('rejects %j, which is not a list', (value) => {
    expect(checkJpegList(value)).toMatch(/2 to 4/)
  })
  it('rejects a list with a bad entry and says which', () => {
    const list = frames(3)
    list[1] = 'not base64!'
    expect(checkJpegList(list)).toMatch(/images\[1\] must be base64/)
    list[1] = Buffer.from('hello!').toString('base64')
    expect(checkJpegList(list)).toMatch(/images\[1\] must be a JPEG/)
    list[1] = 42 as unknown as string
    expect(checkJpegList(list)).toMatch(/images\[1\] is required/)
  })
  it('accepts frames up to the burst cap and rejects one byte more', () => {
    expect(checkJpegList([jpeg(MAX_BURST_IMAGE_BYTES), jpeg(MAX_BURST_IMAGE_BYTES)])).toBeNull()
    expect(checkJpegList([jpeg(100), jpeg(MAX_BURST_IMAGE_BYTES + 1)])).toBe('images[1] is over 512 KB.')
  })
  it('keeps even the largest allowed burst under the burst body cap, and the cap under what Vercel takes', () => {
    const base64 = Math.ceil((MAX_CHECK_IMAGES * MAX_BURST_IMAGE_BYTES * 4) / 3)
    expect(base64).toBeLessThan(MAX_CHECK_BURST_BODY_BYTES)
    expect(MAX_CHECK_BURST_BODY_BYTES).toBeLessThan(4.5 * 1024 * 1024)
    expect(MAX_CHECK_BODY_BYTES).toBeLessThan(MAX_CHECK_BURST_BODY_BYTES)
  })
})

describe('decodedSize', () => {
  it('matches Buffer decoding', () => {
    for (const n of [1, 2, 3, 100, 101, 102]) {
      expect(decodedSize(jpeg(n + 4))).toBe(n + 4)
    }
  })
})
