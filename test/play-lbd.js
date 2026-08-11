/* PLAY AN LBD GAME FOR REAL — and audit its dialogue.
   ────────────────────────────────────────────────────────────────────────────
   LBD 2 is played properly: every glass dragged to its tray, the garnishes
   tapped, on into serving. LBD 1 is opened and its opening beats watched (its
   pour/drag flow is scripted per-step by the game itself).

   The dialogue audit is the valuable part. For every voice clip that starts it
   records whether the speech bubble was ON SCREEN for the whole clip. A clip that
   outlives its bubble is the bug "the audio plays but there is no dialogue" — and
   the usual cause is a hard-coded delay guessing at the clip's length instead of
   waiting for it to finish.

   Usage:  node test/play-lbd.js 2                  play LBD 2 (default)
           node test/play-lbd.js 1                  play LBD 1
           node test/play-lbd.js 2 --throttle 6     slow the CPU 6x (timers slip)
           node test/play-lbd.js 2 --file           the double-click path
           node test/play-lbd.js 2 --wrong          mis-drop on purpose
*/
"use strict";
const H = require("./lib/harness");

const WHICH    = process.argv.includes("1") ? 1 : 2;
const USE_FILE = process.argv.includes("--file");
const WRONG    = process.argv.includes("--wrong");
const THROTTLE = (() => {
  const i = process.argv.indexOf("--throttle");
  return i > -1 ? Number(process.argv[i + 1] || 4) : 0;
})();

const REL = "LBD/Glass half full LBD " + WHICH + "/index.html";
const PLAY = WHICH === 1 ? "#playBtn" : "#play-btn";

/* Instrumented inside the game: wrap the voice player, then sample the bubble. */
function instrument() {
  window.__t0 = performance.now();
  window.__lines = [];
  window.__vis = [];
  if (window.SFX && SFX.voice) {                       // LBD 2
    const ov = SFX.voice.bind(SFX);
    SFX.voice = function (src) {
      window.__lines.push({ src: String(src).split("/").pop(),
        dur: (SFX.voiceDuration && SFX.voiceDuration(src)) || 0,
        start: performance.now() - window.__t0 });
      return ov.apply(this, arguments);
    };
  }
  const bubble = document.getElementById("agni-bubble") || document.getElementById("bubble");
  const holder = document.getElementById("agni") || bubble;
  const text   = document.getElementById("agni-text") || document.getElementById("bubbleText");
  if (!holder || !bubble) return;
  setInterval(() => {
    const r = bubble.getBoundingClientRect();
    window.__vis.push({
      t: performance.now() - window.__t0,
      shown: getComputedStyle(holder).visibility === "visible" && +getComputedStyle(bubble).opacity > 0.5,
      onScreen: r.width > 0 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight,
      text: (text && text.textContent) || ""
    });
  }, 60);
}

