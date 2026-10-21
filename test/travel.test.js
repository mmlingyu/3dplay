import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/game-state.js';
import { applyPack, nextQuestion, useTutorRealm } from '../src/tutor-data.js';
import { riTutorPack } from '../src/ri-tutors.js';
import { STAMPS, WASHI_TOTAL_SECONDS } from '../src/realm-data.js';
import { createCutscene } from '../src/travel.js';

test('访客小院可搭建和撤回，朋友的家不能盖，家里的方块不动', () => {
  const game = new GameState(null);
  assert.ok(game.placeBlock('plank', { x: -2, y: 0, z: 1, rotation: 0 }).ok);
  const homeBlocks = game.state.blocks.map((block) => block.id);
  assert.ok(game.beginTravel('ri').ok);
  assert.equal(game.placementProblem('plank', { x: -8, y: 0, z: -6, rotation: 0 }), '这里是朋友的家和园子，去访客小院搭建吧。');
  assert.equal(game.placementProblem('plank', { x: 40, y: 0, z: 0, rotation: 0 }), '这里出了日谷的范围。');
  const placed = game.placeBlock('plank', { x: 4, y: 0, z: 8, rotation: 0 });
  assert.equal(placed.ok, true);
  assert.deepEqual(game.state.blocks.map((block) => block.id), homeBlocks);
  assert.equal(game.state.travel.realms.ri.blocks.length, 1);
  assert.ok(game.undo().ok);
  assert.equal(game.state.travel.realms.ri.blocks.length, 0);
  assert.equal(game.state.blocks.length, 1);
});

test('和纸按可见的秒推进，暂停不调用 tick 就不会变，做完得到和纸', () => {
  const game = new GameState(null);
  game.beginTravel('ri');
  assert.match(game.startWashi().message, /楮树林/);
  assert.match(game.startWashi().message, /不用答题/);
  game.state.inventory.kozo = 1;
  assert.ok(game.startWashi().ok);
  assert.equal(game.state.travel.realms.ri.processes[0].stage, 'steam');
  assert.equal(game.startWashi().ok, false);
  game.returnHome();
  assert.equal(game.state.travel.realms.ri.processes[0].elapsed, 0);
  game.tick(4);
  assert.equal(game.state.travel.realms.ri.processes[0].stage, 'beat');
  game.tick(WASHI_TOTAL_SECONDS);
  assert.equal(game.state.travel.realms.ri.processes[0].stage, 'ready');
  game.beginTravel('ri');
  assert.ok(game.claimWashi().ok);
  assert.equal(game.state.inventory.washi, 1);
  assert.ok(game.state.travel.stamps.includes('ri-washi-first'));
});

test('四枚印章都能不答题得到，答题补给不加印章', () => {
  const game = new GameState(null);
  assert.ok(game.beginTravel('ri').ok);
  assert.ok(game.beginTravel('ri').ok === false);
  game.state.inventory.kozo = 1;
  game.startWashi();
  game.tick(WASHI_TOTAL_SECONDS);
  game.claimWashi();
  assert.ok(game.craft([['washi']], 'paper-crane').ok);
  game.state.inventory.washi = 1;
  game.state.inventory['bamboo-strip'] = 1;
  assert.ok(game.craft([['washi', 'bamboo-strip']], 'paper-koinobori').ok);
  assert.match(game.repairKoinobori().message, /不用答题|补上了/);
  assert.ok(game.repairKoinobori().ok);
  for (const stamp of STAMPS) assert.ok(game.state.travel.stamps.includes(stamp.id), stamp.id);
  assert.equal(game.state.travel.stamps.length, STAMPS.length);
  const before = game.state.travel.stamps.length;
  assert.ok(game.rewardTutorSupply('koharu').ok);
  assert.equal(game.state.inventory.kozo, 2);
  assert.equal(game.state.travel.stamps.length, before);
  assert.equal(game.rewardTutorSupply('koharu').ok, false);
  assert.ok(game.state.travel.stickers.includes('ri-quiz-koharu'));
});

test('10–12 岁没有题目时用 7–9 岁，未发布角色不出现', () => {
  applyPack(riTutorPack, 'ri');
  useTutorRealm('ri');
  const older = nextQuestion('kozo-elder', 'older', []);
  const bigger = nextQuestion('kozo-elder', 'bigger', []);
  assert.equal(older.id, bigger.id);
  assert.equal(useTutorRealm('ri').characters.some((item) => item.id === 'draft-hidden'), false);
  assert.ok(useTutorRealm('ri').characters.some((item) => item.id === 'koharu'));
});

test('渡口过场可跳过，暂停或隐藏时不计时', () => {
  const scene = createCutscene('ferry', 3);
  assert.equal(scene.tick(1, { paused: true }), false);
  assert.equal(scene.tick(1, { hidden: true }), false);
  assert.equal(scene.elapsed, 0);
  scene.tick(1, {});
  assert.equal(scene.done, false);
  scene.skip();
  assert.equal(scene.done, true);
});
