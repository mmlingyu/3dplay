import { ITEMS, RECIPES, COLLECTABLE_ITEMS } from './game-data.js';
import {
  CATALOG_VERSION, CREATION_LIMITS as L, TRUTH_MODES, PALETTE, SHAPES, AXES, JOINTS, PART_TAGS, CAPABILITIES,
  STAMPS, MATERIAL_SOURCES, BASE_PART_TYPES, OBJECT_TEMPLATES, FIGURE_LIMITS, FIGURE_TEMPLATES, FIGURE_KEYWORDS,
  GENERIC_FIGURE, FIGURE_ANIMS, TEST_FIELD, unknownFigure, figureFromLook, lookFacts,
} from './creation-data.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const copy = value => JSON.parse(JSON.stringify(value));
const round = value => Math.round(value * 1000) / 1000;
const ID_RE = /^[a-zA-Z][a-zA-Z0-9-]{0,31}$/;
const CUSTOM_ID_RE = /^ai-[a-z0-9-]{2,30}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

class RuleError extends Error {}
const bad = message => { throw new RuleError(message); };

export function cleanText(value, max = L.textLength) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f<>`]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}
function text(value, label, max = L.textLength, required = true) {
  const result = cleanText(value, max);
  if (required && !result) bad(`${label}不能为空`);
  return result;
}
function num(value, label, min, max) {
  if (!Number.isFinite(value) || value < min || value > max) bad(`${label}超出范围 ${min}~${max}`);
  return round(value);
}
function vec(value, label, limit = L.coordinate) {
  if (!Array.isArray(value) || value.length !== 3) bad(`${label}必须是三个数字`);
  return value.map((v, i) => num(v, `${label}[${i}]`, -limit, limit));
}
function color(value, label) {
  if (typeof value === 'string' && (Object.hasOwn(PALETTE, value) || HEX_RE.test(value))) return value;
  bad(`${label}的颜色只能用调色板名称或 #rrggbb`);
}
function list(value, label, max) {
  if (!Array.isArray(value)) bad(`${label}必须是列表`);
  if (value.length > max) bad(`${label}最多 ${max} 项`);
  return value;
}

export function resolveColor(value) {
  return PALETTE[value] || value || PALETTE.plank;
}

// ---------- geometry DSL ----------

export function validateShape(raw, label = '形状') {
  if (!isRecord(raw) || !SHAPES.includes(raw.shape)) bad(`${label}的 shape 必须是 ${SHAPES.join('/')}`);
  const shape = { shape: raw.shape, at: vec(raw.at ?? [0, 0, 0], `${label}.at`), color: color(raw.color, label) };
  if (raw.rot !== undefined) shape.rot = vec(raw.rot, `${label}.rot`, 180);
  const size = v => num(v, `${label}尺寸`, L.minSize, L.maxSize);
  const axis = () => { if (!AXES.includes(raw.axis ?? 'y')) bad(`${label}.axis 只能是 x/y/z`); return raw.axis ?? 'y'; };
  if (raw.shape === 'box') {
    if (!Array.isArray(raw.size) || raw.size.length !== 3) bad(`${label}.size 必须是三个数字`);
    shape.size = raw.size.map(size);
  } else if (raw.shape === 'cylinder' || raw.shape === 'cone') {
    shape.radius = size(raw.radius); shape.length = size(raw.length); shape.axis = axis();
  } else if (raw.shape === 'torus') {
    shape.radius = size(raw.radius); shape.tube = num(raw.tube, `${label}.tube`, 0.005, 0.5); shape.axis = axis();
  } else {
    shape.radius = size(raw.radius);
    if (raw.scale !== undefined) {
      if (!Array.isArray(raw.scale) || raw.scale.length !== 3) bad(`${label}.scale 必须是三个数字`);
      shape.scale = raw.scale.map(v => num(v, `${label}.scale`, 0.2, 4));
    }
  }
  return shape;
}

// ---------- items and recipes ----------

const producers = new Map();
for (const recipe of RECIPES) if (!producers.has(recipe.output.item)) producers.set(recipe.output.item, recipe);

export function isObtainable(item, seen = new Set()) {
  if (!Object.hasOwn(ITEMS, item)) return false;
  if (COLLECTABLE_ITEMS.includes(item)) return true;
  const recipe = producers.get(item);
  if (!recipe || seen.has(item)) return false;
  seen.add(item);
  return recipe.pattern.flat().filter(Boolean).every(input => isObtainable(input, new Set(seen)));
}

function recipeInputs(recipe) {
  const inputs = {};
  for (const item of recipe.pattern.flat()) if (item) inputs[item] = (inputs[item] || 0) + 1;
  return inputs;
}

// ---------- part types ----------

