import { describe, expect, it } from 'vitest'
import type { Detection } from './recognizer.ts'
import { emptyTally, stepTally, type Tally } from './gestureTally.ts'

const det = (label: string, score: number, handPresent = true): Detection => ({
  label,
  score,
  handPresent,
  landmarks: handPresent ? [] : null,
})

const run = (detections: Detection[]): Tally => detections.reduce(stepTally, emptyTally())

describe('stepTally (counts gesture attempts for the hour-1 test)', () => {
  it('counts a held gesture once, not once per frame', () => {
    const t = run([det('Thumb_Up', 0.9), det('Thumb_Up', 0.92), det('Thumb_Up', 0.95)])
    expect(t.hits.Thumb_Up).toBe(1)
  })

  it('counts again after the hand drops and comes back', () => {
    const t = run([det('Thumb_Up', 0.9), det('None', 0, false), det('Thumb_Up', 0.9)])
    expect(t.hits.Thumb_Up).toBe(2)
  })

  it('counts again after another gesture in between', () => {
    const t = run([det('Thumb_Up', 0.9), det('Open_Palm', 0.9), det('Thumb_Up', 0.9)])
    expect(t.hits.Thumb_Up).toBe(2)
    expect(t.hits.Open_Palm).toBe(1)
  })

  it('ignores readings below 0.7 confidence', () => {
    const t = run([det('Thumb_Up', 0.69), det('Thumb_Up', 0.5)])
    expect(t.hits.Thumb_Up ?? 0).toBe(0)
  })

  it('counts an open palm from 0.6, like the gesture filter', () => {
    expect(run([det('Open_Palm', 0.62)]).hits.Open_Palm).toBe(1)
    expect(run([det('Open_Palm', 0.58)]).hits.Open_Palm ?? 0).toBe(0)
  })

  it('a low-confidence frame ends the current attempt', () => {
    const t = run([det('Thumb_Up', 0.9), det('Thumb_Up', 0.4), det('Thumb_Up', 0.9)])
    expect(t.hits.Thumb_Up).toBe(2)
  })

  it('never counts None', () => {
    const t = run([det('None', 0.9), det('None', 0, false)])
    expect(t.hits.None).toBeUndefined()
  })

  it('counts frames per label, for a rough hit rate', () => {
    const t = run([det('Thumb_Up', 0.9), det('Thumb_Up', 0.9), det('Thumb_Down', 0.9)])
    expect(t.frames.Thumb_Up).toBe(2)
    expect(t.frames.Thumb_Down).toBe(1)
  })

  it('emptyTally starts clean', () => {
    expect(emptyTally()).toEqual({ hits: {}, frames: {}, current: null })
  })
})
