/** Star-net changes on a valley save. Story light is never written here. */

import {
  FIELD_GRANTS,
  PUZZLE_GRANT_CAP,
  STAGE_LIGHT,
  defaultHolo,
  echoReport,
  grantStarlight,
  holoAge,
  raiseTier,
  recordGrowth,
  trimPath,
} from './holo-data.js';
import { DOME_HOME } from './xing-data.js';

function spotOf(state) {
  return state?.travel?.realms?.xing || null;
}

export function ensureHolo(state) {
  const spot = spotOf(state);
  if (!spot) return null;
  if (!spot.holo) spot.holo = defaultHolo();
  return spot.holo;
}

export function syncFieldStarlight(state) {
  const spot = spotOf(state);
  const holo = ensureHolo(state);
  if (!spot || !holo) return false;
  let changed = false;
  const stamps = state.travel?.stamps || [];
  if (stamps.includes('xing-crystal-first')) changed = grantStarlight(holo, 'field', 'crystal', FIELD_GRANTS.crystal) || changed;
  if (stamps.includes('xing-moss-seen') || (spot.claimed || []).includes('xing-moss-seen')) {
    changed = grantStarlight(holo, 'field', 'moss', FIELD_GRANTS.moss) || changed;
  }
  if ((spot.experiments || []).some((item) => item.kind === 'gravity')) {
    changed = grantStarlight(holo, 'field', 'gravity', FIELD_GRANTS.gravity) || changed;
  }
  let puzzles = 0;
  for (const id of spot.puzzles || []) {
    if (puzzles >= PUZZLE_GRANT_CAP) break;
    if (grantStarlight(holo, 'field', `puzzle:${id}`, FIELD_GRANTS.puzzle)) {
      changed = true;
      puzzles += 1;
    } else if (holo.grants.includes(`puzzle:${id}`)) puzzles += 1;
  }
  if (changed) raiseTier(holo);
  return changed;
}

export function noteStage(state, stageId, record) {
  const holo = ensureHolo(state);
  if (!holo) return { ok: false, report: null };
  const prev = holo.echo[stageId] || null;
  const next = {
    ms: Math.max(0, Math.round(record.ms || 0)),
    steps: Math.max(0, Math.round(record.steps || 0)),
    correct: record.ok ? 1 : Math.max(0, Math.round(record.correct || 0)),
    hints: Math.max(0, Math.round(record.hints || 0)),
    path: trimPath(record.path || []),
  };
  const report = echoReport(prev, next);
  holo.echo[stageId] = next;
  if (record.ok) {
    grantStarlight(holo, 'challenge', `stage:${stageId}`, STAGE_LIGHT);
    const zone = stageId.startsWith('shape') ? 'shape'
      : stageId.startsWith('force') ? 'force'
        : stageId.startsWith('chart') ? 'chart'
          : stageId.startsWith('code') ? 'code'
            : 'num';
    if (!Array.isArray(holo.zones[zone])) holo.zones[zone] = [];
    const lightEcho = stageId === 'num-echo' ? report.better : true;
    if (lightEcho && !holo.zones[zone].includes(stageId)) holo.zones[zone].push(stageId);
  }
  raiseTier(holo);
  return { ok: true, report, holo };
}

export function setAvatar(state, patch) {
  const holo = ensureHolo(state);
  if (!holo) return false;
  if (patch.glow && holo.unlocked.includes(`glow-${patch.glow}`)) holo.avatar.glow = patch.glow;
  if (patch.visor && holo.unlocked.includes(`visor-${patch.visor}`)) holo.avatar.visor = patch.visor;
  return true;
}

export function markWelcomed(state) {
  const holo = ensureHolo(state);
  if (!holo || holo.welcomed) return false;
  holo.welcomed = true;
  return true;
}

export function snapshotGrowth(state, now) {
  const holo = ensureHolo(state);
  if (!holo) return [];
  return recordGrowth(holo, now);
}

/** Writes the star shard on the alien valley only. Never touches travel.story. */
export function claimDome(state, choice, { tour = false, ageBand = null } = {}) {
  const spot = spotOf(state);
  if (!spot) return { ok: false, message: '先到外星谷的星网。' };
  if (spot.storyShard === true) return { ok: true, already: true, message: '星之片已经拿到了。', line: DOME_HOME };
  const senior = holoAge(ageBand) === 'older' && !tour;
  const picked = String(choice || '');
  if (senior) {
    if (picked !== 'north') return { ok: false, message: '这块在家的北边。再点一次方向。' };
  } else if (picked !== 'home') {
    return { ok: false, message: '点大星星，把这块补上。' };
  }
  spot.storyShard = true;
  ensureHolo(state);
  const stamps = state.travel?.stamps;
  if (Array.isArray(stamps) && !stamps.includes('xing-dome')) stamps.push('xing-dome');
  return { ok: true, shard: true, message: '穹顶补上了。深蓝石片里有会动的光点。', line: DOME_HOME };
}

export function noteTogether(state) {
  const holo = ensureHolo(state);
  if (!holo) return { ok: false, message: '先到外星谷的星网。' };
  const fresh = grantStarlight(holo, 'challenge', 'arena', STAGE_LIGHT);
  if (!Array.isArray(holo.zones.code)) holo.zones.code = [];
  if (!holo.zones.code.includes('code-together')) holo.zones.code.push('code-together');
  return { ok: true, fresh, message: '看台亮了。没有输赢，也没有排名。' };
}
