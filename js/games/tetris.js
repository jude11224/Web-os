/* Tetris-style falling blocks */
'use strict';

OS.registerApp({
  id: 'tetris', name: 'Blocks', icon: 'tetris', category: 'Games', width: 520, height: 680, minWidth: 320, minHeight: 420,
  desc: 'Classic falling-blocks puzzle', keywords: 'tetris game puzzle',
  launch(win) {
    const COLS = 10, ROWS = 20, C = 30, SIDE = 170;
    const g = OS.ui.game(win, { w: COLS * C + SIDE, h: ROWS * C, bar: [U.h('button', { class: 'btn small', onclick: () => { reset(); start(); } }, 'New game')] });
    const SHAPES = {
      I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
      J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
      L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
      O: [[1, 1], [1, 1]],
      S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
      T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
      Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    };
    const COLORS = { I: '#22d3ee', J: '#3b82f6', L: '#f97316', O: '#facc15', S: '#22c55e', T: '#a855f7', Z: '#ef4444' };
    let board, cur, next, hold, canHold, bag, score, lines, level, state, dropAcc, lockT, clearing, flash;

    const rotate = m => m[0].map((_, i) => m.map(r => r[i]).reverse());
    function fromBag() {
      if (!bag.length) bag = U.shuffle(Object.keys(SHAPES));
      return bag.pop();
    }
    function spawn(type) {
      const m = SHAPES[type].map(r => r.slice());
      return { type, m, x: Math.floor((COLS - m[0].length) / 2), y: type === 'I' ? -1 : 0 };
    }
    function collide(p, m = p.m, ox = p.x, oy = p.y) {
      for (let y = 0; y < m.length; y++) for (let x = 0; x < m[y].length; x++) {
        if (!m[y][x]) continue;
        const bx = ox + x, by = oy + y;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && board[by][bx]) return true;
      }
      return false;
    }
    function reset() {
      board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      bag = []; next = [fromBag(), fromBag(), fromBag()];
      cur = spawn(fromBag()); hold = null; canHold = true;
      score = 0; lines = 0; level = 1; dropAcc = 0; lockT = 0; clearing = null; flash = 0;
      state = 'ready';
      hud();
      g.overlay.show('Blocks', '← → move · ↑ rotate · ↓ soft drop · Space hard drop · C hold · P pause', [['Play', start]]);
    }
    function start() { state = 'play'; g.overlay.hide(); }
    function hud() { g.setScore(`Score: ${score}`, `Best: ${OS.ui.best('tetris') || 0}`); }
    function newPiece() {
      cur = spawn(next.shift());
      next.push(fromBag());
      canHold = true;
      lockT = 0;
      if (collide(cur)) gameOver();
    }
    function lock() {
      cur.m.forEach((r, y) => r.forEach((v, x) => { if (v && cur.y + y >= 0) board[cur.y + y][cur.x + x] = COLORS[cur.type]; }));
      if (cur.m.some((r, y) => r.some(v => v) && cur.y + y < 0)) return gameOver();
      const full = [];
      board.forEach((r, y) => { if (r.every(Boolean)) full.push(y); });
      if (full.length) {
        clearing = { rows: full, t: 0.25 };
        const pts = [0, 100, 300, 500, 800][full.length] * level;
        score += pts;
        lines += full.length;
        level = Math.floor(lines / 10) + 1;
        OS.sound.play(full.length === 4 ? 'win' : 'coin');
        if (full.length === 4) flash = 0.3;
      } else OS.sound.play('blip');
      hud();
      newPiece();
    }
    function move(dx) { if (!collide(cur, cur.m, cur.x + dx, cur.y)) { cur.x += dx; lockT = 0; } }
    function rot(dir = 1) {
      let m = rotate(cur.m);
      if (dir < 0) m = rotate(rotate(m));
      for (const k of [0, -1, 1, -2, 2]) {
        if (!collide(cur, m, cur.x + k, cur.y)) { cur.m = m; cur.x += k; lockT = 0; return; }
        if (!collide(cur, m, cur.x + k, cur.y - 1)) { cur.m = m; cur.x += k; cur.y -= 1; lockT = 0; return; }
      }
    }
    function soft() { if (!collide(cur, cur.m, cur.x, cur.y + 1)) { cur.y++; score += 1; dropAcc = 0; hud(); } }
    function hard() {
      let d = 0;
      while (!collide(cur, cur.m, cur.x, cur.y + 1)) { cur.y++; d++; }
      score += d * 2;
      lock();
    }
    function doHold() {
      if (!canHold) return;
      const t = cur.type;
      if (hold) cur = spawn(hold); else newPiece();
      hold = t;
      canHold = false;
    }
    function ghostY() { let y = cur.y; while (!collide(cur, cur.m, cur.x, y + 1)) y++; return y; }
    function gameOver() {
      state = 'over';
      OS.sound.play('lose');
      const prev = OS.ui.best('tetris') || 0;
      OS.ui.best('tetris', score);
      hud();
      g.overlay.show('Game over', `Score ${score} · Lines ${lines} · Level ${level}${score > prev ? ' — New best!' : ''}`, [['Play again', () => { reset(); start(); }]]);
    }

    let das = { dir: 0, t: 0 };
    win.onKey(e => {
      const k = e.key;
      if (state === 'ready' && (k === ' ' || k === 'Enter')) { e.preventDefault(); start(); return; }
      if (k === 'p' || k === 'P' || k === 'Escape') {
        if (state === 'play') { state = 'pause'; g.overlay.show('Paused', null, [['Resume', start]]); } else if (state === 'pause') start();
        return;
      }
      if (state !== 'play') return;
      if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '].includes(k)) e.preventDefault();
      if (k === 'ArrowLeft' || k === 'a') { move(-1); das = { dir: -1, t: -0.17 }; }
      else if (k === 'ArrowRight' || k === 'd') { move(1); das = { dir: 1, t: -0.17 }; }
      else if (k === 'ArrowDown' || k === 's') soft();
      else if (k === 'ArrowUp' || k === 'x' || k === 'w') rot(1);
      else if (k === 'z' || k === 'Control') rot(-1);
      else if (k === ' ') hard();
      else if (k === 'c' || k === 'Shift') doHold();
    });
    win.onKey(e => { if ((e.key === 'ArrowLeft' && das.dir === -1) || (e.key === 'ArrowRight' && das.dir === 1)) das = { dir: 0, t: 0 }; }, 'keyup');
    g.swipe(g.stage, d => { if (state === 'ready') return start(); if (state !== 'play') return; ({ left: () => move(-1), right: () => move(1), down: hard, up: () => rot(1) })[d](); });
    g.canvas.addEventListener('click', () => { if (state === 'play') rot(1); });
    win.onBlur = () => { if (state === 'play') { state = 'pause'; g.overlay.show('Paused', null, [['Resume', start]]); } };

    const ctx = g.ctx;
    const cell = (x, y, color, alpha = 1, size = C) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.fillRect(x + 1, y + 1, size - 2, 4);
      ctx.fillStyle = 'rgba(0,0,0,.2)';
      ctx.fillRect(x + 1, y + size - 5, size - 2, 4);
      ctx.globalAlpha = 1;
    };
    const mini = (type, ox, oy) => {
      if (!type) return;
      const m = SHAPES[type], s = 20;
      const w = m[0].length * s, rowsUsed = m.filter(r => r.some(Boolean));
      const off = m.findIndex(r => r.some(Boolean));
      m.forEach((r, y) => r.forEach((v, x) => v && cell(ox + (130 - w) / 2 + x * s, oy + (y - off) * s + (40 - rowsUsed.length * s) / 2, COLORS[type], 1, s)));
    };
    win.loop(dt => {
      if (state === 'play') {
        if (clearing) {
          clearing.t -= dt;
          if (clearing.t <= 0) {
            clearing.rows.forEach(y => { board.splice(y, 1); board.unshift(Array(COLS).fill(null)); });
            clearing = null;
          }
        } else {
          if (das.dir) { das.t += dt; while (das.t > 0.05) { move(das.dir); das.t -= 0.05; } }
          const interval = Math.max(0.05, 0.8 * Math.pow(0.85, level - 1));
          dropAcc += dt;
          if (collide(cur, cur.m, cur.x, cur.y + 1)) {
            lockT += dt;
            if (lockT > 0.5) lock();
          } else if (dropAcc >= interval) { dropAcc = 0; cur.y++; }
        }
      }
      flash = Math.max(0, flash - dt);
      // board
      ctx.fillStyle = '#0b1020';
      ctx.fillRect(0, 0, COLS * C, ROWS * C);
      ctx.strokeStyle = 'rgba(255,255,255,.04)';
      for (let x = 1; x < COLS; x++) { ctx.beginPath(); ctx.moveTo(x * C, 0); ctx.lineTo(x * C, ROWS * C); ctx.stroke(); }
      for (let y = 1; y < ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * C); ctx.lineTo(COLS * C, y * C); ctx.stroke(); }
      board.forEach((r, y) => r.forEach((c, x) => {
        if (!c) return;
        const fl = clearing && clearing.rows.includes(y);
        cell(x * C, y * C, fl ? '#fff' : c, fl ? clearing.t / 0.25 + 0.2 : 1);
      }));
      if (state !== 'over' && !clearing) {
        const gy = ghostY();
        cur.m.forEach((r, y) => r.forEach((v, x) => { if (v && gy + y >= 0) { ctx.strokeStyle = COLORS[cur.type] + '99'; ctx.lineWidth = 2; ctx.strokeRect((cur.x + x) * C + 3, (gy + y) * C + 3, C - 6, C - 6); } }));
        cur.m.forEach((r, y) => r.forEach((v, x) => { if (v && cur.y + y >= 0) cell((cur.x + x) * C, (cur.y + y) * C, COLORS[cur.type]); }));
      }
      if (flash) { ctx.fillStyle = `rgba(255,255,255,${flash})`; ctx.fillRect(0, 0, COLS * C, ROWS * C); }
      // side panel
      const sx = COLS * C;
      ctx.fillStyle = '#111827';
      ctx.fillRect(sx, 0, SIDE, ROWS * C);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '600 13px system-ui';
      const label = (t, y) => { ctx.fillStyle = '#9ca3af'; ctx.fillText(t, sx + 20, y); };
      label('NEXT', 30);
      next.forEach((t, i) => mini(t, sx + 20, 42 + i * 52));
      label('HOLD', 220);
      ctx.globalAlpha = canHold ? 1 : 0.4; mini(hold, sx + 20, 232); ctx.globalAlpha = 1;
      const stat = (t, v, y) => { label(t, y); ctx.fillStyle = '#fff'; ctx.font = '700 24px system-ui'; ctx.fillText(v, sx + 20, y + 28); ctx.font = '600 13px system-ui'; };
      stat('SCORE', score, 320);
      stat('LINES', lines, 390);
      stat('LEVEL', level, 460);
      stat('BEST', Math.max(score, OS.ui.best('tetris') || 0), 530);
    });
    reset();
  },
});
