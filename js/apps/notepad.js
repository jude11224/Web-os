/* Notepad — plain text & markdown editor */
'use strict';

OS.registerApp({
  id: 'notepad', name: 'Notepad', icon: 'notepad', category: 'Apps', width: 720, height: 500,
  desc: 'Edit text and Markdown files', keywords: 'text editor write markdown',
  exts: ['txt', 'md', 'log', 'csv', 'ini', 'cfg', 'json', 'xml', 'yml', 'yaml', 'toml', '*'],
  launch(win, args) {
    const fs = OS.fs;
    let path = null, dirty = false, wrap = OS.data.get('notepad.wrap', true), size = OS.data.get('notepad.size', 15), preview = false;

    const ta = U.h('textarea', { class: 'np-text', spellcheck: false, placeholder: 'Start typing…' });
    const prev = U.h('div', { class: 'np-preview md', hidden: true });
    const status = U.h('div', { class: 'statusbar' });
    const findBar = U.h('div', { class: 'toolbar np-find', hidden: true });
    const findInp = U.h('input', { class: 'input', placeholder: 'Find' });
    const replInp = U.h('input', { class: 'input', placeholder: 'Replace with' });
    const findInfo = U.h('small', { class: 'muted' });
    findBar.append(findInp, replInp,
      U.h('button', { class: 'btn', onclick: () => find(1) }, 'Next'),
      U.h('button', { class: 'btn', onclick: () => find(-1) }, 'Prev'),
      U.h('button', { class: 'btn', onclick: () => replace(false) }, 'Replace'),
      U.h('button', { class: 'btn', onclick: () => replace(true) }, 'All'),
      findInfo,
      U.h('button', { class: 'btn icon-btn', style: { marginLeft: 'auto' }, onclick: () => { findBar.hidden = true; ta.focus(); } }, '✕'));

    const isMd = () => path && ['md', 'markdown'].includes(U.ext(path));
    const menubar = OS.ui.menubar([
      { label: 'File', items: () => [
        { label: 'New', shortcut: 'Ctrl+N', action: newDoc },
        { label: 'New window', action: () => OS.launch('notepad') },
        { label: 'Open…', shortcut: 'Ctrl+O', action: openDoc },
        { label: 'Save', shortcut: 'Ctrl+S', action: save },
        { label: 'Save as…', shortcut: 'Ctrl+Shift+S', action: saveAs },
        '-',
        { label: 'Download to computer', disabled: false, action: () => U.download(path ? U.basename(path) : 'untitled.txt', ta.value) },
        { label: 'Print', action: printDoc },
        '-',
        { label: 'Close', action: () => win.close() },
      ] },
      { label: 'Edit', items: () => [
        { label: 'Undo', shortcut: 'Ctrl+Z', action: () => { ta.focus(); document.execCommand('undo'); } },
        { label: 'Redo', shortcut: 'Ctrl+Y', action: () => { ta.focus(); document.execCommand('redo'); } },
        '-',
        { label: 'Find & replace', shortcut: 'Ctrl+F', action: showFind },
        { label: 'Select all', shortcut: 'Ctrl+A', action: () => { ta.focus(); ta.select(); } },
        { label: 'Insert time/date', shortcut: 'F5', action: insertDate },
        '-',
        { label: 'UPPERCASE selection', action: () => transform(s => s.toUpperCase()) },
        { label: 'lowercase selection', action: () => transform(s => s.toLowerCase()) },
        { label: 'Sort lines', action: () => { ta.value = ta.value.split('\n').sort((a, b) => a.localeCompare(b)).join('\n'); changed(); } },
      ] },
      { label: 'View', items: () => [
        { label: 'Word wrap', checked: wrap, action: () => { wrap = !wrap; OS.data.set('notepad.wrap', wrap); applyView(); } },
        { label: 'Zoom in', shortcut: 'Ctrl++', action: () => zoom(1) },
        { label: 'Zoom out', shortcut: 'Ctrl+-', action: () => zoom(-1) },
        { label: 'Reset zoom', action: () => { size = 15; applyView(); } },
        '-',
        { label: 'Markdown preview', checked: preview, action: togglePreview },
      ] },
    ]);
    const prevBtn = U.h('button', { class: 'btn small', onclick: togglePreview, style: { marginLeft: 'auto', marginRight: '8px' } }, 'Preview');
    menubar.appendChild(prevBtn);

    win.body.append(menubar, findBar, U.h('div', { class: 'np-wrap' }, ta, prev), status);

    function applyView() {
      ta.style.whiteSpace = wrap ? 'pre-wrap' : 'pre';
      ta.style.overflowX = wrap ? 'hidden' : 'auto';
      ta.style.fontSize = size + 'px';
      prev.style.fontSize = size + 'px';
      OS.data.set('notepad.size', size);
      prevBtn.style.display = isMd() ? '' : 'none';
    }
    function zoom(d) { size = U.clamp(size + d, 9, 40); applyView(); }
    function togglePreview() {
      preview = !preview;
      prev.hidden = !preview;
      ta.hidden = preview;
      prevBtn.classList.toggle('active', preview);
      if (preview) prev.innerHTML = U.markdown(ta.value);
      else ta.focus();
    }
    function title() {
      win.setTitle((dirty ? '• ' : '') + (path ? U.basename(path) : 'Untitled') + ' — Notepad');
    }
    function updateStatus() {
      const before = ta.value.slice(0, ta.selectionStart);
      const line = before.split('\n').length, col = before.length - before.lastIndexOf('\n');
      const words = (ta.value.match(/\S+/g) || []).length;
      status.textContent = `Ln ${line}, Col ${col}   •   ${ta.value.length} characters   •   ${words} words   •   ${path || 'Not saved'}`;
    }
    function changed() { if (!dirty) { dirty = true; title(); } updateStatus(); }
    function load(p) {
      try {
        ta.value = fs.read(p);
        path = fs.resolve(p);
        dirty = false;
        title(); updateStatus(); applyView();
        if (preview) prev.innerHTML = U.markdown(ta.value);
        if (isMd() && !preview && ta.value.length) togglePreview();
      } catch (e) { OS.dialog.alert(e.message); }
    }
    async function confirmDiscard() {
      if (!dirty) return true;
      const r = await OS.dialog.ask(`Do you want to save changes to ${path ? U.basename(path) : 'Untitled'}?`, { title: 'Notepad', yes: 'Save', no: "Don't save" });
      if (r === 'yes') return await save();
      return r === 'no';
    }
    async function newDoc() { if (!(await confirmDiscard())) return; path = null; ta.value = ''; dirty = false; title(); updateStatus(); applyView(); }
    async function openDoc() {
      if (!(await confirmDiscard())) return;
      const p = await OS.dialog.file({ mode: 'open', start: path ? U.dirname(path) : '/Documents' });
      if (p) load(p);
    }
    async function save() {
      if (!path) return saveAs();
      try { fs.write(path, ta.value); dirty = false; title(); updateStatus(); return true; }
      catch (e) { OS.dialog.alert(e.message); return false; }
    }
    async function saveAs() {
      const p = await OS.dialog.file({ mode: 'save', start: path ? U.dirname(path) : '/Documents', name: path ? U.basename(path) : 'Untitled.txt' });
      if (!p) return false;
      path = p;
      const ok = await save();
      applyView();
      return ok;
    }
    function insertDate() {
      ta.focus();
      document.execCommand('insertText', false, new Date().toLocaleString());
    }
    function transform(fn) {
      const s = ta.selectionStart, e = ta.selectionEnd;
      if (s === e) return;
      ta.focus();
      document.execCommand('insertText', false, fn(ta.value.slice(s, e)));
      ta.setSelectionRange(s, e);
    }
    function printDoc() {
      const w = window.open('', '_blank');
      if (!w) return OS.dialog.alert('Allow pop-ups to print.');
      w.document.write(`<title>${U.esc(path ? U.basename(path) : 'Untitled')}</title><pre style="white-space:pre-wrap;font:13px monospace">${U.esc(ta.value)}</pre>`);
      w.document.close();
      w.print();
    }
    function showFind() {
      findBar.hidden = false;
      const s = ta.value.slice(ta.selectionStart, ta.selectionEnd);
      if (s && !s.includes('\n')) findInp.value = s;
      findInp.focus(); findInp.select();
    }
    function find(dir) {
      const q = findInp.value;
      if (!q) return;
      const text = ta.value.toLowerCase(), ql = q.toLowerCase();
      let idx = dir > 0 ? text.indexOf(ql, ta.selectionEnd) : text.lastIndexOf(ql, ta.selectionStart - 1);
      if (idx < 0) idx = dir > 0 ? text.indexOf(ql) : text.lastIndexOf(ql);
      const count = text.split(ql).length - 1;
      findInfo.textContent = count ? `${count} match${count > 1 ? 'es' : ''}` : 'No matches';
      if (idx < 0) return;
      ta.focus();
      ta.setSelectionRange(idx, idx + q.length);
      const lineH = size * 1.5;
      ta.scrollTop = Math.max(0, (ta.value.slice(0, idx).split('\n').length - 3) * lineH);
      findInp.focus();
    }
    function replace(all) {
      const q = findInp.value;
      if (!q) return;
      if (all) {
        const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const n = (ta.value.match(re) || []).length;
        ta.focus(); ta.select();
        document.execCommand('insertText', false, ta.value.replace(re, replInp.value));
        findInfo.textContent = `Replaced ${n}`;
      } else {
        const selText = ta.value.slice(ta.selectionStart, ta.selectionEnd);
        if (selText.toLowerCase() === q.toLowerCase()) { ta.focus(); document.execCommand('insertText', false, replInp.value); }
        find(1);
      }
    }

    ta.addEventListener('input', changed);
    ['keyup', 'click', 'select'].forEach(ev => ta.addEventListener(ev, updateStatus));
    ta.addEventListener('keydown', e => {
      if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '  '); }
    });
    findInp.addEventListener('keydown', e => { if (e.key === 'Enter') find(e.shiftKey ? -1 : 1); if (e.key === 'Escape') { findBar.hidden = true; ta.focus(); } });
    win.onKey(e => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 's') { e.preventDefault(); e.shiftKey ? saveAs() : save(); }
      else if (ctrl && e.key === 'o') { e.preventDefault(); openDoc(); }
      else if (ctrl && e.key === 'n') { e.preventDefault(); newDoc(); }
      else if (ctrl && (e.key === 'f' || e.key === 'h')) { e.preventDefault(); showFind(); }
      else if (ctrl && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoom(1); }
      else if (ctrl && e.key === '-') { e.preventDefault(); zoom(-1); }
      else if (e.key === 'F5') { e.preventDefault(); insertDate(); }
    });
    win.beforeClose = confirmDiscard;
    win.onFocus = () => setTimeout(() => { if (!findBar.contains(document.activeElement) && !preview) ta.focus(); }, 0);

    if (args.path) load(args.path);
    else { title(); updateStatus(); applyView(); }
    if (args.text) { ta.value = args.text; changed(); }
    setTimeout(() => ta.focus(), 50);
  },
});
