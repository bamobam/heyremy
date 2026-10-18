import { describe, expect, it } from 'vitest'
import type { HandShape } from '../camera/handShape.ts'
import type { Detection } from '../camera/recognizer.ts'
import { toReading } from './reading.ts'

const detection = (label: string, score: number, shape?: [HandShape, number], handPresent = true): Detection => ({
  label,
  score,
  handPresent,
  landmarks: handPresent ? [] : null,
  ...(shape && { shape: { shape: shape[0], confidence: shape[1] } }),
})

describe('toReading, what the dev tag shows', () => {
  it('is the label and score when MediaPipe read the gesture', () => {
    expect(toReading(detection('Open_Palm', 0.93, ['open', 0.99]))).toEqual({ label: 'Open_Palm', score: 0.93, handPresent: true })
  })

  it('adds the shape when that is what the gesture came from', () => {
    expect(toReading(detection('None', 0.2, ['open', 0.91]))).toEqual({
      label: 'None',
      score: 0.2,
      handPresent: true,
      shape: { name: 'open', score: 0.91 },
    })
    expect(toReading(detection('Closed_Fist', 0.9, ['thumb_up', 0.8])).shape).toEqual({ name: 'thumb_up', score: 0.8 })
    expect(toReading(detection('None', 0, ['thumb_down', 0.75])).shape).toEqual({ name: 'thumb_down', score: 0.75 })
  })

  it('leaves the shape out when it is other, or missing, or there is no hand', () => {
    expect(toReading(detection('None', 0.2, ['other', 0.9]))).not.toHaveProperty('shape')
    expect(toReading(detection('None', 0.2))).not.toHaveProperty('shape')
    expect(toReading(detection('None', 0, ['open', 0.9], false))).toEqual({ label: 'None', score: 0, handPresent: false })
  })

  it('leaves the shape out when MediaPipe was sure enough that its label is what fired', () => {
    expect(toReading(detection('Thumb_Up', 0.9, ['open', 0.95]))).not.toHaveProperty('shape')
  })
})
