// @vitest-environment node -- server code runs on Node, not in the browser
import { describe, expect, it } from 'vitest'
import { DEFAULT_PERSONA, PERSONA_IDS, checkPersona, isPersonaId } from './persona.js'

describe('personas', () => {
  it('are remy (the default), grandma and sergeant', () => {
    expect(DEFAULT_PERSONA).toBe('remy')
    expect([...PERSONA_IDS]).toEqual(['remy', 'grandma', 'sergeant'])
  })

  it('knows its own ids and nothing inherited', () => {
    for (const id of PERSONA_IDS) expect(isPersonaId(id)).toBe(true)
    for (const x of ['', 'Remy', 'gordon', 'constructor', '__proto__', 3, null, undefined, {}, ['remy']]) expect(isPersonaId(x)).toBe(false)
  })
})

describe('checkPersona', () => {
  it('accepts a missing persona, which means the default', () => {
    expect(checkPersona(undefined)).toBeNull()
    expect(checkPersona(null)).toBeNull()
  })

  it('accepts each known persona', () => {
    for (const id of PERSONA_IDS) expect(checkPersona(id)).toBeNull()
  })

  it('names the choices when it is anything else', () => {
    for (const bad of ['', 'gordon', 'REMY', 4, true, {}, ['remy']]) {
      expect(checkPersona(bad)).toBe('persona must be remy, grandma or sergeant.')
    }
  })
})
