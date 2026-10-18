import { describe, expect, it } from 'vitest'
import { cameraProblemText, cameraStatusText, setupHelp } from './cameraHelp.ts'

describe('setupHelp', () => {
  it('asks about the bowl while the hat cam is fine', () => {
    expect(setupHelp('hat', null)).toEqual({ text: expect.stringMatching(/see your bowl/i), switchTo: null })
  })

  it('offers the laptop camera when the hat cam is not there', () => {
    const help = setupHelp('hat', 'not_found')
    expect(help.text).toMatch(/no hat cam/i)
    expect(help.switchTo).toEqual({ mode: 'laptop', label: "Use this laptop's camera" })
  })

  it('offers it for any hat cam trouble a switch can get around, such as another app using it', () => {
    for (const error of ['busy', 'lost', 'unknown'] as const) {
      expect(setupHelp('hat', error).switchTo?.mode).toBe('laptop')
    }
  })

  it('does not offer it when the camera is blocked in the browser, which would block the laptop camera too', () => {
    expect(setupHelp('hat', 'denied').switchTo).toBeNull()
  })

  it('says how to set the laptop up, and offers the way back', () => {
    const help = setupHelp('laptop', null)
    expect(help.text).toMatch(/laptop/i)
    expect(help.text).toMatch(/hands/i)
    expect(help.switchTo).toEqual({ mode: 'hat', label: 'Use the hat cam instead' })
  })
})

describe('cameraStatusText', () => {
  it('names the hat cam in hat mode and the camera in laptop mode', () => {
    expect(cameraStatusText('hat', 'connecting')).toMatch(/hat cam/i)
    expect(cameraStatusText('laptop', 'connecting')).not.toMatch(/hat/i)
    expect(cameraStatusText('hat', 'error')).toMatch(/hat cam/i)
    expect(cameraStatusText('laptop', 'error')).not.toMatch(/hat/i)
  })

  it('says the same thing in both modes where the camera is not the point', () => {
    expect(cameraStatusText('hat', 'live')).toBe('Live')
    expect(cameraStatusText('laptop', 'live')).toBe('Live')
  })
})

describe('cameraProblemText', () => {
  it('uses the shared messages in hat mode', () => {
    expect(cameraProblemText('hat', 'not_found')).toMatch(/hat cam not found/i)
  })

  it('never blames the hat cam or a USB cable in laptop mode', () => {
    for (const error of ['not_found', 'lost'] as const) {
      expect(cameraProblemText('laptop', error)).not.toMatch(/hat cam|usb/i)
    }
  })

  it('keeps the messages that are true for any camera', () => {
    expect(cameraProblemText('laptop', 'denied')).toBe(cameraProblemText('hat', 'denied'))
    expect(cameraProblemText('laptop', 'busy')).toBe(cameraProblemText('hat', 'busy'))
  })
})
