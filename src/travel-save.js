/** Travel record checks. Home buildings stay on the root save. */

import { ITEMS } from './game-data.js';
import { LIFE_RULES } from './life-data.js';
import {
  PLAYABLE_REALMS,
  REALM_BLOCK_LIMIT,
  REALMS,
  STAMPS,
  WASHI_TOTAL_SECONDS,
  arrivalFor,
  defaultTravel,
  inVisitorYard,
  realmContains,
  realmTerrainHeight,
  washiStage,
} from './realm-data.js';
import { XING_STAMPS } from './xing-data.js';
import { readCrystal, readXingFields } from './xing-save.js';

const STAMP_IDS = new Set([...STAMPS, ...XING_STAMPS].map((item) => item.id));
const ID_TEXT = /^[a-z0-9-]{1,64}$/;
const TRAVEL_KEYS = new Set(['schema', 'current', 'via', 'visited', 'stamps', 'stickers', 'story', 'gifts', 'supplyAt', 'realms']);

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isCount = (value) => Number.isSafeInteger(value) && value >= 0 && value <= 1000000;

export class TravelError extends Error {
  constructor(message, code = 'travel', realmId = null) {
    super(message);
    this.name = 'TravelError';
    this.travel = true;
    this.code = code;
    this.realmId = realmId;
  }
}

function idList(value, label, { known = null, limit = 64 } = {}) {
  if (!Array.isArray(value) || value.length > limit) throw new TravelError(`${label}不正确。`);
  if (new Set(value).size !== value.length) throw new TravelError(`${label}重复了。`);
  for (const id of value) {
    if (typeof id !== 'string' || !ID_TEXT.test(id)) throw new TravelError(`${label}不正确。`);
    if (known && !known.has(id)) throw new TravelError(`${label}不正确。`);
  }
  return [...value];
}

function readBag(value, code = 'realm', realmId = null) {
  if (!isRecord(value) || Object.keys(value).some((item) => !Object.hasOwn(ITEMS, item))) {
    throw new TravelError('日谷的材料记录不正确。', code, realmId);
  }
  const bag = {};
  for (const item of Object.keys(ITEMS)) {
    const count = value[item] ?? 0;
    if (!isCount(count)) throw new TravelError('日谷的材料数量不正确。', code, realmId);
    bag[item] = count;
  }
  return bag;
}

