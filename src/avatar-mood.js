/** Shared look moods for the creation preview and the valley child.
 * Shapes and colors stay on the existing look ids. Moods are short and return to idle.
 * There is no status console and no expression editor.
 */

import { LOOK_HATS, LOOK_SHAPES } from './avatar-data.js';

export const MOODS = Object.freeze(['idle', 'happy', 'talking', 'curious', 'surprise', 'yawn']);

export const MOOD_LABELS = Object.freeze({
  idle: '平时',
  happy: '开心',
  talking: '说话',
  curious: '好奇',
  surprise: '哇',
  yawn: '打哈欠',
});

export const MOOD_SECONDS = Object.freeze({
  idle: 0,
  happy: 1.7,
  talking: 1.35,
  curious: 2.2,
  surprise: 1.25,
  yawn: 2.05,
});

/** Tap order on the creation preview. Idle is where each one returns. */
export const PREVIEW_MOODS = Object.freeze(['happy', 'talking', 'curious', 'surprise', 'yawn']);

const FACE = Object.freeze({
  round: {
    path: 'M50 10 C76 10 90 30 90 54 C90 80 74 96 50 96 C26 96 10 80 10 54 C10 30 24 10 50 10Z',
    eyeY: 48,
    spread: 15,
    radius: 8,
  },
  square: {
    path: 'M26 12 H74 Q90 12 90 28 V76 Q90 94 74 94 H26 Q10 94 10 76 V28 Q10 12 26 12Z',
    eyeY: 50,
    spread: 16,
    radius: 7.2,
  },
  cat: {
    path: 'M16 34 L18 10 L36 22 Q50 16 64 22 L82 10 L84 34 Q94 48 90 66 C86 88 70 96 50 96 C30 96 14 88 10 66 Q6 48 16 34Z',
    eyeY: 54,
    spread: 15,
    radius: 7.4,
  },
  hood: {
    path: 'M50 14 C68 14 80 26 80 42 C80 48 74 52 70 56 C88 66 92 84 82 98 C72 110 60 112 50 112 C40 112 28 110 18 98 C8 84 12 66 30 56 C26 52 20 48 20 42 C20 26 32 14 50 14Z',
    eyeY: 62,
    spread: 13,
    radius: 6.6,
  },
});

const HATS = Object.freeze({
  sprout: '<g class="hat"><path d="M50 18 C47 8 40 2 44 -6 C49 0 50 18 50 18Z" fill="#6a9a48"/><path d="M50 18 C54 8 62 2 57 -6 C52 0 50 18 50 18Z" fill="#8fb86a"/></g>',
  cap: '<g class="hat"><path d="M30 22 Q32 4 50 4 Q68 4 70 22Z" fill="#f3e2b8"/><ellipse cx="50" cy="22" rx="24" ry="6" fill="#f3e2b8" stroke="#e0cfa0" stroke-width="1"/></g>',
  flower: '<g class="hat" fill="#e07a8a"><circle cx="50" cy="4" r="5"/><circle cx="41" cy="10" r="5"/><circle cx="59" cy="10" r="5"/><circle cx="44" cy="0" r="4.5"/><circle cx="56" cy="0" r="4.5"/><circle cx="50" cy="7" r="3.2" fill="#f3e2b8"/></g>',
  none: '',
});

export function safeHex(color) {
  return /^#[0-9a-fA-F]{6}$/.test(color || '') ? color : '#93b7a0';
}

