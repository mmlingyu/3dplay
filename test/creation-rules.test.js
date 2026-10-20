import test from 'node:test';
import assert from 'node:assert/strict';
import { OBJECT_TEMPLATES, FIGURE_TEMPLATES, GENERIC_FIGURE, BASE_PART_TYPES, figureGestures, humanoidFigure, appendPiece, recolorPart, removePart } from '../src/creation-data.js';
import {
  partCatalog, normalizeBlueprint, blueprintProblems, capabilityStatus, validatePartType, validateFigure,
  routeIdea, analyzeLocal, validateProposal, proposalFromLook, planMaterials, partTypeCounts, attachProblem, detachProblem,
  assemblyOrder, runExperiment, validateCreation, createCreation,
} from '../src/creation-rules.js';

const catalog = partCatalog();

test('内置部件都通过白名单校验', () => {
  for (const type of BASE_PART_TYPES) assert.doesNotThrow(() => validatePartType(type, { custom: false }), type.id);
});

for (const template of OBJECT_TEMPLATES) {
  test(`${template.name}模板接口对齐、全部连通、请求的能力都能做到`, () => {
    const bp = normalizeBlueprint(template.blueprint, catalog);
    assert.deepEqual(blueprintProblems(bp, catalog), []);
    const status = capabilityStatus(bp, catalog);
    for (const cap of bp.capabilities) assert.equal(status[cap].ok, true, `${cap}: ${status[cap].reason}`);
  });
}

test('放到场景里的造物按身体给出动作', () => {
  assert.deepEqual(figureGestures(FIGURE_TEMPLATES.find(t => t.id === 'cat').figure), ['hop', 'spin']);
  assert.deepEqual(figureGestures(FIGURE_TEMPLATES.find(t => t.id === 'bird').figure), ['hop', 'spin', 'flap']);
  assert.deepEqual(figureGestures(humanoidFigure({ name: '小人', suit: '#d97a5f' })), ['hop', 'spin', 'wave']);
});

test('在原来的造物上加一块、换颜色、拿掉后加的', () => {
  const base = humanoidFigure({ name: '小人', suit: '#d97a5f' });
  const added = appendPiece(base, { shape: 'cone', anchor: 'head', size: 'small', color: '#5b8fd8' });
  assert.equal(added.parts.at(-1).id, 'edit1');
  assert.equal(added.parts.at(-1).parent, 'head');
  assert.equal(added.name, '小人');
  assert.doesNotThrow(() => validateFigure(added));
  const colored = recolorPart(added, 'head', '#8fb26f');
  assert.ok(colored.parts.find(p => p.id === 'head').shapes.every(s => s.color === '#8fb26f'));
  assert.equal(removePart(colored, 'body'), null);
  assert.equal(removePart(colored, 'head'), null);
  const removed = removePart(colored, 'edit1');
  assert.equal(removed.parts.some(p => p.id === 'edit1'), false);
  assert.equal(removed.parts.length, base.parts.length);
});

test('造物模板都能通过造型校验', () => {
  for (const t of FIGURE_TEMPLATES) assert.doesNotThrow(() => validateFigure(t.figure), t.id);
  assert.doesNotThrow(() => validateFigure(GENERIC_FIGURE));
});

test('画汽车走部件拆解，画猫走造物分支', () => {
  assert.equal(routeIdea({ idea: '我想造一辆汽车' }).template.id, 'car');
  assert.equal(routeIdea({ idea: '一辆自行车' }).template.id, 'bicycle');
  assert.equal(routeIdea({ title: '小猫咪' }).kind, 'figure');
  assert.equal(routeIdea({ idea: '一只恐龙' }).kind, 'figure');
  assert.equal(routeIdea({ idea: '一个东西' }).kind, 'unknown');
});

test('汽车分析拆出轮子、车体、方向盘、座椅、车灯，并补上没画的轮轴', () => {
  const proposal = analyzeLocal({ title: '汽车', idea: '', stamps: [{ type: 'wheel', x: .2, y: .8 }, { type: 'wheel', x: .7, y: .8 }] });
  assert.equal(proposal.kind, 'assembly');
  const names = proposal.recognized.map(r => r.label);
  for (const name of ['轮子', '车体', '方向盘', '座椅', '车灯']) assert.ok(names.includes(name), name);
  assert.ok(proposal.coreAdditions.some(c => c.slot === 'frontAxle'));
  assert.equal(proposal.recognized.find(r => r.partTypeId === 'wheel').from, 'sketch');
  assert.equal(validateProposal(proposal).ok, true);
});

