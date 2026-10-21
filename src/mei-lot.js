/** Hollywood-lot rules for beauty valley. Optional save fields. No travel.story writes. */

export const SHARD_LINE = '放映机放出一片星空，一艘飞船慢慢飞过。那个方向，只有热气球能去。';
export const PREMIERE_NOTE = '星光首映夜放你自己拍的照片和小电影。每部都有掌声。不评名次。';
export const SET_NOTE = '绕到后面能看见木头架子。这是布景。没有枪，也没有决斗。';
export const RABBIT_NOTE = '灯塔兔举着一盏灯。它是兔子，圆耳朵，短背心。';
export const SIGN_NOTE = '山坡上的大字写着 USA。';
export const LOT_NOTE = '农场还在，叫外景地。旁边是片场。';
export const STAR_COUNT = 8;
export const FILM_LIMIT = 12;

export const PARTS = Object.freeze([
  { id: 'gear', name: '齿轮', icon: 'workbench' },
  { id: 'lens', name: '镜头', icon: 'sparkle' },
  { id: 'lamp', name: '灯', icon: 'lantern' },
]);

export const BOARD_CARDS = Object.freeze([
  { id: 'sun', name: '太阳', icon: 'lantern' },
  { id: 'tree', name: '树', icon: 'plant' },
  { id: 'friend', name: '朋友', icon: 'heart' },
  { id: 'plane', name: '纸飞机', icon: 'paper' },
  { id: 'star', name: '星星', icon: 'star' },
  { id: 'ship', name: '飞船', icon: 'balloon' },
]);

export const SHOTS = Object.freeze([
  { id: 'wide', name: '远景', en: 'wide shot', audio: 'en-wide', icon: 'map' },
  { id: 'medium', name: '中景', en: 'medium shot', audio: 'en-medium', icon: 'play' },
  { id: 'close', name: '特写', en: 'close-up', audio: 'en-close', icon: 'sparkle' },
]);

export const LIGHTS = Object.freeze([
  { id: 'key', name: '主光', icon: 'lantern' },
  { id: 'fill', name: '补光', icon: 'sun' },
  { id: 'rim', name: '轮廓光', icon: 'star' },
]);

export const LOT_SITES = Object.freeze({
  sign: Object.freeze({ x: 1.6, z: 14.15, name: '山坡大字' }),
  cinema: Object.freeze({ x: -5.2, z: -1.7, name: '星光大影院' }),
  stage: Object.freeze({ x: 13.7, z: -2.5, name: '1号摄影棚' }),
  street: Object.freeze({ x: 14.15, z: 4.35, name: '街景布景' }),
  western: Object.freeze({ x: -13.6, z: 2.15, name: '西部布景' }),
  bridge: Object.freeze({ x: 0, z: -14.55, name: '红色吊桥' }),
  rabbit: Object.freeze({ x: 7.6, z: -14.15, name: '灯塔兔' }),
  stars: Object.freeze({ x: -3.1, z: -8.4, name: '星光步道' }),
  kacha: Object.freeze({ x: 11.15, z: -1.15, name: '咔嚓' }),
  rudy: Object.freeze({ x: -2.7, z: -0.35, name: 'Rudy' }),
  pumpkin: Object.freeze({ x: -11.15, z: 2.35, name: '南瓜头' }),
  gear: Object.freeze({ x: 9.55, z: 2.55, name: '齿轮' }),
  lens: Object.freeze({ x: 11.05, z: -2.5, name: '镜头' }),
  lamp: Object.freeze({ x: 3.4, z: -9.15, name: '灯' }),
  lampTour: Object.freeze({ x: -5.2, z: -4.55, name: '灯' }),
});

const PART_IDS = new Set(PARTS.map((item) => item.id));
const CARD_IDS = new Set(BOARD_CARDS.map((item) => item.id));
const SHOT_IDS = new Set(SHOTS.map((item) => item.id));
const MADE = Object.freeze(['windmill-mini', 'paper-plane', 'quilt', 'pumpkin-lantern', 'thanks-card', 'log-wall']);

export function emptyLotFields() {
  return {
    storyShard: false,
    projector: { gear: false, lens: false, lamp: false },
    films: [],
    premiere: false,
  };
}

/** 4–6 and 7–9 read as 6–8. 10–12 reads as 9–12. */
export function meiAgeBand(ageBand) {
  if (ageBand === 'older' || ageBand === 'senior' || ageBand === '9-12') return 'senior';
  return 'junior';
}

export function isMeiTour() {
  return new URLSearchParams(location.search).get('tour') === '1';
}

export function readTour() {
  try { return isMeiTour(); }
  catch { return false; }
}

export function normalizeProjector(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    gear: source.gear === true,
    lens: source.lens === true,
    lamp: source.lamp === true,
  };
}

export function projectorStatus(realm, tour = readTour()) {
  const saved = normalizeProjector(realm?.projector);
  const showcase = tour && realm?.storyShard !== true;
  const gear = showcase ? true : saved.gear;
  const lens = showcase ? true : saved.lens;
  const lamp = saved.lamp;
  const missing = PARTS.filter((item) => !({ gear, lens, lamp })[item.id]).map((item) => item.id);
  return { gear, lens, lamp, missing, tour: showcase };
}

export function partSite(part, tour = readTour()) {
  if (part === 'lamp' && tour) return LOT_SITES.lampTour;
  return LOT_SITES[part] || null;
}

export function litStarCount(stamps) {
  const list = Array.isArray(stamps) ? stamps : [];
  const n = list.filter((id) => id === 'vista-mei' || (typeof id === 'string' && id.startsWith('mei-'))).length;
  return Math.min(STAR_COUNT, n);
}

export function madeTokens(state) {
  const inventory = state?.inventory || {};
  const tokens = MADE.filter((id) => (inventory[id] || 0) > 0);
  if ((state?.travel?.realms?.mei?.films || []).length) tokens.push('film');
  return tokens;
}

export function audioUrl(id) {
  const base = import.meta.env?.BASE_URL || '/';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}audio/mei/${id}.mp3`;
}

export function playMeiLine(id, fallbackText, lang = 'en-US') {
  const finish = () => speakFallback(fallbackText, lang);
  try {
    const audio = new Audio(audioUrl(id));
    audio.addEventListener('error', finish, { once: true });
    const played = audio.play();
    if (played && typeof played.catch === 'function') played.catch(finish);
    return audio;
  } catch {
    finish();
    return null;
  }
}

function speakFallback(text, lang) {
  if (!text || typeof speechSynthesis === 'undefined') return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = lang.startsWith('zh') ? 0.92 : 0.86;
    utterance.volume = 0.7;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  } catch { /* icons still explain the step */ }
}

export function shardClue() {
  return {
    line: SHARD_LINE,
    audio: 'zh-shard',
    en: 'en-ship',
    skip: '跳过这段',
  };
}
