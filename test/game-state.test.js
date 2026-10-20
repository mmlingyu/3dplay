import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState, createInitialState } from '../src/game-state.js';
import { STORAGE_KEY, DAMAGED_BACKUP_KEY, terrainHeight, isProtectedCell } from '../src/game-data.js';
import { FLORA_SITES } from '../src/life-data.js';
import { inPoolReservedArea } from '../src/water-data.js';

class MemoryStorage {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, value); }
}

test('球玩具状态可保存，旧 v1 缺省兼容，错误数据不替换世界', () => {
  const game = new GameState(new MemoryStorage());
  const old = createInitialState(); delete old.toys;
  assert.ok(game.importSave(JSON.stringify(old)).ok);
  assert.deepEqual(game.state.toys, []);
  const saved = createInitialState();
  saved.toys = [{ id: 'ball-1', x: -4, y: .22, z: 5, vx: 1, vy: 0, vz: 0 }];
  assert.ok(game.importSave(JSON.stringify(saved)).ok);
  assert.deepEqual(game.state.toys, saved.toys);
  saved.toys[0].x = 1000;
  assert.equal(game.importSave(JSON.stringify(saved)).ok, false);
  assert.equal(game.state.toys[0].x, -4);
});

test('存档恢复建筑、箱子、角色、工坊和园地，离线不推进', () => {
  const storage = new MemoryStorage();
  const game = new GameState(storage);
  game.addItem('chest', 1);
  const { id } = game.placeBlock('chest', { x: -2, y: 0, z: 1 });
  game.depositChest(id, 'wood', 2);
  game.startKiln();
  game.plant('plot-3');
  game.tick(7);
  game.mutate(state => { state.player = { x: -3.5, y: 0, z: 2.5 }; state.settings.sound = false; });
  const snapshot = JSON.parse(game.exportSave());
  const restored = new GameState(storage);
  assert.deepEqual(restored.state, snapshot);
  assert.equal(restored.state.kiln.elapsed, 7);
  assert.equal(restored.state.garden[2].age, 7);
  assert.equal(restored.state.chests[id].wood, 2);
  assert.equal(restored.state.settings.sound, false);
});

test('坏存档不覆盖当前世界，重复建筑与错误工坊阶段被拒绝', () => {
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, '{ broken');
  const game = new GameState(storage);
  assert.deepEqual(game.state, createInitialState());
  const before = game.exportSave();
  const invalid = createInitialState();
  invalid.inventory.wood = -1;
  assert.equal(game.importSave(JSON.stringify(invalid)).ok, false);
  assert.equal(game.exportSave(), before);
  invalid.inventory.wood = 4;
  invalid.kiln = { stage: 'ready', elapsed: 2, count: 2, mode: 'normal' };
  assert.equal(game.importSave(JSON.stringify(invalid)).ok, false);
  invalid.kiln = createInitialState().kiln;
  invalid.blocks = [{ id: 'block-1', item: 'wood', x: 0, y: 0, z: 0, rotation: 0 }, { id: 'block-2', item: 'wood', x: 0, y: 0, z: 0, rotation: 0 }];
  assert.equal(game.importSave(JSON.stringify(invalid)).ok, false);
});

test('损坏原文成功备份前禁止自动覆盖，无法本地保存时明确提示导出', () => {
  const storage = new MemoryStorage();
  const original = '{ original damaged world';
  storage.setItem(STORAGE_KEY, original);
  const normalSetItem = storage.setItem.bind(storage);
  let blockBackup = true;
  storage.setItem = (key, value) => {
    if (blockBackup && key === DAMAGED_BACKUP_KEY) throw new Error('quota');
    normalSetItem(key, value);
  };
  const game = new GameState(storage);
  game.harvest('wood');
  assert.equal(storage.getItem(STORAGE_KEY), original);
  assert.equal(game.save().ok, false);
  assert.match(game.storageError, /导出/);
  blockBackup = false;
  assert.equal(game.save().ok, true);
  assert.equal(storage.getItem(DAMAGED_BACKUP_KEY), original);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).inventory.wood, 6);
  assert.deepEqual(new GameState(storage).state, game.state);
  const temporary = new GameState(null);
  assert.equal(temporary.save().ok, false);
  assert.match(temporary.storageError, /刷新或关闭页面后不会恢复/);
});

