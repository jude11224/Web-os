/* WebOS system services: app registry, launching, file associations, settings, notifications, menus, dialogs */
'use strict';

/* ---------- Settings (per user) ---------- */
OS.settings = {
  defaults: {
    theme: 'dark', accent: '#3b82f6', wallpaper: { type: 'preset', value: 'aurora' },
    clock24: false, showSeconds: false, sounds: true, volume: 70, brightness: 100,
    animations: true, transparency: true, taskbarAlign: 'center', dnd: false,
    desktopApps: ['files', 'browser', 'terminal', 'notepad', 'code', 'settings', 'snake', 'tetris', 'minesweeper', 'solitaire'],
    pinned: ['files', 'browser', 'notepad', 'terminal', 'music', 'settings'],
    iconPositions: {}, showHidden: false, iconSize: 'medium',
  },
  _data: {},
  load() {
    this._data = Object.assign({}, JSON.parse(JSON.stringify(this.defaults)), OS.storage.get('settings.' + OS.user.username, {}));
  },
  get(k) { return this._data[k] ?? this.defaults[k]; },
  set(k, v) {
    this._data[k] = v;
    OS.storage.set('settings.' + OS.user.username, this._data);
    OS.bus.emit('settings:change', k, v);
    OS.applySettings(k);
  },
};

