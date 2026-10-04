import { describe, expect, it } from 'vitest'
import { FakeObjectUrls } from '../test/fakes/audio.ts'
import { createClipCache } from './clipCache.ts'

const blob = (s: string) => new Blob([s], { type: 'audio/mpeg' })

describe('clipCache', () => {
  it('stores a clip as an object URL', () => {
    const urls = new FakeObjectUrls()
    const cache = createClipCache(urls)
    const clip = blob('step 1')
    cache.put('step-1', clip)
    const url = cache.get('step-1')
    expect(url).toMatch(/^blob:/)
    expect(urls.blobs.get(url!)).toBe(clip)
    expect(cache.has('step-1')).toBe(true)
  })

  it('returns null and false for unknown ids', () => {
    const cache = createClipCache(new FakeObjectUrls())
    expect(cache.get('done')).toBeNull()
    expect(cache.has('done')).toBe(false)
  })

  it('keeps servings variants apart', () => {
    const cache = createClipCache(new FakeObjectUrls())
    cache.put('step-3@4', blob('four'))
    expect(cache.has('step-3@4')).toBe(true)
    expect(cache.has('step-3@2')).toBe(false)
  })

  it('replacing a clip revokes the old URL', () => {
    const urls = new FakeObjectUrls()
    const cache = createClipCache(urls)
    cache.put('looking', blob('a'))
    const first = cache.get('looking')!
    cache.put('looking', blob('b'))
    expect(urls.revoked).toEqual([first])
    expect(cache.get('looking')).not.toBe(first)
    expect(urls.live.size).toBe(1)
  })

  it('clear revokes every URL and empties the cache', () => {
    const urls = new FakeObjectUrls()
    const cache = createClipCache(urls)
    cache.put('step-1', blob('1'))
    cache.put('done', blob('d'))
    cache.clear()
    expect(urls.live.size).toBe(0)
    expect(urls.revoked).toHaveLength(2)
    expect(cache.has('step-1')).toBe(false)
    expect(cache.get('done')).toBeNull()
  })
})