test('格子配方可平移，每种摆法只对应一样结果，失败不扣材料', () => {
  const game = new GameState(null);
  const shifted = [[null, null, null], [null, 'plank', 'plank'], [null, 'plank', 'plank']];
  assert.deepEqual(game.getMatches(shifted).map(recipe => recipe.id), ['workbench']);
  const before = game.state.inventory.plank;
  const balls = game.state.inventory.ball;
  assert.equal(game.craft(shifted).ok, true);
  assert.equal(game.state.inventory.plank, before - 4);
  assert.equal(game.state.inventory.workbench, 1);
  assert.equal(game.craft([['plank', 'plank']]).ok, true);
  assert.equal(game.state.inventory.ball, balls + 1);
  assert.equal(game.craft([['plank']], 'sticks').ok, true);
  assert.equal(game.state.inventory.stick, 2);
  game.mutate(state => { state.inventory.plank = 0; });
  const noMaterials = game.exportSave();
  assert.equal(game.craft(shifted, 'workbench').ok, false);
  assert.equal(game.exportSave(), noMaterials);
});

test('建筑必须连接、空位、界内；撤回与挖回箱子完整返还', () => {
  const game = new GameState(null);
  const original = game.state.inventory.plank;
  assert.equal(game.placeBlock('plank', { x: 0, y: 2, z: 0 }).ok, false);
  assert.equal(game.placeBlock('plank', { x: 16, y: 0, z: 0 }).ok, false);
  assert.equal(game.placeBlock('plank', { x: -9, y: 0, z: -7 }).ok, false);
  assert.equal(isProtectedCell(4, 2), true);
  assert.equal(isProtectedCell(9, 5), true);
  assert.equal(isProtectedCell(-12, -1), true);
  assert.equal(isProtectedCell(9, -5), true);
  assert.equal(isProtectedCell(9, -1), true);
  assert.equal(isProtectedCell(-4.4, 13.5), false);
  assert.equal(isProtectedCell(-4.2, 20.2), true);
  const lower = game.placeBlock('plank', { x: 0, y: 0, z: 0 });
  assert.equal(lower.ok, true);
  assert.equal(game.placeBlock('plank', { x: 0, y: 0, z: 0 }).ok, false);
  assert.equal(game.placeBlock('plank', { x: 0, y: 1, z: 0 }).ok, true);
  assert.equal(game.undo().ok, true);
  assert.equal(game.state.inventory.plank, original - 1);
  assert.equal(game.removeBlock(lower.id).ok, true);
  assert.equal(game.state.inventory.plank, original);
  assert.equal(game.undo().ok, true);
  assert.equal(game.state.inventory.plank, original - 1);
  game.addItem('chest', 1);
  const chest = game.placeBlock('chest', { x: 1, y: 0, z: 0 });
  const wood = game.state.inventory.wood;
  game.depositChest(chest.id, 'wood', 3);
  game.removeBlock(chest.id);
  assert.equal(game.state.inventory.chest, 1);
  assert.equal(game.state.inventory.wood, wood);
  assert.equal(game.state.chests[chest.id], undefined);
  assert.equal(game.undo().ok, true);
  assert.equal(game.state.chests[chest.id].wood, 3);
  assert.equal(game.state.inventory.wood, wood - 3);
  assert.equal(game.withdrawChest('__proto__', 'wood').ok, false);
  assert.equal(terrainHeight(4, 0), -1);
  assert.equal(game.placeBlock('stone', { x: 4, y: -1, z: 0 }).ok, true);
});

test('错误答题不扣材料，正确订单只领取一次，采集完全不需要答题', () => {
  const storage = new MemoryStorage();
  const game = new GameState(storage);
  const before = game.exportSave();
  assert.equal(game.rewardOrder('road-6-minus-4', { item: 'wood', count: 2 }, false).ok, false);
  assert.equal(game.exportSave(), before);
  assert.equal(game.rewardOrder('road-6-minus-4', { item: 'wood', count: 2 }).ok, true);
  const rewarded = game.state.inventory.wood;
  assert.equal(new GameState(storage).rewardOrder('road-6-minus-4', { item: 'wood', count: 2 }).ok, false);
  assert.equal(game.harvest('wood').ok, true);
  assert.equal(game.state.inventory.wood, rewarded + 2);
  assert.equal(game.harvest('brick').ok, false);
});

