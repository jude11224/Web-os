/* Calendar — month view with events and reminders */
'use strict';

OS.registerApp({
  id: 'calendar', name: 'Calendar', icon: 'calendar', category: 'Apps', width: 900, height: 600, minWidth: 460, single: true,
  desc: 'Plan your days with events and reminders', keywords: 'events schedule agenda date',
  launch(win, args) {
    const ymd = d => `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}-${U.pad(d.getDate())}`;
    const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
    let selected = args.date || ymd(new Date());
    let month = parse(selected); month.setDate(1);
    const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#ec4899'];
    const events = () => OS.data.get('calendar', {});
    const saveEvents = e => { OS.data.set('calendar', e); render(); };

    const head = U.h('div', { class: 'toolbar cal-head' });
    const grid = U.h('div', { class: 'cal-grid' });
    const side = U.h('div', { class: 'cal-side' });
    win.body.append(head, U.h('div', { class: 'cal-wrap' }, U.h('div', { class: 'cal-month' }, grid), side));

    function render() {
      head.innerHTML = '';
      head.append(
        U.h('button', { class: 'btn icon-btn', onclick: () => { month.setMonth(month.getMonth() - 1); render(); } }, '‹'),
        U.h('button', { class: 'btn icon-btn', onclick: () => { month.setMonth(month.getMonth() + 1); render(); } }, '›'),
        U.h('button', { class: 'btn', onclick: () => { selected = ymd(new Date()); month = new Date(); month.setDate(1); render(); } }, 'Today'),
        U.h('h2', { class: 'cal-title' }, month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })));
      grid.innerHTML = '';
      const ev = events();
      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(d => grid.appendChild(U.h('div', { class: 'cal-dow' }, d)));
      const first = new Date(month.getFullYear(), month.getMonth(), 1);
      const startDay = new Date(first);
      startDay.setDate(1 - first.getDay());
      const today = ymd(new Date());
      for (let i = 0; i < 42; i++) {
        const d = new Date(startDay);
        d.setDate(startDay.getDate() + i);
        const key = ymd(d);
        const list = ev[key] || [];
        const cell = U.h('div', {
          class: 'cal-cell' + (d.getMonth() !== month.getMonth() ? ' other' : '') + (key === today ? ' today' : '') + (key === selected ? ' sel' : ''),
          onclick: () => { selected = key; if (d.getMonth() !== month.getMonth()) { month = new Date(d); month.setDate(1); } render(); },
          ondblclick: () => { selected = key; render(); setTimeout(() => side.querySelector('input').focus(), 0); },
        }, U.h('span', { class: 'cal-num' }, d.getDate()),
        list.slice(0, 3).map(e => U.h('div', { class: 'cal-chip', style: { background: e.color || COLORS[0] } }, (e.time ? e.time + ' ' : '') + e.title)),
        list.length > 3 ? U.h('div', { class: 'cal-more' }, `+${list.length - 3} more`) : null);
        grid.appendChild(cell);
      }
      renderSide();
    }

    function renderSide() {
      side.innerHTML = '';
      const d = parse(selected);
      const all = events();
      const list = (all[selected] || []).slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      const title = U.h('input', { class: 'input', placeholder: 'Event title' });
      const time = U.h('input', { class: 'input', type: 'time' });
      const note = U.h('textarea', { class: 'input', placeholder: 'Notes (optional)', rows: 2 });
      let color = COLORS[0];
      const colors = U.h('div', { class: 'cal-colors' }, COLORS.map(c => {
        const b = U.h('button', { class: 'cal-color' + (c === color ? ' sel' : ''), style: { background: c } });
        b.onclick = () => { color = c; colors.querySelectorAll('.cal-color').forEach(x => x.classList.toggle('sel', x === b)); };
        return b;
      }));
      const add = () => {
        if (!title.value.trim()) { title.focus(); return; }
        const e = events();
        (e[selected] = e[selected] || []).push({ id: U.uid(), title: title.value.trim(), time: time.value, note: note.value.trim(), color });
        saveEvents(e);
      };
      title.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
      side.append(
        U.h('div', { class: 'cal-day-h' }, U.h('div', { class: 'cal-day-n' }, d.getDate()), U.h('div', {}, U.h('b', {}, d.toLocaleDateString(undefined, { weekday: 'long' })), U.h('div', { class: 'muted' }, d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })))),
        U.h('div', { class: 'cal-events' }, list.length ? list.map(e => U.h('div', { class: 'cal-event', style: { borderLeftColor: e.color } },
          U.h('div', {}, U.h('b', {}, e.title), U.h('div', { class: 'muted' }, e.time || 'All day'), e.note ? U.h('div', { class: 'cal-note' }, e.note) : null),
          U.h('button', { class: 'btn small', title: 'Delete', onclick: () => { const all2 = events(); all2[selected] = (all2[selected] || []).filter(x => x.id !== e.id); if (!all2[selected].length) delete all2[selected]; saveEvents(all2); } }, '×'))) : U.h('div', { class: 'muted', style: { padding: '8px 0' } }, 'No events')),
        U.h('div', { class: 'cal-form' }, U.h('b', {}, 'Add event'), title, time, note, colors, U.h('button', { class: 'btn primary', onclick: add }, 'Add'),
          U.h('small', { class: 'muted' }, 'Events with a time trigger a notification at that time.')));
    }

    win.onKey(e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const d = parse(selected);
      const mv = n => { d.setDate(d.getDate() + n); selected = ymd(d); month = new Date(d); month.setDate(1); render(); };
      if (e.key === 'ArrowLeft') mv(-1); else if (e.key === 'ArrowRight') mv(1);
      else if (e.key === 'ArrowUp') mv(-7); else if (e.key === 'ArrowDown') mv(7);
    });
    win.onArgs = a => { if (a.date) { selected = a.date; month = parse(a.date); month.setDate(1); render(); } };
    render();
  },
});
