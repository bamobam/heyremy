// The Cook settings control: Level and Persona, each a radio group with a one-line description per option.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { DEFAULT_SETTINGS, LEVELS, PERSONAS } from '../cooking/settings.ts'
import { CookSettingsMenu, CookSettingsView } from './CookSettings.tsx'

afterEach(cleanup)

const group = (name: string) => screen.getByRole('radiogroup', { name })

describe('CookSettingsView', () => {
  it('offers the three Levels and the three Personas, as two groups', () => {
    render(<CookSettingsView settings={DEFAULT_SETTINGS} onChange={() => {}} />)
    expect(screen.getByRole('region', { name: 'Cook settings' })).toBeTruthy()
    expect(within(group('Level')).getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(['beginner', 'intermediate', 'master'])
    expect(within(group('Persona')).getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(['remy', 'grandma', 'sergeant'])
  })

  it('names every option and gives it a one-line description', () => {
    render(<CookSettingsView settings={DEFAULT_SETTINGS} onChange={() => {}} />)
    for (const option of [...LEVELS, ...PERSONAS]) {
      const radio = screen.getByRole('radio', { name: new RegExp(`^${option.label}`) })
      expect(radio).toHaveAccessibleDescription(option.description)
      expect(screen.getByText(option.description)).toBeTruthy()
    }
  })

  it('shows the current choice in each group', () => {
    render(<CookSettingsView settings={{ level: 'master', persona: 'sergeant' }} onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: /^Master/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /^Beginner/ })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: /^Sergeant/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /^Remy/ })).not.toBeChecked()
  })

  it('reports a choice as the one field that changed', () => {
    const onChange = vi.fn()
    render(<CookSettingsView settings={DEFAULT_SETTINGS} onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: /^Intermediate/ }))
    expect(onChange).toHaveBeenLastCalledWith({ level: 'intermediate' })
    fireEvent.click(screen.getByRole('radio', { name: /^Grandma/ }))
    expect(onChange).toHaveBeenLastCalledWith({ persona: 'grandma' })
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('does not report the choice that is already made', () => {
    const onChange = vi.fn()
    render(<CookSettingsView settings={DEFAULT_SETTINGS} onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: /^Beginner/ }))
    fireEvent.click(screen.getByRole('radio', { name: /^Remy/ }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('says in the title that only how Remy talks changes, never the recipe', () => {
    render(<CookSettingsView settings={DEFAULT_SETTINGS} onChange={() => {}} />)
    expect(screen.getByText(/never your recipe/i)).toBeTruthy()
  })

  it('can sit twice on a page without the two sets of radios sharing a name', () => {
    render(
      <>
        <CookSettingsView settings={DEFAULT_SETTINGS} onChange={() => {}} />
        <CookSettingsView settings={{ level: 'master', persona: 'grandma' }} onChange={() => {}} />
      </>,
    )
    const names = new Set(screen.getAllByRole('radio').map((r) => (r as HTMLInputElement).name))
    expect(names.size).toBe(4)
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(4)
  })
})

describe('CookSettingsMenu', () => {
  const opener = () => screen.getByRole('button', { name: /cook settings/i })

  it('says what is chosen on one line, with the choices closed', () => {
    render(<CookSettingsMenu settings={{ level: 'master', persona: 'grandma' }} onChange={() => {}} />)
    expect(opener().textContent).toContain('Master · Grandma')
    expect(opener()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('radio')).toBeNull()
  })

  it('opens the choices on a click, and puts the keyboard on the Level that is chosen', () => {
    render(<CookSettingsMenu settings={{ level: 'intermediate', persona: 'remy' }} onChange={() => {}} />)
    fireEvent.click(opener())
    expect(opener()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('radio')).toHaveLength(6)
    expect(screen.getByRole('radio', { name: /^Intermediate/ })).toHaveFocus()
  })

  it('passes a choice on, one field at a time, and stays open so both can be set', () => {
    const onChange = vi.fn()
    render(<CookSettingsMenu settings={DEFAULT_SETTINGS} onChange={onChange} />)
    fireEvent.click(opener())
    fireEvent.click(screen.getByRole('radio', { name: /^Master/ }))
    fireEvent.click(screen.getByRole('radio', { name: /^Sergeant/ }))
    expect(onChange.mock.calls).toEqual([[{ level: 'master' }], [{ persona: 'sergeant' }]])
    expect(screen.getAllByRole('radio')).toHaveLength(6)
  })

  it('follows the settings it is given, so the line updates as soon as a choice is made', () => {
    const { rerender } = render(<CookSettingsMenu settings={DEFAULT_SETTINGS} onChange={() => {}} />)
    rerender(<CookSettingsMenu settings={{ level: 'master', persona: 'sergeant' }} onChange={() => {}} />)
    expect(opener().textContent).toContain('Master · Sergeant')
  })

  it('closes on Done and hands the focus back to the line', () => {
    render(<CookSettingsMenu settings={DEFAULT_SETTINGS} onChange={() => {}} />)
    fireEvent.click(opener())
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('radio')).toBeNull()
    expect(opener()).toHaveFocus()
  })

  it('closes on the same button, which says Close while it is open', () => {
    render(<CookSettingsMenu settings={DEFAULT_SETTINGS} onChange={() => {}} />)
    fireEvent.click(opener())
    expect(opener().textContent).toContain('Close')
    fireEvent.click(opener())
    expect(screen.queryByRole('radio')).toBeNull()
  })

  it('closes on Escape and hands the focus back to the line', () => {
    render(<CookSettingsMenu settings={DEFAULT_SETTINGS} onChange={() => {}} />)
    fireEvent.click(opener())
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('radio')).toBeNull()
    expect(opener()).toHaveFocus()
  })

  it('closes on a press anywhere else, but not on a press inside the panel', () => {
    render(
      <>
        <p>elsewhere</p>
        <CookSettingsMenu settings={DEFAULT_SETTINGS} onChange={() => {}} />
      </>,
    )
    fireEvent.click(opener())
    fireEvent.pointerDown(screen.getByRole('radio', { name: /^Master/ }))
    expect(screen.getAllByRole('radio')).toHaveLength(6)
    fireEvent.pointerDown(screen.getByText('elsewhere'))
    expect(screen.queryByRole('radio')).toBeNull()
  })

  it('stops listening for Escape once it is closed', () => {
    const remove = vi.spyOn(document, 'removeEventListener')
    render(<CookSettingsMenu settings={DEFAULT_SETTINGS} onChange={() => {}} />)
    fireEvent.click(opener())
    fireEvent.click(opener())
    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('pointerdown', expect.any(Function))
    remove.mockRestore()
  })
})
