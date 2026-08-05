/* ============================================================================
   THE STORY NIGHT — flipbook behaviour.
   Diagnostic first: surface any REAL JavaScript error on screen (a silent error
   would stop the click handlers from ever attaching). Image / video / network
   load failures are ignored — they have no .message and are handled per-element.
   ============================================================================ */
window.addEventListener("error", function (ev) {
  if (!ev || !ev.message) return;                 // ignore resource-load errors
  var b = document.getElementById("__jsErr");
  if (!b) {
    b = document.createElement("div");
    b.id = "__jsErr";
    b.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:100000;" +
      "background:#b00020;color:#fff;font:13px/1.5 monospace;padding:10px;white-space:pre-wrap";
    (document.body || document.documentElement).appendChild(b);
  }
  b.textContent = "JavaScript error (this is likely why the book won't open):\n" +
    ev.message + "\n" + (ev.filename || "") + " : line " + ev.lineno;
});

// If you can read this line in the console, the script parsed with NO syntax
// error and you are running the CURRENT file (not a cached copy).
console.log("%c[flipbook] loaded — 3D book, full-bleed pages, speech bubbles.",
            "font-weight:bold;color:#7d5fd0;font-size:13px");

/* ---- ON-DEVICE DEBUG OVERLAY -------------------------------------------------
   Phones have no DevTools. Open the book with  #debug  on the URL
   (e.g.  https://…/index.html#debug ) and every error, rejected promise and
   console.error/warn is printed in an overlay on the page itself — so an
   iPhone-only problem can be READ on the iPhone. Costs nothing when off. */
(function () {
  if (window.location.hash.indexOf("debug") === -1) return;
  var box = document.createElement("div");
  box.style.cssText = "position:fixed;left:0;right:0;top:0;max-height:45%;overflow:auto;" +
    "z-index:100001;background:rgba(10,8,30,0.92);color:#9f9;padding:8px 10px;" +
    "font:11px/1.45 monospace;white-space:pre-wrap;pointer-events:auto";
  box.textContent = "[debug] flipbook " + new Date().toISOString() + "\n" +
    "[debug] " + navigator.userAgent + "\n[debug] viewport " +
    window.innerWidth + "x" + window.innerHeight + "  (tap this panel to hide)";
  box.addEventListener("click", function () { box.style.display = "none"; });
  function line(kind, msg) {
    box.style.display = "";
    box.textContent += "\n[" + kind + "] " + msg;
    box.scrollTop = box.scrollHeight;
  }
  (document.body || document.documentElement).appendChild(box);
  window.addEventListener("error", function (ev) {
    line("error", ev.message ? ev.message + " @ " + (ev.filename || "") + ":" + ev.lineno
                             : "resource failed: " + ((ev.target && (ev.target.src || ev.target.href)) || "?"));
  }, true);   // capture: resource-load failures (missing video/poster/css) land here too
  window.addEventListener("unhandledrejection", function (ev) {
    line("promise", (ev.reason && (ev.reason.message || ev.reason)) || "rejected");
  });
  ["error", "warn"].forEach(function (k) {
    var orig = console[k];
    console[k] = function () {
      line("console." + k, Array.prototype.slice.call(arguments).join(" "));
      return orig.apply(console, arguments);
    };
  });
})();

/* ============================================================================
   ██  THE STORY LIVES IN  story.js  —  edit THAT file, not this one  ██
   ----------------------------------------------------------------------------
   story.js sets  window.STORY = { cover, music, pages }.  Everything below is
   the reusable ENGINE — the book, the flip physics, the buttons, the
   dialogue/scene player. You should not need to touch it to make a new story.
   ============================================================================ */
const STORY = window.STORY || {};

// Cover art — themed from story.js so the whole book is configured in one place.
(function () {
  const ci = document.querySelector(".cover-img");
  if (ci && STORY.cover) ci.style.backgroundImage = "url('" + encodeURI(STORY.cover) + "')";
  // The Play button: its artwork (`playButton`) and where it sits on the cover
  // (`playAt`, % of the cover — every illustration has its clear space somewhere
  // different). Both optional; omitted → whatever index.html / the CSS default say.
  const pb = document.getElementById("hint");
  if (pb) {
    const art = pb.querySelector(".play-art");
    if (art && STORY.playButton) art.src = encodeURI(STORY.playButton);
    const at = STORY.playAt || {};
    if (at.x) pb.style.setProperty("--play-x", at.x);
    if (at.y) pb.style.setProperty("--play-y", at.y);
  }
})();
const pages = STORY.pages || [];   // ← the story's pages (defined in story.js)

