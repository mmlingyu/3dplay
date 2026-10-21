import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState, createInitialState } from '../src/game-state.js';
import { HOLO_BACKUP_KEY, STORAGE_KEY } from '../src/game-data.js';
import { emptyRealm } from '../src/realm-data.js';
import { readHolo } from '../src/holo-save.js';
import {
  TIER_RULES,
  defaultHolo,
  earnedTier,
  grantStarlight,
  holoAge,
  inferQuality,
  makeStage,
  resolveQuality,
  roundTripAlien,
  stageAnswer,
  tierLabel,
} from '../src/holo-data.js';

class MemoryStorage {
  constructor() { this.data = new Map(); this.failKeys = new Set(); }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) {
    if (this.failKeys.has(key)) throw new Error('写入失败');
    this.data.set(key, value);
  }
}

function savedWorld() {
  const save = createInitialState();
  save.travel.realms.xing = emptyRealm('xing');
  return save;
}

test('旧存档没有星网字段时补默认值，并在第一次写入前备份', () => {
  const save = savedWorld();
  save.travel.realms.xing.glyphs = ['drop'];
  const text = JSON.stringify(save);
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, text);
  const game = new GameState(storage);
  assert.equal(game.state.travel.realms.xing.glyphs[0], 'drop');
  assert.equal(game.state.travel.realms.xing.holo.tier, 1);
  assert.equal(game.state.travel.realms.xing.holo.starlight.story, 0);
  assert.equal(game.state.settings.quality, undefined);
  game.save();
  assert.equal(storage.getItem(HOLO_BACKUP_KEY), text);
  assert.equal(storage.getItem(`${HOLO_BACKUP_KEY}-1`), null);
  const written = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.equal(written.travel.realms.xing.glyphs[0], 'drop');
  assert.equal(written.travel.realms.xing.holo.avatar.glow, 'cyan');
  game.save();
  assert.equal(storage.getItem(`${HOLO_BACKUP_KEY}-1`), null);
});

test('星网备份写失败时不覆盖主存档', () => {
  const text = JSON.stringify(savedWorld());
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, text);
  storage.failKeys.add(HOLO_BACKUP_KEY);
  const game = new GameState(storage);
  assert.equal(game.save().ok, false);
  assert.equal(storage.getItem(STORAGE_KEY), text);
});

test('没有星网、没有外星谷、没有 travel 的存档都能读', () => {
  const bare = createInitialState();
  delete bare.travel;
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify(bare));
  const game = new GameState(storage);
  assert.equal(game.state.travel.realms.xing.holo.welcomed, false);
  const noXing = createInitialState();
  delete noXing.travel.realms.xing;
  const again = new GameState(new MemoryStorage());
  assert.equal(again.importSave(JSON.stringify(noXing)).ok, true);
  assert.ok(again.state.travel.realms.xing.holo);
});

test('非法星网记录用中文拒绝', () => {
  const save = savedWorld();
  save.travel.realms.xing.holo = defaultHolo();
  save.travel.realms.xing.holo.avatar.glow = 'gold';
  assert.throws(() => readHolo(save.travel.realms.xing), /星网的化身颜色不正确/);
  save.travel.realms.xing.holo = defaultHolo();
  save.travel.realms.xing.holo.tier = 13;
  assert.throws(() => readHolo(save.travel.realms.xing), /星网的星阶不正确/);
  save.travel.realms.xing.holo = defaultHolo();
  save.travel.realms.xing.holo.echo = { 'num-1': { ms: 1, steps: 1, correct: 1, hints: 0, path: Array.from({ length: 121 }, () => ({ x: 0, y: 1, z: 0 })) } };
  assert.throws(() => readHolo(save.travel.realms.xing), /星网的路线太长/);
  save.travel.realms.xing.holo = defaultHolo();
  save.travel.realms.xing.holo.echo = { 'num-1': { ms: 1, steps: 1, correct: 1, hints: 0, path: [{ x: 0, y: 1, z: 400 }] } };
  assert.throws(() => readHolo(save.travel.realms.xing), /星网的坐标不正确/);
  const storage = new MemoryStorage();
  const game = new GameState(storage);
  game.save();
  const bad = JSON.parse(game.exportSave());
  bad.travel.realms.xing.holo.avatar.glow = 'gold';
  assert.equal(game.importSave(JSON.stringify(bad)).ok, false);
  assert.match(game.importSave(JSON.stringify(bad)).message, /化身颜色/);
});