function validateRealm(id, realm) {
  if (!REALMS[id]?.playable || id === 'he' || !isRecord(realm)) {
    throw new TravelError('日谷的记录不正确。', 'realm', id);
  }
  const blocks = realm.blocks;
  if (!Array.isArray(blocks) || blocks.length > REALM_BLOCK_LIMIT) {
    throw new TravelError('日谷的建筑数量不正确。', 'realm', id);
  }
  const ids = new Set();
  const positions = new Set();
  const nextBlocks = blocks.map((block) => {
    if (!isRecord(block)) throw new TravelError('日谷的建筑不正确。', 'realm', id);
    const spanW = block.w == null ? 1 : block.w;
    const spanD = block.d == null ? 1 : block.d;
    if (!/^block-[1-9]\d*$/.test(block.id) || ids.has(block.id) || !ITEMS[block.item]?.placeable
      || !Number.isInteger(block.x) || !Number.isInteger(block.z) || !Number.isInteger(block.y)
      || !Number.isInteger(block.rotation) || block.rotation < 0 || block.rotation > 3
      || !Number.isInteger(spanW) || spanW < 1 || spanW > 12
      || !Number.isInteger(spanD) || spanD < 1 || spanD > 12
      || (block.item !== 'roof' && (spanW !== 1 || spanD !== 1))) {
      throw new TravelError('日谷的建筑不正确。', 'realm', id);
    }
    for (let dx = 0; dx < spanW; dx += 1) {
      for (let dz = 0; dz < spanD; dz += 1) {
        const cx = block.x + dx;
        const cz = block.z + dz;
        if (!inVisitorYard(id, cx, cz) || block.y < realmTerrainHeight(id, cx) || block.y > 12) {
          throw new TravelError('日谷的建筑放在了朋友的家里。', 'realm', id);
        }
        const key = `${cx},${block.y},${cz}`;
        if (positions.has(key)) throw new TravelError('日谷的建筑重叠了。', 'realm', id);
        positions.add(key);
      }
    }
    ids.add(block.id);
    return { id: block.id, item: block.item, x: block.x, y: block.y, z: block.z, rotation: block.rotation, w: spanW, d: spanD };
  });
  if (!isRecord(realm.chests)) throw new TravelError('日谷的箱子不正确。', 'realm', id);
  const chests = {};
  for (const block of nextBlocks.filter((block) => block.item === 'chest')) chests[block.id] = readBag(realm.chests[block.id] ?? {}, 'realm', id);
  if (Object.keys(realm.chests).some((chestId) => !Object.hasOwn(chests, chestId))) {
    throw new TravelError('日谷有找不到的箱子。', 'realm', id);
  }
  const claimed = idList(realm.claimed ?? [], '日谷的标记', { limit: 32 });
  const processes = realm.processes ?? [];
  if (!Array.isArray(processes) || processes.length > 4) throw new TravelError('日谷的加工不正确。', 'realm', id);
  const nextProcesses = processes.map((proc) => {
    if (id === 'xing') {
      const crystal = readCrystal(proc);
      if (typeof crystal === 'string') throw new TravelError(crystal, 'realm', id);
      return crystal;
    }
    if (!isRecord(proc) || proc.kind !== 'washi' || typeof proc.id !== 'string' || !ID_TEXT.test(proc.id)) {
      throw new TravelError('日谷的加工不正确。', 'realm', id);
    }
    if (!Number.isFinite(proc.elapsed) || proc.elapsed < 0 || proc.elapsed > WASHI_TOTAL_SECONDS) {
      throw new TravelError('日谷的加工时间不正确。', 'realm', id);
    }
    const stage = washiStage(proc.elapsed);
    if (proc.stage !== stage) throw new TravelError('和纸的步骤不一致。', 'realm', id);
    return { id: proc.id, kind: 'washi', elapsed: proc.elapsed, stage };
  });
  const player = realm.player;
  if (!isRecord(player) || ![player.x, player.y, player.z].every(Number.isFinite)) {
    throw new TravelError('日谷的位置不正确。', 'position', id);
  }
  const ry = player.ry ?? 0;
  const maxY = id === 'xing' ? 24 : 16;
  if (!Number.isFinite(ry) || !realmContains(id, player.x, player.z) || player.y < -2 || player.y > maxY) {
    throw new TravelError('日谷的位置不正确。', 'position', id);
  }
  const checked = {
    player: { x: player.x, y: player.y, z: player.z, ry },
    blocks: nextBlocks,
    chests,
    claimed,
    processes: nextProcesses,
  };
  if (id === 'xing') {
    try { Object.assign(checked, readXingFields(realm)); }
    catch (error) { throw new TravelError(error.message || '外星谷的记录不正确。', 'realm', id); }
  }
  return checked;
}

function keepPlain(realm) {
  if (!isRecord(realm)) throw new TravelError('外谷记录不正确。');
  const text = JSON.stringify(realm);
  if (text.length > 200000) throw new TravelError('外谷记录不正确。');
  return JSON.parse(text);
}

