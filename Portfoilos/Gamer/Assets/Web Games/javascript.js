/* javascript.js — arcade hub: the game catalogue, the procedurally drawn cover
 * art, best-score display, and the shared page chrome (settings, cookies).
 *
 * The cover art is painted with canvas paths rather than loaded as images, for
 * the same reason the games have no sprite sheets: the whole folder has to work
 * offline with nothing to download.
 */

export const GAMES = [
  {
    id: 'balloon',
    folder: 'Ballon Shooting',
    title: 'Balloon Shooting',
    blurb: 'Pop rising balloons before they escape. Every fifth wave the wind picks up and the small ones start dodging.',
    tags: ['Aim', 'Arcade'],
    art: drawBalloonArt
  },
  {
    id: 'carrace',
    folder: 'Car Race',
    title: 'Car Race',
    blurb: 'Top-down lane racer. Overtake for points, survive rising traffic density, grab fuel before the tank empties.',
    tags: ['Reflex', 'Endless'],
    art: drawCarArt
  },
  {
    id: 'flappy',
    folder: 'Flappy Bird',
    title: 'Flappy Bird',
    blurb: 'One button, gravity, and a gap. The classic — rebuilt with real physics rather than a tween.',
    tags: ['One button', 'Classic'],
    art: drawFlappyArt
  },
  {
    id: 'spaceio',
    folder: 'Space IO',
    title: 'Space IO',
    blurb: 'Drift-physics arena shooter. Break big asteroids into small fast ones and keep the screen from filling up.',
    tags: ['Shooter', 'Physics'],
    art: drawSpaceArt
  },
  {
    id: 'towerdef',
    folder: 'Tower Defence',
    title: 'Tower Defence',
    blurb: 'Place gun, frost and sniper towers along a fixed path. Ten waves, limited cash, real projectile targeting.',
    tags: ['Strategy', 'Waves'],
    art: drawTowerArt
  },
  {
    id: 'factoryio',
    folder: 'Factory IO',
    title: 'Factory IO',
    blurb: 'A conveyor sorting line. Set each diverter to route parts to the right bin before the queue backs up.',
    tags: ['Puzzle', 'Automation'],
    art: drawFactoryArt
  }
];

/* ------------------------------------------------------------------ */
/* Cover art — every one of these is drawn, not loaded                 */
/* ------------------------------------------------------------------ */

function sky(ctx, w, h, top, bottom) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function drawBalloonArt(ctx, w, h) {
  sky(ctx, w, h, '#132a44', '#0a1524');
  const colors = ['#f87171', '#fbbf24', '#34d399', '#38bdf8', '#a78bfa'];
  const spots = [[0.18, 0.62], [0.36, 0.38], [0.54, 0.7], [0.72, 0.44], [0.87, 0.66]];
  spots.forEach(([fx, fy], i) => {
    const x = fx * w;
    const y = fy * h;
    const r = h * (0.1 + (i % 3) * 0.022);
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.82, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(226,232,240,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + r);
    ctx.quadraticCurveTo(x + 4, y + r + h * 0.09, x, y + r + h * 0.17);
    ctx.stroke();
  });
  // crosshair
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.6;
  const cx = 0.36 * w;
  const cy = 0.38 * h;
  ctx.beginPath();
  ctx.arc(cx, cy, h * 0.13, 0, Math.PI * 2);
  ctx.moveTo(cx - h * 0.19, cy); ctx.lineTo(cx - h * 0.07, cy);
  ctx.moveTo(cx + h * 0.07, cy); ctx.lineTo(cx + h * 0.19, cy);
  ctx.moveTo(cx, cy - h * 0.19); ctx.lineTo(cx, cy - h * 0.07);
  ctx.moveTo(cx, cy + h * 0.07); ctx.lineTo(cx, cy + h * 0.19);
  ctx.stroke();
}