export function shade(hex, amount) {
  const clean = safeHex(hex);
  const n = Number.parseInt(clean.slice(1), 16);
  const channel = (value) => Math.max(0, Math.min(255, value));
  const r = channel((n >> 16) + amount);
  const g = channel(((n >> 8) & 255) + amount);
  const b = channel((n & 255) + amount);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function createMoodClock() {
  return { name: 'idle', left: 0, held: false };
}

export function setMood(clock, name, options = {}) {
  const next = MOODS.includes(name) ? name : 'idle';
  if (options.soft && next !== 'idle') {
    const protect = clock.name === 'happy' || clock.name === 'surprise' || clock.name === 'yawn';
    if (protect && clock.name !== next) return false;
  }
  if (next === 'idle') {
    clock.name = 'idle';
    clock.left = 0;
    clock.held = false;
    return true;
  }
  clock.name = next;
  clock.held = Boolean(options.hold);
  clock.left = Number.isFinite(options.seconds) ? options.seconds : (MOOD_SECONDS[next] ?? 1.4);
  return true;
}

export function stepMood(clock, dt) {
  if (!clock || clock.name === 'idle' || clock.held) return clock?.name || 'idle';
  clock.left -= dt;
  if (clock.left <= 0) {
    clock.name = 'idle';
    clock.left = 0;
    clock.held = false;
  }
  return clock.name;
}

export function createBlink(random = Math.random) {
  return { wait: 1.5 + random() * 1.2, shutFor: 0, queueDouble: false, random };
}

/** Returns whether the eyes are shut this step. A short gap can queue a second blink. */
export function stepBlink(blink, dt) {
  if (blink.shutFor > 0) {
    blink.shutFor -= dt;
    if (blink.shutFor > 0) return true;
  }
  blink.wait -= dt;
  if (blink.wait > 0) return false;
  blink.shutFor = 0.1;
  const double = blink.queueDouble;
  blink.queueDouble = !double && blink.random() < 0.28;
  blink.wait = blink.queueDouble ? 0.18 : 1.6 + blink.random() * 2.5;
  return true;
}

export function pupilShift(dx, dy, limit = 3.2) {
  const distance = Math.hypot(dx, dy) || 1;
  const reach = Math.min(limit, distance / 48);
  return { x: (dx / distance) * reach, y: (dy / distance) * reach };
}

function faceOf(shape) {
  return FACE[shape] || FACE.round;
}

function hatOf(hat) {
  return Object.hasOwn(HATS, hat) ? HATS[hat] : '';
}

export function lookMarkup({ shape = 'round', color = '#93b7a0', hat = 'sprout', mood = 'idle', size = 112 } = {}) {
  const knownShape = LOOK_SHAPES.some((item) => item.id === shape) ? shape : 'round';
  const knownHat = LOOK_HATS.some((item) => item.id === hat) ? hat : 'sprout';
  const knownMood = MOODS.includes(mood) ? mood : 'idle';
  const ink = safeHex(color);
  const face = faceOf(knownShape);
  const eyeY = face.eyeY;
  const radius = face.radius;
  const eyes = [-1, 1].map((side) => {
    const x = 50 + side * face.spread;
    return `<g transform="translate(${x} ${eyeY})"><ellipse rx="${radius}" ry="${radius * 1.12}" fill="#fff"/><circle class="pupil" r="${(radius * 0.55).toFixed(2)}" fill="#243044"/><circle class="pupil" r="${(radius * 0.18).toFixed(2)}" cx="-1.6" cy="-2.2" fill="#fff"/><ellipse class="lid" rx="${radius + 1}" ry="${radius * 1.12 + 1}" fill="${ink}"/></g>`;
  }).join('');
  const blushY = eyeY + 14;
  const mouthY = eyeY + 18;
  return `<svg class="av mood-${knownMood}" width="${size}" height="${size}" viewBox="-12 -18 124 136" role="img" aria-label="${MOOD_LABELS[knownMood]}" style="--c:${ink};--c2:${shade(ink, 48)};--c3:${shade(ink, -42)}">
    <ellipse cx="50" cy="108" rx="28" ry="4" fill="#243044" opacity=".12"/>
    <g class="body">${hatOf(knownHat)}
      <path d="${face.path}" fill="var(--c)"/>
      <path d="${face.path}" fill="none" stroke="var(--c3)" stroke-width="2" opacity=".35"/>
      <ellipse cx="34" cy="28" rx="11" ry="5" fill="#fff" opacity=".28" transform="rotate(-18 34 28)"/>
      <g class="eyes">${eyes}</g>
      <ellipse cx="${50 - face.spread - radius - 2}" cy="${blushY}" rx="5.5" ry="2.6" fill="#e7a0b0" opacity=".55"/>
      <ellipse cx="${50 + face.spread + radius + 2}" cy="${blushY}" rx="5.5" ry="2.6" fill="#e7a0b0" opacity=".55"/>
      <ellipse class="mouth" cx="50" cy="${mouthY}" rx="6.5" ry="3.6" fill="#243044"/>
    </g>
    <text class="yawn-mark" x="78" y="18" font-size="16" fill="#5d7a68" font-weight="700">哈</text>
    <g class="spark" fill="#e7a15a"><path d="M8 8 l2.4 5.2 5.2 2.2 -5.2 2.2 -2.4 5.2 -2.4 -5.2 -5.2 -2.2 5.2 -2.2z"/><path d="M96 34 l1.6 3.6 3.6 1.5 -3.6 1.5 -1.6 3.6 -1.6 -3.6 -3.6 -1.5 3.6 -1.5z"/></g>
  </svg>`;
}

export function emitMood(name, options = {}) {
  const target = globalThis;
  if (typeof target?.dispatchEvent !== 'function' || typeof target.CustomEvent !== 'function') return;
  target.dispatchEvent(new target.CustomEvent('valley-mood', { detail: { name, ...options } }));
}

/** Outer valleys only pulse the existing player group. No extra meshes. */
export function bindMood(host) {
  host.moodClock = createMoodClock();
  host.setMood = (name, options) => setMood(host.moodClock, name, options);
  host.stepMoodScale = (dt) => {
    const name = stepMood(host.moodClock, dt || 0);
    const player = host.player;
    if (!player?.scale) return name;
    const t = host.time || 0;
    let scale = 1 + Math.sin(t * 1.8) * 0.015;
    if (name === 'happy') scale = 1 + Math.abs(Math.sin(t * 10)) * 0.06;
    else if (name === 'surprise') scale = 1 + Math.sin(Math.min(host.moodClock.left, 1.25) / 1.25 * Math.PI) * 0.07;
    else if (name === 'yawn') scale = 1 + Math.sin(t * 1.4) * 0.02;
    player.scale.set(scale, name === 'happy' ? 1 + Math.sin(t * 10) * 0.045 : scale, scale);
    return name;
  };
}
