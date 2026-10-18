// "Send feedback": a link to the form the project owner sets in VITE_FEEDBACK_URL (a build-time
// variable, so it is public by design and holds no secret). With nothing set, nothing is shown.

/** The address, if it is a secure web address; anything else (a script, plain http, junk) is dropped. */
export function feedbackUrl(raw: string | undefined): string | null {
  const text = raw?.trim()
  if (!text) return null
  try {
    const url = new URL(text)
    return url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

export function FeedbackLink() {
  const url = feedbackUrl(import.meta.env.VITE_FEEDBACK_URL as string | undefined)
  if (!url) return null
  return (
    <a className="ui-feedback" href={url} target="_blank" rel="noopener noreferrer">
      Send feedback
    </a>
  )
}
