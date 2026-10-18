import { describe, expect, it } from 'vitest'
import { fitFontSize } from './fitText.ts'

const range = { min: 22, max: 38 }

describe('fitFontSize', () => {
  it('keeps the largest size when the text fits at it', () => {
    expect(fitFontSize(() => true, range)).toBe(38)
  })

  it('falls back to the floor when nothing fits', () => {
    expect(fitFontSize(() => false, range)).toBe(22)
  })

  it('finds the largest size that fits', () => {
    for (let limit = 22; limit <= 38; limit++) {
      expect(fitFontSize(px => px <= limit, range)).toBe(limit)
    }
  })

  it('only ever tries sizes inside the range', () => {
    const tried: number[] = []
    fitFontSize(px => {
      tried.push(px)
      return px <= 30
    }, range)
    expect(Math.min(...tried)).toBeGreaterThanOrEqual(22)
    expect(Math.max(...tried)).toBeLessThanOrEqual(38)
  })

  it('does not take more than a handful of measurements', () => {
    let calls = 0
    fitFontSize(px => {
      calls++
      return px <= 27
    }, range)
    expect(calls).toBeLessThanOrEqual(6)
  })
})
