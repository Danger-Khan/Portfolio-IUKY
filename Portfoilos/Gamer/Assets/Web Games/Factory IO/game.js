/* Factory IO — a conveyor sorting line.
 *
 * Parts ride a belt left to right past three diverters. Each diverter is a
 * latch, not a button: you set it and it stays set until you change it, the way
 * a real solenoid-driven arm behaves. That is what makes this a planning
 * problem rather than a reaction test — you are setting up the line for the
 * part that is coming, not swatting at the one in front of you.
 *
 * A part that reaches the end of the belt unsorted is a reject, and so is one
 * dropped into the wrong bin. Both cost a strike, because in a real sorting
 * cell both are the same failure: the part did not end up where it belonged.
 */

import { clamp, text, rand, randInt, roundRect } from '../engine.js';

const W = 620;
const H = 480;

const BELT_Y = 152;
const BELT_H = 28;
const CHUTE_W = 54;
const BIN_Y = 322;
const BIN_H = 96;
const BIN_W = 128;
const PART_R = 13;
const MAX_STRIKES = 3;

const CHUTES = [
  { x: 150, color: '#38bdf8', name: 'BLUE' },
  { x: 310, color: '#fbbf24', name: 'AMBER' },
  { x: 470, color: '#34d399', name: 'GREEN' }
];

