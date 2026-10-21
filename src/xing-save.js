/** Checks for the alien valley record. Home blocks and the garden cannot hold living fantasy. */

import { ITEMS } from './game-data.js';
import { GLYPH_IDS } from './glyph-data.js';
import { CRYSTAL_SECONDS, EXPERIMENT_LIMIT, crystalStage } from './experiment-lab.js';
import { QUARANTINE_NOTE } from './xing-data.js';

const ID_TEXT = /^[a-z0-9-]{1,64}$/;
const PUZZLE_ID = /^p-(little|bigger|older)-(pair|color|count|order)-[a-z0-9-]{1,24}$/;

export function isFantasyLiving(itemId) {
  const item = ITEMS[itemId];
  return Boolean(item && item.fantasy === true && item.living === true);
}

export function quarantineMessage(itemId) {
  return isFantasyLiving(itemId) ? QUARANTINE_NOTE : '';
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function readXingFields(realm) {
  const glyphs = realm.glyphs ?? [];
  const puzzles = realm.puzzles ?? [];
  const experiments = realm.experiments ?? [];
  if (!Array.isArray(glyphs) || glyphs.length > 32 || new Set(glyphs).size !== glyphs.length) {
    throw new Error('外星谷的符号记录不正确。');
  }
  for (const id of glyphs) {
    if (typeof id !== 'string' || !GLYPH_IDS.has(id)) throw new Error('外星谷的符号记录不正确。');
  }
  if (!Array.isArray(puzzles) || puzzles.length > 64 || new Set(puzzles).size !== puzzles.length) {
    throw new Error('外星谷的谜题记录不正确。');
  }
  for (const id of puzzles) {
    if (typeof id !== 'string' || !PUZZLE_ID.test(id)) throw new Error('外星谷的谜题记录不正确。');
  }
  if (!Array.isArray(experiments) || experiments.length > EXPERIMENT_LIMIT) {
    throw new Error('外星谷的实验记录不正确。');
  }
  const experimentIds = new Set();
  const nextExperiments = experiments.map((item) => {
    if (!isRecord(item) || typeof item.id !== 'string' || !ID_TEXT.test(item.id) || experimentIds.has(item.id)) {
      throw new Error('外星谷的实验记录不正确。');
    }
    if (item.kind !== 'gravity' && item.kind !== 'crystal') throw new Error('外星谷的实验记录不正确。');
    if (item.band !== 'little' && item.band !== 'bigger' && item.band !== 'older') throw new Error('外星谷的实验记录不正确。');
    const homeApex = item.homeApex ?? 0;
    const xingApex = item.xingApex ?? 0;
    if (!Number.isFinite(homeApex) || !Number.isFinite(xingApex) || homeApex < 0 || xingApex < 0 || homeApex > 100 || xingApex > 100) {
      throw new Error('外星谷的实验记录不正确。');
    }
    experimentIds.add(item.id);
    return { id: item.id, kind: item.kind, band: item.band, homeApex, xingApex };
  });
  return { glyphs: [...glyphs], puzzles: [...puzzles], experiments: nextExperiments };
}

export function readCrystal(proc) {
  if (!isRecord(proc) || proc.kind !== 'crystal' || proc.id !== 'crystal') return '外星谷的加工不正确。';
  if (typeof proc.saturated !== 'boolean') return '外星谷的加工不正确。';
  if (!Number.isInteger(proc.salt) || proc.salt < 1 || proc.salt > 4) return '外星谷的加工不正确。';
  if (!Number.isFinite(proc.elapsed) || proc.elapsed < 0 || proc.elapsed > CRYSTAL_SECONDS) return '外星谷的加工时间不正确。';
  const stage = crystalStage(proc.elapsed, proc.saturated);
  if (proc.stage !== stage) return '盐晶的步骤不一致。';
  return { id: 'crystal', kind: 'crystal', elapsed: proc.elapsed, stage, salt: proc.salt, saturated: proc.saturated };
}

export function homeHasFantasyLiving(save) {
  const blocks = Array.isArray(save?.blocks) ? save.blocks : [];
  if (blocks.some((block) => isFantasyLiving(block?.item))) return true;
  const garden = Array.isArray(save?.garden) ? save.garden : [];
  return garden.some((plot) => isFantasyLiving(plot?.crop) || isFantasyLiving(plot?.item) || isFantasyLiving(plot?.species));
}
