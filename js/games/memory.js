/* Memory Match */
'use strict';

OS.registerApp({
  id: 'memory', name: 'Memory Match', icon: 'memory', category: 'Games', width: 560, height: 640, minWidth: 320, minHeight: 420,
  desc: 'Flip cards and find all the pairs', keywords: 'game concentration cards pairs',
  launch(win) {
    const SYMBOLS = ['🍎', '🚀', '🎸', '🐙', '🌈', '⚽', '🍕', '🎲', '🦊', '🌵', '💎', '🎈', '🐢', '🍩', '⭐', '🔔', '🦄', '🍉'];
    let size = OS.data.get('memory.size', 4);
    let cards, open, matched, moves, lock, t0, timer;
    const sel = U.h('select', { class: 'input', style: { width: 'auto', minHeight: '28px', padding: '2px 6px' } },
      [[4, 'Easy 4×4'], [6, 'Hard 6×6']].map(([v, l]) => U.h('option', { value: v, selected: v === size }, l)));
    sel.onchange = () => { size = +sel.value; OS.data.set('memory.size', size); reset(); };
    const g = OS.ui.game(win, { bar: [sel, U.h('button', { class: 'btn small', onclick: () => reset() }, 'New game')] });
    const grid = U.h('div', { class: 'mem-grid' });
    g.stage.insertBefore(grid, g.overlay.el);
    function fit() {
      const s = Math.min(g.stage.clientWidth - 30, g.stage.clientHeight - 30);
      grid.style.width = grid.style.height = Math.max(200, s) + 'px';
    }
    win.onResize(fit);
    function reset() {
      const n = size * size / 2;
      const syms = U.shuffle(SYMBOLS.slice()).slice(0, n);
      cards = U.shuffle([...syms, ...syms]).map((s, i) => ({ s, i, up: false, done: false }));
      open = []; matched = 0; moves = 0; lock = false;
      clearInterval(timer); t0 = null;
      g.overlay.hide();
      grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
      grid.innerHTML = '';
      cards.forEach(c => {
        c.el = U.h('button', { class: 'mem-card' }, U.h('div', { class: 'mem-inner' }, U.h('div', { class: 'mem-front' }, c.s), U.h('div', { class: 'mem-back' })));
        c.el.style.fontSize = size === 4 ? 'clamp(20px, 7vmin, 52px)' : 'clamp(14px, 4.5vmin, 34px)';
        c.el.onclick = () => flip(c);
        grid.appendChild(c.el);
      });
      hud();
      fit();
    }
    win.addCleanup(() => clearInterval(timer));
    function hud() {
      const t = t0 ? Math.floor((Date.now() - t0) / 1000) : 0;
      const best = OS.ui.best('memory' + size);
      g.setScore(`Moves: ${moves}  ·  Pairs: ${matched}/${size * size / 2}  ·  ${U.fmtDuration(t)}`, best != null ? `Best: ${best} moves` : '');
    }
    function flip(c) {
      if (lock || c.up || c.done) return;
      if (!t0) { t0 = Date.now(); timer = setInterval(hud, 1000); }
      c.up = true;
      c.el.classList.add('up');
      OS.sound.play('click');
      open.push(c);
      if (open.length < 2) return;
      moves++;
      const [a, b] = open;
      open = [];
      if (a.s === b.s) {
        a.done = b.done = true;
        matched++;
        win.timeout(() => { a.el.classList.add('done'); b.el.classList.add('done'); OS.sound.play('coin'); }, 250);
        if (matched === size * size / 2) {
          clearInterval(timer);
          const prev = OS.ui.best('memory' + size);
          OS.ui.best('memory' + size, moves, true);
          win.timeout(() => { OS.sound.play('win'); g.overlay.show('All pairs found! 🎉', `${moves} moves in ${U.fmtDuration((Date.now() - t0) / 1000)}${prev == null || moves < prev ? ' — New best!' : ''}`, [['Play again', reset]]); }, 600);
        }
      } else {
        lock = true;
        win.timeout(() => { a.up = b.up = false; a.el.classList.remove('up'); b.el.classList.remove('up'); lock = false; }, 800);
      }
      hud();
    }
    reset();
    requestAnimationFrame(fit);
  },
});