/* ---- Build one page face's media (image OR video) ------------------------ */
function makeMedia(page) {
  const media = page.type === "video"
    ? document.createElement("video")
    : document.createElement("img");
  media.className = "page-media";
  media.draggable = false;                           // never let the image "ghost-drag" out
  media.addEventListener("dragstart", function (e) { e.preventDefault(); });
  media.src = page.src;
  if (page.type === "video") {
    media.loop = false;
    media.playsInline = true;
    media.setAttribute("playsinline", "");            // iOS Safari inline playback
    media.setAttribute("webkit-playsinline", "");
    // FIRST-FRAME POSTER: the page surface (--paper) is deep night-blue, so a video
    // that hasn't painted a frame yet (still buffering, or autoplay was blocked) would
    // show as a BLANK dark-blue page. The poster is that clip's own frame 0, so the
    // scene shows INSTANTLY and — because it equals where playback starts — there's no
    // jump when the video then plays. Posters are tiny (~40KB) and live in assets/posters/.
    media.setAttribute("poster",
      page.src.replace(/^assets\//, "assets/posters/").replace(/\.(mp4|webm)$/i, ".webp"));
    // LAZY: do NOT eager-buffer. With many videos, preload="auto" made the browser
    // open + decode every clip on load (huge memory/CPU spike + open lag). We only
    // buffer the page you're on + the next one, on demand (see warmVideo()).
    media.preload = "none";
    // Tapping the page RECOVERS SOUND if the browser blocked the auto-start's
    // audio — a tap is a user gesture, so play() with sound is allowed now.
    // It must never REPLAY the page: the bottom-right corner is exactly where the
    // hand nudge invites a tap and where a page-turn drag starts, and a finished
    // clip restarting under the reader's finger reads as a bug. So a clip that has
    // ended is left alone, and one already playing with sound is left alone too.
    media.addEventListener("click", function () {
      // A clip that has FINISHED is left alone — unless it played silently, in
      // which case the reader never heard the page and replaying it aloud is
      // exactly what they want.
      if (media.ended && !media.muted) return;
      if (!media.muted && !media.paused) return;    // already playing aloud → nothing to fix
      media.muted = false;
      hideSoundHint(media);                         // sound recovered → the rescue chip goes
      duckMusic(true);
      const p = media.play(); if (p && p.catch) p.catch(function () {});
    });
    // When THIS page's video FULLY finishes, the reader is TOLD they may turn:
    // the corner arrow fades in (dialogueDone → updateProgress) and blinks +
    // gold-glows for 2s, and the hand nudge on the page corner starts 2s later.
    // The blink fires ONCE per page arrival (armBlink) so a short clip won't
    // blink repeatedly, and is skipped on the last page.
    media.addEventListener("ended", function () {
      hideSoundHint(media);                    // a muted clip that ends takes its hint with it
      if (!opened || !ready) return;
      if (!leaves[flipped] || !leaves[flipped].contains(media)) return;   // only the current page
      duckMusic(false);                        // narration over → music swells back
      // THE CUE: the clip has played out → now the page may be turned.
      if (pages[flipped] && pages[flipped].scenes) {
        // …except on a SCENES page, where the page isn't finished until its LAST
        // scene ends — the scene player owns that call (seqDone → dialogueDone).
        // Bail out on the earlier clips, or they'd burn this page's one blink
        // (armBlink) at a moment when the arrow is still hidden.
        const layer = media.closest(".page-scene");
        const layers = leaves[flipped].querySelectorAll(".page-scene");
        if (!layer || layer !== layers[layers.length - 1]) return;
      } else {
        videoWatched[flipped] = true;            // seen in full → never re-gate it
        saveProgress();                          // the bookmark remembers it was watched
        dialogueDone(flipped);
      }
      if (flipped >= totalPages - 1) return;     // last page → nothing to turn to
      if (!armBlink || !cornerNext) return;      // already blinked for this visit
      armBlink = false;                          // one blink per page arrival
      cornerNext.classList.remove("blink1");
      void cornerNext.offsetWidth;               // restart the animation cleanly
      cornerNext.classList.add("blink1");
      setTimeout(function () { cornerNext.classList.remove("blink1"); }, 2050);
    });
  } else {
    media.decoding = "async";
    media.alt = page.alt || "story page";
  }
  return media;
}

/* ---- Build one speech bubble (hidden until the page fully lands) ---------
   The bubble artwork + crop live in styles.css (.bubble.neel / .bubble.everywhere).
   Here we only apply the per-page geometry (position, width, flip) + the text. */
function makeBubble(bubble) {
  const wrap = document.createElement("div");
  wrap.className = "bubble" + (bubble.kind ? " " + bubble.kind : "");

  const box = bubble.box || {};
  ["top", "left", "right", "bottom"].forEach(function (k) {
    if (box[k] != null) wrap.style[k] = box[k];
  });
  if (box.w != null) wrap.style.setProperty("--w", box.w + "px");

  // FIT: the bubble art is a wide flat rectangle, so at its natural aspect a
  // 1-2 line text leaves big margins above/below. Squash the art vertically
  // (--sq, used by .bubble.speech CSS) to comfortably wrap the text block:
  //   needed  = lines × line-height (--dialogue-fs 21.33px × 1.2) + padding
  //   natural = the art's body height (above the tail) at this width
  // The text itself NEVER scales (32 Semi Bold rule) — only the bubble does.
  if (bubble.kind === "speech" && bubble.text && box.w) {
    const lines = String(bubble.text).split("\n").length;
    const needH = lines * (32 * 2 / 3) * 1.2 + 42;   // keep font in sync with --dialogue-fs
    const artH  = box.w * 0.4405;
    wrap.style.setProperty("--sq", Math.max(0.7, Math.min(1, needH / artH)).toFixed(3));
  }

  const bg = document.createElement("div");
  bg.className = "bubble-bg" + (bubble.flip ? " flip" : "");
  wrap.appendChild(bg);

  if (bubble.text) {
    const t = document.createElement("div");
    t.className = "bubble-text";
    t.textContent = bubble.text;
    t.dataset.full = bubble.text;              // kept so the typewriter can replay
    if (bubble.textLeft) t.style.left = bubble.textLeft;
    if (bubble.textTop)  t.style.top  = bubble.textTop;
    if (bubble.fontSize) t.style.fontSize = bubble.fontSize;
    wrap.appendChild(t);
  }
  if (bubble.typeSpeed) wrap.dataset.typeSpeed = bubble.typeSpeed;   // ms/char
  return wrap;
}

/* ---- Build one SVG speech bubble (white + black outline + purple glow) -----
   cfg = { text, box:{top,left,right,bottom,w}, tail, rot, fontSize }
     box   : position of the bubble box + its WIDTH in book-space px
     tail  : "down" | "down-left" | "down-right"  (which way the tail points)
     rot   : tilt in degrees (optional)
   Hidden until the page lands (revealed by refreshMedia). */
const SBUB_TAILS = {
  "down":       "M42 57 L58 57 L50 73 Z",
  "down-left":  "M30 55 L47 59 L16 73 Z",
  "down-right": "M53 59 L70 55 L84 73 Z"
};
function makeSpeechBubble(cfg) {
  const wrap = document.createElement("div");
  wrap.className = "sbub";
  const box = cfg.box || {};
  ["top", "left", "right", "bottom"].forEach(function (k) {
    if (box[k] != null) wrap.style[k] = box[k];
  });
  if (box.w != null) wrap.style.setProperty("--sbw", box.w + "px");
  if (cfg.rot)       wrap.style.setProperty("--sbrot", cfg.rot + "deg");

  const tailPath = SBUB_TAILS[cfg.tail] || SBUB_TAILS.down;
  wrap.innerHTML =
    '<svg class="sbub-svg" viewBox="0 0 100 74" aria-hidden="true">' +
      '<g class="sbub-shape">' +
        '<path d="' + tailPath + '"/>' +
        '<ellipse cx="50" cy="32" rx="47" ry="29"/>' +
      '</g>' +
    '</svg>';

  const t = document.createElement("div");
  t.className = "sbub-text";
  t.textContent = cfg.text || "";
  if (cfg.fontSize) t.style.fontSize = cfg.fontSize + "px";
  wrap.appendChild(t);
  return wrap;
}

/* ---- Build one scene's ambient FX layer (fx: on a scene) -----------------
   Types: "scan" (pure CSS beam), "popcorn" (falling kernels), "sparkle"
   (gold twinkles), {type:"pulse", x, y} (breathing glow at a point),
   "shake" (whole-scene jitter — a class on the layer, no element).
   Particle positions/timings are randomized once at build; the loops are
   pure CSS so they cost nothing to run. */
function makeFx(fx, layer) {
  const cfg = typeof fx === "string" ? { type: fx } : fx;
  if (cfg.type === "shake") {                  // CSS on the layer's media
    layer.classList.add("fx-shake");
    return null;
  }
  const el = document.createElement("div");
  el.className = "fx fx-" + cfg.type;
  el.setAttribute("aria-hidden", "true");
  if (cfg.type === "popcorn") {
    for (let i = 0; i < 14; i++) {             // kernels spill from the machine
      const k = document.createElement("i");
      k.className = "fx-kernel";
      k.style.left = (24 + Math.random() * 46) + "%";
      k.style.top  = (26 + Math.random() * 10) + "%";
      k.style.animationDelay    = (Math.random() * 2.4).toFixed(2) + "s";
      k.style.animationDuration = (1.7 + Math.random() * 1.1).toFixed(2) + "s";
      k.style.setProperty("--kx", (Math.random() * 140 - 70).toFixed(0) + "px");
      k.style.setProperty("--kr", (Math.random() * 500 - 250).toFixed(0) + "deg");
      k.style.setProperty("--ks", (0.6 + Math.random() * 0.7).toFixed(2));
      el.appendChild(k);
    }
  } else if (cfg.type === "sparkle") {
    for (let i = 0; i < 12; i++) {
      const s = document.createElement("i");
      s.className = "fx-spark";
      s.style.left = (8 + Math.random() * 84) + "%";
      s.style.top  = (8 + Math.random() * 72) + "%";
      s.style.animationDelay    = (Math.random() * 2.8).toFixed(2) + "s";
      s.style.animationDuration = (1.5 + Math.random() * 1.4).toFixed(2) + "s";
      el.appendChild(s);
    }
  } else if (cfg.type === "pulse") {
    const p = document.createElement("i");
    p.className = "fx-glow";
    p.style.left = cfg.x || "50%";
    p.style.top  = cfg.y || "50%";
    el.appendChild(p);
  }
  return el;
}

/* ==========================================================================
   POUR SCENE  —  an interactive scene: the reader taps the POUR button and
   juice pours into a glass, one shot per tap, until it is full — then the
   page's sequence completes and the turn cue arms. Ported from the "Ready Set
   Serve!" pour mechanic (see pour-interaction.md): per tap —
     press-in (140ms) · stream (900ms one-shot) · 5 splash droplets (550ms) ·
     the liquid RISES smoothly (750ms) · optional pour sound, cut at 920ms.
   The liquid is the classic SVG-clip trick: the juice shape is painted once
   (a pink copy of the glass's front face) and a clipPath rectangle slides UP
   to reveal it — animated via a transform transition, which unlike the `y`
   geometry property animates everywhere, Safari included.
   Config (story.js): { bg, machine, button, machineAt, buttonAt, glassAt,
     stream:{x,top,h}, juice, taps, sound } — positions in % of the page, so
   the whole scene rides the book's one responsive scale.
   The scene player arms it when the scene lands (layer._pourArm), completion
   reports back through layer._pourDone, and resetScenes calls layer._pourReset
   so a revisit starts with an empty glass. */
/* The pointing hand, shared by the page-turn nudge, the tap hot-spot and the
   pour hint. Declared BEFORE the leaf builder — buildPourScene runs at load. */
const HAND_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#ffffff" ' +
  'd="M9 11.24V7.5C9 6.12 10.12 5 11.5 5S14 6.12 14 7.5v3.74c1.21-.81 2-2.18 ' +
  '2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 ' +
  '4.63l-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6C13 6.67 12.33 6 11.5 6S10 ' +
  '6.67 10 7.5v10.74l-3.44-.72c-.37-.08-.76.04-1.02.31l-1.04 1.05 5.19 ' +
  '5.19c.28.28.66.44 1.06.44h6.78c.75 0 1.38-.55 1.49-1.29l.77-5.44c.1-.72-.29-1.42-.95-1.71z"/></svg>';

let _pourSeq = 0;
function buildPourScene(layer, cfg) {
  const uid = "pour" + (++_pourSeq);           // cloned/multiple scenes must not share clip ids
  const STEP = 100 / Math.max(1, cfg.taps || 4);   // default: 4 taps = a full glass
  // The glass (from the Figma design's vector): rim ellipse over a tapering cup.
  // Liquid = the front-face path re-filled with juice colour, clipped by #fillClip;
  // the rim is drawn AFTER the liquid so the mouth always reads on top.
  const juice = cfg.juice || "#F27FBE";
  const CUP_FRONT = "M110.802 18.7536C110.802 18.7309 110.79 18.7104 110.769 18.7003C110.748 18.6896 110.725 18.6924 110.706 18.7053C102.859 24.4034 81.3011 28.2315 57.0632 28.2315C32.62 28.2315 11.0051 24.3608 3.27709 18.5993C3.25917 18.5859 3.23504 18.5838 3.21429 18.5935C3.19393 18.6033 3.18075 18.6236 3.18027 18.6462C2.74199 33.8219 5.84696 60.8215 11.6989 92.7214C16.361 118.135 21.9159 141.704 24.081 145.257C26.1417 148.642 32.4997 150.744 37.47 151.911C43.4108 153.306 50.7338 154.138 57.0584 154.138C68.9401 154.138 87.2315 151.382 90.6962 145.257C93.0902 141.025 98.2154 118.695 102.62 93.3144C107.943 62.6482 110.925 35.4717 110.802 18.7536Z";
  const CUP_BACK  = "M113.88 14.1724C113.878 14.14 113.846 14.1086 113.818 14.1149C113.785 14.1159 113.759 14.1427 113.759 14.1755C113.759 15.7223 112.741 17.2462 110.732 18.7051C110.716 18.7162 110.707 18.7348 110.707 18.7543C110.829 35.4657 107.848 62.6342 102.527 93.2939C98.1242 118.663 93.0045 140.976 90.6178 145.196C87.1763 151.281 68.9366 154.018 57.0845 154.018C45.9934 154.018 27.8754 151.214 24.2098 145.196C22.0514 141.65 16.5042 118.101 11.8438 92.6996C5.99325 60.8075 2.88878 33.8171 3.32705 18.6489C3.32755 18.6294 3.31854 18.6108 3.30291 18.5989C1.38905 17.1722 0.418468 15.6842 0.418468 14.1755C0.418468 14.1433 0.392974 14.1166 0.360883 14.1149C0.333063 14.1157 0.300878 14.1379 0.298066 14.1699C-1.56856 33.7284 5.81325 78.6279 9.07409 97.0241C14.5699 128.033 21.2135 157.333 23.5812 161.004C25.7657 164.39 32.1125 166.418 37.0523 167.52C43.0035 168.85 50.3066 169.613 57.0889 169.613C70.7436 169.613 87.0536 166.918 90.5973 161.002C93.2207 156.622 99.4901 128.928 104.871 97.9538C107.954 80.2061 115.004 36.5139 113.88 14.1724Z";
  const CUP_RIM   = "M97.2109 4.13631C86.4913 1.46885 72.2396 0 57.0812 0C41.9235 0 27.6718 1.46923 16.9523 4.13631C6.20722 6.81009 0.290068 10.3758 0.290068 14.1771C0.290068 15.7257 1.27674 17.2467 3.22312 18.6973C10.97 24.4729 32.6142 28.3535 57.0812 28.3535C81.343 28.3535 102.93 24.5158 110.795 18.8041C112.837 17.3212 113.872 15.7646 113.872 14.1771C113.872 10.3758 107.956 6.81009 97.2109 4.13631Z";
  const CUP_MOUTH = "M19.096 21.0888C29.2388 23.1466 42.7238 24.2803 57.0671 24.2803C71.4102 24.2803 84.8951 23.1466 95.0377 21.0888C105.208 19.0249 110.81 16.2689 110.81 13.3273C110.81 10.3858 105.208 7.62922 95.0377 5.56567C84.8951 3.50767 71.41 2.37404 57.0671 2.37404C42.7238 2.37404 29.2388 3.50767 19.096 5.56567C8.92507 7.62922 3.32394 10.3858 3.32394 13.3273C3.32394 16.2689 8.92507 19.0249 19.096 21.0888Z";
  const TOP_Y = 33, BOT_Y = 152;               // liquid surface y at 100% / 0% (cup space)
  const at = function (o, dw) {                // config position → inline % styles
    return "left:" + (o && o.x || "0%") + ";top:" + (o && o.y || "0%") +
           ";width:" + (o && o.w || dw) + ";";
  };
  const st = cfg.stream || {};
  layer.classList.add("pour-scene");
  layer.innerHTML =
    '<img class="pour-bg" alt="" draggable="false" src="' + encodeURI(cfg.bg || "") + '">' +
    '<img class="pour-machine" alt="" draggable="false" style="' + at(cfg.machineAt, "27%") + '" src="' + encodeURI(cfg.machine || "") + '">' +
    '<div class="pour-stream" style="left:' + (st.x || "50%") + ";top:" + (st.top || "60%") +
        ";height:" + (st.h || "8%") + ';background:linear-gradient(180deg,' +
        juice + '00 0%,' + juice + ' 22%,' + juice + ' 100%)"></div>' +
    '<svg class="pour-glass" style="' + at(cfg.glassAt, "6%") + '" viewBox="0 0 114 169.613" aria-hidden="true">' +
      '<defs><clipPath id="' + uid + 'clip">' +
        '<rect class="pour-level" x="0" y="0" width="114" height="169.613" style="transform:translateY(' + BOT_Y + 'px)"/>' +
      '</clipPath></defs>' +
      '<path d="' + CUP_BACK + '" fill="#DFDAD0"/>' +
      '<path d="' + CUP_FRONT + '" fill="#EAE7E0"/>' +
      '<g clip-path="url(#' + uid + 'clip)">' +
        '<path d="' + CUP_FRONT + '" fill="' + juice + '"/>' +
      '</g>' +
      '<ellipse class="pour-surface" cx="57" cy="0" rx="52" ry="7" fill="' + juice + '" ' +
        'style="filter:brightness(1.18);transform:translateY(' + BOT_Y + 'px) scaleX(0.64);opacity:0"/>' +
      '<path d="' + CUP_RIM + '" fill="#F8FBF6"/>' +
      '<path d="' + CUP_MOUTH + '" fill="#DFDAD0"/>' +
    '</svg>' +
    '<button class="pour-btn" type="button" disabled aria-label="Pour the juice" ' +
        'style="' + at(cfg.buttonAt, "6%") + '">' +
      '<img alt="" draggable="false" src="' + encodeURI(cfg.button || "") + '">' +
    '</button>' +
    // the "tap here" ring + hand, reusing the scene-tap look (pointer-through);
    // centred on the BUTTON: x + w/2 across, and half the button's height down
    // (the art is roughly square, so w/2 of the PAGE ≈ h/2 once aspect-corrected
    // by the 16:9 page box — close enough for a hint that only says "look here")
    '<span class="scene-tap-spot pour-hint" style="left:' +
        (parseFloat(cfg.buttonAt && cfg.buttonAt.x || 47) + parseFloat(cfg.buttonAt && cfg.buttonAt.w || 6) / 2).toFixed(2) +
        "%;top:" +
        (parseFloat(cfg.buttonAt && cfg.buttonAt.y || 50) + parseFloat(cfg.buttonAt && cfg.buttonAt.w || 6) * 16 / 18).toFixed(2) +
        '%;--spot:112px;opacity:0">' +
      '<span class="scene-tap-ring"></span>' +
      '<span class="scene-tap-hand">' + HAND_SVG + "</span>" +
    "</span>";

  const btn     = layer.querySelector(".pour-btn");
  const streamEl= layer.querySelector(".pour-stream");
  const levelEl = layer.querySelector(".pour-level");
  const surfEl  = layer.querySelector(".pour-surface");
  const hintEl  = layer.querySelector(".pour-hint");
  const sound   = cfg.sound ? new Audio(encodeURI(cfg.sound)) : null;
  if (sound) sound.preload = "auto";
  layer._pourSound = sound;                    // exposed for the headless tests

  let fillPct = 0, complete = false, timers = [], idleTimer = null;
  const wait = function (fn, ms) { timers.push(setTimeout(fn, ms)); };
  const showHint = function (on) { if (hintEl) hintEl.style.opacity = on ? "1" : "0"; };
  function armIdleHint() {                     // md: re-arm after EVERY pour, so the
    clearTimeout(idleTimer);                   // window always measures true idleness
    idleTimer = setTimeout(function () {
      if (!complete && !btn.disabled) showHint(true);
    }, 9000);
  }
  function setJuice(pct) {
    const f = Math.max(0, Math.min(1, pct / 100));
    const y = BOT_Y - f * (BOT_Y - TOP_Y);
    levelEl.style.transform = "translateY(" + y.toFixed(1) + "px)";
    // the surface ellipse rides the level; the cup tapers, so it narrows going down
    const k = 0.64 + 0.36 * ((BOT_Y - y) / (BOT_Y - TOP_Y));
    surfEl.style.transform = "translateY(" + y.toFixed(1) + "px) scaleX(" + k.toFixed(3) + ")";
    surfEl.style.opacity = f > 0.01 ? "1" : "0";
  }
  function pour() {
    if (complete || btn.disabled || fillPct >= 100) return;
    showHint(false);
    armIdleHint();
    btn.classList.add("pressed");              // touch gets the same feedback as :active
    wait(function () { btn.classList.remove("pressed"); }, 140);
    if (sound) {                               // every play() catch-wrapped (autoplay policies)
      try { sound.currentTime = 0; var p = sound.play(); if (p && p.catch) p.catch(function () {}); } catch (_) {}
    }
    streamEl.classList.remove("pouring");      // restart pattern: works mid-animation
    void streamEl.offsetWidth;
    streamEl.classList.add("pouring");
    wait(function () {
      streamEl.classList.remove("pouring");
      if (sound) { try { sound.pause(); sound.currentTime = 0; } catch (_) {} }
    }, 920);
    spawnSplash();
    fillPct = Math.min(fillPct + STEP, 100);
    setJuice(fillPct);
    if (fillPct >= 100) {                      // full = locked, permanently (allowPour rule)
      complete = true;
      btn.disabled = true;
      clearTimeout(idleTimer);
      // let the stream fade + the liquid finish rising, hold the full glass a
      // beat, THEN hand the page back to the scene player (turn cue arms).
      wait(function () { if (layer._pourDone) layer._pourDone(); }, 1500);
    }
  }
  function spawnSplash() {                     // 5 throwaway droplets at the mouth
    const gx = parseFloat(cfg.glassAt && cfg.glassAt.x || 47),
          gw = parseFloat(cfg.glassAt && cfg.glassAt.w || 6),
          gy = parseFloat(cfg.glassAt && cfg.glassAt.y || 66);
    for (let i = 0; i < 5; i++) {
      const d = document.createElement("div");
      d.className = "pour-splash";
      d.style.background = juice;
      const sz = 6 + Math.random() * 8;        // book px (the layer scales with the book)
      d.style.width = d.style.height = sz.toFixed(0) + "px";
      d.style.left = (gx + gw * (0.3 + Math.random() * 0.4)) + "%";
      d.style.top  = (gy + 1 + Math.random() * 2) + "%";
      d.style.setProperty("--dx", ((Math.random() * 2 - 1) * 40).toFixed(0) + "px");
      d.style.setProperty("--dy", (-(18 + Math.random() * 28)).toFixed(0) + "px");
      layer.appendChild(d);
      timers.push(setTimeout(function () { d.remove(); }, 560));
    }
  }
  btn.addEventListener("click", function (e) { e.stopPropagation(); pour(); });

  layer._pourArm = function () {               // the scene has landed → the reader may pour
    if (complete) { if (layer._pourDone) layer._pourDone(); return; }
    btn.disabled = false;
    showHint(true);                            // no narration introduces POUR — the ring does
    armIdleHint();
  };
  layer._pourReset = function () {             // leaving the page → empty glass next visit
    timers.forEach(clearTimeout); timers = [];
    clearTimeout(idleTimer);
    fillPct = 0; complete = false;
    btn.disabled = true;
    btn.classList.remove("pressed");
    streamEl.classList.remove("pouring");
    showHint(false);
    if (sound) { try { sound.pause(); sound.currentTime = 0; } catch (_) {} }
    layer.querySelectorAll(".pour-splash").forEach(function (d) { d.remove(); });
    const t = levelEl.style.transition, t2 = surfEl.style.transition;
    levelEl.style.transition = "none"; surfEl.style.transition = "none";   // reset without a visible drain
    setJuice(0);
    void layer.offsetWidth;
    levelEl.style.transition = t; surfEl.style.transition = t2;
  };
}

/* ---- Build the pages (one CSS 3D "leaf" per entry) ---------------------- */
const flipbookEl  = document.getElementById("flipbook");
const pageStackEl = flipbookEl ? flipbookEl.querySelector(".page-stack") : null;   // right-side page stack
const flipScaleEl = document.getElementById("flipScale");
const coverScene  = document.getElementById("coverScene");
// ONE full 16:9 page per view (single display). page 1 = entry 1. The themed
// book frame forms the left spine/cover edge (always visible when open); pages
// flip normally. No two-page spread.
const totalPages = pages.length;
// Each leaf is a full 16:9 page hinged on the LEFT spine:
//   • FRONT = the page's full-bleed image / video (+ its speech bubble, if any).
//   • BACK  = a BLANK parchment sheet (seen edge-on while the page turns).
const leaves = [];
pages.forEach(function (page, i) {
  const leaf = document.createElement("div");
  leaf.className = "leaf";

  const front = document.createElement("div");
  front.className = "face front";
  if (page.type === "end") {
    // THE END — a real final page in the BOOK's own night-and-gold look
    // (template-neutral: nothing story-specific, works for any story).
    front.classList.add("end-page");
    front.innerHTML =
      '<div class="end-page-inner">' +
        '<div class="end-rule" aria-hidden="true"><svg viewBox="0 0 24 24">' +
          '<path fill="currentColor" d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"/>' +
        '</svg></div>' +
        '<div class="end-title">The End</div>' +
        '<div class="end-rule" aria-hidden="true"><svg viewBox="0 0 24 24">' +
          '<path fill="currentColor" d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"/>' +
        '</svg></div>' +
        '<button class="replay-btn" id="replayBtn" type="button" aria-label="Read the story again">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true">' +
            '<path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>' +
          '</svg>' +
          '<span>Read again</span>' +
        '</button>' +
      '</div>';
  } else if (page.scenes) {
    // MULTI-SCENE page: the storyboard screens stack as full-bleed layers and
    // the scene player (playScenes) cross-dissolves through them. Scene 0
    // starts visible so the page has art on it while it turns. A scene whose
    // src is a video plays when its scene lands (see playScenes).
    page.scenes.forEach(function (sc, si) {
      const layer = document.createElement("div");
      layer.className = "page-scene" + (si === 0 ? " on" : "");
      if (sc.pour) {                           // interactive POUR scene (no media src)
        buildPourScene(layer, sc.pour);
        front.appendChild(layer);
        return;
      }
      const isVideo = /\.(mp4|webm)$/i.test(sc.src);
      layer.appendChild(makeMedia({ type: isVideo ? "video" : "image", src: sc.src, alt: sc.alt }));
      if (sc.fx) {
        const fxEl = makeFx(sc.fx, layer);     // ambient animation for this scene
        if (fxEl) layer.appendChild(fxEl);
      }
      if (sc.bubble) layer.appendChild(makeBubble(sc.bubble));
      front.appendChild(layer);
    });
  } else {
    front.appendChild(makeMedia(page));                       // full-bleed image / video
    if (page.bubble) front.appendChild(makeBubble(page.bubble));  // PNG speech bubble (revealed on land)
  }
  const curl = document.createElement("div");               // moving page-curl shading
  curl.className = "curl";
  front.appendChild(curl);

  const back = document.createElement("div");
  back.className = "face back";                             // blank reverse side (no content)
  const backCurl = document.createElement("div");           // sheen for the reverse side —
  backCurl.className = "curl";                              // the front curl is backface-hidden
  back.appendChild(backCurl);                               // past 90°, this shades the landing half

  leaf.appendChild(front);
  leaf.appendChild(back);
  flipbookEl.appendChild(leaf);
  leaves.push(leaf);
});

/* One shared, JS-driven shadow the TURNING sheet casts on the page beneath it —
   swept + faded per-frame from the live flip angle (see applyFlipFX). Hinged at
   the spine so scaleX(cos) mirrors it onto the landing side past 90°. Stacked
   above the resting pages (z250 in CSS), below the turning sheet (z300). */
const flipShadowEl = document.createElement("div");
flipShadowEl.className = "flip-shadow";
flipShadowEl.setAttribute("aria-hidden", "true");
flipbookEl.appendChild(flipShadowEl);

/* ---- State + element references ----------------------------------------- */
const bookStage  = document.getElementById("bookStage");
const book       = document.getElementById("book");
const bookPop    = document.getElementById("bookPop");
const bookFloat  = document.getElementById("bookFloat");
const cover      = document.getElementById("cover");
const hint       = document.getElementById("hint");
const cornerPrev  = document.getElementById("cornerPrev");
const cornerNext  = document.getElementById("cornerNext");
const replayBtn   = document.getElementById("replayBtn");   // lives on the THE END page (built above)

let opened = false;      // has the cover been opened?
let ready  = false;      // has the cover FINISHED opening? (flips allowed only then)
let flipped = 0;         // how many leaves are currently turned to the left
let animating = false;   // guard so a new turn can't start mid-flip
const FLIP_MS = 1150;    // keep in sync with --flip-ms in styles.css
const COVER_OPEN_MS = 6000;  // keep in sync with the coverOpen animation in styles.css
const CLOSE_SETTLE_MS = 560;  // keep in sync with the bookSettle animation in styles.css
const COVER_CLOSE_MS  = 2000; // Home/Replay: cover swings shut (reverse open); sync with coverClose in styles.css
let _openTimer = null;   // pending "cover finished opening" timer
let _mediaGateTimer = null;
// May a page's video START? False while the cover is still visibly swinging, so
// page 1's narration can't play behind a half-open cover (see runOpenSequence).
let mediaGate = false;
let _homeTimer = null;   // pending "cover finished closing → back to the cover" timer

/* ==========================================================================
   GSAP FLIP DRIVER  —  a physical, real-book page turn.
   When GSAP is available (gsap.min.js loads before this file) every turn is a
   multi-phase tween: the page LIFTS with effort (ease-in-out), FALLS under
   gravity (accelerating), touches down and gives a tiny landing BOUNCE. The
   curl shading is synced to the LIVE angle every frame, and a drag release
   falls from the exact angle you let go at, with a distance-scaled duration
   (the fixed-length CSS transition made short releases float unnaturally).
   If GSAP is missing, everything falls back to the original CSS flip.
   ========================================================================== */
// Reduced-motion users keep the CSS fallback: styles.css shortens those flips
// to 260ms, which the GSAP timelines would otherwise bypass.
const G = (window.gsap &&
           !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches))
          ? window.gsap : null;
const FLIP_S = FLIP_MS / 1000;                 // GSAP works in seconds

// Curl shading strength for a given turn angle (same curve the drag uses):
// ramps up to the edge-on point (90°), then back off as the page lies flat.
function curlFor(ang) {
  return (ang <= 90 ? ang / 90 : (180 - ang) / 90) * 0.9;
}

/* ---- Per-frame flip FX ------------------------------------------------------
   Everything that makes the turn read as a flexible SHEET OF PAPER instead of
   a rigid board, all derived from the live angle (0 = flat right, 180 = turned):
     • curl sheen on BOTH faces (front while lifting, back while landing)
     • the cast shadow sweeping across the page beneath the turning sheet
     • paper FLEX: the page media lags behind the board by an amount tied to
       the angular VELOCITY — so it bends on the lift, straightens edge-on and
       flutters on the landing bounce, like real paper
     • a gentle sag + lift of the whole sheet, strongest edge-on (returned to
       the caller: GSAP merges it into the tween; the drag composes it into
       its manual transform string)
   Shared by the GSAP turn, the drag-follow AND the ghost peek. */
let _fxBend = 0, _fxLastAng = null, _fxLastT = 0;
function applyFlipFX(leaf, ang) {
  const rad = ang * Math.PI / 180, s = Math.sin(rad);
  const co = curlFor(ang);
  leaf.querySelectorAll(".curl").forEach(function (c) { c.style.opacity = co; });
  // cast shadow: hinged at the spine; cos sweeps it right → left (mirroring
  // past 90°), sin fades it in and out around the edge-on point
  flipShadowEl.style.transform = "scaleX(" + Math.cos(rad).toFixed(4) + ")";
  flipShadowEl.style.opacity = (s * 0.45).toFixed(3);
  // paper flex: velocity-based lag, smoothed so it eases like real paper
  const now = performance.now();
  if (_fxLastAng != null) {
    const dt = now - _fxLastT;
    const vel = (dt > 0 && dt < 200) ? (ang - _fxLastAng) / dt * 1000 : 0;   // deg/s
    const target = Math.max(-4, Math.min(4, vel * 0.022));
    _fxBend += (target - _fxBend) * 0.28;
  }
  _fxLastAng = ang; _fxLastT = now;
  const media = leaf.querySelector(".page-media");
  if (media) {                                   // only while the front is visible (< 90°)
    media.style.transform = (ang < 95 && Math.abs(_fxBend) > 0.05)
      ? "perspective(1200px) rotateY(" + _fxBend.toFixed(2) + "deg)" +
        " scale(" + (1 + Math.abs(_fxBend) * 0.004).toFixed(4) + ")"
      : "";
  }
  return { sag: 2.2 * s, lift: 30 * s };
}
function clearFlipFX(leaf) {
  if (leaf) {
    leaf.querySelectorAll(".curl").forEach(function (c) { c.style.opacity = ""; });
    const media = leaf.querySelector(".page-media");
    if (media) media.style.transform = "";
  }
  flipShadowEl.style.opacity = "0";
  _fxBend = 0; _fxLastAng = null;
}

/* ==========================================================================
   PAGE-PEEL ENGINE  —  a real "corner peel" page turn (turn.js style).
   The sheet lifts from its bottom-right corner and peels across the page with
   a travelling fold:
     • the leaf's FRONT is clipped to the un-peeled region,
     • the folded-over part shows the sheet's blank tan BACK — the peeled
       region REFLECTED across the fold line — with a bright crease rolling
       into curved paper shading,
     • a shadow hugs the fold on the flat part and the lifted sheet casts a
       soft drop shadow past it.
   All geometry is exact 2D reflection math, computed per frame from P = where
   the page's bottom-right corner currently is (book coords). P rests at
   (PW,PH) and ends at (-PW,PH), fully folded over the left spine — which
   matches the .flipped pose (parked off-book left), so class semantics keep
   working. GSAP drives P; without GSAP the old CSS hinge flip runs instead.
   ========================================================================== */
const PW = 1280, PH = 720;                    // book-space page size
const PEEL_EMPTY = "inset(0 0 0 100%)";       // hide-the-whole-page clip (fully peeled)
let _peelTween = null;                        // the active corner tween (one at a time)
let peelFoldWrap = null, peelFold = null;     // shared folded-over sheet layers

function ensurePeelEls(leaf) {
  if (!peelFoldWrap) {
    peelFoldWrap = document.createElement("div");
    peelFoldWrap.className = "peel-foldwrap";
    peelFold = document.createElement("div");
    peelFold.className = "peel-fold";
    peelFoldWrap.appendChild(peelFold);
    flipbookEl.appendChild(peelFoldWrap);
  }
  if (!leaf._crease) {                        // fold-hugging shadow on the page front
    const c = document.createElement("div");
    c.className = "peel-crease";
    leaf.appendChild(c);
    leaf._crease = c;
  }
}

// Cut a convex polygon by the half-plane sideFn(p) >= 0 (Sutherland–Hodgman).
function clipHalf(poly, sideFn) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const sa = sideFn(a), sb = sideFn(b);
    if (sa >= 0) out.push(a);
    if ((sa >= 0) !== (sb >= 0)) {
      const u = sa / (sa - sb);
      out.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
    }
  }
  return out;
}
function polyCss(poly) {
  return "polygon(" + poly.map(function (p) {
    return p.x.toFixed(1) + "px " + p.y.toFixed(1) + "px";
  }).join(",") + ")";
}
function mixRGB(a, b, f) {                     // blend two [r,g,b] colours by f (0..1)
  return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * f) + "," +
                  Math.round(a[1] + (b[1] - a[1]) * f) + "," +
                  Math.round(a[2] + (b[2] - a[2]) * f) + ")";
}

