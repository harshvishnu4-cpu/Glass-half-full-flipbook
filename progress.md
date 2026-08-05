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

## 2026-08-04 (latest) — navigating to a page always restarts its clip

Author report: going BACK to a page mid-clip resumed the video from where it had
paused instead of restarting. `playVideoNow(v, restart)` semantics tightened: a
fresh ARRIVAL on a page (back or forward, or a scene landing) now seeks to 0
before playing — a revisited page always tells its story from the top. The
re-assert path (`restart=false`, called repeatedly during each turn) still leaves
a playing clip alone and a finished clip finished, so the corner-tap-replay bug
stays fixed (regression-tested in the same run).

Verified: page 2 paused at 4.6s → back → page 1 restarts from ~0 → forward →
page 2 restarts from ~0; corner tap on a finished page still does not replay;
full unforced read-through clean.

---

## 2026-08-04 (earlier) — narration starts at ~1.8s; persistence removed for good

Two author reports, both fixed:

### 1. "No audio when the book opens feels awkward"
The video (and its narration) waited for 84% of the 6s cover swing (~5.1s of
music-only dead air). **Measured the swing** (coverangle.js): its ease is so
front-loaded that the cover passes 90° (page fully visible) at **0.75s** and is
visually flat (~165°) by **2s** — everything after is an imperceptible settle.
The media gate now opens at **28% (~1.7s)**; measured result: narration starts
**1.82s** after the tap with the cover at 158°, fully clear of the page. `ready`
(flip unlock + cover parking) still waits for the full 6s swing.

### 2. "Some pages can be turned before the clip ends" (looked like random glitching)
Cause: the previous fix persisted the WATCHED set across sessions — pages watched
in an earlier sitting unlocked instantly on revisit, unwatched ones gated, and the
mix read as broken. That was the SECOND time localStorage state read as a bug
("starts in the middle" was the first). **Persistence is now removed entirely**
(no PROGRESS_KEY/save/load): every open is a fresh, fully-gated read from page 1;
`videoWatched` is session-only, so back-and-forth within one read stays instant.
If resume is ever wanted, build it as explicit UI (a "Continue?" choice), never
silent state. Old builds' leftover storage keys are simply ignored.

Also hardened `armTurnCue`: "stuck" now requires no-playback-PROGRESS as well as
bad element state, so a slow connection that dips readyState while still crawling
forward can never unlock a page mid-story (the 5s true-freeze escape remains).

Verified: narration at 1.82s with sound; a planted old-format bookmark is ignored
(page 1, gated); page 1 gated while playing on a dirty profile; full unforced
read-through clean.

---

## 2026-08-04 (earlier) — "the book starts in the middle": bookmark-resume rethought

The author reported the book opening mid-story. Root cause: the UX pass's
bookmark-resume WORKING — their browser held a real bookmark from a half-finished
read, so every open jumped to the saved page. All headless tests cleared
localStorage first, which is exactly why it never showed up here. *Lesson: a
persistence feature must be tested with a DIRTY profile, not just a clean one.*

Fix — keep the medicine, drop the surprise:
- **The book now ALWAYS opens at page 1.** `applyResume()` no longer touches
  `flipped`; the saved `page` field is gone (old-format saves are read
  compatibly and simply ignored beyond their watched list).
- **The watched set still persists** (`{watched:[…]}`): previously watched pages
  unlock the moment they're revisited, so returning to page 7 is six quick taps
  instead of six re-watched clips. Fresh readers (no storage) are fully gated;
  THE END and Replay still clear everything.
- The `body.no-anim` leaf rule + silent pre-pose in applyResume were only for the
  position jump — removed.

Verified: an old-format bookmark ({page:6}) now opens on page 1 with pages 1-4
instantly turnable; a clean profile stays fully gated; watching page 1 then
reloading gives page 1 with its cue immediate; full read-through clean.

### Same session, earlier: dead-code purge + abuse fuzz (author-requested QA)
- **Removed the entire dormant LBD/"Stairway Shuffle" system** (~180 lines JS:
  makeMedia's lbd branch, LBD_INDEX, the overlay section incl. postMessage
  listener, every lbdFullscreen/updateLbdOverlay/positionLbdStage reference) —
  its #lbdStage/#lbdFrame elements haven't existed in this build's markup at all.
