/* WebOS virtual file system — per-user tree kept in memory and persisted to IndexedDB.
 * Node shapes:  dir  { t:'d', c:{ name: node }, m: mtime }
 *               file { t:'f', d: 'text or data:URL', m: mtime }
 * The user's home is the root "/". Trash lives in "/.Trash".
 */
'use strict';

class VFS {
  constructor(user, tree) {
    this.user = user;
    this.root = tree;
    this._save = U.debounce(() => this.flush(), 400);
  }

  static async open(user) {
    let tree = await OS.idb.get('fs:' + user);
    const fs = new VFS(user, tree || VFS.defaultTree(user));
    if (!tree) fs.flush();
    if (!fs.root.c['.Trash']) fs.root.c['.Trash'] = VFS.dir();
    return fs;
  }

  static dir(children = {}) { return { t: 'd', c: children, m: Date.now() }; }
  static file(data = '') { return { t: 'f', d: data, m: Date.now() }; }

  static defaultTree(user) {
    const f = VFS.file, d = VFS.dir;
    const sampleSvg = 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9a8b"/><stop offset=".55" stop-color="#ff6a88"/><stop offset="1" stop-color="#5b247a"/></linearGradient></defs><rect width="800" height="500" fill="url(#s)"/><circle cx="560" cy="250" r="90" fill="#ffe29f" opacity=".95"/><path d="M0 330 L140 220 L260 300 L380 180 L520 320 L640 240 L800 330 V500 H0z" fill="#3a1c71" opacity=".85"/><path d="M0 390 L180 300 L330 380 L470 290 L620 380 L800 320 V500 H0z" fill="#24124a"/></svg>`);
    const sampleSvg2 = 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><defs><radialGradient id="g" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#43cea2"/><stop offset="1" stop-color="#185a9d"/></radialGradient></defs><rect width="800" height="500" fill="url(#g)"/>${Array.from({ length: 24 }, (_, i) => `<circle cx="${(i * 97) % 800}" cy="${(i * 53) % 500}" r="${10 + (i * 7) % 40}" fill="#fff" opacity="${0.05 + (i % 5) * 0.04}"/>`).join('')}<text x="400" y="270" font-family="sans-serif" font-size="64" font-weight="700" fill="#fff" text-anchor="middle">Bubbles</text></svg>`);
    return d({
      Desktop: d({
        'Welcome.txt': f(`Welcome to WebOS, ${user}!\n\nThis is a complete desktop operating system that runs entirely in your browser.\n\nThings to try:\n  • Open the Start menu (bottom-left) to find every app and game.\n  • Drag windows around, resize them, snap them to the screen edges.\n  • Right-click the desktop to create files and folders.\n  • Open Terminal and type "help".\n  • Change your wallpaper and theme in Settings.\n  • Drop files from your real computer onto the desktop to import them.\n\nEverything you create is saved in your browser, per user account.\n\nHave fun!\n`),
      }),
      Documents: d({
        'Notes.md': f(`# My Notes\n\nThis is a **Markdown** file. Open it in *Notepad* and press **Preview**.\n\n## Todo\n- Try every game\n- Beat my Snake high score\n- Write some code in Code Studio\n\n> Tip: Ctrl+S saves in most apps.\n`),
        'hello.html': f(`<!DOCTYPE html>\n<html>\n<head>\n  <title>Hello</title>\n  <style>\n    body { font-family: sans-serif; display: grid; place-items: center; height: 100vh; margin: 0;\n           background: linear-gradient(135deg, #667eea, #764ba2); color: white; }\n    button { font-size: 18px; padding: 10px 20px; border-radius: 8px; border: 0; cursor: pointer; }\n  </style>\n</head>\n<body>\n  <div style="text-align:center">\n    <h1>Hello from WebOS!</h1>\n    <p>Edit this file in Code Studio and press Run.</p>\n    <button onclick="this.textContent = 'Clicked ' + (++n) + ' times'">Click me</button>\n  </div>\n  <script>let n = 0;</script>\n</body>\n</html>\n`),
        'script.js': f(`// Open in Code Studio and press Run (F5).\n// console.log output appears in the console panel.\n\nfunction fib(n) {\n  return n < 2 ? n : fib(n - 1) + fib(n - 2);\n}\n\nfor (let i = 0; i < 10; i++) {\n  console.log('fib(' + i + ') =', fib(i));\n}\n`),
        'shopping.csv': f('item,qty,price\napples,6,0.5\nbread,1,2.25\nmilk,2,1.1\n'),
      }),
      Pictures: d({ 'Sunset.svg': f(sampleSvg), 'Bubbles.svg': f(sampleSvg2) }),
      Music: d({}),
      Videos: d({}),
      Downloads: d({}),
      '.Trash': d({}),
    });
  }

