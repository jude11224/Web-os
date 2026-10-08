/* WebOS core utilities, event bus, storage and sound */
'use strict';

const OS = window.OS = {
  name: 'WebOS',
  version: '1.0.0',
  apps: {},
  bootTime: Date.now(),
};

/* ---------- Event bus ---------- */
OS.bus = (() => {
  const map = {};
  return {
    on(evt, fn) { (map[evt] = map[evt] || []).push(fn); return () => this.off(evt, fn); },
    off(evt, fn) { map[evt] = (map[evt] || []).filter(f => f !== fn); },
    emit(evt, ...args) {
      (map[evt] || []).slice().forEach(fn => {
        try { fn(...args); } catch (err) { console.error('[bus]', evt, err); }
      });
    },
  };
})();

/* ---------- Helpers ---------- */
const U = OS.util = {
  /** Small DOM builder: h('div', {class:'x', onclick: fn}, 'text', childNode) */
  h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') {
          for (const [sk, sv] of Object.entries(v)) {
            if (sk.startsWith('--')) el.style.setProperty(sk, sv);
            else el.style[sk] = sv;
          }
        }
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    const add = c => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) c.forEach(add);
      else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    };
    children.forEach(add);
    return el;
  },
  /** Like Element.append but skips null/false and flattens arrays */
  append(parent, ...kids) {
    const add = c => { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else parent.append(c); };
    kids.forEach(add);
    return parent;
  },
  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },
  clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },
  rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; },
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },
  pad(n, l = 2) { return String(n).padStart(l, '0'); },
  debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  },
  fmtBytes(n) {
    if (n < 1024) return n + ' B';
    const u = ['KB', 'MB', 'GB'];
    let i = -1;
    do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
    return n.toFixed(n < 10 ? 1 : 0) + ' ' + u[i];
  },
  fmtDate(t) {
    const d = new Date(t);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  },
  fmtDuration(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
    return (h ? h + ':' + U.pad(m) : m) + ':' + U.pad(s);
  },
  ext(name) {
    const m = /\.([^./]+)$/.exec(name || '');
    return m ? m[1].toLowerCase() : '';
  },
  basename(p) { return (p || '').split('/').filter(Boolean).pop() || '/'; },
  dirname(p) {
    const parts = (p || '').split('/').filter(Boolean);
    parts.pop();
    return '/' + parts.join('/');
  },
  join(...parts) {
    return ('/' + parts.join('/')).replace(/\/+/g, '/').replace(/(.)\/$/, '$1');
  },
  stripExt(name) { return name.replace(/\.[^.]+$/, ''); },
  textExts: ['txt', 'md', 'log', 'csv', 'json', 'js', 'mjs', 'ts', 'css', 'html', 'htm', 'xml', 'svg', 'py', 'c', 'cpp', 'h', 'java', 'rb', 'go', 'rs', 'sh', 'ini', 'cfg', 'yml', 'yaml', 'toml', 'sql', 'php'],
  imageExts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif'],
  audioExts: ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus'],
  videoExts: ['mp4', 'webm', 'mov', 'm4v', 'ogv', 'mkv'],
  isText(name) { return U.textExts.includes(U.ext(name)); },
  /** Read a host File as text (for text types) or a data URL */
  readHostFile(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      const asText = U.isText(file.name) || (file.type && file.type.startsWith('text/') && !file.name.endsWith('.svg'));
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      asText ? r.readAsText(file) : r.readAsDataURL(file);
    });
  },
  pickHostFiles({ accept = '', multiple = true } = {}) {
    return new Promise(res => {
      const inp = U.h('input', { type: 'file', accept, multiple, style: { display: 'none' } });
      inp.onchange = () => { res([...inp.files]); inp.remove(); };
      document.body.appendChild(inp);
      inp.click();
    });
  },
  dataURLToBlob(url) {
    const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(url);
    if (!m) return new Blob([url], { type: 'text/plain' });
    const mime = m[1] || 'application/octet-stream';
    if (m[2]) {
      const bin = atob(m[3]);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: mime });
    }
    return new Blob([decodeURIComponent(m[3])], { type: mime });
  },
  mimeFor(name) {
    const e = U.ext(name);
    const map = {
      txt: 'text/plain', md: 'text/markdown', html: 'text/html', htm: 'text/html', css: 'text/css',
      js: 'text/javascript', json: 'application/json', svg: 'image/svg+xml', png: 'image/png',
      jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', mp3: 'audio/mpeg',
      wav: 'audio/wav', ogg: 'audio/ogg', mp4: 'video/mp4', webm: 'video/webm', pdf: 'application/pdf',
    };
    return map[e] || 'text/plain';
  },
  /** Turn file content (text or data URL) into a Blob */
  contentToBlob(content, name) {
    if (typeof content === 'string' && content.startsWith('data:')) return U.dataURLToBlob(content);
    return new Blob([content ?? ''], { type: U.mimeFor(name) });
  },
  download(name, content) {
    const blob = content instanceof Blob ? content : U.contentToBlob(content, name);
    const url = URL.createObjectURL(blob);
    const a = U.h('a', { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },
  async sha256(text) {
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback (non-secure contexts): simple 53-bit hash, repeated
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let r = 0; r < 1000; r++) {
      for (let i = 0; i < text.length; i++) {
        const ch = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
      }
    }
    return 'fb' + (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
  },
  /** Simple, safe-ish markdown to HTML */
  markdown(src) {
    const esc = U.esc;
    const lines = String(src).replace(/\r/g, '').split('\n');
    let html = '', inList = null, inCode = false, code = [];
    const inline = s => esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img alt="$1" src="$2">')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, href) => /^(https?:|mailto:|#)/.test(href) ? `<a href="${href}" target="_blank" rel="noopener">${t}</a>` : t);
    const closeList = () => { if (inList) { html += `</${inList}>`; inList = null; } };
    for (const line of lines) {
      if (line.startsWith('```')) {
        if (inCode) { html += `<pre><code>${esc(code.join('\n'))}</code></pre>`; code = []; inCode = false; }
        else { closeList(); inCode = true; }
        continue;
      }
      if (inCode) { code.push(line); continue; }
      let m;
      if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) { closeList(); html += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`; }
      else if ((m = /^\s*[-*+]\s+(.*)$/.exec(line))) { if (inList !== 'ul') { closeList(); html += '<ul>'; inList = 'ul'; } html += `<li>${inline(m[1])}</li>`; }
      else if ((m = /^\s*\d+\.\s+(.*)$/.exec(line))) { if (inList !== 'ol') { closeList(); html += '<ol>'; inList = 'ol'; } html += `<li>${inline(m[1])}</li>`; }
      else if (/^>\s?/.test(line)) { closeList(); html += `<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`; }
      else if (/^(-{3,}|\*{3,})$/.test(line.trim())) { closeList(); html += '<hr>'; }
      else if (!line.trim()) { closeList(); }
      else { closeList(); html += `<p>${inline(line)}</p>`; }
    }
    if (inCode) html += `<pre><code>${esc(code.join('\n'))}</code></pre>`;
    closeList();
    return html;
  },
};

/* ---------- Persistent key/value storage (localStorage) ---------- */
OS.storage = {
  get(key, def) {
    try {
      const v = localStorage.getItem('webos.' + key);
      return v == null ? def : JSON.parse(v);
    } catch { return def; }
  },
  set(key, val) {
    try { localStorage.setItem('webos.' + key, JSON.stringify(val)); return true; }
    catch (e) { console.warn('storage full', e); OS.notify && OS.notify({ title: 'Storage full', body: 'Could not save data: the browser storage quota was exceeded.' }); return false; }
  },
  remove(key) { try { localStorage.removeItem('webos.' + key); } catch { /* ignore */ } },
  keys(prefix) {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith('webos.' + prefix)) out.push(k.slice(6));
      }
    } catch { /* ignore */ }
    return out;
  },
};

/** Per-user app data (high scores, notes, events...) */
OS.data = {
  get(key, def) { return OS.storage.get('data.' + OS.user.username + '.' + key, def); },
  set(key, val) { return OS.storage.set('data.' + OS.user.username + '.' + key, val); },
};

/* ---------- IndexedDB key/value (large data like the file system) ---------- */
OS.idb = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('no indexedDB'));
    const r = indexedDB.open('webos', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction('kv', mode);
      const req = fn(t.objectStore('kv'));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  };
  return {
    async get(k) {
      try { return await tx('readonly', s => s.get(k)); }
      catch { return OS.storage.get('idb.' + k); }
    },
    async set(k, v) {
      try { await tx('readwrite', s => s.put(v, k)); }
      catch { OS.storage.set('idb.' + k, v); }
    },
    async del(k) {
      try { await tx('readwrite', s => s.delete(k)); }
      catch { OS.storage.remove('idb.' + k); }
    },
  };
})();

/* ---------- Sounds (synthesized with WebAudio, no assets needed) ---------- */
OS.sound = (() => {
  let ctx = null;
  const getCtx = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  const vol = () => (OS.settings ? (OS.settings.get('volume') ?? 70) / 100 : 0.7);
  const enabled = () => !OS.settings || OS.settings.get('sounds') !== false;
  const tone = (freq, start, dur, type = 'sine', gain = 0.2) => {
    const c = getCtx();
    if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    const t = c.currentTime + start;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain * vol(), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  };
  const sounds = {
    startup() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.12, 0.9 - i * 0.1, 'sine', 0.15)); tone(261.63, 0, 1.2, 'triangle', 0.1); },
    shutdown() { [783.99, 659.25, 523.25, 392].forEach((f, i) => tone(f, i * 0.14, 0.6, 'sine', 0.15)); },
    notify() { tone(880, 0, 0.18, 'sine', 0.15); tone(1318.5, 0.09, 0.3, 'sine', 0.12); },
    error() { tone(220, 0, 0.25, 'square', 0.08); tone(196, 0.12, 0.3, 'square', 0.08); },
    click() { tone(1200, 0, 0.04, 'square', 0.03); },
    pop() { tone(660, 0, 0.08, 'triangle', 0.15); },
    coin() { tone(988, 0, 0.08, 'square', 0.07); tone(1319, 0.07, 0.25, 'square', 0.07); },
    hit() { tone(140, 0, 0.15, 'sawtooth', 0.12); },
    blip() { tone(520, 0, 0.06, 'square', 0.06); },
    win() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.1, 0.25, 'triangle', 0.15)); },
    lose() { [392, 349, 311, 262].forEach((f, i) => tone(f, i * 0.16, 0.35, 'triangle', 0.15)); },
    alarm() { for (let i = 0; i < 6; i++) { tone(880, i * 0.5, 0.2, 'square', 0.1); tone(880, i * 0.5 + 0.25, 0.2, 'square', 0.1); } },
  };
  return {
    play(name) { if (enabled() && sounds[name]) try { sounds[name](); } catch { /* ignore */ } },
    tone(...a) { if (enabled()) tone(...a); },
    ctx: getCtx,
  };
})();