test('没见过的名字也会本机捏出可摆放的造物', () => {
  const hero = analyzeLocal({ title: '奥特曼', idea: '', stamps: [], strokes: [{ c: '#d97a5f', p: [[0, 0], [1, 1]] }] });
  assert.equal(hero.kind, 'figure');
  assert.equal(hero.figure.name, '奥特曼');
  assert.equal(hero.figure.parts.find(p => p.id === 'body').shapes[0].color, '#d97a5f');
  assert.equal(validateProposal(hero).ok, true, validateProposal(hero).errors.join('；'));
  const thing = analyzeLocal({ title: '神秘杯子', idea: '', stamps: [] });
  assert.equal(thing.kind, 'figure');
  assert.equal(thing.figure.name, '神秘杯子');
  assert.equal(validateProposal(thing).ok, true, validateProposal(thing).errors.join('；'));
  assert.equal(routeIdea({ idea: '一个东西' }).kind, 'unknown');
});

test('图像模型认出的特征会做进模型', () => {
  const hero = proposalFromLook(
    { title: '奥特曼', idea: '红色的英雄', stamps: [], strokes: [] },
    { name: '奥特曼', kind: 'humanoid', main: '#d97a5f', accent: '#f0c95c', extra: '#f4d8a5', features: ['crest', 'chest-lamp'], summary: '红色身体，头上有尖角，胸口有一盏灯。' },
  );
  assert.equal(hero.kind, 'figure');
  assert.equal(hero.figure.name, '奥特曼');
  assert.equal(hero.figure.parts.find(p => p.id === 'body').shapes[1].color, '#f0c95c');
  assert.ok(hero.figure.parts.find(p => p.id === 'head').shapes.some(s => s.shape === 'cone'));
  assert.equal(hero.figure.parts.filter(p => p.id.startsWith('arm')).length, 2);
  assert.equal(validateProposal(hero).ok, true, validateProposal(hero).errors.join('；'));
  const four = proposalFromLook(
    { title: '奥特曼', idea: '', stamps: [], strokes: [] },
    { name: '奥特曼', kind: 'humanoid', main: '#d97a5f', accent: '#f0c95c', features: ['crest', 'chest-lamp', 'belt'], details: ['红色头冠', '胸口黄灯'], summary: '红色的英雄。' , arms: 4, legs: 2, eyes: 2 },
  );
  assert.equal(four.figure.parts.filter(p => p.id.startsWith('arm')).length, 4);
  assert.match(four.summary, /4条胳膊/);
  assert.match(four.summary, /腰带/);
  assert.equal(validateProposal(four).ok, true, validateProposal(four).errors.join('；'));
  const written = proposalFromLook(
    { title: '奥特曼', idea: '', stamps: [] },
    { name: '奥特曼', kind: 'humanoid', details: ['四条胳膊', '银色腰带'], summary: '站着的英雄。' },
  );
  assert.equal(written.figure.parts.filter(p => p.id.startsWith('arm')).length, 4);
  const machine = proposalFromLook(
    { title: '奥特曼', idea: '', stamps: [] },
    { name: '奥特曼', kind: 'humanoid', main: '#c0c6d0', accent: '#f0c95c', extra: '#8aa0b8', wings: 4, features: ['wings', 'armor', 'joints', 'thruster', 'visor'], summary: '银色的英雄。' },
  );
  assert.equal(machine.figure.parts.filter(p => p.id.startsWith('wing')).length, 4);
  assert.ok(machine.figure.parts.some(p => p.id.startsWith('thrust')));
  assert.ok(machine.figure.parts.find(p => p.id === 'body').shapes.some(s => s.size?.[1] === 0.16));
  assert.ok(machine.figure.parts.find(p => p.id === 'arm1').shapes.some(s => s.shape === 'cylinder'));
  assert.match(machine.summary, /4只翅膀/);
  assert.match(machine.summary, /装甲/);
  assert.equal(validateProposal(machine).ok, true, validateProposal(machine).errors.join('；'));
  const noted = proposalFromLook(
    { title: '飞侠', idea: '', stamps: [] },
    { name: '飞侠', kind: 'humanoid', details: ['一对翅膀', '机械关节'], summary: '会飞的人。' },
  );
  assert.equal(noted.figure.parts.filter(p => p.id.startsWith('wing')).length, 2);
  const invented = proposalFromLook(
    { title: '泡泡兽', idea: '', stamps: [] },
    { name: '泡泡兽', kind: 'creature', parts: [
      { name: '螺旋壳', shape: 'cone', anchor: 'back', size: 'large', color: 'accent' },
      { name: '眼柄', shape: 'cylinder', anchor: 'head', size: 'small', color: '#88c0d0' },
      { shape: 'pyramid', anchor: 'sky' },
    ], summary: '没见过的生物。' },
  );
  assert.equal(invented.figure.parts.filter(p => p.id.startsWith('bit')).length, 2);
  assert.equal(invented.figure.parts.find(p => p.id === 'bit1').shapes[0].shape, 'cone');
  assert.equal(invented.figure.parts.find(p => p.id === 'bit2').parent, 'head');
  assert.match(invented.summary, /螺旋壳/);
  assert.match(invented.summary, /眼柄/);
  assert.equal(validateProposal(invented).ok, true, validateProposal(invented).errors.join('；'));
  assert.ok(noted.figure.parts.find(p => p.id === 'arm1').shapes.some(s => s.shape === 'cylinder'));
  const rabbit = proposalFromLook({ title: '', idea: '', stamps: [] }, { name: '长耳兽', kind: 'creature', main: '#f3efe6', accent: '#e9a25f', features: ['long-ears', 'tail'], summary: '长长的耳朵和一条尾巴。' });
  assert.equal(rabbit.figure.parts.find(p => p.id === 'ears').shapes[0].length, 0.42);
  assert.ok(rabbit.figure.parts.some(p => p.id === 'tail'));
  const bike = proposalFromLook({ title: '我画的', idea: '', stamps: [] }, { name: '自行车', kind: 'object', features: ['wheels'], summary: '两个轮子的自行车。' });
  assert.equal(bike.kind, 'assembly');
  assert.equal(bike.templateId, 'bicycle');
});

