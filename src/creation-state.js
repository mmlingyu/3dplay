import { ITEMS, RECIPES } from './game-data.js';
import { CREATION_LIMITS as L, CAPABILITIES, TEST_FIELD } from './creation-data.js';
import {
  partCatalog, validateProposal, partTypeCounts, attachProblem, detachProblem, assemblyOrder,
  runExperiment, normalizeDraft, planMaterials, cleanText, validateFigure,
} from './creation-rules.js';
import { appendPiece, recolorPart, removePart } from './creation-data.js';
import { isPointOpen } from './land-data.js';
import { inPoolReservedArea } from './water-data.js';

const ok = (message, extra = {}) => ({ ok: true, message, ...extra });
const fail = message => ({ ok: false, message });
const copy = value => JSON.parse(JSON.stringify(value));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Methods mixed into GameState. Every change goes through one mutate() so a
// failed check never leaves half-consumed materials or half-moved parts.
export const creationMethods = {
  creationCatalog() { return partCatalog(this.state.creation.partTypes); },
  blueprint(id) { return this.state.creation.blueprints.find(b => b.id === id) || null; },
  assembly(id) { return this.state.creation.assemblies.find(a => a.id === id) || null; },
  filledSlots(asmId) { return new Set(this.state.creation.parts.filter(p => p.owner === asmId).map(p => p.slot)); },
  bagParts(typeId = null) { return this.state.creation.parts.filter(p => p.owner === 'bag' && (!typeId || p.typeId === typeId)); },

  setEngineEnabled(enabled) {
    this.mutate(s => { s.creation.settings.engine = Boolean(enabled); });
    return ok(enabled ? '发明家小屋已开启。' : '发明家小屋已关闭，只用本机分析。');
  },

  setVision(mode) {
    const vision = mode === 'cloud' ? 'cloud' : 'local';
    this.mutate(s => { s.creation.settings.vision = vision; });
    return ok(vision === 'cloud' ? '看图改用在线图像模型。' : '看图改用本机 SmolVLM 256。');
  },

  saveDraft(input) {
    const c = this.state.creation;
    const existing = input.id ? c.drafts.find(d => d.id === input.id) : null;
    if (!existing && c.drafts.length >= L.drafts) return fail(`想法本最多放 ${L.drafts} 张，先删掉一张旧的吧。`);
    const id = existing?.id || `draft-${c.nextId}`;
    const checked = normalizeDraft({ ...input, id, engine: existing?.engine });
    if (!checked.ok) return fail(`这张画还不能保存：${checked.message}`);
    this.mutate(s => {
      if (!existing) s.creation.nextId++;
      const list = s.creation.drafts;
      const index = list.findIndex(d => d.id === id);
      if (index >= 0) list[index] = { ...checked.draft, engine: list[index].engine };
      else list.push(checked.draft);
    });
    return ok('想法和画都记下来了。', { id });
  },

  deleteDraft(id) {
    if (!this.state.creation.drafts.some(d => d.id === id)) return fail('没有找到这张草稿。');
    this.mutate(s => { s.creation.drafts = s.creation.drafts.filter(d => d.id !== id); });
    return ok('草稿删掉了，做好的部件和作品都还在。');
  },

  setDraftEngineRun(id, runId) {
    if (!this.state.creation.drafts.some(d => d.id === id)) return fail('没有找到这张草稿。');
    this.mutate(s => {
      const draft = s.creation.drafts.find(d => d.id === id);
      if (runId) draft.engine = { runId }; else delete draft.engine;
    });
    return ok('');
  },

  adoptProposal(proposal, { assetId = null } = {}) {
    const c = this.state.creation;
    const checked = validateProposal(proposal, { customTypes: c.partTypes });
    if (!checked.ok) return fail(`这份方案还有问题：${checked.errors[0]}`);
    const p = checked.proposal;
    if (p.kind === 'figure') {
      if (c.figures.length >= 24) return fail('造物架满了，先把不要的造物收起来删掉。');
      const id = `fig-${c.nextId}`;
      this.mutate(s => { s.creation.nextId++; s.creation.figures.push({ id, figure: p.figure, placed: null, assetId }); });
      return ok(`${p.figure.name}做好了，放进背包啦！`, { figureId: id });
    }
    if (c.blueprints.length >= L.blueprints) return fail(`图纸夹最多放 ${L.blueprints} 张。`);
    const rename = {};
    const additions = [];
    for (const type of p.newPartTypes) {
      const existing = c.partTypes.find(t => t.id === type.id);
      if (existing && same(existing, type)) continue;
      let id = type.id, n = 2;
      while (c.partTypes.some(t => t.id === id) || additions.some(t => t.id === id)) id = `${type.id.slice(0, 28)}-${n++}`;
      rename[type.id] = id;
      additions.push({ ...type, id });
    }
    if (c.partTypes.length + additions.length > L.customPartTypes) return fail('新部件太多了，部件册已经满了。');
    const blueprint = copy(p.blueprint);
    for (const part of blueprint.parts) part.typeId = rename[part.typeId] || part.typeId;
    const id = `bp-${c.nextId}`;
    this.mutate(s => {
      s.creation.nextId++;
      s.creation.partTypes.push(...additions);
      s.creation.blueprints.push({ id, source: p.source, ...blueprint, coreAdditions: p.coreAdditions, assetId });
    });
    return ok(`图纸“${blueprint.name}”放进图纸夹了。`, { blueprintId: id });
  },

  deleteBlueprint(id) {
    const c = this.state.creation;
    if (!this.blueprint(id)) return fail('没有这张图纸。');
    if (c.assemblies.some(a => a.blueprintId === id)) return fail('先把用这张图纸拼的作品拆完，再删除图纸。');
    this.mutate(s => { s.creation.blueprints = s.creation.blueprints.filter(b => b.id !== id); });
    return ok('图纸删除了，部件还在背包里。');
  },

  // Parts still needed for a blueprint after counting bag parts and parts already installed.
  partsNeeded(bpId) {
    const bp = this.blueprint(bpId);
    if (!bp) return {};
    const need = partTypeCounts(bp);
    const asm = this.state.creation.assemblies.find(a => a.blueprintId === bpId);
    const installed = asm ? this.state.creation.parts.filter(p => p.owner === asm.id) : [];
    for (const part of [...installed, ...this.bagParts()]) if (need[part.typeId] > 0) need[part.typeId]--;
    return Object.fromEntries(Object.entries(need).filter(([, n]) => n > 0));
  },

  materialPlan(bpId) {
    return planMaterials(this.partsNeeded(bpId), this.creationCatalog(), this.state.inventory);
  },

  craftParts(bpId, transactionId) {
    const c = this.state.creation;
    if (typeof transactionId !== 'string' || !transactionId || transactionId.length > 64) return fail('这次制作缺少编号，请再点一次。');
    if (c.transactions.includes(transactionId)) return fail('这次制作已经完成过了，不会重复扣材料。');
    if (!this.blueprint(bpId)) return fail('没有这张图纸。');
    const need = this.partsNeeded(bpId);
    const total = Object.values(need).reduce((a, n) => a + n, 0);
    if (!total) return fail('需要的部件都已经有了，可以去拼装了。');
    if (c.parts.length + total > L.partInstances) return fail('部件箱太满了，先拆掉一些不用的作品。');
    const catalog = this.creationCatalog();
    const cost = {};
    for (const [typeId, count] of Object.entries(need)) for (const m of catalog.get(typeId).materials) cost[m.item] = (cost[m.item] || 0) + m.count * count;
    const missing = Object.entries(cost).filter(([item, n]) => this.state.inventory[item] < n);
    if (missing.length) return fail(`还差：${missing.map(([item, n]) => `${ITEMS[item].name}${n - this.state.inventory[item]}份`).join('、')}。看看材料清单去哪里采。`);
    const made = [];
    this.mutate(s => {
      for (const [item, n] of Object.entries(cost)) s.inventory[item] -= n;
      for (const [typeId, count] of Object.entries(need)) for (let i = 0; i < count; i++) {
        const part = { id: `part-${s.creation.nextId++}`, typeId, owner: 'bag', slot: null };
        s.creation.parts.push(part); made.push(part);
      }
      s.creation.transactions = [...s.creation.transactions, transactionId].slice(-L.transactionsKept);
      s.stats.crafted += made.length;
    });
    return ok(`做好了 ${made.length} 个部件：${made.map(p => catalog.get(p.typeId).name).join('、')}。`, { parts: made, cost });
  },

  processRecipe(recipeId) {
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return fail('没有这种加工方法。');
    return this.craft(recipe.pattern, recipeId);
  },

  createAssembly(bpId) {
    const c = this.state.creation;
    if (!this.blueprint(bpId)) return fail('没有这张图纸。');
    const existing = c.assemblies.find(a => a.blueprintId === bpId);
    if (existing) return ok('', { assemblyId: existing.id });
    if (c.assemblies.length >= L.assemblies) return fail(`拼装台最多放 ${L.assemblies} 件作品，先拆掉一件。`);
    const id = `asm-${c.nextId}`;
    this.mutate(s => { s.creation.nextId++; s.creation.assemblies.push({ id, blueprintId: bpId, status: 'lab', world: null, experiments: [] }); });
    return ok('拼装架准备好了。', { assemblyId: id });
  },

  attachSlot(asmId, slotId) {
    const asm = this.assembly(asmId), bp = asm && this.blueprint(asm.blueprintId);
    if (!bp) return fail('没有这件作品。');
    const catalog = this.creationCatalog();
    const problem = attachProblem(bp, catalog, this.filledSlots(asmId), slotId);
    if (problem) return fail(problem);
    const slot = bp.parts.find(p => p.id === slotId);
    const part = this.bagParts(slot.typeId)[0];
    if (!part) return fail(`背包里没有${catalog.get(slot.typeId).name}，先在制作台做一个。`);
    this.mutate(s => { const target = s.creation.parts.find(p => p.id === part.id); target.owner = asmId; target.slot = slotId; });
    return ok(`${catalog.get(slot.typeId).name}装好了。`, { partId: part.id });
  },

  detachSlot(asmId, slotId) {
    const asm = this.assembly(asmId), bp = asm && this.blueprint(asm.blueprintId);
    if (!bp) return fail('没有这件作品。');
    const problem = detachProblem(bp, this.filledSlots(asmId), slotId);
    if (problem) return fail(problem);
    const part = this.state.creation.parts.find(p => p.owner === asmId && p.slot === slotId);
    this.mutate(s => { const target = s.creation.parts.find(p => p.id === part.id); target.owner = 'bag'; target.slot = null; });
    return ok(`${this.creationCatalog().get(part.typeId).name}取下来了，放回背包。`, { partId: part.id });
  },

  autoAssemble(asmId) {
    const asm = this.assembly(asmId), bp = asm && this.blueprint(asm.blueprintId);
    if (!bp) return fail('没有这件作品。');
    let attached = 0;
    for (let round = 0; round < bp.parts.length; round++) {
      let progressed = false;
      for (const slotId of assemblyOrder(bp)) {
        if (this.filledSlots(asmId).has(slotId)) continue;
        if (this.attachSlot(asmId, slotId).ok) { attached++; progressed = true; }
      }
      if (!progressed) break;
    }
    const missing = bp.parts.length - this.filledSlots(asmId).size;
    if (!attached && missing) return fail('背包里没有能装上的部件，先去制作台做部件。');
    return ok(missing ? `装上了 ${attached} 个部件，还差 ${missing} 个。` : '全部部件都装好了！', { attached, missing });
  },

  disassemble(asmId) {
    const asm = this.assembly(asmId);
    if (!asm) return fail('没有这件作品。');
    const count = this.filledSlots(asmId).size;
    if (!count) return fail('拼装架上是空的。');
    this.mutate(s => { for (const p of s.creation.parts) if (p.owner === asmId) { p.owner = 'bag'; p.slot = null; } });
    return ok(`拆开了 ${count} 个部件，都放回背包了，可以重新组装。`, { count });
  },

  deleteAssembly(asmId) {
    const asm = this.assembly(asmId);
    if (!asm) return fail('没有这件作品。');
    if (this.filledSlots(asmId).size) return fail('先把部件拆下来，再收起拼装架。');
    this.mutate(s => { s.creation.assemblies = s.creation.assemblies.filter(a => a.id !== asmId); });
    return ok('拼装架收起来了。');
  },

  experiment(asmId, capability) {
    const asm = this.assembly(asmId), bp = asm && this.blueprint(asm.blueprintId);
    if (!bp) return fail('没有这件作品。');
    if (!Object.hasOwn(CAPABILITIES, capability)) return fail('这个实验还没有做好。');
    const result = runExperiment(bp, this.creationCatalog(), this.filledSlots(asmId), capability);
    this.mutate(s => {
      const target = s.creation.assemblies.find(a => a.id === asmId);
      target.experiments = [...target.experiments, { capability, ok: result.ok, text: cleanText(result.text, 120) }].slice(-L.experimentsKept);
    });
    return { ...result, message: result.text };
  },

  deployAssembly(asmId) {
    const asm = this.assembly(asmId), bp = asm && this.blueprint(asm.blueprintId);
    if (!bp) return fail('没有这件作品。');
    if (asm.status === 'world') return fail('它已经在实验场了。');
    if (this.filledSlots(asmId).size !== bp.parts.length) return fail('还有部件没装好，装完整才能拿去实验场。');
    const taken = this.state.creation.assemblies.filter(a => a.status === 'world').map(a => a.world);
    const blocked = p => this.state.blocks.some(b => Math.abs(b.x - p.x) < 1.3 && Math.abs(b.z - p.z) < 1.3);
    const spot = TEST_FIELD.spots.find(p => !taken.some(t => Math.hypot(t.x - p.x, t.z - p.z) < 1) && !blocked(p));
    if (!spot) return fail('实验场满了，先把一件作品送回实验室。');
    this.mutate(s => { const target = s.creation.assemblies.find(a => a.id === asmId); target.status = 'world'; target.world = { x: spot.x, z: spot.z }; });
    return ok(`${bp.name}放到实验场了，走过去试一试！`, { spot });
  },

  recallAssembly(asmId) {
    const asm = this.assembly(asmId);
    if (!asm || asm.status !== 'world') return fail('它已经在实验室里了。');
    this.mutate(s => { const target = s.creation.assemblies.find(a => a.id === asmId); target.status = 'lab'; target.world = null; });
    return ok('作品送回实验室了，可以拆开重新组装。');
  },

  reviseFigure(figId, figure) {
    if (!this.state.creation.figures.some(f => f.id === figId)) return fail('没有这个造物。');
    let checked;
    try { checked = validateFigure(figure); }
    catch (error) { return fail(error.message || '这块加不上去。'); }
    this.mutate(s => { s.creation.figures.find(f => f.id === figId).figure = checked; });
    return ok(`${checked.name}改好了，还是原来的那一个。`);
  },

  addPiece(figId, spec) {
    const fig = this.state.creation.figures.find(f => f.id === figId);
    if (!fig) return fail('没有这个造物。');
    const next = appendPiece(fig.figure, spec);
    if (!next) return fail('已经加满了，先拿掉一块再加上。');
    return this.reviseFigure(figId, next);
  },

  recolorFigurePart(figId, partId, color) {
    const fig = this.state.creation.figures.find(f => f.id === figId);
    if (!fig) return fail('没有这个造物。');
    const next = recolorPart(fig.figure, partId, color);
    if (!next) return fail('没有这块，换一块再试。');
    return this.reviseFigure(figId, next);
  },

  removeFigurePart(figId, partId) {
    const fig = this.state.creation.figures.find(f => f.id === figId);
    if (!fig) return fail('没有这个造物。');
    const next = removePart(fig.figure, partId);
    if (!next) return fail('这块上面还长着别的，先拿掉外面的。身体要留着。');
    return this.reviseFigure(figId, next);
  },

  placeFigure(figId, { x, z, rotY = 0 }) {
    const fig = this.state.creation.figures.find(f => f.id === figId);
    if (!fig) return fail('没有这个造物。');
    if (!isPointOpen(this.state.land, x, z, 0.3) || inPoolReservedArea(x, z, 0.3)) return fail('这里放不下，换一块开好的空地吧。');
    this.mutate(s => { s.creation.figures.find(f => f.id === figId).placed = { x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, rotY: Math.round(rotY * 1000) / 1000 }; });
    return ok(`${fig.figure.name}来到河谷里了。`);
  },

  recallFigure(figId) {
    const fig = this.state.creation.figures.find(f => f.id === figId);
    if (!fig?.placed) return fail('它已经在背包里了。');
    this.mutate(s => { s.creation.figures.find(f => f.id === figId).placed = null; });
    return ok(`${fig.figure.name}回到背包了。`);
  },

  deleteFigure(figId) {
    const fig = this.state.creation.figures.find(f => f.id === figId);
    if (!fig) return fail('没有这个造物。');
    if (fig.placed) return fail('先把它收回背包。');
    this.mutate(s => { s.creation.figures = s.creation.figures.filter(f => f.id !== figId); });
    return ok('造物删掉了。');
  },
};
