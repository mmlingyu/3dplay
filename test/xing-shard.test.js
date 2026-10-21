import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/game-state.js';
import { STORAGE_KEY, XING_SHARD_BACKUP_KEY } from '../src/game-data.js';
import { arenaPlan, domePlan, gradeStage, makeStage } from '../src/holo-data.js';

class MemoryStorage {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, String(value)); }
}

function inXing(storage = new MemoryStorage()) {
  const game = new GameState(storage);
  const trip = game.beginTravel('xing', 'balloon');
  assert.equal(trip.ok, true);
  return game;
}

test('体验模式点一次就写下星之片，不改河谷故事', () => {
  const storage = new MemoryStorage();
  const game = inXing(storage);
  game.save();
  const before = JSON.stringify(game.state.travel.story);
  const result = game.claimXingShard('home', { tour: true, ageBand: 'senior' });
  assert.equal(result.ok, true);
  assert.equal(result.shard, true);
  assert.equal(game.state.travel.realms.xing.storyShard, true);
  assert.equal(game.state.travel.stamps.includes('xing-dome'), true);
  assert.equal(JSON.stringify(game.state.travel.story), before);
  assert.equal((game.state.travel.story.restored || []).includes('sky'), false);
  const again = game.claimXingShard('home', { tour: true });
  assert.equal(again.already, true);
  const backup = game.getXingShardBackup();
  assert.equal(typeof backup, 'string');
  assert.equal(JSON.parse(backup).travel.realms.xing.storyShard === true, false);
  assert.equal(storage.getItem(XING_SHARD_BACKUP_KEY), backup);
  const loaded = new GameState(storage);
  assert.equal(loaded.state.travel.realms.xing.storyShard, true);
  assert.equal(loaded.state.travel.stamps.includes('xing-dome'), true);
});

test('9 到 12 岁要点对北边，点错不写碎片', () => {
  const game = inXing();
  const missed = game.claimXingShard('east', { tour: false, ageBand: 'senior' });
  assert.equal(missed.ok, false);
  assert.equal(game.state.travel.realms.xing.storyShard === true, false);
  const placed = game.claimXingShard('north', { tour: false, ageBand: 'senior' });
  assert.equal(placed.ok, true);
  assert.equal(game.state.travel.realms.xing.storyShard, true);
});

test('星区和擂台可以记下，旧档没有碎片字段也能读', () => {
  const storage = new MemoryStorage();
  const game = inXing(storage);
  const shape = makeStage('junior', 'shape-1', 'seed');
  assert.equal(shape.kind, 'pick');
  assert.equal(gradeStage(shape, shape.answer).ok, true);
  assert.equal(gradeStage(shape, '方块').ok, false);
  const older = makeStage('senior', 'force-1', 'seed');
  assert.equal(older.answer, '1.5 米');
  assert.equal(domePlan('junior', false).mode, 'tap');
  assert.equal(domePlan('senior', false).mode, 'dir');
  assert.equal(domePlan('senior', true).mode, 'tap');
  assert.equal(arenaPlan('junior').answer, '10');
  game.noteHoloStage('shape-1', { ok: true, ms: 20, steps: 1, correct: 1, hints: 0, path: [] });
  const together = game.noteHoloTogether();
  assert.equal(together.ok, true);
  assert.equal(game.state.travel.realms.xing.holo.zones.shape.includes('shape-1'), true);
  assert.equal(game.state.travel.realms.xing.holo.zones.code.includes('code-together'), true);
  const raw = JSON.parse(storage.getItem(STORAGE_KEY));
  delete raw.travel.realms.xing.storyShard;
  storage.setItem(STORAGE_KEY, JSON.stringify(raw));
  const kept = new GameState(storage);
  assert.equal(Object.hasOwn(kept.state.travel.realms.xing, 'storyShard'), false);
  assert.equal(kept.state.travel.realms.xing.holo.zones.shape.includes('shape-1'), true);
});
