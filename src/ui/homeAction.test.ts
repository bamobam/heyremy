import { describe, expect, it } from 'vitest'
import { homeAction } from './HomeLogo.tsx'

describe('homeAction', () => {
  it('does nothing when the cook is already at the start, or Remy is reading the recipe', () => {
    expect(homeAction('input')).toBe('none')
    expect(homeAction('parsing')).toBe('none')
  })

  it('asks first when there is something to lose', () => {
    expect(homeAction('prep')).toBe('confirm')
    expect(homeAction('cooking')).toBe('confirm')
  })

  it('goes straight home once the cook is done', () => {
    expect(homeAction('done')).toBe('go')
  })
})