/* Render ONE frame of the peel for the given corner position P. */
function renderPeel(leaf, P) {
  ensurePeelEls(leaf);
  const crease = leaf._crease;
  const dx = PW - P.x, dy = PH - P.y;          // corner displacement (rest − current)
  const dl = Math.hypot(dx, dy);
  if (dl < 1.5) {                              // corner at rest → flat, unclipped page
    leaf.style.clipPath = "";
    crease.style.display = "none";
    peelFoldWrap.style.display = "none";
    return;
  }
  const nx = dx / dl, ny = dy / dl;            // fold normal (points to the peeled side)
  const mx = (PW + P.x) / 2, my = (PH + P.y) / 2;  // the fold passes through this midpoint
  function side(p) { return (p.x - mx) * nx + (p.y - my) * ny; }
  const rect = [{ x: 0, y: 0 }, { x: PW, y: 0 }, { x: PW, y: PH }, { x: 0, y: PH }];
  const front  = clipHalf(rect, function (p) { return -side(p); });   // still lying flat
  const peeled = clipHalf(rect, side);                                // lifted + folded over
  if (peeled.length < 3) {
    // Nothing (or a degenerate sliver) is lifted. A <3-point polygon() is
    // INVALID CSS — the fold layer would paint UNCLIPPED as a full-box tan
    // flash — so treat this as a flat page instead.
    leaf.style.clipPath = "";
    crease.style.display = "none";
    peelFoldWrap.style.display = "none";
    return;
  }
  leaf.style.clipPath = front.length > 2 ? polyCss(front) : PEEL_EMPTY;
  // Folded-over part = the peeled region reflected across the fold line.
  const back = peeled.map(function (p) {
    const s = side(p);
    return { x: p.x - 2 * s * nx, y: p.y - 2 * s * ny };
  });
  // SHADING STRENGTH: ramps in the moment the corner lifts, and MELTS AWAY over
  // the last stretch of the turn — so the landed sheet blends seamlessly into
  // the parked page on the left with no crease/shadow pop at the end.
  const p01 = Math.min(1, dl / (2 * PW));      // 0 = corner at rest … 1 = fully turned
  const kOut = p01 < 0.8 ? 1 : Math.max(0, (1 - p01) / 0.2);
  const k = Math.min(1, p01 * 10) * kOut;
  // The fold layer's box spans -PW..PW in book space (so the sheet stays
  // visible while it lands LEFT of the book): element x = book x + PW.
  peelFold.style.clipPath = "polygon(" + back.map(function (p) {
    return (p.x + PW).toFixed(1) + "px " + p.y.toFixed(1) + "px";
  }).join(",") + ")";
  // Both gradients run along -n (from the fold INTO the page). CSS measures
  // gradient stops from the gradient line's start (center − dir·L/2), so find
  // where the fold sits along that line (per element box) and hang stops off it.
  const gx = -nx, gy = -ny;
  const theta = Math.atan2(gx, -gy) * 180 / Math.PI;
  // shadow hugging the fold on the flat part (leaf box: PW × PH)
  const L1 = Math.abs(PW * gx) + Math.abs(PH * gy);
  const s1 = (mx - (PW / 2 - gx * L1 / 2)) * gx + (my - (PH / 2 - gy * L1 / 2)) * gy;
  crease.style.display = "block";
  crease.style.background = "linear-gradient(" + theta.toFixed(2) + "deg, rgba(15,10,34," +
    (0.34 * k).toFixed(3) + ") " + s1.toFixed(1) + "px, rgba(15,10,34," +
    (0.13 * k).toFixed(3) + ") " + (s1 + 46).toFixed(1) + "px, rgba(15,10,34,0) " +
    (s1 + 130).toFixed(1) + "px)";
  // the folded-over back (fold box: 2PW × PH): a bright crease rolling into warm
  // tan — every stop eased back to the resting paper tones as the sheet lands
  const FW = 2 * PW;
  const L2 = Math.abs(FW * gx) + Math.abs(PH * gy);
  const s2 = ((mx + PW) - (PW - gx * L2 / 2)) * gx + (my - (PH / 2 - gy * L2 / 2)) * gy;
  const BASE = [203, 157, 131], DEEP = [179, 128, 95];   // --page-back / --page-back-2
  peelFold.style.background = "linear-gradient(" + theta.toFixed(2) + "deg, " +
    mixRGB(BASE, [246, 227, 201], k) + " " + s2.toFixed(1) + "px, " +
    mixRGB(BASE, [220, 177, 144], k) + " " + (s2 + 26).toFixed(1) + "px, " +
    "rgb(203,157,131) " + (s2 + 70).toFixed(1) + "px, " +
    mixRGB(DEEP, [156, 108, 80], k) + " " + (s2 + 260).toFixed(1) + "px)";
  // soft shadow the lifted sheet casts past the fold — fades out as it lands
  peelFoldWrap.style.display = "block";
  peelFoldWrap.style.filter = "drop-shadow(" + (gx * 14).toFixed(1) + "px " +
    (gy * 14 + 5).toFixed(1) + "px 16px rgba(8,6,22," +
    (0.42 * (0.15 + 0.85 * kOut)).toFixed(3) + "))";
}

