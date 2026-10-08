/* Snake */
'use strict';

OS.registerApp({
  id: 'snake', name: 'Snake', icon: 'snake', category: 'Games', width: 560, height: 640, minWidth: 300, minHeight: 360,
  desc: 'Eat, grow, don\'t bite yourself', keywords: 'game arcade classic',
  launch(win) {
    const N = 24, C = 20;
    let mode = OS.data.get('snake.mode', 'walls');
    const modeBtn = U.h('button', { class: 'btn small', title: 'Toggle wall mode', onclick: () => { mode = mode === 'walls' ? 'wrap' : 'walls'; OS.data.set('snake.mode', mode); modeBtn.textContent = mode === 'walls' ? 'Walls: on' : 'Walls: off'; reset(); } }, mode === 'walls' ? 'Walls: on' : 'Walls: off');
    const g = OS.ui.game(win, { w: N * C, h: N * C, bar: [modeBtn, U.h('button', { class: 'btn small', onclick: () => reset() }, 'New game')] });
    let snake, dir, queue, food, bonus, score, state, acc, speed, particles;
    const best = () => OS.ui.best('snake' + mode) || 0;

    function reset() {
      snake = [{ x: 8, y: 12 }, { x: 7, y: 12 }, { x: 6, y: 12 }];
      dir = { x: 1, y: 0 }; queue = []; score = 0; acc = 0; speed = 8; bonus = null; particles = [];
      placeFood();
      state = 'ready';
      g.overlay.show('Snake', 'Arrow keys / WASD or swipe to move. Space to pause.', [['Play', start]]);
      hud();
    }
    function start() { state = 'play'; g.overlay.hide(); }
    function hud() { g.setScore(`Score: ${score}`, `Best: ${best()}`); }
    function free() {
      let p;
      do { p = { x: U.rand(0, N - 1), y: U.rand(0, N - 1) }; } while (snake.some(s => s.x === p.x && s.y === p.y) || (food && food.x === p.x && food.y === p.y));
      return p;
    }
    function placeFood() { food = free(); }
    function turn(dx, dy) {
      if (state === 'ready') start();
      if (state !== 'play') return;
      const last = queue.length ? queue[queue.length - 1] : dir;
      if (last.x === -dx && last.y === -dy) return;
      if (last.x === dx && last.y === dy) return;
      if (queue.length < 3) queue.push({ x: dx, y: dy });
    }
    function burst(x, y, color) {
      for (let i = 0; i < 14; i++) particles.push({ x: x * C + C / 2, y: y * C + C / 2, vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200, life: 0.6, color });
    }
    function step() {
      if (queue.length) dir = queue.shift();
      let head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      if (mode === 'wrap') { head.x = (head.x + N) % N; head.y = (head.y + N) % N; }
      if (head.x < 0 || head.y < 0 || head.x >= N || head.y >= N || snake.slice(0, -1).some(s => s.x === head.x && s.y === head.y)) return die();
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score += 10; speed = Math.min(22, speed + 0.35);
        OS.sound.play('coin'); burst(food.x, food.y, '#ef4444');
        placeFood();
        if (!bonus && Math.random() < 0.25) bonus = { ...free(), t: 6 };
      } else if (bonus && head.x === bonus.x && head.y === bonus.y) {
        score += 50; OS.sound.play('win'); burst(bonus.x, bonus.y, '#f59e0b'); bonus = null;
      } else snake.pop();
      hud();
    }
    function die() {
      state = 'over';
      OS.sound.play('lose');
      const b = best();
      const nb = OS.ui.best('snake' + mode, score);
      hud();
      g.overlay.show('Game over', `Score: ${score}${nb > b ? '  —  New best!' : ''}`, [['Play again', () => { reset(); start(); }]]);
    }

    win.onKey(e => {
      const k = e.key.toLowerCase();
      const map = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] };
      if (map[k]) { e.preventDefault(); turn(...map[k]); }
      else if (k === ' ' || k === 'p') {
        e.preventDefault();
        if (state === 'play') { state = 'pause'; g.overlay.show('Paused', null, [['Resume', start]]); }
        else if (state === 'pause') start();
        else if (state === 'ready') start();
      } else if (k === 'enter' && state === 'over') { reset(); start(); }
    });
    g.swipe(g.stage, d => turn(...{ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[d]));
    win.onBlur = () => { if (state === 'play') { state = 'pause'; g.overlay.show('Paused', null, [['Resume', start]]); } };

    const ctx = g.ctx;
    win.loop(dt => {
      if (state === 'play') {
        acc += dt;
        while (acc > 1 / speed && state === 'play') { acc -= 1 / speed; step(); }
        if (bonus) { bonus.t -= dt; if (bonus.t <= 0) bonus = null; }
      }
      particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
      particles = particles.filter(p => p.life > 0);
      // draw
      ctx.fillStyle = '#0f1a14';
      ctx.fillRect(0, 0, N * C, N * C);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x + y) % 2) { ctx.fillStyle = '#122019'; ctx.fillRect(x * C, y * C, C, C); }
      if (mode === 'walls') { ctx.strokeStyle = '#22c55e55'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, N * C - 2, N * C - 2); }
      const t = performance.now() / 1000;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(food.x * C + C / 2, food.y * C + C / 2, C * 0.38 + Math.sin(t * 6) * 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#22c55e'; ctx.fillRect(food.x * C + C / 2 - 1, food.y * C + 2, 3, 5);
      if (bonus) {
        ctx.globalAlpha = bonus.t < 2 ? (Math.sin(t * 20) + 1) / 2 : 1;
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? C * 0.22 : C * 0.48; ctx.lineTo(bonus.x * C + C / 2 + Math.cos(a) * r, bonus.y * C + C / 2 + Math.sin(a) * r); }
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      snake.forEach((s, i) => {
        const f = 1 - i / snake.length * 0.5;
        ctx.fillStyle = `hsl(${140 - i * 1.5}, 70%, ${45 * f + 10}%)`;
        const pad = i === 0 ? 1 : 2;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(s.x * C + pad, s.y * C + pad, C - pad * 2, C - pad * 2, 6) : ctx.rect(s.x * C + pad, s.y * C + pad, C - pad * 2, C - pad * 2);
        ctx.fill();
      });
      const h = snake[0];
      ctx.fillStyle = '#fff';
      const ex = dir.y ? [-4, 4] : [dir.x * 4, dir.x * 4], ey = dir.x ? [-4, 4] : [dir.y * 4, dir.y * 4];
      for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.arc(h.x * C + C / 2 + ex[k], h.y * C + C / 2 + ey[k], 2.6, 0, Math.PI * 2); ctx.fill(); }
      particles.forEach(p => { ctx.globalAlpha = p.life / 0.6; ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); });
      ctx.globalAlpha = 1;
    });
    reset();
  },
});
