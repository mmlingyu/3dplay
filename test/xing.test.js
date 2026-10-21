import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState, createInitialState, validateSave } from '../src/game-state.js';
import { MEI_BACKUP_KEY, STORAGE_KEY, XING_BACKUP_KEY } from '../src/game-data.js';
import { emptyRealm } from '../src/realm-data.js';
import { balloonLook } from '../src/balloon-data.js';
import { XING_STAMPS, starRouteVisible } from '../src/xing-data.js';
import { advanceCrystal, crystalPlan, crystalStage } from '../src/experiment-lab.js';
import { makePuzzle } from '../src/glyph-data.js';
import { repairTravelRaw } from '../src/travel-save.js';

class MemoryStorage {
  constructor() { this.data = new Map(); this.failKeys = new Set(); }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) {
    if (this.failKeys.has(key)) throw new Error('写入失败');
    this.data.set(key, value);
  }
}

function world(extra = {}) {
  const save = createInitialState();
  Object.assign(save, extra);
  return save;
}

function homeSlice(save) {
  return {
    inventory: save.inventory,
    blocks: save.blocks,
    player: save.player,
    garden: save.garden,
    kiln: save.kiln,
    chests: save.chests,
    stats: save.stats,
  };
}

test('幻想航线只在游览时出现，渡船去不了外星谷', () => {
  assert.equal(starRouteVisible({ realm: 'he', phase: 'tour' }), true);
  assert.equal(starRouteVisible({ open: false, realm: 'he', phase: 'tour' }), false);
  assert.equal(starRouteVisible({ realm: 'ri', phase: 'tour' }), false);
  const look = balloonLook('voyage', 0, 'orbit', 'xing');
  assert.equal(look.title, '飞向星星');
  assert.match(look.note, /幻想航线/);
  assert.match(look.note, /飞不出大气层/);
  assert.equal(balloonLook('voyage', 1, 'orbit').title, '看风景去日谷');
  assert.equal(balloonLook('voyage', 0, 'orbit', 'mei').title, '看风景去美谷');
  assert.equal(balloonLook('voyage', 0, 'orbit', 'xing').title, '飞向星星');
  const game = new GameState(new MemoryStorage());
  const ferry = game.beginTravel('xing', 'ferry');
  assert.equal(ferry.ok, false);
  assert.match(ferry.message, /热气球/);
  assert.equal(game.state.travel.current, 'he');
});

test('地面印章不用答题，补穹顶的印章要另外拿', () => {
  const game = new GameState(new MemoryStorage());
  game.beginTravel('xing', 'balloon');
  game.addItem('salt', 4);
  game.startCrystal(true);
  game.tick(20);
  game.claimCrystal();
  game.recordExperiment('gravity', 'little');
  game.seeMoss();
  game.reuniteGugu();
  game.reuniteGugu();
  game.grantPlaque();
  const ids = game.state.travel.stamps.filter((id) => id.startsWith('xing-'));
  const field = XING_STAMPS.map((stamp) => stamp.id).filter((id) => id !== 'xing-dome').sort();
  assert.deepEqual([...ids].sort(), field);
  assert.equal(ids.includes('xing-dome'), false);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(game.state.inventory['glyph-plaque'], 1);
  assert.equal(game.state.inventory['salt-crystal'], 1);
  const puzzle = makePuzzle('little', 'pair', 3);
  const before = game.state.inventory.salt;
  const wrong = puzzle.choices.find((choice) => !choice.ok);
  const missed = game.solvePuzzle(puzzle, wrong.id);
  assert.equal(missed.correct, false);
  assert.equal(game.state.inventory.salt, before);
  assert.equal(game.state.travel.stamps.includes('xing-puzzle'), false);
});

test('盐放得多会析出，放得少几乎没有，暂停、隐藏和离线都不往前走', () => {
  assert.equal(crystalPlan(2, 1).saturated, true);
  assert.equal(crystalPlan(1, 1).saturated, false);
  assert.equal(crystalStage(20, true), 'ready');
  assert.equal(crystalStage(20, false), 'sparse');
  const dish = { kind: 'crystal', elapsed: 4, stage: 'dissolve', saturated: true };
  assert.equal(advanceCrystal(dish, 5, { paused: true }).elapsed, 4);
  assert.equal(advanceCrystal(dish, 5, { hidden: true }).elapsed, 4);
  const game = new GameState(new MemoryStorage());
  game.beginTravel('xing', 'balloon');
  game.addItem('salt', 2);
  game.startCrystal(false);
  const early = game.crystalStatus().elapsed;
  const text = game.exportSave();
  const again = new GameState(new MemoryStorage());
  again.importSave(text);
  assert.equal(again.crystalStatus().elapsed, early);
  game.tick(20);
  assert.equal(game.crystalStatus().sparse, true);
  assert.equal(game.claimCrystal().ok, true);
  assert.equal(game.state.inventory['salt-crystal'], 0);
  game.addItem('salt', 2);
  game.startCrystal(true);
  game.tick(20);
  assert.equal(game.crystalStatus().ready, true);
  assert.equal(game.claimCrystal().ok, true);
  assert.equal(game.state.inventory['salt-crystal'], 1);
});

