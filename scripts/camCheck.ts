// Checks that macOS sees the hat cam (Logitech C270, USB 046d:0825).
// Run before testing or demoing: npm run cam:check

import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const HAT_CAM = { vendorId: '046d', productId: '0825' }

export interface MacCamera {
  name: string
  modelId: string
  /** 4-digit lowercase hex, only for USB cameras. */
  vendorId: string | null
  productId: string | null
}

const toHex = (decimal: string) => Number(decimal).toString(16).padStart(4, '0')

/** Parses the output of `system_profiler SPCameraDataType`. */
export function parseCameras(output: string): MacCamera[] {
  const cameras: MacCamera[] = []
  for (const line of output.split('\n')) {
    const name = line.match(/^ {4}(\S.*):$/)
    if (name) {
      cameras.push({ name: name[1], modelId: '', vendorId: null, productId: null })
      continue
    }
    const model = line.match(/^ {6}Model ID: (.*)$/)
    const camera = cameras.at(-1)
    if (model && camera) {
      camera.modelId = model[1]
      const ids = model[1].match(/VendorID_(\d+) ProductID_(\d+)/)
      if (ids) {
        camera.vendorId = toHex(ids[1])
        camera.productId = toHex(ids[2])
      }
    }
  }
  return cameras
}

export function findHatCam(cameras: MacCamera[]): MacCamera | null {
  return (
    cameras.find((c) => c.vendorId === HAT_CAM.vendorId && c.productId === HAT_CAM.productId) ??
    null
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const output = execFileSync('system_profiler', ['SPCameraDataType'], { encoding: 'utf8' })
  const cameras = parseCameras(output)
  const hatCam = findHatCam(cameras)
  if (hatCam) {
    console.log(`✅ Hat cam connected: ${hatCam.name} (${HAT_CAM.vendorId}:${HAT_CAM.productId})`)
  } else {
    console.log(`❌ Hat cam (${HAT_CAM.vendorId}:${HAT_CAM.productId}) not found. Check the USB cable and adapter.`)
    console.log(`   Cameras macOS sees: ${cameras.map((c) => c.name).join(', ') || 'none'}`)
    process.exitCode = 1
  }
}
