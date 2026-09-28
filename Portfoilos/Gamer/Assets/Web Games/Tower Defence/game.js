/* Tower Defence — ten waves, one fixed path, limited cash.
 *
 * Towers target the enemy furthest along the path rather than the nearest one.
 * That is the standard rule and it matters: targeting the nearest enemy means
 * a tower keeps re-aiming at whatever wanders closest and lets the leader walk
 * through, which feels broken even though each individual shot looks sensible.
 *
 * Projectiles travel rather than hitting instantly, so a fast enemy can outrun
 * a slow shot — that is what makes the frost tower worth its cost.
 */

import { clamp, text, roundRect, loadSprites, drawSprite } from '../engine.js';

// Kenney CC0 art from Images/ (see Images/CREDITS.md). Only the tower *base* is
// swapped: the type colour and the rotating barrel are still drawn on top, so
// which tower is which stays just as readable as before.
const SPR = loadSprites({
  tower_00: 'Images/tower_00.png',
  tower_01: 'Images/tower_01.png',
  tower_02: 'Images/tower_02.png'
});

const TOWER_ART = ['tower_00', 'tower_01', 'tower_02'];

const CELL = 40;
const COLS = 16;
const ROWS = 11;
const TOP_H = 34;
const BOTTOM_H = 46;

const W = COLS * CELL;                 // 640
const H = ROWS * CELL + TOP_H + BOTTOM_H; // 520

const START_CASH = 220;
const START_LIVES = 15;
const TOTAL_WAVES = 10;

/** Corner points of the route, in grid coordinates. */
const WAYPOINTS = [
  [-1, 2], [4, 2], [4, 7], [10, 7], [10, 4], [COLS, 4]
];

const TOWER_TYPES = {
  gun: {
    key: '1', name: 'Gun', cost: 50, range: 95, damage: 9, cooldown: 0.5,
    bulletSpeed: 340, color: '#38bdf8',
    note: 'Steady all-rounder.'
  },
  frost: {
    key: '2', name: 'Frost', cost: 70, range: 82, damage: 3, cooldown: 0.75,
    bulletSpeed: 300, color: '#a78bfa', slow: 0.45, slowTime: 1.4,
    note: 'Low damage, halves speed.'
  },
  sniper: {
    key: '3', name: 'Sniper', cost: 110, range: 205, damage: 34, cooldown: 1.7,
    bulletSpeed: 620, color: '#fbbf24',
    note: 'Long reach, slow reload.'
  }
};

