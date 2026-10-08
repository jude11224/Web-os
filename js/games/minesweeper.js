/* Minesweeper */
'use strict';

OS.registerApp({
  id: 'minesweeper', name: 'Minesweeper', icon: 'minesweeper', category: 'Games', width: 520, height: 600, minWidth: 300, minHeight: 360,
  desc: 'Clear the field without hitting a mine', keywords: 'game puzzle mines classic',
  launch(win) {
    const LEVELS = { beginner: [9, 9, 10], intermediate: [16, 16, 40], expert: [30, 16, 99] };
    let level = OS.data.get('mines.level', 'beginner');
    let W, H, M, cells, started, over, flags, revealed, t0, timer;
    const sel = U.h('select', { class: 'input', style: { width: 'auto', minHeight: '28px', padding: '2px 6px' } },
      Object.keys(LEVELS).map(l => U.h('option', { value: l, selected: l === level }, l[0].toUpperCase() + l.slice(1))));
    sel.onchange = () => { level = sel.value; OS.data.set('mines.level', level); reset(); fitWin(); };
    const g = OS.ui.game(win, { bar: [sel] });
    const face = U.h('button', { class: 'ms-face', title: 'New game', onclick: () => reset() }, '🙂');
    const mineCount = U.h('div', { class: 'ms-lcd' });
    const timeEl = U.h('div', { class: 'ms-lcd' });
    const grid = U.h('div', { class: 'ms-grid' });
    const board = U.h('div', { class: 'ms-board' }, U.h('div', { class: 'ms-head' }, mineCount, face, timeEl), grid);
    g.stage.insertBefore(board, g.overlay.el);

    function fitWin() {
      const [w, h] = LEVELS[level];
      if (!win.maximized) win.setSize(Math.max(320, w * 28 + 60), Math.max(380, h * 28 + 170));
      fit();
    }
    function fit() {
      const [w, h] = LEVELS[level];
      const avail = Math.min((g.stage.clientWidth - 40) / w, (g.stage.clientHeight - 90) / h);
      grid.style.setProperty('--cs', U.clamp(Math.floor(avail), 16, 40) + 'px');
    }
    win.onResize(fit);

    function reset() {
      [W, H, M] = LEVELS[level];
      cells = Array.from({ length: W * H }, (_, i) => ({ i, x: i % W, y: Math.floor(i / W), mine: false, n: 0, open: false, flag: 0 }));
      started = false; over = false; flags = 0; revealed = 0;
      clearInterval(timer);
      t0 = 0;
      face.textContent = '🙂';
      g.overlay.hide();
      grid.style.gridTemplateColumns = `repeat(${W}, var(--cs))`;
      grid.innerHTML = '';
      cells.forEach(c => {
        c.el = U.h('button', { class: 'ms-cell' });
        c.el.addEventListener('mousedown', e => { if (!over && e.button === 0) face.textContent = '😮'; });
        c.el.addEventListener('mouseup', () => { if (!over) face.textContent = '🙂'; });
        c.el.addEventListener('click', () => click(c));
        c.el.addEventListener('contextmenu', e => { e.preventDefault(); flag(c); });
        c.el.addEventListener('dblclick', () => chord(c));
        let lp;
        c.el.addEventListener('touchstart', () => { lp = setTimeout(() => { lp = 'done'; flag(c); }, 450); }, { passive: true });
        c.el.addEventListener('touchend', e => { if (lp === 'done') e.preventDefault(); clearTimeout(lp); });
        grid.appendChild(c.el);
      });
      hud();
      fit();
    }
    const nbrs = c => {
      const out = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const x = c.x + dx, y = c.y + dy;
        if (x >= 0 && y >= 0 && x < W && y < H) out.push(cells[y * W + x]);
      }
      return out;
    };
    function plant(safe) {
      const forbidden = new Set([safe.i, ...nbrs(safe).map(n => n.i)]);
      const pool = cells.filter(c => !forbidden.has(c.i));
      U.shuffle(pool).slice(0, M).forEach(c => { c.mine = true; });
      cells.forEach(c => { c.n = nbrs(c).filter(n => n.mine).length; });
      started = true;
      t0 = Date.now();
      timer = setInterval(hud, 250);
    }
    win.addCleanup(() => clearInterval(timer));
    function hud() {
      mineCount.textContent = String(M - flags).padStart(3, '0');
      const t = started ? Math.min(999, Math.floor((Date.now() - t0) / 1000)) : 0;
      if (!over) timeEl.textContent = String(t).padStart(3, '0');
      const best = OS.ui.best('mines.' + level);
      g.setScore(level[0].toUpperCase() + level.slice(1), best != null ? `Best: ${best}s` : 'Best: —');
    }
    function click(c) {
      if (over || c.open || c.flag === 1) return;
      if (!started) plant(c);
      if (c.mine) return lose(c);
      reveal(c);
      OS.sound.play('click');
      check();
    }
    function reveal(c) {
      const stack = [c];
      while (stack.length) {
        const k = stack.pop();
        if (k.open || k.flag === 1) continue;
        k.open = true;
        revealed++;
        k.el.classList.add('open');
        if (k.n) { k.el.textContent = k.n; k.el.dataset.n = k.n; }
        else nbrs(k).forEach(n => { if (!n.open && !n.mine) stack.push(n); });
      }
    }
    function flag(c) {
      if (over || c.open) return;
      c.flag = (c.flag + 1) % 3;
      flags += c.flag === 1 ? 1 : c.flag === 2 ? -1 : 0;
      c.el.textContent = c.flag === 1 ? '🚩' : c.flag === 2 ? '?' : '';
      c.el.classList.toggle('flag', c.flag === 1);
      OS.sound.play('blip');
      hud();
    }
    function chord(c) {
      if (!c.open || !c.n || over) return;
      const ns = nbrs(c);
      if (ns.filter(n => n.flag === 1).length !== c.n) return;
      for (const n of ns) {
        if (n.flag === 1 || n.open) continue;
        if (n.mine) return lose(n);
        reveal(n);
      }
      check();
    }
    function lose(c) {
      over = true;
      clearInterval(timer);
      face.textContent = '😵';
      OS.sound.play('hit');
      cells.forEach(k => {
        if (k.mine && k.flag !== 1) { k.el.textContent = '💣'; k.el.classList.add('open', 'mine'); }
        if (!k.mine && k.flag === 1) { k.el.textContent = '❌'; }
      });
      c.el.classList.add('boom');
      setTimeout(() => g.overlay.show('Boom!', 'You hit a mine.', [['Try again', () => reset()]]), 600);
    }
    function check() {
      if (revealed !== W * H - M) return;
      over = true;
      clearInterval(timer);
      face.textContent = '😎';
      cells.forEach(k => { if (k.mine) { k.el.textContent = '🚩'; k.el.classList.add('flag'); } });
      flags = M;
      const t = Math.floor((Date.now() - t0) / 1000);
      const prev = OS.ui.best('mines.' + level);
      OS.ui.best('mines.' + level, t, true);
      hud();
      OS.sound.play('win');
      g.overlay.show('You win!', `Cleared in ${t} seconds${prev == null || t < prev ? ' — New best!' : ''}`, [['Play again', () => reset()]]);
    }
    win.onKey(e => { if (e.key === 'F2' || e.key === 'n') reset(); });
    reset();
    requestAnimationFrame(fitWin);
  },
});
