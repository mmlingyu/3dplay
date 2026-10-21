import { ITEMS, RECIPES, COLLECTABLE_ITEMS, CRAFT_RULES } from './game-data.js';
import { LIFE_RULES, SPECIES, FLORA_LABELS, FLORA_BY_ID, floraStage, floraBlocked, realMoment } from './life-data.js';
import { realAnalogClock } from './clock-ui.js';
import { LAND_RULES, frontierChunks, nearbyFrontiers, landEncounters } from './land-data.js';
import { Workshop3D } from './workshop-3d.js';
import { BUILD_CASES, PACK_ITEMS, WORKSHOP_FOLDS, combinationTree, lackHint, lackItems, madeLine, mathPits, needLine, putHint, recipeNeeds, resultLine } from './workshop-data.js';
import { Axle3D } from './axle-3d.js';
import { createCreationStudio, CREATION_TITLES } from './creation-ui.js';
import { AGE_BANDS, FOLD_NOTE, WASHI_NOTE } from './realm-data.js';
import { STAMP_BOOK } from './stamp-book.js';
import { MEI_PANEL_TITLES, handleMeiAction, meiPanelHtml } from './mei-panels.js';
import { KEEPSAKES, VISTA_IDS, VISTAS, VISTA_QUIZ, drawVistaMap, gradeVistaQuiz, vistaBand, vistaDistanceCopy } from './vista-data.js';

const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const BUILDABLE = new Set(['plank', 'stone', 'brick', 'ramp', 'post', 'chest', 'workbench', 'roof', 'window', 'door', 'bed', 'fence', 'pot', 'wreath', 'lantern', 'flag']);
const TITLES = { ...CREATION_TITLES, ...MEI_PANEL_TITLES, workshop: '木作工作台', axle: '轮轴试装台', land:'开垦与探索', life:'河谷的时间与生命', inventory: '我的背包', craft: '格子工坊', kiln: '小小砖窑', garden: '我的小菜园', warehouse: '可选补给站', help: '怎么玩', pause: '暂停与存档', chest: '我的储物箱', inspiration: '建筑点子卡', washi: '做和纸', fold: '折一折', stamps: '印章本', vista: '远处的谷' };
const KILN_NAMES = { idle: '还没开始', moistening: '加水与成形', shaping: '成形', drying: '干燥', firing: '烧制', cooling: '冷却', ready: '完成，可以领取', failed: '试样出现裂纹' };
const itemEntries = Array.isArray(ITEMS) ? ITEMS.map((entry) => [entry.id, entry]) : Object.entries(ITEMS);
const recipes = Array.isArray(RECIPES) ? RECIPES : Object.values(RECIPES);
const itemData = Object.fromEntries(itemEntries);
const recipeInputs = new Set(recipes.flatMap((recipe) => (recipe.pattern || []).flat().filter(Boolean)));
const isBuildable = (key) => itemData[key]?.placeable ?? BUILDABLE.has(key);
const nameOf = (key) => itemData[key]?.name || key || '材料';
const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const uniqueID = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const emptyGrid = (side) => Array.from({ length: side }, () => Array(side).fill(null));

