import { describe, expect, it } from 'vitest'
import { cameraMode, rememberCameraMode, switchUrl } from './cameraChoice.ts'
import { blocked, memory } from '../test/fakes/storage.ts'

describe('cameraMode', () => {
  it('is the hat cam unless the cook has chosen otherwise', () => {
    expect(cameraMode('', memory())).toBe('hat')
  })

  it('uses the laptop camera for ?cam=any, the way the developer flag always has', () => {
    expect(cameraMode('?cam=any', memory())).toBe('laptop')
  })

  it('remembers a choice made earlier', () => {
    expect(cameraMode('', memory({ 'remy.camera': 'laptop' }))).toBe('laptop')
  })

  it('lets ?cam=hat override a remembered laptop choice', () => {
    expect(cameraMode('?cam=hat', memory({ 'remy.camera': 'laptop' }))).toBe('hat')
  })

  it('ignores a saved value it does not know', () => {
    expect(cameraMode('', memory({ 'remy.camera': 'toaster' }))).toBe('hat')
  })

  it('still works when the browser blocks storage', () => {
    expect(cameraMode('', blocked)).toBe('hat')
    expect(cameraMode('?cam=any', blocked)).toBe('laptop')
    expect(cameraMode('', null)).toBe('hat')
  })
})

describe('rememberCameraMode', () => {
  it('saves the laptop choice and clears it for the hat cam', () => {
    const store = memory()
    expect(rememberCameraMode(store, 'laptop')).toBe(true)
    expect(cameraMode('', store)).toBe('laptop')
    expect(rememberCameraMode(store, 'hat')).toBe(true)
    expect(cameraMode('', store)).toBe('hat')
  })

  it('says so when it could not remember', () => {
    expect(rememberCameraMode(blocked, 'laptop')).toBe(false)
    expect(rememberCameraMode(null, 'laptop')).toBe(false)
  })
})

describe('switchUrl', () => {
  it('drops ?cam= when the choice was saved, because the saved choice now says it', () => {
    expect(switchUrl('https://remy.test/?cam=hat&x=1', 'laptop', true)).toBe('https://remy.test/?x=1')
  })

  it('carries the choice in the address when it could not be saved, so a blocked browser still switches', () => {
    expect(switchUrl('https://remy.test/', 'laptop', false)).toBe('https://remy.test/?cam=any')
    expect(switchUrl('https://remy.test/?cam=any', 'hat', false)).toBe('https://remy.test/?cam=hat')
  })
})
