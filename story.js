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

   • A single-image page (no scenes):  { type:"image", src, bubble }
     A single-video page:              { type:"video", src, delay }

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

  // The book opens by PULLING THE SPIDER that hangs over the cover. This is where
  // it hangs at rest, as a % of the COVER ARTWORK: x across, y down from the top
  // of the art (the silk hangs from there). Pick a calm patch — the silk and the
  // spider cover whatever is behind them. This spot is the dark sky just left of
  // the title, so nothing in the artwork is hidden.
  hangAt: { x: "27.5%", y: "16%" },

  // Looping background music (any file in sfx/). Remove this line for silence.
  music: "sfx/BG Music.mp3",

  /* ── THE BOOK ────────────────────────────────────────────────────────────
     Each clip in assets/pages/ is one finished page: the art, the animation
     and the narration are all baked into the video, so a page here is just
     one line. They play in the order listed — the numbers in the file names
     are only labels, not the reader's page count.

     The reader can only turn a page once its clip has FINISHED: the forward
     arrow stays hidden while the video plays, then fades in and blinks gold, and
     the hand nudge appears on the page corner 2s later. (The back arrow is
     always available.)

     Page 5 is INTERACTIVE — it is three clips in one page (see `scenes` below).
     ──────────────────────────────────────────────────────────────────────── */
  pages: [
    { type: "video", src: "assets/pages/Page 1.mp4"  },   // 11s
    { type: "video", src: "assets/pages/Page 2.mp4"  },   // 18s
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
          tap: { after: 4800, at: { x: "46.7%", y: "53.5%" }, size: 150,
                 label: "Tap the POUR button to pour the juice" } },
        { src: "assets/pages/Page 5 part 3.mp4" },              // 8.5s — it pours
    ] },

    { type: "video", src: "assets/pages/Page 6.mp4"  },   // 17s
    { type: "video", src: "assets/pages/Page 7.mp4"  },   // 18s
    { type: "video", src: "assets/pages/Page 8.mp4"  },   // 16s
    { type: "video", src: "assets/pages/Page 9.mp4"  },   // 31s
    { type: "video", src: "assets/pages/Page 10.mp4" },   // 15s

    { type: "end" },   // ← keep this last: the closing "The End" page
  ]
};

