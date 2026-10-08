/* Klondike Solitaire */
'use strict';

OS.registerApp({
  id: 'solitaire', name: 'Solitaire', icon: 'solitaire', category: 'Games', width: 860, height: 640, minWidth: 420, minHeight: 420,
  desc: 'Classic Klondike patience', keywords: 'cards game klondike patience',
  launch(win) {
    const SUITS = ['♠', '♥', '♦', '♣'], RED = new Set(['♥', '♦']);
    const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    let drawN = OS.data.get('sol.draw', 1);
    let stock, waste, found, tab, moves, score, history, t0, timer, won, autoRunning;

    const drawSel = U.h('select', { class: 'input', style: { width: 'auto', minHeight: '28px', padding: '2px 6px' } },
      U.h('option', { value: 1, selected: drawN === 1 }, 'Draw 1'), U.h('option', { value: 3, selected: drawN === 3 }, 'Draw 3'));
    drawSel.onchange = () => { drawN = +drawSel.value; OS.data.set('sol.draw', drawN); deal(); };
    const g = OS.ui.game(win, { bar: [
      drawSel,
      U.h('button', { class: 'btn small', onclick: undo, title: 'Undo (Ctrl+Z)' }, '↶ Undo'),
      U.h('button', { class: 'btn small', onclick: hint, title: 'Hint (H)' }, 'Hint'),
      U.h('button', { class: 'btn small', onclick: () => deal() }, 'New game')] });
    const table = U.h('div', { class: 'sol-table' });
    g.stage.insertBefore(table, g.overlay.el);
    g.stage.classList.add('sol-stage');

    function fit() {
      const W = g.stage.clientWidth, H = g.stage.clientHeight;
      const cw = Math.max(40, Math.min((W - 40) / 7.6, (H - 30) / 4.6, 110));
      table.style.setProperty('--cw', cw + 'px');
      table.style.setProperty('--ch', cw * 1.4 + 'px');
      render();
    }
    win.onResize(fit);

    function deal() {
      const deck = [];
      SUITS.forEach(s => RANKS.forEach((r, i) => deck.push({ s, r, v: i + 1, red: RED.has(s), up: false, id: s + r })));
      U.shuffle(deck);
      tab = [[], [], [], [], [], [], []];
      for (let i = 0; i < 7; i++) for (let j = i; j < 7; j++) tab[j].push(deck.pop());
      tab.forEach(p => { p[p.length - 1].up = true; });
      stock = deck; waste = []; found = [[], [], [], []];
      moves = 0; score = 0; history = []; won = false; autoRunning = false;
      clearInterval(timer);
      t0 = null;
      g.overlay.hide();
      render();
    }
    function startTimer() {
      if (t0) return;
      t0 = Date.now();
      timer = setInterval(hud, 1000);
    }
    win.addCleanup(() => clearInterval(timer));
    function hud() {
      const t = t0 ? Math.floor((Date.now() - t0) / 1000) : 0;
      const best = OS.ui.best('sol' + drawN);
      g.setScore(`Moves: ${moves}  ·  Score: ${score}  ·  ${U.fmtDuration(t)}`, best != null ? `Best: ${U.fmtDuration(best)}` : '');
    }
    const snapshot = () => JSON.stringify({ stock, waste, found, tab, score });
    function record() { history.push(snapshot()); if (history.length > 200) history.shift(); moves++; startTimer(); }
    function undo() {
      if (!history.length || won) return;
      const s = JSON.parse(history.pop());
      ({ stock, waste, found, tab, score } = s);
      moves++;
      render();
    }

    /* ----- rules ----- */
    const top = a => a[a.length - 1];
    const canFound = (c, f) => f.length ? (top(f).s === c.s && c.v === top(f).v + 1) : c.v === 1;
    const canTab = (c, p) => p.length ? (top(p).up && top(p).red !== c.red && top(p).v === c.v + 1) : c.v === 13;
    function sourceOf(loc) {
      if (loc.t === 'w') return { arr: waste, cards: [top(waste)] };
      if (loc.t === 'f') return { arr: found[loc.i], cards: [top(found[loc.i])] };
      return { arr: tab[loc.i], cards: tab[loc.i].slice(loc.j) };
    }
    function tryMove(loc, dest) {
      const { arr, cards } = sourceOf(loc);
      if (!cards.length || !cards[0]) return false;
      const c = cards[0];
      if (dest.t === 'f') {
        if (cards.length !== 1 || !canFound(c, found[dest.i])) return false;
        record();
        arr.pop();
        found[dest.i].push(c);
        score += loc.t === 'f' ? 0 : 10;
      } else {
        if (loc.t === 't' && loc.i === dest.i) return false;
        if (!canTab(c, tab[dest.i])) return false;
        record();
        arr.splice(arr.length - cards.length, cards.length);
        tab[dest.i].push(...cards);
        score += loc.t === 'w' ? 5 : loc.t === 'f' ? -15 : 0;
      }
      if (loc.t === 't' && arr.length && !top(arr).up) { top(arr).up = true; score += 5; }
      score = Math.max(0, score);
      OS.sound.play('blip');
      return true;
    }
    function autoMove(loc) {
      const { cards } = sourceOf(loc);
      if (!cards[0]) return false;
      if (cards.length === 1) for (let i = 0; i < 4; i++) if (tryMove(loc, { t: 'f', i })) return true;
      for (let i = 0; i < 7; i++) if (tryMove(loc, { t: 't', i })) return true;
      return false;
    }
    function drawStock() {
      startTimer();
      record();
      if (!stock.length) {
        if (!waste.length) { history.pop(); moves--; return; }
        stock = waste.reverse().map(c => ({ ...c, up: false }));
        waste = [];
        score = Math.max(0, score - (drawN === 1 ? 100 : 20));
      } else {
        for (let i = 0; i < drawN && stock.length; i++) { const c = stock.pop(); c.up = true; waste.push(c); }
      }
      OS.sound.play('click');
      render();
    }
    function hint() {
      const tryAll = () => {
        const srcs = [];
        if (waste.length) srcs.push({ t: 'w' });
        tab.forEach((p, i) => p.forEach((c, j) => { if (c.up) srcs.push({ t: 't', i, j }); }));
        for (const s of srcs) {
          const { cards } = sourceOf(s);
          const c = cards[0];
          if (cards.length === 1) for (let i = 0; i < 4; i++) if (canFound(c, found[i])) return s;
          for (let i = 0; i < 7; i++) {
            if (s.t === 't' && s.i === i) continue;
            if (canTab(c, tab[i]) && !(s.t === 't' && s.j === 0 && c.v === 13)) return s;
          }
        }
        return null;
      };
      const s = tryAll();
      const el = s ? table.querySelector(s.t === 'w' ? '.sol-waste .card:last-child' : `.sol-pile[data-i="${s.i}"] .card:nth-child(${s.j + 1})`) : table.querySelector('.sol-stock');
      if (el) { el.classList.remove('hint'); void el.offsetWidth; el.classList.add('hint'); }
    }
    function checkWin() {
      if (found.every(f => f.length === 13)) {
        won = true;
        clearInterval(timer);
        const t = Math.floor((Date.now() - (t0 || Date.now())) / 1000);
        const prevBest = OS.ui.best('sol' + drawN);
        OS.ui.best('sol' + drawN, t, true);
        hud();
        OS.sound.play('win');
        celebrate();
        g.overlay.show('You win! 🎉', `${moves} moves · score ${score} · ${U.fmtDuration(t)}${prevBest == null || t < prevBest ? ' · New best time!' : ''}`, [['Deal again', () => deal()]]);
        return true;
      }
      // offer auto-complete when everything is face up
      if (!autoRunning && !stock.length && !waste.length && tab.every(p => p.every(c => c.up))) autoComplete();
      return false;
    }
    function autoComplete() {
      autoRunning = true;
      const stepAuto = () => {
        for (let i = 0; i < 7; i++) {
          if (!tab[i].length) continue;
          for (let f = 0; f < 4; f++) if (tryMove({ t: 't', i, j: tab[i].length - 1 }, { t: 'f', i: f })) { render(); win.timeout(stepAuto, 90); return; }
        }
        autoRunning = false;
      };
      win.timeout(stepAuto, 200);
    }
    function celebrate() {
      const cv = U.h('canvas', { class: 'sol-confetti' });
      g.stage.appendChild(cv);
      cv.width = g.stage.clientWidth; cv.height = g.stage.clientHeight;
      const c = cv.getContext('2d');
      const ps = Array.from({ length: 150 }, () => ({ x: Math.random() * cv.width, y: -Math.random() * cv.height, vy: 80 + Math.random() * 160, vx: (Math.random() - 0.5) * 60, r: Math.random() * 6, col: `hsl(${Math.random() * 360},90%,60%)`, rot: Math.random() * 6 }));
      let t = 0;
      const stop = win.loop(dt => {
        t += dt;
        c.clearRect(0, 0, cv.width, cv.height);
        ps.forEach(p => { p.y += p.vy * dt; p.x += p.vx * dt; p.rot += dt * 5; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.col; c.fillRect(-4, -2, 8, 4); c.restore(); });
        if (t > 5) { stop(); cv.remove(); }
      });
    }

    /* ----- rendering & interaction ----- */
    function cardEl(c, loc) {
      const el = U.h('div', { class: 'card' + (c.up ? (c.red ? ' red' : ' black') : ' back') });
      if (c.up) el.innerHTML = `<span class="cr">${c.r}<br>${c.s}</span><span class="cc">${c.s}</span><span class="cr2">${c.r}<br>${c.s}</span>`;
      el._loc = loc;
      return el;
    }
    function render() {
      if (!tab) return;
      table.innerHTML = '';
      const topRow = U.h('div', { class: 'sol-row' });
      const stockEl = U.h('div', { class: 'sol-slot sol-stock' + (stock.length ? '' : ' empty') }, stock.length ? U.h('div', { class: 'card back' }) : U.h('span', { class: 'sol-recycle' }, '↻'));
      stockEl.onclick = drawStock;
      const wasteEl = U.h('div', { class: 'sol-slot sol-waste' });
      const show = waste.slice(-(drawN === 3 ? 3 : 1));
      show.forEach((c, k) => {
        const el = cardEl(c, k === show.length - 1 ? { t: 'w' } : null);
        el.style.left = `calc(${k} * var(--cw) * .22)`;
        if (k === show.length - 1) bindCard(el);
        wasteEl.appendChild(el);
      });
      topRow.append(stockEl, wasteEl);
      found.forEach((f, i) => {
        const fe = U.h('div', { class: 'sol-slot sol-found', dataset: { drop: 'f', i } }, U.h('span', { class: 'sol-ghost' }, 'A'));
        if (f.length) { const el = cardEl(top(f), { t: 'f', i }); bindCard(el); fe.appendChild(el); }
        topRow.appendChild(fe);
      });
      const piles = U.h('div', { class: 'sol-row sol-piles' });
      tab.forEach((p, i) => {
        const pe = U.h('div', { class: 'sol-slot sol-pile', dataset: { drop: 't', i } });
        let off = 0;
        p.forEach((c, j) => {
          const el = cardEl(c, c.up ? { t: 't', i, j } : null);
          el.style.top = `calc(var(--ch) * ${off})`;
          off += c.up ? 0.26 : 0.12;
          if (c.up) bindCard(el);
          pe.appendChild(el);
        });
        pe.style.height = `calc(var(--ch) * ${1 + off})`;
        piles.appendChild(pe);
      });
      table.append(topRow, piles);
      hud();
      if (!won) checkWin();
    }

    function bindCard(el) {
      el.addEventListener('dblclick', () => { if (autoMove(el._loc)) render(); });
      el.addEventListener('pointerdown', e => {
        if (e.button !== 0 || won) return;
        e.preventDefault();
        const loc = el._loc;
        const { cards } = sourceOf(loc);
        // the dragged elements: this card and those after it in the pile
        const parent = el.parentElement;
        const els = loc.t === 't' ? [...parent.children].slice(loc.j) : [el];
        const rects = els.map(x => x.getBoundingClientRect());
        const sx = e.clientX, sy = e.clientY;
        let dragging = false;
        el.setPointerCapture(e.pointerId);
        const move = ev => {
          const dx = ev.clientX - sx, dy = ev.clientY - sy;
          if (!dragging && Math.hypot(dx, dy) < 5) return;
          if (!dragging) {
            dragging = true;
            els.forEach((x, k) => {
              x.classList.add('dragging');
              x.style.position = 'fixed';
              x.style.left = rects[k].left + 'px';
              x.style.top = rects[k].top + 'px';
              x.style.width = rects[k].width + 'px';
              x.style.height = rects[k].height + 'px';
              x.style.setProperty('--cw', table.style.getPropertyValue('--cw'));
              x.style.setProperty('--ch', table.style.getPropertyValue('--ch'));
              document.body.appendChild(x);
            });
          }
          els.forEach((x, k) => { x.style.left = rects[k].left + dx + 'px'; x.style.top = rects[k].top + dy + 'px'; });
        };
        const up = ev => {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', up);
          el.removeEventListener('pointercancel', up);
          if (!dragging) {
            // single click: auto-move
            if (autoMove(loc)) render();
            return;
          }
          els.forEach(x => { x.style.visibility = 'hidden'; });
          const under = document.elementFromPoint(ev.clientX, ev.clientY);
          els.forEach(x => x.remove());
          const slot = under && under.closest('[data-drop]');
          let ok = false;
          if (slot && cards[0]) ok = tryMove(loc, { t: slot.dataset.drop, i: +slot.dataset.i });
          if (!ok) {
            // try the slot whose area overlaps most with the dragged card
            const r = { x: rects[0].left + ev.clientX - sx, y: rects[0].top + ev.clientY - sy, w: rects[0].width, h: rects[0].height };
            let bestSlot = null, bestA = 0;
            table.querySelectorAll('[data-drop]').forEach(s => {
              const b = s.getBoundingClientRect();
              const a = Math.max(0, Math.min(r.x + r.w, b.right) - Math.max(r.x, b.left)) * Math.max(0, Math.min(r.y + r.h, b.bottom) - Math.max(r.y, b.top));
              if (a > bestA) { bestA = a; bestSlot = s; }
            });
            if (bestSlot && bestSlot !== slot) ok = tryMove(loc, { t: bestSlot.dataset.drop, i: +bestSlot.dataset.i });
          }
          render();
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
      });
    }

    win.onKey(e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      else if (e.key === 'h') hint();
      else if (e.key === ' ' || e.key === 'd') { e.preventDefault(); drawStock(); }
      else if (e.key === 'F2') deal();
    });
    win.addCleanup(() => document.querySelectorAll('body > .card.dragging').forEach(x => x.remove()));
    deal();
    requestAnimationFrame(fit);
  },
});
