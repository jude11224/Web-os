/* About WebOS / Help */
'use strict';

OS.registerApp({
  id: 'about', name: 'Help & Tips', icon: 'about', category: 'System', width: 620, height: 560, minWidth: 380, single: true,
  desc: 'Getting started with WebOS', keywords: 'about help tips shortcuts version',
  launch(win) {
    const apps = Object.values(OS.apps).filter(a => !a.hidden);
    const tip = (t, d) => U.h('li', {}, U.h('b', {}, t), ' — ', d);
    win.body.append(U.h('div', { class: 'about' },
      U.h('div', { class: 'about-hero' }, U.h('div', { html: OS.icons.tile('logo', 84) }),
        U.h('div', {}, U.h('h1', {}, OS.name), U.h('div', { class: 'muted' }, `Version ${OS.version} · ${apps.filter(a => a.category !== 'Games').length} apps · ${apps.filter(a => a.category === 'Games').length} games`))),
      U.h('h3', {}, 'Getting started'),
      U.h('ul', {},
        tip('Start menu', 'click the ▦ button or press Ctrl+Space. Type to search apps, files, or do quick math.'),
        tip('Windows', 'drag the title bar to move, drag edges to resize, double-click to maximize, drag to the left/right edge to snap.'),
        tip('Desktop', 'right-click for new files and folders, drag icons to arrange them, drop files from your computer to import them.'),
        tip('Files', 'drag & drop between folders, Ctrl+C / Ctrl+X / Ctrl+V, Delete sends to Trash, F2 renames.'),
        tip('Quick settings', 'the bell icon in the taskbar has dark mode, volume, brightness and notifications.'),
        tip('Terminal', 'a real shell: try ls, cd, cat, grep, pipes like "cat file | grep word", or neofetch.'),
        tip('Accounts', 'each account has its own private files, settings and high scores. Add more from the login screen.'),
        tip('Backup', 'Settings → Storage & backup lets you export everything to a file and restore it later.')),
      U.h('h3', {}, 'Everything included'),
      U.h('div', { class: 'about-apps' }, apps.sort((a, b) => a.name.localeCompare(b.name)).map(a => U.h('button', { class: 'about-app', title: a.desc, onclick: () => OS.launch(a.id), html: OS.icons.tile(a.icon, 32) + `<span>${U.esc(a.name)}</span>` }))),
      U.h('p', { class: 'muted', style: { marginTop: '18px', fontSize: '12px' } }, 'All data stays in this browser (IndexedDB + localStorage). Nothing is uploaded anywhere.')));
  },
});
