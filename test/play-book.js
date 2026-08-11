/* READ THE BOOK THROUGH — every page, with a screenshot of each so the run can be
   eyeballed afterwards. Also checks the two things that are easy to break and
   invisible in a console: that every page is actually reachable, and that the
   closing iris really does close on the glass.

   Usage:  node test/play-book.js            (http)
           node test/play-book.js --file     (file:// — the double-click path)

   Screenshots land in test/shots/. LOOK AT THEM — that is the point.
*/
"use strict";
const H = require("./lib/harness");
const USE_FILE = process.argv.includes("--file");

(async () => {
  const srv = USE_FILE ? { port: null, stop() {} } : await H.ensureServer();
  const url = USE_FILE ? H.fileUrl("index.html") : H.httpUrl("index.html", srv.port);

  const browser = await H.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const w = H.watch(page);
  await page.goto(url);

  await page.screenshot({ path: H.shotPath("00-cover") });
  await H.openBook(page);
  const types = await H.storyPages(page);
  const games = await H.gamePages(page);
  console.log("pages: " + types.length + "  (" + types.join(", ") + ")");
  console.log("game pages: " + games.join(", "));

  /* The closing iris lives on the last video page. It MUST be watched while that
     page is still open — checking it after turning on finds an unloaded video and
     reports a false failure, which this script did at first. */
  const irisPage = types.length - 2;

  const stuck = [];
  for (let n = 1; n < types.length; n++) {
    const before = await H.pageIndex(page);
    const after = await H.gotoPage(page, n, { settle: 950 });
    await H.parkMouse(page);
    if (after < n) { stuck.push(n); console.log("  page " + n + ": COULD NOT REACH (stopped at " + after + ")"); break; }
    // a game page needs its Play pressed or there is nothing to see
    if (games.includes(n)) {
      console.log("  page " + n + ": game — pressing Play");
      const title = await page.evaluate(i => {
        const f = document.querySelectorAll("#flipbook .leaf")[i].querySelector("iframe.page-game");
        return f ? f.getAttribute("title") : null;
      }, n);
      if (title) {
        const btn = /Pour the juice/.test(title) ? "#playBtn" : "#play-btn";
        await page.frameLocator('iframe[title="' + title + '"]').locator(btn)
          .click({ force: true }).catch(() => console.log("     (Play not pressable yet)"));
        await page.waitForTimeout(6000);
      }
    } else {
      await page.waitForTimeout(1200);
    }
    await page.screenshot({ path: H.shotPath(String(n).padStart(2, "0") + "-page-" + types[n]) });
    console.log("  page " + n + " (" + types[n] + ") ok");

    if (n === irisPage) await watchIris(page, n);
  }

  /* The closing iris: dormant for most of the clip, then it closes on the glass and
     holds it spotlit through the last frame.
     `.page-iris` itself is STATIC by design — `--isize` is always 40% and its
     opacity always 1. The animation is entirely on the inner <i>
     (scale(3.4)/opacity 0 → scale(1)/opacity 1), switched by the `.closing` class.
     Sampling the wrapper makes a perfectly good iris look frozen. */
  async function watchIris(page, n) {
    H.heading("closing iris (page " + n + ")");
    for (let i = 0; i < 44; i++) {
      const s = await page.evaluate(i => {
        const leaf = document.querySelectorAll("#flipbook .leaf")[i];
        const v = leaf && leaf.querySelector("video");
        const ir = leaf && leaf.querySelector(".page-iris");
        const inner = ir && ir.querySelector("i");
        if (!ir) return { none: true };
        return {
          t: v ? +v.currentTime.toFixed(2) : null, dur: v ? +v.duration.toFixed(2) : null,
          closing: ir.classList.contains("closing"),
          op: inner ? +getComputedStyle(inner).opacity : null,
          scale: inner ? Number((getComputedStyle(inner).transform.match(/matrix\(([\d.]+)/) || [])[1]) : null
        };
      }, n);
      if (s.none) { console.log("  no .page-iris on this page — nothing to check"); return; }
      if (s.closing && s.op > 0.9 && s.scale <= 1.02) {
        console.log("  closed on the glass at t=" + s.t + "s of " + s.dur + "s  — ok");
        await page.screenshot({ path: H.shotPath("99-iris-closed") });
        return;
      }
      if (s.dur && s.t !== null && s.t >= s.dur - 0.05) break;
      await page.waitForTimeout(400);
    }
    console.log("  WARNING: the iris never finished closing — check `iris.at` in story.js");
  }

  H.heading("RESULT");
  console.log("reached page " + (await H.pageIndex(page)) + " of " + (types.length - 1) +
              (stuck.length ? "  — BLOCKED at " + stuck.join(",") : "  — every page reachable"));
  const errs = [...new Set(w.errors)];
  console.log("JS errors: " + (errs.length || "none"));
  errs.slice(0, 8).forEach(e => console.log("   " + e));
  const missing = [...w.missing];
  console.log("missing assets: " + (missing.length || "none"));
  missing.forEach(([u, why]) => console.log("   " + why + "  " + u));
  console.log("\nscreenshots: " + H.shotDir);

  await browser.close();
  srv.stop();
})();