export function validatePartType(raw, { custom = true } = {}) {
  const label = `部件 ${raw?.id ?? '?'}`;
  if (!isRecord(raw)) bad('部件定义必须是对象');
  if (custom ? !CUSTOM_ID_RE.test(raw.id) : !ID_RE.test(raw.id)) bad(`${label}的 id 必须形如 ai-xxx（小写字母、数字、短横线）`);
  const tags = list(raw.tags ?? [], `${label}.tags`, 4).map(tag => { if (!PART_TAGS.includes(tag)) bad(`${label}的标签 ${tag} 不在白名单`); return tag; });
  const geometry = list(raw.geometry, `${label}.geometry`, L.shapesPerPart).map((s, i) => validateShape(s, `${label}.geometry[${i}]`));
  if (!geometry.length) bad(`${label}至少需要一个形状`);
  const portIds = new Set();
  const ports = list(raw.ports, `${label}.ports`, L.portsPerPart).map((p, i) => {
    if (!isRecord(p) || !ID_RE.test(p.id) || portIds.has(p.id)) bad(`${label}.ports[${i}] 的 id 无效或重复`);
    if (!Object.hasOwn(JOINTS, p.joint)) bad(`${label}.ports[${i}] 的 joint 只能是 ${Object.keys(JOINTS).join('/')}`);
    if (!['plug', 'socket'].includes(p.gender)) bad(`${label}.ports[${i}] 的 gender 只能是 plug/socket`);
    portIds.add(p.id);
    return { id: p.id, joint: p.joint, gender: p.gender, at: vec(p.at, `${label}.ports[${i}].at`), label: text(p.label ?? p.id, '接口名称', 12) };
  });
  if (!ports.length) bad(`${label}至少需要一个接口`);
  const materials = list(raw.materials, `${label}.materials`, 3).map((m, i) => {
    if (!isRecord(m) || !Object.hasOwn(ITEMS, m.item)) bad(`${label}.materials[${i}] 使用了河谷里没有的材料`);
    if (!isObtainable(m.item)) bad(`${label}.materials[${i}] 的${ITEMS[m.item].name}没有普通取得办法`);
    if (!Number.isInteger(m.count) || m.count < 1 || m.count > 6) bad(`${label}.materials[${i}] 数量必须是 1~6`);
    return { item: m.item, count: m.count };
  });
  if (!materials.length) bad(`${label}至少需要一种材料`);
  if (!Object.hasOwn(TRUTH_MODES, raw.truthMode)) bad(`${label}.truthMode 必须是 ${Object.keys(TRUTH_MODES).join('/')}`);
  return {
    id: raw.id, name: text(raw.name, `${label}名称`, 10), tags, geometry, ports, materials,
    truthMode: raw.truthMode, realNote: text(raw.realNote, `${label}的现实说明`),
  };
}

const BASE_BY_ID = new Map(BASE_PART_TYPES.map(type => [type.id, type]));
export function partCatalog(customTypes = []) {
  const catalog = new Map(BASE_BY_ID);
  for (const type of customTypes) catalog.set(type.id, type);
  return catalog;
}

// ---------- blueprint graph ----------

function rotateY([x, y, z], degrees) {
  const t = degrees * Math.PI / 180, c = Math.round(Math.cos(t)), s = Math.round(Math.sin(t));
  return [x * c + z * s, y, -x * s + z * c];
}
export function portWorld(slot, type, portId) {
  const port = type.ports.find(p => p.id === portId);
  if (!port) return null;
  const local = rotateY(port.at, slot.rotY || 0);
  return slot.at.map((v, i) => round(v + local[i]));
}

export function normalizeBlueprint(raw, catalog) {
  if (!isRecord(raw)) bad('blueprint 必须是对象');
  const ids = new Set();
  const parts = list(raw.parts, 'blueprint.parts', L.partsPerBlueprint).map((p, i) => {
    if (!isRecord(p) || !ID_RE.test(p.id) || ids.has(p.id)) bad(`blueprint.parts[${i}] 的 id 无效或重复`);
    if (!catalog.has(p.typeId)) bad(`blueprint.parts[${i}] 的部件类型 ${p.typeId} 不存在`);
    const rotY = p.rotY ?? 0;
    if (![0, 90, 180, 270].includes(rotY)) bad(`blueprint.parts[${i}].rotY 只能是 0/90/180/270`);
    ids.add(p.id);
    return { id: p.id, typeId: p.typeId, at: vec(p.at, `blueprint.parts[${i}].at`), rotY };
  });
  if (!parts.length) bad('blueprint 至少需要一个部件');
  const jointIds = new Set();
  const joints = list(raw.joints ?? [], 'blueprint.joints', L.jointsPerBlueprint).map((j, i) => {
    if (!isRecord(j) || !ID_RE.test(j.id) || jointIds.has(j.id)) bad(`blueprint.joints[${i}] 的 id 无效或重复`);
    jointIds.add(j.id);
    const end = side => {
      if (!isRecord(side) || typeof side.part !== 'string' || typeof side.port !== 'string') bad(`blueprint.joints[${i}] 的连接端格式不对`);
      return { part: side.part, port: side.port };
    };
    return { id: j.id, a: end(j.a), b: end(j.b) };
  });
  const capabilities = list(raw.capabilities ?? [], 'blueprint.capabilities', 6).map(id => { if (!Object.hasOwn(CAPABILITIES, id)) bad(`能力 ${id} 还没有实现`); return id; });
  return { name: text(raw.name, '作品名称', L.titleLength), parts, joints, capabilities: [...new Set(capabilities)] };
}

