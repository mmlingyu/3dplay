/** Travel record checks. Home buildings stay on the root save. */

import { ITEMS } from './game-data.js';
import { LIFE_RULES } from './life-data.js';
import { MAPLE_TOTAL_SECONDS, mapleStage } from './mei-data.js';
import { validateMeiFields } from './mei-save.js';
import {
  PLAYABLE_REALMS,
  REALM_BLOCK_LIMIT,
  REALMS,
  WASHI_TOTAL_SECONDS,
  arrivalFor,
  defaultTravel,
  emptyRealm,
  inVisitorYard,
  realmContains,
  realmTerrainHeight,
  washiStage,
} from './realm-data.js';
import { STAMP_IDS as STAMP_BOOK_IDS } from './stamp-book.js';
import { inferDiscovered, KEEPSAKE_IDS, VISTA_IDS } from './vista-data.js';
import { readCrystal, readXingFields } from './xing-save.js';

const STAMP_IDS = STAMP_BOOK_IDS;
const ID_TEXT = /^[a-z0-9-]{1,64}$/;
const TRAVEL_KEYS = new Set(['schema', 'current', 'via', 'visited', 'stamps', 'stickers', 'story', 'gifts', 'supplyAt', 'realms', 'discovered', 'keepsakes']);

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

function readBag(value, code = 'realm', realmId = null, name = '日谷') {
  if (!isRecord(value) || Object.keys(value).some((item) => !Object.hasOwn(ITEMS, item))) {
    throw new TravelError(`${name}的材料记录不正确。`, code, realmId);
  }
  const bag = {};
  for (const item of Object.keys(ITEMS)) {
    const count = value[item] ?? 0;
    if (!isCount(count)) throw new TravelError(`${name}的材料数量不正确。`, code, realmId);
    bag[item] = count;
  }
  return bag;
}

function validateRealm(id, realm) {
  const name = REALMS[id]?.name || '这一谷';
  if (!REALMS[id]?.playable || id === 'he' || !isRecord(realm)) {
    throw new TravelError(`${name}的记录不正确。`, 'realm', id);
  }
  const blocks = realm.blocks;
  if (!Array.isArray(blocks) || blocks.length > REALM_BLOCK_LIMIT) {
    throw new TravelError(`${name}的建筑数量不正确。`, 'realm', id);
  }
  const ids = new Set();
  const positions = new Set();
  const nextBlocks = blocks.map((block) => {
    if (!isRecord(block)) throw new TravelError(`${name}的建筑不正确。`, 'realm', id);
    const spanW = block.w == null ? 1 : block.w;
    const spanD = block.d == null ? 1 : block.d;
    if (!/^block-[1-9]\d*$/.test(block.id) || ids.has(block.id) || !ITEMS[block.item]?.placeable
      || !Number.isInteger(block.x) || !Number.isInteger(block.z) || !Number.isInteger(block.y)
      || !Number.isInteger(block.rotation) || block.rotation < 0 || block.rotation > 3
      || !Number.isInteger(spanW) || spanW < 1 || spanW > 12
      || !Number.isInteger(spanD) || spanD < 1 || spanD > 12
      || (block.item !== 'roof' && (spanW !== 1 || spanD !== 1))) {
      throw new TravelError(`${name}的建筑不正确。`, 'realm', id);
    }
    for (let dx = 0; dx < spanW; dx += 1) {
      for (let dz = 0; dz < spanD; dz += 1) {
        const cx = block.x + dx;
        const cz = block.z + dz;
        if (!inVisitorYard(id, cx, cz) || block.y < realmTerrainHeight(id, cx) || block.y > 12) {
          throw new TravelError(`${name}的建筑放在了朋友的家里。`, 'realm', id);
        }
        const key = `${cx},${block.y},${cz}`;
        if (positions.has(key)) throw new TravelError(`${name}的建筑重叠了。`, 'realm', id);
        positions.add(key);
      }
    }
    ids.add(block.id);
    return { id: block.id, item: block.item, x: block.x, y: block.y, z: block.z, rotation: block.rotation, w: spanW, d: spanD };
  });
  if (!isRecord(realm.chests)) throw new TravelError(`${name}的箱子不正确。`, 'realm', id);
  const chests = {};
  for (const block of nextBlocks.filter((block) => block.item === 'chest')) chests[block.id] = readBag(realm.chests[block.id] ?? {}, 'realm', id, name);
  if (Object.keys(realm.chests).some((chestId) => !Object.hasOwn(chests, chestId))) {
    throw new TravelError(`${name}有找不到的箱子。`, 'realm', id);
  }
  const claimed = idList(realm.claimed ?? [], `${name}的标记`, { limit: 32 });
  const processes = realm.processes ?? [];
  if (!Array.isArray(processes) || processes.length > 4) throw new TravelError(`${name}的加工不正确。`, 'realm', id);
  const nextProcesses = processes.map((proc) => {
    if (id === 'xing') {
      const crystal = readCrystal(proc);
      if (typeof crystal === 'string') throw new TravelError(crystal, 'realm', id);
      return crystal;
    }
    if (id === 'mei') {
      if (!isRecord(proc) || proc.kind !== 'maple' || typeof proc.id !== 'string' || !ID_TEXT.test(proc.id)) {
        throw new TravelError('美谷的加工不正确。', 'realm', id);
      }
      if (!Number.isFinite(proc.elapsed) || proc.elapsed < 0 || proc.elapsed > MAPLE_TOTAL_SECONDS) {
        throw new TravelError('美谷的加工时间不正确。', 'realm', id);
      }
      const stage = mapleStage(proc.elapsed);
      if (proc.stage !== stage) throw new TravelError('枫糖的步骤不一致。', 'realm', id);
      return { id: proc.id, kind: 'maple', elapsed: proc.elapsed, stage };
    }
    if (!isRecord(proc) || proc.kind !== 'washi' || typeof proc.id !== 'string' || !ID_TEXT.test(proc.id)) {
      throw new TravelError(`${name}的加工不正确。`, 'realm', id);
    }
    if (!Number.isFinite(proc.elapsed) || proc.elapsed < 0 || proc.elapsed > WASHI_TOTAL_SECONDS) {
      throw new TravelError(`${name}的加工时间不正确。`, 'realm', id);
    }
    const stage = washiStage(proc.elapsed);
    if (proc.stage !== stage) throw new TravelError('和纸的步骤不一致。', 'realm', id);
    return { id: proc.id, kind: 'washi', elapsed: proc.elapsed, stage };
  });
  const player = realm.player;
  if (!isRecord(player) || ![player.x, player.y, player.z].every(Number.isFinite)) {
    throw new TravelError(`${name}的位置不正确。`, 'position', id);
  }
  const ry = player.ry ?? 0;
  const maxY = id === 'xing' ? 24 : 16;
  if (!Number.isFinite(ry) || !realmContains(id, player.x, player.z) || player.y < -2 || player.y > maxY) {
    throw new TravelError(`${name}的位置不正确。`, 'position', id);
  }
  const checked = {
    player: { x: player.x, y: player.y, z: player.z, ry },
    blocks: nextBlocks,
    chests,
    claimed,
    processes: nextProcesses,
  };
  if (Object.hasOwn(realm, 'storyShard')) {
    if (typeof realm.storyShard !== 'boolean') throw new TravelError(`${name}的碎片记录不正确。`, 'realm', id);
    checked.storyShard = realm.storyShard;
  }
  if (id === 'xing') {
    try { Object.assign(checked, readXingFields(realm)); }
    catch (error) { throw new TravelError(error.message || '外星谷的记录不正确。', 'realm', id); }
  }
  if (id === 'mei') return { ...checked, ...validateMeiFields(realm) };
  return checked;
}