/* Canonical corner path for arrow/keyboard turns + the idle peek: a quadratic
   Bezier from the resting corner, LIFTING through mid-page, down to the
   fully-turned mirror corner past the spine. */
function peelPath(t) {
  const u = 1 - t;
  return {
    x: u * u * PW + 2 * u * t * (PW * 0.10) + t * t * (-PW),
    y: u * u * PH + 2 * u * t * (PH - 620) + t * t * PH
  };
}
/* Keep a dragged corner physical: paper can't stretch, so P stays within reach
   of the spine's two anchor points (bottom-left and top-left of the page). */
function clampPeelP(p) {
  let x = p.x, y = Math.min(p.y, PH);
  let vx = x, vy = y - PH, d = Math.hypot(vx, vy);       // anchor (0, PH), radius PW
  if (d > PW) { x = vx / d * PW; y = PH + vy / d * PW; }
  const R = Math.hypot(PW, PH);
  vx = x; vy = y; d = Math.hypot(vx, vy);                // anchor (0, 0), radius diagonal
  if (d > R) { x = vx / d * R; y = vy / d * R; }
  return { x: x, y: y };
}
/* Pointer event → book-space coordinates (the 1280×720 the geometry lives in). */
function bookPt(e) {
  const r = flipbookEl.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * PW, y: (e.clientY - r.top) / r.height * PH };
}

/* Finish a peel: clear the per-frame layers and hand the pose back to the
   .flipped class (transition suppressed so nothing re-animates). */
function peelEnd(leaf) {
  renderLeaves();                              // resting classes for the final state
  leaf.style.clipPath = "";
  if (leaf._crease) leaf._crease.style.display = "none";
  if (peelFoldWrap) peelFoldWrap.style.display = "none";
  leaf.style.transition = "none";
  leaf.style.transform = "";
  void leaf.offsetWidth;                       // commit with no transition
  leaf.style.transition = "";
  updateZ();
}

/* ---- CLOSE CASCADE — the "real book close" for Home / Replay ---------------
   Riffle every turned page back to the right, one after another: the top of
   the left pile (the most recently turned page) falls first, and each later
   sheet lands ON TOP of the one before, so the book visibly returns to page 1
   — then the caller swings the cover shut. Each fall gets a flip sound (a
   quick riffle). Without GSAP (or with no pages turned) it calls done()
   immediately and the old instant close runs. */
function cascadeClose(done) {
  const n = flipped;
  if (!G || n <= 0) { done(); return; }
  if (_peelTween) { _peelTween.kill(); _peelTween = null; }
  const falling = leaves.slice(0, n);
  falling.forEach(function (l) { l.style.transition = "none"; });   // GSAP owns the motion
  const tl = G.timeline({
    onComplete: function () {
      flipped = 0;
      renderLeaves();                        // every leaf officially unflipped again
      falling.forEach(function (l) {
        G.set(l, { clearProps: "transform,transformOrigin" });
        l.style.zIndex = "";
        void l.offsetWidth;                  // commit while transitions are off
        l.style.transition = "";
      });
      updateZ();
      done();
    }
  });
  for (let k = 0; k < n; k++) {
    const leaf = leaves[n - 1 - k];          // most recently turned page falls first
    const at = k * 0.085;                    // riffle stagger
    tl.set(leaf, { zIndex: 320 + k }, at);   // later sheets land ON TOP → page 1 ends up top
    tl.fromTo(leaf, { rotationY: -180, transformOrigin: "left center" },
                    { rotationY: 0, duration: 0.38, ease: "power2.in" }, at);
    tl.call(playFlip, null, at + 0.2);       // flip sound as each sheet falls
  }
}

/* Full peel turn for the arrows / keyboard: drive the corner along peelPath. */
function peelTurn(leaf, forward, opts) {
  if (_peelTween) { _peelTween.kill(); _peelTween = null; }
  ensurePeelEls(leaf);
  const proxy = { t: forward ? 0 : 1 };
  leaf.style.transition = "none";
  leaf.style.transform = "none";               // flat — the travelling fold does the turning
  renderPeel(leaf, peelPath(proxy.t));
  renderLeaves();                              // final classes now (the inline flat overrides)
  leaf.style.zIndex = 300;                     // keep the peeling sheet on top
  _peelTween = G.to(proxy, {
    t: forward ? 1 : 0,
    duration: FLIP_S,
    ease: "power2.inOut",
    onUpdate: function () { renderPeel(leaf, peelPath(proxy.t)); },
    onComplete: function () {
      _peelTween = null;
      peelEnd(leaf);
      if (opts && opts.done) opts.done();
    }
  });
}

/* ---- Responsive: scale the FIXED 1280x720 book to fit the viewport --------
   ORIGINAL fit — 96% of width / 84% of height — so the book size and the arrows
   (which stay at the viewport's bottom corners, via CSS) look exactly as before.
   The ONLY addition is a safeguard on SHORT screens: never let the book grow so
   tall that it covers the bottom controls. That safeguard changes nothing on
   normal/large screens (there the 0.84 factor is the smaller of the two); it only
   shrinks the book a little on small screens so the arrows + progress stay visible.
   Only this CSS transform scale changes, so the paper curl is never distorted. */
function fitScale() {
  const vw = window.innerWidth, vh = window.innerHeight;
  // Room kept above/below for the controls: PROPORTIONAL on small screens, capped
  // at the original 64px on big ones. A fixed 64px reserved 40% of a landscape
  // phone's 320px height, shrinking the book to a third of the screen; at 11% of
  // height the same phone keeps a usable strip and a far bigger book, while
  // anything laptop-sized is pixel-identical to the old layout.
  const CTRL = Math.max(30, Math.min(64, Math.round(vh * 0.11)));
  // Same idea sideways: small screens can afford less horizontal breathing room.
  const availW = vw * (vw < 700 ? 0.94 : 0.88);
  const availH = Math.min(vh * (vh < 480 ? 0.86 : 0.80), vh - CTRL * 2);
  const s = Math.min(availW / 1280, availH / 720);
  flipScaleEl.style.setProperty("--book-scale", s.toFixed(4));
  // The nav arrows sit UNDER the book's bottom corners: BACK below the
  // bottom-LEFT corner, NEXT below the bottom-RIGHT — horizontally centred
  // on each corner, with the arrow art fully BELOW the book edge (never
  // touching it). The gold glyph fills the middle ~58% of the button box,
  // so the box is placed with that inset in mind; the button shrinks when
  // the strip under the book is tight.
  const bookW = 1280 * s, bookH = 720 * s, edge = 18 * s;
  const cornerL = (vw - bookW) / 2 - edge;
  const cornerR = (vw + bookW) / 2 + edge;
  const cornerY = (vh + bookH) / 2 + edge;                   // book bottom edge
  const room = vh - cornerY - 6;                             // strip below the book
  const btn = Math.max(56, Math.min(124, Math.round(120 * s), Math.floor(Math.max(room, 0) / 0.58) || 56));
  const rs = document.documentElement.style;
  rs.setProperty("--arrow-size", btn + "px");
  // Never let the button box sink below the fold: when the strip under the book
  // is thinner than the button (very short screens), the arrow rides up ONTO the
  // page's bottom corner instead — still visible, still tappable.
  const arrowY = Math.min(Math.round(cornerY + 2 - 0.21 * btn), vh - btn - 4);
  rs.setProperty("--arrow-y", arrowY + "px");
  // …and keep both inside the sides on very narrow screens.
  rs.setProperty("--back-x", Math.max(2, Math.round(cornerL - btn / 2)) + "px");
  rs.setProperty("--fwd-x",  Math.min(vw - btn - 2, Math.round(cornerR - btn / 2)) + "px");
  // keep the page-turn hint glued to the forward arrow when the viewport changes
  if (flipHint && flipHint.classList.contains("show")) positionFlipHint();
}

/* ---- Render / stacking for the CSS leaf flip ---------------------------- */
// A TURNED leaf sits to the left (rotateY -180deg, showing its blank back over
// the cover); an UN-turned leaf lies flat on top of the cover. z-index keeps the
// current (top un-turned) page in front, and stacks more-recently turned leaves
// above earlier ones on the left pile.
function updateZ() {
  leaves.forEach(function (leaf, i) {
    leaf.style.zIndex = (i < flipped) ? (200 + i) : (100 - i);
  });
}
function renderLeaves() {
  leaves.forEach(function (leaf, i) {
    if (i < flipped) leaf.classList.add("flipped");
    else             leaf.classList.remove("flipped");
  });
  updateZ();
}

/* ---- Per-page media -----------------------------------------------------
   Play the CURRENT page's video (pause every other), and pop the current page's
   speech bubble in ONCE, only after the page has fully settled. Called after
   each flip completes and once the cover has finished opening. */
let mediaDelayTimer = null;   // pending "start this video after N ms" timer
let mediaDelayIdx = -1;       // which page that pending timer belongs to
let lastMediaIdx = -1;        // last page refreshMedia handled (to arm the blink once)
let armBlink = false;         // allow the video-end arrow blink ONCE per page arrival

/* Start (or resume) a page's clip. `restartIfEnded` is the guard against replaying
   a page the reader has already watched: refreshMedia() is called several times per
   turn as an idempotent safety net (flip start, flip end, a drag that snapped back),
   and play() on a FINISHED element seeks back to 0 — so those re-asserts would
   restart a clip the reader had just finished. Only a fresh arrival on the page
   (or a scene landing) replays it. */
function playVideoNow(v, restartIfEnded) {
  try {
    v.preload = "auto";                       // make sure it's buffering before we play
    if (v.ended) {
      if (!restartIfEnded) return;            // finished, and we're only re-asserting → leave it
      v.currentTime = 0;
    }
    v.muted = false;                          // try WITH sound (primed in the Play gesture)
    duckMusic(true);                          // narration up front, music underneath
    const p = v.play();
    if (p && p.catch) p.catch(function () {
      // Sound blocked → play silently rather than not at all, and TELL the reader
      // how to fix it — a silent story with no cue just looks broken.
      v.muted = true;
      v.play().catch(function () {});
      showSoundHint(v);
    });
  } catch (_) {}
}

/* Buffer ONE page's video on demand (only the current + next page are ever
   warmed, so we never spin up all 25 decoders at once). */
function warmVideo(i) {
  const leaf = leaves[i];
  if (!leaf) return;
  const v = leaf.querySelector("video.page-media");
  if (v && v.preload !== "auto") { v.preload = "auto"; try { v.load(); } catch (_) {} }
}

/* Unlock ONE page's video for instant, sound-enabled playback: a muted
   play()→pause() done INSIDE a user gesture. We prime only the page being shown
   and the next one — priming them all at once was the opening lag. */
function primeVideo(i) {
  const leaf = leaves[i];
  if (!leaf) return;
  const v = leaf.querySelector("video.page-media");
  if (!v || v.dataset.primed) return;
  v.dataset.primed = "1";
  try {
    v.preload = "auto";
    // Prime UNMUTED: Safari grants each media element its play-with-sound right
    // only if an AUDIBLE play() happened inside a user gesture — a muted prime
    // earns nothing there (muted playback never needed permission), so the real
    // play() seconds later was rejected and the page fell back to silent + the
    // rescue chip. The synchronous pause() means nothing is actually heard.
    v.muted = false;
    const p = v.play();                       // start within the gesture → element is "activated"
    if (p && p.catch) p.catch(function () {
      // Even the in-gesture audible play was refused (strict autoplay settings) —
      // take the muted activation as a consolation so at least video runs.
      try { v.muted = true; v.play().catch(function () {}); v.pause(); } catch (_) {}
    });
    v.pause();                                // pause synchronously
    v.currentTime = 0;
  } catch (_) {}
}

/* ==========================================================================
   DIALOGUE + SCENE PLAYER  —  the LXD presentation rules, in code:
     • bubble reveal  = Pop (On Enter)  → the existing bubblePop CSS animation
     • text reveal    = Typewriter (On Enter), speed adjustable per bubble
     • scenes on a page cross-DISSOLVE (1.1s), each popping its own bubble
   Bubbles replay every time the reader lands on the page ("On Enter"): when a
   page is LEFT, its dialogue resets (delayed until the turn finishes so
   nothing blanks mid-flip).
   ========================================================================== */
const TYPE_MS       = 45;     // default typewriter speed (ms per character)
const TYPE_LAG_MS   = 260;    // typing starts as the pop settles
const DISSOLVE_MS   = 1100;   // scene cross-dissolve (sync with .page-scene CSS)
const SCENE_HOLD_MS = 1600;   // default linger after typing ends, before dissolving

/* ---- Pausable dialogue timers -------------------------------------------
   Every dialogue timer (scene holds, typewriter ticks, bubble reveals) runs
   through dlgWait so the whole playback can FREEZE and RESUME in place —
   each record knows its deadline, so pause stores the remaining time and
   resume re-arms it. (Used by the TEMP test button; also useful later for
   audio sync.) A timer created WHILE paused stays parked until resume. */
let dlgPaused = false;
let dlgTimers = [];                          // live records: {fn, remaining, deadline, id}
function dlgDrop(rec) {
  const i = dlgTimers.indexOf(rec);
  if (i >= 0) dlgTimers.splice(i, 1);
}
function dlgWait(fn, ms) {
  const rec = { fn: fn, remaining: ms, deadline: 0, id: 0 };
  if (!dlgPaused) {
    rec.deadline = performance.now() + ms;
    rec.id = setTimeout(function () { dlgDrop(rec); fn(); }, ms);
  }
  dlgTimers.push(rec);
  return rec;
}
function dlgKill(rec) {                      // cancel one record (returns null)
  if (rec) { clearTimeout(rec.id); dlgDrop(rec); }
  return null;
}
function dlgPause() {
  if (dlgPaused) return;
  dlgPaused = true;
  const now = performance.now();
  dlgTimers.forEach(function (r) {
    clearTimeout(r.id); r.id = 0;
    r.remaining = Math.max(0, r.deadline - now);
  });
  // freeze any scene video mid-play (its 'ended' advance freezes with it)
  document.querySelectorAll(".page-scene video.page-media").forEach(function (v) {
    if (!v.paused && !v.ended) { v._dlgWasPlaying = true; try { v.pause(); } catch (_) {} }
  });
}
function dlgResume() {
  if (!dlgPaused) return;
  dlgPaused = false;
  dlgTimers.forEach(function (r) {
    r.deadline = performance.now() + r.remaining;
    r.id = setTimeout(function () { dlgDrop(r); r.fn(); }, r.remaining);
  });
  document.querySelectorAll(".page-scene video.page-media").forEach(function (v) {
    if (v._dlgWasPlaying) {
      v._dlgWasPlaying = false;
      const p = v.play(); if (p && p.catch) p.catch(function () {});
    }
  });
}

/* Lay the bubble's text out as INVISIBLE per-char spans: the final layout is
   built up-front (so the text never re-wraps mid-type) but no character shows
   until the typewriter reveals it. MUST run before the bubble pops in —
   otherwise the plain text flashes visible during the pop. */
