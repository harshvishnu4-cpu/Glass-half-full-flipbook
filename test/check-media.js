/* SAFARI / iOS MEDIA FALLBACK CHECK — no browser needed, runs in a second.
   ────────────────────────────────────────────────────────────────────────────
   Safari before 17 cannot play Ogg Vorbis, and its WebM support is patchy. A book
   read on an iPad is the likely case, and the failure is silent: the game just has
   no voice and a blank video, with nothing in the console to find later.

   LBD 1 already solved this for itself — every clip has an AAC (.m4a) / H.264
   (.mp4) sibling and it picks the format once from `canPlayType` (see MEDIA /
   mediaSrc in its index.html). This script checks whether that is true everywhere.

   Usage:  node test/check-media.js
   Exit code 1 if anything lacks a fallback, so it can gate a release.
*/
"use strict";
const fs   = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
/* .ogg needs an .m4a (or .mp3) twin; .webm needs an .mp4 twin */
const NEEDS = { ".ogg": [".m4a", ".mp3"], ".oga": [".m4a", ".mp3"], ".webm": [".mp4"] };
const SKIP  = /(^|[\\/])(node_modules|\.git|test[\\/]shots)([\\/]|$)/;

function walk(dir, out) {
  out = out || [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (SKIP.test(path.relative(ROOT, p))) continue;
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(ROOT);
const groups = new Map();          // area -> {ok:[], missing:[]}
let missingTotal = 0;

for (const f of files) {
  const ext = path.extname(f).toLowerCase();
  const alts = NEEDS[ext];
  if (!alts) continue;
  const stem = f.slice(0, -ext.length);
  const has = alts.some(a => fs.existsSync(stem + a));
  const rel = path.relative(ROOT, f).replace(/\\/g, "/");
  const area = rel.split("/").slice(0, 2).join("/");
  if (!groups.has(area)) groups.set(area, { ok: [], missing: [] });
  if (has) groups.get(area).ok.push(rel);
  else { groups.get(area).missing.push({ rel: rel, want: alts[0] }); missingTotal++; }
}

console.log("Safari/iOS media fallback check\n");
for (const [area, g] of [...groups].sort()) {
  const total = g.ok.length + g.missing.length;
  console.log(area + "  —  " + g.ok.length + "/" + total + " have a fallback" +
              (g.missing.length ? "   <-- " + g.missing.length + " MISSING" : "   ok"));
  g.missing.slice(0, 20).forEach(m => console.log("      needs " + m.want + " for  " + m.rel));
  if (g.missing.length > 20) console.log("      …and " + (g.missing.length - 20) + " more");
}

if (!missingTotal) {
  console.log("\nEvery Ogg/WebM asset has an AAC/H.264 sibling. Safari is covered.");
} else {
  console.log("\n" + missingTotal + " file(s) would be SILENT OR BLANK on Safari before 17 (incl. older iPads).");
  console.log("Transcoding, once ffmpeg is available:");
  console.log("   ffmpeg -i \"in.ogg\"  -c:a aac -b:a 128k  \"in.m4a\"");
  console.log("   ffmpeg -i \"in.webm\" -c:v libx264 -crf 23 -c:a aac  \"in.mp4\"");
  console.log("Then make the game CHOOSE the format instead of hard-coding .ogg —");
  console.log("copy the MEDIA / mediaSrc pair from LBD 1's index.html, which already does this.");
}
process.exit(missingTotal ? 1 : 0);