export function blueprintProblems(bp, catalog) {
  const problems = [];
  const slots = new Map(bp.parts.map(p => [p.id, p]));
  const used = new Set();
  for (const j of bp.joints) {
    const sa = slots.get(j.a.part), sb = slots.get(j.b.part);
    if (!sa || !sb) { problems.push(`连接 ${j.id} 指向不存在的部件`); continue; }
    if (sa === sb) { problems.push(`连接 ${j.id} 不能把部件连到自己`); continue; }
    const ta = catalog.get(sa.typeId), tb = catalog.get(sb.typeId);
    const pa = ta.ports.find(p => p.id === j.a.port), pb = tb.ports.find(p => p.id === j.b.port);
    if (!pa || !pb) { problems.push(`连接 ${j.id} 用了不存在的接口`); continue; }
    if (pa.joint !== pb.joint) problems.push(`连接 ${j.id}：${ta.name}的${pa.label}是${JOINTS[pa.joint].label}，${tb.name}的${pb.label}是${JOINTS[pb.joint].label}，对不上`);
    if (pa.gender === pb.gender) problems.push(`连接 ${j.id}：两个接口都是${pa.gender === 'plug' ? '插头' : '插孔'}，插不进去`);
    for (const key of [`${sa.id}.${pa.id}`, `${sb.id}.${pb.id}`]) { if (used.has(key)) problems.push(`接口 ${key} 被连了两次`); used.add(key); }
    const wa = portWorld(sa, ta, pa.id), wb = portWorld(sb, tb, pb.id);
    const gap = Math.hypot(wa[0] - wb[0], wa[1] - wb[1], wa[2] - wb[2]);
    if (gap > L.portTolerance) problems.push(`连接 ${j.id}：${ta.name}和${tb.name}的接口相距 ${round(gap)} 格，没有挨在一起`);
  }
  const adjacency = adjacencyOf(bp);
  const seen = new Set([bp.parts[0].id]);
  const queue = [bp.parts[0].id];
  while (queue.length) for (const next of adjacency.get(queue.shift()) || []) if (!seen.has(next)) { seen.add(next); queue.push(next); }
  const loose = bp.parts.filter(p => !seen.has(p.id));
  if (loose.length) problems.push(`有部件没连上：${loose.map(p => catalog.get(p.typeId).name).join('、')}`);
  return problems;
}

function adjacencyOf(bp, filled = null) {
  const adjacency = new Map(bp.parts.map(p => [p.id, []]));
  for (const j of bp.joints) {
    if (filled && (!filled.has(j.a.part) || !filled.has(j.b.part))) continue;
    adjacency.get(j.a.part)?.push(j.b.part);
    adjacency.get(j.b.part)?.push(j.a.part);
  }
  return adjacency;
}

// ---------- capabilities and experiments ----------

function tagsOf(slot, catalog) { return catalog.get(slot.typeId)?.tags || []; }

function connectedJointFor(bp, catalog, filled, slotId, jointKind) {
  return bp.joints.find(j => {
    const end = j.a.part === slotId ? j.a : j.b.part === slotId ? j.b : null;
    if (!end || !filled.has(j.a.part) || !filled.has(j.b.part)) return false;
    const type = catalog.get(bp.parts.find(p => p.id === slotId).typeId);
    return type.ports.find(p => p.id === end.port)?.joint === jointKind;
  });
}

export function capabilityStatus(bp, catalog, filled = new Set(bp.parts.map(p => p.id))) {
  const slots = bp.parts.filter(p => filled.has(p.id));
  const tagged = tag => slots.filter(s => tagsOf(s, catalog).includes(tag));
  const joined = (tag, kind) => tagged(tag).filter(s => connectedJointFor(bp, catalog, filled, s.id, kind));
  const wheels = joined('wheel', 'revolute');
  const status = {};
  status.roll = wheels.length >= 2 ? { ok: true, wheels: wheels.length } : { ok: false, reason: `需要至少两个装在转动轴上的轮子，现在有 ${wheels.length} 个` };
  const steerJoint = bp.joints.find(j => filled.has(j.a.part) && filled.has(j.b.part) && catalog.get(bp.parts.find(p => p.id === j.a.part).typeId).ports.find(p => p.id === j.a.port)?.joint === 'steer');
  let steerOk = false;
  if (steerJoint) {
    const plugIsA = catalog.get(bp.parts.find(p => p.id === steerJoint.a.part).typeId).ports.find(p => p.id === steerJoint.a.port).gender === 'plug';
    const start = plugIsA ? steerJoint.a.part : steerJoint.b.part, blocked = plugIsA ? steerJoint.b.part : steerJoint.a.part;
    const adjacency = adjacencyOf(bp, filled), seen = new Set([start]), queue = [start];
    while (queue.length) for (const next of adjacency.get(queue.shift()) || []) if (next !== blocked && !seen.has(next)) { seen.add(next); queue.push(next); }
    steerOk = wheels.some(w => seen.has(w.id));
  }
  if (!steerOk && tagged('steering').length && status.roll.ok) steerOk = true;
  status.steer = steerOk ? { ok: true } : { ok: false, reason: '需要转向轴带着轮子，或装好方向盘' };
  const crank = joined('crank', 'revolute'), chain = joined('chain', 'drive');
  status.pedal = crank.length && chain.length && status.roll.ok ? { ok: true } : { ok: false, reason: '需要脚踏、链条和能滚的轮子都装好' };
  status.spin = joined('blade', 'revolute').length ? { ok: true } : { ok: false, reason: '需要把叶片装到转动轴上' };
  const stone = slots.reduce((n, s) => n + (catalog.get(s.typeId).materials.find(m => m.item === 'stone')?.count || 0), 0);
  const wood = slots.reduce((n, s) => n + catalog.get(s.typeId).materials.filter(m => ['plank', 'stick', 'wood'].includes(m.item)).reduce((a, m) => a + m.count, 0), 0);
  status.float = tagged('hull').length ? (stone > wood ? { ok: false, reason: '石头太多，比水重，会沉下去' } : { ok: true }) : { ok: false, reason: '需要严实的船身' };
  status.sit = tagged('sittable').length || tagged('seat').length ? { ok: true } : { ok: false, reason: '还没有能坐的地方' };
  status.light = tagged('light').filter(s => connectedJointFor(bp, catalog, filled, s.id, 'fixed')).length ? { ok: true } : { ok: false, reason: '需要把车灯装到车上' };
  return status;
}

