/* Task Manager — running apps, performance graphs and storage */
'use strict';

OS.registerApp({
  id: 'taskmgr', name: 'Task Manager', icon: 'taskmgr', category: 'System', width: 700, height: 500, minWidth: 420, single: true,
  desc: 'See and end running apps, monitor performance', keywords: 'processes performance cpu memory kill',
  launch(win) {
    let tab = 'proc';
    const tabBar = U.h('div', { class: 'tabs' });
    const content = U.h('div', { class: 'tm-content' });
    win.body.append(tabBar, content);
    const fpsHist = new Array(60).fill(0), memHist = new Array(60).fill(0), loadHist = new Array(60).fill(0);
    let frames = 0, lastT = performance.now(), lag = 0;

    // FPS + main-thread lag sampling
    win.loop(() => { frames++; });
    let expected = performance.now() + 100;
    win.interval(() => { const now = performance.now(); lag = Math.max(0, now - expected); expected = now + 100; }, 100);
    win.interval(() => {
      const now = performance.now();
      const fps = Math.round(frames * 1000 / (now - lastT));
      frames = 0; lastT = now;
      fpsHist.push(fps); fpsHist.shift();
      const mem = performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0;
      memHist.push(mem); memHist.shift();
      loadHist.push(Math.min(100, lag)); loadHist.shift();
      if (tab === 'perf') renderPerf();
    }, 1000);

    function renderTabs() {
      tabBar.innerHTML = '';
      [['proc', 'Processes'], ['perf', 'Performance'], ['storage', 'Storage'], ['startup', 'Users']].forEach(([id, l]) =>
        tabBar.appendChild(U.h('button', { class: 'tab' + (tab === id ? ' active' : ''), onclick: () => { tab = id; render(); } }, l)));
    }
    let selected = null;
    function renderProc() {
      content.innerHTML = '';
      const wins = OS.wm.list();
      const table = U.h('div', { class: 'tm-table' },
        U.h('div', { class: 'tm-row tm-head' }, U.h('span', {}, 'Name'), U.h('span', {}, 'PID'), U.h('span', {}, 'Status'), U.h('span', {}, 'DOM nodes')),
        wins.map(w => {
          const row = U.h('div', { class: 'tm-row' + (selected === w.id ? ' sel' : ''), onclick: () => { selected = w.id; renderProc(); }, ondblclick: () => w.focus() },
            U.h('span', { class: 'tm-name', html: OS.icons.tile(w.icon, 18) + `<span>${U.esc(w.title)}</span>` }),
            U.h('span', {}, w.id.slice(-6)),
            U.h('span', {}, w.minimized ? 'Minimized' : w.focused ? 'Active' : 'Running'),
            U.h('span', {}, w.el.getElementsByTagName('*').length));
          row.oncontextmenu = e => { e.preventDefault(); OS.menu(e.clientX, e.clientY, [{ label: 'Switch to', action: () => w.focus() }, { label: 'End task', action: () => w.close(true) }]); };
          return row;
        }));
      content.append(table, U.h('div', { class: 'tm-foot' },
        U.h('span', { class: 'muted' }, `${wins.length} running · uptime ${U.fmtDuration((Date.now() - OS.bootTime) / 1000)}`),
        U.h('button', { class: 'btn', disabled: !selected || !OS.wm.windows.get(selected), onclick: () => { const w = OS.wm.windows.get(selected); w && w.close(true); selected = null; renderProc(); } }, 'End task')));
    }
    function graph(data, max, color, label, value) {
      const cv = U.h('canvas', { class: 'tm-graph', width: 600, height: 120 });
      const c = cv.getContext('2d');
      const css = getComputedStyle(document.documentElement);
      c.strokeStyle = css.getPropertyValue('--border').trim();
      for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(0, i * 30); c.lineTo(600, i * 30); c.stroke(); }
      c.beginPath();
      data.forEach((v, i) => { const x = i * 600 / (data.length - 1), y = 118 - Math.min(1, v / max) * 112; i ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.strokeStyle = color; c.lineWidth = 2; c.stroke();
      c.lineTo(600, 120); c.lineTo(0, 120); c.closePath(); c.fillStyle = color + '33'; c.fill();
      return U.h('div', { class: 'tm-card' }, U.h('div', { class: 'tm-card-h' }, U.h('b', {}, label), U.h('span', {}, value)), cv);
    }
    function renderPerf() {
      content.innerHTML = '';
      const fps = fpsHist[fpsHist.length - 1], mem = memHist[memHist.length - 1];
      content.append(
        graph(fpsHist, 120, '#22c55e', 'Frame rate', fps + ' FPS'),
        graph(loadHist, 100, '#3b82f6', 'Main-thread lag', Math.round(loadHist[loadHist.length - 1]) + ' ms'),
        performance.memory ? graph(memHist, Math.max(...memHist) * 1.3 || 1, '#a855f7', 'JS memory', mem.toFixed(1) + ' MB') : U.h('div', { class: 'tm-card muted' }, 'Memory statistics are not available in this browser.'),
        U.h('div', { class: 'tm-info' },
          U.h('div', {}, U.h('small', { class: 'muted' }, 'Logical processors'), U.h('b', {}, navigator.hardwareConcurrency || '?')),
          U.h('div', {}, U.h('small', { class: 'muted' }, 'Device memory'), U.h('b', {}, navigator.deviceMemory ? navigator.deviceMemory + ' GB' : '?')),
          U.h('div', {}, U.h('small', { class: 'muted' }, 'Screen'), U.h('b', {}, `${screen.width}×${screen.height} @${devicePixelRatio}x`)),
          U.h('div', {}, U.h('small', { class: 'muted' }, 'Network'), U.h('b', {}, navigator.onLine ? 'Online' : 'Offline'))));
    }
    async function renderStorage() {
      content.innerHTML = '';
      const fs = OS.fs;
      const total = fs.usage();
      const folders = fs.list('/', { hidden: true }).filter(s => s.isDir).map(s => ({ name: s.name === '.Trash' ? 'Trash' : s.name, size: s.size, path: s.path })).sort((a, b) => b.size - a.size);
      let quota = null;
      if (navigator.storage && navigator.storage.estimate) { try { quota = await navigator.storage.estimate(); } catch { /* ignore */ } }
      U.append(content,
        U.h('div', { class: 'tm-card' }, U.h('div', { class: 'tm-card-h' }, U.h('b', {}, 'Your files'), U.h('span', {}, U.fmtBytes(total))),
          folders.map(f => U.h('div', { class: 'tm-bar-row', onclick: () => OS.launch('files', { path: f.path }) }, U.h('span', {}, f.name), U.h('div', { class: 'meter' }, U.h('i', { style: { width: (total ? f.size / total * 100 : 0) + '%' } })), U.h('small', {}, U.fmtBytes(f.size))))),
        quota ? U.h('div', { class: 'tm-card' }, U.h('div', { class: 'tm-card-h' }, U.h('b', {}, 'Browser storage'), U.h('span', {}, `${U.fmtBytes(quota.usage || 0)} of ${U.fmtBytes(quota.quota || 0)}`)),
          U.h('div', { class: 'meter' }, U.h('i', { style: { width: Math.min(100, (quota.usage / quota.quota) * 100 || 0) + '%' } }))) : null,
        U.h('div', { class: 'tm-foot' }, U.h('button', { class: 'btn', onclick: () => OS.apps.trash.empty() }, 'Empty Trash')));
    }
    function renderUsers() {
      content.innerHTML = '';
      const users = OS.accounts.all();
      content.append(U.h('div', { class: 'tm-table' },
        U.h('div', { class: 'tm-row tm-head' }, U.h('span', {}, 'User'), U.h('span', {}, 'Username'), U.h('span', {}, 'Status'), U.h('span', {}, 'Created')),
        Object.entries(users).map(([u, d]) => U.h('div', { class: 'tm-row' },
          U.h('span', { class: 'tm-name' }, U.h('span', { class: 'avatar', style: { background: d.color, width: '22px', height: '22px', fontSize: '11px' } }, (d.name || u)[0].toUpperCase()), U.h('span', {}, d.name)),
          U.h('span', {}, u), U.h('span', {}, u === OS.user.username ? 'Signed in' : '—'), U.h('span', {}, new Date(d.created).toLocaleDateString())))));
    }
    function render() {
      renderTabs();
      ({ proc: renderProc, perf: renderPerf, storage: renderStorage, startup: renderUsers })[tab]();
    }
    let sig = '';
    win.sub('wm:change', () => {
      const s2 = OS.wm.list().map(w => w.id + w.title + w.minimized).join('|');
      if (tab === 'proc' && s2 !== sig) { sig = s2; renderProc(); }
    });
    render();
  },
});
