# Progress — The Story Night Flipbook

Context document for the current state of this project: what it is, what has been
changed, how the new systems work, and where to tune things. Last updated: **2026-08-03**.

> **⚠ The file table + some UI notes below are STALE.** The project has since been
> reorganised into a reusable template: the engine now lives in `engine/`
> (`script.js`, `styles.css`, `gsap.min.js`, `sfx-data.js`) and **all content is in
> `story.js` at the root** (`window.STORY = { cover, music, pages }`) — see
> `README.md`. There is no Home button and no `assets/posters/` at the old path in
> this build. Everything about the *engine's behaviour* (peel physics, cover
> sequence, tuning knobs) still applies. Read the **2026-08-03** section first.

---

## 2026-08-03 (latest) — why page 1 started "after a few seconds", and the trim

The author noticed the first clip doesn't start immediately. Cause, in order:
tapping Play starts the **6s** `coverOpen` hinge (`COVER_OPEN_MS` 6000 +
`animation: coverOpen 6000ms`), and playback was gated on `ready`, which fires at
`COVER_OPEN_MS + 50` = **6050ms**. The gate itself is deliberate — without it page 1
is ~6s in, its narration playing behind a half-open cover.

**Trimmed the part of that wait which was pure waste.** The `coverOpen` keyframes
reach `rotateY(-180.4deg)` at **84%** (≈5040ms); the final 16% is a 0.4° settle
nobody can see. Playback now starts there, via a dedicated `mediaGate` flag +
`_mediaGateTimer` in `runOpenSequence` (cleared/false in `closeBookToCover` and
`resetToStart`). `refreshMedia` gates on `mediaGate` instead of `ready`.
**`ready` was deliberately left alone** — it also unlocks flips and parks the cover,
and moving it would cut the settle short.

Measured from the Play tap: first frame visible **0.25s**, playback **5.13s**
(was 6.1s).

Still 5.1s of cover animation before the story begins. If that wants shortening,
it is the 6s swing itself — change **both** `COVER_OPEN_MS` (script.js) and the
`coverOpen` animation duration (styles.css) together, or the handoff desyncs.

---

## 2026-08-03 (earlier) — page 1 re-authored

`Page 1.mp4` was replaced **in place** (same filename), so `story.js` needed no
edit at all. What DID need doing: **regenerate its poster** — `assets/posters/pages/
Page 1.webp` was still the old clip's frame 0, which would have shown a wrong still
and then jumped the moment playback began. *Replacing a clip always means
regenerating its poster.*

The new clip: 10.8s, 1920×1080, two shots — a wide of the spooky fair, a camera
move at ~6.5s, then the Spooky Juice stall. Narration runs the **full length** (no
silent tail, so the turn cue lands exactly right with no `hold` needed) and it ends
on a clean frame. Verified in the book: held on frame 0 through the cover swing,
plays on open, cue + blink + nudge at 10.8s, back-nav ungated.

> **Testing note.** A poster-vs-frame-0 pixel check is NOT simply "diff must be
> ~0": lossy webp alone gives a mean diff of 5–10/255, and this clip is nearly
> static for its first 40%, so a correct poster looks identical to a wrong one.
> Compare against frame 0 **and** a control frame further in, and first measure
> whether the clip changes at all between them (`selfdiff.js` in the scratchpad).
> A naive threshold flagged all 12 posters as stale when every one was correct.

---

## 2026-08-03 (earlier) — real cover art + page-5 pacing

### The cover: `assets/Cover page.jpg`
The author supplied a 1920×1080 title illustration ("THE GLASS HALF FULL" — dragon,
cauldron, blue monster). `Cover Page.webp` is gone; `story.js` points at the new
file. **Note the author's `assets/` drop also removed `assets/posters/` — the
posters had to be regenerated. Check that folder still exists after any asset
hand-off.**

- **Perfect fit, no crop.** `.cover-img` was `inset: 54px` → a 1172×612 window
  (1.915) that cropped ~47px off a 16:9 image's height. It is now
  **`inset: 27px 48px` → 1184×666, exactly 16:9**, so a 16:9 cover fills it with
  `background-size: cover` and **0px** is lost (measured, not assumed). If you
  re-proportion it, keep height = width × 9/16.
