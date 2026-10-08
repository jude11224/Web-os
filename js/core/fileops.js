/* Shared file operations used by the desktop, Files app and others */
'use strict';

OS.fileOps = {
  clipboard: null, // { mode: 'copy'|'cut', paths: [] }

  copy(paths) { this.clipboard = { mode: 'copy', paths: [...paths] }; OS.bus.emit('clipboard'); },
  cut(paths) { this.clipboard = { mode: 'cut', paths: [...paths] }; OS.bus.emit('clipboard'); },

  paste(dir) {
    const cb = this.clipboard, fs = OS.fs;
    if (!cb) return;
    const errors = [];
    for (const p of cb.paths) {
      try {
        if (!fs.exists(p)) continue;
        if (cb.mode === 'cut') {
          if (U.dirname(p) === dir) continue;
          fs.move(p, U.join(dir, fs.uniqueName(dir, U.basename(p))));
        } else {
          fs.copy(p, U.join(dir, fs.uniqueName(dir, U.basename(p))));
        }
      } catch (e) { errors.push(e.message); }
    }
    if (cb.mode === 'cut') this.clipboard = null;
    OS.bus.emit('clipboard');
    if (errors.length) OS.dialog.alert(errors.join('\n'), { title: 'Paste' });
  },

  /** Move paths into a folder; dropping into the trash trashes them */
  moveInto(paths, dest) {
    const fs = OS.fs, errors = [];
    for (const p of paths) {
      try {
        if (p === dest || U.dirname(p) === dest) continue;
        if (dest === '/.Trash') fs.trash(p);
        else {
          fs.move(p, U.join(dest, fs.uniqueName(dest, U.basename(p))));
          const n = fs.node(U.join(dest, U.basename(p)));
          if (n) delete n.o;
        }
      } catch (e) { errors.push(e.message); }
    }
    if (errors.length) OS.dialog.alert(errors.join('\n'), { title: 'Move' });
  },

  async remove(paths, { permanent = false } = {}) {
    const fs = OS.fs;
    if (!paths.length) return;
    const inTrash = paths.every(p => p.startsWith('/.Trash/'));
    if (permanent || inTrash) {
      const ok = await OS.dialog.confirm(`Permanently delete ${paths.length === 1 ? '"' + U.basename(paths[0]) + '"' : paths.length + ' items'}? This cannot be undone.`, { title: 'Delete', ok: 'Delete', danger: true, icon: 'trash' });
      if (!ok) return;
      paths.forEach(p => { try { fs.remove(p); } catch (e) { console.warn(e); } });
    } else {
      paths.forEach(p => { try { fs.trash(p); } catch (e) { OS.dialog.alert(e.message); } });
    }
  },

  async rename(path) {
    const fs = OS.fs;
    const name = await OS.dialog.prompt('New name', U.basename(path), { title: 'Rename', icon: OS.icons.forFile(U.basename(path), fs.isDir(path)) });
    if (!name || name === U.basename(path)) return null;
    try { return fs.rename(path, name.trim()); } catch (e) { OS.dialog.alert(e.message, { title: 'Rename' }); return null; }
  },

  async newFolder(dir) {
    const fs = OS.fs;
    const name = await OS.dialog.prompt('Folder name', fs.uniqueName(dir, 'New folder'), { title: 'New Folder', icon: 'folder' });
    if (!name) return null;
    try { return fs.mkdir(U.join(dir, name.trim())); } catch (e) { OS.dialog.alert(e.message); return null; }
  },

  async newFile(dir, def = 'New text document.txt', content = '') {
    const fs = OS.fs;
    const name = await OS.dialog.prompt('File name', fs.uniqueName(dir, def), { title: 'New File', icon: 'filetext' });
    if (!name) return null;
    try {
      const p = U.join(dir, name.trim());
      if (fs.exists(p)) throw new Error('A file with that name already exists');
      return fs.write(p, content);
    } catch (e) { OS.dialog.alert(e.message); return null; }
  },

  download(path) {
    const fs = OS.fs;
    if (fs.isDir(path)) {
      // Export folder as a JSON bundle
      const node = fs.node(path);
      U.download(U.basename(path) + '.webos.json', new Blob([JSON.stringify(node)], { type: 'application/json' }));
      return;
    }
    U.download(U.basename(path), fs.read(path));
  },

  properties(path) {
    const fs = OS.fs, st = fs.stat(path);
    if (!st) return;
    const win = OS.wm.create({ title: st.name + ' Properties', icon: OS.icons.forFile(st.name, st.isDir), width: 360, height: 330, resizable: false, dialog: true });
    const row = (k, v) => U.h('tr', {}, U.h('td', {}, k), U.h('td', {}, v));
    win.body.append(U.h('div', { class: 'props' },
      U.h('div', { class: 'props-head', html: OS.icons.tile(OS.icons.forFile(st.name, st.isDir), 48) + `<b>${U.esc(st.name)}</b>` }),
      U.h('table', {},
        row('Type', st.isDir ? 'Folder' : (U.ext(st.name).toUpperCase() || 'Unknown') + ' file'),
        row('Location', U.dirname(st.path)),
        row('Size', U.fmtBytes(st.size) + (st.isDir ? ` (${st.count} items)` : '')),
        row('Modified', U.fmtDate(st.mtime)),
        st.origin ? row('Original location', st.origin) : null,
        !st.isDir ? row('Opens with', (OS.appsForFile(path).filter(a => !a.exts.includes('*'))[0] || { name: 'Notepad' }).name) : null),
      U.h('div', { class: 'dlg-buttons' }, U.h('button', { class: 'btn primary', onclick: () => win.close() }, 'OK'))));
  },

  /** Context menu items for a selection of paths */
  menuItems(paths, { onOpen, dir } = {}) {
    const fs = OS.fs;
    const one = paths.length === 1 ? paths[0] : null;
    const isDir = one && fs.isDir(one);
    const inTrash = paths.every(p => p.startsWith('/.Trash/'));
    if (inTrash) {
      return [
        { label: 'Restore', icon: 'files', action: () => paths.forEach(p => { try { fs.restore(p); } catch (e) { OS.dialog.alert(e.message); } }) },
        '-',
        { label: 'Delete permanently', icon: 'trash', action: () => this.remove(paths, { permanent: true }) },
        one ? { label: 'Properties', action: () => this.properties(one) } : null,
      ];
    }
    const openWith = one && !isDir ? OS.appsForFile(one).map(a => ({ label: a.name, icon: a.icon, action: () => OS.openFile(one, a.id) })) : [];
    return [
      { label: 'Open', icon: isDir ? 'folder' : null, action: () => (onOpen ? onOpen(paths) : paths.forEach(p => OS.openFile(p))) },
      openWith.length ? { label: 'Open with', submenu: openWith } : null,
      one && !isDir && U.imageExts.includes(U.ext(one)) ? { label: 'Set as wallpaper', icon: 'photos', action: () => OS.settings.set('wallpaper', { type: 'image', path: one }) } : null,
      '-',
      { label: 'Cut', shortcut: 'Ctrl+X', action: () => this.cut(paths) },
      { label: 'Copy', shortcut: 'Ctrl+C', action: () => this.copy(paths) },
      isDir && this.clipboard ? { label: 'Paste into folder', action: () => this.paste(one) } : null,
      '-',
      one ? { label: 'Rename', shortcut: 'F2', action: () => this.rename(one) } : null,
      { label: 'Delete', shortcut: 'Del', icon: 'trash', action: () => this.remove(paths) },
      '-',
      one ? { label: isDir ? 'Export folder' : 'Download', icon: 'downloads', action: () => this.download(one) } : null,
      one && !isDir && dir !== '/Desktop' ? { label: 'Create shortcut on Desktop', action: () => fs.write(U.join('/Desktop', fs.uniqueName('/Desktop', U.stripExt(U.basename(one)) + '.lnk')), one) } : null,
      one ? { label: 'Properties', action: () => this.properties(one) } : null,
    ];
  },
};
