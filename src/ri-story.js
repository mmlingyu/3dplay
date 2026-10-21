/** Day-valley v0.3 rules. Missing save fields mean "not done". */

export const MIKO_CLUE = '这种孔，我在海那边的电影院见过。';
export const SHOP_ALL = 63;
export const LANTERN_ALL = 15;
export const SHRINE_FORBIDDEN = Object.freeze(['参拜', '抽签', '许愿', '知识']);

export const RI_LAYOUT = Object.freeze({
  gate: Object.freeze({ x: 0, z: -8 }),
  tower: Object.freeze({ x: 13, z: 7, deckY: 14.2 }),
  shrine: Object.freeze({ x: -13.2, z: 7.2, floor: 3 }),
  crosswalk: Object.freeze({ x: 8.4, z: 1.5 }),
  cabinet: Object.freeze({ x: 3.55, z: -10.35 }),
  miko: Object.freeze({ x: 2.45, z: -11.15 }),
  denden: Object.freeze({ x: 4.15, z: -6.35 }),
  stall: Object.freeze({ x: 7.1, z: -7.55 }),
  shoes: Object.freeze({ x: 4.15, z: -2.55 }),
  queue: Object.freeze({ x: -4.6, z: 10.15 }),
  trackZ: 14.15,
  trackY: 6.2,
});

export const RI_SHOPS = Object.freeze([
  Object.freeze({ id: 'sakura', kana: 'さくら', reading: 'さくら', audio: 'ja-sakura', meaning: '樱花', icon: 'plant' }),
  Object.freeze({ id: 'hon', kana: 'ほん', reading: 'ほん', audio: 'ja-hon', meaning: '书', icon: 'paper' }),
  Object.freeze({ id: 'mizu', kana: 'みず', reading: 'みず', audio: 'ja-mizu', meaning: '水', icon: 'water' }),
  Object.freeze({ id: 'densha', kana: 'でんしゃ', reading: 'でんしゃ', audio: 'ja-densha', meaning: '电车', icon: 'ferry' }),
  Object.freeze({ id: 'yama', kana: 'やま', reading: 'やま', audio: 'ja-yama', meaning: '山', icon: 'stone' }),
  Object.freeze({ id: 'sora', kana: 'そら', reading: 'そら', audio: 'ja-sora', meaning: '天空', icon: 'star' }),
].map((shop, index) => Object.freeze({ ...shop, index, x: 5.55, z: -7.15 + index * 1.32 })));

export const RI_STATIONS = Object.freeze([
  Object.freeze({ id: 'village', name: '老村站', kana: 'むら', audio: 'ja-station-village', icon: 'home', x: -4, z: 11.2 }),
  Object.freeze({ id: 'tower', name: '铁塔站', kana: 'とう', audio: 'ja-station-tower', icon: 'post', x: 10.4, z: 11.2 }),
  Object.freeze({ id: 'gate', name: '山门站', kana: 'やま', audio: 'ja-station-gate', icon: 'lantern', x: -12.2, z: 9.2 }),
]);

export const RI_LOANWORDS = Object.freeze([
  Object.freeze({ kana: 'カメラ', audio: 'ja-camera', meaning: '照相机', from: 'camera' }),
  Object.freeze({ kana: 'ケーキ', audio: 'ja-cake', meaning: '蛋糕', from: 'cake' }),
  Object.freeze({ kana: 'テレビ', audio: 'ja-terebi', meaning: '电视', from: 'television' }),
]);

const CITY_KEYS = new Set(['lanterns', 'shops', 'trainLoops', 'queue', 'signal', 'shoes', 'thanks']);

export function riBand(ageBand) {
  if (ageBand === 'older' || ageBand === 'senior') return 'senior';
  return 'junior';
}

export function isTour() {
  try {
    return new URLSearchParams(location.search).get('tour') === '1';
  } catch {
    return false;
  }
}

export function readCity(realm) {
  const city = realm?.city && typeof realm.city === 'object' && !Array.isArray(realm.city) ? realm.city : {};
  return {
    lanterns: city.lanterns || 0,
    shops: city.shops || 0,
    trainLoops: city.trainLoops || 0,
    queue: city.queue === true,
    signal: city.signal === true,
    shoes: city.shoes === true,
    thanks: city.thanks === true,
  };
}

export function shardTasks(realm) {
  const city = readCity(realm);
  return {
    flag: Boolean(realm?.claimed?.includes('ri-flag-repaired')),
    street: (city.shops & SHOP_ALL) === SHOP_ALL,
    train: city.trainLoops >= 1,
  };
}

export function shardScore(realm) {
  const tasks = shardTasks(realm);
  return Number(tasks.flag) + Number(tasks.street) + Number(tasks.train);
}

export function shardNeed() {
  return isTour() ? 1 : 2;
}

export function canOpenCabinet(realm) {
  if (realm?.storyShard === true) return true;
  return shardScore(realm) >= shardNeed();
}

export function shrineAllows(action) {
  const text = String(action || '');
  if (SHRINE_FORBIDDEN.some((word) => text.includes(word))) return false;
  return text === '点亮' || text === '看看';
}

export function parseStoryShard(value) {
  if (value == null || value === false) return null;
  if (value === true) return true;
  return '日谷的故事碎片不正确。';
}

export function parseRiCity(value) {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return '日谷的街区记录不正确。';
  for (const key of Object.keys(value)) {
    if (!CITY_KEYS.has(key)) return '日谷的街区记录不正确。';
  }
  const lanterns = value.lanterns ?? 0;
  const shops = value.shops ?? 0;
  const trainLoops = value.trainLoops ?? 0;
  if (!Number.isInteger(lanterns) || lanterns < 0 || lanterns > LANTERN_ALL) return '日谷的灯笼记录不正确。';
  if (!Number.isInteger(shops) || shops < 0 || shops > SHOP_ALL) return '日谷的招牌记录不正确。';
  if (!Number.isInteger(trainLoops) || trainLoops < 0 || trainLoops > 99) return '日谷的电车记录不正确。';
  const city = { lanterns, shops, trainLoops };
  for (const key of ['queue', 'signal', 'shoes', 'thanks']) {
    if (value[key] == null) continue;
    if (typeof value[key] !== 'boolean') return '日谷的礼仪记录不正确。';
    city[key] = value[key];
  }
  return city;
}

export function readRiSave(realm) {
  const extra = {};
  if (realm && Object.hasOwn(realm, 'storyShard')) {
    const shard = parseStoryShard(realm.storyShard);
    if (typeof shard === 'string') throw new Error(shard);
    if (shard) extra.storyShard = true;
  }
  if (realm && Object.hasOwn(realm, 'city')) {
    const city = parseRiCity(realm.city);
    if (typeof city === 'string') throw new Error(city);
    if (city) extra.city = city;
  }
  return extra;
}

export function freshCity() {
  return { lanterns: 0, shops: 0, trainLoops: 0, queue: false, signal: false, shoes: false, thanks: false };
}
