/** Checks for fields that live only inside travel.realms.mei. */

import { PUMPKIN_FACES } from './mei-data.js';
import { PROJECT_CARD_LIMIT, PROJECT_GOALS, sanitizeParts } from './project-board.js';

const GOAL_IDS = new Set(PROJECT_GOALS.map((item) => item.id));
const FACE_IDS = new Set(PUMPKIN_FACES.map((item) => item.id));
const STEPS = new Set(['draw', 'make', 'try', 'change', 'done']);
const ID_TEXT = /^card-[1-9]\d*$/;

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function fail(message) {
  const error = new Error(message);
  error.travel = true;
  error.code = 'realm';
  error.realmId = 'mei';
  return error;
}

function readTrial(goal, trial) {
  if (!isRecord(trial) || !isRecord(trial.parts) || !isRecord(trial.result)) throw fail('美谷的试验结果不正确。');
  const parts = sanitizeParts(goal, trial.parts);
  if (!parts) throw fail('美谷的试验部件不正确。');
  const result = trial.result;
  if (goal === 'plane') {
    if (!Number.isInteger(result.distance) || result.distance < 0 || result.distance > 99) throw fail('美谷的飞行记录不正确。');
    return { parts, result: { distance: result.distance } };
  }
  if (goal === 'windmill') {
    if (!Number.isInteger(result.spin) || result.spin < 0 || result.spin > 99 || typeof result.spinning !== 'boolean') {
      throw fail('美谷的风车记录不正确。');
    }
    return { parts, result: { spin: result.spin, spinning: result.spinning } };
  }
  if (typeof result.enclosed !== 'boolean' || !Number.isInteger(result.walls) || result.walls < 0 || result.walls > 99) {
    throw fail('美谷的小屋记录不正确。');
  }
  return { parts, result: { enclosed: result.enclosed, walls: result.walls } };
}

export function validateMeiFields(realm) {
  const projectsIn = realm.projects ?? [];
  if (!Array.isArray(projectsIn) || projectsIn.length > PROJECT_CARD_LIMIT) throw fail('美谷的项目卡太多了。');
  const ids = new Set();
  const projects = projectsIn.map((card) => {
    if (!isRecord(card) || typeof card.id !== 'string' || !ID_TEXT.test(card.id) || ids.has(card.id)) throw fail('美谷的项目卡不正确。');
    if (!GOAL_IDS.has(card.goal) || !STEPS.has(card.step) || typeof card.skipped !== 'boolean' || typeof card.done !== 'boolean') {
      throw fail('美谷的项目卡不正确。');
    }
    const parts = sanitizeParts(card.goal, card.parts);
    if (!parts) throw fail('美谷的项目部件不正确。');
    if (!Number.isInteger(card.used) || card.used < 0 || card.used > 99) throw fail('美谷的材料记录不正确。');
    if (!Array.isArray(card.trials) || card.trials.length > 12) throw fail('美谷的试验次数不正确。');
    ids.add(card.id);
    return {
      id: card.id,
      goal: card.goal,
      parts,
      trials: card.trials.map((trial) => readTrial(card.goal, trial)),
      step: card.step,
      skipped: card.skipped,
      done: card.done,
      used: card.used,
    };
  });
  const tradesIn = realm.trades ?? [];
  if (!Array.isArray(tradesIn) || tradesIn.length > 32) throw fail('美谷的交换记录不正确。');
  const trades = tradesIn.map((trade) => {
    if (!isRecord(trade) || typeof trade.id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(trade.id)) throw fail('美谷的交换记录不正确。');
    if (!Number.isInteger(trade.count) || trade.count < 1 || trade.count > 999) throw fail('美谷的交换次数不正确。');
    return { id: trade.id, count: trade.count };
  });
  const decorIn = realm.decor ?? {};
  if (!isRecord(decorIn)) throw fail('美谷的装饰记录不正确。');
  const face = decorIn.face ?? 'smile';
  if (!FACE_IDS.has(face)) throw fail('美谷的南瓜灯表情不正确。');
  return { projects, trades, decor: { face } };
}
