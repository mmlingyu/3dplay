import { ITEMS, RECIPES } from './game-data.js';

const UNIT = { wood: '份', plank: '块', stick: '根', stone: '块', branch: '根', clay: '份', ramp: '块', post: '块', workbench: '个', chest: '个', ball: '个', roof: '片', window: '扇', door: '扇', bed: '张', fence: '段', pot: '个', wreath: '个', lantern: '个', flag: '面', kozo: '份', bamboo: '根', 'bamboo-strip': '条', washi: '张', 'paper-crane': '只', 'paper-boat': '只', 'paper-koinobori': '面', 'paper-door': '扇' };

export const PACK_ITEMS = Object.freeze(['wood', 'plank', 'stick', 'stone', 'clay', 'branch', 'brick', 'soil', 'water', 'seed', 'bean', 'shard']);

export const WORKSHOP_FOLDS = Object.freeze([
  { id: 'mat', title: '先做出材料', ids: ['planks', 'sticks'] },
  { id: 'house', title: '盖房子', ids: ['roof', 'window', 'door', 'ramp', 'fence'] },
  { id: 'room', title: '屋里屋外', ids: ['bed', 'workbench', 'chest'] },
  { id: 'deco', title: '个性装饰', ids: ['pot', 'wreath', 'lantern', 'flag'] },
  { id: 'toy', title: '球道玩具', ids: ['ball', 'post'] },
  { id: 'ri', title: '日谷纸艺', ids: ['bamboo-strips', 'paper-crane', 'paper-boat', 'paper-koinobori', 'paper-door'] },
]);

export function unit(item) {
  return UNIT[item] || '个';
}

export function recipeNeeds(recipe) {
  const counts = new Map();
  for (const row of recipe?.pattern || []) for (const cell of row) if (cell) counts.set(cell, (counts.get(cell) || 0) + 1);
  return [...counts].map(([item, count]) => ({ item, count, name: ITEMS[item]?.name || item }));
}

export function recipePits(recipe) {
  if (Array.isArray(recipe?.pits) && recipe.pits.length) {
    return recipe.pits.map(need => ({ item: need.item, count: need.count, name: ITEMS[need.item]?.name || need.item }));
  }
  return recipeNeeds(recipe);
}

export function nextMakes(item) {
  return RECIPES.flatMap(recipe => {
    const need = recipeNeeds(recipe).find(entry => entry.item === item);
    return need ? [{ id: recipe.id, name: recipe.name, count: need.count, output: recipe.output.item }] : [];
  });
}

