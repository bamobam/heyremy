// Test fake: a synthetic 21-point MediaPipe hand skeleton, so hand-shape tests need no camera.
//
// The hand is built in 3D in its own frame (right hand; units of one palm length, wrist to the base of
// the middle finger): u across the palm toward the thumb, v along the fingers, w out of the palm.
// Fingers and thumb bend toward the palm (+w) by a `curl` from 0 (straight) to 1 (tight fist). The
// skeleton is then turned to face the camera with the palm or the back of the hand, tilted, rolled in
// the picture and projected with a little perspective, so the same hand can be shown the way the hat
// cam would see it: either side, either hand, any tilt. Landmarks come out normalised 0..1, y down,
// in MediaPipe's order (wrist 0, thumb 1-4, index 5-8, middle 9-12, ring 13-16, pinky 17-20).

import type { Landmark } from '../../camera/recognizer.ts'

type Vec = [number, number, number]

export interface HandPose {
  /** Which hand. Default right. */
  hand?: 'right' | 'left'
  /** Which side faces the camera. Default the palm. */
  facing?: 'palm' | 'back'

  /** How curled each finger is, 0 straight to 1 tight fist. `fingers` sets all four at once. */
  fingers?: number
  index?: number
  middle?: number
  ring?: number
  pinky?: number
  /** How far the fingers fan out, 0 together to 1 relaxed spread. Default 1. */
  spread?: number

  /** Thumb direction in the palm plane, degrees from along the fingers (0) toward out to the side (90). Default 50. */
  thumbSwing?: number
  /** Thumb bend toward the palm, 0 straight to 1 folded across it. Default 0.1. */
  thumbCurl?: number
  /**
   * Turn the hand in the picture so the thumb (knuckle to tip) points this way, in degrees clockwise
   * from straight up: 0 up, 90 right, 180 down. `roll` then adds to it.
   */
  thumbPointing?: number

  /** Tilt of the hand away from the camera, degrees: pitch about the picture's x axis, yaw about its y axis. */
  pitch?: number
  yaw?: number
  /** Turn of the hand in the picture, degrees clockwise. */
  roll?: number

  /** Frame width over height. Default 1 (a square frame). Landmarks are normalised by the frame, as MediaPipe's are. */
  aspect?: number
  /** Palm length as a fraction of the frame height. Default 0.25. */
  size?: number
  /** Camera distance in palm lengths; perspective gets weaker as it grows. Default 5. */
  distance?: number
  /** Landmark jitter, normalised units (uniform, plus or minus). Default 0. */
  noise?: number
  /** Seed for the jitter, so a failing case can be repeated. Default 1. */
  seed?: number
}

const WRIST: Vec = [0, 0, 0]
const THUMB_BASE: Vec = [0.2, 0.14, 0.03]
const THUMB_SEGMENTS = [0.3, 0.24, 0.2] // base to knuckle, knuckle to joint, joint to tip

interface FingerSpec {
  mcp: Vec
  /** Proximal, middle and distal phalanx lengths. */
  segments: [number, number, number]
  /** Sideways fan from along the fingers, degrees toward the thumb side, at full spread. */
  fan: number
}

const FINGERS: FingerSpec[] = [
  { mcp: [0.32, 0.97, 0], segments: [0.38, 0.22, 0.18], fan: 8 },
  { mcp: [0.08, 1.0, 0], segments: [0.42, 0.25, 0.19], fan: 0 },
  { mcp: [-0.15, 0.95, 0], segments: [0.39, 0.23, 0.18], fan: -6 },
  { mcp: [-0.36, 0.84, 0], segments: [0.31, 0.17, 0.16], fan: -14 },
]

/** How far each phalanx bends toward the palm at full curl, degrees: knuckle, middle joint, fingertip joint. */
const FINGER_BEND = [80, 100, 70]
const THUMB_BEND = [30, 40, 35]
/** The way the thumb folds: across the palm and toward the palm side. */
const THUMB_FOLD: Vec = unit([-0.8, 0, 0.6])

const rad = (deg: number) => (deg * Math.PI) / 180
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
function unit(a: Vec): Vec {
  const n = Math.hypot(...a)
  return [a[0] / n, a[1] / n, a[2] / n]
}

/** Turns direction `d` by `angle` degrees toward `toward`, staying a unit vector. */
function bend(d: Vec, toward: Vec, angleDeg: number): Vec {
  const perp = add(toward, scale(d, -dot(toward, d)))
  const n = Math.hypot(...perp)
  if (n < 1e-9) return d
  const a = rad(angleDeg)
  return unit(add(scale(d, Math.cos(a)), scale(perp, Math.sin(a) / n)))
}

/** Walks a chain of segments from `start`, bending each one a share of its full bend by `curl`. Returns the joints after `start`. */
function chain(start: Vec, direction: Vec, lengths: number[], bends: number[], curl: number, toward: Vec): Vec[] {
  const points: Vec[] = []
  let at = start
  let d = direction
  lengths.forEach((length, i) => {
    d = bend(d, toward, bends[i] * curl)
    at = add(at, scale(d, length))
    points.push(at)
  })
  return points
}

