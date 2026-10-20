import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState, createInitialState } from '../src/game-state.js';
import { STORAGE_KEY } from '../src/game-data.js';
import { analyzeLocal } from '../src/creation-rules.js';

class MemoryStorage {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, value); }
}

const partsIn = (game, owner) => game.state.creation.parts.filter(p => p.owner === owner).length;

test('汽车完整闭环：画图 → 方案 → 加工 → 做部件 → 拼装 → 实验 → 实验场 → 拆解 → 重装', () => {
  const storage = new MemoryStorage();
  const game = new GameState(storage);
  const draft = game.saveDraft({ title: '汽车', idea: '想开车去兜风', strokes: [{ c: '#333333', w: 4, p: [[.1, .5], [.9, .5]] }], stamps: [{ type: 'wheel', x: .2, y: .8 }] });
  assert.ok(draft.ok);
  const proposal = analyzeLocal(game.state.creation.drafts[0]);
  const adopted = game.adoptProposal(proposal);
  assert.ok(adopted.ok, adopted.message);
  const bpId = adopted.blueprintId;

  game.state.inventory = { ...game.state.inventory, wood: 0, plank: 0, stick: 0, stone: 0 };
  const plan = game.materialPlan(bpId);
  assert.equal(plan.status, 'needs-materials');
  assert.equal(game.craftParts(bpId, 'tx-1').ok, false);
  assert.equal(game.state.creation.parts.length, 0);

  game.state.inventory.wood = 10; game.state.inventory.stone = 4;
  assert.ok(game.processRecipe('planks').ok);
  while (game.state.inventory.wood > 0) game.processRecipe('planks');
  for (let i = 0; i < 5; i++) game.craft([['plank']], 'sticks');
  assert.equal(game.materialPlan(bpId).status, 'ready');
  const before = { ...game.state.inventory };
  const made = game.craftParts(bpId, 'tx-2');
  assert.ok(made.ok, made.message);
  assert.equal(game.state.creation.parts.length, 12);
  assert.ok(game.state.inventory.plank < before.plank);
  assert.equal(game.craftParts(bpId, 'tx-2').ok, false, '同一个事务不能重复扣料');
  assert.equal(game.craftParts(bpId, 'tx-3').ok, false, '部件够了就不再制作');

  const asm = game.createAssembly(bpId).assemblyId;
  assert.ok(game.attachSlot(asm, 'body').ok);
  assert.equal(game.attachSlot(asm, 'w1').ok, false, '轮子要先等轮轴装好');
  assert.equal(game.deployAssembly(asm).ok, false, '没装完不能出场');
  assert.ok(game.autoAssemble(asm).ok);
  assert.equal(partsIn(game, asm), 12);
  for (const cap of ['roll', 'steer', 'sit', 'light']) assert.equal(game.experiment(asm, cap).ok, true, cap);
  assert.equal(game.experiment(asm, 'spin').ok, false);

  assert.ok(game.deployAssembly(asm).ok);
  assert.equal(game.detachSlot(asm, 'light1').ok, true, '在河谷里也能改装原来的这一件');
  assert.ok(game.attachSlot(asm, 'light1').ok);
  const reloaded = new GameState(storage);
  assert.equal(reloaded.assembly(asm).status, 'world');
  assert.ok(game.recallAssembly(asm).ok);

  assert.equal(game.detachSlot(asm, 'body').ok, false, '拿走车体其它部件会散开');
  assert.ok(game.detachSlot(asm, 'light1').ok);
  const inventoryBefore = JSON.stringify(game.state.inventory);
  assert.ok(game.disassemble(asm).ok);
  assert.equal(partsIn(game, 'bag'), 12, '拆开后部件完整回到背包，不多不少');
  assert.ok(game.autoAssemble(asm).ok);
  assert.equal(partsIn(game, asm), 12);
  assert.equal(JSON.stringify(game.state.inventory), inventoryBefore, '重新组装不再消耗材料');

  const saved = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.equal(saved.creation.parts.length, 12);
});

test('画猫直接生成造物模型，可以放进河谷再收回背包', () => {
  const game = new GameState(new MemoryStorage());
  const result = game.adoptProposal(analyzeLocal({ title: '小猫', idea: '', stamps: [] }));
  assert.ok(result.ok, result.message);
  assert.equal(game.placeFigure(result.figureId, { x: 100, z: 100 }).ok, false);
  assert.ok(game.placeFigure(result.figureId, { x: -4, z: 9.5 }).ok);
  assert.equal(game.deleteFigure(result.figureId).ok, false);
  assert.ok(game.recallFigure(result.figureId).ok);
  assert.ok(game.deleteFigure(result.figureId).ok);
});

test('继续修改改的是原来那一个，位置不变', () => {
  const game = new GameState(new MemoryStorage());
  const adopted = game.adoptProposal(analyzeLocal({ title: '小猫', idea: '', stamps: [] }));
  assert.ok(game.placeFigure(adopted.figureId, { x: -4, z: 4 }).ok);
  const before = game.state.creation.figures.find(f => f.id === adopted.figureId);
  const placed = { ...before.placed };
  const count = before.figure.parts.length;
  const added = game.addPiece(adopted.figureId, { shape: 'sphere', anchor: 'back', size: 'medium', color: '#f0c95c' });
  assert.ok(added.ok, added.message);
  const after = game.state.creation.figures.find(f => f.id === adopted.figureId);
  assert.equal(after.id, adopted.figureId);
  assert.deepEqual(after.placed, placed);
  assert.equal(after.figure.parts.length, count + 1);
  assert.ok(game.recolorFigurePart(adopted.figureId, 'body', '#5b8fd8').ok);
  const live = game.state.creation.figures.find(f => f.id === adopted.figureId);
  assert.ok(live.figure.parts.find(p => p.id === 'body').shapes.every(s => s.color === '#5b8fd8'));
  const editId = game.state.creation.figures.find(f => f.id === adopted.figureId).figure.parts.at(-1).id;
  assert.ok(game.removeFigurePart(adopted.figureId, editId).ok);
  assert.equal(game.state.creation.figures.find(f => f.id === adopted.figureId).figure.parts.length, count);
  assert.equal(game.removeFigurePart(adopted.figureId, 'body').ok, false);
});

test('没有创作域的旧存档照常读取，坏的创作数据不会替换当前世界', () => {
  const game = new GameState(new MemoryStorage());
  const old = createInitialState(); delete old.creation;
  assert.ok(game.importSave(JSON.stringify(old)).ok);
  assert.equal(game.state.creation.settings.engine, true);
  const broken = createInitialState();
  broken.creation.parts = [{ id: 'part-1', typeId: 'rocket', owner: 'bag', slot: null }];
  assert.equal(game.importSave(JSON.stringify(broken)).ok, false);
  assert.equal(game.state.creation.parts.length, 0);
});

test('家长可以关闭发明家小屋', () => {
  const game = new GameState(new MemoryStorage());
  game.setEngineEnabled(false);
  assert.equal(game.state.creation.settings.engine, false);
});
