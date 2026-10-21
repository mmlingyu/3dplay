/** Project board rules: draw, make, try, change one thing. Results are fixed game tables. */

import { roofSpan } from './game-data.js';
import { MATERIAL_CAP, PROJECT_CARD_LIMIT } from './mei-data.js';

export const PROJECT_GOALS = Object.freeze([
  { id: 'windmill', name: '风车', icon: 'windmill' },
  { id: 'plane', name: '纸飞机', icon: 'plane' },
  { id: 'cabin', name: '原木小屋', icon: 'cabin' },
]);

const GOAL_IDS = new Set(PROJECT_GOALS.map((item) => item.id));

/**
 * Flight distance in game steps.
 * Columns: nose weight 0 light, 1 middle, 2 heavy.
 * Rows: wing angle 0 flat, 1 middle, 2 steep.
 * A middle nose and a middle wing fly farther. Too light, too heavy,
 * too flat, or too steep are shorter. This table is a game convention,
 * not an aerodynamic calculation.
 */
export const PLANE_DISTANCE = Object.freeze([
  Object.freeze([4, 8, 5]),
  Object.freeze([7, 14, 9]),
  Object.freeze([5, 9, 6]),
]);

const WINDMILL_TABLE = Object.freeze([
  Object.freeze([1, 2, 1]),
  Object.freeze([2, 4, 3]),
  Object.freeze([2, 5, 3]),
]);

const fail = (message) => ({ ok: false, message });
const ok = (message, extra = {}) => ({ ok: true, message, ...extra });

export function projectBand(ageBand) {
  if (ageBand === 'bigger' || ageBand === 'older') return ageBand;
  if (ageBand === 'senior' || ageBand === '9-12') return 'older';
  return 'little';
}

export function planeDistance(nose, wing) {
  const n = Number(nose);
  const w = Number(wing);
  if (![0, 1, 2].includes(n) || ![0, 1, 2].includes(w)) return null;
  return PLANE_DISTANCE[w][n];
}

/**
 * Blade rows and size columns are a game table.
 * Without wind and without the bellows, the wheel does not count as spinning.
 */
export function windmillSpin(blades, size, weatherKind, bellows) {
  const b = Number(blades);
  const s = Number(size);
  if (![0, 1, 2].includes(b) || ![0, 1, 2].includes(s)) return null;
  const powered = weatherKind === 'wind' || Boolean(bellows);
  if (!powered) return { spin: 0, spinning: false };
  const spin = WINDMILL_TABLE[b][s] + (weatherKind === 'wind' ? 2 : 0) + (bellows ? 2 : 0);
  return { spin, spinning: true };
}

export function cabinResult(blocks) {
  const list = Array.isArray(blocks) ? blocks : [];
  let enclosed = list.some((block) => block?.item === 'roof' && ((block.w || 1) > 1 || (block.d || 1) > 1));
  if (!enclosed) {
    for (const block of list) {
      if (!Number.isInteger(block?.x) || !Number.isInteger(block?.y) || !Number.isInteger(block?.z)) continue;
      const span = roofSpan(list, { x: block.x, y: block.y, z: block.z });
      if (span.enclosed) { enclosed = true; break; }
    }
  }
  return { enclosed, walls: list.filter((block) => block?.item === 'log-wall').length };
}

function defaultParts(goal) {
  if (goal === 'plane') return { nose: 1, wing: 1 };
  if (goal === 'windmill') return { blades: 1, size: 1 };
  return { walls: 4 };
}

function partKeys(goal) {
  if (goal === 'plane') return ['nose', 'wing'];
  if (goal === 'windmill') return ['blades', 'size'];
  return ['walls'];
}

export function sanitizeParts(goal, parts) {
  if (!parts || typeof parts !== 'object') return null;
  if (goal === 'plane') {
    const nose = Number(parts.nose);
    const wing = Number(parts.wing);
    if (![0, 1, 2].includes(nose) || ![0, 1, 2].includes(wing)) return null;
    return { nose, wing };
  }
  if (goal === 'windmill') {
    const blades = Number(parts.blades);
    const size = Number(parts.size);
    if (![0, 1, 2].includes(blades) || ![0, 1, 2].includes(size)) return null;
    return { blades, size };
  }
  if (goal === 'cabin') {
    const walls = Number(parts.walls);
    if (!Number.isInteger(walls) || walls < 0 || walls > 12) return null;
    return { walls };
  }
  return null;
}

