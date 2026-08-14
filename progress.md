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

## 2026-08-14 (latest) — LBD 2: the glow now waits for Agni to LEAVE, not just stop

The earlier fix (below) was measured against the wrong finish line. Moving the nudge
into the line's `onDone` stopped it glowing over the *words*, but the instruction is
still on screen after that: **the bubble sits there for another 1.5s and then takes
~0.55s to leave**, so the boxes were still pulsing under a bubble reading "Tap the
lemons and the straws." That is what was still being seen, and it was a fair report —
"the line has ended" and "the instruction is over" are two different moments.

The nudge now starts after `hideTutMascot()` has actually taken the bubble away:

```js
showTutMascot(TUT[4], function () {
  state.locked = false;                 // typed + spoken: tap away
  tutLater(1.5, function () {
    hideTutMascot();
    tutLater(0.6, startGarnishNudge);   // ...and only once his bubble has gone
  });
});
```

Measured end to end: instruction starts 7721ms → line ends 11134 → **bubble gone
12934 → glow 13242**, i.e. 308ms after the last of the instruction leaves the screen.

**That delay opens a race**, so `startGarnishNudge()` was guarded: the boxes are
tappable ~2.1s before the nudge runs, and without the guard a box tapped in that
window would be lit up again by it. Both cases tested:

- lemon tapped early → glow starts with **lemon off, straw on** ✓
- both tapped early → **nothing glows at all**, trays centre, the cheer plays and four
  customers file in ✓

A testing note worth keeping: `page.evaluate(fn, arg)` where fn returns a Promise —
the `new Promise(...)` must be closed *before* the argument (`}), ARG);` not
`}, ARG));`). Getting it wrong silently passes the argument to `new Promise` and it
fails inside the page as "ARG is not defined".

---

## 2026-08-14 — LBD 2: the lemons and straws pulsed over the instruction

The garnish boxes started glowing and bobbing the instant level 2 opened, while Agni
was still saying "Tap the lemons and the straws." — so the thing being explained was
already flashing "tap me" over the explanation.

One line moved. In `transitionToPhase2`'s afterFn, `startGarnishNudge()` was called
in parallel with `showTutMascot(TUT[4], …)`; it is now inside that call's `onDone`,
next to the `state.locked = false` that was *already* correctly gated there.
`onDone` fires from `lineDone()`, i.e. only once the line is fully typed AND spoken.

Worth noting the old arrangement was self-contradicting, not just noisy: taps were
locked out until the line ended anyway, so for the whole instruction the boxes were
advertising an interaction the game would refuse.

Measured by playing level 1 through for real (nine drags — `game.js` is an IIFE and
exposes only `window.__game`, so there is no shortcut into level 2), then timing the
`nudge-glow` class against `state.speaking`:

| | pulse begins |
|---|---|
| before | **0ms into** the 3402ms instruction — glowing through all of it ✗ |
| after | **3394ms in**, 0ms after the instruction ends ✓ |

Two testing notes for next time. `#play-btn` listens for **pointerdown**, not click —
a `.click()` leaves the title up and every later drag lands on the overlay, which
looked exactly like broken drag handling. And the bubble text is **typed**, so
matching on the full sentence dates the line's start to just before its end; use
`state.speaking`, which spans the real line.

The idle-nudge path was checked too — it deliberately leaves the garnish step alone
("the untapped boxes already glow"), so this single call site was the whole bug.

---

## 2026-08-13 — the page-jump menu is back, button and all

Asked for the hamburger again. Two edits, no more: the one `<script
src="dev/dev-menu.js">` line is back at the bottom of index.html, and
`SHOW_BUTTON` in `dev/dev-menu.js` is `true` again so the button is visible in the
top-left rather than key-only. Nothing in `engine/`, `story.js` or the CSS was
touched — removing that line (and the folder) is still the entire uninstall.

Verified in the real book: both dev files fetched, button visible at 14,14 with 13
page rows, the active page carries `aria-current` and follows the book as it turns,
an outside click closes it, so do Esc and picking a page, and the backtick still
toggles it. Jumps land from **both** the open book and the closed cover — indices
5, 9 and 1 all exact, no JS errors.

(A first run reported the jump failing. It had not: from a closed cover the menu
opens the book first, which takes ~6s, and the check had waited 4s. The test now
waits on the menu's own `busy` lock coming off instead of guessing a duration.)

`dev/README.md` was updated to match — it still described the button as hidden.

---

## 2026-08-13 — LBD 1's juice-splash wipe rebuilt from the reference

The author supplied `splash-transition.md` — the written-up version of this effect —
and asked for LBD 1 to use it, because the wipe there "is not looking good". Ported
into the game's existing Web Animations code (LBD 1 has no GSAP, and the reference's
§7 says none is needed — it is three transforms and two callbacks).

**Two defects were captured on real frames first**, which is what the port fixes:

1. **The board went flat pink in ~150ms and then sat there for ~840ms.** The burst ran
   on an ease-OUT curve, so the blob reached almost full size immediately. It also
   wasted the 16 droplets: they are the same pink, so once the board is pink there is
   nothing left to see them against. Now the burst *accelerates* (`power3.in`), the
   droplets lead it over the live scene, and the splat's ragged edge and white rim are
   part of the show.
2. **"Full cover" was not full.** The sheets were 132% of the board tall and covered at
   -16%, which put the front sheet's drippy bottom edge at 91% of the board — measured
   at 1000ms, before the drain had even started, **the wooden counter was plainly
   visible across the bottom ~12%**, including at the moment the scene is swapped
   behind it. The sheets are now 176% of the board (the reference's ~1.75×) and cover
   at -10.5%, so the body reaches 131% of the board.

Also from the reference: the blob→sheet **handoff is a snap, not a 340ms crossfade**.
Both sheets arrive at cover in the SAME frame while the blob is still up, and the blob
is dropped 50ms later — identical pink on both sides, so there is nothing to see. Only
the *fall* is staggered (120ms), which is what separates the two drippy edges. Doing it
the other way round would leave the darker back sheet alone over the board for 120ms.

**Scales are this game's, not the reference's.** `splash.svg` is a ragged splat with
deep notches and a white rim just inside its edge, so its bounding box covering the
board is not the same as the painted shape covering it. Swept scale against "is every
pixel of the board this exact pink?": the first clean scale is **3.8**, so the burst
goes to **4.8** (settling to 5.05) for ~26% of margin — which also carries the moment
the viewport suddenly gets bigger during the fullscreen switch.

**Callers now get the hooks the effect is built around**, `playSplashTransition(midFn,
afterFn)`: midFn under full cover, afterFn once the new scene is revealed. The
end-screen swap was a hand-picked `SPLASH_COVER_AT = 820`; it is now the midFn, so the
swap and the cover cannot drift apart. (`endGame` still starts the celebration video at
`DRAIN_AT` rather than in afterFn — deliberately: a video must already be running
before the reveal, or the drain uncovers a frozen first frame.)

The sound was re-fitted, since the picture moved: `transation.ogg` now starts **late**,
at `COVER_AT − (peak − lead-in)` = 470ms, so its impact peak lands exactly on full
cover and the rush builds through the half of the burst where the blob is accelerating.
It used to start at t=0, which fired the wet SPLAT at ~450ms while the blob was small.

**Measured, not assumed** (`cover-window.js` scores every captured frame for "is the
whole board the wipe's pink?", timed from the transition's own start):

| | |
|---|---|
| cover window | **741ms → 1221ms** (746 → 1221 with the main thread throttled 4×) |
| `midFn` fired | 923ms — dead centre of the cover |
| `afterFn` fired | 2314ms, after the reveal completes at ~2244ms |
| Play → title hidden | 837ms, under cover |
| `endGame` → `gameEnd.show` | 926ms, under cover; video playing by 1172ms |
| in the book | `covered` 824ms → `masked` 1015 → `switched` 1018, fullscreen granted |
| `file://` | midFn 928, afterFn 2320, everything parked, no errors |

`TRANS.SWALLOWED` (800ms) is the earliest moment anything may rely on the cover, and is
what the fullscreen handshake uses — deliberately not `COVER_AT`, which would leave the
switch ~10ms of clearance before the drain. It is a few frames past the measured 741,
not on it, because an accelerating burst is back-loaded: the shape closes over the
corners in the last 15% of the burst.

---

## 2026-08-13 — the testing menu is out of the book again

The page-jump menu is no longer loaded: the `<script src="dev/dev-menu.js">` line is
gone from index.html, so **no dev code runs, nothing is added to the page, and no
dev file is even requested**.

Verified: no `.devm-btn`, no `.devm-panel`, zero elements with a `devm` class, no
`dev-menu` stylesheet, **no network request to `dev/` at all**, and the backtick /
Ctrl+Alt+D shortcuts are inert. The book itself still opens and navigates (reached
page 2), with no JS errors.

`dev/` is still on disk and completely inert. To use it again while authoring, put
that one line back; then press `` ` `` or Ctrl+Alt+D, or set `SHOW_BUTTON = true` in
`dev-menu.js` for the visible hamburger. Delete the folder as well for a final
clean-out — nothing in `engine/`, `story.js` or the CSS refers to it.

---

## 2026-08-13 — the dev hamburger is hidden, the menu still opens

Asked to hide the hamburger. Hiding the button alone would have left the tool
unreachable — it had no shortcut, only Esc-to-close — so the button is hidden AND a
key was added to open the menu:

- **backtick** (`` ` ``), or **Ctrl+Alt+D** for the version that cannot be hit by
  accident. Either also closes it.
- Neither is used by the book (it listens for the arrows, Space, Enter and Escape),
  and the listener is capture-phase so the book cannot swallow it. Confirmed the
  arrows still work: 3 → 2 by ArrowLeft, 2 → 1 by `goPrev()`, 1 → 2 by ArrowRight.
- One flag brings the button back: `var SHOW_BUTTON = true;` at the top of
  `dev-menu.js`. The console prints the keys and that flag on every load, so it is
  not something to remember.

The button is still **built**, just `display: none` — so `aria-expanded`, `focus()`
and the click handler all keep working untouched. `display` rather than opacity so it
cannot be tabbed to or clicked by accident, and takes no space over the book.

Verified: the button computes to `display: none` at 0×0, the panel is closed on load,
backtick opens and closes it, Ctrl+Alt+D opens it, a jump from the keyboard-opened
menu still lands (page 4), the cover screenshot is completely clean, and the book
keeps its own arrow keys.

---

## 2026-08-13 — the page-jump menu is back, for testing

Re-enabled the dev hamburger that was removed on 2026-08-11. Everything it needs
was still on disk in `dev/` (kept inert precisely so it could come back), so this
was one `<script>` line in `index.html` plus a verification pass.

**Removal is still one folder and one line** — `dev/README.md` spells it out, and
the comment above the script tag repeats it. Nothing in `engine/`, `story.js` or the
CSS refers to it, and it refuses to start if `window.STORY` is absent.

### It survived the engine changes made while it was gone

Worth checking, because two of them could have broken it:

- **Games can no longer be turned past** (they must report `end`). The menu's jump
  calls the engine's own `dialogueDone(at)` before each forward hop, which sets
  `hintDoneFor` and satisfies `goNext()` for *any* page type — so a jump straight to
  page 12, past **both** games, still works. Verified.
- **`arrowReadyFor` / `revisiting`** likewise do not gate `goNext()`, so hopping is
  unaffected.

### Verified against every requirement

| | |
| --- | --- |
| top-left | button at (14, 14), 44×44, `position: fixed` |
| lists every page | 14 rows — cover + 13 pages |
| marks the current page | `aria-current="true"` — cover on load, the landing row after a jump |
| closes when a page is picked | yes |
| closes on an outside click | yes |
| closes on Esc | yes (extra) |
| jump past both games | page 11 reached |
| JS errors / 404s | none |

**Note for future testing:** the active row is marked with `aria-current`, not a
class. My first check looked for `.active`/`.current` class names and reported "no
active page" on a menu that was working correctly.

### One improvement while it was open

Game rows showed their `src`, which is always `index.html` — useless for telling the
two games apart, which is the main reason to jump to one. They now show the title
from `story.js`: **🎮 Pour the juice** and **🎮 Sort and serve**.

---

## 2026-08-12 — LBD 1's fresh glass inflated instead of dropping in

Reported as "the glass pop for few second and its looking akward", narrowed with the
author to the **fresh glass that appears in the machine after a serve**, playing the
game standalone.

The sequence itself turned out to be correct, so the bug was in the animation, not
the timing. Measured in isolation (`hideMachineGlass()` + `rewardCoins()`):

| | |
| --- | --- |
| glass hidden | 5ms |
| coins land | 6ms |
| coins fade | 912ms |
| glass `appearIn` | 1640ms |
| at rest | 2161ms |

That matches `COIN.HOLD` 900 + `COIN.FADE` 700 + 20 exactly, and the
`noCustomersLeft()` guard is complete — it covers `phase === 'gameover'`, non-pair
mode, customers still due, an **empty** queue, and the last-served case. (I first
thought the empty-queue case was missing and was wrong; it is handled.)

### What was actually wrong

The keyframes claimed to "drop into the slot" but did the opposite. Sampling the
computed transform frame by frame:

- `transform-origin: center bottom` with `scale(0.7)` meant the glass's top edge
  started **17px BELOW** its resting position (top 570 against a resting 553) and
  **grew upward out of the machine floor** — inflating, not dropping.
- The back-out curve `cubic-bezier(0.34,1.56,0.64,1)` then swelled it to **scale
  1.029 at 275ms**, 2.9% over its resting size, before it settled back.

A glass ballooning up out of the bay and wobbling past its own size is what looked
awkward. Now it is placed: `transform-origin: center center`, no scaling at all, and
a plain ease-out from `translateY(-9%)` to 0 over 450ms. Re-measured: scale is
**exactly 1 throughout, 0% overshoot**, and the glass starts 10px **above** its slot
(top 543 → 553), so it genuinely drops in and fades up. Confirmed on frames.

### Testing notes from this one

- `#glass` is an **SVG** element, so `element.className` is an `SVGAnimatedString`,
  not a string — logging it prints `[object SVGAnimatedString]`. Use
  `getAttribute("class")`.
- LBD 1's inline handlers expose usable globals: `pour()`, `addStrawToServed()`,
  `addLemonToServed()`, plus `hideMachineGlass()` / `showMachineGlass()` /
  `rewardCoins()`. Driving those directly reproduces a post-serve state in seconds,
  where scripting the full drag-and-drop flow kept failing at the tray drop.
- `skipDialogue` is a top-level `let`, so it is NOT reachable from outside; `?debug=1`
  loads only an asset-positioning overlay, not a flow skipper.

---

## 2026-08-12 — the poured juice fell BEHIND the glass

Reported as "the pouring juice falling behind the glass not in the glass", and that
is exactly what it was — not an alignment drift but a paint-order bug.

The stream is a `<div>` that sat **before** `.pour-glass` in the DOM, on the note that
it should tuck "behind the rim". But the glass is not translucent artwork: the SVG
fills `CUP_BACK`, `CUP_FRONT`, `CUP_RIM` and `CUP_MOUTH` as solid paths. Sitting
underneath meant being hidden behind the **whole cup**, not just the rim. Measured:
the stream ran to y 512 while the cup's top edge was y 500, so its last 12px were
buried and it appeared to stop dead at the rim — the liquid then rose in the glass
with nothing connecting it to the spout.

Two changes, both needed:

- **Paint order** — the stream div moved to after the glass SVG, so it is visible
  crossing the rim into the mouth.
- **`stream.h` 8.5% → 19%** — at 8.5% it still only reached the rim (bottom y 512
  against a mouth at y 500–509). At 19% it carries from the spout down into the
  juice: bottom y 579, inside a glass that ends at y 605, so it never overshoots.

Verified by zooming 3× on the spout-to-glass region through a full four-tap fill:
the stream lands in the liquid at every level (its lower part merging with juice of
the same colour once the level is high), it stays inside the glass, and the glass
still reaches `.full` so the page unlocks.

Worth noting how this was found: the geometry numbers alone looked fine — the stream
was centred on the glass and overlapped its mouth by 12px. Only the zoomed picture
showed the overlap was **behind** the cup rather than in front of it.

### The Page 6 export never landed

Reported as updated, but the file on disk is **byte-for-byte identical** to the
committed one — same SHA256 `85d2d42c…`, same 3,495,290 bytes, git reporting no
change, only the mtime moved. So it was the same file copied over itself.

Flagged for when the real one arrives, because Page 6 is the highest-stakes
replacement in the book: the POUR scene's `machineAt` / `buttonAt` / `glassAt` /
`stream` were template-matched against **that clip's final frame** so the
cross-dissolve into the interactive machine is invisible. An earlier set was 5.8% too
far right, 3.8% too low and 6% too small and the machine visibly jumped. Any change
to the clip's framing means re-measuring all of them.

---

## 2026-08-12 — the iris comes earlier, and the peel reveals the page again

### A misread, and the revert

"when nudge came with peel animation show the next page" was a **request** — the
peel should reveal the next page, as lifting a real page does. I read it as a bug
report that the hint was leaking the next scene, and veiled the sheet beneath so the
fold uncovered blank paper. That paper is `var(--paper)`, #1e2750, which is what
"only blue colour" was.