function prepBubbleText(bub) {
  const t = bub.querySelector(".bubble-text");
  if (!t) return;
  const full = t.dataset.full != null ? t.dataset.full : t.textContent;
  t.dataset.full = full;
  t.textContent = "";
  Array.prototype.forEach.call(full, function (ch) {
    const s = document.createElement("span");
    s.textContent = ch;
    s.style.visibility = "hidden";
    t.appendChild(s);
  });
}

/* Typewriter: reveal the prepared invisible spans one by one. */
function typeBubbleText(bub) {
  const t = bub.querySelector(".bubble-text");
  if (!t) return;
  if (!t.querySelector("span")) prepBubbleText(bub);   // safety: not prepped yet
  const spans = t.querySelectorAll("span");
  const ms = +bub.dataset.typeSpeed || TYPE_MS;
  let i = 0;
  (function tick() {
    if (i >= spans.length) { bub._typeTimer = null; return; }
    spans[i++].style.visibility = "visible";
    bub._typeTimer = dlgWait(tick, ms);
  })();
}

/* Pop the bubble in NOW (empty — its text is hidden spans), then start
   typing as the pop settles. Runs once per page visit. */
function revealBubbleNow(bub) {
  if (!bub || bub.dataset.revealed) return;
  bub.dataset.revealed = "1";
  prepBubbleText(bub);                                         // hide text FIRST
  bub.classList.add("revealed");                               // Pop (On Enter)
  bub._typeStartTimer = dlgWait(function () {
    bub._typeStartTimer = null;                // cleared → "typing has begun"
    typeBubbleText(bub);
  }, TYPE_LAG_MS);
}

/* Put a bubble back to its hidden, un-typed state (for the next visit). */
function resetBubble(bub) {
  dlgKill(bub._revealTimer); dlgKill(bub._typeStartTimer); dlgKill(bub._typeTimer);
  bub._revealTimer = bub._typeStartTimer = bub._typeTimer = null;
  delete bub.dataset.revealed;
  delete bub.dataset.sched;
  bub.classList.remove("revealed");
  const t = bub.querySelector(".bubble-text");
  if (t && t.dataset.full != null) t.textContent = t.dataset.full;
}

/* ---- Scene player ---------------------------------------------------------
   Walks a page's `scenes`: reveal bubble → type → hold → 1.1s cross-dissolve
   to the next scene → its bubble pops as the dissolve lands → … The last
   scene simply stays. All timers are tracked so leaving the page stops them. */
let scenePlayPage = -1, sceneTimers = [], scenePlayRun = 0;
let sceneSeqDone = -1;                         // page whose scene sequence has PLAYED OUT
function sceneWait(fn, ms) { sceneTimers.push(dlgWait(fn, ms)); }
function stopScenes() {
  sceneTimers.forEach(dlgKill);
  sceneTimers = [];
  clearSceneTap();                             // a pending "tap to continue" is void
  scenePlayPage = -1;
  sceneSeqDone = -1;
  scenePlayRun++;                              // invalidates pending video-ended advances
}
function resetScenes(leaf) {                   // back to scene 0, bubbles + videos fresh
  clearSceneTap();                             // drop a pending "tap to continue"
  leaf.querySelectorAll(".page-scene").forEach(function (l, i) {
    l.classList.toggle("on", i === 0);
    if (l._pourReset) l._pourReset();          // empty the glass for the next visit
    const b = l.querySelector(".bubble");
    if (b) resetBubble(b);
    l.querySelectorAll(".scene-tap").forEach(function (t) { t.remove(); });   // stray hot-spot
    const v = l.querySelector("video.page-media");
    if (v) {
      if (v._sceneAdv) {
        v.removeEventListener("ended", v._sceneAdv);
        v.removeEventListener("error", v._sceneAdv);
        v._sceneAdv = null;
      }
      try { v.pause(); v.currentTime = 0; } catch (_) {}
    }
  });
}

/* ---- INTERACTIVE SCENE: "tap to continue" --------------------------------
   A scene with `tap:` in story.js does NOT advance on its own. Its clip plays
   out, then the page HOLDS and a pulsing gold ring + hand appears over the thing
   to tap; tapping runs the next scene. The whole page is the hit area, so a small
   child never has to aim — the ring only says WHERE to look.
   The reader can't get past it by other means either: the page-turn cue is armed
   only by the page's LAST scene, so the interaction can't be skipped (going BACK
   a page is still allowed, and leaving cleans the hot-spot up).
     tap: { at: { x: "47%", y: "54%" }, size: 150, label: "Tap the POUR button" }
   x/y are CSS % of the page; size is the ring diameter in book px (1280x720). */
let sceneTapClear = null;
function clearSceneTap() { if (sceneTapClear) sceneTapClear(); }
function armSceneTap(layer, cfg, onTap) {
  clearSceneTap();
  const at = (cfg && cfg.at) || {};
  const hot = document.createElement("button");
  hot.type = "button";                         // focusable → Enter/Space work too
  hot.className = "scene-tap" + (cfg && cfg.anywhere ? " anywhere" : "");
  // `anywhere: true` — the cue means "tap the SCREEN", not "tap this thing":
  // the targeting ring is hidden (CSS) and only the tapping hand + ripple show,
  // placed wherever `at` says (pick open space, off the artwork's own buttons).
  hot.setAttribute("aria-label", (cfg && cfg.label) || "Tap to continue the story");
  const spot = document.createElement("span");
  spot.className = "scene-tap-spot";
  spot.style.left = at.x || "50%";
  spot.style.top  = at.y || "50%";
  if (cfg && cfg.size) spot.style.setProperty("--spot", cfg.size + "px");
  spot.innerHTML = '<span class="scene-tap-ring"></span>' +
                   '<span class="scene-tap-hand">' + HAND_SVG + '</span>';
  hot.appendChild(spot);
  layer.appendChild(hot);
  requestAnimationFrame(function () { hot.classList.add("show"); });   // fade in
  // A TAP, not a swipe. The hot-spot covers the page, so a reader dragging the
  // page (to turn BACK, say) would otherwise "tap" it on release — Chrome still
  // fires click when press and release land on the same element. So remember
  // where the press started and ignore a release that travelled.
  let downX = 0, downY = 0, moved = false;
  const TAP_SLOP = 10;                                    // px of travel still counts as a tap
  const onDown = function (e) { downX = e.clientX; downY = e.clientY; moved = false; };
  const onMove = function (e) {
    if (Math.abs(e.clientX - downX) > TAP_SLOP || Math.abs(e.clientY - downY) > TAP_SLOP) moved = true;
  };
  const fire = function (e) {
    if (moved) { moved = false; return; }                 // that was a drag — let it be
    e.preventDefault();
    e.stopPropagation();     // never let the tap reach the video's own play/unmute handler
    clearSceneTap();
    onTap();
  };
  hot.addEventListener("pointerdown", onDown);
  hot.addEventListener("pointermove", onMove);
  hot.addEventListener("click", fire);
  sceneTapClear = function () {
    sceneTapClear = null;
    hot.removeEventListener("pointerdown", onDown);
    hot.removeEventListener("pointermove", onMove);
    hot.removeEventListener("click", fire);
    if (hot.parentNode) hot.parentNode.removeChild(hot);
  };
}
function playScenes(idx, startDelay) {
  if (scenePlayPage === idx) return;           // already running on this page
  stopScenes();
  scenePlayPage = idx;
  const run = scenePlayRun;                    // this playback session's token
  const leaf = leaves[idx], scs = pages[idx].scenes;
  const layers = leaf.querySelectorAll(".page-scene");
  resetScenes(leaf);
  (function showScene(si, revealDelay) {
    const layer = layers[si];
    if (!layer) return;
    const sc  = scs[si];
    const bub = layer.querySelector(".bubble");
    const vid = layer.querySelector("video.page-media");
    let typedMs = 0;
    if (vid) sceneWait(function () { playVideoNow(vid, true); }, revealDelay);   // a scene landing always starts its clip
    if (bub) {
      const t = bub.querySelector(".bubble-text");
      const full = (t && t.dataset.full) || "";
      typedMs = TYPE_LAG_MS + full.length * (+bub.dataset.typeSpeed || TYPE_MS);
      sceneWait(function () { revealBubbleNow(bub); }, revealDelay);
    }
    if (si + 1 < layers.length) {
      const goNextScene = function () {
        if (run !== scenePlayRun || scenePlayPage !== idx) return;   // stale
        // Freeze the outgoing clip. When a scene is cut short — by a `hold`, or by
        // the reader tapping — it would otherwise keep playing (and SOUNDING)
        // invisibly under the 1.1s dissolve, and could even run on into a bad
        // final frame. Scenes that advance on `ended` are already stopped.
        if (vid) { try { vid.pause(); } catch (_) {} }
        layer.classList.remove("on");          // cross-dissolve: old fades out…
        layers[si + 1].classList.add("on");    // …new fades in (1.1s, CSS)
        showScene(si + 1, DISSOLVE_MS);        // next bubble pops as it lands
      };
      // A scene with `tap:` hands control to the READER: we arm the tap hot-spot
      // instead of advancing, and the tap is what advances.
      const armTap = function () {
        if (run !== scenePlayRun || scenePlayPage !== idx) return;   // stale
        armSceneTap(layer, sc.tap, goNextScene);
      };
      const advance = (sc && sc.tap) ? armTap : goNextScene;
      if (sc && sc.pour) {
        // POUR scene mid-sequence: the READER finishes it — no timers, no video.
        layer._pourDone = goNextScene;                    // full glass → next scene
        sceneWait(function () { if (layer._pourArm) layer._pourArm(); },
                  revealDelay + 250);                     // arm once the dissolve lands
      } else if (sc && sc.tap && sc.tap.after != null) {
        // `tap.after` — arm the hot-spot partway INTO the clip (once its narration
        // is over) rather than at the very end, so the reader isn't left waiting
        // through a silent, still tail. Tapping then cuts the clip short.
        sceneWait(armTap, revealDelay + sc.tap.after);
      } else if (vid && (!sc || sc.hold == null)) {
        // video scene with no explicit hold → move on when the clip ends
        vid._sceneAdv = advance;
        vid.addEventListener("ended", advance, { once: true });
        // …and if the clip can't play at all (missing file / decode error), still
        // move on — a scene that never ends would trap the reader on the page.
        vid.addEventListener("error", advance, { once: true });
      } else {
        const hold = (sc && sc.hold != null) ? sc.hold : SCENE_HOLD_MS;
        sceneWait(advance, revealDelay + typedMs + hold);
      }
    } else {
      // LAST scene of the page: signal once its dialogue has fully played out
      // (typing done / video ended / narrator hold over) → the page-turn nudge
      // may arm (it waits HINT_AFTER_DONE_MS more, see dialogueDone).
      const seqDone = function () {
        if (run !== scenePlayRun || scenePlayPage !== idx) return;   // stale
        sceneSeqDone = idx;                    // remember: this page has played out
        dialogueDone(idx);
      };
      if (sc && sc.pour) {
        // POUR scene as the page's FINALE: the full glass is what completes the
        // page — seqDone then arms the turn cue. Deliberately NO stall watchdog:
        // this is the reader's task, not a clip that can hang.
        layer._pourDone = seqDone;
        sceneWait(function () { if (layer._pourArm) layer._pourArm(); },
                  revealDelay + 250);
      } else if (vid && (!sc || sc.hold == null)) {
        vid._sceneAdv = seqDone;               // resetScenes cleans this up too
        vid.addEventListener("ended", seqDone, { once: true });
        vid.addEventListener("error", seqDone, { once: true });   // can't play → still let them turn
        armTurnCue(vid, idx);                  // …and the stall watchdog, as on a single-video page
      } else if (bub) {
        sceneWait(seqDone, revealDelay + typedMs + 600);   // pop + typing settled
      } else {
        const hold = (sc && sc.hold != null) ? sc.hold : SCENE_HOLD_MS;
        sceneWait(seqDone, revealDelay + hold);
      }
    }
  })(0, startDelay || 0);
}

/* ---- The turn cue on a VIDEO page ---------------------------------------
   A video page's narration is baked into the clip, so the "you may turn now"
   cue (corner arrow + hand nudge) waits for the clip to FINISH — otherwise the
   reader would be invited to cut the story off mid-sentence. The cue is fired by
   the video's own `ended` listener (see makeMedia).
   This watchdog is the SAFETY NET: a clip that can never finish (file missing,
   decode error, autoplay blocked, buffering forever) must not trap the reader on
   the page, so after ~5s with no playback progress we arm the cue anyway. */
let turnCueTimer = null, turnCueIdx = -1;
// Pages whose clip has already played all the way through THIS read-through. The
// gate is there so the story isn't cut off mid-sentence on first viewing — once a
// page has been watched, going back to it and forward again must not force the
// reader to sit through it a second time, so its cue is available immediately
// (the clip still replays from the top). Cleared by resetToStart for a fresh read.
const videoWatched = Object.create(null);
function armTurnCue(v, idx) {
  if (turnCueIdx === idx && turnCueTimer) return;          // already watching this page
  stopTurnCue();
  turnCueIdx = idx;
  let stuck = 0;
  turnCueTimer = setInterval(function () {
    if (flipped !== idx || hintDoneFor === idx) { stopTurnCue(); return; }  // left, or already armed
    if (v.error || v.ended) { stopTurnCue(); dialogueDone(idx); return; }
    const counting = mediaDelayTimer && mediaDelayIdx === idx;   // a `delay` countdown is not "stuck"
    stuck = (!counting && (v.paused || v.readyState < 3)) ? stuck + 1 : 0;
    if (stuck >= 5) { stopTurnCue(); dialogueDone(idx); }        // ~5s of nothing → let them turn
  }, 1000);
}
function stopTurnCue() {
  clearInterval(turnCueTimer); turnCueTimer = null; turnCueIdx = -1;
}

