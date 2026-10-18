import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTER_CONFIG } from './gestureFilter.ts'
import { FALLBACK_MAPPING, MAPPING, mapDetection, mapGesture, readGesture } from './gestureMapper.ts'
import type { HandShape } from './handShape.ts'
import type { Detection } from './recognizer.ts'

const detection = (label: string, handPresent = true): Detection => ({
  label,
  score: 0.9,
  handPresent,
  landmarks: handPresent ? [] : null,
})

describe('mapGesture with the default mapping', () => {
  it.each([
    ['Thumb_Up', 'next'],
    ['Thumb_Down', 'back'],
    ['Open_Palm', 'check'],
  ] as const)('maps %s to %s', (label, intent) => {
    expect(mapGesture(label)).toBe(intent)
  })

  it.each(['None', 'Closed_Fist', 'Victory', 'Pointing_Up', 'ILoveYou', '', 'nonsense'])(
    'ignores %s',
    (label) => {
      expect(mapGesture(label)).toBeNull()
    },
  )

  it('does not match inherited object keys', () => {
    expect(mapGesture('toString')).toBeNull()
    expect(mapGesture('constructor')).toBeNull()
  })
})

describe('the fallback mapping, for when thumbs read badly from the hat', () => {
  it.each([
    ['Closed_Fist', 'next'],
    ['Victory', 'back'],
    ['Open_Palm', 'check'],
  ] as const)('maps %s to %s', (label, intent) => {
    expect(mapGesture(label, FALLBACK_MAPPING)).toBe(intent)
  })

  it('no longer reacts to the thumbs', () => {
    expect(mapGesture('Thumb_Up', FALLBACK_MAPPING)).toBeNull()
    expect(mapGesture('Thumb_Down', FALLBACK_MAPPING)).toBeNull()
  })

  it('keeps open palm as check in both mappings', () => {
    expect(MAPPING.Open_Palm).toBe('check')
    expect(FALLBACK_MAPPING.Open_Palm).toBe('check')
  })
})

describe('mapDetection', () => {
  it('maps a detection with a hand', () => {
    expect(mapDetection(detection('Thumb_Up'))).toBe('next')
  })

  it('returns null with no hand, whatever the label says', () => {
    expect(mapDetection(detection('Thumb_Up', false))).toBeNull()
  })

  it('uses the mapping it is given', () => {
    expect(mapDetection(detection('Closed_Fist'), FALLBACK_MAPPING)).toBe('next')
  })
})

