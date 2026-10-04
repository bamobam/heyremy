// Checks that macOS sees the hat cam (a Logitech C270 or C920).
// Run before testing or demoing: npm run cam:check

import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

/** USB ids of the cameras that can be the hat cam. */
export const HAT_CAMS = [
  { name: 'Logitech C270', vendorId: '046d', productId: '0825' },
  { name: 'Logitech C920', vendorId: '046d', productId: '0892' },
]

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
    cameras.find((c) =>
      HAT_CAMS.some((h) => c.vendorId === h.vendorId && c.productId === h.productId),
    ) ?? null
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const output = execFileSync('system_profiler', ['SPCameraDataType'], { encoding: 'utf8' })
  const cameras = parseCameras(output)
  const hatCam = findHatCam(cameras)
  if (hatCam) {
    console.log(`✅ Hat cam connected: ${hatCam.name} (${hatCam.vendorId}:${hatCam.productId})`)
  } else {
    const wanted = HAT_CAMS.map((h) => `${h.name} ${h.vendorId}:${h.productId}`).join(' or ')
    console.log(`❌ Hat cam (${wanted}) not found. Check the USB cable and adapter.`)
    console.log(`   Cameras macOS sees: ${cameras.map((c) => c.name).join(', ') || 'none'}`)
    process.exitCode = 1
  }
}