export function startProject(projects, goal) {
  const list = Array.isArray(projects) ? projects : [];
  if (list.length >= PROJECT_CARD_LIMIT) return fail(`项目卡已经有 ${PROJECT_CARD_LIMIT} 张，先整理一下再画新的。`);
  if (!GOAL_IDS.has(goal)) return fail('先选风车、纸飞机或原木小屋。');
  const card = {
    id: `card-${list.length + 1}`,
    goal,
    parts: defaultParts(goal),
    trials: [],
    step: 'draw',
    skipped: false,
    done: false,
    used: 0,
  };
  return ok('选好目标了。再点部件，画到卡片上。不用写字。', { card, projects: [...list, card] });
}

export function drawProject(card, parts) {
  if (!card || card.done) return fail('这张卡已经完成了。');
  const next = sanitizeParts(card.goal, parts || card.parts);
  if (!next) return fail('点一点目标和部件。不用写字。');
  return ok('画好了。下一步去做部件。', { card: { ...card, parts: next, step: 'make' } });
}

export function makeProject(card, used = 0) {
  if (!card || card.done) return fail('这张卡已经完成了。');
  if (card.step === 'draw') return fail('先画目标和部件。');
  const count = Number.isInteger(used) && used >= 0 && used <= 99 ? used : 0;
  return ok('部件做好了。去试一试。', { card: { ...card, used: count, step: 'try' } });
}

function measure(card, extra) {
  if (card.goal === 'plane') {
    const distance = planeDistance(card.parts.nose, card.parts.wing);
    if (distance == null) return null;
    return { distance };
  }
  if (card.goal === 'windmill') {
    const spin = windmillSpin(card.parts.blades, card.parts.size, extra.weather, extra.bellows);
    if (!spin) return null;
    return spin;
  }
  if (card.goal === 'cabin') return cabinResult(extra.blocks);
  return null;
}

export function tryProject(card, extra = {}) {
  if (!card || card.done) return fail('这张卡已经完成了。');
  if (card.step !== 'try' && card.step !== 'change') return fail('先把部件做好，再试。');
  const result = measure(card, extra);
  if (!result) return fail('这一次还看不出结果。');
  const trials = [...card.trials, { parts: { ...card.parts }, result }];
  return ok('试过了。可以改一个地方再试，也可以完成。', { card: { ...card, trials, step: 'change' }, result });
}

export function changeProject(card, patch, band) {
  if (!card || card.done) return fail('这张卡已经完成了。');
  if (!card.trials.length) return fail('先试一次，再决定改哪里。');
  const age = projectBand(band);
  const next = sanitizeParts(card.goal, { ...card.parts, ...patch });
  if (!next) return fail('这个部件不对。');
  if (age === 'little') return ok('再试一次。', { card: { ...card, parts: next, step: 'try' } });
  const changed = partKeys(card.goal).filter((key) => next[key] !== card.parts[key]);
  if (changed.length !== 1) return fail('一次只改一个地方。');
  return ok('改好一个地方了。再试一次。', { card: { ...card, parts: next, step: 'try' }, changed: changed[0] });
}

export function skipProject(card) {
  if (!card || card.done) return fail('这张卡已经完成了。');
  if (!card.trials.length) return fail('先试一次，再决定要不要跳过修改。');
  return ok('跳过修改，项目完成了。', { card: { ...card, skipped: true, done: true, step: 'done' } });
}

export function finishProject(card) {
  if (!card || card.done) return fail('这张卡已经完成了。');
  if (!card.trials.length) return fail('先试一次再完成。');
  return ok('项目完成了。', { card: { ...card, done: true, step: 'done' } });
}

export function compareTrials(card) {
  const trials = card?.trials || [];
  if (trials.length < 2) return null;
  return { before: trials[trials.length - 2], after: trials[trials.length - 1] };
}

export function capNote(card, band) {
  if (projectBand(band) !== 'older' || !card) return '';
  const cap = MATERIAL_CAP[card.goal];
  if (!cap) return '';
  const over = card.used > cap;
  return over ? `木板用了 ${card.used} 块，超过了 ${cap} 块。可以再改一次。` : `木板不超过 ${cap} 块。这次用了 ${card.used} 块。`;
}

export function resultLine(goal, result) {
  if (!result) return '';
  if (goal === 'plane') return `飞了 ${result.distance} 步`;
  if (goal === 'windmill') return result.spinning ? `转速 ${result.spin}` : '还没转起来';
  return result.enclosed ? '屋子围好了' : '还没围好';
}

export { PROJECT_CARD_LIMIT };
