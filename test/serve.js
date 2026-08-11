/* Static server for the book, with RANGE REQUEST support.
   ────────────────────────────────────────────────────────────────────────────
   Why this exists rather than any one-line static server: the book must be tested
   over http as well as by double-click, because the two behave differently
   (fullscreen is refused inside a `file://` iframe, and Vercel serves over http).
   Range support is here because seeking a <video> needs it — the engine sets
   `currentTime` on page videos, and a server answering 200-with-everything makes
   that behave unlike production.

   A CORRECTION worth keeping, because it was believed for a while: Range support
   is NOT what makes `<audio>.duration` finite. An `.ogg` streamed over http
   reports `Infinity` here regardless — measured, with `preload="metadata"` AND
   `preload="auto"` — because Ogg carries no duration in a header and Chromium will
   not read to the last page to compute it. Fetch the file and read it from a
   `blob:` URL and it is exact (3.822313s for vo-ready.ogg). That is precisely what
   both games' own preloaders do, which is why they get real durations at runtime.
   Use `clipDuration()` in lib/harness.js rather than probing a bare element.

   Usage:  node test/serve.js [port]        (default 8791)
   The play/audit scripts start this themselves; run it by hand only to poke
   around in a browser: http://localhost:8791/index.html
*/
"use strict";
const http = require("http");
const fs   = require("fs");
const path = require("path");
const url  = require("url");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.argv[2] || process.env.BOOK_PORT || 8791);

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",   ".json": "application/json",
  ".mp4": "video/mp4",  ".webm": "video/webm", ".mov": "video/quicktime",
  ".mp3": "audio/mpeg", ".wav": "audio/wav",   ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",  ".oga": "audio/ogg",
  ".png": "image/png",  ".jpg": "image/jpeg",  ".jpeg": "image/jpeg",
  ".gif": "image/gif",  ".svg": "image/svg+xml", ".webp": "image/webp",
  ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
  ".ttf": "font/ttf",   ".txt": "text/plain; charset=utf-8"
};

const server = http.createServer(function (req, res) {
  let pathname;
  try { pathname = decodeURIComponent(url.parse(req.url).pathname || "/"); }
  catch (e) { res.writeHead(400); return res.end("bad path"); }
  if (pathname.endsWith("/")) pathname += "index.html";

  const file = path.join(ROOT, pathname);
  // never serve outside the project
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end("forbidden"); }

  fs.stat(file, function (err, st) {
    if (err || !st.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("404 " + pathname);
    }
    const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
    const range = req.headers.range;

    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      if (m) {
        let start = m[1] === "" ? null : parseInt(m[1], 10);
        let end   = m[2] === "" ? null : parseInt(m[2], 10);
        if (start === null && end !== null) {          // suffix form: bytes=-500
          start = Math.max(0, st.size - end); end = st.size - 1;
        } else {
          if (start === null) start = 0;
          if (end === null) end = st.size - 1;
        }
        if (start > end || start >= st.size) {
          res.writeHead(416, { "Content-Range": "bytes */" + st.size });
          return res.end();
        }
        end = Math.min(end, st.size - 1);
        res.writeHead(206, {
          "Content-Type": type,
          "Content-Range": "bytes " + start + "-" + end + "/" + st.size,
          "Accept-Ranges": "bytes",
          "Content-Length": end - start + 1,
          "Cache-Control": "no-store"
        });
        return fs.createReadStream(file, { start: start, end: end }).pipe(res);
      }
    }

    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": st.size,
      "Accept-Ranges": "bytes",          // tells the browser it MAY range-request
      "Cache-Control": "no-store"
    });
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, function () {
  console.log("serving " + ROOT + "\n  http://localhost:" + PORT + "/index.html");
});