export function runExperiment(bp, catalog, filled, capability) {
  if (!Object.hasOwn(CAPABILITIES, capability)) return { ok: false, text: '这个实验还没有做好。' };
  const status = capabilityStatus(bp, catalog, filled)[capability];
  const info = CAPABILITIES[capability];
  if (!status.ok) return { ok: false, capability, text: `${info.label}没成功：${status.reason}。` };
  const texts = {
    roll: `${status.wheels} 个轮子都绕着轴转，推一下滚了 ${TEST_FIELD.rollDistance} 格。`,
    steer: '转一下方向，前轮偏过去，车子拐弯了。',
    pedal: '踩脚踏，链条带着后轮转，车子自己往前走。',
    spin: '风吹过来，叶片绕着轴呼呼转。',
    float: '放进水里，船身浮起来了。',
    sit: '坐上去试试，稳稳的。',
    light: '打开车灯，前面亮起来了。',
  };
  return { ok: true, capability, text: texts[capability], note: info.note, truthMode: info.truthMode };
}

// Assembly order follows the connection graph: a part needs a filled neighbour.
export function attachProblem(bp, catalog, filled, slotId) {
  const slot = bp.parts.find(p => p.id === slotId);
  if (!slot) return '图纸上没有这个位置。';
  if (filled.has(slotId)) return '这个位置已经装好了。';
  if (!filled.size) return null;
  const neighbours = bp.joints.filter(j => j.a.part === slotId || j.b.part === slotId).map(j => j.a.part === slotId ? j.b.part : j.a.part);
  if (neighbours.some(id => filled.has(id))) return null;
  const names = [...new Set(neighbours.map(id => catalog.get(bp.parts.find(p => p.id === id).typeId).name))];
  return `${catalog.get(slot.typeId).name}要接在${names.join('或') || '别的部件'}上，先装那个吧。`;
}
export function detachProblem(bp, filled, slotId) {
  if (!filled.has(slotId)) return '这个位置是空的。';
  const rest = new Set([...filled].filter(id => id !== slotId));
  if (rest.size <= 1) return null;
  const adjacency = adjacencyOf(bp, rest), start = [...rest][0], seen = new Set([start]), queue = [start];
  while (queue.length) for (const next of adjacency.get(queue.shift()) || []) if (!seen.has(next)) { seen.add(next); queue.push(next); }
  return seen.size === rest.size ? null : '拿走它，别的部件就散开了。先取下外面连着的部件。';
}
export function assemblyOrder(bp) {
  const adjacency = adjacencyOf(bp), order = [bp.parts[0].id], seen = new Set(order);
  for (let i = 0; i < order.length; i++) for (const next of adjacency.get(order[i]) || []) if (!seen.has(next)) { seen.add(next); order.push(next); }
  return order;
}

// ---------- materials ----------

export function partTypeCounts(bp) {
  const counts = {};
  for (const p of bp.parts) counts[p.typeId] = (counts[p.typeId] || 0) + 1;
  return counts;
}

export function planMaterials(needTypes, catalog, inventory) {
  const required = {};
  for (const [typeId, count] of Object.entries(needTypes)) {
    if (count <= 0) continue;
    for (const m of catalog.get(typeId).materials) required[m.item] = (required[m.item] || 0) + m.count * count;
  }
  const stock = { ...inventory };
  const steps = [];
  const raw = {};
  const expand = (item, count, depth) => {
    if (depth > 6) return false;
    const have = Math.min(stock[item] || 0, count);
    stock[item] = (stock[item] || 0) - have;
    let missing = count - have;
    if (!missing) return true;
    if (COLLECTABLE_ITEMS.includes(item)) { raw[item] = (raw[item] || 0) + missing; return true; }
    const recipe = producers.get(item);
    if (!recipe) return false;
    const batches = Math.ceil(missing / recipe.output.count);
    steps.push({ recipeId: recipe.id, name: recipe.name, item, batches, inputs: recipeInputs(recipe), output: recipe.output });
    stock[item] += batches * recipe.output.count - missing;
    return Object.entries(recipeInputs(recipe)).every(([input, n]) => expand(input, n * batches, depth + 1));
  };
  let valid = true;
  for (const [item, count] of Object.entries(required)) valid = expand(item, count, 0) && valid;
  const requirements = Object.entries(required).map(([item, count]) => ({ item, name: ITEMS[item].name, required: count, available: inventory[item] || 0, missing: Math.max(0, count - (inventory[item] || 0)) }));
  const gather = Object.entries(raw).map(([item, count]) => ({ item, name: ITEMS[item].name, count, ...MATERIAL_SOURCES[item] }));
  const status = !valid ? 'no-valid-source' : requirements.some(r => r.missing) ? 'needs-materials' : 'ready';
  // Reversed expansion puts inputs before the recipes that consume them; repeats of one recipe merge into its earliest step.
  const merged = [];
  for (const step of steps.reverse()) {
    const same = merged.find(s => s.recipeId === step.recipeId);
    if (same) same.batches += step.batches; else merged.push({ ...step });
  }
  return { requirements, steps: merged, gather, status };
}

