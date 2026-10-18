// Which camera Remy uses: the hat cam it is designed around, or the laptop's own camera for cooks
// without one (testers, mostly). The laptop camera used to need ?cam=any in the URL; this lets the
// cook choose in the app, and remembers it. The choice is made once at load, because the camera hook
// is picked once (hooks cannot change between renders), so switching reloads the page.

import type { CameraErrorKind } from '../camera/openHatCam.ts'
import { pageStorage, type Store } from './storage.ts'

export type CameraMode = 'hat' | 'laptop'

const KEY = 'remy.camera'

/** ?cam=any or ?cam=laptop picks the laptop camera, ?cam=hat the hat cam; otherwise the saved choice; otherwise the hat cam. */
export function cameraMode(search: string, storage: Store): CameraMode {
  const asked = new URLSearchParams(search).get('cam')
  if (asked === 'any' || asked === 'laptop') return 'laptop'
  if (asked === 'hat') return 'hat'
  try {
    return storage?.getItem(KEY) === 'laptop' ? 'laptop' : 'hat'
  } catch {
    return 'hat'
  }
}

export function rememberCameraMode(storage: Store, mode: CameraMode): void {
  try {
    if (mode === 'laptop') storage?.setItem(KEY, 'laptop')
    else storage?.removeItem(KEY)
  } catch {
    // Not remembered, so the next visit asks again. Nothing else depends on it.
  }
}

/** The camera for this page load. */
export const LAPTOP_CAMERA: boolean = cameraMode(window.location.search, pageStorage()) === 'laptop'

/** Saves the choice and reloads, so the other camera is opened. ?cam= in the address would override it, so it is dropped. */
export function switchCamera(mode: CameraMode): void {
  rememberCameraMode(pageStorage(), mode)
  const url = new URL(window.location.href)
  url.searchParams.delete('cam')
  window.location.assign(url)
}

/** What the prep screen says under the camera window, and the switch it offers (if any). */
export function setupHelp(
  laptop: boolean,
  error: CameraErrorKind | null,
): { text: string; switchTo: { mode: CameraMode; label: string } | null } {
  if (laptop) {
    return {
      text: "Using this laptop's camera. Prop it up so Remy sees your hands and the bowl.",
      switchTo: { mode: 'hat', label: 'Use the hat cam instead' },
    }
  }
  if (error === 'not_found') {
    return {
      text: "No hat cam found. Plug it in, or use this laptop's camera instead.",
      switchTo: { mode: 'laptop', label: "Use this laptop's camera" },
    }
  }
  return { text: "Can Remy see your bowl? Look down at it and check it's in the window.", switchTo: null }
}
