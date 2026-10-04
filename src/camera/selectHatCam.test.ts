import { describe, expect, it } from 'vitest'
import { pickHatCam } from './selectHatCam.ts'

const device = (label: string, kind: MediaDeviceKind = 'videoinput', deviceId = label) =>
  ({ deviceId, groupId: '', kind, label, toJSON() {} }) as MediaDeviceInfo

const MACBOOK = device('MacBook Air Camera')
const IPHONE = device('iPhone Camera')
const C270 = device('UVC Camera (046d:0825)')

describe('pickHatCam', () => {
  it('picks the C270 by its USB id among the MacBook and iPhone cameras', () => {
    expect(pickHatCam([MACBOOK, C270, IPHONE])).toBe(C270)
  })

  it('picks the Logitech C920 (046d:0892) too', () => {
    const c920 = device('HD Pro Webcam C920 (046d:0892)')
    expect(pickHatCam([MACBOOK, c920, IPHONE])).toBe(c920)
  })

  it('picks the C920 by name when the label has no USB id', () => {
    const c920 = device('HD Pro Webcam C920')
    expect(pickHatCam([MACBOOK, c920])).toBe(c920)
  })

  it('picks the C920 over a generic Logitech camera when both are plugged in', () => {
    const c920 = device('HD Pro Webcam C920 (046d:0892)')
    const otherLogitech = device('Logitech BRIO (046d:085e)')
    expect(pickHatCam([otherLogitech, c920])).toBe(c920)
  })

  it('matches the USB id in any letter case', () => {
    const upper = device('USB CAMERA (046D:0825)')
    expect(pickHatCam([MACBOOK, upper])).toBe(upper)
  })

  it('also accepts labels naming Logitech or the C270', () => {
    const named = device('Logitech Webcam C270')
    expect(pickHatCam([MACBOOK, named])).toBe(named)
    const short = device('C270 HD WEBCAM')
    expect(pickHatCam([IPHONE, short])).toBe(short)
  })

  it('prefers the exact USB id over a generic Logitech label', () => {
    const otherLogitech = device('Logitech BRIO (046d:085e)')
    expect(pickHatCam([otherLogitech, C270])).toBe(C270)
  })

  it('never falls back to the MacBook or iPhone camera', () => {
    expect(pickHatCam([MACBOOK, IPHONE])).toBeNull()
  })

  it('returns null before camera permission, when labels are empty', () => {
    expect(pickHatCam([device(''), device('')])).toBeNull()
  })

  it('ignores microphones and speakers with matching labels', () => {
    const mic = device('Logitech C270 Microphone (046d:0825)', 'audioinput')
    expect(pickHatCam([MACBOOK, mic])).toBeNull()
  })
})
