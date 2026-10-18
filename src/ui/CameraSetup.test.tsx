import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CookingContext } from '../cooking/context.ts'
import type { CookingContextValue } from '../cooking/contract.ts'
import { CameraSetup } from './prep.tsx'

const choice = vi.hoisted(() => ({ laptop: false, switchCamera: vi.fn() }))
vi.mock('./cameraChoice.ts', async importOriginal => ({
  ...(await importOriginal<typeof import('./cameraChoice.ts')>()),
  get LAPTOP_CAMERA() {
    return choice.laptop
  },
  switchCamera: choice.switchCamera,
}))

const camera = (error: string | null) =>
  ({ attachVideo() {}, video: null, status: error ? 'error' : 'live', error, label: null, stream: null, reconnects: 0, stalls: 0 }) as unknown as CookingContextValue['camera']

const setup = (error: string | null = null) =>
  render(
    <CookingContext.Provider value={{ camera: camera(error) } as CookingContextValue}>
      <CameraSetup />
    </CookingContext.Provider>,
  )

beforeEach(() => {
  choice.laptop = false
  choice.switchCamera.mockClear()
})

afterEach(cleanup)

describe('CameraSetup', () => {
  it('offers the laptop camera when the hat cam is missing, and switches on click', () => {
    setup('not_found')
    fireEvent.click(screen.getByRole('button', { name: /use this laptop's camera/i }))
    expect(choice.switchCamera).toHaveBeenCalledWith('laptop')
  })

  it('offers nothing extra while the hat cam is working', () => {
    setup(null)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText(/see your bowl/i)).toBeTruthy()
  })

  it('tells a laptop cook how to set up, and offers the hat cam', () => {
    choice.laptop = true
    setup(null)
    expect(screen.getByText(/prop it up/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /use the hat cam instead/i }))
    expect(choice.switchCamera).toHaveBeenCalledWith('hat')
  })
})
