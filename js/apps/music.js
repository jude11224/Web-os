/* Music — audio player with a procedurally generated built-in soundtrack and visualizer */
'use strict';

(() => {
  /* ---------- tiny chiptune composer (rendered offline with WebAudio) ---------- */
  const SONGS = [
    { id: 'neon', title: 'Neon Drive', artist: 'WebOS Synth Ensemble', bpm: 112, key: 57, minor: true, prog: [0, 8, 3, 10], bars: 32, seed: 7, colors: ['#ec4899', '#6366f1'], lead: 'sawtooth', soft: false },
    { id: 'sunrise', title: 'Pixel Sunrise', artist: 'WebOS Synth Ensemble', bpm: 126, key: 60, minor: false, prog: [0, 7, 9, 5], bars: 32, seed: 21, colors: ['#f59e0b', '#ef4444'], lead: 'square', soft: false },
    { id: 'rain', title: 'Lo-fi Rain', artist: 'WebOS Chill Collective', bpm: 80, key: 62, minor: true, prog: [0, 5, 10, 3], bars: 24, seed: 3, colors: ['#0ea5e9', '#1e3a8a'], lead: 'triangle', soft: true },
    { id: 'arcade', title: 'Arcade Hero', artist: 'WebOS 8-bit Band', bpm: 148, key: 64, minor: true, prog: [0, 3, 8, 7], bars: 40, seed: 99, colors: ['#22c55e', '#14532d'], lead: 'square', soft: false },
    { id: 'drift', title: 'Starlight Drift', artist: 'WebOS Chill Collective', bpm: 92, key: 65, minor: false, prog: [0, 9, 5, 7], bars: 24, seed: 42, colors: ['#a855f7', '#0f172a'], lead: 'sine', soft: true },
  ];
  const cache = {};
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  /** Synthesizes a song straight into a sample buffer (much faster than scheduling thousands of WebAudio nodes) */
  async function renderSong(song) {
    if (cache[song.id]) return cache[song.id];
    const rate = 32000, beat = 60 / song.bpm, barLen = beat * 4, dur = song.bars * barLen + 2;
    const out = new Float32Array(Math.ceil(rate * dur));
    const rnd = mulberry(song.seed);
    const scale = song.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
    const TAU = Math.PI * 2;
    const wave = (type, p) => {
      p -= Math.floor(p);
      if (type === 'sine') return Math.sin(TAU * p);
      if (type === 'square') return p < 0.5 ? 1 : -1;
      if (type === 'sawtooth') return 2 * p - 1;
      return 1 - 4 * Math.abs(p - 0.5); // triangle
    };
    const note = (freq, t, len, type, vol, attack = 0.005, rel = 0.08) => {
      const s0 = Math.floor(t * rate), n = Math.floor(len * rate), a = Math.max(1, attack * rate), r = Math.max(1, rel * rate);
      for (let i = 0; i < n && s0 + i < out.length; i++) {
        const env = i < a ? i / a : i > n - r ? (n - i) / r : 1;
        out[s0 + i] += wave(type, freq * i / rate) * vol * env;
      }
    };
    const noise = (t, len, vol, hp) => {
      const s0 = Math.floor(t * rate), n = Math.floor(len * rate);
      const rc = 1 / (TAU * hp), k = rc / (rc + 1 / rate);
      let px = 0, py = 0;
      for (let i = 0; i < n && s0 + i < out.length; i++) {
        const x = Math.random() * 2 - 1;
        py = k * (py + x - px); px = x;
        out[s0 + i] += py * vol * Math.exp(-6 * i / n);
      }
    };
    const kick = t => {
      const s0 = Math.floor(t * rate), n = Math.floor(0.3 * rate);
      let ph = 0;
      for (let i = 0; i < n && s0 + i < out.length; i++) {
        const tt = i / rate;
        ph += (40 + 100 * Math.exp(-tt * 18)) / rate;
        out[s0 + i] += Math.sin(TAU * ph) * (song.soft ? 0.5 : 0.8) * Math.exp(-tt * 12);
      }
    };

    // melody motif (2 bars) reused with variation
    const motif = [];
    let deg = 4;
    for (let i = 0; i < 16; i++) {
      deg = U.clamp(deg + Math.round((rnd() - 0.5) * 4), 0, 11);
      motif.push(rnd() < 0.22 ? null : deg);
    }
    for (let bar = 0; bar < song.bars; bar++) {
      const t0 = bar * barLen;
      const step = song.prog[bar % song.prog.length];
      const root = song.key + step;
      const third = (song.minor && [0, 5, 7].includes(step % 12)) || (!song.minor && [2, 4, 9].includes(step % 12)) ? 3 : 4;
      const chord = [0, third, 7];
      const section = Math.floor(bar / 8) % 4; // intro, A, B, A'
      for (let i = 0; i < 8; i++) note(mtof(root - 24 + (i % 4 === 3 ? 7 : 0)), t0 + i * beat / 2, beat / 2 * 0.9, song.soft ? 'sine' : 'triangle', song.soft ? 0.35 : 0.3);
      if (song.soft) chord.forEach(c => note(mtof(root - 12 + c), t0, barLen, 'sine', 0.06, 0.4, 0.5));
      else for (let i = 0; i < 16; i++) note(mtof(root + chord[i % 3] + (i % 6 >= 3 ? 12 : 0)), t0 + i * beat / 4, beat / 4 * 0.8, 'square', 0.035);
      if (section > 0) {
        for (let i = 0; i < 8; i++) {
          const m = motif[(bar % 2) * 8 + i];
          if (m == null) continue;
          const d = m + (section === 2 ? 2 : 0);
          const n = song.key + 12 + scale[d % 7] + 12 * Math.floor(d / 7);
          note(mtof(n), t0 + i * beat / 2, beat / 2 * (rnd() < 0.3 ? 1.9 : 0.95), song.lead, song.lead === 'sawtooth' ? 0.07 : song.lead === 'square' ? 0.06 : 0.14);
        }
      }
      if (bar > 0 || section > 0) {
        for (let b = 0; b < 4; b++) {
          const t = t0 + b * beat;
          if (b % 2 === 0) kick(t);
          if (b % 2 === 1) noise(t, song.soft ? 0.12 : 0.18, song.soft ? 0.3 : 0.6, 1200);
          noise(t, 0.04, 0.2, 7000);
          noise(t + beat / 2, 0.04, song.soft ? 0.12 : 0.2, 7000);
          if (!song.soft && bar % 4 === 3 && b === 3) kick(t + beat / 2);
        }
      }
      if (bar % 4 === 3) await new Promise(r => setTimeout(r, 0)); // stay responsive
    }
    // normalize with gentle soft-clipping, fade out the last 2 seconds
    let peak = 0;
    for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
    const g = peak ? 1.4 / peak : 1, fade = rate * 2;
    for (let i = 0; i < out.length; i++) {
      out[i] = Math.tanh(out[i] * g) * 0.85;
      if (i > out.length - fade) out[i] *= (out.length - i) / fade;
    }
    const url = URL.createObjectURL(encodeWav(out, rate));
    cache[song.id] = url;
    return url;
  }
  function encodeWav(samples, rate) {
    const buf = new ArrayBuffer(44 + samples.length * 2), v = new DataView(buf);
    const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, U.clamp(samples[i], -1, 1) * 0x7fff, true);
    return new Blob([buf], { type: 'audio/wav' });
  }

  OS.registerApp({
    id: 'music', name: 'Music', icon: 'music', category: 'Apps', width: 860, height: 560, minWidth: 420, single: true,
    desc: 'Play music and audio files', keywords: 'audio player songs mp3 media',
    exts: U.audioExts,
    launch(win, args) {
      const fs = OS.fs;
      const audio = new Audio();
      audio.preload = 'auto';
      let queue = [], cur = -1, shuffle = false, repeat = 'all', vol = OS.data.get('music.vol', 0.8), blobUrl = null;
      let analyser = null, srcNode = null, actx = null;

      const lib = U.h('div', { class: 'mu-lib' });
      const art = U.h('div', { class: 'mu-art' });
      const viz = U.h('canvas', { class: 'mu-viz' });
      const tTitle = U.h('div', { class: 'mu-title' }, 'Nothing playing');
      const tArtist = U.h('div', { class: 'mu-artist muted' }, 'Pick a song from the library');
      const seek = U.h('input', { type: 'range', class: 'mu-seek', min: 0, max: 1000, value: 0 });
      const tCur = U.h('small', {}, '0:00'), tDur = U.h('small', {}, '0:00');
      const playBtn = U.h('button', { class: 'mu-play', title: 'Play/Pause (Space)', onclick: togglePlay }, '▶');
      const shufBtn = U.h('button', { class: 'mu-btn', title: 'Shuffle', onclick: () => { shuffle = !shuffle; shufBtn.classList.toggle('on', shuffle); } }, '⤮');
      const repBtn = U.h('button', { class: 'mu-btn on', title: 'Repeat: all', onclick: () => { repeat = repeat === 'all' ? 'one' : repeat === 'one' ? 'off' : 'all'; repBtn.textContent = repeat === 'one' ? '🔂' : '🔁'; repBtn.classList.toggle('on', repeat !== 'off'); repBtn.title = 'Repeat: ' + repeat; } }, '🔁');
      const volInp = U.h('input', { type: 'range', min: 0, max: 100, value: vol * 100, class: 'mu-vol' });
      volInp.oninput = () => { vol = volInp.value / 100; OS.data.set('music.vol', vol); applyVol(); };

      win.body.append(U.h('div', { class: 'app-split' },
        U.h('div', { class: 'app-side mu-side' }, lib),
        U.h('div', { class: 'mu-main' },
          U.h('div', { class: 'mu-now' }, art, U.h('div', { class: 'mu-meta' }, tTitle, tArtist)),
          viz,
          U.h('div', { class: 'mu-seekrow' }, tCur, seek, tDur),
          U.h('div', { class: 'mu-controls' },
            shufBtn,
            U.h('button', { class: 'mu-btn', title: 'Previous', onclick: prev }, '⏮'),
            playBtn,
            U.h('button', { class: 'mu-btn', title: 'Next', onclick: next }, '⏭'),
            repBtn,
            U.h('span', { class: 'mu-volwrap', title: 'Volume' }, '🔊', volInp)))));

      function applyVol() { audio.volume = U.clamp(vol * (OS.settings.get('volume') / 100), 0, 1); }
      win.sub('settings:change', k => k === 'volume' && applyVol());

      function library() {
        const items = SONGS.map(s => ({ type: 'builtin', song: s, title: s.title, artist: s.artist, colors: s.colors }));
        const walk = d => {
          let l = [];
          try { l = fs.list(d); } catch { return; }
          l.forEach(i => { if (i.isDir) walk(i.path); else if (U.audioExts.includes(U.ext(i.name))) items.push({ type: 'file', path: i.path, title: U.stripExt(i.name), artist: U.dirname(i.path), colors: ['#64748b', '#1e293b'] }); });
        };
        walk('/');
        return items;
      }
      function renderLib() {
        const items = library();
        lib.innerHTML = '';
        lib.append(U.h('div', { class: 'mu-lib-h' }, U.h('b', {}, 'Library'),
          U.h('button', { class: 'btn small', onclick: importMusic, title: 'Import audio files from your computer' }, '+ Import')));
        const section = (label, list) => {
          if (!list.length) return;
          lib.append(U.h('div', { class: 'sm-h' }, label));
          list.forEach(it => {
            const playing = queue[cur] && (queue[cur].song ? queue[cur].song === it.song : queue[cur].path === it.path);
            lib.append(U.h('button', {
              class: 'mu-row' + (playing ? ' playing' : ''),
              onclick: () => { queue = items; playIndex(items.indexOf(it)); },
            }, U.h('span', { class: 'mu-mini', style: { background: `linear-gradient(135deg, ${it.colors[0]}, ${it.colors[1]})` } }, playing && !audio.paused ? '♪' : ''),
            U.h('span', { class: 'mu-row-t' }, U.h('span', {}, it.title), U.h('small', { class: 'muted' }, it.artist))));
          });
        };
        section('WebOS Originals', items.filter(i => i.type === 'builtin'));
        section('Your music', items.filter(i => i.type === 'file'));
        if (!items.some(i => i.type === 'file')) lib.append(U.h('p', { class: 'muted mu-tip' }, 'Tip: import MP3/WAV/OGG files or drop them into your Music folder.'));
        return items;
      }
      async function importMusic() {
        const files = await U.pickHostFiles({ accept: 'audio/*' });
        if (!files.length) return;
        await fs.importFiles(files, '/Music');
        renderLib();
      }
      async function playIndex(i) {
        if (!queue.length) return;
        cur = (i + queue.length) % queue.length;
        const it = queue[cur];
        tTitle.textContent = it.title;
        tArtist.textContent = it.type === 'builtin' ? it.artist : U.basename(it.path);
        art.style.background = `linear-gradient(135deg, ${it.colors[0]}, ${it.colors[1]})`;
        art.innerHTML = OS.icons.glyph('music', 64);
        win.setTitle(it.title + ' — Music');
        if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
        try {
          if (it.type === 'builtin') {
            tArtist.textContent = 'Composing…';
            audio.src = await renderSong(it.song);
            tArtist.textContent = it.artist;
          } else {
            blobUrl = URL.createObjectURL(U.contentToBlob(fs.read(it.path), it.path));
            audio.src = blobUrl;
          }
          setupAnalyser();
          applyVol();
          await audio.play();
        } catch (e) {
          if (e.name !== 'AbortError') { tArtist.textContent = 'Could not play: ' + e.message; OS.sound.play('error'); }
        }
        if ('mediaSession' in navigator) {
          try {
            navigator.mediaSession.metadata = new MediaMetadata({ title: it.title, artist: it.artist, album: OS.name });
            navigator.mediaSession.setActionHandler('play', () => audio.play());
            navigator.mediaSession.setActionHandler('pause', () => audio.pause());
            navigator.mediaSession.setActionHandler('previoustrack', prev);
            navigator.mediaSession.setActionHandler('nexttrack', next);
          } catch { /* ignore */ }
        }
        renderLib();
      }
      function togglePlay() {
        if (cur < 0) { queue = library(); playIndex(0); return; }
        audio.paused ? audio.play() : audio.pause();
      }
      function next() {
        if (!queue.length) return;
        if (shuffle && queue.length > 1) { let n; do { n = U.rand(0, queue.length - 1); } while (n === cur); playIndex(n); }
        else playIndex(cur + 1);
      }
      function prev() {
        if (audio.currentTime > 3) { audio.currentTime = 0; return; }
        playIndex(cur - 1);
      }
      function setupAnalyser() {
        if (analyser) return;
        try {
          actx = OS.sound.ctx();
          srcNode = actx.createMediaElementSource(audio);
          analyser = actx.createAnalyser();
          analyser.fftSize = 128;
          srcNode.connect(analyser);
          analyser.connect(actx.destination);
        } catch (e) { analyser = null; }
      }
      audio.addEventListener('play', () => { playBtn.textContent = '❚❚'; renderLib(); });
      audio.addEventListener('pause', () => { playBtn.textContent = '▶'; renderLib(); });
      audio.addEventListener('timeupdate', () => {
        if (!seeking && audio.duration) seek.value = audio.currentTime / audio.duration * 1000;
        tCur.textContent = U.fmtDuration(audio.currentTime);
        tDur.textContent = U.fmtDuration(audio.duration || 0);
      });
      audio.addEventListener('ended', () => {
        if (repeat === 'one') { audio.currentTime = 0; audio.play(); }
        else if (repeat === 'off' && cur === queue.length - 1 && !shuffle) playBtn.textContent = '▶';
        else next();
      });
      let seeking = false;
      seek.addEventListener('input', () => { seeking = true; if (audio.duration) tCur.textContent = U.fmtDuration(seek.value / 1000 * audio.duration); });
      seek.addEventListener('change', () => { if (audio.duration) audio.currentTime = seek.value / 1000 * audio.duration; seeking = false; });

      // visualizer
      const vctx = viz.getContext('2d');
      const freq = new Uint8Array(64);
      win.loop(() => {
        if (win.minimized) return;
        const w = viz.clientWidth, h = viz.clientHeight;
        if (viz.width !== w * devicePixelRatio) { viz.width = w * devicePixelRatio; viz.height = h * devicePixelRatio; }
        vctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        vctx.clearRect(0, 0, w, h);
        const it = queue[cur];
        const cols = it ? it.colors : ['#64748b', '#334155'];
        const g = vctx.createLinearGradient(0, h, 0, 0);
        g.addColorStop(0, cols[1]); g.addColorStop(1, cols[0]);
        vctx.fillStyle = g;
        if (analyser && !audio.paused) analyser.getByteFrequencyData(freq); else freq.forEach((v, i) => { freq[i] = Math.max(0, v - 6); });
        const n = 48, bw = w / n;
        for (let i = 0; i < n; i++) {
          const v = freq[Math.floor(i * 56 / n)] / 255;
          const bh = Math.max(2, v * h * 0.95);
          vctx.beginPath();
          vctx.roundRect ? vctx.roundRect(i * bw + 1, h - bh, bw - 2, bh, 3) : vctx.rect(i * bw + 1, h - bh, bw - 2, bh);
          vctx.fill();
        }
      });

      win.onKey(e => {
        if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
        if (e.key === ' ') { e.preventDefault(); togglePlay(); }
        else if (e.key === 'ArrowRight' && e.ctrlKey) next();
        else if (e.key === 'ArrowLeft' && e.ctrlKey) prev();
        else if (e.key === 'ArrowRight') audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
        else if (e.key === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
      });
      win.addCleanup(() => {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        try { srcNode && srcNode.disconnect(); analyser && analyser.disconnect(); } catch { /* ignore */ }
        if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
      });
      win.sub('fs:change', U.debounce(renderLib, 100));
      win.onArgs = a => {
        if (!a.path) return;
        queue = renderLib();
        const i = queue.findIndex(q => q.path === fs.resolve(a.path));
        if (i >= 0) playIndex(i);
      };

      queue = renderLib();
      art.style.background = 'linear-gradient(135deg, #64748b, #1e293b)';
      art.innerHTML = OS.icons.glyph('music', 64);
      applyVol();
      if (args.path) win.onArgs(args);
    },
  });
})();
