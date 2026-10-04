# Camera track plan

How the camera track (system design section 5) gets built: small branches, tests first, and a camera signal that stays up the whole time the app is open.

## Current focus

Three things first, in this order: **live stream**, **detection** (MediaPipe hand and gesture recognition), **image capture**. Cable tests and the reconnect watchdog wait until these work.

| # | Branch | What | Done when |
| --- | --- | --- | --- |
| 1 | `nam/camera-test-setup` | Vitest + jsdom, camera fakes, `npm run cam:check` | `npm test` green; `cam:check` sees the hat cam (C270 or C920) |
| 2 | `nam/hatcam-stream` | Pick the hat cam (C270 or C920), open it, live preview on `/?debug=camera` | Preview shows the hat cam, never the MacBook or iPhone camera |
| 3 | `nam/hand-detection` | MediaPipe gesture recognizer on the live stream (frame loop + recognizer adapter), label, score and hand landmarks drawn on the debug page | Thumbs-up / thumbs-down / open palm show up live with their scores |
| 4 | `nam/grab-frame` | Sharpest-of-6 JPEG capture, shown on the debug page | "Grab" button shows a sharp 80–150 KB JPEG |

**Later**, in the order below: the keepalive watchdog and cable tests (old branch 3), gesture logic (4), and `useGestures` (7). Branches 5 and 6 below are folded into the new branch 3.

## Hardware, as this Mac sees it

Checked with `system_profiler SPCameraDataType` on 2026-10-03, once with each hat cam option plugged in:

| Camera | macOS name | USB id | Notes |
| --- | --- | --- | --- |
| **Hat cam option 1: Logitech C270** | `UVC Camera VendorID_1133 ProductID_2085` | `046d:0825` | 1280×720 at 30 fps over USB 2.0 |
| **Hat cam option 2: Logitech C920** | `HD Pro Webcam C920` (`UVC Camera VendorID_1133 ProductID_2194`) | `046d:0892` | Up to 1080p at 30 fps; the app still asks for 1280×720 |
| Built-in | `MacBook Air Camera` | none | Must never be picked |
| iPhone | `iPhone Camera` (Continuity Camera) | none | Must never be picked; macOS can make it the default camera |

Either option can be the hat cam. It is attached to the hat and connected to a Thunderbolt/USB-C port through an extension cable. Plug in one at a time: if both are connected, the app opens whichever Chrome lists first. Adding another camera is a one-line change in `selectHatCam.ts` and `camCheck.ts`.

The design says "open the camera whose label contains Logitech", but neither camera is labelled that way. macOS calls the C270 "UVC Camera" and the C920 "HD Pro Webcam C920". Chrome usually appends the USB id to the label, e.g. `UVC Camera (046d:0825)`, so the selection rule matches on **`046d:0825` or `046d:0892`** first, then on the names Logitech, C270 and C920. Branch 2 confirms the label Chrome actually shows for each.

Constraints ask for 1280×720 at 30 fps using `ideal` values, never `exact`, so a camera that offers a different mode doesn't throw `OverconstrainedError`.

### The extension cable

The camera rides on the cook's head and the cable runs down to the laptop, so every head turn moves the cable. That makes **brief disconnects the most likely failure in the whole demo**, more than anything in the software. Plan for it on both sides:

**Rig (physical):**
- **Total length under 5 m** (camera lead plus extension). That's the USB 2.0 limit for a passive cable. Longer needs an *active* extension.
- **Strain relief at both ends.** Tape the cable to the hat and again at the shoulder or back, so a head turn pulls on the tape, not the camera plug. Leave a slack loop near the laptop and tape it to the table, so a tug never reaches the laptop port.
- **The connector between the camera lead and the extension is the weak point.** Wrap it in tape so it can't half-separate. A half-seated USB plug is what causes the freeze-without-disconnect case below.
- **Plug directly into the laptop** with a short USB-C-to-A adapter, not a hub, so there's one fewer joint.
- **Route the cable away from the stove**, and away from where the cook's hands and whisk move.

**Software (branch 3):** reconnecting has to be fast and fully automatic, and a gesture held during a dropout must not fire after reconnecting (branch 7 covers this).

## What "camera signal at all times" means

