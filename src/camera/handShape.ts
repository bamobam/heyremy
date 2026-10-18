// Reads a hand shape straight from the 21 MediaPipe hand landmarks, so a gesture still counts when
// MediaPipe's own label misses it. MediaPipe's stock labels read a palm facing the camera well and the
// back of a hand poorly, and the hat cam looks down, so backs of hands are the common case (ADR 0001).
//
// Pure: no camera, DOM or clock. Everything here is measured from distances between landmarks, never
// from which way the palm faces, so the answer is the same for a left or right hand, palm or back
// toward the camera, and a hand turned or tilted (the tests cover about 35 degrees).
//
// Conservative on purpose: a hand that is not clearly open, thumb up or thumb down is 'other'. A false
// trigger while stirring or chopping is worse than a miss, and the gesture filter (hold, score,
// cooldown) still stands behind this.

// Landmark order: wrist 0; thumb 1-4 (base, knuckle, joint, tip); then index 5-8, middle 9-12, ring 13-16
// and pinky 17-20, each knuckle, middle joint, far joint, tip.
type Point = { x: number; y: number }

export type HandShape = 'open' | 'thumb_up' | 'thumb_down' | 'other'

export interface HandShapeReading {
  shape: HandShape
  /**
   * 0..1. For open and the thumbs: how clearly the hand makes that shape (the weakest of the things it
   * needs). For 'other': how clearly it is none of them, so a half-formed shape is low and a fist is high.
   * 0 when there is nothing to read.
   */
  confidence: number
}

export interface HandShapeOptions {
  /**
   * Frame width over height. Landmarks are normalised by each side, so on a 16:9 frame a step sideways
   * is worth more than the same step up. Without it every angle and distance is skewed. Default 1.
   */
  aspect?: number
}

/** A shape needs at least this much confidence to be called; below it the hand is 'other'. */
const MIN_SHAPE = 0.5
/** A hand smaller than this (palm length, as a fraction of frame height) is too small to measure. */
const MIN_HAND_SIZE = 0.04
/** Typical palm width over palm length, to size a hand turned so its length is foreshortened. */
const PALM_WIDTH_TO_LENGTH = 0.72

// Every threshold below is a ramp: nothing at the first number, full at the second, smooth between (a
// "falling" one is used as 1 minus the ramp). They were set on synthetic hands (src/test/fakes/hand.ts),
// so they need checking against a real hat cam. The dev tag shows what a real hand reads as.

/**
 * A finger is extended when its tip is further from the wrist than its middle joint, by this much
 * (tip distance over middle-joint distance; about 1.3 straight, 0.7 in a fist).
 */
const EXTENDED_REACH: Ramp = [1.09, 1.21]
/** ... and the finger runs straight (knuckle-to-tip over the length of its bones; 1 is dead straight). */
const EXTENDED_STRAIGHT: Ramp = [0.82, 0.93]
/** A finger is curled when that same ratio is this low (falling ramp). */
const CURLED_REACH: Ramp = [0.88, 1.05]

/**
 * How far the thumb points away from the hand: degrees from along the hand (wrist to middle knuckle)
 * toward the thumb side. About 45 on an open hand, 70 or more on a thumb stuck out of a fist, and
 * negative or near 0 for a thumb folded across a fist or tucked against a flat hand.
 */
const OPEN_THUMB_OUT: Ramp = [18, 34]
/** The same, for a thumbs-up or thumbs-down, which want the thumb clearly out. */
const THUMB_OUT: Ramp = [40, 58]
/** Thumb knuckle to tip, in palm lengths (about 0.45 unforeshortened; a stub is a thumb pointing at the camera, whose direction means nothing). */
const THUMB_LENGTH: Ramp = [0.15, 0.27]
/** Thumb knuckle-to-tip over the length of its bones. */
const THUMB_STRAIGHT: Ramp = [0.8, 0.9]
/** How far the thumb may lean off straight up or down, degrees (falling ramp). */
const THUMB_LEAN: Ramp = [40, 65]

type Ramp = readonly [from: number, to: number]

