/* Space IO — drift-physics asteroid arena.
 *
 * Momentum is the whole game: thrust adds to velocity and nothing removes it
 * except a small drag, so stopping means turning around and burning. Asteroids
 * split into smaller, faster pieces, which is why clearing a screen gets harder
 * right as it looks like it is getting easier.
 */

import { clamp, text, rand, randInt, circleHit, loadSprites, drawSprite } from '../engine.js';

// Kenney CC0 art from Images/ (see Images/CREDITS.md). Every use is guarded, so
// an empty Images/ folder just falls back to the original vector drawing.
const SPR = loadSprites({
  ship: 'Images/ship.png',
  meteor: 'Images/meteor.png',
  background: 'Images/background.png'
});

// Kenney's ship art points up; this game's angle 0 points right.
const SHIP_ART_OFFSET = Math.PI / 2;
let bgPattern = null;

const W = 640;
const H = 560;

const TURN_SPEED = 3.4;      // rad/s
const THRUST = 260;          // px/s²
const DRAG = 0.34;           // per second, fraction of velocity shed
const MAX_SPEED = 380;
const BULLET_SPEED = 430;
const BULLET_LIFE = 1.15;
const FIRE_DELAY = 0.19;
const SHIP_R = 11;
const START_LIVES = 3;
const RESPAWN_CLEAR_R = 90;  // keep the respawn point clear of rocks