The veil is gone — CSS rules, the `setPeekVeil` helper and all three call sites —
and the peel reveals the real next page again, confirmed on a captured frame (page
2's lit pumpkin visible under the fold while reading page 1). A note is left in
styles.css saying it was tried and why it was removed, so it does not get
"fixed" back in.

### The iris is now timed to the ZOOM, not to the clip's end

Three passes to get this right, and the author's reasoning is what settled it: the
iris exists to *focus attention on the glass*, so it should close **with** the camera
pushing in — not once the push has already finished.

| `at` | circle closes | held spotlit | verdict |
| --- | --- | --- | --- |
| 14600 | 16.48s | 0.53s | far too late — the beat was over before it was seen |
| 12600 | 14.36s | 2.65s | still waited for the zoom to finish first |
| **10000** | **11.5s** | **5.5s** | closes as the zoom starts, which is the point |

Found the zoom by tracking the glass's width as a share of the frame:

| clip time | glass width |
| --- | --- |
| 10.0s | 7.5% ← the push-in begins |
| 10.5s | 8.8% |
| 11.0s | 10.4% |
| 12.0s | 18.8% |
| 12.5s | 20.4% ← arrived |
| 14.6s+ | 19–20%, held to the last frame |

Verified frame by frame: dormant at 9.85s (`scale(3.4)`, opacity 0), closing by
10.67s (scale 1.92), fully closed at 11.56s with the spotlight on the still-small
glass while the camera keeps pushing, and by 12.5s the glass has grown to fill the
circle — rim to base, steam rising out of the top. Held from there to 17.0s.

**A measurement trap worth recording:** a colour-based scan of the juice makes the
13–14s stretch look wildly unstable (the pink was reported spanning x 32.9–95.4%,
centroid jumping to y 33%), which nearly ruled out any earlier timing. Looking at
the actual frame showed why — a **purple smoke plume** rises out of the glass there
and the filter counted it. The glass itself never moves. Always look at the frame
before trusting a colour statistic.

### Page 10's new export: the geometry still needed retuning

Same footage with ~2s more of the held glass — frames at 12.6s pixel-identical to
the previous file (control 51.53), same audio peak, RMS differing only at 14.50s,
past where the old clip ended. Duration **15.022s → 17.009s**.

`y` 49% → 62% (and `x` → 49.5%) stays, and is the real fix for the framing: this
export does not zoom as far as the old one, so at 49% the circle ended at 535px
while the glass reached 567px and **its base was cut off**. Measured at the closing
frames the juice centroid is 50.5% / 66.9%, spanning y 45.9–84.4%, so the glass
centres near y 62%. `size` stays 40% (≈452px against a glass ~282 × 353px).

Two replaced clips in a row have changed *duration*, which is what silently breaks a
timed effect. A replacement on any page carrying `iris`, `hold`, `delay` or
`tap.after` needs its numbers re-measured, not assumed.

### Still to confirm with the author

The new clip was described as "an end screen of the book". It is already the last
story page, and page 12 is still the generated "The End" card with the replay
button. Whether that card should now go is a content decision, so it stays.

thing that silently breaks a timed effect. Any replaced clip on a page carrying an
`iris`, `hold`, `delay` or `tap.after` needs its numbers re-measured, not assumed.

### Still to confirm with the author

The new clip was described as "an end screen of the book". It is already the last
story page, and page 12 is still the generated "The End" card with the replay
button. Whether that card should now go — leaving the held glass as the final
screen — is a content decision, so it has been left in place.

---

## 2026-08-12 — the new Page 2, and re-reading a page

### Page 2's replaced export: the AUDIO changed, nothing else

Checked the way every replaced clip is: **17.441s and 1920×1080, identical to the
previous file**, and frames sampled at 0.5 / 3 / 6 / 9 / 12 / 15 / 17.1s are
pixel-identical — against a control of **42.03** for a genuinely different clip
(Page 3), so the method is sound. The first control I tried scored only 3.73
comparing two moments of Page 2 itself, which is far too weak to prove anything;
worth remembering that a control has to be something that *must* differ.

Decoding the audio found the real change: same duration, rate, channels and peak
(0.3949), but the per-250ms RMS differs, **biggest at 4.00s**. So it is a
re-recorded line, not a re-encode. Same as the previous Page 2 replacement.

Nothing to integrate. Page 2 has no `iris`, `hold` or `delay`, its length is
unchanged, so every timing that depends on it still lands. `story.js` still says
"17s", which is right.

### "The nudge and arrow should come when the whole video completes"

Already true on a **first** read, and now measured against every clip's real
duration rather than assumed:

| page | clip | duration | cue fired | vs clip end + 700ms |
| --- | --- | --- | --- | --- |
| 1 | Page 2 | 17.441s | 18114ms | −27ms |
| 2 | Page 3 | 23.538s | 24216ms | −22ms |
| 3 | Page 4 | 16.136s | 16779ms | −57ms |
| 6 | Page 7 | 8.197s | 8952ms | +55ms |
| 9 | Page 9 | 30.680s | 31331ms | −49ms |
| 11 | Page 10 | 15.022s | 15666ms | −56ms |

Page 0 is the exception at +1172ms, which is the book-open animation delaying the
clip's start, not the cue firing late.

What actually looked wrong was the **re-read** case: returning to a page fired the
cue instantly (`videoWatched[idx] → dialogueDone(idx)` on arrival), so the nudge
appeared with no clip having played — which reads exactly like "the nudge came
before the video finished".

### Re-reading a page now behaves differently, on purpose

New `pageRead` map, and a `revisiting` flag set when a page arrives:

- **Both arrows immediately.** A re-reader is not made to sit through the clip
  again to earn the forward arrow. Set at ARRIVAL rather than in `dialogueDone`, so
  it holds for a scenes page too — those only report finished when their last scene
  ends, and a re-reader should not have to replay the scenes for an arrow.
- **No page-flip nudge.** `canShowHint()` returns false while revisiting. A hand
  swiping the corner of a page the reader has deliberately turned BACK to is
  telling them to undo the thing they just chose to do.
- Interaction nudges (the tapping hand, the POUR hint) are untouched — those are
  how a scenes page is played at all.
- `pageRead` clears with `videoWatched` when the book closes, so every fresh read
  is fully gated again.

Verified: first reads of pages 0–2 still cue at 12698 / 17979 / 24116ms (the whole
clip), then going back to pages 2 and 1 shows `back=yes next=yes` immediately with
**no hand, no flare and no peel across 12 seconds** of watching. Pages 0–7 still
clean on a first read, and the game gate still holds.

---

## 2026-08-12 — the turn cue: three real bugs in the nudge and arrow

Audited the whole cue by watching it play with **nothing forced** — the arrow, the
hand, the flare and the ghost peel sampled at 25ms on every page, then the taps a
reader would make driven for real. Three genuine bugs, and one thing the audit
proved is *not* broken.

### 1. The arrow arrived ~600ms before the nudge

`CUE_AFTER_DONE_MS`'s own comment reads *"page finished → arrow + hand + peel,
**together**"* — but the code did not do that. `dialogueDone` revealed the arrow
immediately and then scheduled the hand, the flare and the peel 700ms later.
Measured on four pages: **585, 625, 601, 624ms apart**. The flare and the hand were
already perfectly synced (0ms, from the earlier fix); it was the arrow's plain
*arrival* that ran ahead, so the reader saw two separate events.

Fixed with `arrowReadyFor`, a second gate on the forward arrow set on the same
delay that fires the nudge. Now measured **0ms / 0ms / 0ms** — arrow, flare and
hand are one event on every page.

Two traps handled while doing it, both found by testing rather than reasoning:

- The arrow gets its **own timer** (`arrowRevealTimer`) that `resetIdleHint` does
  *not* clear. Sharing the nudge's timer meant a tap during the 700ms beat pushed
  the arrow out to `CUE_AFTER_TOUCH_MS` (measured: 2508ms) — and a child tapping
  repeatedly could postpone it indefinitely and never be offered a way on. Now:
  idle reader → all three together; tapping reader → the arrow still arrives on
  time (measured 843ms) and only the nudge waits for a lull.
- `arrowReadyFor` is set **before** `canShowHint()` in `triggerHint`, so a nudge
  held back for an unfinished game does not also withhold the arrow.

### 2. A game could be turned straight past without being played

`refreshMedia`'s *"no dialogue at all (e.g. THE END)"* branch fires for any page
with no bubble and no video. That was written for THE END — but a **game page has
neither**, so it inherited the branch when games were added and was marked finished
the instant the reader arrived. Measured on page 8, three seconds after landing:
the forward arrow visible and enabled, and **the arrow, `goNext()` and a corner
drag all turned the page** with the game untouched. The `gameDone` gate added
earlier only ever held back the nudge, never the arrow or the turn.

Game pages are now excluded from that branch, so a game finishes the only way it
should — by reporting `end`. Verified: all three routes now leave the page at 8,
and finishing the game still hands it back (`end → endDone → left → arrow → 8→9`).
The BACK arrow is untouched, so nobody is stuck on a game they cannot win.

### 3. The second beat's page-lift was silently lost without GSAP

The nudge plays two beats and re-fires `peekFlip` on the second, because the peel
is one-shot. `peekFlip` bails while `peeking` is true. The GSAP peel runs
0.7 + 0.15 + 0.6 = **1450ms**, comfortably clear of the 1500ms beat — but the
no-GSAP fallback ran 720/760/**1520ms**, clearing `peeking` 20ms *after* the
re-fire. So in the fallback the second beat lost the one thing that re-fire exists
to provide. Retimed to 700 + 150 + 600 = 1450ms, matching the GSAP path exactly.

### Not broken, despite looking it

- The nudge **does** repeat while idle — instrumented at exactly 9001ms after it
  hides, indefinitely. An earlier reading suggested it never repeated; that was my
  watch window ending before page 1's real completion (its video runs ~15s).
- The interaction hand (`.scene-tap-hand`) and the corner flip hand never appear
  together. An apparent clash on page 4 was my probe querying the whole document
  and finding tap-hands on *other* leaves, off-screen but computing as visible.
  Scope cue probes to the current leaf.

### Consequence for testing

An automated read-through can no longer click past the game pages — reaching page
12 now requires actually playing both games. That is correct, but it means a
full-book script has to play them or start after them.

---

## 2026-08-12 — a reusable play-test suite in `test/`

Every bug found in this project was found by *playing* it in a real browser, but the
scripts that did it were one-offs in a temp scratchpad — **208 of them**, wiped every
session, rebuilt from scratch each time. They now live in `test/`, committed.

The book is untouched by this: still **no build step, no runtime dependencies**,
still works by double-clicking `index.html`. `playwright-core` is installed only
inside `test/` and gitignored, and downloads no browser — it drives the Edge already
on the machine.

| command | what it does |
| --- | --- |
| `node test/check-media.js` | Safari/iOS codec fallbacks. No browser, ~1s. |
| `node test/audit.js [--file]` | Missing assets + JS errors, book and both games. |
| `node test/play-book.js` | All 13 pages, a screenshot each, checks the closing iris. |
| `node test/play-lbd.js 2 [--wrong] [--throttle 6]` | Plays a game properly, audits its dialogue. |
| `node test/serve.js` | The server alone, for poking about by hand. |

`audit.js` and `check-media.js` exit non-zero, so either can gate a release.
`test/README.md` documents the traps each script already avoids;
`TESTING-PROMPT.md` at the root is the same prompt aimed at a different project.

### New finding: LBD 2 is silent on Safari before 17

`check-media.js` earns its place immediately. **LBD 2 has no Safari/iOS fallbacks
at all** — 14 audio files `.ogg` only, its end video `.webm` only, and `js/sfx.js`
hard-codes `.ogg` with no `canPlayType` detection. On an older iPad the game has no
voice-over and a blank end video, with **nothing in the console** to find later.

LBD 1 already solved exactly this for itself: every clip has an `.m4a`/`.mp4`
sibling (21/21 covered) and it picks the format once via `MEDIA` / `mediaSrc`. LBD 2
never got the same treatment. Two files in the book are uncovered too:
`sfx/pour.ogg` and `assets/audios/This glass is filled all the way up…ogg`.

**Not fixed** — transcoding needs ffmpeg (not on this machine) and the assets are
the author's call. The fix is to create the siblings, then copy LBD 1's
`MEDIA`/`mediaSrc` pair into LBD 2. 17 files in total.

### A correction: Range support is not what fixes `Infinity` durations

I had believed a test server ignoring `Range:` was why `<audio>.duration` read
`Infinity`, and wrote that into `test/serve.js`. Measured properly, it is false: an
`.ogg` streamed over http reports `Infinity` **with `preload="metadata"` and with
`preload="auto"` alike**, because Ogg carries no header duration and Chromium will
not read to the last page for it. Fetched through a `blob:` URL it is exact
(3.822313s for `vo-ready.ogg`) — which is why both games get real durations at
runtime: their preloaders hand every clip a blob. `H.clipDuration()` does it the
right way. `serve.js` still implements Range properly, verified with a 206 response,
because seeking a `<video>` needs it.

### Two bugs in my own test script, fixed before committing

Worth recording, because a test that lies is worse than no test:

- `play-book.js` reported *"the iris never finished closing"* — a **false failure**.
  It was checking after the read-through had already turned past that page, so it
  found an unloaded video. Moved inside the loop; now reports `closed on the glass
  at t=14.07s of 15.02s`.
- Pages 4 and 5 printed as `undefined`. Not every page carries `type` — the
  multi-scene ones are identified by a `scenes` array. Now `scenes(3)` / `scenes(2)`.

### Verified

`audit.js` — clean, 0 missing and 0 JS errors across all three. `play-book.js` — all
13 pages reachable, iris closes, no errors. `play-lbd.js 2` — full playthrough into
serving, 7 clips, none cut short, no clip outliving its bubble.

---

## 2026-08-12 — a bug sweep across the book and both games

Two real bugs found and fixed. The reported one — LBD 2 playing a line's audio with
no dialogue on screen — **could not be reproduced**, and that is recorded honestly
below rather than papered over.

### Fixed: LBD 1 404'd a voice clip on every single load

`TITLE_MUSIC_SRC = 'audio/ready set serve.ogg'` — the spoken title announcement.
The file is not in `audio/`, has no `.m4a` twin, and **has never existed in this
project's git history**, so the reference could only ever 404. It was also listed
in the preload manifest at 28,677 bytes, so the loader was told to fetch bytes that
could not arrive.

Set to `''` (every use already guards on it, so `titleMusic` stays null and the
title is simply silent) and the manifest line commented out, both with restore
instructions. The Play button already appeared at 836ms, so this was never gating
loading — it was pure console noise plus a missing announcement.

**To restore:** drop the clip into `LBD/Glass half full LBD 1/audio/` and put the
filename back in both places.

### Fixed: LBD 2's dialogue was chained on guessed timers

Agni's lines were sequenced and dismissed by hard-coded delays, each one a guess at
its clip's length. Measured against the real clips (via `SFX.voiceDuration` after
preload, **not** raw `<audio>` over my test server — that reports `Infinity` because
the server has no Range support):

| line | clip | audio ends | next event | margin |
| --- | --- | --- | --- | --- |
| TUT[0] | 3.12s | 5.27s | next line at 5.4s | **130ms** |
| TUT[1] | 2.95s | 8.55s | next line at 8.8s | **250ms** |
| TUT[3] | 3.82s | 4.47s | hide at 4.6s | **130ms** |
| TUT[5] | 3.82s | 5.57s | hide at 5.6s | **30ms** |

A negative margin means either the next line starts while Agni is still talking
(the bubble retypes mid-sentence under the old audio) or the bubble leaves while
the clip runs on — **audio with no dialogue**. The 30ms one is a coin flip.

The code already had the right mechanism and was using it in one place: the `onDone`
callback passed to `showTutMascot` fires only once a line is **fully typed AND
spoken**. All four sites now use it. Gaps measured after: 677ms and 752ms, up from
304ms and 395ms. Added a `tutSeq` token bumped by `clearTutTimers`, because an
`onDone` already handed to `showTutMascot` cannot be killed like a timer can — so a
chained line still checks whether the player dived in and the tutorial was called off.

LBD 1 already does this correctly (`clip.onended = advance`, with a safety net sized
from the real duration), so this only brings LBD 2 into line with it.

### Could NOT reproduce: LBD 2 audio with no dialogue

Driven every path I can reach, watching `#agni`'s computed visibility and the bubble
against every clip that starts. In all of them the bubble stayed up for the whole
clip and the text typed out in full:

- standalone over HTTP, and standalone on `file://`
- inside the book (where it also goes fullscreen and the stage rescales mid-tutorial)
- the wrong-drop nudge (`wrongStreak >= 2`), where the bubble deliberately shows
  only "This glass is half full." while the clip also says "Put it in the correct tray."
- a full playthrough to the serving phase: all 7 clips, none cut short
- **with the CPU throttled 6×**, and the pre-fix code throttled 3× all the way to
  the 30ms-margin line — even that held here

So the timer fix above is a robustness fix, not a proven cure. If the symptom is
still there, what would pin it down: which line, and whether it is on `file://` or
the hosted build.

### Checked, not bugs

- **LBD 2's garnish boxes** (`#lemonbox`/`#strawbox`) — Playwright called them "not
  visible" and a blocked garnish step would stall the game. In phase 2 they are
  `visible`, opacity 1, `pointer-events: auto`, and `elementFromPoint` at their
  centre returns the box itself. My harness was clicking before the phase transition.
- **LBD 1 on Safari** — `VOICE` builds every path as `.ogg`, which looked like it
  ignored the `.m4a` twins and the codec detection. It does not: `regAudio` routes
  through `mediaSrc`, which swaps the extension. All 13 mapped lines have both twins
  and there are no orphan clips.
- **`assets/pages/Page N.mp4` in `requestfailed`** — the engine aborting in-flight
  range requests as it unloads a video on leaving a page. Every file is present.
- **"Allow attribute will take precedence over 'allowfullscreen'"** — the book's game
  iframes carry both deliberately; `allowfullscreen` is the fallback for browsers
  without `allow`. Harmless redundancy, left alone.

Final state: **0 missing assets and 0 JS errors** across the book, LBD 1 and LBD 2.

---

## 2026-08-11 — a finished game gives the book back

A game is played **fullscreen**, so when it ended the reader was left looking at a
celebration filling the screen with the book nowhere in sight: no page to turn, no
arrow, no hand, and no way onward except finding Esc. The page-turn cue was firing
the instant the game said `end` — behind a fullscreen celebration nobody could see
past. Now the game hands the book back.

### The sequence

1. `end` — the celebration has **started**. Nothing about the page changes: it is
   the reward, so it plays at full size.
2. `endDone` — the celebration has **finished**. A separate message because it is a
   separate moment: LBD 1 shows its card at `SPLASH_COVER_AT` but does not start
   the video until `DRAIN_AT`, ~1s later, and both celebrations run 4.02s.
3. The book posts `leave`; the game exits **its own** fullscreen and answers `left`.
4. Only then does the book take the page over — `gameDone`, `.done`, and the turn
   cue — with two rAFs first so the book is laid out at window size before the hand
   and ghost peel (positioned in % of the page) start animating.

### Two things this got wrong first

- **`gameDone` was being set at `end`.** That flag is what opens `canShowHint`'s
  gate, so setting it early was itself what armed the cue behind the fullscreen
  celebration — measured at 148ms after `end`. It now waits for the return. Same
  for `.done`: dropping the frame's pointer-events during the celebration took
  away the game's own taps, and **LBD 1's end card waits for a tap to replay**.
- **The book cannot exit the game's fullscreen.** Calling `document.exitFullscreen()`
  from the book shrank the frame but left the book's own
  `document.fullscreenElement` still pointing at the iframe — a half-exited state.
  Fullscreen was requested on the game's own `documentElement`, so only the game's
  document can release it. Hence `leave`/`left`.

### And a check that was quietly wrong

The book **already goes fullscreen when it opens** (`enterFullscreen` on the
cover's Play tap), so `document.fullscreenElement` is truthy for the whole
reading. Both places that asked "is anything fullscreen?" now compare against the
**frame** instead — otherwise every switch reads as granted, including a refused
one. This is also why the return works so neatly: releasing the game's fullscreen
restores the book's, so the reader lands back in the **fullscreen book**, not a
windowed browser.

### Verified over HTTP (the only path where fullscreen happens)

Both games, driven to their end screens:

| | LBD 1 | LBD 2 |
| --- | --- | --- |
| celebration plays full size | 1280×800 for 4.1s | 1280×800 for 4.1s |
| `endDone` → `left` | 546ms | 523ms |
| frame back to page size | yes (1126×634) | yes (1126×634) |
| cue arrives **after** the return | yes | yes |
| page turns | 8 → 9 | 10 → 11 |

Screenshot after the return confirms it: the frozen celebration held in the page,
the desk around the book, and the forward arrow cueing the turn.

One testing note: park the pointer off the book (`mouse.move(4, 4)`) before
sampling. `.done` makes the frame pointer-transparent, and a peel completes at
**15%** (`prog > 0.15`), so a mouse left sitting over the page turns it and looks
like a product bug. It is not — that cost me a wrong diagnosis.

### The end scene: a new export was intended, but none landed

The author reported adding a new video for the end scene and confirmed they meant
the **story's last page** (index 11, `assets/pages/Page 10.mp4`). No new file
arrived: `git status` was clean (nothing untracked anywhere), no commit this
session **added** a file, and the only change under `assets/` was that one
`Page 10.mp4` — which decodes to **identical frames**. Whatever was exported
re-muxed the same edit rather than bringing in a new one.

So the end scene was verified against the file that is actually there, and it is
working exactly as designed:

| clip time | iris |
| --- | --- |
| 0 → 12.52s | dormant (`opacity: 0`, `scale(3.4)` — hides nothing) |
| ~12.6s | `.closing` goes on, at the configured `at: 12600` |
| 12.52 → 14.58s | travels `scale(3.4)` → `scale(1)` over the CSS 1500ms |
| 14.58 → 15.02s | holds the glass spotlit through the last frame |

Then page 11 → 12 turns and THE END renders. Screenshot confirms the black
surround with the circle centred on the glass.

**Measuring the wrong element first**: `.page-iris` itself is static by design —
`--isize` is always `40%` and its opacity always `1`. The animation is entirely on
the inner `<i>` (`scale(3.4)`/`opacity: 0` → `scale(1)`/`opacity: 1`), switched by
`.page-iris.closing`. Sampling the wrapper made a working iris look frozen.

If a genuinely new export is dropped in, the iris needs re-checking, not
re-plumbing: `at` is measured from the clip's own clock, and `x`/`y` are the
glass's centre in the closing frames. A different edit moves all three.

---

## 2026-08-11 — the hamburger is gone, and the LBD switch stopped snapping

Two things: remove the testing hamburger from the book, and make the game-opening
transition smooth — LBD 1 above all.

### The hamburger

`index.html` no longer loads `dev/dev-menu.js`. Its button sat in the top-left of
**every** screen, cover included, which is not something a reader should see. The
`dev/` folder is still on disk and completely inert without that one `<script>`
tag; the comment left in its place says how to put it back for authoring.

Note for future testing: scripts that navigated by clicking `.devm-btn` no longer
work. Drive the engine directly instead — `window.dialogueDone(n)` then
`window.goNext()`, reading the current page as
`document.querySelectorAll("#flipbook .leaf.flipped").length`. (`goNext` and
`dialogueDone` are top-level function declarations, so they are on `window`;
`flipped` is a `let`, so it is **not**.)

### Why the transition was still noticeable — measured, not guessed

Captured real composited frames (CDP `Page.startScreencast`, **not**
`page.screenshot()`, which awaits a paint and therefore cannot catch a
mid-transition frame) and scored each one for how pink it was. Three separate
faults showed up, none of them the one I had been assuming:

1. **The switch fired before the screen was covered.** LBD 1's wipe holds full
   cover only from `BURST + 40` = 740ms (waves home) to `DRAIN_AT` = 1040ms — a
   300ms window. I was switching at `BURST + 30` = **730ms**, i.e. ~10ms *before*
   the waves arrived, so the switch straddled the moment cover completed and was
   still settling as the drain began.
2. **The mask's own appearance was the visible event.** It had no fade in by
   design ("it appears while the frame is already fully pink, so there is nothing
   to ease") — but that was wrong: the wipe covers only the *iframe*, which is one
   book page. The desk shows all around it. Frames measured **67% pink → 100% in a
   single frame**: the desk snapping pink. The mask hid the resize and then
   announced itself.
3. **On `file://` the mask was pure cost.** `document.fullscreenEnabled` is
   `false` inside a `file://` frame, so a double-clicked book could never switch —
   yet the game asked for the mask anyway. The reader got the wipe *plus* a pink
   flash across the desk, hiding nothing.

### What changed

- **Both games** now check `document.fullscreenEnabled !== false` before asking.
  No switch possible → no mask, no handshake; the game's own wipe runs alone,
  which is seamless. This is the double-click path, so it is the common case.
- **The mask fades in** over `LBD_MASK_IN_MS` (160ms, `.lbd-mask.up`), so the pink
  spreads outward from the book instead of snapping. It starts at `opacity: 0`
  now — it is only visible once `.up` is added.
- **`masked` is acked when the fade FINISHES**, not when it paints. Switching part
  way through would show the resize through a semi-transparent mask. The games'
  no-ack fallback went 250ms → 700ms so it cannot race the fade.
- **LBD 1 asks at `BURST + 40` (740ms)** — the start of its covered window, not
  the middle — because the fade now needs 160ms before the switch can go.
- **A granted switch keeps the mask up** and drops it 2.6s later with no fade. A
  fullscreen element renders in the browser's **top layer**, above everything in
  the page, so the mask is invisible regardless — which removes the tight timing
  budget entirely. Only a *refused* switch needs the quick fade-out
  (`.clearing.fast`, 120ms).

### Measured result

| moment | before | after |
| --- | --- | --- |
| desk turns pink | 67% → 100% in one frame | ramps 192→247 over ~155ms |
| switch lands | ~10ms before cover completed | ~950ms, 90ms clear of the drain |
| `file://` | wipe + a pointless pink flash | the wipe alone |

LBD 2 came out smooth on the same changes: splat ramp → 70% plateau → 120ms mask
ramp → cover held ~430ms → drain. Its window is wider than the timeline suggests.

### Verified

Full read-through on `file://` and over `http://localhost` (Vercel serves over
HTTP, and the fullscreen path only exists there — confirmed
`fullscreenEnabled: true` and `fullscreenElement: IFRAME`):

- 0 dev hamburger buttons anywhere; reaches page 12 of 12.
- Both games load (`game-missing` false) and start on Play.
- **0 mask events on `file://`** — the gate works.
- No new console errors. The `assets/pages/Page N.mp4` entries in
  `requestfailed` are the engine **aborting in-flight range requests when it
  unloads a video on leaving a page** — every one of those files is present on
  disk. The one genuine miss is LBD 1's own `audio/ready set serve.ogg`,
  pre-existing and its own bug.

### Also swept into this commit: a replaced `Page 10.mp4`

`assets/pages/Page 10.mp4` changed on disk during the session (8,918,176 →
8,845,579 bytes) without my touching it, so it went in with the above. Checked it
the way every other replaced export has been checked, because page 10 is the one
carrying the **iris** (`iris: { at: 12600, … }`) and a re-edit would move the zoom
out from under it:

- duration **15.022s** and **1920×1080** — identical to the previous file;
- frames sampled at 0.5 / 4 / 8 / 11 / **12.6** / 13.5 / 14.8s are **pixel-identical**
  (mean abs diff 0.00 at every point), against controls of 46.26 and 33.32 for
  frames that genuinely differ — so the 0.00s are real, not a broken comparison.

It is a **re-mux**, not a re-encode: same frames, smaller container. Nothing to
integrate, and the iris still fires on exactly the same frame.

---

## 2026-08-11 — the fullscreen switch: pink before, pink after

Author: still noticeable, make it unnoticeable. It was — and hiding it inside the
game's wipe was never going to be enough, for a reason that only showed up under
measurement.

**A wipe inside the iframe only covers the iframe.** At the instant fullscreen
engages, that frame stops being a page-sized rectangle and becomes the whole
screen, so the desk, the book and the arrows all disappear at once. And it is worse
on the far side: the wipe's splat is sized to the **pre-switch** viewport, so once
the viewport grows it no longer reaches the new corners and the game's own dark
background shows through — measured at **`19,8,34`** in the frames right after the
switch. Neither state was uniform, so there was always something to see.

A transition is unnoticeable when the before and after states MATCH. Both ends are
now the same pink — `#F77ADE`, the fill in both games' splash art and their drain
waves, so nothing was invented:

- **Before** — the book paints `.lbd-mask`, a fixed full-screen div in that pink,
  over everything including the desk and arrows.
- **After** — each game paints its own page background the same pink for the wipe's
  duration, so the enlarged viewport's corners are pink too. It sits behind
  everything, so the drain still reveals the scene normally, and it is cleared when
  the wipe finishes.

### The handshake, which is what actually made the mask work

The first attempt posted `covered` and requested fullscreen in the same breath. Since
postMessage is async, that gave the mask **~15ms — under one frame** — so it was
never on screen when the switch happened and did nothing at all. The measurement said
so plainly: *zero* frames with all four corners pink.

Now the game asks and **waits**: `covered` → the book paints, waits two rAFs so the
paint has actually landed, and replies `masked` → only then does the game switch. With
a 250ms fallback so a host that does not speak the protocol (or standalone) still goes
fullscreen.

Result, sampling a screen recording every 30ms at all four corners:

| | all-four-corners-pink frames |
|---|---|
| before the handshake | **0** |
| handshake only | 1 (~30ms) |
| handshake + pink page background | **4 (~120ms)** |

And "frames with ANY pink corner" spans exactly the same range as "all four" — so
there is no half-masked frame on either side. The switch happens inside a window
where the whole screen is one flat colour.

### Two measurement traps on the way

- `page.screenshot()` is ~380ms per frame, far too coarse for a switch lasting a
  couple of frames; it reported no pink at all. A screen recording sampled at 30ms
  found it. (Same lesson as the load-glitch hunt.)
- The recording sampler had to run on the **file origin** — an `http://` page cannot
  read a `file://` video, which failed as "no read" until the helper page moved.

Verified after: both games still start where fullscreen is refused (book on
`file://` — LBD 1 at 791ms, LBD 2 at 1182ms), the end-of-game handoff still works
(cue plays, drag turns the page 8 → 9, restart hands gestures back), 10/10 on the
game-integration checks, no host errors, read-through clean.

---

## 2026-08-11 — a finished game hands the page back to the book

Author: after the game ends, the end screen shows and the reader should be able to
turn the page with the flip animation. Two things were in the way: the book had no
idea a game had finished, and **drag-to-flip could not work on a game page at all**
— the iframe swallows pointer events, which is the very isolation that stops the
book stealing the game's drags.

### The games now report in

Each posts `{ source: "lbd", type: "end" }` to the parent when its end screen
appears — and, for LBD 1, `"restart"` when it loops back to its title.

Neither game's own logic was touched. Both moments are observable from the appended
script instead:

- **LBD 1** — `#gameEnd` gaining `.show` *is* the end screen; losing it is
  `restartGame()`.
- **LBD 2** — `#win-overlay` becoming visible *is* the finale. It never leaves that
  screen ("nothing navigates away and there is no replay button"), so it has no
  restart to report. A MutationObserver catches GSAP's inline-style change, with a
  slow poll as the belt to that braces.

### What the book does with it

`dialogueDone(idx)` → the page-turn cue it had been **holding back**: arrow glow,
hand and ghost peel, together on one beat. `canShowHint` used to veto game pages
outright; it now vetoes only until `gameDone[idx]`, so the nudge cannot interrupt
play but arrives the moment it is welcome. The arrow stays available throughout
regardless, so an unfinished game never traps anyone.

And **`.page-game.done { pointer-events: none }`** — the frame drops out of
hit-testing, so the page can be dragged to turn like any other. Only safe because
both end screens are non-interactive (an image, a video, confetti — no buttons),
checked before relying on it. LBD 1's `restart` message puts the frame back, or the
reader could never press Play a second time.

`e.source` is matched against each frame's `contentWindow` rather than trusting the
origin: on `file://` every document is an opaque origin, so origin checks cannot
identify a sender, but window identity can.

Verified: mid-game the frame still owns gestures and no nudge fires; on the end
screen the book flips to `done`, `pointer-events: none`, the cue plays, and **a real
drag turns the page 8 → 9**; on restart gestures go back to the game.

### A latent bug the change exposed

Letting taps fall through meant they could now reach the leaf beneath — and the
video click handler (the "tap for sound" recovery) had **no check that the video
belongs to the current page**. It would have called `play()` on whatever video was
clicked, breaking the one-video-at-a-time rule. I could not get it to fire — taps at
both the centre and the right edge land on the game leaf's own `DIV.face front`, and
0 videos played — but the handler was relying on an assumption my change had just
invalidated, and its sibling `ended` handler already guards exactly this way. Added
the guard rather than leaving it to luck.

Read-through clean, still "max videos playing at once: 1".

---

## 2026-08-11 — the fullscreen switch is now HIDDEN INSIDE the wipe

Author: the fullscreen switch still looks bad — it should happen *in between* the
splash transition. Right, and better than what came before it: the previous fix put
the switch before the transition, which just moved the visible resize onto the title
screen. Hiding it under a wipe is what a wipe is for.

Both games now: tap → wipe bursts and covers the screen → **switch + start, unseen**
→ wipe drains, revealing the game already full size.

| | wipe starts | covered | **switch** | game revealed |
|---|---|---|---|---|
| LBD 1 | 9ms | 168ms | **750ms** | 2273ms |
| LBD 2 | 266ms | 961ms | **1209ms** | 2587ms |

### The premise that had to be proved first

Requesting fullscreen ~1.2s after the tap is only legal if the gesture still counts.
It does — Chromium's transient activation lasts ~5s — and it was measured rather
than assumed: the switch is granted at 1209ms in LBD 2. Had that failed, the whole
approach would have been dead, so it was the first thing checked.

### Hooked without touching either game's logic

- **LBD 2** — `splashTransition`'s timeline calls `midFn` at the top, once the juice
  splat has scaled to 3.8 and swallowed the screen. `midFn` is where `game.js` sets
  `#title-screen` to `display: none`, so **that mutation IS the covered moment** —
  a MutationObserver on it fires the switch. `game.js` is untouched.
- **LBD 1** — had no transition on Play at all (`leaveTitle` hid the title outright:
  "no shutter — go straight into the game"). But it already owns the pink juice wipe
  it uses between the tutorial and the customers, so that is reused rather than
  inventing one, with the timing read from the game's **own `TRANS` table**
  (`TRANS.BURST + 30`) so the two cannot drift apart.

**⚠ Design change to flag:** LBD 1 now has an opening wipe it did not have before.
That is the only way to hide a switch in a game with nothing to hide it behind. The
handler carries a one-line revert in a comment (`start();`) if the instant start is
preferred.

### Checked where fullscreen is refused

The wipe now gates the start, so a refusal must not strand anyone. In the book on
`file://` (`fullscreenEnabled: false`) both games still start — LBD 1 at 790ms, LBD 2
at 1195ms, i.e. on the wipe's own schedule, with the switch simply not happening.
Nothing waits on a permission that is never coming.

Also fixed a probe that lied: it reported "game revealed" at 114ms, before the splash
had even started, because `#splash` begins at `display: none` and the check did not
require having seen it *on* first. Gating it on that produced the real 2587ms.

`git status LBD` shows only the two intended `index.html` changes. Read-through clean.

---

## 2026-08-11 — fullscreen now happens BEFORE the game's opening beat

Author: tapping Play started the transition and *then* went fullscreen, so the
transition was unnoticeable. Correct — the fullscreen switch resizes the viewport,
and it was landing on top of an animation that had already begun. Reordered: ask
for fullscreen, let it settle, *then* start the game.

One correction to the report worth recording: the author said LBD 1, but LBD 1's
`leaveTitle()` hides the title instantly ("no shutter — go straight into the game")
— it is **LBD 2** that runs `splashTransition()` on Play. Rather than guess which
was meant, both were fixed; the reasoning is identical either way.

### Two different fixes, because the two games start differently

- **LBD 1** — `leaveTitle()` fired from an inline `onclick`, i.e. immediately, with
  no delay to hide behind. Removed the inline handler and sequenced it: request
  fullscreen, start on `fullscreenchange`, with `start()` idempotent (and
  `leaveTitle` already guards on `titleDone`, so a race is harmless).
- **LBD 2** — `game.js` already spends 0.12s squashing the button and a 0.25s
  `delayedCall` before `splashTransition()`. That is enough runway, so nothing in
  `game.js` was touched: the request just moved from `click` to **`pointerdown`**,
  one event earlier. `pointerdown` is activation-triggering, so it still satisfies
  the gesture requirement. The `click` listener stays for keyboard starts, which
  produce no `pointerdown`.

Measured over HTTP, where fullscreen actually works:

| | fullscreen at | opening beat at |
|---|---|---|
| LBD 1 | 20ms | title hidden **92ms** |
| LBD 2 | 47ms | splash visible **252ms** |

So in both the resize is finished before the reader is shown anything.

### The regression risk, checked rather than assumed

Waiting for fullscreen could have left the reader on a dead title screen wherever
it is refused — which is exactly the case inside the book on `file://`. It does not:
`requestFullscreen()` **rejects immediately** there, `p.catch(start)` fires, and the
game starts at **18ms**. The 400ms cap is insurance that never bites in practice.
Standalone on `file://` the game gets real fullscreen anyway (a top-level document
is allowed — only the iframe is refused), starting at 45ms.

A test file was briefly written into `LBD/Glass half full LBD 2/` by a `cd` that ran
inside a backgrounded subshell. Deleted; `git status LBD` now shows only the two
intended `index.html` changes. Worth remembering that `cd X && cmd &` backgrounds
the whole compound, so the parent shell never changes directory.

Read-through clean; both games still load lazily and unload on leaving.

---

## 2026-08-11 — the Play button has a real click sound

Author added `sfx/play click (1).mp3`. It now plays when the Play button is tapped,
replacing the synthesized pop that stood in for it.

Wired as a **story option**, next to the button it belongs to, so `engine/` stays
story-agnostic like `playButton` / `playAt`:

    playSound: "sfx/play click (1).mp3",
    playSoundSkip: 0.1,

Fired from inside `openBook()`, not the button's own handler, so **every route in
gets it** — the button, a tap on the catcher inside the hit-circle, and Enter/Space
on the focused button. Verified the catcher route too, not just the obvious one.

### Two things measurement decided, rather than taste

- **`playSoundSkip: 0.1`.** The recording has **100ms of silence before its
  transient** (measured). Played from 0 the button would feel 100ms late however
  fast the code is — the same problem the engine's Web Audio path already solves
  with a per-sound `offset`. Verified it now starts at `currentTime 0.1` and runs
  on to 0.98s, so it is really sounding rather than stalled.
- **Volume 0.4.** The file is normalised to **peak 1.0**, where the cover-flip
  beside it is peak 0.46 played at 0.35 — an effective 0.16. At full volume this
  would have been roughly six times its neighbour. 0.4 matches the perceived weight
  of the synthesized pop it replaces, which was rendered peak 0.39.

An `<audio>` element rather than the engine's Web Audio path on purpose: that one
reads from the base64 in `engine/sfx-data.js`, which is for engine sounds, and this
is the story's.

**The pop is now the fallback, not dead code.** If the file cannot play the
`play()` rejection fires it, so the press is never silent. Tested by aborting the
request: the pop fired (1 oscillator) and the book still opened. When the file does
play, the pop does **not** double up — verified 0 oscillators.

All of this under the **real autoplay policy** (no `--autoplay-policy` override),
because the click is the first sound of the session and overriding the policy is
exactly what hides that class of failure.

Read-through clean; 28 asset references resolve case-exact.

Minor: the filename still carries a browser's download suffix — `play click (1).mp3`.
Renaming it means one matching edit to `playSound` in story.js.

---

## 2026-08-11 — the background music is gone

Author: remove the background music. Read as the BOOK's `music:` track — the thing
story.js and the engine both call "background music" (`bgMusic`, `playBgMusic`) —
not the games' own audio, which is untouched. It is also the file that vanished from
the working tree three times while `story.js` still pointed at it, which now reads
as the author having wanted it gone all along.

- `story.js`'s `music:` line removed (kept as a commented one-liner to restore it).
- `sfx/BG Music.mp3` deleted — 9.35MB, tracked, so recoverable from git. Deployable
  payload: **86MB → 78MB**.

### A latent trap the removal would have sprung

`bgMusic` was built unconditionally:

    const bgMusic = new Audio(STORY.music ? encodeURI(STORY.music) : "");

An **empty src resolves to the document's own URL**, so a deliberately silent book
would have had the browser fetch `index.html` and try to decode the HTML as audio —
a media error and a junk request on every load. It never showed while `music:` was
set, and would have appeared the moment it wasn't. `bgMusic` is now `null` when
there is no music, with all five uses guarded (`playBgMusic`, `duckMusic`,
`closeBookToCover`, and the two visibility-change handlers). `duckMusic` also now
guards on `bgMusic` rather than `STORY.music`, so the two can never disagree.

Verified with a silent book: **no music element created, nothing requests
index.html as audio, no failed requests, no page errors** — and every other sound
still present (`Page flip`, `cover page flip`, `pour.wav`, `glass-full.wav`, the
pour prompt). Page turns, which call `duckMusic` on every arrival and on the game
pages, throw nothing. The pour page's own narration and sticker pops are unchanged
(`660→210@0.4` for the button, `520→160@0.5` for the stickers). 27 asset references
resolve case-exact; read-through reaches THE END with only game 1's own missing
`ready set serve.ogg`.

Note: the games keep their own soundtracks. `duckMusic` is still called when a game
takes the page — now a no-op, harmless, and correct again the moment music returns.

---

## 2026-08-11 — tapping Play in a game takes it FULLSCREEN

Author: in the LBD games, tapping Play should open the game fullscreen. A book page
is a small window for a game, especially a drag-and-drop one.

**The request has to come from inside the game.** `requestFullscreen()` needs the
user gesture in the document that calls it, and a click inside the iframe never
reaches the book — the same isolation that stops the book stealing the game's
drags. So the book grants the permission and each game asks.

- Book side: the iframe gets `allow="autoplay; fullscreen"` plus the legacy
  `allowfullscreen`.
- Game side: a **separate** click listener on each Play button — `#playBtn` in
  LBD 1, `#play-btn` in LBD 2 — requesting fullscreen on its own
  `documentElement`, with the promise rejection swallowed. Deliberately separate
  so neither game's own handler is touched: if fullscreen is refused, the game
  starts exactly as before. Verified both still start.

### The check that mattered, and what it found

`document.fullscreenEnabled` inside the frame is the one thing that fails silently.
On `file://` it came back **false** — and my first instinct, that fullscreen is
simply blocked for `file://` pages, was wrong: the **top** document there reports
`true`. It is specifically the *iframe*, which on `file://` gets an opaque origin
that Chromium will not delegate the permission to.

Re-tested over HTTP, which is how the book actually ships — a throwaway static
server on 127.0.0.1:

| | top document | inside the game frame | real Play tap |
|---|---|---|---|
| `file://` | `true` | **`false`** | no transition |
| `http://` | `true` | **`true`** | `fullscreenchange` fired, `fullscreenElement = HTML` |

So **hosted, it works end to end**. Double-clicked from disk it does not, because
the browser will not give a `file://` iframe the permission — the game just starts
windowed, which is why the rejection is caught rather than reported.

Worth noting how nearly this shipped as "done": a stubbed `requestFullscreen` proved
only that the call was *made*, and it happily passed while the browser was refusing
it. Checking the permission and the `fullscreenchange` event is what separated
"asked" from "happened".

If fullscreen in the double-clicked case ever matters, the alternative is a
`postMessage` from the game on start and the book CSS-expanding the iframe to the
viewport — no permission needed, works on `file://`, but it is not true fullscreen.

Read-through clean; the only error remains game 1's own missing
`ready set serve.ogg`.

---

## 2026-08-11 — the games' 404 fixed: they were never committed

Author: the games 404. Confirmed the cause in one command rather than guessing —
what commit `41e0986` actually recorded for `LBD/`:

    160000 commit 8ef2a017…	LBD/Glass half full LBD 1
    160000 commit a9b58fd1…	LBD/Glass half full LBD 2

**Two entries, mode 160000 — gitlinks, not files.** Each game carried its own
`.git`, so `git add` staged a *pointer* to a repo the book does not contain. Locally
the folders are on disk and the games play; a clone or a Vercel build gets two
**empty** folders, so both iframes 404. That is the whole bug: nothing to do with
paths, names or the engine.

Fix: removed the two nested `.git` directories and re-staged. `git ls-files -s LBD`
is now **144 entries, all mode 100644** — no gitlinks — and both
`…/index.html` files are tracked, so a deploy carries the games.

Re-checked before deleting anything, not after: both repos were **fully pushed**
(HEAD == origin/main, 0 dirty, 0 unpushed) to
`yuvrajsingh-alt/THE-GLASS-HALF-FULL` and `harshvishnu4-cpu/Glass-Half-full-LBD-2-`,
so their history survives on those remotes. The `.gitignore` note now records this
as history plus the rule: **if a game folder is ever re-cloned in here, delete its
`.git` again.**

Size, as a side effect of dropping 154MB of nested git history: **398MB → 212MB**,
and the deployable payload (excluding this repo's own `.git`) is **86MB**, with
`LBD/` down from 203MB to 11MB.

### The other 404 risk, audited: there isn't one

Spaces in `LBD/Glass half full LBD 1/…` were the obvious suspect and are **not** the
problem — the src is `encodeURI`d and the games load. The real hosting hazard would
have been **case**: a reference that works on Windows and 404s on Linux. Audited
every asset reference inside both games, segment by segment against the real
directory listings:

- LBD 1 — 7 refs fine, **0 case mismatches**
- LBD 2 — 55 refs fine, **0 case mismatches**; the game's runtime specifically
  (`index.html` + `js/` + `css/`) is **101 refs, 0 missing**

The "missing" ones the audit first printed were both false positives worth knowing:
`splash.svg` is really `new assets/splash.svg` (the regex clipped at the space), and
LBD 2's are all in `tools/e2e*.js` — dev scripts that *write* those screenshots
rather than read them.

### One thing left undone

Renaming the folders to space-free paths (`LBD/lbd-1`, `LBD/lbd-2`) is blocked:
both `mv` and `Rename-Item` fail with *Access denied* because stray `msedge`
processes from this session's own test runs still hold the directories. It is
**cosmetic only** — the 404 is fixed and spaces work — and killing those processes
could close the author's own browser windows, so it was left alone. When nothing has
the folder open:

    mv "LBD/Glass half full LBD 1" LBD/lbd-1 && mv "LBD/Glass half full LBD 2" LBD/lbd-2
    # then update the two `src:` paths in story.js

Verified after the fix: 144 real files staged, both games still load lazily and
unload on leaving, 28 book asset references resolve case-exact, and the read-through
reaches THE END. The only remaining error is game 1's own missing
`ready set serve.ogg`.

---

## 2026-08-11 — dead code out, 42MB out, nothing changed on screen

Author: remove the dead code and take roughly 10MB off, without changing the game
or the book. **Saved 42MB** (398MB → 356MB; the deployable payload, ignoring every
`.git`, is now **86MB**), with no visual or behavioural change — verified.

### Where the size went (nothing the game or book loads at runtime)

| removed | size | why it is safe |
|---|---|---|
| `LBD 2/node_modules/` | 28MB | **game 2's own `.gitignore` excludes it** ("reinstall with: npm i") and `git ls-files` shows 0 tracked. Runtime uses the vendored `js/vendor/gsap.min.js`. |
| `LBD 2/tools/e2e-shots/` | 13MB | also gitignored by game 2, 0 tracked — generated test screenshots, regenerated by `tools/e2e.js`. |
| `sfx/Book drop.mp3` + `book-drop.wav` | 390KB | unreferenced since the thud was removed. |
| `assets/audios/page 5 part 2.wav` | 506KB | unreferenced since that scene went back to video. |
| `assets/wish button.svg` | 11KB | unreferenced since the new play button. |
| `assets/bats.svg` | 73KB | leftover from the removed bat transition. |
| `engine/Button.svg`, `assets/pages/pour/glass.svg` | 9KB | unreferenced — the pour glass is inline SVG paths in script.js. |
| `__MACOSX` / `._*` resource forks | — | macOS junk. |

Everything in the book's own list is **tracked**, so each deletion is recoverable
from git history; the two LBD folders' bulk was never in any repo at all.

**Kept on purpose:** `sfx/pour.ogg` and the glass-full `.ogg` (148KB) — story.js
documents the `.wav` files as "wav twins of the .ogg sources", so these are the
sources, not duplicates. And `assets/table.png` (2.1MB), which is the editable
source for `table.webp`; the book never loads it.

### Dead code

The real find was that there is very little. What went:

- **story.js's inert `STORY_STORYBOARD` block** — 128 lines of commented-out code
  the file itself said to delete once the video book was final. story.js is 20.6KB
  → 14.3KB, and still parses to 13 pages.
- Three stale header claims in story.js, all made wrong by this session's work:
  the nudge "appears 2s later" (it now arrives *with* the arrow), no mention of the
  two game pages, and no mention of the `game` / `iris` page options. Documented.
- The index.html note about the drop recordings, which now pointed at deleted files.

### Two dead-code scans that were worthless — and how I knew

Recording these because both looked authoritative:

- A **CSS orphan scan** flagged `.fx-scan` as unused. It is not: `makeFx` builds
  the class by concatenation (`"fx-" + cfg.type`), so it is reachable through the
  documented `fx: "scan"` option. A scan that only sees literal class names cannot
  see a class that is assembled at runtime.
- A **JS dead-function scan** reported **105** never-called functions including
  `openBook`, `fitScale`, `goNext` and `dialogueDone`, and 81 never-read bindings
  including `STORY`, `leaves` and `flipped`. Obvious nonsense — the comment-stripping
  regex had eaten large blocks of the file. Discarded rather than acted on. The
  lesson: when a "dead code" tool says the entry point is dead, the tool is dead.
  Individual candidates were then checked against real call sites instead
  (`sc.layers` / `_sceneSound`: 0 occurrences, so that support was already reverted
  away; `makeSpeechBubble`: reachable from `makeBubble`, so template code, not dead).
- The unreferenced-**file** scan had the same blind spot: it listed all 15 posters as
  unused, because the engine derives their paths (`page.src.replace(…)`). Confirmed
  live before touching them.

Verified after: 28 asset references resolve case-exact, cover and page 1 render with
**zero failed requests and no page errors**, still 13 pages, both games still load
lazily / unload on leaving, and the read-through reaches THE END. The one remaining
error is game 1's own missing `ready set serve.ogg`, unchanged.

---

## 2026-08-11 — the two LBD games are pages in the book

Author: the `LBD/` folder holds two games; game 1 goes after page 8, game 2 after
page 9. The book is now **13 pages**: `…7, 8, GAME 1, 9, GAME 2, 10, THE END`.

### A new `game` page type

    { type: "game", title: "Pour the juice — game",
      src: "LBD/Glass half full LBD 1/index.html" }

Each game is a whole self-contained app (LBD 1 is one 252KB inline index.html;
LBD 2 has `css/`, `js/` and a vendored `js/vendor/gsap.min.js`), hosted in an
iframe that fills the leaf.

**An iframe specifically, not inlined script.** Pointer events inside a frame do
not reach the parent document, so the book's drag-to-flip can never steal a drag
— and LBD 2 *is* a drag-and-drop game. Inlining it would have put the two drag
systems in direct competition.

Three consequences that had to be handled rather than discovered later:

- **Lazy.** `src` lives in `data-src` and is only assigned on arrival. Loading two
  games up front would cost megabytes before page one is read. Verified: both
  frames have `src === null` at book load.
- **Unloaded on leaving** (`src = "about:blank"`). The engine cannot pause a
  cross-origin frame — every `file://` document is its own opaque origin — so
  unloading is the only way to stop a game narrating from behind a page that has
  been turned. The cost is that a game restarts if the reader leaves it, which is
  the rule the pour scene already follows. The book's music is ducked while a game
  holds the page.
- **No idle nudge on a game page** (`canShowHint` returns false). Interactions
  inside the frame never reach this document, so the idle timer would never reset
  and the nudge would fire over the game — the ghost peel lifting the very page
  being played on.

**The forward arrow is live the moment a game page lands.** Neither game signals
completion (no `postMessage`, checked), so there is nothing to gate on; arming
immediately means nobody is trapped in a game they cannot finish, at the cost of
letting a reader leave early. If either game later posts a "done" message, that
becomes the gate.

Verified: correct page order, lazy load, game 1's document really loads (its title
reads "Ready Set Serve!") and fills 1267×713, leaving sets `about:blank`, game 2
loads on its page, no errors in the host page, and the read-through walks all 13
pages to THE END.

### ⚠ The games will NOT deploy as-is

Both game folders carry their **own `.git`**, so `git add` stages each as an
embedded repository:

    warning: adding embedded git repository: LBD/Glass half full LBD 1

A clone — or a Vercel build — of this repo would contain two **empty** game
folders, and both game pages would come up blank. **Ignoring the nested `.git`
does not fix it** (tested: git decides on the presence of `.git` on disk, not on
ignore rules). The nested repos have to go for the files to be tracked:

    rm -rf "LBD/Glass half full LBD 1/.git" "LBD/Glass half full LBD 2/.git"

Checked before suggesting that, rather than after: both are **fully pushed** —
`HEAD == origin/main`, no uncommitted files, no unpushed commits — to
`yuvrajsingh-alt/THE-GLASS-HALF-FULL` and `harshvishnu4-cpu/Glass-Half-full-LBD-2-`,
so the history survives on those remotes and either folder can be re-cloned. Left
for the author to run: they are their repos.

Added a `.gitignore` for `LBD/*/node_modules/` (28MB, dev-only — neither game
loads it at runtime) with that warning written out in full. Removing the two
nested `.git`s plus node_modules takes the book's LBD payload from **204MB to
about 22MB**.

### A pre-existing bug inside game 1

`ready set serve.ogg` is referenced by `LBD/Glass half full LBD 1/index.html` but
**does not exist** anywhere in that folder — there is no such file and no `.m4a`
twin, while every other sound in `sxf/` has both. It only became visible now
because the book loads the game; the read-through reports
`load fail: ready set serve.ogg`. It is game 1's own asset to add or de-reference.

---

## 2026-08-11 — the arrow and the hand now guide together

Author: the arrow and hand nudge are not in sync; on completion they should come
together. Measured before touching anything, on page 1:

    12675ms  clip ENDED
    12684ms  → arrow-visible, blink1     (  9ms after the clip)
    14728ms  → arrow-visible, blink, hand (2053ms after the clip)
    → GAP 2044ms

So there were **two separate guidance cues**: the arrow fired its own 2s one-shot
(`.blink1`) 9ms after the clip ended, and the nudge — hand + arrow glow + ghost
peel — only arrived two seconds later. The earlier sync work put the *nudge's*
three parts on one beat, which they still are; it never touched this, because the
clash is between the nudge and a cue that runs before it.

**`.blink1` is gone.** Page completion now fires exactly one thing: `dialogueDone`
schedules the whole nudge, so the arrow's glow, the hand and the peel all start in
the same tick. Removed with it: the `armBlink` "one blink per arrival" flag it
existed to gate, the `arrowBlink1` keyframes, and the `remove("blink1")` that
`triggerHint` needed because `.blink1` outranked `.blink` in the cascade — a whole
little subsystem that only existed to manage a second cue.

**One breath became two, because they are different questions:**

- `CUE_AFTER_DONE_MS` **700ms** — the page has finished and the reader is asking
  "what now?", so the answer should be prompt. (Was 2000ms.)
- `CUE_AFTER_TOUCH_MS` **2500ms** — after the reader touches something, nudging
  again 0.7s later would be pestering. This path used to inherit the same constant
  (`+ 500`), and collapsing them to one number would have made the re-nudge feel
  like nagging.

Verified: the gap is **0ms** — arrow, hand and peel all start at the same
millisecond (0ms spread across all three), 730ms after the clip ends. They remain
in phase within their shared 1.5s beat (hand holds furthest-left 641–1143ms, arrow
holds full glow 690–1116ms, midpoints 11ms apart, one flare per swipe). After a
touch the nudge waits 2574ms. Reduced motion still silences it. Read-through clean.

### `sfx/BG Music.mp3` disappeared for the THIRD time

Deleted again from the working tree (folder mtime minutes old) while `story.js`
still references it, so the book logged `load fail: BG Music.mp3` and played
silent. Restored from git again — but three times in two days is a pattern, not an
accident. If the 9.4MB file is being cleaned up deliberately, the fix is to drop
the `music:` line in story.js rather than leave a reference to a file that is not
there; if it is not deliberate, something in the workflow is removing it.

---

## 2026-08-10 — the book-drop thud is gone

Author: remove the book drop sound. The whole `<script>` at the bottom of `<body>`
is gone, so the landing is silent.

**Only the sound went.** The drop itself is untouched — `bookDrop` still runs its
1150ms, the dust burst still fires at the landing, and the load gate still opens.
Verified by instrumenting the `Audio` constructor: after load *and* after opening,
the elements created are `pour.wav`, the pour prompt, `glass-full.wav`,
`BG Music.mp3`, `Page flip.mp3` and `cover page flip.mp3` — **no drop**, and
nothing requests the file at all. The asset audit is down from 29 references to 28,
which is the one that left.

**The recordings stay in `sfx/`** — `book-drop.wav` and the nine-take
`Book drop.mp3` it was cut from. They are now unreferenced, but this effect has
already been added, tuned, diagnosed and restored once across this project, so
deleting the audio would be the expensive half of the decision to reverse. Say the
word and they go.

Two stale comments fixed rather than left to mislead:

- The `<head>` scene-override block said "to go back to the starlit night delete
  **THREE** things … and the drop-sfx `<script>` at the bottom of `<body>`". That
  script no longer exists, so it now says TWO and notes what happened to the third.
- Where the script was, a short note records what it did (an `<audio>` element at
  volume 0.55 on a 760ms timer matching the landing frame, skipped under
  `prefers-reduced-motion`) so restoring it does not need re-deriving.

Read-through clean, `errors: (none)`.

---

## 2026-08-10 — an IRIS closes the story on the glass

Author: make the ending better — as the clip zooms into the glass, go to black with
a circle focusing on it. New page-level option:

    iris: { at: 12600, x: "49%", y: "49%", size: "40%" }

on page 10, the last story page. The page darkens to black except a circle that
closes onto the glass and **holds it spotlit** until the reader turns to THE END.

### How it is built

The black is a **2000px box-shadow spread on the circle itself**, so one
`transform: scale()` animates the entire iris on the compositor — no mask, no
`@property`, and the hole stays a true circle at any book scale. The spread is in
book px rather than `vmax` because this layer lives inside the scaled book, where
viewport units would not track it (1280×720 means 2000px covers every corner).
`aspect-ratio: 1` keeps it circular while the width is a % of the page.

**Aimed by measurement, not by eye.** Tracking the juice's pink centroid through
the closing frames of `Page 10.mp4`: it settles at **49.24% / 49.25%**, with the
glass about 23% wide and 56% tall — hence `x/y 49%` and a 40%-of-width diameter,
which frames the glass with a margin. (The pink *bounding box* was useless here —
stray juice specks spread it across most of the frame; the centroid was the stable
signal.)

**Timed off the clip's own clock**, via `timeupdate`, not a timer from page
arrival — since the turn-hold change playback begins when the page lands, so a
timer would drift from the picture. `at` defaults to 2.4s before the clip ends when
omitted. Using `classList.toggle(…, currentTime >= at)` rather than `add` makes it
**self-resetting**: a revisit replays the clip from 0, which is below `at`, so the
iris re-opens with no teardown code at all. Verified — after going back and
returning, `closing=false` at clip time 1.81s.

### Checked

Closes at **12.74s** of the 15.02s clip (configured 12.6s) and never during the
earlier part; `pointer-events: none` so it can never eat a tap; `z-index: 4`, over
the art and under the curl. The turn cue still arms with the iris closed, and the
forward arrow stays at 0.92 opacity because the arrows live *outside* the book —
the darkness cannot hide the way out. Reduced motion keeps the framing but drops
the travel (`transition-duration: 0s`). Read-through clean, `errors: (none)`.

---

## 2026-08-10 — new Page 2 export: audio only, nothing to change

Author replaced `Page 2.mp4`. It came in already committed, swept into `d3aafd8`
alongside the pour-hand change, at the **same byte size** (5500730 → 5500730) but a
different hash (`50dc61fe…` → `54698f20…`) — so size alone would have missed it
entirely. Compared against `d3aafd8^`:

- **Picture identical** at all 17 sampled frames; 1920×1080 both.
- **Duration identical**: 17.441s. `story.js`'s `// 17s` still right.
- **Audio re-recorded over the first two lines.** Window-by-window PCM shows the
  change confined to **0.5s → 9s**; from 9.5s to the end it is bit-identical
  (diff rms exactly 0). Same 48kHz stereo, speech still 0.5s → ~17.05s, and the
  overall level unchanged (mean rms change −0.0003, peak 0.2445 vs 0.2683).
  Within the changed stretch a line has clearly MOVED, not just been re-read:
  at 5.0s the new take has sound where the old was silent, and at 6.0s it is
  near-silent where the old was speaking.
- **Poster still matches frame 0** (0.8%, inside the usual 0.56–1.2% webp band).
- Filename casing intact — git reports it as *modified*, not delete + add.

Nothing needed retiming: Page 2 is a plain `{ type: "video" }` page whose turn cue
arms on `ended`. Read-through clean, `errors: (none)`.

### The static checker had two blind spots — both now fixed

Worth recording because the first one already let a real bug through once:

- It matched only `url()`, `src=` and `href=`, so **`new Audio("…")` was invisible**
  — exactly how the missing `sfx/book-drop.wav` slipped past it while every load
  logged `ERR_FILE_NOT_FOUND`. Widened; the count went 26 → 29 references.
- With that widened, it immediately reported `sfx/Page%20flip.mp3` and
  `sfx/cover%20page%20flip.mp3` as MISSING. They are not: those references are
  **percent-encoded in the source** and the filesystem has the decoded names. The
  check now decodes before testing existence and before the per-segment case
  comparison. A checker that cries wolf is worse than no checker.

---

## 2026-08-10 — the POUR hand moved down and grew

Author, with a screenshot: the hand covers the button, so "POUR" reads as "P**R".
It did. Measured against the page:

| | before | after |
|---|---|---|
| hand width | 38.08px (34%) | **53.75px (48%)** — +41% |
| hand spans | y 50.93 – 57.56% | **y 56.19 – 65.55%** |
| overlap with the button | 6.63% = **63% of its height** | 2.73% = **26%** |

The button spans y 48.39–58.92% with its label in the middle band, so anything
above ~54% sits on the word. The hand is positioned by a translate expressed in
its OWN height, which makes the move arithmetic rather than guesswork:
`handTop = spotCentre + translateY × handHeight`. Checked against the old numbers
(53.85 − 0.44 × 6.63 = 50.93 ✓), then solved for a top of ~56%: **translateY goes
from −44%/−56% to +25%/+13%**, keeping the original 12%-of-height press travel.

It gets **its own `pourHandPress` keyframes** rather than editing the shared
`handPressCentred`, which still belongs to the tap-anywhere cue on page 5 — that
one is centred on its target on purpose and must not move.

The reduced-motion override needed changing too: it parked the hand at
`translate(-50%, -50%)`, which after this change would have snapped it back over
the label for exactly the readers who opted out of motion. It now parks at the
animation's resting pose. Verified in both modes — normal 55.5%, reduced 56.19%,
both below the label, and the fingertip still overlaps the disc's lower third at
both keyframes so it still reads as pointing AT the button rather than at the
machine's body. Read-through clean.

One measurement note: a first attempt screenshotted the closed cover, because the
pour layer exists in the DOM from load but is behind the cover — the crop was
computed from an element that is not on screen. The numbers were fine (they are in
the layer's own coordinates); only the picture was wrong. And an "is it bigger"
assertion compared px across two different render contexts and reported a false
failure; the honest comparison is same-context, 38.08 → 53.75px.

---

## 2026-08-10 — the load glitch: the book flashed at HALF SIZE

Author: "there is a glitch when the flipbook loads." There was, and it is fixed —
but three plausible-looking diagnoses had to be **disproved** first, which is the
real lesson of this entry.

### The actual bug

`.flip-scale` is a fixed 1280×720 layer scaled to fit:
`transform: … scale(var(--book-scale, 0.5))`. `fitScale()` sets `--book-scale`
when `engine/script.js` runs, at the end of `<body>` — so until then the CSS
**fallback of 0.5** applies.

Recording the load at 1280×720 and measuring the book's painted width in every
composited frame: **7 consecutive frames at 756px, then a jump to 1272px at
231ms.** A ~68% size snap, on screen for about a fifth of a second, right on top of
the drop — which is exactly why it reads as a glitch rather than as a resize.

Fixed by never letting that fallback paint. In `<head>` (it has to be there — a
rule arriving with a stylesheet lower down is already too late for the first paint):

    html:not(.book-fitted) #flipScale { visibility: hidden }
    html:not(.book-fitted) #bookPop   { animation-play-state: paused }

and `fitScale()` adds `book-fitted` on its first run. The drop is *paused* as well
as hidden, so it plays in full rather than starting behind a hidden book and
appearing mid-fall. `engine/script.js` runs before the inline drop-sfx script, so
the thud's 760ms timer still lines up — verified: the impact squash still peaks at
~760ms. Plus a 1500ms head-script safety net, because a blank desk would be a worse
failure than a mis-sized book: with `engine/script.js` blocked entirely the book
still appears.

After: **0 frames narrower than 820px** (was 7). Gate opens on all six sizes
(scale 1.2 → 0.3472), read-through clean.

### Two other head changes, made for robustness rather than for this bug

- **`html{background:#241137}`** inline and before every stylesheet. `html` had no
  background of its own, so the canvas colour depended on propagation from `body`
  once the big stylesheet had parsed.
- **The Google Fonts stylesheet is now non-blocking** (`media="print"` +
  `onload` swap, `<noscript>` fallback). It sat ABOVE `engine/styles.css` in the
  head, so the first paint was gated on a network round trip — wrong for a book
  meant to work when index.html is double-clicked. Verified the book still paints
  with `fonts.googleapis.com` hanging, and that the swap really fires: the link
  ends at `media="all"`, its sheet applies, and Fredoka + Patrick Hand load.

### Three wrong diagnoses, and why each one fooled me

Worth keeping, because each looked convincing and two were *my instruments*:

- **"The book falls before its cover art arrives."** The marks said
  `bookDrop animation begins` at 31ms and `cover url set` at 488ms. Wrong
  comparison: the first mark fires when the animation OBJECT exists, not when its
  clock starts. Sampling the animation's own `currentTime` showed the art is
  present at **0–2% of the fall**, with **0** blank-cover frames.
- **"A white flash for 1.5s."** A video recording showed 19 white frames. That is
  Playwright's own `about:blank` **pre-roll** — `recordVideo` starts when the
  context is created, before `goto`. I then "A/B tested" the fix with
  `page.screenshot()`, which **awaits a paint** and therefore can never capture a
  pre-paint frame; it reported 0/3 white both with and without the fix, proving
  nothing either way.
- **"The book is off-centre."** `.book-frame`'s rect is 5–13px asymmetric — but
  that is the page block and lip sticking out on the right, not the book. A
  pixel scan then said 42px off at 1920×1080, which was the desk's own candle and
  spellbooks being counted as book pixels. Diffing the page against itself with
  the book hidden — a mask that is *only* the book — gives margins equal to
  **within 1px on all six sizes.**

The through-line: **a computed value is not a composited pixel.** Every honest
answer here came from measuring what was actually painted — the recorded frames for
the snap, the animation's own clock for the drop, a hide-and-diff mask for the
centring.

---

## 2026-08-10 — a pop on the Play button, and a full read-through

### The pop

The engine already had a synthesized pop (`playPopSfx`, a sine blip) for the pour
page's sticker reveals. The Play button now fires it too, from **inside
`openBook()`** rather than the button's own click handler — that way every route in
gets it: the button, a tap on the tap-catcher inside the hit-circle, and
Enter/Space on the focused button all arrive through `openBook()`.

`playPopSfx` gained an optional `opts` so a caller can shift its character without
touching the defaults. The button uses **660→210Hz at 0.4** against the sticker's
520→160Hz at 0.5 — brighter, so a press does not sound like a sticker landing, and
quieter, so it does not bury the cover swoosh that follows it a moment later.
Rendered offline to check rather than guessed: button peak 0.39 / rms 0.0392,
sticker peak 0.4778 / rms 0.0484.

**The real find was a suspended-clock bug.** `resume()` is asynchronous, and a
suspended AudioContext has a FROZEN clock — so scheduling the envelope against
`currentTime` inside the same gesture put the whole pop behind a clock that had not
started. Instrumenting `createOscillator` showed `ctxStateAtStart: "suspended"` on
the very first press, which is the one press that matters: the button's pop is the
first sound of the session. Now it resumes first and schedules in the promise
callback; the same probe reports `running`. Tested under the REAL autoplay policy
(no `--autoplay-policy` override), because overriding it is what makes this class
of bug invisible. The sticker pops take the fast synchronous path — verified still
firing `520→160@0.5`, twice, on the pour reward.

### The read-through — one real bug

Read all 11 pages as a reader, capturing 30 frames and checking each for blank,
flat or near-black output, plus console errors, failed requests and every cue.

**Bug found and fixed: `sfx/book-drop.wav` and `sfx/Book drop.mp3` had been deleted**
(the sfx folder's mtime was minutes old) while `index.html:328` still loads the wav
— so the book-drop thud was silent and every single load logged
`net::ERR_FILE_NOT_FOUND`. Restored from HEAD; the thud now reports
`readyState 4, dur 0.78s, err null` and a plain load has **zero failed requests**.

That one slipped past my own audit, so the audit is fixed too: it only matched
`url()`, `src=` and `href=`, and this reference is **`new Audio("sfx/book-drop.wav")`**.
Now 29 references are checked instead of 26.

Everything else was clean: all 11 pages render correctly, no blank/black frames,
the page-5 tap and the 4-tap pour both work, the pour reward lands with "Full" +
the pointer, page 8 shows the fixed caption, THE END renders with "Read again", and
replay returns to the closed cover with the Play button back.

### Three findings that were my instruments, not the book

Recording these because each looked like a serious bug for a while:

- **"the cover art did not load"** — `.cover-img` is a **DIV with a
  background-image** set inline by script.js, not an `<img>`, so `.complete` and
  `.src` were meaningless. It is fine: inline `url("assets/Cover%20page.jpg")`,
  decoding at 1920×1080.
- **`ERR_FILE_NOT_FOUND` on eight clips** — the console showed one generic
  message and my probe grouped it with eight `requestfailed` entries for
  `Page 3..10.mp4`. Logging the full URL and failure text showed all eight are
  **`net::ERR_ABORTED`**: the browser cancelling media fetches when the engine
  pauses every non-current clip. Benign and expected. Only `book-drop.wav` was a
  real `FILE_NOT_FOUND`. My probe even printed "on disk? YES — so the URL is
  malformed", which is a wrong inference baked into a test: aborted ≠ malformed.
- **"no page media found to sample" on every page** — the selector was scoped
  under `.book-frame` and matched `.page-scene.on` across the whole document, so it
  picked scenes off leaves that were not in front. The front page is the first
  `.leaf:not(.flipped)`. (Two of those warnings survive and are correct: THE END
  has no media to sample.)

### For the author to decide

- **`dev/dev-menu.js` is still loaded** (index.html:343) and its hamburger renders
  at 44×44 in the top-left of every screen, cover included — it is in all 30
  captured frames. It was built to be deleted when the book is done. Left in place
  because the book is clearly still being authored and the menu is the page-jump
  tool for that; deleting is one line when you are finished.
- **Unused assets:** `assets/wish button.svg` and `assets/audios/page 5 part 2.wav`
  are now referenced by nothing (0 files).
- **`Page 4.mp4`** is still the pre-08-10 export; the re-recorded narration you
  committed is in Downloads as `Page 4 (2).mp4`. Identical picture and duration.

---

## 2026-08-10 — a "press me" effect on the Play button

Author: "add some special effect on play button." Three parts, all pure CSS, no
markup and no JS:

| part | what it does |
|---|---|
| `.play-btn::before` | a gold halo ripple pushing outward — "tap here" |
| `.play-btn::after` | five sparks that twinkle on the beat while slowly orbiting (14s) |
| `.play-art` | a candle-warm glow swelling with the breath |

**All of it runs on the existing `playBreathe` 2.6s beat**, not on periods of its
own. That is the lesson the page-turn cue taught earlier today: three effects on
three periods read as three things happening at once, while one shared period
reads as a single living object. Verified in the browser — every beat-driven part
reports `2600ms` and all four sit within **0ms** of each other in their cycles.
(The orbit is deliberately off-beat at 14s: a slow drift, not a pulse.)

Details that mattered:

- **The pseudo-elements MUST be `position: absolute`.** `.play-btn` is
  `display: grid`, and a static pseudo-element becomes a grid ITEM — it would have
  shoved the artwork out of the centre. Checked: the art still measures the full
  170×170 inside a 170×170 button.
- **`pointer-events: none` on both**, and the tap target is untouched at 170×170 —
  the effect can never eat the tap that opens the book.
- **Every keyframe repeats `translate(-50%, -50%)`.** The pseudo-elements are
  centred by their own transform, so a keyframe that sets only `scale()` or
  `rotate()` drops the centring and the ring flies to the corner. The same trap
  the existing `playBreathe` comment warns about.
- **The glow lives in the keyframes with the cast shadow.** Animating `filter`
  replaces the whole property, so the original
  `drop-shadow(0 9px 14px rgba(6,4,26,.55))` is repeated in both stops or the
  button loses the shadow that lifts it off the cover.
- **Pressed state:** `:active` already stops the breath; the halo stops too — once
  the invitation is accepted it should not keep inviting.

**Reduced motion keeps it special without moving.** Everything stops, but the
button holds a steady warm glow, a static halo at 0.45 opacity and the sparks at
0.8 — a reader who asks for less motion should still see the one control on the
cover, not a plain image. That override block sits AFTER the rules it overrides,
for the ordering reason logged in the entry below.

First pass had the sparks at 2.4–3.4px, which at book scale rendered as ~3px dots
and barely read. Bumped ~35% and added a 4px bloom so each spark reads as *light*
rather than a dot, with the twinkle floor raised 0.35 → 0.45.

Verified: five animations running and in phase, no page errors, reduced motion
silences all of them, and — worth checking because the sparkle layer extends to
132% of the button, wider than the art — **the whole effect disappears with the
button when the cover opens**: a pixel crop of exactly where the halo and sparks
lived shows only page 1's artwork afterwards. Read-through clean, `errors: (none)`.

---

## 2026-08-10 — the new Play button (and the engine stopped squashing it)

`assets/play button.svg` — an orange cobweb disc with a white play triangle and
gold sparkles — replaces `assets/wish button.svg` on the cover. Both references
updated, as the swap needs: **`playButton` in story.js** (the authority, read into
`art.src` at load) and **the hard-coded fallback `src` in index.html**, which must
match or the pre-script paint shows the wrong art for a frame.

### It would have shipped visibly distorted

`.play-btn` is a **square** 168px tap target and `.play-art` was
`width:100%; height:100%` with **no `object-fit`** — so the default `fill`
stretches the art to the box. The old button was 210×206 (aspect 1.019), so the
1.9% distortion never showed. **The new one is 214×194 — aspect 1.103** — and would
have been stretched about 10% too tall.

Added **`object-fit: contain`**. The engine's own comment says the button "is
whatever the story's illustrator drew; the engine only places, sizes and animates
it", so reshaping it contradicted the stated contract. Now any aspect works.

Two things checked before making that change rather than after:

- **The tap target does not shrink.** `tapHitsPlay()` measures the BUTTON's
  bounding box, not the art, so letterboxing the image leaves the hit-circle at
  the full 170px. Verified by firing a click on the tap-catcher 6px inside the
  circle's edge on the diagonal — outside the letterboxed art — and the book
  opened.
- **Nothing moved.** Swapping the `src` back and forth in a live page changed the
  button box by `{dl:0, dt:0, dw:0, dh:0}`.

The visible art is now 169.7×153.9 rather than filling 170×170, so the button
reads very slightly shorter than the old one. That is the undistorted shape; if a
bigger button is wanted, `.play-btn`'s 168px is the knob.

### A false failure worth recording

My first check reported the button 2.19% below `playAt` (79.19% vs 77%). It is
exactly right: **`--play-y` is a percentage of the button's OFFSET PARENT**
(`.face.front`), and I had measured against `.cover-img`, a different box. Measured
against the offset parent it is **50% / 77%**, dead on. Always resolve a
percentage against the box the browser resolves it against.

Verified: both references point at the new file, nothing 404s, drawn aspect 1.103
matches the natural 1.103, tap target 170×170, position 50%/77%, still breathing
(`playBreathe`), a hit-circle tap opens the book, and the read-through is clean
with `errors: (none)`. `assets/wish button.svg` is left in place, unused — say the
word and it goes.

---

## 2026-08-10 — the new desk art, and a bug sweep

Author: "I've updated the new table, use it in the book background — and check for
bugs, fix all the bugs."

### The desk

`index.html` paints the body from **`assets/table.webp`**, a webp twin of the
editable `assets/table.png` (the comment there has always said so). The PNG had
been replaced with the new, wider-framed desk — candle, spider and spellbooks now
fully in frame — but **the twin was still the 08-06 file**, so the book was still
showing the old desk. Regenerated it from the new PNG at full 1920×1080.

Quality picked by matching the old twin's weight rather than guessing: 0.72 → 60KB,
0.78 → 74KB, 0.82 → 89KB, **0.88 → 134KB**, and the old twin was 134KB. So the new
desk costs nothing extra (from a 2187KB source). Verified the *painted* background
is 0.42% from the current `table.png` — i.e. webp noise, not the old art.

### Bugs found and fixed

- **`sfx/BG Music.mp3` was missing** and `story.js` still referenced it, so the
  book played silent and every read-through logged `load fail: BG Music.mp3`. It
  had been swept into commit `0928a65` by a `git add -A`. Restored from
  `0928a65^`. The read-through now reports **`errors: (none)`** for the first time
  in this session, and the music is confirmed playing and looping (`paused false`,
  `t 3.48s`, `loop true`, volume 0.06 because narration was ducking it).
- **Reduced motion was ignored for the POUR hint's hand** — a real cascade bug.
  `.pour-scene .pour-hint .scene-tap-hand { animation: handPressCentred … }` is
  declared at line ~1093, while its reduced-motion override sat back at ~1014 with
  the other cue overrides. Both selectors are **three classes**, so specificity is
  a tie and the *later* rule wins: the override silently lost and the hand kept
  nudging for a reader who had asked for less motion. Moved the override to sit
  immediately AFTER the rule, with a comment saying why it must live there.
  This is the same trap logged on 08-07 — the fix then added matching specificity
  but put it in the wrong place in the file. Specificity was never the whole story;
  **order breaks the tie.**
  Checked both directions afterwards, because "disable it" is easy to overdo:
  under `no-preference` the hand still runs `handPressCentred`; under `reduce` its
  `animation-name` is `none` and `getAnimations()` is empty. Same 38.08px width in
  both, so nothing else moved.

### Clean

26 asset references resolve **case-exact** (the check tests each path segment
against the real directory listing — Windows hides mismatches that 404 on Linux
hosting). All 12 clips decode and every poster matches its frame 0 (0.56–1.2%).
`story.js` duration comments match the files. Across 10 viewports from 3440×1440 to
568×320: the book fits, the arrow glyphs clear the book by 3–6px, the back-cover lip
stays 10–46px inside it, no sideways scroll, tap targets 56–124px. Back-navigation
works twice in a row. No page errors anywhere, in any mode.

### A false positive worth remembering

The asset audit first reported `speech_bubble.png` MISSING. It isn't — it is a CSS
`url()`, and **CSS urls resolve relative to the stylesheet**, not the project root,
so `engine/speech_bubble.png` was right there. Fixed the checker to use each
reference's own base directory. Had I reported that as a bug it would have sent the
author looking for a file that exists.

### Still the author's call

`assets/pages/Page 4.mp4` on disk is the pre-08-10 export (`4415648b`); the
re-recorded narration committed in `e9faa33` (`ca3b7fe7`) is in Downloads as
`Page 4 (2).mp4`. Picture and duration are identical, only the audio differs. Not
touched — see the entry below.

---

## 2026-08-10 — page 5 part 2 is the VIDEO again, and two lost filenames

Author: "again add the old page 5 part 2 video in the book." Restored from
**`3a1cb92^`** — the deletion had been *committed*, so `git checkout HEAD --` can't
find the file; it has to come from the parent of the commit that removed it.
`assets/pages/Page 5 part 2.mp4` (876KB) and its poster (41KB) are both back, and
story.js was already pointed at the mp4 again with the original cue at `x 45.2%`,
which is the right number for the clip (the Figma version had centred the machine
at 49.45%; the clip has it at 45.23%).

### What the reverted Figma/composed version left behind

That scene had briefly been built from `background.png` + `machine.png` + a
narration file (Figma node 756:4). It is no longer live. Leftovers, all harmless:

- **`layers` and `sound` in the engine are now unused.** Both are general scene
  options — `layers` places art over a scene's base image at `at:{x,y,w}` in page
  %, `sound` gives a scene its own narration — documented and completely inert
  when no scene sets them. Say the word and they come out.
- **`assets/audios/page 5 part 2.wav` is committed and unused.** Worth keeping: it
  is the only copy of that spoken line outside the mp4, decoded straight from the
  clip's audio track with its time origin intact.
- `background.png` / `machine.png` are deleted from the working tree, which is
  consistent — nothing references them now.

### Two file-name accidents found while doing it

Both have the same cause: re-downloading a file while the original is still there,
so Windows appends " (2)", and then the plain-named one gets deleted.

- **`Page 2.mp4` was MISSING** — story.js pointed at it and page 2 would have been
  blank — while `Page 2 (2).mp4` sat beside it. Renamed back. Zero risk, because
  SHA1 says the "(2)" file is **byte-identical** (`50dc61fe47de5133`) to the
  `Page 2.mp4` already in git: this restored a *filename*, not content. git agrees
  — it stopped reporting the file as deleted.
- **`Page 4.mp4` on disk is the PRE-08-10 export** (`4415648b9f7b00cb`, the version
  from `42ec59d`). The re-recorded narration committed in `e9faa33`
  (`ca3b7fe799e461cd`) is in Downloads as `Page 4 (2).mp4`. **Deliberately left
  alone.** Picture and duration are identical between the two — only the audio
  differs (diff RMS 0.051, speech onset 0.08s on disk vs 0.40s in the committed
  one) — and since this very turn was a request to go *back* to an older take, it
  is not safe to assume which one is wanted. Flagged for the author instead of
  guessed at. The poster matches frame 0 either way (0.86%), the picture being
  unchanged.

### The check that caught it

Walking every path `story.js` references and testing **each path segment against
the real directory listing** catches both a missing file and a case-only mismatch
(the latter works on Windows and 404s on Vercel). It found `Page 2.mp4` here — and
`sfx/BG Music.mp3`, still absent, so the book still plays silent.

---

## 2026-08-10 — a page's clip no longer plays during the page turn

Author: "page 4 video play before the page turn." It did — and so did every other
page. This was never a Page 4 problem.

`turnLeaf` and both drag-release paths call `refreshMedia()` **twice**: once as the
flip begins (its comment read *"START now → the target video plays INSTANTLY"*) and
once when it settles. Playback started on the first call, so the clip ran for the
whole `FLIP_MS` 1150ms flip — narration over the turn, and the reader landing
already a second into the page.

`refreshMedia` now treats a turn in progress like the `delay` option it already
supported: while `animating` is true the clip is **paused and held on frame 0**
(already decoded by `warmVideo`), and the settle call — where every turn path has
set `animating = false` before calling — is what starts it. So the clip begins as
the page lands.

Two things that had to come with it:

- **Clear the pending hold before playing.** Left alive, its timer fires ~1.2s in
  with `restart=true` and yanks the clip back to the top just after it started.
- **`TURN_HOLD_MS` (`FLIP_MS + 60`) is a safety net, not the mechanism.** It only
  matters if a completion callback never arrives — a killed peel tween, a tab
  backgrounded mid-flip — so a page is never left on a frozen first frame. The
  stall watchdog already tolerates it: `armTurnCue` treats
  `mediaDelayTimer && mediaDelayIdx === idx` as "counting, not stuck", and the
  hold reuses exactly those two variables.

**The scenes path had the same bug**, 450ms of it: `playScenes(idx, animating ? 700
: 150)` revealed scene 1 at 700ms of a 1150ms flip. Raising that to `TURN_HOLD_MS`
was the right fix rather than delaying only the clip, because that one delay is the
scene's whole **time origin** — `tap.after` and scene `hold`s are measured from it,
so moving the clip alone would have slid the page-5 tap cue out of sync with the
narration it was fitted to. Shifting the origin keeps them locked together;
verified the cue still appears at **clip time 5.0s** against its authored 5.1s,
unchanged from when it was fitted on 08-07. No live scenes page has a bubble and no
page uses `delay`, so nothing else moved — both checked against STORY, not assumed.

Verified: page 3→4 and 4→5 both hold `currentTime` at **0 across 44 frames** of the
flip, paused throughout, then start at 1284ms / 1380ms against the 1150ms flip and
run on monotonically — no restart. Backward turns hold too (started 1257ms). Page 1
is untouched at 1969ms after the Play tap, since the cover opening sets no
`animating` flag and its media gate still governs. Read-through clean.

**My diagnosis was wrong and measuring killed it.** I assumed the re-recorded Page
4 now began speaking immediately where the old one had a lead-in. The opposite:
speech starts at **0.4s** in the new export and **0.08s** in the previous one — the
re-record made it *better*. The onset table shows why the author noticed it on Page
4 and why it was never Page 4's fault:

| clip | audio starts | heard during a 1.15s turn |
|---|---|---|
| Page 1 | 0.00s | 1.15s |
| Page 5 part 3 | 0.02s | 1.13s |
| Page 3 | 0.28s | 0.87s |
| Page 4 | 0.40s | 0.75s |
| Page 2 / 6 / 9 | 0.50s | 0.65s |
| Page 8 | 0.64s | 0.51s |
| Page 5 / 5p2 / 10 | 0.82–0.88s | ~0.3s |
| Page 7 | 1.20s | none |

Every page but Page 7 bled into its turn. Had I "fixed Page 4" on the strength of
that hypothesis I would have shipped a per-clip workaround for an engine bug.

---

## 2026-08-10 — the POUR button waits for its spoken instruction

Author added `assets/audios/Tap the button to pour juice1.mp3` and asked that the
button only become tappable once the line has finished.

New pour option **`promptSound`**, wired exactly like `fullSound` so the scene's
three sounds now mark its three beats:

| option | when | what it gates |
|---|---|---|
| `promptSound` | the scene lands | the button is DEAD until it ends |
| `sound` | each tap | nothing |
| `fullSound` | glass full | the page hands back only after it |

`layer._pourArm` used to enable the button and raise the hand immediately. It now
holds **both** back — button `disabled`, hand at opacity 0 — plays the line with
`duckMusic(true)`, and opens up on `ended`. Hiding the hand matters as much as
disabling the button: a hand pressing a control that ignores taps teaches the
wrong thing, and a child who taps through the instruction never hears it.

Three details that keep it from trapping the reader:

- `open()` is idempotent (`opened` flag) so `ended` and the backstop can't both fire.
- `play()`'s rejection calls `open()` — if the browser blocks the audio the page
  must still be pourable, silently.
- A backstop timer at `duration + 1200ms` (≈4.1s for this 2.93s line) covers a
  line that never fires `ended` at all. It uses the metadata duration, falling
  back to 4s while `duration` is still `NaN`.

`_pourReset` clears the prompt too, so a revisit replays it from the start.

Verified on the real page: button `disabled` and hand at opacity 0 the moment the
scene arms, **31/31 samples dead through the whole line**, two clicks over it pour
nothing, the button opens at 4380ms (1.1s cross-dissolve + the 2.93s line, so the
line starts after the machine has fully arrived — not under the fade), the hand
reaches opacity 1 right behind it, and 4 taps still fill the glass. Read-through
clean.

**The prompt's level is right** — and my first measurement said otherwise. Peak
0.89, loud-half RMS 0.114, against 0.86/0.099 for the reward line and 0.99/0.095
for Page 6's baked narration, so it is a touch louder than everything around it.
An earlier script reported "peak 0.1847" and I nearly went looking for a way to
boost it: that number was the peak of the **50ms-RMS envelope**, not of the
samples. Two different quantities, one name. (Page 7's narration is the real
outlier at peak 0.338 / loud-RMS 0.037 — about a quarter of every other page.
Author's call, not touched.)

### Page 2 and Page 4 were replaced at the same time

Same protocol as Page 6/8 — old-vs-new frames plus decoded PCM:

- **Page 2 — re-cut shorter: 18.376s → 17.441s**, audio changed from 5.66s on.
  `story.js` comment updated `// 18s` → `// 17s`. The frame divergence its tail
  shows is expected: comparing two different-length clips at the same absolute
  timestamps is not comparing the same moment.
- **Page 4 — audio only.** Picture identical at all 17 sampled frames, duration
  unchanged, audio differs from 0.06s: the narration was re-recorded.

Both are plain `{ type: "video" }` pages whose turn cue arms on `ended`, so a
shorter clip just arms the cue sooner — nothing was timed against either length.
All twelve posters still match frame 0 (0.56–1.2%, the usual webp band),
including the re-cut Page 2, and git reports both as *modified*, so the casing is
intact and nothing will 404 on Vercel.

---

## 2026-08-10 — Page 6 + Page 8 replaced; nothing needed retiming

Author replaced two clips (swept into commit `42ec59d`). **No code changes were
needed** — but only because I measured what changed rather than assuming.

The byte deltas were `+55` on Page 6 and `-1645` on Page 8, which looks like a
re-mux, so my first read was "metadata only". Wrong. Diffing 21 sampled frames
and the decoded PCM of each against the previous committed version:

| | picture | audio | duration |
|---|---|---|---|
| Page 6 | identical at all 21 frames | **opening line re-recorded** | 16.643s, same |
| Page 8 | **caption typo fixed** | bit-identical | 16.39s, same |

- **Page 8** is a picture-only fix: the baked caption's double space,
  `It is  getting late.` → `It is getting late.`, from ~10.75s to the end.
  Localised by diff bbox to x 29.9% / y 3.9% / w 18.3% — the speech bubble.
  Audio diff RMS 0.00036 (AAC noise).
- **Page 6** is an audio-only change: the first line is a different take that
  starts ~0.25s later. The envelope is *bit-identical from 4.5s on*, so only
  that opening line was replaced. Audio diff RMS 0.066 against a signal RMS of
  0.083, with a max per-sample difference of 1.38 — uncorrelated, not a re-level.

Why nothing had to move:

- **Posters still equal frame 0** — 0.86% and 0.75% off, inside the 0.56–1.2%
  webp-noise band that the ten *untouched* clips also sit in. No regeneration.
- **Page 6's final frame is unchanged**, so the template-matched `machineAt` /
  `buttonAt` / `glassAt` still land where the video leaves the machine. That
  alignment was the one thing a new Page 6 export could have silently broken.
- **Durations unchanged**, so Page 8's `// 16s` note and the pour hand-off stand.
- **Casing is right.** git reports both as *modified*, not delete + add — the trap
  from 08-07, when a re-export landed as `page 2.mp4` and would have 404'd on
  Vercel while working perfectly on Windows.

Full read-through clean: cover → THE END, the page-5 tap, all four pours, one
video at a time.

Three measurement lessons, all of which nearly produced a wrong answer:

- **A tiny byte delta does not mean a tiny change.** Page 6 grew by 55 bytes and
  had a whole line re-recorded.
- **Do not sample audio through `requestAnimationFrame`.** My first old-vs-new
  RMS comparison played both clips separately and binned by rAF tick, so frame
  jitter put the same audio in different bins; it reported "the audio DIFFERS"
  for Page 8, which is bit-identical. `decodeAudioData` + direct sample
  comparison is the honest tool and it is not slower.
- **A threshold picked from the peak found the ambience, not the last word.** An
  8%-of-peak "is it speech" test said Page 6's narration runs to 16.25s, leaving
  0.39s of tail, and I nearly reported the 1.1s cross-dissolve as clipping it.
  It isn't: a scene that advances on `ended` has *finished playing* before the
  dissolve starts (see the comment at `goNextScene`), and the figure was
  identical in the old take anyway. Check whether a number is a *regression*
  before treating it as a *defect*.

### Still outstanding, not mine to decide

`sfx/BG Music.mp3` was deleted in commit `0928a65` while `story.js:78` still
points at it, so the book now loads with a failing request and plays silent.
Restore with `git checkout 0928a65^ -- "sfx/BG Music.mp3"`, or drop the `music:`
line for deliberate silence.

---

## 2026-08-10 — the nudge's three parts now run on one beat

Author: "sync the arrow and hand nudge animation coming together." They weren't.
The page-turn nudge fires three things at once and two of them already shared a
rhythm by accident:

| part | period |
|---|---|
| hand swipe (`flipHintSwipe`) | 1.50s |
| ghost peel (GSAP: 0.70 up + 0.15 hold + 0.60 down) | 1.45s |
| **arrow glow (`arrowBlink`)** | **0.70s** |

So the arrow beat **2.14× per swipe** — never landing on the same frame twice,
which is exactly what "not coming together" looks like. Three changes:

- **`arrowBlink` is now 1.5s** with the hand's own easing, and its bright keys
  are the hand's own **45% and 72%** — the frames where the hand holds at the
  end of its stroke and the peel holds at full lift. One gold flare per swipe,
  held for as long as the hand holds. Trough raised 0.35 → 0.5 so the slower
  cycle reads as a glow swelling, not the arrow disappearing.
- **`NUDGE_SHOW_MS` 2000 → 3000**, expressed as `NUDGE_BEAT_MS * 2`. At 2000 the
  cue died a third of the way into a second stroke the hand never finished.
  Now it plays two whole beats and ends on the pose it started in.
- **The peel re-fires on beat 2** (`peekTimers`, so an interaction still kills
  it). It's one-shot; without this the second beat would be missing the page
  lift the other two are timed against.

The real bug was in the JS, and only a live probe found it: **`.blink1` was
still on the arrow when the nudge started.** That's the one-shot 2s flash fired
when a page's video ends; `dialogueDone` → `HINT_AFTER_DONE_MS` (2000) lands
~50ms before `blink1` is removed at 2050. It's declared *after* `.blink` at the
same specificity, so it won the `animation` property — the synced glow simply
did not start until `blink1` was dropped, then trailed the hand by 50ms for the
whole cue. `triggerHint` now removes `blink1` before adding `blink`.

Verified: both animations report the same 1500ms period and the same
`currentTime` in the same tick; sampled over one beat, the hand holds
furthest-left 581–1082ms and the arrow holds full glow 631–1057ms — **midpoints
12ms apart**, one flare per swipe; the peel lifts at 0ms and 1475ms. Under
`reducedMotion: "reduce"` neither animation runs and the hand is still shown at
0.96, so the guidance survives without the movement. Full read-through clean.

A measurement note worth keeping: `Animation.startTime` is **null** for an
animation caught in its first tick, and `Math.round(null)` is `0` — a
"both started at 0" result proved nothing. `currentTime` is the honest one.

---

## 2026-08-10 — TWO hands: white on the book, artwork in the illustration

Author: "use the old hand nudge, the white one using in the start" — then, once
they saw it: **"do not change the interaction nudge, only change the book flip
nudge."** So the split is now deliberate, not a fallback:

| cue | hand |
|---|---|
| book-flip nudge (page corner + arrow) | the engine's plain white SVG |
| tap hot-spots + POUR hint | `assets/pages/hand nudge.webp` |

The reasoning behind the line: the flip nudge is about **the book** — swipe the
paper, tap the arrow — so it belongs with the arrows and the progress dots as
neutral chrome. The tap and pour cues point **into the illustration**, at a
machine on a table, so they carry the story's own art. One hand doing both jobs
made whichever art you picked wrong in one of the two places.

So `flipHint` is now a plain `.flip-hint--svg` div built from `HAND_SVG` with no
`handNudge` branch at all, while `handMarkup()` (tap spots + pour) keeps reading
`HAND_ART`. `handNudge` stays in story.js, its comment now saying which cues it
governs and which it does not.

Two things that fell out of the round trip:

- `.pour-scene .pour-hint .scene-tap-hand` is back at **34%**. It had gone to
  40% for the SVG (hand edge to edge, so 34% read as a speck); the webp carries
  padding, so 34% is its number. If you ever swap `handNudge` again, check this.
- The book-flip hint no longer requests **`engine/hand-nudge.png`** — a file that
  has never existed here. It used to be reached via
  `HAND_ART || "engine/hand-nudge.png"` and only became the white hand through
  the `<img>` error handler: a guaranteed 404 on every load, for the cue that was
  always going to end up as the SVG anyway. Now it just builds the SVG.

Verified: the flip hint is a `.flip-hint--svg` div holding an `<svg>`, every
`.scene-tap-hand` is an `<img src="assets/pages/hand%20nudge.webp">`, nothing
404s, no page errors; the POUR hint is the artwork at 38px with the word still
readable; and the flip nudge still shares its 1500ms period and phase with the
arrow, so the sync above survived the change.

---

## 2026-08-10 — the nav arrows were sitting ON the book

Author: the back/forward arrows overlap the book. They did — **on 8 of the 10
test viewports**, the gold glyph intruded 8–20px onto the book's frame.

The arrows are meant to sit just under the book's bottom corners. The button is
a deliberately generous tap target whose outer ~21% is empty padding; only the
middle 58% is the visible glyph. `fitScale` sized the button so that *the glyph*
fits the strip under the book — but then clamped with `vh - btn - 4`, which
keeps the **whole box** on screen. On a normal screen that clamp pushed the
button up by roughly its own padding, dragging the visible arrow back onto the
book — the exact thing the placement was avoiding. Its comment called it a
"very short screens" fallback; it was firing almost always.

Fixed by expressing both the placement and the clamp in terms of the glyph:
`maxY = vh - 4 - (btn + glyph)/2`. That alone cleared 8 of 10.

The two shortest landscape phones had no room at all — the strip under the book
is thinner than the smallest allowed button. Rather than shrink the button (a
56px minimum is what makes it hittable for a small child), the **glyph** is now
capped to what the strip can hold and the box stays ≥56px:
`--arrow-glyph` drives the SVG's size, so the artwork shrinks inside an
unchanged tap target. Trading a cosmetic overlap for an unhittable control would
have been the wrong way round.

Now clear on all 10 viewports with a 3–6px gap under the frame, tap target still
56px+ everywhere, glyph never off-screen, and a real click still turns the page.

*Measurement note:* my first pass measured the BUTTON BOX against the book and
reported an overlap everywhere including the two that were actually fine — the
box is supposed to overlap. Measure the thing the reader can see (the `<svg>`),
against the book's visible `.book-frame` rather than the 1280×720 book box,
which is smaller than the frame drawn around it.

---

## 2026-08-10 — the step jutting out of the book's bottom-right corner

Author spotted a bright tab poking out of the closed book's bottom-right. Cause:
**`.pb-back-lip` had `right: -10px`**, so the back-cover lip painted ~6px PAST
the front cover's right edge. Because the lip starts *above* the cover's bottom
edge (its top is at cover.bottom − 23px) and is a lighter purple than the board
(`#271e50` against the cover's `#241b46` there), that overhang read as a bright
step with its own 14px rounded corner. Fixed by making the lip symmetric —
`right: 2px`, matching `left: 2px`. It is the BACK cover, so it must never be
wider than the front one; it still sits 7.6px proud of the page stack and still
peeks 33.6px below the cover, which is the layering the effect wanted
(pages < back lip < front cover).

**Two false trails, both killed by measuring instead of looking:**

- I first blamed `.book-body` from a side-by-side of hidden-element renders —
  it *looked* like the culprit. A quantitative diff said otherwise: hiding it
  changes **0%** of those pixels, and its computed opacity is already 0. Eyeball
  A/B of near-identical crops is not evidence; diff them.
- The bounding rects said the lip was 7.2px *inside* the cover, which
  contradicted the screenshot. Sampling actual pixels showed why: the cover's
  **painted** right edge is ~1505 while its bounding rect claims 1518 — so rects
  alone would have "proved" there was no bug. The pixel scan found the lip's
  colour sitting to the right of the cover's, which is the real defect.

*Test-writing notes:* `getBoundingClientRect()` returns a DOMRect, which has no
own enumerable properties and serialises out of `page.evaluate` as `{}` — build
`{l,r,t,b}` explicitly. And when both metrics are phrased as "beyond the cover",
*both* pass at `<= 0`; I initially asserted `>= 0` on the left and got a false
failure on correct code.

Verified: no lip-coloured pixels remain right of the cover (0 px), the lip is
inset 20.3px on both sides, still wider than the page stack, still peeking
below; clean across all 10 viewports; full read-through clean.

---

## 2026-08-07 — the tap-to-begin gate was REVERTED

Author: "no need to add tap to begin text or interaction." The gate below is
**gone** — no prompt, no extra tap, the book drops on load exactly as before,
and the thud is best-effort again. Removed cleanly: the `<head>` script, the
`html.awaiting-drop` rules, the `.drop-gate` styles and its keyframes; nothing
left behind (verified — no gate element, no class, no "tap to begin" text
anywhere, `.scene` interactive from the start, and **one** tap on Play opens the
book).

**Where that leaves the sound, stated plainly so nobody re-opens this:** on a
cold first visit to the hosted site the thud does not play, and *cannot* — see
the diagnosis below. It plays on any later visit or reload. The entrance was
judged worth more than the effect. The only two ways to change that are the
gate (reverted here) or dropping on the Play tap (rejected — it delays the
story). `sfx/book-drop.wav` and the level tuning all stay as they are.

---

## 2026-08-07 — the drop sound on Vercel: diagnosed, then gated behind a tap *(gate since reverted, see above)*

Author: the thud doesn't play on the hosted build. **Diagnosed before changing
anything**, by serving the folder over HTTP and loading it in Edge with its
NORMAL autoplay policy (no flags) — the closest thing to Vercel:

```
network : book-drop.wav  200  audio/wav          ← file is fine
element : readyState 4, duration 0.78            ← fully loaded
play()  : NotAllowedError: play() failed because the user
          didn't interact with the document first.
```

So it was never Vercel, the path, the case, or the MIME type — all of which I
checked first. It is the browser refusing sound before the reader has touched
the page, and the book was dropping *on load*, before any touch could exist.

**The fix: the drop now waits for the reader.** The animation is held at its
first frame (where the book is off-camera and invisible) behind a light
"Tap to begin" prompt using the story's own hand art. The tap releases the
drop, the dust and the thud together — and because a tap *is* the activation
the browser wants, the sound plays. If nobody touches anything within **5s**
the book drops anyway, silently, so the desk is never left empty.

Two traps this hit, both worth remembering:

- **Pausing from the end of `<body>` is a race.** The CSS animation starts at
  first style resolution, often before an end-of-body script runs, so the book
  flashed into view already half-fallen — intermittently, which is the worst
  kind. The class is now set on `<html>` from a script in `<head>`, before the
  first paint, and the CSS keys off `html.awaiting-drop`.
- **An invisible element is still clickable.** The held book has `opacity: 0`
  but was still hit-testable, so a tap where the Play button was about to appear
  would open the book mid-drop. `html.awaiting-drop .scene { pointer-events:
  none }` fixes it; the gate's own listener is on `window`, so the releasing tap
  still registers.

**Rejected alternative:** dropping on the Play tap instead. It would have
avoided the extra tap, but pushed the story ~0.9s further behind that tap — and
the opening delay is something this book has already been tuned to keep short
(see the mediaGate work). One cheap tap before the book appears beats a slower
start every time.

`GATE = false` in the `<head>` script restores the old drop-on-load behaviour,
silent on a first visit.

Verified over HTTP with the default autoplay policy: the drop is held with the
book invisible, the tap makes **the thud actually sound** and plays it through,
the book lands and opens and page 1 plays, and with no tap at all the book still
appears with Play ready. No errors.

*Test note: scripts that used to open with `click("#hint")` must now release the
gate first (`keyboard.press("Shift")`, then wait out the 1.15s drop) — the scene
is not hit-testable until the book lands. `verify8.js` has been updated.*

---

## 2026-08-07 — highlight moved to the glass, a genuinely full glass, harder pops, drop thud

**The highlight is on the GLASS now, not the "Full" text.** The glow keyframes
came off `.pour-pop-hero` and went onto `.pour-glass.full` — a warm halo that
breathes, added by `setJuice` the moment the fill hits 100% and removed on
reset. The sticker keeps its pulse (slightly stronger, 1.09×), just no glow of
its own. The reasoning is sound: the glass is the thing that *changed*, so
that's where the eye should go.

**Why the glass didn't look full, and the actual fix.** Raising `TOP_Y` to the
brim yesterday wasn't enough, and the author's reference photo showed why: in a
real full glass you look down into **juice**, but `CUP_MOUTH` is an opaque grey
disc (`#DFDAD0`) painted *over* the liquid, so the top always read as empty cup
no matter how high the level went. Added a second `CUP_MOUTH` path filled with
a **darker twin of the juice** (`shade(juice, 0.9)`), faded in over the last
third of the fill (`(f − 0.62) / 0.38`) — so the mouth turns to juice as the
glass fills and is solid juice at 100%. Also added **8 bubbles** suspended in
the liquid; they sit inside the fill clip, so they only appear where there is
juice. Close-up now matches the reference.

**Stronger pops.** `pourPopIn` was a modest 0.35 → 1.08 → 1. It is now a
four-stage throw: **0.18 → 1.28 → 0.93 → 1.06 → 1** with a −14° → +7° → −4°
rotation swing over 640ms. The counter-swing is what makes it read as *thrown
on* rather than faded in.

**A soft thud when the book lands.** Synthesized in Web Audio — a low sine
dropping 155→46Hz for the hardcover hitting wood, plus a short puff of
low-passed noise for the dust — fired at the drop's 760ms impact frame. No
asset, nothing to load. It lives in `index.html` with the rest of the table
scene (so removal is now **three** things: the `<style>` block, the
`.dust-burst` markup and this `<script>`), and it closes its AudioContext after
a second.

> **Honest limit, worth remembering:** browsers refuse audio until the reader
> has interacted with the page, and the drop happens *on load* — so on a first
> visit this thud is usually **silent**. It plays on revisits and wherever the
> browser's autoplay policy allows. There is no fix that keeps the entrance on
> load; the alternative is holding the drop until the first tap. Verified it
> genuinely emits sound (peak amplitude 0.29) by patching `AudioContext` to tap
> the destination through an analyser, rather than just asserting no error.

### Follow-up: "increase the drop sfx, it's unnoticeable"

Two separate causes, and **volume was the smaller one**:

1. **It is completely blocked on a cold load.** My first test ran Edge with
   `--autoplay-policy=no-user-gesture-required`, which quietly guaranteed the
   result. Re-run under the DEFAULT policy: **peak 0.0000, context
   `suspended` throughout** — not quiet, not playing. *Lesson: never verify an
   autoplay-sensitive feature under a flag that disables the very policy that
   governs it.*
2. **The sound was pitched where speakers can't reproduce it.** It was a
   155→46Hz sine. Laptop and phone speakers roll off hard below ~150Hz, so even
   when it played there was little left to hear. Rebuilt as four layers with
   the loud ones in the audible band: a **520→190Hz triangle knock** (the layer
   you actually hear), a **1.9kHz band-passed slap** transient, a deliberately
   *quiet* 130→60Hz body (felt, not heard — turning it up only steals headroom),
   and low-passed dust a beat later. All through one master bus at 0.62 so
   nothing clips.

Calibrated against sounds the reader demonstrably hears rather than against an
absolute number: measured through the same analyser tap, the thud is
**peak 0.67 / rms 0.020** versus the page flip's **0.078 / 0.0035** and the
cover-open's **0.062 / 0.0016** — about 8.6× the flip's peak, which is right for
an impact against a paper rustle. No clipping (peak < 1.0).

The AudioContext is also now opened at page load rather than at the impact
frame, giving it the full 760ms to wake; if it is still suspended at impact the
thud is skipped rather than fired late and out of sync.

**Still open for the author:** guaranteed sound on a first visit would mean
moving the drop behind the reader's first tap, which changes the entrance. Not
done unilaterally.

### Follow-up: the author's own recording replaced the synth

`sfx/Book drop.mp3` (freesound, 15.7s) turned out to hold **nine separate
takes** — the ask was really "pick the good one". Detected each by onset and
characterised it (attack, length, peak, energy split across <150Hz / 150Hz-4kHz
/ >4kHz), then **plotted the waveforms**, which is what actually decided it:

| take | verdict |
|---|---|
| 0.68s | clean single impact, but thin (peak 0.35) and half its energy is sub-bass |
| 2.45s | scattered rustle, no impact |
| 4.84s | double thump — lands then flops |
| 8.19s | good hit, but trails into rustling |
| **10.80s** | **chosen** — loudest (0.56), one clean impact, natural settle, 67% mid |
| 13.62s | **83% mid-range, the best number of the nine — and it is pages riffling, not a drop** |

That last row is the lesson: ranking on the summary statistic alone would have
picked page-riffle. *Plot the waveform before trusting a spectral score.*

Cut to **`sfx/book-drop.wav`** — 0.78s, mono, 73KB, 3ms/70ms fades so neither
edge clicks, normalised to 0.95. Played from an **`<audio>` element, not
fetch + Web Audio**: `fetch()` is blocked on `file://`, and this book must work
when index.html is double-clicked. The full mp3 stays as the source and is never
loaded; re-cut with a different take by changing `START` in `dropcut.js`.

Level set to **0.55** — the file's rms is 10.9× the page-flip file's, so this
lands at ~6× a page flip: clearly an impact, not a shock. Verified it fires at
**766ms** against the 760ms landing frame, plays to completion, and — under the
default autoplay policy — stays silent with no error rather than throwing.

---

## 2026-08-07 — the author's hand art, everywhere; tap cue moved onto the machine

**`assets/pages/hand nudge.webp` is now the hand in all three nudges** — the
page-turn hint, the "tap the screen" cue and the POUR hint. (It had been sitting
unused in the repo since 08-04; the engine was drawing its own plain white SVG
hand.)

Wired it the same way as `playButton` rather than hard-coding a path in the
engine: **`handNudge` in story.js**, read once into `HAND_ART`, with
`handMarkup()` returning either an `<img>` or the built-in SVG. Delete the
story line and the engine still has a hand. `engine/` stays story-agnostic,
which is the whole point of the template split — and the long-standing
`engine/hand-nudge.png` 404 is finally gone.

Two traps this hit:

- **TDZ, again.** `handMarkup()` reads `HAND_SVG`, and `buildPourScene` calls it
  while the leaves are built at load. Declared above `HAND_SVG` it throws and
  takes the whole book down with a blank page — the exact failure from the first
  pour build. It now sits *below* `HAND_SVG` with a comment saying why.
- **CSS specificity vs reduced motion.** The new centred-hand rules
  (`.scene-tap.anywhere .scene-tap-hand`, `.pour-scene .pour-hint …`) are
  3-class selectors, so they outranked the reduced-motion block's 1-class
  `.scene-tap-hand { animation: none }` no matter where it sat. Readers who ask
  for less motion would have kept a nudging hand. Added matching-specificity
  overrides; verified with Playwright's `reducedMotion: "reduce"`.

`.scene-tap-hand img` also needed the sizing rule the `svg` child already had,
or the art rendered at its natural size.

**The tap-anywhere cue now sits ON the machine.** It was at `x 27%` — empty
table, chosen back when the brief was "point at open space, not at POUR". The
machine in Page 5 part 2 is centred at **x 45.23%** (measured off the frame at
the cue moment), so `at` is now `45.2% / 58%` and the hand points up at the
machine. It is still `anywhere: true` — no targeting ring, a tap anywhere still
counts; only the hand's *placement* changed.

For that to be exact, the hand also had to be **centred on its `at` point**.
The shared cue deliberately hangs the hand below-right of its anchor to avoid
covering what the ring circles — but a ring-less cue has nothing to avoid, and
the offset put the hand 2.9% off the machine's centre. `.anywhere` and
`.pour-hint` now share one `handPressCentred` keyframe, so `at` means the middle
of the hand: measured **45.20% against the machine's 45.23%**.

---

## 2026-08-07 — five pour-scene fixes (author's list)

**1. Hand nudge centred on POUR.** Measured it: the ring was already dead-centre
on the button (dx 0.00%) but the *hand* sat **dx 1.85% / dy 9.04%** off — the
shared `.scene-tap-hand` hangs below its ring by design, because elsewhere the
cue points at big scenery a hand would cover. POUR is a small disc, so a hand
below it read as pointing at the machine's body. Overrode it for `.pour-hint`
only (`pourHandPress` keyframes, centred, 40% wide so "POUR" still reads).
Now off by dx 0.00% / dy 0.17%.

**2. Fuller glass.** `TOP_Y` 33 → **24**. In cup space the mouth's inner edge
bottoms out at 24.3, so the surface now sits right under the lip and the rim —
painted after the juice — tucks over it. Before, it stopped ~9 units short and
read as three-quarters full at "full".

**3. Continuous nudge while pouring.** `pour()` used to hide the hand on every
tap and only re-show it after **9s idle** (from pour-interaction.md). Filling
takes four taps, so the hand vanished after the first and the reader had no cue
that more were wanted. It now stays up from arm until the glass is full, then
hides (nothing left to tap). The idle timer is gone entirely — no dangling refs.

**4. Machine aligned to the clip.** The big one. Page 6.mp4 ends on this same
machine, so the cross-dissolve is only invisible if the pour machine lands
exactly where the video leaves it — it didn't. Found the true fit by
**template-matching `machine.webp` against the clip's final frame** (coarse 1%
sweep over x/y/width, then a 0.25% refine; `fit.js`): match error **68.6 → 25.2**.
The machine was **5.8% too far right, 3.8% too low and 6% too small** — it
visibly jumped and shrank at the hand-off.
`machineAt` is now `x 30.75% / y 7.75% / w 28.5%`, and **the same fit is applied
to every attached part** (button, glass, stream, both stickers) via
`new = 30.75 + (old − 36.56) × 1.0626`, so the composition the author approved
is preserved exactly while the whole assembly moves onto the video's machine.
Independent cross-check: the derived glass x (41.88%) matched the glass measured
directly in the video frame (41.88%) to two decimals.

**5. "Full" highlighted + pulsating.** New per-pop flag **`emphasis: true`**
(story.js) → `.pour-pop-hero`: a warm gold glow plus `pourPopPulse` /
`pourPopGlow` that start as the pop lands (listed after `pourPopIn` so they take
over `transform`/`filter` cleanly) and keep going. Only the "Full" sticker gets
it; the arrow just points.

Verified (`pour5.js`): all five, plus the page still unlocks after the reward
line, no errors. Full read-through clean.

**Worth knowing — the clip ends on "Empty" + arrow.** The video's last frame
already carries an "Empty" sticker and dashed arrow in the same style as our
"Full" pair, in almost the same place. That's the largest remaining delta at
the hand-off: they fade out during the 1.1s dissolve, then "Full" appears later
in roughly their spot. Carrying an "Empty" sticker into the pour scene (fading
it on the first tap) would make the join seamless, but there is **no
`empty text.png` asset** — it would need new art from the author.

---

## 2026-08-07 — three replaced clips, and a casing bug that only breaks when hosted

Author replaced **Page 2** (18.4s), **Page 5 part 2** (8.5s) and **Page 7**
(8.2s, was 10.4s) in place. Replacing a clip in place is never just a file
copy — four things ride on each one:

**1. The filename case — the real bug.** The new page-2 export landed as
**`page 2.mp4`** (lowercase p) while `story.js` and git both say `Page 2.mp4`.
Windows is case-INSENSITIVE, so it plays perfectly here and looks completely
fine — but **GitHub Pages is case-sensitive**, so the hosted book would 404 on
page 2: a blank page that never unlocks, on the iPhone read this project exists
for. Renamed back via a two-step (`page 2.mp4` → `.tmpcase` → `Page 2.mp4`;
a direct case-only rename is a no-op on Windows), confirmed by git reporting it
as *modified* rather than delete+add. **Check `cmd /c dir /b` against
`git ls-files` after every asset drop** — Explorer and `Get-ChildItem` will not
show you this.

**2. Posters.** All 12 regenerated (`posters.js`); the three replaced clips had
posters from the previous encode, which would flash the OLD first frame and jump
the instant playback began. New check `posterdiff.js` draws poster and frame 0
to canvas and reports mean per-pixel difference — everything now ≤3 (webp noise;
a stale poster scores far higher). Worth running after any clip swap.

**3. Cue timing tied to the clip.** Page 5 part 2 carries `tap.after`, and the
new take's narration runs **0.8s→5.0s** with a **3.4s silent tail**. The old
`4800` now fired over the last word. Measured the envelope (`envelope.js`,
per-200ms RMS via `decodeAudioData`) and moved it to **5100** — verified the cue
becomes visible at clip time **5.0s** exactly (`p5cue.js`, sampled against the
video's own `currentTime`, not wall clock). Page 7 (1.2s tail) and Page 2
(0.4s tail) gate on `ended`, so neither needed tuning.

**4. Encoding.** All 12 re-checked for `moov` before `mdat` — all faststart, so
they still stream progressively over HTTP instead of downloading whole.

Also fixed the now-stale `// 10s` comment on Page 7. Geometry was fine: every
clip is 1920×1080 / exactly 16:9, so nothing letterboxes in the 1280×720 frame.

**Unrelated loose end:** `assets/pages/hand nudge.webp` (a drawn pointing hand,
dated 08-04) is sitting untracked and unused. The engine wants
`engine/hand-nudge.png` and falls back to an inline SVG hand, which is why the
404 is harmless. Left alone — swapping the cue hand is a design call the author
hasn't made.

---

## 2026-08-07 — new gold Play button

The author supplied a new button (`Wish Frame.svg` from Figma) — same blob +
web + ▶ language as the purple one, but **gold**, which now matches the desk's
candle/wand trim and the cover's gold title. Saved as
**`assets/wish button.svg`**; the old **`assets/play button.svg` was deleted**
(author asked for it removed, not kept as a spare).

Three references had to move together, and missing any one of them 404s the
button: `story.js` → `playButton`, the hard-coded `src` on `.play-art` in
`index.html` (the markup default, used before `story.js` is applied), and the
README (both the code sample and the folder table). Nothing in `engine/`
changed — it only places, sizes (168 book px) and breathes the artwork.

*Note for next time:* the author re-exported **over the same filename** while I
was mid-swap (`Wish Frame.svg`, 4354 → 11219 bytes, the second adding the web
pattern). "Use these buttons now, not the first one" meant a NEW FILE AT THE OLD
PATH, not a new path — so check the Downloads mtime/size, don't assume the
attachment you already read is current.

Verified: art loads (210×206 natural, into the 168px square box — a 2% squeeze,
invisible), sits at 50%/79% of the cover on the cauldron's black belly, the book
still opens, no failed requests for the deleted file.

---

## 2026-08-06 — the table scene + the book-drop entrance

The book no longer floats on the engine's starlit-night gradient. It now lies on
a **Halloween desk** (`assets/table.png` — purple wood, a candle top-left, a
dangling spider top-right, spellbooks in the bottom corners) and **drops onto
it** on load. Everything lives in ONE `<style>` block plus one `.dust-burst`
markup island in `index.html` — **nothing in `engine/` was touched**, so
deleting those two pieces restores the night scene exactly.

**The desk.** `body` background = candle-warm glow top-left + a soft glow under
the book + a vignette + `assets/table.webp`, `cover`. The `.floor-shadow` is
re-tinted deep plum so the cast shadow reads on dark wood, and the engine's
`idleBob` float is disabled (`.book-float { animation: none }`) — a book resting
on a desk shouldn't hover. The `.scene` fade-in is off too; the drop replaces it.

**The drop** (`bookDrop`, 1150ms on `.book-pop`). The camera is top-down, so
"falling onto the desk" is played as **shrinking away from the lens**:
`scale(2.35) rotate(-4deg)` → `scale(1)` at 66% (impact ≈760ms, ease-in for
gravity) → squash `scale(1.05, 0.93)` → rebound `scale(0.982, 1.012)` → rest.
`.book-pop` was chosen deliberately: it is a pure pass-through wrapper the
engine never transforms (the open-pop moved to `.book-stage` long ago), so this
animation can't compose against engine motion. Verified `#bookPop` ends at
`matrix(1,0,0,1,0,0)` — no residual transform for the cover swing to fight.
`shadowLand` runs alongside with `fill: backwards` only, so once it finishes the
engine's own open/close shadow transitions resume untouched.

**The dust** — 13 `<i>` puffs in `.dust-burst`, each a soft radial-gradient
ellipse, fired at 760ms with per-puff `--j` jitter. Positioned in book space:
`--x/--y` start, `--dx/--dy` outward drift, `--s` size. They hug the **bottom
edge** (y ≈ 99–104%, where the book meets the desk, same line as the floor
shadow) in overlapping mixed sizes, plus one kick out of each bottom corner.

*Getting the dust visible took four passes, and the reason is worth recording:*
the closed book's board and page lip **overhang the 1280×720 stage by ~48px**,
so puffs placed at the stage's own edge (`--y:100%`) are **painted behind the
book art** and invisible. They must sit just outside the visible silhouette.
The first sizes (26–46px, drifting 80px) also read as faint specks scattered
across the desk rather than a landing cloud — 52–118px puffs drifting only
~30px sell the impact. Diagnosis method: seek `document.getAnimations()` to a
fixed `currentTime`, then dump each puff's rect + computed opacity +
`elementsFromPoint` (`dustdiag.js`). Note that `animation-delay` tricks fail
here — `currentTime` is absolute and covers delay, so one value poses the whole
entrance (`dropscrub3.js`); the earlier negative-delay attempts (`dropscrub.js`,
`dropscrub2.js`) posed the layers inconsistently.

**`assets/table.webp`** — the source PNG is **1917KB**, far too heavy for the
phone read the author cares about. Canvas-converted at q=0.92 to **134KB**
(93% smaller, visually identical; `towebp.js`). The CSS points at the webp; the
PNG stays as the editable source. webp is already a hard dependency (posters,
pour art).

Reduced motion: no drop, no dust, no shadow animation — the book is simply
there.

Verified: 10 viewports from 3440×1440 to 568×320 — desk fills with no
letterboxing, book stays centred (±2px) at 48–70% fill, Play button lands on the
cover art, `#bookPop` at identity, **zero errors** (only the by-design
`hand-nudge.png` 404); cover still opens and the full read-through is clean.

---

## 2026-08-06 — "Full" sticker + arrow pop during the reward line

Author added two images (`assets/pages/full text.png` — a "Full" sticker — and
`pointer.png` — a white dashed arrow). New pour option **`pops`**: stickers that
pop in WHILE the reward line plays, each timed to the word it illustrates —
`{ src, at:{x,y}, w, time }`, `time` = ms into `fullSound`. Measured the line's
envelope: the final emphatic "full" starts at **~5.4s**, so the sticker pops
there (right of the machine) and the arrow follows at 5.6s, curling down to the
glass. Each pop plays a **synthesized pop sfx** (`playPopSfx()` — a 520→160Hz
sine blip through the existing Web Audio ctx; no asset file needed, silent when
muted/unavailable). Springy `pourPopIn` keyframes (overshoot + settle);
reduced-motion shows them statically. `_pourReset` re-hides them; timers ride
the pour scene's cancellable `wait()` list, so leaving mid-line cancels cleanly.

Verified: stickers hidden through pouring and the first 4.65s of the line, both
shown at 5.85s (screenshot matches: Full → arrow → glass), cue after the line,
hidden again after leaving; full unforced read-through clean.

Resized to match the author's reference mockup: **both PNGs are 1080×1080
canvases with the art occupying only ~66% of the width** (transparent padding),
so the first sizes rendered far smaller than intended. Measured the opaque
bounds (System.Drawing alpha scan: Full art 716×392 px, pointer art 716×480 px)
and compensated — Full `w:20% at 62%/24%` (art lands at tank level, ~0.6× the
machine's width like the mockup), pointer `w:34% at 50.5%/31%` (dash trail
starts under "Full", loops, arrowhead just touches the glass's right edge at
mid-height instead of covering it). Config comment in story.js warns that `w`
is the CANVAS size. Re-verified via pops.js after each nudge.
*(Test-writing note: my first timing assertion was wrong by 900ms because the
tap loop's trailing sleep overlapped the completion delay — anchor assertions to
a captured t0, not to accumulated sleeps.)*

---

## 2026-08-06 (earlier) — glass-full reward line + new Page 7 clip

- **New pour option `fullSound`** — the author added a narration line ("This
  glass is filled all the way up. It is full.", `assets/audios/*.ogg`). OGG is
  silent on Safari/iOS, so it was converted (ogg2wav recipe) to
  **`sfx/glass-full.wav`** (6.16s, 531KB) and wired as `fullSound` on page 6's
  pour config. Sequence on the 4th tap: stream fades (~0.95s) → music ducks →
  the line plays → **the page unlocks only after the line ends** (fullSound
  `onended`; catch/9s backstop so a blocked or broken audio can never trap the
  page; a `rewarded` flag stops the backstop double-finishing). `_pourReset`
  silences it when the reader leaves mid-line.
- **Page 7 re-authored in place** (17.7s → 10.4s). Same drill as Page 1's
  replacement: poster regenerated from the new frame 0, faststart verified,
  tail frame clean. story.js duration comment updated.

Verified: during the line — playing, music 0.06, cue hidden; after — cue up,
music 0.20; leaving mid-line silences it; full unforced read-through clean.

---

## 2026-08-06 (earlier) — the POUR game moved from page 5 to the end of page 6

Author restructure: the pour interaction is no longer page 5's fourth scene.
Page 5 is back to its three clips (mix → tap-anywhere wait → pour-into-tank),
with the turn cue arming when part 3 ends. Page 6 changed from a single-video
page to a scenes page: **[Page 6.mp4 → pour game]** — the 17s clip plays right
through, cross-dissolves to the juice machine, and the reader fills the glass
(4 taps) before the page can turn. Pure story.js change — the engine's scene
player already supported a video scene advancing into a `pour` finale.
Note: page 6 is now a scenes page, so it no longer joins `videoWatched` —
revisiting it replays clip + pour, same contract as page 5.

Verified: page 5 cue arms at part 3's end with no pour present; page 6 clip
plays → pour arms only after it ends → ArrowRight refused mid-game → 4 taps →
cue; full unforced read-through clean (page 6 scene 2/2 pour logged 4 taps).

---

## 2026-08-04 — navigating to a page always restarts its clip

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
