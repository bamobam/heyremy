// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCameras, findHatCam } from './camCheck.ts'

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')

describe('parseCameras', () => {
  it('lists every camera macOS reports', () => {
    const cameras = parseCameras(fixture('cameras-connected.txt'))
    expect(cameras.map((c) => c.name)).toEqual([
      'MacBook Air Camera',
      'USB Camera VID:1133 PID:2085',
      'iPhone Camera',
    ])
  })

  it('reads the USB vendor and product ids as hex', () => {
    const usb = parseCameras(fixture('cameras-connected.txt'))[1]
    expect(usb.vendorId).toBe('046d')
    expect(usb.productId).toBe('0825')
  })

  it('leaves ids null for non-USB cameras', () => {
    const builtIn = parseCameras(fixture('cameras-connected.txt'))[0]
    expect(builtIn.vendorId).toBeNull()
    expect(builtIn.productId).toBeNull()
  })

  it('returns an empty list for empty output', () => {
    expect(parseCameras('')).toEqual([])
  })
})

describe('findHatCam', () => {
  it('finds the Logitech C270 (046d:0825)', () => {
    const hatCam = findHatCam(parseCameras(fixture('cameras-connected.txt')))
    expect(hatCam?.name).toBe('USB Camera VID:1133 PID:2085')
  })

  it('finds the Logitech C920 (046d:0892)', () => {
    const cameras = parseCameras(fixture('cameras-c920.txt'))
    expect(cameras.find((c) => c.name === 'HD Pro Webcam C920')).toMatchObject({
      vendorId: '046d',
      productId: '0892',
    })
    expect(findHatCam(cameras)?.name).toBe('HD Pro Webcam C920')
  })

  it('returns null when only the built-in and iPhone cameras are connected', () => {
    expect(findHatCam(parseCameras(fixture('cameras-disconnected.txt')))).toBeNull()
  })
})
