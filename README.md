# Flipbook Template

An interactive 3D storybook that runs in any browser — no build step, no
frameworks. Open `index.html` and press **Play** to read.

To make your **own** story you only touch the content; the book design, page-flip
physics, buttons, and dialogue animations all stay exactly as they are.

---

## Make your own story in 3 steps

### 1. Add your art
Drop your scene images (and any videos) into **`assets/pages/`**, and your
cover image into **`assets/`**. Any file names are fine — you'll point to them
in step 3.

### 2. Add your music (optional)
Put a background-music file into **`sfx/`**.

### 3. Edit `story.js`
This is the **only file you edit**. Set the cover, the music, and the pages:

```js
window.STORY = {
  cover: "assets/my-cover.png",
  playButton: "assets/play button.svg",   // the Play button artwork
  playAt: { x: "50%", y: "77%" },         // where it sits on the cover
  music: "sfx/my-music.mp3",              // remove this line for a silent book
  pages: [ /* your pages … */ ]
};
```

**Cover art:** use a **16:9** image. The cover board's art window is exactly 16:9,
so a 16:9 file fills it with nothing cropped or stretched.

**The Play button** is your own artwork (`playButton`) — the engine just places it,
sizes it and gives it a slow breathing pulse. `playAt` positions it as a % of the
cover; put it over a calm part of the illustration, since it covers whatever is
behind it. It's the only thing on the cover that responds: taps elsewhere do
nothing, and keyboard users can Tab to it and press Enter.

Each page is one screen of the book. A page can be a single picture with a
speech bubble, or several **scenes** that cross-dissolve into each other:

```js
{ type: "image", scenes: [
    { src: "assets/pages/scene1.png",
      bubble: { kind: "speech", text: "Hello!\nWelcome.",
                box: { top: "20%", left: "8%", w: 240 } } },
    { src: "assets/pages/scene2.png", fx: "sparkle",
      bubble: { kind: "speech", text: "Let's go!", flip: true,
                box: { top: "12%", right: "6%", w: 200 } } },
] },
```

Keep the last page as `{ type: "end" }` — it's the closing "The End" page.

`story.js` has full inline notes for every option (bubble position, line
breaks, timing, effects). Quick reference:

| Field | What it does |
|-------|--------------|
| `src` | the scene image or video |
| `hold` | ms to stay on a scene before it dissolves onward |
| `fx` | ambient animation: `"popcorn"`, `"scan"`, `"sparkle"`, `"shake"`, or `{ type:"pulse", x, y }` |
| `tap` | **wait for the reader here** — see below |
| `bubble.text` | the words — use `\n` to choose line breaks |
| `bubble.box` | `{ top / left / right / bottom, w }` — position (%) + width in book px (book is 1280×720) |
| `bubble.flip` | `true` mirrors the bubble so the tail points the other way |
| `bubble.typeSpeed` | ms per typed character (default 45) |

### Make the reader do something

Put `tap` on a scene and the page **stops there** until the reader taps. The scene
plays out, then a pulsing gold ring and a tapping hand appear over the thing to
tap — and only a tap moves the story on:

```js
{ scenes: [
    { src: "assets/pages/machine-idle.mp4",        // …plays, then waits
      tap: { at: { x: "47%", y: "54%" }, size: 150,
             label: "Tap the POUR button" } },
    { src: "assets/pages/machine-pours.mp4" },     // …runs when they tap
] },
```

| Field | What it does |
|-------|--------------|
| `tap.at` | where the cue sits — `{ x, y }` as CSS % of the page |
| `tap.size` | cue diameter in book px (default 132) |
| `tap.after` | ms into the clip to show the cue (default: when the clip ends) |
| `tap.anywhere` | `true` → no targeting ring, just a tapping hand ("tap the screen", not "tap this thing") — place `at` on open space |
| `tap.label` | what a screen reader announces |

Set `tap.after` when the clip has a quiet tail — otherwise the reader sits looking
at a still frame with nothing to do. Time it to the end of the narration.

A tap **anywhere on the page** counts, so a small child never has to aim
accurately — the ring just shows where to look. Swipes don't count (so a reader
can still drag the page), and the page can't be turned forward past an
interaction, only back.

### The pour mini-game

A scene can also be a small POUR interaction instead of a clip: a machine, a
POUR button and a glass — each tap pours one shot (stream, splash, the liquid
rises smoothly) until the glass is full, and only then can the page be turned:

```js
{ pour: {
    bg: "…", machine: "…", button: "…",       // your artwork
    machineAt: { x: "36%", y: "12%", w: "27%" },  // % of the page
    buttonAt:  { x: "47%", y: "50%", w: "6%"  },
    glassAt:   { x: "47%", y: "66%", w: "6%"  },
    stream: { x: "50%", top: "60%", h: "8%" },    // spout → glass mouth
    juice: "#F27FBE",
    taps: 4,                                   // 4 taps = full (2 = half-style)
    // sound: "sfx/pour.mp3",                  // optional pour SFX
} },
```

