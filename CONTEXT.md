# Remy

Remy is a hands-free cooking buddy: it reads a recipe aloud one step at a time, moves on when the cook gestures, and looks at the food to say whether a step is done.

## Recipes

**Recipe**:
The text a cook pastes in, or accepts from a Suggestion, before Remy reorganizes it. It is the root: a Version always traces back to one.
_Avoid_: Original, input

**Ingredient**:
One item the recipe uses, with its amount at the recipe's original servings.
_Avoid_: Item, component

**Servings**:
How many portions the recipe makes; the cook can change it during prep, and every ingredient amount scales with it.
_Avoid_: Portion size, yield, batch

**Prep**:
A task that must happen before cooking starts, pulled out of wherever the recipe buried it (preheating, softening, taking things out of the fridge).
_Avoid_: Setup, mise en place

**Step**:
One short instruction the cook does at a time, shown and spoken on its own.
_Avoid_: Instruction, line, stage

**Heads-up**:
A warning attached to a step about something the next step needs ready (a hot pan, a greased tray).
_Avoid_: Reminder, tip, alert

**Cue**:
The visible sign that a step is done, written so it can be checked by looking ("smooth, no dry flour streaks").
_Avoid_: Ready-when, done condition, criteria

**Checkable step**:
A step whose cue can be judged from a picture of the food. Steps without a visual cue are never checked.

## Cooking

**Cooking mode**:
The hands-free part of a session, from pressing Start to the last step, during which the cook never touches the device.

**Hat cam**:
The single camera, worn on the chef's hat, that sees both the cook's hand gestures and the food.
_Avoid_: Overhead camera, food camera, webcam

**Laptop camera**:
The device's own built-in camera, used instead of the hat cam by cooks who don't have one. The gestures and checks are the same, but it tends to see the cook rather than the food, so checks are less reliable. The hat cam remains the camera Remy is designed around.
_Avoid_: Webcam, any cam

**Gesture**:
A held hand shape the cook makes in view of the hat cam to control cooking mode (next, back, check).

**Check**:
The cook asking Remy to look at the food for the current step's cue.
_Avoid_: Scan, analysis, snapshot

**Verdict**:
Remy's spoken answer to a check: whether the cue is met, and what to do next if it isn't.
_Avoid_: Result, feedback, response

**Question**:
The cook asking Remy something out loud during cooking mode (a substitution, a technique, how long to wait, "was I meant to do this before that?"); Remy answers aloud, using the whole recipe, how far the cook has got and what the camera sees.
_Avoid_: Query, prompt, voice command

**Auto-check**:
Remy checking a checkable step on its own, repeatedly, and speaking up only when the cue is met.

**Timer**:
A countdown the cook starts, often from the time a step gives, that Remy announces in its own voice when it ends. Several can run at once.
_Avoid_: Alarm, countdown

## Cook settings

**Level**:
How much guidance Remy gives while reading steps: beginner explains technique and what to watch for, master is brief. It changes only what is said, never a Recipe's steps, amounts or cues.
_Avoid_: Difficulty, skill, mode

**Persona**:
The character Remy speaks as: its voice, catchphrases, and the wording of verdicts and answers. It never changes a Recipe.
_Avoid_: Style, theme, chef

## Choosing what to cook

**Pantry**:
The ingredients a cook has on hand, read from a photo or typed in, and corrected by the cook before Remy uses them.
_Avoid_: Inventory, fridge contents

**Suggestion**:
A dish Remy proposes from the Pantry, with the ingredients the cook is missing. Choosing one gives Remy the text of a Recipe to cook.
_Avoid_: Recommendation, option

**Shopping list**:
The ingredients a chosen Suggestion needs that the Pantry lacks.

## Saved recipes

**Version**:
A saved, cook-ready form of a Recipe (its ingredients, prep and steps), shaped by a cook's own changes: a reordering, a substitution, a rewritten step. A Version comes from a Recipe or from another Version. Changing the servings does not make a new Version.
_Avoid_: Copy, variation, modified recipe

**Lineage**:
The chain of Versions, parent to child, that leads from a Version back to the Recipe it began as, so a cook can see what they started from.
_Avoid_: History, ancestry, tree

**Stagger**:
Starting the parts of a dish at different times, longest-cooking first, so they finish together (the vegetables go in before the meat when they take longer). Offered as an opt-in pass that gives the cook a new Version, with a reason for each change.
_Avoid_: Reorder, optimize, schedule

**Kitchen profile**:
What Remy knows about the cook's kitchen and tastes: equipment, diet and allergies, pantry staples, and default servings, Level and Persona. Remy flags what doesn't fit and offers changes; it never rewrites a Recipe on its own.
_Avoid_: Settings, account

**Cook log**:
The record of each time a cook finishes a Version: when, how many servings, how it went, and a note.
_Avoid_: History, session