test('制砖先消耗黏土与燃料，经过四阶段并冷却才能取出；试样不耗原料', () => {
  const game = new GameState(null);
  const clay = game.state.inventory.clay;
  const branch = game.state.inventory.branch;
  assert.equal(game.startKiln(2).ok, true);
  assert.equal(game.state.inventory.clay, clay - 2);
  assert.equal(game.state.inventory.branch, branch - 1);
  assert.equal(game.claimKiln().ok, false);
  for (const stage of ['drying', 'firing', 'cooling', 'ready']) {
    game.tick(6);
    assert.equal(game.state.kiln.stage, stage);
  }
  assert.equal(game.state.inventory.brick, 0);
  assert.equal(game.claimKiln().ok, true);
  assert.equal(game.state.inventory.brick, 2);
  assert.equal(game.claimKiln().ok, false);
  for (const mode of ['wet', 'fastCooling']) {
    const materials = { clay: game.state.inventory.clay, branch: game.state.inventory.branch };
    assert.equal(game.startKiln(2, mode).ok, true);
    game.update(24);
    assert.equal(game.state.kiln.stage, 'failed');
    assert.equal(game.claimKiln().item, 'shard');
    assert.deepEqual({ clay: game.state.inventory.clay, branch: game.state.inventory.branch }, materials);
  }
  assert.equal(game.state.inventory.shard, 4);
});

test('干土和积水阻碍生长，移栽到好排水园地恢复；收获留种可循环', () => {
  const game = new GameState(null);
  assert.equal(game.plant('plot-1').ok, true);
  game.water('plot-1');
  game.water('plot-1');
  assert.equal(game.state.garden[0].moisture, 3);
  game.tick(40);
  assert.equal(game.state.garden[0].age, 0);
  assert.equal(game.transplant('plot-1', 'plot-3').ok, true);
  game.tick(8);
  assert.equal(game.state.garden[2].moisture, 2);
  assert.equal(game.state.garden[2].age, 0);
  game.tick(90);
  assert.equal(game.state.garden[2].age, 90);
  const seeds = game.state.inventory.seed;
  assert.equal(game.harvestPlant('plot-3').ok, true);
  assert.equal(game.state.inventory.bean, 2);
  assert.equal(game.state.inventory.seed, seeds + 1);
  assert.equal(game.plant('plot-3').ok, true);
  game.mutate(state => { state.garden[2].moisture = 0; });
  game.tick(200);
  assert.equal(game.state.garden[2].age, 0);
  assert.equal(game.state.garden[2].planted, true);
  game.water('plot-3');
  game.tick(60);
  assert.equal(game.state.garden[2].age, 60);
  game.tick(30);
  assert.equal(game.state.garden[2].age, 60);
});

test('小数帧累计为整秒，暂停及重新加载不增加加工时间', () => {
  const storage = new MemoryStorage();
  const game = new GameState(storage);
  game.startKiln();
  for (let i = 0; i < 60; i++) game.tick(1 / 60);
  assert.equal(game.state.kiln.elapsed, 1);
  const restored = new GameState(storage);
  assert.equal(restored.state.kiln.elapsed, 1);
  restored.tick(0);
  assert.equal(restored.state.kiln.elapsed, 1);
});

test('游戏时钟与花序暖季循环；季节不阻断菜豆普通生产', () => {
  const game = new GameState(null);
  game.tick(100);
  assert.equal(game.state.clock.elapsed,100);
  assert.equal(game.state.flora[0].age,100);
  game.tick(140);
  assert.equal(game.state.flora[0].age,0);
  game.tick(1200);
  assert.equal(game.state.clock.elapsed,1440);
  assert.equal(game.state.flora[0].age,0);
  game.tick(100);
  assert.equal(game.state.flora[0].age,0,'秋季花序停长，根和叶仍保留');
  game.plant('plot-3');game.water('plot-3');game.tick(90);
  assert.equal(game.state.garden[2].age,90);
  assert.ok(game.harvestPlant('plot-3').ok);
});

