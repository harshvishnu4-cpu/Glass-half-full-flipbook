/* ===========================================================================
   DEV PAGE MENU  —  TESTING ONLY.  Not part of the book.
   ---------------------------------------------------------------------------
   A hamburger in the top-left corner that lists every page and jumps straight
   to any of them, so you don't have to sit through the book to reach page 9.

     • the page you are on is highlighted
     • picking a page closes the menu
     • clicking anywhere outside it closes it (so does Esc)

   TO DELETE THE WHOLE TOOL when testing is over:
     1. delete the  dev/  folder
     2. delete the single <script src="dev/dev-menu.js"> line in index.html
   That's it. This file touches NOTHING in engine/ and adds nothing to
   story.js, so removing it cannot affect the book.

   HOW IT DRIVES THE BOOK (no engine edits)
   ---------------------------------------------------------------------------
   engine/script.js is a classic script, so its `function` declarations are
   global while its `let`/`const` state is not. That gives us exactly what we
   need and nothing we shouldn't touch:
     openBook() / goNext() / goPrev() / dialogueDone(i) / closeBookToCover()
   The current page is NOT readable as a variable, so we count the leaves that
   carry the .flipped class — the engine applies that synchronously as the turn
   starts, so it is accurate the instant a hop begins.
   A jump is just repeated goNext()/goPrev(). Forward turns are gated on the
   page's clip finishing, so before each forward hop we call the engine's own
   dialogueDone() to release that gate — the same call the scene player makes
   when a clip really does end. GSAP's global timeScale is raised for the
   duration so a ten-page hop takes ~1.5s instead of ~11s.
   =========================================================================== */