// ---------- figures ----------

export function validateFigure(raw) {
  if (!isRecord(raw)) bad('figure 必须是对象');
  const ids = new Set();
  let shapes = 0;
  const parts = list(raw.parts, 'figure.parts', FIGURE_LIMITS.parts).map((p, i) => {
    if (!isRecord(p) || !ID_RE.test(p.id) || ids.has(p.id)) bad(`figure.parts[${i}] 的 id 无效或重复`);
    if (p.parent !== null && p.parent !== undefined && !ids.has(p.parent)) bad(`figure.parts[${i}] 的 parent 必须是前面出现过的部位`);
    const anim = p.anim ?? 'none';
    if (!Object.hasOwn(FIGURE_ANIMS, anim)) bad(`figure.parts[${i}].anim 只能是 ${Object.keys(FIGURE_ANIMS).join('/')}`);
    const partShapes = list(p.shapes, `figure.parts[${i}].shapes`, FIGURE_LIMITS.shapes).map((s, k) => validateShape(s, `figure.parts[${i}].shapes[${k}]`));
    shapes += partShapes.length;
    ids.add(p.id);
    return { id: p.id, parent: p.parent ?? null, pivot: vec(p.pivot ?? [0, 0, 0], `figure.parts[${i}].pivot`), anim, shapes: partShapes };
  });
  if (!parts.length || !shapes) bad('figure 至少需要一个形状');
  if (shapes > FIGURE_LIMITS.shapes) bad(`figure 最多 ${FIGURE_LIMITS.shapes} 个形状`);
  return { name: text(raw.name, '造物名称', L.titleLength), scale: num(raw.scale ?? 1, 'figure.scale', FIGURE_LIMITS.minScale, FIGURE_LIMITS.maxScale), parts };
}

// ---------- routing and local analysis ----------

function matchTemplate(templates, haystack) {
  let best = null, bestLength = 0;
  for (const template of templates) for (const word of template.keywords) {
    if (haystack.includes(word.toLowerCase()) && word.length > bestLength) { best = template; bestLength = word.length; }
  }
  return { template: best, length: bestLength };
}

export function routeIdea({ title = '', idea = '', stamps = [] } = {}) {
  const haystack = `${title} ${idea}`.toLowerCase();
  const machine = matchTemplate(OBJECT_TEMPLATES, haystack);
  const creature = matchTemplate(FIGURE_TEMPLATES, haystack);
  if (machine.template && machine.length >= creature.length) return { kind: 'assembly', template: machine.template };
  if (creature.template) return { kind: 'figure', template: creature.template };
  if (FIGURE_KEYWORDS.some(word => haystack.includes(word))) return { kind: 'figure', template: null };
  if (stamps.length) return { kind: 'assembly', template: null };
  return { kind: 'unknown', template: null };
}

function stampCounts(stamps) {
  const counts = {};
  for (const s of stamps) { const type = STAMPS[s.type]?.partType; if (type) counts[type] = (counts[type] || 0) + 1; }
  return counts;
}

export function analyzeLocal(draft) {
  const route = routeIdea(draft);
  const title = cleanText(draft.title, L.titleLength) || cleanText(draft.idea, L.titleLength) || '我的发明';
  if (route.kind === 'figure') {
    const figure = copy(route.template?.figure || GENERIC_FIGURE);
    figure.name = route.template ? figure.name : title;
    return {
      schemaVersion: 1, kind: 'figure', source: 'local', templateId: route.template?.id || 'generic', title,
      summary: route.template ? `${route.template.reason}先用河谷的样子捏一个，发明家小屋会照着你的画再修一修。` : '这是一个造物。先捏一个河谷小伙伴，发明家小屋会照着你的画重新塑形。',
      figure, notes: [{ mode: 'fantasy', text: '这是摆件模型，不会吃东西、长大，也不是真的动物。' }], questions: [],
    };
  }
  if (route.kind === 'assembly' && route.template) {
    const template = route.template, drawn = stampCounts(draft.stamps || []);
    const remaining = { ...drawn };
    const recognized = [], coreAdditions = [];
    for (const slot of template.blueprint.parts) {
      if (remaining[slot.typeId] > 0) { remaining[slot.typeId]--; recognized.push(slot.id); }
      else if (template.core[slot.id]) coreAdditions.push({ slot: slot.id, reason: template.core[slot.id] });
    }
    const catalog = partCatalog();
    const counts = partTypeCounts(template.blueprint);
    return {
      schemaVersion: 1, kind: 'assembly', source: 'local', templateId: template.id, title,
      summary: `看起来是${template.name}。${template.reason}`,
      recognized: Object.entries(counts).map(([typeId, count]) => ({ label: catalog.get(typeId).name, partTypeId: typeId, count, from: (drawn[typeId] || 0) > 0 ? 'sketch' : 'real-object' })),
      coreAdditions, newPartTypes: [], blueprint: { ...copy(template.blueprint), name: `我的${template.name}` },
      notes: [...new Set(template.blueprint.parts.map(p => p.typeId))].map(id => catalog.get(id)).filter(t => t.truthMode !== 'reality-grounded').slice(0, 4).map(t => ({ mode: t.truthMode, text: `${t.name}：${t.realNote}` })),
      questions: [],
    };
  }
  if (route.kind === 'assembly') {
    const drawn = stampCounts(draft.stamps || []);
    return {
      schemaVersion: 1, kind: 'assembly', source: 'local', templateId: null, title, summary: '图上的部件找到了，但还不知道它们怎么连在一起。',
      recognized: Object.entries(drawn).map(([typeId, count]) => ({ label: partCatalog().get(typeId).name, partTypeId: typeId, count, from: 'sketch' })),
      coreAdditions: [], newPartTypes: [], blueprint: null, notes: [],
      questions: ['它是用来做什么的？在想法里写一写，或者请发明家小屋帮忙看看。'],
    };
  }
  const figure = unknownFigure(draft, title);
  const person = figure.parts.some(part => part.id === 'head');
  return {
    schemaVersion: 1, kind: 'figure', source: 'local', templateId: 'unknown', title,
    summary: person
      ? `目录里还没有「${title}」。本机先捏了一个会站着的小人，颜色照你的画；可以放进背包，再摆到河谷里。`
      : `目录里还没有「${title}」。本机先按名字和画的颜色捏了一个摆件，可以放进背包。`,
    figure, notes: [{ mode: 'fantasy', text: '这是照名字和画捏的摆件，不是照片里的原样，也不会真的打架或干活。' }], questions: [],
  };
}

