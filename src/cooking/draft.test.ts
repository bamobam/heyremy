import { describe, expect, it } from 'vitest'
import { stashDraft, takeDraft } from './draft.ts'
import { memory } from '../test/fakes/storage.ts'

describe('draft', () => {
  it('hands back the recipe text that was set aside, once', () => {
    const store = memory()
    stashDraft('Soup\n1 onion', store)
    expect(takeDraft(store)).toBe('Soup\n1 onion')
    expect(takeDraft(store)).toBeNull()
  })

  it('has nothing when nothing was set aside, or the text was blank', () => {
    const store = memory()
    expect(takeDraft(store)).toBeNull()
    stashDraft('   ', store)
    expect(takeDraft(store)).toBeNull()
  })

  it('does nothing with no storage', () => {
    expect(() => stashDraft('Soup', null)).not.toThrow()
    expect(takeDraft(null)).toBeNull()
  })
})
