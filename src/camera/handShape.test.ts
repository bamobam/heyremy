import { describe, expect, it } from 'vitest'
import {
  fist,
  flatHandThumbIn,
  makeHand,
  openHand,
  pointing,
  thumbsDown,
  thumbsUp,
  victory,
  type HandPose,
} from '../test/fakes/hand.ts'
import { classifyHandShape } from './handShape.ts'

// Every way the hat cam can see a hand: either hand, palm or back toward the camera.
const SIDES = [
  { hand: 'right', facing: 'palm' },
  { hand: 'left', facing: 'palm' },
  { hand: 'right', facing: 'back' },
  { hand: 'left', facing: 'back' },
] as const

// Tilted away from the camera by up to about 35 degrees, in each direction.
const TILTS: Pick<HandPose, 'pitch' | 'yaw'>[] = [
  {},
  { pitch: 35 },
  { pitch: -35 },
  { yaw: 35 },
  { yaw: -35 },
  { pitch: 25, yaw: -25 },
  { pitch: -25, yaw: 25 },
]

const label = (o: object) => JSON.stringify(o)
const cases = SIDES.flatMap((side) => TILTS.map((tilt) => ({ ...side, ...tilt })))

/** What the filter asks of a reading: at least this sure, or it counts as no gesture. */
const SURE_ENOUGH = 0.8

describe('an open hand', () => {
  it.each(cases)('is open, palm or back, left or right, tilted: %j', (o) => {
    const { shape, confidence } = classifyHandShape(openHand(o))
    expect(shape).toBe('open')
    expect(confidence).toBeGreaterThanOrEqual(SURE_ENOUGH)
  })

  it.each([0, 35, -35, 90, 180, 270])('is open however it is turned in the picture (%i degrees)', (roll) => {
    for (const side of SIDES) {
      expect(classifyHandShape(openHand({ ...side, roll })).shape).toBe('open')
    }
  })

  it('is open with the fingers relaxed and a little bent', () => {
    for (const side of SIDES) {
      expect(classifyHandShape(makeHand({ ...side, fingers: 0.15 })).shape).toBe('open')
    }
  })

  it('is open with the fingers together, if the thumb is out', () => {
    for (const side of SIDES) {
      expect(classifyHandShape(makeHand({ ...side, spread: 0 })).shape).toBe('open')
    }
  })
})

describe('a thumbs-up', () => {
  it.each(cases)('is thumb_up, palm or back, left or right, tilted: %j', (o) => {
    const { shape, confidence } = classifyHandShape(thumbsUp(o))
    expect(shape).toBe('thumb_up')
    expect(confidence).toBeGreaterThanOrEqual(SURE_ENOUGH)
  })

  it.each([-35, 35])('is still thumb_up with the thumb leaning %i degrees off straight up', (lean) => {
    for (const side of SIDES) {
      expect(classifyHandShape(thumbsUp(side, lean)).shape).toBe('thumb_up')
      expect(classifyHandShape(thumbsUp({ ...side, pitch: 25 }, lean)).shape).toBe('thumb_up')
    }
  })

  it('is thumb_up for a tighter or looser fist', () => {
    for (const side of SIDES) {
      for (const fingers of [0.85, 1]) {
        expect(classifyHandShape(makeHand({ ...side, fingers, thumbSwing: 80, thumbCurl: 0, thumbPointing: 0 })).shape).toBe(
          'thumb_up',
        )
      }
    }
  })
})

describe('a thumbs-down', () => {
  it.each(cases)('is thumb_down, palm or back, left or right, tilted: %j', (o) => {
    const { shape, confidence } = classifyHandShape(thumbsDown(o))
    expect(shape).toBe('thumb_down')
    expect(confidence).toBeGreaterThanOrEqual(SURE_ENOUGH)
  })

  it.each([-35, 35])('is still thumb_down with the thumb leaning %i degrees off straight down', (lean) => {
    for (const side of SIDES) {
      expect(classifyHandShape(thumbsDown(side, 180 + lean)).shape).toBe('thumb_down')
    }
  })
})