- **Removed the legacy hidden #prev/#next buttons** (markup, consts, listeners,
  updateProgress lines) — the corner arrows are the real controls.
- **Removed ~120 lines of orphaned CSS**: .lbd-stage block, both .arrow blocks,
  .page-base, .bookplate, .end-note (+.book.at-end), .cover .title/.subtitle/
  .cover-photo(+.tape) blocks and their hide rule, .cover .front .fore-edge,
  .cover .back .line/.name-line, #leaves. Verified with a selector-vs-usage
  scanner (scratchpad orphans2.js); the one remaining flag, `.fx-scan`, is a
  FALSE positive — fx classes are built dynamically as "fx-" + type. Stale
  "25 videos" comments updated.
- **Abuse fuzz, all clean** (scratchpad fuzz.js): Play-button mash opens once;
  6-click arrow mash = exactly one turn; alternating arrows; grabbing the page
  mid peel-tween (no stuck leaf, no leftover clip-path); a resize storm mid-flip;
  tab hide/show mid-video; Read-again mashed 4× closes once and the next read is
  fresh; arrow keys during the cover swing are refused. Mid-peel screenshot
  geometry correct; responsive matrix + full unforced read-through re-passed
  after the purge.

---

## 2026-08-04 (earlier) — "misaligned pages": verified original, then rebalanced

The author asked why the pages were misaligned (page sits left-of-centre in the
book frame). **Verified NOT a regression** before touching anything: rendered the
repo's first full commit (8f7a028, before every change this session) at the same
viewport — pixel-identical geometry (leaf [192,108,1536,864], frame
[173,89,1606,902]). It is the template's original book anatomy: page block flush
to the SPINE (left, 16px board), fore-edge (.page-stack, the pages still to be
turned) on the right under a wider 42px board.

The real problem: the paper sheets only reach ~21px past the page edge, so the
-42px frame left **~21px of bare dark board between paper and frame edge** — and
that gap is what read as "misaligned" rather than as book anatomy. Fix (author
chose "paper hugs the page" over centring or leaving it): `.book-frame` right
inset **-42px → -27px**, leaving a 6px board edge past the deepest sheet. Left/
top/bottom untouched; the fore-edge still thins page by page (data-count) and
the closed cover was never affected (frame is is-open only).

*Method note for future "why did X change?" questions: `git worktree add <tmp>
<old-commit>` + screenshot both versions at the same viewport BEFORE explaining.
Also: this repo's "first commit" is only the README stub — the project baseline
is "second commit" (8f7a028).*

---

## 2026-08-04 (earlier) — pour SFX + part 2's cue is now "tap anywhere"

- **Pour SFX wired.** The author added `sfx/pour.ogg` (4.68s stereo) — but .ogg
  is SILENT on Safari/iOS (the exact platform just fixed), so it was converted
  in-browser (decodeAudioData → OfflineAudioContext → 16-bit mono WAV) to
  **`sfx/pour.wav`** (403KB, plays everywhere); the .ogg stays as the source.
  `sound: "sfx/pour.wav"` on the pour config → per tap: rewind + play, hard-stop
  at 920ms as the stream fades (the md's cutoff — only the first ~0.9s of the
  4.7s file is ever heard). Conversion recipe: `ogg2wav.js` in the scratchpad.
- **Part 2's cue no longer points at the POUR button** (author request: "tap
  the screen anywhere, not on the pour button" — button-pressing is part 4's
  job, and a ring on the machine's button taught the wrong thing one scene
  early). New `tap.anywhere: true` option: the targeting ring AND ripple circle
  are hidden, leaving a big tapping hand placed via `at` on open space
  (27%, 62% — empty wood left of the machine), label "Tap the screen…". The
  full-page hit area is unchanged — a tap anywhere always advanced; the hint
  now says so instead of contradicting it.
- `layer._pourSound` exposed for headless tests.

Verified: part-2 cue shows hand-only (ring display:none), 150px+ from the
button, tap at a random far corner advances; part-4 tap → pour.wav playing at
t=0.02, stopped by ~1.2s; full unforced read-through clean.

---

## 2026-08-04 (earlier) — page 5 part 4: the POUR mini-game (from Figma)

