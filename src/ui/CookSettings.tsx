// Cook settings (CONTEXT.md): the Level and Persona the cook picks before Remy starts reading. A Level
// changes only what Remy says; a Persona changes only his voice and the wording of what he says live.
// Neither ever changes the recipe. Offered on the start screen and on prep, until Start (no switching
// mid-cook yet).
//
// One line says what is chosen ("Cook settings  Beginner · Remy  Change"); it opens the two groups in a
// panel over the page. The groups themselves are too tall to sit inline: on a 720 px-high laptop the prep
// screen has no room for them without pushing the Start button off the screen.
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { LEVELS, PERSONAS, summarizeSettings, useCooking, type CookSettings as Settings, type SettingOption } from '../cooking/contract.ts'
import './cookSettings.css'

function OptionGroup<Id extends string>({
  legend,
  options,
  value,
  onPick,
}: {
  legend: string
  options: readonly SettingOption<Id>[]
  value: Id
  onPick: (id: Id) => void
}) {
  const name = useId()
  const legendId = `${name}-legend`
  return (
    <div className="ui-settings__group" role="radiogroup" aria-labelledby={legendId}>
      <span className="ui-settings__legend" id={legendId}>
        {legend}
      </span>
      <div className="ui-settings__options">
        {options.map((option) => {
          const describedBy = `${name}-${option.id}`
          return (
            <label key={option.id} className="ui-opt">
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={value === option.id}
                aria-label={option.label}
                aria-describedby={describedBy}
                onChange={() => value !== option.id && onPick(option.id)}
              />
              <b className="ui-opt__name">{option.label}</b>
              <span className="ui-opt__desc" id={describedBy}>
                {option.description}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

/** The control itself, with the settings and what to do with a choice passed in. */
export function CookSettingsView({ settings, onChange }: { settings: Settings; onChange: (change: Partial<Settings>) => void }) {
  return (
    <section className="ui-settings" aria-label="Cook settings">
      <h2 className="ui-settings__title">
        Cook settings <span>How Remy talks, never your recipe</span>
      </h2>
      <OptionGroup legend="Level" options={LEVELS} value={settings.level} onPick={(level) => onChange({ level })} />
      <OptionGroup legend="Persona" options={PERSONAS} value={settings.persona} onPick={(persona) => onChange({ persona })} />
    </section>
  )
}

/** The one-line control: what is chosen, and a button that opens the choices upward. Escape or a click elsewhere closes them. */
export function CookSettingsMenu({ settings, onChange }: { settings: Settings; onChange: (change: Partial<Settings>) => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  const close = useCallback((refocus: boolean) => {
    setOpen(false)
    if (refocus) button.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    // Into the panel, on the Level that is chosen, so the arrow keys work straight away.
    root.current?.querySelector<HTMLInputElement>('input:checked')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(true)
    const onPointerDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && close(false)
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open, close])

  return (
    <div className="ui-settings-pop" ref={root}>
      <button
        ref={button}
        type="button"
        className="ui-settings-pop__btn"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="ui-settings-pop__label">Cook settings</span>
        <b className="ui-settings-pop__value">{summarizeSettings(settings)}</b>
        <span className="ui-settings-pop__change">{open ? 'Close' : 'Change'}</span>
      </button>
      {open && (
        <div className="ui-settings-pop__panel" id={panelId}>
          <CookSettingsView settings={settings} onChange={onChange} />
          <button type="button" className="ui-btn ui-settings-pop__done" onClick={() => close(true)}>
            Done
          </button>
        </div>
      )}
    </div>
  )
}

/** The control wired to the session: choices are remembered in this browser. */
export function CookSettings() {
  const { state, controller } = useCooking()
  return <CookSettingsMenu settings={state.settings} onChange={controller.setSettings} />
}
