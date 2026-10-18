// Remy's lines per Persona. The default table must stay exactly what Remy always said.
import { describe, expect, it } from 'vitest'
import { DONE_CLIP, LOOKING_CLIP, fixedClipId, fixedLine } from '../audio/lines.ts'
import { PERSONAS } from '../cooking/settings.ts'
import { GESTURE_HINTS, SAY, sayFor } from './say.ts'

describe('sayFor', () => {
  it('gives Remy the table SAY has always held, and SAY is that table', () => {
    expect(sayFor('remy')).toBe(SAY)
    expect(sayFor()).toBe(SAY)
    expect(SAY.hello).toBe("Hey, I'm Remy! Let's cook!")
    expect(SAY.verdict).toEqual({ ready: 'Oui, chef!', not_ready: 'Almost, chef!', unsure: "Hmm, my whiskers can't see that" })
  })

  it.each(PERSONAS.map((p) => p.id))('has every line for %s, and a different catchline for each answer', (persona) => {
    const { verdict, ...lines } = sayFor(persona)
    for (const [key, line] of Object.entries({ ...lines, ...verdict })) expect(line.trim(), key).not.toBe('')
    expect(new Set(Object.values(verdict)).size).toBe(3)
  })

  it('has the same lines to fill in for every Persona', () => {
    const keys = (persona: 'remy' | 'grandma' | 'sergeant') => Object.keys(sayFor(persona)).sort()
    expect(keys('grandma')).toEqual(keys('remy'))
    expect(keys('sergeant')).toEqual(keys('remy'))
  })

  it('words the lines differently for each Persona', () => {
    expect(sayFor('grandma').verdict.ready).not.toBe(sayFor('remy').verdict.ready)
    expect(sayFor('sergeant').verdict.ready).not.toBe(sayFor('grandma').verdict.ready)
    expect(sayFor('grandma').hello).not.toBe(sayFor('remy').hello)
  })

  it.each(PERSONAS.map((p) => p.id))('says on screen what the fixed clips say aloud for %s', (persona) => {
    expect(sayFor(persona).look).toBe(fixedLine(LOOKING_CLIP, persona))
    expect(sayFor(persona).done).toBe(fixedLine(DONE_CLIP, persona))
  })

  it('names no real chef', () => {
    const everything = PERSONAS.flatMap((p) => {
      const { verdict, ...lines } = sayFor(p.id)
      return [...Object.values(lines), ...Object.values(verdict)]
    }).join(' ')
    expect(everything).not.toMatch(/ramsay|child|bourdain|oliver|lawson|garten/i)
  })
})

describe('fixed clips', () => {
  it('keep their plain ids for Remy and get their own for another Persona, since the voice differs', () => {
    expect(fixedClipId(LOOKING_CLIP)).toBe('looking')
    expect(fixedClipId(DONE_CLIP, 'remy')).toBe('done')
    expect(fixedClipId(LOOKING_CLIP, 'grandma')).not.toBe('looking')
    expect(fixedClipId(LOOKING_CLIP, 'grandma')).not.toBe(fixedClipId(LOOKING_CLIP, 'sergeant'))
  })

  it('stay short enough to be one clip', () => {
    for (const { id } of PERSONAS) {
      expect(fixedLine(LOOKING_CLIP, id).length).toBeLessThan(80)
      expect(fixedLine(DONE_CLIP, id).length).toBeLessThan(80)
    }
  })
})

describe('GESTURE_HINTS', () => {
  it('still teaches next, check and back', () => {
    expect(GESTURE_HINTS.map((h) => h.intent).sort()).toEqual(['back', 'check', 'next'])
  })
})
