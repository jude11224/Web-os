/* Pong vs CPU */
'use strict';

OS.registerApp({
  id: 'pong', name: 'Pong', icon: 'pong', category: 'Games', width: 720, height: 520, minWidth: 360, minHeight: 300,
  desc: 'The original table-tennis video game', keywords: 'game arcade paddle tennis',
  launch(win) {
    const W = 640, H = 400, PH = 70, WIN_SCORE = 7;
    let diff = OS.data.get('pong.diff', 'normal');
    const dsel = U.h('select', { class: 'input', style: { width: 'auto', minHeight: '28px', padding: '2px 6px' } },
      [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard'], ['2p', '2 players (W/S vs ↑/↓)']].map(([v, l]) => U.h('option', { value: v, selected: v === diff }, l)));
    dsel.onchange = () => { diff = dsel.value; OS.data.set('pong.diff', diff); reset(); };
    const g = OS.ui.game(win, { w: W, h: H, bar: [dsel, U.h('button', { class: 'btn small', onclick: () => reset() }, 'New match')] });
    let p1, p2, ball, s1, s2, state, keys = {}, serveT;
    function reset() {
      p1 = { y: H / 2 }; p2 = { y: H / 2 }; s1 = 0; s2 = 0;
      serve(1);
      state = 'ready';
      g.overlay.show('Pong', diff === '2p' ? 'Left: W/S  ·  Right: ↑/↓  ·  First to 7' : 'Move with mouse, touch or ↑/↓. First to 7 wins.', [['Play', () => { state = 'play'; g.overlay.hide(); }]]);
      hud();
    }
    function serve(dir) {
      ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, dir };
      serveT = 0.8;
    }
    function hud() { g.setScore(diff === '2p' ? `Left ${s1} : ${s2} Right` : `You ${s1} : ${s2} CPU`, ''); }
    g.canvas.addEventListener('pointermove', e => { if (diff !== '2p') p1.y = U.clamp(g.pos(e).y, PH / 2, H - PH / 2); });
    win.onKey(e => { keys[e.key] = true; if (['ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault(); if (e.key === 'p' && state === 'play') { state = 'pause'; g.overlay.show('Paused', null, [['Resume', () => { state = 'play'; g.overlay.hide(); }]]); } });
    win.onKey(e => { keys[e.key] = false; }, 'keyup');
    win.onBlur = () => { keys = {}; if (state === 'play') { state = 'pause'; g.overlay.show('Paused', null, [['Resume', () => { state = 'play'; g.overlay.hide(); }]]); } };

    const ctx = g.ctx;
    win.loop(dt => {
      if (state === 'play') {
        const sp = 420;
        if (diff === '2p') {
          if (keys.w || keys.W) p1.y -= sp * dt;
          if (keys.s || keys.S) p1.y += sp * dt;
          if (keys.ArrowUp) p2.y -= sp * dt;
          if (keys.ArrowDown) p2.y += sp * dt;
        } else {
          if (keys.ArrowUp || keys.w) p1.y -= sp * dt;
          if (keys.ArrowDown || keys.s) p1.y += sp * dt;
          const cpuSp = { easy: 190, normal: 290, hard: 420 }[diff];
          const target = ball.vx > 0 ? ball.y + (diff === 'hard' ? 0 : Math.sin(performance.now() / 300) * 20) : H / 2;
          p2.y += U.clamp(target - p2.y, -cpuSp * dt, cpuSp * dt);
        }
        p1.y = U.clamp(p1.y, PH / 2, H - PH / 2);
        p2.y = U.clamp(p2.y, PH / 2, H - PH / 2);
        if (serveT > 0) {
          serveT -= dt;
          if (serveT <= 0) { const a = (Math.random() - 0.5) * 0.8; ball.vx = Math.cos(a) * 320 * ball.dir; ball.vy = Math.sin(a) * 320; }
        }
        ball.x += ball.vx * dt; ball.y += ball.vy * dt;
        if (ball.y < 8) { ball.y = 8; ball.vy = Math.abs(ball.vy); OS.sound.play('blip'); }
        if (ball.y > H - 8) { ball.y = H - 8; ball.vy = -Math.abs(ball.vy); OS.sound.play('blip'); }
        const hit = (px, py, side) => {
          if (Math.abs(ball.x - px) < 14 && Math.abs(ball.y - py) < PH / 2 + 8 && Math.sign(ball.vx) === side) {
            const rel = (ball.y - py) / (PH / 2);
            const sp2 = Math.min(800, Math.hypot(ball.vx, ball.vy) * 1.06);
            ball.vx = -side * sp2 * Math.cos(rel * 0.9);
            ball.vy = sp2 * Math.sin(rel * 0.9);
            OS.sound.play('click');
          }
        };
        hit(24, p1.y, -1);
        hit(W - 24, p2.y, 1);
        if (ball.x < -20 || ball.x > W + 20) {
          if (ball.x < 0) s2++; else s1++;
          OS.sound.play(ball.x < 0 && diff !== '2p' ? 'lose' : 'coin');
          hud();
          if (s1 >= WIN_SCORE || s2 >= WIN_SCORE) {
            state = 'over';
            const msg = diff === '2p' ? (s1 > s2 ? 'Left player wins!' : 'Right player wins!') : s1 > s2 ? 'You win! 🎉' : 'CPU wins';
            if (diff !== '2p' && s1 > s2) OS.sound.play('win');
            g.overlay.show(msg, `${s1} : ${s2}`, [['Play again', () => { reset(); state = 'play'; g.overlay.hide(); }]]);
          } else serve(ball.x < 0 ? 1 : -1);
        }
      }
      ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#334155';
      for (let y = 6; y < H; y += 24) ctx.fillRect(W / 2 - 2, y, 4, 12);
      ctx.fillStyle = '#e2e8f0'; ctx.font = '700 56px ui-monospace, monospace'; ctx.textAlign = 'center';
      ctx.fillText(s1, W / 2 - 70, 70); ctx.fillText(s2, W / 2 + 70, 70); ctx.textAlign = 'left';
      ctx.fillStyle = '#38bdf8'; ctx.fillRect(14, p1.y - PH / 2, 10, PH);
      ctx.fillStyle = '#f472b6'; ctx.fillRect(W - 24, p2.y - PH / 2, 10, PH);
      ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 14;
      ctx.fillRect(ball.x - 7, ball.y - 7, 14, 14);
      ctx.shadowBlur = 0;
    });
    reset();
  },
});
