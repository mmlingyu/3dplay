/** Optional star-net record on the alien valley. Missing fields become defaults. */

import {
  ECHO_PATH_LIMIT,
  GLOW_COLORS,
  GRANT_LIMIT,
  GROWTH_LIMIT,
  VISORS,
  ZONE_LIMIT,
  defaultHolo,
} from './holo-data.js';

const ID_TEXT = /^[a-z0-9:-]{1,64}$/;
const MARK_TEXT = /^[a-z0-9-]{1,32}$/;
const STAGE_TEXT = /^(num|shape|force|chart|code)-[a-z0-9-]{1,24}$/;
const GLOW_KEYS = new Set(Object.keys(GLOW_COLORS));
const VISOR_KEYS = new Set(Object.keys(VISORS));
const UNLOCK_IDS = new Set([
  ...Object.values(GLOW_COLORS).map((item) => item.id),
  ...Object.values(VISORS).map((item) => item.id),
]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function copyDefault() {
  return defaultHolo();
}

function readOptionalId(value, label) {
  if (value == null) return null;
  if (typeof value !== 'string' || !MARK_TEXT.test(value)) throw new Error(`${label}不正确。`);
  return value;
}

function readCount(value, label, max) {
  if (!Number.isInteger(value) || value < 0 || value > max) throw new Error(`${label}不正确。`);
  return value;
}

function readPath(value) {
  if (!Array.isArray(value) || value.length > ECHO_PATH_LIMIT) throw new Error('星网的路线太长。');
  return value.map((point) => {
    if (!isRecord(point) || ![point.x, point.y, point.z].every(Number.isFinite)) throw new Error('星网的坐标不正确。');
    if (point.x < -80 || point.x > 80 || point.z < -80 || point.z > 80 || point.y < -5 || point.y > 80) {
      throw new Error('星网的坐标不正确。');
    }
    return {
      x: Math.round(point.x * 10) / 10,
      y: Math.round(point.y * 10) / 10,
      z: Math.round(point.z * 10) / 10,
    };
  });
}

export function readHolo(realm) {
  if (!isRecord(realm) || realm.holo == null) return copyDefault();
  const holo = realm.holo;
  if (!isRecord(holo)) throw new Error('星网记录不正确。');
  const avatarIn = holo.avatar ?? {};
  if (!isRecord(avatarIn)) throw new Error('星网的化身不正确。');
  const visor = avatarIn.visor ?? 'clear';
  const glow = avatarIn.glow ?? 'cyan';
  if (!VISOR_KEYS.has(visor)) throw new Error('星网的面罩不正确。');
  if (!GLOW_KEYS.has(glow)) throw new Error('星网的化身颜色不正确。');
  const avatar = {
    visor,
    glow,
    suit: readOptionalId(avatarIn.suit ?? null, '星网的外骨骼'),
    back: readOptionalId(avatarIn.back ?? null, '星网的背件'),
    mark: readOptionalId(avatarIn.mark ?? null, '星网的印记'),
  };
  const tier = holo.tier ?? 1;
  if (!Number.isInteger(tier) || tier < 1 || tier > 12) throw new Error('星网的星阶不正确。');
  const light = holo.starlight ?? {};
  if (!isRecord(light)) throw new Error('星光记录不正确。');
  const starlight = {
    challenge: readCount(light.challenge ?? 0, '星光记录', 100000),
    field: readCount(light.field ?? 0, '星光记录', 100000),
    story: readCount(light.story ?? 0, '星光记录', 100000),
  };
  const grantsIn = holo.grants ?? [];
  if (!Array.isArray(grantsIn) || grantsIn.length > GRANT_LIMIT || new Set(grantsIn).size !== grantsIn.length) {
    throw new Error('星光记录不正确。');
  }
  const grants = grantsIn.map((id) => {
    if (typeof id !== 'string' || !ID_TEXT.test(id)) throw new Error('星光记录不正确。');
    return id;
  });
  const zonesIn = holo.zones ?? {};
  if (!isRecord(zonesIn)) throw new Error('星网的星区不正确。');
  for (const key of Object.keys(zonesIn)) {
    if (key !== 'num' && key !== 'shape' && key !== 'force' && key !== 'chart' && key !== 'code') {
      throw new Error('星网的星区不正确。');
    }
  }
  const readZone = (key) => {
    const list = zonesIn[key] ?? [];
    if (!Array.isArray(list) || list.length > ZONE_LIMIT || new Set(list).size !== list.length) throw new Error('星网的星区不正确。');
    return list.map((id) => {
      if (typeof id !== 'string' || !STAGE_TEXT.test(id)) throw new Error('星网的星区不正确。');
      return id;
    });
  };
  const zones = { num: readZone('num') };
  for (const key of ['shape', 'force', 'chart', 'code']) {
    if (zonesIn[key]) zones[key] = readZone(key);
  }
  const echoIn = holo.echo ?? {};
  if (!isRecord(echoIn) || Object.keys(echoIn).length > 16) throw new Error('星网的回声不正确。');
  const echo = {};
  for (const [key, value] of Object.entries(echoIn)) {
    if (!STAGE_TEXT.test(key) || !isRecord(value)) throw new Error('星网的回声不正确。');
    const ms = value.ms ?? 0;
    const steps = value.steps ?? 0;
    const correct = value.correct ?? 0;
    const hints = value.hints ?? 0;
    if (!Number.isInteger(ms) || ms < 0 || ms > 3600000) throw new Error('星网的回声不正确。');
    if (!Number.isInteger(steps) || steps < 0 || steps > 1000) throw new Error('星网的回声不正确。');
    if (!Number.isInteger(correct) || correct < 0 || correct > 1000) throw new Error('星网的回声不正确。');
    if (!Number.isInteger(hints) || hints < 0 || hints > 1000) throw new Error('星网的回声不正确。');
    echo[key] = { ms, steps, correct, hints, path: readPath(value.path ?? []) };
  }
  const growthIn = holo.growth ?? [];
  if (!Array.isArray(growthIn) || growthIn.length > GROWTH_LIMIT) throw new Error('星网的成长记录不正确。');
  const weeks = new Set();
  const growth = growthIn.map((item) => {
    if (!isRecord(item) || !Number.isInteger(item.week) || item.week < 0 || item.week > 200000 || weeks.has(item.week)) {
      throw new Error('星网的成长记录不正确。');
    }
    weeks.add(item.week);
    const axis = (name) => {
      const n = item[name] ?? 0;
      if (!Number.isInteger(n) || n < 0 || n > 100) throw new Error('星网的成长记录不正确。');
      return n;
    };
    return { week: item.week, count: axis('count'), shape: axis('shape'), force: axis('force'), chart: axis('chart'), code: axis('code') };
  });
  const unlockedIn = holo.unlocked ?? copyDefault().unlocked;
  if (!Array.isArray(unlockedIn) || unlockedIn.length > 24 || new Set(unlockedIn).size !== unlockedIn.length) {
    throw new Error('星网的解锁不正确。');
  }
  const unlocked = unlockedIn.map((id) => {
    if (typeof id !== 'string' || !UNLOCK_IDS.has(id)) throw new Error('星网的解锁不正确。');
    return id;
  });
  for (const id of ['glow-cyan', 'visor-clear', 'visor-half', 'visor-goggles']) {
    if (!unlocked.includes(id)) unlocked.push(id);
  }
  const welcomed = holo.welcomed === true;
  return { avatar, tier, starlight, grants, zones, echo, growth, unlocked, welcomed };
}
