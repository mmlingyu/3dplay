import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GameState, createInitialState } from '../src/game-state.js';
import { MEI3_BACKUP_KEY, STORAGE_KEY } from '../src/game-data.js';
import { meiAgeBand, litStarCount, projectorStatus } from '../src/mei-lot.js';

class MemoryStorage {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, value); }
}

function oldMeiSave() {
  const save = createInitialState();
  delete save.travel.realms.mei.storyShard;
  delete save.travel.realms.mei.projector;
  delete save.travel.realms.mei.films;
  delete save.travel.realms.mei.premiere;
  save.inventory.wood = 4;
  return save;
}

test('还没有光之片字段的美谷档只备份一次到 before-mei3', () => {
  const save = oldMeiSave();
  const text = JSON.stringify(save);
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, text);
  const game = new GameState(storage);
  assert.equal(game.state.travel.realms.mei.storyShard, false);
  assert.equal(game.state.inventory.wood, 4);
  game.save();
  assert.equal(storage.getItem(MEI3_BACKUP_KEY), text);
  assert.equal(storage.getItem(`${MEI3_BACKUP_KEY}-1`), null);
  game.save();
  assert.equal(storage.getItem(`${MEI3_BACKUP_KEY}-1`), null);
  const again = new GameState(storage);
  again.save();
  assert.equal(storage.getItem(`${MEI3_BACKUP_KEY}-1`), null);
  assert.equal(again.state.travel.realms.mei.storyShard, false);
});

test('光之片不是布尔时整份拒绝，名次不会留在片子里', () => {
  const game = new GameState(new MemoryStorage());
  const before = game.exportSave();
  const bad = JSON.parse(before);
  bad.travel.realms.mei.storyShard = 'yes';
  assert.equal(game.importSave(JSON.stringify(bad)).ok, false);
  assert.equal(game.exportSave(), before);
  const ranked = JSON.parse(before);
  ranked.travel.realms.mei.films = [{ id: 'film-1', kind: 'photo', frames: ['star'], shot: 'wide', subject: 'star', rank: 1 }];
  assert.equal(game.importSave(JSON.stringify(ranked)).ok, true);
  assert.equal(game.state.travel.realms.mei.films[0].rank, undefined);
  assert.equal(game.state.travel.realms.mei.films[0].kind, 'photo');
});

test('没有序章也能修好放映机，不改 travel.story', () => {
  const game = new GameState(new MemoryStorage());
  game.state.travel.current = 'mei';
  const story = JSON.parse(JSON.stringify(game.state.travel.story));
  assert.equal(game.fixMeiProjector().ok, false);
  assert.equal(game.state.travel.realms.mei.storyShard, false);
  game.state.travel.realms.mei.projector = { gear: true, lens: true, lamp: true };
  const result = game.fixMeiProjector();
  assert.equal(result.ok, true);
  assert.equal(game.state.travel.realms.mei.storyShard, true);
  assert.ok(game.state.travel.stamps.includes('mei-premiere'));
  assert.deepEqual(game.state.travel.story, story);
  assert.equal(Object.hasOwn(game.state.travel.story, 'shard'), false);
});

test('家长体验只缺灯，年龄档在美谷本地分成两档', () => {
  const realm = { projector: { gear: false, lens: false, lamp: false }, storyShard: false };
  assert.deepEqual(projectorStatus(realm, true).missing, ['lamp']);
  assert.deepEqual(projectorStatus(realm, false).missing, ['gear', 'lens', 'lamp']);
  assert.equal(meiAgeBand(null), 'junior');
  assert.equal(meiAgeBand('little'), 'junior');
  assert.equal(meiAgeBand('bigger'), 'junior');
  assert.equal(meiAgeBand('junior'), 'junior');
  assert.equal(meiAgeBand('older'), 'senior');
  assert.equal(meiAgeBand('senior'), 'senior');
  assert.equal(meiAgeBand('9-12'), 'senior');
  assert.equal(litStarCount(['mei-arrive', 'vista-mei', 'ri-arrive']), 2);
  assert.equal(litStarCount(Array.from({ length: 20 }, (_, index) => `mei-${index}`)), 8);
});

test('美谷自己读 tour=1，河谷故事仍用独立的 tour 存档', () => {
  const source = readFileSync(new URL('../src/mei-lot.js', import.meta.url), 'utf8');
  assert.match(source, /new URLSearchParams\(location\.search\)\.get\('tour'\) === '1'/);
  assert.doesNotMatch(source, /tour-mode/);
  const tour = readFileSync(new URL('../src/tour-mode.js', import.meta.url), 'utf8');
  assert.match(tour, /yuanyuan-river-valley-v1-tour/);
});
