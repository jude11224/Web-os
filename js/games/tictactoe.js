/* Tic-Tac-Toe with unbeatable (or easy) AI */
'use strict';

OS.registerApp({
  id: 'tictactoe', name: 'Tic-Tac-Toe', icon: 'tictactoe', category: 'Games', width: 420, height: 560, minWidth: 300, minHeight: 420,
  desc: 'Noughts and crosses vs the computer or a friend', keywords: 'game x o noughts crosses',
  launch(win) {
    let mode = OS.data.get('ttt.mode', 'hard');
    let board, turn, over, tally = OS.data.get('ttt.tally', { X: 0, O: 0, draw: 0 });
    const modeSel = U.h('select', { class: 'input', style: { width: 'auto', minHeight: '28px', padding: '2px 6px' } },
      [['easy', 'vs CPU (easy)'], ['hard', 'vs CPU (unbeatable)'], ['pvp', '2 players']].map(([v, l]) => U.h('option', { value: v, selected: v === mode }, l)));
    modeSel.onchange = () => { mode = modeSel.value; OS.data.set('ttt.mode', mode); reset(); };
    const g = OS.ui.game(win, { bar: [modeSel, U.h('button', { class: 'btn small', onclick: () => reset() }, 'New round')] });
    const status = U.h('div', { class: 'ttt-status' });
    const grid = U.h('div', { class: 'ttt-grid' });
    g.stage.insertBefore(U.h('div', { class: 'ttt' }, status, grid), g.overlay.el);
    const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    const winner = b => { for (const l of LINES) if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[1]] === b[l[2]]) return { p: b[l[0]], l }; return b.every(Boolean) ? { p: 'draw' } : null; };

    function minimax(b, player) {
      const w = winner(b);
      if (w) return { score: w.p === 'O' ? 10 : w.p === 'X' ? -10 : 0 };
      let best = { score: player === 'O' ? -Infinity : Infinity };
      b.forEach((v, i) => {
        if (v) return;
        b[i] = player;
        const s = minimax(b, player === 'O' ? 'X' : 'O').score * 0.99;
        b[i] = null;
        if (player === 'O' ? s > best.score : s < best.score) best = { score: s, i };
      });
      return best;
    }
    function cpu() {
      const empty = board.map((v, i) => v ? null : i).filter(i => i != null);
      const i = mode === 'easy' && Math.random() < 0.6 ? empty[U.rand(0, empty.length - 1)] : minimax(board.slice(), 'O').i;
      play(i);
    }
    function reset() {
      board = Array(9).fill(null);
      turn = 'X';
      over = false;
      g.overlay.hide();
      render();
    }
    function play(i) {
      if (over || board[i]) return;
      board[i] = turn;
      OS.sound.play(turn === 'X' ? 'blip' : 'pop');
      const w = winner(board);
      if (w) {
        over = true;
        tally[w.p === 'draw' ? 'draw' : w.p]++;
        OS.data.set('ttt.tally', tally);
        render(w);
        OS.sound.play(w.p === 'draw' ? 'click' : (mode !== 'pvp' && w.p === 'O') ? 'lose' : 'win');
        win.timeout(() => g.overlay.show(w.p === 'draw' ? "It's a draw" : mode !== 'pvp' ? (w.p === 'X' ? 'You win! 🎉' : 'Computer wins') : `${w.p} wins!`, null, [['Play again', reset]]), 700);
        return;
      }
      turn = turn === 'X' ? 'O' : 'X';
      render();
      if (mode !== 'pvp' && turn === 'O') win.timeout(cpu, 380);
    }
    function render(w) {
      grid.innerHTML = '';
      board.forEach((v, i) => {
        const c = U.h('button', { class: 'ttt-cell' + (v ? ' ' + v.toLowerCase() : '') + (w && w.l && w.l.includes(i) ? ' win' : '') }, v || '');
        c.onclick = () => { if (mode === 'pvp' || turn === 'X') play(i); };
        grid.appendChild(c);
      });
      status.textContent = over ? '' : mode === 'pvp' ? `${turn}'s turn` : turn === 'X' ? 'Your turn (X)' : 'Computer is thinking…';
      g.setScore(mode === 'pvp' ? `X: ${tally.X}  ·  O: ${tally.O}  ·  Draws: ${tally.draw}` : `You: ${tally.X}  ·  CPU: ${tally.O}  ·  Draws: ${tally.draw}`, '');
    }
    win.onKey(e => { if (/^[1-9]$/.test(e.key)) { const i = +e.key - 1; if (mode === 'pvp' || turn === 'X') play(i); } });
    reset();
  },
});