test('生命存档兼容旧 v1，错误字段拒绝，重载不计算离线时间', () => {
  const storage=new MemoryStorage(),game=new GameState(storage);
  const old=createInitialState();delete old.clock;delete old.flora;
  assert.ok(game.importSave(JSON.stringify(old)).ok);
  assert.deepEqual(game.state.clock,{elapsed:0});
  assert.ok(game.state.flora.length>0);
  game.tick(100);
  const restored=new GameState(storage);
  assert.deepEqual(restored.state.clock,game.state.clock);
  assert.deepEqual(restored.state.flora,game.state.flora);
  for(const mutate of [
    s=>{s.clock.elapsed=-1;},s=>{s.clock.elapsed=Infinity;},
    s=>{s.flora[0].species='unknown';},s=>{s.flora[1].id=s.flora[0].id;},
    s=>{s.flora[0].age=240;},
  ]){
    const save=createInitialState();mutate(save);
    assert.equal(restored.importSave(JSON.stringify(save)).ok,false);
    assert.equal(restored.state.clock.elapsed,100);
  }
});

test('野花各自按全日照、半阴和建筑遮挡推进，取走遮挡后恢复',()=>{
  const game=new GameState(null),site=FLORA_SITES[0];
  const shadeIndex=FLORA_SITES.findIndex(p=>p.shade&&!inPoolReservedArea(p.x,p.z));
  assert.ok(shadeIndex>=0);
  game.tick(100);
  assert.equal(game.state.flora[0].age,100);
  assert.equal(game.state.flora[shadeIndex].age,50);
  for(let i=0;i<FLORA_SITES.length;i++)if(inPoolReservedArea(FLORA_SITES[i].x,FLORA_SITES[i].z))assert.equal(game.state.flora[i].age,0,'泳池下不生长花序');
  assert.ok(game.placeBlock('plank',{x:site.x,z:site.z,y:terrainHeight(site.x,site.z),rotation:0}).ok);
  game.tick(10);assert.equal(game.state.flora[0].age,100);
  assert.ok(game.removeBlock(game.state.blocks[0].id).ok);
  game.tick(10);assert.equal(game.state.flora[0].age,110);
});

test('升级生命字段前备份有效旧世界，备份失败不覆盖原文',()=>{
  const old=createInitialState();delete old.clock;delete old.flora;
  const text=JSON.stringify(old),storage=new MemoryStorage();storage.setItem(STORAGE_KEY,text);
  const game=new GameState(storage);game.tick(1);
  assert.equal(storage.getItem(`${STORAGE_KEY}-before-life`),text);
  const blocked={getItem:key=>key===STORAGE_KEY?text:null,setItem:key=>{throw new Error(`拒绝${key}`);}};
  const g=new GameState(blocked);assert.equal(g.save().ok,false);
  assert.equal(blocked.getItem(STORAGE_KEY),text);
});

test('开垦相邻区块扩大建造范围并保存，非法或不连通区块拒绝',()=>{
  const storage=new MemoryStorage(),g=new GameState(storage);
  assert.equal(typeof g.reclaim,'function');
  assert.equal(g.placeBlock('plank',{x:18,z:2,y:0}).ok,false);
  assert.equal(g.reclaim(3,0).ok,false);
  assert.equal(g.reclaim(2,0).ok,false);
  g.state.player={x:15.2,y:0,z:2};
  assert.ok(g.reclaim(2,0).ok);
  assert.equal(g.reclaim(2,0).ok,false);
  assert.ok(g.placeBlock('plank',{x:18,z:2,y:0}).ok);
  const restored=new GameState(storage);
  assert.deepEqual(restored.state.land,g.state.land);
  assert.equal(restored.state.blocks[0].x,18);
  const bad=JSON.parse(g.exportSave());bad.land.opened=['3,0'];
  assert.equal(g.importSave(JSON.stringify(bad)).ok,false);
  assert.equal(g.state.blocks[0].x,18);
  assert.equal(g.reclaim(4,0).ok,false);
});

