import { describe, expect, it } from 'vitest'
import { blocked, memory } from '../test/fakes/storage.ts'
import { readItem, removeItem, writeItem } from './storage.ts'

describe('storage helpers', () => {
  it('read, write and remove an item, and say whether it worked', () => {
    const store = memory()
    expect(readItem(store, 'k')).toBeNull()
    expect(writeItem(store, 'k', 'v')).toBe(true)
    expect(readItem(store, 'k')).toBe('v')
    expect(removeItem(store, 'k')).toBe(true)
    expect(readItem(store, 'k')).toBeNull()
  })

  it('never throw where the browser blocks storage, and say it did not work', () => {
    expect(readItem(blocked, 'k')).toBeNull()
    expect(writeItem(blocked, 'k', 'v')).toBe(false)
    expect(removeItem(blocked, 'k')).toBe(false)
  })

  it('treat having no storage at all as not working', () => {
    expect(readItem(null, 'k')).toBeNull()
    expect(writeItem(null, 'k', 'v')).toBe(false)
    expect(removeItem(null, 'k')).toBe(false)
  })
})
