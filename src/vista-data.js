/** Distant valleys seen from home. Directions follow the ferry and the balloon. */

import { arrivalFor } from './realm-data.js';

export const VISTA_IDS = Object.freeze(['ri', 'mei', 'xing']);
export const DISCOVER_HEIGHT = 12;
export const DAY_SECONDS = 240;

export const VISTAS = Object.freeze({
  ri: Object.freeze({
    id: 'ri',
    name: '日谷',
    compass: '东南',
    x: 18,
    y: 0,
    z: 36,
    routes: Object.freeze(['ferry', 'balloon']),
    songs: 3,
    clouds: 4,
    km: 18,
    keepsake: 'crane',
    icon: 'ferry',
    line: '看，那边是日谷。',
  }),
  mei: Object.freeze({
    id: 'mei',
    name: '美谷',
    compass: '西南',
    x: -28,
    y: 0,
    z: 48,
    routes: Object.freeze(['ferry', 'balloon']),
    songs: 8,
    clouds: 6,
    km: 48,
    keepsake: 'maple',
    icon: 'leaf',
    line: '看，那边是美谷。',
  }),
  xing: Object.freeze({
    id: 'xing',
    name: '外星谷',
    compass: '北',
    x: 2,
    y: 14,
    z: -48,
    routes: Object.freeze(['balloon']),
    songs: null,
    clouds: 12,
    km: 120,
    fantasy: true,
    keepsake: 'pebble',
    icon: 'star',
    line: '看，那边是外星谷。这是游戏里的想象。',
  }),
});

export const KEEPSAKES = Object.freeze({
  crane: Object.freeze({ id: 'crane', realm: 'ri', name: '纸鹤', icon: 'crane', note: '瓶子里的纸鹤。日谷的朋友也许在折纸。' }),
  maple: Object.freeze({ id: 'maple', realm: 'mei', name: '枫叶', icon: 'leaf', note: '瓶子里的红枫叶。美谷的秋天是这样的颜色。' }),
  pebble: Object.freeze({ id: 'pebble', realm: 'xing', name: '发光石子', icon: 'star', note: '瓶子里会发光的小石子。外星谷是游戏里的想象。' }),
});

export const KEEPSAKE_IDS = Object.freeze(Object.keys(KEEPSAKES));

export const BOTTLE_SPOTS = Object.freeze({
  crane: Object.freeze({ x: 1.2, z: 14.7 }),
  maple: Object.freeze({ x: 7.6, z: 14.4 }),
  pebble: Object.freeze({ x: -1.8, z: 15.1 }),
});

const BOTTLE_WINDOW = Object.freeze({ start: 0.42, end: 0.7 });

export const VISTA_STAMPS = Object.freeze([
  { id: 'vista-ri', name: '发现日谷', icon: 'ferry', how: '坐热气球升高，看见雪山和红白铁塔。不用答题，渡口也照样能走。' },
  { id: 'vista-mei', name: '发现美谷', icon: 'leaf', how: '坐热气球升高，看见山坡上的大字和红色吊桥。不用答题。' },
  { id: 'vista-xing', name: '发现外星谷', icon: 'star', how: '坐热气球升高，看见悬浮岛和带环的星球。这是游戏里的想象。不用答题。' },
]);

export const VISTA_QUIZ = Object.freeze({
  id: 'which-farther',
  ask: '估一估：哪一个更远？',
  options: Object.freeze([
    Object.freeze({ id: 'ri', label: '日谷，坐船唱 3 首歌' }),
    Object.freeze({ id: 'mei', label: '美谷，坐船唱 8 首歌' }),
  ]),
  answer: 'mei',
});

export const MAP_LAYOUT = Object.freeze({
  width: 320,
  height: 240,
  home: Object.freeze({ x: 160, y: 118 }),
  dock: Object.freeze({ x: 168, y: 156 }),
  balloon: Object.freeze({ x: 132, y: 168 }),
  ri: Object.freeze({ x: 246, y: 186 }),
  mei: Object.freeze({ x: 58, y: 198 }),
  xing: Object.freeze({ x: 168, y: 36 }),
});

