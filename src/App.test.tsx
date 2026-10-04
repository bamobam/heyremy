// §9.2: the phase decides which screen the cook sees, and the whole thing runs off one provider.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from './App.tsx'
import { installFakeMediaDevices, MACBOOK } from './test/fakes/media.ts'

beforeEach(() => {
  installFakeMediaDevices([MACBOOK])
})

afterEach(cleanup)

describe('the app shell', () => {
  it('opens on the recipe box', () => {
    render(<App />)
    expect(screen.getByRole('textbox')).toBeTruthy()
  })

  it('moves from the recipe box to prep, keeping the recipe the cook pasted', async () => {
    render(<App />)
    const typed = (screen.getByRole('textbox') as HTMLTextAreaElement).value
    fireEvent.click(screen.getByRole('button', { name: /let'?s cook/i }))

    await screen.findByText(/before you start/i, undefined, { timeout: 15_000 })
    expect(typed).toMatch(/pancakes/)
    expect(screen.queryByRole('textbox')).toBeNull()
  }, 20_000)

  it('shows the ingredient amounts at the recipe’s own servings', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /let'?s cook/i }))

    await screen.findByText(/before you start/i, undefined, { timeout: 15_000 })
    expect(screen.getByText('1 cup')).toBeTruthy()
    expect(screen.getByText('flour')).toBeTruthy()
  }, 20_000)
})