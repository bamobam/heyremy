// The hat cam is a Logitech C270. macOS doesn't name it "Logitech"; Chrome
// labels it with its USB ids instead, e.g. "UVC Camera (046d:0825)".

export const HAT_CAM_USB_ID = '046d:0825'

const NAMED_HAT_CAM = /logitech|c270/i

/**
 * Picks the hat cam from enumerateDevices(). Returns null rather than any
 * other camera, so the MacBook or iPhone camera is never opened by mistake.
 * Labels are empty until camera permission is granted, so this returns null then too.
 */
export function pickHatCam(devices: MediaDeviceInfo[]): MediaDeviceInfo | null {
  const cameras = devices.filter((d) => d.kind === 'videoinput')
  return (
    cameras.find((d) => d.label.toLowerCase().includes(HAT_CAM_USB_ID)) ??
    cameras.find((d) => NAMED_HAT_CAM.test(d.label)) ??
    null
  )
}