test('猫的本地分析给出可渲染的造型', () => {
  const proposal = analyzeLocal({ title: '我的猫', idea: '', stamps: [] });
  assert.equal(proposal.kind, 'figure');
  const checked = validateProposal(proposal);
  assert.equal(checked.ok, true, checked.errors.join('；'));
  assert.ok(checked.proposal.figure.parts.some(p => p.anim === 'wag'));
});

test('引擎提案：错接、悬空、假材料和做不到的能力都会被拒绝', () => {
  const base = analyzeLocal({ title: '小推车' });
  const wrong = structuredClone(base);
  wrong.blueprint.joints[2].b.port = 'nope';
  assert.equal(validateProposal(wrong).ok, false);
  const floating = structuredClone(base);
  floating.blueprint.parts[3].at = [2, 2, 2];
  assert.match(validateProposal(floating).errors.join(), /没有挨在一起/);
  const fake = structuredClone(base);
  fake.newPartTypes = [{ id: 'ai-rubber', name: '橡胶胎', tags: ['wheel'], geometry: [{ shape: 'sphere', radius: .2, at: [0, 0, 0], color: 'tire' }], ports: [{ id: 'hub', joint: 'revolute', gender: 'socket', at: [0, 0, 0] }], materials: [{ item: 'rubber', count: 1 }], truthMode: 'reality-grounded', realNote: '橡胶' }];
  assert.match(validateProposal(fake).errors.join(), /没有的材料/);
  const cannot = structuredClone(base);
  cannot.blueprint.capabilities.push('spin');
  assert.match(validateProposal(cannot).errors.join(), /做不到/);
  const script = structuredClone(base);
  script.blueprint.parts[0].typeId = 'javascript:alert(1)';
  assert.equal(validateProposal(script).ok, false);
});