describe('readGesture', () => {
  const read = (label: string, score: number, shape?: [HandShape, number], handPresent = true): Detection => ({
    label,
    score,
    handPresent,
    landmarks: handPresent ? [] : null,
    ...(shape && { shape: { shape: shape[0], confidence: shape[1] } }),
  })

  describe('when MediaPipe knows the gesture', () => {
    it('uses its label and score, as mapDetection does', () => {
      expect(readGesture(read('Thumb_Up', 0.93))).toEqual({ intent: 'next', score: 0.93, source: 'model' })
      expect(readGesture(read('Thumb_Down', 0.8))).toEqual({ intent: 'back', score: 0.8, source: 'model' })
      expect(readGesture(read('Open_Palm', 0.9))).toEqual({ intent: 'check', score: 0.9, source: 'model' })
    })

    it('keeps the label even when the hand shape says something else', () => {
      expect(readGesture(read('Thumb_Up', 0.9, ['open', 0.99]))).toEqual({ intent: 'next', score: 0.9, source: 'model' })
      expect(readGesture(read('Open_Palm', 0.8, ['thumb_down', 0.99]))).toEqual({ intent: 'check', score: 0.8, source: 'model' })
    })

    it('counts an open palm as sure from 0.6 and the thumbs from 0.7, as the filter does', () => {
      expect(readGesture(read('Open_Palm', 0.6, ['open', 0.95]))?.source).toBe('model')
      expect(readGesture(read('Thumb_Up', 0.7, ['thumb_up', 0.95]))?.source).toBe('model')
      expect(readGesture(read('Thumb_Up', 0.69, ['thumb_up', 0.95]))?.source).toBe('shape')
    })

    it('follows a filter config with other thresholds', () => {
      const strict = { ...DEFAULT_FILTER_CONFIG, minScore: 0.9, minScoreFor: {} }
      expect(readGesture(read('Thumb_Up', 0.85, ['thumb_up', 0.95]), MAPPING, strict)?.source).toBe('shape')
      expect(readGesture(read('Thumb_Up', 0.95, ['open', 0.95]), MAPPING, strict)?.source).toBe('model')
    })
  })

  describe('when MediaPipe does not know it, the hand shape steps in', () => {
    it.each([
      ['open', 'check'],
      ['thumb_up', 'next'],
      ['thumb_down', 'back'],
    ] as const)('maps %s to %s with the shape\'s own confidence', (shape, intent) => {
      expect(readGesture(read('None', 0.3, [shape, 0.91]))).toEqual({ intent, score: 0.91, source: 'shape' })
    })

    it('works for a back of the hand MediaPipe called a fist', () => {
      expect(readGesture(read('Closed_Fist', 0.95, ['thumb_up', 0.88]))).toEqual({ intent: 'next', score: 0.88, source: 'shape' })
    })

    it('works when MediaPipe returned a label the mapping ignores, or a score of nothing', () => {
      expect(readGesture(read('Victory', 0.9, ['open', 0.8]))?.source).toBe('shape')
      expect(readGesture(read('None', 0, ['open', 0.8]))?.source).toBe('shape')
    })

    it('takes over from a label that maps but is not sure enough', () => {
      expect(readGesture(read('Thumb_Down', 0.55, ['thumb_down', 0.9]))).toEqual({ intent: 'back', score: 0.9, source: 'shape' })
    })

    it('takes the shape\'s score, so a weak shape stays weak for the filter', () => {
      expect(readGesture(read('None', 0, ['thumb_up', 0.55]))).toEqual({ intent: 'next', score: 0.55, source: 'shape' })
    })

    it('is null when the shape is other', () => {
      expect(readGesture(read('None', 0.2, ['other', 0.9]))).toBeNull()
      expect(readGesture(read('Closed_Fist', 0.9, ['other', 0.9]))).toBeNull()
    })

    it('is null with no shape and no label that maps', () => {
      expect(readGesture(read('None', 0.9))).toBeNull()
      expect(readGesture(read('Victory', 0.9))).toBeNull()
    })
  })

  describe('when the two disagree and MediaPipe is not sure', () => {
    it('keeps the stronger reading, which the filter then drops if it is too weak', () => {
      // Thumb_Up 0.65 is under 0.7; the open-hand shape is surer, so it wins ...
      expect(readGesture(read('Thumb_Up', 0.65, ['open', 0.9]))).toEqual({ intent: 'check', score: 0.9, source: 'shape' })
      // ... but a weak shape does not override a label that is nearly sure.
      expect(readGesture(read('Thumb_Up', 0.65, ['open', 0.62]))).toEqual({ intent: 'next', score: 0.65, source: 'model' })
    })
  })

  describe('with no usable label and no shape', () => {
    it('hands back a label that maps but is not sure, exactly as mapDetection would, for the filter to drop', () => {
      expect(readGesture(read('Thumb_Up', 0.5))).toEqual({ intent: 'next', score: 0.5, source: 'model' })
      expect(readGesture(read('Thumb_Up', 0.5, ['other', 0.9]))).toEqual({ intent: 'next', score: 0.5, source: 'model' })
    })
  })

  describe('with no hand', () => {
    it('is null, whatever the label or shape says', () => {
      expect(readGesture(read('Thumb_Up', 0.99, ['thumb_up', 0.99], false))).toBeNull()
    })
  })

  describe('with the hour-1 fallback mapping', () => {
    it('lets the shape make open palm a check, as the labels do', () => {
      expect(readGesture(read('None', 0, ['open', 0.9]), FALLBACK_MAPPING)).toEqual({ intent: 'check', score: 0.9, source: 'shape' })
    })

    it('does not bring the thumbs back through the shape, since the mapping dropped them', () => {
      expect(readGesture(read('None', 0, ['thumb_up', 0.95]), FALLBACK_MAPPING)).toBeNull()
      expect(readGesture(read('None', 0, ['thumb_down', 0.95]), FALLBACK_MAPPING)).toBeNull()
    })

    it('still reads the labels it maps', () => {
      expect(readGesture(read('Closed_Fist', 0.9), FALLBACK_MAPPING)).toEqual({ intent: 'next', score: 0.9, source: 'model' })
    })
  })

  it('agrees with mapDetection about the intent whenever there is no shape', () => {
    for (const label of ['Thumb_Up', 'Thumb_Down', 'Open_Palm', 'Closed_Fist', 'Victory', 'None', 'toString']) {
      for (const mapping of [MAPPING, FALLBACK_MAPPING]) {
        expect(readGesture(read(label, 0.9), mapping)?.intent ?? null).toBe(mapDetection(read(label, 0.9), mapping))
      }
    }
  })
})
