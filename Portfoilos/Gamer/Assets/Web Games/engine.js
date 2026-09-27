/* engine.js — the shared runtime every game in this folder is built on.
 *
 * One engine, six games. It handles the parts that are the same every time —
 * the fixed-timestep loop, input, a hi-dpi canvas, procedural sound, score
 * persistence, and the start / pause / game-over shell — so each game.js only
 * contains the part that is actually that game.
 *
 * Nothing is downloaded. There are no sprite sheets and no audio files: all the
 * artwork is drawn with canvas paths at runtime and every sound is synthesised
 * with WebAudio oscillators. That keeps the whole arcade playable offline from
 * a local folder, which is the point.
 */

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();   // cleared at the end of every frame
    this.released = new Set();
    this.pointer = { x: 0, y: 0, down: false, pressed: false, released: false };
    this._bind();
  }

  _bind() {
    this._onKeyDown = (ev) => {
      const key = normalizeKey(ev);
      if (!key) return;
      // Stop the page scrolling under the player mid-game.
      if (SCROLL_KEYS.has(key)) ev.preventDefault();
      if (!this.down.has(key)) this.pressed.add(key);
      this.down.add(key);
    };
    this._onKeyUp = (ev) => {
      const key = normalizeKey(ev);
      if (!key) return;
      this.down.delete(key);
      this.released.add(key);
    };
    this._onBlur = () => {
      // Without this, holding a key and alt-tabbing leaves it stuck down.
      this.down.clear();
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);

    const toLocal = (ev) => {
      const rect = this.canvas.getBoundingClientRect();
      const vw = Number(this.canvas.dataset.vw) || rect.width;
      const vh = Number(this.canvas.dataset.vh) || rect.height;
      this.pointer.x = ((ev.clientX - rect.left) / rect.width) * vw;
      this.pointer.y = ((ev.clientY - rect.top) / rect.height) * vh;
    };

    this._onDown = (ev) => {
      ev.preventDefault();
      toLocal(ev);
      if (!this.pointer.down) this.pointer.pressed = true;
      this.pointer.down = true;
    };
    this._onMove = (ev) => toLocal(ev);
    this._onUp = (ev) => {
      toLocal(ev);
      this.pointer.down = false;
      this.pointer.released = true;
    };

    this.canvas.addEventListener('pointerdown', this._onDown);
    this.canvas.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    this.canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
  }

  isDown(...keys) { return keys.some((k) => this.down.has(k)); }
  justPressed(...keys) { return keys.some((k) => this.pressed.has(k)); }
  justReleased(...keys) { return keys.some((k) => this.released.has(k)); }

  /** Called by the loop once per frame, after update. */
  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.pointer.pressed = false;
    this.pointer.released = false;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.canvas.removeEventListener('pointerdown', this._onDown);
    this.canvas.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
  }
}

const SCROLL_KEYS = new Set(['up', 'down', 'left', 'right', 'space']);

function normalizeKey(ev) {
  switch (ev.code) {
    case 'ArrowUp': case 'KeyW': return 'up';
    case 'ArrowDown': case 'KeyS': return 'down';
    case 'ArrowLeft': case 'KeyA': return 'left';
    case 'ArrowRight': case 'KeyD': return 'right';
    case 'Space': return 'space';
    case 'Enter': return 'enter';
    case 'Escape': return 'escape';
    case 'KeyP': return 'p';
    case 'KeyR': return 'r';
    case 'KeyM': return 'm';
    case 'KeyH': return 'h';
    case 'Digit1': return '1';
    case 'Digit2': return '2';
    case 'Digit3': return '3';
    default: return null;
  }
}

