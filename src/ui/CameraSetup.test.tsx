import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CookingContext } from '../cooking/context.ts'
import type { CookingContextValue } from '../cooking/contract.ts'
import { CameraSetup } from './prep.tsx'
import { CameraSwitch } from './CameraSwitch.tsx'

const choice = vi.hoisted(() => ({ mode: 'hat' as 'hat' | 'laptop', switchCamera: vi.fn() }))
vi.mock('../cooking/cameraChoice.ts', async importOriginal => ({
  ...(await importOriginal<typeof import('../cooking/cameraChoice.ts')>()),
  get CAMERA_MODE() {
    return choice.mode
  },
  switchCamera: choice.switchCamera,
}))

const context = (error: string | null) =>
  ({
    state: { recipeText: 'Soup\n1 onion' },
    camera: { attachVideo() {}, video: null, status: error ? 'error' : 'live', error, label: null, stream: null, reconnects: 0, stalls: 0 },
  }) as unknown as CookingContextValue

const inContext = (error: string | null, ui: React.ReactNode) => render(<CookingContext.Provider value={context(error)}>{ui}</CookingContext.Provider>)

beforeEach(() => {
  choice.mode = 'hat'
  choice.switchCamera.mockClear()
})

afterEach(cleanup)

describe('CameraSetup', () => {
  it('offers the laptop camera when the hat cam is missing, and switches on click, keeping the pasted recipe', () => {
    inContext('not_found', <CameraSetup />)
    fireEvent.click(screen.getByRole('button', { name: /use this laptop's camera/i }))
    expect(choice.switchCamera).toHaveBeenCalledWith('laptop', 'Soup\n1 onion')
  })

  it('offers it when another app has the hat cam too', () => {
    inContext('busy', <CameraSetup />)
    expect(screen.getByRole('button', { name: /use this laptop's camera/i })).toBeTruthy()
  })

  it('offers nothing extra while the hat cam is working', () => {
    inContext(null, <CameraSetup />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText(/see your bowl/i)).toBeTruthy()
  })

  it('tells a laptop cook how to set up, and offers the hat cam', () => {
    choice.mode = 'laptop'
    inContext(null, <CameraSetup />)
    expect(screen.getByText(/prop it up/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /use the hat cam instead/i }))
    expect(choice.switchCamera).toHaveBeenCalledWith('hat', 'Soup\n1 onion')
  })
})

describe('CameraSwitch (on the start screen)', () => {
  it('is there before any recipe is read, when the hat cam is missing', () => {
    inContext('not_found', <CameraSwitch />)
    expect(screen.getByRole('button', { name: /use this laptop's camera/i })).toBeTruthy()
  })

  it('is absent when the hat cam is fine', () => {
    const { container } = inContext(null, <CameraSwitch />)
    expect(container.firstChild).toBeNull()
  })
})
