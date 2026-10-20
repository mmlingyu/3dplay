import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState, createInitialState } from '../src/game-state.js';
import { STORAGE_KEY, TRAVEL_BACKUP_KEY } from '../src/game-data.js';
import { emptyRealm } from '../src/realm-data.js';

class MemoryStorage {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, value); }
}

function oldWorld() {
  const save = createInitialState();
  delete save.travel;
  delete save.settings.ageBand;
  save.blocks = [{ id: 'block-1', item: 'plank', x: -2, y: 0, z: 1, rotation: 0 }];
  save.nextId = 2;
  save.inventory.wood = 9;
  return save;
}

test('旧 v1 没有 travel 时家里字段保留，并只备份一次原文', () => {
  const save = oldWorld();
  const text = JSON.stringify(save);
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, text);
  const game = new GameState(storage);
  assert.equal(game.state.settings.sound, true);
  assert.equal(game.state.settings.ageBand, null);
  assert.equal(game.state.travel.current, 'he');
  assert.equal(game.state.blocks[0].x, -2);
  assert.equal(game.state.blocks[0].item, 'plank');
  assert.equal(game.state.inventory.wood, 9);
  assert.deepEqual(game.state.player, save.player);
  game.save();
  assert.equal(storage.getItem(TRAVEL_BACKUP_KEY), text);
  game.save();
  assert.equal(storage.getItem(`${TRAVEL_BACKUP_KEY}-1`), null);
  assert.equal(storage.getItem(TRAVEL_BACKUP_KEY), text);
  const again = new GameState(storage);
  assert.equal(again.state.inventory.wood, 9);
  assert.equal(again.state.blocks.length, 1);
  assert.equal(storage.getItem(`${TRAVEL_BACKUP_KEY}-1`), null);
});

test('已有不同内容的旅行备份时改用编号，写入失败不覆盖主存档', () => {
  const save = oldWorld();
  const text = JSON.stringify(save);
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, text);
  storage.setItem(TRAVEL_BACKUP_KEY, '{"other":true}');
  const game = new GameState(storage);
  game.save();
  assert.equal(storage.getItem(`${TRAVEL_BACKUP_KEY}-1`), text);
  assert.equal(storage.getItem(TRAVEL_BACKUP_KEY), '{"other":true}');
  const blocked = {
    getItem(key) { return key === STORAGE_KEY ? text : null; },
    setItem() { throw new Error('拒绝写入'); },
  };
  const failed = new GameState(blocked);
  assert.equal(failed.save().ok, false);
  assert.equal(blocked.getItem(STORAGE_KEY), text);
});

test('导入非法 travel 整份拒绝，本地读取则回家并保留家里的建筑', () => {
  const game = new GameState(new MemoryStorage());
  const before = game.exportSave();
  const bad = JSON.parse(before);
  bad.travel.current = 'nope';
  assert.equal(game.importSave(JSON.stringify(bad)).ok, false);
  assert.equal(game.exportSave(), before);
  const home = oldWorld();
  home.travel = { schema: 1, current: 'ri', visited: [], stamps: [], stickers: [], story: { seen: [], letters: [] }, gifts: { given: [], received: [] }, supplyAt: 0, realms: { ri: { ...emptyRealm('ri'), blocks: 'nope' } } };
  const text = JSON.stringify(home);
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, text);
  const loaded = new GameState(storage);
  assert.equal(loaded.state.travel.current, 'he');
  assert.equal(loaded.state.blocks[0].x, -2);
  assert.equal(loaded.state.blocks[0].item, 'plank');
  assert.equal(loaded.state.inventory.wood, 9);
  assert.match(loaded.travelNotice, /回到河谷/);
  loaded.save();
  assert.equal(storage.getItem(TRAVEL_BACKUP_KEY), text);
});

test('只有日谷位置出界时回到码头，仍留在日谷', () => {
  const home = createInitialState();
  home.travel.current = 'ri';
  home.travel.visited = ['ri'];
  home.travel.realms.ri = emptyRealm('ri');
  home.travel.realms.ri.player = { x: 80, y: 0, z: 0, ry: 0 };
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify(home));
  const game = new GameState(storage);
  assert.equal(game.state.travel.current, 'ri');
  assert.equal(game.state.travel.realms.ri.player.z, -12);
  assert.match(game.travelNotice, /码头/);
  assert.deepEqual(game.state.blocks, home.blocks);
});

test('年龄档非法时导入失败，缺省为不设置', () => {
  const game = new GameState(new MemoryStorage());
  const bad = JSON.parse(game.exportSave());
  bad.settings.ageBand = 'adult';
  assert.equal(game.importSave(JSON.stringify(bad)).ok, false);
  assert.equal(game.state.settings.ageBand, null);
});
