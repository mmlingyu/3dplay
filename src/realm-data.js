/** Realm registry. Home stays neutral. Day, beauty and alien valleys are playable. */

import { MEI_REALM } from './mei-data.js';

export const EARTH_GRAVITY = 9.8;

export const REALM_BLOCK_LIMIT = 600;
export const TRAVEL_BACKUP_KEY_NAME = 'before-travel';
export const SUPPLY_COOLDOWN = 180;
export const SUPPLY_COUNT = 2;

export const AGE_BANDS = Object.freeze([
  { id: 'junior', label: '6–8 岁', npc: '短一点' },
  { id: 'senior', label: '9–12 岁', npc: '挑战一下' },
]);

/** Old 4–6 and 7–9 both read as 6–8. 10–12 reads as 9–12. */
export function normalizeAgeBand(band) {
  if (band === 'senior' || band === 'older') return 'senior';
  if (band === 'junior' || band === 'little' || band === 'bigger') return 'junior';
  return null;
}

/** Legacy copy keys. Explicit little / bigger / older stay put so existing scenes keep their lines. */
export function contentAgeBand(band) {
  if (band === 'little' || band === 'bigger' || band === 'older') return band;
  return normalizeAgeBand(band) === 'senior' ? 'older' : 'little';
}

/** 6–8 merges the younger lines. 9–12 reads the older lines. Legacy ids keep the old order. */
export function mergedQuizOrder(band) {
  if (band === 'junior') return ['little', 'bigger'];
  if (band === 'senior') return ['older'];
  if (band === 'older') return ['older', 'bigger', 'little'];
  if (band === 'bigger') return ['bigger', 'little'];
  return ['little'];
}

export const FERRY_NOTE = '坐小船可以过海到日谷。路程在游戏里变短了。';
export const VOYAGE_NOTE = '路程和天气在游戏里被简化了。真实的热气球跨海要看风向和天气。';
export const WASHI_NOTE = '和纸用楮树皮的纤维，经过剥皮蒸煮、敲打、加水、竹帘抄纸和晾干。这里的时间在游戏里缩短了。格子份数是游戏约定。';
export const FOLD_NOTE = '对折、再对折是折纸的做法。游戏里一次折好。纸鹤用一张和纸，纸船用两张并排，这样每种格子只有一个结果。真实折纸通常一张纸、很多步。这是游戏约定。';

export const WASHI_STAGE_SECONDS = 4;
export const WASHI_TOTAL_SECONDS = 20;
export const WASHI_STAGES = Object.freeze([
  { id: 'steam', label: '剥皮蒸煮', icon: 'plant' },
  { id: 'beat', label: '敲打成纤维', icon: 'hammer' },
  { id: 'water', label: '加水', icon: 'water' },
  { id: 'scoop', label: '竹帘抄纸', icon: 'craft' },
  { id: 'dry', label: '晾干', icon: 'sun' },
]);

export function washiStage(elapsed) {
  const time = Number(elapsed) || 0;
  if (time >= WASHI_TOTAL_SECONDS) return 'ready';
  const index = Math.min(WASHI_STAGES.length - 1, Math.floor(time / WASHI_STAGE_SECONDS));
  return WASHI_STAGES[index].id;
}

export const STAMPS = Object.freeze([
  { id: 'ri-arrive', name: '到达日谷', icon: 'ferry', how: '走到渡口坐船，或在热气球上选择看风景。不用答题。' },
  { id: 'ri-washi-first', name: '第一张和纸', icon: 'paper', how: '在纸坊用楮皮做和纸。不用答题。' },
  { id: 'ri-crane-first', name: '第一只纸鹤', icon: 'crane', how: '用和纸折一只纸鹤。不用答题。' },
  { id: 'ri-help-koharu', name: '帮小春修鲤鱼旗', icon: 'carp', how: '做好纸鲤鱼旗，到旗杆补上。不用答题。' },
]);

export const RI_STORY_STAMPS = Object.freeze([
  { id: 'ri-tide-shard', name: '潮之片', icon: 'water', how: '在日谷车站的失物柜，三件事里完成两件就能打开。不用先做完别的章节。' },
]);

export const HOME_DOCKS = Object.freeze([
  { id: 'downstream', x: 4, z: 14, radius: 2.15 },
  { id: 'upstream', x: 4, z: -14, radius: 2.15 },
]);

const HOME_DOCK_SCAN = Object.freeze([14, -14, 12, -12, 10, -10, 8, -8]);

