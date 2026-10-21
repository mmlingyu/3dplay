/** Star-net changes on a valley save. Story light is never written here. */

import {
  FIELD_GRANTS,
  PUZZLE_GRANT_CAP,
  STAGE_LIGHT,
  defaultHolo,
  echoReport,
  grantStarlight,
  raiseTier,
  recordGrowth,
  trimPath,
} from './holo-data.js';

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
    const lightEcho = stageId === 'num-echo' ? report.better : true;
    if (lightEcho && !holo.zones.num.includes(stageId)) holo.zones.num.push(stageId);
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
