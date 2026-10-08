/* Video Player */
'use strict';

OS.registerApp({
  id: 'video', name: 'Video Player', icon: 'video', category: 'Apps', width: 820, height: 520, minWidth: 360,
  desc: 'Play video files', keywords: 'movie media mp4 film',
  exts: U.videoExts,
  launch(win, args) {
    const fs = OS.fs;
    let url = null;
    const video = U.h('video', { class: 'vp-video', controls: true, playsinline: true });
    const empty = U.h('div', { class: 'vp-empty' },
      U.h('div', { html: OS.icons.tile('video', 72) }),
      U.h('h3', {}, 'No video open'),
      U.h('p', { class: 'muted' }, 'Open a video from your files, import one from your computer, or drop it here.'),
      U.h('div', { class: 'go-btns' },
        U.h('button', { class: 'btn primary', onclick: openDlg }, 'Open from Files'),
        U.h('button', { class: 'btn', onclick: importVid }, 'Import from computer')));
    const list = U.h('div', { class: 'vp-list' });
    win.body.append(U.h('div', { class: 'vp' }, video, empty), list);

    function load(p) {
      p = fs.resolve(p);
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(U.contentToBlob(fs.read(p), p));
      video.src = url;
      video.hidden = false;
      empty.hidden = true;
      win.setTitle(U.basename(p) + ' — Video Player');
      video.play().catch(() => {});
    }
    async function openDlg() {
      const p = await OS.dialog.file({ mode: 'open', start: '/Videos', exts: U.videoExts });
      if (p) load(p);
    }
    async function importVid() {
      const files = await U.pickHostFiles({ accept: 'video/*' });
      if (!files.length) return;
      const added = await fs.importFiles(files, '/Videos');
      if (added[0]) load(added[0]);
      renderList();
    }
    function renderList() {
      const vids = fs.find('.', '/', 500).filter(s => !s.isDir && U.videoExts.includes(U.ext(s.name)));
      list.innerHTML = '';
      list.hidden = !vids.length;
      vids.forEach(v => list.appendChild(U.h('button', { class: 'vp-item', onclick: () => load(v.path), html: OS.icons.tile('filevideo', 18) + `<span>${U.esc(v.name)}</span>` })));
    }
    win.body.addEventListener('dragover', e => e.preventDefault());
    win.body.addEventListener('drop', async e => {
      e.preventDefault();
      const f = [...e.dataTransfer.files].filter(x => x.type.startsWith('video/'));
      if (!f.length) return;
      const added = await fs.importFiles(f, '/Videos');
      if (added[0]) load(added[0]);
      renderList();
    });
    win.onKey(e => {
      if (video.hidden) return;
      if (e.key === ' ' && e.target !== video) { e.preventDefault(); video.paused ? video.play() : video.pause(); }
      else if (e.key === 'f') video.requestFullscreen && video.requestFullscreen();
    });
    win.addCleanup(() => { video.pause(); if (url) URL.revokeObjectURL(url); });
    win.onArgs = a => a.path && load(a.path);
    video.hidden = true;
    renderList();
    if (args.path) load(args.path);
  },
});