function countOf(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

// Left pits are the addends. Right side is the combined product, not more addition.
export function mathPits(recipe, inventory = {}, placed = 0) {
  const needs = recipePits(recipe);
  let remaining = countOf(placed);
  const used = {};
  const groups = needs.map(need => {
    const total = countOf(inventory?.[need.item]);
    const have = Math.max(0, total - (used[need.item] || 0));
    const put = Math.max(0, Math.min(need.count, have, remaining));
    remaining -= put;
    used[need.item] = (used[need.item] || 0) + put;
    return { item: need.item, name: need.name, unit: unit(need.item), need: need.count, have: total, put };
  });
  const need = groups.reduce((sum, group) => sum + group.need, 0);
  const put = groups.reduce((sum, group) => sum + group.put, 0);
  const first = groups[0] || { item: '', name: '', unit: '个', need: 0, have: 0, put: 0 };
  const out = recipe?.output || { item: '', count: 0 };
  const outHave = countOf(inventory?.[out.item]);
  const ready = need > 0 && groups.every(group => group.put === group.need);
  const taken = {};
  for (const group of groups) taken[group.item] = (taken[group.item] || 0) + group.put;
  const canPut = groups.some(group => group.put < group.need && taken[group.item] < group.have);
  return {
    groups,
    item: first.item,
    name: first.name,
    unit: first.unit,
    need,
    have: first.have,
    put,
    left: first.have - first.put,
    ready,
    short: groups.some(group => group.have < group.need),
    canPut,
    empty: recipe?.empty || '',
    kind: recipe?.kind || '',
    why: recipe?.why || recipe?.hint || '',
    outItem: out.item,
    outName: ITEMS[out.item]?.name || out.item,
    outUnit: unit(out.item),
    outCount: out.count,
    outHave,
    outNext: outHave + (ready ? out.count : 0),
  };
}

const ITEM_SOURCE = Object.freeze({
  wood: '去地图上的林间木料采集',
  branch: '去地图上的干枝堆采集',
  stone: '去地图上的石料堆采集',
  clay: '去地图上的制砖黏土采集',
  soil: '去地图上的种植土采集',
  water: '去地图上的溪边取水点采集',
  seed: '去地图上的豆子种子箱采集',
  kozo: '去日谷的楮树林采集，不用答题',
  bamboo: '去日谷的竹林采集，不用答题',
  washi: '在日谷纸坊用楮皮做和纸',
  brick: '去小小砖窑，用黏土和树枝烧砖',
  bean: '去小菜园种豆，长成后再采收',
  shard: '试样碎片只观察，不能当材料',
});

export function whereToGet(item) {
  if (ITEM_SOURCE[item]) return ITEM_SOURCE[item];
  const recipe = RECIPES.find(entry => entry.output.item === item);
  if (recipe) return `在木作工作台点「${recipe.name}」做出来`;
  return '先去采集或制作';
}

export function sourceKind(item) {
  if (ITEM_SOURCE[item] && ['wood', 'branch', 'stone', 'clay', 'soil', 'water', 'seed', 'kozo', 'bamboo'].includes(item)) return 'gather';
  if (item === 'washi') return 'kiln';
  if (item === 'brick') return 'kiln';
  if (item === 'bean') return 'garden';
  if (RECIPES.some(entry => entry.output.item === item)) return 'craft';
  return 'other';
}

export function makerOf(item) {
  return RECIPES.find(entry => entry.output.item === item) || null;
}

export function lackItems(math) {
  const seen = new Set();
  const items = [];
  for (const group of math?.groups || []) {
    if (seen.has(group.item)) continue;
    seen.add(group.item);
    const need = (math.groups || []).filter(entry => entry.item === group.item).reduce((sum, entry) => sum + entry.need, 0);
    if (group.have >= need) continue;
    items.push({ ...group, need, lack: need - group.have, where: whereToGet(group.item), kind: sourceKind(group.item), recipeId: makerOf(group.item)?.id || null });
  }
  return items;
}

export function lackHint(math) {
  return lackItems(math).map(item => `${item.name}还差 ${item.lack} ${item.unit}。背包 ${item.have}，这一步要 ${item.need}。${item.where}。`).join('');
}

export function putHint(math) {
  if (math.put) return sumLine(math.put);
  if (math.short && !math.canPut) return '背包不够';
  if (math.empty) return math.empty;
  return math.canPut ? '点左边的坑，放进去' : '再去采一点';
}

export function resultLine(math) {
  return math.ready ? `得到 ${math.outCount} ${math.outUnit}${math.outName}` : '结合以后出现';
}

export function madeLine(recipe, count = recipe?.output?.count) {
  const item = recipe?.output?.item;
  const n = Math.max(0, Math.floor(Number(count) || 0));
  return `做好了 ${n} ${unit(item)}${ITEMS[item]?.name || recipe?.name || ''}，已经放进背包。`;
}

export function sumLine(count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n <= 0) return '';
  if (n === 1) return '1';
  return `${Array.from({ length: n }, () => '1').join(' + ')} = ${n}`;
}

export function needLine(recipe, inventory = {}) {
  const needs = recipeNeeds(recipe);
  const bits = needs.map(need => {
    const have = Math.max(0, Math.floor(Number(inventory[need.item]) || 0));
    const name = `${need.name}要 ${need.count} ${unit(need.item)}，背包有 ${have}`;
    return have >= need.count ? name : `${name}，还差 ${need.count - have}`;
  });
  return { needs, ok: needs.every(need => (Number(inventory[need.item]) || 0) >= need.count), text: bits.join('；') };
}

// Each made thing sits one layer above its ingredients, and never past four.
export function combinationLayers(limit = 4) {
  const produced = new Set(RECIPES.map(recipe => recipe.output.item));
  const depth = new Map();
  for (const recipe of RECIPES) {
    for (const need of recipeNeeds(recipe)) if (!produced.has(need.item)) depth.set(need.item, 1);
  }
  const byItem = new Map();
  for (let guard = 0; guard < RECIPES.length + 2; guard += 1) {
    let grew = false;
    for (const recipe of RECIPES) {
      const needs = recipeNeeds(recipe);
      if (!needs.every(need => depth.has(need.item))) continue;
      const next = Math.max(...needs.map(need => depth.get(need.item))) + 1;
      const item = recipe.output.item;
      if (next > limit || depth.has(item)) continue;
      depth.set(item, next);
      byItem.set(item, recipe);
      grew = true;
    }
    if (!grew) break;
  }
  return Array.from({ length: limit }, (_, index) => [...depth]
    .filter(([, level]) => level === index + 1)
    .map(([item]) => {
      const recipe = byItem.get(item) || null;
      return {
        item,
        name: ITEMS[item]?.name || item,
        recipeId: recipe?.id || null,
        from: recipe ? recipeNeeds(recipe).map(need => ({ item: need.item, name: need.name, count: need.count, unit: unit(need.item) })) : [],
        count: recipe?.output.count ?? null,
        unit: unit(item),
      };
    }));
}