const LOOK_KINDS = new Set(['humanoid', 'creature', 'object']);

function tintFigure(figure, look) {
  const targets = [look.main, look.accent, look.extra].filter(color => typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color));
  const map = new Map();
  for (const part of figure.parts) for (const shape of part.shapes) {
    if (shape.color === 'dark' || map.has(shape.color) || map.size >= targets.length) continue;
    map.set(shape.color, targets[map.size]);
  }
  for (const part of figure.parts) for (const shape of part.shapes) if (map.has(shape.color)) shape.color = map.get(shape.color);
}

function describeLook(look) {
  const summary = cleanText(look.summary, 120);
  const marks = lookFacts(look).marks.filter(mark => mark && !summary.includes(mark));
  if (!marks.length) return summary || '图像模型看出了这张画。';
  const lead = marks.join('、');
  return `${lead}。${summary}`.replace(/。{2,}/g, '。').slice(0, 120);
}

export function proposalFromLook(draft, look) {
  const seen = isRecord(look) ? look : {};
  const title = cleanText(seen.name, L.titleLength) || cleanText(draft.title, L.titleLength) || cleanText(draft.idea, L.titleLength) || '我的发明';
  const kind = LOOK_KINDS.has(seen.kind) ? seen.kind : 'object';
  const summary = describeLook(seen) || `图像模型看出这是「${title}」。`;
  const facts = lookFacts(seen);
  const shaped = facts.bits.length > 0 || facts.wings > 0 || [...facts.features].some(item => ['armor', 'joints', 'thruster', 'visor', 'claws', 'gear', 'pipes', 'wings', 'wheels', 'cape'].includes(item));
  const route = routeIdea({ title, idea: `${draft.idea || ''} ${draft.title || ''}`, stamps: draft.stamps || [] });
  if (kind === 'object' && route.kind === 'assembly' && route.template) {
    const proposal = analyzeLocal({ ...draft, title, idea: draft.idea || title });
    proposal.summary = summary;
    proposal.source = 'engine';
    return proposal;
  }
  if (kind === 'creature' && route.kind === 'figure' && route.template && !shaped) {
    const proposal = analyzeLocal({ ...draft, title, idea: '' });
    proposal.title = title;
    proposal.figure.name = title;
    proposal.summary = summary;
    proposal.source = 'engine';
    tintFigure(proposal.figure, seen);
    return proposal;
  }
  const figure = figureFromLook({ ...seen, name: title, kind });
  return {
    schemaVersion: 1, kind: 'figure', source: 'engine', templateId: 'vision', title, summary, figure,
    notes: [{ mode: 'fantasy', text: '图像模型只根据这张画和你写的想法认出来，摆件不会真的动起来干活。' }],
    questions: [],
  };
}

// ---------- proposals from the engine ----------