export function createPanels({ game, icon, toast = () => {}, speak = () => {}, onClose = () => {}, onSelect = () => {}, onChanged = () => {}, onReclaim = (cx,cz) => game.reclaim(cx,cz), onPlaceFigure = () => ({ ok: false, message: '现在还放不下。' }), onTravelHome = () => {}, onAge = () => {} }) {
  let root = document.getElementById('modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'modal-root';
    document.body.append(root);
  }
  let current = null;
  let context = {};
  let previousFocus = null;
  let previousOverflow = '';
  let side = 2;
  let grid = emptyGrid(2);
  let selectedMaterial = itemData.log ? 'log' : (itemData.wood ? 'wood' : itemEntries[0]?.[0]);
  let selectedRecipe = null;
  let craftNotice = '';
  let kilnNotice = '';
  let gardenNotice = '';
  let backupBeforeImport = null;
  let importPending = null;
  let vistaQuizNote = '';
  let pauseNotice = '';
  let lastMarkup = '';
  let craftDrag=null;
  let workshop = null;
  let axle = null;
  const wood = itemData.log ? 'log' : (itemData.wood ? 'wood' : 'plank');
  const orders = makeOrders();
  // Every raw material is provided at first entry; keep it discoverable even
  // after its count reaches zero and the saved world is reopened.
  const discovered = new Set(COLLECTABLE_ITEMS);

  function safeSpeak(text) {
    try { speak(text); } catch { /* Pictures and controls work without speech support. */ }
  }
  function svg(key, size = 28) {
    try { return icon?.(key, size) || `<span aria-hidden="true">${escapeHTML(itemData[key]?.emoji || '●')}</span>`; }
    catch { return `<span aria-hidden="true">${escapeHTML(itemData[key]?.emoji || '●')}</span>`; }
  }
  function button(action, label, options = {}) {
    const attrs = Object.entries(options.data || {}).map(([key, value]) => `data-${key}="${escapeHTML(value)}"`).join(' ');
    return `<button type="button" class="${options.className || 'secondary-btn'}" data-action="${action}" ${attrs} ${options.disabled ? 'disabled' : ''} ${options.label ? `aria-label="${escapeHTML(options.label)}"` : ''}>${label}</button>`;
  }
  function readButton(text) {
    return button('speak', `${svg('sound', 20)}<span>听说明</span>`, { className: 'secondary-btn speak-btn', data: { text } });
  }
  function inventoryCount(key) { return Number(game.state.inventory?.[key] || 0); }
  const studio = createCreationStudio({ game, svg, button, escapeHTML, notify: (result) => notifyResult(result), speak: safeSpeak, toast, open: (type, details) => open(type, details), onPlaceFigure });
  const isStudio = (type) => type === 'idea' || type === 'lab';
  function notifyResult(result, fallback) {
    const message = result?.message || fallback || (result?.ok === false ? '这次还没完成，我们再试一试。' : '完成啦！');
    toast(message);
    safeSpeak(message);
    if (result?.ok !== false) onChanged();
    return result?.ok !== false;
  }
  function inventoryView(selectAction = 'inventory-select', entries = itemEntries, showDescriptions = false) {
    return `<div class="panel-grid inventory-grid">${entries.map(([key, data]) => {
      const count = inventoryCount(key);
      const selected = selectAction === 'craft-material' && selectedMaterial === key;
      return button(selectAction, `${svg(key, 42)}<strong>${escapeHTML(data.name)}</strong><span class="item-count">${count} ${isBuildable(key) ? '个' : '份'}</span>${selectAction === 'craft-material' ? '' : `<small>${showDescriptions ? escapeHTML(data.description || '') : (isBuildable(key) ? '选来建造' : '点一下听名称')}</small>`}`, {
        className: `item-card${selected ? ' selected' : ''}${count === 0 ? ' empty' : ''}`,
        data: { item: key }, label: `${data.name}，${count}份。${selectAction === 'craft-material' ? '选择这种材料' : (isBuildable(key) ? '选择建造' : '听名称与用途')}`,
        disabled: selectAction === 'craft-material' && count === 0,
      });
    }).join('')}</div>`;
  }
  function canUseLargeGrid() {
    return Boolean(context.atWorkbench || context.public || context.workbench || context.source === 'workbench' || game.hasWorkbench?.() || game.state.blocks?.some?.((block) => (block.item || block.type) === 'workbench'));
  }
  function recipePattern(recipe) { return recipe.pattern || recipe.grid || []; }
  function recipeFits(recipe) {
    const pattern = recipePattern(recipe);
    return pattern.length <= side && pattern.every((row) => row.length <= side);
  }
  function currentMatches() {
    try { return game.getMatches(grid) || []; } catch { return []; }
  }
  function miniaturePattern(pattern) {
    const columns = Math.max(1, ...pattern.map((row) => row.length));
    return `<div class="recipe-mini-grid" aria-hidden="true" style="display:grid;grid-template-columns:repeat(${columns},1fr);gap:3px">${pattern.flat().map((key) => `<span>${key ? svg(key, 20) : '·'}</span>`).join('')}</div>`;
  }
  function craftCanConfirm() {
    if (!selectedRecipe) return false;
    const required = grid.flat().filter(Boolean).reduce((counts, key) => ({ ...counts, [key]: (counts[key] || 0) + 1 }), {});
    return Object.keys(required).every((key) => required[key] <= inventoryCount(key));
  }
  function craftView() {
    const matches = currentMatches();
    if (!matches.some((recipe) => recipe.id === selectedRecipe)) selectedRecipe = matches.length === 1 ? matches[0].id : null;
    const used = grid.flat().filter(Boolean).reduce((counts, key) => ({ ...counts, [key]: (counts[key] || 0) + 1 }), {});
    const over = Object.keys(used).filter((key) => used[key] > inventoryCount(key));
    const materials = itemEntries.filter(([key]) => recipeInputs.has(key) && inventoryCount(key) > 0);
    const recipeBook = `<details class="panel-details craft-recipe-book"><summary>打开配方书 · 游戏约定</summary><p>点“摆给我看”只展示配方，不会消耗材料。</p><div class="panel-grid">${recipes.map((recipe) => `<article class="recipe-card">${miniaturePattern(recipePattern(recipe))}<strong>${escapeHTML(recipe.name)}</strong><p>${escapeHTML(recipe.hint || '')}</p><small>得到 ${recipe.output.count} 个${escapeHTML(nameOf(recipe.output.item))}</small>${button('craft-example', recipeFits(recipe) ? '摆给我看' : '需要 3 × 3 工作台', { data: { recipe: recipe.id }, disabled: !recipeFits(recipe) })}</article>`).join('')}</div></details>`;
    return `${guideMarkup('craft-goal', side === 3)}<div class="panel-row craft-intro"><span>${svg('workbench', 22)}<strong>摆一摆，点制作</strong> · 试摆不扣材料</span>${readButton('点产物图看摆法。材料可以拖进格子，也可以先点材料再点格子。点格子可以拿回，点制作才消耗材料。格子是游戏约定。')}</div>
      <div class="panel-tabs" role="group" aria-label="选择工坊大小">${button('craft-size', '随身 2 × 2', { className: side === 2 ? 'primary-btn' : 'secondary-btn', data: { side: 2 } })}${button('craft-size', `工作台 3 × 3${canUseLargeGrid() ? '' : ' · 需要工作台'}`, { className: side === 3 ? 'primary-btn' : 'secondary-btn', data: { side: 3 }, disabled: !canUseLargeGrid() })}</div>
      <div class="craft-layout"><section class="craft-materials"><h3 class="craft-step-label">① 拖材料</h3>${materials.length ? inventoryView('craft-material', materials) : `<p class="panel-note">先去采集木料。</p>`}<p class="craft-selected">正在选：${svg(selectedMaterial, 18)} ${escapeHTML(nameOf(selectedMaterial))}</p>${recipeBook}</section><section class="craft-workspace"><h3 class="craft-step-label">② 摆一摆</h3><div class="craft-grid" data-size="${side}" style="grid-template-columns:repeat(${side},1fr)">${grid.flatMap((row, y) => row.map((key, x) => button('craft-slot', key ? `${svg(key, 42)}<small>${escapeHTML(nameOf(key))}</small>` : '<span aria-hidden="true">＋</span>', { className: 'craft-slot', data: { x, y }, label: `第${y + 1}行第${x + 1}格，${key ? `${nameOf(key)}，点击拿回` : '空格，点击放入所选材料'}` }))).join('')}</div>
      <div class="craft-clear-row">${button('craft-clear', '全部拿回')}<span class="craft-step-label">③ 选产物</span></div><div class="craft-results" role="group" aria-label="选择产物">${matches.length ? matches.map((recipe) => button('craft-result', `${svg(recipe.output.item, 26)}<span><strong>${escapeHTML(recipe.name)}</strong><small>× ${recipe.output.count}</small></span>`, { className: selectedRecipe === recipe.id ? 'recipe-card selected' : 'recipe-card', data: { recipe: recipe.id } })).join('') : '<p class="craft-empty-result">试摆，或打开配方书看看。</p>'}</div>
      ${over.length ? `<p class="panel-note warning">${escapeHTML(over.map(nameOf).join('、'))}数量不够。材料仍在背包里，可以先去采集。</p>` : ''}
      ${craftNotice ? `<p class="panel-notice" role="status">${escapeHTML(craftNotice)}</p>` : ''}</section></div>`;
  }
  const mathPut = {};
  let workshopWant = null;
  let workshopFold = 'house';
  function paintMath(recipeId) {
    const recipe = recipes.find(entry => entry.id === recipeId);
    const row = root.querySelector(`[data-recipe-row="${recipeId}"]`);
    if (!recipe || !row) return;
    const math = mathPits(recipe, game.state.inventory || {}, mathPut[recipeId] || 0);
    mathPut[recipeId] = math.put;
    row.querySelectorAll('[data-math="add"] [data-action="math-pit"]').forEach(pit => {
      const index = Number(pit.dataset.index);
      const filled = index < math.put;
      pit.classList.toggle('filled', filled);
      pit.disabled = filled ? false : !math.canPut;
      pit.setAttribute('aria-pressed', String(filled));
    });
    const sum = row.querySelector('[data-math="sum"]');
    if (sum) sum.textContent = putHint(math);
    row.querySelector('[data-math="gain-box"]')?.classList.toggle('ready', math.ready);
    const gain = row.querySelector('[data-math="gain"]');
    if (gain) gain.textContent = resultLine(math);
    row.querySelectorAll('[data-have-item]').forEach(el => {
      const have = inventoryCount(el.dataset.haveItem);
      el.textContent = `背包 ${have}`;
      el.classList.toggle('is-short', have < Number(el.dataset.need || 0));
    });
    paintCounts();
    paintLack(math);
  }
  function paintCounts() {
    root.querySelectorAll('[data-pack-item]').forEach(el => {
      const count = inventoryCount(el.dataset.packItem);
      const num = el.querySelector('b');
      if (num) num.textContent = count;
      el.classList.toggle('zero', count <= 0);
    });
    root.querySelectorAll('.workshop-want[data-recipe]').forEach(el => {
      const recipe = recipes.find(entry => entry.id === el.dataset.recipe);
      if (!recipe) return;
      const have = inventoryCount(recipe.output.item);
      const count = el.querySelector('[data-have]');
      if (count) count.textContent = `背包 ${have}`;
      el.classList.toggle('is-short', recipeNeeds(recipe).some(need => inventoryCount(need.item) < need.count));
    });
  }
  function lackButtons(math) {
    return lackItems(math).map(item => {
      if (item.kind === 'gather') return button('workshop-gather', `去采${item.name}`, { data: { item: item.item }, label: item.where });
      if (item.kind === 'kiln') return button('workshop-kiln', '去小小砖窑', { label: item.where });
      if (item.kind === 'garden') return button('workshop-garden', '去小菜园', { label: item.where });
      if (item.recipeId) return button('workshop-want', `去做${item.name}`, { data: { recipe: item.recipeId }, label: item.where });
      return '';
    }).join('');
  }
  function paintLack(math) {
    const note = root.querySelector('[data-math="lack"]');
    if (!note) return;
    const text = lackHint(math);
    note.hidden = !text;
    note.classList.toggle('warning', Boolean(text));
    note.innerHTML = text ? `${escapeHTML(text)}${lackButtons(math)}` : '';
  }
  function makeFromRecipe(id) {
    const recipe = recipes.find(entry => entry.id === id);
    if (!recipe) return;
    if (!recipeFitsTable(recipe, canUseLargeGrid())) {
      const message = '先把工作台放到地上，才能做这个。';
      toast(message);
      safeSpeak(message);
      return;
    }
    const math = mathPits(recipe, game.state.inventory || {}, 0);
    if (!needLine(recipe, game.state.inventory || {}).ok) {
      const message = lackHint(math) || '材料还不够。';
      toast(message);
      safeSpeak(message);
      paintLack(math);
      return;
    }
    const result = game.craft(recipe.pattern, recipe.id);
    if (result.ok) {
      result.message = madeLine(recipe, result.count);
      mathPut[id] = 0;
      selectedRecipe = id;
      workshopWant = id;
    }
    notifyResult(result);
    if (workshop) {
      if (result.ok) {
        workshop.session.clear();
        workshop.lastProduct = { item: result.item, count: result.count };
      }
      workshop.refresh();
      paintBoard();
      const status = root.querySelector('#workshop-status');
      if (status && result.ok) status.textContent = result.message;
      return;
    }
    craftNotice = result.message;
    render();
  }
  function treeNode(node) {
    const kids = node.children.map(child => {
      const join = `${child.from.map(need => `${need.count} ${need.unit}`).join('＋')} → ${child.count} ${child.unit}`;
      return `<li><span class="combo-join">${escapeHTML(join)}</span>${treeNode(child)}</li>`;
    }).join('');
    return `<div class="combo-card">${svg(node.item, 28)}<b>${escapeHTML(node.name)}</b></div>${kids ? `<ul>${kids}</ul>` : ''}`;
  }
  function recipeFitsTable(recipe, large) {
    return large || (recipe.pattern.length <= 2 && recipe.pattern.every(row => row.length <= 2));
  }
  function boardMarkup(recipe, goalAction, large) {
    if (!recipe) return '<p class="board-empty">打开上面一组，点想做的东西。下面只会出这一样要用的坑。</p>';
    const fits = recipeFitsTable(recipe, large);
    const math = mathPits(recipe, game.state.inventory || {}, mathPut[recipe.id] || 0);
    let pitIndex = 0;
    const left = math.groups.map((group, groupIndex) => {
      const holes = Array.from({ length: group.need }, (_, i) => {
        const index = pitIndex;
        pitIndex += 1;
        return `${button('math-pit', svg(group.item, 32), {
          className: `math-pit${index < math.put ? ' filled' : ''}`,
          data: { recipe: recipe.id, index },
          disabled: index < math.put ? false : !math.canPut,
          label: index < math.put ? `拿回一个${group.name}` : `再放一个${group.name}`,
        })}${i < group.need - 1 ? '<span class="add-plus" aria-hidden="true">+</span>' : ''}`;
      }).join('');
        const join = groupIndex ? '<span class="add-plus group-plus" aria-hidden="true">+</span>' : '';
        const short = group.have < group.need;
        return `${join}<div class="eq-group"><span class="eq-label">${svg(group.item, 22)}${escapeHTML(group.name)} ×${group.need}<small class="eq-have${short ? ' is-short' : ''}" data-have-item="${escapeHTML(group.item)}" data-need="${group.need}">背包 ${group.have}</small></span><div class="math-pits">${holes}</div></div>`;
      }).join('');
    const lack = lackHint(math);
    return `<ul class="recipe-links"><li class="recipe-link math-row${selectedRecipe === recipe.id ? ' is-shown' : ''}" data-recipe-row="${escapeHTML(recipe.id)}"><div class="eq-side eq-in" data-math="add">${left}<p class="add-sum" data-math="sum">${escapeHTML(putHint(math))}</p></div><span class="add-equals" aria-hidden="true">=</span><div class="eq-side eq-out add-result${math.ready ? ' ready' : ''}" data-math="gain-box"><span class="eq-label">得到<span class="eq-have" data-have-item="${escapeHTML(math.outItem)}" data-need="0">背包 ${math.outHave}</span></span><div class="eq-result-box">${svg(math.outItem, 36)}<b>${escapeHTML(math.outName)}</b><strong>×${math.outCount}</strong></div><p data-math="gain">${escapeHTML(resultLine(math))}</p></div>${button(goalAction, fits ? '制作' : '要大桌', { className: 'primary-btn', data: { recipe: recipe.id }, disabled: !fits, label: fits ? `制作${recipe.name}，做好放进背包` : '先把工作台放到地上，才能做这个' })}</li></ul><p class="panel-note warning" data-math="lack"${lack ? '' : ' hidden'}>${lack ? `${escapeHTML(lack)}${lackButtons(math)}` : ''}</p><p class="panel-note">${escapeHTML(recipe.kind || '')}${recipe.hint ? ` · ${recipe.hint}` : ''}</p>`;
  }
  function paintBoard() {
    const board = root.querySelector('#workshop-board');
    if (!board) return;
    const recipe = recipes.find(entry => entry.id === workshopWant) || null;
    const goalAction = current === 'workshop' ? 'workshop-goal' : 'craft-goal';
    board.innerHTML = boardMarkup(recipe, goalAction, canUseLargeGrid());
    if (recipe) paintMath(recipe.id);
  }
  function paintWants() {
    root.querySelectorAll('.workshop-want').forEach(el => {
      const on = el.dataset.recipe === workshopWant;
      el.classList.toggle('is-on', on);
      el.setAttribute('aria-pressed', String(on));
    });
  }
  function guideMarkup(goalAction, large) {
    const pack = PACK_ITEMS.map(item => {
      const count = inventoryCount(item);
      return `<div class="bag-chip${count ? '' : ' zero'}" data-pack-item="${escapeHTML(item)}">${svg(item, 26)}<span>${escapeHTML(nameOf(item))}</span><b>${count}</b></div>`;
    }).join('');
    const folds = WORKSHOP_FOLDS.map(fold => {
      const wants = fold.ids.map(id => {
        const recipe = recipes.find(entry => entry.id === id);
        if (!recipe) return '';
        const on = workshopWant === id;
        const have = inventoryCount(recipe.output.item);
        const short = recipeNeeds(recipe).some(need => inventoryCount(need.item) < need.count);
        return `<button type="button" class="workshop-want${on ? ' is-on' : ''}${short ? ' is-short' : ''}" data-action="workshop-want" data-recipe="${escapeHTML(id)}" aria-pressed="${on}" aria-label="想做${escapeHTML(recipe.name)}，背包 ${have} ${nameOf(recipe.output.item)}">${svg(recipe.output.item, 32)}<span>${escapeHTML(recipe.name)}</span><small>${escapeHTML(recipe.kind || '')}</small><small data-have>背包 ${have}</small></button>`;
      }).join('');
      return `<details class="workshop-fold" data-fold="${escapeHTML(fold.id)}" ${fold.id === workshopFold ? 'open' : ''}><summary>${escapeHTML(fold.title)}</summary><div class="want-row">${wants}</div></details>`;
    }).join('');
    const recipe = recipes.find(entry => entry.id === workshopWant) || null;
    const cases = BUILD_CASES.map(sample => `<article class="build-case"><header><h3>${escapeHTML(sample.name)}</h3><p>${escapeHTML(sample.blurb)}</p></header><ol>${sample.steps.map(step => {
      const stepRecipe = step.recipe ? recipes.find(entry => entry.id === step.recipe) : null;
      const fits = !stepRecipe || recipeFitsTable(stepRecipe, large);
      const action = step.recipe ? button(goalAction, fits ? '做这一步' : '先放下工作台', { className: 'primary-btn', data: { recipe: step.recipe }, disabled: !fits, label: step.say }) : step.place ? button('workshop-build', `带上${nameOf(step.place)}去摆`, { className: 'primary-btn', data: { item: step.place }, label: step.say }) : button('workshop-gather', `去采${nameOf(step.gather)}`, { data: { item: step.gather }, label: step.say });
      return `<li><p>${escapeHTML(step.say)}</p>${action}</li>`;
    }).join('')}</ol></article>`).join('');
    const tree = combinationTree().map(node => `<li>${treeNode(node)}</li>`).join('');
    return `<section class="workshop-links" aria-label="材料和数量"><h3>现在背包里有</h3><div class="pack-row">${pack}</div><p class="panel-note">点想做的东西，下面只出现这一样要用的坑。点「制作」会从背包拿走材料，做好的立刻放进背包。</p><div id="workshop-folds">${folds}</div><div id="workshop-board">${boardMarkup(recipe, goalAction, large)}</div><details class="panel-details combo-details"><summary>四层组合</summary><p class="panel-note">从上往下看。上一层做好，才能做下一层，最多四层。再大的路和房子，是把这些模块摆到地上。</p><div class="combo-tree-wrap"><ul class="combo-tree" aria-label="从上到下的四层组合">${tree}</ul></div></details><h3>用做好的模块拼大的</h3><div class="build-cases">${cases}</div></section>`;
  }
  function workshopView() {
    const large = canUseLargeGrid();
    return `${guideMarkup('workshop-goal', large)}
      <div class="workshop-intro"><strong>点想做的 → 制作</strong><span>做好放进背包</span></div>
      <div class="workshop-stage"><canvas id="workshop-canvas" aria-label="实体工作台。上面先看材料和数量，再拖材料进插槽，点右侧产物，向下拉木杆制作。"></canvas><div class="workshop-labels" aria-hidden="true"></div></div>
      <p id="workshop-status" role="status"></p>
      <div class="workshop-controls">${button('workshop-pull', '制作 · 拉杆备用', { className: 'primary-btn', disabled: true })}${button('workshop-clear', '全部拿回')}${button('workshop-size', '小桌', { data: { side: 2 } })}${button('workshop-size', '大桌', { data: { side: 3 }, disabled: !large })}</div>
      <div class="workshop-secondary">${button('workshop-flat', '二维格子备用')}<details class="panel-details"><summary>更多操作与说明</summary><p>也可点材料，再点空槽；点槽里的材料拿回。图卡会演示摆法。同一摆法有多个结果时，先点右边的实体物品。拉杆是游戏制作约定，不模拟真实锯切。</p>${readButton('拖材料进槽，试摆不扣料。点右边的产物，再把木拉杆向下拉，松手制作。也可先点材料，再点空槽。')}</details></div>`;
  }
  function axleView() {
    return `<div class="axle-intro"><strong>固定轴 · 两个独立转轮</strong><span>点轮子装上或取下 · 拖轮子转动</span></div>
      <div class="axle-stage"><canvas id="axle-canvas" aria-label="三维轮轴试装台。点轮子装上或取下，拖动已安装的轮子可以转动。"></canvas></div>
      <p id="axle-feedback" class="axle-feedback" role="status">点轮子装上固定轴；装好后拖动它转一转。</p>
      <div class="axle-readout" aria-live="polite"><span id="axle-readout">左轮 0° · 右轮 0° · 固定轴 0°</span><span id="axle-joint-count">0 / 2 个插接</span></div>
      <div class="axle-controls" role="group" aria-label="轮轴操作">
        <section class="axle-control"><strong>左轮</strong><span id="axle-left-status">待装 · 0°</span>${button('axle-toggle', '装上左轮', { data: { side: 'left' } })}${button('axle-turn', '转一小格', { data: { side: 'left' }, disabled: true })}</section>
        <section class="axle-control"><strong>右轮</strong><span id="axle-right-status">待装 · 0°</span>${button('axle-toggle', '装上右轮', { data: { side: 'right' } })}${button('axle-turn', '转一小格', { data: { side: 'right' }, disabled: true })}</section>
      </div>
      <div class="panel-note axle-rule-note"><strong>本次演示的规则</strong><br>轮子通过插槽连在固定轴上，可以拆下；左右轮各自绕轴转动，互不带动。这里不模拟承重、传动、材料强度或骑行。零件是试验架演示件，不消耗背包材料，也不算已制作的作品。</div>
      <details class="panel-details"><summary>为什么左右轮能各自转？</summary><p>每个轮毂单独套在固定轴的转动接口上。演示中只改变被推动轮子的角度，固定轴和另一个轮子保持不动。这是用于检查接口与独立转动的简化模型，不代表完整的自行车轴承结构。</p></details>`;
  }
  function kilnWatchLine(kiln) {
    return {
      moistening: '黏土在变湿，慢慢捏成砖坯。',
      drying: '砖坯在变浅，水汽往上飘。',
      firing: '窑口亮了，砖坯正在烧。',
      cooling: '火小了，砖的颜色在变稳。',
    }[kiln.stage] || '看着窑口前面的材料。';
  }
  function touchKiln() {
    const phase = root.querySelector('#kiln-phase');
    if (!phase || current !== 'kiln') return;
    const kiln = game.state.kiln || { stage: 'idle', elapsed: 0, count: 0, mode: 'normal' };
    const progress = Math.min(100, Math.max(0, Number(kiln.elapsed || 0) / 24 * 100));
    const running = !['idle', 'ready', 'failed'].includes(kiln.stage);
    const finished = ['ready', 'failed'].includes(kiln.stage);
    phase.textContent = KILN_NAMES[kiln.stage] || kiln.stage;
    const desc = root.querySelector('#kiln-description');
    if (desc) desc.textContent = kiln.mode === 'normal' ? '看窑口前面的黏土怎样变化' : '试样 · 不消耗背包材料';
    const fill = root.querySelector('.progress-fill');
    if (fill) fill.style.width = `${progress}%`;
    const bar = root.querySelector('[role="progressbar"]');
    if (bar) bar.setAttribute('aria-valuenow', String(Math.round(progress)));
    const note = root.querySelector('#kiln-progress');
    if (note) note.textContent = running ? kilnWatchLine(kiln) : (finished ? (kiln.stage === 'failed' ? '坯上有裂纹。可以领取看看。' : '砖冷却好了，可以领取。') : '材料在背包里。开始后回到窑边看。');
    root.querySelectorAll('[data-action="kiln-start"]').forEach((button) => {
      const lack = button.dataset.mode === 'normal' && (inventoryCount('clay') < 2 || inventoryCount('branch') < 1);
      button.disabled = running || finished || lack;
    });
    const claim = root.querySelector('[data-action="kiln-claim"]');
    if (claim) claim.disabled = !finished;
  }
  function kilnView() {
    const kiln = game.state.kiln || { stage: 'idle', elapsed: 0, count: 0, mode: 'normal' };
    const progress = Math.min(100, Math.max(0, Number(kiln.elapsed || 0) / 24 * 100));
    const running = !['idle', 'ready', 'failed'].includes(kiln.stage);
    const finished = ['ready', 'failed'].includes(kiln.stage);
    const text = '要做黏土砖，需要适宜的黏土，加水成形，先干燥，再烧制，最后冷却。游戏把这个过程快进成二十四秒。';
    return `<div class="panel-note">${svg('kiln', 30)}<span>成形 → 干燥 → 烧制 → 冷却。<strong>24 秒是游戏快进</strong>，不是现实制作时间。</span></div>${readButton(text)}
      <section class="kiln-stage-card"><div class="panel-row">${svg(kiln.stage === 'failed' ? 'shard' : 'brick', 64)}<div><h3 id="kiln-phase">${escapeHTML(KILN_NAMES[kiln.stage] || kiln.stage)}</h3><p id="kiln-description">${kiln.mode === 'normal' ? '看窑口前面的黏土怎样变化' : '试样 · 不消耗背包材料'}</p></div></div><div class="progress-track" role="progressbar" aria-label="制砖进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress)}"><div class="progress-fill" style="width:${progress}%"></div></div><p id="kiln-progress">${running ? kilnWatchLine(kiln) : (finished ? (kiln.stage === 'failed' ? '坯上有裂纹。可以领取看看。' : '砖冷却好了，可以领取。') : '材料在背包里。开始后回到窑边看。')}</p></section>
      <div class="panel-row">${button('kiln-start', `${svg('clay', 26)} 2 份黏土 ＋ ${svg('branch', 24)} 1 根树枝 · 开始加工`, { className: 'primary-btn', data: { mode: 'normal' }, disabled: running || finished || inventoryCount('clay') < 2 || inventoryCount('branch') < 1 })}${button('kiln-claim', '领取结果', { className: 'primary-btn', disabled: !finished })}</div>
      <p class="panel-note">树枝在本游戏中代表燃料；原料份数和产量也是游戏约定。</p><h3>不花材料的小试验</h3><p>试样来自工坊。看看改变条件后会出现什么。</p><div class="panel-row">${button('kiln-start', '试样：没有充分干燥', { data: { mode: 'wet' }, disabled: running || finished })}${button('kiln-start', '试样：突然急冷', { data: { mode: 'fastCooling' }, disabled: running || finished })}</div>
      <p class="panel-notice" role="status">${escapeHTML(kilnNotice)}</p><details class="panel-details"><summary>给好奇的你：现实的时间、温度与条件</summary><p>制砖需要适宜的黏土原料、成形、充分干燥，以及合适的烧制与冷却工艺。南非黏土砖协会的行业实例给出烧成约 1000—1200℃；美国砖业协会给出烧制约 10—40 小时，干燥和冷却另需时间。它们是不同工艺的实例，不能拼成所有砖的统一配方。</p><p>残余水分较多或温度变化不合适，可能产生裂纹等缺陷；不是每次都必然开裂，也不是“冷却越慢越好”。本游戏的两个试样只演示一种可能结果。</p><p>游戏没有真实的火、高温或砖块强度，工坊由角色操作。来源：<a href="https://claybrick.org/wp-content/uploads/2024/09/Clay-Brick-Manufacture.pdf" target="_blank" rel="noopener noreferrer">南非黏土砖协会</a>、<a href="https://www.gobrick.com/media/file/9-manufacturing-of-brick.pdf" target="_blank" rel="noopener noreferrer">美国砖业协会</a>。</p></details>`;
  }
  function gardenPlots() {
    const garden = game.state.garden || [];
    return Array.isArray(garden) ? garden : Object.entries(garden).map(([id, plot]) => ({ id, ...plot }));
  }
  function plantStage(plot) {
    if (!plot.planted) return '空地';
    if (Number(plot.age || 0) >= 90) return '长成了，可以采收';
    if (plot.moisture >= 3) return '水太多了';
    if (plot.moisture <= 0) return '有点缺水';
    if (Number(plot.age || 0) >= 60) return '正在长叶';
    if (Number(plot.age || 0) >= 30) return '长出小芽';
    return '种子正在变化';
  }
  function gardenView() {
    const plots = gardenPlots();
    const suitableEmpty = plots.filter((plot) => !plot.planted && plot.drainage === 'good');
    const instruction = '点空地播种。看一看土壤的水分，缺水时浇一点。积水时可以把植物移到排水好的空位。长成后再采收。';
    return `<div class="panel-note">${svg('seed', 28)}<span>这是一种菜豆的<strong>简化生长模型</strong>。看土壤和植物的变化，再决定做什么。</span></div>${readButton(instruction)}<div class="panel-grid garden-plots">${plots.map((plot, index) => {
      const empty = !plot.planted;
      const ready = !empty && Number(plot.age || 0) >= 90;
      const label = `${index + 1}号地：${plantStage(plot)}。${plot.drainage === 'good' ? '排水好' : '容易积水'}，水分${plot.moisture || 0}。`;
      return `<article class="plot-card${context.id === plot.id ? ' selected' : ''}"><div class="panel-row">${svg(empty ? 'soil' : (ready ? 'bean' : 'plant'), 44)}<strong>${index + 1} 号地</strong></div><p>${escapeHTML(plantStage(plot))}</p><p>${svg(plot.drainage === 'good' ? 'plant' : 'water', 18)} ${plot.drainage === 'good' ? '排水好' : '容易积水'} · 水分 ${plot.moisture || 0} / 3</p><div class="water-drops" aria-hidden="true">${Array.from({ length: 3 }, (_, i) => `<span style="opacity:${i < (plot.moisture || 0) ? 1 : .2}">${svg('water', 22)}</span>`).join('')}</div>${readButton(label)}<div class="panel-row">${empty ? button('garden-plant', '播种', { className: 'primary-btn', data: { id: plot.id } }) : `${button('garden-water', '浇一点水', { data: { id: plot.id } })}${button('garden-harvest', '采收', { className: 'primary-btn', data: { id: plot.id }, disabled: !ready })}`}</div>${!empty && suitableEmpty.length ? `<label class="transplant-label">移到排水好的空位<select aria-label="${index + 1}号植物的移栽位置" data-transplant-from="${escapeHTML(plot.id)}">${suitableEmpty.map((to) => `<option value="${escapeHTML(to.id)}">${plots.findIndex((p) => p.id === to.id) + 1}号地</option>`).join('')}</select></label>${button('garden-transplant', '轻轻移过去', { data: { id: plot.id } })}` : ''}</article>`;
    }).join('')}</div><p class="panel-notice" role="status">${escapeHTML(gardenNotice)}</p><details class="panel-details"><summary>为什么不是一直浇水？</summary><p>植物需要合适的水分与空气。土壤一直积水，会影响根部获得空气。缺水和过湿都可能影响生长。</p><p>本游戏只展示一种菜豆，不代表所有植物都需要相同条件；生长压缩到约 90 秒，移栽也有简化。游戏没有完整模拟季节、虫害、营养和真实移栽风险。</p></details>`;
  }
  function numberOptions(answer) {
    const options = new Set([answer]);
    while (options.size < 3) options.add(randomInt(Math.max(0, answer - 3), Math.min(10, answer + 3)));
    return [...options].sort(() => Math.random() - .5);
  }
  function makeOrders() {
    const have = randomInt(1, 5);
    const need = have + randomInt(1, Math.min(5, 10 - have));
    const total = randomInt(4, 9);
    const taken = randomInt(1, total - 1);
    return [
      { id: `wood-count-${uniqueID()}`, kind: 'add', title: '帮仓库数木料', item: wood, have, need, answer: need - have, options: numberOptions(need - have), reward: { item: wood, count: 2 }, answered: false, hint: '' },
      { id: `clay-count-${uniqueID()}`, kind: 'subtract', title: '看看还剩多少黏土', item: 'clay', total, taken, answer: total - taken, options: numberOptions(total - taken), reward: { item: 'clay', count: 2 }, answered: false, hint: '' },
      { id: `wood-word-${uniqueID()}`, kind: 'word', title: '木头的木 · mù', item: wood, answer: wood, options: [wood, 'stone', 'clay'], reward: { item: wood, count: 2 }, answered: false, hint: '' },
    ];
  }
  function orderQuestion(order) {
    if (order.kind === 'add') return `这里有 ${order.have} 根木料，要凑够 ${order.need} 根，还缺几根？`;
    if (order.kind === 'subtract') return `这里有 ${order.total} 份黏土，装走 ${order.taken} 份，还剩几份？`;
    return '听一听：木头的木，读 mù。哪一张图是木料？';
  }
  function tokens(item, count, faded = 0) {
    return `<div class="order-tokens" aria-label="${count}份${escapeHTML(nameOf(item))}" style="display:flex;flex-wrap:wrap;gap:8px">${Array.from({ length: count }, (_, i) => `<span class="number-token${i < faded ? ' crossed' : ''}" style="${i < faded ? 'opacity:.3;text-decoration:line-through' : ''}">${svg(item, 28)}<small>${i + 1}</small>${i < faded ? '<span aria-hidden="true">✓ 已装走</span>' : ''}</span>`).join('')}</div>`;
  }
  function warehouseView() {
    orders.forEach((order) => { order.answered = Boolean(game.state.claimedOrders?.includes(order.id)); });
    return `<div class="panel-note">${svg('warehouse', 28)}<span>愿意就帮忙，不做也能自由采集和建造。补给来自仓库已有的原料，<strong>不会增加游玩时间</strong>。</span></div>${readButton('这里的三个小帮忙都可以跳过。答错不扣材料，你可以看图数一数。奖励是仓库发给你的原料，不会增加玩游戏的时间。')}
      <div class="warehouse-orders">${orders.map((order, index) => `<article class="order-card"><div class="panel-row"><h3>${index + 1}. ${escapeHTML(order.title)}</h3><span>${order.answered ? '✓ 已领取' : `补给：${nameOf(order.reward.item)} × ${order.reward.count}`}</span></div><p>${escapeHTML(orderQuestion(order))}</p>${readButton(orderQuestion(order))}
      ${order.kind === 'add' ? `${tokens(wood, order.have)}<p>想凑够：${order.need} 根</p>${order.hint ? `<div class="order-targets" style="display:flex;flex-wrap:wrap;gap:6px">${Array.from({ length: order.need }, (_, i) => `<span class="number-token">${i < order.have ? svg(wood, 26) : '空位'}<small>${i + 1}</small></span>`).join('')}</div>` : ''}` : (order.kind === 'subtract' ? tokens('clay', order.total, order.taken) : `<div class="word-card"><strong style="font-size:56px">木</strong><span style="font-size:28px">mù</span><p>木头的“木”</p></div>`)}
      <div class="order-options">${order.options.map((answer) => button('order-answer', order.kind === 'word' ? `${svg(answer, 44)}<span>${escapeHTML(nameOf(answer))}</span>` : `<strong style="font-size:28px">${answer}</strong>`, { className: 'secondary-btn answer-btn', data: { order: index, answer }, disabled: order.answered })).join('')}</div><p class="panel-notice" role="status">${escapeHTML(order.hint)}</p></article>`).join('')}</div>
      <details class="panel-details"><summary>给大人：这个练习如何简化</summary><p>“木”在这里读 mù；“目”等字也可以同音，要结合物品和词理解。数原料不是让答案变出材料，份数也不代表真实重量。</p></details>${button('close', '先去自由玩', { className: 'primary-btn' })}`;
  }
  function chestView() {
    const id = context.id;
    const contents = game.chestBag?.(id) || game.state.chests?.[id];
    if (!id || !contents) return '<p>这个储物箱暂时找不到了。可以关掉面板，重新点一个箱子。</p>';
    return `<div class="panel-note">${svg('chest', 36)}<span>把暂时不用的材料存起来，下次再拿。每点一下移动 1 份。</span></div>${readButton('左边是背包，右边是箱子。点存入放一份进去，点取出拿一份回来。')}<div class="chest-items">${itemEntries.map(([item, data]) => `<div class="panel-row chest-item-row">${svg(item, 32)}<strong>${escapeHTML(data.name)}</strong><span>背包 ${inventoryCount(item)} · 箱子 ${Number(contents[item] || 0)}</span><div class="quantity-controls">${button('chest-deposit', '存入 1', { data: { item }, disabled: inventoryCount(item) <= 0 })}${button('chest-withdraw', '取出 1', { data: { item }, disabled: !contents[item] })}</div></div>`).join('')}</div>`;
  }
  function washiView() {
    const status = game.washiStatus?.() || { stage: 'idle', label: '还没开始', ready: false, stages: [] };
    const steps = (status.stages || []).map((step) => `<span>${svg(step.icon || 'paper', 28)} ${escapeHTML(step.label)}</span>`).join('');
    return `<div class="panel-note">${svg('paper', 36)}<span>${escapeHTML(status.label)}。楮皮在楮树林，不用答题。</span></div><div class="panel-row">${steps}</div><details class="panel-details"><summary>和真实造纸有什么不同</summary><p>${escapeHTML(WASHI_NOTE)}</p></details><div class="panel-row">${button('washi-start', `${svg('craft', 28)} 做和纸`, { className: 'primary-btn', label: '做和纸', disabled: status.ready || (status.stage !== 'idle') })}${button('washi-claim', `${svg('check', 28)} 收下和纸`, { className: 'primary-btn', label: '收下和纸', disabled: !status.ready })}</div>`;
  }
  function foldView() {
    const folds = [
      ['paper-crane', '折纸鹤', 'crane', [['washi']]],
      ['paper-boat', '折纸船', 'boat', [['washi', 'washi']]],
      ['paper-koinobori', '做鲤鱼旗', 'carp', [['washi', 'bamboo-strip']]],
      ['paper-door', '做纸拉门', 'paper-door', [['washi', 'stick']]],
    ];
    return `<div class="panel-note">${svg('crane', 36)}<span>选一个，材料够就会做好。</span></div><div class="panel-row">${folds.map(([id, label, picture]) => button('fold-make', `${svg(picture, 32)} ${label}`, { className: 'primary-btn', label, data: { recipe: id } })).join('')}</div><details class="panel-details"><summary>和真实折纸有什么不同</summary><p>${escapeHTML(FOLD_NOTE)}</p></details>`;
  }
  function keepsakeView() {
    const ids = game.state.travel?.keepsakes || [];
    if (!ids.length) return '';
    return `<section class="keepsake-row" aria-label="纪念">${ids.map((id) => {
      const item = KEEPSAKES[id];
      if (!item) return '';
      return `<article class="keepsake-card">${svg(item.icon, 36)}<span><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.note)}</small></span></article>`;
    }).join('')}</section>`;
  }
  function vistaView() {
    const band = vistaBand(game.state.settings?.ageBand);
    const discovered = game.state.travel?.discovered || {};
    const lines = VISTA_IDS.map((id) => {
      const vista = VISTAS[id];
      const known = Boolean(discovered[id]);
      const copy = known ? vistaDistanceCopy(id, band) : '海面上还有雾';
      return `<p class="vista-distance" data-vista="${id}" data-known="${known ? 'yes' : 'no'}">${svg(known ? vista.icon : 'map', 28)} <strong>${escapeHTML(known ? vista.name : '还在雾里')}</strong> <span>${escapeHTML(copy)}</span></p>`;
    }).join('');
    const scale = band === 'older' ? '<p class="vista-scale">比例尺在地图下面。1 首歌大约是一小段。数字是游戏里的远近，不是真实公里。</p>' : '';
    const quiz = band === 'older' ? `<div class="vista-quiz"><p>${escapeHTML(VISTA_QUIZ.ask)}</p><div class="panel-row">${VISTA_QUIZ.options.map((opt) => button('vista-quiz', escapeHTML(opt.label), { className: 'secondary-btn', data: { choice: opt.id }, label: opt.label })).join('')}</div><p id="vista-quiz-note" role="status">${escapeHTML(vistaQuizNote)}</p><p class="panel-note">答错不扣东西。</p></div>` : '';
    return `<canvas id="vista-map" width="320" height="240" aria-label="河谷在中间，海面盖着雾。发现以后会点亮。"></canvas>${scale}${lines}${quiz}<p class="panel-note">实线是渡口的船，虚线是热气球。外星谷只有热气球，而且是想象的航线。没发现也能从渡口出发。</p>${readButton('河谷在中间。发现一个谷，地图就点亮它。坐船的线是实的，热气球的线是虚的。')}`;
  }
  function paintVistaCanvas() {
    const canvas = root.querySelector('#vista-map');
    if (!canvas) return;
    drawVistaMap(canvas, { discovered: game.state.travel?.discovered || {}, band: vistaBand(game.state.settings?.ageBand) });
  }
  function stampsView() {
    const owned = new Set(game.state.travel?.stamps || []);
    return `<div class="stamp-grid">${STAMP_BOOK.map((stamp) => `<article class="stamp-card ${owned.has(stamp.id) ? 'owned' : ''}">${svg(stamp.icon, 36)}<strong>${escapeHTML(stamp.name)}</strong><p>${owned.has(stamp.id) ? '已经盖上' : escapeHTML(stamp.how)}</p></article>`).join('')}</div>`;
  }
  function pauseView() {
    const saveInfo = game.storageError || (!game.storage?.setItem ? '这个窗口暂时保留世界，请下载存档备份。' : (game.accountId ? '背包物品、放下的建筑和设置记在当前登录的账号上。换一个人登录，会进入那个人自己的河谷。' : '还没登录，世界只在这台浏览器里。登录后会记到账号上。'));
    const age = game.state.settings?.ageBand || '';
    const away = (game.state.travel?.current || 'he') !== 'he';
    const ageOptions = [['', '不设置'], ...AGE_BANDS.map((item) => [item.id, item.label])].map(([id, label]) => `<option value="${id}" ${age === id ? 'selected' : ''}>${label}</option>`).join('');
    return `<div class="panel-note">${svg('save', 32)}<span>${escapeHTML(saveInfo)}</span></div>${readButton(`${saveInfo}大人可以导出备份，也可以导入以前的存档。`)}<div class="panel-row">${button('save', '保存一下', { className: 'primary-btn' })}${button('close', '继续玩', { className: 'primary-btn' })}${away ? button('travel-home', '回家', { className: 'primary-btn', label: '回家' }) : ''}</div>${game.travelNotice ? `<p class="panel-notice" role="status">${escapeHTML(game.travelNotice)}</p>` : ''}<details class="panel-details" ${importPending ? 'open' : ''}><summary>给大人：备份与导入存档</summary><p>${game.accountId ? '已登录时，河谷存在这个账号下，换一台电脑登录也能回来。仍可以导出一份文件备份。' : '还没登录时，存档只在当前浏览器里。登录后会记到账号上。'}</p><label>年龄档（不记录生日）<select id="age-band">${ageOptions}</select></label><p>这只是打开对话时的默认长短。孩子随时可以换，不会扣东西。</p><div class="panel-row">${button('export', '下载存档 JSON')}${button('import-choose', '选择存档文件')}${backupBeforeImport ? button('export-backup', '下载导入前的备份') : ''}${game.getLegacyBackup?.()?button('export-legacy','下载升级前的备份'):''}${game.getTravelBackup?.()?button('export-travel','下载升级前的备份',{label:'下载旅行升级前的备份'}):''}${game.getMeiBackup?.()?button('export-mei','下载升级前的备份',{label:'下载美谷升级前的备份'}):''}${game.getXingBackup?.()?button('export-xing','下载升级前的备份',{label:'下载外星谷升级前的备份'}):''}${game.getVistaBackup?.()?button('export-vista','下载升级前的备份',{label:'下载远眺升级前的备份'}):''}</div><input id="save-import-input" type="file" accept=".json,application/json" hidden>${importPending ? `<div class="panel-note warning">已选：${escapeHTML(importPending.name)}。导入会替换当前世界；系统会先保留备份并检查存档。${button('import-confirm', '确认导入', { className: 'primary-btn' })}${button('import-cancel', '取消')}</div>` : ''}</details>${studio.pauseSection()}<p class="panel-notice" role="status">${escapeHTML(pauseNotice)}</p>`;
  }
  function helpView() {
    const cards = [
      ['footsteps', '走一走', '拖左下角方向盘移动。拖动空白处看四周。'],
      ['hand', '点一点击', '走到物品旁，点采集。树木、石头和黏土都有自己的取材点。'],
      ['plank', '自由建造', '先点底栏材料。电脑单击看预览，双击直接放置；触屏先点场景，再按住预览拖动，松手放置。绿色可以放，红色会说明原因。也可点确认按钮；旋转、取消和撤销都在底部。'],
      ['workbench', '木作工作台', '先点想做的东西，下面只出现这一样要用的坑。点制作会从背包拿走材料，做好的立刻放进背包。每种材料组合只对应一样结果。'],
      ['ball', '推一推球', '木球会从坡道滚下，走过去可以推它。点球，再点收起球，可以重复使用。最多放四个，不会过一会儿就消失。'],
      ['backpack', '造物互动', '单击放到河谷里的模型，旁边的菜单可以做动作、在原来的上面加一块或换颜色，或收回背包。改的还是这一个。双击靠近看看，再双击回到原来的视角。'],
      ['jump', '数字乐园', '走上东边的六边形小岛就会一直跳。点彩色石或卡片换玩法：数一数 4 岁、双数蹦、凑十、跳着数、乘法蹦、质数灯 10 岁。每跳一下出现数字、英文、算式和语音。点停下来才停止。'],
      ['balloon', '热气球游览', '从小院再往南走，过小路门就到专门的热气球草场。点乘坐就会起飞。飞高了可以看见海边的日谷、美谷，还有天上的外星谷。点剪影或箭头看一看，会盖一枚发现章。渡口不用发现也能走。可点转一圈看地图，或点自己开。想下来点降落到草坪基地。不消耗材料。空中可以点看风景去日谷、看风景去美谷，或飞向星星。路程和天气是简化的。飞向星星是游戏里的幻想航线。'],
      ['ferry', '去日谷', '走到小溪下游的渡口，点去日谷或去美谷。坐船的路程在游戏里变短了。外谷里随时可以回家。答题只给一点材料，不做也能采集和做手工。'],
      ['water', '游一游', '浅溪里慢慢走。南侧泳池的水更深，从木坡道进去会浮起划水。摇杆控制方向，游向池沿，或点上岸返回。这里的动作不是现实游泳教学。'],
      ['leaf','时间与生命','点顶部季节按钮，或点一株蒲公英观察。花草会慢慢变化。暂停或离线时停止，不需要赶着看完。'],
      ['kiln', '看条件', '制砖和种植会显示变化，真实时间被快进，原因可以点开看。'],
      ['save', '随时停下', '暂停会保存世界。登录后，背包和建筑记在这个账号上，换一个人登录会进入自己的河谷。'],
    ];
    return `<div class="panel-grid">${cards.map(([key, title, text]) => `<article class="help-card">${svg(key, 44)}<h3>${title}</h3><p>${text}</p>${readButton(text)}</article>`).join('')}</div><details class="panel-details"><summary>哪些是游戏约定？</summary><p>格子排列、原料份数、产量与建筑连接检查都是游戏约定。建筑连接检查不能判断现实房屋是否安全。加工和生长被快进；角色的软萌动作不改变实验物体的材料规律。</p><p>地图、图片和按钮足以操作，语音是可选帮助；设备不支持语音时也能继续玩。这里没有实时 AI 聊天，也不会为了答题延长家长设定的时间。</p></details><div class="panel-row">${button('open-inspiration', `${svg('book', 24)} 看看建筑点子卡`, { className: 'primary-btn' })}</div>`;
  }
  function miniMap(kind) {
    const tile = 20;
    const blocks = kind === 'shelter' ? [[1, 1, 'stone'], [3, 1, 'stone'], [1, 3, 'stone'], [3, 3, 'stone'], [1, 0, 'plank'], [2, 0, 'plank'], [3, 0, 'plank']] : [[1, 1, 'plank'], [2, 1, 'plank'], [3, 1, 'plank'], [3, 2, 'ramp'], [3, 3, 'plank'], [2, 3, 'plank']];
    return `<svg class="mini-map" viewBox="0 0 120 120" role="img" aria-label="${kind === 'shelter' ? '石块与木板围出的游戏休息角落示意' : '木板与坡道组成的小球道示意'}"><rect x="0" y="0" width="120" height="120" rx="14" fill="#d5edcd"/>${Array.from({ length: 5 }, (_, y) => Array.from({ length: 5 }, (_, x) => `<rect x="${10 + x * tile}" y="${10 + y * tile}" width="18" height="18" rx="3" fill="#c4e1b8"/>`).join('')).join('')}${blocks.map(([x, y, key]) => `<rect x="${10 + x * tile}" y="${10 + y * tile}" width="18" height="18" rx="3" fill="${key === 'stone' ? '#8b9c9b' : (key === 'ramp' ? '#e3b15b' : '#c88e51')}" stroke="#745135" stroke-width="1.5"/>`).join('')}${kind === 'track' ? '<circle cx="40" cy="40" r="6" fill="#ee9375" stroke="#fff" stroke-width="2"/>' : ''}</svg>`;
  }
  function inspirationView() {
    return `<div class="panel-note">${svg('book', 30)}<span><strong>AI 提供的游戏点子</strong>。可以改一改，也要试试看是否好用。</span></div><div class="panel-grid"><article class="inspiration-card">${miniMap('shelter')}<h3>我的小角落</h3><p>用石块和木板围出自己的休息角落。可以改形状、大小和位置，不用照着摆。</p>${readButton('点子一，用石块和木板做一个游戏里的小角落。你可以换一种样子，不用照着摆。')}</article><article class="inspiration-card">${miniMap('track')}<h3>弯弯小球道</h3><p>摆木板、坡道和挡板，放小球试一试。看球停在哪里，再动手改。</p>${readButton('点子二，用坡道和挡板做小球道。放一个球，看看它走到哪里。再改一改。')}</article></div><details class="panel-details"><summary>给大人：点子与现实规则</summary><p>这些是 AI 提供的游戏示意，没有经过人类对具体图例的审核，也不是实时聊天或现实施工图。格子与连接规则经过游戏简化；点子卡不能判断真实结构的承重或安全。</p></details>`;
  }
  function bodyView() {
    if(current==='land')return landView();
    if(current==='life')return lifeView();
    if (current === 'inventory') {
      itemEntries.forEach(([key]) => { if (inventoryCount(key) > 0) discovered.add(key); });
      const visible = itemEntries.filter(([key]) => inventoryCount(key) > 0 || (COLLECTABLE_ITEMS.includes(key) && discovered.has(key)));
      return `<p class="panel-note">${svg('hand', 24)}点建造材料可以带到手里，点普通原料可以听名称。</p>${keepsakeView()}${inventoryView('inventory-select', visible)}${studio.inventorySection()}<details class="panel-details"><summary>全部材料与用途</summary>${inventoryView('inventory-select', itemEntries, true)}</details>`;
    }
    if (current === 'craft') return craftView();
    if (current === 'workshop') return workshopView();
    if (current === 'axle') return axleView();
    if (isStudio(current)) return studio.body(current, context);
    if (current === 'kiln') return kilnView();
    if (current === 'garden') return gardenView();
    if (current === 'warehouse') return warehouseView();
    if (current === 'chest') return chestView();
    if (current === 'pause') return pauseView();
    if (current === 'washi') return washiView();
    if (current === 'fold') return foldView();
    if (current === 'stamps') return stampsView();
    if (current === 'vista') return vistaView();
    const meiBody = meiPanelHtml(current, { game, button, escapeHTML });
    if (meiBody) return meiBody;
    if (current === 'inspiration') return inspirationView();
    return helpView();
  }
  function landView(){
    const cards=nearbyFrontiers(game.state.land,game.state.player),hasFrontier=frontierChunks(game.state.land).length>0;
    const card=p=>`<article class="land-card">${svg('soil',48)}<strong>身边的${p.direction}草地</strong><small>${LAND_RULES.chunkSize} × ${LAND_RULES.chunkSize} 格</small>${button('land-open','开垦这里',{className:'primary-btn',data:{cx:p.cx,cz:p.cz}})}</article>`;
    return `<p class="panel-note">${svg('map',28)}走到边界 → 整理身边草地 → 点击发现</p>${cards.length?`<div class="land-frontier">${cards.map(card).join('')}</div>`:`<p class="panel-note">${hasFrontier?'先走到边界吧！沿着小地图，走向已开放草地的边缘。快到时会问你：想去看看吗？':'这版草地已全部展开啦，可以继续搭建和探索。'}</p>`}
      <p>${game.state.land.opened.length} 片新区 · 已发现 ${game.state.land.claimed.length} 份补给</p>
      <p class="panel-note">小兔、草地观察或宝箱会随机出现。物资包和宝箱只领一次，不伤害动物；里面也可能有做好的木板、斜坡或工作台。</p>
      ${landEncounters(game.state.land).length?'<p>回到地图，点发现标签。沿开好的草地走过去，也可以用摇杆。</p>':''}
      <details class="panel-details"><summary>给大人：生成与材料来源</summary><p>仅可在角色所在开放地块的共享边界附近整理对应草地，不能隔角或远程开区。新区是整理与发现的游戏约定，不是锄地创造土地。随机结果由世界种子决定，刷新一致；原物品都有普通采集/制作方式。本期最多新增48个8×8区块，不承诺无限地图或实际平板性能。</p></details>`;
  }
  function lifeView(){
    const info=realMoment(),plants=context.id?game.state.flora.filter(p=>p.id===context.id):game.state.flora.slice(0,3);
    const plantPicture=stage=>{
      const crown=stage==='seed'?'<circle cx="32" cy="19" r="11" fill="#f6edda" stroke="#99a58e"/>':stage==='flower'?'<circle cx="32" cy="19" r="10" fill="#eed396" stroke="#bd994a"/>':'<ellipse cx="32" cy="19" rx="5" ry="8" fill="#9aaf73"/>';
      return `<svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><ellipse cx="24" cy="49" rx="16" ry="5" fill="#789957" transform="rotate(20 24 49)"/><ellipse cx="40" cy="49" rx="16" ry="5" fill="#9aaf73" transform="rotate(-20 40 49)"/>${['leaf','rest'].includes(stage)?'':`<path d="M32 49V22" stroke="#789957" stroke-width="3"/>${crown}`}</svg>`;
    };
    return `<div class="large-clock">${realAnalogClock(180)}<span>短时针 · 长分针<br>跟家里的钟一样</span></div><div class="life-seasons life-dayparts">${LIFE_RULES.periods.map(p=>`<span class="${p===info.period?'active':''}">${p}</span>`).join('')}</div><div class="life-seasons">${LIFE_RULES.seasons.map((s,i)=>`<span class="${i===info.seasonIndex?'active':''}">${s}</span>`).join('')}</div>
      <p class="panel-note">${svg('leaf',28)}${info.dateLabel} · ${info.season} · ${info.weather.label} · ${info.period}</p>
      <div class="life-plants">${plants.map(p=>{
        const site=FLORA_BY_ID[p.id],stage=floraStage(p,game.state.clock),blocked=floraBlocked(site,game.state.blocks);
        const note=blocked?'上方有建筑，暂不长花序':info.seasonIndex===3?'冬天，根和叶歇着':info.seasonIndex===2?'秋天，叶子还在':site.shade?'半阴处，慢慢长':'暖季，继续成长';
        return `<article class="life-plant">${plantPicture(stage)}<strong>蒲公英 · ${FLORA_LABELS[stage]}</strong><span>${note}</span><div class="life-cycle">叶丛 → 花苞 → 黄花 → 种子头</div></article>`;
      }).join('')}</div>${readButton('蒲公英春天和夏天开花。秋天留着叶子，冬天根和叶歇着。这里长得比真花快。')}
      <div class="panel-note">${svg('seed',28)}菜豆按水分成长，收获会留种，可以接着种。</div>
      <details class="panel-details"><summary>给大人：时间与简化规则</summary><p>季节和钟点读取这台设备的本地时间。春 3–5 月、夏 6–8 月、秋 9–11 月、冬 12–2 月。天气按当天日期固定，同一天看到的一样，不联网查预报。蒲公英只在春夏长花序，秋天留叶，冬天休眠。菜豆仍按游戏里的照料成长。暂停、隐藏和离线不推进窑和植物，没有枯死罚损。</p><p>${SPECIES.dandelion.description}</p><p>${SPECIES.bean.description}</p><p>野花全日照与半阴的速度差是游戏近似，上方建筑遮挡时暂停花序成长；未模拟真实土壤、温度、营养、风传播或所有物种。一天按本地钟点分成早上 5–11 点、中午 11–13 点、下午 13–18 点、晚上 18–23 点、深夜 23–5 点。天空和光照跟着分钟变化，不按纬度计算日出日落。蒲公英的花在早上到下午张开，晚上和深夜合拢。</p></details>`;
  }
  function render({ focusFirst = false } = {}) {
    if (!current) return;
    if (current === 'workshop' && workshop && !focusFirst) return;
    if (current === 'axle' && axle && !focusFirst) return;
    if (isStudio(current) && studio.isLive(current) && !focusFirst) return;
    const markup = `<div class="modal-backdrop" data-action="backdrop"><section class="game-panel" data-panel="${current}" role="dialog" aria-modal="true" aria-labelledby="game-panel-title" tabindex="-1"><header class="panel-header"><h2 id="game-panel-title">${escapeHTML(TITLES[current] || TITLES.help)}</h2>${button('close', '<span aria-hidden="true">×</span>', { className: 'icon-btn', label: '关闭面板，回到世界' })}</header><div class="panel-body">${bodyView()}</div><footer class="panel-footer${current === 'craft' ? ' craft-confirm-row' : ''}"><span>随时离开 · 可以保存和备份</span>${current === 'craft' ? button('craft-confirm', '确认制作', { className: 'primary-btn', disabled: !craftCanConfirm() }) : ''}${button('close', '回到世界', { className: 'secondary-btn' })}</footer></section></div>`;
    if (!focusFirst && markup === lastMarkup) return;
    const body = root.querySelector('.panel-body');
    const scroll = root.querySelector('.game-panel')?.dataset.panel === current ? (body?.scrollTop || 0) : 0;
    const active = document.activeElement;
    const activeData = active && root.contains(active) ? { ...active.dataset } : null;
    const sameControl = (element) => element.tagName === active?.tagName && Object.keys(activeData || {}).every((key) => element.dataset[key] === activeData[key]) && (element.tagName !== 'SUMMARY' || element.textContent === active.textContent);
    const activeIndex = activeData ? [...root.querySelectorAll('button, select, input, summary, a[href]')].filter(sameControl).indexOf(active) : -1;
    const selectValues = [...root.querySelectorAll('[data-transplant-from]')].map((element) => [element.dataset.transplantFrom, element.value]);
    const openDetails = [...root.querySelectorAll('details[open]')].map((element) => element.querySelector('summary')?.textContent);
    workshop?.dispose();
    workshop = null;
    axle?.dispose();
    axle = null;
    studio.unmount();
    root.innerHTML = markup;
    if (current === 'vista') paintVistaCanvas();
    if (current === 'workshop') workshop = new Workshop3D(root, game, { large: canUseLargeGrid(), notify: notifyResult });
    if (current === 'axle') axle = new Axle3D(root);
    if (isStudio(current)) studio.mount(current, root);
    lastMarkup = markup;
    root.querySelector('.panel-body').scrollTop = scroll;
    root.querySelectorAll('details').forEach((element) => { if (openDetails.includes(element.querySelector('summary')?.textContent)) element.open = true; });
    root.querySelectorAll('[data-transplant-from]').forEach((element) => {
      const entry = selectValues.find(([id]) => id === element.dataset.transplantFrom);
      if (entry && [...element.options].some((option) => option.value === entry[1])) element.value = entry[1];
    });
    if (focusFirst) root.querySelector('[data-action="close"]')?.focus();
    else if (activeData) {
      const controls = [...root.querySelectorAll('button, select, input, summary, a[href]')].filter(sameControl);
      const control = controls[activeIndex] || controls[0];
      (control && !control.disabled ? control : root.querySelector('.game-panel'))?.focus({ preventScroll: true });
    }
  }
  function open(type, details = {}) {
    cancelCraftDrag();
    workshop?.dispose();
    workshop = null;
    axle?.dispose();
    axle = null;
    studio.unmount();
    if (!current) {
      previousFocus = document.activeElement;
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    current = type === 'craft' && !details.flat ? 'workshop' : TITLES[type] ? type : 'help';
    context = details || {};
    if (current === 'craft') {
      side = context.atWorkbench || context.public || context.workbench ? 3 : 2;
      grid = emptyGrid(side);
      selectedRecipe = null;
      craftNotice = '';
      if (inventoryCount(selectedMaterial) === 0 || !recipeInputs.has(selectedMaterial)) selectedMaterial = itemEntries.find(([key]) => recipeInputs.has(key) && inventoryCount(key) > 0)?.[0] || selectedMaterial;
    }
    importPending = null;
    render({ focusFirst: true });
  }
  function close() {
    if (!current) return;
    cancelCraftDrag();
    workshop?.dispose();
    workshop = null;
    axle?.dispose();
    axle = null;
    studio.unmount();
    current = null;
    context = {};
    importPending = null;
    root.innerHTML = '';
    lastMarkup = '';
    document.body.style.overflow = previousOverflow;
    previousFocus?.focus?.({ preventScroll: true });
    onClose();
  }
  function download(text, filename) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportText() {
    const value = game.exportSave();
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  }
  function cancelCraftDrag(){
    craftDrag?.ghost?.remove();craftDrag=null;
    root.querySelectorAll('.drag-over').forEach(e=>e.classList.remove('drag-over'));
  }
  root.addEventListener('pointerdown',event=>{
    if(current!=='craft')return;
    if(craftDrag&&craftDrag.id!==event.pointerId){cancelCraftDrag();return;}
    const source=event.target.closest('[data-action="craft-material"]');
    if(!source||source.disabled||event.button!==0)return;
    craftDrag={id:event.pointerId,item:source.dataset.item,x:event.clientX,y:event.clientY,moved:false};
    source.setPointerCapture?.(event.pointerId);
  });
  root.addEventListener('pointermove',event=>{
    const drag=craftDrag;if(!drag||drag.id!==event.pointerId)return;
    if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<CRAFT_RULES.dragThreshold)return;
    drag.moved=true;event.preventDefault();
    if(!drag.ghost){drag.ghost=document.createElement('div');drag.ghost.className='craft-drag-ghost';drag.ghost.innerHTML=svg(drag.item,44);document.body.append(drag.ghost);}
    drag.ghost.style.left=`${event.clientX}px`;drag.ghost.style.top=`${event.clientY}px`;
    root.querySelectorAll('.drag-over').forEach(e=>e.classList.remove('drag-over'));
    const slot=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-action="craft-slot"]');
    if(slot&&root.contains(slot))slot.classList.add('drag-over');
  },{passive:false});
  root.addEventListener('pointerup',event=>{
    const drag=craftDrag;if(!drag||drag.id!==event.pointerId)return;
    const slot=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-action="craft-slot"]');
    cancelCraftDrag();if(!drag.moved)return;
    const x=Number(slot?.dataset.x),y=Number(slot?.dataset.y);
    if(slot&&root.contains(slot)&&Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<side&&y<side){
      grid[y][x]=drag.item;selectedMaterial=drag.item;craftNotice='材料仍在背包里，点制作才消耗。';
    }else craftNotice='还没放进格子，材料仍在背包里。';
    render();
  });
  root.addEventListener('pointercancel',cancelCraftDrag);
  function toggleWorkshopFold(fold, willOpen) {
    workshopFold = willOpen ? fold.dataset.fold : (workshopFold === fold.dataset.fold ? '' : workshopFold);
    root.querySelectorAll('.workshop-fold').forEach(el => { el.open = willOpen && el === fold; });
  }
  function onAction(event) {
    const foldSummary = event.target.closest('.workshop-fold > summary');
    if (foldSummary && root.contains(foldSummary) && current) {
      event.preventDefault();
      const fold = foldSummary.closest('.workshop-fold');
      toggleWorkshopFold(fold, !fold.open);
    }
    const target = event.target.closest('[data-action]');
    if (!target || !root.contains(target) || !current || target.disabled) return;
    const action = target.dataset.action;
    if (action === 'backdrop') { if (event.target === target) close(); return; }
    if (action === 'close') { close(); return; }
    if (action === 'speak') { safeSpeak(target.dataset.text); return; }
    if (handleMeiAction({ action, target, game, notifyResult, render })) return;
    if (studio.handle(action, target)) return;
    if (action === 'open-inspiration') { open('inspiration'); return; }
    if (action === 'workshop-flat') { open('craft', { ...context, flat: true }); return; }
    if (action === 'workshop-build') {
      const item = target.dataset.item;
      if (inventoryCount(item) <= 0) {
        const status = root.querySelector('#workshop-status');
        const message = `背包里还没有${nameOf(item)}。先点上面的「制作」做出来。`;
        if (status) status.textContent = message;
        else craftNotice = message;
        safeSpeak(message);
        toast(message);
        if (current === 'craft') render();
        return;
      }
      safeSpeak(`带好了${nameOf(item)}。到空地上摆，可以和别的模块接在一起。`);
      onSelect(item);
      close();
      return;
    }
    if (action === 'workshop-gather') {
      const item = target.dataset.item;
      const math = workshopWant ? mathPits(recipes.find(entry => entry.id === workshopWant), game.state.inventory || {}, mathPut[workshopWant] || 0) : null;
      const extra = math ? lackItems(math).find(entry => entry.item === item) : null;
      const message = extra ? `${extra.name}还差 ${extra.lack} ${extra.unit}。${extra.where}。` : `${nameOf(item)}不用在工作台做，去地图上的取材点采集。`;
      toast(message);
      safeSpeak(message);
      close();
      return;
    }
    if (action === 'workshop-kiln') { open('kiln'); return; }
    if (action === 'workshop-garden') { open('garden'); return; }
    if (action === 'workshop-want') {
      workshopWant = target.dataset.recipe;
      selectedRecipe = workshopWant;
      const fold = WORKSHOP_FOLDS.find(entry => entry.ids.includes(workshopWant));
      if (fold) workshopFold = fold.id;
      if (current === 'workshop' && workshop) {
        paintWants();
        paintBoard();
        root.querySelectorAll('.workshop-fold').forEach(el => { el.open = el.dataset.fold === workshopFold; });
        const picked = recipes.find(entry => entry.id === workshopWant);
        const math = picked ? mathPits(picked, game.state.inventory || {}, mathPut[workshopWant] || 0) : null;
        if (math?.short) {
          const message = lackHint(math);
          toast(message);
          safeSpeak(message);
        }
        return;
      }
      render();
      return;
    }
    if (action === 'math-pit') {
      const recipe = recipes.find(entry => entry.id === target.dataset.recipe);
      if (!recipe) return;
      const currentPut = mathPut[recipe.id] || 0;
      const math = mathPits(recipe, game.state.inventory || {}, currentPut);
      if (target.classList.contains('filled')) mathPut[recipe.id] = Math.max(0, currentPut - 1);
      else if (math.canPut) mathPut[recipe.id] = currentPut + 1;
      else {
        const message = lackHint(math) || '再去采一点';
        toast(message);
        safeSpeak(message);
      }
      paintMath(recipe.id);
      return;
    }
    if (action === 'workshop-goal' || action === 'craft-goal') { makeFromRecipe(target.dataset.recipe); return; }
    if (action === 'workshop-pull') { workshop?.craft(); return; }
    if (action === 'workshop-size') { workshop?.resizeSlots(Number(target.dataset.side)); return; }
    if (action === 'workshop-clear') { if (workshop) { workshop.session.clear(); workshop.lastProduct = null; workshop.refresh(); } return; }
    if (action === 'axle-toggle') { axle?.toggle(target.dataset.side); return; }
    if (action === 'axle-turn') { axle?.turn(target.dataset.side); return; }
    if(action==='land-open'){const result=onReclaim(Number(target.dataset.cx),Number(target.dataset.cz));notifyResult(result);if(result.ok)close();else render();return;}
    if (action === 'inventory-select') {
      const item = target.dataset.item;
      if (isBuildable(item) && inventoryCount(item) > 0) { safeSpeak(`带好了${nameOf(item)}，现在可以在空地上建造。`); onSelect(item); close(); }
      else safeSpeak(`${nameOf(item)}。${itemData[item]?.description || ''}${inventoryCount(item) === 0 ? '背包里暂时没有，可以去地图上采集。' : ''}`);
      return;
    }
    if (action === 'craft-material') { selectedMaterial = target.dataset.item; safeSpeak(`选好了${nameOf(selectedMaterial)}，现在可以点空格。`); render(); return; }
    if (action === 'craft-slot') {
      const x = Number(target.dataset.x); const y = Number(target.dataset.y);
      grid[y][x] = grid[y][x] ? null : selectedMaterial;
      craftNotice = '';
      render(); return;
    }
    if (action === 'craft-size') { side = Number(target.dataset.side); grid = emptyGrid(side); selectedRecipe = null; render(); return; }
    if (action === 'craft-clear') { grid = emptyGrid(side); selectedRecipe = null; craftNotice = '材料都还在背包里。'; render(); return; }
    if (action === 'craft-result') { selectedRecipe = target.dataset.recipe; render(); return; }
    if (action === 'craft-example'||action==='craft-goal') {
      const recipe = recipes.find((entry) => entry.id === target.dataset.recipe);
      if (recipe && recipeFits(recipe)) {
        grid = emptyGrid(side);
        recipePattern(recipe).forEach((row, y) => row.forEach((item, x) => { grid[y][x] = item; }));
        selectedRecipe = recipe.id;
        craftNotice = '只展示样式，还没有消耗材料。点“确认制作”才会制作。';
        safeSpeak(craftNotice);
        const book = root.querySelector('.craft-recipe-book');
        if (book) book.open = false;
        root.querySelector('.panel-body').scrollTop = 0;
        render();
      }
      return;
    }
    if (action === 'craft-confirm') {
      const result = game.craft(grid, selectedRecipe);
      craftNotice = result.message;
      if (notifyResult(result)) { grid = emptyGrid(side); selectedRecipe = null; }
      render(); return;
    }
    if (action === 'kiln-start') {
      const result = game.startKiln(2, target.dataset.mode);
      kilnNotice = result.message;
      notifyResult(result);
      if (result.ok) close();
      else render();
      return;
    }
    if (action === 'kiln-claim') { const result = game.claimKiln(); kilnNotice = result.message; notifyResult(result); render(); return; }
    if (action.startsWith('garden-')) {
      const id = target.dataset.id;
      let result;
      if (action === 'garden-plant') result = game.plant(id);
      if (action === 'garden-water') result = game.water(id);
      if (action === 'garden-harvest') result = game.harvestPlant(id);
      if (action === 'garden-transplant') {
        const select = [...root.querySelectorAll('[data-transplant-from]')].find((element) => element.dataset.transplantFrom === id);
        result = game.transplant(id, select?.value);
      }
      if (result) { gardenNotice = result.message; notifyResult(result); render(); }
      return;
    }
    if (action === 'order-answer') {
      const order = orders[Number(target.dataset.order)];
      if (!order || order.answered) return;
      const answer = order.kind === 'word' ? target.dataset.answer : Number(target.dataset.answer);
      const correct = answer === order.answer;
      const result = game.rewardOrder(order.id, order.reward, correct);
      if (correct && result.ok) { order.answered = true; order.hint = `仓库发给你 ${order.reward.count} 份${nameOf(order.reward.item)}。想走就可以走。`; onChanged(); toast(order.hint); }
      else if (correct) order.hint = result.message || '这份补给已经领取过啦。';
      else order.hint = order.kind === 'add' ? '看空位：已有的木料放好后，数一数还空着几个位置。' : (order.kind === 'subtract' ? '装走的先放一边，再数留在货架上的黏土。' : `你选的是${nameOf(answer)}。看木头的图，再听一遍：木，mù。`);
      safeSpeak(order.hint);
      render(); return;
    }
    if (action === 'chest-deposit' || action === 'chest-withdraw') {
      const result = action === 'chest-deposit' ? game.depositChest(context.id, target.dataset.item, 1) : game.withdrawChest(context.id, target.dataset.item, 1);
      notifyResult(result); render(); return;
    }
    if (action === 'save') {
      try { const result = game.save(); pauseNotice = result?.message || '已经保存。现在可以放心停下。'; toast(pauseNotice); }
      catch { pauseNotice = '当前浏览器没有保存成功，请先下载存档备份。'; toast(pauseNotice); }
      render(); return;
    }
    if(action==='export-legacy'){const text=game.getLegacyBackup?.();if(text)download(text,'我的河谷-生命升级前备份.json');else toast('暂时没有升级前备份。');return;}
    if(action==='export-travel'){const text=game.getTravelBackup?.();if(text)download(text,'我的河谷-旅行升级前备份.json');else toast('暂时没有旅行升级前的备份。');return;}
    if(action==='export-mei'){const text=game.getMeiBackup?.();if(text)download(text,'我的河谷-美谷升级前备份.json');else toast('暂时没有美谷升级前的备份。');return;}
    if(action==='export-xing'){const text=game.getXingBackup?.();if(text)download(text,'我的河谷-外星谷升级前备份.json');else toast('暂时没有外星谷升级前的备份。');return;}
    if(action==='export-vista'){const text=game.getVistaBackup?.();if(text)download(text,'我的河谷-远眺升级前备份.json');else toast('暂时没有远眺升级前的备份。');return;}
    if(action==='vista-quiz'){
      const before = JSON.stringify(game.state.inventory);
      const graded = gradeVistaQuiz(target.dataset.choice);
      if (JSON.stringify(game.state.inventory) !== before) return;
      vistaQuizNote = graded.message;
      safeSpeak(graded.message);
      render();
      return;
    }
    if(action==='travel-home'){onTravelHome();return;}
    if(action==='washi-start'){const result=game.startWashi();notifyResult(result);render();return;}
    if(action==='washi-claim'){const result=game.claimWashi();notifyResult(result);render();return;}
    if(action==='fold-make'){
      const recipe = target.dataset.recipe;
      const grid = recipe === 'paper-koinobori' ? [['washi', 'bamboo-strip']] : recipe === 'paper-door' ? [['washi', 'stick']] : recipe === 'paper-boat' ? [['washi', 'washi']] : [['washi']];
      const result = game.craft(grid, recipe);
      notifyResult(result); render(); return;
    }
    if (action === 'export' || action === 'export-backup') {
      try { download(action === 'export-backup' ? backupBeforeImport : exportText(), `我的河谷-${action === 'export-backup' ? '导入前备份-' : ''}${Date.now()}.json`); }
      catch { toast('备份暂时没有导出成功，请再试一下。'); }
      return;
    }
    if (action === 'import-choose') { root.querySelector('#save-import-input')?.click(); return; }
    if (action === 'import-cancel') { importPending = null; pauseNotice = '已取消，当前世界没有改变。'; render(); return; }
    if (action === 'import-confirm' && importPending) {
      try {
        backupBeforeImport = exportText();
        const result = game.importSave(importPending.text);
        pauseNotice = result?.message || (result?.ok ? '存档已导入。' : '这个文件不能导入，当前世界没有改变。');
        if (result?.ok) { importPending = null; onChanged(); }
        toast(pauseNotice);
      } catch { pauseNotice = '这个文件不能导入，当前世界没有改变。'; toast(pauseNotice); }
      render();
    }
  }
  root.addEventListener('click', onAction);
  root.addEventListener('change', async (event) => {
    if (event.target.id === 'age-band') {
      const value = event.target.value;
      const ageBand = value === 'little' || value === 'bigger' || value === 'older' ? value : null;
      game.mutate((state) => { state.settings.ageBand = ageBand; });
      onAge(ageBand);
      return;
    }
    if (event.target.id !== 'save-import-input') return;
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { pauseNotice = '文件太大，请选择本游戏导出的 JSON 存档。'; render(); return; }
    try {
      const text = await file.text();
      JSON.parse(text);
      if (current !== 'pause') return;
      importPending = { name: file.name, text };
      pauseNotice = '先确认，再由游戏检查存档。';
    } catch { pauseNotice = '文件不是可读取的 JSON，当前世界没有改变。'; }
    if (current === 'pause') render();
  });
  document.addEventListener('keydown', (event) => {
    if (!current) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key !== 'Tab') return;
    const focusables = [...root.querySelectorAll('button:not([disabled]), summary, select, input:not([hidden]), a[href], [tabindex="0"]')].filter((element) => element.getClientRects().length > 0);
    const first = focusables[0]; const last = focusables.at(-1);
    if (!first) { event.preventDefault(); root.querySelector('.game-panel')?.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
  }, true);

  root.addEventListener('workshop-math', () => {
    if (current !== 'workshop' && current !== 'craft') return;
    const id = workshopWant || selectedRecipe;
    if (!id) return;
    const recipe = recipes.find(entry => entry.id === id);
    if (!recipe) return;
    const math = mathPits(recipe, game.state.inventory || {}, mathPut[id] || 0);
    if ((mathPut[id] || 0) > math.put && math.put < math.need) mathPut[id] = math.put;
    paintMath(id);
    paintCounts();
  });
  return { open, close, isOpen: () => Boolean(current), type: () => current, refresh: () => render(), touchKiln, workshop: () => workshop, axle: () => axle, studio: () => studio };
}
