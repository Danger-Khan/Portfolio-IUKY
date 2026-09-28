/* Flappy Bird — one button, gravity, and a gap.
 *
 * The bird is a real projectile: a constant downward acceleration, and a flap
 * that sets vertical velocity outright rather than adding to it. Setting rather
 * than adding is what makes the control feel crisp — otherwise a fast fall
 * swallows the flap and the bird feels unresponsive at exactly the moment you
 * need it most.
 */

import { clamp, roundRect, text, loadSprites, drawSprite } from '../engine.js';

// Kenney CC0 art from Images/ (see Images/CREDITS.md). Every use below is
// guarded -- with the folder empty the game draws its original shapes instead.
// No background image on purpose: the Kenney sky layer is a single flat colour,
// which loses the gradient this draws below. Sprites are only worth it where
// they beat the procedural version.
const SPR = loadSprites({
  bird: 'Images/bird.png',
  cloud: 'Images/cloud.png'
});

const W = 420;
const H = 620;

const GRAVITY = 1500;      // px/s²
const FLAP_VELOCITY = -430; // px/s, set on flap
const PIPE_SPEED = 152;     // px/s
const PIPE_SPACING = 208;   // px between pipe centres
const PIPE_WIDTH = 62;
const GROUND_H = 78;
const BIRD_R = 13;

/** Modulo that always returns a positive result.
 *
 * JavaScript's % keeps the sign of the dividend, so once the scroll offset
 * grows past the wrap width the plain expression goes negative and the
 * repeating scenery drifts off the left edge and never comes back. */
const wrapMod = (value, span) => ((value % span) + span) % span;