| Threat | How it's caught | What happens |
| --- | --- | --- |
| Wrong camera opened (MacBook, iPhone) | `pickHatCam` only accepts `046d:0825` / `046d:0892` or the names Logitech / C270 / C920, and the stream is opened with `deviceId: { exact }` | Never opens anything else; shows "Hat cam not found" |
| Head turn tugs the extension cable; plug pulled or joint loosens | Track `ended` event and `devicechange` | Status `reconnecting`; reopens the **same** camera as soon as it reappears |
| Stream freezes without ending (half-seated plug, USB hiccup) | No new frame for 2 s (`requestVideoFrameCallback`) | Stops the track and reopens it |
| Rapid drop, reconnect, drop as the cable flexes | Watchdog sees repeated `ended` within seconds | Each reopen waits for the device to be listed again; no overlapping `getUserMedia` calls |
| Brief `mute` from macOS | The same frame check | Not tracked separately: a mute under 2 s changes nothing, and one that lasts 2 s means no frames, so the stream is restarted |
| Another app holds the camera (Zoom, Photo Booth, FaceTime) | `NotReadableError` | "Camera busy. Close other camera apps." Retries every 2 s |
| Laptop screen sleeps | Screen Wake Lock while cooking | Screen stays on; lock re-requested when the tab becomes visible again |
| Tab in the background | Chrome sends no frames to it | The demo tab stays in front; `frameLoop` pauses while hidden and resumes on return, and the watchdog does not count a hidden tab as a freeze |
| Permission denied | `NotAllowedError` | "Allow camera access in Chrome settings." No retry loop |

Reconnecting to the **same** camera is not a backup path. It never switches to another camera, so it fits the "no fallbacks" rule in the system design. Section 5.1 currently says "plug in the hat cam and reload". Branch 3 updates it to "reconnects on its own".

**Targets:** live again within 2 s of re-plugging. A frozen stream is detected within 2 s and recovered within 3 s. Zero stalls in a 30-minute soak with the hat on.

## How testing works

- **Vitest + jsdom + Testing Library** for everything. Each branch starts by writing its tests (red), then the code (green).
- **Pure modules get table-driven tests** with fake timestamps: the selection rule, the watchdog, the filter, the mapper, hand presence, and sharpness scoring.
- **Browser APIs get small fakes** in `src/test/fakes/`:
  - `FakeMediaDevices`: `plug()`, `unplug()`, `devicechange` events, scripted `getUserMedia` errors.
  - `FakeTrack`: `end()`, `mute()`, `unmute()`.
  - `FakeVideo`: frame callbacks.
- **MediaPipe and canvas don't run in jsdom.** Their adapters are kept thin and tested on fixtures (recorded MediaPipe result JSON, synthetic pixel arrays). The real model and real canvas are checked on the debug page.
- **A hardware check on the real hat cam (C270 or C920) at `/?debug=camera`** closes every branch. It's short, written down, and done before opening the PR.

## Branches

Each branch is one PR into `main`, merged within about an hour, with `npm test`, `npm run build` and `npm run lint` passing. Branch names follow the `nam/<task>` convention from `PLAN.md`.

```
1 nam/camera-test-setup ─► 2 nam/hatcam-select ─► 3 nam/hatcam-keepalive ─┐
                                                                          ├─► 7 nam/use-gestures ─► 8 nam/grab-frame
4 nam/gesture-logic ─────────────────────────────────────────────────────┤
5 nam/frame-loop ────────────────────────────────────────────────────────┤
6 nam/recognizer ────────────────────────────────────────────────────────┘
```

Branches 4, 5 and 6 don't depend on the camera, so they can be built while waiting on PR review, or handed to a teammate.

### 1. `nam/camera-test-setup` (about 30 min)

**Tests first:**
- `src/test/smoke.test.ts`: Vitest runs in jsdom.
- `scripts/camCheck.test.ts`: `parseCameras(systemProfilerText)` finds `VendorID_1133 ProductID_2085` in a saved copy of today's output, and reports "missing" for output without it.