- **Gold keyline moved** (`index.html`, `.cover-frame` rect) from x44/y44 — which
  now sat outside the art — to **x59 y38 w1162 h644**: 11px *inside* the art
  window, reading as a keyline printed on the artwork, and still clear of the 38px
  spine band.
- **New story option `playAt: { x, y }`** — where the gold Play orb sits on the
  cover. At the old CSS default (top 63%) it landed exactly on the cauldron's
  mouth, hiding the bubbling juice; page 5's art wants **`y: "77%"`**, the
  cauldron's black belly — clear of the title, both characters and the juice.
  Every cover has its clear space somewhere different, hence a story-level knob
  rather than an engine constant.
- The cover JPG is **1.4 MB** — the heaviest first-paint asset in the book (videos
  are lazy, this is not). A webp at ~85% would be ~250 KB and visually identical;
  left as the author's JPG for now.

### Page 5 pacing — the interaction came ~4.5s too late
Measured the clips rather than guessing (audio RMS + frame-diff motion envelopes,
scripts in the session scratchpad):

| clip | length | narration ends | motion |
|---|---|---|---|
| part 1 `Page 5.mp4` | 4.6s | 2.5s | static; **last ~0.2s is BLANK WHITE** |
| part 2 `Page 5 part 2.mp4` | 7.6s | 5.0s | completely static |
| part 3 `Page 5 part 3.mp4` | 8.5s | 6.5s | animates right to the end |

So the reader sat through 2.1s of silent still part 1 + 1.1s dissolve + 2.6s of
silent still part 2 before the ring even appeared. Fixes:

- **New `tap.after` option** (ms into the clip) — arms the hot-spot partway
  through instead of at the clip's end. Page 5 uses `after: 4800`, right as the
  instruction finishes. Tapping cuts the rest of the clip.
- **`hold: 3600` on part 1** — moves on once its line has landed, *and* stops
  before those blank white frames.
- **`goNextScene` now pauses the outgoing clip.** A scene cut short (by `hold` or
  by a tap) used to keep playing — and sounding — invisibly under the 1.1s
  dissolve, and could run into a bad final frame. Verified part 1 freezes at
  3.49s, so the white frames can never be seen.

Result: ring appears **~4.5s sooner**; only the 1.1s dissolve is now overhead.
Lower `tap.after` to prompt even earlier.

> **Author action:** `Page 5.mp4`'s last frames are blank white (background layer
> dropped out on export). Only that one clip — all 11 others end clean (checked).
> `hold: 3600` hides it, but a re-render would let the clip run its full length.

---

## 2026-08-03 (earlier) — page 5 is interactive: TAP TO POUR

Page 5 arrived as **three clips**, and the author wanted a real interaction: the
juice machine waits, and the reader has to tap the **POUR** button to make it pour.
So page 5 is a `scenes` page (cross-dissolving clips on one leaf):

| scene | clip | what it does |
|---|---|---|
| 1 | `Page 5.mp4` (4.6s) | the dragon mixes the juice |
| 2 | `Page 5 part 2.mp4` (7.6s) | the machine sits waiting → **holds for a tap** |
| 3 | `Page 5 part 3.mp4` (8.5s) | it pours; page-turn cue arms when it ends |

### New story option: `tap` on a scene
`tap: { at: {x,y}, size, label }` — the scene plays out, then the page **waits**.
Engine side is `armSceneTap()` / `clearSceneTap()` in the scene player, plus
`.scene-tap*` in `styles.css`:

- The hit area is a **full-page transparent `<button>`** — a small child should not
  have to aim. The ring + hand only mark *where to look*. Being a real `<button>`
  it is focusable, so Enter/Space work too.
- `at` is a CSS % of the page, `size` the ring diameter in **book px** (1280×720),
  so the spot scales with the book automatically. Page 5 uses
  `at: {x:"46.7%", y:"53.5%"}, size:150` — measured off part 2's last frame.
- The hand taps from **just below** the ring so a labelled target (here the word
  POUR) is never covered.
