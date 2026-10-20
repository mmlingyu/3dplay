import test from 'node:test';
import assert from 'node:assert/strict';
import { RECIPES } from '../src/game-data.js';
import { GameState } from '../src/game-state.js';
import { BUILD_CASES, WORKSHOP_FOLDS, afterMaking, combinationLayers, combinationTree, lackHint, madeLine, mathPits, needLine, putHint, recipeNeeds, recipePits, resultLine, sumLine, whereToGet } from '../src/workshop-data.js';

const recipe = id => RECIPES.find(entry => entry.id === id);

test('每条配方都写出材料和数量', () => {
  assert.deepEqual(recipeNeeds(recipe('planks')), [{ item: 'wood', count: 1, name: '木料' }]);
  assert.equal(recipe('planks').output.count, 4);
  assert.deepEqual(recipeNeeds(recipe('sticks')).map(need => [need.item, need.count]), [['plank', 1]]);
  assert.equal(recipe('sticks').output.count, 2);
  assert.equal(recipeNeeds(recipe('chest')).find(need => need.item === 'plank').count, 8);
  assert.equal(recipeNeeds(recipe('workbench')).find(need => need.item === 'plank').count, 4);
  assert.deepEqual(recipePits(recipe('chest')).map(need => need.count), [4, 4]);
  assert.deepEqual(recipeNeeds(recipe('window')).map(need => [need.item, need.count]), [['plank', 1], ['stick', 1]]);
  assert.deepEqual(recipeNeeds(recipe('ramp')).map(need => [need.item, need.count]), [['plank', 1], ['stone', 1]]);
});

test('每种左边材料组合只对应一样结果', () => {
  const game = new GameState(null);
  const bags = RECIPES.map(entry => JSON.stringify(recipeNeeds(entry).map(need => [need.item, need.count]).sort()));
  assert.equal(bags.length, new Set(bags).size);
  for (const entry of RECIPES) {
    assert.deepEqual(game.getMatches(entry.pattern).map(match => match.id), [entry.id], entry.id);
  }
});

test('放进坑里用加法数出来', () => {
  assert.equal(sumLine(0), '');
  assert.equal(sumLine(1), '1');
  assert.equal(sumLine(4), '1 + 1 + 1 + 1 = 4');
  const one = mathPits(recipe('ball'), { plank: 12 }, 1);
  assert.equal(one.put, 1);
  assert.equal(one.ready, false);
  const two = mathPits(recipe('ball'), { plank: 12 }, 2);
  assert.equal(two.ready, true);
  assert.equal(two.outCount, 1);
  assert.equal(two.groups.length, 1);
  assert.equal(two.groups[0].item, 'plank');
  assert.equal(two.groups[0].need, 2);
  assert.equal(putHint(mathPits(recipe('ball'), { plank: 12 }, 0)), '两块板合成圆');
  assert.equal(resultLine(two), '得到 1 个木球');
  const sticks = mathPits(recipe('sticks'), { plank: 12 }, 1);
  assert.equal(sticks.ready, true);
  assert.equal(sticks.outCount, 2);
  assert.equal(putHint(mathPits(recipe('sticks'), { plank: 12 }, 0)), '1 变成 2');
});

test('加减坑位按放入的份数算剩下和得到', () => {
  const empty = mathPits(recipe('planks'), { wood: 4, plank: 12 }, 0);
  assert.equal(empty.need, 1);
  assert.equal(empty.put, 0);
  assert.equal(empty.left, 4);
  assert.equal(empty.canPut, true);
  assert.equal(empty.ready, false);
  const placed = mathPits(recipe('planks'), { wood: 4, plank: 12 }, 1);
  assert.equal(placed.put, 1);
  assert.equal(placed.left, 3);
  assert.equal(placed.ready, true);
  assert.equal(placed.outNext, 16);
  const short = mathPits(recipe('chest'), { plank: 3 }, 9);
  assert.equal(short.need, 8);
  assert.equal(short.put, 3);
  assert.equal(short.ready, false);
  assert.equal(short.canPut, false);
  assert.equal(short.outNext, 0);
  const split = mathPits(recipe('chest'), { plank: 12 }, 5);
  assert.equal(split.groups.length, 2);
  assert.equal(split.groups[0].put, 4);
  assert.equal(split.groups[1].put, 1);
  assert.equal(split.canPut, true);
});