function refreshMedia() {
  const idx = flipped;                         // the front-most page right now
  // Is this the reader ARRIVING on the page, or just one of the several re-asserts
  // per turn? Only an arrival may replay a clip that has already finished.
  const arrived = (idx !== lastMediaIdx);
  if (arrived) {
    lastMediaIdx = idx; armBlink = true;       // arm the video-end blink once per page
    hintDoneFor = -1;                          // fresh page → nudge waits for its scenes again
    hideSoundHint(null);                       // the muted-clip rescue belongs to the page we left
    if (idx >= totalPages - 1) {
      clearProgress();                         // reached THE END → next open starts fresh
      duckMusic(false);                        // no narration here — let the music carry the page
    } else {
      saveProgress();                          // bookmark every landing
    }
  }
  // Left the page a delayed video was counting down on? Cancel that countdown.
  if (mediaDelayTimer && mediaDelayIdx !== idx) {
    clearTimeout(mediaDelayTimer); mediaDelayTimer = null; mediaDelayIdx = -1;
  }
  // Buffer + gesture-unlock ONLY this page and the next (so the upcoming flip is
  // instant and keeps sound) — never every video at once.
  warmVideo(idx); warmVideo(idx + 1); primeVideo(idx + 1);
  // Pause every video that is NOT the current page.
  leaves.forEach(function (leaf, i) {
    if (i === idx) return;
    const v = leaf.querySelector("video.page-media");
    if (v) { try { v.pause(); } catch (_) {} }
  });
  // This page's OWN video. (A video INSIDE a .page-scene belongs to the scene
  // player — playScenes starts it when its scene lands.)
  const cur = leaves[idx];
  const pv = cur && !(pages[idx] && pages[idx].scenes)
    ? cur.querySelector("video.page-media") : null;
  // Start it — but NOT while the cover is still swinging open (`mediaGate`): the
  // Play tap calls refreshMedia() at the START of the swing, so page 1's clip would
  // otherwise be seconds in — its narration playing behind a half-open cover — by
  // the time the reader can see it. warmVideo() has already decoded frame 0, so the
  // page shows its opening still meanwhile; only playback waits. Turning a page
  // always happens long after the gate opens, so flips are unaffected.
  const v = mediaGate ? pv : null;
  if (v) {
    const delayMs = (pages[idx] && pages[idx].delay) ? pages[idx].delay : 0;
    if (delayMs > 0) {
      // Already playing this page, or already counting down for it → leave it alone
      // (so the flip-start + flip-end calls don't restart the 3s countdown).
      if (mediaDelayIdx === idx && (mediaDelayTimer || !v.paused)) { /* keep going */ }
      else {
        try { v.pause(); v.currentTime = 0; } catch (_) {}   // hold on the first frame
        mediaDelayIdx = idx;
        mediaDelayTimer = setTimeout(function () {
          mediaDelayTimer = null;
          if (flipped === idx) playVideoNow(v, true);          // only if still on this page
        }, delayMs);
      }
    } else {
      playVideoNow(v, arrived);                 // no delay → instant
    }
  }
  // Reset dialogue on every page we've LEFT — delayed until the turn finishes
  // so nothing blanks mid-flip. Bubbles then replay on the next visit.
  leaves.forEach(function (leaf, i) {
    if (i === idx || leaf.dataset.resetPend) return;
    const touched = leaf.querySelector(".bubble[data-revealed], .bubble[data-sched]");
    if (!touched && scenePlayPage !== i) return;              // nothing to reset
    leaf.dataset.resetPend = "1";
    setTimeout(function () {
      delete leaf.dataset.resetPend;
      if (flipped === i) return;               // reader came straight back — keep it
      if (scenePlayPage === i) stopScenes();
      leaf.querySelectorAll(".bubble").forEach(resetBubble);
      if (pages[i] && pages[i].scenes) resetScenes(leaf);
    }, FLIP_MS + 80);
  });
  // Start this page's dialogue: the scene sequence, or the single bubble —
  // Pop + Typewriter, timed so it lands as the page finishes turning.
  // (Scenes only run while the book is OPEN — never behind a closing cover.)
  if (cur && pages[idx] && pages[idx].scenes) {
    if (opened) {
      playScenes(idx, animating ? 700 : 150);
      // Returned to a page whose sequence already played out before its
      // reset kicked in (quick back-and-forth): it's still "done".
      if (scenePlayPage === idx && sceneSeqDone === idx) dialogueDone(idx);
    }
  } else {
    const bub = cur && cur.querySelector(".bubble");
    if (bub && !bub.dataset.revealed && !bub.dataset.sched) {
      bub.dataset.sched = "1";
      bub._revealTimer = dlgWait(function () {
        delete bub.dataset.sched;
        if (flipped === idx) revealBubbleNow(bub);
      }, animating ? 700 : 150);
      // …and once the bubble has popped + typed out, the nudge may arm.
      const bt = bub.querySelector(".bubble-text");
      const btFull = (bt && (bt.dataset.full || bt.textContent)) || "";
      dlgWait(function () { dialogueDone(idx); },
              (animating ? 700 : 150) + TYPE_LAG_MS +
              btFull.length * (+bub.dataset.typeSpeed || TYPE_MS) + 600);
    } else if (bub && bub.dataset.revealed && !bub._typeTimer && !bub._typeStartTimer) {
      dialogueDone(idx);                       // already popped + typed (quick return)
    } else if (pv) {
      // VIDEO page: the turn cue waits for the clip to end (armTurnCue above),
      // unless this page has already been watched right through once. Armed only
      // once the clip can actually run — refreshMedia() runs again the moment the
      // media gate opens, which is when playback starts.
      if (mediaGate) {
        if (videoWatched[idx]) dialogueDone(idx); else armTurnCue(pv, idx);
      }
    } else if (!bub && cur) {
      dialogueDone(idx);                       // no dialogue at all (e.g. THE END)
    }
  }
  // Right-side page stack shrinks toward the end: 3 sheets → … → 0 on the last page.
  if (pageStackEl) pageStackEl.dataset.count = String(Math.max(0, Math.min(3, totalPages - 1 - flipped)));
  // Restart the idle → page-turn-hint countdown for the page we've just landed on
  // (uses the NEW `flipped`, so the delay is right: 5s on page 1, 10s afterwards).
  if (typeof resetIdleHint === "function") resetIdleHint();
}

/* ---- Navigation (drives the CSS leaf flip) ------------------------------ */
function turnLeaf(leaf) {                 // shared flip visuals + timing
  if (G) {
    // PEEL path — a real corner-peel turn (see the PAGE-PEEL ENGINE above):
    // the corner travels its canonical arc while the fold sweeps the page.
    const toFlipped = leaves.indexOf(leaf) < flipped;   // turning left, or back right?
    peelTurn(leaf, toFlipped, {
      done: function () {
        animating = false; updateProgress();
        refreshMedia();                  // re-assert once settled (idempotent safety net)
      }
    });
  } else {
    // Fallback — the original CSS-transition flip.
    leaf.style.zIndex = 300;             // lift the turning sheet above everything
    leaf.classList.add("flipping");      // enables the moving curl shading
    renderLeaves();
    setTimeout(function () {
      leaf.classList.remove("flipping");
      animating = false; updateZ(); updateProgress();
      refreshMedia();                    // re-assert once settled (idempotent safety net)
    }, FLIP_MS + 40);
  }
  refreshMedia();                        // START now → the target video plays INSTANTLY
                                          // (as the page is revealed, not after the flip)
  playFlip();
  updateProgress();
}
function goNext() {
  if (!opened || !ready || animating) return;   // wait until the cover has fully opened
  if (hintDoneFor !== flipped) return;           // scenes/dialogue still playing → no turning
  if (flipped >= totalPages - 1) return;         // already on the LAST page (THE END)
  animating = true;
  const leaf = leaves[flipped];                  // the page to turn
  flipped++;
  turnLeaf(leaf);
}
function goPrev() {
  if (!opened || !ready || animating) return;   // wait until the cover has fully opened
  if (flipped <= 0) return;               // already on the first page
  // (going BACK is allowed even while a scene is playing — only forward waits)
  animating = true;
  flipped--;
  turnLeaf(leaves[flipped]);
}

/* ---- Nav state (the "Page X / N" counter has been removed) --------------- */
function updateProgress() {
  // Corner arrows: BACK is hidden on page 1 only (visible + usable everywhere
  // else, even mid-scene). NEXT stays HIDDEN until the page's scenes/dialogue
  // have fully played out (dialogueDone() re-runs this), then fades in.
  const dlgDone = hintDoneFor === flipped;
  const showPrev = opened && ready && flipped > 0;
  const showNext = opened && ready && dlgDone && flipped < totalPages - 1;
  if (cornerPrev) {
    cornerPrev.classList.toggle("hide", !showPrev);
    cornerPrev.disabled = !showPrev;
  }
  if (cornerNext) {
    cornerNext.classList.toggle("hide", !showNext);
    cornerNext.disabled = !showNext;
  }
}

/* ---- Fullscreen: go FULLSCREEN when the book opens (the Play tap is the user
   gesture the Fullscreen API requires) and LEAVE fullscreen when back at the
   cover (Home / Replay). Applies on every screen; silently no-ops where the
   browser blocks it (e.g. iPhone Safari can't fullscreen arbitrary elements). */
function enterFullscreen() {
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) return;
    var el = document.documentElement;
    var req = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen || el.msRequestFullscreen;
    if (req) { var p = req.call(el); if (p && p.catch) p.catch(function () {}); }
  } catch (_) {}
}
function exitFullscreen() {
  try {
    if (!(document.fullscreenElement || document.webkitFullscreenElement)) return;
    var ex = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen || document.msExitFullscreen;
    if (ex) { var p = ex.call(document); if (p && p.catch) p.catch(function () {}); }
  } catch (_) {}
}

/* ---- Open the 3D cover, then hand off to the page-turning book ----------
   Shared by the first open (openBook) AND Replay (replayBook), so the dramatic
   hinge-open + post-open setup are identical both times. */
function runOpenSequence() {
  ready = false;
  document.body.classList.remove("is-closing");
  document.body.classList.add("is-open");
  // The whole open motion IS the cover's own hinge — NO zoom / camera move.
  book.classList.remove("closing");
  book.classList.add("open");          // cover hinges open on the LEFT spine
  bookFloat.classList.add("rest");     // stop the idle bob
  coverScene.classList.remove("parked");
  flipbookEl.style.zIndex = "";        // cover ABOVE the pages while it swings open
  applyResume();                       // unlock previously watched pages (start stays page 1)
  keepAwake();                         // hands-off story → the screen must not sleep
  // Reveal the REAL page right away (it sits beneath the cover, masked by it).
  flipbookEl.classList.add("show");
  // A user gesture drives every open, so start audio here.
  soundOn();
  resumeAudio();
  playCoverFlip();
  playBgMusic();                        // start the looping background music
  primeVideo(flipped); primeVideo(flipped + 1);   // unlock the landing page + next inside the gesture
  refreshMedia();                       // buffer + hold the landing page on its first frame
  // Page 1's clip starts as soon as the cover is VISUALLY FLAT — the coverOpen
  // keyframes hit -180.4deg at 84%, and the last 16% is a 0.4deg settle nobody can
  // see. Waiting for the whole animation left ~1s of dead air on a page the reader
  // was already looking at. (`ready`, which unlocks flips, still waits for the
  // full swing — only playback moves earlier.)
  clearTimeout(_mediaGateTimer);
  mediaGate = false;
  _mediaGateTimer = setTimeout(function () {
    mediaGate = true;
    refreshMedia();
  }, Math.round(COVER_OPEN_MS * 0.84));
  // Once the cover has FULLY opened, park it, lift the pages above it, hand over
  // pointer events, and mark the book READY.
  clearTimeout(_openTimer);
  _openTimer = setTimeout(function () {
    coverScene.classList.add("parked");
    flipbookEl.style.zIndex = "5";        // pages now sit ABOVE the parked cover (z3)
    tapCatcher.style.pointerEvents = "none";
    flipbookEl.style.pointerEvents = "auto";
    ready = true;
    updateProgress();
    refreshMedia();
    resetIdleHint();
  }, COVER_OPEN_MS + 50);
  updateProgress();
}
function openBook() {
  console.log("[The Story Night] openBook() called — opened was:", opened);
  if (opened) return;
  opened = true;
  enterFullscreen();          // Play tap is a user gesture → allowed to go fullscreen
  runOpenSequence();
}

/* ---- Reset the whole book to the START SCREEN: the CLOSED FRONT COVER + Play
   button, exactly like a fresh load (so tapping Play reads from the top). Shared
   by Replay and Home (called once the closing swing has finished). --------- */
function resetToStart() {
  exitFullscreen();           // back at the cover → leave fullscreen
  ready = false; opened = false; flipped = 0;
  mediaGate = false; clearTimeout(_mediaGateTimer);   // re-gated for the next read
  animating = false;          // never carry a stuck flip-lock into the next read
  renderLeaves();
  clearFlipFX(null);                           // kill any lingering cast shadow / flex
  if (peelFoldWrap) peelFoldWrap.style.display = "none";   // hide a lingering fold-back
  leaves.forEach(function (leaf) {
    var vv = leaf.querySelector("video.page-media");
    if (vv) { try { vv.pause(); vv.currentTime = 0; } catch (_) {} }
  });
  // Fresh dialogue for the next read-through: stop the scene player and put
  // every bubble / scene sequence back to its start.
  hintDoneFor = -1;                            // nudge re-gates on the next read
  for (var k in videoWatched) delete videoWatched[k];   // every page is unwatched again
  stopScenes();
  leaves.forEach(function (leaf, i) {
    leaf.querySelectorAll(".bubble").forEach(resetBubble);
    if (pages[i] && pages[i].scenes) resetScenes(leaf);
  });
  lastMediaIdx = -1;
  document.body.classList.remove("is-open", "is-closing");
  book.classList.remove("open", "closing");
  coverScene.classList.remove("parked");
  cover.style.transform = "";                 // cover CLOSED → front cover + Play button showing
  flipbookEl.classList.remove("show");         // pages hidden behind the closed cover
  flipbookEl.style.zIndex = "";
  flipbookEl.style.pointerEvents = "none";
  bookFloat.classList.remove("rest");          // resume the idle bob
  tapCatcher.style.pointerEvents = "auto";     // Play is tappable again
  hideFlipHint(); clearTimeout(idleHintTimer); clearTimeout(nudgeHideTimer);
  stopTurnCue();                               // no watchdog running behind the cover
  hideSoundHint(null);
  releaseWake();                               // closed book → the screen may sleep again
  clearProgress();                             // closing to the cover IS choosing a fresh read
  try { bgMusic.pause(); bgMusic.currentTime = 0; bgMusic.volume = BG_VOL; } catch (_) {}   // stop music, un-ducked for next Play
  updateProgress();                            // re-sync nav state (arrows greyed)
}

/* ---- CLOSE THE BOOK: the cover swings SHUT — the exact REVERSE of the opening
   hinge (cover −180 → 0) — and the book lands on the front cover. Used by
   REPLAY (from THE END page). `afterReset` runs once we're back on the cover. */
function closeBookToCover(afterReset) {
  ready = false;                               // block flips during the close
  mediaGate = false;                           // …and no clip may (re)start behind the closing cover
  clearTimeout(_mediaGateTimer);
  clearTimeout(_openTimer);
  clearTimeout(_homeTimer);
  hideFlipHint(); cancelPeek(); clearTimeout(idleHintTimer); clearTimeout(nudgeHideTimer);
  stopTurnCue();
  if (cornerNext) cornerNext.classList.remove("blink", "blink1");
  var v = currentVideo(); if (v) { try { v.pause(); } catch (_) {} }
  flipbookEl.style.pointerEvents = "none";
  tapCatcher.style.pointerEvents = "none";
  // REAL-BOOK CLOSE, in two beats:
  //   1) every turned page riffles back to the right (cascadeClose) — the pages
  //      stay ABOVE the parked cover for this, so the riffle is fully visible;
  //   2) then the cover swings shut over page 1 (the original closing hinge).
  cascadeClose(function () {
    // pages back UNDER the cover, so the closing cover sweeps over them
    flipbookEl.style.zIndex = "";
    coverScene.classList.remove("parked");
    // CLOSE — reverse of the opening hinge (cover swings from -180 back to 0).
    // is-closing keeps the current page bright (hides the dark thickness block) and
    // hides any stray turned page, so the cover folds cleanly.
    document.body.classList.add("is-closing");
    book.classList.remove("open");
    book.classList.add("closing");
    playCoverFlip();
    _homeTimer = setTimeout(function () {
      resetToStart();
      if (typeof afterReset === "function") afterReset();
    }, COVER_CLOSE_MS + 60);
  });
}

/* ---- REPLAY (button on THE END page): close the book with the reverse-of-open
   swing and land on the front cover, ready for another read. */
function replayBook() {
  if (!opened || animating) return;
  closeBookToCover();
}

