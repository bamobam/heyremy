import { describe, expect, it } from 'vitest'
import { bubbleText, levelCoverage, narrationTag } from './narrationText.ts'

describe('bubbleText', () => {
  it("drops the spoken 'Step N.' lead-in, which the card already shows", () => {
    expect(bubbleText('Step 3. Pour a ladle of batter. A drop of water should sizzle first.', 'Pour a ladle.')).toBe(
      'Pour a ladle of batter. A drop of water should sizzle first.',
    )
  })

  it('leaves narration without a lead-in alone', () => {
    expect(bubbleText('Whisk until smooth.', 'x')).toBe('Whisk until smooth.')
  })

  it('falls back to the card text when the narration is empty or only the lead-in', () => {
    expect(bubbleText('', 'Whisk the batter.')).toBe('Whisk the batter.')
    expect(bubbleText('Step 2.', 'Whisk the batter.')).toBe('Whisk the batter.')
  })
})

describe('levelCoverage', () => {
  const steps = [
    { spoken: 'a', spokenIntermediate: 'b', spokenMaster: 'c' },
    { spoken: 'a', spokenIntermediate: 'b' },
    { spoken: 'a' },
  ]

  it('counts the steps that have narration written for the Level, so a recipe that falls back to beginner shows', () => {
    expect(levelCoverage(steps, 'intermediate')).toEqual({ written: 2, total: 3 })
    expect(levelCoverage(steps, 'master')).toEqual({ written: 1, total: 3 })
  })

  it('has every step at beginner, which is the narration every recipe has', () => {
    expect(levelCoverage(steps, 'beginner')).toEqual({ written: 3, total: 3 })
  })

  it('does not count an empty variant', () => {
    expect(levelCoverage([{ spoken: 'a', spokenMaster: '  ' }], 'master')).toEqual({ written: 0, total: 1 })
  })
})

describe('narrationTag', () => {
  const steps = [{ spoken: 'a', spokenIntermediate: 'b' }, { spoken: 'a' }]

  it('says nothing at beginner, where there is nothing to fall back from', () => {
    expect(narrationTag('beginner', steps)).toBeNull()
  })

  it('warns when some steps have no narration at the chosen Level, so the Level seems to do nothing', () => {
    expect(narrationTag('intermediate', steps)).toEqual({ text: 'Level intermediate: written for 1 of 2 steps, the rest read as beginner', ok: false })
  })

  it('is fine when every step has it', () => {
    expect(narrationTag('intermediate', [{ spoken: 'a', spokenIntermediate: 'b' }])).toEqual({ text: 'Level intermediate: written for all 1 steps', ok: true })
  })
})