Implemented the Figma frame **"Page 5 part 4"** (The-Glass-Half-Full-LBDs,
node 745:508) as a FOURTH scene on page 5, with the tap-to-pour mechanic ported
from the author's `pour-interaction.md` (the *Ready Set Serve!* reference). Flow:
part 3's pouring clip ends → cross-dissolve to the machine with an EMPTY GLASS →
the reader taps POUR — one shot per tap: press-in 140ms, stream 900ms one-shot,
5 splash droplets 550ms, the liquid RISES 750ms — **4 taps to full**, then the
button locks and the page's turn cue arms. The glass must be filled to move on.

### How it's built
- **Engine feature, story-configured**: new scene option `pour:` (story.js docs)
  → `buildPourScene()` in script.js + a `.pour-*` CSS block. Scene player arms it
  on landing (`layer._pourArm`), completion reports via `layer._pourDone`
  (mid-sequence → next scene; as finale → seqDone → cue), `resetScenes` empties
  the glass via `layer._pourReset`. No stall watchdog on purpose — it is the
  reader's task, not a clip that can hang.
- **The liquid is the md's SVG-clip trick**, adapted: the glass is the Figma
  design's own vector cup (paths embedded in the engine; `assets/pages/pour/
  glass.svg` kept as source); the juice is the cup's front-face path re-filled
  pink, revealed by a clipPath rect that slides via **transform transition**
  (not the `y` geometry property — transform animates everywhere, Safari
  included). A surface ellipse rides the level, narrowing with the cup's taper
  (scaleX). Unique clip id per build (`pour1clip…`) per the md's cloning gotcha.
- **Geometry straight from Figma** (1920×1080 → same % in the 16:9 page):
  machine 36.56%/11.57% w26.82%, button 46.82%/49.81% w5.78%, glass
  47.03%/66.11% w5.94%, stream at 49.97% from 60% down 8%.
- **Assets**: the node's raw exports had a baked WHITE matte on machine + button
  — the `rawImages` from download_assets carry real alpha; converted via canvas
  to webp (machine 196KB @1030px, button 24KB, bg 25KB — 268KB total vs 1.5MB
  of first-try PNGs). *Lesson: prefer download_assets' rawImages over the node
  export when transparency matters.*
- md rules kept: `.pressed` mirrors `:active` for touch; disabled = dim only,
  never scaled (bitmap text blurs); stream restart via reflow; every `play()`
  catch-wrapped; splash divs self-remove; idle nudge re-armed after EVERY pour
  (ring + hand reusing the scene-tap look, pointer-through, 9s idle + shown on
  first arm since no narration introduces the button). `sound:` config wired
  but not shipped — add `sfx/pour.mp3` and one story.js line for SFX.
- **TDZ gotcha hit once**: buildPourScene runs at LOAD (leaf building) and used
  `HAND_SVG`, declared later → ReferenceError killed the whole engine. The
  constant now lives above the leaf builder. A load-order crash breaks
  EVERYTHING (no Play, no error banner content) — first thing to suspect if the
  book ever "won't open" after an engine edit.

Verified end-to-end: parts 1-3 play → part 4 arms with ring + hand on POUR →
ArrowRight refused mid-interaction → 4 taps: fill 25/50/75/100%, stream+splashes
each tap, hint hides on first tap → full = button locked → cue SHOWN → leaving
and returning resets to an empty glass at scene 1/4 → full unforced read-through
(now pour-aware) reaches THE END, one video at a time, no errors. Screenshots
match the Figma frame (armed / half / full).

---

## 2026-08-04 — "won't open on iPhone": root cause + Safari hardening

### Root cause: there is no URL — iOS cannot open a local HTML file
The book has only ever been opened by double-clicking `index.html` (file://).
iPhones have no equivalent: tapping an .html file in the Files app / AirDrop /
iCloud opens a QuickLook PREVIEW that runs no scripts and can't see `engine/` or
`assets/` — so the book "won't open" on any Apple device by that route. Checked:
the GitHub repo (harshvishnu4-cpu/Glass-half-full-flipbook, public, branch main)
exists but **GitHub Pages is NOT enabled** — https://harshvishnu4-cpu.github.io/
Glass-half-full-flipbook/ returns 404. **The fix is hosting, not code**: enable
Pages (repo Settings → Pages → Deploy from a branch → main, / (root)), push, and
open that URL in Safari. Note: enabling Pages needs the author's GitHub login.

### Safari hardening done anyway (code audit — WebKit-on-Windows crashes at
launch on this machine, so this is static analysis, not an engine run):
- **`primeVideo` now primes UNMUTED.** Safari grants play-with-sound per element
  only if an AUDIBLE play() ran inside a user gesture; the old muted prime earned
  nothing (muted playback never needed permission), so page 1's real play() 5s
  later would be refused → silent + rescue chip on every open. The synchronous
  pause() means nothing is audibly heard during the prime; if even the audible
  in-gesture play is refused, it falls back to the old muted prime.
- **`min-height: 100vh` fallback** before `100svh` (.scene) — iOS < 15.4 drops
  svh entirely and the scene would collapse.
- Audit found NO parse-level blockers: no optional chaining / lookbehind /
  replaceAll; AudioContext has the webkit fallback + try/catch; fullscreen is
  guarded (iPhone has no fullscreen API — it just no-ops); videos are
  `playsinline` + all 12 mp4s are **faststart** (moov first — verified);
  touch-blocking only preventDefaults multi-touch, so taps still click.

### NEW: on-device debug overlay — how to diagnose this in future
Open the book with **`#debug`** on the URL (…/index.html#debug): an overlay
panel prints the user agent, viewport, every JS error, unhandled rejection,
console.error/warn AND failed resource loads (capture-phase error listener), on
the device itself — no DevTools needed. Tap the panel to hide it. Zero cost when
the hash is absent. (The red `__jsErr` crash banner still exists independently.)