function readDiscovered(value, travel) {
  const inferred = inferDiscovered(travel);
  if (value == null) return inferred;
  if (!isRecord(value)) throw new TravelError('发现记录不正确。');
  for (const key of Object.keys(value)) {
    if (!VISTA_IDS.includes(key)) throw new TravelError('发现记录不正确。');
  }
  const found = {};
  for (const id of VISTA_IDS) {
    if (!Object.hasOwn(value, id)) found[id] = inferred[id];
    else if (typeof value[id] !== 'boolean') throw new TravelError('发现记录不正确。');
    else found[id] = value[id];
  }
  return found;
}

function readKeepsakes(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > KEEPSAKE_IDS.length) throw new TravelError('纪念物记录不正确。');
  const kept = [];
  for (const id of value) {
    if (typeof id !== 'string' || !KEEPSAKE_IDS.includes(id) || kept.includes(id)) throw new TravelError('纪念物记录不正确。');
    kept.push(id);
  }
  return kept;
}

const RESTORE_IDS = new Set(['water', 'light', 'sky', 'all']);
const PLACE_IDS = new Set(['yard', 'garden', 'dock', 'balloon', 'observatory']);
const NUDGE_CHAPTERS = new Set(['prologue', 'ri', 'mei', 'xing', 'finale', 'festival', 'done']);

function readFlag(value) {
  if (value == null) return false;
  if (typeof value !== 'boolean') throw new TravelError('故事记录不正确。');
  return value;
}

function readPlaces(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 3) throw new TravelError('故事记录不正确。');
  const places = [];
  for (const id of value) {
    if (typeof id !== 'string' || places.includes(id)) throw new TravelError('故事记录不正确。');
    if (!PLACE_IDS.has(id) && !/^block-[1-9]\d*$/.test(id)) throw new TravelError('故事记录不正确。');
    places.push(id);
  }
  return places;
}

function readSite(value) {
  if (value == null) return null;
  if (!isRecord(value) || !Number.isInteger(value.x) || !Number.isInteger(value.z)) throw new TravelError('故事记录不正确。');
  if (value.x < -20 || value.x > 20 || value.z < -20 || value.z > 20) throw new TravelError('故事记录不正确。');
  return { x: value.x, z: value.z };
}

