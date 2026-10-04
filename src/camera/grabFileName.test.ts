import { describe, expect, it } from 'vitest'
import { grabFileName } from './grabFileName.ts'

describe('grabFileName', () => {
  it('names the file by the local date and time, to the second', () => {
    expect(grabFileName(new Date(2026, 9, 4, 13, 5, 9))).toBe('hatcam-20261004-130509.jpg')
  })

  it('pads single-digit months, days and times', () => {
    expect(grabFileName(new Date(2026, 0, 2, 3, 4, 5))).toBe('hatcam-20260102-030405.jpg')
  })

  it('sorts in the order the photos were taken', () => {
    const names = [new Date(2026, 9, 4, 13, 5, 9), new Date(2026, 9, 4, 9, 30, 0), new Date(2026, 9, 3, 23, 59, 59)].map(grabFileName)
    expect([...names].sort()).toEqual([names[2], names[1], names[0]])
  })
})
