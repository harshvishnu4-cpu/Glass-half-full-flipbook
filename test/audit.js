/* BASELINE SWEEP — the objective one. Loads the book and both games, plays each
   far enough to pull its assets in, and reports every missing file and every JS
   error. This is the check to run before and after any change.

   Usage:  node test/audit.js            (http — the hosted path)
           node test/audit.js --file     (file:// — the double-click path)

   A clean run prints 0 missing and 0 errors for all three.
*/
"use strict";
const H = require("./lib/harness");

const USE_FILE = process.argv.includes("--file");

(async () => {
  const srv = USE_FILE ? { port: null, stop() {} } : await H.ensureServer();
  const at = p => USE_FILE ? H.fileUrl(p) : H.httpUrl(p, srv.port);

  const TARGETS = [
    { name: "BOOK",  url: at("index.html"),                                    kind: "book" },
    { name: "LBD 1", url: at("LBD/Glass half full LBD 1/index.html"), play: "#playBtn" },
    { name: "LBD 2", url: at("LBD/Glass half full LBD 2/index.html"), play: "#play-btn" }
  ];

  const browser = await H.launch();
  let totalMissing = 0, totalErrors = 0;

  for (const t of TARGETS) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const w = H.watch(page);
    await page.goto(t.url);
    await page.waitForTimeout(2500);

    if (t.kind === "book") {
      await H.openBook(page);
      const types = await H.storyPages(page);
      await H.gotoPage(page, types.length - 1, { settle: 780 });
      await H.parkMouse(page);
    } else {
      await page.waitForTimeout(2200);                 // let the preloader finish
      await page.click(t.play, { force: true }).catch(e =>
        w.errors.push("could not press Play: " + e.message.split("\n")[0]));
      await page.waitForTimeout(14000);                // through the opening beats
    }

    H.heading(t.name);
    const missing = [...w.missing];
    console.log("missing / failed (" + missing.length + "):");
    missing.forEach(([u, why]) => console.log("   " + why + "  " + u));
    if (w.aborted.size)
      console.log("   (" + w.aborted.size + " aborted mid-flight — media unloaded on a page turn, benign)");

    const errs = [...new Set(w.errors)];
    console.log("JS errors (" + errs.length + "):");
    errs.slice(0, 12).forEach(e => console.log("   " + e));

    const warns = [...new Set(w.warnings)];
    if (warns.length) {
      console.log("warnings (" + warns.length + ") — usually harmless:");
      warns.slice(0, 6).forEach(x => console.log("   " + x));
    }
    totalMissing += missing.length;
    totalErrors  += errs.length;
    await page.close();
  }

  await browser.close();
  srv.stop();
  H.heading("RESULT (" + (USE_FILE ? "file://" : "http") + ")");
  console.log(totalMissing === 0 && totalErrors === 0
    ? "clean — 0 missing assets, 0 JS errors"
    : totalMissing + " missing asset(s), " + totalErrors + " JS error(s)");
  process.exit(totalMissing === 0 && totalErrors === 0 ? 0 : 1);
})();
