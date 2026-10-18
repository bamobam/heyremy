import { describe, expect, it } from 'vitest'
import { stepTitle, upcomingSteps } from './upNext.ts'

describe('stepTitle', () => {
  it('keeps the action and drops the detail after the first clause', () => {
    expect(stepTitle('Whisk 1 cup flour, 2 tbsp sugar and 2 tsp baking powder.')).toBe('Whisk 1 cup flour')
  })

  it('stops after a handful of words', () => {
    expect(stepTitle('Pour a ladle of batter into the greased pan over medium heat.')).toBe('Pour a ladle of batter')
  })

  it('does not end on a dangling word', () => {
    expect(stepTitle('Cook over medium heat for about 2 minutes, then flip.')).toBe('Cook over medium heat')
  })

  it('handles a one-word step and no text', () => {
    expect(stepTitle('Flip.')).toBe('Flip')
    expect(stepTitle('')).toBe('')
  })

  it('does not mistake a decimal, a thousands comma or a time for the end of the clause', () => {
    expect(stepTitle('Heat 2.5 tbsp olive oil in the pan.')).toBe('Heat 2.5 tbsp olive oil')
    expect(stepTitle('Add 1,000 g flour.')).toBe('Add 1,000 g flour')
    expect(stepTitle('Cook for 2:30, then flip.')).toBe('Cook')
  })

  it('does not end on a bare number', () => {
    expect(stepTitle('Bake at 350°F for 25 minutes.')).toBe('Bake at 350°F')
    expect(stepTitle('Simmer for 25')).toBe('Simmer')
  })

  it('starts with a capital', () => {
    expect(stepTitle('let the batter rest for 5 minutes.')).toBe('Let the batter rest')
  })
})

const step = (id: number, text: string) => ({ id, text })

describe('upcomingSteps', () => {
  const steps = [step(1, 'Whisk the dry mix.'), step(2, 'Add the milk.'), step(3, 'Heat the pan.'), step(4, 'Pour a ladle.'), step(5, 'Flip.'), step(6, 'Serve.')]

  it('lists the next few steps, numbered as on the cards, and counts the rest', () => {
    const { items, more } = upcomingSteps(steps, 0, 3)
    expect(items.map(i => [i.number, i.title])).toEqual([[2, 'Add the milk'], [3, 'Heat the pan'], [4, 'Pour a ladle']])
    expect(more).toBe(2)
  })

  it('shows what is left near the end, with nothing more to count', () => {
    const { items, more } = upcomingSteps(steps, 4, 3)
    expect(items.map(i => i.number)).toEqual([6])
    expect(more).toBe(0)
  })

  it('is empty on the last step', () => {
    expect(upcomingSteps(steps, 5, 3)).toEqual({ items: [], more: 0 })
  })
})
