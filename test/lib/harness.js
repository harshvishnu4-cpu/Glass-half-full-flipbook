/* Shared play-testing helpers for the book and both LBD games.
   Everything here drives a REAL browser — the point is to play the thing, not to
   reason about the source. Each helper exists because getting it wrong once cost
   a wrong diagnosis; the comments say which.
*/
"use strict";
const fs    = require("fs");
const path  = require("path");
const http  = require("http");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const PORT = Number(process.env.BOOK_PORT || 8791);

/* ── playwright-core ──────────────────────────────────────────────────────────
   Not a runtime dependency of the book (which has no build step and must work by
   double-click), so it is installed only for these tests. Resolved from a few
   places so either install style works. */
function playwright() {
  const tries = [
    "playwright-core",
    path.join(__dirname, "..", "node_modules", "playwright-core"),
    path.join(ROOT, "node_modules", "playwright-core")
  ];
  for (const t of tries) { try { return require(t); } catch (e) {} }
  console.error(
    "\nplaywright-core is not installed. From the project root run ONE of:\n" +
    "    cd test && npm install playwright-core     (kept out of git)\n" +
    "    npm install -g playwright-core\n" +
    "No browser download is needed — these tests drive the Edge already on this machine.\n");
  process.exit(1);
}

/* The browser: whatever is actually on this machine. No download. */
const BROWSERS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"
];
function browserPath() {
  for (const b of BROWSERS) if (fs.existsSync(b)) return b;
  return null;   // let playwright fall back to its own channel resolution
}

/* headless: false deliberately — fullscreen and media autoplay behave
   differently headless, and both matter here. */
async function launch(opts) {
  opts = opts || {};
  const { chromium } = playwright();
  const exe = browserPath();
  return chromium.launch({
    executablePath: exe || undefined,
    channel: exe ? undefined : "msedge",
    headless: false,
    args: [
      "--allow-file-access-from-files",          // for the file:// half of testing
      "--autoplay-policy=no-user-gesture-required",
      ...(opts.args || [])
    ]
  });
}

/* ── the local server ─────────────────────────────────────────────────────────
   Started as a detached child so it survives the caller, and stopped on exit.
   (Backgrounding a shell compound with "&" does NOT survive — that wasted time
   more than once.) */
function serverUp(port) {
  return new Promise(res => {
    const req = http.get({ host: "localhost", port: port, path: "/index.html" },
      r => { r.resume(); res(true); });
    req.on("error", () => res(false));
    req.setTimeout(700, () => { req.destroy(); res(false); });
  });
}

async function ensureServer(port) {
  port = port || PORT;
  if (await serverUp(port)) return { port, started: false, stop() {} };
  const child = spawn(process.execPath, [path.join(__dirname, "..", "serve.js"), String(port)],
    { cwd: ROOT, stdio: "ignore", detached: false });
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 150));
    if (await serverUp(port)) break;
  }
  if (!(await serverUp(port))) { child.kill(); throw new Error("could not start test/serve.js on " + port); }
  const stop = () => { try { child.kill(); } catch (e) {} };
  process.on("exit", stop);
  return { port, started: true, stop };
}

