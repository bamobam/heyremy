// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCameras, findHatCam } from './camCheck.ts'

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')

describe('parseCameras', () => {
  it('lists every camera macOS reports with the C270 plugged in', () => {
    const cameras = parseCameras(fixture('system-profiler-c270.txt'))
    expect(cameras.map((c) => c.name)).toEqual([
      'MacBook Air Camera',
      'USB Camera VID:1133 PID:2085',
      'iPhone Camera',
    ])
  })

  it('reads the C270 USB vendor and product ids as hex', () => {
    const usb = parseCameras(fixture('system-profiler-c270.txt'))[1]
    expect(usb.vendorId).toBe('046d')
    expect(usb.productId).toBe('0825')
  })

  it('leaves ids null for non-USB cameras', () => {
    const builtIn = parseCameras(fixture('system-profiler-c270.txt'))[0]
    expect(builtIn.vendorId).toBeNull()
    expect(builtIn.productId).toBeNull()
  })

  it('returns an empty list for empty output', () => {
    expect(parseCameras('')).toEqual([])
  })
})

describe('findHatCam', () => {
  it('finds the Logitech C270 (046d:0825)', () => {
    const hatCam = findHatCam(parseCameras(fixture('system-profiler-c270.txt')))
    expect(hatCam?.name).toBe('USB Camera VID:1133 PID:2085')
  })

  it('finds the Logitech C920 (046d:0892) with the C920 plugged in', () => {
    const cameras = parseCameras(fixture('system-profiler-c920.txt'))
    expect(cameras.find((c) => c.name === 'HD Pro Webcam C920')).toMatchObject({
      vendorId: '046d',
      productId: '0892',
    })
    expect(findHatCam(cameras)?.name).toBe('HD Pro Webcam C920')
  })

  it('returns null when neither hat cam is plugged in, only the built-in and iPhone cameras', () => {
    expect(findHatCam(parseCameras(fixture('system-profiler-no-hat-cam.txt')))).toBeNull()
  })
})
