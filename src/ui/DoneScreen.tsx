// DoneScreen (§9.2): Remy celebrating on the sage field, the session's stats, and one button.
import type { CookingStats } from '../cooking/contract.ts'
import { RemyBadge, SpeechBubble } from './Remy.tsx'
import { SAY } from './say.ts'

/** "You checked 3 times and never touched the screen." */
function statsLine(stats: CookingStats): string {
  const checks = stats.checks === 1 ? 'once' : `${stats.checks} times`
  if (stats.taps === 0) return `You checked ${checks} and never touched the screen.`
  return `You checked ${checks} and touched the screen ${stats.taps} ${stats.taps === 1 ? 'time' : 'times'}.`
}

export function DoneScreen({ stats, title, onRestart }: { stats: CookingStats; title: string; onRestart: () => void }) {
  return (
    <div className="ui-full ui-enter" style={{ background: 'var(--sage)' }}>
      <div className="ui-done__meet">
        <RemyBadge size={230} color="var(--sparkle)" form="burst" />
        <SpeechBubble>
          <b>{SAY.done}</b>
          <br />
          All done with the {title.toLowerCase()}.
        </SpeechBubble>
      </div>
      <p className="ui-done__stats">{statsLine(stats)}</p>
      <button type="button" className="ui-btn ui-btn--cream" onClick={onRestart}>
        Let's cook something else!
      </button>
    </div>
  )
}