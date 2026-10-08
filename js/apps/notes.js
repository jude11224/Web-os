/* Sticky Notes — quick colorful notes with search and autosave */
'use strict';

OS.registerApp({
  id: 'notes', name: 'Sticky Notes', icon: 'notes', category: 'Apps', width: 760, height: 520, minWidth: 420, single: true,
  desc: 'Quick notes that save automatically', keywords: 'memo todo reminder sticky',
  launch(win) {
    const COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#ddd6fe', '#fed7aa'];
    let notes = OS.data.get('notes', null);
    if (!notes) notes = [{ id: U.uid(), text: 'Welcome to Sticky Notes!\n\n• Notes save automatically\n• Pick a color with the dots\n• Search with the box above', color: COLORS[0], t: Date.now() }];
    let activeId = notes[0] && notes[0].id, q = '';
    const save = U.debounce(() => OS.data.set('notes', notes), 300);

    const search = U.h('input', { class: 'input', placeholder: 'Search notes', type: 'search' });
    const list = U.h('div', { class: 'nt-list' });
    const editor = U.h('div', { class: 'nt-editor' });
    search.oninput = () => { q = search.value.toLowerCase(); renderList(); };
    win.body.append(U.h('div', { class: 'app-split' },
      U.h('div', { class: 'app-side nt-side' }, U.h('div', { class: 'nt-side-h' }, search, U.h('button', { class: 'btn primary icon-btn', title: 'New note (Ctrl+N)', onclick: add }, '+')), list),
      editor));

    function add() {
      const n = { id: U.uid(), text: '', color: COLORS[notes.length % COLORS.length], t: Date.now() };
      notes.unshift(n);
      activeId = n.id;
      q = ''; search.value = '';
      save(); render();
      setTimeout(() => editor.querySelector('textarea').focus(), 0);
    }
    function renderList() {
      list.innerHTML = '';
      const shown = notes.filter(n => !q || n.text.toLowerCase().includes(q));
      if (!shown.length) list.appendChild(U.h('div', { class: 'muted', style: { padding: '16px' } }, 'No notes'));
      shown.forEach(n => {
        const [first, ...rest] = (n.text || 'Empty note').split('\n');
        list.appendChild(U.h('button', { class: 'nt-item' + (n.id === activeId ? ' active' : ''), style: { '--nc': n.color }, onclick: () => { activeId = n.id; render(); } },
          U.h('b', {}, first.slice(0, 40) || 'Empty note'), U.h('small', {}, rest.join(' ').trim().slice(0, 60) || new Date(n.t).toLocaleString())));
      });
    }
    function renderEditor() {
      editor.innerHTML = '';
      const n = notes.find(x => x.id === activeId);
      if (!n) { editor.appendChild(U.h('div', { class: 'empty-state' }, 'Select a note or create a new one.')); return; }
      const ta = U.h('textarea', { class: 'nt-text', placeholder: 'Write something…', spellcheck: true });
      ta.value = n.text;
      ta.oninput = () => { n.text = ta.value; n.t = Date.now(); save(); renderList(); };
      editor.style.setProperty('--nc', n.color);
      editor.append(
        U.h('div', { class: 'nt-bar' },
          COLORS.map(c => U.h('button', { class: 'nt-dot' + (c === n.color ? ' sel' : ''), style: { background: c }, onclick: () => { n.color = c; save(); render(); } })),
          U.h('span', { style: { flex: 1 } }),
          U.h('small', {}, 'Edited ' + new Date(n.t).toLocaleString()),
          U.h('button', { class: 'nt-del', title: 'Save as text file', onclick: async () => { const p = await OS.dialog.file({ mode: 'save', name: (n.text.split('\n')[0] || 'note').slice(0, 30).replace(/[/\\]/g, '') + '.txt' }); if (p) OS.fs.write(p, n.text); } }, '💾'),
          U.h('button', { class: 'nt-del', title: 'Delete note', onclick: async () => { if (!n.text || await OS.dialog.confirm('Delete this note?', { title: 'Sticky Notes', ok: 'Delete', danger: true })) { notes = notes.filter(x => x !== n); activeId = notes[0] && notes[0].id; save(); render(); } } }, '🗑')),
        ta);
    }
    function render() { renderList(); renderEditor(); }
    win.onKey(e => { if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); add(); } });
    win.addCleanup(() => OS.data.set('notes', notes));
    render();
    OS.data.set('notes', notes);
  },
});