test('背包不够时直接说出还差几份', () => {
  const short = needLine(recipe('window'), { plank: 1, stick: 0 });
  assert.equal(short.ok, false);
  assert.match(short.text, /木棍要 1 根，背包有 0，还差 1/);
  const enough = needLine(recipe('planks'), { wood: 3 });
  assert.equal(enough.ok, true);
  assert.match(enough.text, /木料要 1 份，背包有 3/);
});

test('不够时说出背包数量和去哪里拿', () => {
  assert.match(whereToGet('wood'), /林间木料/);
  assert.match(whereToGet('stone'), /石料堆/);
  assert.match(whereToGet('plank'), /木板/);
  assert.match(whereToGet('stick'), /木棍/);
  assert.match(whereToGet('brick'), /砖窑/);
  const none = mathPits(recipe('ball'), { plank: 0 }, 0);
  assert.equal(none.short, true);
  assert.equal(putHint(none), '背包不够');
  assert.match(lackHint(none), /木板还差 2 块/);
  assert.match(lackHint(none), /背包 0/);
  assert.match(lackHint(none), /木作工作台/);
  const mix = mathPits(recipe('ramp'), { plank: 0, stone: 0 }, 0);
  assert.match(lackHint(mix), /石料堆/);
  assert.match(lackHint(mix), /林间木料|木作工作台/);
  assert.match(madeLine(recipe('planks'), 4), /做好了 4 块木板，已经放进背包/);
});

test('做好的木板能接上下一步模块', () => {
  const next = afterMaking(recipe('planks'));
  assert.match(next, /可以摆到地上/);
  assert.match(next, /斜坡要用 1 块/);
  assert.match(next, /储物箱要用 8 块/);
  assert.match(afterMaking(recipe('sticks')), /挡板要用 1 根/);
});

test('组合关系最多四层，挡板在最上一层', () => {
  const layers = combinationLayers();
  assert.equal(layers.length, 4);
  assert.ok(layers[0].some(node => node.item === 'wood'));
  const plank = layers[1].find(node => node.item === 'plank');
  assert.ok(plank);
  assert.deepEqual(plank.from.map(need => [need.item, need.count]), [['wood', 1]]);
  assert.equal(plank.count, 4);
  assert.ok(layers[2].some(node => node.item === 'stick'));
  assert.ok(layers[3].some(node => node.item === 'post'));
  assert.ok(layers[3].some(node => node.item === 'door'));
  assert.equal(layers.flat().length, new Set(layers.flat().map(node => node.item)).size);
});

test('四层组合成从上到下的树', () => {
  const roots = combinationTree();
  const wood = roots.find(node => node.item === 'wood');
  assert.ok(wood);
  const plank = wood.children.find(node => node.item === 'plank');
  assert.ok(plank);
  const made = plank.children.map(node => node.item);
  assert.ok(made.includes('stick'));
  assert.ok(made.includes('roof'));
  const stick = plank.children.find(node => node.item === 'stick');
  assert.ok(stick.children.some(node => node.item === 'post'));
  assert.ok(stick.children.some(node => node.item === 'fence'));
});

test('引导案例用已经做好的模块往上拼', () => {
  const ids = new Set(RECIPES.map(entry => entry.id));
  const foldIds = WORKSHOP_FOLDS.flatMap(fold => fold.ids);
  assert.equal(foldIds.length, new Set(foldIds).size);
  for (const id of foldIds) assert.ok(ids.has(id), id);
  for (const sample of BUILD_CASES) {
    const recipes = sample.steps.filter(step => step.recipe).map(step => step.recipe);
    assert.ok(recipes.length >= 1, sample.id);
    for (const id of recipes) assert.ok(ids.has(id), id);
  }
  const track = BUILD_CASES.find(sample => sample.id === 'track').steps.map(step => step.recipe || step.place);
  assert.deepEqual(track, ['planks', 'ramp', 'sticks', 'post', 'ramp']);
  const store = BUILD_CASES.find(sample => sample.id === 'store').steps.map(step => step.recipe || step.place);
  assert.deepEqual(store, ['planks', 'workbench', 'chest', 'chest']);
  const house = BUILD_CASES.find(sample => sample.id === 'house').steps.map(step => step.recipe || step.place);
  assert.deepEqual(house, ['planks', 'door', 'window', 'roof', 'ramp', 'door']);
});