/* ------------------------------------------------------------------ */
/* Sound — synthesised, never loaded                                   */
/* ------------------------------------------------------------------ */

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('arcade_muted') === '1';
  }

  /** Created on first use: browsers refuse to start an AudioContext until the
   *  player has interacted with the page. */
  _ensure() {
    if (this.muted) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem('arcade_muted', muted ? '1' : '0');
    return this.muted;
  }

  toggleMute() { return this.setMuted(!this.muted); }

  tone({ freq = 440, dur = 0.12, type = 'square', gain = 0.06, slideTo = null }) {
    const ctx = this._ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 1), ctx.currentTime + dur);
    amp.gain.setValueAtTime(gain, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(amp).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  noise({ dur = 0.2, gain = 0.05 }) {
    const ctx = this._ensure();
    if (!ctx) return;
    const frames = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      // Fade the noise out so it reads as a hit rather than a click.
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = ctx.createBufferSource();
    const amp = ctx.createGain();
    amp.gain.value = gain;
    src.buffer = buffer;
    src.connect(amp).connect(ctx.destination);
    src.start();
  }

  blip() { this.tone({ freq: 660, dur: 0.07, gain: 0.05 }); }
  good() { this.tone({ freq: 520, dur: 0.16, slideTo: 990, type: 'triangle', gain: 0.07 }); }
  bad() { this.tone({ freq: 260, dur: 0.28, slideTo: 70, type: 'sawtooth', gain: 0.07 }); }
  hit() { this.noise({ dur: 0.18, gain: 0.07 }); }
}

/* ------------------------------------------------------------------ */
/* Scores                                                              */
/* ------------------------------------------------------------------ */

/** Best scores live in localStorage — no account, no server, nothing leaves
 *  the browser. backupengine.php is an optional extra for anyone self-hosting
 *  this on a PHP server; with no server it simply never gets called. */
export const Scores = {
  key(gameId) { return `arcade_best_${gameId}`; },

  best(gameId) {
    return Number(localStorage.getItem(this.key(gameId)) || 0);
  },

  submit(gameId, score) {
    const previous = this.best(gameId);
    const isRecord = score > previous;
    if (isRecord) localStorage.setItem(this.key(gameId), String(score));
    this.sync(gameId, score, isRecord);
    return { isRecord, best: Math.max(previous, score) };
  },

  /** Fire-and-forget POST to backupengine.php, only when the page is served
   *  over http(s) AND the player opted in. Failure is silent by design: the
   *  game must not care whether a backend exists. */
  sync(gameId, score, isRecord) {
    if (!isRecord) return;
    if (localStorage.getItem('arcade_cloud_backup') !== '1') return;
    if (!location.protocol.startsWith('http')) return;
    try {
      fetch('../backupengine.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: gameId, score, player: localStorage.getItem('arcade_player') || 'guest' })
      }).catch(() => {});
    } catch (_) { /* no backend, no problem */ }
  },

  all() {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('arcade_best_')) {
        out[key.replace('arcade_best_', '')] = Number(localStorage.getItem(key));
      }
    }
    return out;
  }
};