**Build:**
- Dev dependencies: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`. Scripts: `test`, `test:watch`.
- `vite.config.ts`: a `test` block (`environment: 'jsdom'`, setup file).
- `src/types.ts`: add `GestureIntent`, `GestureEvent`, `HoldProgress` (the contract additions in system design section 4).
- `scripts/camCheck.ts` + `npm run cam:check`: runs `system_profiler SPCameraDataType` and prints "OK: Hat cam connected" or "FAIL: Hat cam not found, check the USB cable and adapter". It runs before every demo and every hardware check.
- `src/test/fakes/`: `FakeMediaDevices`, `FakeTrack`, `FakeVideo`.

**Done when:** `npm test` is green and `npm run cam:check` prints OK with the C270 or the C920 plugged in and FAIL with it unplugged.

### 2. `nam/hatcam-select` (about 45 min)

**Tests first** (`camera/selectHatCam.test.ts`, `camera/openHatCam.test.ts`):
- `pickHatCam` with real-shaped device lists:
  - picks `UVC Camera (046d:0825)` (C270) or `HD Pro Webcam C920 (046d:0892)` from a list containing it, `MacBook Air Camera` and `iPhone Camera`
  - also matches labels containing `Logitech`, `C270` or `C920`, in case Chrome labels it differently
  - returns `null` when only the MacBook and iPhone are listed; **never** falls back to them
  - returns `null` when labels are empty (permission not granted yet)
  - prefers a USB id match over a generic "Logitech" match
- `openHatCam` with `FakeMediaDevices`:
  - empty labels → requests access once, re-enumerates, then opens with `deviceId: { exact: id }`
  - constraints are `ideal` 1280×720 at 30 fps
  - `NotAllowedError` → `denied`; `NotFoundError` or no match → `not_found`; `NotReadableError` → `busy`

**Build:** `src/camera/selectHatCam.ts` (pure) and `src/camera/openHatCam.ts`.

**Hardware check:** a temporary debug page shows the chosen label. Write down the exact label Chrome shows for each camera (update the matcher test if it differs). Confirm it picks the hat cam even with the iPhone nearby and Continuity Camera on.

### 3. `nam/hatcam-keepalive` (about 1.5 h, the core of "at all times")

**Tests first** (`camera/watchdog.test.ts`, pure state machine, fake time):

| Given | Event | Then |
| --- | --- | --- |
| `live` | track `ended` | `reconnecting`, release the track |
| `reconnecting` | `devicechange` with the hat cam present | `connecting`, reopen with the same `deviceId` (or a re-matched one if macOS gave it a new id) |
| `reconnecting` | `devicechange` with only other cameras | stays `reconnecting`; **never** opens them |
| `reconnecting` | 2 s poll tick, hat cam present | reopen (backup for a missed `devicechange`) |
| `live` | no frame for 2 s | `stalled` → release and reopen |
| `live` | `mute`, then `unmute` within 2 s | stays `live`, no action |
| `live` | `mute` for 2 s or more | treated as a freeze |
| `connecting` | track `ended` before the stream is live (cable flapping) | back to `reconnecting`; the pending open is cancelled, never two opens at once |
| `connecting` | `busy` error | retry in 2 s, status `busy` |
| `connecting` | `denied` | `error`, no retries |
| any | `stop()` (unmount) | release everything, no more timers |

Hook tests (`camera/useHatCam.test.tsx`, Testing Library + fakes):
- status goes `connecting` → `live` → `reconnecting` → `live` across `unplug()` / `plug()`
- the `<video>` element gets the new stream after a reconnect
- `reconnects` and `stalls` counters increase
- unmounting stops tracks and removes listeners (no leaks between tests)

**Build:**
- `src/camera/watchdog.ts` (pure): `stepWatchdog(state, event, now) → { state, actions }`.
- `src/camera/useHatCam.ts`. Returns `{ videoRef, status, deviceLabel, stats: { fps, reconnects, stalls } }`, with status `connecting | live | reconnecting | busy | error`. It listens for track `ended`, `mute` and `unmute`, `devicechange`, and frame callbacks (`requestVideoFrameCallback`). It takes the Screen Wake Lock while live and re-requests it on `visibilitychange`.
- `src/camera/CameraDebug.tsx` at `/?debug=camera`: preview, label, resolution, measured fps, status, counters, and a timestamped event log. Every later branch adds its own panel here.
- Update system design section 5.1 to describe reconnecting.

**Hardware check** (on the debug page, with the camera on the hat and the real extension cable, written down in the PR):
1. Unplug and replug **at each joint**: the laptop port, and the camera-to-extension connector. 5 times each. Each time it's `live` again in under 2 s.
2. **Tug test:** wearing the hat, turn your head fully left and right, look down at the bowl and back up, 20 times. With the strain relief in place there are no drops. Without it, every drop recovers on its own.
3. Wiggle the joint between the camera lead and the extension, to make a half-seated plug. Any freeze is caught within 2 s and recovers.
4. Plug and unplug quickly 3 times in a row. The app ends `live`, with no stuck `connecting` state.
5. Open Photo Booth while the app runs, then close it. The app shows `busy`, then recovers.
6. Wear the hat for 30 minutes of normal cooking movement without touching the laptop. The screen stays on, fps stays near 30, and every drop that happens recovers.

### 4. `nam/gesture-logic` (about 1 h, pure, no hardware)

**Tests first:**
- `gestureMapper`: `Thumb_Up` → `next`, `Thumb_Down` → `back`, `Open_Palm` → `check`, an unknown label or `None` → `null`. Same for `FALLBACK_MAPPING`.
- `gestureFilter`: one test per row of the transition table in system design 5.5. Plus: fires once per hold, never during cooldown, a 3-frame flicker doesn't reset, a 4-frame flicker does, a score of 0.69 never starts a hold, `disabled` keeps it idle.
- `handPresence`: gone after 300 ms of no hand, one dropped frame isn't "gone", it comes back immediately when the hand reappears.

**Build:** `src/camera/gestureMapper.ts`, `gestureFilter.ts`, `handPresence.ts`.

### 5. `nam/frame-loop` (about 30 min)

**Tests first** (fake `requestAnimationFrame` and clock):
- at 60 Hz rAF with `fps = 15`, `onFrame` runs about 15 times per second
- skipped while `video.readyState < 2`
- paused while `document.hidden`, resumes on return
- the stop function cancels the next frame

**Build:** `src/camera/frameLoop.ts`.

### 6. `nam/recognizer` (about 1 h)

**Tests first:**
- `toRawGesture(result)` (pure) on recorded MediaPipe result JSON: picks the top gesture and its score; no hands → `{ label: 'None', score: 0, handPresent: false }`; a hand with no gesture → `handPresent: true`, label `None`.
- `createRecognizer` loads files from `/models/` and `/wasm/` (the MediaPipe loader is mocked; this only checks the paths).

**Build:**
- Add `@mediapipe/tasks-vision`. `scripts/copyMediapipe.ts` copies the wasm into `public/wasm/` (on `postinstall`). Download `gesture_recognizer.task` into `public/models/` once and commit it, so nothing loads from a CDN at the venue.
- `src/camera/recognizer.ts`: thin adapter in `VIDEO` mode, one hand.
- Debug page panel: live label, score and hand-present flag.

**Hardware check, the hour-1 gesture test from `PLAN.md`:** with the hat on and the cam pointing down, try each gesture 20 times and count hits. Record the numbers in the PR. If thumbs-up is below about 70%, switch to `FALLBACK_MAPPING` (a one-line change from branch 4).

### 7. `nam/use-gestures` (about 45 min)

**Tests first** (fake recognizer that plays a scripted list of labels, fake clock):
- 1.2 s of `Thumb_Up` at 0.9 → exactly one `{ intent: 'next' }` event
- `holdProgress` rises from 0 to 1 during the hold
- `enabled: false` → no events
- **camera not `live` (reconnecting) → filter reset, no events, `holdProgress` 0.** A half-finished hold never fires after a reconnect.
- `handVisible` follows `handPresence`

**Build:** `src/camera/useGestures.ts`, combining `useHatCam`, `frameLoop`, the recognizer, the mapper, the filter and `handPresence`. It exposes Seam A for the controller: `{ holdProgress, handVisible, status, grabFrame }`.

**Hardware check:** the debug page shows the hold ring and an event log. Ten holds of each gesture each give one event, and random hand movement while whisking gives none.

### 8. `nam/grab-frame` (about 1 h)

**Tests first:**
- `laplacianVariance(gray, w, h)` (pure): a synthetic checkerboard scores higher than the same board blurred; a flat image scores about 0.
- `pickSharpest(scores)` returns the highest index.
- `grabSharpestFrame` with an injected canvas fake takes 6 frames over 500 ms and returns the sharpest, resized so the long side is 768 px.
- **Camera not `live` → rejects with `camera_unavailable`**, so the check flow can say "Camera reconnecting, try again" instead of sending a black frame.

**Build:** `src/camera/sharpness.ts` (pure) and `src/camera/grabSharpestFrame.ts`.

**Hardware check:** a "Grab" button on the debug page shows the chosen frame, its size in KB (target 80–150 KB), and all 6 sharpness scores. Shake your head while pressing it; the chosen frame should be visibly the least blurred.

## Hand-off to the controller

After branch 7, the controller (system design section 6.8) gets Seam A from `useGestures`: gesture events, `holdProgress`, `handVisible`, `grabFrame`, and the camera `status`. Showing camera status is the UI's job; "Reconnecting camera…" is a one-line banner Grace can add.

## Fit with the 10-hour plan

| Hour (`PLAN.md`) | Camera milestone |
| --- | --- |
| 0–0.5 | Branch 1; `cam:check` green; hat rig taped up |
| 0.5–3 | Branches 2, 3, 6 (hour-1 gesture test inside 6), 4 and 5 in between; "gestures logged from the hat cam" |
| 3 | Branch 7 merged: gestures move through steps |
| 5 | Branch 8 merged: open palm → sharpest frame → `/api/check` |
| 5–7.5 | Framing and lighting; repeat the 30-minute soak with the real demo setup |

Unplug-and-replug recovery and the tug test are never cut: with a cable running to the cook's head, they are the demo. If time runs short, shorten the 30-minute soak instead.

## Open questions

1. **How long is the cable, in total?** The camera's own lead plus the extension must stay under 5 m unless the extension is an active one. Do every hardware check with the exact cable used for the demo.
2. **USB-C adapter or hub?** Both cameras have a USB-A plug. A short, direct USB-C-to-A adapter is safer than a hub.
3. **Continuity Camera.** The selection rule ignores the iPhone, but turning off Continuity Camera on the demo Mac removes one more surprise.
4. **Power.** Keep the laptop plugged in during the demo, so macOS doesn't suspend USB devices to save battery.
