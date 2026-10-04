import { describe, expect, it } from 'vitest'
import { pancakes } from '../cooking/fixtures.ts'
import { isParsedRecipe, isVerdict } from './guards.ts'

describe('isVerdict', () => {
  it.each(['ready', 'not_ready', 'unsure'])('accepts status %s', (status) => {
    expect(isVerdict({ status, feedback: 'Keep going.' })).toBe(true)
  })

  it.each([
    ['null', null],
    ['a string', 'ready'],
    ['an unknown status', { status: 'maybe', feedback: 'x' }],
    ['the old boolean shape', { ready: true, feedback: 'x' }],
    ['no feedback', { status: 'ready' }],
    ['feedback that is not text', { status: 'ready', feedback: 3 }],
    ['empty feedback', { status: 'ready', feedback: '   ' }],
  ])('rejects %s', (_name, value) => {
    expect(isVerdict(value)).toBe(false)
  })
})

describe('isParsedRecipe', () => {
  const copy = () => structuredClone(pancakes) as unknown as Record<string, unknown>

  it('accepts a well-formed recipe', () => {
    expect(isParsedRecipe(pancakes)).toBe(true)
  })

  it.each([null, 'recipe', 42, [], {}])('rejects %j', (value) => {
    expect(isParsedRecipe(value)).toBe(false)
  })

  it.each([
    ['no title', (r: Record<string, unknown>) => delete r.title],
    ['servings that is not a positive number', (r: Record<string, unknown>) => (r.servings = 0)],
    ['servings as text', (r: Record<string, unknown>) => (r.servings = '4')],
    ['ingredients that is not a list', (r: Record<string, unknown>) => (r.ingredients = 'flour')],
    ['prep that is not a list of text', (r: Record<string, unknown>) => (r.prep = [1, 2])],
    ['no steps', (r: Record<string, unknown>) => (r.steps = [])],
    ['steps that is not a list', (r: Record<string, unknown>) => (r.steps = {})],
  ])('rejects a recipe with %s', (_name, damage) => {
    const r = copy()
    damage(r)
    expect(isParsedRecipe(r)).toBe(false)
  })

  it.each([
    ['an ingredient with no id', (r: any) => delete r.ingredients[0].id],
    ['an ingredient amount that is text', (r: any) => (r.ingredients[0].amount = 'one')],
    ['an ingredient unit that is a number', (r: any) => (r.ingredients[0].unit = 5)],
    ['an ingredient with no name', (r: any) => delete r.ingredients[0].name],
    ['a step with no text', (r: any) => delete r.steps[0].text],
    ['a step with no spoken text', (r: any) => delete r.steps[0].spoken],
    ['a step whose checkable is not a boolean', (r: any) => (r.steps[0].checkable = 'yes')],
    ['a step whose cue is a number', (r: any) => (r.steps[0].cue = 4)],
    ['a step whose headsUp is a number', (r: any) => (r.steps[0].headsUp = 4)],
    ['a checkable step with no cue', (r: any) => (r.steps[0].cue = null)],
  ])('rejects %s', (_name, damage) => {
    const r = copy()
    damage(r)
    expect(isParsedRecipe(r)).toBe(false)
  })

  it('accepts null amounts and units, and null cues and heads-ups on steps that cannot be checked', () => {
    expect(isParsedRecipe(pancakes)).toBe(true)
    expect(pancakes.ingredients.some((i) => i.amount === null && i.unit === null)).toBe(true)
    expect(pancakes.steps.some((s) => s.cue === null && s.headsUp === null && !s.checkable)).toBe(true)
  })

  it('rejects a step that uses an ingredient id the recipe does not have', () => {
    const r = copy() as any
    r.steps[0].text = 'Whisk {mystery} into a batter.'
    expect(isParsedRecipe(r)).toBe(false)
  })
})