  flush() {
    return OS.idb.set('fs:' + this.user, this.root);
  }

  changed(...paths) {
    this._save();
    OS.bus.emit('fs:change', paths);
  }

  resolve(path, cwd = '/') {
    if (path == null || path === '') return cwd;
    path = String(path);
    if (path === '~' || path.startsWith('~/')) path = '/' + path.slice(1);
    const full = path.startsWith('/') ? path : cwd + '/' + path;
    const out = [];
    for (const p of full.split('/')) {
      if (!p || p === '.') continue;
      if (p === '..') out.pop();
      else out.push(p);
    }
    return '/' + out.join('/');
  }

  node(path) {
    const parts = this.resolve(path).split('/').filter(Boolean);
    let n = this.root;
    for (const p of parts) {
      if (!n || n.t !== 'd' || !Object.prototype.hasOwnProperty.call(n.c, p)) return null;
      n = n.c[p];
    }
    return n;
  }

  exists(path) { return !!this.node(path); }
  isDir(path) { const n = this.node(path); return !!n && n.t === 'd'; }
  isFile(path) { const n = this.node(path); return !!n && n.t === 'f'; }

  _parent(path, create = false) {
    path = this.resolve(path);
    if (path === '/') throw new Error('Cannot modify root');
    const dir = U.dirname(path), name = U.basename(path);
    let p = this.node(dir);
    if (!p && create) { this.mkdir(dir, true); p = this.node(dir); }
    if (!p) throw new Error(`No such directory: ${dir}`);
    if (p.t !== 'd') throw new Error(`Not a directory: ${dir}`);
    return { parent: p, name, dir, path };
  }

  static validName(name) {
    return !!name && !/[/\\]/.test(name) && name !== '.' && name !== '..' && name.length < 200;
  }

  size(node) {
    if (!node) return 0;
    if (node.t === 'f') {
      const d = node.d || '';
      if (d.startsWith('data:')) {
        const i = d.indexOf(',');
        return d.slice(0, i).includes('base64') ? Math.floor((d.length - i - 1) * 3 / 4) : d.length - i - 1;
      }
      return new Blob([d]).size;
    }
    return Object.values(node.c).reduce((a, n) => a + this.size(n), 0);
  }

  stat(path) {
    path = this.resolve(path);
    const n = this.node(path);
    if (!n) return null;
    return {
      name: U.basename(path), path, type: n.t === 'd' ? 'dir' : 'file', isDir: n.t === 'd',
      size: this.size(n), mtime: n.m, count: n.t === 'd' ? Object.keys(n.c).length : 0, origin: n.o,
    };
  }

