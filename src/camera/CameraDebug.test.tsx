import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { C270, IPHONE, MACBOOK, installFakeMediaDevices } from '../test/fakes/media.ts'
import CameraDebug from './CameraDebug.tsx'

afterEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
})

describe('CameraDebug', () => {
  it('shows the live hat cam with its label and resolution', async () => {
    installFakeMediaDevices([MACBOOK, C270, IPHONE])
    render(<CameraDebug />)

    expect(await screen.findByText('live')).toBeInTheDocument()
    expect(screen.getByText(C270.label)).toBeInTheDocument()
    expect(screen.getByText('1280 × 720')).toBeInTheDocument()
    expect(screen.getByTestId('preview')).toBeInTheDocument()
  })

  it('explains what to do when the hat cam is missing', async () => {
    installFakeMediaDevices([MACBOOK, IPHONE])
    render(<CameraDebug />)

    expect(await screen.findByText(/Hat cam not found/)).toBeInTheDocument()
    expect(screen.getByText('error')).toBeInTheDocument()
  })
})
