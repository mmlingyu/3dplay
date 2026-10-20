import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/game-state.js';
import * as land from '../src/land-data.js';

const storage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};

test('原地和远处不能开区，走到对应共享边界才能开垦，奖励与存档保留', () => {
  const g = new GameState(storage()), before = g.exportSave();
  assert.equal(g.reclaim(2, 0).ok, false);
  assert.equal(g.exportSave(), before);
  for (const [cx, cz, x, z] of [
    [2, 0, 15.2, 3], [-3, 0, -15.2, 3],
    [0, -3, 1, -15.2], [0, 2, 1, 15.2],
  ]) {
    g.state.player = { x, y: 0, z };
    const inventory = { ...g.state.inventory };
    assert.ok(g.reclaim(cx, cz).ok, `${cx},${cz}`);
    assert.deepEqual(g.state.inventory, inventory, '开垦不扣材料');
    assert.equal(g.reclaim(cx, cz).ok, false, '不能重复开同一块');
  }
  g.state.player = { x: 23.2, y: 0, z: 3 };
  assert.ok(g.reclaim(3, 0).ok, '新区边缘继续开');
  const e = land.encounterForChunk(g.state.land, '2,0');
  assert.ok(g.claimEncounter(e.id).ok);
  const saved = g.exportSave();
  assert.ok(g.importSave(saved).ok);
  const restored=JSON.parse(g.exportSave()),original=JSON.parse(saved);
  restored.land.opened.sort();original.land.opened.sort();
  assert.deepEqual(restored,original);
  assert.equal(g.claimEncounter(e.id).ok, false);
});

test('当前位置的边界选择只来自角色所在的开放区，不跨角或穿过未开区', () => {
  assert.equal(typeof land.nearbyFrontiers, 'function');
  const map = land.createLand();
  assert.deepEqual(land.nearbyFrontiers(map, { x: -5, z: 5 }), []);
  assert.deepEqual(land.nearbyFrontiers(map, { x: 15.2, z: 3 }).map(p => p.id), ['2,0']);
  assert.deepEqual(land.nearbyFrontiers(map, { x: 15.2, z: -0.8 }).map(p => p.id), ['2,-1']);
  assert.deepEqual(land.nearbyFrontiers(map, { x: 16.2, z: 3 }), [], '站在未开区域不允许开垦');
  assert.deepEqual(land.nearbyFrontiers(map, { x: NaN, z: 3 }), []);
  map.opened.push('2,0');
  assert.deepEqual(land.nearbyFrontiers(map, { x: 15.2, z: 3 }), [], '已开边界不再提示');
  assert.deepEqual(land.nearbyFrontiers(map, { x: 23.2, z: 3 }).map(p => p.id), ['3,0']);
});

test('停在错侧、刚离开边界、地图尽头不能开区且无副作用', () => {
  const g = new GameState(storage());
  for (const [x, z, cx, cz] of [[15.2, -0.8, 2, 0], [12, 3, 2, 0], [15.2, 3, -3, 0], [15.2, 3, 4, 0]]) {
    g.state.player = { x, y: 0, z };
    const before = g.exportSave();
    assert.equal(g.reclaim(cx, cz).ok, false);
    assert.equal(g.exportSave(), before);
  }
});
