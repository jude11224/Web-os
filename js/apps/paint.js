/* Paint — raster drawing app */
'use strict';

OS.registerApp({
  id: 'paint', name: 'Paint', icon: 'paint', category: 'Apps', width: 900, height: 620, minWidth: 500, minHeight: 380,
  desc: 'Draw and edit pictures', keywords: 'draw image sketch art',
  exts: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'],
  launch(win, args) {
    const fs = OS.fs;
    let path = null, dirty = false;
    let tool = 'brush', color = '#1e293b', color2 = '#ffffff', size = 6, fill = false, opacity = 1;
    const undo = [], redo = [];

    const cv = U.h('canvas', { class: 'paint-canvas' });
    const ov = U.h('canvas', { class: 'paint-overlay' });
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const octx = ov.getContext('2d');
    const stageInner = U.h('div', { class: 'paint-inner' }, cv, ov);
    const stage = U.h('div', { class: 'paint-stage' }, stageInner);
    const status = U.h('div', { class: 'statusbar' });

    const TOOLS = [
      ['brush', '🖌', 'Brush (B)'], ['pencil', '✏', 'Pencil (P)'], ['eraser', '⌫', 'Eraser (E)'], ['fill', '🪣', 'Fill (F)'],
      ['picker', '💧', 'Color picker (I)'], ['line', '╱', 'Line (L)'], ['rect', '▭', 'Rectangle (R)'], ['ellipse', '◯', 'Ellipse (O)'],
      ['text', 'T', 'Text (T)'], ['spray', '⁂', 'Spray (S)'],
    ];
    const PALETTE = ['#000000', '#1e293b', '#64748b', '#ffffff', '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#7c2d12', '#fde68a', '#bae6fd'];
    const toolBtns = {};
    const toolbox = U.h('div', { class: 'paint-tools' }, TOOLS.map(([id, ic, title]) => (toolBtns[id] = U.h('button', { class: 'ptool', title, onclick: () => setTool(id) }, ic))));
    const c1 = U.h('input', { type: 'color', value: color, title: 'Primary color (left click)' });
    const c2 = U.h('input', { type: 'color', value: color2, title: 'Secondary color (right click)' });
    c1.oninput = () => { color = c1.value; };
    c2.oninput = () => { color2 = c2.value; };
    const sizeInp = U.h('input', { type: 'range', min: 1, max: 80, value: size });
    const sizeLbl = U.h('span', { class: 'muted' }, size + 'px');
    sizeInp.oninput = () => { size = +sizeInp.value; sizeLbl.textContent = size + 'px'; };
    const opInp = U.h('input', { type: 'range', min: 5, max: 100, value: 100 });
    opInp.oninput = () => { opacity = opInp.value / 100; };
    const fillChk = U.h('input', { type: 'checkbox' });
    fillChk.onchange = () => { fill = fillChk.checked; };
    const palette = U.h('div', { class: 'paint-palette' }, PALETTE.map(c => {
      const sw = U.h('button', { class: 'swatch', style: { background: c }, title: c });
      sw.onclick = () => { color = c; c1.value = c; };
      sw.oncontextmenu = e => { e.preventDefault(); color2 = c; c2.value = c; };
      return sw;
    }));

    const menubar = OS.ui.menubar([
      { label: 'File', items: () => [
        { label: 'New…', shortcut: 'Ctrl+N', action: newImage },
        { label: 'Open…', shortcut: 'Ctrl+O', action: openImage },
        { label: 'Import from computer…', action: importImage },
        { label: 'Save', shortcut: 'Ctrl+S', action: save },
        { label: 'Save as…', action: saveAs },
        { label: 'Download PNG', action: () => U.download((path ? U.stripExt(U.basename(path)) : 'drawing') + '.png', cv.toDataURL('image/png')) },
        { label: 'Set as wallpaper', action: async () => { if (await save()) OS.settings.set('wallpaper', { type: 'image', path }); } },
      ] },
      { label: 'Edit', items: () => [
        { label: 'Undo', shortcut: 'Ctrl+Z', disabled: !undo.length, action: doUndo },
        { label: 'Redo', shortcut: 'Ctrl+Y', disabled: !redo.length, action: doRedo },
        '-',
        { label: 'Clear canvas', action: () => { snapshot(); ctx.fillStyle = color2; ctx.fillRect(0, 0, cv.width, cv.height); markDirty(); } },
      ] },
      { label: 'Image', items: () => [
        { label: 'Resize canvas…', action: resizeDialog },
        { label: 'Flip horizontal', action: () => transform((c, w, h) => { c.translate(w, 0); c.scale(-1, 1); }) },
        { label: 'Flip vertical', action: () => transform((c, w, h) => { c.translate(0, h); c.scale(1, -1); }) },
        { label: 'Rotate 90°', action: () => rotate() },
        '-',
        { label: 'Invert colors', action: () => filter(d => { for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; } }) },
        { label: 'Grayscale', action: () => filter(d => { for (let i = 0; i < d.length; i += 4) { const g = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; d[i] = d[i + 1] = d[i + 2] = g; } }) },
        { label: 'Sepia', action: () => filter(d => { for (let i = 0; i < d.length; i += 4) { const r = d[i], g = d[i + 1], b = d[i + 2]; d[i] = Math.min(255, r * .393 + g * .769 + b * .189); d[i + 1] = Math.min(255, r * .349 + g * .686 + b * .168); d[i + 2] = Math.min(255, r * .272 + g * .534 + b * .131); } }) },
      ] },
    ]);

    win.body.append(menubar,
      U.h('div', { class: 'toolbar paint-bar' },
        U.h('div', { class: 'paint-colors' }, c1, c2),
        U.h('label', { class: 'pb-field' }, 'Size', sizeInp, sizeLbl),
        U.h('label', { class: 'pb-field' }, 'Opacity', opInp),
        U.h('label', { class: 'pb-field' }, fillChk, 'Fill shapes'),
        U.h('span', { class: 'sep' }),
        U.h('button', { class: 'btn icon-btn', title: 'Undo (Ctrl+Z)', onclick: doUndo }, '↶'),
        U.h('button', { class: 'btn icon-btn', title: 'Redo (Ctrl+Y)', onclick: doRedo }, '↷'),
        U.h('button', { class: 'btn', onclick: save }, 'Save')),
      U.h('div', { class: 'paint-main' }, toolbox, stage),
      U.h('div', { class: 'paint-foot' }, palette, status));

    function setTool(t) {
      tool = t;
      Object.entries(toolBtns).forEach(([k, b]) => b.classList.toggle('active', k === t));
      ov.style.cursor = t === 'picker' ? 'copy' : t === 'text' ? 'text' : t === 'fill' ? 'cell' : 'crosshair';
    }
    function setSize(w, h, keep = true) {
      const old = keep ? ctx.getImageData(0, 0, cv.width, cv.height) : null;
      cv.width = ov.width = w;
      cv.height = ov.height = h;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      if (old) ctx.putImageData(old, 0, 0);
      stageInner.style.width = w + 'px';
      stageInner.style.height = h + 'px';
      updateStatus();
    }
    function snapshot() {
      undo.push(ctx.getImageData(0, 0, cv.width, cv.height));
      if (undo.length > 30) undo.shift();
      redo.length = 0;
    }
    function doUndo() {
      if (!undo.length) return;
      redo.push(ctx.getImageData(0, 0, cv.width, cv.height));
      const img = undo.pop();
      if (img.width !== cv.width || img.height !== cv.height) setSize(img.width, img.height, false);
      ctx.putImageData(img, 0, 0);
      markDirty();
    }
    function doRedo() {
      if (!redo.length) return;
      undo.push(ctx.getImageData(0, 0, cv.width, cv.height));
      const img = redo.pop();
      if (img.width !== cv.width || img.height !== cv.height) setSize(img.width, img.height, false);
      ctx.putImageData(img, 0, 0);
      markDirty();
    }
    function markDirty() { dirty = true; title(); }
    function title() { win.setTitle(`${dirty ? '• ' : ''}${path ? U.basename(path) : 'Untitled'} — Paint`); }
    function updateStatus(x, y) {
      status.textContent = `${cv.width} × ${cv.height}px` + (x != null ? `   •   ${x}, ${y}` : '');
    }
    function filter(fn) {
      snapshot();
      const img = ctx.getImageData(0, 0, cv.width, cv.height);
      fn(img.data);
      ctx.putImageData(img, 0, 0);
      markDirty();
    }
    function transform(fn) {
      snapshot();
      const tmp = U.h('canvas', { width: cv.width, height: cv.height });
      tmp.getContext('2d').drawImage(cv, 0, 0);
      ctx.save();
      fn(ctx, cv.width, cv.height);
      ctx.drawImage(tmp, 0, 0);
      ctx.restore();
      markDirty();
    }
    function rotate() {
      snapshot();
      const tmp = U.h('canvas', { width: cv.width, height: cv.height });
      tmp.getContext('2d').drawImage(cv, 0, 0);
      setSize(cv.height, cv.width, false);
      ctx.save();
      ctx.translate(cv.width, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(tmp, 0, 0);
      ctx.restore();
      markDirty();
    }
    async function resizeDialog() {
      const v = await OS.dialog.prompt('New size (width x height)', `${cv.width}x${cv.height}`, { title: 'Resize canvas' });
      const m = /(\d+)\s*[x×, ]\s*(\d+)/.exec(v || '');
      if (!m) return;
      snapshot();
      setSize(U.clamp(+m[1], 1, 4000), U.clamp(+m[2], 1, 4000));
      markDirty();
    }

    /* ---------- drawing ---------- */
    const pos = e => {
      const r = ov.getBoundingClientRect();
      return { x: Math.round((e.clientX - r.left) * cv.width / r.width), y: Math.round((e.clientY - r.top) * cv.height / r.height) };
    };
    let drawing = false, start = null, lastP = null, curColor = color, sprayTimer = null;
    ov.addEventListener('contextmenu', e => e.preventDefault());
    ov.addEventListener('pointerdown', e => {
      if (e.button !== 0 && e.button !== 2) return;
      e.preventDefault();
      const p = pos(e);
      curColor = e.button === 2 ? color2 : color;
      if (tool === 'picker') {
        const d = ctx.getImageData(p.x, p.y, 1, 1).data;
        const hex = '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');
        if (e.button === 2) { color2 = hex; c2.value = hex; } else { color = hex; c1.value = hex; }
        return;
      }
      if (tool === 'fill') { snapshot(); floodFill(p.x, p.y, curColor); markDirty(); return; }
      if (tool === 'text') { placeText(p); return; }
      snapshot();
      drawing = true;
      start = lastP = p;
      ov.setPointerCapture(e.pointerId);
      ctx.globalAlpha = opacity;
      if (tool === 'brush' || tool === 'pencil' || tool === 'eraser') stroke(p, p);
      if (tool === 'spray') { spray(p); sprayTimer = setInterval(() => spray(lastP), 30); }
    });
    ov.addEventListener('pointermove', e => {
      const p = pos(e);
      updateStatus(p.x, p.y);
      if (!drawing) return;
      if (tool === 'brush' || tool === 'pencil' || tool === 'eraser') { stroke(lastP, p); lastP = p; }
      else if (tool === 'spray') lastP = p;
      else preview(start, p, e.shiftKey);
    });
    const end = e => {
      if (!drawing) return;
      drawing = false;
      clearInterval(sprayTimer);
      const p = pos(e);
      if (['line', 'rect', 'ellipse'].includes(tool)) { octx.clearRect(0, 0, ov.width, ov.height); shape(ctx, start, p, e.shiftKey); }
      ctx.globalAlpha = 1;
      markDirty();
    };
    ov.addEventListener('pointerup', end);
    ov.addEventListener('pointercancel', end);
    function stroke(a, b) {
      ctx.save();
      ctx.lineCap = tool === 'pencil' ? 'square' : 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = tool === 'pencil' ? Math.max(1, Math.round(size / 4)) : size;
      if (tool === 'eraser') { ctx.globalAlpha = 1; ctx.strokeStyle = color2; }
      else ctx.strokeStyle = curColor;
      ctx.beginPath();
      ctx.moveTo(a.x + 0.01, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
    }
    function spray(p) {
      ctx.fillStyle = curColor;
      for (let i = 0; i < size * 2; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * size * 1.5;
        ctx.fillRect(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 1.2, 1.2);
      }
    }
    function shape(c, a, b, constrain) {
      let w = b.x - a.x, h = b.y - a.y;
      if (constrain && tool !== 'line') { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
      c.save();
      c.globalAlpha = opacity;
      c.strokeStyle = curColor;
      c.fillStyle = curColor;
      c.lineWidth = Math.max(1, size / 2);
      c.lineCap = 'round';
      c.beginPath();
      if (tool === 'line') {
        let ex = b.x, ey = b.y;
        if (constrain) { const ang = Math.round(Math.atan2(h, w) / (Math.PI / 4)) * Math.PI / 4, len = Math.hypot(w, h); ex = a.x + Math.cos(ang) * len; ey = a.y + Math.sin(ang) * len; }
        c.moveTo(a.x, a.y); c.lineTo(ex, ey); c.stroke();
      } else if (tool === 'rect') {
        c.rect(a.x, a.y, w, h);
        fill ? c.fill() : c.stroke();
      } else {
        c.ellipse(a.x + w / 2, a.y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
        fill ? c.fill() : c.stroke();
      }
      c.restore();
    }
    function preview(a, b, constrain) {
      octx.clearRect(0, 0, ov.width, ov.height);
      shape(octx, a, b, constrain);
    }
    function floodFill(x, y, hex) {
      const img = ctx.getImageData(0, 0, cv.width, cv.height), d = img.data, W = cv.width, H = cv.height;
      const i0 = (y * W + x) * 4;
      const t = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]];
      const n = parseInt(hex.slice(1), 16);
      const f = [(n >> 16) & 255, (n >> 8) & 255, n & 255, Math.round(opacity * 255)];
      if (t.every((v, k) => Math.abs(v - f[k]) < 2)) return;
      const tol = 40;
      const match = i => Math.abs(d[i] - t[0]) + Math.abs(d[i + 1] - t[1]) + Math.abs(d[i + 2] - t[2]) + Math.abs(d[i + 3] - t[3]) <= tol;
      const seen = new Uint8Array(W * H);
      const stack = [x, y];
      while (stack.length) {
        const cy = stack.pop(), cx = stack.pop();
        let lx = cx;
        while (lx >= 0 && !seen[cy * W + lx] && match((cy * W + lx) * 4)) lx--;
        lx++;
        let up = false, down = false;
        for (let xx = lx; xx < W; xx++) {
          const idx = cy * W + xx;
          if (seen[idx] || !match(idx * 4)) break;
          seen[idx] = 1;
          d.set(f, idx * 4);
          if (cy > 0) { const u = idx - W; if (!seen[u] && match(u * 4)) { if (!up) { stack.push(xx, cy - 1); up = true; } } else up = false; }
          if (cy < H - 1) { const dn = idx + W; if (!seen[dn] && match(dn * 4)) { if (!down) { stack.push(xx, cy + 1); down = true; } } else down = false; }
        }
      }
      ctx.putImageData(img, 0, 0);
    }
    async function placeText(p) {
      const t = await OS.dialog.prompt('Text to place', '', { title: 'Text tool' });
      if (!t) return;
      snapshot();
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.font = `${Math.max(10, size * 3)}px system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      t.split('\n').forEach((l, i) => ctx.fillText(l, p.x, p.y + i * size * 3.4));
      ctx.restore();
      markDirty();
    }

    /* ---------- files ---------- */
    function loadSrc(src, p) {
      const img = new Image();
      img.onload = () => {
        setSize(img.naturalWidth || 800, img.naturalHeight || 600, false);
        ctx.drawImage(img, 0, 0);
        path = p;
        dirty = false;
        undo.length = redo.length = 0;
        title();
      };
      img.onerror = () => OS.dialog.alert('Could not open this image.');
      img.src = src;
    }
    async function confirmDiscard() {
      if (!dirty) return true;
      const r = await OS.dialog.ask('Save changes to your drawing?', { title: 'Paint', yes: 'Save', no: "Don't save" });
      if (r === 'yes') return save();
      return r === 'no';
    }
    async function newImage() {
      if (!(await confirmDiscard())) return;
      path = null; dirty = false; undo.length = redo.length = 0;
      setSize(960, 600, false);
      title();
    }
    async function openImage() {
      if (!(await confirmDiscard())) return;
      const p = await OS.dialog.file({ mode: 'open', start: '/Pictures', exts: U.imageExts });
      if (p) loadSrc(fs.read(p), U.ext(p) === 'svg' ? null : p);
    }
    async function importImage() {
      const [f] = await U.pickHostFiles({ accept: 'image/*', multiple: false });
      if (f) loadSrc(await U.readHostFile(f), null);
    }
    async function save() {
      if (!path || !['png', 'jpg', 'jpeg', 'webp'].includes(U.ext(path))) return saveAs();
      const e = U.ext(path);
      fs.write(path, cv.toDataURL(e === 'png' ? 'image/png' : e === 'webp' ? 'image/webp' : 'image/jpeg', 0.92));
      dirty = false; title();
      return true;
    }
    async function saveAs() {
      const p = await OS.dialog.file({ mode: 'save', start: '/Pictures', name: path ? U.stripExt(U.basename(path)) + '.png' : 'drawing.png' });
      if (!p) return false;
      path = U.ext(p) ? p : p + '.png';
      return save();
    }

    win.onKey(e => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 'z') { e.preventDefault(); doUndo(); }
      else if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); doRedo(); }
      else if (ctrl && e.key === 's') { e.preventDefault(); save(); }
      else if (ctrl && e.key === 'o') { e.preventDefault(); openImage(); }
      else if (ctrl && e.key === 'n') { e.preventDefault(); newImage(); }
      else if (!ctrl && !e.altKey) {
        const map = { b: 'brush', p: 'pencil', e: 'eraser', f: 'fill', i: 'picker', l: 'line', r: 'rect', o: 'ellipse', t: 'text', s: 'spray' };
        if (map[e.key]) setTool(map[e.key]);
        if (e.key === '[') { size = Math.max(1, size - 2); sizeInp.value = size; sizeLbl.textContent = size + 'px'; }
        if (e.key === ']') { size = Math.min(80, size + 2); sizeInp.value = size; sizeLbl.textContent = size + 'px'; }
      }
    });
    win.beforeClose = confirmDiscard;
    // paste images from clipboard
    win.on(document, 'paste', e => {
      if (!win.focused) return;
      const item = [...(e.clipboardData || {}).items || []].find(i => i.type.startsWith('image/'));
      if (!item) return;
      const r = new FileReader();
      r.onload = () => { const img = new Image(); img.onload = () => { snapshot(); ctx.drawImage(img, 0, 0); markDirty(); }; img.src = r.result; };
      r.readAsDataURL(item.getAsFile());
    });

    setTool('brush');
    setSize(960, 600, false);
    title();
    if (args.path) loadSrc(fs.read(args.path), U.ext(args.path) === 'svg' ? null : fs.resolve(args.path));
  },
});
