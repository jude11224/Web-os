/* Browser — tabbed web browser (iframe based) that can also open local files */
'use strict';

(() => {
  const SEARCH = q => 'https://www.google.com/search?igu=1&q=' + encodeURIComponent(q);
  const WEB_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-presentation';
  const QUICK = [
    ['Wikipedia', 'https://en.wikipedia.org/wiki/Main_Page', '#64748b'],
    ['Google', 'https://www.google.com/webhp?igu=1', '#3b82f6'],
    ['OpenStreetMap', 'https://www.openstreetmap.org/export/embed.html?bbox=-0.2,51.45,0.05,51.56&layer=mapnik', '#22c55e'],
    ['Wiktionary', 'https://en.wiktionary.org/wiki/Wiktionary:Main_Page', '#a855f7'],
    ['Example', 'https://example.com', '#f59e0b'],
    ['MDN Docs', 'https://developer.mozilla.org/en-US/', '#0ea5e9'],
  ];

  OS.registerApp({
    id: 'browser', name: 'Browser', icon: 'browser', category: 'Apps', width: 1000, height: 640, minWidth: 420,
    desc: 'Browse the web and open local HTML/PDF files', keywords: 'internet web chrome firefox edge',
    exts: ['html', 'htm', 'pdf', 'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'txt', 'mp4', 'webm', 'mp3'],
    launch(win, args) {
      const fs = OS.fs;
      const tabs = [];
      let active = null;
      const bookmarks = () => OS.data.get('browser.bookmarks', []);

      const tabBar = U.h('div', { class: 'br-tabs' });
      const newTabBtn = U.h('button', { class: 'br-newtab', title: 'New tab (Ctrl+T)', onclick: () => addTab('webos://home') }, '+');
      const backBtn = U.h('button', { class: 'btn icon-btn', title: 'Back', onclick: () => nav(-1) }, '←');
      const fwdBtn = U.h('button', { class: 'btn icon-btn', title: 'Forward', onclick: () => nav(1) }, '→');
      const reloadBtn = U.h('button', { class: 'btn icon-btn', title: 'Reload (F5)', onclick: () => active && load(active, active.url, false) }, '↻');
      const homeBtn = U.h('button', { class: 'btn icon-btn', title: 'Home', onclick: () => active && go('webos://home') }, '⌂');
      const url = U.h('input', { class: 'input br-url', placeholder: 'Search Google or type a URL', spellcheck: false });
      const star = U.h('button', { class: 'btn icon-btn', title: 'Bookmark this page', onclick: toggleBookmark }, '☆');
      const ext = U.h('button', { class: 'btn icon-btn', title: 'Open in a real browser tab', onclick: () => active && /^https?:/.test(active.url) && window.open(active.url, '_blank', 'noopener') }, '↗');
      const bmBar = U.h('div', { class: 'br-bookmarks' });
      const hint = U.h('div', { class: 'br-hint', hidden: true });
      const views = U.h('div', { class: 'br-views' });

      tabBar.appendChild(newTabBtn);
      win.body.append(tabBar, U.h('div', { class: 'toolbar br-nav' }, backBtn, fwdBtn, reloadBtn, homeBtn, url, star, ext), bmBar, hint, views);

      url.addEventListener('focus', () => url.select());
      url.addEventListener('keydown', e => { if (e.key === 'Enter') { go(url.value.trim()); url.blur(); } });

      function normalize(input) {
        if (!input) return 'webos://home';
        if (/^(webos|file|blob|data):/.test(input)) return input;
        if (input.startsWith('/') && fs.exists(input)) return 'file://' + input;
        if (/^https?:\/\//i.test(input)) return input;
        if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(input) || /^localhost(:\d+)?/.test(input)) return 'https://' + input;
        return SEARCH(input);
      }

      function addTab(u, activate = true) {
        const frame = U.h('iframe', { class: 'br-frame', sandbox: WEB_SANDBOX, allow: 'fullscreen; autoplay; clipboard-write; encrypted-media; picture-in-picture', referrerpolicy: 'no-referrer' });
        const homeEl = U.h('div', { class: 'br-home', hidden: true });
        const view = U.h('div', { class: 'br-view' }, frame, homeEl);
        const tabEl = U.h('div', { class: 'br-tab' });
        const tab = { url: '', title: 'New Tab', hist: [], hpos: -1, frame, homeEl, view, tabEl, blob: null, loading: false };
        tabEl.onclick = () => select(tab);
        tabEl.onauxclick = e => { if (e.button === 1) closeTab(tab); };
        tabs.push(tab);
        tabBar.insertBefore(tabEl, newTabBtn);
        views.appendChild(view);
        frame.addEventListener('load', () => {
          tab.loading = false;
          try { const t = frame.contentDocument && frame.contentDocument.title; if (t) tab.title = t; } catch { /* cross-origin */ }
          renderTab(tab);
          if (tab === active) updateChrome();
        });
        load(tab, normalize(u));
        if (activate) select(tab);
        return tab;
      }
      function renderTab(tab) {
        tab.tabEl.innerHTML = '';
        tab.tabEl.className = 'br-tab' + (tab === active ? ' active' : '');
        tab.tabEl.title = tab.url;
        tab.tabEl.append(
          U.h('span', { class: 'br-fav' + (tab.loading ? ' loading' : ''), html: tab.url.startsWith('webos:') ? OS.icons.tile('logo', 14) : tab.url.startsWith('file:') ? OS.icons.tile(OS.icons.forFile(tab.url), 14) : OS.icons.tile('browser', 14) }),
          U.h('span', { class: 'br-tab-t' }, tab.title || tab.url),
          U.h('button', { class: 'br-tab-x', title: 'Close tab', onclick: e => { e.stopPropagation(); closeTab(tab); } }, '×'));
      }
      function select(tab) {
        active = tab;
        tabs.forEach(t => { t.view.hidden = t !== tab; renderTab(t); });
        updateChrome();
      }
      function closeTab(tab) {
        const i = tabs.indexOf(tab);
        tabs.splice(i, 1);
        tab.tabEl.remove();
        tab.view.remove();
        if (tab.blob) URL.revokeObjectURL(tab.blob);
        if (!tabs.length) { win.close(); return; }
        if (active === tab) select(tabs[Math.min(i, tabs.length - 1)]);
      }
      function go(input) {
        if (!active) addTab(input);
        else load(active, normalize(input));
      }
      function nav(d) {
        const t = active;
        if (!t) return;
        const n = t.hpos + d;
        if (n < 0 || n >= t.hist.length) return;
        t.hpos = n;
        load(t, t.hist[n], false);
      }
      function load(tab, u, push = true) {
        if (push) { tab.hist = tab.hist.slice(0, tab.hpos + 1); tab.hist.push(u); tab.hpos = tab.hist.length - 1; }
        tab.url = u;
        if (tab.blob) { URL.revokeObjectURL(tab.blob); tab.blob = null; }
        if (u === 'webos://home') {
          tab.title = 'New Tab';
          tab.frame.hidden = true;
          tab.homeEl.hidden = false;
          tab.frame.removeAttribute('src');
          renderHome(tab);
        } else {
          tab.frame.hidden = false;
          tab.homeEl.hidden = true;
          tab.loading = true;
          if (u.startsWith('file://')) {
            const p = u.slice(7);
            tab.title = U.basename(p);
            try {
              const data = fs.read(p);
              const e = U.ext(p);
              // Local content never gets same-origin access to WebOS itself (PDF viewers can't run sandboxed)
              if (e === 'pdf') tab.frame.removeAttribute('sandbox');
              else tab.frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-popups');
              if (e === 'html' || e === 'htm') {
                tab.frame.removeAttribute('src');
                tab.frame.srcdoc = data;
              } else {
                tab.frame.removeAttribute('srcdoc');
                tab.blob = URL.createObjectURL(U.contentToBlob(data, p));
                tab.frame.src = tab.blob;
              }
            } catch (err) {
              tab.frame.srcdoc = `<body style="font-family:sans-serif;padding:40px"><h2>File not found</h2><p>${U.esc(err.message)}</p></body>`;
            }
          } else {
            tab.title = u.replace(/^https?:\/\/(www\.)?/, '').split(/[/?#]/)[0];
            tab.frame.setAttribute('sandbox', WEB_SANDBOX);
            tab.frame.removeAttribute('srcdoc');
            tab.frame.src = u;
          }
        }
        renderTab(tab);
        if (tab === active) updateChrome();
      }
      function updateChrome() {
        const t = active;
        if (!t) return;
        url.value = t.url === 'webos://home' ? '' : t.url;
        backBtn.disabled = t.hpos <= 0;
        fwdBtn.disabled = t.hpos >= t.hist.length - 1;
        const isWeb = /^https?:/.test(t.url);
        ext.disabled = !isWeb;
        star.textContent = bookmarks().some(b => b.url === t.url) ? '★' : '☆';
        star.disabled = t.url === 'webos://home';
        hint.hidden = !isWeb || OS.data.get('browser.hintDismissed', false);
        hint.innerHTML = '';
        hint.append(U.h('span', {}, 'Some websites refuse to be shown inside other pages. If this one stays blank, use ↗ to open it in a real tab.'),
          U.h('button', { class: 'btn small', onclick: () => { OS.data.set('browser.hintDismissed', true); hint.hidden = true; } }, 'Got it'));
        win.setTitle((t.title || 'New Tab') + ' — Browser');
        renderBookmarks();
      }
      function toggleBookmark() {
        const t = active;
        if (!t || t.url === 'webos://home') return;
        let bm = bookmarks();
        if (bm.some(b => b.url === t.url)) bm = bm.filter(b => b.url !== t.url);
        else bm.push({ url: t.url, title: t.title || t.url });
        OS.data.set('browser.bookmarks', bm);
        updateChrome();
        tabs.forEach(x => x.url === 'webos://home' && renderHome(x));
      }
      function renderBookmarks() {
        const bm = bookmarks();
        bmBar.innerHTML = '';
        bmBar.hidden = !bm.length;
        bm.forEach(b => {
          const el = U.h('button', { class: 'br-bm', title: b.url, html: OS.icons.tile(b.url.startsWith('file:') ? 'file' : 'browser', 14) + `<span>${U.esc(b.title)}</span>` });
          el.onclick = () => go(b.url);
          el.onauxclick = e => { if (e.button === 1) addTab(b.url); };
          el.oncontextmenu = e => {
            e.preventDefault();
            OS.menu(e.clientX, e.clientY, [
              { label: 'Open', action: () => go(b.url) },
              { label: 'Open in new tab', action: () => addTab(b.url) },
              { label: 'Remove bookmark', action: () => { OS.data.set('browser.bookmarks', bookmarks().filter(x => x.url !== b.url)); updateChrome(); } },
            ]);
          };
          bmBar.appendChild(el);
        });
      }
      function renderHome(tab) {
        const h = tab.homeEl;
        h.innerHTML = '';
        const q = U.h('input', { class: 'input br-home-search', placeholder: 'Search Google or type a URL' });
        q.addEventListener('keydown', e => { if (e.key === 'Enter' && q.value.trim()) load(tab, normalize(q.value.trim())); });
        const hr = new Date().getHours();
        const tile = (title, u, color) => U.h('button', { class: 'br-quick', onclick: () => load(tab, normalize(u)) },
          U.h('span', { class: 'br-quick-ic', style: { background: color } }, title[0]), U.h('span', {}, title));
        const localPages = [];
        try { fs.find('.htm', '/', 20).forEach(f => !f.isDir && localPages.push(f)); } catch { /* ignore */ }
        h.append(
          U.h('div', { class: 'br-home-inner' },
            U.h('h1', {}, hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening', U.h('span', { class: 'muted' }, ', ' + (OS.user.name || OS.user.username))),
            q,
            U.h('div', { class: 'br-quick-grid' }, QUICK.map(([t, u, c]) => tile(t, u, c)), bookmarks().map(b => tile(b.title.slice(0, 16), b.url, '#e11d48'))),
            localPages.length ? U.h('div', { class: 'br-local' }, U.h('h3', {}, 'Web pages on this computer'),
              localPages.map(f => U.h('button', { class: 'sm-row', onclick: () => load(tab, 'file://' + f.path), html: OS.icons.tile('filecode', 20) + `<span>${U.esc(f.name)}</span><small>${U.esc(U.dirname(f.path))}</small>` }))) : null));
        setTimeout(() => { if (tab === active && win.focused) q.focus(); }, 50);
      }

      win.onKey(e => {
        const ctrl = e.ctrlKey || e.metaKey;
        if (ctrl && e.key === 't') { e.preventDefault(); addTab('webos://home'); }
        else if (ctrl && e.key === 'w') { e.preventDefault(); active && closeTab(active); }
        else if (ctrl && e.key === 'l') { e.preventDefault(); url.focus(); }
        else if (ctrl && e.key === 'd') { e.preventDefault(); toggleBookmark(); }
        else if (e.key === 'F5') { e.preventDefault(); active && load(active, active.url, false); }
        else if (e.altKey && e.key === 'ArrowLeft') nav(-1);
        else if (e.altKey && e.key === 'ArrowRight') nav(1);
        else if (ctrl && e.key === 'Tab') { e.preventDefault(); const i = tabs.indexOf(active); select(tabs[(i + (e.shiftKey ? -1 : 1) + tabs.length) % tabs.length]); }
      });
      win.addCleanup(() => tabs.forEach(t => t.blob && URL.revokeObjectURL(t.blob)));
      win.onArgs = a => addTab(a.path ? 'file://' + fs.resolve(a.path) : a.url || 'webos://home');

      addTab(args.path ? 'file://' + fs.resolve(args.path) : args.url || 'webos://home');
    },
  });
})();
