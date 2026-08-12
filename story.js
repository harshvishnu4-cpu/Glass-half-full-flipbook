/* ============================================================================
   ██  YOUR STORY  —  this is the ONLY file you edit to make a new flipbook  ██
   ----------------------------------------------------------------------------
   Change the cover, the music, and the pages below. Put your scene images and
   videos in  assets/pages/  and your cover in  assets/  , your music in  sfx/ .
   You never need to touch anything in  engine/  ,  index.html  , or the CSS.

   HOW A PAGE WORKS
   ----------------------------------------------------------------------------
   • Each entry in `pages` is ONE page of the book, shown in order after the
     cover. A page is either a single image/video, or a list of `scenes` that
     cross-dissolve into each other (1.1s) on the same page.

   • A scene:  { src, hold, fx, tap, bubble }
       src    : the image ("assets/pages/x.png") or video (".mp4"/".webm").
       hold   : ms to linger before dissolving to the next scene
                (default 1600; a video with no hold advances when it ends).
       fx     : optional ambient animation over the art —
                "popcorn" | "scan" | "sparkle" | "shake"
                | { type:"pulse", x:"48%", y:"62%" }  (a glow at a point)
       tap    : make the page WAIT FOR THE READER here. The scene plays out, then
                a pulsing ring + hand appears and the next scene runs only when
                the reader taps. A tap ANYWHERE on the page counts.
                  tap: { at: { x:"47%", y:"54%" }, size: 150, after: 4800,
                         label: "Tap it!" }
                at   — where the ring sits (CSS % of the page)
                size — ring diameter in book px (default 132)
                after— ms into the clip to show the ring. Default: when the clip
                       ends. Set this if the clip has a long quiet tail, so the
                       reader isn't left waiting with nothing to do.
                label— what a screen reader announces
       bubble : optional speech bubble (below).
       pour   : an INTERACTIVE scene instead of src — the reader taps a POUR
                button to fill a glass, one shot per tap; the page can only be
                turned once the glass is full. See PAGE 6 below for a live
                example with every field. Fields: bg / machine / button (image
                paths), machineAt / buttonAt / glassAt ({x,y,w} in % of the
                page), stream ({x,top,h}), juice (colour), taps (to fill,
                default 4), sound (pour SFX per tap), fullSound (spoken line
                once the glass is full — the page unlocks after it finishes).

   • A single-image page (no scenes):  { type:"image", src, bubble }
     A single-video page:              { type:"video", src, delay, iris }
     A whole mini-game as a page:      { type:"game", src, title }
       src   : that game's own index.html — it is hosted in an iframe filling the
               page, so everything inside it (drags included) belongs to the game.
               Loaded only when the reader reaches the page, and unloaded when
               they leave, so it cannot keep playing behind a turned page.
       title : what a screen reader announces for the frame.
     iris (on a video page): { at, x, y, size } — closes the page to black around
       a circle centred on x/y, `size` wide (% of the page width), starting `at`
       ms into the clip. Used on the last page to hold the glass spotlit.

   • A speech bubble:  bubble: { kind:"speech", text, box, flip, typeSpeed }
       text     : the words. Use "\n" to choose where the line breaks.
       box      : { top / left / right / bottom, w } — position (CSS %) and
                  WIDTH in book-space px (the book is 1280 x 720).
       flip     : true → mirror the bubble so its tail points the other way.
                  Aim the tail tip at the speaking character's head.
       typeSpeed: ms per typed character (default 45) — lower = faster.

   • Last entry must be  { type: "end" }  — the closing "The End" page.
   ============================================================================ */
