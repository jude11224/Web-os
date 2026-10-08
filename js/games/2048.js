/* 2048 */
'use strict';

OS.registerApp({
  id: 'g2048', name: '2048', icon: 'g2048', category: 'Games', width: 460, height: 600, minWidth: 300, minHeight: 400,
  desc: 'Slide and merge tiles to reach 2048', keywords: 'game puzzle numbers',
  launch(win) {
    const N = 4;
    let tiles, score, won, keepGoing, prev, idc = 0, over;
    const g = OS.ui.game(win, { bar: [
      U.h('button', { class: 'btn small', title: 'Undo last move', onclick: undo }, '↶ Undo'),
      U.h('button', { class: 'btn small', onclick: () => newGame() }, 'New game')] });
    const boardEl = U.h('div', { class: 't2-board' });
    const wrap = U.h('div', { class: 't2-wrap' }, boardEl);
    g.stage.insertBefore(wrap, g.overlay.el);
    for (let i = 0; i < N * N; i++) boardEl.appendChild(U.h('div', { class: 't2-cell' }));

    function fit() {
      const s = Math.max(200, Math.min(g.stage.clientWidth - 30, g.stage.clientHeight - 30, 520));
      boardEl.style.setProperty('--size', s + 'px');
    }
    win.onResize(fit);

    function newGame() {
      tiles = []; score = 0; won = false; keepGoing = false; prev = null; over = false;
      boardEl.querySelectorAll('.t2-tile').forEach(t => t.remove());
      add(); add();
      g.overlay.hide();
      save(); render(); hud();
    }
    function save() { OS.data.set('2048.state', { tiles: tiles.map(t => ({ x: t.x, y: t.y, v: t.v })), score, won, keepGoing }); }
    function load() {
      const s = OS.data.get('2048.state', null);
      if (!s || !s.tiles || !s.tiles.length) return newGame();
      tiles = s.tiles.map(t => ({ ...t, id: ++idc })); score = s.score; won = s.won; keepGoing = s.keepGoing; prev = null; over = false;
      render(); hud();
      if (!movesLeft()) lose();
    }
    function add() {
      const empty = [];
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!at(x, y)) empty.push([x, y]);
      if (!empty.length) return;
      const [x, y] = empty[U.rand(0, empty.length - 1)];
      tiles.push({ id: ++idc, x, y, v: Math.random() < 0.9 ? 2 : 4, isNew: true });
    }
    const at = (x, y) => tiles.find(t => t.x === x && t.y === y && !t.gone);
    function hud() {
      OS.ui.best('2048', score);
      g.setScore(`Score: ${score}`, `Best: ${OS.ui.best('2048') || 0}`);
    }
    function move(dir) {
      if (over || g.overlay.visible) return;
      const vec = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir];
      const snapshot = { tiles: tiles.map(t => ({ ...t })), score };
      tiles = tiles.filter(t => !t.gone);
      tiles.forEach(t => { t.merged = false; t.isNew = false; });
      const order = [...Array(N).keys()];
      if (vec[0] === 1 || vec[1] === 1) order.reverse();
      let moved = false;
      for (const a of order) for (const b of order) {
        const x = vec[0] ? a : b, y = vec[0] ? b : a;
        const t = at(x, y);
        if (!t) continue;
        let nx = x, ny = y;
        for (;;) {
          const tx = nx + vec[0], ty = ny + vec[1];
          if (tx < 0 || ty < 0 || tx >= N || ty >= N) break;
          const o = at(tx, ty);
          if (!o) { nx = tx; ny = ty; continue; }
          if (o.v === t.v && !o.merged && !o.gone) {
            nx = tx; ny = ty;
            o.gone = true;
            t.v *= 2; t.merged = true;
            score += t.v;
            if (t.v === 2048 && !won) won = true;
          }
          break;
        }
        if (nx !== x || ny !== y) { t.x = nx; t.y = ny; moved = true; }
      }
      if (!moved) return;
      prev = snapshot;
      add();
      OS.sound.play(tiles.some(t => t.merged) ? 'pop' : 'blip');
      render();
      hud();
      save();
      if (won && !keepGoing) {
        keepGoing = true; save();
        setTimeout(() => { OS.sound.play('win'); g.overlay.show('You made 2048! 🎉', `Score: ${score}`, [['Keep going', () => g.overlay.hide()], ['New game', () => newGame(), false]]); }, 250);
      } else if (!movesLeft()) setTimeout(lose, 300);
    }
    function movesLeft() {
      const live = tiles.filter(t => !t.gone);
      if (live.length < N * N) return true;
      return live.some(t => [[1, 0], [0, 1]].some(([dx, dy]) => { const o = at(t.x + dx, t.y + dy); return o && o.v === t.v; }));
    }
    function lose() {
      over = true;
      OS.sound.play('lose');
      g.overlay.show('Game over', `Score: ${score}`, [['Try again', () => newGame()], ['Undo', () => { over = false; undo(); }, false]]);
    }
    function undo() {
      if (!prev) return;
      g.overlay.hide();
      over = false;
      tiles = prev.tiles.filter(t => !t.gone).map(t => ({ ...t, merged: false, isNew: false }));
      score = prev.score;
      prev = null;
      boardEl.querySelectorAll('.t2-tile').forEach(t => t.remove());
      render(); hud(); save();
    }
    function render() {
      const els = new Map([...boardEl.querySelectorAll('.t2-tile')].map(e => [+e.dataset.id, e]));
      for (const t of tiles) {
        let el = els.get(t.id);
        if (!el) {
          el = U.h('div', { class: 't2-tile' + (t.isNew ? ' new' : ''), dataset: { id: t.id } });
          boardEl.appendChild(el);
        }
        els.delete(t.id);
        el.style.setProperty('--x', t.x);
        el.style.setProperty('--y', t.y);
        el.textContent = t.v;
        el.dataset.v = t.v > 2048 ? 'big' : t.v;
        el.style.zIndex = t.gone ? 1 : 2;
        if (t.merged) { el.classList.remove('merged'); void el.offsetWidth; el.classList.add('merged'); }
        if (t.gone) setTimeout(() => el.remove(), 110);
      }
      els.forEach(e => e.remove());
    }
    win.onKey(e => {
      const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
      if (map[e.key]) { e.preventDefault(); move(map[e.key]); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'z') undo();
    });
    g.swipe(g.stage, move);
    load();
    requestAnimationFrame(fit);
  },
});
