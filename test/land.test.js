import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState, createInitialState } from '../src/game-state.js';
import { ITEMS, STORAGE_KEY, LAND_BACKUP_KEY } from '../src/game-data.js';
import { createLand, encounterForChunk, frontierChunks, FACILITY_CHUNKS, LAND_RULES, isPointOpen, openChunks } from '../src/land-data.js';

const storageFor = text => {
  const data = new Map(text ? [[STORAGE_KEY, text]] : []);
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};
const standAtBoundary=(g,p)=>{
  const [dx,dz]=[[-1,0],[1,0],[0,-1],[0,1]].find(([x,z])=>openChunks(g.state.land).has(`${p.cx+x},${p.cz+z}`));
  const s=LAND_RULES.chunkSize;
  g.state.player={x:(p.cx+.5+dx/2)*s+dx*.8,y:0,z:(p.cz+.5+dz/2)*s+dz*.8};
};

test('全部48个新区稳定生成三类发现，默认种子的补给与边界固定', () => {
  const g = new GameState(storageFor()), kinds = new Set(), advanced = new Set();
  while (frontierChunks(g.state.land).length) {
    const p = frontierChunks(g.state.land)[0];
    standAtBoundary(g,p);
    assert.ok(g.reclaim(p.cx, p.cz).ok);
    const e = encounterForChunk(g.state.land, p.id);
    assert.deepEqual(e, encounterForChunk(JSON.parse(g.exportSave()).land, p.id));
    assert.ok(isPointOpen(g.state.land, e.x, e.z, 1));
    kinds.add(e.kind);
    for (const [item, count] of Object.entries(e.rewards)) {
      assert.ok(Object.hasOwn(ITEMS, item));
      assert.ok(Number.isSafeInteger(count) && count > 0);
      if (e.kind === 'treasure') advanced.add(item);
    }
    const before = { ...g.state.inventory };
    assert.ok(g.claimEncounter(e.id).ok);
    for (const [item, count] of Object.entries(e.rewards)) assert.equal(g.state.inventory[item], before[item] + count);
    assert.equal(g.claimEncounter(e.id).ok, false);
  }
  assert.equal(g.state.land.opened.length, LAND_RULES.maxNewChunks - FACILITY_CHUNKS.length);
  assert.deepEqual([...kinds].sort(), ['animal', 'plant', 'treasure']);
  assert.deepEqual([...advanced].sort(), ['chest', 'plank', 'workbench']);
  assert.equal(g.reclaim(4, 0).ok, false);
  assert.equal(g.reclaim(-5, 0).ok, false);
  assert.equal(g.importSave(g.exportSave()).ok, true);
  assert.equal(g.state.land.claimed.length, LAND_RULES.maxNewChunks - FACILITY_CHUNKS.length);
  assert.equal(isPointOpen(createLand(), -4.2, 20.2), true);
  assert.equal(isPointOpen(g.state.land, 40, 0), false);
});

test('不同有效种子的宝箱配置覆盖四类已有加工物体', () => {
  const items = new Set();
  for (let seed = 1; seed <= 16; seed++) {
    for (let x = -4; x <= 3; x++) for (let z = -4; z <= 3; z++) {
      const e = encounterForChunk({ seed }, `${x},${z}`);
      if (e.kind === 'treasure') for (const item of Object.keys(e.rewards)) items.add(item);
    }
  }
  assert.deepEqual([...items].sort(), ['chest', 'plank', 'ramp', 'workbench']);
});

test('领取超库存上限不部分发奖或标记领取，非法区块不替换世界', () => {
  const g = new GameState(storageFor());
  standAtBoundary(g,{cx:2,cz:0});
  g.reclaim(2, 0);
  const e = encounterForChunk(g.state.land, '2,0');
  const item = Object.keys(e.rewards)[0];
  g.mutate(s => { s.inventory[item] = 1000000; });
  const before = g.exportSave();
  assert.equal(g.claimEncounter(e.id).ok, false);
  assert.equal(g.exportSave(), before);
  for (const land of [
    { ...createLand(), opened: ['2,0', '2,0'] },
    { ...createLand(), opened: ['4,0'] },
    { ...createLand(), opened: ['2,0'], claimed: [e.id, e.id] },
    { ...createLand(), seed: -1 },
  ]) {
    const bad = JSON.parse(before); bad.land = land;
    assert.equal(g.importSave(JSON.stringify(bad)).ok, false);
    assert.equal(g.exportSave(), before);
  }
});

test('扩图升级保留旧世界原文和既有备份，缺领取字段也可恢复', () => {
  const old = createInitialState(); delete old.land;
  old.blocks = [{ id: 'block-1', item: 'plank', x: 0, y: 0, z: 0, rotation: 0 }];
  const text = JSON.stringify(old), storage = storageFor(text);
  storage.setItem(LAND_BACKUP_KEY, 'earlier world');
  const g = new GameState(storage);
  assert.deepEqual(g.state.land, createLand());
  assert.deepEqual(g.state.blocks, [{ ...old.blocks[0], w: 1, d: 1 }]);
  standAtBoundary(g,{cx:2,cz:0});
  assert.ok(g.reclaim(2, 0).ok);
  assert.equal(storage.getItem(LAND_BACKUP_KEY), 'earlier world');
  assert.equal(storage.getItem(`${LAND_BACKUP_KEY}-1`), text);
  assert.equal(g.getLegacyBackup(), text);
  const beforeClaim = JSON.parse(g.exportSave()); delete beforeClaim.land.claimed;
  const upgraded = new GameState(storageFor(JSON.stringify(beforeClaim)));
  assert.deepEqual(upgraded.state.land.claimed, []);
  assert.ok(upgraded.save().ok);
  const blocked = { getItem: key => key === STORAGE_KEY ? text : null, setItem: () => { throw new Error('quota'); } };
  const failed = new GameState(blocked);
  assert.equal(failed.save().ok, false);
  assert.equal(blocked.getItem(STORAGE_KEY), text);
});