(function () {
  "use strict";

  // ---- refuse to run if the page isn't the book (or STORY hasn't loaded) ----
  if (!window.STORY || !Array.isArray(window.STORY.pages)) {
    console.warn("[dev-menu] window.STORY not found — dev menu not started.");
    return;
  }
  if (document.querySelector(".devm-btn")) return;         // never double-install

  var SPEED   = 8;      // GSAP time multiplier while hopping between pages
  var STEP_MS = 60;     // how often to attempt the next hop
  var GUARD   = 200;    // hard cap on hop attempts, so a wedge can't spin forever

  /* ---- load our stylesheet (kept in its own file, next to this one) ------- */
  (function () {
    var href = "dev/dev-menu.css";
    var me = document.currentScript;                        // resolve relative to THIS file
    if (me && me.src) href = me.src.replace(/[^/]*$/, "dev-menu.css");
    var l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    document.head.appendChild(l);
  })();

  /* ---- reading the book's state from the DOM ------------------------------ */
  var pages = window.STORY.pages;
  var TOTAL = pages.length;                                 // includes the "end" page

  function currentIdx() {
    return document.querySelectorAll("#flipbook .leaf.flipped").length;
  }
  function isOpen() {
    return document.body.classList.contains("is-open");
  }
  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  /* ---- labels, straight from story.js ------------------------------------- */
  function describe(page, i) {
    if (page.type === "end") return { label: "The End", note: "" };
    if (page.scenes) {
      var withPour = page.scenes.some(function (s) { return s.pour; });
      var withTap  = page.scenes.some(function (s) { return s.tap;  });
      return {
        label: "Page " + (i + 1),
        note: page.scenes.length + " scenes" +
              (withPour ? " + pour" : withTap ? " + tap" : ""),
      };
    }
    var label = "Page " + (i + 1);
    // A GAME page's src is always ".../index.html", which says nothing about WHICH
    // game it is — and knowing that is the main reason to jump to one. story.js
    // gives each a title, so use that, trimmed of its " — game" suffix.
    if (page.type === "game") {
      var t = (page.title || "game").replace(/\s*—\s*game\s*$/i, "");
      return { label: label, note: "🎮 " + t };
    }
    var src = page.src || (page.scenes && page.scenes[0] && page.scenes[0].src) || "";
    var file = src.split("/").pop().replace(/\.(mp4|webm|png|jpe?g|webp)$/i, "");
    // only show the filename when it tells you something the label doesn't
    return { label: label, note: file.toLowerCase() === label.toLowerCase() ? "" : file };
  }

  /* ---- build the UI ------------------------------------------------------- */
  var btn = document.createElement("button");
  btn.className = "devm-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "Dev: jump to a page");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", "devmPanel");
  btn.innerHTML = '<span class="devm-bars" aria-hidden="true"><i></i><i></i><i></i></span>';

  var panel = document.createElement("div");
  panel.className = "devm-panel";
  panel.id = "devmPanel";
  panel.setAttribute("role", "menu");
  panel.setAttribute("aria-label", "Jump to page");

  var head = document.createElement("div");
  head.className = "devm-head";
  head.innerHTML = "<span>Dev · pages</span><span>" + TOTAL + "</span>";

  var list = document.createElement("ul");
  list.className = "devm-list";

  var foot = document.createElement("div");
  foot.className = "devm-foot";
  foot.textContent = "Testing tool — delete dev/ and its <script> line to remove.";

  var items = [];

  // "Cover" first: shuts the book, exactly like Replay does.
  items.push(addItem(-1, "Cover", "closed book"));
  for (var i = 0; i < TOTAL; i++) {
    var d = describe(pages[i], i);
    items.push(addItem(i, d.label, d.note));
  }

  function addItem(idx, label, note) {
    var li = document.createElement("li");
    var b = document.createElement("button");
    b.className = "devm-item";
    b.type = "button";
    b.setAttribute("role", "menuitem");
    b.dataset.idx = String(idx);
    b.innerHTML =
      '<span class="devm-num">' + (idx < 0 ? "▲" : idx + 1) + "</span>" +
      '<span class="devm-label"></span>' +
      '<span class="devm-note"></span>';
    b.querySelector(".devm-label").textContent = label;
    b.querySelector(".devm-note").textContent = note;
    b.addEventListener("click", function () { pick(idx); });
    li.appendChild(b);
    list.appendChild(li);
    return b;
  }

  panel.appendChild(head);
  panel.appendChild(list);
  panel.appendChild(foot);
  document.body.appendChild(btn);
  document.body.appendChild(panel);

  /* ---- active-page highlight ---------------------------------------------- */
  var markTimer = null;
  function mark() {
    var here = isOpen() ? currentIdx() : -1;
    items.forEach(function (b) {
      var mine = Number(b.dataset.idx) === here;
      if (mine) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    });
  }

  /* ---- open / close -------------------------------------------------------- */
  var open = false;
  function setOpen(v) {
    open = v;
    panel.classList.toggle("open", v);
    btn.setAttribute("aria-expanded", v ? "true" : "false");
    clearInterval(markTimer);
    if (v) {
      mark();
      // keep the highlight honest if the book is navigated by other means
      markTimer = setInterval(mark, 300);
      var cur = list.querySelector('[aria-current="true"]');
      if (cur) cur.scrollIntoView({ block: "nearest" });
    }
  }

  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    setOpen(!open);
  });

  // click ANYWHERE outside the panel or the button → close.
  // pointerdown (not click) so it also closes on a drag that starts outside,
  // and capture so the book's own handlers can't swallow it first.
  document.addEventListener("pointerdown", function (e) {
    if (!open) return;
    if (panel.contains(e.target) || btn.contains(e.target)) return;
    setOpen(false);
  }, true);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && open) { setOpen(false); btn.focus(); }
  });

  /* ---- the jump ------------------------------------------------------------ */
  var busy = false;

  function pick(idx) {
    setOpen(false);                       // selecting a page closes the menu
    jump(idx);
  }

  async function jump(target) {
    if (busy) return;
    busy = true;
    panel.classList.add("busy");
    var muted = [];
    var g = window.gsap;
    try {
      if (target < 0) {                   // back to the closed cover
        if (isOpen() && typeof window.closeBookToCover === "function") {
          window.closeBookToCover();
        }
        return;
      }
      if (!isOpen()) {
        window.openBook();
        // wait for the cover swing to finish — the first hop simply won't take
        // until the engine is `ready`, so poll rather than hard-code a delay
        for (var w = 0; w < 60 && !isOpen(); w++) await sleep(100);
        await sleep(1200);
      }
      // silence the pages we fly past, restoring each one's own setting after
      muted = [].slice.call(document.querySelectorAll("video")).map(function (v) {
        var was = v.muted; v.muted = true; return [v, was];
      });
      if (g) g.globalTimeline.timeScale(SPEED);

      var guard = 0;
      while (currentIdx() !== target && guard++ < GUARD) {
        var at = currentIdx();
        if (at < target) {
          if (typeof window.dialogueDone === "function") window.dialogueDone(at);
          window.goNext();
        } else {
          window.goPrev();
        }
        await sleep(STEP_MS);
      }
      if (guard >= GUARD) console.warn("[dev-menu] gave up hopping to page", target + 1);
    } catch (err) {
      console.error("[dev-menu] jump failed:", err);
    } finally {
      if (g) g.globalTimeline.timeScale(1);
      muted.forEach(function (p) { p[0].muted = p[1]; });
      // let the engine settle on the landing page, then unlock + re-sync
      await sleep(420);
      busy = false;
      panel.classList.remove("busy");
      mark();
    }
  }

  mark();
  console.info("[dev-menu] ready — " + TOTAL + " pages. Delete dev/ + its script tag to remove.");
})();
