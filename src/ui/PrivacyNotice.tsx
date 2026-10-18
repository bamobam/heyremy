// A one-time notice, over the start screen, about what Remy sends to other services. It is a notice,
// not a consent form: Remy has no account to attach a choice to. It does stop the screen behind it
// (App makes that inert), so the first recipe is only sent once the cook has seen what goes where.
import { useState } from 'react'
import { isMockApi } from '../api/index.ts'
import { pageStorage } from '../cooking/storage.ts'
import { markNoticeSeen, needsNotice } from './notice.ts'

/** Whether the notice is up, and how it is dismissed. */
export function useNotice(): { open: boolean; accept: () => void } {
  const [open, setOpen] = useState(() => needsNotice(isMockApi(), pageStorage()))
  return {
    open,
    accept: () => {
      markNoticeSeen(pageStorage())
      setOpen(false)
    },
  }
}

export function PrivacyNotice({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="ui-notice">
      <div className="ui-notice__card" role="dialog" aria-modal="true" aria-labelledby="ui-notice-title">
        <h2 id="ui-notice-title">What Remy sends</h2>
        <p>To read recipes, speak and judge your food, Remy sends a few things through its own server to other services:</p>
        <ul>
          <li>The recipe you paste, to Google's Gemini. If you paste a link, Remy's server fetches the page first.</li>
          <li>A photo from your camera, with the step's text, each time you ask "is it ready?", to Google's Gemini. It shows whatever the camera sees, which may include you.</li>
          <li>The lines Remy says, to ElevenLabs, to make its voice.</li>
        </ul>
        <p>Remy doesn't save any of it, and your camera video never leaves your device. Those services handle what they receive under their own terms. The page also loads its font from Google Fonts.</p>
        <button type="button" className="ui-btn" autoFocus onClick={onAccept}>
          Got it
        </button>
      </div>
    </div>
  )
}
