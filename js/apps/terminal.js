/* Terminal — a bash-like shell over the virtual file system */
'use strict';

OS.registerApp({
  id: 'terminal', name: 'Terminal', icon: 'terminal', category: 'System', width: 760, height: 460,
  desc: 'Command line shell', keywords: 'shell bash console cli command prompt',
  exts: ['sh'],
  launch(win, args) {
    const fs = OS.fs;
    let cwd = args.cwd && fs.isDir(args.cwd) ? args.cwd : '/';
    const hist = OS.data.get('term.history', []);
    let hpos = hist.length, busy = false, cancel = null;
    const env = { USER: OS.user.username, HOME: '/', SHELL: '/bin/wsh', OS: OS.name };
    const aliases = Object.assign({ ll: 'ls -l', la: 'ls -a', cls: 'clear', dir: 'ls', nano: 'edit', vi: 'edit', vim: 'edit', type: 'cat', del: 'rm', copy: 'cp', move: 'mv', md: 'mkdir' }, OS.data.get('term.aliases', {}));

    const out = U.h('div', { class: 'term-out' });
    const promptEl = U.h('span', { class: 'term-prompt' });
    const inp = U.h('input', { class: 'term-in', spellcheck: false, autocomplete: 'off', autocapitalize: 'off' });
    const line = U.h('div', { class: 'term-line' }, promptEl, inp);
    const screen = U.h('div', { class: 'term' }, out, line);
    win.body.append(screen);
    screen.addEventListener('mouseup', () => { if (!window.getSelection().toString()) inp.focus(); });
    win.onFocus = () => setTimeout(() => inp.focus(), 0);

    const host = 'webos';
    const short = p => p;
    function setPrompt() {
      promptEl.innerHTML = `<span class="t-green">${U.esc(OS.user.username)}@${host}</span>:<span class="t-blue">${U.esc(short(cwd))}</span>$&nbsp;`;
    }
    function print(text, cls) {
      const el = U.h('div', { class: 'term-row' + (cls ? ' ' + cls : '') });
      if (typeof text === 'string') el.textContent = text; else el.append(text);
      out.appendChild(el);
      if (out.childElementCount > 2000) out.firstChild.remove();
      screen.scrollTop = screen.scrollHeight;
    }
    function printHTML(html) {
      const el = U.h('div', { class: 'term-row', html });
      out.appendChild(el);
      screen.scrollTop = screen.scrollHeight;
    }

    /* ---------- argument parsing ---------- */
    function tokenize(str) {
      const toks = [];
      let cur = '', q = null, has = false;
      for (let i = 0; i < str.length; i++) {
        const c = str[i];
        if (q) {
          if (c === q) q = null;
          else if (c === '\\' && q === '"' && i + 1 < str.length) cur += str[++i];
          else cur += c;
        } else if (c === '"' || c === "'") { q = c; has = true; }
        else if (c === '\\' && i + 1 < str.length) { cur += str[++i]; has = true; }
        else if (/\s/.test(c)) { if (cur || has) toks.push(cur); cur = ''; has = false; }
        else if (c === '|' || c === '>' || c === ';' || c === '&') {
          if (cur || has) toks.push(cur);
          cur = ''; has = false;
          if (c === '>' && str[i + 1] === '>') { toks.push({ op: '>>' }); i++; }
          else if (c === '&' && str[i + 1] === '&') { toks.push({ op: '&&' }); i++; }
          else toks.push({ op: c });
        } else { cur += c; has = true; }
      }
      if (q) throw new Error('unterminated quote');
      if (cur || has) toks.push(cur);
      return toks;
    }
    const expand = s => s.replace(/\$(\w+)/g, (m, k) => env[k] ?? '').replace(/^~(?=\/|$)/, '/');
    function flags(argv) {
      const f = new Set(), rest = [];
      for (const a of argv) {
        if (/^-[a-zA-Z]+$/.test(a)) [...a.slice(1)].forEach(c => f.add(c));
        else if (a.startsWith('--')) f.add(a.slice(2));
        else rest.push(a);
      }
      return { f, rest };
    }
    const R = p => fs.resolve(expand(p), cwd);
    function glob(arg) {
      if (!/[*?]/.test(arg)) return [arg];
      const dir = arg.includes('/') ? arg.slice(0, arg.lastIndexOf('/') + 1) : '';
      const pat = arg.slice(dir.length);
      const re = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
      try {
        const m = fs.list(R(dir || '.')).filter(s => re.test(s.name)).map(s => dir + s.name);
        return m.length ? m : [arg];
      } catch { return [arg]; }
    }

    /* ---------- commands ---------- */
    const C = {};
    const help = {};
    const def = (name, desc, fn) => { C[name] = fn; help[name] = desc; };

    def('help', 'List available commands', (a, io) => {
      io.print('WebOS shell — available commands:', 't-bold');
      const names = Object.keys(help).sort();
      const w = Math.max(...names.map(n => n.length)) + 2;
      names.forEach(n => io.print('  ' + n.padEnd(w) + help[n]));
      io.print('');
      io.print('Supports pipes (|), redirection (> >>), && and ;, wildcards (*), $VARS, Tab completion and ↑/↓ history.', 't-dim');
    });
    def('man', 'Show help for a command', (a, io) => io.print(a[0] && help[a[0]] ? `${a[0]} — ${help[a[0]]}` : 'usage: man <command>'));
    def('clear', 'Clear the screen', () => { out.innerHTML = ''; });
    def('echo', 'Print text', (a, io) => io.print(a.join(' ')));
    def('pwd', 'Print working directory', (a, io) => io.print(cwd));
    def('cd', 'Change directory', a => {
      const p = R(a[0] || '/');
      if (!fs.isDir(p)) throw new Error(`cd: ${a[0]}: No such directory`);
      cwd = p; setPrompt();
    });
    def('ls', 'List directory contents (-l long, -a all)', (a, io) => {
      const { f, rest } = flags(a);
      const targets = rest.length ? rest.flatMap(glob) : ['.'];
      for (const t of targets) {
        const p = R(t);
        const st = fs.stat(p);
        if (!st) throw new Error(`ls: cannot access '${t}': No such file or directory`);
        const items = st.isDir ? fs.list(p, { hidden: f.has('a') }) : [st];
        if (targets.length > 1) io.print(t + ':', 't-bold');
        if (f.has('l')) {
          io.print(`total ${items.length}`);
          items.forEach(i => io.print(`${i.isDir ? 'd' : '-'}rw-r--r--  ${OS.user.username}  ${String(i.isDir ? i.count : i.size).padStart(9)}  ${new Date(i.mtime).toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}  ${i.name}${i.isDir ? '/' : ''}`, i.isDir ? 't-blue' : ''));
        } else {
          const el = U.h('div', { class: 'term-grid' });
          items.forEach(i => el.appendChild(U.h('span', { class: i.isDir ? 't-blue t-bold' : U.imageExts.includes(U.ext(i.name)) ? 't-magenta' : U.ext(i.name) === 'sh' ? 't-green' : '' }, i.name + (i.isDir ? '/' : ''))));
          io.print(el, null, items.map(i => i.name).join('\n'));
        }
      }
    });
    def('cat', 'Print file contents', (a, io) => {
      if (!a.length) { io.print(io.stdin); return; }
      a.flatMap(glob).forEach(f => {
        const d = fs.read(R(f));
        io.print(d.startsWith('data:') ? `[binary file ${U.basename(f)}, ${U.fmtBytes(fs.stat(R(f)).size)}]` : d.replace(/\n$/, ''));
      });
    });
    def('touch', 'Create empty file / update timestamp', a => a.forEach(f => { const p = R(f); fs.isFile(p) ? fs.write(p, fs.read(p)) : fs.write(p, ''); }));
    def('mkdir', 'Create directory (-p parents)', a => { const { f, rest } = flags(a); rest.forEach(d => fs.mkdir(R(d), f.has('p'))); });
    def('rmdir', 'Remove empty directory', a => a.forEach(d => { const p = R(d); if (!fs.isDir(p)) throw new Error(`rmdir: ${d}: Not a directory`); if (fs.list(p, { hidden: true }).length) throw new Error(`rmdir: ${d}: Directory not empty`); fs.remove(p); }));
    def('rm', 'Remove files (-r recursive, -f force)', a => {
      const { f, rest } = flags(a);
      rest.flatMap(glob).forEach(x => {
        const p = R(x);
        if (!fs.exists(p)) { if (!f.has('f')) throw new Error(`rm: cannot remove '${x}': No such file or directory`); return; }
        if (fs.isDir(p) && !f.has('r') && !f.has('R')) throw new Error(`rm: cannot remove '${x}': Is a directory (use -r)`);
        if (p === '/' || p === '/.Trash') throw new Error(`rm: refusing to remove '${x}'`);
        fs.remove(p);
      });
    });
    def('mv', 'Move / rename', a => {
      if (a.length < 2) throw new Error('usage: mv <src...> <dest>');
      const dest = a.pop();
      a.flatMap(glob).forEach(s => fs.move(R(s), R(dest)));
    });
    def('cp', 'Copy files (-r for folders)', a => {
      const { rest } = flags(a);
      if (rest.length < 2) throw new Error('usage: cp <src...> <dest>');
      const dest = rest.pop();
      rest.flatMap(glob).forEach(s => fs.copy(R(s), R(dest)));
    });
    def('tree', 'Show directory tree', (a, io) => {
      const start = R(a[0] || '.');
      io.print(a[0] || '.', 't-blue');
      let nd = 0, nf = 0;
      const walk = (p, pre) => {
        const items = fs.list(p);
        items.forEach((it, i) => {
          const last = i === items.length - 1;
          io.print(pre + (last ? '└── ' : '├── ') + it.name, it.isDir ? 't-blue' : '');
          if (it.isDir) { nd++; walk(it.path, pre + (last ? '    ' : '│   ')); } else nf++;
        });
      };
      walk(start, '');
      io.print(`\n${nd} directories, ${nf} files`);
    });
    def('find', 'Find files by name: find [dir] <name>', (a, io) => {
      const [dir, q] = a.length > 1 ? a : ['.', a[0] || ''];
      fs.find(q.replace(/\*/g, ''), R(dir), 1000).forEach(s => io.print(s.path));
    });
    def('grep', 'Search text: grep [-i] [-n] <pattern> [files]', (a, io) => {
      const { f, rest } = flags(a);
      const pat = rest.shift();
      if (pat == null) throw new Error('usage: grep <pattern> [file...]');
      const re = new RegExp(pat, f.has('i') ? 'i' : '');
      const scan = (text, label) => text.split('\n').forEach((l, i) => { if (re.test(l)) io.print((label ? label + ':' : '') + (f.has('n') ? (i + 1) + ':' : '') + l); });
      if (!rest.length) scan(io.stdin);
      else rest.flatMap(glob).forEach(x => scan(fs.read(R(x)), rest.length > 1 ? x : ''));
    });
    const textOf = (a, io) => (a.length ? a.flatMap(glob).map(x => fs.read(R(x))).join('\n') : io.stdin);
    def('head', 'First lines: head [-n N] [file]', (a, io) => { let n = 10; if (a[0] === '-n') { n = +a[1]; a = a.slice(2); } io.print(textOf(a, io).split('\n').slice(0, n).join('\n')); });
    def('tail', 'Last lines: tail [-n N] [file]', (a, io) => { let n = 10; if (a[0] === '-n') { n = +a[1]; a = a.slice(2); } io.print(textOf(a, io).replace(/\n$/, '').split('\n').slice(-n).join('\n')); });
    def('wc', 'Count lines, words, chars', (a, io) => { const t = textOf(a, io); io.print(`${t.split('\n').length - (t.endsWith('\n') ? 1 : 0)} ${(t.match(/\S+/g) || []).length} ${t.length}`); });
    def('sort', 'Sort lines (-r reverse, -n numeric)', (a, io) => { const { f, rest } = flags(a); let l = textOf(rest, io).replace(/\n$/, '').split('\n'); l.sort(f.has('n') ? (x, y) => parseFloat(x) - parseFloat(y) : (x, y) => x.localeCompare(y)); if (f.has('r')) l.reverse(); io.print(l.join('\n')); });
    def('uniq', 'Remove duplicate adjacent lines', (a, io) => io.print(textOf(a, io).split('\n').filter((l, i, arr) => l !== arr[i - 1]).join('\n')));
    def('rev', 'Reverse each line', (a, io) => io.print(textOf(a, io).split('\n').map(l => [...l].reverse().join('')).join('\n')));
    def('tr', 'Translate chars: tr <from> <to>', (a, io) => { const [x, y] = a; io.print([...io.stdin].map(c => { const i = (x || '').indexOf(c); return i >= 0 ? (y || '')[Math.min(i, y.length - 1)] : c; }).join('')); });
    def('seq', 'Print a sequence: seq [start] end', (a, io) => { const [s, e] = a.length > 1 ? [+a[0], +a[1]] : [1, +a[0]]; const r = []; for (let i = s; i <= e && r.length < 10000; i++) r.push(i); io.print(r.join('\n')); });
    def('base64', 'Encode/decode base64 (-d)', (a, io) => { const { f, rest } = flags(a); const t = rest.length ? rest.join(' ') : io.stdin; io.print(f.has('d') ? decodeURIComponent(escape(atob(t.trim()))) : btoa(unescape(encodeURIComponent(t)))); });
    def('date', 'Show date and time', (a, io) => io.print(new Date().toString()));
    def('cal', 'Show calendar for this month', (a, io) => {
      const n = new Date(), y = n.getFullYear(), m = n.getMonth();
      io.print(n.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }).padStart(14 + 6), 't-bold');
      io.print('Su Mo Tu We Th Fr Sa');
      const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
      let row = '   '.repeat(first);
      for (let d = 1; d <= days; d++) {
        row += String(d).padStart(2) + ' ';
        if ((first + d) % 7 === 0 || d === days) { io.print(row.trimEnd()); row = ''; }
      }
    });
    def('whoami', 'Current user', (a, io) => io.print(OS.user.username));
    def('hostname', 'Host name', (a, io) => io.print(host));
    def('uname', 'System information', (a, io) => io.print(a.includes('-a') ? `${OS.name} ${host} ${OS.version} ${navigator.platform || 'web'} JavaScript` : OS.name));
    def('uptime', 'Time since boot', (a, io) => io.print(`up ${U.fmtDuration((Date.now() - OS.bootTime) / 1000)}, 1 user, ${OS.wm.list().length} windows`));
    def('history', 'Command history (-c to clear)', (a, io) => { if (a[0] === '-c') { hist.length = 0; OS.data.set('term.history', hist); return; } hist.forEach((h, i) => io.print(String(i + 1).padStart(4) + '  ' + h)); });
    def('env', 'Environment variables', (a, io) => Object.entries(env).forEach(([k, v]) => io.print(`${k}=${v}`)));
    def('export', 'Set variable: export NAME=value', a => a.forEach(x => { const [k, ...v] = x.split('='); env[k] = v.join('='); }));
    def('alias', 'Define alias: alias name="command"', (a, io) => {
      if (!a.length) { Object.entries(aliases).forEach(([k, v]) => io.print(`alias ${k}='${v}'`)); return; }
      a.forEach(x => { const [k, ...v] = x.split('='); aliases[k] = v.join('='); });
      const custom = OS.data.get('term.aliases', {}); a.forEach(x => { const [k, ...v] = x.split('='); custom[k] = v.join('='); }); OS.data.set('term.aliases', custom);
    });
    def('open', 'Open a file, folder or app', a => {
      if (!a.length) throw new Error('usage: open <file|folder|app>');
      a.forEach(x => {
        const p = R(x);
        if (fs.exists(p)) OS.openFile(p);
        else if (OS.apps[x]) OS.launch(x);
        else throw new Error(`open: ${x}: not found`);
      });
    });
    def('edit', 'Edit a file in Notepad', a => { const p = R(a[0] || 'untitled.txt'); if (!fs.exists(p)) fs.write(p, ''); OS.launch(U.ext(p) && ['js', 'html', 'css', 'json', 'py'].includes(U.ext(p)) ? 'code' : 'notepad', { path: p }); });
    def('code', 'Open file/folder in Code Studio', a => OS.launch('code', a[0] ? { path: R(a[0]) } : {}));
    def('apps', 'List installed apps', (a, io) => Object.values(OS.apps).sort((x, y) => x.name.localeCompare(y.name)).forEach(x => io.print(`${x.id.padEnd(14)}${x.name.padEnd(16)}${x.category}`)));
    def('run', 'Launch an app by id: run <app>', a => { if (!OS.apps[a[0]]) throw new Error(`run: unknown app '${a[0] || ''}' (see 'apps')`); OS.launch(a[0], a[1] ? { path: R(a[1]) } : {}); });
    def('ps', 'List running windows', (a, io) => { io.print('PID      APP           TITLE'); OS.wm.list().forEach(w => io.print(`${w.id.slice(-6).padEnd(9)}${(w.app || '-').padEnd(14)}${w.title}`)); });
    def('kill', 'Close a window by PID or app id', a => a.forEach(x => { const w = OS.wm.list().filter(w => w.id.endsWith(x) || w.app === x); if (!w.length) throw new Error(`kill: (${x}) - No such process`); w.forEach(k => k !== win && k.close(true)); }));
    def('theme', 'Set theme: theme dark|light', a => { if (!['dark', 'light'].includes(a[0])) throw new Error('usage: theme dark|light'); OS.settings.set('theme', a[0]); });
    def('wallpaper', 'Set wallpaper preset or image path', (a, io) => {
      if (!a[0]) { io.print('Presets: ' + Object.keys(OS.wallpapers).join(', ')); return; }
      if (OS.wallpapers[a[0]]) OS.settings.set('wallpaper', { type: 'preset', value: a[0] });
      else if (fs.isFile(R(a[0]))) OS.settings.set('wallpaper', { type: 'image', path: R(a[0]) });
      else throw new Error('wallpaper: unknown preset or file');
    });
    def('calc', 'Evaluate a math expression', (a, io) => {
      const expr = a.join(' ').replace(/\^/g, '**');
      if (!/^[\d\s+\-*/().%e,]*$|Math\./.test(expr.replace(/\b(sqrt|sin|cos|tan|log|abs|PI|E|pow|floor|ceil|round|min|max)\b/g, ''))) throw new Error('calc: invalid expression');
      const v = Function('with(Math){return (' + expr + ')}')();
      io.print(String(v));
    });
    C.bc = C.calc;
    def('js', 'Evaluate JavaScript', (a, io) => {
      const r = (0, eval)(a.join(' '));
      io.print(typeof r === 'object' ? JSON.stringify(r, null, 2) ?? String(r) : String(r));
    });
    def('download', 'Download a file to your computer', a => a.forEach(x => OS.fileOps.download(R(x))));
    def('upload', 'Upload files from your computer here', async (a, io) => {
      const files = await U.pickHostFiles();
      const added = await fs.importFiles(files, cwd);
      added.forEach(p => io.print('uploaded ' + U.basename(p), 't-green'));
    });
    def('sleep', 'Wait N seconds', a => new Promise((res, rej) => { const t = setTimeout(res, (+a[0] || 1) * 1000); cancel = () => { clearTimeout(t); rej(new Error('^C')); }; }));
    def('curl', 'Fetch a URL (CORS permitting)', async (a, io) => {
      if (!a[0]) throw new Error('usage: curl <url>');
      const url = /^https?:/.test(a[0]) ? a[0] : 'https://' + a[0];
      const r = await fetch(url);
      io.print((await r.text()).slice(0, 20000));
    });
    def('neofetch', 'System info with style', (a, io) => {
      const logo = ['  ▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄ ', '  ███████  ███████ ', '  ███████  ███████ ', '  ▀▀▀▀▀▀▀  ▀▀▀▀▀▀▀ ', '  ▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄ ', '  ███████  ███████ ', '  ███████  ███████ ', '  ▀▀▀▀▀▀▀  ▀▀▀▀▀▀▀ ', '', ''];
      const info = [
        `<span class="t-blue t-bold">${U.esc(OS.user.username)}</span>@<span class="t-blue t-bold">${host}</span>`,
        '-----------------',
        `<span class="t-blue">OS</span>: ${OS.name} ${OS.version}`,
        `<span class="t-blue">Host</span>: ${U.esc(navigator.userAgent.match(/(Firefox|Edg|Chrome|Safari)\/[\d.]+/)?.[0] || 'Browser')}`,
        `<span class="t-blue">Uptime</span>: ${U.fmtDuration((Date.now() - OS.bootTime) / 1000)}`,
        `<span class="t-blue">Apps</span>: ${Object.keys(OS.apps).length}`,
        `<span class="t-blue">Shell</span>: wsh 1.0`,
        `<span class="t-blue">Resolution</span>: ${window.screen.width}x${window.screen.height}`,
        `<span class="t-blue">Theme</span>: ${OS.settings.get('theme')}`,
        `<span class="t-blue">Disk</span>: ${U.fmtBytes(fs.usage())} used`,
      ];
      logo.forEach((l, i) => io.html(`<span class="t-cyan">${l.padEnd(20)}</span>${info[i] || ''}`, l + ' ' + (info[i] || '').replace(/<[^>]+>/g, '')));
      io.html('<span style="background:#e11d48">   </span><span style="background:#16a34a">   </span><span style="background:#eab308">   </span><span style="background:#2563eb">   </span><span style="background:#9333ea">   </span><span style="background:#0891b2">   </span><span style="background:#e5e7eb">   </span>'.padStart(0), '');
    });
    const FORTUNES = ['The best way to predict the future is to invent it. — Alan Kay', 'Simplicity is prerequisite for reliability. — Edsger Dijkstra', 'Talk is cheap. Show me the code. — Linus Torvalds', 'Programs must be written for people to read. — Harold Abelson', 'First, solve the problem. Then, write the code. — John Johnson', 'Any sufficiently advanced technology is indistinguishable from magic. — Arthur C. Clarke', 'It works on my machine. — Every developer', 'There are only two hard things in computer science: cache invalidation and naming things.', 'Weeks of coding can save you hours of planning.', 'Have you tried turning it off and on again?'];
    def('fortune', 'Random quote', (a, io) => io.print(FORTUNES[U.rand(0, FORTUNES.length - 1)]));
    def('cowsay', 'A talking cow', (a, io) => {
      const msg = a.join(' ') || io.stdin.trim() || 'Moo!';
      io.print(` ${'_'.repeat(msg.length + 2)}\n< ${msg} >\n ${'-'.repeat(msg.length + 2)}\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||`);
    });
    def('matrix', 'Enter the matrix (Ctrl+C to exit)', () => new Promise((res) => {
      const cv = U.h('canvas', { class: 'term-matrix' });
      screen.appendChild(cv);
      const ctx = cv.getContext('2d');
      cv.width = screen.clientWidth; cv.height = screen.clientHeight;
      const cols = Math.floor(cv.width / 14), drops = Array(cols).fill(0).map(() => U.rand(-30, 0));
      const stop = win.loop(() => {
        ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.fillStyle = '#22c55e'; ctx.font = '14px monospace';
        drops.forEach((y, i) => {
          ctx.fillText(String.fromCharCode(0x30A0 + U.rand(0, 95)), i * 14, y * 14);
          drops[i] = y * 14 > cv.height && Math.random() > 0.975 ? 0 : y + 1;
        });
      });
      cancel = () => { stop(); cv.remove(); res(); };
    }));
    def('exit', 'Close the terminal', () => win.close());
    def('lock', 'Lock the screen', () => OS.session.lock());
    def('logout', 'Sign out', () => OS.session.logout());
    def('reboot', 'Restart WebOS', () => OS.session.power('restart'));
    def('shutdown', 'Shut down WebOS', () => OS.session.power('shutdown'));
    def('sh', 'Run a shell script file', async (a, io) => {
      const script = fs.read(R(a[0]));
      for (const l of script.split('\n')) { if (l.trim() && !l.trim().startsWith('#')) await execLine(l, io); }
    });

    /* ---------- execution ---------- */
    function makeIO(stdin) {
      const segs = [];
      return {
        stdin: stdin || '',
        segs,
        print(text, cls, plain) { segs.push({ text, cls, plain: plain ?? (typeof text === 'string' ? text : text.textContent) }); },
        html(h, plain) { segs.push({ html: h, plain }); },
        get text() { return segs.map(s => s.plain).join('\n'); },
      };
    }
    function flush(io) {
      io.segs.forEach(s => s.html != null ? printHTML(s.html) : print(s.text, s.cls));
    }

    async function runPipeline(cmds, redirect) {
      let stdin = '', io;
      for (let i = 0; i < cmds.length; i++) {
        let [name, ...argv] = cmds[i];
        if (aliases[name]) { const t = tokenize(aliases[name]); name = t[0]; argv = [...t.slice(1), ...argv]; }
        argv = argv.map(expand);
        if (/^\w+=/.test(name) && !argv.length) { const [k, ...v] = name.split('='); env[k] = v.join('='); return; }
        const fn = C[name];
        if (!fn) {
          if (fs.isFile(R(name)) && U.ext(name) === 'sh') { io = makeIO(stdin); await C.sh([name], io); stdin = io.text; continue; }
          throw new Error(`${name}: command not found. Type 'help' for a list of commands.`);
        }
        io = makeIO(stdin);
        await fn(argv, io);
        stdin = io.text;
      }
      if (redirect) {
        const p = R(redirect.file);
        const text = io.text + (io.text ? '\n' : '');
        redirect.op === '>>' ? fs.append(p, text) : fs.write(p, text);
      } else if (io) flush(io);
    }

    async function execLine(lineStr, ioParent) {
      const toks = tokenize(lineStr.trim());
      // split on ; and &&
      const groups = [];
      let cur = [], sep = ';';
      for (const t of toks) {
        if (t && t.op && (t.op === ';' || t.op === '&&')) { groups.push({ toks: cur, sep }); cur = []; sep = t.op; }
        else cur.push(t);
      }
      groups.push({ toks: cur, sep });
      let ok = true;
      for (const g of groups) {
        if (g.sep === '&&' && !ok) continue;
        if (!g.toks.length) continue;
        const cmds = [[]];
        let redirect = null;
        for (let i = 0; i < g.toks.length; i++) {
          const t = g.toks[i];
          if (t && t.op === '|') cmds.push([]);
          else if (t && (t.op === '>' || t.op === '>>')) { redirect = { op: t.op, file: g.toks[++i] }; if (typeof redirect.file !== 'string') throw new Error('syntax error near redirection'); }
          else if (typeof t === 'string') cmds[cmds.length - 1].push(...(cmds[cmds.length - 1].length ? glob(expand(t)) : [t]));
        }
        try { await runPipeline(cmds.filter(c => c.length), redirect); ok = true; }
        catch (e) { ok = false; if (ioParent) throw e; print(e.message, e.message === '^C' ? 't-dim' : 't-red'); }
      }
    }

    async function submit() {
      const v = inp.value;
      inp.value = '';
      printHTML(promptEl.innerHTML + U.esc(v));
      if (v.trim()) {
        if (hist[hist.length - 1] !== v) { hist.push(v); if (hist.length > 300) hist.shift(); OS.data.set('term.history', hist); }
      }
      hpos = hist.length;
      if (!v.trim()) return;
      busy = true;
      line.style.visibility = 'hidden';
      try { await execLine(v); }
      catch (e) { print(e.message, 't-red'); }
      busy = false;
      cancel = null;
      line.style.visibility = '';
      setPrompt();
      inp.focus();
      screen.scrollTop = screen.scrollHeight;
    }

    function complete() {
      const v = inp.value.slice(0, inp.selectionStart);
      const parts = v.split(/\s+/);
      const word = parts[parts.length - 1];
      let cands;
      if (parts.length === 1) cands = [...Object.keys(C), ...Object.keys(aliases)].filter(c => c.startsWith(word)).map(c => c + ' ');
      else {
        const dirPart = word.includes('/') ? word.slice(0, word.lastIndexOf('/') + 1) : '';
        const base = word.slice(dirPart.length);
        try {
          cands = fs.list(R(dirPart || '.'), { hidden: base.startsWith('.') }).filter(s => s.name.toLowerCase().startsWith(base.toLowerCase())).map(s => dirPart + (s.name.includes(' ') ? s.name.replace(/ /g, '\\ ') : s.name) + (s.isDir ? '/' : ' '));
        } catch { cands = []; }
      }
      if (cands.length === 1) {
        inp.value = v.slice(0, v.length - word.length) + cands[0] + inp.value.slice(inp.selectionStart);
      } else if (cands.length > 1) {
        let pre = cands[0];
        cands.forEach(c => { while (!c.startsWith(pre)) pre = pre.slice(0, -1); });
        if (pre.length > word.length) inp.value = v.slice(0, v.length - word.length) + pre;
        else { printHTML(promptEl.innerHTML + U.esc(inp.value)); print(cands.map(c => c.trim()).join('   '), 't-dim'); }
      }
    }

    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); if (!busy) submit(); }
      else if (e.key === 'Tab') { e.preventDefault(); complete(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (hpos > 0) { inp.value = hist[--hpos]; setTimeout(() => inp.setSelectionRange(inp.value.length, inp.value.length)); } }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (hpos < hist.length - 1) inp.value = hist[++hpos]; else { hpos = hist.length; inp.value = ''; } }
      else if (e.ctrlKey && e.key === 'l') { e.preventDefault(); out.innerHTML = ''; }
      else if (e.ctrlKey && e.key === 'c' && !window.getSelection().toString()) { e.preventDefault(); printHTML(promptEl.innerHTML + U.esc(inp.value) + '^C'); inp.value = ''; }
    });
    win.onKey(e => { if (busy && e.ctrlKey && e.key === 'c' && cancel) { e.preventDefault(); cancel(); } });

    setPrompt();
    printHTML(`<span class="t-cyan t-bold">${OS.name} Terminal</span> <span class="t-dim">v${OS.version}</span>`);
    print(`Type 'help' to see available commands.`, 't-dim');
    print('');
    if (args.cmd) { inp.value = args.cmd; submit(); }
    setTimeout(() => inp.focus(), 50);
  },
});