export const RI_DOCK = Object.freeze({ x: 0, y: 0, z: -12, ry: 0 });
export const RI_LAWN = Object.freeze({ x: -10, y: 0, z: 12, ry: 0 });
export const XING_LAWN = Object.freeze({ x: -10, y: 0, z: 12, ry: 0 });

const XING_BALLOON = Object.freeze({
  x: -10,
  z: 12,
  radius: 2.8,
  padHeight: 0.14,
  basketHeight: 0.72,
  cruiseHeight: 16.5,
  liftSeconds: 4.2,
  descendSeconds: 3.4,
  homeSpeed: 4.2,
  tourSeconds: 48,
});

const RI_BALLOON = Object.freeze({
  x: -10,
  z: 12,
  radius: 2.8,
  padHeight: 0.14,
  basketHeight: 0.72,
  cruiseHeight: 16.5,
  liftSeconds: 4.2,
  descendSeconds: 3.4,
  homeSpeed: 4.2,
  tourSeconds: 48,
});

export const REALMS = Object.freeze({
  he: Object.freeze({
    id: 'he',
    name: '河谷',
    home: true,
    playable: true,
    theme: 'home',
    gravity: EARTH_GRAVITY,
    ballBoundary: 15.55,
  }),
  ri: Object.freeze({
    id: 'ri',
    name: '日谷',
    playable: true,
    theme: 'japan',
    gravity: EARTH_GRAVITY,
    entry: 'dock',
    altEntry: 'balloon',
    festivals: Object.freeze([
      Object.freeze({ id: 'sakura-lantern', name: '樱花灯笼祭', note: '街上挂着纸灯笼，寺社石阶有樱花。鲤鱼旗全年都能补。没有限时奖励。' }),
    ]),
    bounds: Object.freeze({ minX: -16, maxX: 15, minZ: -16, maxZ: 15 }),
    flight: Object.freeze({ minX: -14, maxX: 14, minZ: -14, maxZ: 14 }),
    visitor: Object.freeze({ minX: 2, maxX: 10, minZ: 5, maxZ: 12 }),
    stream: Object.freeze({ minX: -1, maxX: 1 }),
    balloon: RI_BALLOON,
    dock: RI_DOCK,
    lawn: RI_LAWN,
    sites: Object.freeze({
      workshop: Object.freeze({ x: -8, z: -6, name: '纸坊' }),
      gassho: Object.freeze({ x: -8, z: 5, name: '合掌大屋' }),
      kozo: Object.freeze({ x: -12, z: -11, name: '楮树林' }),
      bamboo: Object.freeze({ x: 11, z: -8, name: '竹林' }),
      bridge: Object.freeze({ x: 0, z: -2, name: '太鼓桥' }),
      flag: Object.freeze({ x: -4, z: 1, name: '鲤鱼旗杆' }),
      koharu: Object.freeze({ x: -6.2, z: -4.2 }),
      elder: Object.freeze({ x: -9.2, z: -4.5 }),
      ponta: Object.freeze({ x: 9.2, z: -6.2 }),
      gate: Object.freeze({ x: 0, z: -8, name: '大灯笼门' }),
      tower: Object.freeze({ x: 13, z: 7, name: '红白铁塔' }),
      shrine: Object.freeze({ x: -13.2, z: 7.2, name: '山坡寺社' }),
      cabinet: Object.freeze({ x: 3.55, z: -10.35, name: '失物招领柜' }),
    }),
  }),
  mei: Object.freeze({ ...MEI_REALM, gravity: EARTH_GRAVITY }),
  xing: Object.freeze({
    id: 'xing',
    name: '外星谷',
    playable: true,
    theme: 'fiction',
    entry: 'balloon',
    festivals: Object.freeze([]),
    gravity: EARTH_GRAVITY / 3,
    ballBoundary: 14.4,
    bounds: Object.freeze({ minX: -16, maxX: 15, minZ: -16, maxZ: 15 }),
    flight: Object.freeze({ minX: -14, maxX: 14, minZ: -14, maxZ: 14 }),
    visitor: Object.freeze({ minX: 2, maxX: 10, minZ: 2, maxZ: 9 }),
    balloon: XING_BALLOON,
    lawn: XING_LAWN,
    sites: Object.freeze({
      dome: Object.freeze({ x: -4, z: 1, name: '穹顶屋' }),
      tower: Object.freeze({ x: -8, z: -6, name: '晶体塔' }),
      lab: Object.freeze({ x: -8, z: -2, name: '试验站' }),
      salt: Object.freeze({ x: 8, z: -11, name: '盐湖' }),
      moss: Object.freeze({ x: 5, z: -8, name: '光苔' }),
      hopper: Object.freeze({ x: 11, z: 1, name: '跳跳球兽' }),
      meteor: Object.freeze({ x: -12, z: 6, name: '陨石' }),
      glass: Object.freeze({ x: -2, z: -11, name: '玻璃罩' }),
      gugu: Object.freeze({ x: -6, z: 6 }),
      doctor: Object.freeze({ x: -9, z: -2 }),
      robot: Object.freeze({ x: 0, z: -6 }),
    }),
  }),
});

