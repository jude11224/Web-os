/* Breakout */
'use strict';

OS.registerApp({
  id: 'breakout', name: 'Breakout', icon: 'breakout', category: 'Games', width: 560, height: 680, minWidth: 300, minHeight: 400,
  desc: 'Smash all the bricks', keywords: 'arkanoid game arcade paddle',
  launch(win) {
    const W = 480, H = 600;
    const g = OS.ui.game(win, { w: W, h: H, bar: [U.h('button', { class: 'btn small', onclick: () => { newGame(); } }, 'New game')] });
    let paddle, balls, bricks, lives, score, level, state, powerups, particles, keys = {}, wideT;
    const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7'];

    function newGame() { lives = 3; score = 0; level = 1; buildLevel(); }
    function buildLevel() {
      paddle = { x: W / 2, w: 90, y: H - 40 };
      bricks = [];
      const rows = Math.min(7, 4 + level), cols = 10, bw = 44, bh = 18, ox = (W - cols * bw) / 2;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        if (level % 3 === 2 && (r + c) % 4 === 0) continue;
        if (level % 3 === 0 && Math.abs(c - 4.5) < r * 0.6 - 1) continue;
        const hp = r < level - 1 ? 2 : 1;
        bricks.push({ x: ox + c * bw + 2, y: 70 + r * (bh + 4), w: bw - 4, h: bh, hp, color: COLORS[r % COLORS.length] });
      }
      powerups = []; particles = []; wideT = 0;
      resetBall();
      state = 'ready';
      hud();
      g.overlay.show(level === 1 ? 'Breakout' : `Level ${level}`, 'Move with mouse, touch or ←/→. Click or Space to launch.', [['Start', launch]]);
    }
    function resetBall() { balls = [{ x: paddle.x, y: paddle.y - 10, vx: 0, vy: 0, r: 7, stuck: true }]; }
    function launch() {
      g.overlay.hide();
      state = 'play';
      balls.forEach(b => { if (b.stuck) { const sp = 300 + level * 25; b.stuck = false; b.vx = sp * 0.5 * (Math.random() < 0.5 ? -1 : 1); b.vy = -sp * 0.87; } });
    }
    function hud() { g.setScore(`Score: ${score}  ·  Lives: ${'♥'.repeat(Math.max(0, lives))}  ·  Level ${level}`, `Best: ${OS.ui.best('breakout') || 0}`); }
    function burst(x, y, color) { for (let i = 0; i < 10; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 240, vy: (Math.random() - 0.5) * 240, life: 0.5, color }); }

    g.canvas.addEventListener('pointermove', e => { paddle.x = U.clamp(g.pos(e).x, paddle.w / 2, W - paddle.w / 2); });
    g.canvas.addEventListener('pointerdown', e => { paddle.x = U.clamp(g.pos(e).x, paddle.w / 2, W - paddle.w / 2); if (state === 'play') launch(); });
    win.onKey(e => {
      keys[e.key] = true;
      if (e.key === ' ') { e.preventDefault(); if (state === 'play') launch(); else if (state === 'pause') { state = 'play'; g.overlay.hide(); } }
      if (e.key === 'p' || e.key === 'Escape') { if (state === 'play') { state = 'pause'; g.overlay.show('Paused', null, [['Resume', () => { state = 'play'; g.overlay.hide(); }]]); } }
    });
    win.onKey(e => { keys[e.key] = false; }, 'keyup');
    win.onBlur = () => { keys = {}; if (state === 'play') { state = 'pause'; g.overlay.show('Paused', null, [['Resume', () => { state = 'play'; g.overlay.hide(); }]]); } };

    const ctx = g.ctx;
    win.loop(dt => {
      if (state === 'play') {
        if (keys.ArrowLeft || keys.a) paddle.x -= 520 * dt;
        if (keys.ArrowRight || keys.d) paddle.x += 520 * dt;
        if (wideT > 0) { wideT -= dt; paddle.w = 140; } else paddle.w = 90;
        paddle.x = U.clamp(paddle.x, paddle.w / 2, W - paddle.w / 2);
        for (const b of balls) {
          if (b.stuck) { b.x = paddle.x; b.y = paddle.y - b.r - 2; continue; }
          const steps = 4;
          for (let s = 0; s < steps; s++) {
            b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
            if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); OS.sound.play('blip'); }
            if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); OS.sound.play('blip'); }
            if (b.y < b.r + 30) { b.y = b.r + 30; b.vy = Math.abs(b.vy); OS.sound.play('blip'); }
            // paddle
            if (b.vy > 0 && b.y + b.r >= paddle.y && b.y + b.r <= paddle.y + 14 && Math.abs(b.x - paddle.x) <= paddle.w / 2 + b.r) {
              const rel = (b.x - paddle.x) / (paddle.w / 2);
              const sp = Math.min(700, Math.hypot(b.vx, b.vy) * 1.01);
              const ang = rel * 1.1;
              b.vx = sp * Math.sin(ang); b.vy = -sp * Math.cos(ang);
              b.y = paddle.y - b.r;
              OS.sound.play('click');
            }
            // bricks
            for (const k of bricks) {
              if (k.hp <= 0) continue;
              const cx = U.clamp(b.x, k.x, k.x + k.w), cy = U.clamp(b.y, k.y, k.y + k.h);
              if ((b.x - cx) ** 2 + (b.y - cy) ** 2 > b.r * b.r) continue;
              const ox = Math.min(b.x + b.r - k.x, k.x + k.w - (b.x - b.r)), oy = Math.min(b.y + b.r - k.y, k.y + k.h - (b.y - b.r));
              if (ox < oy) b.vx = b.x < k.x + k.w / 2 ? -Math.abs(b.vx) : Math.abs(b.vx);
              else b.vy = b.y < k.y + k.h / 2 ? -Math.abs(b.vy) : Math.abs(b.vy);
              k.hp--;
              if (k.hp <= 0) {
                score += 10 * level;
                burst(k.x + k.w / 2, k.y + k.h / 2, k.color);
                OS.sound.play('pop');
                if (Math.random() < 0.12) powerups.push({ x: k.x + k.w / 2, y: k.y, type: Math.random() < 0.5 ? 'wide' : 'multi' });
              } else OS.sound.play('hit');
              hud();
              break;
            }
          }
        }
        balls = balls.filter(b => b.y < H + 20);
        if (!balls.length) {
          lives--;
          OS.sound.play('lose');
          hud();
          if (lives <= 0) {
            state = 'over';
            const prev = OS.ui.best('breakout') || 0;
            OS.ui.best('breakout', score);
            g.overlay.show('Game over', `Score: ${score}${score > prev ? ' — New best!' : ''}`, [['Play again', newGame]]);
          } else { resetBall(); state = 'play'; }
        }
        powerups.forEach(p => { p.y += 150 * dt; });
        powerups = powerups.filter(p => {
          if (p.y > paddle.y - 8 && p.y < paddle.y + 14 && Math.abs(p.x - paddle.x) < paddle.w / 2 + 10) {
            OS.sound.play('coin');
            if (p.type === 'wide') wideT = 12;
            else { const src = balls[0]; if (src) [-1, 1].forEach(d => balls.push({ x: src.x, y: src.y, vx: src.vx * 0.8 + d * 150, vy: -Math.abs(src.vy), r: 7, stuck: false })); }
            return false;
          }
          return p.y < H;
        });
        if (bricks.every(k => k.hp <= 0)) {
          state = 'between';
          OS.sound.play('win');
          score += 100 * level;
          OS.ui.best('breakout', score);
          level++;
          g.overlay.show('Level cleared!', `Score: ${score}`, [['Next level', buildLevel]]);
        }
      }
      particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt; });
      particles = particles.filter(p => p.life > 0);

      // draw
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0f172a'); bg.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffffff22'; ctx.fillRect(0, 28, W, 2);
      ctx.fillStyle = '#cbd5e1'; ctx.font = '600 14px system-ui';
      ctx.fillText(`SCORE ${score}`, 12, 20);
      ctx.textAlign = 'right'; ctx.fillText(`LEVEL ${level}   ${'♥'.repeat(Math.max(0, lives))}`, W - 12, 20); ctx.textAlign = 'left';
      bricks.forEach(k => {
        if (k.hp <= 0) return;
        ctx.fillStyle = k.color;
        ctx.globalAlpha = k.hp > 1 ? 1 : 0.85;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(k.x, k.y, k.w, k.h, 4) : ctx.rect(k.x, k.y, k.w, k.h); ctx.fill();
        if (k.hp > 1) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
        ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(k.x + 2, k.y + 2, k.w - 4, 4);
        ctx.globalAlpha = 1;
      });
      powerups.forEach(p => {
        ctx.fillStyle = p.type === 'wide' ? '#22c55e' : '#f59e0b';
        ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText(p.type === 'wide' ? 'W' : '3', p.x, p.y + 4); ctx.textAlign = 'left';
      });
      const pg = ctx.createLinearGradient(0, paddle.y, 0, paddle.y + 12);
      pg.addColorStop(0, '#e2e8f0'); pg.addColorStop(1, '#64748b');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(paddle.x - paddle.w / 2, paddle.y, paddle.w, 12, 6) : ctx.rect(paddle.x - paddle.w / 2, paddle.y, paddle.w, 12); ctx.fill();
      balls.forEach(b => { ctx.fillStyle = '#fff'; ctx.shadowColor = '#93c5fd'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; });
      particles.forEach(p => { ctx.globalAlpha = p.life * 2; ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); });
      ctx.globalAlpha = 1;
    });
    newGame();
  },
});
