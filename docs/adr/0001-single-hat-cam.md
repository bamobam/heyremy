# One hat-mounted camera for gestures and food

Remy uses a single Logitech webcam taped to a cap under the chef's hat, pointing forward-down, to see both the cook's gestures and the food. A tripod behind the pan or two cameras (laptop webcam for gestures, Logitech for food) were simpler to set up, but a tripod can't see into the food from the right angle without being in the way, and two cameras meant two streams and a device picker. The hat cam sees what the cook sees, and matches the pitch: Remy hides under the hat.

## Consequences

- Hands are in frame while cooking, so gestures must be held about 1 second at 0.7+ confidence, then a 2-second cooldown.
- Head movement blurs frames, so a check grabs about 0.5 seconds of frames and sends the sharpest.
- Thumbs-up may read poorly from above; if it registers below about 70% in testing, switch to open palm / closed fist / victory.
- Fallback if the rig fails: the same camera on a tripod, angled down at the pan.