const ROUTE_COLORS = Object.freeze({ ri: '#d98aa4', mei: '#c45c4a', xing: '#6aa6d8' });

export function vistaBand(ageBand) {
  if (ageBand === 'bigger' || ageBand === 'older') return ageBand;
  if (ageBand === 'senior') return 'older';
  return 'little';
}

export function vistaClarity(height, { flying = false } = {}) {
  if (!flying) return 0.2;
  const h = Math.max(0, Number(height) || 0);
  const t = Math.min(1, Math.max(0, (h - 5) / 13));
  return 0.28 + t * 0.72;
}

export function vistaOpacity(clarity) {
  const c = Math.min(1, Math.max(0, Number(clarity) || 0));
  return 0.14 + c * 0.82;
}

export function vistaSignals(moment) {
  const period = moment?.period || '中午';
  const night = period === '晚上' || period === '深夜';
  return { kite: !night, lantern: night, windmill: true, crystal: night, searchlight: night };
}

export function nearestVista(origin, discovered = {}) {
  if (!origin) return null;
  let best = null;
  let dist = Infinity;
  for (const id of VISTA_IDS) {
    if (discovered?.[id]) continue;
    const vista = VISTAS[id];
    const d = Math.hypot(vista.x - origin.x, vista.z - origin.z);
    if (d < dist) { dist = d; best = id; }
  }
  return best;
}

export function realmShowsVisit(id, realm) {
  if (!realm || typeof realm !== 'object' || Array.isArray(realm)) return false;
  const lists = ['blocks', 'claimed', 'processes', 'glyphs', 'puzzles', 'experiments', 'projects', 'trades'];
  if (lists.some((key) => Array.isArray(realm[key]) && realm[key].length > 0)) return true;
  const player = realm.player;
  if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.z)) return false;
  const spots = [arrivalFor(id, 'ferry'), arrivalFor(id, 'balloon')];
  return spots.every((spot) => Math.hypot(player.x - spot.x, player.z - spot.z) > 1.5);
}

/** Old saves omit discovered. A valley counts once the player has been there. */
export function inferDiscovered(travel = {}) {
  const visited = new Set(Array.isArray(travel.visited) ? travel.visited : []);
  const current = travel.current;
  const realms = travel.realms && typeof travel.realms === 'object' ? travel.realms : {};
  const found = {};
  for (const id of VISTA_IDS) found[id] = visited.has(id) || current === id || realmShowsVisit(id, realms[id]);
  return found;
}

export function emptyDiscovered() {
  return { ri: false, mei: false, xing: false };
}

export function vistaDistanceCopy(id, ageBand) {
  const vista = VISTAS[id];
  const band = vistaBand(ageBand);
  if (!vista) return '';
  if (id === 'xing') {
    if (band === 'little') return '坐热气球，往上看星星';
    if (band === 'bigger') return '北边 · 坐热气球往上看';
    return '北边 · 游戏里大约 120 · 想象的航线';
  }
  const boat = `坐船要唱 ${vista.songs} 首歌`;
  const air = `热气球要数 ${vista.clouds} 朵云`;
  if (band === 'little') return `${boat} · ${air}`;
  if (band === 'bigger') return `${vista.compass} · ${boat}`;
  return `${vista.compass} · 大约 ${vista.km} · ${boat}`;
}

export function activeBottle(clock, keepsakes) {
  const elapsed = Number(clock?.elapsed) || 0;
  if (elapsed < 0) return null;
  const phase = (elapsed % DAY_SECONDS) / DAY_SECONDS;
  if (phase < BOTTLE_WINDOW.start || phase >= BOTTLE_WINDOW.end) return null;
  const owned = new Set(Array.isArray(keepsakes) ? keepsakes : []);
  const pending = KEEPSAKE_IDS.filter((id) => !owned.has(id));
  if (!pending.length) return null;
  const day = Math.floor(elapsed / DAY_SECONDS);
  const id = pending[day % pending.length];
  return { ...KEEPSAKES[id], ...BOTTLE_SPOTS[id] };
}

