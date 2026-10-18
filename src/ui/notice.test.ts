import { describe, expect, it } from 'vitest'
import { blocked, memory } from '../test/fakes/storage.ts'
import { markNoticeSeen, needsNotice } from './notice.ts'

describe('needsNotice', () => {
  it('shows the notice to a new visitor of the real app', () => {
    expect(needsNotice(false, memory())).toBe(true)
  })

  it('does not show it again once it has been accepted', () => {
    const store = memory()
    markNoticeSeen(store)
    expect(needsNotice(false, store)).toBe(false)
  })

  it('shows it again when the notice text is revised', () => {
    expect(needsNotice(false, memory({ 'remy.notice': 'an older revision' }))).toBe(true)
  })

  it('does not show it on the stand-in backend, where nothing is sent anywhere', () => {
    expect(needsNotice(true, memory())).toBe(false)
  })

  it('asks every visit where storage is blocked, and accepting does not throw', () => {
    expect(needsNotice(false, blocked)).toBe(true)
    expect(needsNotice(false, null)).toBe(true)
    expect(() => markNoticeSeen(blocked)).not.toThrow()
  })
})