Regression: page 1 plays WITH sound after the prime change; overlay absent
without the hash, catches console/promise/404s with it; full read-through clean.

---

## 2026-08-03 — bats REMOVED; responsive fit for every size

### Bats removed (author's call — the transition never landed)
All three iterations are gone: the `#bats` markup, the whole BATS CSS block, the
GSAP colony in script.js (`releaseBats`/`stopBats` + the ticker), the
`engine/bat-frames.js` file and its `<script>` include, and the `bats:` story
option. `assets/bats.svg` itself was left on disk (the author's artwork; unused).
Grepped clean — the only remaining "bat" in the codebase is inside the word
"battery". If bats ever come back, progress.md's superseded sections describe all
three approaches and their lessons.

### Responsive: audited at 17 sizes, then fixed what the numbers said
`fitScale()` already scaled the fixed 1280×720 book into the viewport, and the
touch-portrait rotate lock worked everywhere. Measured audit (open book, arrows
live, video playing — `sizes2.js` in the scratchpad) found ONE real problem:
**small phones wasted the screen** — a fixed `CTRL = 64px` control reserve ate
40% of a 320px-tall phone, shrinking the book to 36% of the display.

Changes, all in `fitScale()`:
- **Proportional control reserve**: `CTRL = clamp(30, 11% of height, 64)`. On a
  568×320 phone the book grew 341×192 → **444×250 (36% → 61% screen fill)**;
  laptop-and-up layouts are pixel-identical (the 64px cap).
- Small screens (<700px wide) breathe at 94% width instead of 88%.
- **Arrow clamps**: the button box can no longer sink below the fold — on very
  short screens it rides up onto the page's bottom corner (still visible, still
  tappable) — and both arrows are pinned inside the side edges. Tap target never
  drops below 56px.

Verified across 568×320 → 3840×2160 (+ narrow/square/short desktop windows, iPad
sizes, Fold): no book overflow, no arrow glyph off-screen, no page scroll, video
plays everywhere. Mid-read live resize 1920×1080 ⇄ 640×360 refits cleanly with
the video still playing. Phone-scale input model verified at 568×320: arrow turn,
drag-back turn, page-5 ring exactly at its 46.7%/53.5% spot scaled with the book,
tap advances the scene. Desktop full read-through clean after both changes.

---

## 2026-08-03 (earlier) — UX pass: ducking, bookmark-resume, sound rescue, wake lock

Four experience fixes (behaviour, not looks), all in `engine/script.js` + small CSS:

1. **Music ducks under narration.** At a flat 20% the BG music sat directly under
   every voice-over. `duckMusic(on)` tweens `bgMusic.volume` 0.20 ⇄ 0.06 (GSAP,
   450ms): down when a clip starts (`playVideoNow`), up when it ends, on THE END,
   and reset on close. The story is now always the loudest thing a child hears.
