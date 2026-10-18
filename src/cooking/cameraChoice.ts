// Which camera Remy uses: the hat cam it is designed around, or the laptop's own camera for cooks
// without one (testers, mostly). The laptop camera used to need ?cam=any in the URL; this lets the
// cook choose in the app, and remembers it. The choice is made once at load, because the camera hook
// is picked once (hooks cannot change between renders), so switching reloads the page.
import { stashDraft } from './draft.ts'
import { pageStorage, readItem, removeItem, writeItem, type Store } from './storage.ts'

export type CameraMode = 'hat' | 'laptop'

const KEY = 'remy.camera'

/** ?cam=any (the old developer flag) picks the laptop camera, ?cam=hat the hat cam; otherwise the saved choice; otherwise the hat cam. */
export function cameraMode(search: string, store: Store): CameraMode {
  const asked = new URLSearchParams(search).get('cam')
  if (asked === 'any') return 'laptop'
  if (asked === 'hat') return 'hat'
  return readItem(store, KEY) === 'laptop' ? 'laptop' : 'hat'
}

/** True if the choice was saved. */
export function rememberCameraMode(store: Store, mode: CameraMode): boolean {
  return mode === 'laptop' ? writeItem(store, KEY, 'laptop') : removeItem(store, KEY)
}

/** The camera for this page load. */
export const CAMERA_MODE: CameraMode = cameraMode(window.location.search, pageStorage())

/** Where to go to switch: a saved choice needs no ?cam=, which would override it; an unsaved one has to ride in the address. */
export function switchUrl(href: string, mode: CameraMode, saved: boolean): string {
  const url = new URL(href)
  if (saved) url.searchParams.delete('cam')
  else url.searchParams.set('cam', mode === 'laptop' ? 'any' : 'hat')
  return url.toString()
}

/** Saves the choice and reloads, so the other camera is opened. The recipe text in the box is kept for after the reload. */
export function switchCamera(mode: CameraMode, recipeText?: string): void {
  const saved = rememberCameraMode(pageStorage(), mode)
  stashDraft(recipeText)
  window.location.assign(switchUrl(window.location.href, mode, saved))
}
