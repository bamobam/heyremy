// A one-time notice, over the start screen, about what Remy sends to other services. Camera video
// stays in the browser; only a photo goes out, and only when the cook asks "is it ready?".
import { useState } from 'react'
import { isMockApi } from '../api/index.ts'
import { giveConsent, needsNotice } from './consent.ts'
import { pageStorage } from './storage.ts'

export function ConsentNotice() {
  const [open, setOpen] = useState(() => needsNotice(isMockApi(), pageStorage()))
  if (!open) return null

  const accept = () => {
    giveConsent(pageStorage())
    setOpen(false)
  }

  return (
    <div className="ui-consent">
      <div className="ui-consent__card" role="dialog" aria-modal="true" aria-labelledby="ui-consent-title">
        <h2 id="ui-consent-title">What Remy sends</h2>
        <p>To read recipes, speak and judge your food, Remy sends a few things to other services:</p>
        <ul>
          <li>The recipe you paste, to Google's Gemini.</li>
          <li>A photo from your camera each time you ask "is it ready?", to Google's Gemini.</li>
          <li>The lines Remy says, to ElevenLabs, to make its voice.</li>
        </ul>
        <p>Remy doesn't save any of it, and your camera video never leaves your device. Those services handle what they receive under their own terms.</p>
        <button type="button" className="ui-btn" autoFocus onClick={accept}>
          Got it
        </button>
      </div>
    </div>
  )
}