2. **The book remembers where the reader left off.** Every clip is
   watch-to-the-end gated, so losing your place is expensive (a refresh on page 7
   meant re-sitting six clips). Landing on a page saves `{page, watched[]}` to
   localStorage (`PROGRESS_KEY`, namespaced by `STORY.cover` so different books
   don't share bookmarks). On the next open, `applyResume()` poses the turned
   leaves BEFORE the cover swings (leaf transitions suppressed via
   `body.no-anim`), so the cover opens straight onto the bookmarked page with
   watched pages' turn cues already unlocked. Reaching THE END or closing to the
   cover (Replay) clears it — a fresh read is a deliberate act and gates afresh.
   `primeVideo(flipped)` (was hard-coded 0/1) so the landing page still gets its
   gesture-unlocked audio. All storage access try/caught (privacy modes).
3. **Sound rescue.** The one failure mode that just looked broken: browser
   refuses audible autoplay → clip plays muted → child watches a silent story
   with no cue. Now the muted fallback also shows a small "Tap the page for
   sound" chip (`.sound-hint`, pointer-events none so the tap falls through to
   the page, which already unmutes). Hides on unmute (any route — volumechange),
   with its clip, or on page turn. Exists ONLY in that failure mode.
4. **Screen wake lock.** The book is hands-off (15–30s clips, no touching), and
   tablets dim/sleep after ~30s idle — mid-page. `keepAwake()` requests a screen
   wake lock on open, re-acquires on visibilitychange (the OS drops it on every
   hide), releases on close. Silently absent where unsupported.

Verified: volume 0.06 during narration / 0.20 after; read to p3 → reload → Play
resumes ON p3 (clip playing, back arrow live, forward still gated) and a watched
page is instantly turnable; THE END clears the bookmark; a planted bookmark at p8
resumes, finishes, Replay + Play then starts a FRESH gated read at p1; the chip
shows while muted and a tap recovers sound + hides it; no errors; full unforced
read-through clean.

> **Testing note:** the bookmark persists across page loads by design — headless
> test runs should `localStorage.clear()` first or a previous run's bookmark will
> resume the book mid-story and confuse the script.

---

## 2026-08-03 (earlier) — bat flight v3: GSAP-driven, alive

The author found v2 (CSS offset-path spirals + steps() flap) still "not looking
good". Diagnosis: every bat rode its spiral at CONSTANT speed with a metronome
wingbeat — smooth, but nothing in the motion was coupled to anything else, which
is exactly what reads as "a transition" instead of animals.

v3 moves ALL motion into **GSAP** (already vendored for the peel engine): one
`G.ticker` callback computes every bat every frame — `releaseBats()` in
`engine/script.js`. Per bat, per frame:

- **Base path**: the expanding spiral (r = R·t^1.55, 0.9–1.6 turns, cw/ccw mixed)
  — or, for the last **3 "hero" bats**, a shallow quadratic-bezier swoop across
  the lens (centre → wide → off the opposite edge, scaling to ~3.5×).
- **The body rides the wingbeat** — the piece v2 lacked. `wingPhase` advances
  per-bat; the wing pose flicks up→level→down→level from it; and the bat is
  displaced along the path NORMAL by `sin(wingPhase)·bobAmp` — every downstroke
  visibly lifts the body. Coupling beat↔bob is most of what "alive" looks like.
- **Glides**: a slow per-bat oscillator gates the beat — above the threshold the
  wings freeze on "level" and the bob melts to 15%, like a bat coasting between
  bursts of flapping.
- **Banking**: nose on the path tangent (numerical derivative) + a slow sway.
- **Depth**: scale grows toward the camera; fade-in at launch, fade-out only in
  the last stretch (off-screen by then). `dt` capped at 50ms so a tab switch
  can't teleport wings.
- The ticker unhooks itself and empties the layer when the last bat lands
  (`stopBats()` also runs from close; a 6s `setTimeout` is the hard backstop).
- **No GSAP → no bats** (reduced-motion or load failure). The bats are decoration;
  maintaining a CSS twin of all this was not worth it. `.bats` CSS is now layout
  only.