test('活的幻想生物不能播种、放养或带进家里的建筑，展柜可以放', () => {
  const game = new GameState(new MemoryStorage());
  const sow = game.sow('garden-1', 'glowmoss');
  assert.equal(sow.ok, false);
  assert.match(sow.message, /展柜/);
  const released = game.releaseCreature('glowmoss');
  assert.equal(released.ok, false);
  assert.match(released.message, /展柜/);
  assert.match(game.placementProblem('glowmoss', { x: 2, y: 0, z: 2, rotation: 0 }), /展柜/);
  game.beginTravel('xing', 'balloon');
  game.addItem('glowmoss', 1);
  game.addItem('glass-dome', 1);
  const made = game.craft([['glowmoss', 'glass-dome']], 'glowmoss-case');
  assert.equal(made.ok, true);
  game.returnHome();
  const placed = game.placeBlock('glowmoss-case', { x: -2, y: 0, z: 1, rotation: 0 });
  assert.equal(placed.ok, true);
  const dirty = createInitialState();
  dirty.blocks.push({ id: 'block-9', item: 'glowmoss', x: -2, y: 0, z: 2, rotation: 0, w: 1, d: 1 });
  assert.throws(() => validateSave(dirty), /展柜/);
  const garden = createInitialState();
  garden.garden[0].crop = 'glowmoss';
  assert.throws(() => validateSave(garden), /展柜/);
  const fresh = new GameState(new MemoryStorage());
  const before = fresh.exportSave();
  const imported = fresh.importSave(JSON.stringify(dirty));
  assert.equal(imported.ok, false);
  assert.equal(fresh.exportSave(), before);
});

test('没有 travel 的 v1、只有日谷、以及带着美谷原文的存档都能升级且家里的数据不变', () => {
  const v1 = world();
  delete v1.travel;
  const v1Text = JSON.stringify(v1);
  const plain = new MemoryStorage();
  plain.setItem(STORAGE_KEY, v1Text);
  const opened = new GameState(plain);
  assert.deepEqual(homeSlice(opened.state).blocks, v1.blocks);
  assert.equal(opened.state.inventory.wood, v1.inventory.wood);
  opened.save();
  assert.equal(plain.getItem(XING_BACKUP_KEY), v1Text);
  assert.equal(plain.getItem(MEI_BACKUP_KEY), v1Text);
  assert.notEqual(XING_BACKUP_KEY, MEI_BACKUP_KEY);
  opened.save();
  assert.equal(plain.getItem(`${XING_BACKUP_KEY}-1`), null);
  assert.equal(plain.getItem(`${MEI_BACKUP_KEY}-1`), null);

  const ri = world();
  ri.blocks = [{ id: 'block-3', item: 'plank', x: -2, y: 0, z: 1, rotation: 0, w: 1, d: 1 }];
  ri.inventory.wood = 11;
  ri.travel.realms.ri = emptyRealm('ri');
  ri.travel.realms.ri.blocks = [{ id: 'block-4', item: 'plank', x: 4, y: 0, z: 6, rotation: 0, w: 1, d: 1 }];
  ri.travel.visited = ['ri'];
  ri.travel.stamps = ['ri-arrive'];
  const riCopy = JSON.parse(JSON.stringify(ri.travel.realms.ri));
  const riText = JSON.stringify(ri);
  const riStore = new MemoryStorage();
  riStore.setItem(STORAGE_KEY, riText);
  const riGame = new GameState(riStore);
  riGame.save();
  assert.equal(riStore.getItem(XING_BACKUP_KEY), riText);
  assert.deepEqual(riGame.state.travel.realms.ri, riCopy);
  assert.equal(riGame.state.blocks[0].id, 'block-3');
  assert.equal(riGame.state.inventory.wood, 11);
  riGame.beginTravel('xing', 'balloon');
  assert.deepEqual(riGame.state.travel.realms.ri, riCopy);
  assert.equal(riGame.state.blocks[0].item, 'plank');

  const both = JSON.parse(JSON.stringify(ri));
  both.travel.realms.mei = emptyRealm('mei');
  both.travel.realms.mei.decor.face = 'cat';
  both.travel.realms.mei.blocks = [{ id: 'block-9', item: 'plank', x: 4, y: 0, z: 6, rotation: 0, w: 1, d: 1 }];
  const meiText = JSON.stringify(both);
  const meiStore = new MemoryStorage();
  meiStore.setItem(STORAGE_KEY, meiText);
  meiStore.setItem(MEI_BACKUP_KEY, '{"mei-older":true}');
  const meiGame = new GameState(meiStore);
  meiGame.save();
  assert.equal(meiStore.getItem(MEI_BACKUP_KEY), '{"mei-older":true}');
  assert.equal(meiStore.getItem(XING_BACKUP_KEY), meiText);
  assert.equal(meiGame.state.travel.realms.mei.decor.face, 'cat');
  assert.equal(meiGame.state.travel.realms.mei.blocks[0].id, 'block-9');
  assert.deepEqual(meiGame.state.travel.realms.ri.blocks, riCopy.blocks);
  meiGame.beginTravel('xing', 'balloon');
  assert.equal(meiGame.state.travel.realms.mei.decor.face, 'cat');
  assert.equal(meiGame.state.travel.realms.mei.blocks[0].item, 'plank');

  const stepwise = new MemoryStorage();
  stepwise.setItem(STORAGE_KEY, v1Text);
  const first = new GameState(stepwise);
  first.save();
  const second = new GameState(stepwise);
  second.save();
  assert.equal(stepwise.getItem(`${XING_BACKUP_KEY}-1`), null);
  assert.equal(stepwise.getItem(`${MEI_BACKUP_KEY}-1`), null);
  assert.equal(stepwise.getItem(XING_BACKUP_KEY), v1Text);
  assert.equal(stepwise.getItem(MEI_BACKUP_KEY), v1Text);
  assert.deepEqual(second.state.travel.realms.xing.glyphs, []);
  assert.equal(second.state.inventory.wood, opened.state.inventory.wood);
  assert.equal(second.state.travel.current, 'he');
  assert.deepEqual(second.state.blocks, opened.state.blocks);
});

