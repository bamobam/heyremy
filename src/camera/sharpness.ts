// Pure image maths for choosing the sharpest frame. Head movement blurs the
// hat cam, so a check captures several frames and keeps the least blurred one.

/** RGBA pixels to one gray value per pixel (standard luma weights). */
export function toGrayscale(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(rgba.length / 4)
  for (let i = 0; i < gray.length; i++) {
    gray[i] = Math.round(0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2])
  }
  return gray
}

/**
 * Sharpness score: the variance of the Laplacian (how much each pixel differs
 * from the average of its four neighbours). Blur flattens edges, so a blurry
 * frame scores low and a sharp one scores high. Scores compare frames of the
 * same size, not different scenes.
 */
export function laplacianVariance(gray: Uint8ClampedArray, width: number, height: number): number {
  if (width < 3 || height < 3) return 0
  let sum = 0
  let sumSquares = 0
  let n = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const laplacian = gray[i - width] + gray[i + width] + gray[i - 1] + gray[i + 1] - 4 * gray[i]
      sum += laplacian
      sumSquares += laplacian * laplacian
      n++
    }
  }
  const mean = sum / n
  return sumSquares / n - mean * mean
}

/** Index of the highest score; the first one wins a tie. */
export function pickSharpest(scores: number[]): number {
  let best = 0
  for (let i = 1; i < scores.length; i++) if (scores[i] > scores[best]) best = i
  return best
}

/** Size that fits `maxSide` on the long side, keeping the aspect ratio. Never scales up. */
export function scaleToMaxSide(width: number, height: number, maxSide: number) {
  const ratio = Math.min(1, maxSide / Math.max(width, height))
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) }
}
