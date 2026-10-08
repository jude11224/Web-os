/* Connect Four with alpha-beta AI */
'use strict';

OS.registerApp({
  id: 'connect4', name: 'Connect Four', icon: 'connect4', category: 'Games', width: 600, height: 620, minWidth: 340, minHeight: 400,
  desc: 'Line up four discs before the computer does', keywords: 'game strategy four in a row',
  launch(win) {
    const C = 7, R = 6;
    let mode = OS.data.get('c4.mode', 'normal');
    let board, turn, over, busy, hover = -1, tally = OS.data.get('c4.tally', { p1: 0, p2: 0, d: 0 });
    const sel = U.h('select', { class: 'input', style: { width: 'auto', minHeight: '28px', padding: '2px 6px' } },
      [['easy', 'vs CPU (easy)'], ['normal', 'vs CPU (normal)'], ['hard', 'vs CPU (hard)'], ['pvp', '2 players']].map(([v, l]) => U.h('option', { value: v, selected: v === mode }, l)));
    sel.onchange = () => { mode = sel.value; OS.data.set('c4.mode', mode); reset(); };
    const g = OS.ui.game(win, { bar: [sel, U.h('button', { class: 'btn small', onclick: () => reset() }, 'New game')] });
    const boardEl = U.h('div', { class: 'c4-board' });
    const status = U.h('div', { class: 'ttt-status' });
    g.stage.insertBefore(U.h('div', { class: 'c4' }, status, boardEl), g.overlay.el);
    function fit() {
      const s = Math.min((g.stage.clientWidth - 30) / C, (g.stage.clientHeight - 80) / R, 80);
      boardEl.style.setProperty('--cs', Math.max(30, Math.floor(s)) + 'px');
    }
    win.onResize(fit);

    const drop = (b, col) => { for (let r = R - 1; r >= 0; r--) if (!b[r][col]) return r; return -1; };
    function winner(b) {
      const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        const p = b[r][c];
        if (!p) continue;
        for (const [dr, dc] of dirs) {
          const cells = [[r, c]];
          for (let k = 1; k < 4; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr >= R || cc < 0 || cc >= C || b[rr][cc] !== p) break; cells.push([rr, cc]); }
          if (cells.length === 4) return { p, cells };
        }
      }
      return b[0].every(Boolean) ? { p: 0 } : null;
    }
    function evalWindow(w, p) {
      const o = 3 - p, mine = w.filter(x => x === p).length, theirs = w.filter(x => x === o).length, empty = w.filter(x => !x).length;
      if (mine === 4) return 100000;
      if (mine === 3 && empty === 1) return 50;
      if (mine === 2 && empty === 2) return 5;
      if (theirs === 3 && empty === 1) return -80;
      if (theirs === 2 && empty === 2) return -4;
      return 0;
    }
    function score(b, p) {
      let s = 0;
      for (let r = 0; r < R; r++) s += (b[r][3] === p ? 6 : 0);
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        if (c + 3 < C) s += evalWindow([b[r][c], b[r][c + 1], b[r][c + 2], b[r][c + 3]], p);
        if (r + 3 < R) s += evalWindow([b[r][c], b[r + 1][c], b[r + 2][c], b[r + 3][c]], p);
        if (r + 3 < R && c + 3 < C) s += evalWindow([b[r][c], b[r + 1][c + 1], b[r + 2][c + 2], b[r + 3][c + 3]], p);
        if (r - 3 >= 0 && c + 3 < C) s += evalWindow([b[r][c], b[r - 1][c + 1], b[r - 2][c + 2], b[r - 3][c + 3]], p);
      }
      return s;
    }
    const ORDER = [3, 2, 4, 1, 5, 0, 6];
    function negamax(b, depth, alpha, beta, p) {
      const w = winner(b);
      if (w) return w.p === 0 ? 0 : (w.p === p ? 1e6 + depth : -1e6 - depth);
      if (depth === 0) return score(b, p) - score(b, 3 - p) * 0.5;
      let best = -Infinity;
      for (const c of ORDER) {
        const r = drop(b, c);
        if (r < 0) continue;
        b[r][c] = p;
        const v = -negamax(b, depth - 1, -beta, -alpha, 3 - p);
        b[r][c] = 0;
        if (v > best) best = v;
        if (best > alpha) alpha = best;
        if (alpha >= beta) break;
      }
      return best;
    }
    function cpuMove() {
      const depth = { easy: 1, normal: 3, hard: 5 }[mode];
      let bestC = ORDER.find(c => drop(board, c) >= 0), bestV = -Infinity;
      if (mode === 'easy' && Math.random() < 0.35) {
        const opts = ORDER.filter(c => drop(board, c) >= 0);
        return opts[U.rand(0, opts.length - 1)];
      }
      for (const c of ORDER) {
        const r = drop(board, c);
        if (r < 0) continue;
        board[r][c] = 2;
        const v = -negamax(board, depth, -Infinity, Infinity, 1);
        board[r][c] = 0;
        if (v > bestV) { bestV = v; bestC = c; }
      }
      return bestC;
    }

    function reset() {
      board = Array.from({ length: R }, () => Array(C).fill(0));
      turn = 1; over = false; busy = false;
      g.overlay.hide();
      render();
    }
    async function play(c) {
      if (over || busy) return;
      const r = drop(board, c);
      if (r < 0) return;
      busy = true;
      board[r][c] = turn;
      render({ r, c });
      OS.sound.play('pop');
      await new Promise(res => win.timeout(res, 350));
      const w = winner(board);
      if (w) {
        over = true;
        busy = false;
        tally[w.p === 0 ? 'd' : 'p' + w.p]++;
        OS.data.set('c4.tally', tally);
        render(null, w.cells);
        const msg = w.p === 0 ? "It's a draw" : mode === 'pvp' ? `${w.p === 1 ? 'Red' : 'Yellow'} wins!` : w.p === 1 ? 'You win! 🎉' : 'Computer wins';
        OS.sound.play(w.p === 2 && mode !== 'pvp' ? 'lose' : 'win');
        win.timeout(() => g.overlay.show(msg, null, [['Play again', reset]]), 900);
        return;
      }
      turn = 3 - turn;
      busy = false;
      render();
      if (mode !== 'pvp' && turn === 2) {
        busy = true;
        render();
        win.timeout(() => { const m = cpuMove(); busy = false; play(m); }, 60);
      }
    }
    function render(last, winCells) {
      boardEl.innerHTML = '';
      for (let c = 0; c < C; c++) {
        const col = U.h('div', { class: 'c4-col' + (hover === c && !over && !busy ? ' hover' : '') });
        col.onclick = () => { if (mode === 'pvp' || turn === 1) play(c); };
        col.onpointerenter = () => { hover = c; col.classList.add('hover'); };
        col.onpointerleave = () => { hover = -1; col.classList.remove('hover'); };
        for (let r = 0; r < R; r++) {
          const v = board[r][c];
          const cell = U.h('div', { class: 'c4-cell' }, v ? U.h('div', { class: 'c4-disc p' + v + (last && last.r === r && last.c === c ? ' drop' : '') + (winCells && winCells.some(([a, b]) => a === r && b === c) ? ' win' : ''), style: { '--r': r } }) : null);
          col.appendChild(cell);
        }
        boardEl.appendChild(col);
      }
      boardEl.dataset.turn = turn;
      status.innerHTML = over ? '' : mode === 'pvp' ? `<span class="c4-dot p${turn}"></span> ${turn === 1 ? 'Red' : 'Yellow'}'s turn` : turn === 1 ? '<span class="c4-dot p1"></span> Your turn' : '<span class="c4-dot p2"></span> Computer is thinking…';
      g.setScore(mode === 'pvp' ? `Red ${tally.p1} · Yellow ${tally.p2} · Draws ${tally.d}` : `You ${tally.p1} · CPU ${tally.p2} · Draws ${tally.d}`, '');
    }
    win.onKey(e => { if (/^[1-7]$/.test(e.key) && (mode === 'pvp' || turn === 1)) play(+e.key - 1); });
    reset();
    requestAnimationFrame(fit);
  },
});
