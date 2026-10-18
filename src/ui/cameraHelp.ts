// What the prep and start screens say about the camera, and the switch they offer (if any).
import { CAMERA_ERROR_MESSAGES } from '../camera/cameraMessages.ts'
import type { CameraErrorKind } from '../camera/openHatCam.ts'
import type { HatCam } from '../camera/useHatCam.ts'
import type { CameraMode } from '../cooking/contract.ts'

export interface SetupHelp {
  text: string
  switchTo: { mode: CameraMode; label: string } | null
}

export function setupHelp(mode: CameraMode, error: CameraErrorKind | null): SetupHelp {
  if (mode === 'laptop') {
    return {
      text: "Using this laptop's camera. Prop it up so Remy sees your hands and the bowl.",
      switchTo: { mode: 'hat', label: 'Use the hat cam instead' },
    }
  }
  // A camera blocked in the browser is blocked for every camera, so switching would not help.
  if (error === null || error === 'denied') {
    return { text: "Can Remy see your bowl? Look down at it and check it's in the window.", switchTo: null }
  }
  return {
    text: error === 'not_found' ? "No hat cam found. Plug it in, or use this laptop's camera instead." : "The hat cam isn't ready. Sort it out, or use this laptop's camera instead.",
    switchTo: { mode: 'laptop', label: "Use this laptop's camera" },
  }
}

/** What a camera window says while it is not showing a picture, naming the camera the cook is using. */
export function cameraStatusText(mode: CameraMode, status: HatCam['status']): string {
  const name = mode === 'laptop' ? 'the camera' : 'the hat cam'
  const text: Record<HatCam['status'], string> = {
    connecting: `Connecting to ${name}…`,
    live: 'Live',
    reconnecting: 'Reconnecting…',
    busy: 'Camera busy',
    error: mode === 'laptop' ? 'Camera offline' : 'Hat cam offline',
  }
  return text[status]
}

/** The message for a camera error. The shared ones talk about the hat cam and its USB cable, so laptop mode has its own. */
export function cameraProblemText(mode: CameraMode, error: CameraErrorKind): string {
  if (mode === 'laptop') {
    if (error === 'not_found') return 'No camera found on this device.'
    if (error === 'lost') return 'The camera disconnected. Reconnecting as soon as it is back...'
  }
  return CAMERA_ERROR_MESSAGES[error]
}
