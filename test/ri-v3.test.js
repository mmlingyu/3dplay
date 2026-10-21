import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState, createInitialState } from '../src/game-state.js';
import { RI3_BACKUP_KEY, STORAGE_KEY } from '../src/game-data.js';
import { validateTravel } from '../src/travel-save.js';
import {
  canOpenCabinet,
  freshCity,
  isTour,
  readRiSave,
  shrineAllows,
  shardNeed,
} from '../src/ri-story.js';

class MemoryStorage {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, value); }
}

function traveled() {
  const game = new GameState(new MemoryStorage());
  assert.equal(game.beginTravel('ri').ok, true);
  return game;
}

test('寺社只允许点亮石灯笼和看看', () => {
  assert.equal(shrineAllows('点亮'), true);
  assert.equal(shrineAllows('看看'), true);
  for (const word of ['参拜', '抽签', '许愿', '知识牌', '祈福']) assert.equal(shrineAllows(word), false, word);
});

test('电车绕一圈记入 trainLoops，旧档没有 city 也能读', () => {
  const game = traveled();
  assert.equal(game.state.travel.realms.ri.city, undefined);
  assert.equal(game.finishRiTrain().ok, true);
  assert.equal(game.state.travel.realms.ri.city.trainLoops, 1);
  assert.equal(game.finishRiTrain().ok, true);
  assert.equal(game.state.travel.realms.ri.city.trainLoops, 2);
  const old = structuredClone(game.state.travel);
  delete old.realms.ri.city;
  delete old.realms.ri.storyShard;
  const checked = validateTravel(old);
  assert.equal(Object.hasOwn(checked.realms.ri, 'city'), false);
  assert.equal(Object.hasOwn(checked.realms.ri, 'storyShard'), false);
  assert.equal(checked.realms.ri.player.x, old.realms.ri.player.x);
});

test('潮之片不要求序章，两件事才开柜，并只备份一次原文', () => {
  const home = createInitialState();
  home.blocks = [{ id: 'block-1', item: 'plank', x: -2, y: 0, z: 1, rotation: 0 }];
  home.inventory.wood = 9;
  const text = JSON.stringify(home);
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, text);
  const game = new GameState(storage);
  assert.equal(game.state.blocks[0].item, 'plank');
  assert.equal(game.state.inventory.wood, 9);
  assert.equal(game.beginTravel('ri').ok, true);
  assert.equal(game.state.travel.story.seen.length, 0);
  game.state.inventory['paper-koinobori'] = 1;
  assert.equal(game.repairKoinobori().ok, true);
  assert.equal(canOpenCabinet(game.state.travel.realms.ri), false);
  assert.equal(game.claimRiShard().ok, false);
  assert.equal(game.finishRiTrain().ok, true);
  const opened = game.claimRiShard();
  assert.equal(opened.ok, true);
  assert.equal(opened.shard, true);
  assert.match(opened.line, /电影院/);
  assert.equal(game.state.travel.realms.ri.storyShard, true);
  assert.equal(game.state.travel.stamps.includes('ri-tide-shard'), true);
  assert.equal(game.state.travel.story.seen.length, 0);
  assert.equal(game.state.blocks[0].item, 'plank');
  game.save();
  assert.equal(storage.getItem(RI3_BACKUP_KEY), text);
  assert.equal(storage.getItem(`${RI3_BACKUP_KEY}-1`), null);
  const again = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.equal(again.travel.realms.ri.storyShard, true);
  assert.equal(again.blocks[0].item, 'plank');
  game.save();
  assert.equal(storage.getItem(`${RI3_BACKUP_KEY}-1`), null);
});

test('没有新字段的日谷原文来回读取后仍没有 storyShard 和 city', () => {
  const game = traveled();
  const raw = JSON.parse(JSON.stringify(game.state));
  assert.equal(Object.hasOwn(raw.travel.realms.ri, 'storyShard'), false);
  assert.equal(Object.hasOwn(raw.travel.realms.ri, 'city'), false);
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify(raw));
  const loaded = new GameState(storage);
  assert.equal(Object.hasOwn(loaded.state.travel.realms.ri, 'storyShard'), false);
  assert.equal(Object.hasOwn(loaded.state.travel.realms.ri, 'city'), false);
  assert.deepEqual(readRiSave(loaded.state.travel.realms.ri), {});
  loaded.save();
  assert.equal(storage.getItem(RI3_BACKUP_KEY), null);
});

test('坏的街区记录会被拒绝，节点环境里 tour 默认为关', () => {
  assert.throws(() => validateTravel({
    schema: 1,
    current: 'ri',
    via: 'ferry',
    visited: ['ri'],
    stamps: [],
    stickers: [],
    story: { seen: [], letters: [] },
    gifts: { given: [], received: [] },
    supplyAt: 0,
    realms: {
      ri: {
        player: { x: 0, y: 0, z: -12, ry: 0 },
        blocks: [],
        chests: {},
        claimed: [],
        processes: [],
        city: { lanterns: 0, shops: 0, trainLoops: 0, wish: true },
      },
    },
  }), /街区/);
  assert.equal(isTour(), false);
  assert.equal(shardNeed(), 2);
  assert.equal(freshCity().trainLoops, 0);
});
