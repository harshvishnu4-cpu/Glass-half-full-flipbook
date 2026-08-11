/* debug.js — per-screen layout overlay for "The Glass Half Full".
   Loads only when the page URL contains ?debug=1 (see the loader at the bottom
   of index.html). Purely additive: drop the ?debug=1 flag and the game is
   untouched. Lets you drag/resize the positioned props, jump between screens,
   and export a layout JSON of the final coordinates. Vanilla JS, no deps. */
(function () {
  'use strict';

  // positioned game props we instrument. Full-bleed backgrounds (#bgFull,
  // #counterFront) are deliberately excluded and also caught by FULL_FRAME.
  var ASSET_IDS = [
    'machine', 'glass', 'pourBtn', 'strawBox', 'lemonBox', 'tray',
    'checkBtn', 'dragon', 'dragonBubble', 'thought', 'client', 'playBtn'
  ];
  // props centred via transform: translateX(-50%) — their CSS `left` is the centre
  var CENTER_ANCHORED = { client: true, dragonBubble: true };
  // props whose height follows the image aspect / aspect-ratio — set width only, never height
  var WIDTH_ONLY = { strawBox: true, lemonBox: true, tray: true, thought: true, playBtn: true, pourBtn: true };
  // props laid out in normal/flex flow (not position:absolute). They're pinned to
  // absolute while debugging — with their idle animation frozen — so the overlay
  // box lines up and dragging actually moves them. The title's Play button is one.
  var FLOW_POSITIONED = { playBtn: true };
  var FULL_FRAME = 0.97;   // skip anything covering ≥97% of the frame (defensive bg guard)

  var gc = document.getElementById('gc');
  if (!gc) { console.warn('[debug] #gc not found — overlay disabled'); return; }

  var diff = {};            // id -> { x, y, w, h } in % of the frame (current state)
  var handles = {};         // id -> { box, el, label }
  var originalCss = {};     // id -> original inline style (for Reset)
  var currentScreen = 'title';

  injectStyles();
  var layer = el('div', 'dbgLayer'); gc.appendChild(layer);
  var panel = buildPanel(); document.body.appendChild(panel);

  // re-scan when the window resizes (the frame is responsive)
  window.addEventListener('resize', function () { scan(); });

  scan();

  // ── helpers ──────────────────────────────────────────────────
  function el(tag, cls) { var n = document.createElement(tag); if (cls) n.className = cls; return n; }
  function pct(px, total) { return +(px / total * 100).toFixed(2); }
  function frameRect() { return gc.getBoundingClientRect(); }

  // ── scan the current screen and build handles ────────────────
  function scan() {
    layer.innerHTML = '';
    handles = {};
    // keep the dragon's speech bubble revealed while debugging so it can always
    // be aligned, even on screens where it is normally hidden (display:none)
    var bubble = document.getElementById('dragonBubble');
    if (bubble) bubble.classList.add('show');
    // flow-positioned props (e.g. the Play button) animate via a translate/scale
    // that would offset their measured box — freeze that animation before measuring.
    Object.keys(FLOW_POSITIONED).forEach(function (id) {
      var n = document.getElementById(id);
      if (!n) return;
      if (!(id in originalCss)) originalCss[id] = n.getAttribute('style') || '';
      n.style.animation = 'none';
    });
    var fr = frameRect();
    ASSET_IDS.forEach(function (id) {
      var node = document.getElementById(id);
      if (!node) return;
      var r = node.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;                                  // not visible
      if (r.width >= fr.width * FULL_FRAME && r.height >= fr.height * FULL_FRAME) return;  // full-bleed guard
      if (!(id in originalCss)) originalCss[id] = node.getAttribute('style') || '';
      makeHandle(id, node, r, fr);
    });
    renderPanel();
  }

  function makeHandle(id, node, r, fr) {
    var box = el('div', 'dbgBox');
    var rx = r.left - fr.left, ry = r.top - fr.top;
    // pin flow-positioned props to absolute (at their current spot) so the
    // left/top that drag/resize write actually move them.
    if (FLOW_POSITIONED[id]) {
      node.style.position = 'absolute';
      node.style.left = pct(rx, fr.width) + '%';
      node.style.top = pct(ry, fr.height) + '%';
    }
    placeBox(box, rx, ry, r.width, r.height, fr);

    var label = el('div', 'dbgLabel');
    box.appendChild(label);

    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(function (dir) {
      var h = el('div', 'dbgRes dbgRes-' + dir);
      h.dataset.dir = dir;
      box.appendChild(h);
    });

    layer.appendChild(box);
    handles[id] = { box: box, el: node, label: label };
    diff[id] = { x: pct(rx, fr.width), y: pct(ry, fr.height), w: pct(r.width, fr.width), h: pct(r.height, fr.height) };
    updateLabel(id);
    wire(id);
  }

  function placeBox(box, rx, ry, rw, rh, fr) {
    box.style.left = pct(rx, fr.width) + '%';
    box.style.top = pct(ry, fr.height) + '%';
    box.style.width = pct(rw, fr.width) + '%';
    box.style.height = pct(rh, fr.height) + '%';
  }

  function updateLabel(id) {
    var d = diff[id];
    handles[id].label.textContent = id + ' | ' + d.x + ', ' + d.y + ' | ' + d.w + ' × ' + d.h;
  }

  // apply a frame-relative rect (px) to both the element and its overlay box
  function applyRect(id, rx, ry, rw, rh) {
    var fr = frameRect();
    var info = handles[id], node = info.el;
    node.style.right = 'auto';
    node.style.bottom = 'auto';
    if (CENTER_ANCHORED[id]) {
      node.style.transform = 'translateX(-50%)';
      node.style.left = pct(rx + rw / 2, fr.width) + '%';
    } else {
      node.style.left = pct(rx, fr.width) + '%';
    }
    node.style.top = pct(ry, fr.height) + '%';
    node.style.width = pct(rw, fr.width) + '%';
    if (!WIDTH_ONLY[id]) node.style.height = pct(rh, fr.height) + '%';

    // width-only props re-flow their height from the image — re-measure
    var r2 = node.getBoundingClientRect();
    var fx = r2.left - fr.left, fy = r2.top - fr.top;
    placeBox(info.box, fx, fy, r2.width, r2.height, fr);
    diff[id] = { x: pct(fx, fr.width), y: pct(fy, fr.height), w: pct(r2.width, fr.width), h: pct(r2.height, fr.height) };
    updateLabel(id);
    syncRow(id);
  }

  // ── drag + 8-point resize wiring ─────────────────────────────
  function wire(id) {
    var box = handles[id].box;

    box.addEventListener('pointerdown', function (e) {
      if (e.target.classList.contains('dbgRes')) return;   // resize handled separately
      e.preventDefault();
      var fr = frameRect(), start = diff[id];
      var sx = e.clientX, sy = e.clientY;
      var ox = start.x / 100 * fr.width, oy = start.y / 100 * fr.height;
      var ow = start.w / 100 * fr.width, oh = start.h / 100 * fr.height;
      box.setPointerCapture(e.pointerId);
      function move(ev) { applyRect(id, ox + (ev.clientX - sx), oy + (ev.clientY - sy), ow, oh); }
      function up() { box.removeEventListener('pointermove', move); box.removeEventListener('pointerup', up); }
      box.addEventListener('pointermove', move);
      box.addEventListener('pointerup', up);
    });

    box.querySelectorAll('.dbgRes').forEach(function (h) {
      h.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var dir = h.dataset.dir, fr = frameRect(), start = diff[id];
        var sx = e.clientX, sy = e.clientY;
        var ox = start.x / 100 * fr.width, oy = start.y / 100 * fr.height;
        var ow = start.w / 100 * fr.width, oh = start.h / 100 * fr.height;
        h.setPointerCapture(e.pointerId);
        function move(ev) {
          var dx = ev.clientX - sx, dy = ev.clientY - sy;
          var nx = ox, ny = oy, nw = ow, nh = oh;
          if (dir.indexOf('e') !== -1) nw = Math.max(10, ow + dx);
          if (dir.indexOf('s') !== -1) nh = Math.max(10, oh + dy);
          if (dir.indexOf('w') !== -1) { nw = Math.max(10, ow - dx); nx = ox + (ow - nw); }
          if (dir.indexOf('n') !== -1) { nh = Math.max(10, oh - dy); ny = oy + (oh - nh); }
          applyRect(id, nx, ny, nw, nh);
        }
        function up() { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); }
        h.addEventListener('pointermove', move);
        h.addEventListener('pointerup', up);
      });
    });
  }

  function resetAsset(id) {
    var node = document.getElementById(id);
    if (!node) return;
    if (originalCss[id]) node.setAttribute('style', originalCss[id]);
    else node.removeAttribute('style');
    delete diff[id];
    scan();
  }

  // ── control panel ────────────────────────────────────────────
  function buildPanel() {
    var p = el('div', 'dbgPanel');
    p.innerHTML =
      '<div class="dbgHead">🛠 Layout Debug</div>' +
      '<div class="dbgNav" id="dbgNav"></div>' +
      '<div class="dbgList" id="dbgList"></div>' +
      '<button class="dbgBtn dbgDl" id="dbgDl">⬇ Download Layout JSON</button>';
    return p;
  }

  function renderPanel() {
    var nav = panel.querySelector('#dbgNav');
    var screens = ['title'];
    var rounds = (window.__GAME && window.__GAME.rounds) || [];
    rounds.forEach(function (_, i) { screens.push('round' + i); });

    nav.innerHTML = '<div class="dbgNavTitle">Jump to screen</div>';
    screens.forEach(function (name, i) {
      var chip = el('button', 'dbgChip' + (name === currentScreen ? ' on' : ''));
      chip.textContent = name === 'title' ? 'Title' : (rounds[i - 1] || name);
      chip.addEventListener('click', function () {
        currentScreen = name;
        if (window.__GAME && window.__GAME.gotoScreen) window.__GAME.gotoScreen(name);
        setTimeout(scan, 80);   // let the screen render, then re-instrument
      });
      nav.appendChild(chip);
    });

    var list = panel.querySelector('#dbgList');
    list.innerHTML = '';
    Object.keys(handles).forEach(function (id) {
      var row = el('div', 'dbgRow');
      row.id = 'dbgRow-' + id;
      row.innerHTML = '<span class="dbgRowId">' + id + '</span>' +
        '<span class="dbgRowVal" id="dbgVal-' + id + '"></span>';
      var rst = el('button', 'dbgBtn dbgReset');
      rst.textContent = '⟲';
      rst.title = 'Reset ' + id;
      rst.addEventListener('click', function () { resetAsset(id); });
      row.appendChild(rst);
      list.appendChild(row);
      syncRow(id);
    });

    panel.querySelector('#dbgDl').onclick = downloadJSON;
  }

  function syncRow(id) {
    var v = panel.querySelector('#dbgVal-' + id);
    if (v && diff[id]) v.textContent = diff[id].x + ', ' + diff[id].y + ' · ' + diff[id].w + '×' + diff[id].h;
  }

  function downloadJSON() {
    var assets = Object.keys(diff).map(function (id) {
      return { id: id, x: diff[id].x, y: diff[id].y, w: diff[id].w, h: diff[id].h };
    });
    var data = { screen: currentScreen, unit: '% of #gc frame', assets: assets };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'layout_' + currentScreen + '_' + stamp() + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function stamp() {
    var d = new Date();
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
      '_' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  }

  // ── overlay + panel styles ───────────────────────────────────
  function injectStyles() {
    var css =
      '#dbgLayer{position:absolute;inset:0;z-index:9000;pointer-events:none;}' +
      '.dbgBox{position:absolute;border:2px solid #00e5ff;background:rgba(0,229,255,0.08);' +
        'pointer-events:auto;cursor:move;box-sizing:border-box;}' +
      '.dbgLabel{position:absolute;left:0;top:-18px;font:700 11px/1 monospace;color:#00e5ff;' +
        'background:rgba(0,0,0,0.75);padding:2px 5px;white-space:nowrap;border-radius:3px;}' +
      '.dbgRes{position:absolute;width:10px;height:10px;background:#00e5ff;border:1px solid #003;' +
        'box-sizing:border-box;}' +
      '.dbgRes-nw{left:-5px;top:-5px;cursor:nwse-resize;}.dbgRes-ne{right:-5px;top:-5px;cursor:nesw-resize;}' +
      '.dbgRes-se{right:-5px;bottom:-5px;cursor:nwse-resize;}.dbgRes-sw{left:-5px;bottom:-5px;cursor:nesw-resize;}' +
      '.dbgRes-n{left:50%;top:-5px;margin-left:-5px;cursor:ns-resize;}.dbgRes-s{left:50%;bottom:-5px;margin-left:-5px;cursor:ns-resize;}' +
      '.dbgRes-w{left:-5px;top:50%;margin-top:-5px;cursor:ew-resize;}.dbgRes-e{right:-5px;top:50%;margin-top:-5px;cursor:ew-resize;}' +
      '.dbgPanel{position:fixed;top:10px;left:10px;z-index:9001;width:250px;max-height:92vh;overflow:auto;' +
        'background:rgba(18,7,31,0.95);color:#fff;font:12px/1.4 system-ui,sans-serif;border:1px solid #00e5ff;' +
        'border-radius:10px;padding:10px;box-shadow:0 8px 28px rgba(0,0,0,0.6);}' +
      '.dbgHead{font-weight:800;margin-bottom:8px;color:#00e5ff;}' +
      '.dbgNavTitle{font-weight:700;margin:4px 0;opacity:0.8;}' +
      '.dbgNav{margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:8px;}' +
      '.dbgChip{margin:2px;padding:3px 8px;border-radius:12px;border:1px solid #00e5ff;background:transparent;' +
        'color:#fff;cursor:pointer;font:11px/1 system-ui;text-transform:capitalize;}' +
      '.dbgChip.on{background:#00e5ff;color:#08202a;font-weight:700;}' +
      '.dbgRow{display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.08);}' +
      '.dbgRowId{flex:0 0 84px;font-weight:700;}.dbgRowVal{flex:1;font:11px/1.3 monospace;opacity:0.85;}' +
      '.dbgBtn{cursor:pointer;border:none;border-radius:6px;font:inherit;}' +
      '.dbgReset{background:#3a2a4a;color:#fff;width:24px;height:22px;}' +
      '.dbgDl{width:100%;margin-top:10px;padding:8px;background:#00e5ff;color:#08202a;font-weight:800;}';
    var s = el('style'); s.textContent = css; document.head.appendChild(s);
  }
})();