export function validateTravel(travel) {
  if (travel == null) return defaultTravel();
  if (!isRecord(travel) || Object.keys(travel).some((key) => !TRAVEL_KEYS.has(key))) {
    throw new TravelError('旅行记录不正确。');
  }
  if (travel.schema !== 1) throw new TravelError('旅行记录的版本不正确。');
  const current = travel.current;
  if (current !== 'he' && !PLAYABLE_REALMS.includes(current)) throw new TravelError('现在所在的谷不正确。');
  const via = travel.via ?? null;
  if (via !== null && via !== 'ferry' && via !== 'balloon') throw new TravelError('旅行方式不正确。');
  const visited = idList(travel.visited ?? [], '去过的谷', { known: new Set(PLAYABLE_REALMS), limit: 8 });
  const stamps = idList(travel.stamps ?? [], '印章', { known: STAMP_IDS, limit: 32 });
  const stickers = idList(travel.stickers ?? [], '贴纸', { limit: 64 });
  const story = travel.story ?? { seen: [], letters: [] };
  if (!isRecord(story)) throw new TravelError('故事记录不正确。');
  const gifts = travel.gifts ?? { given: [], received: [] };
  if (!isRecord(gifts)) throw new TravelError('礼物记录不正确。');
  const supplyAt = travel.supplyAt ?? 0;
  if (!Number.isSafeInteger(supplyAt) || supplyAt < 0 || supplyAt > LIFE_RULES.maxElapsed) {
    throw new TravelError('补给时间不正确。');
  }
  const realmsIn = travel.realms ?? {};
  if (!isRecord(realmsIn)) throw new TravelError('外谷记录不正确。');
  const realms = {};
  for (const id of Object.keys(realmsIn)) {
    if (id === 'mei' && REALMS.mei && !REALMS.mei.playable) {
      realms[id] = keepPlain(realmsIn[id]);
      continue;
    }
    realms[id] = validateRealm(id, realmsIn[id]);
  }
  if (current !== 'he' && !realms[current]) throw new TravelError('这一谷的记录丢了。', 'realm', current);
  return {
    schema: 1,
    current,
    via,
    visited,
    stamps,
    stickers,
    story: {
      seen: idList(story.seen ?? [], '看过的故事', { limit: 64 }),
      letters: idList(story.letters ?? [], '信件', { limit: 32 }),
    },
    gifts: {
      given: idList(gifts.given ?? [], '送出的礼物', { limit: 64 }),
      received: idList(gifts.received ?? [], '收到的礼物', { limit: 64 }),
    },
    supplyAt,
    realms,
  };
}

const HOME_NOTICE = '旅行记录有问题，已经回到河谷。家里的建筑和背包还在。';
const DOCK_NOTICE = '日谷的位置出了范围，已经回到码头。家里的建筑和背包还在。';

function keepIds(value, known = null) {
  if (!Array.isArray(value)) return [];
  const kept = [];
  for (const id of value) {
    if (typeof id !== 'string' || !ID_TEXT.test(id)) continue;
    if (known && !known.has(id)) continue;
    if (!kept.includes(id)) kept.push(id);
  }
  return kept.slice(0, 64);
}

/** Local loads keep the home. Import uses validateTravel and rejects the whole file. */
export function repairTravelRaw(raw) {
  const copy = JSON.parse(JSON.stringify(raw));
  if (!isRecord(copy.travel)) {
    copy.travel = defaultTravel();
    return { raw: copy, notice: HOME_NOTICE, code: 'travel' };
  }
  try {
    copy.travel = validateTravel(copy.travel);
    return { raw: copy, notice: null, code: null };
  } catch (error) {
    if (!error?.travel) throw error;
    if (error.code === 'position' && error.realmId && isRecord(copy.travel.realms?.[error.realmId])) {
        copy.travel.realms[error.realmId].player = arrivalFor(error.realmId, 'ferry');
        try {
          copy.travel = validateTravel(copy.travel);
          const notice = error.realmId === 'xing' ? '外星谷的位置出了范围，已经回到热气球草坪。家里的建筑和背包还在。' : DOCK_NOTICE;
          return { raw: copy, notice, code: 'position' };
      } catch (again) {
        if (!again?.travel) throw again;
      }
    }
    const fresh = defaultTravel();
    const src = isRecord(copy.travel) ? copy.travel : {};
    fresh.visited = keepIds(src.visited, new Set(PLAYABLE_REALMS));
    fresh.stamps = keepIds(src.stamps, STAMP_IDS);
    fresh.stickers = keepIds(src.stickers);
    fresh.story.seen = keepIds(src.story?.seen);
    fresh.story.letters = keepIds(src.story?.letters);
    fresh.gifts.given = keepIds(src.gifts?.given);
    fresh.gifts.received = keepIds(src.gifts?.received);
    fresh.supplyAt = Number.isSafeInteger(src.supplyAt) && src.supplyAt >= 0 && src.supplyAt <= LIFE_RULES.maxElapsed ? src.supplyAt : 0;
    if (isRecord(src.realms)) {
      for (const id of Object.keys(src.realms)) {
        const trial = defaultTravel();
        trial.realms = { [id]: src.realms[id] };
        try {
          fresh.realms[id] = validateTravel(trial).realms[id];
        } catch { /* drop this valley */ }
      }
    }
    copy.travel = fresh;
    return { raw: copy, notice: HOME_NOTICE, code: 'travel' };
  }
}
