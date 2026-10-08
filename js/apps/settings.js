/* Settings — personalization, accounts, sound, apps, backups */
'use strict';

OS.registerApp({
  id: 'settings', name: 'Settings', icon: 'settings', category: 'System', width: 860, height: 600, minWidth: 460, single: true,
  desc: 'Personalize WebOS and manage your account', keywords: 'preferences control panel wallpaper theme password',
  launch(win, args) {
    const S = OS.settings;
    const PAGES = [
      ['personalize', 'Personalization', 'paint'], ['desktop', 'Desktop & taskbar', 'desktop'], ['sound', 'Sound', 'music'],
      ['time', 'Date & time', 'clock'], ['account', 'Account', 'user'], ['apps', 'Default apps', 'store'],
      ['storage', 'Storage & backup', 'drive'], ['about', 'About', 'about'],
    ];
    let page = args.page || 'personalize';
    const nav = U.h('div', { class: 'app-side st-nav' });
    const content = U.h('div', { class: 'st-content' });
    win.body.append(U.h('div', { class: 'app-split' }, nav, content));
    win.onArgs = a => { if (a.page) { page = a.page; render(); } };

    const section = (title, ...kids) => U.h('div', { class: 'st-section' }, title ? U.h('h3', {}, title) : null, ...kids);
    const row = (label, desc, control) => U.h('div', { class: 'st-row' }, U.h('div', {}, U.h('div', {}, label), desc ? U.h('small', { class: 'muted' }, desc) : null), control);
    const toggle = (key, onChange) => {
      const t = U.h('input', { type: 'checkbox', class: 'switch', checked: !!S.get(key) });
      t.onchange = () => { S.set(key, t.checked); onChange && onChange(); };
      return t;
    };
    const select = (key, opts) => {
      const s = U.h('select', { class: 'input', style: { width: 'auto' } }, opts.map(([v, l]) => U.h('option', { value: v, selected: S.get(key) === v }, l)));
      s.onchange = () => S.set(key, s.value);
      return s;
    };

    function renderNav() {
      nav.innerHTML = '';
      const u = OS.user;
      nav.append(U.h('div', { class: 'st-user' }, U.h('span', { class: 'avatar', style: { background: u.color, width: '44px', height: '44px', fontSize: '20px' } }, (u.name || u.username)[0].toUpperCase()),
        U.h('div', {}, U.h('b', {}, u.name), U.h('small', { class: 'muted' }, '@' + u.username))));
      PAGES.forEach(([id, label, icon]) => nav.appendChild(U.h('button', { class: 'st-nav-item' + (page === id ? ' active' : ''), onclick: () => { page = id; render(); }, html: OS.icons.tile(icon, 20) + `<span>${label}</span>` })));
    }

    const pages = {
      personalize() {
        const wp = S.get('wallpaper');
        const accents = ['#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#14b8a6', '#06b6d4', '#64748b'];
        const accentInp = U.h('input', { type: 'color', value: S.get('accent'), title: 'Custom color' });
        accentInp.oninput = () => S.set('accent', accentInp.value);
        const wpGrid = U.h('div', { class: 'st-wps' }, Object.entries(OS.wallpapers).map(([id, w]) =>
          U.h('button', { class: 'st-wp' + (wp.type === 'preset' && wp.value === id ? ' sel' : ''), title: w.name, style: { background: w.css }, onclick: () => { S.set('wallpaper', { type: 'preset', value: id }); render(); } }, U.h('span', {}, w.name))));
        const preview = U.h('div', { class: 'st-preview' }, U.h('div', { class: 'st-preview-win' }), U.h('div', { class: 'st-preview-tb' }));
        preview.style.background = document.getElementById('wallpaper').style.background;
        return [
          U.h('h2', {}, 'Personalization'),
          preview,
          section('Theme',
            U.h('div', { class: 'st-themes' }, ['light', 'dark'].map(t => U.h('button', { class: 'st-theme ' + t + (S.get('theme') === t ? ' sel' : ''), onclick: () => { S.set('theme', t); render(); } }, U.h('div', { class: 'st-theme-prev' }, U.h('i'), U.h('i')), t === 'light' ? 'Light' : 'Dark')))),
          section('Accent color',
            U.h('div', { class: 'st-accents' }, accents.map(c => U.h('button', { class: 'st-accent' + (S.get('accent') === c ? ' sel' : ''), style: { background: c }, onclick: () => { S.set('accent', c); render(); } })), accentInp)),
          section('Wallpaper', wpGrid,
            U.h('div', { class: 'st-btnrow' },
              U.h('button', { class: 'btn', onclick: async () => { const p = await OS.dialog.file({ mode: 'open', start: '/Pictures', exts: U.imageExts, title: 'Choose wallpaper' }); if (p) { S.set('wallpaper', { type: 'image', path: p }); render(); } } }, 'Choose from Pictures…'),
              U.h('button', { class: 'btn', onclick: async () => {
                const [f] = await U.pickHostFiles({ accept: 'image/*', multiple: false });
                if (!f) return;
                const [p] = await OS.fs.importFiles([f], '/Pictures');
                if (p) { S.set('wallpaper', { type: 'image', path: p }); render(); }
              } }, 'Upload image…'))),
          section('Effects',
            row('Transparency effects', 'Blurred glass for the taskbar, menus and panels', toggle('transparency')),
            row('Animations', 'Animate windows, menus and controls', toggle('animations'))),
        ];
      },
      desktop() {
        const apps = Object.values(OS.apps).filter(a => !a.hidden || a.id === 'trash').sort((a, b) => a.name.localeCompare(b.name));
        const pick = key => U.h('div', { class: 'st-appgrid' }, apps.map(a => {
          const on = S.get(key).includes(a.id);
          const cb = U.h('input', { type: 'checkbox', checked: on });
          cb.onchange = () => S.set(key, cb.checked ? [...S.get(key), a.id] : S.get(key).filter(x => x !== a.id));
          return U.h('label', { class: 'st-app' }, cb, U.h('span', { html: OS.icons.tile(a.icon, 20) }), a.name);
        }));
        return [
          U.h('h2', {}, 'Desktop & taskbar'),
          section('Taskbar',
            row('Taskbar alignment', null, select('taskbarAlign', [['center', 'Center'], ['left', 'Left']]))),
          section('Desktop',
            row('Icon size', null, select('iconSize', [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']])),
            row('Arrange icons', 'Reset icon positions to the default grid', U.h('button', { class: 'btn', onclick: () => S.set('iconPositions', {}) }, 'Sort icons')),
            row('Show hidden files', 'Show files starting with a dot in Files', toggle('showHidden'))),
          section('Pinned to taskbar', pick('pinned')),
          section('Desktop shortcuts', pick('desktopApps')),
        ];
      },
      sound() {
        const vol = U.h('input', { type: 'range', min: 0, max: 100, value: S.get('volume') });
        vol.oninput = () => S.set('volume', +vol.value);
        vol.onchange = () => OS.sound.play('notify');
        return [
          U.h('h2', {}, 'Sound'),
          section(null,
            row('System sounds', 'Startup chime, notifications, game effects', toggle('sounds')),
            row('Master volume', 'Applies to system sounds, music and games', vol),
            row('Do not disturb', 'Hide notification pop-ups', toggle('dnd')),
            row('Test sounds', null, U.h('div', { class: 'st-btnrow' }, ['startup', 'notify', 'error', 'win'].map(s => U.h('button', { class: 'btn small', onclick: () => OS.sound.play(s) }, s))))),
        ];
      },
      time() {
        const clock = U.h('div', { class: 'st-bigclock' });
        const upd = () => { clock.textContent = new Date().toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'medium', hour12: !S.get('clock24') }); };
        upd();
        win.timeout(function t() { if (page === 'time') { upd(); win.timeout(t, 1000); } }, 1000);
        return [
          U.h('h2', {}, 'Date & time'),
          clock,
          section(null,
            row('24-hour clock', null, toggle('clock24', upd)),
            row('Show seconds in taskbar', null, toggle('showSeconds')),
            row('Time zone', 'Detected from your browser', U.h('b', {}, Intl.DateTimeFormat().resolvedOptions().timeZone))),
        ];
      },
      account() {
        const u = OS.user;
        const name = U.h('input', { class: 'input', value: u.name, style: { maxWidth: '260px' } });
        name.onchange = () => { if (name.value.trim()) { OS.accounts.update(u.username, { name: name.value.trim() }); renderNav(); } };
        const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#64748b'];
        const p1 = U.h('input', { class: 'input', type: 'password', placeholder: 'Current password' });
        const p2 = U.h('input', { class: 'input', type: 'password', placeholder: 'New password (blank = none)' });
        const p3 = U.h('input', { class: 'input', type: 'password', placeholder: 'Confirm new password' });
        const msg = U.h('small', {});
        return [
          U.h('h2', {}, 'Account'),
          section('Profile',
            row('Display name', null, name),
            row('Avatar color', null, U.h('div', { class: 'st-accents' }, colors.map(c => U.h('button', { class: 'st-accent' + (u.color === c ? ' sel' : ''), style: { background: c }, onclick: () => { OS.accounts.update(u.username, { color: c }); render(); } })))),
            row('Username', 'Used to sign in', U.h('b', {}, u.username))),
          section('Password',
            U.h('div', { class: 'st-form' }, OS.accounts.get(u.username).hash ? p1 : null, p2, p3,
              U.h('button', { class: 'btn primary', onclick: async () => {
                msg.className = 'muted';
                if (OS.accounts.get(u.username).hash && !(await OS.accounts.verify(u.username, p1.value))) { msg.textContent = 'Current password is incorrect.'; msg.style.color = 'var(--danger)'; return; }
                if (p2.value !== p3.value) { msg.textContent = 'New passwords do not match.'; msg.style.color = 'var(--danger)'; return; }
                await OS.accounts.setPassword(u.username, p2.value);
                OS.notify({ title: 'Password updated', body: p2.value ? 'Your new password is active.' : 'Password removed.', icon: 'user' });
                render();
              } }, 'Change password'), msg)),
          section('Session',
            row('Lock screen', null, U.h('button', { class: 'btn', onclick: () => OS.session.lock() }, 'Lock')),
            row('Sign out', 'Other users can sign in from the login screen', U.h('button', { class: 'btn', onclick: () => OS.session.logout() }, 'Sign out')),
            row('Add another account', 'Sign out and choose "New account" on the login screen', U.h('button', { class: 'btn', onclick: () => OS.session.logout() }, 'Switch user'))),
          section('Danger zone',
            row('Delete account', 'Permanently deletes this account and all of its files', U.h('button', { class: 'btn danger', onclick: async () => {
              if (!(await OS.dialog.confirm(`Delete the account "${u.username}" and ALL of its files? This cannot be undone.`, { title: 'Delete account', ok: 'Delete', danger: true }))) return;
              const name2 = u.username;
              await OS.session.logout();
              if (!OS.user) { await OS.accounts.remove(name2); OS.session.showLogin(); }
            } }, 'Delete account'))),
        ];
      },
      apps() {
        const assoc = OS.storage.get('assoc.' + OS.user.username, {});
        const exts = ['txt', 'md', 'html', 'js', 'css', 'json', 'png', 'jpg', 'svg', 'mp3', 'wav', 'mp4', 'pdf'];
        return [
          U.h('h2', {}, 'Default apps'),
          U.h('p', { class: 'muted' }, 'Choose which app opens each type of file.'),
          section(null, exts.map(e => {
            const apps = OS.appsForFile('x.' + e).filter(a => !a.exts.includes('*') || a.id === 'notepad');
            const s = U.h('select', { class: 'input', style: { width: 'auto' } }, U.h('option', { value: '' }, 'Automatic'), apps.map(a => U.h('option', { value: a.id, selected: assoc[e] === a.id }, a.name)));
            s.onchange = () => { if (s.value) assoc[e] = s.value; else delete assoc[e]; OS.storage.set('assoc.' + OS.user.username, assoc); };
            return row('.' + e, null, s);
          })),
          section('Installed apps', U.h('div', { class: 'st-appgrid' }, Object.values(OS.apps).filter(a => !a.hidden).sort((a, b) => a.name.localeCompare(b.name)).map(a =>
            U.h('button', { class: 'st-app', onclick: () => OS.launch(a.id), title: a.desc || '' }, U.h('span', { html: OS.icons.tile(a.icon, 20) }), a.name)))),
        ];
      },
      storage() {
        const fs = OS.fs;
        return [
          U.h('h2', {}, 'Storage & backup'),
          section('Usage', row('Files', 'Everything in your home folder', U.h('b', {}, U.fmtBytes(fs.usage()))),
            row('Trash', null, U.h('button', { class: 'btn', onclick: () => OS.apps.trash.empty() }, 'Empty Trash')),
            row('Task Manager', 'See a breakdown by folder', U.h('button', { class: 'btn', onclick: () => OS.launch('taskmgr') }, 'Open'))),
          section('Backup',
            row('Export backup', 'Download your files, settings and app data as one file', U.h('button', { class: 'btn primary', onclick: exportBackup }, 'Export')),
            row('Restore backup', 'Replace your files and settings with a backup file', U.h('button', { class: 'btn', onclick: importBackup }, 'Restore…'))),
          section('Reset',
            row('Reset settings', 'Restore default appearance and layout (keeps files)', U.h('button', { class: 'btn', onclick: async () => {
              if (!(await OS.dialog.confirm('Reset all settings to default?', { title: 'Reset settings' }))) return;
              OS.storage.remove('settings.' + OS.user.username);
              S.load(); OS.applySettings(); OS.shell.Desktop.render(); OS.shell.Taskbar.render(); render();
            } }, 'Reset')),
            row('Factory reset', 'Erase ALL accounts, files and settings in this browser', U.h('button', { class: 'btn danger', onclick: async () => {
              if (!(await OS.dialog.confirm('Erase everything? All accounts and files in this browser will be permanently deleted.', { title: 'Factory reset', ok: 'Erase everything', danger: true }))) return;
              const users = Object.keys(OS.accounts.all());
              await OS.wm.closeAll(true);
              for (const u of users) await OS.idb.del('fs:' + u);
              OS.storage.keys('').forEach(k => OS.storage.remove(k));
              OS.fs = null;
              location.reload();
            } }, 'Factory reset'))),
        ];
      },
      about() {
        return [
          U.h('h2', {}, 'About'),
          U.h('div', { class: 'st-about' }, U.h('div', { html: OS.icons.tile('logo', 72) }), U.h('div', {}, U.h('h3', {}, `${OS.name} ${OS.version}`), U.h('div', { class: 'muted' }, 'A desktop operating system that runs entirely in your browser.'))),
          section(null,
            row('Apps installed', null, U.h('b', {}, Object.values(OS.apps).filter(a => !a.hidden).length)),
            row('Browser', null, U.h('small', {}, navigator.userAgent)),
            row('Storage', 'Files are stored in IndexedDB; settings in localStorage', U.h('b', {}, U.fmtBytes(OS.fs.usage()))),
            row('Keyboard shortcuts', 'Ctrl+Space: Start menu · Ctrl+S: save · Double-click title: maximize · Drag to screen edges: snap', null)),
        ];
      },
    };

    async function exportBackup() {
      const data = {};
      OS.storage.keys('data.' + OS.user.username + '.').forEach(k => { data[k.slice(('data.' + OS.user.username + '.').length)] = OS.storage.get(k); });
      const backup = { webos: OS.version, user: OS.user.username, date: new Date().toISOString(), settings: S._data, data, assoc: OS.storage.get('assoc.' + OS.user.username, {}), fs: OS.fs.root };
      U.download(`webos-backup-${OS.user.username}-${new Date().toISOString().slice(0, 10)}.json`, new Blob([JSON.stringify(backup)], { type: 'application/json' }));
    }
    async function importBackup() {
      const [f] = await U.pickHostFiles({ accept: '.json,application/json', multiple: false });
      if (!f) return;
      try {
        const b = JSON.parse(await f.text());
        if (!b.webos || !b.fs || b.fs.t !== 'd') throw new Error('This is not a WebOS backup file.');
        if (!(await OS.dialog.confirm(`Restore backup from ${new Date(b.date).toLocaleString()}? Your current files and settings will be replaced.`, { title: 'Restore backup', ok: 'Restore', danger: true }))) return;
        OS.fs.root = b.fs;
        if (!OS.fs.root.c['.Trash']) OS.fs.root.c['.Trash'] = OS.VFS.dir();
        await OS.fs.flush();
        OS.storage.set('settings.' + OS.user.username, b.settings || {});
        Object.entries(b.data || {}).forEach(([k, v]) => OS.data.set(k, v));
        OS.storage.set('assoc.' + OS.user.username, b.assoc || {});
        S.load(); OS.applySettings();
        OS.bus.emit('fs:change', ['/', '/Desktop']);
        OS.shell.Desktop.render(); OS.shell.Taskbar.render();
        OS.notify({ title: 'Backup restored', body: 'Your files and settings have been restored.', icon: 'settings' });
        render();
      } catch (e) { OS.dialog.alert('Restore failed: ' + e.message, { title: 'Restore backup' }); }
    }

    function render() {
      renderNav();
      content.innerHTML = '';
      content.append(...pages[page]().filter(Boolean));
      content.scrollTop = 0;
    }
    win.sub('settings:change', k => { if (k === 'wallpaper' && page === 'personalize') render(); });
    render();
  },
});