export default {
  id: 'flappy',
  title: 'Flappy Bird',
  width: W,
  height: H,
  controls: [
    'Space / W / Up — flap',
    'Click or tap anywhere — flap',
    'P — pause    R — restart    F — full screen',
    '',
    'The gap narrows every 10 points,',
    'down to a floor it never goes below.'
  ],

  create(api) {
    let bird, pipes, scrollX, gapHeight, passed, dead;

    function reset() {
      bird = { x: W * 0.28, y: H * 0.42, vy: 0, angle: 0 };
      pipes = [];
      scrollX = 0;
      gapHeight = 175;
      passed = 0;
      dead = false;
      // Start far enough right that the player gets a moment before the first gap.
      for (let i = 0; i < 4; i++) addPipe(W + 120 + i * PIPE_SPACING);
    }

    function addPipe(x) {
      const margin = 70;
      const usable = H - GROUND_H - margin * 2 - gapHeight;
      pipes.push({
        x,
        gapY: margin + gapHeight / 2 + Math.random() * Math.max(usable, 10),
        scored: false
      });
    }

    function flap() {
      if (dead) return;
      bird.vy = FLAP_VELOCITY;
      api.sound.tone({ freq: 620, dur: 0.07, type: 'square', gain: 0.045 });
    }

    function update(dt, input) {
      if (input.justPressed('space', 'up') || input.pointer.pressed) flap();

      bird.vy += GRAVITY * dt;
      bird.y += bird.vy * dt;
      // Nose follows velocity, clamped so it never looks silly.
      bird.angle = clamp(bird.vy / 900, -0.5, 1.1);

      scrollX += PIPE_SPEED * dt;

      for (const pipe of pipes) {
        pipe.x -= PIPE_SPEED * dt;

        if (!pipe.scored && pipe.x + PIPE_WIDTH < bird.x - BIRD_R) {
          pipe.scored = true;
          passed++;
          api.addScore(1);
          api.sound.tone({ freq: 880, dur: 0.09, type: 'triangle', gain: 0.05 });
          // Tighten the gap as the player gets better, but never past 118 —
          // below that it stops being a skill test and starts being a coin flip.
          gapHeight = Math.max(118, 175 - Math.floor(passed / 10) * 8);
        }
      }

      while (pipes.length && pipes[0].x < -PIPE_WIDTH - 10) pipes.shift();
      const lastX = pipes.length ? pipes[pipes.length - 1].x : 0;
      if (lastX < W + PIPE_SPACING) addPipe(lastX + PIPE_SPACING);

      // Ceiling is solid but forgiving: you stop, you do not die.
      if (bird.y < BIRD_R) {
        bird.y = BIRD_R;
        bird.vy = 0;
      }

      if (bird.y > H - GROUND_H - BIRD_R) {
        die();
        return;
      }

      for (const pipe of pipes) {
        if (bird.x + BIRD_R < pipe.x || bird.x - BIRD_R > pipe.x + PIPE_WIDTH) continue;
        const top = pipe.gapY - gapHeight / 2;
        const bottom = pipe.gapY + gapHeight / 2;
        if (bird.y - BIRD_R < top || bird.y + BIRD_R > bottom) {
          die();
          return;
        }
      }
    }

    function die() {
      if (dead) return;
      dead = true;
      api.particles.burst(bird.x, bird.y, 16, { color: '#facc15', speed: 190, life: 0.6, size: 4 });
      api.sound.hit();
      api.gameOver();
    }

    function drawPipe(ctx, pipe) {
      const top = pipe.gapY - gapHeight / 2;
      const bottom = pipe.gapY + gapHeight / 2;
      const lipH = 24;

      ctx.fillStyle = '#22c55e';
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, top - lipH);
      ctx.fillRect(pipe.x, bottom + lipH, PIPE_WIDTH, H - GROUND_H - bottom - lipH);

      ctx.fillStyle = '#16a34a';
      roundRect(ctx, pipe.x - 5, top - lipH, PIPE_WIDTH + 10, lipH, 4);
      ctx.fill();
      roundRect(ctx, pipe.x - 5, bottom, PIPE_WIDTH + 10, lipH, 4);
      ctx.fill();

      // A single highlight strip reads as a cylinder for almost no cost.
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(pipe.x + 8, 0, 8, top - lipH);
      ctx.fillRect(pipe.x + 8, bottom + lipH, 8, H - GROUND_H - bottom - lipH);
    }

    function draw(ctx) {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#1e40af');
      sky.addColorStop(0.65, '#38bdf8');
      sky.addColorStop(1, '#7dd3fc');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // Parallax clouds, positioned from scrollX so they never need storing.
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      for (let i = 0; i < 6; i++) {
        const cx = wrapMod(i * 190 - scrollX * 0.25, W + 220) - 110;
        const cy = 70 + ((i * 97) % 170);
        if (SPR.cloud) {
          drawSprite(ctx, SPR.cloud, cx, cy, 104, 54);
          continue;
        }
        ctx.beginPath();
        ctx.arc(cx, cy, 26, 0, Math.PI * 2);
        ctx.arc(cx + 26, cy + 6, 20, 0, Math.PI * 2);
        ctx.arc(cx - 24, cy + 8, 17, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const pipe of pipes) drawPipe(ctx, pipe);

      api.particles.draw(ctx);

      // Ground
      ctx.fillStyle = '#ca8a04';
      ctx.fillRect(0, H - GROUND_H, W, GROUND_H);
      ctx.fillStyle = '#65a30d';
      ctx.fillRect(0, H - GROUND_H, W, 16);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let i = 0; i < 14; i++) {
        const gx = wrapMod(i * 44 - scrollX, W + 44) - 22;
        ctx.fillRect(gx, H - GROUND_H + 16, 22, 8);
      }

      // Bird
      if (SPR.bird) {
        drawSprite(ctx, SPR.bird, bird.x, bird.y, BIRD_R * 2.8, BIRD_R * 2.8, bird.angle);
      } else {
        ctx.save();
        ctx.translate(bird.x, bird.y);
        ctx.rotate(bird.angle);
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.ellipse(0, 0, BIRD_R + 3, BIRD_R, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(BIRD_R + 1, -2);
        ctx.lineTo(BIRD_R + 11, 1);
        ctx.lineTo(BIRD_R + 1, 4);
        ctx.closePath();
        ctx.fill();
        // Wing angle tracks vertical speed, so it flaps because of the physics
        // rather than on a timer.
        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.ellipse(-3, 1, 8, clamp(6 - bird.vy / 160, 2.5, 9), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(5, -5, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      text(ctx, String(Math.floor(api.score)), W / 2, 58, { size: 42, align: 'center', color: '#ffffff' });
      ctx.globalAlpha = 0.45;
      text(ctx, `gap ${Math.round(gapHeight)}`, W - 12, H - 22, { size: 11, align: 'right', color: '#fff7ed', weight: 400 });
      ctx.globalAlpha = 1;
    }

    reset();
    return { reset, update, draw, particleGravity: 620 };
  }
};