/* ============================================================================
   The storyboard version of this book (still images + typed speech bubbles) is
   kept below for reference — it is INERT (the assignment above is what runs).
   Delete it once the video book is final.
   ============================================================================
window.STORY_STORYBOARD = {
  cover: "assets/Cover Page.webp",
  music: "sfx/BG Music.mp3",
  pages: [
    // ── PAGE 1: city → theatre → popcorn ──────────────────────────────────
    { type: "image", scenes: [
        { src: "assets/pages/page1.1.png", hold: 3500 },   // narrator (voice-over only)
        { src: "assets/pages/page1.2.png",
          bubble: { kind: "speech", text: "I am so excited\nfor the show!",
                    box: { top: "32%", left: "10%", w: 225 } } },
        { src: "assets/pages/page1.3.png",
          bubble: { kind: "speech", text: "But let us get\nsomething to eat first.", flip: true,
                    box: { top: "20%", left: "3%", w: 330 } } },
        { src: "assets/pages/page1.4.png", fx: "popcorn",
          bubble: { kind: "speech", text: "Popcorn jumping!\nPopcorn jumping!",
                    box: { top: "36%", left: "8%", w: 270 } } },
        { src: "assets/pages/page1.5.png",
          bubble: { kind: "speech", text: "This is going\nto be fun!",
                    box: { top: "8%", left: "59%", w: 200 } } },
    ] },
    // ── PAGE 2: in the auditorium — Byte senses something ─────────────────
    { type: "image", scenes: [
        { src: "assets/pages/page2.1.png", hold: 3500 },              // narrator VO
        { src: "assets/pages/page2.2.png", hold: 3000, fx: "scan" },  // Byte VO (off-screen)
        { src: "assets/pages/page2.3.png", hold: 2500, fx: "scan" },  // Byte VO (off-screen)
        { src: "assets/pages/page2.4.png", hold: 2500, fx: "scan" },  // Byte VO (off-screen)
        { src: "assets/pages/page2.5.png",
          bubble: { kind: "speech", text: "Error! Error!",
                    box: { top: "11%", left: "63%", w: 170 } } },
    ] },
    // ── PAGE 3: the necklace glows — Byte heads for the stage ─────────────
    { type: "image", scenes: [
        { src: "assets/pages/page3.1.png", hold: 2500,
          fx: { type: "pulse", x: "48%", y: "62%" } },              // necklace glow
        { src: "assets/pages/page3.2.png",
          bubble: { kind: "speech", text: "Byte?",
                    box: { top: "11%", left: "48%", w: 125 } } },
        { src: "assets/pages/page3.3.png",
          bubble: { kind: "speech", text: "BYTE!",
                    box: { top: "8%", left: "51%", w: 125 } } },
        { src: "assets/pages/page3.4.png",
          bubble: { kind: "speech", text: "Wait for me!",
                    box: { top: "10%", left: "36%", w: 185 } } },
    ] },
    // (page4 = suit-up video — art coming: "Alright!! Ready, steady, launch!")
    // ── PAGE 4 (art: page5.x): on stage — the scan verdict ────────────────
    { type: "image", scenes: [
        { src: "assets/pages/page5.1.png",
          bubble: { kind: "speech", text: "Byte, tell me\nwhat is wrong.",
                    box: { top: "9%", left: "47%", w: 218 } } },
        { src: "assets/pages/page5.2.png", hold: 2500, fx: "scan" },  // Byte VO (off-screen)
        { src: "assets/pages/page5.3.png", hold: 3000, fx: "scan" },  // Byte VO (off-screen)
        { src: "assets/pages/page5.4.png", hold: 4000 },              // narrator VO
        { src: "assets/pages/page5.5.mp4" },                          // narrator VO (video)
    ] },
    // ── PAGE 5 (art: page6.x): the batteries plan ────────────────────────
    { type: "image", scenes: [
        { src: "assets/pages/page6.1.png",
          bubble: { kind: "speech", text: "Look! These must\nbe the batteries.", flip: true,
                    box: { top: "12%", left: "45%", w: 262 } } },
        { src: "assets/pages/page6.2.png",
          bubble: { kind: "speech", text: "Let us use them to\ncharge the bots.", flip: true,
                    box: { top: "13%", left: "46%", w: 272 } } },
        { src: "assets/pages/page6.3.png",
          bubble: { kind: "speech", text: "Mission\naccepted.",
                    box: { top: "7%", left: "66%", w: 200 } } },
    ] },
    // ── PAGE 6 (art: page7.x): charged! …then chaos ──────────────────────
    { type: "image", scenes: [
        { src: "assets/pages/page7.1.png", hold: 3500, fx: "sparkle" },  // narrator VO
        { src: "assets/pages/page7.2.png", hold: 3000, fx: "shake" },    // SFX chaos
        { src: "assets/pages/page7.3.png",
          bubble: { kind: "speech", text: "Oh no! What\nis going on?", flip: true,
                    box: { top: "11%", left: "20%", w: 200 } } },
        { src: "assets/pages/page7.4.png",
          bubble: { kind: "speech", text: "Why is this\nhappening?",
                    box: { top: "11%", left: "58%", w: 200 } } },
    ] },
    // ── PAGE 7 (art: page8.x): wrong code → the fix plan ─────────────────
    { type: "image", scenes: [
        { src: "assets/pages/page8.1.png", hold: 3000, fx: "scan" },  // Byte VO (off-screen)
        { src: "assets/pages/page8.2.png",
          bubble: { kind: "speech", text: "Aha! Their codes\nare messed up.",
                    box: { top: "12%", left: "53%", w: 250 } } },
        { src: "assets/pages/page8.3.png",
          bubble: { kind: "speech", text: "Let us fix them.",
                    box: { top: "10%", left: "46%", w: 222 } } },
    ] },
    // ── PAGE 8 (art: page9.x): fixed! the show can begin ─────────────────
    { type: "image", scenes: [
        { src: "assets/pages/page9.1.png",
          bubble: { kind: "speech", text: "Yay! All fixed.",
                    box: { top: "11%", left: "49%", w: 200 } } },
        { src: "assets/pages/page9.2.png", hold: 3500 },              // narrator VO
    ] },
    // ── PAGE 9 (art: page10.x): choose a dance group → they perform ──────
    { type: "image", scenes: [
        { src: "assets/pages/page10.1.png", hold: 4000 },                 // narrator VO
        { src: "assets/pages/page10.2.png", hold: 3000, fx: "sparkle" },  // group 1
        { src: "assets/pages/page10.3.png", hold: 3000, fx: "sparkle" },  // group 2
    ] },
    // ── PAGE 10 (art: page11.x): they're dancing! …Byte? ─────────────────
    { type: "image", scenes: [
        { src: "assets/pages/page11.1.png",
          bubble: { kind: "speech", text: "Look, Byte! They\nare dancing.",
                    box: { top: "10%", left: "70%", w: 240 } } },
        { src: "assets/pages/page11.2.png",
          bubble: { kind: "speech", text: "Byte?",
                    box: { top: "10%", left: "49%", w: 125 } } },
    ] },
    // ── PAGE 11 (art: page12.x): Byte dances with the bots ───────────────
    { type: "image", scenes: [
        { src: "assets/pages/page12.1.mp4" },                         // video, advances on end
        { src: "assets/pages/page12.2.png", fx: "sparkle",
          bubble: { kind: "speech", text: "Nice moves\nByte!",
                    box: { top: "67%", left: "38%", w: 200 } } },
    ] },

    { type: "end" },
  ]
};
============================================================================ */