/* ==========================================================================
   INPUT  —  tap PLAY to OPEN the cover; once open, drag + corner arrows +
   keyboard drive the page flip.
   ========================================================================== */
const tapCatcher = document.getElementById("tapCatcher");

/* The book opens ONLY from the Play button. The tap-catcher still sits on top to
   block page gestures before opening, but it opens the book only when the tap
   lands inside the play button's (breathing) hit-circle — taps elsewhere on the
   cover do nothing. */
function tapHitsPlay(e) {
  const r = hint.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const rad = Math.max(r.width, r.height) / 2;
  return Math.hypot(e.clientX - cx, e.clientY - cy) <= rad;
}
if (tapCatcher) tapCatcher.addEventListener("click", function (e) { if (!opened && tapHitsPlay(e)) openBook(); });
// Show the hand cursor ONLY over the play button — the sole CTA on the cover.
if (tapCatcher) tapCatcher.addEventListener("mousemove", function (e) {
  tapCatcher.style.cursor = (!opened && tapHitsPlay(e)) ? "pointer" : "default";
});

// The play button itself (also covers keyboard: Enter/Space on the focused button).
hint.addEventListener("click", function (e) { e.stopPropagation(); if (!opened) openBook(); });

// Bottom-corner flip arrows (outside the book): back = left, forward = right.
cornerPrev.addEventListener("click", function (e) { e.stopPropagation(); goPrev(); this.blur(); });
cornerNext.addEventListener("click", function (e) { e.stopPropagation(); goNext(); this.blur(); });
if (replayBtn) replayBtn.addEventListener("click", function (e) { e.stopPropagation(); replayBook(); this.blur(); });

// Page interaction — DRAG TO TURN: grab the page and it follows your cursor,
// rotating about the spine, then SNAPS to the nearest state when you let go.
//   • drag LEFT  → turn the current page forward (it comes to rest on the cover)
//   • drag RIGHT → turn the previous page back
// A plain tap does nothing; the corner arrows + keyboard still work.
(function () {
  let startX = 0, startY = 0, pw = 1;
  let leaf = null, dir = 0, decided = false, dragging = false;
  let pC0 = null, pS = null, pP = null;               // peel drag: corner start, grab point, corner now
  let lastX = 0, lastT = 0, vx = 0;                   // for flick (velocity) detection
  const DECIDE = 6;                                   // px before we commit to a drag
  const FLICK = 0.45;                                 // px/ms — a quick flick completes the turn
  const FINISH_DEG = 45;                              // turned this far (deg) → completes on release

  // how many degrees the drag has turned the page (0..180)
  function degFromDx(dx) { return Math.max(0, Math.min(180, Math.abs(dx) / pw * 180)); }
  // the live angle for the active leaf, given the raw horizontal travel
  function liveAngle(dx) {
    return (dir === 1) ? degFromDx(Math.min(0, dx))          // forward: leftward turns 0→180
                       : 180 - degFromDx(Math.max(0, dx));   // back: starts at 180, rightward → 0
  }

  flipbookEl.addEventListener("pointerdown", function (e) {
    if (!opened || !ready || animating) return;
    startX = e.clientX; startY = e.clientY;
    lastX = e.clientX; lastT = e.timeStamp || performance.now(); vx = 0;
    decided = false; dragging = true; leaf = null; dir = 0;
    pC0 = pS = pP = null;
    pw = flipbookEl.getBoundingClientRect().width || 1;
  });

  flipbookEl.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    const now = e.timeStamp || performance.now();
    const dt = now - lastT;
    if (dt > 0) vx = (e.clientX - lastX) / dt;         // running horizontal velocity
    lastX = e.clientX; lastT = now;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (!decided) {
      if (Math.abs(dx) < DECIDE || Math.abs(dx) <= Math.abs(dy)) return;   // wait for a clear horizontal drag
      if (dx < 0 && flipped < totalPages - 1 &&
          hintDoneFor === flipped)            { dir = 1;  leaf = leaves[flipped]; }     // forward only AFTER the scenes finish
      else if (dx > 0 && flipped > 0)         { dir = -1; leaf = leaves[flipped - 1]; } // turn back (always allowed)
      else { dragging = false; return; }                  // nothing to turn that way
      decided = true;
      leaf.style.transition = "none";                     // follow the finger exactly
      leaf.style.zIndex = 300;
      if (G) {                                            // PEEL drag: the page corner follows
        pC0 = (dir === 1) ? { x: PW, y: PH } : { x: -PW, y: PH };   // where the corner rests now
        pS  = bookPt(e);                                  // grab point (keeps the grab offset)
        pP  = { x: pC0.x, y: pC0.y };
        leaf.style.transform = "none";                    // flat — the travelling fold turns it
        renderPeel(leaf, pP);
      }
      try { flipbookEl.setPointerCapture(e.pointerId); } catch (_) {}
    }
    if (G) {
      // Corner = its resting spot + how far the finger has travelled, kept
      // physical (paper can't stretch past the spine anchors).
      const bp = bookPt(e);
      pP = clampPeelP({ x: pC0.x + (bp.x - pS.x), y: pC0.y + (bp.y - pS.y) });
      renderPeel(leaf, pP);
      return;
    }
    const ang = Math.max(0, Math.min(180, liveAngle(dx)));
    // Fallback (no GSAP) rigid drag: curls, cast shadow, media flex — and the
    // sheet's sag + lift composed into the follow-the-finger transform.
    const fx = applyFlipFX(leaf, ang);
    leaf.style.transform = "rotateY(" + (-ang) + "deg) rotateX(" + fx.sag.toFixed(2) +
                           "deg) translateZ(" + fx.lift.toFixed(1) + "px)";
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    const L = leaf, D = dir;
    leaf = null;
    if (!decided || !L) return;                           // a plain tap → nothing

    const flick = (D === 1) ? (vx < -FLICK) : (vx > FLICK);

    if (G) {
      // PEEL release: the fold keeps going from wherever the finger let go —
      // completing over the spine or settling back down — with a duration
      // scaled to the remaining distance, like releasing a real page mid-peel.
      const P0 = pP || { x: (D === 1 ? PW : -PW), y: PH };
      const prog = (PW - P0.x) / (2 * PW);              // 0 = flat right … 1 = fully turned
      const complete = (D === 1) ? (prog > 0.15 || flick) : (prog < 0.85 || flick);
      const endFlipped = (D === 1) ? complete : !complete;
      animating = true;
      if (complete) { playFlip(); flipped += (D === 1) ? 1 : -1; }
      renderLeaves();                                   // final classes now (inline overrides)
      refreshMedia();                                   // START the target video INSTANTLY
      L.style.zIndex = 300;                             // keep the peeling sheet on top
      const target = endFlipped ? { x: -PW, y: PH } : { x: PW, y: PH };
      const proxy = { x: P0.x, y: P0.y };
      const dist = Math.min(1, Math.hypot(target.x - P0.x, target.y - P0.y) / (2 * PW));
      if (_peelTween) _peelTween.kill();
      _peelTween = G.to(proxy, {
        x: target.x, y: target.y,
        duration: Math.max(0.3, FLIP_S * dist),
        ease: flick ? "power2.out" : "power2.inOut",
        onUpdate: function () { renderPeel(L, proxy); },
        onComplete: function () {
          _peelTween = null;
          peelEnd(L);
          animating = false; updateProgress();
          refreshMedia();                               // re-assert once settled
        }
      });
      updateProgress();
      return;
    }

    const ang = Math.max(0, Math.min(180, liveAngle(e.clientX - startX)));
    // Complete the turn if it's been dragged far enough OR flicked quickly in
    // the turn's direction — no need to drag all the way past halfway.
    const complete   = (D === 1) ? (ang > FINISH_DEG || flick)
                                 : (ang < 180 - FINISH_DEG || flick);
    const endFlipped = (D === 1) ? complete   : !complete;    // does this leaf end up turned?

    animating = true;
    if (complete) { playFlip(); flipped += (D === 1) ? 1 : -1; }

    clearFlipFX(L);         // drop the inline FX; the .flipping keyframe takes over
    // Lock in the resting classes + z-index NOW (so nothing pops in later), then
    // animate the inline transform from the dragged angle to the target. The
    // .flipped class already holds the same final angle underneath.
    L.style.transition = "";                              // restore the CSS flip transition
    void L.offsetWidth;                                   // reflow so it animates FROM the dragged angle
    L.classList.add("flipping");                          // curl shading during the snap
    renderLeaves();                                       // apply .flipped + z-index immediately
    refreshMedia();                                       // START the target video INSTANTLY
    L.style.transform = endFlipped ? "rotateY(-180deg)" : "rotateY(0deg)";
    updateProgress();

    setTimeout(function () {
      L.classList.remove("flipping");
      // Drop the inline transform WITHOUT re-animating: the .flipped class already
      // holds the final angle, so disabling the transition for this swap prevents
      // the leaf from briefly swinging back (the "page reappears on the left" glitch).
      L.style.transition = "none";
      L.style.transform = "";
      void L.offsetWidth;                                 // commit with no transition
      L.style.transition = "";                            // restore for the next turn
      animating = false; updateProgress();
      refreshMedia();                                     // re-assert once settled (idempotent safety net)
    }, FLIP_MS + 40);
  }
  flipbookEl.addEventListener("pointerup", endDrag);
  flipbookEl.addEventListener("pointercancel", endDrag);
})();

window.addEventListener("keydown", function (e) {
  if (e.key === "ArrowRight") { e.preventDefault(); opened ? goNext() : openBook(); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
  else if ((e.key === " " || e.key === "Enter") && !opened) { e.preventDefault(); openBook(); }
});

// Keep the canvas scaled to fit on resize / rotate.
let _resizeSettle = null;
function onViewportChange() {
  // Suppress the page-turn transitions while the viewport is actively changing, so
  // a rapid resize / resolution change can't make the book LOOK like it's auto-
  // flipping (the leaves re-render during the scale change). Restored once settled.
  document.body.classList.add("is-resizing");
  clearTimeout(_resizeSettle);
  _resizeSettle = setTimeout(function () { document.body.classList.remove("is-resizing"); }, 220);
  fitScale();
}
window.addEventListener("resize", onViewportChange);
window.addEventListener("orientationchange", onViewportChange);

/* ---- Block ALL zoom (pinch, double-tap, ctrl+wheel, ctrl +/-) ------------
   The book is fixed-layout, so zoom would only break it. */
(function () {
  // Never let anything (esp. page images) start a native HTML5 drag — that was
  // showing a "ghost" of the image following the cursor during a page-flip drag.
  document.addEventListener("dragstart", function (e) { e.preventDefault(); });
  ["gesturestart", "gesturechange", "gestureend"].forEach(function (t) {   // iOS pinch
    document.addEventListener(t, function (e) { e.preventDefault(); }, { passive: false });
  });
  window.addEventListener("wheel", function (e) {                          // desktop ctrl+wheel
    if (e.ctrlKey) e.preventDefault();
  }, { passive: false });
  window.addEventListener("keydown", function (e) {                        // ctrl/⌘ +/-/0
    if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "0"].indexOf(e.key) !== -1) e.preventDefault();
    // Block "Save page" (Ctrl/⌘+S) — a casual way to grab the media.
    if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) e.preventDefault();
  });
  document.addEventListener("touchmove", function (e) {                    // 2-finger pinch
    if (e.touches && e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  // NOTE: the right-click / context menu is intentionally LEFT ENABLED (so "Inspect"
  // and dev tools work). Casual image protection still stands via CSS — no drag,
  // no text-selection, no iOS long-press "Save Image" callout — plus Ctrl+S is blocked.
})();

/* ==========================================================================
   SOUND  —  page-flip + cover-flip SFX live in sfx/ (engine). The looping
   BACKGROUND MUSIC is your story's — set its path as STORY.music in story.js
   (leave it out for a silent book). All muted until the book is opened (a
   user gesture the browser needs before it will play audio).
   ========================================================================== */
let muted = true;

// Looping BACKGROUND MUSIC (from story.js) at 20% volume. Started on open (a
// user gesture) so the browser allows it to play with sound.
const BG_VOL   = 0.20;                        // music alone (cover, page turns, THE END)
const DUCK_VOL = 0.06;                        // music under a page's narration
const bgMusic = new Audio(STORY.music ? encodeURI(STORY.music) : "");
bgMusic.loop = true;
bgMusic.volume = BG_VOL;
bgMusic.preload = "auto";
function playBgMusic() {
  if (!STORY.music) return;                   // no music set → silent book
  try {
    const p = bgMusic.play();
    if (p && p.catch) p.catch(function () {});   // ignore autoplay rejections
  } catch (_) {}
}
/* DUCKING — the music dips while a page's clip narrates and swells back between
   pages, so the story is always the loudest thing the child hears. (At a flat
   20% the music sat right under every voice-over, competing with it.) */
let _duckTween = null;
function duckMusic(on) {
  if (!STORY.music) return;
  const to = on ? DUCK_VOL : BG_VOL;
  if (G) {
    if (_duckTween) _duckTween.kill();
    _duckTween = G.to(bgMusic, { volume: to, duration: 0.45, ease: "sine.out", overwrite: true });
  } else {
    bgMusic.volume = to;
  }
}

/* ---- SOUND RESCUE — "Tap for sound" -----------------------------------------
   The one failure mode where the book just looks broken: the browser refuses
   audible autoplay, the clip plays MUTED, and a child watches a silent story
   with no idea anything is wrong. Tapping the page already fixes it (a tap is a
   user gesture) — this chip only exists to SAY so, and only in that failure
   mode. It hides the moment sound is recovered, or with its clip. */
let soundHintEl = null, _soundHintFor = null;
function showSoundHint(v) {
  _soundHintFor = v;
  if (!soundHintEl) {
    soundHintEl = document.createElement("div");
    soundHintEl.className = "sound-hint";
    soundHintEl.setAttribute("aria-live", "polite");
    soundHintEl.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" ' +
      'd="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 ' +
      '2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06 ' +
      'c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>' +
      "<span>Tap the page for sound</span>";
    document.body.appendChild(soundHintEl);
  }
  soundHintEl.classList.add("show");
  // sound recovered by ANY route (tap handler, OS media keys) → chip goes
  v.addEventListener("volumechange", function onV() {
    if (!v.muted) { v.removeEventListener("volumechange", onV); hideSoundHint(v); }
  });
}
function hideSoundHint(v) {
  if (!soundHintEl) return;
  if (v && _soundHintFor && v !== _soundHintFor) return;   // some other clip's hint
  soundHintEl.classList.remove("show");
  _soundHintFor = null;
}

/* ---- WAKE LOCK — the screen must not sleep mid-story -------------------------
   The whole book is hands-off: a child watches 15–30s clips without touching the
   screen, and tablets dim/sleep after ~30s idle — right in the middle of a page.
   Requested on open (a user gesture), re-acquired when the tab comes back (the
   OS releases it on every hide), released when the book closes. Silently absent
   on browsers without the API — worst case is the old behaviour. */
let _wakeLock = null;
function keepAwake() {
  if (!opened || !navigator.wakeLock || document.hidden) return;
  navigator.wakeLock.request("screen").then(function (wl) {
    _wakeLock = wl;
  }).catch(function () {});                    // denied (battery saver etc.) → fine
}
function releaseWake() {
  if (_wakeLock) { try { _wakeLock.release(); } catch (_) {} _wakeLock = null; }
}
document.addEventListener("visibilitychange", function () {
  if (!document.hidden) keepAwake();           // hides always drop the lock — take it back
});

/* ---- REMEMBER WHAT'S BEEN WATCHED ---------------------------------------------
   Every clip is watch-to-the-end gated, so losing your place is EXPENSIVE: a
   refresh on page 7 used to mean sitting through six clips again to get back.
   The set of watched pages is saved as the reader goes; on the next open the
   book still starts at PAGE 1 (an earlier version jumped straight to the saved
   page, which read as "the book starts in the middle" — a bug report, not a
   feature), but every previously watched page's turn cue unlocks the moment it
   is revisited — so getting back to where you were is a few quick taps, not a
   re-watch. Finishing the story (THE END) or tapping Replay clears the memory —
   a fresh read is a deliberate act, and it gates afresh.
   Keyed by the story's cover path, so two different books served from the same
   origin don't inherit each other's state. localStorage can be unavailable
   (privacy modes) — every touch is try/caught; the feature just disappears. */
const PROGRESS_KEY = "flipbook-progress:" + (STORY.cover || "default");
function saveProgress() {
  try {
    const watched = Object.keys(videoWatched).map(Number);
    if (!watched.length || flipped >= totalPages - 1) { localStorage.removeItem(PROGRESS_KEY); return; }
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ watched: watched }));
  } catch (_) {}
}
function clearProgress() {
  try { localStorage.removeItem(PROGRESS_KEY); } catch (_) {}
}
/* Restore the watched set (never the position — the book always opens on page 1). */
function applyResume() {
  try {
    const s = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "null");
    if (!s) return;
    (s.watched || []).forEach(function (i) {
      if (i >= 0 && i < totalPages - 1) videoWatched[i] = true;
    });
  } catch (_) {}
}

