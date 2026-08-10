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

  // The Play button on the closed cover — tapping it opens the book.
  //   playButton : the button artwork (any image in assets/).
  //   playAt     : where it sits, as a % of the cover. Put it over a calm part of
  //                your cover art — here the cauldron's black belly, clear of the
  //                title, both characters and the bubbling juice.
  playButton: "assets/wish button.svg",
  playAt: { x: "50%", y: "77%" },

  // The pointing hand for the cues that point INTO a page's illustration — the
  // "tap the screen" cue and the POUR hint. Remove this line and they fall back
  // to the engine's plain white hand.
  // NOT the book-flip nudge: that hand (on the page's corner, alongside the
  // arrow) is always the plain white one, because it's about the book rather
  // than the story happening inside it.
  handNudge: "assets/pages/hand nudge.webp",

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

     Pages 5 and 6 are multi-scene; page 6 ends in the interactive POUR game.
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