describe('a thumb that does not point up or down', () => {
  it.each([90, 270, 75, 285, 120, 240])('is other when it points %i degrees round from up', (pointingAt) => {
    for (const side of SIDES) {
      expect(classifyHandShape(thumbsUp(side, pointingAt)).shape).toBe('other')
    }
  })
})

describe('shapes that must never fire', () => {
  it.each(cases)('a fist is other, and clearly so: %j', (o) => {
    const { shape, confidence } = classifyHandShape(fist(o))
    expect(shape).toBe('other')
    expect(confidence).toBeGreaterThanOrEqual(SURE_ENOUGH)
  })

  it.each(cases)('victory is other: %j', (o) => {
    expect(classifyHandShape(victory(o)).shape).toBe('other')
  })

  it.each(cases)('pointing is other: %j', (o) => {
    expect(classifyHandShape(pointing(o)).shape).toBe('other')
  })

  it.each(cases)('a flat hand with the thumb tucked in (pressing dough) is other: %j', (o) => {
    expect(classifyHandShape(flatHandThumbIn(o)).shape).toBe('other')
  })

  it('a fist is other however it is turned, even when the folded thumb happens to point up or down', () => {
    for (const side of SIDES) {
      for (const roll of [0, 45, 90, 135, 180, 225, 270, 315]) {
        expect(classifyHandShape(fist({ ...side, roll })).shape).toBe('other')
      }
    }
  })

  it('thumb, index and little finger out (I love you) is other', () => {
    for (const side of SIDES) {
      const shape = classifyHandShape(makeHand({ ...side, index: 0, middle: 1, ring: 1, pinky: 0, thumbSwing: 80, thumbCurl: 0 })).shape
      expect(shape).toBe('other')
    }
  })

  it('an open hand with one finger folded is other', () => {
    for (const side of SIDES) {
      for (const folded of ['index', 'middle', 'ring', 'pinky'] as const) {
        expect(classifyHandShape(makeHand({ ...side, [folded]: 1 })).shape).toBe('other')
      }
    }
  })

  it('a thumb up over fingers that are hardly curled (a hand held out) is not a thumbs-up', () => {
    for (const side of SIDES) {
      for (const fingers of [0.2, 0.3, 0.4]) {
        const hand = makeHand({ ...side, fingers, thumbSwing: 80, thumbCurl: 0, thumbPointing: 0 })
        expect(classifyHandShape(hand).shape).not.toBe('thumb_up')
      }
    }
  })
})

describe('fingers and thumbs the fixtures cannot pose directly', () => {
  type Points = { x: number; y: number }[]
  /** Folds the last joint of every finger over by `degrees`, in the picture, leaving the rest of the finger straight. */
  const hookTips = (hand: Points, degrees: number): Points => {
    const out = hand.map((p) => ({ ...p }))
    const a = (degrees * Math.PI) / 180
    for (const knuckle of [5, 9, 13, 17]) {
      const joint = hand[knuckle + 2]
      const vx = hand[knuckle + 3].x - joint.x
      const vy = hand[knuckle + 3].y - joint.y
      out[knuckle + 3] = { x: joint.x + vx * Math.cos(a) - vy * Math.sin(a), y: joint.y + vx * Math.sin(a) + vy * Math.cos(a) }
    }
    return out
  }
  /** Bends the thumb at its joint (3), turning the tip by `degrees` in the picture. */
  const bendThumbTip = (hand: Points, degrees: number): Points => {
    const out = hand.map((p) => ({ ...p }))
    const a = (degrees * Math.PI) / 180
    const vx = hand[4].x - hand[3].x
    const vy = hand[4].y - hand[3].y
    out[4] = { x: hand[3].x + vx * Math.cos(a) - vy * Math.sin(a), y: hand[3].y + vx * Math.sin(a) + vy * Math.cos(a) }
    return out
  }
  /** Pulls the thumb's joint and tip toward its knuckle, as when it points at the camera and is foreshortened. */
  const shrinkThumb = (hand: Points, k: number): Points => {
    const out = hand.map((p) => ({ ...p }))
    for (const i of [3, 4]) {
      out[i] = { x: hand[2].x + k * (hand[i].x - hand[2].x), y: hand[2].y + k * (hand[i].y - hand[2].y) }
    }
    return out
  }

  it('fingertips a little bent are still an open hand', () => {
    for (const side of SIDES) expect(classifyHandShape(hookTips(openHand(side), 30)).shape).toBe('open')
  })

  it('fingertips hooked well over (a claw) are not an open hand, though the tips stay far from the wrist', () => {
    for (const side of SIDES) {
      for (const degrees of [75, 90, -75, -90]) expect(classifyHandShape(hookTips(openHand(side), degrees)).shape).toBe('other')
    }
  })

  it('a thumb whose tip is bent over is not a thumbs-up, whichever way it bends', () => {
    for (const side of SIDES) {
      for (const degrees of [90, -90]) expect(classifyHandShape(bendThumbTip(thumbsUp(side), degrees)).shape).toBe('other')
    }
  })

  it('a thumb at full length is a thumbs-up, and the same thumb foreshortened to a stub is not', () => {
    for (const side of SIDES) {
      expect(classifyHandShape(shrinkThumb(thumbsUp(side), 1)).shape).toBe('thumb_up')
      expect(classifyHandShape(shrinkThumb(thumbsUp(side), 0.3)).shape).toBe('other')
    }
  })
})

