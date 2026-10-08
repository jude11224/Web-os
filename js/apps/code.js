/* Code Studio — code editor with syntax highlighting, tabs, file tree, live HTML preview and JS console */
'use strict';

(() => {
  const KW_JS = 'const|let|var|function|return|if|else|for|while|do|break|continue|new|class|extends|import|from|export|default|try|catch|finally|throw|typeof|instanceof|in|of|async|await|switch|case|this|super|yield|delete|void|static|get|set';
  const KW_PY = 'def|class|return|if|elif|else|for|while|break|continue|import|from|as|try|except|finally|raise|with|lambda|pass|yield|global|nonlocal|in|is|not|and|or|async|await|del|assert';
  const LANGS = {
    js: [
      [/\/\/.*|\/\*[\s\S]*?\*\//, 'c'],
      [/`(?:\\[\s\S]|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/, 's'],
      [new RegExp(`\\b(?:${KW_JS})\\b`), 'k'],
      [/\b(?:true|false|null|undefined|NaN|Infinity)\b/, 'n'],
      [/\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b|\b0x[\da-f]+\b/i, 'n'],
      [/\b[A-Za-z_$][\w$]*(?=\s*\()/, 'f'],
      [/\b[A-Z][\w$]*\b/, 't'],
    ],
    json: [
      [/"(?:\\.|[^"\\\n])*"(?=\s*:)/, 'p'],
      [/"(?:\\.|[^"\\\n])*"/, 's'],
      [/\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/i, 'n'],
    ],
    css: [
      [/\/\*[\s\S]*?\*\//, 'c'],
      [/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/, 's'],
      [/@[\w-]+/, 'k'],
      [/#[\da-f]{3,8}\b/i, 'n'],
      [/[\w-]+(?=\s*:[^{}]*;)/, 'p'],
      [/-?\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms|deg|fr)?\b/, 'n'],
      [/[.#]?[\w-]+(?=[^{};]*\{)/, 't'],
    ],
    html: [
      [/<!--[\s\S]*?-->/, 'c'],
      [/<!DOCTYPE[^>]*>/i, 'c'],
      [/<\/?[\w-]+/, 'k'],
      [/\/?>/, 'k'],
      [/"[^"]*"|'[^']*'/, 's'],
      [/\b[\w-:@]+(?==)/, 'p'],
    ],
    py: [
      [/#.*/, 'c'],
      [/"""[\s\S]*?"""|'''[\s\S]*?'''|f?"(?:\\.|[^"\\\n])*"|f?'(?:\\.|[^'\\\n])*'/, 's'],
      [new RegExp(`\\b(?:${KW_PY})\\b`), 'k'],
      [/\b(?:True|False|None|self)\b|\b\d+(?:\.\d+)?\b/, 'n'],
      [/\b[A-Za-z_]\w*(?=\s*\()/, 'f'],
    ],
    md: [
      [/^#{1,6} .*/m, 'k'],
      [/`[^`\n]+`/, 's'],
      [/\*\*[^*\n]+\*\*|\*[^*\n]+\*/, 'p'],
      [/^\s*(?:[-*+]|\d+\.) /m, 'n'],
      [/\[[^\]\n]*\]\([^)\n]*\)/, 'f'],
    ],
  };
  const LANG_OF = { js: 'js', mjs: 'js', ts: 'js', json: 'json', css: 'css', html: 'html', htm: 'html', svg: 'html', xml: 'html', py: 'py', md: 'md' };
  const compiled = {};
  function highlight(code, lang) {
    const rules = LANGS[lang];
    if (!rules) return U.esc(code);
    if (!compiled[lang]) compiled[lang] = new RegExp(rules.map(r => `(${r[0].source})`).join('|'), 'gm' + (rules.some(r => r[0].flags.includes('i')) ? 'i' : ''));
    const re = compiled[lang];
    re.lastIndex = 0;
    let out = '', last = 0, m;
    while ((m = re.exec(code))) {
      if (m[0] === '') { re.lastIndex++; continue; }
      let gi = 1;
      while (m[gi] === undefined) gi++;
      out += U.esc(code.slice(last, m.index)) + `<span class="hl-${rules[gi - 1][1]}">${U.esc(m[0])}</span>`;
      last = m.index + m[0].length;
    }
    return out + U.esc(code.slice(last));
  }

  // Script injected into previews to forward console output to the editor
  const CONSOLE_HOOK = `<script>(function(){var send=function(t,a){try{parent.postMessage({__webosConsole:1,type:t,args:[].map.call(a,function(x){try{return typeof x==='object'?JSON.stringify(x):String(x)}catch(e){return String(x)}})},'*')}catch(e){}};['log','info','warn','error','debug'].forEach(function(k){var o=console[k];console[k]=function(){send(k,arguments);o&&o.apply(console,arguments)}});window.onerror=function(m,s,l,c){send('error',[m+(l?' (line '+l+')':'')])};window.addEventListener('unhandledrejection',function(e){send('error',['Unhandled rejection: '+(e.reason&&e.reason.message||e.reason)])});window.addEventListener('message',function(e){if(e.data&&e.data.__webosEval!=null){try{var r=(0,eval)(e.data.__webosEval);console.log(r)}catch(err){console.error(err.message)}}});})();<\/script>`;

  OS.registerApp({
    id: 'code', name: 'Code Studio', icon: 'code', category: 'Apps', width: 1000, height: 620, minWidth: 480,
    desc: 'Write and run HTML, CSS and JavaScript', keywords: 'ide programming developer javascript html',
    exts: ['js', 'mjs', 'ts', 'json', 'css', 'html', 'htm', 'py', 'xml', 'md', 'svg', 'c', 'cpp', 'java', 'sh', 'txt'],
    launch(win, args) {
      const fs = OS.fs;
      let docs = [], active = -1, root = args.path ? U.dirname(fs.resolve(args.path)) : '/Documents';
      const expanded = new Set([root]);
      let showPreview = false, showConsole = true;

      const tree = U.h('div', { class: 'cs-tree' });
      const tabs = U.h('div', { class: 'cs-tabs' });
      const gutter = U.h('div', { class: 'cs-gutter' });
      const hl = U.h('pre', { class: 'cs-hl', 'aria-hidden': 'true' });
      const ta = U.h('textarea', { class: 'cs-ta', spellcheck: false, autocapitalize: 'off', autocomplete: 'off', wrap: 'off' });
      const editor = U.h('div', { class: 'cs-editor' }, gutter, U.h('div', { class: 'cs-code' }, hl, ta));
      const empty = U.h('div', { class: 'empty-state' }, 'Open a file from the sidebar or press Ctrl+N for a new file.');
      const iframe = U.h('iframe', { class: 'cs-frame', sandbox: 'allow-scripts allow-modals allow-forms allow-popups' });
      const preview = U.h('div', { class: 'cs-preview', hidden: true }, U.h('div', { class: 'cs-panel-h' }, 'Preview', U.h('button', { class: 'btn small', onclick: run }, '↻')), iframe);
      const cons = U.h('div', { class: 'cs-console-out' });
      const consoleInp = U.h('input', { class: 'cs-console-in', placeholder: '› Evaluate in preview context…' });
      const consolePanel = U.h('div', { class: 'cs-console' }, U.h('div', { class: 'cs-panel-h' }, 'Console', U.h('button', { class: 'btn small', onclick: () => { cons.innerHTML = ''; } }, 'Clear')), cons, consoleInp);
      const status = U.h('div', { class: 'statusbar' });
      const langLbl = U.h('span', { class: 'cs-lang' });

      const runBtn = U.h('button', { class: 'btn primary', onclick: run, title: 'Run (F5)' }, '▶ Run');
      const toolbar = U.h('div', { class: 'toolbar' },
        U.h('button', { class: 'btn', onclick: newDoc, title: 'New file (Ctrl+N)' }, '+ New'),
        U.h('button', { class: 'btn', onclick: openDoc, title: 'Open (Ctrl+O)' }, 'Open'),
        U.h('button', { class: 'btn', onclick: () => save(), title: 'Save (Ctrl+S)' }, 'Save'),
        U.h('button', { class: 'btn', onclick: chooseRoot, title: 'Open folder' }, 'Folder…'),
        U.h('span', { class: 'sep' }),
        runBtn,
        U.h('button', { class: 'btn', onclick: () => { showPreview = !showPreview; layout(); if (showPreview) run(); } }, 'Preview'),
        U.h('button', { class: 'btn', onclick: () => { showConsole = !showConsole; layout(); } }, 'Console'),
        U.h('span', { style: { flex: 1 } }), langLbl);

      win.body.append(toolbar,
        U.h('div', { class: 'app-split cs-split' },
          U.h('div', { class: 'app-side cs-side' }, U.h('div', { class: 'cs-side-h' }, 'EXPLORER'), tree),
          U.h('div', { class: 'cs-center' }, tabs, U.h('div', { class: 'cs-edit-area' }, editor, empty), consolePanel),
          preview),
        status);

      function layout() {
        preview.hidden = !showPreview;
        consolePanel.hidden = !showConsole;
        const d = docs[active];
        editor.hidden = !d;
        empty.hidden = !!d;
      }

      /* ----- file tree ----- */
      function renderTree() {
        tree.innerHTML = '';
        const walk = (dir, depth) => {
          let items = [];
          try { items = fs.list(dir); } catch { return; }
          for (const it of items) {
            const row = U.h('div', {
              class: 'cs-node' + (docs[active] && docs[active].path === it.path ? ' active' : ''),
              style: { paddingLeft: 8 + depth * 14 + 'px' },
              html: (it.isDir ? `<span class="cs-caret">${expanded.has(it.path) ? '▾' : '▸'}</span>` : '<span class="cs-caret"></span>') + OS.icons.tile(OS.icons.forFile(it.name, it.isDir), 16) + `<span>${U.esc(it.name)}</span>`,
            });
            row.onclick = () => {
              if (it.isDir) { expanded.has(it.path) ? expanded.delete(it.path) : expanded.add(it.path); renderTree(); }
              else openPath(it.path);
            };
            row.oncontextmenu = e => {
              e.preventDefault();
              OS.menu(e.clientX, e.clientY, [
                it.isDir ? { label: 'New file here', action: () => OS.fileOps.newFile(it.path, 'untitled.js').then(p => p && openPath(p)) } : { label: 'Open', action: () => openPath(it.path) },
                { label: 'Rename', action: () => OS.fileOps.rename(it.path) },
                { label: 'Delete', action: () => OS.fileOps.remove([it.path]) },
              ]);
            };
            tree.appendChild(row);
            if (it.isDir && expanded.has(it.path)) walk(it.path, depth + 1);
          }
        };
        tree.appendChild(U.h('div', { class: 'cs-root', title: root }, (root === '/' ? 'HOME' : U.basename(root).toUpperCase())));
        walk(root, 0);
      }
      async function chooseRoot() {
        const p = await OS.dialog.file({ mode: 'folder', start: root, title: 'Open Folder' });
        if (p) { root = p; expanded.add(p); renderTree(); }
      }

      /* ----- documents ----- */
      function openPath(p) {
        p = fs.resolve(p);
        const i = docs.findIndex(d => d.path === p);
        if (i >= 0) return activate(i);
        let content;
        try { content = fs.read(p); } catch (e) { return OS.dialog.alert(e.message); }
        docs.push({ path: p, content, dirty: false, scroll: 0, sel: 0 });
        activate(docs.length - 1);
      }
      function newDoc() {
        docs.push({ path: null, name: `untitled-${docs.length + 1}.js`, content: '', dirty: false, scroll: 0, sel: 0 });
        activate(docs.length - 1);
      }
      async function openDoc() {
        const p = await OS.dialog.file({ mode: 'open', start: root });
        if (p) openPath(p);
      }
      function docName(d) { return d.path ? U.basename(d.path) : d.name; }
      function langOf(d) { return LANG_OF[U.ext(docName(d))] || 'text'; }
      function activate(i) {
        const cur = docs[active];
        if (cur) { cur.content = ta.value; cur.scroll = ta.scrollTop; cur.sel = ta.selectionStart; }
        active = i;
        const d = docs[i];
        if (d) {
          ta.value = d.content;
          refresh();
          ta.scrollTop = d.scroll;
          ta.setSelectionRange(d.sel, d.sel);
          setTimeout(() => ta.focus(), 0);
        }
        renderTabs();
        renderTree();
        layout();
        updateTitle();
        if (showPreview) run();
      }
      async function closeDoc(i) {
        const d = docs[i];
        if (i === active) d.content = ta.value;
        if (d.dirty) {
          const r = await OS.dialog.ask(`Save changes to ${docName(d)}?`, { title: 'Code Studio', yes: 'Save', no: "Don't save" });
          if (r === null) return false;
          if (r === 'yes' && !(await save(i))) return false;
        }
        docs.splice(i, 1);
        active = -1;
        activate(Math.min(i, docs.length - 1));
        return true;
      }
      function renderTabs() {
        tabs.innerHTML = '';
        docs.forEach((d, i) => {
          const t = U.h('div', { class: 'cs-tab' + (i === active ? ' active' : ''), title: d.path || 'Unsaved',
            html: OS.icons.tile(OS.icons.forFile(docName(d)), 14) + `<span>${U.esc(docName(d))}</span>` });
          const x = U.h('button', { class: 'cs-tab-x', title: 'Close' }, d.dirty ? '●' : '×');
          x.onclick = e => { e.stopPropagation(); closeDoc(i); };
          t.onclick = () => activate(i);
          t.onauxclick = e => { if (e.button === 1) closeDoc(i); };
          t.appendChild(x);
          tabs.appendChild(t);
        });
      }
      async function save(i = active) {
        const d = docs[i];
        if (!d) return false;
        if (i === active) d.content = ta.value;
        if (!d.path) {
          const p = await OS.dialog.file({ mode: 'save', start: root, name: d.name });
          if (!p) return false;
          d.path = p;
        }
        try {
          fs.write(d.path, d.content);
          d.dirty = false;
          renderTabs(); renderTree(); updateTitle();
          if (showPreview) run();
          return true;
        } catch (e) { OS.dialog.alert(e.message); return false; }
      }
      function updateTitle() {
        const d = docs[active];
        win.setTitle(d ? `${d.dirty ? '• ' : ''}${docName(d)} — Code Studio` : 'Code Studio');
        langLbl.textContent = d ? langOf(d).toUpperCase() : '';
        const canRun = d && ['html', 'js', 'md', 'css'].includes(langOf(d)) || (d && U.ext(docName(d)) === 'svg');
        runBtn.disabled = !canRun;
      }

      /* ----- editor ----- */
      function refresh() {
        const d = docs[active];
        if (!d) return;
        const code = ta.value;
        hl.innerHTML = highlight(code, langOf(d)) + '\n';
        const lines = code.split('\n').length;
        if (gutter._n !== lines) {
          gutter._n = lines;
          gutter.textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
        }
        syncScroll();
        updateStatus();
      }
      function syncScroll() {
        hl.style.transform = `translate(${-ta.scrollLeft}px, ${-ta.scrollTop}px)`;
        gutter.style.transform = `translateY(${-ta.scrollTop}px)`;
      }
      function updateStatus() {
        const before = ta.value.slice(0, ta.selectionStart);
        const ln = before.split('\n').length, col = before.length - before.lastIndexOf('\n');
        const d = docs[active];
        status.textContent = d ? `Ln ${ln}, Col ${col}   •   ${ta.value.split('\n').length} lines   •   Spaces: 2   •   ${d.path || 'unsaved'}` : '';
      }
      ta.addEventListener('input', () => {
        const d = docs[active];
        if (d && !d.dirty) { d.dirty = true; renderTabs(); updateTitle(); }
        refresh();
        if (showPreview && d && langOf(d) !== 'js') liveRun();
      });
      ta.addEventListener('scroll', syncScroll);
      ['click', 'keyup'].forEach(e => ta.addEventListener(e, updateStatus));
      const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
      ta.addEventListener('keydown', e => {
        const s = ta.selectionStart, en = ta.selectionEnd, v = ta.value;
        if (e.key === 'Tab') {
          e.preventDefault();
          if (s !== en && v.slice(s, en).includes('\n')) {
            // indent / outdent block
            const ls = v.lastIndexOf('\n', s - 1) + 1;
            const block = v.slice(ls, en);
            const nb = e.shiftKey ? block.replace(/^ {1,2}/gm, '') : block.replace(/^/gm, '  ');
            ta.setSelectionRange(ls, en);
            document.execCommand('insertText', false, nb);
            ta.setSelectionRange(ls, ls + nb.length);
          } else document.execCommand('insertText', false, '  ');
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const ls = v.lastIndexOf('\n', s - 1) + 1;
          const indent = /^\s*/.exec(v.slice(ls, s))[0];
          const prev = v[s - 1], next = v[s];
          if ((prev === '{' && next === '}') || (prev === '[' && next === ']') || (prev === '(' && next === ')') || (prev === '>' && next === '<')) {
            document.execCommand('insertText', false, '\n' + indent + '  \n' + indent);
            ta.setSelectionRange(s + indent.length + 3, s + indent.length + 3);
          } else document.execCommand('insertText', false, '\n' + indent + (/[{[(:]$/.test(v.slice(ls, s).trimEnd()) ? '  ' : ''));
        } else if (PAIRS[e.key] && s === en && !e.ctrlKey && !e.metaKey) {
          const next = v[s];
          if ((e.key === '"' || e.key === "'" || e.key === '`') && next === e.key) { e.preventDefault(); ta.setSelectionRange(s + 1, s + 1); return; }
          if (next && /\w/.test(next)) return;
          e.preventDefault();
          document.execCommand('insertText', false, e.key + PAIRS[e.key]);
          ta.setSelectionRange(s + 1, s + 1);
        } else if ([')', ']', '}'].includes(e.key) && v[s] === e.key && s === en) {
          e.preventDefault();
          ta.setSelectionRange(s + 1, s + 1);
        } else if (e.key === 'Backspace' && s === en && PAIRS[v[s - 1]] === v[s] && v[s]) {
          e.preventDefault();
          ta.setSelectionRange(s - 1, s + 1);
          document.execCommand('delete');
        } else if ((e.ctrlKey || e.metaKey) && e.key === '/') {
          e.preventDefault();
          const lang = langOf(docs[active]);
          const c = lang === 'py' ? '# ' : lang === 'html' || lang === 'md' ? null : '// ';
          if (!c) return;
          const ls = v.lastIndexOf('\n', s - 1) + 1;
          let le = v.indexOf('\n', en === s ? en : en - 1); if (le < 0) le = v.length;
          const block = v.slice(ls, le);
          const lines = block.split('\n');
          const all = lines.every(l => !l.trim() || l.trimStart().startsWith(c.trim()));
          const nb = lines.map(l => all ? l.replace(new RegExp('^(\\s*)' + c.trim().replace(/\//g, '\\/') + ' ?'), '$1') : (l.trim() ? l.replace(/^(\s*)/, '$1' + c) : l)).join('\n');
          ta.setSelectionRange(ls, le);
          document.execCommand('insertText', false, nb);
        }
      });

      /* ----- running ----- */
      function log(type, args) {
        const line = U.h('div', { class: 'cs-log ' + type }, args.join(' '));
        cons.appendChild(line);
        cons.scrollTop = cons.scrollHeight;
        if (cons.childElementCount > 500) cons.firstChild.remove();
      }
      win.on(window, 'message', e => {
        if (e.source !== iframe.contentWindow || !e.data || !e.data.__webosConsole) return;
        log(e.data.type, e.data.args);
      });
      /** Inline <link href> and <script src> that point to files in the virtual FS */
      function inlineAssets(html, baseDir) {
        html = html.replace(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi, (m, href) => {
          if (/^(https?:)?\/\//.test(href) || !/stylesheet/i.test(m)) return m;
          const p = fs.resolve(href, baseDir);
          return fs.isFile(p) ? `<style>/* ${U.esc(href)} */\n${fs.read(p)}</style>` : m;
        });
        html = html.replace(/<script\b([^>]*)src=["']([^"']+)["']([^>]*)><\/script>/gi, (m, a, src, b) => {
          if (/^(https?:)?\/\//.test(src)) return m;
          const p = fs.resolve(src, baseDir);
          return fs.isFile(p) ? `<script${a}${b}>${fs.read(p).replace(/<\/script/gi, '<\\/script')}<\/script>` : m;
        });
        html = html.replace(/(<img\b[^>]*src=["'])([^"']+)(["'])/gi, (m, a, src, b) => {
          if (/^(https?:|data:|\/\/)/.test(src)) return m;
          const p = fs.resolve(src, baseDir);
          return fs.isFile(p) ? a + fs.read(p) + b : m;
        });
        return html;
      }
      function run() {
        const d = docs[active];
        if (!d) return;
        d.content = ta.value;
        const lang = langOf(d), base = d.path ? U.dirname(d.path) : root;
        let doc;
        if (lang === 'html') {
          const ext = U.ext(docName(d));
          doc = ext === 'svg' ? d.content : CONSOLE_HOOK + inlineAssets(d.content, base);
        } else if (lang === 'js') {
          doc = `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#888">${CONSOLE_HOOK}<script>${d.content.replace(/<\/script/gi, '<\\/script')}\n<\/script></body></html>`;
          showConsole = true;
          log('info', [`▶ Running ${docName(d)}…`]);
        } else if (lang === 'md') {
          doc = `<!DOCTYPE html><html><head><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:20px auto;padding:0 16px;line-height:1.6;color:#222}code{background:#eee;padding:1px 4px;border-radius:3px}pre{background:#eee;padding:10px;overflow:auto}blockquote{border-left:4px solid #ccc;margin:0;padding-left:12px;color:#555}img{max-width:100%}</style></head><body>${U.markdown(d.content)}</body></html>`;
          showPreview = true;
        } else if (lang === 'css') {
          doc = `<!DOCTYPE html><html><head><style>${d.content}</style></head><body><h1>Heading</h1><p>Paragraph with <a href="#">a link</a> and <strong>bold</strong> text.</p><button>Button</button> <input placeholder="Input"><ul><li>List item</li><li>List item</li></ul><div class="box">div.box</div></body></html>`;
          showPreview = true;
        } else return;
        if (lang === 'html') showPreview = true;
        layout();
        iframe.srcdoc = doc;
      }
      const liveRun = U.debounce(run, 600);
      consoleInp.addEventListener('keydown', e => {
        if (e.key !== 'Enter' || !consoleInp.value.trim()) return;
        const code = consoleInp.value;
        log('cmd', ['› ' + code]);
        consoleInp.value = '';
        if (!iframe.contentWindow || !iframe.srcdoc) {
          iframe.srcdoc = `${CONSOLE_HOOK}<script>try{console.log(eval(${JSON.stringify(code)}))}catch(e){console.error(e.message)}<\/script>`;
        } else {
          iframe.contentWindow.postMessage({ __webosEval: code }, '*');
        }
      });
      win.onKey(e => {
        const ctrl = e.ctrlKey || e.metaKey;
        if (ctrl && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
        else if (ctrl && e.key === 'o') { e.preventDefault(); openDoc(); }
        else if (ctrl && e.key === 'n') { e.preventDefault(); newDoc(); }
        else if (ctrl && e.key === 'w') { e.preventDefault(); if (active >= 0) closeDoc(active); }
        else if (e.key === 'F5' || (ctrl && e.key === 'Enter')) { e.preventDefault(); run(); }
      });
      win.beforeClose = async () => {
        if (docs[active]) docs[active].content = ta.value;
        const dirty = docs.filter(d => d.dirty);
        if (!dirty.length) return true;
        const r = await OS.dialog.ask(`You have ${dirty.length} unsaved file(s). Save them before closing?`, { title: 'Code Studio', yes: 'Save all', no: "Don't save" });
        if (r === null) return false;
        if (r === 'yes') { for (let i = 0; i < docs.length; i++) if (docs[i].dirty && !(await save(i))) return false; }
        return true;
      };
      win.sub('fs:change', U.debounce(renderTree, 50));
      win.onArgs = a => a.path && openPath(a.path);

      renderTree();
      if (args.path) openPath(args.path);
      layout();
      updateTitle();
    },
  });
})();
