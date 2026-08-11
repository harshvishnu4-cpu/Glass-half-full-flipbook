# Play-testing the book

These scripts **play the book and both games in a real browser** — the Edge already
installed on this machine. Nothing is mocked. They exist because the bugs that
actually shipped here were never visible in the source: a mask that snapped pink in
one frame, a speech bubble dismissed 30ms before its audio ended, a voice clip that
404'd on every load for weeks.

Nothing here ships with the book. The book itself still has **no build step and no
runtime dependencies** — double-clicking `index.html` works exactly as before.

## One-time setup

```
cd test
npm install playwright-core
```

14MB, gitignored, and **no browser is downloaded** — it drives the installed Edge
(or Chrome). If neither is found it falls back to Playwright's own channel lookup.

## The scripts

| command | what it does |
| --- | --- |
| `node test/check-media.js` | Safari/iOS fallback check. No browser, ~1s. |
| `node test/audit.js` | Baseline sweep: every missing asset and JS error, book + both games. |
| `node test/play-book.js` | Reads all 13 pages, screenshots each, checks the closing iris. |
| `node test/play-lbd.js 2` | Plays LBD 2 properly and audits its dialogue. |
| `node test/serve.js` | Just the server, to poke around by hand. |

Useful flags:

```
node test/audit.js --file            # the double-click path instead of http
node test/play-lbd.js 1              # LBD 1
node test/play-lbd.js 2 --wrong      # mis-drop on purpose (the nudge path)
node test/play-lbd.js 2 --throttle 6 # slow the CPU 6x — tight timers slip
```

`audit.js` and `check-media.js` exit non-zero on failure, so either can gate a release.

Screenshots go to `test/shots/` (gitignored, overwritten each run). **Look at them.**
That is the point — half the bugs found here were visual.

## Test BOTH environments

They genuinely differ, and a bug can exist in one and not the other:

- **`file://`** — the double-click path. `document.fullscreenEnabled` is **false**
  inside a `file://` iframe, so the games never go fullscreen here.
- **`http://localhost`** — the Vercel path, and the only one where the fullscreen
  switch actually happens.

## Traps these scripts already avoid

Each cost a wrong diagnosis at least once. If you write a new script, keep them in mind.

- **`page.screenshot()` awaits a paint**, so it can *never* catch a mid-transition
  frame. Use `H.startScreencast()` (CDP) for anything animated.
- **A resting mouse pointer turns pages by itself.** A peel completes at only 15%
  (`prog > 0.15`), and a finished game's frame is pointer-transparent. Call
  `H.parkMouse(page)` before sampling, or you will "find" a bug that is your cursor.
- **`<audio>.duration` on a streamed `.ogg` is `Infinity`** — with
  `preload="metadata"` *and* `preload="auto"`. Ogg carries no duration in a header
  and Chromium will not read to the last page for it. Range support does **not**
  fix this (it was assumed to, and does not). Use `H.clipDuration()`, which fetches
  through a `blob:` URL — the same thing the games' own preloaders do, which is why
  they get real durations at runtime.
- **`flipped` is a `let`**, so it is *not* on `window`. Read the current page from
  the DOM: `document.querySelectorAll("#flipbook .leaf.flipped").length`.
  `goNext()` and `dialogueDone()` *are* top-level function declarations, so they
  are global — and `goNext()` refuses to act until the page's cue has completed, so
  call `dialogueDone(n)` first. `H.gotoPage()` handles this.
- **Check the element that actually animates.** `.page-iris` is static by design
  (`--isize` always 40%, opacity always 1); the animation is on the inner `<i>`,
  switched by `.closing`. Sampling the wrapper makes a working iris look frozen.
- **Watch a page's media while that page is still open.** Checking the iris after
  turning on finds an unloaded video and reports a false failure — this script did
  exactly that on its first run.
- **Start the server with the harness**, not with `&` in a shell — a backgrounded
  compound command dies when the calling shell exits. `H.ensureServer()` handles it.
- **You cannot hear audio.** Verify it through durations, `play`/`ended` events, or
  decoded samples. Never assume a clip was audible.

## Known, deliberately not "fixed"

- `Allow attribute will take precedence over 'allowfullscreen'` — the game iframes
  carry both on purpose; `allowfullscreen` is the fallback for browsers without
  `allow`. Harmless.
- `assets/pages/Page N.mp4` appearing as failed requests — the engine aborting
  in-flight range requests as it unloads a video on a page turn. Every file exists.
  `H.watch()` reports these separately as `aborted`.
