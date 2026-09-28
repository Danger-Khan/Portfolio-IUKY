/* Car Race — top-down lane racer.
 *
 * Traffic moves at its own speed, not the player's, so overtaking is a real
 * closing-speed judgement rather than a dodge. Fuel is the reason you cannot
 * simply sit in an empty lane: the tank drains constantly, so you have to move
 * into traffic to keep going.
 */

import { clamp, text, rand, randInt, pick, aabb, roundRect, loadSprites, drawSprite } from '../engine.js';

// Kenney CC0 cars from Images/ (see Images/CREDITS.md). These are from the
// Racing Pack, which is drawn top-down and already nose-up -- the pixel car
// pack was tried first and is side-view, so rotating it into a top-down lane
// just laid the car on its side. Guarded at every use: empty the folder and
// the original drawn cars come back.
const SPR = loadSprites({
  taxi: 'Images/taxi.png',
  traffic_black: 'Images/traffic_black.png',
  traffic_blue: 'Images/traffic_blue.png',
  traffic_green: 'Images/traffic_green.png',
  traffic_red: 'Images/traffic_red.png'
});

const TRAFFIC_SPRITES = ['traffic_black', 'traffic_blue', 'traffic_green', 'traffic_red'];

/** Picks a traffic sprite from the car's colour, so a given car keeps the same
 *  body for its whole run without having to store one on the spawn. Indexed off
 *  TRAFFIC_COLORS rather than hashing the string: hashing bunched three of the
 *  six palette colours onto the same car and never produced the black one. */
function trafficSprite(color) {
  const i = TRAFFIC_COLORS.indexOf(color);
  const key = TRAFFIC_SPRITES[(i < 0 ? 0 : i) % TRAFFIC_SPRITES.length];
  return SPR[key];
}

const W = 460;
const H = 660;

const LANES = 4;
const ROAD_MARGIN = 46;
const ROAD_W = W - ROAD_MARGIN * 2;
const LANE_W = ROAD_W / LANES;

const CAR_W = 38;
const CAR_H = 68;
const STEER_SPEED = 430;      // px/s sideways
const FUEL_BURN = 3.1;        // % per second
const START_FUEL = 100;

const TRAFFIC_COLORS = ['#f87171', '#fbbf24', '#34d399', '#a78bfa', '#fb7185', '#e2e8f0'];

