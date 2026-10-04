import type { CameraErrorKind } from './openHatCam.ts'

/** What to show the cook for each camera error. */
export const CAMERA_ERROR_MESSAGES: Record<CameraErrorKind, string> = {
  denied: 'Camera blocked. Allow camera access for this site in Chrome settings, then reload.',
  not_found: 'Hat cam not found. Check the USB cable, then reload.',
  busy: 'Camera busy. Close Zoom, FaceTime or Photo Booth, then reload.',
  lost: 'Hat cam disconnected. Plug it back in, then reload.',
  unknown: 'Camera error. Reload the page.',
}