OS.wallpapers = {
  aurora: { name: 'Aurora', css: 'radial-gradient(ellipse at 20% 0%, #2dd4bf55 0%, transparent 55%), radial-gradient(ellipse at 80% 20%, #a855f777 0%, transparent 50%), radial-gradient(ellipse at 50% 100%, #3b82f666 0%, transparent 60%), linear-gradient(160deg, #0f172a, #1e1b4b 50%, #0c4a6e)' },
  sunset: { name: 'Sunset', css: 'radial-gradient(circle at 70% 65%, #ffd28a 0%, #ff8a65 12%, transparent 35%), linear-gradient(180deg, #2b1055 0%, #7597de 30%, #ff9a8b 60%, #ff6a88 75%, #3a1c71 100%)' },
  ocean: { name: 'Ocean', css: 'radial-gradient(ellipse at top, #38bdf8aa, transparent 60%), linear-gradient(180deg, #0369a1 0%, #0c4a6e 50%, #082f49 100%)' },
  forest: { name: 'Forest', css: 'radial-gradient(ellipse at 30% 10%, #bef26455, transparent 50%), linear-gradient(170deg, #14532d, #052e16 60%, #022c22)' },
  candy: { name: 'Candy', css: 'radial-gradient(circle at 15% 85%, #f472b6aa, transparent 40%), radial-gradient(circle at 85% 15%, #60a5faaa, transparent 45%), linear-gradient(135deg, #fbcfe8, #c4b5fd 50%, #a5f3fc)' },
  midnight: { name: 'Midnight', css: 'radial-gradient(1px 1px at 20% 30%, #fff, transparent), radial-gradient(1px 1px at 70% 20%, #fff, transparent), radial-gradient(1.5px 1.5px at 40% 70%, #fff, transparent), radial-gradient(1px 1px at 85% 60%, #fff, transparent), radial-gradient(1px 1px at 10% 80%, #fff, transparent), radial-gradient(1.5px 1.5px at 55% 45%, #fff, transparent), radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%)' },
  ember: { name: 'Ember', css: 'radial-gradient(ellipse at bottom, #f97316aa, transparent 60%), linear-gradient(180deg, #1c1917, #431407 70%, #7c2d12)' },
  mint: { name: 'Mint', css: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 40%, #6ee7b7 70%, #34d399 100%)' },
  slate: { name: 'Slate', css: 'linear-gradient(135deg, #334155, #1e293b 60%, #0f172a)' },
  bloom: { name: 'Bloom', css: 'conic-gradient(from 200deg at 60% 40%, #6366f1, #ec4899, #f59e0b, #10b981, #6366f1)' },
  classic: { name: 'Classic', css: 'darkslategrey' },
  waves: { name: 'Waves', css: 'repeating-radial-gradient(circle at 0 100%, #1e3a8a 0 40px, #1e40af 40px 80px, #1d4ed8 80px 120px)' },
};

OS.applySettings = (key) => {
  const s = OS.settings, root = document.documentElement;
  if (!key || key === 'theme') root.dataset.theme = s.get('theme');
  if (!key || key === 'accent') {
    root.style.setProperty('--accent', s.get('accent'));
  }
  if (!key || key === 'wallpaper') {
    const wp = s.get('wallpaper'), el = document.getElementById('wallpaper');
    if (wp.type === 'image') {
      let src = wp.value;
      if (wp.path && OS.fs && OS.fs.isFile(wp.path)) src = OS.fs.read(wp.path);
      el.style.background = `center / cover no-repeat url("${src}")`;
    } else el.style.background = (OS.wallpapers[wp.value] || OS.wallpapers.aurora).css;
  }
  if (!key || key === 'animations') root.classList.toggle('no-anim', !s.get('animations'));
  if (!key || key === 'transparency') root.classList.toggle('no-glass', !s.get('transparency'));
  if (!key || key === 'brightness') document.getElementById('shell').style.filter = s.get('brightness') < 100 ? `brightness(${s.get('brightness') / 100})` : '';
  if (!key || key === 'taskbarAlign') root.dataset.tbalign = s.get('taskbarAlign');
  if (!key || key === 'iconSize') root.dataset.iconsize = s.get('iconSize');
};

/* ---------- App registry & launching ---------- */
OS.registerApp = def => {
  OS.apps[def.id] = Object.assign({ category: 'Apps', width: 720, height: 480, icon: def.id }, def);
};

OS.launch = (id, args = {}) => {
  const app = OS.apps[id];
  if (!app) { OS.dialog.alert(`App "${id}" not found.`); return null; }
  if (app.single) {
    const ex = OS.wm.byApp(id)[0];
    if (ex) { ex.focus(); ex.onArgs && ex.onArgs(args); return ex; }
  }
  const win = OS.wm.create({
    title: app.name, icon: app.icon, app: id, width: app.width, height: app.height,
    minWidth: app.minWidth, minHeight: app.minHeight, resizable: app.resizable, className: 'app-' + id,
  });
  try {
    app.launch(win, args || {});
  } catch (e) {
    console.error(e);
    win.body.innerHTML = `<div class="app-error"><h3>${U.esc(app.name)} crashed</h3><pre>${U.esc(e.stack || e.message)}</pre></div>`;
  }
  OS.bus.emit('app:launch', id);
  return win;
};

/** Apps able to open a given file */
OS.appsForFile = path => {
  const e = U.ext(path);
  return Object.values(OS.apps).filter(a => a.exts && (a.exts.includes(e) || a.exts.includes('*')));
};

OS.openFile = (path, appId) => {
  const fs = OS.fs;
  path = fs.resolve(path);
  if (fs.isDir(path)) return OS.launch('files', { path });
  if (!fs.exists(path)) { OS.dialog.alert(`File not found: ${path}`); return; }
  if (U.ext(path) === 'lnk') {
    const target = fs.read(path).trim();
    if (target.startsWith('app:')) return OS.launch(target.slice(4));
    return OS.openFile(target);
  }
  if (appId) return OS.launch(appId, { path });
  const defaults = OS.storage.get('assoc.' + OS.user.username, {});
  const e = U.ext(path);
  if (defaults[e] && OS.apps[defaults[e]]) return OS.launch(defaults[e], { path });
  const builtin = U.imageExts.includes(e) ? 'photos' : U.audioExts.includes(e) ? 'music' : U.videoExts.includes(e) ? 'video'
    : e === 'pdf' ? 'browser' : ['txt', 'md', 'log', 'csv'].includes(e) ? 'notepad' : null;
  if (builtin && OS.apps[builtin]) return OS.launch(builtin, { path });
  const candidates = OS.appsForFile(path).filter(a => !a.exts.includes('*'));
  if (candidates.length) return OS.launch(candidates[0].id, { path });
  // Unknown type: text-ish -> notepad, otherwise ask
  const data = fs.read(path);
  if (!data.startsWith('data:')) return OS.launch('notepad', { path });
  OS.dialog.alert(`No app can open "${U.basename(path)}". You can download it from the Files app.`, { title: 'Open file' });
};

/* ---------- Notifications ---------- */
OS.notifications = [];
OS.notify = ({ title = 'Notification', body = '', icon = 'about', action = null, timeout = 5000, sound = true } = {}) => {
  const n = { id: U.uid(), title, body, icon, action, time: Date.now(), read: false };
  OS.notifications.unshift(n);
  if (OS.notifications.length > 50) OS.notifications.pop();
  OS.bus.emit('notify', n);
  const dnd = OS.settings._data && OS.settings.get('dnd');
  if (dnd) return n;
  if (sound) OS.sound.play('notify');
  const box = document.getElementById('toasts');
  const t = U.h('div', { class: 'toast' },
    U.h('div', { class: 'toast-icon', html: OS.icons.tile(icon, 32) }),
    U.h('div', { class: 'toast-text' }, U.h('b', {}, title), body ? U.h('div', {}, body) : null),
    U.h('button', { class: 'toast-x', title: 'Dismiss', html: '&times;', onclick: e => { e.stopPropagation(); close(); } }));
  const close = () => { t.classList.add('out'); setTimeout(() => t.remove(), 250); };
  t.onclick = () => { action && action(); n.read = true; close(); };
  box.appendChild(t);
  if (timeout) setTimeout(close, timeout);
  return n;
};

/* ---------- Context menus ---------- */
OS.menu = (() => {
  let current = null;
  const closeAll = () => { document.querySelectorAll('.ctx-menu').forEach(m => m.remove()); current = null; };
  const build = (items, x, y, parent) => {
    const m = U.h('div', { class: 'ctx-menu', role: 'menu' });
    for (const it of items) {
      if (!it) continue;
      if (it === '-' || it.sep) { m.appendChild(U.h('div', { class: 'ctx-sep' })); continue; }
      const row = U.h('div', { class: 'ctx-item' + (it.disabled ? ' disabled' : '') + (it.submenu ? ' has-sub' : ''), role: 'menuitem' },
        U.h('span', { class: 'ctx-ico', html: it.icon ? (OS.icons.has(it.icon) ? OS.icons.tile(it.icon, 16) : it.icon) : (it.checked ? '✓' : '') }),
        U.h('span', { class: 'ctx-label' }, it.label),
        it.shortcut ? U.h('span', { class: 'ctx-sc' }, it.shortcut) : null,
        it.submenu ? U.h('span', { class: 'ctx-arrow' }, '›') : null);
      if (!it.disabled) {
        if (it.submenu) {
          let sub = null;
          row.addEventListener('pointerenter', () => {
            m.querySelectorAll(':scope > .ctx-item .ctx-menu').forEach(s => s.remove());
            m.querySelectorAll('.sub-open').forEach(s => s.classList.remove('sub-open'));
            const r = row.getBoundingClientRect();
            sub = build(typeof it.submenu === 'function' ? it.submenu() : it.submenu, r.right - 4, r.top - 4, m);
            row.classList.add('sub-open');
          });
          row.addEventListener('click', e => e.stopPropagation());
        } else {
          row.addEventListener('pointerenter', () => {
            m.querySelectorAll('.ctx-menu').forEach(s => s.remove());
            m.querySelectorAll('.sub-open').forEach(s => s.classList.remove('sub-open'));
          });
          row.addEventListener('click', e => { e.stopPropagation(); closeAll(); it.action && it.action(); });
        }
      }
      m.appendChild(row);
    }
    document.getElementById('menus').appendChild(m);
    const W = window.innerWidth, H = window.innerHeight, mr = m.getBoundingClientRect();
    let left = x, top = y;
    if (left + mr.width > W - 4) left = parent ? parent.getBoundingClientRect().left - mr.width + 4 : W - mr.width - 4;
    if (top + mr.height > H - 4) top = Math.max(4, H - mr.height - 4);
    m.style.left = Math.max(4, left) + 'px';
    m.style.top = top + 'px';
    return m;
  };
  document.addEventListener('pointerdown', e => { if (!e.target.closest('.ctx-menu')) closeAll(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
  window.addEventListener('blur', closeAll);
  const fn = (x, y, items) => { closeAll(); current = build(items, x, y); return current; };
  fn.close = closeAll;
  fn.isOpen = () => !!document.querySelector('.ctx-menu');
  return fn;
})();

/* ---------- Dialogs (all return Promises) ---------- */
OS.dialog = (() => {
  const base = (title, icon, build, { width = 380, height = 'auto' } = {}) => new Promise(resolve => {
    const win = OS.wm.create({ title, icon, width, height: 200, dialog: true, resizable: false, noTaskbar: false, className: 'dlg' });
    let done = false;
    const finish = v => { if (done) return; done = true; resolve(v); win.close(true); };
    win.beforeClose = () => { if (!done) { done = true; resolve(null); } return true; };
    build(win, finish);
    // size to content
    requestAnimationFrame(() => {
      win.el.style.height = 'auto';
      if (height !== 'auto') win.el.style.height = height + 'px';
      win.center();
      const f = win.body.querySelector('input,textarea,select,button.primary');
      f && f.focus();
      if (f && f.select) f.select();
    });
  });

  const buttons = (finish, list) => U.h('div', { class: 'dlg-buttons' },
    list.map(([label, val, primary]) => U.h('button', { class: 'btn' + (primary ? ' primary' : ''), onclick: () => finish(typeof val === 'function' ? val() : val) }, label)));

  return {
    alert(msg, { title = 'Message', icon = 'about' } = {}) {
      return base(title, icon, (win, finish) => {
        win.body.append(U.h('div', { class: 'dlg-msg' }, msg), buttons(finish, [['OK', true, true]]));
        win.onKey(e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); finish(true); } });
      });
    },
    confirm(msg, { title = 'Confirm', icon = 'about', ok = 'OK', cancel = 'Cancel', danger = false } = {}) {
      return base(title, icon, (win, finish) => {
        win.body.append(U.h('div', { class: 'dlg-msg' }, msg), buttons(finish, [[cancel, false], [ok, true, true]]));
        if (danger) win.body.querySelector('.primary').classList.add('danger');
        win.onKey(e => { if (e.key === 'Escape') finish(false); if (e.key === 'Enter') { e.preventDefault(); finish(true); } });
      }).then(v => !!v);
    },
    /** Three-way: resolves 'yes' | 'no' | null(cancel) */
    ask(msg, { title = 'Question', yes = 'Yes', no = 'No', cancel = 'Cancel' } = {}) {
      return base(title, 'about', (win, finish) => {
        win.body.append(U.h('div', { class: 'dlg-msg' }, msg), buttons(finish, [[cancel, null], [no, 'no'], [yes, 'yes', true]]));
        win.onKey(e => { if (e.key === 'Escape') finish(null); });
      });
    },
    prompt(msg, def = '', { title = 'Input', icon = 'about', type = 'text', placeholder = '' } = {}) {
      return base(title, icon, (win, finish) => {
        const inp = U.h('input', { class: 'input', type, value: def, placeholder });
        win.body.append(U.h('div', { class: 'dlg-msg' }, U.h('label', {}, msg), inp),
          buttons(finish, [['Cancel', null], ['OK', () => inp.value, true]]));
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') finish(inp.value); if (e.key === 'Escape') finish(null); });
        setTimeout(() => {
          inp.focus();
          const dot = def.lastIndexOf('.');
          dot > 0 ? inp.setSelectionRange(0, dot) : inp.select();
        }, 50);
      });
    },
    /** File picker. mode 'open' | 'save' | 'folder'. Returns path or null */
    file({ mode = 'open', title, start = '/Documents', name = '', exts = null } = {}) {
      const fs = OS.fs;
      if (!fs.isDir(start)) start = '/';
      return base(title || (mode === 'save' ? 'Save As' : mode === 'folder' ? 'Choose Folder' : 'Open'), 'files', (win, finish) => {
        let cwd = start, selected = null;
        const pathEl = U.h('div', { class: 'fp-path' });
        const list = U.h('div', { class: 'fp-list' });
        const nameInp = U.h('input', { class: 'input', value: name, placeholder: 'File name' });
        const places = ['/', '/Desktop', '/Documents', '/Pictures', '/Music', '/Videos', '/Downloads'];
        const side = U.h('div', { class: 'fp-side' }, places.map(p => U.h('div', {
          class: 'fp-place', onclick: () => go(p),
          html: OS.icons.tile(p === '/' ? 'drive' : OS.icons.forFile(U.basename(p), true), 18) + `<span>${p === '/' ? 'Home' : U.basename(p)}</span>`,
        })));
        const go = p => { cwd = p; selected = null; render(); };
        const okPath = () => {
          if (mode === 'folder') return selected && fs.isDir(selected) ? selected : cwd;
          if (mode === 'open') return selected && fs.isFile(selected) ? selected : null;
          const nm = nameInp.value.trim();
          if (!nm || !OS.VFS.validName(nm)) return null;
          return U.join(cwd, nm);
        };
        const submit = async () => {
          if (mode === 'open' && selected && fs.isDir(selected)) return go(selected);
          const p = okPath();
          if (!p) { OS.sound.play('error'); return; }
          if (mode === 'save' && fs.exists(p)) {
            if (fs.isDir(p)) return go(p);
            if (!(await OS.dialog.confirm(`"${U.basename(p)}" already exists. Replace it?`, { title: 'Confirm Save As', ok: 'Replace' }))) return;
          }
          finish(p);
        };
        const render = () => {
          pathEl.innerHTML = '';
          U.append(pathEl, U.h('button', { class: 'btn icon-btn', title: 'Up', onclick: () => go(U.dirname(cwd)), disabled: cwd === '/' }, '↑'),
            U.h('span', {}, cwd === '/' ? 'Home' : cwd),
            mode !== 'open' ? U.h('button', {
              class: 'btn', style: { marginLeft: 'auto' }, onclick: async () => {
                const n = await OS.dialog.prompt('Folder name', 'New folder', { title: 'New Folder' });
                if (n) { try { fs.mkdir(U.join(cwd, n)); render(); } catch (e) { OS.dialog.alert(e.message); } }
              },
            }, '+ Folder') : null);
          list.innerHTML = '';
          let items = [];
          try { items = fs.list(cwd); } catch { /* ignore */ }
          if (exts && mode !== 'folder') items = items.filter(i => i.isDir || exts.includes(U.ext(i.name)));
          if (mode === 'folder') items = items.filter(i => i.isDir);
          if (!items.length) list.appendChild(U.h('div', { class: 'fp-empty' }, 'Empty folder'));
          for (const it of items) {
            const row = U.h('div', {
              class: 'fp-item' + (selected === it.path ? ' sel' : ''),
              html: OS.icons.tile(OS.icons.forFile(it.name, it.isDir), 20) + `<span>${U.esc(it.name)}</span><small>${it.isDir ? '' : U.fmtBytes(it.size)}</small>`,
            });
            row.onclick = () => { selected = it.path; if (!it.isDir) nameInp.value = it.name; render(); };
            row.ondblclick = () => { if (it.isDir) go(it.path); else { selected = it.path; submit(); } };
            list.appendChild(row);
          }
        };
        nameInp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
        U.append(win.body, U.h('div', { class: 'fp' }, side, U.h('div', { class: 'fp-main' }, pathEl, list)),
          mode === 'save' ? U.h('div', { class: 'fp-name' }, U.h('label', {}, 'Name'), nameInp) : null,
          buttons(finish, [['Cancel', null], [mode === 'save' ? 'Save' : mode === 'folder' ? 'Select' : 'Open', null, true]]));
        win.body.querySelector('.dlg-buttons .primary').onclick = submit;
        win.onKey(e => { if (e.key === 'Escape') finish(null); });
        render();
      }, { width: 600, height: mode === 'save' ? 460 : 420 });
    },
  };
})();

/* ---------- Background services (alarms / reminders) ---------- */
OS.services = {
  start() {
    this.stop();
    this._t = setInterval(() => this.tick(), 1000);
  },
  stop() { clearInterval(this._t); },
  tick() {
    if (!OS.user) return;
    const now = new Date();
    if (now.getSeconds() !== 0) return;
    const hm = U.pad(now.getHours()) + ':' + U.pad(now.getMinutes());
    const alarms = OS.data.get('alarms', []);
    let changed = false;
    for (const a of alarms) {
      if (!a.on || a.time !== hm) continue;
      const day = now.getDay();
      if (a.days && a.days.length && !a.days.includes(day)) continue;
      OS.sound.play('alarm');
      OS.notify({ title: 'Alarm', body: `${a.label || 'Alarm'} — ${hm}`, icon: 'clock', timeout: 15000, sound: false, action: () => OS.launch('clock', { tab: 'alarm' }) });
      if (!a.days || !a.days.length) { a.on = false; changed = true; }
    }
    if (changed) { OS.data.set('alarms', alarms); OS.bus.emit('alarms:change'); }
    // Calendar reminders at event time
    const ymd = `${now.getFullYear()}-${U.pad(now.getMonth() + 1)}-${U.pad(now.getDate())}`;
    const events = OS.data.get('calendar', {})[ymd] || [];
    for (const ev of events) if (ev.time === hm) OS.notify({ title: 'Event: ' + ev.title, body: ev.time + (ev.note ? ' — ' + ev.note : ''), icon: 'calendar', timeout: 12000, action: () => OS.launch('calendar', { date: ymd }) });
  },
};

/* ---------- Reusable UI widgets ---------- */
OS.ui = {
  /** Menu bar: [{label, items: () => menuItems | menuItems}] */
  menubar(menus) {
    const bar = U.h('div', { class: 'menubar' });
    let openIdx = -1;
    const openAt = (i, btn) => {
      const r = btn.getBoundingClientRect();
      const m = menus[i];
      OS.menu(r.left, r.bottom + 2, typeof m.items === 'function' ? m.items() : m.items);
      openIdx = i;
      bar.querySelectorAll('.mb-item').forEach((b, k) => b.classList.toggle('open', k === i));
      const watch = setInterval(() => { if (!OS.menu.isOpen()) { clearInterval(watch); openIdx = -1; bar.querySelectorAll('.mb-item').forEach(b => b.classList.remove('open')); } }, 100);
    };
    menus.forEach((m, i) => {
      const b = U.h('button', { class: 'mb-item' }, m.label);
      b.addEventListener('pointerdown', e => { e.stopPropagation(); if (openIdx === i) { OS.menu.close(); openIdx = -1; } else openAt(i, b); });
      b.addEventListener('pointerenter', () => { if (openIdx !== -1 && openIdx !== i) openAt(i, b); });
      bar.appendChild(b);
    });
    return bar;
  },
  /** Generic overlay message for games: returns {show(title, text, btnLabel, onClick), hide()} */
  overlay(parent) {
    const el = U.h('div', { class: 'game-overlay', hidden: true });
    parent.appendChild(el);
    return {
      el,
      show(title, text, buttons = []) {
        el.innerHTML = '';
        el.append(U.h('div', { class: 'go-box' }, U.h('h2', {}, title), text ? U.h('p', {}, text) : null,
          U.h('div', { class: 'go-btns' }, buttons.map(([label, fn, primary]) => U.h('button', { class: 'btn' + (primary !== false ? ' primary' : ''), onclick: fn }, label)))));
        el.hidden = false;
        const b = el.querySelector('button');
        b && setTimeout(() => b.focus(), 30);
      },
      hide() { el.hidden = true; },
      get visible() { return !el.hidden; },
    };
  },
  /** High score helpers (per user) */
  best(game, score, lowerIsBetter = false) {
    const key = 'best.' + game;
    const cur = OS.data.get(key, null);
    if (score == null) return cur;
    if (cur == null || (lowerIsBetter ? score < cur : score > cur)) { OS.data.set(key, score); return score; }
    return cur;
  },
};

/** Game scaffold: bar + stage + crisp canvas scaled to fit. Returns helpers. */
OS.ui.game = (win, { w, h, bar = [] } = {}) => {
  const scoreEl = U.h('span', { class: 'gb-score' });
  const bestEl = U.h('span', { class: 'gb-best' });
  const barEl = U.h('div', { class: 'game-bar' }, scoreEl, bestEl, U.h('span', { style: { flex: 1 } }), ...bar);
  const stage = U.h('div', { class: 'game-stage' });
  const root = U.h('div', { class: 'game' }, barEl, stage);
  win.body.appendChild(root);
  const overlay = OS.ui.overlay(stage);
  const g = { root, bar: barEl, stage, overlay, scoreEl, bestEl, w, h, scale: 1 };
  if (w && h) {
    const canvas = U.h('canvas', { class: 'game-canvas' });
    const ctx = canvas.getContext('2d');
    stage.insertBefore(canvas, overlay.el);
    g.canvas = canvas;
    g.ctx = ctx;
    g.fit = () => {
      const W = stage.clientWidth - 16, H = stage.clientHeight - 16;
      if (W <= 0 || H <= 0) return;
      const s = Math.max(0.1, Math.min(W / w, H / h));
      const dpr = window.devicePixelRatio || 1;
      g.scale = s;
      canvas.style.width = Math.floor(w * s) + 'px';
      canvas.style.height = Math.floor(h * s) + 'px';
      canvas.width = Math.floor(w * s * dpr);
      canvas.height = Math.floor(h * s * dpr);
      ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
      g.onFit && g.onFit();
    };
    /** pointer position in logical coordinates */
    g.pos = e => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width * w, y: (e.clientY - r.top) / r.height * h };
    };
    win.onResize(g.fit);
    requestAnimationFrame(g.fit);
  }
  g.setScore = (label, best) => { scoreEl.textContent = label; bestEl.textContent = best != null ? best : ''; };
  /** Swipe detection on an element: cb('up'|'down'|'left'|'right') */
  g.swipe = (el, cb) => {
    let sx, sy;
    el.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchend', e => {
      if (sx == null) return;
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 24) cb(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      sx = null;
    }, { passive: true });
  };
  return g;
};