/** 0 at or below `from`, 1 at or above `to`, a smooth S between. */
function ramp(value: number, [from, to]: Ramp): number {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

const other = (confidence: number): HandShapeReading => ({ shape: 'other', confidence })

/** Classifies one hand. `landmarks` are the 21 MediaPipe points, normalised 0..1, y down. */
export function classifyHandShape(landmarks: readonly Point[], options: HandShapeOptions = {}): HandShapeReading {
  if (landmarks.length !== 21) return other(0)
  const { aspect = 1 } = options
  const wide = Number.isFinite(aspect) && aspect > 0 ? aspect : 1
  // Work in units of the frame's height, so distances mean the same sideways and up.
  const p = landmarks.map(({ x, y }) => ({ x: x * wide, y }))
  if (p.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y))) return other(0)

  const dist = (a: number, b: number) => Math.hypot(p[a].x - p[b].x, p[a].y - p[b].y)

  // The hand's size: palm length, or palm width if the hand points at the camera and its length is foreshortened.
  const size = Math.max(dist(0, 9), dist(5, 17) / PALM_WIDTH_TO_LENGTH)
  if (size < MIN_HAND_SIZE) return other(0)

  const fingers = [5, 9, 13, 17].map((knuckle) => {
    const [middle, far, tip] = [knuckle + 1, knuckle + 2, knuckle + 3]
    const reach = dist(0, tip) / dist(0, middle)
    const straight = dist(knuckle, tip) / (dist(knuckle, middle) + dist(middle, far) + dist(far, tip))
    return {
      extended: Math.min(ramp(reach, EXTENDED_REACH), ramp(straight, EXTENDED_STRAIGHT)),
      curled: 1 - ramp(reach, CURLED_REACH),
    }
  })
  const extended = Math.min(...fingers.map((f) => f.extended))
  const curled = Math.min(...fingers.map((f) => f.curled))

  // Thumb, from its knuckle (2) to its tip (4).
  const thumb = { x: p[4].x - p[2].x, y: p[4].y - p[2].y }
  const length = Math.hypot(thumb.x, thumb.y)
  if (length === 0) return other(0)
  // Which way the thumb points relative to the hand itself: along the hand (wrist to middle knuckle)
  // and across it toward the thumb side (little finger knuckle to index knuckle). Made of landmarks, so it
  // flips with the hand: the same for a left or right hand, palm or back.
  const along = unit(p[9].x - p[0].x, p[9].y - p[0].y)
  const across = unit(p[5].x - p[17].x, p[5].y - p[17].y)
  const out = (Math.atan2(thumb.x * across.x + thumb.y * across.y, thumb.x * along.x + thumb.y * along.y) * 180) / Math.PI
  const thumbStraight = ramp(length / (dist(2, 3) + dist(3, 4)), THUMB_STRAIGHT)
  const thumbLength = ramp(length / size, THUMB_LENGTH)

  // Which way it points in the picture, degrees from straight up (the cook's thumbs-up is up in the picture).
  const lean = (Math.atan2(thumb.x, -thumb.y) * 180) / Math.PI
  const fromUp = Math.abs(lean)
  const fromDown = 180 - fromUp
  const thumbOutStrong = Math.min(ramp(out, THUMB_OUT), thumbLength, thumbStraight)
  const thumbShape = Math.min(curled, thumbOutStrong)

  const scores = {
    open: Math.min(extended, ramp(out, OPEN_THUMB_OUT)),
    thumb_up: Math.min(thumbShape, 1 - ramp(fromUp, THUMB_LEAN)),
    thumb_down: Math.min(thumbShape, 1 - ramp(fromDown, THUMB_LEAN)),
  }
  // A landmark sitting exactly on another (a broken frame) can make a ratio 0/0: nothing to read then.
  if (Object.values(scores).some(Number.isNaN)) return other(0)
  const best = (Object.keys(scores) as (keyof typeof scores)[]).reduce((a, b) => (scores[b] > scores[a] ? b : a))
  return scores[best] >= MIN_SHAPE ? { shape: best, confidence: scores[best] } : other(1 - scores[best])
}

function unit(x: number, y: number): Point {
  const n = Math.hypot(x, y)
  return n === 0 ? { x: 0, y: 0 } : { x: x / n, y: y / n }
}