/** The skeleton in the hand's own frame (right hand), 21 points. */
function skeleton(pose: HandPose): Vec[] {
  const curls = [pose.index, pose.middle, pose.ring, pose.pinky].map((c) => c ?? pose.fingers ?? 0)
  const palm: Vec = [0, 0, 1]

  // Thumb: base (1), knuckle (2), joint (3), tip (4).
  const swing = rad(pose.thumbSwing ?? 50)
  const thumbDir: Vec = [Math.sin(swing), Math.cos(swing), 0]
  const thumb = chain(THUMB_BASE, thumbDir, THUMB_SEGMENTS, THUMB_BEND, pose.thumbCurl ?? 0.1, THUMB_FOLD)

  const points: Vec[] = [WRIST, THUMB_BASE, ...thumb]
  FINGERS.forEach((finger, i) => {
    const fan = rad(finger.fan * (pose.spread ?? 1))
    const direction: Vec = [Math.sin(fan), Math.cos(fan), 0]
    // The knuckle itself, then the three joints after it.
    points.push(finger.mcp, ...chain(finger.mcp, direction, finger.segments, FINGER_BEND, curls[i], palm))
  })
  return points
}

/** Seeded random numbers in [0, 1), so jitter is repeatable. */
function random(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * The 21 hand landmarks as the camera sees this pose. With no argument: a relaxed open right palm
 * facing the camera, fingers up.
 */
export function makeHand(pose: HandPose = {}): Landmark[] {
  const { facing = 'palm', hand = 'right', pitch = 0, yaw = 0, roll = 0, aspect = 1, size = 0.25, distance = 5, noise = 0, seed = 1 } = pose

  // The hand frame's axes in the camera frame (x right, y down, z away from the camera).
  const v: Vec = [0, -1, 0]
  const w: Vec = facing === 'palm' ? [0, 0, -1] : [0, 0, 1]
  const u: Vec = facing === 'palm' ? [1, 0, 0] : [-1, 0, 0]
  const center: Vec = [0, 0.55, 0]

  const turn = (p: Vec): Vec => {
    // A left hand is a right hand mirrored across the plane that holds the fingers and palm normal.
    const q: Vec = hand === 'left' ? [-p[0], p[1], p[2]] : p
    const r = add(q, scale(center, -1))
    let c = add(add(scale(u, r[0]), scale(v, r[1])), scale(w, r[2]))
    const a = rad(pitch)
    c = [c[0], c[1] * Math.cos(a) - c[2] * Math.sin(a), c[1] * Math.sin(a) + c[2] * Math.cos(a)]
    const b = rad(yaw)
    return [c[0] * Math.cos(b) + c[2] * Math.sin(b), c[1], -c[0] * Math.sin(b) + c[2] * Math.cos(b)]
  }

  // Perspective, in units of the frame's height. The palm centre is on the optical axis.
  const flat = skeleton(pose).map(turn).map(([x, y, z]) => {
    const k = (size * distance) / (distance + z)
    return { x: x * k, y: y * k }
  })

  let rollBy = roll
  if (pose.thumbPointing !== undefined) {
    const dx = flat[4].x - flat[2].x
    const dy = flat[4].y - flat[2].y
    const now = (Math.atan2(dx, -dy) * 180) / Math.PI
    rollBy += pose.thumbPointing - now
  }
  const cos = Math.cos(rad(rollBy))
  const sin = Math.sin(rad(rollBy))
  const jitter = random(seed)
  const noisy = () => (noise === 0 ? 0 : (jitter() * 2 - 1) * noise)

  return flat.map(({ x, y }) => ({
    x: 0.5 + (x * cos - y * sin) / aspect + noisy(),
    y: 0.5 + (x * sin + y * cos) + noisy(),
  }))
}

// Named poses. Each takes the orientation and tilt options on top.
type Orientation = Pick<HandPose, 'hand' | 'facing' | 'pitch' | 'yaw' | 'roll' | 'aspect' | 'size' | 'distance' | 'noise' | 'seed'>

/** Every finger straight and spread, thumb out. */
export const openHand = (o: Orientation = {}) => makeHand({ ...o })

/** A tight fist, thumb folded across the fingers. */
export const fist = (o: Orientation = {}) => makeHand({ fingers: 1, thumbSwing: 25, thumbCurl: 0.9, ...o })

/** A fist with the thumb straight out and pointing the given way (degrees clockwise from up). Default straight up. */
export const thumbsUp = (o: Orientation = {}, pointing = 0) =>
  makeHand({ fingers: 1, thumbSwing: 80, thumbCurl: 0, thumbPointing: pointing, ...o })

/** The same, pointing straight down. */
export const thumbsDown = (o: Orientation = {}, pointing = 180) => thumbsUp(o, pointing)

/** Index and middle fingers up and apart, the rest folded. */
export const victory = (o: Orientation = {}) =>
  makeHand({ index: 0, middle: 0, ring: 1, pinky: 1, thumbSwing: 25, thumbCurl: 0.8, ...o })

/** Index finger up, the rest folded. */
export const pointing = (o: Orientation = {}) =>
  makeHand({ index: 0, middle: 1, ring: 1, pinky: 1, thumbSwing: 25, thumbCurl: 0.8, ...o })

/** A flat hand with the fingers together and the thumb tucked against it, as when pressing dough. */
export const flatHandThumbIn = (o: Orientation = {}) => makeHand({ spread: 0.2, thumbSwing: 8, thumbCurl: 0.5, ...o })