  list(path, { hidden = false } = {}) {
    path = this.resolve(path);
    const n = this.node(path);
    if (!n) throw new Error(`No such directory: ${path}`);
    if (n.t !== 'd') throw new Error(`Not a directory: ${path}`);
    return Object.keys(n.c)
      .filter(name => hidden || !name.startsWith('.'))
      .map(name => this.stat(U.join(path, name)))
      .sort((a, b) => (b.isDir - a.isDir) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  }

  read(path) {
    const n = this.node(path);
    if (!n) throw new Error(`No such file: ${path}`);
    if (n.t !== 'f') throw new Error(`Is a directory: ${path}`);
    return n.d;
  }

  write(path, data, { createDirs = false } = {}) {
    const { parent, name, dir, path: full } = this._parent(path, createDirs);
    if (!VFS.validName(name)) throw new Error(`Invalid name: ${name}`);
    const ex = parent.c[name];
    if (ex && ex.t === 'd') throw new Error(`Is a directory: ${full}`);
    if (ex) { ex.d = String(data ?? ''); ex.m = Date.now(); }
    else parent.c[name] = VFS.file(String(data ?? ''));
    parent.m = Date.now();
    this.changed(dir, full);
    return full;
  }

  append(path, data) {
    const cur = this.isFile(path) ? this.read(path) : '';
    return this.write(path, cur + data);
  }

  mkdir(path, recursive = false) {
    path = this.resolve(path);
    if (path === '/') return path;
    if (recursive) {
      let cur = '';
      for (const p of path.split('/').filter(Boolean)) {
        cur += '/' + p;
        const n = this.node(cur);
        if (!n) this.mkdir(cur);
        else if (n.t !== 'd') throw new Error(`Not a directory: ${cur}`);
      }
      return path;
    }
    const { parent, name, dir } = this._parent(path);
    if (!VFS.validName(name)) throw new Error(`Invalid name: ${name}`);
    if (parent.c[name]) throw new Error(`Already exists: ${path}`);
    parent.c[name] = VFS.dir();
    parent.m = Date.now();
    this.changed(dir, path);
    return path;
  }

  remove(path) {
    const { parent, name, dir, path: full } = this._parent(path);
    if (!parent.c[name]) throw new Error(`No such file or directory: ${full}`);
    if (full === '/.Trash') throw new Error('Cannot remove the Trash');
    delete parent.c[name];
    parent.m = Date.now();
    this.changed(dir, full);
  }

  move(src, dst) {
    src = this.resolve(src);
    dst = this.resolve(dst);
    if (this.isDir(dst)) dst = U.join(dst, U.basename(src));
    if (src === dst) return dst;
    if (dst.startsWith(src + '/')) throw new Error('Cannot move a folder into itself');
    const s = this._parent(src);
    const node = s.parent.c[s.name];
    if (!node) throw new Error(`No such file or directory: ${src}`);
    const d = this._parent(dst);
    if (!VFS.validName(d.name)) throw new Error(`Invalid name: ${d.name}`);
    if (d.parent.c[d.name]) throw new Error(`Already exists: ${dst}`);
    delete s.parent.c[s.name];
    node.m = Date.now();
    d.parent.c[d.name] = node;
    this.changed(s.dir, d.dir, src, dst);
    return dst;
  }

  rename(path, newName) {
    if (!VFS.validName(newName)) throw new Error(`Invalid name: ${newName}`);
    return this.move(path, U.join(U.dirname(this.resolve(path)), newName));
  }

  copy(src, dst) {
    src = this.resolve(src);
    dst = this.resolve(dst);
    if (this.isDir(dst)) dst = U.join(dst, U.basename(src));
    if (dst.startsWith(src + '/')) throw new Error('Cannot copy a folder into itself');
    const node = this.node(src);
    if (!node) throw new Error(`No such file or directory: ${src}`);
    const d = this._parent(dst);
    if (d.parent.c[d.name]) throw new Error(`Already exists: ${dst}`);
    const clone = JSON.parse(JSON.stringify(node));
    clone.m = Date.now();
    delete clone.o;
    d.parent.c[d.name] = clone;
    this.changed(d.dir, dst);
    return dst;
  }

  /** "name.txt" -> "name (2).txt" if taken */
  uniqueName(dir, name) {
    if (!this.exists(U.join(dir, name))) return name;
    const e = U.ext(name), base = e ? name.slice(0, -(e.length + 1)) : name;
    for (let i = 2; ; i++) {
      const cand = `${base} (${i})${e ? '.' + e : ''}`;
      if (!this.exists(U.join(dir, cand))) return cand;
    }
  }

  trash(path) {
    path = this.resolve(path);
    if (path.startsWith('/.Trash')) { this.remove(path); return null; }
    const name = this.uniqueName('/.Trash', U.basename(path));
    const dst = this.move(path, U.join('/.Trash', name));
    this.node(dst).o = path;
    this._save();
    return dst;
  }

  restore(trashPath) {
    const n = this.node(trashPath);
    if (!n) throw new Error('Not found');
    const orig = n.o || U.join('/', U.basename(trashPath));
    const dir = U.dirname(orig);
    this.mkdir(dir, true);
    const dst = U.join(dir, this.uniqueName(dir, U.basename(orig)));
    this.move(trashPath, dst);
    delete this.node(dst).o;
    return dst;
  }

  emptyTrash() {
    this.root.c['.Trash'] = VFS.dir();
    this.changed('/.Trash');
  }

  /** Recursively find entries whose name contains query */
  find(query, start = '/', limit = 200) {
    const q = query.toLowerCase(), out = [];
    const walk = (path, node) => {
      for (const [name, child] of Object.entries(node.c)) {
        if (out.length >= limit) return;
        if (name === '.Trash') continue;
        const p = U.join(path, name);
        if (name.toLowerCase().includes(q)) out.push(this.stat(p));
        if (child.t === 'd') walk(p, child);
      }
    };
    const s = this.node(start);
    if (s && s.t === 'd') walk(this.resolve(start), s);
    return out;
  }

  usage() { return this.size(this.root); }

  /** Import host File objects into a directory */
  async importFiles(files, dir) {
    const out = [];
    for (const file of files) {
      try {
        const data = await U.readHostFile(file);
        const name = this.uniqueName(dir, file.name);
        out.push(this.write(U.join(dir, name), data));
      } catch (e) {
        OS.notify({ title: 'Import failed', body: `${file.name}: ${e.message}` });
      }
    }
    return out;
  }
}

OS.VFS = VFS;