/* ------------------------------------------------------------------ */
/* Small helpers games keep needing                                    */
/* ------------------------------------------------------------------ */

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (lo, hi) => lo + Math.random() * (hi - lo);
export const randInt = (lo, hi) => Math.floor(rand(lo, hi + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function circleHit(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

/** Rounded rectangle path — used constantly and not worth repeating. */
export function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function text(ctx, str, x, y, { size = 16, color = '#e6edf3', align = 'left', weight = 700, font = 'Consolas, monospace' } = {}) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

/** A cheap starfield/particle pool shared by several of the games. */
export class Particles {
  constructor(limit = 240) {
    this.items = [];
    this.limit = limit;
  }

  burst(x, y, count, { color = '#ffd166', speed = 120, life = 0.5, size = 3 } = {}) {
    for (let i = 0; i < count; i++) {
      if (this.items.length >= this.limit) break;
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      this.items.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: life * (0.6 + Math.random() * 0.6),
        maxLife: life,
        color,
        size: size * (0.5 + Math.random())
      });
    }
  }

  update(dt, gravity = 0) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.items.splice(i, 1);
        continue;
      }
      p.vy += gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx) {
    for (const p of this.items) {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  clear() { this.items.length = 0; }
}

/* ------------------------------------------------------------------ */
/* The shell: loop, states, overlays                                   */
/* ------------------------------------------------------------------ */

const STEP = 1 / 120;      // physics step
const MAX_FRAME = 0.25;    // never simulate more than a quarter second at once
const MAX_STEPS = 8;       // ceiling on catch-up steps in a single frame

/**
 * Mount a game onto a canvas.
 *
 * `def` is the game module's default export:
 *   { id, title, width, height, controls[], create(api) -> { reset, update(dt, input), draw(ctx) } }
 *
 * The returned game object may also define `scoreLabel` and, optionally,
 * `onGameOver()`.
 */
export function mount(canvas, def) {
  const ctx = canvas.getContext('2d');
  const input = new Input(canvas);
  const sound = new Sound();

  canvas.dataset.vw = def.width;
  canvas.dataset.vh = def.height;
  canvas.style.aspectRatio = `${def.width} / ${def.height}`;

  const api = {
    sound,
    width: def.width,
    height: def.height,
    particles: new Particles(),
    score: 0,
    /** Games call this instead of touching score directly, so the HUD and the
     *  record check stay in one place. */
    addScore(n) { this.score += n; },
    gameOver() { shell.state = 'over'; shell.finish(); },
    win(message) { shell.winMessage = message || 'Cleared!'; shell.state = 'won'; shell.finish(); }
  };

  const game = def.create(api);

  const shell = {
    state: 'title',            // title | playing | paused | over | won
    winMessage: '',
    best: Scores.best(def.id),
    isRecord: false,
    accumulator: 0,
    last: 0,
    raf: null,
    showHelp: false,

    start() {
      api.score = 0;
      api.particles.clear();
      shell.isRecord = false;
      shell.winMessage = '';
      game.reset();
      shell.state = 'playing';
      shell.accumulator = 0;
    },

    finish() {
      const result = Scores.submit(def.id, Math.floor(api.score));
      shell.isRecord = result.isRecord;
      shell.best = result.best;
      if (shell.state === 'over') sound.bad();
      else sound.good();
      notifyHud();
    }
  };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(def.width * dpr);
    const h = Math.round(def.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    // Game code always works in virtual units; this is the only place dpr shows up.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  function notifyHud() {
    canvas.dispatchEvent(new CustomEvent('arcade:hud', {
      bubbles: true,
      detail: {
        score: Math.floor(api.score),
        best: shell.best,
        state: shell.state,
        muted: sound.muted,
        isRecord: shell.isRecord
      }
    }));
  }

  function handleShellKeys() {
    if (input.justPressed('m')) {
      sound.toggleMute();
      notifyHud();
    }
    if (input.justPressed('h')) shell.showHelp = !shell.showHelp;

    if (shell.state === 'title') {
      if (input.justPressed('space', 'enter') || input.pointer.pressed) shell.start();
      return;
    }
    if (shell.state === 'over' || shell.state === 'won') {
      if (input.justPressed('space', 'enter', 'r') || input.pointer.pressed) shell.start();
      return;
    }
    if (input.justPressed('p', 'escape')) {
      shell.state = shell.state === 'paused' ? 'playing' : 'paused';
      notifyHud();
    }
    if (shell.state === 'playing' && input.justPressed('r')) shell.start();
  }

  function frame(now) {
    shell.raf = requestAnimationFrame(frame);
    if (!shell.last) shell.last = now;
    let dt = (now - shell.last) / 1000;
    shell.last = now;
    if (dt > MAX_FRAME) dt = MAX_FRAME;

    resize();
    handleShellKeys();

    if (shell.state === 'playing' && !shell.showHelp) {
      shell.accumulator += dt;
      let steps = 0;
      while (shell.accumulator >= STEP && steps < MAX_STEPS) {
        game.update(STEP, input);
        api.particles.update(STEP, game.particleGravity || 0);
        shell.accumulator -= STEP;
        steps++;
      }
      // Hitting the step cap means the machine cannot simulate as fast as time
      // is passing — below about 15 FPS, or on the first frame back from a
      // backgrounded tab. Throw the backlog away instead of carrying it: owing
      // time either replays it as fast-forward or, if the device simply cannot
      // keep up, leaves the game permanently and increasingly behind.
      if (shell.accumulator >= STEP) shell.accumulator = 0;
      notifyHud();
    }

    ctx.save();
    game.draw(ctx);
    ctx.restore();

    if (shell.state !== 'playing' || shell.showHelp) drawOverlay();

    input.endFrame();
  }

  function drawOverlay() {
    const w = def.width;
    const h = def.height;
    ctx.save();
    ctx.fillStyle = 'rgba(6, 10, 18, 0.82)';
    ctx.fillRect(0, 0, w, h);

    if (shell.showHelp) {
      text(ctx, 'HOW TO PLAY', w / 2, 46, { size: 20, color: '#38bdf8', align: 'center' });
      let y = 92;
      for (const line of def.controls) {
        text(ctx, line, w / 2, y, { size: 13, color: '#cbd5e1', align: 'center', weight: 400 });
        y += 26;
      }
      text(ctx, 'H — close this', w / 2, h - 40, { size: 12, color: '#64748b', align: 'center', weight: 400 });
      ctx.restore();
      return;
    }

    const titles = {
      title: def.title,
      paused: 'PAUSED',
      over: 'GAME OVER',
      won: shell.winMessage || 'CLEARED!'
    };
    const colors = { title: '#38bdf8', paused: '#fbbf24', over: '#f87171', won: '#34d399' };

    text(ctx, titles[shell.state], w / 2, h / 2 - 54, { size: 30, color: colors[shell.state], align: 'center' });

    if (shell.state === 'over' || shell.state === 'won') {
      text(ctx, `Score ${Math.floor(api.score)}`, w / 2, h / 2 - 12, { size: 18, align: 'center' });
      text(ctx, shell.isRecord ? 'NEW BEST!' : `Best ${shell.best}`, w / 2, h / 2 + 16, {
        size: 14, color: shell.isRecord ? '#fbbf24' : '#94a3b8', align: 'center'
      });
      text(ctx, 'Space / tap to play again', w / 2, h / 2 + 58, { size: 13, color: '#94a3b8', align: 'center', weight: 400 });
    } else if (shell.state === 'title') {
      text(ctx, 'Space or tap to start', w / 2, h / 2 + 6, { size: 14, color: '#cbd5e1', align: 'center', weight: 400 });
      text(ctx, 'H — how to play    ·    M — sound', w / 2, h / 2 + 40, { size: 12, color: '#64748b', align: 'center', weight: 400 });
      if (shell.best > 0) {
        text(ctx, `Best ${shell.best}`, w / 2, h / 2 + 76, { size: 13, color: '#fbbf24', align: 'center' });
      }
    } else {
      text(ctx, 'P to resume', w / 2, h / 2 + 6, { size: 14, color: '#cbd5e1', align: 'center', weight: 400 });
    }

    ctx.restore();
  }

  resize();
  shell.raf = requestAnimationFrame(frame);
  notifyHud();

  return {
    api,
    shell,
    restart: () => shell.start(),
    togglePause() {
      if (shell.state === 'playing') shell.state = 'paused';
      else if (shell.state === 'paused') shell.state = 'playing';
      notifyHud();
    },
    toggleHelp() { shell.showHelp = !shell.showHelp; },
    toggleMute() { const m = sound.toggleMute(); notifyHud(); return m; },
    dispose() {
      if (shell.raf) cancelAnimationFrame(shell.raf);
      input.dispose();
    }
  };
}
