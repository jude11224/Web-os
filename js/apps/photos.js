/* Photos — image gallery and viewer */
'use strict';

OS.registerApp({
  id: 'photos', name: 'Photos', icon: 'photos', category: 'Apps', width: 900, height: 600, minWidth: 380,
  desc: 'View your pictures', keywords: 'images gallery viewer pictures',
  exts: U.imageExts,
  launch(win, args) {
    const fs = OS.fs;
    let list = [], idx = 0, zoom = 1, rot = 0, panX = 0, panY = 0, slideshow = null, mode = 'gallery';

    const gallery = U.h('div', { class: 'ph-gallery' });
    const img = U.h('img', { class: 'ph-img', draggable: false, alt: '' });
    const stage = U.h('div', { class: 'ph-stage' }, img);
    const strip = U.h('div', { class: 'ph-strip' });
    const info = U.h('span', { class: 'ph-info' });
    const prevBtn = U.h('button', { class: 'ph-arrow left', onclick: () => show(idx - 1), title: 'Previous (←)' }, '‹');
    const nextBtn = U.h('button', { class: 'ph-arrow right', onclick: () => show(idx + 1), title: 'Next (→)' }, '›');
    const ssBtn = U.h('button', { class: 'btn', onclick: toggleSlideshow }, '▶ Slideshow');
    const bar = U.h('div', { class: 'toolbar ph-bar' },
      U.h('button', { class: 'btn', onclick: () => setMode('gallery') }, '▦ Gallery'),
      U.h('button', { class: 'btn icon-btn', title: 'Zoom out (-)', onclick: () => setZoom(zoom / 1.25) }, '−'),
      U.h('button', { class: 'btn icon-btn', title: 'Zoom in (+)', onclick: () => setZoom(zoom * 1.25) }, '+'),
      U.h('button', { class: 'btn', title: 'Fit (0)', onclick: () => { zoom = 1; panX = panY = 0; apply(); } }, 'Fit'),
      U.h('button', { class: 'btn icon-btn', title: 'Rotate (R)', onclick: () => { rot = (rot + 90) % 360; apply(); } }, '⟳'),
      ssBtn,
      U.h('span', { style: { flex: 1 } }), info,
      U.h('button', { class: 'btn', title: 'More', onclick: e => {
        const p = list[idx];
        if (!p) return;
        const r = e.currentTarget.getBoundingClientRect();
        OS.menu(r.left - 120, r.bottom, [
          { label: 'Set as wallpaper', icon: 'settings', action: () => { OS.settings.set('wallpaper', { type: 'image', path: p }); OS.notify({ title: 'Wallpaper changed', body: U.basename(p), icon: 'photos' }); } },
          { label: 'Edit in Paint', icon: 'paint', action: () => OS.launch('paint', { path: p }) },
          { label: 'Show in Files', icon: 'files', action: () => OS.launch('files', { path: p }) },
          { label: 'Download', icon: 'downloads', action: () => OS.fileOps.download(p) },
          { label: 'Properties', action: () => OS.fileOps.properties(p) },
          '-',
          { label: 'Delete', icon: 'trash', action: () => { OS.fileOps.remove([p]); } },
        ]);
      } }, '⋯'));
    const viewer = U.h('div', { class: 'ph-viewer' }, bar, U.h('div', { class: 'ph-stage-wrap' }, stage, prevBtn, nextBtn), strip);
    win.body.append(gallery, viewer);

    function allImages() {
      const out = [];
      const walk = d => {
        let items = [];
        try { items = fs.list(d); } catch { return; }
        items.forEach(i => { if (i.isDir) walk(i.path); else if (U.imageExts.includes(U.ext(i.name))) out.push(i.path); });
      };
      walk('/');
      return out;
    }
    function setMode(m) {
      mode = m;
      gallery.hidden = m !== 'gallery';
      viewer.hidden = m === 'gallery';
      if (m === 'gallery') { stopSlideshow(); renderGallery(); win.setTitle('Photos'); }
    }
    function renderGallery() {
      gallery.innerHTML = '';
      const imgs = allImages();
      const groups = {};
      imgs.forEach(p => (groups[U.dirname(p)] = groups[U.dirname(p)] || []).push(p));
      gallery.append(U.h('div', { class: 'ph-g-head' }, U.h('h2', {}, 'Photos'), U.h('span', { class: 'muted' }, `${imgs.length} picture${imgs.length === 1 ? '' : 's'}`),
        U.h('button', { class: 'btn', style: { marginLeft: 'auto' }, onclick: async () => { const f = await U.pickHostFiles({ accept: 'image/*' }); if (f.length) { await fs.importFiles(f, '/Pictures'); renderGallery(); } } }, '⇪ Import')));
      if (!imgs.length) gallery.append(U.h('div', { class: 'empty-state' }, 'No pictures yet. Import some, or draw one in Paint!'));
      for (const [dir, ps] of Object.entries(groups)) {
        gallery.append(U.h('h3', { class: 'ph-g-dir' }, dir === '/' ? 'Home' : dir));
        gallery.append(U.h('div', { class: 'ph-grid' }, ps.map(p => {
          const t = U.h('button', { class: 'ph-thumb', title: U.basename(p) }, U.h('img', { src: fs.read(p), loading: 'lazy', alt: U.basename(p) }));
          t.onclick = () => { list = ps; show(ps.indexOf(p)); };
          t.oncontextmenu = e => { e.preventDefault(); OS.menu(e.clientX, e.clientY, OS.fileOps.menuItems([p])); };
          return t;
        })));
      }
    }
    function openPath(p) {
      p = fs.resolve(p);
      const dir = U.dirname(p);
      try { list = fs.list(dir).filter(i => !i.isDir && U.imageExts.includes(U.ext(i.name))).map(i => i.path); } catch { list = [p]; }
      if (!list.includes(p)) list.unshift(p);
      show(list.indexOf(p));
    }
    function show(i) {
      if (!list.length) return setMode('gallery');
      idx = (i + list.length) % list.length;
      setMode('viewer');
      zoom = 1; rot = 0; panX = panY = 0;
      const p = list[idx];
      try { img.src = fs.read(p); } catch { list.splice(idx, 1); return show(idx); }
      img.onload = () => {
        const st = fs.stat(p);
        info.textContent = `${idx + 1} / ${list.length}   •   ${img.naturalWidth} × ${img.naturalHeight}   •   ${U.fmtBytes(st ? st.size : 0)}`;
      };
      win.setTitle(U.basename(p) + ' — Photos');
      apply();
      strip.innerHTML = '';
      list.forEach((q, k) => {
        const t = U.h('button', { class: 'ph-st' + (k === idx ? ' active' : '') }, U.h('img', { src: fs.read(q), alt: '' }));
        t.onclick = () => show(k);
        strip.appendChild(t);
        if (k === idx) setTimeout(() => t.scrollIntoView({ block: 'nearest', inline: 'center' }), 0);
      });
      prevBtn.hidden = nextBtn.hidden = list.length < 2;
    }
    function setZoom(z) { zoom = U.clamp(z, 0.1, 20); apply(); }
    function apply() {
      img.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom}) rotate(${rot}deg)`;
      stage.style.cursor = zoom > 1 ? 'grab' : 'default';
    }
    function toggleSlideshow() { slideshow ? stopSlideshow() : startSlideshow(); }
    function startSlideshow() {
      slideshow = setInterval(() => show(idx + 1), 3000);
      ssBtn.textContent = '■ Stop';
    }
    function stopSlideshow() {
      clearInterval(slideshow);
      slideshow = null;
      ssBtn.textContent = '▶ Slideshow';
    }
    win.addCleanup(stopSlideshow);

    stage.addEventListener('wheel', e => { e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)); }, { passive: false });
    stage.addEventListener('dblclick', () => { zoom = zoom > 1 ? 1 : 2; panX = panY = 0; apply(); });
    stage.addEventListener('pointerdown', e => {
      if (zoom <= 1) return;
      const sx = e.clientX - panX, sy = e.clientY - panY;
      stage.setPointerCapture(e.pointerId);
      stage.style.cursor = 'grabbing';
      const move = ev => { panX = ev.clientX - sx; panY = ev.clientY - sy; apply(); };
      const up = () => { stage.removeEventListener('pointermove', move); stage.removeEventListener('pointerup', up); apply(); };
      stage.addEventListener('pointermove', move);
      stage.addEventListener('pointerup', up);
    });
    win.onKey(e => {
      if (mode !== 'viewer') return;
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); show(idx + 1); }
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === '+' || e.key === '=') setZoom(zoom * 1.25);
      else if (e.key === '-') setZoom(zoom / 1.25);
      else if (e.key === '0') { zoom = 1; panX = panY = 0; apply(); }
      else if (e.key === 'r') { rot = (rot + 90) % 360; apply(); }
      else if (e.key === 'Escape') setMode('gallery');
      else if (e.key === 'Delete' && list[idx]) OS.fileOps.remove([list[idx]]);
    });
    win.sub('fs:change', U.debounce(() => {
      if (mode === 'gallery') renderGallery();
      else {
        const cur = list[idx];
        list = list.filter(p => fs.isFile(p));
        if (!list.length) return setMode('gallery');
        const ni = list.indexOf(cur);
        show(ni >= 0 ? ni : Math.min(idx, list.length - 1));
      }
    }, 80));
    win.onArgs = a => a.path && openPath(a.path);

    if (args.path) openPath(args.path);
    else setMode('gallery');
  },
});