export function gradeVistaQuiz(choice) {
  const right = choice === VISTA_QUIZ.answer;
  return {
    ok: right,
    took: null,
    message: right
      ? '对了。美谷要唱更多首歌，在游戏里更远。'
      : '再估一估。唱得更久的那一趟更远。东西都还在。',
  };
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawRiMark(ctx, x, y, night) {
  ctx.fillStyle = '#f7f4ef';
  ctx.beginPath();
  ctx.moveTo(x - 20, y + 12);
  ctx.lineTo(x - 6, y - 16);
  ctx.lineTo(x + 6, y + 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c8402a';
  ctx.fillRect(x + 6, y - 18, 6, 30);
  ctx.fillStyle = '#f7f4ef';
  ctx.fillRect(x + 6, y - 8, 6, 7);
  ctx.fillRect(x + 6, y + 6, 6, 6);
  if (night) {
    ctx.fillStyle = '#ffd27a';
    ctx.beginPath();
    ctx.arc(x + 9, y - 20, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffb25e';
    ctx.fillRect(x - 18, y + 4, 5, 8);
    ctx.beginPath();
    ctx.arc(x - 15.5, y + 3, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#24344a';
  ctx.font = '700 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('日', x - 4, y + 26);
}

export function drawVistaMap(canvas, { discovered = {}, band = 'little', overlay = null, night = false } = {}) {
  if (!canvas?.getContext) return;
  const layout = MAP_LAYOUT;
  const ratio = Math.min(2, canvas.ownerDocument?.defaultView?.devicePixelRatio || 1);
  canvas.width = Math.round(layout.width * ratio);
  canvas.height = Math.round(layout.height * ratio);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, layout.width, layout.height);
  ctx.fillStyle = '#d5dde3';
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.fillStyle = '#c5d7c0';
  ctx.beginPath();
  ctx.ellipse(layout.home.x, layout.home.y, 46, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8ebdc0';
  ctx.fillRect(layout.home.x - 4, layout.home.y - 28, 8, 56);
  ctx.fillStyle = '#3f6b52';
  ctx.font = '700 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('河谷', layout.home.x, layout.home.y + 4);
  for (const id of VISTA_IDS) {
    const spot = layout[id];
    const vista = VISTAS[id];
    const known = Boolean(discovered?.[id]);
    if (!known) {
      ctx.fillStyle = 'rgba(214, 222, 228, .92)';
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, 28, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    if (vista.routes.includes('ferry')) {
      ctx.save();
      ctx.strokeStyle = ROUTE_COLORS[id];
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(layout.dock.x, layout.dock.y);
      ctx.lineTo(spot.x, spot.y);
      ctx.stroke();
      ctx.restore();
    }
    if (vista.routes.includes('balloon')) {
      ctx.save();
      ctx.strokeStyle = ROUTE_COLORS[id];
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(layout.balloon.x, layout.balloon.y);
      ctx.lineTo(spot.x, spot.y);
      ctx.stroke();
      ctx.restore();
    }
    if (id === 'ri') drawRiMark(ctx, spot.x, spot.y, night);
    else {
      ctx.fillStyle = ROUTE_COLORS[id];
      roundRect(ctx, spot.x - 16, spot.y - 16, 32, 32, 10);
      ctx.fill();
      ctx.fillStyle = '#fffaf0';
      ctx.font = '700 12px sans-serif';
      ctx.fillText(vista.name.slice(0, 1), spot.x, spot.y + 4);
    }
  }
  if (vistaBand(band) === 'older') {
    ctx.strokeStyle = '#3f6b52';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(16, 222);
    ctx.lineTo(16 + 42, 222);
    ctx.stroke();
    ctx.fillStyle = '#3f6b52';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('1 首歌', 64, 226);
  }
  ctx.fillStyle = '#e27a5f';
  ctx.beginPath();
  ctx.arc(layout.balloon.x, layout.balloon.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8f6238';
  ctx.fillRect(layout.dock.x - 5, layout.dock.y - 3, 10, 6);
  if (typeof overlay === 'function') overlay(ctx, layout);
}
