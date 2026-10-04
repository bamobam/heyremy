// Voice clips by id, kept as object URLs so playing one never touches the network.
// Ids: `step-<id>`, `step-<id>@<servings>` (steps with placeholders), `looking`, `done`.

export interface ObjectUrls {
  createObjectURL(blob: Blob): string
  revokeObjectURL(url: string): void
}

export interface ClipCache {
  /** Stores the clip as an object URL, replacing (and revoking) any clip with the same id. */
  put(id: string, blob: Blob): void
  get(id: string): string | null
  has(id: string): boolean
  /** Revokes every URL. Called on restart. */
  clear(): void
}

export function createClipCache(urls: ObjectUrls = URL): ClipCache {
  const clips = new Map<string, string>()
  return {
    put(id, blob) {
      const old = clips.get(id)
      if (old) urls.revokeObjectURL(old)
      clips.set(id, urls.createObjectURL(blob))
    },
    get: (id) => clips.get(id) ?? null,
    has: (id) => clips.has(id),
    clear() {
      for (const url of clips.values()) urls.revokeObjectURL(url)
      clips.clear()
    },
  }
}

/** The app's one cache, shared by the player and the controller. */
export const clipCache: ClipCache = createClipCache()

export const put = (id: string, blob: Blob) => clipCache.put(id, blob)
export const get = (id: string) => clipCache.get(id)
export const has = (id: string) => clipCache.has(id)
export const clear = () => clipCache.clear()