Measured: a tracked bat arcs across the whole screen while its rotation banks
−165°→178° and scale grows; all three poses appear with glide holds; 27 bats,
individual curves; layer empties itself; **frame cost still zero** (median
identical bats on/off). Full read-through clean.

---

## 2026-08-03 (superseded) — the bats FLAPPED and swirled in a CSS vortex

The author rejected the first bat pass ("works like a transition") and asked for
wing-flapping and a circling, cinematic flight. Root problem with v1: scaling the
whole cloud moved every bat in lockstep — a zoom, not creatures. v2 is per-bat:

### Wingbeat = sprite frames from the author's own sheet
`assets/bats.svg` contains bats in many wing poses. Three upright ones — **#16
(wings raised), #50 (level), #6 (wings down)** — were extracted, normalised into a
common 100×100 box, and baked into **`engine/bat-frames.js`** (auto-generated;
regenerate with `batextract2.js` in the session scratchpad if the sheet changes).
Baked-in because file:// CORS blocks fetching the sheet at runtime.
Each `.bat` element holds all three poses stacked in one inline SVG; `flapUp/
flapMid/flapDown` keyframes gate their opacity **up → level → down → level** with
`steps(1,end)` — a sprite flick, not a crossfade. Per-bat `--flap` (240–420ms) and
a negative `--fdel` phase so the colony never beats in unison.
**⚠ Sheet indices:** paths must be queried on the SHEET's element only —
`document.querySelectorAll("path")` also picks up the engine's own UI icons
(corner arrows, end-page star) and shifts every index. This bit once.

### Flight = one outward spiral per bat (CSS offset-path)
`releaseBats()` builds ~26 bats per open; each gets `offset-path: path(...)` —
a spiral `r = R·t^1.5`, angle winding 1–1.6 turns, direction alternating so the
vortex has cross-traffic — generated in px from the live viewport (R = 0.85 ×
max(vw,vh), enough to exit even if fullscreen grows the window right after
launch). Animating `offset-distance` flies it; `offset-rotate: auto 90deg` keeps
the nose on the tangent so bats BANK around the circle (the sprite faces up, so
+90° aligns its head with the path direction). Depth: random `--size` 56–120px ×
an inner `batNear` grow (0.55 → 2.2). Delays 0–1.1s stream the colony out; the
last bat lands ≤ ~4.2s, before page 1 starts at ~5.04s.
Fades happen at the START (first 8%) and the last 22% of the path — by then the
bat is off-screen, so nothing pops out of existence mid-frame.

### Numbers
- First cut had 16 bats — read sparse; 26 with slightly larger sizes reads as a
  colony without blacking out the art (the v1 four-layer version's failure mode).
- Perf: 26 bats × ~5 animations each, all compositor-properties (offset-distance,
  transform, opacity). Measured on/off over the same 4.2s: **median frame
  identical, zero regression.**
- Cleanup empties the container (`stopBats()`), so the layer is inert while
  reading; Replay builds a fresh colony. Reduced-motion hides the whole thing.

Verified: 26 bats spread from 140px to 2400px apart (individual paths, not
lockstep); every bat shows exactly ONE pose at any instant and cycles through all
three (sampled at 85ms); container empties after the flight; arrows still work;
no errors; full read-through clean.

---

## 2026-08-03 (superseded) — BATS fly out at the reader when the book opens

New asset `assets/bats.svg`: a 2500×2500 canvas holding **~67 bat silhouettes
arranged as a radial cloud**. That layout is the whole trick — scaling the cloud up
about its centre carries every bat outward past the edges of the screen, which IS
"every bat flies toward the viewer", in one composited transform.

### Why layers of the whole image, not 67 animated paths
Animating each bat individually would need the SVG **inlined** so the paths are
addressable — and `fetch()` of a local file is blocked by Chrome's file:// CORS
rules, so a runtime fetch would break the one thing this project guarantees
(open `index.html`, no server). Pasting 75KB of paths into index.html was the only
alternative. So instead: **four `<img>` layers** of the same cloud at different
sizes, delays, spins and emanation points. Four elements instead of 268, each a
single GPU transform, and the repeated silhouettes are invisible at different
scales and rotations.

- Markup `#bats` in index.html; CSS `.bats` / `.bat-swarm` / `@keyframes batFly`.
- Body-level and `position: fixed` — the flight belongs to the SCREEN, not the
  book's 3D space, so bats sweep past outside the book too. z-index 680 (over the
  book, under the corner arrows) and `pointer-events: none`.