test('画质可选，缺省时不写入，非法值拒绝', () => {
  const storage = new MemoryStorage();
  const game = new GameState(storage);
  assert.equal(game.state.settings.quality, undefined);
  assert.match(game.setQuality('fast').message, /流畅/);
  assert.equal(JSON.parse(game.exportSave()).settings.quality, 'fast');
  const bad = JSON.parse(game.exportSave());
  bad.settings.quality = 'ultra';
  assert.match(game.importSave(JSON.stringify(bad)).message, /画质不正确/);
  assert.equal(game.state.settings.quality, 'fast');
});

test('年龄只影响星网内容，小的档位进 6–8', () => {
  assert.equal(holoAge('little'), 'young');
  assert.equal(holoAge('bigger'), 'young');
  assert.equal(holoAge('junior'), 'young');
  assert.equal(holoAge(null), 'young');
  assert.equal(holoAge('older'), 'older');
  assert.equal(holoAge('senior'), 'older');
  assert.equal(makeStage('little', 'num-1', 'same').kind, 'count');
  assert.equal(makeStage('older', 'num-1', 'same').kind, 'calc');
  assert.equal(tierLabel(8, 'little'), '6 阶（满）');
  assert.equal(tierLabel(8, 'older'), '8 阶');
});

test('同一随机种子题目相同，答案唯一，四进制可来回', () => {
  const young = makeStage('little', 'num-3', 'seed-a');
  assert.deepEqual(young, makeStage('bigger', 'num-3', 'seed-a'));
  assert.notDeepEqual(young.blocks, makeStage('little', 'num-3', 'seed-b').blocks);
  const pair = young.blocks;
  const hits = [];
  for (let i = 0; i < pair.length; i += 1) {
    for (let j = i + 1; j < pair.length; j += 1) {
      if (pair[i] + pair[j] === 12) hits.push([pair[i], pair[j]]);
    }
  }
  assert.equal(hits.length, 1);
  assert.deepEqual(hits[0].sort((a, b) => a - b), stageAnswer(young).slice().sort((a, b) => a - b));
  const ten = makeStage('little', 'num-2', 'seed-a');
  const tenHits = [];
  for (let i = 0; i < ten.blocks.length; i += 1) {
    for (let j = i + 1; j < ten.blocks.length; j += 1) {
      if (ten.blocks[i] + ten.blocks[j] === 10) tenHits.push([ten.blocks[i], ten.blocks[j]]);
    }
  }
  assert.equal(tenHits.length, 1);
  for (let n = 0; n <= 63; n += 1) assert.equal(roundTripAlien(n), n);
  const base = makeStage('older', 'num-2', 'base');
  assert.equal(base.kind, 'base4');
  assert.equal(String(stageAnswer(base)).length > 0, true);
  const path = makeStage('older', 'num-3', 'path');
  assert.equal(path.points.length, 3);
  assert.ok(Math.abs(path.points[0][0] - 3) <= 1);
});

test('星阶 4 以上必须两种星光都有，故事来源不加星光', () => {
  const holo = defaultHolo();
  grantStarlight(holo, 'story', 'tale', 100);
  assert.equal(holo.starlight.story, 0);
  assert.equal(earnedTier(holo), 1);
  grantStarlight(holo, 'challenge', 'stage:num-1', 4);
  grantStarlight(holo, 'challenge', 'stage:num-2', 4);
  grantStarlight(holo, 'challenge', 'stage:num-3', 4);
  assert.equal(earnedTier(holo), 3);
  grantStarlight(holo, 'challenge', 'stage:num-echo', 40);
  assert.equal(earnedTier(holo), 3);
  grantStarlight(holo, 'field', 'crystal', 6);
  assert.ok(earnedTier(holo) >= 4);
  assert.equal(grantStarlight(holo, 'field', 'crystal', 6), false);
  assert.equal(TIER_RULES[3].both, true);
  assert.equal(TIER_RULES.at(-1).tier, 12);
});

test('画质推断：触屏且短边不大时流畅，选择优先', () => {
  assert.equal(inferQuality({ pointerCoarse: true, maxTouchPoints: 2, shortSide: 768 }), 'fast');
  assert.equal(inferQuality({ pointerCoarse: false, maxTouchPoints: 0, shortSide: 800 }), 'fine');
  assert.equal(inferQuality({ pointerCoarse: false, maxTouchPoints: 5, shortSide: 390 }), 'fast');
  assert.equal(resolveQuality('fine', { pointerCoarse: true, maxTouchPoints: 2, shortSide: 768 }), 'fine');
  assert.equal(resolveQuality(undefined, { pointerCoarse: true, shortSide: 1024 }), 'fast');
});
