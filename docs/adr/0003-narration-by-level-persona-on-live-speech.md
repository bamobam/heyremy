# Narration is written per Level at parse time; a Persona only changes live speech

One parse writes every step's spoken narration at all three Levels (beginner, intermediate, master), and Remy voices the one the cook chose. Re-parsing whenever the Level changes would cost about four seconds and a full set of voice clips, and would tie saved Versions to a Level. Writing narration at speak time would add delay in the middle of cooking.

A Persona changes the voice, the catchphrases, and the wording of the lines Remy produces live (verdicts and answers to Questions). It does not rewrite step narration: otherwise every recipe, Level and Persona combination would need its own text and its own voice clips.

## Consequences

- A Version holds three narrations per step and is independent of Level and Persona. Switching Level mid-cook is instant.
- The parse output is larger, and only the chosen Level's clips are voiced.
- A Persona reaches step narration only through the voice it is read in, so its character shows more in live lines than in steps.
- Level changes only what is said. Steps, amounts and cues are the same at every Level.
