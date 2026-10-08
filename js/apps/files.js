/* Files — file explorer */
'use strict';

(() => {
  const PLACES = [
    ['/', 'Home', 'drive'], ['/Desktop', 'Desktop', 'desktop'], ['/Documents', 'Documents', 'documents'],
    ['/Pictures', 'Pictures', 'pictures'], ['/Music', 'Music', 'music'], ['/Videos', 'Videos', 'video'],
    ['/Downloads', 'Downloads', 'downloads'], ['/.Trash', 'Trash', 'trash'],
  ];

  function launchFiles(win, args) {
    const fs = OS.fs;
    let cwd = '/', history = [], hidx = -1, sel = new Set(), anchor = null;
    let view = OS.data.get('files.view', 'grid'), query = '';

    const back = U.h('button', { class: 'btn icon-btn', title: 'Back (Alt+←)', onclick: () => goHist(-1) }, '←');
    const fwd = U.h('button', { class: 'btn icon-btn', title: 'Forward (Alt+→)', onclick: () => goHist(1) }, '→');
    const up = U.h('button', { class: 'btn icon-btn', title: 'Up (Backspace)', onclick: () => cwd !== '/' && go(U.dirname(cwd)) }, '↑');
    const crumbs = U.h('div', { class: 'fx-crumbs' });
    const search = U.h('input', { class: 'input fx-search', placeholder: 'Search', type: 'search' });
    const actions = U.h('div', { class: 'toolbar fx-actions' });
    const side = U.h('div', { class: 'app-side fx-side' });
    const main = U.h('div', { class: 'fx-main', tabindex: 0 });
    const status = U.h('div', { class: 'statusbar' });

    win.body.append(
      U.h('div', { class: 'toolbar' }, back, fwd, up, crumbs, search),
      actions,
      U.h('div', { class: 'app-split' }, side, main),
      status);

    search.addEventListener('input', () => { query = search.value.trim(); render(); });

    function go(path, push = true) {
      path = fs.resolve(path);
      if (!fs.isDir(path)) { OS.dialog.alert(`Folder not found: ${path}`); return; }
      cwd = path;
      sel.clear();
      query = '';
      search.value = '';
      if (push) { history = history.slice(0, hidx + 1); history.push(path); hidx = history.length - 1; }
      render();
    }
    function goHist(d) {
      const n = hidx + d;
      if (n < 0 || n >= history.length) return;
      hidx = n;
      go(history[hidx], false);
    }

    function selectedPaths() { return [...sel]; }

    function open(paths) {
      for (const p of paths) {
        if (fs.isDir(p)) { go(p); return; }
        OS.openFile(p);
      }
    }

    function renderSide() {
      side.innerHTML = '';
      for (const [p, label, icon] of PLACES) {
        side.appendChild(U.h('div', {
          class: 'fx-place' + (cwd === p ? ' active' : ''), 'data-drop-path': p,
          html: OS.icons.tile(icon, 20) + `<span>${label}</span>`, onclick: () => go(p),
        }));
      }
      const used = fs.usage();
      side.appendChild(U.h('div', { class: 'fx-usage' },
        U.h('small', {}, 'Storage used'),
        U.h('div', { class: 'meter' }, U.h('i', { style: { width: Math.min(100, used / (50 * 1024 * 1024) * 100) + '%' } })),
        U.h('small', {}, U.fmtBytes(used))));
      bindDrops(side);
    }

    function renderActions() {
      actions.innerHTML = '';
      const inTrash = cwd === '/.Trash';
      if (inTrash) {
        actions.append(
          U.h('button', { class: 'btn', disabled: !sel.size, onclick: () => { selectedPaths().forEach(p => fs.restore(p)); } }, '↺ Restore'),
          U.h('button', { class: 'btn danger', onclick: () => OS.apps.trash.empty() }, 'Empty Trash'));
      } else {
        actions.append(
          U.h('button', { class: 'btn', onclick: () => OS.fileOps.newFolder(cwd) }, '+ Folder'),
          U.h('button', { class: 'btn', onclick: () => OS.fileOps.newFile(cwd).then(p => p && OS.openFile(p)) }, '+ File'),
          U.h('button', { class: 'btn', title: 'Import files from your computer', onclick: async () => { const f = await U.pickHostFiles(); if (f.length) fs.importFiles(f, cwd); } }, '⇪ Upload'),
          U.h('span', { class: 'sep' }),
          U.h('button', { class: 'btn icon-btn', title: 'Cut', disabled: !sel.size, onclick: () => OS.fileOps.cut(selectedPaths()) }, '✂'),
          U.h('button', { class: 'btn icon-btn', title: 'Copy', disabled: !sel.size, onclick: () => OS.fileOps.copy(selectedPaths()) }, '⧉'),
          U.h('button', { class: 'btn icon-btn', title: 'Paste', disabled: !OS.fileOps.clipboard, onclick: () => OS.fileOps.paste(cwd) }, '📋'),
          U.h('button', { class: 'btn icon-btn', title: 'Rename', disabled: sel.size !== 1, onclick: () => OS.fileOps.rename(selectedPaths()[0]) }, '✎'),
          U.h('button', { class: 'btn icon-btn', title: 'Delete', disabled: !sel.size, onclick: () => OS.fileOps.remove(selectedPaths()) }, '🗑'));
      }
      actions.append(U.h('span', { style: { flex: 1 } }),
        U.h('button', { class: 'btn icon-btn' + (view === 'grid' ? ' active' : ''), title: 'Icons', onclick: () => setView('grid') }, '▦'),
        U.h('button', { class: 'btn icon-btn' + (view === 'list' ? ' active' : ''), title: 'Details', onclick: () => setView('list') }, '☰'));
    }
    function setView(v) { view = v; OS.data.set('files.view', v); render(); }

    function renderCrumbs() {
      crumbs.innerHTML = '';
      const parts = cwd.split('/').filter(Boolean);
      const mk = (label, path) => U.h('button', { class: 'crumb', 'data-drop-path': path, onclick: () => go(path) }, label);
      crumbs.append(mk('Home', '/'));
      let acc = '';
      for (const p of parts) {
        acc += '/' + p;
        crumbs.append(U.h('span', { class: 'crumb-sep' }, '›'), mk(p === '.Trash' ? 'Trash' : p, acc));
      }
      crumbs.ondblclick = async e => {
        if (e.target !== crumbs) return;
        const p = await OS.dialog.prompt('Go to folder', cwd, { title: 'Location' });
        if (p) go(fs.resolve(p, cwd));
      };
    }

    function render() {
      if (!fs.isDir(cwd)) cwd = '/';
      win.setTitle((cwd === '/' ? 'Home' : cwd === '/.Trash' ? 'Trash' : U.basename(cwd)) + ' — Files');
      back.disabled = hidx <= 0;
      fwd.disabled = hidx >= history.length - 1;
      up.disabled = cwd === '/';
      renderSide();
      renderActions();
      renderCrumbs();
      main.innerHTML = '';
      main.className = 'fx-main fx-' + view;
      main.dataset.dropPath = cwd;
      let items;
      try {
        items = query ? fs.find(query, cwd) : fs.list(cwd, { hidden: OS.settings.get('showHidden') || cwd === '/.Trash' });
      } catch (e) { main.textContent = e.message; return; }
      [...sel].forEach(p => { if (!fs.exists(p)) sel.delete(p); });
      if (view === 'list') {
        main.appendChild(U.h('div', { class: 'fx-row fx-head' }, U.h('span', {}, 'Name'), U.h('span', {}, cwd === '/.Trash' ? 'Original location' : 'Modified'), U.h('span', {}, 'Type'), U.h('span', {}, 'Size')));
      }
      if (!items.length) main.appendChild(U.h('div', { class: 'empty-state' }, query ? 'No matching files' : cwd === '/.Trash' ? 'Trash is empty' : 'This folder is empty.\nDrag files here from your computer to import them.'));
      for (const it of items) {
        const icon = OS.icons.forFile(it.name, it.isDir);
        const isImg = !it.isDir && U.imageExts.includes(U.ext(it.name)) && it.size < 4e6;
        const thumb = isImg ? `<img src="${fs.read(it.path)}" alt="" loading="lazy">` : OS.icons.tile(icon, view === 'grid' ? 48 : 20);
        const el = view === 'grid'
          ? U.h('div', { class: 'fx-item', draggable: true, html: `<div class="fx-thumb">${thumb}</div><div class="fx-name">${U.esc(it.name)}</div>` })
          : U.h('div', { class: 'fx-row fx-item', draggable: true, html: `<span class="fx-name">${thumb}<span>${U.esc(it.name)}</span></span><span>${cwd === '/.Trash' ? U.esc(it.origin || '') : U.fmtDate(it.mtime)}</span><span>${it.isDir ? 'Folder' : (U.ext(it.name).toUpperCase() || 'File')}</span><span>${it.isDir ? it.count + ' items' : U.fmtBytes(it.size)}</span>` });
        el.dataset.path = it.path;
        if (it.isDir) el.dataset.dropPath = it.path;
        if (sel.has(it.path)) el.classList.add('sel');
        if (OS.fileOps.clipboard && OS.fileOps.clipboard.mode === 'cut' && OS.fileOps.clipboard.paths.includes(it.path)) el.classList.add('cut');
        el.addEventListener('click', e => {
          e.stopPropagation();
          if (e.shiftKey && anchor) {
            const all = items.map(i => i.path);
            const a = all.indexOf(anchor), b = all.indexOf(it.path);
            sel = new Set(all.slice(Math.min(a, b), Math.max(a, b) + 1));
          } else if (e.ctrlKey || e.metaKey) {
            sel.has(it.path) ? sel.delete(it.path) : sel.add(it.path);
            anchor = it.path;
          } else { sel = new Set([it.path]); anchor = it.path; }
          updateSel();
        });
        el.addEventListener('dblclick', () => open([it.path]));
        el.addEventListener('contextmenu', e => {
          e.preventDefault();
          e.stopPropagation();
          if (!sel.has(it.path)) { sel = new Set([it.path]); updateSel(); }
          OS.menu(e.clientX, e.clientY, OS.fileOps.menuItems(selectedPaths(), { onOpen: open, dir: cwd }));
        });
        el.addEventListener('dragstart', e => {
          if (!sel.has(it.path)) { sel = new Set([it.path]); updateSel(); }
          e.dataTransfer.setData('text/webos-paths', JSON.stringify(selectedPaths()));
          e.dataTransfer.effectAllowed = 'move';
        });
        main.appendChild(el);
      }
      bindDrops(main);
      updateStatus();
    }

    function updateSel() {
      main.querySelectorAll('.fx-item').forEach(el => el.classList.toggle('sel', sel.has(el.dataset.path)));
      renderActions();
      updateStatus();
    }
    function updateStatus() {
      const n = main.querySelectorAll('.fx-item').length;
      let s = `${n} item${n === 1 ? '' : 's'}`;
      if (sel.size) {
        const size = [...sel].reduce((a, p) => a + (fs.stat(p) || { size: 0 }).size, 0);
        s += `  •  ${sel.size} selected (${U.fmtBytes(size)})`;
      }
      status.textContent = s;
    }

    // Drag & drop: moving between folders, importing host files
    function bindDrops(root) {
      root.querySelectorAll('[data-drop-path]').forEach(bindDrop);
      if (root.dataset.dropPath) bindDrop(root);
    }
    function bindDrop(el) {
      if (el._dropBound) return;
      el._dropBound = true;
      el.addEventListener('dragover', e => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.add('drop-hover');
        e.dataTransfer.dropEffect = e.dataTransfer.types.includes('text/webos-paths') ? 'move' : 'copy';
      });
      el.addEventListener('dragleave', () => el.classList.remove('drop-hover'));
      el.addEventListener('drop', async e => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove('drop-hover');
        const dest = el.dataset.dropPath;
        const internal = e.dataTransfer.getData('text/webos-paths');
        if (internal) OS.fileOps.moveInto(JSON.parse(internal).filter(p => p !== dest), dest);
        else if (e.dataTransfer.files.length) {
          const added = await fs.importFiles([...e.dataTransfer.files], dest);
          OS.notify({ title: 'Upload complete', body: `${added.length} file(s) imported to ${dest === '/' ? 'Home' : U.basename(dest)}`, icon: 'files' });
        }
      });
    }

    main.addEventListener('click', e => { if (e.target === main) { sel.clear(); updateSel(); } });
    main.addEventListener('contextmenu', e => {
      if (e.target.closest('.fx-item')) return;
      e.preventDefault();
      sel.clear(); updateSel();
      if (cwd === '/.Trash') {
        OS.menu(e.clientX, e.clientY, [{ label: 'Empty Trash', icon: 'trash', action: () => OS.apps.trash.empty() }]);
        return;
      }
      OS.menu(e.clientX, e.clientY, [
        { label: 'New', submenu: [
          { label: 'Folder', icon: 'folder', action: () => OS.fileOps.newFolder(cwd) },
          { label: 'Text Document', icon: 'filetext', action: () => OS.fileOps.newFile(cwd) },
          { label: 'Web Page', icon: 'filecode', action: () => OS.fileOps.newFile(cwd, 'page.html', '<!DOCTYPE html>\n<html>\n<body>\n  <h1>Hello!</h1>\n</body>\n</html>\n') },
        ] },
        { label: 'Paste', shortcut: 'Ctrl+V', disabled: !OS.fileOps.clipboard, action: () => OS.fileOps.paste(cwd) },
        { label: 'Upload files…', icon: 'downloads', action: async () => fs.importFiles(await U.pickHostFiles(), cwd) },
        '-',
        { label: 'View', submenu: [{ label: 'Icons', checked: view === 'grid', action: () => setView('grid') }, { label: 'Details', checked: view === 'list', action: () => setView('list') }] },
        { label: 'Show hidden files', checked: OS.settings.get('showHidden'), action: () => { OS.settings.set('showHidden', !OS.settings.get('showHidden')); render(); } },
        { label: 'Refresh', action: render },
        '-',
        { label: 'Open in Terminal', icon: 'terminal', action: () => OS.launch('terminal', { cwd }) },
        { label: 'Properties', action: () => OS.fileOps.properties(cwd) },
      ]);
    });

    win.onKey(e => {
      if (e.target === search || e.target.tagName === 'INPUT') return;
      const ctrl = e.ctrlKey || e.metaKey;
      const paths = selectedPaths();
      if (e.key === 'Enter' && paths.length) open(paths);
      else if (e.key === 'Delete' && paths.length) OS.fileOps.remove(paths, { permanent: e.shiftKey });
      else if (e.key === 'F2' && paths.length === 1) OS.fileOps.rename(paths[0]);
      else if (e.key === 'Backspace' || (e.altKey && e.key === 'ArrowUp')) { e.preventDefault(); if (cwd !== '/') go(U.dirname(cwd)); }
      else if (e.altKey && e.key === 'ArrowLeft') goHist(-1);
      else if (e.altKey && e.key === 'ArrowRight') goHist(1);
      else if (ctrl && e.key === 'a') { e.preventDefault(); sel = new Set([...main.querySelectorAll('.fx-item')].map(x => x.dataset.path)); updateSel(); }
      else if (ctrl && e.key === 'c' && paths.length) OS.fileOps.copy(paths);
      else if (ctrl && e.key === 'x' && paths.length) OS.fileOps.cut(paths);
      else if (ctrl && e.key === 'v') OS.fileOps.paste(cwd);
      else if (ctrl && e.key === 'f') { e.preventDefault(); search.focus(); }
      else if (e.key === 'F5') { e.preventDefault(); render(); }
    });

    const rerender = U.debounce(render, 30);
    win.sub('fs:change', rerender);
    win.sub('clipboard', rerender);
    win.sub('settings:change', k => k === 'showHidden' && rerender());

    let start = args.path || '/';
    if (fs.isFile(start)) { const f = start; start = U.dirname(f); go(start); sel = new Set([f]); updateSel(); }
    else go(start);
  }

  OS.registerApp({
    id: 'files', name: 'Files', icon: 'files', category: 'System', width: 820, height: 520, minWidth: 420,
    desc: 'Browse and manage your files', keywords: 'explorer finder folder',
    launch: launchFiles,
  });

  OS.registerApp({
    id: 'trash', name: 'Trash', icon: 'trash', category: 'System', width: 760, height: 460, hidden: true,
    launch: (win, args) => launchFiles(win, { path: '/.Trash' }),
    async empty() {
      const n = OS.fs.list('/.Trash', { hidden: true }).length;
      if (!n) return OS.dialog.alert('The Trash is already empty.', { title: 'Trash', icon: 'trash' });
      if (await OS.dialog.confirm(`Permanently delete ${n} item(s) in the Trash?`, { title: 'Empty Trash', ok: 'Empty Trash', danger: true, icon: 'trash' })) {
        OS.fs.emptyTrash();
        OS.sound.play('pop');
      }
    },
  });
})();