window.STORY = {
  // Cover art shown on the closed book (any image in assets/). Use a 16:9 image:
  // the cover board's art window is exactly 16:9, so a 16:9 file fits with no
  // cropping at all.
  cover: "assets/Cover page.jpg",

  // The Play button on the closed cover — tapping it opens the book.
  //   playButton : the button artwork (any image in assets/).
  //   playAt     : where it sits, as a % of the cover. Put it over a calm part of
  //                your cover art — here the cauldron's black belly, clear of the
  //                title, both characters and the bubbling juice.
  //   playSound  : the click it makes (any file in sfx/). Remove it and the engine
  //                falls back to its own synthesized pop, so the press is never
  //                silent.
  //   playSoundSkip : seconds of leading silence to skip. This recording has 100ms
  //                before the transient (measured); starting at 0 makes the button
  //                feel 100ms late.
  //   playSoundVolume : 0–1, default 0.4. The file is normalised to peak 1.0, and
  //                0.4 matches the weight of the cover-flip sound beside it.
  playButton: "assets/play button.svg",
  playAt: { x: "50%", y: "77%" },
  playSound: "sfx/play click (1).mp3",
  playSoundSkip: 0.1,

  // The pointing hand for the cues that point INTO a page's illustration — the
  // "tap the screen" cue and the POUR hint. Remove this line and they fall back
  // to the engine's plain white hand.
  // NOT the book-flip nudge: that hand (on the page's corner, alongside the
  // arrow) is always the plain white one, because it's about the book rather
  // than the story happening inside it.
  handNudge: "assets/pages/hand nudge.webp",

  // Looping background music (any file in sfx/). Removed at the author's request,
  // so the book is silent apart from each page's own narration and the SFX. Put a
  // line like this back to restore it:
  //   music: "sfx/BG Music.mp3",

  /* ── THE BOOK ────────────────────────────────────────────────────────────
     Each clip in assets/pages/ is one finished page: the art, the animation
     and the narration are all baked into the video, so a page here is just
     one line. They play in the order listed — the numbers in the file names
     are only labels, not the reader's page count.

     The reader can only turn a page once its clip has FINISHED: the forward
     arrow fades in, and a breath later ONE cue guides them — the arrow's gold
     glow, the hand on the page corner and a ghost page-peel, all together on the
     same beat. (The back arrow is always available.)

     Pages 5 and 6 are multi-scene; page 6 ends in the interactive POUR game.
     Pages 9 and 11 are the two LBD mini-games; page 12 closes with the iris.
     ──────────────────────────────────────────────────────────────────────── */
  pages: [
    { type: "video", src: "assets/pages/Page 1.mp4"  },   // 11s
    { type: "video", src: "assets/pages/Page 2.mp4"  },   // 17s
    { type: "video", src: "assets/pages/Page 3.mp4"  },   // 24s
    { type: "video", src: "assets/pages/Page 4.mp4"  },   // 16s

    // ── PAGE 5 — TAP THE POUR BUTTON ───────────────────────────────────────
    // Three clips on ONE page, cross-dissolving: the dragon mixes the juice, the
    // machine waits, and the reader has to TAP it to make it pour.
    //   `tap:` on the middle scene = the page STOPS there. A pulsing ring + hand
    //   appears over the POUR button and the story only continues when the reader
    //   taps (anywhere on the page counts, so a small child doesn't have to aim).
    //   Move the ring with `at` (% of the page) and `size` (ring px).
    //   `after: 4800` = show the ring 4.8s in, as soon as the clip's narration
    //   ends — the clip itself runs 7.6s, and waiting for all of it left the
    //   reader staring at a silent, still frame. Lower it to prompt sooner.
    { scenes: [
        // hold: 3600 — the clip is 4.6s but its narration ends at 2.5s, and its
        // LAST FRAMES ARE BLANK WHITE (an export glitch), so move on before then.
        { src: "assets/pages/Page 5.mp4", hold: 3600 },         // mixing the juice
        { src: "assets/pages/Page 5 part 2.mp4",                // waiting to be tapped
          // anywhere: the cue is a tapping hand on open space — NOT a ring on
          // the machine's POUR button, which is part 4's job. A tap anywhere on
          // the screen continues (it always did; the hint now says so).
          // after: the clip is 8.5s but its narration runs 0.8s→5.0s, so the cue
          // comes up at 5.1s — the moment the line lands, not 3.4s later when
          // the clip finally ends (and not at 4.8s, over the last word).
          // at: ON THE MACHINE (its centre in this clip is x 45.2%), not off in
          // the empty table space it used to sit in — a tap anywhere still
          // counts (`anywhere` drops the targeting ring), but the hand now
          // draws the eye to the thing the story is about. y 79% puts it low on
          // the machine, over the dispensing bay rather than across its middle.
          tap: { after: 5100, anywhere: true, at: { x: "45.2%", y: "79%" },
                 label: "Tap the screen to pour the juice" } },
        { src: "assets/pages/Page 5 part 3.mp4" },              // 8.5s — it pours
    ] },

    // ── PAGE 6: story clip, then POUR A GLASS (interactive) ────────────────
    // The 17s clip plays right through; when it ends, the page cross-dissolves
    // to the juice machine (the Figma "Page 5 part 4" design) and the reader
    // taps POUR to fill the glass — one shot per tap, 4 taps to the brim. The
    // page can only be turned once the glass is FULL. Positions are % of the
    // page (straight from the Figma frame).
    { scenes: [
        { src: "assets/pages/Page 6.mp4" },                     // advances when it ends
        { pour: {
            bg:      "assets/pages/pour/bg.webp",
            machine: "assets/pages/pour/machine.webp",
            button:  "assets/pages/pour/pour-button.webp",
            // ── ALIGNED TO THE CLIP ──────────────────────────────────────────
            // Page 6.mp4 ends on this same machine, so the cross-dissolve is
            // only invisible if the machine lands EXACTLY where the video left
            // it. These came from template-matching machine.webp against the
            // clip's final frame (best fit of x/y/width); the old values had it
            // 5.8% too far right, 3.8% too low and 6% too small, so the machine
            // visibly jumped and shrank at the hand-off. Everything below is
            // the same fit applied to each attached part, so the button, glass,
            // stream and stickers keep their positions ON the machine.
            machineAt: { x: "30.75%", y: "7.75%",  w: "28.50%" },
            buttonAt:  { x: "41.65%", y: "48.39%", w: "6.14%"  },
            glassAt:   { x: "41.88%", y: "65.71%", w: "6.31%"  },
            stream: { x: "45%", top: "59.21%", h: "8.5%" },
            juice: "#F27FBE",
            taps: 4,
            // "Tap the button to pour juice." — spoken as the scene arrives, and
            // the POUR button is DEAD until it finishes, so the instruction is
            // always heard before the first tap. Remove this line and the button
            // is live immediately, introduced only by the ring + hand.
            promptSound: "assets/audios/Tap the button to pour juice1.mp3",
            sound: "sfx/pour.wav",       // pour SFX per tap
            fullSound: "sfx/glass-full.wav",   // "This glass is filled all the way
                                     // up. It is full." — spoken once the glass
                                     // fills; the page unlocks after the line.
                                     // (wav twins of the .ogg sources, which are
                                     // silent on Safari/iOS.)
            // Stickers that pop AS THE LINE IS SPOKEN (time = ms into it, put on
            // the word it illustrates — the final "full" lands at ~5.4s): the
            // "Full" sticker, then the dashed arrow curling down to the glass.
            // (both PNGs are square canvases with the art floating in ~66% of
            // the width — the w values are the CANVAS size, so the visible art
            // is about two-thirds of each w.)
            // `emphasis` = this is the REWARD itself, so it gets a warm glow and
            // keeps gently pulsing after it lands (the arrow just points).
            pops: [
              { src: "assets/pages/full text.png", time: 5400,
                at: { x: "58.85%", y: "15.65%" }, w: "28.69%", emphasis: true },
              { src: "assets/pages/pointer.png",   time: 5600,
                at: { x: "46.63%", y: "34.77%" }, w: "34%" },
            ],
        } },
    ] },
    { type: "video", src: "assets/pages/Page 7.mp4"  },   // 8s
    { type: "video", src: "assets/pages/Page 8.mp4"  },   // 16s

    /* ── GAME 1 — after page 8 ──────────────────────────────────────────────
       A whole self-contained mini-game as a page: its own index.html, hosted in
       an iframe that fills the leaf.
         • Everything inside the frame belongs to the game, DRAGS INCLUDED — that
           isolation is why it is an iframe, so the book's drag-to-flip can never
           steal a drag from a drag-and-drop game.
         • The forward arrow is live as soon as the page lands, because neither
           game tells the book when it is finished. Nobody gets trapped in a game
           they cannot complete — but it also means the reader can leave early.
         • Leaving UNLOADS the game (it would otherwise keep narrating from behind
           a turned page), so returning restarts it. Same rule as the pour scene.
       `title` is what a screen reader announces for the frame. */
    { type: "game", title: "Pour the juice — game",
      src: "LBD/Glass half full LBD 1/index.html" },

    { type: "video", src: "assets/pages/Page 9.mp4"  },   // 31s

    // ── GAME 2 — after page 9 ───────────────────────────────────────────────
    // The sorting/serving game (drag glasses to the Empty / Half Full / Full
    // trays, then serve the customers). Same hosting rules as game 1 above.
    { type: "game", title: "Sort and serve — game",
      src: "LBD/Glass half full LBD 2/index.html" },

    // The last story page: the clip zooms into the full glass, then an IRIS
    // closes the page to black around it and holds it spotlit — the closing beat
    // before THE END. `at` is measured from the clip's own clock, and the circle
    // takes 1500ms to close (the .page-iris i transition), so `at` is set to land
    // that finish just under a second before the last frame.
    //
    // TIMED TO THE ZOOM, because the iris exists to focus attention on the glass —
    // so it should close WITH the camera pushing in, not after it has arrived.
    // Measured on this export by tracking the glass's width as a share of the frame:
    //   10.0s   7.5% wide   ← the push-in begins
    //   10.5s   8.8%
    //   11.0s  10.4%
    //   12.0s  18.8%
    //   12.5s  20.4%        ← arrived
    //   14.6s+ 19-20%       held to the last frame
    // So `at: 10000` starts the circle closing exactly as the zoom starts; it is
    // fully closed at ~11.5s and the glass then grows into the spotlight as the
    // camera finishes its push, settling at 12.5s and held to the end.
    // History, so it is not "corrected" backwards: 14600 (closed 16.5s, only 0.53s
    // of held spotlight) was far too late, and 12600 (closed 14.4s) still waited for
    // the zoom to finish before starting.
    // Note for anyone re-measuring: a colour scan of the juice reads as wildly
    // unstable from 13s on, because a purple smoke plume rises out of the glass and
    // gets counted. The glass itself does not move after 12.5s. Look at the frame.
    //
    // x/y RETUNED too, because this export does not zoom in as far as the old one
    // did. Measured off the closing frames: the juice's centroid is now
    // 50.5% / 66.9% and it spans y 45.9-84.4%, so the glass (rim above the juice,
    // base below) centres near y 62%. The old clip pushed the zoom much further —
    // its juice spanned y 0-83.7% at its closing moment — which is why y 49% framed
    // it then and cuts the glass off now: at 49% the circle ended at y 535px while
    // the glass reached 567px, so its base was clipped. 62% contains it (165-617px
    // against a glass of 214-567px).
    // size is the settled circle's diameter as a % of the page WIDTH: 40% ≈ 452px
    // against a glass ~282px wide and ~353px tall, so it still sits comfortably
    // clear on every side.
    { type: "video", src: "assets/pages/Page 10.mp4",     // 17.009s
      iris: { at: 10000, x: "49.5%", y: "62%", size: "40%" } },

    { type: "end" },   // ← keep this last: the closing "The End" page
  ]
};