function drawCarArt(ctx, w, h) {
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(w * 0.14, 0, w * 0.72, h);
  ctx.strokeStyle = 'rgba(226,232,240,0.55)';
  ctx.lineWidth = 2;
  ctx.setLineDash([h * 0.09, h * 0.07]);
  [0.38, 0.62].forEach((fx) => {
    ctx.beginPath();
    ctx.moveTo(w * fx, 0);
    ctx.lineTo(w * fx, h);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  const car = (x, y, color) => {
    const cw = w * 0.115;
    const ch = h * 0.24;
    ctx.fillStyle = color;
    ctx.fillRect(x - cw / 2, y - ch / 2, cw, ch);
    ctx.fillStyle = 'rgba(15,23,42,0.75)';
    ctx.fillRect(x - cw / 2 + 2, y - ch / 2 + ch * 0.2, cw - 4, ch * 0.22);
    ctx.fillRect(x - cw / 2 + 2, y + ch * 0.08, cw - 4, ch * 0.2);
  };
  car(w * 0.26, h * 0.72, '#38bdf8');
  car(w * 0.5, h * 0.3, '#f87171');
  car(w * 0.74, h * 0.55, '#fbbf24');
}

function drawFlappyArt(ctx, w, h) {
  sky(ctx, w, h, '#1d4ed8', '#0ea5e9');
  ctx.fillStyle = '#22c55e';
  const pipe = (x, gapY, gapH) => {
    const pw = w * 0.13;
    ctx.fillRect(x, 0, pw, gapY - gapH / 2);
    ctx.fillRect(x, gapY + gapH / 2, pw, h - (gapY + gapH / 2));
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(x - 3, gapY - gapH / 2 - h * 0.05, pw + 6, h * 0.05);
    ctx.fillRect(x - 3, gapY + gapH / 2, pw + 6, h * 0.05);
    ctx.fillStyle = '#22c55e';
  };
  pipe(w * 0.42, h * 0.42, h * 0.36);
  pipe(w * 0.78, h * 0.6, h * 0.34);

  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.ellipse(w * 0.22, h * 0.48, h * 0.11, h * 0.09, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.47);
  ctx.lineTo(w * 0.34, h * 0.5);
  ctx.lineTo(w * 0.28, h * 0.53);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(w * 0.25, h * 0.44, h * 0.022, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpaceArt(ctx, w, h) {
  ctx.fillStyle = '#05070f';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    const x = (i * 97.13) % w;
    const y = (i * 53.7) % h;
    ctx.fillStyle = `rgba(226,232,240,${0.2 + ((i * 37) % 60) / 100})`;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  const rock = (cx, cy, r) => {
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const rr = r * (0.76 + ((i * 29) % 40) / 100);
      const px = cx + Math.cos(a) * rr;
      const py = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  rock(w * 0.74, h * 0.32, h * 0.17);
  rock(w * 0.3, h * 0.76, h * 0.12);

  ctx.save();
  ctx.translate(w * 0.34, h * 0.4);
  ctx.rotate(-0.5);
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(h * 0.16, 0);
  ctx.lineTo(-h * 0.1, h * 0.1);
  ctx.lineTo(-h * 0.05, 0);
  ctx.lineTo(-h * 0.1, -h * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#fbbf24';
  [0.5, 0.58, 0.66].forEach((t) => ctx.fillRect(w * t, h * 0.3, 3, 3));
}

function drawTowerArt(ctx, w, h) {
  ctx.fillStyle = '#14532d';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1f2937';
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = h * 0.13;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.25);
  ctx.lineTo(w * 0.42, h * 0.25);
  ctx.lineTo(w * 0.42, h * 0.74);
  ctx.lineTo(w, h * 0.74);
  ctx.stroke();

  const tower = (x, y, color) => {
    ctx.fillStyle = 'rgba(56,189,248,0.12)';
    ctx.beginPath();
    ctx.arc(x, y, h * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, h * 0.085, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - 2, y - h * 0.16, 4, h * 0.09);
  };
  tower(w * 0.22, h * 0.56, '#38bdf8');
  tower(w * 0.66, h * 0.45, '#a78bfa');

  ctx.fillStyle = '#f87171';
  [0.12, 0.26].forEach((t) => {
    ctx.fillRect(w * t, h * 0.25 - h * 0.05, h * 0.1, h * 0.1);
  });
}

function drawFactoryArt(ctx, w, h) {
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, w, h);
  // conveyor
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(0, h * 0.4, w, h * 0.2);
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 2;
  for (let x = 0; x < w; x += w * 0.07) {
    ctx.beginPath();
    ctx.moveTo(x, h * 0.4);
    ctx.lineTo(x, h * 0.6);
    ctx.stroke();
  }
  // parts
  const part = (x, color, square) => {
    ctx.fillStyle = color;
    if (square) ctx.fillRect(x - h * 0.06, h * 0.44, h * 0.12, h * 0.12);
    else {
      ctx.beginPath();
      ctx.arc(x, h * 0.5, h * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  part(w * 0.16, '#38bdf8', true);
  part(w * 0.38, '#fbbf24', false);
  part(w * 0.6, '#34d399', true);

  // diverter arm
  ctx.strokeStyle = '#f87171';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.78, h * 0.6);
  ctx.lineTo(w * 0.88, h * 0.34);
  ctx.stroke();

  // bins
  ['#38bdf8', '#fbbf24', '#34d399'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(w * (0.06 + i * 0.32), h * 0.78, w * 0.2, h * 0.16);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = c;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(w * (0.06 + i * 0.32), h * 0.78, w * 0.2, h * 0.16);
  });
}

/* ------------------------------------------------------------------ */
/* Hub rendering                                                       */
/* ------------------------------------------------------------------ */

function bestScore(id) {
  return Number(localStorage.getItem(`arcade_best_${id}`) || 0);
}

export function renderCatalogue(mountEl) {
  mountEl.innerHTML = '';
  for (const game of GAMES) {
    const card = document.createElement('a');
    card.className = 'game-card';
    card.href = `${encodeURIComponent(game.folder)}/index.html`;

    const canvas = document.createElement('canvas');
    canvas.className = 'game-art';
    canvas.width = 480;
    canvas.height = 300;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${game.title} cover art`);
    game.art(canvas.getContext('2d'), canvas.width, canvas.height);

    const best = bestScore(game.id);
    const tags = game.tags.map((t) => `<span class="tag">${t}</span>`).join('');
    const bestTag = best > 0 ? `<span class="tag best">Best ${best}</span>` : '';

    const body = document.createElement('div');
    body.className = 'game-body';
    body.innerHTML = `
      <h3>${game.title}</h3>
      <p>${game.blurb}</p>
      <div class="game-meta">${tags}${bestTag}</div>
    `;

    card.appendChild(canvas);
    card.appendChild(body);
    mountEl.appendChild(card);
  }
}

/* ------------------------------------------------------------------ */
/* Shared page chrome                                                  */
/* ------------------------------------------------------------------ */

export function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function getCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export function initCookieBanner() {
  const banner = document.getElementById('cookieBanner');
  if (!banner) return;
  const accept = document.getElementById('cookieAccept');
  const decline = document.getElementById('cookieDecline');
  if (!getCookie('cookie_consent')) banner.style.display = 'flex';
  accept.addEventListener('click', () => {
    setCookie('cookie_consent', 'accepted', 365);
    banner.style.display = 'none';
  });
  decline.addEventListener('click', () => {
    setCookie('cookie_consent', 'declined', 365);
    banner.style.display = 'none';
  });
}

export function resetAllScores() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('arcade_best_')) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
  return keys.length;
}