- **A swipe is not a tap.** The hot-spot covers the page, and Chrome fires `click`
  even when press and release are far apart, so a reader dragging the page (to go
  BACK) would have triggered the pour. `armSceneTap` records the pointerdown point
  and ignores a release that travelled more than 10px. *This was a real bug caught
  in testing — keep the guard.*
- Cleanup: `stopScenes()` and `resetScenes()` both clear a pending hot-spot, and
  `resetScenes()` also sweeps stray `.scene-tap` nodes. Verified 0 left behind
  after leaving the page mid-wait.
- The interaction **can't be skipped**: the page-turn cue is armed only by a page's
  LAST scene, so arrow / keyboard / drag all refuse while the page waits. Going
  back a page is still allowed.

### Scene-page safety nets (same reasoning as the video-page watchdog)
A scene that never ends would trap the reader, so scene videos now also advance on
`error` (missing / corrupt file), and the LAST scene's video additionally gets
`armTurnCue()` — the stall watchdog. `resetScenes()` removes both listeners.

### Note on the tap clip
`Page 5 part 2.mp4` is **not** looped while waiting: all three clips carry audio, so
looping would repeat the narration. Its last frame is identical to its first, so
freezing on it reads as the machine simply sitting there. If a future waiting clip
needs to keep moving, add a `loop` flag rather than looping by default.

---

## 2026-08-03 — the story became one baked video per page