export const REALM_IDS = Object.freeze(Object.keys(REALMS));
export const PLAYABLE_REALMS = Object.freeze(REALM_IDS.filter((id) => REALMS[id].playable));

export function realmById(id) {
  return REALMS[id] || null;
}

export function realmTerrainHeight(realmId, x) {
  const realm = REALMS[realmId];
  if (!realm?.stream) return 0;
  return x >= realm.stream.minX && x <= realm.stream.maxX ? -1 : 0;
}

export function realmContains(realmId, x, z) {
  const bounds = REALMS[realmId]?.bounds;
  if (!bounds || !Number.isFinite(x) || !Number.isFinite(z)) return false;
  return x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
}

export function inVisitorYard(realmId, x, z) {
  const yard = REALMS[realmId]?.visitor;
  if (!yard || !Number.isInteger(x) || !Number.isInteger(z)) return false;
  return x >= yard.minX && x <= yard.maxX && z >= yard.minZ && z <= yard.maxZ;
}

export function isRealmProtected(realmId, x, z) {
  if (!realmId || realmId === 'he') return false;
  if (!REALMS[realmId]?.playable) return true;
  return !inVisitorYard(realmId, x, z);
}

function dockHitsBlocks(blocks, x, z, radius) {
  return (blocks || []).some((block) => Math.hypot((block?.x ?? 99) - x, (block?.z ?? 99) - z) <= radius + 0.55);
}

export function chooseDockSite(blocks = []) {
  for (const site of HOME_DOCKS) {
    if (!dockHitsBlocks(blocks, site.x, site.z, site.radius)) return site;
  }
  for (const z of HOME_DOCK_SCAN) {
    const site = { id: `stream-${z}`, x: 4, z, radius: 1.7 };
    if (!dockHitsBlocks(blocks, site.x, site.z, site.radius)) return site;
  }
  return null;
}

export function isDockCell(x, z, blocks = []) {
  const site = chooseDockSite(blocks);
  if (!site || !Number.isFinite(x) || !Number.isFinite(z)) return false;
  return Math.hypot(x - site.x, z - site.z) <= site.radius;
}

export function arrivalFor(realmId, via) {
  if (realmId === 'xing') return { ...XING_LAWN };
  const realm = REALMS[realmId];
  if (!realm?.dock) return { x: -5, y: 0, z: 5, ry: 0 };
  return via === 'balloon' && realm.lawn ? { ...realm.lawn } : { ...realm.dock };
}

export function defaultTravel() {
  return {
    schema: 1,
    current: 'he',
    via: null,
    visited: [],
    stamps: [],
    stickers: [],
    story: {
      seen: [],
      letters: [],
      restored: [],
      fogIntro: false,
      fogOff: false,
      hintsOff: false,
      festival: false,
      homePlaces: [],
      nudges: { vista: 0, bottle: 0, dock: 0, balloon: 0, stuck: 0, day: -1, last: '', chapter: 'prologue' },
      site: null,
    },
    gifts: { given: [], received: [] },
    supplyAt: 0,
    realms: {},
    discovered: { ri: false, mei: false, xing: false },
    keepsakes: [],
  };
}

export function emptyRealm(realmId) {
  const realm = {
    player: arrivalFor(realmId, 'ferry'),
    blocks: [],
    chests: {},
    claimed: [],
    processes: [],
  };
  if (realmId === 'xing') {
    realm.glyphs = [];
    realm.puzzles = [];
    realm.experiments = [];
  }
  if (realmId === 'mei') {
    realm.projects = [];
    realm.trades = [];
    realm.decor = { face: 'smile' };
    realm.storyShard = false;
    realm.projector = { gear: false, lens: false, lamp: false };
    realm.films = [];
    realm.premiere = false;
  }
  return realm;
}