export function combinationTree(limit = 4) {
  const nodes = new Map();
  for (const layer of combinationLayers(limit)) {
    for (const node of layer) nodes.set(node.item, { ...node, children: [] });
  }
  const roots = [];
  for (const node of nodes.values()) {
    const parent = node.from[0] && nodes.get(node.from[0].item);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function afterMaking(recipe) {
  const item = recipe.output.item;
  const next = nextMakes(item).map(entry => `${entry.name}要用 ${entry.count} ${unit(item)}`);
  const place = ITEMS[item]?.placeable ? '可以摆到地上' : '';
  if (place && next.length) return `${place}。继续做：${next.join('，')}`;
  return place || (next.length ? `继续做：${next.join('，')}` : '');
}

// Guided chains: made modules become the pieces of a larger build.
export const BUILD_CASES = Object.freeze([
  {
    id: 'track',
    name: '弯弯小球道',
    blurb: '先做出斜坡、木板和挡板，再出去把它们接成一条路。',
    steps: [
      { recipe: 'planks', say: '第 1 步：1 份木料做成 4 块木板。后面的斜坡和木棍都用这些木板。' },
      { recipe: 'ramp', say: '第 2 步：拿出 1 块木板和 1 块石块，做成斜坡。球从这里滚下来，上台也用它。' },
      { recipe: 'sticks', say: '第 3 步：再拿 1 块木板，做成 2 根木棍。' },
      { recipe: 'post', say: '第 4 步：拿出 1 根木棍，做成挡板。挡板让球转弯。' },
      { place: 'ramp', say: '第 5 步：出去摆。斜坡放高处，木板接在下面，挡板放在旁边，再放木球。形状可以改。' },
    ],
  },
  {
    id: 'corner',
    name: '我的小角落',
    blurb: '木板铺地面，石块围起来。石块是采来的，不用在工作台做。',
    steps: [
      { recipe: 'planks', say: '第 1 步：1 份木料做成 4 块木板，用来铺地。' },
      { gather: 'stone', say: '第 2 步：去石堆采集石块。两份泥土不会变成石块。' },
      { place: 'plank', say: '第 3 步：出去先铺木板，再用石块围一圈。角可以大一点，也可以留个门。' },
    ],
  },
  {
    id: 'store',
    name: '能放大东西的箱子',
    blurb: '先用木板做工作台并放到地上，才能用大桌把更多木板围成储物箱。',
    steps: [
      { recipe: 'planks', say: '第 1 步：储物箱要 8 块木板，工作台还要 4 块。一份木料只有 4 块，要多做几次。' },
      { recipe: 'workbench', say: '第 2 步：4 块木板摆成方块，做成 1 个工作台。放到地上，再回来就能用大桌。' },
      { recipe: 'chest', say: '第 3 步：8 块木板围一圈，中间空着，做成 1 个储物箱。' },
      { place: 'chest', say: '第 4 步：把储物箱放到地上。点它，可以把东西存进去。' },
    ],
  },
  {
    id: 'house',
    name: '我的小屋',
    blurb: '先做门、窗和屋顶，再出去用木板铺地、砌墙，自己拼一座房子。',
    steps: [
      { recipe: 'planks', say: '第 1 步：1 份木料做成 4 块木板。地面和墙直接摆木板，不用另做地板。' },
      { recipe: 'door', say: '第 2 步：两块木板加一根木棍，做成门。这格可以走进去。' },
      { recipe: 'window', say: '第 3 步：木板加木棍，做成窗。嵌在墙上。' },
      { recipe: 'roof', say: '第 4 步：三块木板凑成屋顶。可以多做几片盖在墙上。' },
      { recipe: 'ramp', say: '第 5 步：木板加石块做成斜坡，当上台的台阶。' },
      { place: 'door', say: '第 6 步：出去摆。门朝南，窗嵌在墙上，屋顶盖在顶上。屋里放床，门外篱笆，墙上可挂装饰。' },
    ],
  },
]);

export const WORKSHOP_RULES=Object.freeze({
  dragThreshold:7,leverTravel:70,leverCommit:.7,pixelRatio:1.5,slotSpacing:1.05,
  touchTarget:[1.05,.9,1.05],
  camera:{width:8.4,minHeight:5,position:[3.5,8,7.5],lookAt:[0,.9,.25],narrowWidth:6.4,narrowPosition:[0,9,4.5],narrowBreakpoint:520},
  colors:{wood:'#b77b48',top:'#ddb17c',rim:'#97613e',slot:'#eee4c6',valid:'#b2cd8b',cream:'#fff6dc',lever:'#bf795b'},
});
