/** Star-net rules. Pure data: no rendering, no storage. */

import { fromAlien, toAlien } from './glyph-data.js';

export const HOLO_TRANSITION_SECONDS = 3;
export const STAR_GATE = Object.freeze({ x: 2, z: -2 });
export const GATE_FRONT = Object.freeze({ x: 2, z: 0 });
export const ECHO_PATH_LIMIT = 120;
export const GROWTH_LIMIT = 12;
export const GRANT_LIMIT = 64;
export const ZONE_LIMIT = 8;

export const GLOW_COLORS = Object.freeze({
  cyan: { id: 'glow-cyan', name: '青', color: '#36E0E8', tier: 1 },
  amber: { id: 'glow-amber', name: '琥珀', color: '#FFB347', tier: 2 },
  purple: { id: 'glow-purple', name: '紫', color: '#9D7BFF', tier: 3 },
  white: { id: 'glow-white', name: '白', color: '#F4F7FF', tier: 4 },
  green: { id: 'glow-green', name: '绿', color: '#8EE0B0', tier: 5 },
});

export const VISORS = Object.freeze({
  clear: { id: 'visor-clear', name: '透明面罩' },
  half: { id: 'visor-half', name: '半罩' },
  goggles: { id: 'visor-goggles', name: '护目镜' },
});

export const HOLO_AUDIO = Object.freeze([
  'holo-zero-welcome',
  'holo-count',
  'holo-color-cyan',
  'holo-color-amber',
  'holo-color-purple',
  'holo-color-white',
  'holo-color-green',
  'holo-hint',
  'holo-tier',
  'holo-echo',
]);

export const WELCOME_LINE = '这里是星网，你的光的身体在这里。';

/** Cumulative starlight. Tier 4 and above need both challenge and field light. */
export const TIER_RULES = Object.freeze([
  Object.freeze({ tier: 1, total: 0, challenge: 0, field: 0, both: false }),
  Object.freeze({ tier: 2, total: 4, challenge: 0, field: 0, both: false }),
  Object.freeze({ tier: 3, total: 10, challenge: 0, field: 0, both: false }),
  Object.freeze({ tier: 4, total: 18, challenge: 4, field: 4, both: true }),
  Object.freeze({ tier: 5, total: 28, challenge: 8, field: 6, both: true }),
  Object.freeze({ tier: 6, total: 40, challenge: 12, field: 8, both: true }),
  Object.freeze({ tier: 7, total: 54, challenge: 16, field: 10, both: true }),
  Object.freeze({ tier: 8, total: 70, challenge: 20, field: 12, both: true }),
  Object.freeze({ tier: 9, total: 88, challenge: 24, field: 14, both: true }),
  Object.freeze({ tier: 10, total: 108, challenge: 28, field: 16, both: true }),
  Object.freeze({ tier: 11, total: 130, challenge: 32, field: 18, both: true }),
  Object.freeze({ tier: 12, total: 156, challenge: 36, field: 20, both: true }),
]);

export const FIELD_GRANTS = Object.freeze({
  crystal: 6,
  moss: 4,
  gravity: 6,
  puzzle: 2,
});

export const STAGE_LIGHT = 4;
export const PUZZLE_GRANT_CAP = 4;

const STAGE_IDS = new Set(['num-1', 'num-2', 'num-3', 'num-echo', 'shape-1', 'force-1', 'chart-1', 'code-1']);
const UNLOCK_IDS = new Set([
  ...Object.values(GLOW_COLORS).map((item) => item.id),
  ...Object.values(VISORS).map((item) => item.id),
]);

export function holoAge(ageBand) {
  return ageBand === 'older' || ageBand === 'senior' ? 'older' : 'young';
}

export function tierCap(ageBand) {
  return holoAge(ageBand) === 'older' ? 12 : 6;
}

export function tierLabel(tier, ageBand) {
  const cap = tierCap(ageBand);
  const stored = clampInt(tier, 1, 12);
  const shown = Math.min(stored, cap);
  if (shown >= cap) return `${cap} 阶（满）`;
  return `${shown} 阶`;
}

export function defaultHolo() {
  return {
    avatar: { visor: 'clear', glow: 'cyan', suit: null, back: null, mark: null },
    tier: 1,
    starlight: { challenge: 0, field: 0, story: 0 },
    grants: [],
    zones: { num: [] },
    echo: {},
    growth: [],
    unlocked: ['glow-cyan', 'visor-clear', 'visor-half', 'visor-goggles'],
    welcomed: false,
  };
}