A gold ring + hand shows on the button when it unlocks and again after ~9s of
idling. Leaving the page empties the glass, so a revisit replays the scene.

---

## The table scene (where the book sits)

The closed book lies on a **Halloween desk** and **drops onto it** when the page
loads: it falls in from close to the camera, lands with a small squash-and-settle,
and a puff of dust bursts out from under its bottom edge.

All of it is **one `<style>` block in `index.html`** plus the `.dust-burst`
markup inside the book stage — nothing in `engine/` is involved. Delete those two
pieces and you're back to the engine's starlit-night background.

| To change… | Edit |
|---|---|
| the desk | `assets/table.png` — and re-make `table.webp` from it (the CSS loads the webp; the PNG is 14× heavier) |
| how hard it lands | the `bookDrop` keyframes — `scale(2.35)` is the drop height, the `66%` stop is the impact |
| the dust | the `<i>` elements in `.dust-burst` — `--x/--y` where a puff starts, `--dx/--dy` how far it drifts, `--s` its size, `--j` its delay |

Two things to know if you move the dust: the closed book's board **overhangs the
book area by about 48px**, so a puff placed at `--y:100%` is hidden *behind* the
book — the bottom row sits at `99–104%`. And puffs need to be large (50–120px)
and drift only a little, or they read as specks on the desk instead of dust
kicked up by a landing book.

Readers who ask for reduced motion get the book already resting on the desk, with
no drop and no dust.

## Folder structure

```
index.html      ← open this to read (don't edit)
story.js        ← ★ EDIT THIS: your pages, dialogues, cover, music
README.md       ← this file
assets/
  Cover page.jpg    ← ★ your cover (16:9)
  play button.svg   ← ★ your Play button artwork
  table.png         ← ★ the desk the book lies on (table.webp is what loads)
  pages/            ← ★ your scene images & videos
  posters/pages/    ← first-frame stills, one per video (see Notes)
sfx/
  BG Music.mp3      ← ★ your background music
  Page flip.mp3     ← page-turn sound (engine)
  cover page flip.mp3
engine/           ← ⚙ the book itself — do NOT edit
  script.js         flip engine + dialogue/scene player
  styles.css        book design, theme, animations
  gsap.min.js       page-flip physics
  sfx-data.js        built-in flip sound data
  speech_bubble.png  dialogue bubble art
  Button.svg         spare arrow art
```

## How the book behaves (built-in UX)
- **Every open is a fresh read.** The book always starts at page 1 with every
  page gated, no matter what happened last time. Within one sitting, pages
  already watched don't re-lock, so flipping back and forth is instant.
- **The music ducks under narration** and swells back between pages.
- **If the browser blocks sound**, the page plays silently and a small "Tap the
  page for sound" chip appears — one tap fixes it.
- **The screen won't go to sleep** mid-story on devices that support wake locks.
- A page can only be turned once its clip has finished; the forward arrow appears
  and blinks at that moment. Going back is always allowed, and a page you've
  already watched never re-locks.

## Putting it on phones & tablets
Double-clicking `index.html` only works on a computer. **iPhones and iPads cannot
open a local HTML file** — tapping it in the Files app shows a dead preview, not
the book. To read on a phone, the book must live at a URL:

1. Push this folder to a GitHub repository.
2. Repo **Settings → Pages → Deploy from a branch → `main`, `/ (root)` → Save**.
3. After a minute the book is live at `https://<user>.github.io/<repo>/` —
   open that in Safari/Chrome on any device. (Any static host works the same:
   Netlify, Vercel, itch.io…)

**If something misbehaves on a phone**, open the book with `#debug` added to the
URL (`…/index.html#debug`): a panel on the page itself shows every error, failed
file load and warning — no computer needed. Tap the panel to hide it.

## Notes
- **Video pages need a poster.** For every `assets/pages/X.mp4` the book looks for
  `assets/posters/pages/X.webp` — the clip's **frame 0**, shown until playback
  starts so a page is never blank. It must be frame 0, or the page visibly jumps
  when the video begins. Missing posters only cost you that (harmless 404s).
- Speech bubbles use Poppins SemiBold; the text size is fixed by the theme.
- Only put a bubble where the speaker is visible on screen — off-screen /
  narrator lines are meant to be voice-over only (leave the bubble off and use
  `hold` to give the scene time).
- The book is landscape; on phones/tablets it asks the reader to rotate.
#   G l a s s - h a l f - f u l l - f l i p b o o k  
 