/* ---- Pause ALL audio when the tab / window goes to the background -----------
   Background music AND the current page's video (its voice-over) must stop the
   moment the reader switches tab or app, and resume when they come back — they
   were continuing to play in the background. Covers visibilitychange (tab switch),
   blur (other window), and pagehide (mobile app switch / bfcache). */
let _bgWasPlaying = false;
function currentVideo() {
  const leaf = leaves[flipped];
  return leaf ? leaf.querySelector("video.page-media") : null;
}
function pauseAllAudioFB() {
  if (!bgMusic.paused) { _bgWasPlaying = true; try { bgMusic.pause(); } catch (_) {} }
  const v = currentVideo();
  if (v && !v.paused) { v.dataset.wasPlaying = "1"; try { v.pause(); } catch (_) {} }
  if (audioCtx && audioCtx.state === "running") { try { audioCtx.suspend(); } catch (_) {} }
}
function resumeAllAudioFB() {
  if (document.hidden || !document.hasFocus()) return;   // only when truly back in front
  if (!opened) return;                                   // nothing plays before the book opens
  if (audioCtx && audioCtx.state === "suspended") { try { audioCtx.resume(); } catch (_) {} }
  if (_bgWasPlaying) { _bgWasPlaying = false; playBgMusic(); }
  const v = currentVideo();
  if (v && v.dataset.wasPlaying && !v.ended) { delete v.dataset.wasPlaying; const p = v.play(); if (p && p.catch) p.catch(function () {}); }
}
document.addEventListener("visibilitychange", function () {
  if (document.hidden) pauseAllAudioFB(); else resumeAllAudioFB();
});
window.addEventListener("blur", pauseAllAudioFB);
window.addEventListener("focus", resumeAllAudioFB);
window.addEventListener("pagehide", pauseAllAudioFB);

/* ---- One-shot SFX via Web Audio (glitch-free, zero-latency) --------------
   An <audio> element pays a real first-play init cost and can stutter on short
   one-shots — that was the cover-flip "lag/glitch". Instead we decode each SFX
   ONCE into an AudioBuffer and play it through a BufferSource: sample-accurate,
   no start latency. Any leading silence baked into the mp3 is auto-skipped (we
   start on the first audible sample). Buffers come from base64 data URIs
   (window.SFX_DATA in sfx-data.js) so they decode even on file://, where fetch()
   of a plain path is blocked. If Web Audio is unavailable we fall back to plain
   <audio> elements (the old behaviour). */
let audioCtx = null;
const sfxBuf = {};                          // name -> { buffer, offset (seconds) }

// Fallback <audio> elements — used ONLY if Web Audio fails to init or decode.
const flipSound = new Audio("sfx/Page%20flip.mp3");
flipSound.preload = "auto";
const coverFlipSound = new Audio("sfx/cover%20page%20flip.mp3");
coverFlipSound.preload = "auto";
coverFlipSound.volume = 0.35;

(function initSfx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  const DATA = window.SFX_DATA || {};
  if (!AC || !DATA.cover) return;           // no Web Audio / no inlined data → fallback
  try { audioCtx = new AC(); } catch (_) { audioCtx = null; return; }
  function decode(name, uri) {
    fetch(uri).then(function (r) { return r.arrayBuffer(); })
      .then(function (a) { return audioCtx.decodeAudioData(a); })
      .then(function (buf) {
        // Skip any leading silence so playback starts right on the transient.
        const ch = buf.getChannelData(0), sr = buf.sampleRate, thr = 0.008;
        let first = 0;
        for (let i = 0; i < ch.length; i++) { if (Math.abs(ch[i]) > thr) { first = i; break; } }
        sfxBuf[name] = { buffer: buf, offset: Math.max(0, first / sr - 0.004) };
      })
      .catch(function () {});               // leave name unset → falls back to <audio>
  }
  decode("cover", DATA.cover);
  decode("flip", DATA.flip);
})();

// The audio context starts suspended until a user gesture. Resume it on the first
// pointer press (fires just BEFORE the open click) so the cover-flip sound, played
// a moment later, is instant. Capture phase, not once (cheap + always safe).
function resumeAudio() {
  if (audioCtx && audioCtx.state === "suspended") { try { audioCtx.resume(); } catch (_) {} }
}
document.addEventListener("pointerdown", resumeAudio, { capture: true });

// Play a decoded SFX buffer; returns false if Web Audio isn't ready (→ caller
// falls back to the <audio> element).
function playSfx(name, vol, rate) {
  const entry = sfxBuf[name];
  if (!audioCtx || !entry) return false;
  try {
    if (audioCtx.state === "suspended") audioCtx.resume();
    const src = audioCtx.createBufferSource();
    src.buffer = entry.buffer;
    if (rate) src.playbackRate.value = rate;
    const g = audioCtx.createGain();
    g.gain.value = (vol == null ? 1 : vol);
    src.connect(g).connect(audioCtx.destination);
    src.start(0, entry.offset || 0);        // start on the first audible sample
    return true;
  } catch (_) { return false; }
}

// Page-flip sound — snappy 1.5× on every ordinary flip.
function playFlip() {
  if (muted) return;                        // sound turns on when the book opens
  if (playSfx("flip", 1.0, 1.5)) return;    // Web Audio path
  try {                                     // fallback
    flipSound.currentTime = 0; flipSound.playbackRate = 1.5;
    const p = flipSound.play(); if (p && p.catch) p.catch(function () {});
  } catch (_) {}
}
// COVER-page flip sound — played ONLY when the cover opens (never on page flips).
function playCoverFlip() {
  if (muted) return;
  if (playSfx("cover", 0.35)) return;       // Web Audio path
  try {                                     // fallback
    coverFlipSound.currentTime = 0;
    const p = coverFlipSound.play(); if (p && p.catch) p.catch(function () {});
  } catch (_) {}
}
// Turn sound ON when the book is opened (a clear user gesture). Safe to call
// repeatedly.
function soundOn() {
  muted = false;                     // opening the book turns sound on
}


/* ==========================================================================
   PAGE-TURN HINT  —  guidance for readers who don't know how to turn the page.
   When idle, two cues fire together: a hand taps the forward arrow AND the page
   itself does a "ghost" half-flip (lifts toward the next page, then falls back).
   Timing: PAGE 1 after 5s, every later page after 10s of no interaction; repeats
   while idle and is cancelled by any tap / key / flip. Never on the last page.
   ========================================================================== */
// The nudge is a HAND on the RIGHT side of the book. Optional engine art at
// engine/hand-nudge.png is used if present; until it exists, an emoji hand
// stands in (the <img> error handler swaps to it).
let flipHint = document.createElement("img");
flipHint.className = "flip-hint";
flipHint.setAttribute("aria-hidden", "true");
flipHint.alt = "";
flipHint.decoding = "async";
flipHint.src = "engine/hand-nudge.png";
flipHint.addEventListener("error", function () {
  const el = document.createElement("div");
  el.className = "flip-hint flip-hint--svg";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = HAND_SVG;       // same hand as the in-page tap spot
  if (flipHint.parentNode) flipHint.parentNode.replaceChild(el, flipHint);
  flipHint = el;                 // later show/position calls use the swapped-in element
}, { once: true });
document.body.appendChild(flipHint);

// Guidance timing: the nudge NEVER interrupts a scene — it appears only after
// the page's dialogue/scene sequence has fully finished (dialogueDone below),
// waits HINT_AFTER_DONE_MS more, then plays. It repeats every NUDGE_GAP_MS
// until the reader turns the page; any interaction resets it.
const HINT_AFTER_DONE_MS = 2000;  // breathing room after the scene completes
const NUDGE_SHOW_MS = 2000;    // how long one nudge stays on screen
const NUDGE_GAP_MS  = 9000;    // gap after it disappears before it plays again
let idleHintTimer = null;
let nudgeHideTimer = null;
let hintDoneFor = -1;          // page index whose dialogue has fully played out
let peeking = false;
let peekTimers = [];

/* The current page's dialogue/scenes have finished — the nudge may now arm.
   Called by the scene player (last scene done) and the single-bubble path. */
function dialogueDone(idx) {
  if (idx !== flipped) return;               // stale — we've left that page
  hintDoneFor = idx;
  updateProgress();                          // un-grey the corner arrows
  clearTimeout(idleHintTimer);
  clearTimeout(nudgeHideTimer);
  idleHintTimer = setTimeout(triggerHint, HINT_AFTER_DONE_MS);
}

function canShowHint() {
  return opened && ready && !animating &&
         hintDoneFor === flipped &&          // never before the scene completes
         flipped < totalPages - 1 && !document.hidden;
}
function positionFlipHint() {
  if (!flipScaleEl) return;
  const r = flipScaleEl.getBoundingClientRect();            // the book's on-screen rect
  // Size the hand relative to the BOOK (not the viewport) so it always suits
  // the page, and sit it ON the bottom-right page corner — the exact corner
  // the ghost peel lifts.
  const hw = Math.max(40, Math.round(r.width * 0.085));
  flipHint.style.width = hw + "px";              // img and SVG fallback both size by width
  const w = flipHint.offsetWidth || hw, h = flipHint.offsetHeight || hw;
  flipHint.style.left = Math.round(r.right - w - r.width * 0.035) + "px";
  flipHint.style.top  = Math.round(r.bottom - h - r.height * 0.07) + "px";
}
function showFlipHint() {
  if (!canShowHint()) return;
  positionFlipHint();
  flipHint.classList.add("show");
}
function hideFlipHint() {
  flipHint.classList.remove("show");
}

/* ---- GHOST PAGE-FLIP -------------------------------------------------------
   Lift the current page about halfway toward the next one, then let it fall back
   — a live demo that the page turns. Purely visual; cancelled the instant the
   reader interacts, so a real drag/flip takes over cleanly. */
function cancelPeek() {
  peekTimers.forEach(clearTimeout);
  peekTimers = [];
  if (!peeking) return;
  peeking = false;
  const leaf = leaves[flipped];
  if (leaf) {
    if (G) {
      if (leaf._peekTl) { leaf._peekTl.kill(); leaf._peekTl = null; }
      peelEnd(leaf);                         // clears the clip + fold-back layers
    }
    leaf.style.transition = ""; leaf.style.transform = ""; leaf.style.zIndex = "";
    clearFlipFX(leaf);                       // fallback FX (curls, cast shadow, flex)
  }
  updateZ();
}
function peekFlip() {
  if (peeking || !canShowHint()) return;
  const leaf = leaves[flipped];
  if (!leaf) return;
  peeking = true;
  const curl = leaf.querySelector(".curl");
  leaf.style.zIndex = 300;                               // lift above the rest while peeking
  if (G) {
    // PEEL peek: lift the bottom-right corner a little — a live "you can peel
    // me" invitation — hold for a beat, then lay it back down flat.
    ensurePeelEls(leaf);
    leaf.style.transition = "none";
    leaf.style.transform = "none";
    const proxy = { t: 0 };
    const tl = G.timeline({
      onUpdate: function () { renderPeel(leaf, peelPath(proxy.t)); },
      onComplete: function () {
        leaf._peekTl = null;
        peelEnd(leaf);
        leaf.style.zIndex = "";
        peeking = false; updateZ();
      }
    });
    leaf._peekTl = tl;
    tl.to(proxy, { t: 0.12, duration: 0.7, ease: "power2.inOut" })
      .to(proxy, { t: 0,    duration: 0.6, ease: "power2.inOut", delay: 0.15 });
    return;
  }
  leaf.style.transition = "transform 720ms cubic-bezier(0.33, 0, 0.2, 1)";
  void leaf.offsetWidth;                                 // commit so the lift animates from flat
  leaf.style.transform = "rotateY(-52deg)";              // turn toward the next page (~halfway)
  if (curl) curl.style.opacity = "0.85";                 // page-curl shading during the lift
  peekTimers.push(setTimeout(function () {               // ...then ease it back down
    leaf.style.transform = "rotateY(0deg)";
    if (curl) curl.style.opacity = "";
  }, 760));
  peekTimers.push(setTimeout(function () {               // clean up once settled
    leaf.style.transition = ""; leaf.style.transform = ""; leaf.style.zIndex = "";
    peeking = false; updateZ();
  }, 760 + 760));
}

// Play the nudge ONCE — hand swipe on the book's right + ghost page-flip + the
// right arrow blinks — hold ~2s, then hide and come back 9s later. Repeats while idle.
function triggerHint() {
  if (!canShowHint()) { idleHintTimer = setTimeout(triggerHint, NUDGE_GAP_MS); return; }
  showFlipHint();
  peekFlip();
  if (cornerNext) cornerNext.classList.add("blink");
  clearTimeout(nudgeHideTimer);
  nudgeHideTimer = setTimeout(function () {
    hideFlipHint();
    if (cornerNext) cornerNext.classList.remove("blink");
    idleHintTimer = setTimeout(triggerHint, NUDGE_GAP_MS);   // ...then again after 9s
  }, NUDGE_SHOW_MS);
}
function resetIdleHint() {
  hideFlipHint();
  cancelPeek();
  if (cornerNext) cornerNext.classList.remove("blink");
  clearTimeout(idleHintTimer);
  clearTimeout(nudgeHideTimer);
  // Re-arm ONLY if this page's dialogue has already finished — otherwise the
  // nudge stays quiet until dialogueDone() fires for the page.
  if (hintDoneFor === flipped) {
    idleHintTimer = setTimeout(triggerHint, HINT_AFTER_DONE_MS + 500);
  }
}
// Any interaction cancels the nudge + restarts the idle countdown.
["pointerdown", "keydown", "wheel", "touchstart"].forEach(function (evt) {
  document.addEventListener(evt, resetIdleHint, { passive: true, capture: true });
});

/* ---- Boot ---------------------------------------------------------------- */
fitScale();                              // scale the fixed 1280x720 book to fit first
renderLeaves();                          // lay out the leaves (all on page 1 to start)
updateProgress();