export function stagePlan(ageBand) {
  if (holoAge(ageBand) === 'older') return Object.freeze(['calc', 'base4', 'path', 'echo']);
  return Object.freeze(['count', 'pair10', 'pair12', 'echo']);
}

function hashSeed(seed) {
  const text = String(seed ?? '0');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rng(seed) {
  let state = hashSeed(seed) || 1;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pick(rand, list) {
  return list[Math.floor(rand() * list.length)];
}

function shuffle(rand, list) {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function uniqueChoices(answer, extras) {
  const choices = [answer];
  for (const item of extras) {
    if (!choices.includes(item)) choices.push(item);
    if (choices.length === 4) break;
  }
  return choices;
}

function pairStage(rand, target, values) {
  const blocks = shuffle(rand, values);
  const pair = values.slice(0, 2).sort((a, b) => a - b);
  return {
    kind: target === 10 ? 'pair10' : 'pair12',
    target,
    blocks,
    answer: pair,
  };
}

export function domePlan(ageBand, tour = false) {
  if (holoAge(ageBand) === 'older' && !tour) {
    return {
      mode: 'dir',
      speak: '这块在家的北边。',
      prompt: '小咕说：这一块星星，我们只在你家的天空见过。按方向摆回北边。',
    };
  }
  return {
    mode: 'tap',
    speak: '这一块星星，和家里的夜空是同一张。点大星星，补上穹顶。',
    prompt: '穹顶缺了一块。点大星星，补上它。',
  };
}

export function arenaPlan(ageBand) {
  if (holoAge(ageBand) === 'older') {
    return {
      prompt: '你算 4，小咕算 5，零一算 6。合起来是多少？',
      choices: ['14', '15', '16'],
      answer: '15',
      speak: '三个人合在一起算。没有输赢。',
    };
  }
  return {
    prompt: '你有 3，小咕有 4，零一有 3。合起来是多少？',
    choices: ['7', '10', '12'],
    answer: '10',
    speak: '三个人合在一起算。没有输赢。',
  };
}

function zoneStage(age, stageId, seed) {
  const young = age !== 'older';
  const base = { id: stageId, age, seed: String(seed), echo: false, kind: 'pick' };
  if (stageId === 'shape-1') {
    return young
      ? { ...base, title: '形之阵', prompt: '找和缺口一样的形状。', speak: '找和缺口一样的星星。', choices: ['星星', '方块', '圆'], answer: '星星' }
      : { ...base, title: '形之阵', prompt: '俯视是 3 乘 2。这座平台有几块？', speak: '数一数有几块。', choices: ['4 块', '6 块', '9 块'], answer: '6 块' };
  }
  if (stageId === 'force-1') {
    return young
      ? { ...base, title: '力之台', prompt: '这里拉东西的力小一点。点跳得最高的一层。', speak: '这里跳得更高。点最高的那一层。', choices: ['一层', '三层'], answer: '三层' }
      : { ...base, title: '力之台', prompt: '地球上跳 0.5 米。这颗星的力大约是地球的 1/3，同样起跳大约跳多高？', speak: '先猜再看。这里跳得更高。', choices: ['0.5 米', '1.5 米', '3 米'], answer: '1.5 米' };
  }
  if (stageId === 'chart-1') {
    return young
      ? { ...base, title: '星图之路', prompt: '先认白天最亮的那个。', speak: '先认太阳，再认月亮。', choices: ['太阳', '月亮', '云'], answer: '太阳' }
      : { ...base, title: '星图之路', prompt: '1 光年大约有多远？', speak: '光年比太阳系大很多。', choices: ['大约 9 千米', '大约 9.46 万亿千米', '和月球一样远'], answer: '大约 9.46 万亿千米' };
  }
  if (stageId === 'code-1') {
    return young
      ? { ...base, title: '码之门', prompt: '按颜色排队。第一盏是哪一种？', speak: '按颜色排队。第一盏是青色。', choices: ['青', '琥珀', '紫'], answer: '青' }
      : { ...base, title: '码之门', prompt: '两盏灯，亮是 1，暗是 0。亮暗 是几？', speak: '亮暗，是二。', choices: ['1', '2', '3'], answer: '2' };
  }
  return null;
}

/** One seeded stage. The same seed always rebuilds the same question. */
export function makeStage(ageBand, stageId, seed = '0') {
  if (!STAGE_IDS.has(stageId)) throw new Error('这一关还不开放。');
  const zoned = zoneStage(holoAge(ageBand), stageId, seed);
  if (zoned) return zoned;
  const age = holoAge(ageBand);
  const plan = stagePlan(ageBand);
  const index = stageId === 'num-echo' ? 3 : Number(stageId.slice(4)) - 1;
  const kind = stageId === 'num-echo' ? plan[0] : plan[index];
  const rand = rng(`${seed}:${age}:${stageId}`);
  const base = { id: stageId, age, seed: String(seed), echo: stageId === 'num-echo' };
  if (kind === 'count') {
    const n = 1 + Math.floor(rand() * 20);
    return {
      ...base,
      kind,
      n,
      lamps: Math.min(24, n + 4),
      answer: n,
      title: '点亮修炼台',
      prompt: '数一数星棱身上的光点，点亮一样多的灯。',
      speak: '数一数光点，点亮一样多的灯。',
    };
  }
  if (kind === 'pair10' || kind === 'pair12') {
    const target = kind === 'pair10' ? 10 : 12;
    const values = kind === 'pair10' ? [2, 8, 1, 3, 4] : [5, 7, 3, 8];
    const made = pairStage(rand, target, values);
    return {
      ...base,
      ...made,
      title: kind === 'pair10' ? '凑十' : '给星舰加能量',
      prompt: kind === 'pair10' ? '抱起两块，凑成 10。' : '星舰需要 12 格。抱两块放进去。',
      speak: kind === 'pair10' ? '找两块，加起来是十。' : '找两块，加起来是十二。',
    };
  }
  if (kind === 'calc') {
    const multiply = rand() < 0.5;
    if (multiply) {
      const a = 2 + Math.floor(rand() * 8);
      const b = 2 + Math.floor(rand() * 8);
      const answer = a * b;
      return {
        ...base,
        kind,
        title: '能量计算',
        prompt: `${a} 组，每组 ${b} 格，一共多少格？`,
        speak: `${a} 乘 ${b}，一共多少格？`,
        answer,
        choices: shuffle(rand, uniqueChoices(answer, [answer + a, answer - b, answer + 10, answer - a].filter((n) => n > 0))),
      };
    }
    const divisor = 2 + Math.floor(rand() * 8);
    const quotient = 2 + Math.floor(rand() * 8);
    const remainder = Math.floor(rand() * divisor);
    const total = quotient * divisor + remainder;
    const answer = quotient;
    return {
      ...base,
      kind,
      title: '能量计算',
      prompt: `${total} 格，每份 ${divisor} 格，可以分成几份？还剩 ${remainder} 格。`,
      speak: `${total} 除以 ${divisor}，商是多少？还剩 ${remainder}。`,
      answer,
      remainder,
      choices: shuffle(rand, uniqueChoices(answer, [answer + 1, Math.max(1, answer - 1), answer + remainder + 1, divisor])),
    };
  }
  if (kind === 'base4') {
    const n = Math.floor(rand() * 40);
    const alien = toAlien(n);
    const toOurs = rand() < 0.5;
    if (toOurs) {
      const wrongs = [0, 1, 2, 3, 4, 5, 8, 15, 16].filter((item) => item !== n);
      return {
        ...base,
        kind,
        title: '外星的四进制',
        prompt: `小咕有四根手指。外星的 ${alien} 等于我们的几？`,
        speak: `外星写下 ${alien}。换成我们的数。外星的 10 等于我们的 4。`,
        answer: n,
        choices: shuffle(rand, uniqueChoices(n, wrongs)),
      };
    }
    const wrongAliens = [0, 1, 2, 3, 4, 5, 6, 7, 8, 15].map((item) => toAlien(item)).filter((item) => item !== alien);
    return {
      ...base,
      kind,
      title: '外星的四进制',
      prompt: `我们的 ${n}，用外星的四进制怎么写？`,
      speak: `我们的 ${n}，外星怎么写。外星的 10 等于我们的 4。`,
      answer: alien,
      choices: shuffle(rand, uniqueChoices(alien, wrongAliens)),
    };
  }
  const ox = Math.floor(rand() * 2);
  const oy = Math.floor(rand() * 2);
  const points = [[3 + ox, 2 + oy], [3 + ox, 6 + oy], [7 + ox, 6 + oy]];
  return {
    ...base,
    kind: 'path',
    title: '坐标导航',
    prompt: `按坐标走：${points.map((point) => `(${point[0]},${point[1]})`).join(' → ')}`,
    speak: '按坐标一步一步走，走到就点亮。',
    points,
    answer: points.map((point) => point.join(',')),
    grid: 8,
  };
}

export function stageAnswer(stage) {
  return stage.answer;
}

function samePair(left, right) {
  const a = [...left].sort((x, y) => x - y);
  const b = [...right].sort((x, y) => x - y);
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

export function gradeStage(stage, attempt) {
  if (!stage) return { ok: false, hint: '可以先离开，再回来。' };
  if (stage.kind === 'count') {
    const count = Array.isArray(attempt) ? attempt.length : Number(attempt);
    if (count === stage.answer) return { ok: true, hint: '' };
    return { ok: false, hint: count > stage.answer ? '灯亮得比光点多了。熄掉一盏再数。' : '再点一盏。跟着声音数。' };
  }
  if (stage.kind === 'pair10' || stage.kind === 'pair12') {
    const picked = Array.isArray(attempt) ? attempt.map(Number) : [];
    if (picked.length === 2 && samePair(picked, stage.answer)) return { ok: true, hint: '' };
    return { ok: false, hint: `找两块，加起来正好是 ${stage.target}。` };
  }
  if (stage.kind === 'pick' || stage.kind === 'calc' || stage.kind === 'base4') {
    if (String(attempt) === String(stage.answer)) return { ok: true, hint: '' };
    if (stage.kind === 'pick') return { ok: false, hint: '再点一次也没关系。' };
    if (stage.kind === 'base4') return { ok: false, hint: '小咕有四根手指。外星的 10 等于我们的 4。' };
    return { ok: false, hint: '再算一次。错了也不扣东西。' };
  }
  if (stage.kind === 'path') {
    const walked = Array.isArray(attempt) ? attempt.map((item) => (Array.isArray(item) ? item.join(',') : String(item))) : [];
    if (walked.length === stage.answer.length && walked.every((item, index) => item === stage.answer[index])) return { ok: true, hint: '' };
    const next = stage.points[walked.length] || stage.points[0];
    return { ok: false, hint: `下一格是 (${next[0]},${next[1]})。` };
  }
  return { ok: false, hint: '再试一次也没关系。' };
}

export function starTotal(holo) {
  const light = holo?.starlight || {};
  return (light.challenge || 0) + (light.field || 0) + (light.story || 0);
}

export function earnedTier(holo) {
  const total = starTotal(holo);
  const challenge = holo?.starlight?.challenge || 0;
  const field = holo?.starlight?.field || 0;
  let tier = 1;
  for (const rule of TIER_RULES) {
    if (rule.tier === 1) continue;
    if (total < rule.total) break;
    if (rule.both && (challenge < rule.challenge || field < rule.field)) break;
    tier = rule.tier;
  }
  return tier;
}

export function syncUnlocks(holo) {
  const have = new Set(holo.unlocked);
  for (const id of ['glow-cyan', 'visor-clear', 'visor-half', 'visor-goggles']) have.add(id);
  for (const glow of Object.values(GLOW_COLORS)) {
    if (holo.tier >= glow.tier) have.add(glow.id);
  }
  holo.unlocked = [...have];
  return holo.unlocked;
}

export function raiseTier(holo) {
  const next = earnedTier(holo);
  const before = holo.tier;
  if (next > holo.tier) holo.tier = next;
  syncUnlocks(holo);
  return holo.tier > before;
}

/** Returns true when this id grants light for the first time. Story stays unread. */
export function grantStarlight(holo, source, id, amount) {
  if (source === 'story') return false;
  if (source !== 'challenge' && source !== 'field') return false;
  if (!id || holo.grants.includes(id) || holo.grants.length >= GRANT_LIMIT) return false;
  const gain = Math.max(0, Math.round(amount));
  if (!gain) return false;
  holo.grants.push(id);
  holo.starlight[source] += gain;
  raiseTier(holo);
  return true;
}

export function echoReport(prev, next) {
  if (!prev) return { first: true, better: false, text: '这是你的第一次记录' };
  const bits = [];
  if ((next.correct || 0) > (prev.correct || 0)) bits.push(`这次比上次多做对了 ${next.correct - prev.correct} 题`);
  if ((next.hints || 0) < (prev.hints || 0)) bits.push(`这次少用了 ${prev.hints - next.hints} 次提示`);
  if ((prev.ms || 0) > 0 && (next.ms || 0) > 0 && next.ms < prev.ms) {
    const seconds = Math.max(1, Math.round((prev.ms - next.ms) / 1000));
    bits.push(`这次少用了 ${seconds} 秒`);
  }
  const better = (next.correct || 0) > (prev.correct || 0)
    || ((next.correct || 0) === (prev.correct || 0) && (next.hints || 0) < (prev.hints || 0))
    || ((next.correct || 0) === (prev.correct || 0) && (next.hints || 0) === (prev.hints || 0) && (prev.ms || 0) > 0 && next.ms < prev.ms);
  if (!bits.length) bits.push('这次和上次差不多。再试一次也没关系');
  return { first: false, better, text: bits.join('。') };
}

export function trimPath(points) {
  if (!Array.isArray(points)) return [];
  const kept = [];
  for (const point of points) {
    if (kept.length >= ECHO_PATH_LIMIT) break;
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) continue;
    kept.push({
      x: Math.round(point.x * 10) / 10,
      y: Math.round(point.y * 10) / 10,
      z: Math.round(point.z * 10) / 10,
    });
  }
  return kept;
}

export function recordGrowth(holo, now = Date.now()) {
  const week = Math.floor(Number(now) / (7 * 24 * 60 * 60 * 1000));
  if (!Number.isInteger(week)) return holo.growth;
  if (holo.growth.some((item) => item.week === week)) return holo.growth;
  holo.growth.push({
    week,
    count: Math.min(100, (holo.starlight.challenge || 0) * 4),
    shape: 0,
    force: Math.min(100, (holo.starlight.field || 0) * 4),
    chart: 0,
    code: 0,
  });
  if (holo.growth.length > GROWTH_LIMIT) holo.growth.splice(0, holo.growth.length - GROWTH_LIMIT);
  return holo.growth;
}

export function growthPair(holo, now = Date.now()) {
  const week = Math.floor(Number(now) / (7 * 24 * 60 * 60 * 1000));
  const list = holo?.growth || [];
  const current = list.filter((item) => item.week <= week).slice(-1)[0] || null;
  const past = list.filter((item) => item.week <= week - 1).slice(-1)[0] || null;
  return { past, current };
}

export function glowById(id) {
  return Object.values(GLOW_COLORS).find((item) => item.id === id || item.name === id) || null;
}

export function glowName(key) {
  return GLOW_COLORS[key]?.name || '';
}

/** Device hint kept for tests. The valley default is fast unless a save says fine. */
export function inferQuality({ pointerCoarse = false, maxTouchPoints = 0, shortSide = 0 } = {}) {
  const touch = pointerCoarse === true || Number(maxTouchPoints) > 1;
  const side = Number(shortSide);
  if (touch && (!Number.isFinite(side) || side === 0 || side <= 1200)) return 'fast';
  return 'fine';
}

export function resolveQuality(chosen) {
  if (chosen === 'fine') return 'fine';
  return 'fast';
}

export function dotMarks(count) {
  const n = Math.max(0, Math.min(20, Math.round(Number(count) || 0)));
  return '●'.repeat(n);
}

function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isInteger(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function roundTripAlien(value) {
  return fromAlien(toAlien(value));
}

export const HOLO_PADS = Object.freeze([
  Object.freeze({ id: 'hall', x: 0, z: 0, y: 2, play: true, stage: '' }),
  Object.freeze({ id: 'num-1', x: 5.2, z: 2.2, y: 4.6, play: true, stage: 'num-1' }),
  Object.freeze({ id: 'num-2', x: 8.6, z: 6.4, y: 7.2, play: true, stage: 'num-2' }),
  Object.freeze({ id: 'num-3', x: 4.4, z: 10.6, y: 9.8, play: true, stage: 'num-3' }),
  Object.freeze({ id: 'num-echo', x: -1.2, z: 12.4, y: 12.2, play: true, stage: 'num-echo' }),
  Object.freeze({ id: 'shape', x: -14, z: 6, y: 20, play: false, stage: '' }),
  Object.freeze({ id: 'force', x: -16, z: -4, y: 24, play: false, stage: '' }),
  Object.freeze({ id: 'chart', x: 2, z: -16, y: 28, play: false, stage: '' }),
  Object.freeze({ id: 'code', x: 16, z: -8, y: 32, play: false, stage: '' }),
]);
