/* Clock — world clock, alarms, stopwatch and timer */
'use strict';

OS.registerApp({
  id: 'clock', name: 'Clock', icon: 'clock', category: 'Apps', width: 560, height: 520, minWidth: 360, minHeight: 400, single: true,
  desc: 'World clock, alarms, stopwatch and timer', keywords: 'time alarm stopwatch timer countdown',
  launch(win, args) {
    const tabs = [['clock', 'Clock'], ['alarm', 'Alarms'], ['stopwatch', 'Stopwatch'], ['timer', 'Timer']];
    let tab = args.tab || 'clock';
    const tabBar = U.h('div', { class: 'tabs' });
    const content = U.h('div', { class: 'clk-content' });
    win.body.append(tabBar, content);
    const state = OS.clockState = OS.clockState || { sw: { running: false, start: 0, acc: 0, laps: [] }, timer: { running: false, end: 0, remain: 300000, total: 300000 } };

    function renderTabs() {
      tabBar.innerHTML = '';
      tabs.forEach(([id, label]) => tabBar.appendChild(U.h('button', { class: 'tab' + (tab === id ? ' active' : ''), onclick: () => { tab = id; render(); } }, label)));
    }
    let tick = null;
    function render() {
      renderTabs();
      content.innerHTML = '';
      tick = null;
      ({ clock: renderClock, alarm: renderAlarms, stopwatch: renderStopwatch, timer: renderTimer })[tab]();
    }
    win.interval(() => tick && tick(), 50);
    win.onArgs = a => { if (a.tab) { tab = a.tab; render(); } };
    win.sub('alarms:change', () => tab === 'alarm' && render());

    /* ----- world clock ----- */
    function renderClock() {
      const cv = U.h('canvas', { class: 'clk-face', width: 440, height: 440 });
      const digital = U.h('div', { class: 'clk-digital' });
      const date = U.h('div', { class: 'muted' });
      const zones = OS.data.get('clock.zones', ['America/New_York', 'Europe/London', 'Asia/Tokyo']);
      const zl = U.h('div', { class: 'clk-zones' });
      content.append(U.h('div', { class: 'clk-main' }, cv, U.h('div', {}, digital, date)), zl);
      const renderZones = () => {
        zl.innerHTML = '';
        zones.forEach((z, i) => {
          let t = '';
          try { t = new Date().toLocaleTimeString(undefined, { timeZone: z, hour: '2-digit', minute: '2-digit', hour12: !OS.settings.get('clock24') }); } catch { t = 'invalid'; }
          zl.appendChild(U.h('div', { class: 'clk-zone' }, U.h('span', {}, z.split('/').pop().replace(/_/g, ' ')), U.h('b', {}, t),
            U.h('button', { class: 'btn small', onclick: () => { zones.splice(i, 1); OS.data.set('clock.zones', zones); renderZones(); } }, '×')));
        });
        zl.appendChild(U.h('button', {
          class: 'btn', onclick: async () => {
            const all = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : [];
            const z = await OS.dialog.prompt('Time zone or city (e.g. Paris, Asia/Kolkata)', '', { title: 'Add world clock' });
            if (!z) return;
            const found = all.find(x => x.toLowerCase() === z.toLowerCase()) || all.find(x => x.toLowerCase().includes(z.toLowerCase().replace(/ /g, '_')));
            const zone = found || z;
            try { new Date().toLocaleTimeString(undefined, { timeZone: zone }); zones.push(zone); OS.data.set('clock.zones', zones); renderZones(); }
            catch { OS.dialog.alert(`Unknown time zone "${z}"`); }
          },
        }, '+ Add city'));
      };
      renderZones();
      const ctx = cv.getContext('2d');
      let lastMin = -1;
      tick = () => {
        const n = new Date();
        digital.textContent = n.toLocaleTimeString(undefined, { hour12: !OS.settings.get('clock24') });
        date.textContent = n.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        if (n.getMinutes() !== lastMin) { lastMin = n.getMinutes(); renderZones(); }
        const css = getComputedStyle(document.documentElement);
        const fg = css.getPropertyValue('--text').trim(), acc = css.getPropertyValue('--accent').trim();
        const R = 200;
        ctx.clearRect(0, 0, 440, 440);
        ctx.save();
        ctx.translate(220, 220);
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fillStyle = css.getPropertyValue('--surface-2').trim(); ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = css.getPropertyValue('--border-strong').trim(); ctx.stroke();
        for (let i = 0; i < 60; i++) {
          ctx.save(); ctx.rotate(i * Math.PI / 30);
          ctx.beginPath(); ctx.moveTo(0, -R + 12); ctx.lineTo(0, -R + (i % 5 ? 20 : 34));
          ctx.lineWidth = i % 5 ? 2 : 5; ctx.strokeStyle = fg; ctx.globalAlpha = i % 5 ? 0.35 : 0.9; ctx.stroke(); ctx.restore();
        }
        ctx.fillStyle = fg; ctx.font = '600 26px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (let h = 1; h <= 12; h++) { const a = h * Math.PI / 6; ctx.fillText(h, Math.sin(a) * (R - 58), -Math.cos(a) * (R - 58)); }
        const ms = n.getMilliseconds(), s = n.getSeconds() + ms / 1000, m = n.getMinutes() + s / 60, hr = (n.getHours() % 12) + m / 60;
        const hand = (ang, len, w, col) => { ctx.save(); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(0, 16); ctx.lineTo(0, -len); ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.stroke(); ctx.restore(); };
        hand(hr * Math.PI / 6, R * 0.5, 10, fg);
        hand(m * Math.PI / 30, R * 0.75, 7, fg);
        hand(s * Math.PI / 30, R * 0.85, 3, acc);
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fillStyle = acc; ctx.fill();
        ctx.restore();
      };
    }

    /* ----- alarms ----- */
    function renderAlarms() {
      const alarms = OS.data.get('alarms', []);
      const save = () => { OS.data.set('alarms', alarms); render(); };
      const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      const listEl = U.h('div', { class: 'clk-alarms' });
      if (!alarms.length) listEl.appendChild(U.h('div', { class: 'empty-state' }, 'No alarms yet.'));
      alarms.forEach((a, i) => {
        const tog = U.h('input', { type: 'checkbox', class: 'switch', checked: a.on });
        tog.onchange = () => { a.on = tog.checked; save(); };
        listEl.appendChild(U.h('div', { class: 'clk-alarm' + (a.on ? '' : ' off') },
          U.h('div', {}, U.h('div', { class: 'clk-alarm-t' }, a.time), U.h('small', { class: 'muted' }, (a.label || 'Alarm') + ' · ' + (a.days && a.days.length ? a.days.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ') : 'Once'))),
          U.h('span', { style: { flex: 1 } }),
          tog,
          U.h('button', { class: 'btn small', onclick: () => { alarms.splice(i, 1); save(); } }, 'Delete')));
      });
      const time = U.h('input', { type: 'time', class: 'input', value: '07:00', style: { width: '130px' } });
      const label = U.h('input', { class: 'input', placeholder: 'Label', style: { width: '160px' } });
      const days = new Set();
      const dayBtns = U.h('div', { class: 'clk-days' }, DAYS.map((d, i) => {
        const b = U.h('button', { class: 'btn small', onclick: () => { days.has(i) ? days.delete(i) : days.add(i); b.classList.toggle('active'); } }, d);
        return b;
      }));
      content.append(listEl,
        U.h('div', { class: 'clk-add' }, U.h('b', {}, 'New alarm'), U.h('div', { class: 'clk-add-row' }, time, label), dayBtns,
          U.h('button', { class: 'btn primary', onclick: () => { if (!time.value) return; alarms.push({ time: time.value, label: label.value, days: [...days].sort(), on: true }); save(); OS.notify({ title: 'Alarm set', body: `${time.value}${label.value ? ' — ' + label.value : ''}`, icon: 'clock' }); } }, 'Add alarm')),
        U.h('p', { class: 'muted', style: { fontSize: '12px', padding: '0 16px' } }, 'Alarms ring while WebOS is open in your browser, even if this app is closed.'));
    }

    /* ----- stopwatch ----- */
    function renderStopwatch() {
      const sw = state.sw;
      const disp = U.h('div', { class: 'clk-big' });
      const laps = U.h('div', { class: 'clk-laps' });
      const startBtn = U.h('button', { class: 'btn primary big' });
      const lapBtn = U.h('button', { class: 'btn big' });
      const elapsed = () => sw.acc + (sw.running ? Date.now() - sw.start : 0);
      const fmt = ms => `${U.pad(Math.floor(ms / 60000))}:${U.pad(Math.floor(ms / 1000) % 60)}.${U.pad(Math.floor(ms / 10) % 100)}`;
      const sync = () => {
        startBtn.textContent = sw.running ? 'Stop' : 'Start';
        startBtn.classList.toggle('danger', sw.running);
        lapBtn.textContent = sw.running ? 'Lap' : 'Reset';
        laps.innerHTML = '';
        sw.laps.slice().reverse().forEach((l, i) => laps.appendChild(U.h('div', { class: 'clk-lap' }, U.h('span', {}, 'Lap ' + (sw.laps.length - i)), U.h('span', {}, fmt(l.split)), U.h('b', {}, fmt(l.total)))));
      };
      startBtn.onclick = () => {
        if (sw.running) { sw.acc += Date.now() - sw.start; sw.running = false; }
        else { sw.start = Date.now(); sw.running = true; }
        sync();
      };
      lapBtn.onclick = () => {
        if (sw.running) { const t = elapsed(); const prev = sw.laps.length ? sw.laps[sw.laps.length - 1].total : 0; sw.laps.push({ total: t, split: t - prev }); }
        else { sw.acc = 0; sw.laps = []; }
        sync();
      };
      content.append(disp, U.h('div', { class: 'clk-btns' }, lapBtn, startBtn), laps);
      sync();
      tick = () => { disp.textContent = fmt(elapsed()); };
    }

    /* ----- timer ----- */
    function renderTimer() {
      const t = state.timer;
      const ring = U.h('div', { class: 'clk-ring' });
      const disp = U.h('div', { class: 'clk-big' });
      const startBtn = U.h('button', { class: 'btn primary big' });
      const resetBtn = U.h('button', { class: 'btn big' }, 'Reset');
      const remain = () => t.running ? Math.max(0, t.end - Date.now()) : t.remain;
      const presets = U.h('div', { class: 'clk-presets' }, [[1, '1 min'], [3, '3 min'], [5, '5 min'], [10, '10 min'], [15, '15 min'], [25, 'Pomodoro'], [60, '1 hour']].map(([m, l]) =>
        U.h('button', { class: 'btn small', onclick: () => { t.running = false; t.remain = t.total = m * 60000; sync(); } }, l)));
      const custom = U.h('input', { class: 'input', type: 'number', min: 1, max: 999, placeholder: 'Minutes', style: { width: '100px' } });
      custom.addEventListener('change', () => { const m = +custom.value; if (m > 0) { t.running = false; t.remain = t.total = m * 60000; sync(); } });
      const sync = () => { startBtn.textContent = t.running ? 'Pause' : 'Start'; };
      startBtn.onclick = () => {
        if (t.running) { t.remain = remain(); t.running = false; }
        else { if (t.remain <= 0) t.remain = t.total; t.end = Date.now() + t.remain; t.running = true; OS.clockTimerWatch(); }
        sync();
      };
      resetBtn.onclick = () => { t.running = false; t.remain = t.total; sync(); };
      content.append(U.h('div', { class: 'clk-timer' }, ring, disp), U.h('div', { class: 'clk-btns' }, resetBtn, startBtn), presets, U.h('div', { class: 'clk-presets' }, custom));
      sync();
      tick = () => {
        const r = remain();
        const s = Math.ceil(r / 1000);
        disp.textContent = `${s >= 3600 ? Math.floor(s / 3600) + ':' : ''}${U.pad(Math.floor(s / 60) % 60)}:${U.pad(s % 60)}`;
        ring.style.setProperty('--p', (r / t.total * 100) + '%');
        if (!t.running) sync();
      };
    }

    render();
  },
});

/* Timer runs in the background even if the Clock window is closed */
OS.clockTimerWatch = () => {
  if (OS._timerWatch) return;
  OS._timerWatch = setInterval(() => {
    const t = OS.clockState && OS.clockState.timer;
    if (!t || !t.running) { clearInterval(OS._timerWatch); OS._timerWatch = null; return; }
    if (Date.now() >= t.end) {
      t.running = false;
      t.remain = 0;
      clearInterval(OS._timerWatch);
      OS._timerWatch = null;
      OS.sound.play('alarm');
      OS.notify({ title: "Time's up!", body: 'Your timer has finished.', icon: 'clock', timeout: 15000, sound: false, action: () => OS.launch('clock', { tab: 'timer' }) });
    }
  }, 250);
};
