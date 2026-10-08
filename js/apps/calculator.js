/* Calculator — standard & scientific modes with history and memory */
'use strict';

(() => {
  /** Recursive-descent expression evaluator (no eval) */
  function evaluate(src, deg) {
    const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s+/g, '');
    let i = 0;
    const peek = () => s[i];
    const eat = c => { if (s[i] === c) { i++; return true; } return false; };
    const toRad = x => deg ? x * Math.PI / 180 : x;
    const fromRad = x => deg ? x * 180 / Math.PI : x;
    const FN = {
      sin: x => Math.sin(toRad(x)), cos: x => Math.cos(toRad(x)), tan: x => Math.tan(toRad(x)),
      asin: x => fromRad(Math.asin(x)), acos: x => fromRad(Math.acos(x)), atan: x => fromRad(Math.atan(x)),
      ln: Math.log, log: Math.log10, sqrt: Math.sqrt, '√': Math.sqrt, abs: Math.abs, exp: Math.exp,
    };
    const fact = n => { if (n < 0 || n !== Math.floor(n)) return NaN; if (n > 170) return Infinity; let r = 1; for (let k = 2; k <= n; k++) r *= k; return r; };
    function expr() {
      let v = term();
      for (;;) { if (eat('+')) v += term(); else if (eat('-')) v -= term(); else return v; }
    }
    function term() {
      let v = factor();
      for (;;) {
        if (eat('*')) v *= factor();
        else if (eat('/')) v /= factor();
        else if (peek() === '(' || /[a-zπ√]/i.test(peek() || '')) v *= factor(); // implicit multiplication
        else return v;
      }
    }
    function factor() {
      if (eat('-')) return -factor();
      if (eat('+')) return factor();
      const b = postfix();
      if (eat('^')) return Math.pow(b, factor());
      return b;
    }
    function postfix() {
      let v = primary();
      for (;;) {
        if (eat('!')) v = fact(v);
        else if (eat('%')) v /= 100;
        else return v;
      }
    }
    function primary() {
      if (eat('(')) { const v = expr(); eat(')'); return v; }
      const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
      if (num) { i += num[0].length; return parseFloat(num[0]); }
      if (eat('π')) return Math.PI;
      const id = /^[a-z√]+/i.exec(s.slice(i));
      if (id) {
        const name = id[0];
        if (name === 'pi') { i += 2; return Math.PI; }
        if (name === 'e' && s[i + 1] !== 'x') { i++; return Math.E; }
        if (FN[name]) { i += name.length; return FN[name](primary()); }
      }
      throw new Error('Syntax error');
    }
    const v = expr();
    if (i < s.length) throw new Error('Syntax error');
    return v;
  }
  const fmt = v => {
    if (!isFinite(v)) return isNaN(v) ? 'Error' : (v > 0 ? '∞' : '-∞');
    if (Math.abs(v) >= 1e15 || (Math.abs(v) < 1e-9 && v !== 0)) return v.toExponential(8).replace(/\.?0+e/, 'e');
    return String(+v.toPrecision(14));
  };

  OS.registerApp({
    id: 'calculator', name: 'Calculator', icon: 'calculator', category: 'Apps', width: 360, height: 560, minWidth: 300, minHeight: 440,
    desc: 'Standard and scientific calculator', keywords: 'math',
    launch(win) {
      let expr = '', last = '', justEvaluated = false, sci = OS.data.get('calc.sci', false), deg = true, mem = 0;
      const history = OS.data.get('calc.history', []);
      const exprEl = U.h('div', { class: 'calc-expr' });
      const resEl = U.h('div', { class: 'calc-res' }, '0');
      const keys = U.h('div', { class: 'calc-keys' });
      const histEl = U.h('div', { class: 'calc-hist', hidden: true });
      const modeBtn = U.h('button', { class: 'btn small', onclick: () => { sci = !sci; OS.data.set('calc.sci', sci); build(); } });
      const degBtn = U.h('button', { class: 'btn small', onclick: () => { deg = !deg; degBtn.textContent = deg ? 'DEG' : 'RAD'; preview(); } }, 'DEG');
      const histBtn = U.h('button', { class: 'btn small', onclick: () => { histEl.hidden = !histEl.hidden; renderHist(); } }, 'History');
      win.body.append(
        U.h('div', { class: 'calc' },
          U.h('div', { class: 'calc-top' }, modeBtn, degBtn, U.h('span', { style: { flex: 1 } }), histBtn),
          U.h('div', { class: 'calc-display' }, exprEl, resEl),
          U.h('div', { class: 'calc-mem' }, ['MC', 'MR', 'M+', 'M−'].map(m => U.h('button', { onclick: () => memory(m) }, m))),
          keys, histEl));

      function memory(m) {
        const cur = currentValue();
        if (m === 'MC') mem = 0;
        if (m === 'MR') { if (justEvaluated) expr = ''; expr += fmt(mem); justEvaluated = false; }
        if (m === 'M+') mem += cur;
        if (m === 'M−') mem -= cur;
        render();
      }
      function currentValue() { try { return evaluate(expr || '0', deg); } catch { return 0; } }

      const STD = [
        ['%', 'op', '%'], ['CE', 'fn', 'ce'], ['C', 'fn', 'c'], ['⌫', 'fn', 'back'],
        ['¹⁄ₓ', 'fn', 'inv'], ['x²', 'fn', 'sq'], ['√x', 'fn', 'sqrt'], ['÷', 'op', '÷'],
        ['7', 'num'], ['8', 'num'], ['9', 'num'], ['×', 'op', '×'],
        ['4', 'num'], ['5', 'num'], ['6', 'num'], ['−', 'op', '-'],
        ['1', 'num'], ['2', 'num'], ['3', 'num'], ['+', 'op', '+'],
        ['±', 'fn', 'neg'], ['0', 'num'], ['.', 'num'], ['=', 'eq'],
      ];
      const SCI = [
        ['sin', 'f', 'sin('], ['cos', 'f', 'cos('], ['tan', 'f', 'tan('], ['π', 'num', 'π'], ['e', 'num', 'e'],
        ['asin', 'f', 'asin('], ['acos', 'f', 'acos('], ['atan', 'f', 'atan('], ['(', 'num', '('], [')', 'num', ')'],
        ['ln', 'f', 'ln('], ['log', 'f', 'log('], ['xʸ', 'op', '^'], ['n!', 'op', '!'], ['|x|', 'f', 'abs('],
      ];
      function build() {
        modeBtn.textContent = sci ? 'Scientific' : 'Standard';
        degBtn.style.display = sci ? '' : 'none';
        keys.innerHTML = '';
        keys.className = 'calc-keys' + (sci ? ' sci' : '');
        if (sci) {
          const sk = U.h('div', { class: 'calc-sci' });
          SCI.forEach(([l, t, v]) => sk.appendChild(U.h('button', { class: 'ck fn', onclick: () => press(t, v || l) }, l)));
          keys.appendChild(sk);
        }
        const grid = U.h('div', { class: 'calc-grid' });
        STD.forEach(([l, t, v]) => grid.appendChild(U.h('button', { class: 'ck ' + t, onclick: () => press(t, v || l) }, l)));
        keys.appendChild(grid);
      }

      function press(type, v) {
        OS.sound.play('click');
        if (type === 'num' || type === 'f') {
          if (justEvaluated && /[\d.πe(]/.test(v[0]) || (justEvaluated && type === 'f')) expr = '';
          justEvaluated = false;
          if (v === '.') {
            const m = /[\d.]*$/.exec(expr)[0];
            if (m.includes('.')) return;
            if (!m) v = '0.';
          }
          expr += v;
        } else if (type === 'op') {
          justEvaluated = false;
          if (!expr && v !== '-') expr = '0';
          if (/[+\-×÷^]$/.test(expr) && v !== '!' && v !== '%') expr = expr.slice(0, -1);
          expr += v;
        } else if (type === 'eq') {
          equals();
          return;
        } else if (type === 'fn') {
          if (v === 'c') { expr = ''; last = ''; }
          else if (v === 'ce') { expr = expr.replace(/[\d.]+$/, ''); }
          else if (v === 'back') { expr = justEvaluated ? '' : expr.slice(0, -1); }
          else {
            const map = { inv: `1÷(${expr})`, sq: `(${expr})^2`, sqrt: `√(${expr})`, neg: `-(${expr})` };
            if (!expr) return;
            if (v === 'neg' && /^-\(.*\)$/.test(expr)) expr = expr.slice(2, -1);
            else expr = map[v];
          }
          justEvaluated = false;
        }
        render();
      }
      function equals() {
        if (!expr) return;
        try {
          let e = expr;
          const open = (e.match(/\(/g) || []).length - (e.match(/\)/g) || []).length;
          e += ')'.repeat(Math.max(0, open));
          const v = evaluate(e, deg);
          const r = fmt(v);
          last = e + ' =';
          history.unshift({ e, r });
          if (history.length > 50) history.pop();
          OS.data.set('calc.history', history);
          expr = r === 'Error' ? '' : r;
          resEl.textContent = r;
          resEl.classList.remove('preview');
          resEl.style.fontSize = r.length > 16 ? '24px' : r.length > 11 ? '32px' : '';
          exprEl.textContent = last;
          justEvaluated = true;
          renderHist();
        } catch {
          resEl.textContent = 'Error';
          OS.sound.play('error');
        }
      }
      function liveValue() {
        try {
          const e = expr.replace(/[+\-×÷^(]+$/, '');
          const open = (e.match(/\(/g) || []).length - (e.match(/\)/g) || []).length;
          return fmt(evaluate((e || '0') + ')'.repeat(Math.max(0, open)), deg));
        } catch { return null; }
      }
      function preview() { if (!justEvaluated) render(); }
      function render() {
        if (justEvaluated) return;
        exprEl.textContent = (mem ? 'M  ' : '') + (expr || '\u00a0');
        const v = expr ? liveValue() : '0';
        if (v != null) resEl.textContent = v;
        resEl.classList.toggle('preview', !!expr);
        const len = resEl.textContent.length;
        resEl.style.fontSize = len > 16 ? '24px' : len > 11 ? '32px' : '';
      }
      function renderHist() {
        histEl.innerHTML = '';
        histEl.appendChild(U.h('div', { class: 'calc-hist-h' }, U.h('b', {}, 'History'), U.h('button', { class: 'btn small', onclick: () => { history.length = 0; OS.data.set('calc.history', []); renderHist(); } }, 'Clear')));
        if (!history.length) histEl.appendChild(U.h('div', { class: 'muted', style: { padding: '12px' } }, 'No history yet'));
        history.forEach(h => histEl.appendChild(U.h('div', { class: 'calc-hist-row', onclick: () => { expr = h.r; justEvaluated = false; histEl.hidden = true; render(); } }, U.h('small', {}, h.e + ' ='), U.h('div', {}, h.r))));
      }

      win.onKey(e => {
        const k = e.key;
        if (/^[0-9.]$/.test(k)) press('num', k);
        else if (k === '+' || k === '-') press('op', k);
        else if (k === '*') press('op', '×');
        else if (k === '/') { e.preventDefault(); press('op', '÷'); }
        else if (k === '^') press('op', '^');
        else if (k === '!') press('op', '!');
        else if (k === '%') press('op', '%');
        else if (k === '(' || k === ')') press('num', k);
        else if (k === 'Enter' || k === '=') { e.preventDefault(); press('eq'); }
        else if (k === 'Backspace') press('fn', 'back');
        else if (k === 'Escape' || k === 'Delete') press('fn', 'c');
        else if ((e.ctrlKey || e.metaKey) && k === 'c') navigator.clipboard && navigator.clipboard.writeText(resEl.textContent);
      });
      build();
      render();
    },
  });

  OS.calc = { evaluate };
})();