export function validateProposal(raw, { customTypes = [] } = {}) {
  const errors = [];
  try {
    if (!isRecord(raw) || raw.schemaVersion !== 1) bad('proposal.schemaVersion 必须是 1');
    if (!['assembly', 'figure'].includes(raw.kind)) bad('proposal.kind 必须是 assembly 或 figure');
    const base = {
      schemaVersion: 1, kind: raw.kind, source: raw.source === 'local' ? 'local' : 'engine', title: text(raw.title, '标题', L.titleLength),
      summary: text(raw.summary, '说明', 120),
      notes: list(raw.notes ?? [], 'notes', L.listLength).map((n, i) => { if (!isRecord(n) || !Object.hasOwn(TRUTH_MODES, n.mode)) bad(`notes[${i}].mode 无效`); return { mode: n.mode, text: text(n.text, `notes[${i}]`) }; }),
      questions: list(raw.questions ?? [], 'questions', 3).map((q, i) => text(q, `questions[${i}]`)),
    };
    if (typeof raw.templateId === 'string') base.templateId = cleanText(raw.templateId, 32);
    if (raw.kind === 'figure') return { ok: true, errors, proposal: { ...base, figure: validateFigure(raw.figure) } };
    const newPartTypes = list(raw.newPartTypes ?? [], 'newPartTypes', 6).map(t => validatePartType(t));
    const ids = new Set();
    for (const t of newPartTypes) { if (ids.has(t.id) || BASE_BY_ID.has(t.id)) bad(`新部件 ${t.id} 重名`); ids.add(t.id); }
    const catalog = partCatalog([...customTypes.filter(t => !ids.has(t.id)), ...newPartTypes]);
    const blueprint = normalizeBlueprint(raw.blueprint, catalog);
    errors.push(...blueprintProblems(blueprint, catalog));
    const status = capabilityStatus(blueprint, catalog);
    for (const cap of blueprint.capabilities) if (!status[cap].ok) errors.push(`请求的能力“${CAPABILITIES[cap].label}”做不到：${status[cap].reason}`);
    const used = new Set(blueprint.parts.map(p => p.typeId));
    for (const t of newPartTypes) if (!used.has(t.id)) errors.push(`新部件 ${t.id} 没有出现在图纸里`);
    const slotIds = new Set(blueprint.parts.map(p => p.id));
    const coreAdditions = list(raw.coreAdditions ?? [], 'coreAdditions', L.partsPerBlueprint).map((c, i) => {
      if (!isRecord(c) || !slotIds.has(c.slot)) bad(`coreAdditions[${i}].slot 必须是图纸里的部件 id`);
      return { slot: c.slot, reason: text(c.reason, `coreAdditions[${i}].reason`) };
    });
    const recognized = list(raw.recognized ?? [], 'recognized', L.partsPerBlueprint).map((r, i) => {
      if (!isRecord(r) || !catalog.has(r.partTypeId)) bad(`recognized[${i}].partTypeId 不存在`);
      if (!['sketch', 'idea', 'real-object'].includes(r.from)) bad(`recognized[${i}].from 只能是 sketch/idea/real-object`);
      return { label: text(r.label, `recognized[${i}].label`, 12), partTypeId: r.partTypeId, count: num(r.count, `recognized[${i}].count`, 1, L.partsPerBlueprint), from: r.from };
    });
    return { ok: errors.length === 0, errors, proposal: { ...base, recognized, coreAdditions, newPartTypes, blueprint } };
  } catch (error) {
    if (!(error instanceof RuleError)) throw error;
    errors.push(error.message);
    return { ok: false, errors, proposal: null };
  }
}

// ---------- saved creation domain ----------

export function createCreation() {
  return { schemaVersion: 1, catalogVersion: CATALOG_VERSION, nextId: 1, settings: { engine: true, vision: 'local' }, drafts: [], partTypes: [], blueprints: [], parts: [], assemblies: [], figures: [], transactions: [] };
}

function validateDraft(d, i) {
  if (!isRecord(d) || !/^draft-[1-9]\d*$/.test(d.id)) bad(`草稿 ${i} 编号不正确`);
  const strokes = list(d.strokes ?? [], '草稿笔画', L.strokes).map(s => {
    if (!isRecord(s) || !HEX_RE.test(s.c) || !Number.isFinite(s.w) || s.w < 1 || s.w > 24) bad('草稿笔画格式不正确');
    const points = list(s.p, '笔画点', L.pointsPerStroke).map(p => { if (!Array.isArray(p) || p.length !== 2 || !p.every(v => Number.isFinite(v) && v >= 0 && v <= 1)) bad('笔画点超出画板'); return [round(p[0]), round(p[1])]; });
    return { c: s.c, w: s.w, p: points };
  });
  const stamps = list(d.stamps ?? [], '草稿贴纸', L.stamps).map(s => {
    if (!isRecord(s) || !Object.hasOwn(STAMPS, s.type) || ![s.x, s.y].every(v => Number.isFinite(v) && v >= 0 && v <= 1)) bad('贴纸格式不正确');
    return { type: s.type, x: round(s.x), y: round(s.y) };
  });
  const draft = { id: d.id, title: cleanText(d.title, L.titleLength), idea: cleanText(d.idea, L.ideaLength), strokes, stamps };
  if (isRecord(d.engine) && typeof d.engine.runId === 'string' && /^[a-f0-9]{8,32}$/.test(d.engine.runId)) draft.engine = { runId: d.engine.runId };
  return draft;
}

export function normalizeDraft(raw) {
  try { return { ok: true, draft: validateDraft(raw, 0) }; }
  catch (error) { if (error instanceof RuleError) return { ok: false, message: error.message }; throw error; }
}