export default {
  id: 'factoryio',
  title: 'Factory IO',
  width: W,
  height: H,
  controls: [
    '1 / 2 / 3 — toggle each diverter arm',
    'Click a diverter — toggle it',
    'Diverters latch: they stay set until changed',
    'P — pause    R — restart    F — full screen',
    '',
    'Route every part into its matching bin.',
    'A wrong bin or a part off the end is a reject.',
    'Three rejects and the line is shut down.'
  ],

  create(api) {
    let parts, diverters, strikes, sorted, beltSpeed, spawnTimer, beltOffset,
        flash, message, messageTimer;

    function reset() {
      parts = [];
      diverters = [false, false, false];
      strikes = 0;
      sorted = 0;
      beltSpeed = 78;
      spawnTimer = 0.9;
      beltOffset = 0;
      flash = CHUTES.map(() => 0);
      message = 'Set the arms before the parts arrive';
      messageTimer = 3;
    }

    function say(msg, seconds = 1.8) {
      message = msg;
      messageTimer = seconds;
    }

    function spawn() {
      const idx = randInt(0, CHUTES.length - 1);
      parts.push({
        x: -PART_R * 2,
        y: BELT_Y - PART_R,
        target: idx,
        color: CHUTES[idx].color,
        state: 'belt',
        nextChute: 0,
        chute: -1,
        square: Math.random() < 0.5,
        spin: rand(-1, 1)
      });
    }

    function reject(reason, x, y) {
      strikes++;
      api.sound.bad();
      api.particles.burst(x, y, 14, { color: '#f87171', speed: 150, life: 0.5, size: 3 });
      say(reason);
      if (strikes >= MAX_STRIKES) api.gameOver();
    }

    function update(dt, input) {
      messageTimer = Math.max(0, messageTimer - dt);
      beltOffset = (beltOffset + beltSpeed * dt) % 24;
      for (let i = 0; i < flash.length; i++) flash[i] = Math.max(0, flash[i] - dt * 2.6);

      if (input.justPressed('1')) toggle(0);
      if (input.justPressed('2')) toggle(1);
      if (input.justPressed('3')) toggle(2);

      if (input.pointer.pressed) {
        CHUTES.forEach((chute, i) => {
          if (Math.abs(input.pointer.x - chute.x) < CHUTE_W &&
              input.pointer.y > BELT_Y - 70 && input.pointer.y < BELT_Y + 60) {
            toggle(i);
          }
        });
      }

      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawn();
        // Throughput climbs with the number sorted, so the line speeds up as
        // the operator proves they can keep up.
        spawnTimer = Math.max(0.55, 1.9 - sorted * 0.02);
        beltSpeed = Math.min(190, 78 + sorted * 1.5);
      }

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];

        if (p.state === 'belt') {
          p.x += beltSpeed * dt;

          // Has it reached the next diverter it has not been judged at yet?
          while (p.nextChute < CHUTES.length && p.x >= CHUTES[p.nextChute].x) {
            const idx = p.nextChute;
            if (diverters[idx]) {
              p.state = 'falling';
              p.chute = idx;
              p.x = CHUTES[idx].x;
              api.sound.tone({ freq: 420, dur: 0.06, type: 'square', gain: 0.035 });
              break;
            }
            p.nextChute++;
          }

          if (p.state === 'belt' && p.x > W + PART_R) {
            parts.splice(i, 1);
            reject('Ran off the end', W - 20, BELT_Y);
            if (strikes >= MAX_STRIKES) return;
          }
          continue;
        }

        if (p.state === 'falling') {
          p.y += 250 * dt;
          if (p.y >= BIN_Y + 20) {
            parts.splice(i, 1);
            const correct = p.chute === p.target;
            flash[p.chute] = 1;
            if (correct) {
              sorted++;
              api.addScore(10 + Math.floor(sorted / 5));
              api.sound.good();
              api.particles.burst(p.x, BIN_Y + 20, 10, {
                color: p.color, speed: 120, life: 0.4, size: 3
              });
            } else {
              reject(`${CHUTES[p.target].name} part in the ${CHUTES[p.chute].name} bin`, p.x, BIN_Y);
              if (strikes >= MAX_STRIKES) return;
            }
          }
        }
      }
    }

    function toggle(i) {
      diverters[i] = !diverters[i];
      api.sound.tone({ freq: diverters[i] ? 560 : 360, dur: 0.05, type: 'square', gain: 0.03 });
    }

    function drawPart(ctx, p) {
      ctx.fillStyle = p.color;
      if (p.square) {
        roundRect(ctx, p.x - PART_R, p.y - PART_R, PART_R * 2, PART_R * 2, 3);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, PART_R, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(15,23,42,0.35)';
      ctx.fillRect(p.x - PART_R + 3, p.y - 2, PART_R * 2 - 6, 4);
    }

    function draw(ctx) {
      ctx.fillStyle = '#0d1320';
      ctx.fillRect(0, 0, W, H);

      // Factory backdrop: faint girders, purely so the scene reads as a plant.
      ctx.strokeStyle = 'rgba(148,163,184,0.07)';
      ctx.lineWidth = 8;
      for (let x = 60; x < W; x += 140) {
        ctx.beginPath();
        ctx.moveTo(x, 40);
        ctx.lineTo(x, BELT_Y - 40);
        ctx.stroke();
      }

      // Chute walls first so the belt draws over their tops.
      CHUTES.forEach((chute, i) => {
        ctx.fillStyle = 'rgba(148,163,184,0.08)';
        ctx.fillRect(chute.x - CHUTE_W / 2, BELT_Y, CHUTE_W, BIN_Y - BELT_Y + 20);
        ctx.strokeStyle = 'rgba(148,163,184,0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(chute.x - CHUTE_W / 2, BELT_Y);
        ctx.lineTo(chute.x - CHUTE_W / 2, BIN_Y + 20);
        ctx.moveTo(chute.x + CHUTE_W / 2, BELT_Y);
        ctx.lineTo(chute.x + CHUTE_W / 2, BIN_Y + 20);
        ctx.stroke();
      });

      // Belt
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(0, BELT_Y, W, BELT_H);
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 2;
      for (let x = -24 + beltOffset; x < W; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, BELT_Y);
        ctx.lineTo(x, BELT_Y + BELT_H);
        ctx.stroke();
      }
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, BELT_Y - 3, W, 3);
      ctx.fillRect(0, BELT_Y + BELT_H, W, 3);

      // Parts below the belt line (already falling) draw first.
      for (const p of parts) if (p.state === 'falling') drawPart(ctx, p);

      // Diverter arms
      CHUTES.forEach((chute, i) => {
        const on = diverters[i];
        ctx.save();
        ctx.translate(chute.x, BELT_Y - 6);
        ctx.rotate(on ? 0.62 : -0.18);
        ctx.fillStyle = on ? '#f87171' : '#64748b';
        roundRect(ctx, -4, -46, 8, 48, 3);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = on ? '#f87171' : '#334155';
        ctx.beginPath();
        ctx.arc(chute.x, BELT_Y - 6, 7, 0, Math.PI * 2);
        ctx.fill();

        // Label + indicator lamp
        ctx.fillStyle = on ? '#f87171' : 'rgba(148,163,184,0.5)';
        roundRect(ctx, chute.x - 26, BELT_Y - 86, 52, 20, 5);
        ctx.fill();
        text(ctx, `${i + 1} ${on ? 'DIVERT' : 'PASS'}`, chute.x, BELT_Y - 76, {
          size: 9, align: 'center', color: on ? '#0f172a' : '#e2e8f0'
        });
      });

      for (const p of parts) if (p.state === 'belt') drawPart(ctx, p);

      api.particles.draw(ctx);

      // Bins
      CHUTES.forEach((chute, i) => {
        const x = chute.x - BIN_W / 2;
        ctx.globalAlpha = 0.18 + flash[i] * 0.4;
        ctx.fillStyle = chute.color;
        roundRect(ctx, x, BIN_Y, BIN_W, BIN_H, 8);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = chute.color;
        ctx.lineWidth = 2;
        roundRect(ctx, x, BIN_Y, BIN_W, BIN_H, 8);
        ctx.stroke();
        text(ctx, chute.name, chute.x, BIN_Y + BIN_H - 18, {
          size: 12, align: 'center', color: chute.color
        });
      });

      // The end-of-line reject chute, so the failure state is visible.
      ctx.strokeStyle = 'rgba(248,113,113,0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(W - 34, BELT_Y + BELT_H);
      ctx.lineTo(W - 34, H - 40);
      ctx.stroke();
      ctx.setLineDash([]);
      text(ctx, 'REJECT', W - 34, H - 28, { size: 9, align: 'center', color: '#f87171' });

      // HUD
      ctx.fillStyle = 'rgba(6,10,18,0.85)';
      ctx.fillRect(0, 0, W, 32);
      text(ctx, `${Math.floor(api.score)}`, 12, 16, { size: 15 });
      text(ctx, `SORTED ${sorted}`, 96, 16, { size: 12, color: '#34d399' });
      text(ctx, `${Math.round(beltSpeed)} mm/s`, 220, 16, { size: 12, color: '#38bdf8' });

      for (let i = 0; i < MAX_STRIKES; i++) {
        ctx.fillStyle = i < strikes ? '#f87171' : 'rgba(148,163,184,0.25)';
        roundRect(ctx, W - 22 - i * 20, 9, 14, 14, 3);
        ctx.fill();
      }

      if (messageTimer > 0) {
        ctx.globalAlpha = clamp(messageTimer, 0, 1);
        text(ctx, message, W / 2, 16, { size: 11, align: 'center', color: '#fbbf24' });
        ctx.globalAlpha = 1;
      }
    }

    reset();
    return { reset, update, draw, particleGravity: 220 };
  }
};