test('引擎可以提出新部件，只要材料、接口和位置都真实可用', () => {
  const base = analyzeLocal({ title: '小推车' });
  const proposal = structuredClone(base);
  proposal.source = 'engine';
  proposal.newPartTypes = [{ id: 'ai-bell', name: '车铃', tags: ['decor'], geometry: [{ shape: 'sphere', radius: .08, at: [0, .08, 0], color: 'yellow' }], ports: [{ id: 'base', joint: 'fixed', gender: 'plug', at: [0, 0, 0], label: '铃座' }], materials: [{ item: 'stone', count: 1 }], truthMode: 'game-simplification', realNote: '真实车铃是金属的。' }];
  proposal.blueprint.parts.push({ id: 'bell', typeId: 'ai-bell', at: [0, .61, 0] });
  proposal.blueprint.joints.push({ id: 'j9', a: { part: 'deck', port: 'top' }, b: { part: 'bell', port: 'base' } });
  proposal.coreAdditions.push({ slot: 'bell', reason: '提醒别人让一让。' });
  const result = validateProposal(proposal);
  assert.equal(result.ok, true, result.errors.join('；'));
});

test('材料计划展开到木料并指出采集地点', () => {
  const bp = normalizeBlueprint(OBJECT_TEMPLATES.find(t => t.id === 'car').blueprint, catalog);
  const plan = planMaterials(partTypeCounts(bp), catalog, { plank: 0, stick: 0, wood: 0, stone: 0 });
  assert.equal(plan.status, 'needs-materials');
  assert.ok(plan.steps.some(s => s.recipeId === 'planks'));
  assert.ok(plan.steps.some(s => s.recipeId === 'sticks'));
  assert.deepEqual(plan.gather.map(g => g.item).sort(), ['stone', 'wood']);
  assert.equal(plan.gather.find(g => g.item === 'wood').targetId, 'wood-source');
  const rich = planMaterials(partTypeCounts(bp), catalog, { plank: 99, stick: 99, stone: 99 });
  assert.equal(rich.status, 'ready');
});

test('按连接图拼装：先装能连上的，拆时不能让别的散开', () => {
  const bp = normalizeBlueprint(OBJECT_TEMPLATES.find(t => t.id === 'bicycle').blueprint, catalog);
  const filled = new Set();
  assert.equal(attachProblem(bp, catalog, filled, 'bar'), null);
  filled.add('frame');
  assert.match(attachProblem(bp, catalog, filled, 'bar'), /前叉/);
  for (const id of assemblyOrder(bp)) { assert.equal(attachProblem(bp, catalog, filled, id) && !filled.has(id) ? attachProblem(bp, catalog, filled, id) : null, null); filled.add(id); }
  assert.match(detachProblem(bp, filled, 'fork'), /散开/);
  assert.equal(detachProblem(bp, filled, 'bar'), null);
  assert.equal(runExperiment(bp, catalog, filled, 'pedal').ok, true);
  filled.delete('chain');
  assert.equal(runExperiment(bp, catalog, filled, 'pedal').ok, false);
  assert.equal(runExperiment(bp, catalog, filled, 'steer').ok, true);
  filled.delete('frontWheel');
  assert.equal(runExperiment(bp, catalog, filled, 'roll').ok, false);
});

test('创作存档拒绝重复占位和缺件的河谷作品', () => {
  const blueprint = { id: 'bp-1', source: 'local', ...OBJECT_TEMPLATES.find(t => t.id === 'windmill').blueprint };
  const ok = { ...createCreation(), blueprints: [blueprint], assemblies: [{ id: 'asm-2', blueprintId: 'bp-1', status: 'lab', world: null, experiments: [] }], parts: [{ id: 'part-3', typeId: 'post', owner: 'asm-2', slot: 'post' }], nextId: 4 };
  assert.equal(validateCreation(ok).parts.length, 1);
  assert.throws(() => validateCreation({ ...ok, parts: [...ok.parts, { id: 'part-4', typeId: 'post', owner: 'asm-2', slot: 'post' }] }), /占用/);
  assert.throws(() => validateCreation({ ...ok, assemblies: [{ ...ok.assemblies[0], status: 'world', world: { x: -9, z: 12 } }] }), /缺了部件/);
  assert.equal(validateCreation(undefined).settings.engine, true);
  assert.equal(validateCreation(undefined).settings.vision, 'local');
  const kept = validateCreation(undefined);
  kept.settings.vision = 'cloud';
  assert.equal(validateCreation(kept).settings.vision, 'cloud');
  delete kept.settings.vision;
  assert.equal(validateCreation(kept).settings.vision, 'local');
});