function readNudges(value) {
  const nudges = { vista: 0, bottle: 0, dock: 0, balloon: 0, stuck: 0, day: -1, last: '', chapter: 'prologue' };
  if (value == null) return nudges;
  if (!isRecord(value)) throw new TravelError('故事记录不正确。');
  for (const key of ['vista', 'bottle', 'dock', 'balloon', 'stuck']) {
    const count = value[key] ?? 0;
    if (!Number.isSafeInteger(count) || count < 0 || count > 1000) throw new TravelError('故事记录不正确。');
    nudges[key] = count;
  }
  const day = value.day ?? -1;
  if (!Number.isSafeInteger(day) || day < -1 || day > 1000000000) throw new TravelError('故事记录不正确。');
  nudges.day = day;
  const last = value.last ?? '';
  if (typeof last !== 'string' || last.length > 32) throw new TravelError('故事记录不正确。');
  nudges.last = last;
  const chapter = value.chapter ?? 'prologue';
  if (typeof chapter !== 'string' || !NUDGE_CHAPTERS.has(chapter)) throw new TravelError('故事记录不正确。');
  nudges.chapter = chapter;
  return nudges;
}

export function readStory(story) {
  const source = story ?? {};
  if (!isRecord(source)) throw new TravelError('故事记录不正确。');
  return {
    seen: idList(source.seen ?? [], '看过的故事', { limit: 64 }),
    letters: idList(source.letters ?? [], '信件', { limit: 32 }),
    restored: idList(source.restored ?? [], '恢复的地方', { known: RESTORE_IDS, limit: 8 }),
    fogIntro: readFlag(source.fogIntro),
    fogOff: readFlag(source.fogOff),
    hintsOff: readFlag(source.hintsOff),
    festival: readFlag(source.festival),
    homePlaces: readPlaces(source.homePlaces),
    nudges: readNudges(source.nudges),
    site: readSite(source.site),
  };
}

export function validateTravel(travel) {
  if (travel == null) {
    const fresh = defaultTravel();
    if (REALMS.mei?.playable) fresh.realms.mei = emptyRealm('mei');
    if (REALMS.xing?.playable) fresh.realms.xing = emptyRealm('xing');
    return fresh;
  }
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
  const story = readStory(travel.story ?? {});
  const gifts = travel.gifts ?? { given: [], received: [] };
  if (!isRecord(gifts)) throw new TravelError('礼物记录不正确。');
  const supplyAt = travel.supplyAt ?? 0;
  if (!Number.isSafeInteger(supplyAt) || supplyAt < 0 || supplyAt > LIFE_RULES.maxElapsed) {
    throw new TravelError('补给时间不正确。');
  }
  const realmsIn = travel.realms ?? {};
  if (!isRecord(realmsIn)) throw new TravelError('外谷记录不正确。');
  const realms = {};
  for (const id of Object.keys(realmsIn)) realms[id] = validateRealm(id, realmsIn[id]);
  if (!realms.mei && REALMS.mei?.playable) realms.mei = emptyRealm('mei');
  if (!realms.xing && REALMS.xing?.playable) realms.xing = emptyRealm('xing');
  if (current !== 'he' && !realms[current]) throw new TravelError('这一谷的记录丢了。', 'realm', current);
  return {
    schema: 1,
    current,
    via,
    visited,
    stamps,
    stickers,
    story,
    gifts: {
      given: idList(gifts.given ?? [], '送出的礼物', { limit: 64 }),
      received: idList(gifts.received ?? [], '收到的礼物', { limit: 64 }),
    },
    supplyAt,
    realms,
    discovered: readDiscovered(travel.discovered, { current, visited, realms: realmsIn }),
    keepsakes: readKeepsakes(travel.keepsakes),
  };
}

const HOME_NOTICE = '旅行记录有问题，已经回到河谷。家里的建筑和背包还在。';
const DOCK_NOTICE = '日谷的位置出了范围，已经回到码头。家里的建筑和背包还在。';
const PORT_NOTICE = '美谷的位置出了范围，已经回到港口。家里的建筑和背包还在。';

const LAWN_NOTICE = '外星谷的位置出了范围，已经回到热气球草坪。家里的建筑和背包还在。';

function placeNotice(realmId) {
  if (realmId === 'xing') return LAWN_NOTICE;
  return realmId === 'mei' ? PORT_NOTICE : DOCK_NOTICE;
}

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
        return { raw: copy, notice: placeNotice(error.realmId), code: 'position' };
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
    try { fresh.story = readStory({ ...(isRecord(src.story) ? src.story : {}), seen: fresh.story.seen, letters: fresh.story.letters }); }
    catch { /* keep the letters and the default picture flags */ }
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
    try { fresh.keepsakes = readKeepsakes(src.keepsakes); } catch { fresh.keepsakes = []; }
    fresh.discovered = inferDiscovered(fresh);
    copy.travel = fresh;
    return { raw: copy, notice: HOME_NOTICE, code: 'travel' };
  }
}
