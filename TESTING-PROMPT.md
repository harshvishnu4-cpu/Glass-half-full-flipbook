# Prompt: play-test a game or book and fix what's broken

Paste this into a fresh Claude Code session on any browser-based project. Fill in
the three bracketed lines and it works as-is.

For *this* project the harness already exists — see [test/README.md](test/README.md)
and just say **"run the test suite in `test/` and fix what it finds"**.

---

## The prompt

```
Play-test this project in a real browser and fix what you find.

PROJECT: [path or repo, e.g. d:\My Other Book]
HOW TO OPEN IT: [index.html by double-click / npm run dev / a URL]
HOW TO REACH THE INTERESTING PARTS: [e.g. "click Play, then drag the
  glasses to the trays" — or "I don't know, work it out"]

Don't reason about the code alone. Run it:

- Drive my installed Edge with playwright-core:
  executablePath "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: false,
  args: ["--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required"]
  (If that path doesn't exist, find the installed browser or use channel: "msedge".)
  Install it with `npm install playwright-core` in a test folder, gitignored — no
  browser download is needed, and it must not become a dependency of the project.
- If it ships as static files, test BOTH environments — they behave differently:
  file:// (the double-click path) and http://localhost via a small static server
  (the hosted path). Fullscreen, for instance, is refused inside a file:// iframe.
- Start the server as a real background process, not with "&" in a shell — a
  backgrounded compound command dies when the calling shell exits.

Then work in this order:

1. BASELINE. Load every screen and log every failed request, 404 and JS/console
   error. Fix the real ones. Tell benign aborted requests (media unloaded on
   navigation) apart from genuine misses.
2. PLAY IT. Drive the real flow with clicks, drags and taps, all the way to the
   end. Script whatever is needed to reach later states. Try the failure paths
   too: wrong answers, rapid taps, replay, resize.
3. LOOK AT IT. Screenshot key moments and read them back as images. For anything
   animated use CDP Page.startScreencast — page.screenshot() waits for a paint, so
   it can never catch a mid-transition frame.
4. MEASURE, DON'T GUESS. Before fixing anything, prove the cause with a
   measurement, and sanity-check the measurement itself with a control that must
   give a different answer. If a diagnosis doesn't survive, discard it and say so.
   Never fix a theory.
5. FIX AND RE-VERIFY the same way you found it. Keep each fix small, and make one
   git commit per fix stating what was measured.
6. REPORT HONESTLY: what you fixed, what you checked that turned out fine, and
   anything you could NOT reproduce — plus what you'd need from me to pin it down.
   Don't claim a fix for something you never reproduced.

Watch for these — every one caused a wrong diagnosis on my flipbook project:

- A resting mouse pointer can trigger drag or swipe gestures and look exactly like
  a product bug. Park it away from the content before sampling.
- You cannot hear audio. Verify it via durations, play/ended events or decoded
  samples — never assume a clip was audible.
- A streamed .ogg reports duration: Infinity, with preload="metadata" AND "auto".
  Fetch it through a blob: URL to get a real duration.
- Hard-coded setTimeout values that "should be long enough" for a clip or an
  animation. Measure the real duration and check the margin; drive off completion
  events instead of guesses.
- Comparing "the object exists" with "the user can see it". Check what is painted.
- Sampling a wrapper element when the animation is on a child.
- Checking a page's media after navigating away from that page.
- Codec fallbacks: Safari before 17 cannot play Ogg Vorbis and its WebM support is
  patchy, so every .ogg wants an .m4a sibling and every .webm an .mp4. The failure
  is silent — no console error, just no sound on an iPad.

Finally, save the harness in a test/ folder with a README so it is reusable, and
record the setup and any non-obvious traps in memory.
```

---

## Variants

**When you've already spotted a specific bug** — add this at the top. Much faster
than a blind sweep:

```
SPECIFICALLY: I saw [what you saw] on [which screen], in [file:// or the hosted
build], on [desktop/tablet/phone]. Reproduce that first, before anything else. If
you can't reproduce it after a genuine attempt, say so — don't fix something
adjacent and call it done.
```

**For a quick check rather than a full audit** — replace steps 1–6 with:

```
Load it, play through once in a real browser, screenshot each screen and look at
the shots, and report every error plus anything visually wrong. Fix only what you
can prove. Don't refactor.
```

**For a release gate:**

```
Run the test suite and report pass/fail only. Change nothing. If something fails,
show me the measurement, not a fix.
```

## Adapting it

- The Edge path is specific to this machine — keep it here, drop it elsewhere.
- Drop the `file://` half if the project only ever runs from a server.
- For non-browser projects (Node, Python, a CLI) delete the browser setup
  entirely. Steps 4, 5 and 6 are the part that matters.
- The "watch for these" list is the valuable part. It is not generic advice —
  each line is a mistake that actually happened, and each one cost real time.
