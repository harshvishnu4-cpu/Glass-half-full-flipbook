# `dev/` — testing tools only

Everything in this folder exists so the book is easier to **test**. None of it
is part of the story, and none of it is loaded by the book itself — it is pulled
in by one `<script>` line in `index.html`.

## Delete it when you're done

1. Delete this whole **`dev/`** folder.
2. Delete the one line near the bottom of `index.html`:

```html
<script src="dev/dev-menu.js"></script>
```

That's the entire removal. Nothing in `engine/`, `story.js`, `assets/` or `sfx/`
was changed to add these tools, so taking them out cannot break the book.

---

## The page menu (`dev-menu.js` + `dev-menu.css`)

A hamburger button in the **top-left corner**. Open it and you get every page in
the book; click one and the book goes straight there.

- **The page you're on is highlighted** in amber, and the highlight keeps
  itself up to date — flip with the arrows while the menu is open and it
  follows along.
- **Picking a page closes the menu.**
- **Clicking anywhere outside closes it** — so does pressing `Esc`.
- **"Cover"** at the top shuts the book back to the start screen.
- Jumping works from anywhere, including from the closed cover — it opens the
  book for you first.

Pages that do more than play a clip are labelled, so you can find them quickly:
`3 scenes + tap` (page 5) and `2 scenes + pour` (page 6).

### How it drives the book without touching the engine

`engine/script.js` is a plain script, so its **functions** are global while its
**state variables** are not. The menu uses only that public surface:
`openBook()`, `goNext()`, `goPrev()`, `dialogueDone(i)`, `closeBookToCover()`.

Two consequences worth knowing if you ever edit this:

- **The current page isn't readable as a variable**, so the menu counts the
  leaves carrying the `.flipped` class. The engine applies that class the moment
  a turn *starts*, so the count is accurate immediately.
- **A jump is just repeated page turns.** Turning forward is normally blocked
  until the page's clip has finished, so before each forward hop the menu calls
  the engine's own `dialogueDone()` — the very same call the scene player makes
  when a clip genuinely ends. Nothing is bypassed or faked; the gate is released
  the way the engine intends.

While hopping, GSAP's global `timeScale` is raised (so ten pages take about a
second and a half instead of eleven seconds) and the clips it flies past are
muted, each one restored to its own previous setting afterwards. Both are undone
in a `finally` block, so an error mid-jump can't leave the book fast or silent.

You will see `net::ERR_ABORTED` for video files in the console during a long
jump. That is the browser cancelling clip loads for pages you skipped past —
expected, not an error.