export function validateCreation(raw) {
  if (raw === undefined) return createCreation();
  try {
    if (!isRecord(raw) || raw.schemaVersion !== 1) bad('创作存档版本不支持');
    const next = createCreation();
    if (!isRecord(raw.settings) || typeof raw.settings.engine !== 'boolean') bad('创作设置不正确');
    next.settings = { engine: raw.settings.engine, vision: raw.settings.vision === 'cloud' ? 'cloud' : 'local' };
    next.drafts = list(raw.drafts, '草稿', L.drafts).map(validateDraft);
    next.partTypes = list(raw.partTypes, '自定义部件', L.customPartTypes).map(t => validatePartType(t));
    const catalog = partCatalog(next.partTypes);
    const ids = new Set();
    const unique = (id, re, label) => { if (typeof id !== 'string' || !re.test(id) || ids.has(id)) bad(`${label}编号不正确`); ids.add(id); return id; };
    next.blueprints = list(raw.blueprints, '图纸', L.blueprints).map(b => {
      if (!isRecord(b)) bad('图纸格式不正确');
      const bp = normalizeBlueprint(b, catalog);
      const problems = blueprintProblems(bp, catalog);
      if (problems.length) bad(`图纸不完整：${problems[0]}`);
      return { id: unique(b.id, /^bp-[1-9]\d*$/, '图纸'), source: b.source === 'engine' ? 'engine' : 'local', ...bp, coreAdditions: Array.isArray(b.coreAdditions) ? b.coreAdditions.filter(c => isRecord(c) && bp.parts.some(p => p.id === c.slot)).slice(0, L.partsPerBlueprint).map(c => ({ slot: c.slot, reason: cleanText(c.reason) })) : [], assetId: typeof b.assetId === 'string' ? cleanText(b.assetId, 40) : null };
    });
    const bpById = new Map(next.blueprints.map(b => [b.id, b]));
    next.assemblies = list(raw.assemblies, '作品', L.assemblies).map(a => {
      if (!isRecord(a) || !bpById.has(a.blueprintId) || !['lab', 'world'].includes(a.status)) bad('作品格式不正确');
      let world = null;
      if (a.status === 'world') {
        if (!isRecord(a.world) || !Number.isFinite(a.world.x) || !Number.isFinite(a.world.z)) bad('作品位置不正确');
        world = { x: round(a.world.x), z: round(a.world.z) };
      }
      const experiments = list(a.experiments ?? [], '实验记录', L.experimentsKept).map(e => {
        if (!isRecord(e) || !Object.hasOwn(CAPABILITIES, e.capability) || typeof e.ok !== 'boolean') bad('实验记录不正确');
        return { capability: e.capability, ok: e.ok, text: cleanText(e.text, 120) };
      });
      return { id: unique(a.id, /^asm-[1-9]\d*$/, '作品'), blueprintId: a.blueprintId, status: a.status, world, experiments };
    });
    const asmById = new Map(next.assemblies.map(a => [a.id, a]));
    const occupied = new Set();
    next.parts = list(raw.parts, '部件', L.partInstances).map(p => {
      if (!isRecord(p) || !catalog.has(p.typeId)) bad('部件类型不正确');
      const part = { id: unique(p.id, /^part-[1-9]\d*$/, '部件'), typeId: p.typeId, owner: 'bag', slot: null };
      if (p.owner !== 'bag') {
        const asm = asmById.get(p.owner), slot = asm && bpById.get(asm.blueprintId).parts.find(s => s.id === p.slot);
        if (!slot || slot.typeId !== p.typeId || occupied.has(`${p.owner}.${p.slot}`)) bad('部件装在不存在或已占用的位置');
        occupied.add(`${p.owner}.${p.slot}`);
        part.owner = p.owner; part.slot = p.slot;
      }
      return part;
    });
    for (const a of next.assemblies) if (a.status === 'world') {
      const bp = bpById.get(a.blueprintId);
      if (!bp.parts.every(s => occupied.has(`${a.id}.${s.id}`))) bad('放在河谷里的作品缺了部件');
    }
    next.figures = list(raw.figures, '造物', 24).map(f => {
      if (!isRecord(f)) bad('造物格式不正确');
      let placed = null;
      if (f.placed !== null && f.placed !== undefined) {
        if (!isRecord(f.placed) || !Number.isFinite(f.placed.x) || !Number.isFinite(f.placed.z) || !Number.isFinite(f.placed.rotY ?? 0)) bad('造物位置不正确');
        placed = { x: round(f.placed.x), z: round(f.placed.z), rotY: round(f.placed.rotY ?? 0) };
      }
      return { id: unique(f.id, /^fig-[1-9]\d*$/, '造物'), figure: validateFigure(f.figure), placed, assetId: typeof f.assetId === 'string' ? cleanText(f.assetId, 40) : null };
    });
    next.transactions = list(raw.transactions ?? [], '事务记录', L.transactionsKept).filter(t => typeof t === 'string' && t.length <= 64);
    const maxId = Math.max(0, ...[...ids].map(id => Number(id.split('-').pop())), ...next.drafts.map(d => Number(d.id.split('-').pop())));
    next.nextId = Math.max(maxId + 1, Number.isSafeInteger(raw.nextId) && raw.nextId > 0 ? raw.nextId : 1);
    return next;
  } catch (error) {
    if (error instanceof RuleError) throw new Error(`创作存档：${error.message}`);
    throw error;
  }
}

export function catalogSnapshot() {
  return {
    catalogVersion: CATALOG_VERSION,
    limits: L, figureLimits: FIGURE_LIMITS,
    truthModes: TRUTH_MODES, palette: PALETTE, shapes: SHAPES, joints: JOINTS, tags: PART_TAGS,
    capabilities: CAPABILITIES, figureAnims: FIGURE_ANIMS, stamps: STAMPS,
    items: Object.fromEntries(Object.entries(ITEMS).map(([id, item]) => [id, { name: item.name, obtainable: isObtainable(id), collectable: COLLECTABLE_ITEMS.includes(id), description: item.description }])),
    recipes: RECIPES.map(r => ({ id: r.id, name: r.name, inputs: recipeInputs(r), output: r.output })),
    sources: MATERIAL_SOURCES,
    partTypes: BASE_PART_TYPES,
    objectTemplates: OBJECT_TEMPLATES.map(t => ({ id: t.id, name: t.name, keywords: t.keywords, reason: t.reason, blueprint: t.blueprint, core: t.core })),
    figureTemplates: FIGURE_TEMPLATES.map(t => ({ id: t.id, name: t.name, keywords: t.keywords, figure: t.figure })),
  };
}