describe('mid-motion', () => {
  // A hand closing or opening passes through half-curled fingers. Those frames must read as other.
  // Seen face on. A half-curled hand tilted with its fingertips away from the camera looks like a
  // straight one in a flat picture, so there is nothing to tell them apart by; the 1 s hold covers that.
  it.each([0.4, 0.5, 0.6, 0.7])('fingers half curled (%d) are not an open hand, from any side', (fingers) => {
    for (const side of SIDES) {
      expect(classifyHandShape(makeHand({ ...side, fingers })).shape).toBe('other')
    }
  })

  it('a hand closing goes from open to other, never a thumb shape and never back to open', () => {
    for (const side of SIDES) {
      const shapes = Array.from({ length: 21 }, (_, i) => classifyHandShape(makeHand({ ...side, fingers: i / 20 })).shape)
      expect(shapes).not.toContain('thumb_up')
      expect(shapes).not.toContain('thumb_down')
      // Open at one end, other for the rest, with no flicker back to open.
      const lastOpen = shapes.lastIndexOf('open')
      expect(shapes.slice(0, lastOpen + 1).every((s) => s === 'open')).toBe(true)
      expect(shapes[0]).toBe('open')
      expect(shapes[20]).toBe('other')
    }
  })

  it('the thumb swinging from tucked to out is open only once it is clearly out', () => {
    for (const side of SIDES) {
      expect(classifyHandShape(makeHand({ ...side, thumbSwing: 5, thumbCurl: 0.5 })).shape).toBe('other')
      expect(classifyHandShape(makeHand({ ...side, thumbSwing: 50, thumbCurl: 0.1 })).shape).toBe('open')
    }
  })
})

describe('a shaky hand', () => {
  // MediaPipe landmarks jitter by a fraction of a percent of the frame.
  const seeds = Array.from({ length: 25 }, (_, i) => i + 1)
  const noise = 0.004

  it.each([
    ['open', openHand, 'open'],
    ['thumbs-up', thumbsUp, 'thumb_up'],
    ['thumbs-down', thumbsDown, 'thumb_down'],
    ['fist', fist, 'other'],
    ['victory', victory, 'other'],
  ] as const)('%s keeps its reading under jitter', (_name, make, expected) => {
    for (const side of SIDES) {
      for (const seed of seeds) {
        expect(classifyHandShape(make({ ...side, noise, seed })).shape).toBe(expected)
      }
    }
  })

  it('shows how sure it is: a clean hand is surer than a shaky one', () => {
    const clean = classifyHandShape(openHand()).confidence
    const shaky = classifyHandShape(openHand({ noise: 0.01, seed: 3 })).confidence
    expect(clean).toBeGreaterThanOrEqual(shaky)
  })
})