test('新区随机发现可领奖、旧世界保持，重复与重载不能重复领奖',()=>{
  const storage=new MemoryStorage(),g=new GameState(storage);
  g.state.player={x:15.2,y:0,z:2};
  g.reclaim(2,0);
  assert.equal(typeof g.claimEncounter,'function');
  const id='encounter-2,0',before=JSON.stringify(g.state.inventory);
  assert.ok(g.claimEncounter(id).ok);
  assert.notEqual(JSON.stringify(g.state.inventory),before);
  assert.equal(g.claimEncounter(id).ok,false);
  const restored=new GameState(storage);
  assert.equal(restored.claimEncounter(id).ok,false);
  assert.equal(restored.claimEncounter('encounter-3,0').ok,false);
  const bad=JSON.parse(restored.exportSave());bad.land.claimed.push('unknown');
  assert.equal(restored.importSave(JSON.stringify(bad)).ok,false);
});

test('围好的屋子用一片屋顶盖住，没围好只盖一格，旧存档仍是一格', () => {
  const game = new GameState(null);
  game.addItem('fence', 20);
  game.addItem('roof', 2);
  for (let x = -1; x <= 2; x++) for (let z = -8; z <= -5; z++) {
    if (x === -1 || x === 2 || z === -8 || z === -5) assert.equal(game.placeBlock('fence', { x, y: 0, z }).ok, true);
  }
  const covered = game.placeBlock('roof', { x: 0, y: 0, z: -7 });
  assert.equal(covered.ok, true);
  assert.equal(covered.block.w, 2);
  assert.equal(covered.block.d, 2);
  assert.equal(covered.block.x, 0);
  assert.equal(covered.block.z, -7);
  assert.equal(game.state.inventory.roof, 1);
  assert.equal(game.placeBlock('plank', { x: 1, y: 0, z: -6 }).ok, true);
  const removed = game.removeBlock(covered.block.id);
  assert.equal(removed.ok, true);
  assert.match(removed.message, /整片屋顶/);
  assert.equal(game.state.inventory.roof, 2);
  const open = game.placeBlock('roof', { x: 0, y: 0, z: 2 });
  assert.equal(open.block.w, 1);
  assert.equal(open.block.d, 1);
  const saved = JSON.parse(game.exportSave());
  const roof = saved.blocks.find(block => block.item === 'roof');
  delete roof.w; delete roof.d;
  const again = new GameState(null);
  assert.equal(again.importSave(JSON.stringify(saved)).ok, true);
  assert.equal(again.state.blocks.find(block => block.item === 'roof').w, 1);
});

test('先放屋顶再围墙，屋顶会变大；拆开围墙就变小，木板墙也同样', () => {
  const game = new GameState(null);
  game.addItem('plank', 30);
  game.addItem('roof', 1);
  const early = game.placeBlock('roof', { x: 0, y: 0, z: -7 });
  assert.equal(early.block.w, 1);
  let last = null;
  for (let x = -1; x <= 2; x++) for (let z = -8; z <= -5; z++) {
    if (x === -1 || x === 2 || z === -8 || z === -5) last = game.placeBlock('plank', { x, y: 0, z });
  }
  const roof = game.state.blocks.find(block => block.item === 'roof');
  assert.equal(roof.w, 2);
  assert.equal(roof.d, 2);
  assert.equal(last.ok, true);
  const gap = game.state.blocks.find(block => block.item === 'plank' && block.x === -1 && block.z === -6);
  const opened = game.removeBlock(gap.id);
  assert.match(opened.message, /变小/);
  assert.equal(game.state.blocks.find(block => block.item === 'roof').w, 1);
  const closed = game.placeBlock('plank', { x: -1, y: 0, z: -6 });
  assert.equal(game.state.blocks.find(block => block.item === 'roof').w, 2);
  assert.match(closed.message, /变大/);
  assert.equal(game.undo().ok, true);
  assert.equal(game.state.blocks.find(block => block.item === 'roof').w, 1);
});