- Fires from `runOpenSequence()` via `releaseBats()`, right next to the cover-flip
  sound, so the swarm bursts out as the cover lifts. Last wave lands ~4.0s, before
  page 1's clip starts at 5.04s, so it never competes with the story.
- The `.bats-fly` class is **removed** when the flight ends (`BATS_MS` 4000), which
  both keeps the layer inert while reading and lets Replay play the flight again
  (re-adding the class after a reflow restarts the animations). `stopBats()` on close.
- Story config **`bats: "assets/bats.svg"`** — omit it and the engine deletes the
  whole layer, so nothing about it runs for a story without a swarm.

### Two things that needed tuning, not guessing
- **Density.** Four waves at delays 0.20/0.55/0.95/1.35 all peaked together and
  ~270 silhouettes blacked the page out. Spread to 0.20/0.70/1.20/1.70 with peak
  opacity 0.86 → about two waves prominent at once, art visible through them.
- **Cost.** Four large SVGs re-rasterising as they scale is the obvious risk. Measured
  the same 4.2s window with the swarm on and off: **median frame identical (25ms in
  this environment — that is the display's cadence, not jank), and zero frames over
  40ms with the bats on.** `will-change: transform` promotes each layer so it is
  rasterised once and GPU-scaled; the slight softness at 4× is invisible on
  silhouettes and reads as motion blur.

Verified: layers grow from ~100px to ~3700px and fade out; cleans up at 4.4s;
the corner arrow still works afterwards (the layer never swallows a tap); Replay
re-runs the whole flight; no failed loads, no errors. Reduced-motion hides it.

---

## 2026-08-03 (earlier) — BUGFIX: tapping the page replayed a finished clip

Reported: tapping the page's **bottom-right corner** replayed the video. That corner
is the worst possible place for it — the hand nudge points at it and a turn-drag
starts there — so the reader trying to move on got the page over again.

**Two separate routes to it**, both fixed:

1. `makeMedia`'s video `click` listener did `if (media.ended) media.currentTime = 0`
   then `play()` — so ANY click on the page (the video fills it) restarted a finished
   clip. Its actual purpose is recovering sound when a browser blocks the auto-start's
   audio, which is worth keeping, so the listener is now precise: it does nothing to a
   clip that finished **with sound**, and nothing to one already playing aloud. A clip
   that finished **muted** still replays on tap — that reader never heard the page, so
   replaying it aloud is exactly what they want.
2. `playVideoNow()` also reset `currentTime` on an ended clip, and `refreshMedia()`
   runs several times per turn as an idempotent safety net (flip start, flip end, a
   drag that snapped back). `play()` on a finished element seeks to 0 by spec, so a
   *small drag* in the corner replayed the page too. `playVideoNow(v, restartIfEnded)`
   now only replays a finished clip when `refreshMedia` says the reader has just
   **arrived** on the page (`arrived = idx !== lastMediaIdx`) — re-asserts leave it
   finished. Scene landings pass `true` explicitly.

Re-entering a page still replays it from the top — that was existing, deliberate
behaviour and is covered by a test so it can't regress silently.

Verified (`cornertap.js`, `midtap.js` in the scratchpad): after page 1's clip ends, a
corner tap / a small corner drag / a centre tap all leave it finished and paused;
turning away and back replays from the top; and a tap DURING playback doesn't pause,
mute, restart or stall it.

---

## 2026-08-03 (earlier) — the author's own Play button; the spider is gone

The author supplied **`assets/play button.svg`** (210×206 — a purple spider-web
blob with a white ▶ and two sparkles) and asked for the pull-the-spider opening to
be removed. So the cover is back to a single Play button, but the artwork is now
the story's, not the engine's.

- **Two story options** instead of a hard-coded orb:
  `playButton: "assets/play button.svg"` (the artwork) and
  `playAt: { x: "50%", y: "77%" }` (where it sits, % of the cover — the cauldron's
  black belly again, clear of the title, both characters and the juice). The engine
  only places, sizes and pulses it; `playAt` feeds CSS vars `--play-x/--play-y`.
- Sized in **book px** (168px, breathing to ~180), not `vw` as the old orb was: the
  book is a fixed 1280×720 scaled by transform, so vw sizes drift against the cover
  as the window changes while book px keep their proportion.
- z-index 2 → masked by `.back-fill` (z3) the instant the cover opens, same as before.
- Opening is a plain tap again: `tapHitsPlay()` on the tap-catcher (which sits at
  z50 over the cover, so the button never sees a mouse event), plus the button's own
  click for keyboard. Kept the proper focus ring the spider work added.
- **Fully removed**: `#hangZone` markup, `.hang-*`/`.spider-btn` CSS, the
  `@property --pull` block, `spiderDangle`/`spiderTug`, and the whole PULL THE
  SPIDER section in script.js (~120 lines: pointer capture, `pullResist`,
  `springBack`, `snapAndOpen`, `autoPull`, the tug scheduler). Grepped clean — no
  orphaned rules or dead handlers left.

Verified: artwork loads (210×206) and sits centred on the cauldron at 720,639;
breathes; a tap opens the book and page 1 plays; Enter on the focused button opens
it; a tap elsewhere on the cover still does nothing; no failed loads, no errors.
Full read-through unaffected.

---

## 2026-08-03 (superseded) — the book opened by PULLING A HANGING SPIDER

The author's idea, replacing the gold Play orb: a spider dangles on a silk thread
over the cover art and the reader **drags it down** to open the book.

### How it works
- Markup: `#hangZone` in `index.html` — a `.hang-silk` line + a `<button
  id="hint" class="spider-btn">` holding an inline-SVG spider (purple body,
  gold star marking, white eyes, 8 arcing legs). Still the same `#hint` id, so
  nothing else in the engine had to change.
- **One variable drives everything.** `--pull` is registered with `@property` as a
  `<length>`; the silk's `height` and the spider's `top` are both
  `calc(var(--hang-y) + var(--pull))`, so the thread grows by exactly what the
  spider drops — they cannot drift apart. CSS owns the idle dangle
  (`spiderDangle`) and the periodic "pull me" tug (`spiderTug`); JS sets `--pull`
  while a finger is down. Because `--pull` is registered, the release is a plain
  CSS `transition` on a custom property — **no GSAP needed**.
- **Input is on the tap-catcher, not the button.** `.tap-catcher` is z50 over the
  whole cover, so the button never sees a mouse event — `overSpider()` hit-tests
  its on-screen rect, exactly as the old `tapHitsPlay` did. The `<button>` is kept
  for keyboard users (Enter/Space → the same pull) and now has a real focus ring.
- Pull distances are converted to **book px** (`toBookY`), so the gesture feels
  identical at any screen size. `PULL_OPEN` 92 book-px opens it; `PULL_MAX` 190
  with an exponential `pullResist()` so the silk stiffens instead of hitting a wall.
- Release: past the threshold → `snapAndOpen()` (silk whips up as the cover swings);
  short → `springBack()` on a springy bezier, book stays shut.
- **A plain tap still opens it** — `autoPull()` yanks the spider down and snaps it
  back, so the gesture is *demonstrated* rather than bypassed. A child who only
  taps is never stuck. (Say the word if it should be pull-only.)
- Story config: **`hangAt: { x, y }`** — % of the **artwork**, since `.hang-zone`
  is inset to match the art window. Replaces `playAt`, which the engine still
  accepts as the old name. Placed at **27.5%, 16%** — the dark sky left of the
  title, chosen by scoring the cover image's edge energy along the thread column,
  under the spider and through the pull zone (`hang.js` in the scratchpad); that
  corridor was the calmest available, so nothing in the art is hidden.
- z-index 2 → **under `.back-fill` (z3)**, which is what makes the spider vanish
  the moment the cover starts opening.
- Removed the whole `.play-btn` orb (gradient disc, web SVG, ▶ glyph,
  `playBreathe`) — no orphaned rules left behind.

Verified: renders at rest, dangles, tugs on a timer; a 40px pull springs back and
leaves the book shut; a 150px pull stretches the silk 117→248px and opens it (page
1 then plays); a plain tap opens it; a tap anywhere else on the cover does nothing;
no page errors.

---

## 2026-08-03 (earlier) — why page 1 started "after a few seconds", and the trim

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
