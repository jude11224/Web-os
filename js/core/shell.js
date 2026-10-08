/* WebOS shell: desktop icons, taskbar, start menu, action center, calendar flyout */
'use strict';

OS.shell = (() => {
  const $ = id => document.getElementById(id);
  let started = false;
  const offs = [];

  /* ======================= Desktop ======================= */
  const Desktop = {
    selected: new Set(),
    cell() {
      const s = OS.settings.get('iconSize');
      return s === 'small' ? { w: 76, h: 84 } : s === 'large' ? { w: 108, h: 118 } : { w: 90, h: 100 };
    },
    items() {
      const fs = OS.fs;
      const apps = OS.settings.get('desktopApps').filter(id => OS.apps[id]).map(id => ({
        key: 'app:' + id, name: OS.apps[id].name, icon: OS.apps[id].icon, app: id,
        drop: id === 'trash' ? '/.Trash' : null,
      }));
      let files = [];
      try {
        files = fs.list('/Desktop').map(st => {
          let icon = OS.icons.forFile(st.name, st.isDir), name = st.name, thumb = null;
          if (U.ext(st.name) === 'lnk') {
            const t = fs.read(st.path).trim();
            name = U.stripExt(st.name);
            icon = t.startsWith('app:') ? (OS.apps[t.slice(4)] || {}).icon || 'file' : OS.icons.forFile(U.basename(t), fs.isDir(t));
          } else if (U.imageExts.includes(U.ext(st.name)) && st.size < 3e6) thumb = fs.read(st.path);
          return { key: 'file:' + st.path, name, icon, thumb, path: st.path, isDir: st.isDir, drop: st.isDir ? st.path : null };
        });
      } catch { /* ignore */ }
      return [...apps, ...files];
    },
    render() {
      const root = $('desktop-icons');
      root.innerHTML = '';
      const { w, h } = this.cell();
      const rows = Math.max(1, Math.floor((root.clientHeight - 8) / h));
      const pos = OS.settings.get('iconPositions');
      const taken = new Set();
      const items = this.items();
      const placed = [];
      for (const it of items) {
        const p = pos[it.key];
        if (p && p.r < rows && !taken.has(p.c + ',' + p.r)) { taken.add(p.c + ',' + p.r); placed.push([it, p]); }
        else placed.push([it, null]);
      }
      let c = 0, r = 0;
      for (const pair of placed) {
        if (pair[1]) continue;
        while (taken.has(c + ',' + r)) { r++; if (r >= rows) { r = 0; c++; } }
        pair[1] = { c, r };
        taken.add(c + ',' + r);
      }
      for (const [it, p] of placed) {
        const el = U.h('div', {
          class: 'dicon' + (this.selected.has(it.key) ? ' sel' : ''),
          tabindex: 0, 'data-key': it.key,
          style: { left: (8 + p.c * w) + 'px', top: (8 + p.r * h) + 'px', width: (w - 6) + 'px' },
        },
        U.h('div', { class: 'dicon-img', html: it.thumb ? `<img src="${it.thumb}" alt="">` : OS.icons.tile(it.icon, w > 100 ? 56 : w < 80 ? 38 : 46) }),
        U.h('div', { class: 'dicon-label' }, it.name));
        if (it.drop) el.dataset.dropPath = it.drop;
        el._item = it;
        el._pos = p;
        this.bindIcon(el, it);
        root.appendChild(el);
      }
    },
    open(it) {
      if (it.app) OS.launch(it.app);
      else OS.openFile(it.path);
    },
    selectOnly(key) {
      this.selected = new Set(key ? [key] : []);
      document.querySelectorAll('.dicon').forEach(e => e.classList.toggle('sel', this.selected.has(e.dataset.key)));
    },
    selectedPaths() {
      return [...this.selected].filter(k => k.startsWith('file:')).map(k => k.slice(5));
    },
    bindIcon(el, it) {
      el.addEventListener('dblclick', () => this.open(it));
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter') this.open(it);
        if (e.key === 'Delete' && this.selectedPaths().length) OS.fileOps.remove(this.selectedPaths());
        if (e.key === 'F2' && it.path) OS.fileOps.rename(it.path);
      });
      el.addEventListener('contextmenu', e => {
        e.preventDefault();
        e.stopPropagation();
        if (!this.selected.has(it.key)) this.selectOnly(it.key);
        if (it.app) {
          OS.menu(e.clientX, e.clientY, [
            { label: 'Open', icon: it.icon, action: () => OS.launch(it.app) },
            it.app === 'trash' ? { label: 'Empty Trash', action: () => OS.apps.trash.empty() } : null,
            '-',
            { label: 'Remove from Desktop', action: () => OS.settings.set('desktopApps', OS.settings.get('desktopApps').filter(a => a !== it.app)) },
          ]);
        } else {
          OS.menu(e.clientX, e.clientY, OS.fileOps.menuItems(this.selectedPaths(), { dir: '/Desktop' }));
        }
      });
      el.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        if (e.ctrlKey || e.metaKey) {
          this.selected.has(it.key) ? this.selected.delete(it.key) : this.selected.add(it.key);
          el.classList.toggle('sel');
          return;
        }
        if (!this.selected.has(it.key)) this.selectOnly(it.key);
        const sx = e.clientX, sy = e.clientY;
        const icons = [...document.querySelectorAll('.dicon.sel')];
        const starts = icons.map(i => [i.offsetLeft, i.offsetTop]);
        let dragging = false;
        el.setPointerCapture(e.pointerId);
        const move = ev => {
          const dx = ev.clientX - sx, dy = ev.clientY - sy;
          if (!dragging && Math.hypot(dx, dy) < 5) return;
          if (!dragging) { dragging = true; icons.forEach(i => i.classList.add('dragging')); document.body.classList.add('dragging'); }
          icons.forEach((i, k) => { i.style.left = starts[k][0] + dx + 'px'; i.style.top = starts[k][1] + dy + 'px'; });
          document.querySelectorAll('.drop-hover').forEach(d => d.classList.remove('drop-hover'));
          const t = document.elementFromPoint(ev.clientX, ev.clientY);
          const target = t && t.closest('[data-drop-path]');
          if (target && !icons.includes(target)) target.classList.add('drop-hover');
        };
        const up = ev => {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', up);
          el.removeEventListener('pointercancel', up);
          document.body.classList.remove('dragging');
          document.querySelectorAll('.drop-hover').forEach(d => d.classList.remove('drop-hover'));
          if (!dragging) return;
          icons.forEach(i => i.classList.remove('dragging'));
          const t = document.elementFromPoint(ev.clientX, ev.clientY);
          const target = t && t.closest('[data-drop-path]');
          const paths = icons.map(i => i._item.path).filter(Boolean);
          if (target && !icons.includes(target) && paths.length) {
            const dest = target.dataset.dropPath;
            if (dest !== '/Desktop') { OS.fileOps.moveInto(paths, dest); return; }
          }
          if (t && t.closest('.win')) { this.render(); return; }
          // Reposition on grid
          const { w, h } = this.cell();
          const root = $('desktop-icons');
          const rows = Math.max(1, Math.floor((root.clientHeight - 8) / h));
          const cols = Math.max(1, Math.floor((root.clientWidth - 8) / w));
          const pos = { ...OS.settings.get('iconPositions') };
          const occupied = new Map();
          document.querySelectorAll('.dicon').forEach(d => { if (!icons.includes(d)) occupied.set(d._pos.c + ',' + d._pos.r, d.dataset.key); });
          icons.forEach(i => {
            let c = U.clamp(Math.round((i.offsetLeft - 8) / w), 0, cols - 1);
            let r = U.clamp(Math.round((i.offsetTop - 8) / h), 0, rows - 1);
            let guard = 0;
            while (occupied.has(c + ',' + r) && guard++ < 500) { r++; if (r >= rows) { r = 0; c = (c + 1) % cols; } }
            occupied.set(c + ',' + r, i.dataset.key);
            pos[i.dataset.key] = { c, r };
          });
          OS.settings.set('iconPositions', pos);
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
      });
    },
    bindBackground() {
      const root = $('desktop-icons');
      root.addEventListener('contextmenu', e => {
        if (e.target !== root) return;
        e.preventDefault();
        this.selectOnly(null);
        const fs = OS.fs;
        OS.menu(e.clientX, e.clientY, [
          { label: 'New', submenu: [
            { label: 'Folder', icon: 'folder', action: () => OS.fileOps.newFolder('/Desktop') },
            { label: 'Text Document', icon: 'filetext', action: () => OS.fileOps.newFile('/Desktop') },
            { label: 'Markdown Document', icon: 'filetext', action: () => OS.fileOps.newFile('/Desktop', 'New note.md', '# New note\n') },
            { label: 'Web Page', icon: 'filecode', action: () => OS.fileOps.newFile('/Desktop', 'page.html', '<!DOCTYPE html>\n<html>\n<body>\n  <h1>Hello!</h1>\n</body>\n</html>\n') },
          ] },
          { label: 'Paste', shortcut: 'Ctrl+V', disabled: !OS.fileOps.clipboard, action: () => OS.fileOps.paste('/Desktop') },
          { label: 'Import files…', icon: 'downloads', action: async () => fs.importFiles(await U.pickHostFiles(), '/Desktop') },
          '-',
          { label: 'Sort icons', action: () => OS.settings.set('iconPositions', {}) },
          { label: 'Icon size', submenu: ['small', 'medium', 'large'].map(s => ({ label: s[0].toUpperCase() + s.slice(1), checked: OS.settings.get('iconSize') === s, action: () => OS.settings.set('iconSize', s) })) },
          { label: 'Refresh', action: () => this.render() },
          '-',
          { label: 'Open Terminal here', icon: 'terminal', action: () => OS.launch('terminal', { cwd: '/Desktop' }) },
          { label: 'Open Desktop folder', icon: 'files', action: () => OS.launch('files', { path: '/Desktop' }) },
          { label: 'Personalize', icon: 'settings', action: () => OS.launch('settings', { page: 'personalize' }) },
        ]);
      });
      // Rubber-band selection
      root.addEventListener('pointerdown', e => {
        if (e.target !== root || e.button !== 0) return;
        OS.menu.close();
        closeOverlays();
        if (OS.wm.active) OS.wm.active.blur();
        this.selectOnly(null);
        const r0 = root.getBoundingClientRect();
        const sx = e.clientX, sy = e.clientY;
        const band = U.h('div', { class: 'rubber' });
        root.appendChild(band);
        root.setPointerCapture(e.pointerId);
        const icons = [...root.querySelectorAll('.dicon')];
        const move = ev => {
          const x1 = Math.min(sx, ev.clientX), y1 = Math.min(sy, ev.clientY), x2 = Math.max(sx, ev.clientX), y2 = Math.max(sy, ev.clientY);
          Object.assign(band.style, { left: x1 - r0.left + 'px', top: y1 - r0.top + 'px', width: x2 - x1 + 'px', height: y2 - y1 + 'px' });
          this.selected = new Set();
          icons.forEach(i => {
            const b = i.getBoundingClientRect();
            const hit = b.left < x2 && b.right > x1 && b.top < y2 && b.bottom > y1;
            i.classList.toggle('sel', hit);
            if (hit) this.selected.add(i.dataset.key);
          });
        };
        const up = () => { band.remove(); root.removeEventListener('pointermove', move); root.removeEventListener('pointerup', up); };
        root.addEventListener('pointermove', move);
        root.addEventListener('pointerup', up);
      });
      // Drop from host computer or Files app
      root.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = e.dataTransfer.types.includes('text/webos-paths') ? 'move' : 'copy'; });
      root.addEventListener('drop', async e => {
        e.preventDefault();
        const internal = e.dataTransfer.getData('text/webos-paths');
        if (internal) { OS.fileOps.moveInto(JSON.parse(internal), '/Desktop'); return; }
        if (e.dataTransfer.files.length) {
          const added = await OS.fs.importFiles([...e.dataTransfer.files], '/Desktop');
          OS.notify({ title: 'Files imported', body: `${added.length} file(s) added to Desktop`, icon: 'downloads' });
        }
      });
      // Keyboard shortcuts on desktop
      document.addEventListener('keydown', e => {
        if (!started || OS.wm.active || overlayOpen()) return;
        const tag = (document.activeElement || {}).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        const paths = this.selectedPaths();
        if ((e.ctrlKey || e.metaKey) && e.key === 'c' && paths.length) OS.fileOps.copy(paths);
        else if ((e.ctrlKey || e.metaKey) && e.key === 'x' && paths.length) OS.fileOps.cut(paths);
        else if ((e.ctrlKey || e.metaKey) && e.key === 'v') OS.fileOps.paste('/Desktop');
        else if ((e.ctrlKey || e.metaKey) && e.key === 'a') { e.preventDefault(); this.selected = new Set([...document.querySelectorAll('.dicon')].map(d => d.dataset.key)); document.querySelectorAll('.dicon').forEach(d => d.classList.add('sel')); }
      });
    },
  };

  /* ======================= Taskbar ======================= */
  const Taskbar = {
    render() {
      const box = $('tb-apps');
      box.innerHTML = '';
      const pinned = OS.settings.get('pinned').filter(id => OS.apps[id]);
      const wins = OS.wm.list().filter(w => !w.noTaskbar && !w.opts.dialog);
      const groups = new Map();
      pinned.forEach(id => groups.set(id, []));
      wins.forEach(w => {
        const key = w.app || w.id;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(w);
      });
      for (const [key, ws] of groups) {
        const app = OS.apps[key];
        const icon = app ? app.icon : ws[0].icon;
        const title = ws.length === 1 ? ws[0].title : app ? app.name : ws[0].title;
        const active = ws.some(w => w.focused);
        const btn = U.h('button', {
          class: 'tb-app' + (ws.length ? ' running' : '') + (active ? ' active' : '') + (ws.length > 1 ? ' multi' : ''),
          title, html: OS.icons.tile(icon, 26) + '<span class="tb-dot"></span>',
        });
        btn.onclick = e => {
          closeOverlays();
          if (!ws.length) return OS.launch(key);
          if (ws.length === 1) {
            const w = ws[0];
            if (w.focused && !w.minimized) w.minimize(); else w.focus();
            return;
          }
          const r = btn.getBoundingClientRect();
          const m = OS.menu(r.left, r.top - 8, ws.map(w => ({ label: w.title, icon: w.icon, action: () => w.focus() })));
          const mr = m.getBoundingClientRect();
          m.style.top = Math.max(4, r.top - mr.height - 6) + 'px';
          e.stopPropagation();
        };
        btn.oncontextmenu = e => {
          e.preventDefault();
          const isPinned = pinned.includes(key);
          const items = [];
          if (app) items.push({ label: app.name, icon: app.icon, action: () => OS.launch(key) });
          if (app) items.push({ label: isPinned ? 'Unpin from taskbar' : 'Pin to taskbar', action: () => OS.settings.set('pinned', isPinned ? pinned.filter(p => p !== key) : [...pinned, key]) });
          if (ws.length) items.push('-', { label: ws.length > 1 ? 'Close all windows' : 'Close window', icon: null, action: () => ws.forEach(w => w.close()) });
          const r = btn.getBoundingClientRect();
          const m = OS.menu(r.left, r.top, items);
          m.style.top = Math.max(4, r.top - m.getBoundingClientRect().height - 6) + 'px';
        };
        box.appendChild(btn);
      }
    },
    clock() {
      const now = new Date();
      const opts = { hour: 'numeric', minute: '2-digit', hour12: !OS.settings.get('clock24') };
      if (OS.settings.get('showSeconds')) opts.second = '2-digit';
      $('tb-clock').innerHTML = `<span>${now.toLocaleTimeString(undefined, opts)}</span><small>${now.toLocaleDateString()}</small>`;
    },
  };

  /* ======================= Overlays ======================= */
  const overlays = ['start-menu', 'action-center', 'cal-flyout'];
  function closeOverlays(except) {
    overlays.forEach(id => { if (id !== except) $(id).classList.remove('open'); });
    $('start-btn').classList.toggle('active', except === 'start-menu');
  }
  function overlayOpen() { return overlays.some(id => $(id).classList.contains('open')); }
  function toggleOverlay(id, renderFn) {
    const el = $(id);
    if (el.classList.contains('open')) { closeOverlays(); return; }
    closeOverlays(id);
    renderFn();
    el.classList.add('open');
  }

  /* ---------- Start menu ---------- */
  const Start = {
    toggle() { toggleOverlay('start-menu', () => this.render()); if ($('start-menu').classList.contains('open')) setTimeout(() => $('sm-search').focus(), 50); },
    render(query = '') {
      const sm = $('start-menu');
      sm.innerHTML = '';
      const search = U.h('input', { id: 'sm-search', class: 'input sm-search', placeholder: 'Search apps, games and files…', value: query, autocomplete: 'off' });
      const content = U.h('div', { class: 'sm-content' });
      search.addEventListener('input', () => this.fill(content, search.value.trim()));
      search.addEventListener('keydown', e => {
        if (e.key === 'Enter') { const first = content.querySelector('.sm-tile, .sm-row'); first && first.click(); }
        if (e.key === 'Escape') closeOverlays();
      });
      const u = OS.user;
      const footer = U.h('div', { class: 'sm-footer' },
        U.h('button', { class: 'sm-user', onclick: () => { closeOverlays(); OS.launch('settings', { page: 'account' }); } },
          U.h('span', { class: 'avatar', style: { background: u.color } }, (u.name || u.username)[0].toUpperCase()),
          U.h('span', {}, u.name || u.username)),
        U.h('div', { class: 'sm-power' },
          U.h('button', { class: 'btn icon-btn', title: 'Lock', onclick: () => { closeOverlays(); OS.session.lock(); }, html: '<svg viewBox="0 0 24 24" width="18" height="18"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></g></svg>' }),
          U.h('button', {
            class: 'btn icon-btn', title: 'Power', html: '<svg viewBox="0 0 24 24" width="18" height="18"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v9"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/></g></svg>',
            onclick: e => {
              const r = e.currentTarget.getBoundingClientRect();
              const m = OS.menu(r.left, r.top, [
                { label: 'Lock', action: () => { closeOverlays(); OS.session.lock(); } },
                { label: 'Sign out', action: () => { closeOverlays(); OS.session.logout(); } },
                '-',
                { label: 'Restart', action: () => { closeOverlays(); OS.session.power('restart'); } },
                { label: 'Shut down', action: () => { closeOverlays(); OS.session.power('shutdown'); } },
              ]);
              m.style.top = r.top - m.getBoundingClientRect().height - 4 + 'px';
            },
          })));
      sm.append(search, content, footer);
      this.fill(content, query);
    },
    tile(app) {
      const t = U.h('button', { class: 'sm-tile', title: app.desc || app.name, html: OS.icons.tile(app.icon, 40) + `<span>${U.esc(app.name)}</span>` });
      t.onclick = () => { closeOverlays(); OS.launch(app.id); };
      t.oncontextmenu = e => {
        e.preventDefault();
        const pinned = OS.settings.get('pinned'), desk = OS.settings.get('desktopApps');
        OS.menu(e.clientX, e.clientY, [
          { label: 'Open', icon: app.icon, action: () => { closeOverlays(); OS.launch(app.id); } },
          '-',
          { label: pinned.includes(app.id) ? 'Unpin from taskbar' : 'Pin to taskbar', action: () => OS.settings.set('pinned', pinned.includes(app.id) ? pinned.filter(p => p !== app.id) : [...pinned, app.id]) },
          { label: desk.includes(app.id) ? 'Remove from desktop' : 'Add to desktop', action: () => OS.settings.set('desktopApps', desk.includes(app.id) ? desk.filter(p => p !== app.id) : [...desk, app.id]) },
        ]);
      };
      return t;
    },
    fill(content, q) {
      content.innerHTML = '';
      const apps = Object.values(OS.apps).filter(a => !a.hidden);
      if (q) {
        const ql = q.toLowerCase();
        const found = apps.filter(a => a.name.toLowerCase().includes(ql) || (a.keywords || '').includes(ql) || (a.desc || '').toLowerCase().includes(ql));
        if (found.length) {
          content.append(U.h('div', { class: 'sm-h' }, 'Apps'), U.h('div', { class: 'sm-grid' }, found.map(a => this.tile(a))));
        }
        const files = OS.fs.find(q, '/', 12);
        if (files.length) {
          content.append(U.h('div', { class: 'sm-h' }, 'Files'), U.h('div', { class: 'sm-list' }, files.map(f => U.h('button', {
            class: 'sm-row', html: OS.icons.tile(OS.icons.forFile(f.name, f.isDir), 22) + `<span>${U.esc(f.name)}</span><small>${U.esc(U.dirname(f.path))}</small>`,
            onclick: () => { closeOverlays(); OS.openFile(f.path); },
          }))));
        }
        if (/^[\d\s+\-*/().%^]+$/.test(q) && /\d/.test(q)) {
          try {
            const v = Function('"use strict";return (' + q.replace(/\^/g, '**') + ')')();
            if (typeof v === 'number' && isFinite(v)) content.prepend(U.h('div', { class: 'sm-calc' }, `${q} = `, U.h('b', {}, String(+v.toFixed(10)))));
          } catch { /* ignore */ }
        }
        if (!content.children.length) content.append(U.h('div', { class: 'sm-empty' }, `No results for "${q}"`));
        content.append(U.h('button', { class: 'sm-row web', html: OS.icons.tile('browser', 22) + `<span>Search the web for "${U.esc(q)}"</span>`, onclick: () => { closeOverlays(); OS.launch('browser', { url: 'https://duckduckgo.com/?q=' + encodeURIComponent(q) }); } }));
        return;
      }
      const cats = [['Apps', 'Apps'], ['Games', 'Games'], ['System', 'System']];
      for (const [cat, label] of cats) {
        const list = apps.filter(a => a.category === cat).sort((a, b) => a.name.localeCompare(b.name));
        if (!list.length) continue;
        content.append(U.h('div', { class: 'sm-h' }, label), U.h('div', { class: 'sm-grid' }, list.map(a => this.tile(a))));
      }
    },
  };

  /* ---------- Action center (quick settings + notifications) ---------- */
  const Action = {
    toggle() { toggleOverlay('action-center', () => this.render()); OS.notifications.forEach(n => n.read = true); updateBadge(); },
    render() {
      const ac = $('action-center');
      ac.innerHTML = '';
      const s = OS.settings;
      const toggle = (label, on, fn, icon) => U.h('button', { class: 'qs-tile' + (on ? ' on' : ''), onclick: () => { fn(); this.render(); } }, U.h('span', { class: 'qs-ico', html: icon }), U.h('span', {}, label));
      const fsOn = !!document.fullscreenElement;
      ac.append(
        U.h('div', { class: 'qs-grid' },
          toggle('Dark mode', s.get('theme') === 'dark', () => s.set('theme', s.get('theme') === 'dark' ? 'light' : 'dark'), '◐'),
          toggle('Sounds', s.get('sounds'), () => s.set('sounds', !s.get('sounds')), '♪'),
          toggle('Do not disturb', s.get('dnd'), () => s.set('dnd', !s.get('dnd')), '☾'),
          toggle('Fullscreen', fsOn, () => toggleFullscreen(), '⛶'),
          toggle('Animations', s.get('animations'), () => s.set('animations', !s.get('animations')), '✦'),
          toggle('Transparency', s.get('transparency'), () => s.set('transparency', !s.get('transparency')), '◇')),
        slider('Volume', 'volume', '🔊'),
        slider('Brightness', 'brightness', '☀', 20),
        U.h('div', { class: 'ac-head' }, U.h('b', {}, 'Notifications'),
          OS.notifications.length ? U.h('button', { class: 'btn small', onclick: () => { OS.notifications.length = 0; this.render(); updateBadge(); } }, 'Clear all') : null),
        U.h('div', { class: 'ac-list' }, OS.notifications.length ? OS.notifications.map(n => U.h('div', {
          class: 'ac-note', onclick: () => { closeOverlays(); n.action && n.action(); },
        }, U.h('span', { html: OS.icons.tile(n.icon, 28) }), U.h('div', {}, U.h('b', {}, n.title), U.h('div', {}, n.body), U.h('small', {}, new Date(n.time).toLocaleTimeString())))) : U.h('div', { class: 'ac-empty' }, 'No new notifications')));
      function slider(label, key, icon, min = 0) {
        const inp = U.h('input', { type: 'range', min, max: 100, value: s.get(key) });
        inp.oninput = () => s.set(key, +inp.value);
        return U.h('label', { class: 'qs-slider', title: label }, U.h('span', {}, icon), inp);
      }
    },
  };
  function updateBadge() {
    const n = OS.notifications.filter(x => !x.read).length;
    const b = $('tb-notif-badge');
    b.textContent = n > 9 ? '9+' : n;
    b.style.display = n ? '' : 'none';
  }
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {});
  }

  /* ---------- Calendar flyout ---------- */
  const Cal = {
    month: null,
    toggle() { this.month = new Date(); this.month.setDate(1); toggleOverlay('cal-flyout', () => this.render()); },
    render() {
      const el = $('cal-flyout');
      el.innerHTML = '';
      const now = new Date(), m = this.month;
      const events = OS.data.get('calendar', {});
      const head = U.h('div', { class: 'cf-head' },
        U.h('b', {}, m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })),
        U.h('span', {},
          U.h('button', { class: 'btn icon-btn', onclick: () => { m.setMonth(m.getMonth() - 1); this.render(); } }, '‹'),
          U.h('button', { class: 'btn icon-btn', onclick: () => { m.setMonth(m.getMonth() + 1); this.render(); } }, '›')));
      const grid = U.h('div', { class: 'cf-grid' });
      ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach(d => grid.appendChild(U.h('span', { class: 'cf-dow' }, d)));
      const first = new Date(m.getFullYear(), m.getMonth(), 1).getDay();
      const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      for (let i = 0; i < first; i++) grid.appendChild(U.h('span'));
      for (let d = 1; d <= days; d++) {
        const ymd = `${m.getFullYear()}-${U.pad(m.getMonth() + 1)}-${U.pad(d)}`;
        const isToday = d === now.getDate() && m.getMonth() === now.getMonth() && m.getFullYear() === now.getFullYear();
        grid.appendChild(U.h('button', {
          class: 'cf-day' + (isToday ? ' today' : '') + (events[ymd] && events[ymd].length ? ' has-ev' : ''),
          onclick: () => { closeOverlays(); OS.launch('calendar', { date: ymd }); },
        }, d));
      }
      const todayKey = `${now.getFullYear()}-${U.pad(now.getMonth() + 1)}-${U.pad(now.getDate())}`;
      const todays = events[todayKey] || [];
      el.append(
        U.h('div', { class: 'cf-big' }, U.h('div', { class: 'cf-time' }, now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: !OS.settings.get('clock24') })), U.h('div', {}, now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))),
        head, grid,
        U.h('div', { class: 'cf-events' }, U.h('b', {}, 'Today'), todays.length ? todays.map(ev => U.h('div', { class: 'cf-ev' }, `${ev.time || 'All day'} · ${ev.title}`)) : U.h('div', { class: 'muted' }, 'No events today')));
    },
  };

  /* ======================= Lifecycle ======================= */
  function start() {
    if (!started) {
      started = true;
      Desktop.bindBackground();
      $('start-btn').onclick = e => { e.stopPropagation(); Start.toggle(); };
      $('tb-clock').onclick = e => { e.stopPropagation(); Cal.toggle(); };
      $('tb-notif').onclick = e => { e.stopPropagation(); Action.toggle(); };
      $('tb-desktop').onclick = () => {
        const visible = OS.wm.list().filter(w => !w.minimized);
        if (visible.length) { Taskbar._shown = visible; OS.wm.minimizeAll(); }
        else if (Taskbar._shown) { Taskbar._shown.filter(w => !w.closed).forEach(w => w.focus()); Taskbar._shown = null; }
      };
      document.addEventListener('pointerdown', e => {
        if (!overlayOpen()) return;
        if (e.target.closest('#start-menu, #action-center, #cal-flyout, #start-btn, #tb-clock, #tb-notif, .ctx-menu')) return;
        closeOverlays();
      });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && overlayOpen()) closeOverlays();
        // Ctrl+Space or Alt+Space opens start menu
        if ((e.ctrlKey || e.altKey) && e.code === 'Space' && OS.user && !OS.session.locked) { e.preventDefault(); Start.toggle(); }
      });
      $('desktop-icons').addEventListener('click', () => {});
      window.addEventListener('resize', U.debounce(() => started && OS.user && Desktop.render(), 150));
      setInterval(() => OS.user && Taskbar.clock(), 1000);
    }
    offs.push(
      OS.bus.on('wm:change', () => Taskbar.render()),
      OS.bus.on('fs:change', paths => { if (paths.some(p => p === '/Desktop' || p.startsWith('/Desktop/'))) Desktop.render(); }),
      OS.bus.on('settings:change', k => {
        if (['desktopApps', 'iconPositions', 'iconSize'].includes(k)) Desktop.render();
        if (k === 'pinned') Taskbar.render();
        if (k === 'clock24' || k === 'showSeconds') Taskbar.clock();
        if ($('action-center').classList.contains('open') && ['theme', 'sounds', 'dnd', 'animations', 'transparency'].includes(k)) Action.render();
      }),
      OS.bus.on('notify', () => updateBadge()),
    );
    Desktop.selected = new Set();
    Desktop.render();
    Taskbar.render();
    Taskbar.clock();
    updateBadge();
  }

  function stop() {
    offs.splice(0).forEach(off => off());
    closeOverlays();
    $('desktop-icons').innerHTML = '';
    $('tb-apps').innerHTML = '';
  }

  return { start, stop, Desktop, Taskbar, Start, closeOverlays, overlayOpen, toggleFullscreen };
})();
