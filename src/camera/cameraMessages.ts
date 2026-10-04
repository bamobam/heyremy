import type { CameraErrorKind } from './openHatCam.ts'

/** What to show the cook for each camera error. */
export const CAMERA_ERROR_MESSAGES: Record<CameraErrorKind, string> = {
  denied: 'Camera blocked. Allow camera access for this site in Chrome settings, then reload.',
  not_found: 'Hat cam not found. Check the USB cable. It connects by itself once it is plugged in.',
  busy: 'Camera busy. Close Zoom, FaceTime or Photo Booth. Retrying...',
  lost: 'Hat cam disconnected. Reconnecting as soon as it is back...',
  unknown: 'Camera error. Trying again...',
}
