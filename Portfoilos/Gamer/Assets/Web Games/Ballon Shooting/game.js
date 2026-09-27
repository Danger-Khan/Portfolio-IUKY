/* Balloon Shooting — pop them before they reach the top.
 *
 * The aim is a real crosshair you move, not a click-anywhere hit test: a shot
 * is fired at the crosshair's position, so keyboard and mouse play the same
 * game. Small balloons are worth more and drift sideways, which keeps the
 * scoring honest — the easy targets are the cheap ones.
 */

import { clamp, text, rand, randInt, pick, circleHit } from '../engine.js';

const W = 520;
const H = 620;

const AIM_SPEED = 430;       // px/s for keyboard aiming
const RELOAD_TIME = 0.16;    // s between shots
const START_LIVES = 3;

const COLORS = ['#f87171', '#fbbf24', '#34d399', '#38bdf8', '#a78bfa', '#fb7185'];

export default {
  id: 'balloon',
  title: 'Balloon Shooting',
  width: W,
  height: H,
  controls: [
    'Move mouse / drag — aim',
    'Arrow keys or WASD — aim by keyboard',
    'Click or Space — shoot',
    'P — pause    R — restart    F — full screen',
    '',
    'Small balloons drift and are worth more.',
    'Let three escape and the round is over.'
  ],

  create(api) {
    let aim, balloons, shots, lives, wave, waveTimer, reload, spawnTimer, popped, missed;

    function reset() {
      aim = { x: W / 2, y: H * 0.6 };
      balloons = [];
      shots = [];
      lives = START_LIVES;
      wave = 1;
      waveTimer = 0;
      reload = 0;
      spawnTimer = 0.6;
      popped = 0;
      missed = 0;
    }

    function spawn() {
      // Small balloons are rarer, faster, worth triple, and weave.
      const small = Math.random() < clamp(0.18 + wave * 0.04, 0, 0.55);
      const r = small ? randInt(11, 15) : randInt(19, 26);
      balloons.push({
        x: rand(r + 14, W - r - 14),
        y: H + r + 10,
        r,
        color: pick(COLORS),
        speed: (small ? rand(76, 104) : rand(44, 66)) * (1 + wave * 0.055),
        drift: small ? rand(-1, 1) * (26 + wave * 3) : rand(-8, 8),
        phase: rand(0, Math.PI * 2),
        value: small ? 3 : 1
      });
    }

    function fire() {
      if (reload > 0) return;
      reload = RELOAD_TIME;
      api.sound.tone({ freq: 240, dur: 0.06, type: 'square', gain: 0.045 });

      // Nearest balloon whose circle contains the crosshair.
      let hitIndex = -1;
      let bestDist = Infinity;
      for (let i = 0; i < balloons.length; i++) {
        const b = balloons[i];
        if (!circleHit(aim.x, aim.y, 2, b.x, b.y, b.r)) continue;
        const d = (aim.x - b.x) ** 2 + (aim.y - b.y) ** 2;
        if (d < bestDist) {
          bestDist = d;
          hitIndex = i;
        }
      }

      shots.push({ x: aim.x, y: aim.y, life: 0.22, hit: hitIndex >= 0 });

      if (hitIndex >= 0) {
        const b = balloons[hitIndex];
        balloons.splice(hitIndex, 1);
        popped++;
        api.addScore(b.value * 10);
        api.particles.burst(b.x, b.y, b.value === 3 ? 18 : 12, {
          color: b.color, speed: 210, life: 0.5, size: 3.4
        });
        api.sound.tone({ freq: b.value === 3 ? 980 : 720, dur: 0.1, type: 'triangle', gain: 0.055 });
      } else {
        missed++;
      }
    }

    function update(dt, input) {
      reload = Math.max(0, reload - dt);
      waveTimer += dt;

      // Waves get harder on a timer rather than on score, so a good player and
      // a struggling one both face the same curve.
      if (waveTimer > 18) {
        waveTimer = 0;
        wave++;
        api.sound.tone({ freq: 400, dur: 0.22, slideTo: 760, type: 'triangle', gain: 0.05 });
      }

      if (input.pointer.down || input.pointer.pressed) {
        aim.x = clamp(input.pointer.x, 0, W);
        aim.y = clamp(input.pointer.y, 0, H);
      }
      if (input.isDown('left')) aim.x -= AIM_SPEED * dt;
      if (input.isDown('right')) aim.x += AIM_SPEED * dt;
      if (input.isDown('up')) aim.y -= AIM_SPEED * dt;
      if (input.isDown('down')) aim.y += AIM_SPEED * dt;
      aim.x = clamp(aim.x, 0, W);
      aim.y = clamp(aim.y, 0, H);

      if (input.justPressed('space') || input.pointer.pressed) fire();

      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawn();
        spawnTimer = Math.max(0.34, 1.35 - wave * 0.09);
      }

      for (let i = balloons.length - 1; i >= 0; i--) {
        const b = balloons[i];
        b.phase += dt * 2.2;
        b.y -= b.speed * dt;
        b.x += Math.sin(b.phase) * b.drift * dt;
        b.x = clamp(b.x, b.r + 4, W - b.r - 4);

        if (b.y < -b.r - 6) {
          balloons.splice(i, 1);
          lives--;
          api.sound.bad();
          if (lives <= 0) {
            api.gameOver();
            return;
          }
        }
      }

      for (let i = shots.length - 1; i >= 0; i--) {
        shots[i].life -= dt;
        if (shots[i].life <= 0) shots.splice(i, 1);
      }
    }

    function drawBalloon(ctx, b) {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.r * 0.86, b.r, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.ellipse(b.x - b.r * 0.3, b.y - b.r * 0.34, b.r * 0.2, b.r * 0.3, -0.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.moveTo(b.x - 3, b.y + b.r);
      ctx.lineTo(b.x + 3, b.y + b.r);
      ctx.lineTo(b.x, b.y + b.r + 5);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(226,232,240,0.34)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + b.r + 5);
      ctx.quadraticCurveTo(b.x + Math.sin(b.phase) * 7, b.y + b.r + 20, b.x, b.y + b.r + 34);
      ctx.stroke();
    }

    function draw(ctx) {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#0f2744');
      sky.addColorStop(1, '#091422');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // "Escape line" — crossing it costs a life, so it should be visible.
      ctx.strokeStyle = 'rgba(248,113,113,0.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(0, 34);
      ctx.lineTo(W, 34);
      ctx.stroke();
      ctx.setLineDash([]);

      for (const b of balloons) drawBalloon(ctx, b);
      api.particles.draw(ctx);

      for (const s of shots) {
        ctx.globalAlpha = clamp(s.life / 0.22, 0, 1);
        ctx.strokeStyle = s.hit ? '#fbbf24' : 'rgba(226,232,240,0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 16 * (1 - s.life / 0.22) + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Crosshair
      ctx.strokeStyle = reload > 0 ? 'rgba(148,163,184,0.7)' : '#e2e8f0';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(aim.x, aim.y, 13, 0, Math.PI * 2);
      ctx.moveTo(aim.x - 21, aim.y); ctx.lineTo(aim.x - 7, aim.y);
      ctx.moveTo(aim.x + 7, aim.y); ctx.lineTo(aim.x + 21, aim.y);
      ctx.moveTo(aim.x, aim.y - 21); ctx.lineTo(aim.x, aim.y - 7);
      ctx.moveTo(aim.x, aim.y + 7); ctx.lineTo(aim.x, aim.y + 21);
      ctx.stroke();
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(aim.x - 1, aim.y - 1, 2, 2);

      // HUD
      ctx.fillStyle = 'rgba(6,10,18,0.6)';
      ctx.fillRect(0, 0, W, 30);
      text(ctx, `SCORE ${Math.floor(api.score)}`, 12, 15, { size: 13 });
      text(ctx, `WAVE ${wave}`, W / 2, 15, { size: 13, align: 'center', color: '#38bdf8' });

      for (let i = 0; i < START_LIVES; i++) {
        ctx.fillStyle = i < lives ? '#f87171' : 'rgba(148,163,184,0.25)';
        ctx.beginPath();
        ctx.ellipse(W - 20 - i * 20, 15, 5.5, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      const accuracy = popped + missed > 0 ? Math.round((popped / (popped + missed)) * 100) : 100;
      ctx.globalAlpha = 0.5;
      text(ctx, `accuracy ${accuracy}%`, 12, H - 16, { size: 11, weight: 400 });
      ctx.globalAlpha = 1;
    }

    reset();
    return { reset, update, draw, particleGravity: 300 };
  }
};
