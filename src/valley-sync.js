import { DAMAGED_BACKUP_KEY, LAND_BACKUP_KEY, LIFE_BACKUP_KEY, TRAVEL_BACKUP_KEY } from './game-data.js';
import { createInitialState, salvageSave } from './game-state.js';
import { staticPreviewEnabled } from './static-preview.js';

export const OWNER_KEY = 'yuanyuan-river-valley-owner';
const BACKUP_KEYS = [DAMAGED_BACKUP_KEY, LIFE_BACKUP_KEY, LAND_BACKUP_KEY, TRAVEL_BACKUP_KEY];

function inventoryDistance(save) {
  const starter = createInitialState().inventory;
  const inventory = save.inventory || {};
  const items = new Set([...Object.keys(starter), ...Object.keys(inventory)]);
  let delta = 0;
  for (const item of items) delta += Math.abs((inventory[item] || 0) - (starter[item] || 0));
  const chests = save.chests || {};
  for (const box of Object.values(chests)) {
    if (!box || typeof box !== 'object') continue;
    delta += Object.values(box).reduce((sum, count) => sum + (Number(count) || 0), 0);
  }
  return delta;
}

export function personalScore(save) {
  if (!save || save.version !== 1) return -1;
  const creation = save.creation || {};
  const stats = save.stats || {};
  return (creation.figures?.length || 0) * 100
    + (creation.assemblies?.length || 0) * 40
    + (creation.blueprints?.length || 0) * 10
    + (creation.drafts?.length || 0) * 5
    + (Array.isArray(save.blocks) ? save.blocks.length : 0) * 20
    + inventoryDistance(save)
    + (stats.built || 0) + (stats.crafted || 0) + (stats.gathered || 0);
}

// Remote is this account's space. A browser copy is used only when it belongs
// to the same account (or has never been claimed) and holds more of their work.
export function chooseSpace({ userId, ownerId, remote, local, backups = [] }) {
  if (!userId) return { source: 'guest', save: null };
  const remoteScore = personalScore(remote);
  const ownedHere = !ownerId || ownerId === userId;
  let best = null;
  let bestScore = -1;
  let bestSource = 'local';
  if (ownedHere) {
    const list = [{ source: 'local', save: local }, ...backups.map(save => ({ source: 'backup', save }))];
    for (const item of list) {
      const score = personalScore(item.save);
      if (score > bestScore) {
        best = item.save;
        bestScore = score;
        bestSource = item.source;
      }
    }
  }
  if (ownerId === userId) {
    if (bestScore > remoteScore) return { source: bestSource, save: best };
    if (remoteScore >= 0) return { source: 'remote', save: remote };
    if (best) return { source: bestSource, save: best };
    return { source: 'fresh', save: null };
  }
  if (remoteScore >= 0) {
    if (!ownerId && bestScore > remoteScore) return { source: bestSource, save: best };
    return { source: 'remote', save: remote };
  }
  if (!ownerId && best) return { source: bestSource, save: best };
  return { source: 'fresh', save: null };
}

export function readSaveText(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  try { return salvageSave(JSON.parse(text)); }
  catch { return null; }
}

async function fetchValley() {
  if (staticPreviewEnabled()) return { signedOut: true };
  const response = await fetch('/api/valley', { credentials: 'same-origin' });
  if (response.status === 401) return { signedOut: true };
  if (!response.ok) throw new Error('valley');
  return response.json();
}

async function putValley(save) {
  if (staticPreviewEnabled()) return;
  const response = await fetch('/api/valley', {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(save),
  });
  if (!response.ok) throw new Error('valley-put');
}

export function startValleySync(game) {
  let userId = null;
  let timer = null;
  let writing = false;
  let ready = false;

  function backupSaves() {
    const texts = [];
    for (const key of BACKUP_KEYS) {
      try {
        const text = game.storage?.getItem(key);
        if (text) texts.push(text);
      } catch { /* ignore a backup the browser will not read */ }
    }
    if (typeof game.damagedSaveText === 'string') texts.push(game.damagedSaveText);
    return texts.map(readSaveText).filter(Boolean);
  }

  async function flush() {
    if (staticPreviewEnabled() || !userId) return false;
    clearTimeout(timer);
    writing = true;
    try {
      await putValley(JSON.parse(game.exportSave()));
      return true;
    } catch {
      return false;
    } finally {
      writing = false;
    }
  }

  function schedule() {
    if (!ready || !userId || writing) return;
    clearTimeout(timer);
    timer = setTimeout(() => { flush(); }, 700);
  }

  game.subscribe(() => schedule());
  const saveLocal = game.save.bind(game);
  game.save = () => {
    const result = saveLocal();
    schedule();
    return result;
  };

  async function bind(user) {
    if (staticPreviewEnabled()) return { changed: false, source: 'local' };
    const next = user?.id || null;
    if (next === userId && (ready || !next)) return { changed: false };
    if (userId) await flush();
    const previousOwner = (() => { try { return game.storage?.getItem(OWNER_KEY) || null; } catch { return null; } })();
    userId = next;
    game.accountId = next;
    ready = false;
    if (!next) return { changed: true, source: 'guest' };
    let remote = null;
    try {
      const body = await fetchValley();
      if (body?.signedOut) {
        userId = null;
        game.accountId = null;
        return { changed: true, source: 'guest' };
      }
      remote = body?.save ? readSaveText(JSON.stringify(body.save)) : null;
    } catch {
      userId = null;
      game.accountId = null;
      return { changed: true, source: 'offline' };
    }
    const local = readSaveText(game.exportSave());
    const choice = chooseSpace({
      userId: next,
      ownerId: previousOwner,
      remote,
      local,
      backups: backupSaves(),
    });
    writing = true;
    let applied = choice.source;
    let claimed = choice.source === 'local';
    try {
      if (choice.source === 'fresh') {
        const result = game.importSave(JSON.stringify(createInitialState()));
        claimed = result.ok;
      } else if (choice.source !== 'local' && choice.save) {
        const result = game.importSave(JSON.stringify(choice.save));
        claimed = result.ok;
      }
      if (claimed) {
        try { game.storage?.setItem(OWNER_KEY, next); } catch { /* the account copy is still written below */ }
      }
    } finally {
      writing = false;
    }
    if (!claimed) {
      userId = null;
      game.accountId = null;
      return { changed: true, source: 'offline' };
    }
    ready = true;
    const saved = await flush();
    return { changed: true, source: applied, saved, switched: Boolean(previousOwner && previousOwner !== next) };
  }

  return { bind, flush };
}