const httpUrl  = (p, port) => "http://localhost:" + (port || PORT) + "/" + String(p || "index.html").replace(/^\//, "");
const fileUrl  = p => "file:///" + path.join(ROOT, p || "index.html").replace(/\\/g, "/");

/* ── error / request collection ───────────────────────────────────────────────
   `aborted` is kept separate on purpose: the engine unloads a video when a page
   is turned, which cancels its in-flight range request. Those show up as failed
   requests but every file is present — reporting them as missing is a false alarm. */
function watch(page) {
  const out = { errors: [], warnings: [], missing: new Map(), aborted: new Set() };
  page.on("pageerror", e => out.errors.push(String(e.message).split("\n")[0].slice(0, 160)));
  page.on("console", m => {
    const s = m.text().slice(0, 160);
    if (m.type() === "error" && !/Failed to load resource/.test(s)) out.errors.push(s);
    if (m.type() === "warning") out.warnings.push(s);
  });
  page.on("requestfailed", r => {
    const why = (r.failure() || {}).errorText || "?";
    const u = short(r.url());
    if (/ERR_ABORTED/.test(why)) out.aborted.add(u);
    else out.missing.set(u, why.replace("net::", ""));
  });
  page.on("response", r => { if (r.status() >= 400) out.missing.set(short(r.url()), "HTTP " + r.status()); });
  return out;
}
function short(u) {
  try { u = decodeURIComponent(u); } catch (e) {}
  return u.replace(/^https?:\/\/[^/]+\//, "").replace(/^file:\/\/\/.*?Flipbook v1\//i, "");
}

/* ── the book ─────────────────────────────────────────────────────────────────
   `flipped` is a `let`, so it is NOT on window; read the page from the DOM. But
   goNext and dialogueDone ARE top-level function declarations, so they are. */
const PAGE_EXPR = '() => document.querySelectorAll("#flipbook .leaf.flipped").length';

async function pageIndex(page) { return page.evaluate(eval(PAGE_EXPR)); }

async function openBook(page) {
  await page.waitForTimeout(1400);
  await page.click("#hint", { force: true }).catch(() => {});   // #hint needs force
  await page.waitForTimeout(700);
}

/* Turn to page `n`. goNext() refuses unless the current page's cue has completed
   (hintDoneFor === flipped), so each turn satisfies the gate first. */
async function gotoPage(page, n, opts) {
  const settle = (opts && opts.settle) || 900;
  for (let s = 0; s < 60; s++) {
    const at = await pageIndex(page);
    if (at >= n) return at;
    await page.evaluate(i => { try { window.dialogueDone(i); } catch (e) {} }, at);
    await page.waitForTimeout(130);
    await page.evaluate(() => { try { window.goNext(); } catch (e) {} });
    await page.waitForTimeout(settle);
  }
  return pageIndex(page);
}

/* A page's kind for reporting. Not every page carries `type`: the multi-scene ones
   (the machine and the pour) are identified by a `scenes` array instead. */
const storyPages = page => page.evaluate(() =>
  STORY.pages.map(p => p.type || (p.scenes ? "scenes(" + p.scenes.length + ")" : "?")));
const gamePages  = page => page.evaluate(() => {
  const g = []; STORY.pages.forEach((p, i) => { if (p.type === "game") g.push(i); }); return g;
});

/* A page peel COMPLETES at only 15% (prog > 0.15), and a finished game's frame is
   pointer-transparent — so a mouse left resting over the book turns pages by
   itself and looks exactly like a product bug. Park it before sampling. */
const parkMouse = page => page.mouse.move(4, 4);

async function drag(page, from, to, steps) {
  steps = steps || 12;
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + (to.x - from.x) * i / steps,
                          from.y + (to.y - from.y) * i / steps);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

/* ── real composited frames ───────────────────────────────────────────────────
   page.screenshot() AWAITS a paint, so it can never catch a mid-transition frame.
   For anything animated, screencast instead. */
async function startScreencast(page, opts) {
  opts = opts || {};
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  let t0 = null;
  cdp.on("Page.screencastFrame", async ev => {
    if (t0 === null) t0 = ev.metadata.timestamp;
    frames.push({ t: Math.round((ev.metadata.timestamp - t0) * 1000), data: ev.data });
    try { await cdp.send("Page.screencastFrameAck", { sessionId: ev.sessionId }); } catch (e) {}
  });
  await cdp.send("Page.startScreencast", {
    format: "png", everyNthFrame: 1,
    maxWidth: opts.maxWidth || 640, maxHeight: opts.maxHeight || 400
  });
  return {
    frames,
    async stop() { try { await cdp.send("Page.stopScreencast"); } catch (e) {} return frames; },
    cdp
  };
}

/* ── measuring a clip ─────────────────────────────────────────────────────────
   MUST fetch and go through a blob: URL. A bare <audio src=…> pointing at an .ogg
   over http reports `duration: Infinity` — with preload="metadata" and with
   preload="auto" alike — because Ogg stores no duration in a header and Chromium
   will not read to the last page for it. Range support does not change this (it
   was assumed to, and did not). Via a blob the value is exact, which is also why
   the games get real durations: their preloaders hand every clip a blob: URL.
   `page` must already be on a document in the same origin as `url`. */
async function clipDuration(page, url) {
  return page.evaluate(async u => {
    try {
      const r = await fetch(u);
      if (!r.ok) return { error: "HTTP " + r.status };
      const b = URL.createObjectURL(await r.blob());
      return await new Promise(res => {
        const a = new Audio();
        a.preload = "metadata"; a.src = b;
        a.onloadedmetadata = () => res({ duration: a.duration });
        a.onerror = () => res({ error: "cannot decode (codec unsupported here?)" });
        setTimeout(() => res({ error: "timeout" }), 10000);
      });
    } catch (e) { return { error: String(e.message || e) }; }
  }, url);
}

/* Slow the main thread down: tight timing margins only fail when timers slip. */
async function throttleCPU(page, rate) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: rate });
  return cdp;
}

const shotDir = path.join(__dirname, "..", "shots");
function shotPath(name) {
  if (!fs.existsSync(shotDir)) fs.mkdirSync(shotDir, { recursive: true });
  return path.join(shotDir, name.replace(/[^\w.-]+/g, "-") + ".png");
}

function heading(s) { console.log("\n" + s + "\n" + "─".repeat(s.length)); }

module.exports = {
  ROOT, PORT, launch, ensureServer, httpUrl, fileUrl, watch, short,
  pageIndex, openBook, gotoPage, storyPages, gamePages, parkMouse, drag,
  startScreencast, throttleCPU, clipDuration, shotPath, shotDir, heading, browserPath
};