export default {
  id: 'spaceio',
  title: 'Space IO',
  width: W,
  height: H,
  controls: [
    'Left / Right or A / D — rotate',
    'Up or W — thrust',
    'Space — fire',
    'Down or S — emergency brake',
    'Touch: drag to steer, tap to fire',
    'P — pause    R — restart    F — full screen',
    '',
    'Big rocks split into two smaller, faster ones.'
  ],

  create(api) {
    let ship, rocks, bullets, lives, wave, fireTimer, respawnTimer, invulnerable;

    function reset() {
      ship = { x: W / 2, y: H / 2, vx: 0, vy: 0, angle: -Math.PI / 2 };
      rocks = [];
      bullets = [];
      lives = START_LIVES;
      wave = 0;
      fireTimer = 0;
      respawnTimer = 0;
      invulnerable = 2;
      nextWave();
    }

    function nextWave() {
      wave++;
      const count = Math.min(3 + wave, 9);
      for (let i = 0; i < count; i++) spawnRock(3);
      if (wave > 1) api.sound.tone({ freq: 320, dur: 0.3, slideTo: 640, type: 'triangle', gain: 0.05 });
    }

    /** size: 3 large, 2 medium, 1 small */
    function spawnRock(size, x, y) {
      let px = x;
      let py = y;
      if (px === undefined) {
        // Spawn on an edge, never on top of the player.
        let tries = 0;
        do {
          px = rand(0, W);
          py = rand(0, H);
          tries++;
        } while (tries < 40 && circleHit(px, py, 1, ship.x, ship.y, RESPAWN_CLEAR_R + size * 14));
      }

      const speed = rand(24, 54) + (3 - size) * 26 + wave * 3;
      const angle = rand(0, Math.PI * 2);
      const r = size * 13 + 5;

      // Pre-generate the silhouette so the rock keeps its shape as it spins.
      const points = [];
      const sides = randInt(8, 11);
      for (let i = 0; i < sides; i++) points.push(rand(0.72, 1.18));

      rocks.push({
        x: px, y: py, r, size,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        spin: rand(-1.4, 1.4),
        angle: rand(0, Math.PI * 2),
        points
      });
    }

    function wrap(obj) {
      if (obj.x < -obj.r) obj.x = W + obj.r;
      else if (obj.x > W + obj.r) obj.x = -obj.r;
      if (obj.y < -obj.r) obj.y = H + obj.r;
      else if (obj.y > H + obj.r) obj.y = -obj.r;
    }

    function fire() {
      if (fireTimer > 0 || respawnTimer > 0) return;
      fireTimer = FIRE_DELAY;
      bullets.push({
        x: ship.x + Math.cos(ship.angle) * (SHIP_R + 4),
        y: ship.y + Math.sin(ship.angle) * (SHIP_R + 4),
        // Inherit ship velocity — firing while drifting behaves like it should.
        vx: Math.cos(ship.angle) * BULLET_SPEED + ship.vx * 0.4,
        vy: Math.sin(ship.angle) * BULLET_SPEED + ship.vy * 0.4,
        life: BULLET_LIFE,
        r: 2.5
      });
      api.sound.tone({ freq: 880, dur: 0.06, type: 'square', gain: 0.035, slideTo: 420 });
    }

    function breakRock(index) {
      const rock = rocks[index];
      rocks.splice(index, 1);
      api.addScore(rock.size === 3 ? 20 : rock.size === 2 ? 50 : 100);
      api.particles.burst(rock.x, rock.y, 14, {
        color: '#94a3b8', speed: 170, life: 0.5, size: 3
      });
      api.sound.hit();

      if (rock.size > 1) {
        for (let i = 0; i < 2; i++) spawnRock(rock.size - 1, rock.x, rock.y);
      }

      if (rocks.length === 0) nextWave();
    }

    function killShip() {
      if (invulnerable > 0 || respawnTimer > 0) return;
      lives--;
      api.particles.burst(ship.x, ship.y, 34, { color: '#38bdf8', speed: 250, life: 0.8, size: 4 });
      api.sound.bad();
      if (lives <= 0) {
        api.gameOver();
        return;
      }
      respawnTimer = 1.3;
    }

    function update(dt, input) {
      fireTimer = Math.max(0, fireTimer - dt);
      invulnerable = Math.max(0, invulnerable - dt);

      if (respawnTimer > 0) {
        respawnTimer -= dt;
        if (respawnTimer <= 0) {
          ship.x = W / 2;
          ship.y = H / 2;
          ship.vx = 0;
          ship.vy = 0;
          ship.angle = -Math.PI / 2;
          invulnerable = 2;
          // Shove anything sitting on the respawn point out of the way.
          for (const rock of rocks) {
            if (circleHit(rock.x, rock.y, rock.r, ship.x, ship.y, RESPAWN_CLEAR_R)) {
              rock.x = rand(0, W);
              rock.y = rand(0, 60);
            }
          }
        }
      } else {
        if (input.isDown('left')) ship.angle -= TURN_SPEED * dt;
        if (input.isDown('right')) ship.angle += TURN_SPEED * dt;

        // Touch: steer toward the finger, thrust while held.
        if (input.pointer.down) {
          const want = Math.atan2(input.pointer.y - ship.y, input.pointer.x - ship.x);
          let diff = want - ship.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          ship.angle += clamp(diff, -TURN_SPEED * dt, TURN_SPEED * dt);
        }

        const thrusting = input.isDown('up') || input.pointer.down;
        if (thrusting) {
          ship.vx += Math.cos(ship.angle) * THRUST * dt;
          ship.vy += Math.sin(ship.angle) * THRUST * dt;
          if (Math.random() < 0.6) {
            api.particles.burst(
              ship.x - Math.cos(ship.angle) * SHIP_R,
              ship.y - Math.sin(ship.angle) * SHIP_R,
              1, { color: '#fbbf24', speed: 70, life: 0.3, size: 2.6 }
            );
          }
        }
        if (input.isDown('down')) {
          ship.vx *= 1 - 2.2 * dt;
          ship.vy *= 1 - 2.2 * dt;
        }
        if (input.justPressed('space') || input.pointer.pressed) fire();
      }

      ship.vx *= 1 - DRAG * dt;
      ship.vy *= 1 - DRAG * dt;
      const speed = Math.hypot(ship.vx, ship.vy);
      if (speed > MAX_SPEED) {
        ship.vx = (ship.vx / speed) * MAX_SPEED;
        ship.vy = (ship.vy / speed) * MAX_SPEED;
      }
      ship.x += ship.vx * dt;
      ship.y += ship.vy * dt;
      ship.r = SHIP_R;
      wrap(ship);

      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.life -= dt;
        if (b.life <= 0) {
          bullets.splice(i, 1);
          continue;
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        wrap(b);

        for (let r = rocks.length - 1; r >= 0; r--) {
          if (circleHit(b.x, b.y, b.r, rocks[r].x, rocks[r].y, rocks[r].r)) {
            bullets.splice(i, 1);
            breakRock(r);
            break;
          }
        }
      }

      for (const rock of rocks) {
        rock.x += rock.vx * dt;
        rock.y += rock.vy * dt;
        rock.angle += rock.spin * dt;
        wrap(rock);

        if (respawnTimer <= 0 && invulnerable <= 0 &&
            circleHit(ship.x, ship.y, SHIP_R * 0.8, rock.x, rock.y, rock.r)) {
          killShip();
          return;
        }
      }
    }

    function draw(ctx) {
      if (SPR.background) {
        // Tiled rather than stretched: it's a 256px seamless star tile, and
        // scaling it to the canvas would smear the stars.
        if (!bgPattern) bgPattern = ctx.createPattern(SPR.background, 'repeat');
        ctx.fillStyle = bgPattern;
      } else {
        ctx.fillStyle = '#05070f';
      }
      ctx.fillRect(0, 0, W, H);

      // Deterministic starfield — no array to keep, same sky every run.
      for (let i = 0; i < 90; i++) {
        const x = (i * 137.51) % W;
        const y = (i * 79.31) % H;
        const a = 0.15 + ((i * 53) % 70) / 160;
        ctx.fillStyle = `rgba(226,232,240,${a})`;
        ctx.fillRect(x, y, 1.5, 1.5);
      }

      for (const rock of rocks) {
        if (SPR.meteor) {
          drawSprite(ctx, SPR.meteor, rock.x, rock.y, rock.r * 2.3, rock.r * 2.3, rock.angle);
          continue;
        }
        ctx.save();
        ctx.translate(rock.x, rock.y);
        ctx.rotate(rock.angle);
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        rock.points.forEach((scale, i) => {
          const a = (i / rock.points.length) * Math.PI * 2;
          const px = Math.cos(a) * rock.r * scale;
          const py = Math.sin(a) * rock.r * scale;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      api.particles.draw(ctx);

      ctx.fillStyle = '#fbbf24';
      for (const b of bullets) ctx.fillRect(b.x - 2, b.y - 2, 4, 4);

      if (respawnTimer <= 0 && SPR.ship) {
        ctx.save();
        // Blink while invulnerable so the state is visible, not just felt.
        ctx.globalAlpha = invulnerable > 0 ? (Math.floor(invulnerable * 10) % 2 ? 0.35 : 1) : 1;
        drawSprite(ctx, SPR.ship, ship.x, ship.y, SHIP_R * 2.6, SHIP_R * 2.6, ship.angle + SHIP_ART_OFFSET);
        ctx.restore();
      } else if (respawnTimer <= 0) {
        ctx.save();
        ctx.translate(ship.x, ship.y);
        ctx.rotate(ship.angle);
        // Blink while invulnerable so the state is visible, not just felt.
        ctx.globalAlpha = invulnerable > 0 ? (Math.floor(invulnerable * 10) % 2 ? 0.35 : 1) : 1;
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(SHIP_R + 5, 0);
        ctx.lineTo(-SHIP_R, SHIP_R * 0.8);
        ctx.lineTo(-SHIP_R * 0.45, 0);
        ctx.lineTo(-SHIP_R, -SHIP_R * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      ctx.fillStyle = 'rgba(6,10,18,0.6)';
      ctx.fillRect(0, 0, W, 30);
      text(ctx, `${Math.floor(api.score)}`, 12, 15, { size: 15 });
      text(ctx, `WAVE ${wave}`, W / 2, 15, { size: 12, align: 'center', color: '#38bdf8' });
      for (let i = 0; i < lives; i++) {
        ctx.save();
        ctx.translate(W - 18 - i * 20, 15);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-6, 5);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-6, -5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    reset();
    return { reset, update, draw, particleGravity: 0 };
  }
};