test('已有不同备份时加后缀，备份写失败就不覆盖主存档', () => {
  const save = world();
  save.travel.realms.ri = emptyRealm('ri');
  const text = JSON.stringify(save);
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, text);
  storage.setItem(XING_BACKUP_KEY, '{"older":true}');
  const game = new GameState(storage);
  game.save();
  assert.equal(storage.getItem(`${XING_BACKUP_KEY}-1`), text);
  assert.equal(storage.getItem(XING_BACKUP_KEY), '{"older":true}');

  const blocked = new MemoryStorage();
  blocked.setItem(STORAGE_KEY, text);
  blocked.failKeys.add(XING_BACKUP_KEY);
  const stuck = new GameState(blocked);
  const result = stuck.save();
  assert.equal(result.ok, false);
  assert.equal(blocked.getItem(STORAGE_KEY), text);
});

test('外星谷位置坏了回到草坪，记录坏了回河谷，日谷和美谷原文还在', () => {
  const save = world();
  save.travel.current = 'xing';
  save.travel.via = 'balloon';
  save.travel.visited = ['xing'];
  save.travel.realms.ri = emptyRealm('ri');
  save.travel.realms.ri.claimed = ['ri-flag-repaired'];
  save.travel.realms.mei = emptyRealm('mei');
  save.travel.realms.mei.decor.face = 'cat';
  save.travel.realms.mei.claimed = ['mei-kept'];
  save.travel.realms.xing = emptyRealm('xing');
  save.travel.realms.xing.player.y = 80;
  const high = repairTravelRaw(JSON.parse(JSON.stringify(save)));
  assert.equal(high.raw.travel.current, 'xing');
  assert.equal(high.raw.travel.realms.xing.player.y, 0);
  assert.match(high.notice, /热气球草坪/);
  assert.equal(high.raw.travel.realms.ri.claimed[0], 'ri-flag-repaired');
  assert.equal(high.raw.travel.realms.mei.decor.face, 'cat');

  save.travel.realms.xing = { broken: true };
  const bad = repairTravelRaw(JSON.parse(JSON.stringify(save)));
  assert.equal(bad.raw.travel.current, 'he');
  assert.equal(bad.raw.travel.realms.xing, undefined);
  assert.equal(bad.raw.travel.realms.ri.claimed[0], 'ri-flag-repaired');
  assert.equal(bad.raw.travel.realms.mei.decor.face, 'cat');
  assert.equal(bad.raw.travel.realms.mei.claimed[0], 'mei-kept');
  assert.equal(bad.raw.blocks.length, save.blocks.length);
  const checked = validateSave(bad.raw);
  assert.equal(checked.travel.current, 'he');
  assert.equal(checked.travel.realms.mei.decor.face, 'cat');
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify(save));
  const game = new GameState(storage);
  assert.equal(game.state.travel.current, 'he');
  assert.equal(game.state.travel.realms.mei.decor.face, 'cat');
  assert.equal(game.state.blocks.length, save.blocks.length);
});
