import { describe, expect, it } from 'vitest'
import { blobToBase64 } from './base64.ts'

describe('blobToBase64', () => {
  it('encodes text', async () => {
    expect(await blobToBase64(new Blob(['hello']))).toBe('aGVsbG8=')
  })

  it('encodes binary data, such as a JPEG', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
    expect(await blobToBase64(new Blob([bytes], { type: 'image/jpeg' }))).toBe('/9j/4AAQ')
  })

  it('has no data: prefix, whatever the type', async () => {
    const out = await blobToBase64(new Blob(['x'], { type: 'image/jpeg' }))
    expect(out).not.toContain('data:')
    expect(out).not.toContain(',')
  })

  it('encodes an empty blob as an empty string', async () => {
    expect(await blobToBase64(new Blob([]))).toBe('')
  })
})
