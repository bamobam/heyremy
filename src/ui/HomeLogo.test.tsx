import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CookingContext } from '../cooking/context.ts'
import type { CookingContextValue, Phase } from '../cooking/contract.ts'
import { HomeLogo } from './HomeLogo.tsx'

afterEach(cleanup)

function renderAt(phase: Phase) {
  const restart = vi.fn()
  const value = { state: { phase }, controller: { restart } } as unknown as CookingContextValue
  render(
    <CookingContext.Provider value={value}>
      <HomeLogo />
    </CookingContext.Provider>,
  )
  return { restart, logo: screen.getByRole('button', { name: /back to the start/i }) }
}

describe('HomeLogo', () => {
  it('is a button that says where it goes', () => {
    expect(renderAt('input').logo).toBeTruthy()
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

  it('does nothing on the start screen', () => {
    const { restart, logo } = renderAt('input')
    fireEvent.click(logo)
    expect(restart).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})
