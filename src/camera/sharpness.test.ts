import { describe, expect, it } from 'vitest'
import { laplacianVariance, pickSharpest, scaleToMaxSide, toGrayscale } from './sharpness.ts'

/** A black and white checkerboard: lots of sharp edges. */
const checkerboard = (w: number, h: number, low = 0, high = 255) =>
  Uint8ClampedArray.from({ length: w * h }, (_, i) => ((i % w) + Math.floor(i / w)) % 2 === 0 ? high : low)

/** Averages each pixel with its neighbours, which is what blur does. */
function boxBlur(gray: Uint8ClampedArray, w: number, h: number) {
  const out = new Uint8ClampedArray(gray.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0
      let n = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const px = x + dx
          const py = y + dy
          if (px >= 0 && px < w && py >= 0 && py < h) {
            sum += gray[py * w + px]
            n++
          }
        }
      }
      out[y * w + x] = sum / n
    }
  }
  return out
}

describe('toGrayscale', () => {
  it('weights green most, then red, then blue', () => {
    // Pure red, green, blue, white pixels as RGBA.
    const rgba = Uint8ClampedArray.from([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255])
    const gray = toGrayscale(rgba)
    expect(Array.from(gray)).toEqual([76, 150, 29, 255])
  })

  it('returns one value per pixel', () => {
    expect(toGrayscale(new Uint8ClampedArray(4 * 10)).length).toBe(10)
  })
})

describe('laplacianVariance', () => {
  it('is zero for a flat image', () => {
    expect(laplacianVariance(new Uint8ClampedArray(20 * 20).fill(128), 20, 20)).toBe(0)
  })

  it('is zero for a smooth gradient, which has no edges', () => {
    const gradient = Uint8ClampedArray.from({ length: 20 * 20 }, (_, i) => (i % 20) * 10)
    expect(laplacianVariance(gradient, 20, 20)).toBeLessThan(1)
  })

  it('scores a sharp checkerboard higher than the same board blurred', () => {
    const sharp = checkerboard(24, 24)
    const blurred = boxBlur(sharp, 24, 24)
    expect(laplacianVariance(sharp, 24, 24)).toBeGreaterThan(laplacianVariance(blurred, 24, 24) * 5)
  })

  it('scores higher contrast higher', () => {
    const strong = laplacianVariance(checkerboard(24, 24, 0, 255), 24, 24)
    const weak = laplacianVariance(checkerboard(24, 24, 100, 140), 24, 24)
    expect(strong).toBeGreaterThan(weak)
  })

  it('returns 0 for an image too small to have an interior', () => {
    expect(laplacianVariance(new Uint8ClampedArray(4), 2, 2)).toBe(0)
  })
})

describe('pickSharpest', () => {
  it('returns the index of the highest score', () => {
    expect(pickSharpest([3, 9, 5, 1])).toBe(1)
  })

  it('returns the first of equal scores', () => {
    expect(pickSharpest([4, 7, 7, 2])).toBe(1)
  })

  it('returns 0 for a single score', () => {
    expect(pickSharpest([2])).toBe(0)
  })
})

describe('scaleToMaxSide', () => {
  it('scales a landscape frame so the long side is the max', () => {
    expect(scaleToMaxSide(1280, 720, 768)).toEqual({ width: 768, height: 432 })
  })

  it('scales a portrait frame so the long side is the max', () => {
    expect(scaleToMaxSide(720, 1280, 768)).toEqual({ width: 432, height: 768 })
  })

  it('never scales up', () => {
    expect(scaleToMaxSide(320, 240, 768)).toEqual({ width: 320, height: 240 })
  })

  it('rounds to whole pixels', () => {
    const { width, height } = scaleToMaxSide(1920, 1080, 160)
    expect(Number.isInteger(width) && Number.isInteger(height)).toBe(true)
    expect(width).toBe(160)
    expect(height).toBe(90)
  })
})