export default {
  id: 'carrace',
  title: 'Car Race',
  width: W,
  height: H,
  controls: [
    'Left / Right or A / D — steer',
    'Up / Down or W / S — speed up, slow down',
    'Drag on the road — steer by touch',
    'P — pause    R — restart    F — full screen',
    '',
    'Overtaking scores. Fuel always drains,',
    'so collect the green cans to keep going.'
  ],

  create(api) {
    let car, traffic, pickups, roadY, speed, fuel, distance, overtakes, spawnTimer;

    function laneCentre(i) {
      return ROAD_MARGIN + LANE_W * i + LANE_W / 2;
    }

    function reset() {
      car = { x: laneCentre(1), y: H - 120 };
      traffic = [];
      pickups = [];
      roadY = 0;
      speed = 300;          // player's forward speed, px/s
      fuel = START_FUEL;
      distance = 0;
      overtakes = 0;
      spawnTimer = 0.8;
    }

    function difficulty() {
      // Ramps with distance, then flattens — endless games that ramp forever
      // stop being playable rather than getting harder.
      return Math.min(distance / 4200, 1.6);
    }

    function spawn() {
      const lane = randInt(0, LANES - 1);
      const x = laneCentre(lane);
      // Do not drop a car on top of one already near the spawn line.
      if (traffic.some((t) => Math.abs(t.x - x) < CAR_W && t.y < 120)) return;

      traffic.push({
        x,
        y: -CAR_H - 20,
        w: CAR_W,
        h: CAR_H,
        speed: rand(120, 210) + difficulty() * 40,
        color: pick(TRAFFIC_COLORS),
        passed: false
      });

      if (Math.random() < 0.22) {
        const fuelLane = randInt(0, LANES - 1);
        pickups.push({ x: laneCentre(fuelLane), y: -40, r: 14 });
      }
    }

    function crash() {
      api.particles.burst(car.x, car.y, 30, { color: '#fbbf24', speed: 260, life: 0.7, size: 4 });
      api.sound.hit();
      api.sound.bad();
      api.gameOver();
    }

    function update(dt, input) {
      if (input.isDown('left')) car.x -= STEER_SPEED * dt;
      if (input.isDown('right')) car.x += STEER_SPEED * dt;
      if (input.pointer.down) {
        // Ease toward the finger rather than snapping, so touch is not twitchy.
        car.x += clamp(input.pointer.x - car.x, -STEER_SPEED * dt, STEER_SPEED * dt);
      }
      car.x = clamp(car.x, ROAD_MARGIN + CAR_W / 2, W - ROAD_MARGIN - CAR_W / 2);

      const target = input.isDown('up') ? 470 : input.isDown('down') ? 190 : 320;
      speed += clamp(target - speed, -260 * dt, 220 * dt);

      distance += speed * dt;
      roadY = (roadY + speed * dt) % 80;

      // Faster burn at higher speed — the speed boost has a cost.
      fuel -= (FUEL_BURN + speed / 900) * dt;
      if (fuel <= 0) {
        fuel = 0;
        api.sound.bad();
        api.gameOver();
        return;
      }

      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawn();
        spawnTimer = Math.max(0.34, 1.15 - difficulty() * 0.42);
      }

      const player = { x: car.x - CAR_W / 2, y: car.y - CAR_H / 2, w: CAR_W, h: CAR_H };

      for (let i = traffic.length - 1; i >= 0; i--) {
        const t = traffic[i];
        // Closing speed: player forward speed minus theirs.
        t.y += (speed - t.speed) * dt;

        if (!t.passed && t.y > car.y + CAR_H) {
          t.passed = true;
          overtakes++;
          api.addScore(10);
          api.sound.tone({ freq: 700, dur: 0.06, type: 'triangle', gain: 0.035 });
        }

        if (t.y > H + CAR_H + 40 || t.y < -H) {
          traffic.splice(i, 1);
          continue;
        }

        if (aabb(player, { x: t.x - t.w / 2, y: t.y - t.h / 2, w: t.w, h: t.h })) {
          crash();
          return;
        }
      }

      for (let i = pickups.length - 1; i >= 0; i--) {
        const p = pickups[i];
        p.y += speed * dt;
        if (p.y > H + 40) {
          pickups.splice(i, 1);
          continue;
        }
        if (Math.abs(p.x - car.x) < CAR_W / 2 + p.r && Math.abs(p.y - car.y) < CAR_H / 2 + p.r) {
          pickups.splice(i, 1);
          fuel = Math.min(START_FUEL, fuel + 26);
          api.addScore(25);
          api.sound.good();
          api.particles.burst(p.x, p.y, 12, { color: '#34d399', speed: 150, life: 0.4, size: 3 });
        }
      }

      // Distance is worth points too, but far less than overtaking.
      api.addScore(speed * dt * 0.02);
    }

    function drawCar(ctx, x, y, w, h, color, isPlayer) {
      const img = isPlayer ? SPR.taxi : trafficSprite(color);
      if (img) {
        // Already drawn top-down and nose-up, so it maps straight onto the
        // car's own footprint -- no rotation, no axis swap.
        drawSprite(ctx, img, x, y, w, h);
        return;
      }
      ctx.fillStyle = color;
      roundRect(ctx, x - w / 2, y - h / 2, w, h, 7);
      ctx.fill();

      ctx.fillStyle = 'rgba(15,23,42,0.8)';
      roundRect(ctx, x - w / 2 + 4, y - h / 2 + h * 0.14, w - 8, h * 0.2, 3);
      ctx.fill();
      roundRect(ctx, x - w / 2 + 4, y + h * 0.1, w - 8, h * 0.22, 3);
      ctx.fill();

      ctx.fillStyle = 'rgba(15,23,42,0.55)';
      ctx.fillRect(x - w / 2 - 3, y - h * 0.28, 4, h * 0.2);
      ctx.fillRect(x + w / 2 - 1, y - h * 0.28, 4, h * 0.2);
      ctx.fillRect(x - w / 2 - 3, y + h * 0.1, 4, h * 0.2);
      ctx.fillRect(x + w / 2 - 1, y + h * 0.1, 4, h * 0.2);

      if (isPlayer) {
        ctx.fillStyle = 'rgba(248,250,252,0.85)';
        ctx.fillRect(x - w / 2 + 5, y - h / 2 - 2, 7, 3);
        ctx.fillRect(x + w / 2 - 12, y - h / 2 - 2, 7, 3);
      }
    }

    function draw(ctx) {
      ctx.fillStyle = '#14532d';
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = '#1f2937';
      ctx.fillRect(ROAD_MARGIN, 0, ROAD_W, H);

      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(ROAD_MARGIN - 4, 0, 4, H);
      ctx.fillRect(W - ROAD_MARGIN, 0, 4, H);

      ctx.fillStyle = 'rgba(226,232,240,0.55)';
      for (let lane = 1; lane < LANES; lane++) {
        const x = ROAD_MARGIN + LANE_W * lane - 1.5;
        for (let y = roadY - 80; y < H; y += 80) {
          ctx.fillRect(x, y, 3, 40);
        }
      }

      // Roadside markers give a sense of speed the lane dashes alone do not.
      ctx.fillStyle = '#65a30d';
      for (let y = (roadY * 1.4) % 120 - 120; y < H; y += 120) {
        ctx.fillRect(10, y, 16, 44);
        ctx.fillRect(W - 26, y, 16, 44);
      }

      for (const p of pickups) {
        ctx.fillStyle = '#34d399';
        roundRect(ctx, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2, 4);
        ctx.fill();
        ctx.fillStyle = '#064e3b';
        ctx.fillRect(p.x - 3, p.y - p.r - 4, 6, 5);
        text(ctx, 'F', p.x, p.y + 1, { size: 13, align: 'center', color: '#064e3b' });
      }

      for (const t of traffic) drawCar(ctx, t.x, t.y, t.w, t.h, t.color, false);
      drawCar(ctx, car.x, car.y, CAR_W, CAR_H, '#38bdf8', true);

      api.particles.draw(ctx);

      // HUD
      ctx.fillStyle = 'rgba(6,10,18,0.66)';
      ctx.fillRect(0, 0, W, 32);
      text(ctx, `${Math.floor(api.score)}`, 12, 16, { size: 15 });
      text(ctx, `${Math.round(speed / 4)} km/h`, W / 2, 16, { size: 12, align: 'center', color: '#38bdf8' });
      text(ctx, `${overtakes} passed`, W - 12, 16, { size: 12, align: 'right', color: '#94a3b8' });

      // Fuel bar
      const barW = W - 24;
      ctx.fillStyle = 'rgba(148,163,184,0.25)';
      roundRect(ctx, 12, H - 22, barW, 10, 5);
      ctx.fill();
      const pct = fuel / START_FUEL;
      ctx.fillStyle = pct < 0.25 ? '#f87171' : pct < 0.5 ? '#fbbf24' : '#34d399';
      roundRect(ctx, 12, H - 22, Math.max(barW * pct, 4), 10, 5);
      ctx.fill();
      text(ctx, 'FUEL', 12, H - 34, { size: 10, color: '#94a3b8' });
    }

    reset();
    return { reset, update, draw, particleGravity: 0 };
  }
};
