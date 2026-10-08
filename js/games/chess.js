/* Chess — full rules (castling, en passant, promotion, draws) with an alpha-beta AI */
'use strict';

(() => {
  /* ---------- engine ---------- */
  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
  const PST = {
    p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
    ke: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50],
  };
  const isW = p => p && p === p.toUpperCase();
  const colorOf = p => (p ? (isW(p) ? 'w' : 'b') : null);
  const ROW = i => i >> 3, COL = i => i & 7;
  const N_OFF = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const K_OFF = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const B_DIR = [[-1, -1], [-1, 1], [1, -1], [1, 1]], R_DIR = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const sqName = i => 'abcdefgh'[COL(i)] + (8 - ROW(i));

  function initial() {
    const b = Array(64).fill(null);
    'rnbqkbnr'.split('').forEach((p, i) => { b[i] = p; b[56 + i] = p.toUpperCase(); b[8 + i] = 'p'; b[48 + i] = 'P'; });
    return { b, turn: 'w', castle: { K: true, Q: true, k: true, q: true }, ep: -1, half: 0, full: 1 };
  }
  function attacked(b, sq, by) {
    const r = ROW(sq), c = COL(sq);
    const at = (rr, cc) => (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 ? b[rr * 8 + cc] : undefined);
    const own = p => p && colorOf(p) === by;
    // pawns
    const pd = by === 'w' ? 1 : -1;
    for (const dc of [-1, 1]) { const p = at(r + pd, c + dc); if (own(p) && p.toLowerCase() === 'p') return true; }
    for (const [dr, dc] of N_OFF) { const p = at(r + dr, c + dc); if (own(p) && p.toLowerCase() === 'n') return true; }
    for (const [dr, dc] of K_OFF) { const p = at(r + dr, c + dc); if (own(p) && p.toLowerCase() === 'k') return true; }
    for (const [dirs, kinds] of [[B_DIR, 'bq'], [R_DIR, 'rq']]) {
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
          const p = b[rr * 8 + cc];
          if (p) { if (own(p) && kinds.includes(p.toLowerCase())) return true; break; }
          rr += dr; cc += dc;
        }
      }
    }
    return false;
  }
  const kingSq = (b, color) => b.indexOf(color === 'w' ? 'K' : 'k');
  const inCheck = (s, color) => attacked(s.b, kingSq(s.b, color), color === 'w' ? 'b' : 'w');

  function pseudo(s) {
    const { b, turn } = s, moves = [], enemy = turn === 'w' ? 'b' : 'w';
    const add = (from, to, extra = {}) => moves.push({ from, to, piece: b[from], cap: b[to], ...extra });
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (!p || colorOf(p) !== turn) continue;
      const t = p.toLowerCase(), r = ROW(i), c = COL(i);
      if (t === 'p') {
        const d = turn === 'w' ? -1 : 1, start = turn === 'w' ? 6 : 1, last = turn === 'w' ? 0 : 7;
        const one = i + d * 8;
        const pushPromo = (to, extra) => { if (ROW(to) === last) 'qrbn'.split('').forEach(pr => add(i, to, { ...extra, promo: pr })); else add(i, to, extra); };
        if (r + d >= 0 && r + d < 8 && !b[one]) {
          pushPromo(one);
          if (r === start && !b[one + d * 8]) add(i, one + d * 8, { double: true });
        }
        for (const dc of [-1, 1]) {
          const cc = c + dc, rr = r + d;
          if (cc < 0 || cc > 7 || rr < 0 || rr > 7) continue;
          const to = rr * 8 + cc;
          if (b[to] && colorOf(b[to]) === enemy) pushPromo(to);
          else if (to === s.ep) add(i, to, { ep: true, cap: turn === 'w' ? 'p' : 'P' });
        }
      } else if (t === 'n' || t === 'k') {
        for (const [dr, dc] of t === 'n' ? N_OFF : K_OFF) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue;
          const to = rr * 8 + cc;
          if (!b[to] || colorOf(b[to]) === enemy) add(i, to);
        }
        if (t === 'k') {
          const rights = turn === 'w' ? ['K', 'Q'] : ['k', 'q'];
          const home = turn === 'w' ? 60 : 4;
          if (i === home && !attacked(b, i, enemy)) {
            if (s.castle[rights[0]] && !b[i + 1] && !b[i + 2] && b[i + 3] && b[i + 3].toLowerCase() === 'r' && !attacked(b, i + 1, enemy) && !attacked(b, i + 2, enemy)) add(i, i + 2, { castle: 'K' });
            if (s.castle[rights[1]] && !b[i - 1] && !b[i - 2] && !b[i - 3] && b[i - 4] && b[i - 4].toLowerCase() === 'r' && !attacked(b, i - 1, enemy) && !attacked(b, i - 2, enemy)) add(i, i - 2, { castle: 'Q' });
          }
        }
      } else {
        const dirs = t === 'b' ? B_DIR : t === 'r' ? R_DIR : [...B_DIR, ...R_DIR];
        for (const [dr, dc] of dirs) {
          let rr = r + dr, cc = c + dc;
          while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
            const to = rr * 8 + cc;
            if (b[to]) { if (colorOf(b[to]) === enemy) add(i, to); break; }
            add(i, to);
            rr += dr; cc += dc;
          }
        }
      }
    }
    return moves;
  }
  function make(s, m) {
    const b = s.b.slice(), castle = { ...s.castle };
    const p = b[m.from];
    b[m.to] = m.promo ? (s.turn === 'w' ? m.promo.toUpperCase() : m.promo) : p;
    b[m.from] = null;
    if (m.ep) b[m.to + (s.turn === 'w' ? 8 : -8)] = null;
    if (m.castle === 'K') { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = null; }
    if (m.castle === 'Q') { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = null; }
    if (p === 'K') castle.K = castle.Q = false;
    if (p === 'k') castle.k = castle.q = false;
    for (const sq of [m.from, m.to]) {
      if (sq === 63) castle.K = false; if (sq === 56) castle.Q = false;
      if (sq === 7) castle.k = false; if (sq === 0) castle.q = false;
    }
    return {
      b, castle, turn: s.turn === 'w' ? 'b' : 'w',
      ep: m.double ? (m.from + m.to) / 2 : -1,
      half: p.toLowerCase() === 'p' || m.cap ? 0 : s.half + 1,
      full: s.full + (s.turn === 'b' ? 1 : 0),
    };
  }
  function legal(s) {
    return pseudo(s).filter(m => !inCheck(make(s, m), s.turn));
  }
  function evaluate(s) {
    let score = 0, mat = 0;
    for (let i = 0; i < 64; i++) { const p = s.b[i]; if (p && p.toLowerCase() !== 'k' && p.toLowerCase() !== 'p') mat += VAL[p.toLowerCase()]; }
    const endgame = mat < 2600;
    for (let i = 0; i < 64; i++) {
      const p = s.b[i];
      if (!p) continue;
      const t = p.toLowerCase(), w = isW(p);
      const idx = w ? i : (7 - ROW(i)) * 8 + COL(i);
      const v = VAL[t] + PST[t === 'k' && endgame ? 'ke' : t][idx];
      score += w ? v : -v;
    }
    return s.turn === 'w' ? score : -score;
  }
  const order = ms => ms.sort((a, b) => ((b.cap ? VAL[b.cap.toLowerCase()] * 10 - VAL[b.piece.toLowerCase()] : 0) + (b.promo ? 800 : 0)) - ((a.cap ? VAL[a.cap.toLowerCase()] * 10 - VAL[a.piece.toLowerCase()] : 0) + (a.promo ? 800 : 0)));
  let nodes = 0;
  function quiesce(s, alpha, beta, depth) {
    nodes++;
    const stand = evaluate(s);
    if (stand >= beta) return beta;
    if (alpha < stand) alpha = stand;
    if (depth <= 0) return alpha;
    for (const m of order(pseudo(s).filter(m => m.cap))) {
      const ns = make(s, m);
      if (inCheck(ns, s.turn)) continue;
      const v = -quiesce(ns, -beta, -alpha, depth - 1);
      if (v >= beta) return beta;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }
  function search(s, depth, alpha, beta, ply) {
    if (depth === 0) return quiesce(s, alpha, beta, 4);
    nodes++;
    let any = false, best = -Infinity;
    for (const m of order(pseudo(s))) {
      const ns = make(s, m);
      if (inCheck(ns, s.turn)) continue;
      any = true;
      const v = -search(ns, depth - 1, -beta, -alpha, ply + 1);
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    if (!any) return inCheck(s, s.turn) ? -100000 + ply : 0;
    return best;
  }
  function bestMove(s, depth, randomness = 0) {
    nodes = 0;
    const moves = order(legal(s));
    let best = moves[0], bestV = -Infinity, alpha = -Infinity;
    for (const m of moves) {
      // with randomness every root move needs an exact score (a full window), otherwise noise could promote a fail-low bound
      const v = randomness
        ? -search(make(s, m), depth - 1, -Infinity, Infinity, 1) + Math.random() * randomness
        : -search(make(s, m), depth - 1, -Infinity, -alpha, 1);
      if (v > bestV) { bestV = v; best = m; }
      if (v > alpha) alpha = v;
    }
    return best;
  }
  function san(s, m, all) {
    if (m.castle) return m.castle === 'K' ? 'O-O' : 'O-O-O';
    const t = m.piece.toLowerCase();
    let str = '';
    if (t === 'p') { if (m.cap) str = 'abcdefgh'[COL(m.from)] + 'x'; }
    else {
      str = t.toUpperCase();
      const others = all.filter(o => o !== m && o.to === m.to && o.piece === m.piece && o.from !== m.from);
      if (others.length) str += others.some(o => COL(o.from) === COL(m.from)) ? (8 - ROW(m.from)) : 'abcdefgh'[COL(m.from)];
      if (m.cap) str += 'x';
    }
    str += sqName(m.to);
    if (m.promo) str += '=' + m.promo.toUpperCase();
    const ns = make(s, m);
    if (inCheck(ns, ns.turn)) str += legal(ns).length ? '+' : '#';
    return str;
  }
  const posKey = s => s.b.map(p => p || '.').join('') + s.turn + Object.entries(s.castle).filter(([, v]) => v).map(([k]) => k).join('') + s.ep;

  OS.chessEngine = { initial, legal, make, bestMove, inCheck, evaluate };

  /* ---------- UI ---------- */
  const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  OS.registerApp({
    id: 'chess', name: 'Chess', icon: 'chess', category: 'Games', width: 820, height: 640, minWidth: 380, minHeight: 440,
    desc: 'Play chess against the computer or a friend', keywords: 'game strategy board',
    launch(win) {
      let mode = OS.data.get('chess.mode', 'normal');
      let state, history, moveList, selected, targets, lastMove, flipped = false, over, thinking, captured, repetition;
      const sel = U.h('select', { class: 'input', style: { width: 'auto', minHeight: '28px', padding: '2px 6px' } },
        [['easy', 'vs CPU (easy)'], ['normal', 'vs CPU (normal)'], ['hard', 'vs CPU (hard)'], ['pvp', '2 players']].map(([v, l]) => U.h('option', { value: v, selected: v === mode }, l)));
      sel.onchange = () => { mode = sel.value; OS.data.set('chess.mode', mode); reset(); };
      const g = OS.ui.game(win, { bar: [sel,
        U.h('button', { class: 'btn small', onclick: undo, title: 'Undo move' }, '↶ Undo'),
        U.h('button', { class: 'btn small', onclick: () => { flipped = !flipped; render(); }, title: 'Flip board' }, '⇅ Flip'),
        U.h('button', { class: 'btn small', onclick: () => reset() }, 'New game')] });
      const boardEl = U.h('div', { class: 'ch-board' });
      const capTop = U.h('div', { class: 'ch-cap' }), capBot = U.h('div', { class: 'ch-cap' });
      const movesEl = U.h('div', { class: 'ch-moves' });
      const status = U.h('div', { class: 'ch-status' });
      g.stage.insertBefore(U.h('div', { class: 'ch' }, U.h('div', { class: 'ch-left' }, capTop, boardEl, capBot), U.h('div', { class: 'ch-side' }, status, movesEl)), g.overlay.el);
      function fit() {
        const sideW = g.stage.clientWidth > 640 ? 200 : 0;
        const s = Math.min(g.stage.clientWidth - sideW - 40, g.stage.clientHeight - 90);
        boardEl.style.setProperty('--sq', Math.max(32, Math.floor(s / 8)) + 'px');
        g.stage.classList.toggle('ch-narrow', !sideW);
      }
      win.onResize(fit);

      function reset() {
        state = initial();
        history = []; moveList = []; selected = -1; targets = []; lastMove = null; over = false; thinking = false;
        captured = { w: [], b: [] };
        repetition = { [posKey(state)]: 1 };
        g.overlay.hide();
        render();
      }
      function undo() {
        if (thinking || !history.length) return;
        const steps = mode === 'pvp' ? 1 : (state.turn === 'w' ? 2 : 1);
        for (let i = 0; i < steps && history.length; i++) {
          const h = history.pop();
          state = h.state; captured = h.captured; lastMove = h.lastMove; repetition = h.repetition;
          moveList.pop();
        }
        over = false; selected = -1; targets = [];
        g.overlay.hide();
        render();
      }
      function doMove(m) {
        const all = legal(state);
        const notation = san(state, m, all);
        history.push({ state, captured: { w: captured.w.slice(), b: captured.b.slice() }, lastMove, repetition: { ...repetition } });
        if (m.cap) captured[state.turn].push(m.cap.toLowerCase());
        state = make(state, m);
        moveList.push(notation);
        lastMove = m;
        selected = -1; targets = [];
        const key = posKey(state);
        repetition[key] = (repetition[key] || 0) + 1;
        OS.sound.play(m.cap ? 'hit' : 'blip');
        render();
        checkEnd();
        if (!over && mode !== 'pvp' && state.turn === 'b') cpu();
      }
      function cpu() {
        thinking = true;
        render();
        win.timeout(() => {
          const depth = { easy: 1, normal: 3, hard: 4 }[mode];
          const m = bestMove(state, depth, mode === 'easy' ? 120 : 8);
          thinking = false;
          if (m && !win.closed) doMove(m);
        }, 120);
      }
      function checkEnd() {
        const moves = legal(state);
        let msg = null;
        if (!moves.length) {
          if (inCheck(state, state.turn)) {
            const winner = state.turn === 'w' ? 'Black' : 'White';
            msg = [`Checkmate!`, mode === 'pvp' ? `${winner} wins` : winner === 'White' ? 'You win! 🎉' : 'The computer wins'];
            OS.sound.play(mode !== 'pvp' && winner === 'Black' ? 'lose' : 'win');
            if (mode !== 'pvp' && winner === 'White') OS.data.set('chess.wins.' + mode, OS.data.get('chess.wins.' + mode, 0) + 1);
          } else msg = ['Stalemate', 'The game is a draw'];
        } else if (state.half >= 100) msg = ['Draw', '50-move rule'];
        else if (Object.values(repetition).some(v => v >= 3)) msg = ['Draw', 'Threefold repetition'];
        else {
          const pieces = state.b.filter(Boolean).map(p => p.toLowerCase()).filter(p => p !== 'k');
          if (!pieces.length || (pieces.length === 1 && 'nb'.includes(pieces[0]))) msg = ['Draw', 'Insufficient material'];
        }
        if (msg) { over = true; render(); win.timeout(() => g.overlay.show(msg[0], msg[1], [['New game', reset], ['Review board', () => g.overlay.hide(), false]]), 500); }
      }
      function clickSquare(i) {
        if (over || thinking) return;
        if (mode !== 'pvp' && state.turn !== 'w') return;
        const p = state.b[i];
        if (selected >= 0 && targets.some(m => m.to === i)) {
          const opts = targets.filter(m => m.to === i);
          if (opts.length > 1 && opts[0].promo) {
            const r = boardEl.children[0].getBoundingClientRect();
            const sqEl = boardEl.querySelector(`[data-i="${i}"]`);
            const rr = sqEl ? sqEl.getBoundingClientRect() : r;
            OS.menu(rr.left, rr.bottom, opts.map(m => ({ label: { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' }[m.promo], icon: GLYPH[m.promo], action: () => doMove(m) })));
            return;
          }
          doMove(opts[0]);
          return;
        }
        if (p && colorOf(p) === state.turn) {
          selected = i;
          targets = legal(state).filter(m => m.from === i);
          OS.sound.play('click');
        } else { selected = -1; targets = []; }
        render();
      }
      function render() {
        boardEl.innerHTML = '';
        const checkSq = inCheck(state, state.turn) ? kingSq(state.b, state.turn) : -1;
        for (let k = 0; k < 64; k++) {
          const i = flipped ? 63 - k : k;
          const r = ROW(i), c = COL(i);
          const p = state.b[i];
          const t = targets.find(m => m.to === i);
          const sq = U.h('div', {
            class: 'ch-sq ' + ((r + c) % 2 ? 'dark' : 'light') + (i === selected ? ' sel' : '') + (lastMove && (lastMove.from === i || lastMove.to === i) ? ' last' : '') + (i === checkSq ? ' check' : '') + (t ? (t.cap ? ' cap' : ' dot') : ''),
            dataset: { i },
          }, p ? U.h('span', { class: 'ch-p ' + (isW(p) ? 'w' : 'b') }, GLYPH[p.toLowerCase()]) : null,
          (flipped ? r === 0 : r === 7) ? U.h('span', { class: 'ch-coord f' }, 'abcdefgh'[c]) : null,
          (flipped ? c === 7 : c === 0) ? U.h('span', { class: 'ch-coord r' }, 8 - r) : null);
          sq.onclick = () => clickSquare(i);
          boardEl.appendChild(sq);
        }
        const capStr = (arr, white) => arr.slice().sort((a, b) => VAL[b] - VAL[a]).map(p => `<span class="ch-p ${white ? 'w' : 'b'}">${GLYPH[p]}</span>`).join('');
        const matDiff = captured.w.reduce((a, p) => a + VAL[p], 0) - captured.b.reduce((a, p) => a + VAL[p], 0);
        const top = flipped ? 'w' : 'b', bot = flipped ? 'b' : 'w';
        // captured[x] = pieces captured BY side x
        capTop.innerHTML = capStr(captured[top], top === 'b') + (top === 'w' && matDiff > 0 ? ` +${matDiff / 100}` : top === 'b' && matDiff < 0 ? ` +${-matDiff / 100}` : '');
        capBot.innerHTML = capStr(captured[bot], bot === 'b') + (bot === 'w' && matDiff > 0 ? ` +${matDiff / 100}` : bot === 'b' && matDiff < 0 ? ` +${-matDiff / 100}` : '');
        movesEl.innerHTML = '';
        for (let i = 0; i < moveList.length; i += 2) movesEl.appendChild(U.h('div', { class: 'ch-mv' }, U.h('span', { class: 'muted' }, (i / 2 + 1) + '.'), U.h('span', {}, moveList[i]), U.h('span', {}, moveList[i + 1] || '')));
        movesEl.scrollTop = movesEl.scrollHeight;
        status.textContent = over ? 'Game over' : thinking ? 'Computer is thinking…' : `${state.turn === 'w' ? 'White' : 'Black'} to move${inCheck(state, state.turn) ? ' — Check!' : ''}`;
        const wins = OS.data.get('chess.wins.' + mode, 0);
        g.setScore(mode === 'pvp' ? 'Two players' : `You play White · Wins vs ${mode}: ${wins}`, '');
      }
      win.onKey(e => { if ((e.ctrlKey || e.metaKey) && e.key === 'z') undo(); if (e.key === 'Escape') { selected = -1; targets = []; render(); } });
      reset();
      requestAnimationFrame(fit);
    },
  });
})();