describe('the frame is not square', () => {
  // Landmarks are normalised by frame width and height, so a 16:9 frame stretches sideways distances.
  const wide = 16 / 9

  it('reads the same as in a square frame when told the aspect', () => {
    for (const side of SIDES) {
      expect(classifyHandShape(openHand({ ...side, aspect: wide, pitch: 35 }), { aspect: wide }).shape).toBe('open')
      expect(classifyHandShape(thumbsUp({ ...side, aspect: wide, yaw: 35 }, 35), { aspect: wide }).shape).toBe('thumb_up')
      expect(classifyHandShape(thumbsDown({ ...side, aspect: wide }, 215), { aspect: wide }).shape).toBe('thumb_down')
      expect(classifyHandShape(fist({ ...side, aspect: wide, pitch: 35 }), { aspect: wide }).shape).toBe('other')
    }
  })

  it('does not take a thumb pointing mostly sideways for a thumbs-up just because the frame is wide', () => {
    for (const side of SIDES) {
      expect(classifyHandShape(thumbsUp({ ...side, aspect: wide }, 65), { aspect: wide }).shape).toBe('other')
      expect(classifyHandShape(thumbsDown({ ...side, aspect: wide }, 115), { aspect: wide }).shape).toBe('other')
    }
  })

  it('treats a missing or nonsense aspect as square', () => {
    for (const aspect of [undefined, 0, -1, Number.NaN, Infinity]) {
      expect(classifyHandShape(openHand(), { aspect }).shape).toBe('open')
    }
  })
})

describe('mirrored pictures', () => {
  const mirror = (landmarks: { x: number; y: number }[]) => landmarks.map(({ x, y }) => ({ x: 1 - x, y }))

  it.each([
    ['open', openHand, 'open'],
    ['thumbs-up', thumbsUp, 'thumb_up'],
    ['thumbs-down', thumbsDown, 'thumb_down'],
    ['fist', fist, 'other'],
  ] as const)('a mirrored %s reads the same', (_name, make, expected) => {
    for (const side of SIDES) {
      expect(classifyHandShape(mirror(make({ ...side, pitch: 20 }))).shape).toBe(expected)
    }
  })
})

describe('bad input', () => {
  it('is other with no confidence for too few landmarks', () => {
    expect(classifyHandShape([])).toEqual({ shape: 'other', confidence: 0 })
    expect(classifyHandShape(openHand().slice(0, 20))).toEqual({ shape: 'other', confidence: 0 })
  })

  it('is other with no confidence for a landmark that is not a number', () => {
    const hand = openHand()
    hand[8] = { x: Number.NaN, y: 0.2 }
    expect(classifyHandShape(hand)).toEqual({ shape: 'other', confidence: 0 })
  })

  it('is other with no confidence for a hand collapsed to a point', () => {
    const point = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }))
    expect(classifyHandShape(point)).toEqual({ shape: 'other', confidence: 0 })
  })

  it('is other with no confidence for a hand too small in the frame to read', () => {
    expect(classifyHandShape(openHand({ size: 0.02 }))).toEqual({ shape: 'other', confidence: 0 })
  })

  it('is other with no confidence when landmarks sit exactly on top of each other', () => {
    for (const joint of [6, 10, 14, 18]) {
      const hand = openHand()
      hand[joint] = { ...hand[0] } // a finger's middle joint and tip both on the wrist
      hand[joint + 2] = { ...hand[0] }
      const { shape, confidence } = classifyHandShape(hand)
      expect(shape).toBe('other')
      expect(Number.isFinite(confidence)).toBe(true)
    }
    const thumb = openHand()
    thumb[4] = { ...thumb[2] } // thumb tip on its knuckle
    expect(classifyHandShape(thumb)).toEqual({ shape: 'other', confidence: 0 })
  })

  it('keeps the confidence between 0 and 1', () => {
    for (const make of [openHand, thumbsUp, thumbsDown, fist, victory, pointing, flatHandThumbIn]) {
      for (const tilt of TILTS) {
        const { confidence } = classifyHandShape(make({ ...tilt, noise: 0.01 }))
        expect(confidence).toBeGreaterThanOrEqual(0)
        expect(confidence).toBeLessThanOrEqual(1)
      }
    }
  })

  it('does not change the landmarks it is given', () => {
    const hand = thumbsUp({ pitch: 20 })
    const before = label(hand)
    classifyHandShape(hand)
    expect(label(hand)).toBe(before)
  })
})
