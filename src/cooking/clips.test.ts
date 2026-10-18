// Which audio clips the prep screen has to make before Start: the two fixed lines and one clip per step,
// for the chosen servings, Level and Persona. Pure.
import { describe, expect, it } from 'vitest'
import { pancakes } from './fixtures.ts'
import { wantedClips } from './clips.ts'
import { DEFAULT_SETTINGS, type CookSettings } from './settings.ts'
import { initialState, type CookingState } from './state.ts'

const prep = (settings: CookSettings = DEFAULT_SETTINGS, servings = pancakes.servings): CookingState => ({
  ...initialState(undefined, settings),
  phase: 'prep',
  recipe: pancakes,
  servings,
})

describe('wantedClips', () => {
  it('is nothing before there is a recipe', () => {
    expect(wantedClips(initialState())).toEqual([])
  })

  it('is the two fixed lines, then one clip per step, at the default Level and Persona', () => {
    const clips = wantedClips(prep())
    expect(clips.map((c) => c.id)).toEqual(['looking', 'done', 'step-1@4', 'step-2@4', 'step-3', 'step-4', 'step-5'])
    expect(clips[0].text).toBe('Whiskers on it… hold still!')
    expect(clips[2].text).toBe('Step 1. Whisk one cup of flour, one cup of milk and two eggs into a batter.')
  })

  it('says the chosen Level\'s narration, with the amounts at the chosen servings', () => {
    const master = wantedClips(prep({ level: 'master', persona: 'remy' }, 2)).slice(2)
    expect(master.map((c) => c.text)).toEqual([
      'Step 1. Whisk half a cup of flour, half a cup of milk, one egg.',
      'Step 2. Medium heat, one tablespoon of melted butter.',
      'Step 3. Pour a ladle.',
      'Step 4. Flip on bubbles.',
      'Step 5. Serve.',
    ])
  })

  it('has the same number of clips at every Level and Persona, so the progress bar keeps its total', () => {
    for (const level of ['beginner', 'intermediate', 'master'] as const) {
      for (const persona of ['remy', 'grandma', 'sergeant'] as const) {
        expect(wantedClips(prep({ level, persona }))).toHaveLength(2 + pancakes.steps.length)
      }
    }
  })

  it('has unique ids, and different ones for a different Level or Persona where the sound differs', () => {
    const ids = (settings: CookSettings) => wantedClips(prep(settings)).map((c) => c.id)
    for (const level of ['beginner', 'intermediate', 'master'] as const) {
      expect(new Set(ids({ level, persona: 'grandma' })).size).toBe(2 + pancakes.steps.length)
    }
    const remy = ids({ level: 'beginner', persona: 'remy' })
    const grandma = ids({ level: 'beginner', persona: 'grandma' })
    expect(remy.filter((id) => grandma.includes(id))).toEqual([])
    const master = ids({ level: 'master', persona: 'remy' })
    // Step 5 reads "Serve with butter and syrup" at intermediate (no narration of its own): the beginner clip is reused.
    expect(ids({ level: 'intermediate', persona: 'remy' })).toContain('step-5')
    expect(master).not.toContain('step-5')
  })

  it('says the fixed lines in the Persona\'s words, with ids of their own', () => {
    const [looking, done] = wantedClips(prep({ level: 'beginner', persona: 'sergeant' }))
    expect(looking).toEqual({ id: 'looking~sergeant', text: 'Eyes front! Hold still!' })
    expect(done.id).toBe('done~sergeant')
    expect(done.text).not.toBe('Bon appétit, chef!')
  })
})