export default {
  id: 'towerdef',
  title: 'Tower Defence',
  width: W,
  height: H,
  controls: [
    '1 / 2 / 3 — select Gun, Frost, Sniper',
    'Click a green tile — build there',
    'Click a built tower — sell for half',
    'Space — send the next wave early',
    'P — pause    R — restart    F — full screen',
    '',
    'Towers shoot the leading enemy in range.',
    'Survive all 10 waves to clear the board.'
  ],

  create(api) {
    let towers, enemies, bullets, cash, lives, wave, spawnQueue, spawnTimer,
        selected, waveBreak, cleared, hoverCell, message, messageTimer;

    /* ---- path ---- */

    const path = WAYPOINTS.map(([cx, cy]) => ({
      x: cx * CELL + CELL / 2,
      y: cy * CELL + CELL / 2 + TOP_H
    }));

    /** Cells the route passes through — nothing may be built on these. */
    const blocked = new Set();
    for (let i = 0; i < WAYPOINTS.length - 1; i++) {
      const [x0, y0] = WAYPOINTS[i];
      const [x1, y1] = WAYPOINTS[i + 1];
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let s = 0; s <= steps; s++) {
        const t = steps === 0 ? 0 : s / steps;
        blocked.add(`${Math.round(x0 + (x1 - x0) * t)},${Math.round(y0 + (y1 - y0) * t)}`);
      }
    }

    function reset() {
      towers = [];
      enemies = [];
      bullets = [];
      cash = START_CASH;
      lives = START_LIVES;
      wave = 0;
      spawnQueue = 0;
      spawnTimer = 0;
      selected = 'gun';
      waveBreak = 3.5;
      cleared = false;
      hoverCell = null;
      message = 'Build before wave 1 arrives';
      messageTimer = 3.5;
    }

    function say(msg, seconds = 2.2) {
      message = msg;
      messageTimer = seconds;
    }

    /* ---- waves ---- */

    function startWave() {
      wave++;
      spawnQueue = 4 + wave * 2;
      spawnTimer = 0;
      say(`Wave ${wave} of ${TOTAL_WAVES}`);
      api.sound.tone({ freq: 300, dur: 0.3, slideTo: 520, type: 'triangle', gain: 0.05 });
    }

    function spawnEnemy() {
      // Every fourth wave fields a smaller number of tougher, slower enemies.
      const heavy = wave % 4 === 0;
      const hp = Math.round((14 + wave * 11) * (heavy ? 2.1 : 1));
      enemies.push({
        hp,
        maxHp: hp,
        speed: (heavy ? 30 : 46) + wave * 2.2,
        segment: 0,
        travelled: 0,
        x: path[0].x,
        y: path[0].y,
        r: heavy ? 13 : 10,
        heavy,
        slowUntil: 0,
        slowFactor: 1,
        reward: heavy ? 22 : 11
      });
    }

    /* ---- building ---- */

    function cellAt(px, py) {
      const cx = Math.floor(px / CELL);
      const cy = Math.floor((py - TOP_H) / CELL);
      if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return null;
      return { cx, cy };
    }

    function towerAt(cx, cy) {
      return towers.find((t) => t.cx === cx && t.cy === cy) || null;
    }

    function tryBuild(cx, cy) {
      const existing = towerAt(cx, cy);
      if (existing) {
        const refund = Math.floor(TOWER_TYPES[existing.type].cost / 2);
        cash += refund;
        towers.splice(towers.indexOf(existing), 1);
        say(`Sold for $${refund}`);
        api.sound.blip();
        return;
      }
      if (blocked.has(`${cx},${cy}`)) {
        say('Cannot build on the path');
        return;
      }
      const def = TOWER_TYPES[selected];
      if (cash < def.cost) {
        say(`Need $${def.cost} for a ${def.name}`);
        api.sound.bad();
        return;
      }
      cash -= def.cost;
      towers.push({
        type: selected, cx, cy,
        x: cx * CELL + CELL / 2,
        y: cy * CELL + CELL / 2 + TOP_H,
        cooldown: 0,
        angle: -Math.PI / 2
      });
      api.sound.good();
    }

    /* ---- update ---- */

    function update(dt, input) {
      messageTimer = Math.max(0, messageTimer - dt);

      if (input.justPressed('1')) selected = 'gun';
      if (input.justPressed('2')) selected = 'frost';
      if (input.justPressed('3')) selected = 'sniper';

      hoverCell = cellAt(input.pointer.x, input.pointer.y);
      if (input.pointer.pressed && hoverCell) tryBuild(hoverCell.cx, hoverCell.cy);

      // Between waves
      if (spawnQueue === 0 && enemies.length === 0) {
        if (wave >= TOTAL_WAVES) {
          if (!cleared) {
            cleared = true;
            api.addScore(lives * 50);
            api.win(`All ${TOTAL_WAVES} waves held!`);
          }
          return;
        }
        waveBreak -= dt;
        if (input.justPressed('space')) {
          // Rushing the next wave pays a bonus — a real risk/reward choice.
          const bonus = Math.ceil(waveBreak * 6);
          if (bonus > 0) {
            cash += bonus;
            say(`Early call: +$${bonus}`);
          }
          waveBreak = 0;
        }
        if (waveBreak <= 0) {
          startWave();
          waveBreak = 6;
        }
      }

      if (spawnQueue > 0) {
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          spawnEnemy();
          spawnQueue--;
          spawnTimer = Math.max(0.35, 0.9 - wave * 0.04);
        }
      }

      /* enemies walk the path */
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (e.slowUntil > 0) {
          e.slowUntil -= dt;
          if (e.slowUntil <= 0) e.slowFactor = 1;
        }

        let move = e.speed * e.slowFactor * dt;
        while (move > 0 && e.segment < path.length - 1) {
          const a = path[e.segment];
          const b = path[e.segment + 1];
          const segLen = Math.hypot(b.x - a.x, b.y - a.y);
          const remaining = segLen - e.travelled;
          if (move < remaining) {
            e.travelled += move;
            move = 0;
          } else {
            move -= remaining;
            e.segment++;
            e.travelled = 0;
          }
        }

        if (e.segment >= path.length - 1) {
          enemies.splice(i, 1);
          lives--;
          api.sound.bad();
          say('Leaked!');
          if (lives <= 0) {
            api.gameOver();
            return;
          }
          continue;
        }

        const a = path[e.segment];
        const b = path[e.segment + 1];
        const segLen = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const t = e.travelled / segLen;
        e.x = a.x + (b.x - a.x) * t;
        e.y = a.y + (b.y - a.y) * t;

        // Distance covered overall — used to pick the leading enemy.
        let progress = e.travelled;
        for (let s = 0; s < e.segment; s++) {
          progress += Math.hypot(path[s + 1].x - path[s].x, path[s + 1].y - path[s].y);
        }
        e.progress = progress;
      }

      /* towers acquire and fire */
      for (const tower of towers) {
        const def = TOWER_TYPES[tower.type];
        tower.cooldown = Math.max(0, tower.cooldown - dt);

        let target = null;
        for (const e of enemies) {
          if (Math.hypot(e.x - tower.x, e.y - tower.y) > def.range) continue;
          if (!target || e.progress > target.progress) target = e;
        }
        if (!target) continue;

        tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);
        if (tower.cooldown > 0) continue;
        tower.cooldown = def.cooldown;

        bullets.push({
          x: tower.x, y: tower.y,
          target,
          speed: def.bulletSpeed,
          damage: def.damage,
          color: def.color,
          slow: def.slow || 0,
          slowTime: def.slowTime || 0
        });
        api.sound.tone({
          freq: tower.type === 'sniper' ? 300 : 700,
          dur: 0.05, type: 'square', gain: 0.03
        });
      }

      /* bullets home toward where the target is now */
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        if (!b.target || b.target.hp <= 0 || !enemies.includes(b.target)) {
          bullets.splice(i, 1);
          continue;
        }
        const dx = b.target.x - b.x;
        const dy = b.target.y - b.y;
        const dist = Math.hypot(dx, dy);
        const step = b.speed * dt;

        if (dist <= step) {
          const e = b.target;
          e.hp -= b.damage;
          if (b.slow) {
            e.slowFactor = b.slow;
            e.slowUntil = b.slowTime;
          }
          api.particles.burst(e.x, e.y, 4, { color: b.color, speed: 90, life: 0.25, size: 2.4 });
          bullets.splice(i, 1);

          if (e.hp <= 0) {
            const idx = enemies.indexOf(e);
            if (idx >= 0) enemies.splice(idx, 1);
            cash += e.reward;
            api.addScore(e.reward);
            api.particles.burst(e.x, e.y, 12, { color: '#f87171', speed: 160, life: 0.45, size: 3 });
            api.sound.hit();
          }
          continue;
        }
        b.x += (dx / dist) * step;
        b.y += (dy / dist) * step;
      }
    }

    /* ---- draw ---- */

    function draw(ctx) {
      ctx.fillStyle = '#0f2417';
      ctx.fillRect(0, 0, W, H);

      // Buildable grid
      for (let cy = 0; cy < ROWS; cy++) {
        for (let cx = 0; cx < COLS; cx++) {
          const isPath = blocked.has(`${cx},${cy}`);
          ctx.fillStyle = isPath ? '#374151' : ((cx + cy) % 2 ? '#14532d' : '#166534');
          ctx.fillRect(cx * CELL, cy * CELL + TOP_H, CELL, CELL);
        }
      }

      // Path edge lines
      ctx.strokeStyle = 'rgba(226,232,240,0.22)';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 7]);
      ctx.beginPath();
      path.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
      ctx.setLineDash([]);

      // Build preview
      if (hoverCell) {
        const { cx, cy } = hoverCell;
        const occupied = towerAt(cx, cy);
        const isPath = blocked.has(`${cx},${cy}`);
        const def = TOWER_TYPES[selected];
        ctx.fillStyle = occupied ? 'rgba(251,191,36,0.3)'
          : isPath || cash < def.cost ? 'rgba(248,113,113,0.3)'
          : 'rgba(56,189,248,0.3)';
        ctx.fillRect(cx * CELL, cy * CELL + TOP_H, CELL, CELL);

        if (!occupied && !isPath) {
          ctx.strokeStyle = 'rgba(56,189,248,0.4)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx * CELL + CELL / 2, cy * CELL + CELL / 2 + TOP_H, def.range, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Towers
      for (const tower of towers) {
        const def = TOWER_TYPES[tower.type];
        const baseImg = SPR[TOWER_ART[tower.type % TOWER_ART.length]];
        if (baseImg) {
          drawSprite(ctx, baseImg, tower.x, tower.y, 34, 34);
        } else {
          ctx.fillStyle = 'rgba(15,23,42,0.75)';
          roundRect(ctx, tower.x - 15, tower.y - 15, 30, 30, 6);
          ctx.fill();
        }
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.translate(tower.x, tower.y);
        ctx.rotate(tower.angle);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(4, -2.5, 14, 5);
        ctx.restore();
      }

      // Enemies
      for (const e of enemies) {
        ctx.fillStyle = e.slowUntil > 0 ? '#93c5fd' : (e.heavy ? '#b91c1c' : '#f87171');
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(15,23,42,0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const pct = clamp(e.hp / e.maxHp, 0, 1);
        ctx.fillStyle = 'rgba(15,23,42,0.75)';
        ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2, 4);
        ctx.fillStyle = pct > 0.5 ? '#34d399' : pct > 0.25 ? '#fbbf24' : '#f87171';
        ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2 * pct, 4);
      }

      api.particles.draw(ctx);

      for (const b of bullets) {
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Top HUD
      ctx.fillStyle = 'rgba(6,10,18,0.85)';
      ctx.fillRect(0, 0, W, TOP_H);
      text(ctx, `$${cash}`, 12, TOP_H / 2, { size: 14, color: '#34d399' });
      text(ctx, `LIVES ${lives}`, 108, TOP_H / 2, { size: 13, color: lives > 5 ? '#e6edf3' : '#f87171' });
      text(ctx, `WAVE ${Math.max(wave, 1)}/${TOTAL_WAVES}`, 220, TOP_H / 2, { size: 13, color: '#38bdf8' });
      text(ctx, `SCORE ${Math.floor(api.score)}`, W - 12, TOP_H / 2, { size: 13, align: 'right' });

      if (messageTimer > 0) {
        ctx.globalAlpha = clamp(messageTimer, 0, 1);
        text(ctx, message, W / 2, TOP_H / 2, { size: 12, align: 'center', color: '#fbbf24' });
        ctx.globalAlpha = 1;
      } else if (spawnQueue === 0 && enemies.length === 0 && wave < TOTAL_WAVES) {
        text(ctx, `Next wave in ${Math.ceil(waveBreak)}s — Space to call early`, W / 2, TOP_H / 2,
          { size: 11, align: 'center', color: '#94a3b8', weight: 400 });
      }

      // Bottom build bar
      const barY = H - BOTTOM_H;
      ctx.fillStyle = 'rgba(6,10,18,0.9)';
      ctx.fillRect(0, barY, W, BOTTOM_H);

      let bx = 12;
      for (const [key, def] of Object.entries(TOWER_TYPES)) {
        const active = key === selected;
        const affordable = cash >= def.cost;
        ctx.fillStyle = active ? 'rgba(56,189,248,0.18)' : 'rgba(148,163,184,0.08)';
        roundRect(ctx, bx, barY + 7, 186, BOTTOM_H - 14, 8);
        ctx.fill();
        ctx.strokeStyle = active ? def.color : 'rgba(148,163,184,0.25)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(bx + 19, barY + BOTTOM_H / 2, 8, 0, Math.PI * 2);
        ctx.fill();

        text(ctx, `${def.key} ${def.name}`, bx + 36, barY + BOTTOM_H / 2 - 7, { size: 12 });
        text(ctx, `$${def.cost} · ${def.note}`, bx + 36, barY + BOTTOM_H / 2 + 8, {
          size: 10, color: affordable ? '#94a3b8' : '#f87171', weight: 400
        });
        bx += 198;
      }
    }

    reset();
    return { reset, update, draw, particleGravity: 0 };
  }
};
