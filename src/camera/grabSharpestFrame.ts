import { laplacianVariance, scaleToMaxSide, toGrayscale } from './sharpness.ts'

export type GrabErrorKind = 'camera_unavailable' | 'encode_failed'

export class GrabError extends Error {
  readonly kind: GrabErrorKind
  constructor(kind: GrabErrorKind) {
    super(kind)
    this.name = 'GrabError'
    this.kind = kind
  }
}

export interface GrabResult {
  /** The sharpest frame as a JPEG. */
  blob: Blob
  width: number
  height: number
  /** Sharpness score of every captured frame, in capture order. */
  scores: number[]
  /** Index into scores of the frame that was kept. */
  chosen: number
}

export interface GrabOptions {
  /** How many frames to capture. Default 6. */
  frames?: number
  /** Time the captures are spread over. Default 500 ms. */
  spanMs?: number
  /** Long side of the output image. Default 768 px. */
  maxSide?: number
  /** JPEG quality, 0..1. Default 0.8. */
  quality?: number
}

/** A canvas, reduced to what the capture needs, so tests can swap it. */
export interface Surface {
  resize(width: number, height: number): void
  draw(video: HTMLVideoElement): void
  getPixels(): { data: Uint8ClampedArray; width: number; height: number }
  toBlob(quality: number): Promise<Blob>
}

export interface GrabEnv {
  /** Small copy, used only to score sharpness. */
  analysis: Surface
  /** Full-size copy of the best frame so far. */
  output: Surface
  sleep(ms: number): Promise<void>
}

/** Long side of the copy used for scoring: small, because only edges matter. */
const ANALYSIS_SIDE = 160

function canvasSurface(): Surface {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  return {
    resize(width, height) {
      canvas.width = width
      canvas.height = height
    },
    draw(video) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    },
    getPixels() {
      return ctx.getImageData(0, 0, canvas.width, canvas.height)
    },
    toBlob(quality) {
      return new Promise((resolve, reject) =>
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new GrabError('encode_failed'))), 'image/jpeg', quality),
      )
    },
  }
}

const browserEnv = (): GrabEnv => ({
  analysis: canvasSurface(),
  output: canvasSurface(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
})

function assertCameraReady(video: HTMLVideoElement) {
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    throw new GrabError('camera_unavailable')
  }
}

/**
 * Captures several frames over a short time and returns the sharpest as a
 * JPEG. Head movement blurs the hat cam, so one frame is often a bad one.
 * Rejects with camera_unavailable if the video has no data, including if the
 * camera stops partway through.
 */
export async function grabSharpestFrame(
  video: HTMLVideoElement,
  { frames = 6, spanMs = 500, maxSide = 768, quality = 0.8 }: GrabOptions = {},
  env: GrabEnv = browserEnv(),
): Promise<GrabResult> {
  assertCameraReady(video)

  const analysisSize = scaleToMaxSide(video.videoWidth, video.videoHeight, ANALYSIS_SIDE)
  const outputSize = scaleToMaxSide(video.videoWidth, video.videoHeight, maxSide)
  env.analysis.resize(analysisSize.width, analysisSize.height)
  env.output.resize(outputSize.width, outputSize.height)

  const gap = frames > 1 ? spanMs / (frames - 1) : 0
  const scores: number[] = []
  let best = -Infinity
  let chosen = 0

  for (let i = 0; i < frames; i++) {
    if (i > 0) {
      await env.sleep(gap)
      assertCameraReady(video)
    }
    env.analysis.draw(video)
    const { data, width, height } = env.analysis.getPixels()
    const score = laplacianVariance(toGrayscale(data), width, height)
    scores.push(score)
    // Keep a full-size copy only of the best frame so far; ties keep the earlier one.
    if (score > best) {
      best = score
      chosen = i
      env.output.draw(video)
    }
  }

  const blob = await env.output.toBlob(quality)
  return { blob, width: outputSize.width, height: outputSize.height, scores, chosen }
}