The whole story was re-authored as **one baked video per page** (art + animation
+ narration inside the clip), replacing the old still-image + typed-speech-bubble
storyboard. `assets/pages/` now holds `Page 1.mp4` … `Page 10.mp4`, all 1920×1080
(matching the book's 16:9), 11–31s each.

- Every page now has its clip. The file-name numbers are just labels, not the
  reader's page count. Order: 1, 2, 3, 4, **5 (interactive, 3 clips)**, 6, 7, 8, 9,
  10 → `{ type: "end" }` (11 leaves).
- The old storyboard `pages` array is kept **inside a block comment** at the
  bottom of `story.js` (as `STORY_STORYBOARD`) for reference — its PNGs are gone
  from `assets/pages/`, so it can't run. Delete it once the video book is final.

### Engine fix: don't start a page's video before the cover is open
`runOpenSequence()` calls `refreshMedia()` at the **start** of the 6s cover swing,
so page 1's clip used to be ~6s in — its narration playing behind a half-open
cover — by the time the reader could see it. `refreshMedia()` now requires
`ready` before starting a page video (one condition, `engine/script.js`, search
`NOT before \`ready\``). `warmVideo()` has already decoded frame 0, so the page
still shows its still opening scene while the cover swings; it just doesn't
*start* until the book is open. Page turns always happen with `ready === true`,
so mid-book flips are untouched.
(The same quirk still exists for `scenes` pages, which are gated on `opened`, not
`ready` — irrelevant while the book is all single videos.)

### The turn cue now waits for the clip to finish
The narration is baked into each clip, so being invited to turn mid-sentence would
cut the story off. A video page therefore behaves like the old dialogue pages did:

- The forward corner arrow stays **hidden** while the clip plays; forward turns
  (arrow, keyboard, drag) are refused — the engine already gates those on
  `hintDoneFor === flipped`. **Back** navigation is never gated.
- On the video's `ended` event (in `makeMedia`) the engine calls `dialogueDone()`
  → the arrow **fades in and blinks gold for 2s**, and the hand nudge appears on
  the page's bottom-right corner 2s later, repeating every 9s until the reader
  turns. Verified painted, not just class-toggled (arrow at the book's bottom-right,
  hand on the page corner).
- **Already-watched pages don't re-gate**: `videoWatched[idx]` is set when a clip
  ends, so going back to a finished page and forward again is immediate (the clip
  still replays from the top). Cleared by `resetToStart()` → each read-through
  gates afresh.
- **Safety net** — `armTurnCue()` / `stopTurnCue()`, a 1s watchdog: a clip that can
  never finish (missing file, decode error, autoplay blocked, endless buffering)
  would otherwise trap the reader on the page forever, so after ~5s with no
  playback progress the cue is armed anyway. Tested by swapping a live page's
  `src` for a nonexistent file — the arrow appears. A pending `delay` countdown
  is explicitly not counted as "stuck".

### Posters regenerated
`makeMedia()` derives a poster path from the video path, so these clips wanted
`assets/posters/pages/Page N.webp` — one per clip, including each of page 5's three
scenes (**12** in total). All generated from **frame 0** (32–139 KB, 1280×720 webp). Still no ffmpeg on this machine — they were grabbed by
loading each video in headless **Edge** (`C:\Program Files (x86)\Microsoft\Edge\
Application\msedge.exe`, which has H.264, unlike Playwright's bundled Chromium)
and drawing frame 0 to a canvas → `toDataURL("image/webp", 0.82)`. Repeat that if
the clips are re-cut — a poster that isn't frame 0 causes a visible jump on play.

### Verified (headless Edge + playwright-core)
Cover opens → page 1 held at frame 0 during the swing, starts at ~6.1s → the cue
stays hidden and forward turns are refused until each clip ends, then arrow +
blink + hand nudge appear → all 9 pages read in the right order, each video
autoplays, never more than one playing at once → back to a watched page turns
forward immediately → THE END + Read again → Replay closes the book back to the
cover with page 1 reset to t=0. Only remaining console error is the intentional
`hand-nudge.png` 404 (emoji 👆 / inline-SVG fallback by design).

Test scripts live in the session scratchpad (`verify*.js`, `posters.js`) — they use
`playwright-core` + the installed **Edge** binary. Two gotchas: `#hint` needs
`{ force: true }` (the closed book idle-bobs, so Playwright never sees it as
"stable"), and screenshots of the arrow can look empty if taken at a dark point of
the blink animation — measure `getBoundingClientRect` + computed opacity instead.

---

## What this project is

A zero-build, framework-free interactive 3D storybook that runs by opening
`index.html` directly in a browser (works on `file://`, no server needed).
A closed hardcover book sits on a starlit-night background; tapping the gold
Play orb swings the cover open (6s hinge animation), then the reader flips
through full-bleed 16:9 video/image pages, ending on a cream "THE END" page
with a Replay button.

### Files

| File | Role |
|---|---|
| `index.html` | Static skeleton: 3D cover assembly, empty `#flipbook` (JS fills it), fixed chrome (Home button, corner arrows), portrait-rotate overlay |
| `script.js` | All behaviour. **Content zone** at the top (`pages` array — the only thing to edit for story changes) + the engine below |
| `styles.css` | Theme tokens (night palette, fonts, animation timings), book layout, cover/close animations, peel layers |
| `sfx-data.js` | Auto-generated: two one-shot SFX as base64 data URIs (Web Audio works on `file://`) — do not hand-edit |
| `gsap.min.js` | **Vendored GSAP 3.13.0** (added this session) — powers the peel engine; local so offline/`file://` keeps working |
| `assets/` | Page videos/images + `posters/` (first-frame webp per video, auto-derived path) |
| `sfx/` | Page flip, cover flip, BG music (20% volume), title voice-over (.ogg — no Safari) |

### Core layout concept

The book is a fixed **1280×720** internal coordinate space ("book space"),
uniformly scaled to the viewport by `fitScale()` via a single CSS transform.
All geometry (pages, bubbles, the peel math) works in book-space px.
Turned pages rest at `rotateY(-180deg)` about the **left spine** — i.e. parked
off-book to the LEFT (the visible tan strip = "left panel").

---

## Work completed this session

### 1. GSAP integration (vendored)
- `gsap.min.js` downloaded locally, loaded in `index.html` before `sfx-data.js`.
- Everything GSAP-driven degrades gracefully: if GSAP fails to load **or the
  user prefers reduced motion**, the engine falls back to the original
  CSS-transition rigid hinge flip (`const G = ...` gate near `FLIP_S`).

### 2. Corner-peel page turn (the current flip) — user-chosen style
The user explicitly chose **turn.js-style corner peel** over a rigid 3D hinge
(and over two-page spread / soft fold). "Real book flip" to them = visible
sheet bending/peeling. **Preserve this style in future work.**

**PAGE-PEEL ENGINE** (`script.js`, search `PAGE-PEEL ENGINE`):
- Everything derives from `P` = current position of the page's bottom-right
  corner. Rest = `(PW, PH)` = (1280, 720); fully turned = `(-PW, PH)`.
- The **fold line** is the perpendicular bisector of corner-rest ↔ `P`.
  - Leaf front gets `clip-path` = page ∩ un-peeled half-plane (Sutherland–Hodgman, `clipHalf`).
  - The folded-over part = peeled region **reflected** across the fold, drawn as
    the sheet's blank tan back (`.peel-fold`, dynamic clip + crease gradient).
  - Shadows: a fold-hugging gradient on the flat part (`.peel-crease`, child of
    the leaf so the leaf's clip crops it) + a drop-shadow on `.peel-foldwrap`.
- A full forward peel ends folded over the spine — geometrically identical to
  the `.flipped` class pose, so all existing class semantics still work.
- Drivers:
  - **Arrows/keyboard**: corner travels a lifting Bézier (`peelPath`), tweened
    `FLIP_S` (1.15s) with `power2.inOut` → `peelTurn()`.
  - **Drag**: corner follows the finger 1:1 anywhere (`bookPt` + grab offset),
    clamped so paper can't stretch (`clampPeelP`, spine-anchor radii). Release
    completes/settles with distance-scaled duration. Thresholds `0.15/0.85`
    progress, or a flick (`FLICK` px/ms).
  - **Idle hint**: ghost peek = corner lift to `t=0.12` and back (in `peekFlip`).
- Cleanup contract: `peelEnd()` clears clip/layers, re-applies resting classes
  with transitions suppressed. `cancelPeek()` / `resetToStart()` also clear.

### 3. Left-panel landing continuity fix
Problem: the turned page vanished near the end of the turn, then popped into
the left panel after completion — because `.peel-foldwrap` only covered the
book box and CSS crops backgrounds at the element box.
- Fix: `.peel-foldwrap` spans **one page-width left** of the book
  (`left: -100%`); fold clip x-coords are shifted `+PW` into the wider box;
  gradient-line math uses the 2560-wide box (`FW`, `L2`, `s2` in `renderPeel`).
- Plus a **landing blend**: shading strength `k` ramps in as the corner lifts
  and melts away over the last 20% of the turn (`p01`, `kOut` in `renderPeel`),
  with crease/roll colors eased back to resting paper tones (`mixRGB`) and the
  drop shadow fading — so the swap to the parked page is invisible.

### 4. UI cleanup + hardening pass
- **Page counter removed**: the `#progress` "Page X / N" chip, its `.toolbar`
  markup and CSS are gone. `updateProgress()` remains but now only manages nav
  state (Home visibility + arrow disabled states).
- **Corner arrows enlarged**: `clamp(68px, 8vw, 94px)` (was 52–70px).
- Bug fixes:
  - `renderPeel` guards degenerate (<3-point) peel polygons — an invalid
    `polygon()` would have rendered the fold layer UNCLIPPED (full-box tan flash).
  - `resetToStart()` now clears `animating` — a stuck flag would have silently
    blocked every flip after reopening.
  - Sound header comment corrected (BG music is 20%, not 40%).

### 5. Page-1 video → WebM (2026-07-15)
- The user re-authored `assets/1 page.mp4` (25.3s, 1080p30). Converted to
  **`assets/1 page.webm`** (VP9 CRF 32 + Opus 112k): 5.0 MB vs 12.8 MB — much
  lighter to buffer. `pages[0].src` now points at the .webm; the mp4 remains on
  disk as the edit source but is never loaded by the book.
- Regenerated `assets/posters/1 page.webp` from the new video's frame 0
  (posters must match frame 0 so playback starts without a visual jump).
- **Poster derivation now handles .webm** (`makeMedia`): the regex was
  `.mp4→.webp` only; a .webm page would have requested a nonexistent poster.
- No ffmpeg on this machine: a full build was downloaded to the session
  scratchpad (gyan.dev release-essentials) — re-download if needed again;
  Playwright's bundled ffmpeg can't decode H.264/AAC.

### 6. Closed book = flat "real book" front view (was a bare frame)
The user rejected a 3/4 3D tilt (tried first) and supplied reference art:
straight-on FLAT view whose book-ness comes from ANATOMY, not rotation:
- **Spine band** — `.cover .front::before`: a 38px darker band down the left
  edge with gold double-bands at head + tail. 38px wide on purpose: it ends
  before the gold cover-frame SVG's left rule (x=40) so they don't collide.
  Masked by `.back-fill` as soon as the cover starts opening.
- **Page stack + back-cover lip** — `.pb-pages` / `.pb-back-lip` (markup inside
  `.pageblock` in index.html): parchment page edges peek out UNDER the front
  cover, resting on a purple back-cover lip that pokes out further right +
  below. They live in `.pageblock` so they fade out automatically as the book
  opens, and `translateZ` keeps them behind the cover board (z ≈ +30).
- `.book-inner` closed transform is `none` (flat) — no leveling step needed;
  Play calls `runOpenSequence()` directly. The 3D edge faces keep their
  parchment stripe recolour + `--thick` 56px (edge-on/invisible when closed,
  harmless). Headless tests still wait 7000ms after Play (extra margin only).

### 7. Real-book close (Home / Replay)
`closeBookToCover()` now closes in two beats:
1. **`cascadeClose()`** — every turned page riffles back right, one after
   another: most recently turned falls first, each later sheet lands ON TOP
   (so page 1 ends on top). 380ms fall, `power2.in`, 85ms stagger, a flip
   sound per sheet. Pages stay above the parked cover for this phase.
2. Then the original cover hinge swing (`coverClose`, 2s) + `resetToStart()`.
- `is-closing` (which hides the flipped pile) is applied only in beat 2.
- No GSAP / nothing turned → beat 1 is skipped (old instant close).

---

## Key constants & tuning knobs

| What | Where |
|---|---|
| Flip duration | `FLIP_MS` (script.js) **must equal** `--flip-ms` (styles.css) — 1150ms; flip sound synced |
| Cover open/close durations | `COVER_OPEN_MS` 6000 / `COVER_CLOSE_MS` 2000 — must match the CSS keyframes |
| Peel arc height | Bézier control in `peelPath` (the `620`) |
| Peel crease/roll shading | gradient stops + colors in `renderPeel` |
| Landing blend window | the `0.8` / `0.2` pair (`kOut`) in `renderPeel` |
| Drag completion | `0.15` / `0.85` progress thresholds in `endDrag`'s peel branch; `FLICK = 0.45` |
| Riffle feel | `cascadeClose`: `0.085` stagger, `0.38` fall, `power2.in` |
| Page content | the `pages` array at the top of script.js |

---

## Verification setup (headless)

No test framework in-repo; changes were verified by driving the real app:
- `npm i playwright-core` in a scratch dir + cached Chromium at
  `%LOCALAPPDATA%\ms-playwright\chromium_headless_shell-1223\chrome-headless-shell-win64\chrome-headless-shell.exe`
  (verify the versioned folder still exists before reuse).
- Flow: open `index.html` via `file:///`, click `#hint`, wait ~6.3s for the
  cover, then drive `#cornerNext` / `#homeBtn` / mouse drags; assert on
  clip-paths, classes, inline styles; screenshot mid-animation.
- Expected console noise: exactly one `ERR_FILE_NOT_FOUND` for
  `assets/hand-nudge.png` (intentional — emoji 👆 fallback is by design).

---

## Known quirks / pre-existing issues (not introduced this session)

- **Dead LBD game code**: ~100 lines of "Stairway Shuffle" overlay logic in
  script.js + `.lbd-stage` CSS reference elements that no longer exist
  (`#lbdStage`/`#lbdFrame` are null; all calls no-op safely). Safe to strip.
- **Orphaned CSS**: `#leaves`, `.page-base`, `.bookplate`, `.end-note`,
  `.cover-photo`, `.arrow` style elements not present in the markup.
- Title voice-over is `.ogg` → silent on Safari/iOS (needs an .m4a/.mp3 twin).
- BG music comment says 40% in one header; code truth is `volume = 0.20`.
- Timing constants are intentionally duplicated between JS and CSS — edit both.

## Possible next steps

- Strip the dead LBD + orphaned CSS for a leaner file.
- Add an .m4a fallback for the title VO (Safari).
- Optional: speech bubbles per page (the `bubble` config in `pages` is wired
  up but unused by the current content).
