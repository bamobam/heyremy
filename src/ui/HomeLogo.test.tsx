import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CookingContext } from '../cooking/context.ts'
import type { CookingContextValue, Phase } from '../cooking/contract.ts'
import { HomeLogo } from './HomeLogo.tsx'

afterEach(cleanup)

function renderAt(phase: Phase) {
  const restart = vi.fn()
  const setDialogOpen = vi.fn()
  const value = { state: { phase }, controller: { restart }, setDialogOpen } as unknown as CookingContextValue
  render(
    <CookingContext.Provider value={value}>
      <HomeLogo />
    </CookingContext.Provider>,
  )
  return { restart, setDialogOpen, logo: screen.queryByRole('button', { name: /back to the start/i }) as HTMLElement }
}

describe('HomeLogo', () => {
  it('is a button that says where it goes, once there is somewhere to go', () => {
    expect(renderAt('prep').logo).toBeTruthy()
  })

  it('asks before leaving a recipe that is being cooked, and keeps the place on "Keep cooking"', () => {
    const { restart, logo } = renderAt('cooking')
    fireEvent.click(logo)
    expect(screen.getByRole('alertdialog', { name: /leave this recipe/i })).toBeTruthy()
    expect(restart).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /keep cooking/i }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(restart).not.toHaveBeenCalled()
  })

  it('leaves for the start screen when the cook confirms', () => {
    const { restart, logo } = renderAt('cooking')
    fireEvent.click(logo)
    fireEvent.click(screen.getByRole('button', { name: /^leave$/i }))
    expect(restart).toHaveBeenCalledTimes(1)
  })

  it('closes the question on Escape', () => {
    const { logo } = renderAt('prep')
    fireEvent.click(logo)
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('goes straight home when the cook is done', () => {
    const { restart, logo } = renderAt('done')
    fireEvent.click(logo)
    expect(restart).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('is not a button on the start screen, where there is nowhere to go', () => {
    const { logo } = renderAt('input')
    expect(logo).toBeNull()
    expect(screen.getByText('REMY')).toBeTruthy()
  })

  it('says it is a modal question, and holds gestures while it is open', () => {
    const { logo, setDialogOpen } = renderAt('cooking')
    fireEvent.click(logo)
    expect(screen.getByRole('alertdialog').getAttribute('aria-modal')).toBe('true')
    expect(setDialogOpen).toHaveBeenLastCalledWith(true)

    fireEvent.click(screen.getByRole('button', { name: /keep cooking/i }))
    expect(setDialogOpen).toHaveBeenLastCalledWith(false)
  })

  it('closes on Escape wherever the focus is, and hands the focus back to the logo', () => {
    const { logo } = renderAt('cooking')
    fireEvent.click(logo)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(document.activeElement).toBe(logo)
  })
})
