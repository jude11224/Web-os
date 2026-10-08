/* Flappy — tap to fly between the pipes */
'use strict';

OS.registerApp({
  id: 'flappy', name: 'Flappy Bird', icon: 'flappy', category: 'Games', width: 440, height: 680, minWidth: 260, minHeight: 400,
  desc: 'Tap to flap through the pipes', keywords: 'game arcade bird',
  launch(win) {
    const W = 400, H = 600, GROUND = 540;
    const g = OS.ui.game(win, { w: W, h: H });
    let bird, pipes, score, state, t, groundX, spawnT;
    function reset() {
      bird = { x: 110, y: 260, vy: 0, r: 15 };
      pipes = []; score = 0; t = 0; groundX = 0; spawnT = 0;
      state = 'ready';
      hud();
    }
    function hud() { g.setScore(`Score: ${score}`, `Best: ${OS.ui.best('flappy') || 0}`); }
    function flap() {
      if (state === 'over') { if (t > 0.6) reset(); return; }
      if (state === 'ready') state = 'play';
      bird.vy = -330;
      OS.sound.tone(700, 0, 0.08, 'square', 0.04);
    }
    function die() {
      if (state === 'over') return;
      state = 'over';
      t = 0;
      OS.sound.play('hit');
      OS.ui.best('flappy', score);
      hud();
    }
    g.canvas.addEventListener('pointerdown', e => { e.preventDefault(); flap(); });
    win.onKey(e => { if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); flap(); } });

    const ctx = g.ctx;
    const clouds = Array.from({ length: 5 }, (_, i) => ({ x: i * 100, y: 40 + (i * 53) % 160, s: 0.6 + (i % 3) * 0.3 }));
    win.loop(dt => {
      t += dt;
      if (state === 'play') {
        bird.vy += 1000 * dt;
        bird.y += bird.vy * dt;
        spawnT -= dt;
        if (spawnT <= 0) {
          spawnT = 1.45;
          const gap = Math.max(120, 160 - score * 1.5);
          const top = U.rand(70, GROUND - gap - 70);
          pipes.push({ x: W + 30, top, gap, passed: false });
        }
        const sp = 140 + Math.min(80, score * 2);
        pipes.forEach(p => { p.x -= sp * dt; });
        pipes = pipes.filter(p => p.x > -80);
        groundX = (groundX - sp * dt) % 24;
        for (const p of pipes) {
          if (!p.passed && p.x + 30 < bird.x) { p.passed = true; score++; OS.sound.play('coin'); hud(); }
          if (bird.x + bird.r - 4 > p.x - 30 && bird.x - bird.r + 4 < p.x + 30 && (bird.y - bird.r + 4 < p.top || bird.y + bird.r - 4 > p.top + p.gap)) die();
        }
        if (bird.y + bird.r > GROUND) { bird.y = GROUND - bird.r; die(); }
        if (bird.y < bird.r) { bird.y = bird.r; bird.vy = 0; }
      } else if (state === 'over') {
        if (bird.y + bird.r < GROUND) { bird.vy += 1200 * dt; bird.y = Math.min(GROUND - bird.r, bird.y + bird.vy * dt); }
      } else {
        bird.y = 260 + Math.sin(t * 4) * 8;
        groundX = (groundX - 100 * dt) % 24;
      }
      // sky
      const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
      sky.addColorStop(0, '#38bdf8'); sky.addColorStop(1, '#bae6fd');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      clouds.forEach(c => {
        if (state !== 'over') c.x -= 15 * c.s * dt;
        if (c.x < -80) c.x = W + 40;
        ctx.beginPath(); ctx.arc(c.x, c.y, 20 * c.s, 0, 7); ctx.arc(c.x + 22 * c.s, c.y - 8 * c.s, 24 * c.s, 0, 7); ctx.arc(c.x + 46 * c.s, c.y, 18 * c.s, 0, 7); ctx.fill();
      });
      // city silhouette
      ctx.fillStyle = '#7dd3fc';
      for (let i = 0; i < 12; i++) ctx.fillRect(i * 36, GROUND - 40 - ((i * 37) % 50), 32, 90);
      // pipes
      pipes.forEach(p => {
        const pipe = (y, h, cap) => {
          const gr = ctx.createLinearGradient(p.x - 30, 0, p.x + 30, 0);
          gr.addColorStop(0, '#15803d'); gr.addColorStop(0.4, '#4ade80'); gr.addColorStop(1, '#166534');
          ctx.fillStyle = gr; ctx.fillRect(p.x - 28, y, 56, h);
          ctx.fillRect(p.x - 32, cap, 64, 22);
          ctx.strokeStyle = '#14532d'; ctx.lineWidth = 2; ctx.strokeRect(p.x - 28, y, 56, h); ctx.strokeRect(p.x - 32, cap, 64, 22);
        };
        pipe(0, p.top, p.top - 22);
        pipe(p.top + p.gap, GROUND - p.top - p.gap, p.top + p.gap);
      });
      // ground
      ctx.fillStyle = '#ded895'; ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = '#84cc16'; ctx.fillRect(0, GROUND, W, 14);
      ctx.fillStyle = '#65a30d';
      for (let x = groundX; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x, GROUND + 14); ctx.lineTo(x + 12, GROUND); ctx.lineTo(x + 24, GROUND); ctx.lineTo(x + 12, GROUND + 14); ctx.fill(); }
      // bird
      ctx.save();
      ctx.translate(bird.x, bird.y);
      ctx.rotate(U.clamp(bird.vy / 600, -0.5, 1.2));
      ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.ellipse(0, 0, bird.r + 3, bird.r, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#a16207'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.ellipse(-6, 3 + Math.sin(t * 25) * (state === 'play' ? 4 : 1), 9, 5, -0.3, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(7, -5, 6, 0, 7); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(9, -5, 2.6, 0, 7); ctx.fill();
      ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(24, 3); ctx.lineTo(12, 7); ctx.fill();
      ctx.restore();
      // text
      ctx.textAlign = 'center';
      ctx.lineWidth = 5; ctx.strokeStyle = '#0f172a'; ctx.fillStyle = '#fff';
      const big = (s, y, size) => { ctx.font = `800 ${size}px system-ui`; ctx.strokeText(s, W / 2, y); ctx.fillText(s, W / 2, y); };
      if (state !== 'ready') big(score, 80, 48);
      if (state === 'ready') { big('Flappy Bird', 170, 40); big('Tap or press Space', 380, 20); }
      if (state === 'over') { big('Game Over', 200, 42); big(`Score ${score}   Best ${OS.ui.best('flappy') || 0}`, 250, 20); if (t > 0.6) big('Tap to retry', 380, 20); }
      ctx.textAlign = 'left';
    });
    reset();
  },
});