(async () => {
  const srv = USE_FILE ? { port: null, stop() {} } : await H.ensureServer();
  const url = USE_FILE ? H.fileUrl(REL) : H.httpUrl(REL, srv.port);

  const browser = await H.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const w = H.watch(page);
  await page.goto(url);

  // wait for the preloader rather than a fixed sleep where the game reports it
  await page.waitForFunction(
    () => { const t = document.getElementById("load-txt") || document.getElementById("loadTxt");
            return !t || /100%/.test(t.textContent || ""); },
    { timeout: 90000 }).catch(() => console.log("(the loader never reported 100% — carrying on)"));
  await page.waitForTimeout(1400);                     // the Play button animates in

  await page.evaluate(instrument);
  await page.click(PLAY, { force: true });
  await page.waitForTimeout(1000);
  if (THROTTLE) { await H.throttleCPU(page, THROTTLE); console.log("CPU throttled " + THROTTLE + "x"); }

  if (WHICH === 2) {
    const zoneOf = { empty: "zone-empty", half: "zone-half", full: "zone-full" };
    // sort every glass (or mis-drop deliberately with --wrong)
    for (let n = 0; n < 18; n++) {
      const nx = await page.evaluate(([z, wrong]) => {
        const s = window.__game;
        if (!s) return null;
        if (s.locked || s.speaking) return { wait: true };
        const g = (s.glasses || []).find(g => !g.placed && (!wrong || g.type === "half"));
        if (!g) return null;
        const zid = wrong ? "zone-empty" : z[g.type];      // Empty is wrong for a half glass
        const gr = g.el.getBoundingClientRect(), zr = document.getElementById(zid).getBoundingClientRect();
        return { type: g.type, streak: s.wrongStreak,
          from: { x: Math.round(gr.x + gr.width / 2),  y: Math.round(gr.y + gr.height / 2) },
          to:   { x: Math.round(zr.x + zr.width / 2),  y: Math.round(zr.y + zr.height / 2) } };
      }, [zoneOf, WRONG]);
      if (nx === null) break;
      if (nx.wait) { await page.waitForTimeout(800); n--; continue; }
      await H.drag(page, nx.from, nx.to);
      await page.waitForTimeout(WRONG ? 6500 : 600);
      if (WRONG && n >= 2) break;
    }
    if (!WRONG) {
      console.log("sorted — phase " + await page.evaluate(() => window.__game.phase));
      await page.waitForTimeout(12000);                // phase 2 intro + the splash
      // dress the drinks: wait until each box is really up before tapping
      for (const id of ["#lemonbox", "#strawbox"]) {
        for (let a = 0; a < 8; a++) {
          const ready = await page.evaluate(s => {
            const e = document.querySelector(s); if (!e) return false;
            const r = e.getBoundingClientRect();
            return r.width > 4 && getComputedStyle(e).visibility === "visible" &&
                   document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === e;
          }, id);
          if (ready) break;
          await page.waitForTimeout(900);
        }
        await page.click(id, { force: true }).catch(() => console.log("  could not tap " + id));
        await page.waitForTimeout(1500);
      }
      await page.waitForTimeout(14000);               // the cheer + the walk-in
    }
  } else {
    await page.waitForTimeout(24000);                 // LBD 1 narrates its own opening
  }

  await page.screenshot({ path: H.shotPath("lbd" + WHICH + (WRONG ? "-wrong" : "") + "-played") });

  /* ── the dialogue audit ── */
  const lines = await page.evaluate(() => (window.__lines || []).map(l => {
    const end = l.start + l.dur * 1000;
    const win = (window.__vis || []).filter(v => v.t >= l.start && v.t <= end);
    const gone = win.find(v => !v.shown);
    const off  = win.find(v => !v.onScreen);
    return { src: l.src, dur: +l.dur.toFixed(2), start: Math.round(l.start), end: Math.round(end),
      goneAt: gone ? Math.round(gone.t) : null, offAt: off ? Math.round(off.t) : null,
      text: (win.length ? win[win.length - 1].text : "").slice(0, 38) };
  }));

  H.heading("LBD " + WHICH + " — dialogue");
  if (!lines.length) {
    console.log("no voice clips were captured (LBD 1 drives its own queue; play further, or check SFX.voice)");
  } else {
    console.log("  clip                     spoken   gap after prev   bubble left while speaking?");
    let prevEnd = null, bad = 0;
    lines.forEach(l => {
      const gap = prevEnd === null ? "-" : (l.start - prevEnd) + "ms";
      if (l.goneAt !== null) bad++;
      console.log("  " + l.src.padEnd(24) + String(l.dur).padStart(5) + "s   " + String(gap).padStart(12) +
        "   " + (l.goneAt === null ? "no" : "YES — " + (l.end - l.goneAt) + "ms of AUDIO WITH NO DIALOGUE") +
        (l.offAt !== null ? "  (also off-screen)" : ""));
      prevEnd = l.end;
    });
    const overlap = lines.some((l, i) => i > 0 && l.start < lines[i - 1].end);
    console.log("\n  a line starting while the previous was still speaking? " + (overlap ? "YES — they overlap" : "no"));
    console.log("  clips whose bubble left early: " + (bad || "none"));
  }

  const errs = [...new Set(w.errors)];
  console.log("\nJS errors: " + (errs.length || "none"));
  errs.slice(0, 8).forEach(e => console.log("   " + e));
  const missing = [...w.missing];
  console.log("missing assets: " + (missing.length || "none"));
  missing.forEach(([u, why]) => console.log("   " + why + "  " + u));
  console.log("\nscreenshot: " + H.shotDir);

  await browser.close();
  srv.stop();
})();
