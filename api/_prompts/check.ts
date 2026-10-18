// Prompt for POST /api/check (SYSTEM_DESIGN 10.6). Pure: values in, prompt parts out.

/** One part of a Gemini request: text, or inline base64 data such as a JPEG. */
export type Part = string | { inlineData: { mimeType: string; data: string } }

export const CHECK_TEMPERATURE = 0.2
// A verdict is ~30 output tokens, but the model's thinking counts toward this cap too: 0-335 tokens even
// at thinking level low, most on judging bubbles in a pan. 512 cut some of those checks off, so this
// leaves plenty of room and still stops a runaway response.
export const CHECK_MAX_TOKENS = 2048

export const CHECK_SYSTEM = `You are Remy, a hands-free cooking buddy. The cook wears a camera on their chef's hat and has asked you to check whether the current step is done. You get one photo from that hat cam, the step's cue (the visible sign the step is done) and the step itself.

Rules:
1. Judge only whether the photo shows the cue. The step is context to help you know what you are looking at; do not judge anything the cue does not mention.
2. If the food is not clearly visible (blurry, blocked, a hand in the way, too dark, out of frame, no bowl or pan in view), return "unsure" with feedback that says what to fix, e.g. "Look down at the bowl and hold still." Never guess "ready". When in doubt between "ready" and anything else, do not say "ready".
3. "not_ready" feedback says what is missing and what to keep doing, e.g. "Still some dry flour streaks. Keep whisking."
4. "ready" feedback confirms and moves on, e.g. "Smooth batter. On to the next step."
5. Feedback is under 15 words, plain words, and sounds natural said aloud. No emoji, no markdown, no lists.

Return only JSON: {"status": "ready" | "not_ready" | "unsure", "feedback": string}.`

// Added to CHECK_SYSTEM only when a check sends several frames, so a single-photo check is word for word what it was.
const CHECK_BURST_RULES = `This check sends several frames instead of one photo. They come from the same camera over about two seconds, in time order: the first is the oldest. The cue changes with time (boiling, browning, rising), so judge it by what changes between the frames, and use the last frame for how things are now. Rules 1 to 5 still apply to every frame.`

/** The system prompt for a check with this many images: the usual one, plus the frames rule when there are several. */
export function buildCheckSystem(imageCount: number): string {
  return imageCount > 1 ? `${CHECK_SYSTEM}\n\n${CHECK_BURST_RULES}` : CHECK_SYSTEM
}

const jpeg = (data: string): Part => ({ inlineData: { mimeType: 'image/jpeg', data } })

/**
 * The request parts: the cue and step as text, then the JPEG. With a list of several, each frame follows
 * a short label, in the order given (time order, oldest first).
 */
export function buildCheckParts(images: string | string[], cue: string, step: string): Part[] {
  const frames = typeof images === 'string' ? [images] : images
  if (frames.length === 1) {
    return [`Cue: ${cue}\nStep: ${step}\nIs the cue met in this photo?`, jpeg(frames[0])]
  }
  return [
    `Cue: ${cue}\nStep: ${step}\nIs the cue met in these ${frames.length} frames?`,
    ...frames.flatMap((data, i) => [`Frame ${i + 1} of ${frames.length}`, jpeg(data)]),
  ]
}
