/* WebOS window manager: create, focus, drag, resize, snap, minimize, maximize, close */
'use strict';

(() => {
  const wm = OS.wm = { windows: new Map(), z: 10, active: null, cascade: 0 };
  const area = () => document.getElementById('windows');
  const snapEl = () => document.getElementById('snap-preview');

  const CTRL_ICONS = {
    min: '<svg viewBox="0 0 12 12" width="12" height="12"><path d="M2 6h8" stroke="currentColor" stroke-width="1.4"/></svg>',
    max: '<svg viewBox="0 0 12 12" width="12" height="12"><rect x="2" y="2" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
    restore: '<svg viewBox="0 0 12 12" width="12" height="12"><rect x="2" y="4" width="6" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M4 4V2.5h5.5V8H8" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
    close: '<svg viewBox="0 0 12 12" width="12" height="12"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="1.4"/></svg>',
  };

  wm.list = () => [...wm.windows.values()];
  wm.byApp = appId => wm.list().filter(w => w.app === appId);
  wm.topmost = () => wm.list().filter(w => !w.minimized).sort((a, b) => b.z - a.z)[0] || null;

  wm.create = function (opts = {}) {
    const A = area().getBoundingClientRect();
    const small = A.width < 700;
    const width = Math.min(opts.width || 640, A.width - 16);
    const height = Math.min(opts.height || 460, A.height - 16);
    const off = (wm.cascade++ % 8) * 28 - 98;
    let x = opts.x ?? Math.round((A.width - width) / 2 + off);
    let y = opts.y ?? Math.round((A.height - height) / 2 + off * 0.6);
    x = U.clamp(x, 0, Math.max(0, A.width - width));
    y = U.clamp(y, 0, Math.max(0, A.height - height));

    const el = U.h('div', {
      class: 'win opening' + (opts.className ? ' ' + opts.className : '') + (opts.dialog ? ' dialog' : ''),
      role: 'dialog',
      style: { left: x + 'px', top: y + 'px', width: width + 'px', height: height + 'px' },
    });
    el.innerHTML = `
      <div class="win-titlebar">
        <span class="win-icon"></span><span class="win-title"></span>
        <div class="win-controls">
          ${opts.dialog ? '' : `<button class="wc wc-min" title="Minimize">${CTRL_ICONS.min}</button>`}
          ${opts.resizable === false ? '' : `<button class="wc wc-max" title="Maximize">${CTRL_ICONS.max}</button>`}
          <button class="wc wc-close" title="Close">${CTRL_ICONS.close}</button>
        </div>
      </div>
      <div class="win-body"></div>`;
    if (opts.resizable !== false) {
      for (const d of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) el.appendChild(U.h('div', { class: 'rz rz-' + d, 'data-dir': d }));
    }
    const body = el.querySelector('.win-body');

    const win = {
      id: 'w' + U.uid(), el, body, app: opts.app || null, opts, z: 0,
      title: opts.title || 'Window', icon: opts.icon || 'file',
      minimized: false, maximized: false, focused: false, closed: false,
      minWidth: opts.minWidth || 240, minHeight: opts.minHeight || 140,
      _cleanup: [], _resize: [], beforeClose: null,
      noTaskbar: !!opts.noTaskbar,

      setTitle(t) { win.title = t; el.querySelector('.win-title').textContent = t; OS.bus.emit('wm:change'); },
      setIcon(i) { win.icon = i; el.querySelector('.win-icon').innerHTML = OS.icons.tile(i, 18); OS.bus.emit('wm:change'); },

      focus() {
        if (win.closed) return;
        if (win.minimized) win.restoreMin();
        if (wm.active && wm.active !== win) wm.active.blur();
        win.z = ++wm.z;
        el.style.zIndex = win.z;
        if (!win.focused) {
          win.focused = true;
          el.classList.add('focused');
          wm.active = win;
          win.onFocus && win.onFocus();
          OS.bus.emit('wm:change');
        }
      },
      blur() {
        if (!win.focused) return;
        win.focused = false;
        el.classList.remove('focused');
        if (wm.active === win) wm.active = null;
        win.onBlur && win.onBlur();
        OS.bus.emit('wm:change');
      },
      minimize() {
        if (win.minimized) return;
        win.minimized = true;
        el.classList.add('minimized');
        win.blur();
        const next = wm.topmost();
        next && next.focus();
        OS.bus.emit('wm:change');
      },
      restoreMin() {
        win.minimized = false;
        el.classList.remove('minimized');
        OS.bus.emit('wm:change');
      },
      maximize() {
        if (win.maximized) return;
        win._prev = { left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height };
        win.maximized = true;
        el.classList.add('maximized');
        const b = el.querySelector('.wc-max');
        if (b) { b.innerHTML = CTRL_ICONS.restore; b.title = 'Restore'; }
        win._fireResize();
      },
      unmaximize() {
        if (!win.maximized) return;
        win.maximized = false;
        el.classList.remove('maximized');
        if (win._prev) Object.assign(el.style, win._prev);
        const b = el.querySelector('.wc-max');
        if (b) { b.innerHTML = CTRL_ICONS.max; b.title = 'Maximize'; }
        win._fireResize();
      },
      toggleMax() { win.maximized ? win.unmaximize() : win.maximize(); },
      async close(force = false) {
        if (win.closed) return;
        if (!force && win.beforeClose) {
          let ok;
          try { ok = await win.beforeClose(); } catch { ok = true; }
          if (ok === false) return;
        }
        win.closed = true;
        win._cleanup.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
        win._cleanup = [];
        el.classList.add('closing');
        wm.windows.delete(win.id);
        if (wm.active === win) wm.active = null;
        setTimeout(() => el.remove(), 160);
        const next = wm.topmost();
        next && next.focus();
        OS.bus.emit('wm:change');
        OS.bus.emit('wm:close', win);
      },
      center() {
        const A2 = area().getBoundingClientRect();
        el.style.left = Math.max(0, (A2.width - el.offsetWidth) / 2) + 'px';
        el.style.top = Math.max(0, (A2.height - el.offsetHeight) / 2) + 'px';
      },
      setSize(w, h) {
        const A2 = area().getBoundingClientRect();
        w = Math.min(w, A2.width); h = Math.min(h, A2.height);
        el.style.width = w + 'px';
        el.style.height = h + 'px';
        if (el.offsetLeft + w > A2.width) el.style.left = Math.max(0, A2.width - w) + 'px';
        if (el.offsetTop + h > A2.height) el.style.top = Math.max(0, A2.height - h) + 'px';
        win._fireResize();
      },

      /* lifecycle-managed helpers (auto-cleaned when window closes) */
      addCleanup(fn) { win._cleanup.push(fn); },
      on(target, type, fn, o) {
        target.addEventListener(type, fn, o);
        win._cleanup.push(() => target.removeEventListener(type, fn, o));
      },
      interval(fn, ms) { const t = setInterval(fn, ms); win._cleanup.push(() => clearInterval(t)); return t; },
      timeout(fn, ms) { const t = setTimeout(fn, ms); win._cleanup.push(() => clearTimeout(t)); return t; },
      /** requestAnimationFrame loop; fn(dt seconds, time). Returns stop() */
      loop(fn) {
        let raf, last = performance.now(), stopped = false;
        const tick = now => {
          if (stopped) return;
          const dt = Math.min(0.05, (now - last) / 1000);
          last = now;
          try { fn(dt, now); } catch (e) { console.error(e); stopped = true; return; }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        const stop = () => { stopped = true; cancelAnimationFrame(raf); };
        win._cleanup.push(stop);
        return stop;
      },
      /** keyboard handler only active while this window is focused */
      onKey(fn, type = 'keydown') {
        win.on(document, type, e => {
          if (!win.focused || win.minimized) return;
          if ((OS.shell && OS.shell.overlayOpen()) || (OS.session && OS.session.locked)) return;
          fn(e);
        });
      },
      onResize(fn) { win._resize.push(fn); },
      _fireResize() { win._resize.forEach(f => { try { f(); } catch (e) { console.error(e); } }); },
      sub(evt, fn) { win._cleanup.push(OS.bus.on(evt, fn)); },
    };

    win.setTitle(win.title);
    win.setIcon(win.icon);

    // Resize observer for apps that need it (canvases etc.)
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(U.debounce(() => win._fireResize(), 30));
      ro.observe(body);
      win._cleanup.push(() => ro.disconnect());
    }

    // Focus on any pointer interaction
    el.addEventListener('pointerdown', () => win.focus(), true);

    // Control buttons
    el.querySelector('.wc-close').onclick = e => { e.stopPropagation(); win.close(); };
    const bmin = el.querySelector('.wc-min');
    if (bmin) bmin.onclick = e => { e.stopPropagation(); win.minimize(); };
    const bmax = el.querySelector('.wc-max');
    if (bmax) bmax.onclick = e => { e.stopPropagation(); win.toggleMax(); };
    el.querySelectorAll('.wc').forEach(b => b.addEventListener('pointerdown', e => e.stopPropagation()));

    // Titlebar drag + snap
    const tb = el.querySelector('.win-titlebar');
    tb.addEventListener('dblclick', e => { if (!e.target.closest('.wc') && opts.resizable !== false) win.toggleMax(); });
    tb.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('.wc')) return;
      e.preventDefault();
      const Ar = area().getBoundingClientRect();
      let startX = e.clientX, startY = e.clientY;
      let ox = el.offsetLeft, oy = el.offsetTop, moved = false, snap = null;
      tb.setPointerCapture(e.pointerId);
      document.body.classList.add('dragging');
      const move = ev => {
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
        if (!moved && win.maximized) {
          // detach from maximized, keep cursor at same relative x
          const ratio = (ev.clientX - Ar.left) / Ar.width;
          win.unmaximize();
          ox = ev.clientX - Ar.left - el.offsetWidth * ratio;
          oy = 0;
          startX = ev.clientX; startY = ev.clientY;
        }
        moved = true;
        const nx = U.clamp(ox + ev.clientX - startX, -el.offsetWidth + 80, Ar.width - 80);
        const ny = U.clamp(oy + ev.clientY - startY, 0, Ar.height - 32);
        el.style.left = nx + 'px';
        el.style.top = ny + 'px';
        if (opts.resizable === false) return;
        const px = ev.clientX - Ar.left, py = ev.clientY - Ar.top;
        snap = py <= 4 ? 'max' : px <= 6 ? 'left' : px >= Ar.width - 6 ? 'right' : null;
        const sp = snapEl();
        if (snap) {
          sp.className = 'show snap-' + snap;
        } else sp.className = '';
      };
      const up = () => {
        tb.removeEventListener('pointermove', move);
        tb.removeEventListener('pointerup', up);
        tb.removeEventListener('pointercancel', up);
        document.body.classList.remove('dragging');
        snapEl().className = '';
        if (snap === 'max') win.maximize();
        else if (snap === 'left' || snap === 'right') {
          win._prev = { left: Math.max(0, ox) + 'px', top: oy + 'px', width: el.style.width, height: el.style.height };
          Object.assign(el.style, { left: snap === 'left' ? '0px' : Ar.width / 2 + 'px', top: '0px', width: Ar.width / 2 + 'px', height: Ar.height + 'px' });
          win._fireResize();
        }
      };
      tb.addEventListener('pointermove', move);
      tb.addEventListener('pointerup', up);
      tb.addEventListener('pointercancel', up);
    });

    // Edge resizing
    el.querySelectorAll('.rz').forEach(h => h.addEventListener('pointerdown', e => {
      if (e.button !== 0 || win.maximized) return;
      e.preventDefault();
      e.stopPropagation();
      win.focus();
      const dir = h.dataset.dir;
      const sx = e.clientX, sy = e.clientY;
      const r = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
      h.setPointerCapture(e.pointerId);
      document.body.classList.add('dragging');
      const move = ev => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        let { x, y, w, h: hh } = r;
        if (dir.includes('e')) w = Math.max(win.minWidth, r.w + dx);
        if (dir.includes('s')) hh = Math.max(win.minHeight, r.h + dy);
        if (dir.includes('w')) { w = Math.max(win.minWidth, r.w - dx); x = r.x + r.w - w; }
        if (dir.includes('n')) { hh = Math.max(win.minHeight, r.h - dy); y = Math.max(0, r.y + r.h - hh); hh = r.y + r.h - y; }
        Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: hh + 'px' });
      };
      const up = () => {
        h.removeEventListener('pointermove', move);
        h.removeEventListener('pointerup', up);
        document.body.classList.remove('dragging');
        win._fireResize();
      };
      h.addEventListener('pointermove', move);
      h.addEventListener('pointerup', up);
    }));

    area().appendChild(el);
    wm.windows.set(win.id, win);
    setTimeout(() => el.classList.remove('opening'), 220);
    if (small || opts.maximized) win.maximize();
    win.focus();
    OS.bus.emit('wm:change');
    return win;
  };

  wm.closeAll = async (force = true) => {
    for (const w of wm.list()) await w.close(force);
  };

  wm.minimizeAll = () => wm.list().forEach(w => w.minimize());

  // Focus the window containing an iframe when the iframe gets focus (clicks inside iframes don't bubble)
  window.addEventListener('blur', () => {
    setTimeout(() => {
      const a = document.activeElement;
      if (a && a.tagName === 'IFRAME') {
        const wEl = a.closest('.win');
        const w = wEl && wm.list().find(x => x.el === wEl);
        if (w && !w.focused) w.focus();
      }
    }, 0);
  });

  // Keep windows inside the viewport when the browser resizes
  window.addEventListener('resize', U.debounce(() => {
    const A = area() && area().getBoundingClientRect();
    if (!A) return;
    wm.list().forEach(w => {
      if (w.maximized) { w._fireResize(); return; }
      const el = w.el;
      if (el.offsetLeft > A.width - 80) el.style.left = Math.max(0, A.width - el.offsetWidth) + 'px';
      if (el.offsetTop > A.height - 40) el.style.top = Math.max(0, A.height - el.offsetHeight) + 'px';
    });
  }, 100));
})();
