// The hat cam is a Logitech webcam: the C270 or the C920. macOS and Chrome don't
// always name them "Logitech"; Chrome appends the USB ids to the label, e.g.
// "UVC Camera (046d:0825)" or "HD Pro Webcam C920 (046d:0892)".

/** USB vendor:product ids of the cameras that can be the hat cam. */
export const HAT_CAM_USB_IDS = [
  '046d:0825', // Logitech C270
  '046d:0892', // Logitech C920
]

const NAMED_HAT_CAM = /logitech|c270|c920/i

/**
 * Picks the hat cam from enumerateDevices(). Returns null rather than any
 * other camera, so the MacBook or iPhone camera is never opened by mistake.
 * Labels are empty until camera permission is granted, so this returns null then too.
 */
export function pickHatCam(devices: MediaDeviceInfo[]): MediaDeviceInfo | null {
  const cameras = devices.filter((d) => d.kind === 'videoinput')
  return (
    cameras.find((d) => {
      const label = d.label.toLowerCase()
      return HAT_CAM_USB_IDS.some((id) => label.includes(id))
    }) ??
    cameras.find((d) => NAMED_HAT_CAM.test(d.label)) ??
    null
  )
}
