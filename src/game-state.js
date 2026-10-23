import { ITEMS, RECIPES, COLLECTABLE_ITEMS, GARDEN_PLOTS, MAX_BUILD_HEIGHT, STORAGE_KEY, DAMAGED_BACKUP_KEY, FIGURES_KEY, LIFE_BACKUP_KEY, LAND_BACKUP_KEY, TRAVEL_BACKUP_KEY, MEI_BACKUP_KEY, MEI3_BACKUP_KEY, XING_BACKUP_KEY, VISTA_BACKUP_KEY, HOLO_BACKUP_KEY, XING_SHARD_BACKUP_KEY, STORY_BACKUP_KEY, LOOK_BACKUP_KEY, RI3_BACKUP_KEY, terrainHeight, isProtectedCell, roofSpan, roofWallAt } from './game-data.js';
import { defaultLook, normalizeLook } from './avatar-data.js';
import { REALM_BLOCK_LIMIT, REALMS, SUPPLY_COOLDOWN, SUPPLY_COUNT, WASHI_STAGES, WASHI_TOTAL_SECONDS, arrivalFor, defaultTravel, emptyRealm, inVisitorYard, isDockCell, normalizeAgeBand, realmContains, realmTerrainHeight, washiStage } from './realm-data.js';
import { TravelError, repairTravelRaw, validateTravel } from './travel-save.js';
import { advanceMaple, attachMei } from './mei-state.js';
import { BALL_RULES } from './ball-data.js';
import { LIFE_RULES, FLORA_SITES, FLORA_BY_ID, floraBlocked, createFlora, realMoment } from './life-data.js';
import { createLand, validateLand, isGridOpen, isPointOpen, frontierChunks, nearbyFrontiers, landEncounters } from './land-data.js';
import { createCreation, validateCreation } from './creation-rules.js';
import { creationMethods } from './creation-state.js';
import { homeHasFantasyLiving, isFantasyLiving } from './xing-save.js';
import { QUARANTINE_NOTE } from './xing-data.js';
import { KEEPSAKES, VISTAS } from './vista-data.js';
import { claimCrystal as takeCrystal, crystalStatus as crystalNow, grantPlaque as givePlaque, learnGlyphs as rememberGlyphs, recordExperiment as noteExperiment, releaseCheck, reuniteGugu as bringGugu, rewardXingSupply as payXingSupply, seeHopper as markHopper, seeMoss as markMoss, solvePuzzle as gradeXingPuzzle, sowCheck, startCrystal as beginCrystal, tickCrystals } from './xing-actions.js';
import { claimDome, ensureHolo, markWelcomed, noteStage, noteTogether, setAvatar, snapshotGrowth, syncFieldStarlight } from './holo-actions.js';
import { WELCOME_LINE } from './holo-data.js';
import { LANTERN_ALL, MIKO_CLUE, SHOP_ALL, canOpenCabinet, freshCity, shardNeed, shardTasks } from './ri-story.js';

const ITEM_KEYS = Object.keys(ITEMS);
const KILN_STAGES = ['idle', 'moistening', 'drying', 'firing', 'cooling', 'ready', 'failed'];
const KILN_MODES = ['normal', 'wet', 'fastCooling'];
const KILN_LABELS = { idle: '工坊空闲', moistening: '调湿与成形', drying: '干燥', firing: '烧制', cooling: '冷却', ready: '砖块已冷却', failed: '试样出现裂纹' };
const copy = value => JSON.parse(JSON.stringify(value));
const ok = (message, extra = {}) => ({ ok: true, message, ...extra });
const fail = message => ({ ok: false, message });
const isCount = value => Number.isSafeInteger(value) && value >= 0 && value <= 1000000;
const isPositive = value => isCount(value) && value > 0;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const blankInventory = () => Object.fromEntries(ITEM_KEYS.map(item => [item, 0]));
const emptyKiln = () => ({ stage: 'idle', elapsed: 0, count: 0, mode: 'normal' });
const inBounds = (x,z,land)=>isGridOpen(land,x,z);

export function createInitialState() {
  const travel = defaultTravel();
  travel.realms.mei = emptyRealm('mei');
  return {
    version: 1,
    inventory: { ...blankInventory(), wood: 4, plank: 12, stone: 6, ramp: 2, clay: 4, branch: 4, soil: 4, seed: 4, water: 4, ball: 1 },
    blocks: [],
    toys: [],
    clock: {elapsed:0},
    flora: createFlora(),
    land:createLand(),
    player: { x: -5, z: 5, y: 0 },
    settings: { sound: true, ageBand: null, quality: 'fast' },
    look: defaultLook(),
    travel,
    stats: { gathered: 0, crafted: 0, built: 0, orders: 0 },
    garden: GARDEN_PLOTS.map(plot => ({ ...plot, planted: false, age: 0, moisture: 1, harvested: false, moistureElapsed: 0, drainElapsed: 0 })),
    kiln: emptyKiln(),
    chests: {},
    claimedOrders: [],
    creation: createCreation(),
    nextId: 1,
  };
}

function readInventory(value) {
  if (!isRecord(value) || Object.keys(value).some(item => !Object.hasOwn(ITEMS, item))) throw new Error('存档包含未知材料。');
  const inventory = blankInventory();
  for (const item of ITEM_KEYS) {
    const count = value[item] ?? 0;
    if (!isCount(count)) throw new Error('存档的材料数量不正确。');
    inventory[item] = count;
  }
  return inventory;
}

export function validateSave(value) {
  if (!isRecord(value) || value.version !== 1) throw new Error('这个存档版本暂不支持。');
  const next = createInitialState();
  next.inventory = readInventory(value.inventory);
  next.land=validateLand(value.land===undefined?createLand():value.land);
  const clock=value.clock===undefined?{elapsed:0}:value.clock;
  if(!isRecord(clock)||!Number.isSafeInteger(clock.elapsed)||clock.elapsed<0||clock.elapsed>LIFE_RULES.maxElapsed)throw new Error('存档中的游戏时间不正确。');
  next.clock={elapsed:clock.elapsed};
  const flora=value.flora===undefined?createFlora():value.flora;
  if(!Array.isArray(flora)||flora.length!==FLORA_SITES.length||new Set(flora.map(p=>p?.id)).size!==flora.length)throw new Error('存档中的野花编号不正确。');
  next.flora=FLORA_SITES.map(site=>{
    const p=flora.find(p=>p?.id===site.id);
    if(!isRecord(p)||p.species!==site.species||!Number.isInteger(p.age)||p.age<0||p.age>=LIFE_RULES.flowerCycle)throw new Error('存档中的野花物种或成长不正确。');
    return {id:p.id,species:p.species,age:p.age};
  });
  const toys = value.toys ?? [];
  if (!Array.isArray(toys) || toys.length > BALL_RULES.maxCount) throw new Error('存档中的球玩具数量不正确。');
  const toyIds = new Set();
  next.toys = toys.map(t => {
    if (!isRecord(t) || !/^ball-[1-9]\d{0,8}$/.test(t.id) || toyIds.has(t.id) ||
      !['x','y','z','vx','vy','vz'].every(k => Number.isFinite(t[k])) ||
      !isPointOpen(next.land,t.x,t.z) ||
      t.y < -2 || t.y > 16 || ['vx','vy','vz'].some(k => Math.abs(t[k]) > BALL_RULES.maxSpeed)) throw new Error('存档中的球玩具位置或速度不正确。');
    toyIds.add(t.id);
    return Object.fromEntries(['id','x','y','z','vx','vy','vz'].map(k => [k, t[k]]));
  });
  if (homeHasFantasyLiving(value)) throw new Error('这份存档里有外星的活植物，没有导入。外星的植物要留在它自己的家，我们可以把它放进展柜看。');
  if (!Array.isArray(value.blocks) || value.blocks.length > 12000) throw new Error('存档的建筑数据不正确。');
  const ids = new Set();
  const positions = new Set();
  next.blocks = value.blocks.map(block => {
    if (!isRecord(block)) throw new Error('存档中的建筑位置或类型不正确。');
    const spanW = block.w == null ? 1 : block.w;
    const spanD = block.d == null ? 1 : block.d;
    if (!/^block-[1-9]\d*$/.test(block.id) || ids.has(block.id) || !ITEMS[block.item]?.placeable || !Number.isInteger(block.y) || !Number.isInteger(block.rotation) || block.rotation < 0 || block.rotation > 3 || !Number.isInteger(spanW) || spanW < 1 || spanW > 12 || !Number.isInteger(spanD) || spanD < 1 || spanD > 12 || (block.item !== 'roof' && (spanW !== 1 || spanD !== 1))) throw new Error('存档中的建筑位置或类型不正确。');
    for (let dx = 0; dx < spanW; dx++) for (let dz = 0; dz < spanD; dz++) {
      const cx = block.x + dx, cz = block.z + dz;
      if (!inBounds(cx, cz, next.land) || block.y < terrainHeight(cx, cz) || block.y > MAX_BUILD_HEIGHT) throw new Error('存档中的建筑位置或类型不正确。');
      const position = `${cx},${block.y},${cz}`;
      if (positions.has(position)) throw new Error('存档中有建筑重叠。');
      positions.add(position);
    }
    ids.add(block.id);
    return { id: block.id, item: block.item, x: block.x, y: block.y, z: block.z, rotation: block.rotation, w: spanW, d: spanD };
  });
  const p = value.player;
  if (!isRecord(p) || !isPointOpen(next.land,p.x,p.z) || !Number.isFinite(p.y) || p.y < -2 || p.y > 16) throw new Error('存档中的角色位置不正确。');
  next.player = { x: p.x, y: p.y, z: p.z };
  if (!isRecord(value.settings) || typeof value.settings.sound !== 'boolean') throw new Error('存档中的设置不正确。');
  const rawAge = value.settings.ageBand ?? null;
  const ageBand = normalizeAgeBand(rawAge);
  if (rawAge !== null && ageBand === null) throw new Error('存档中的年龄档不正确。');
  const quality = value.settings.quality;
  if (quality !== undefined && quality !== 'fast' && quality !== 'fine') throw new Error('存档中的画质不正确。');
  next.settings = { sound: value.settings.sound, ageBand, quality: quality === 'fine' ? 'fine' : 'fast' };
  const played = (Number(value.stats?.built) || 0) + (Number(value.stats?.gathered) || 0) + (Number(value.stats?.crafted) || 0) > 0 || (Array.isArray(value.blocks) && value.blocks.length > 0);
  next.look = normalizeLook(value.look, { played });
  if (!isRecord(value.stats)) throw new Error('存档中的记录不正确。');
  for (const stat of Object.keys(next.stats)) {
    if (!isCount(value.stats[stat])) throw new Error('存档中的记录数量不正确。');
    next.stats[stat] = value.stats[stat];
  }
  if (!Array.isArray(value.garden) || value.garden.length !== GARDEN_PLOTS.length) throw new Error('存档中的园地不正确。');
  next.garden = GARDEN_PLOTS.map(expected => {
    const plot = value.garden.find(p => p?.id === expected.id);
    if (!isRecord(plot) || plot.x !== expected.x || plot.z !== expected.z || plot.drainage !== expected.drainage || typeof plot.planted !== 'boolean' || typeof plot.harvested !== 'boolean' || !Number.isFinite(plot.age) || plot.age < 0 || plot.age > 90 || !Number.isInteger(plot.moisture) || plot.moisture < 0 || plot.moisture > 3) throw new Error('存档中的植物数据不正确。');
    const moistureElapsed = plot.moistureElapsed ?? 0;
    const drainElapsed = plot.drainElapsed ?? 0;
    if (!Number.isFinite(moistureElapsed) || moistureElapsed < 0 || moistureElapsed >= 60 || !Number.isFinite(drainElapsed) || drainElapsed < 0 || drainElapsed >= 8) throw new Error('存档中的园地时间不正确。');
    return { ...expected, planted: plot.planted, age: plot.age, moisture: plot.moisture, harvested: plot.harvested, moistureElapsed, drainElapsed };
  });
  const kiln = value.kiln;
  if (!isRecord(kiln) || !KILN_STAGES.includes(kiln.stage) || !KILN_MODES.includes(kiln.mode) || !Number.isFinite(kiln.elapsed) || kiln.elapsed < 0 || kiln.elapsed > 24 || !isCount(kiln.count) || kiln.count > 10) throw new Error('存档中的工坊数据不正确。');
  const expectedStage = kiln.elapsed === 24 ? (kiln.mode === 'normal' ? 'ready' : 'failed') : KILN_STAGES[1 + Math.floor(kiln.elapsed / 6)];
  if (kiln.stage === 'idle' ? (kiln.elapsed !== 0 || kiln.count !== 0 || kiln.mode !== 'normal') : (kiln.count < 1 || kiln.stage !== expectedStage)) throw new Error('存档中的工坊阶段不一致。');
  next.kiln = { stage: kiln.stage, elapsed: kiln.elapsed, count: kiln.count, mode: kiln.mode };
  if (!isRecord(value.chests)) throw new Error('存档中的箱子不正确。');
  next.chests = {};
  for (const block of next.blocks.filter(block => block.item === 'chest')) next.chests[block.id] = readInventory(value.chests[block.id] ?? {});
  if (Object.keys(value.chests).some(id => !Object.hasOwn(next.chests, id))) throw new Error('存档中有找不到的箱子。');
  if (!Array.isArray(value.claimedOrders) || value.claimedOrders.length > 10000 || value.claimedOrders.some(id => typeof id !== 'string' || id.length < 1 || id.length > 128) || new Set(value.claimedOrders).size !== value.claimedOrders.length) throw new Error('存档中的补给记录不正确。');
  next.claimedOrders = [...value.claimedOrders];
  next.creation = validateCreation(value.creation);
  try { next.travel = validateTravel(value.travel); }
  catch (error) {
    if (error?.travel) throw error;
    throw new TravelError(error?.message || '旅行记录不正确。');
  }
  const seenIds = new Set(next.blocks.map(block => block.id));
  for (const realm of Object.values(next.travel.realms)) {
    if (!Array.isArray(realm.blocks)) continue;
    for (const block of realm.blocks) {
      if (seenIds.has(block.id)) throw new TravelError('日谷的建筑编号和家里重复。', 'realm');
      seenIds.add(block.id);
    }
  }
  const maxId = Math.max(0, ...[...seenIds].map(id => Number(String(id).slice(6))));
  if (!Number.isSafeInteger(maxId) || maxId >= 1000000000) throw new Error('存档中的建筑编号不正确。');
  next.nextId = Math.max(maxId + 1, isPositive(value.nextId) ? value.nextId : 1);
  settleHolo(next);
  return next;
}

function xingLacksHolo(raw) {
  const xing = raw?.travel?.realms?.xing;
  return !isRecord(xing) || !Object.hasOwn(xing, 'holo');
}

function settleHolo(state) {
  if (!state?.travel?.realms?.xing) return;
  ensureHolo(state);
  syncFieldStarlight(state);
}

const FIGURE_BACKUP_KEYS = [STORAGE_KEY, DAMAGED_BACKUP_KEY, FIGURES_KEY, LIFE_BACKUP_KEY, LAND_BACKUP_KEY, TRAVEL_BACKUP_KEY, MEI_BACKUP_KEY, MEI3_BACKUP_KEY, XING_BACKUP_KEY, VISTA_BACKUP_KEY, HOLO_BACKUP_KEY, XING_SHARD_BACKUP_KEY, STORY_BACKUP_KEY, RI3_BACKUP_KEY];

function rawHasRi3(raw) {
  const ri = raw?.travel?.realms?.ri;
  return isRecord(ri) && (Object.hasOwn(ri, 'storyShard') || Object.hasOwn(ri, 'city'));
}

function ri3InState(state) {
  const ri = state?.travel?.realms?.ri;
  return isRecord(ri) && (ri.storyShard === true || isRecord(ri.city));
}

function writeOriginalBackup(storage, baseKey, text) {
  for (let i = 0; i < 100; i++) {
    const key = i ? `${baseKey}-${i}` : baseKey;
    const existing = storage.getItem(key);
    if (existing !== null && existing !== text) continue;
    if (existing === null) storage.setItem(key, text);
    if (storage.getItem(key) !== text) throw new Error('备份未写入');
    return key;
  }
  throw new Error('备份槽位已满');
}

export function figureRecordsFrom(raw) {
  const list = Array.isArray(raw?.creation?.figures) ? raw.creation.figures : (Array.isArray(raw?.figures) ? raw.figures : []);
  const kept = [];
  for (const fig of list) {
    if (kept.length >= 24) break;
    try {
      const checked = validateCreation({ ...createCreation(), figures: [...kept, fig] });
      const last = checked.figures[checked.figures.length - 1];
      if (last) kept.push(last);
    } catch { /* this creature cannot be rebuilt */ }
  }
  return kept;
}

export function mergeFigures(state, records) {
  if (!records?.length) return state;
  const next = copy(state);
  const ids = new Set(next.creation.figures.map(fig => fig.id));
  let nextId = next.creation.nextId || 1;
  for (const fig of records) {
    if (!fig || ids.has(fig.id) || next.creation.figures.length >= 24) continue;
    ids.add(fig.id);
    next.creation.figures.push(fig);
    const number = Number(String(fig.id).split('-').pop());
    if (Number.isInteger(number) && number >= nextId) nextId = number + 1;
  }
  next.creation.nextId = Math.max(next.creation.nextId || 1, nextId);
  return validateSave(next);
}

// A later rule may reject one section. Keep the backpack and the buildings when those sections still validate.
export function salvageSave(raw) {
  try { return validateSave(raw); }
  catch { /* keep the sections that still stand */ }
  if (!isRecord(raw)) return null;
  const next = createInitialState();
  let kept = false;
  const keep = (patch) => {
    try {
      const checked = validateSave({ ...createInitialState(), ...patch });
      for (const key of Object.keys(patch)) next[key] = checked[key];
      kept = true;
      return true;
    } catch {
      return false;
    }
  };
  const together = {};
  if (raw.land !== undefined) together.land = raw.land;
  if (raw.inventory !== undefined) together.inventory = raw.inventory;
  if (raw.blocks !== undefined) {
    together.blocks = raw.blocks;
    together.chests = raw.chests ?? {};
    if (raw.nextId !== undefined) together.nextId = raw.nextId;
  }
  if (raw.settings !== undefined) together.settings = raw.settings;
  if (Object.keys(together).length && !keep(together)) {
    if (raw.inventory !== undefined) keep({ inventory: raw.inventory });
    if (raw.blocks !== undefined && !keep({ land: raw.land, blocks: raw.blocks, chests: raw.chests ?? {}, nextId: raw.nextId })) {
      keep({ blocks: raw.blocks, chests: raw.chests ?? {}, nextId: raw.nextId });
    }
    if (raw.settings !== undefined) keep({ settings: raw.settings });
  }
  if (raw.creation !== undefined) {
    try { next.creation = validateCreation(raw.creation); kept = true; }
    catch {
      const records = figureRecordsFrom(raw);
      if (records.length) {
        next.creation = validateCreation({ ...createCreation(), figures: records });
        kept = true;
      }
    }
  }
  if (!kept) return null;
  try { return validateSave(next); }
  catch { return null; }
}

function normalizeGrid(grid) {
  if (!Array.isArray(grid) || grid.length < 1 || grid.length > 3 || !grid.every(row => Array.isArray(row) && row.length > 0 && row.length <= 3) || !grid.every(row => row.length === grid[0].length) || grid.flat().some(item => item !== null && !Object.hasOwn(ITEMS, item))) return null;
  const cells = [];
  for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[y].length; x++) if (grid[y][x] !== null) cells.push({ x, y, item: grid[y][x] });
  if (!cells.length) return [];
  const minX = Math.min(...cells.map(cell => cell.x));
  const minY = Math.min(...cells.map(cell => cell.y));
  const maxX = Math.max(...cells.map(cell => cell.x));
  const maxY = Math.max(...cells.map(cell => cell.y));
  const result = Array.from({ length: maxY - minY + 1 }, () => Array(maxX - minX + 1).fill(null));
  for (const cell of cells) result[cell.y - minY][cell.x - minX] = cell.item;
  return result;
}

function grantStamp(state, id) {
  if (!state.travel.stamps.includes(id)) state.travel.stamps.push(id);
}

export class GameState {
  constructor(storage) {
    if (storage === undefined) {
      try { storage = globalThis.localStorage; } catch { storage = null; }
    }
    this.storage = storage ?? null;
    this.state = createInitialState();
    this.listeners = new Set();
    this.history = [];
    this.tickRemainder = 0;
    this.storageError = null;
    this.damagedSaveText = null;
    this.figuresHealed = false;
    this.legacySaveText=null;this.legacyBackupKey=null;this.legacyBackupBase=LIFE_BACKUP_KEY;
    this.travelSaveText=null;this.travelBackupKey=null;this.travelNotice=null;
    this.xingSaveText=null;this.xingBackupKey=null;
    this.meiSaveText=null;this.meiBackupKey=null;
    this.mei3SaveText=null;this.mei3BackupKey=null;
    this.vistaSaveText=null;this.vistaBackupKey=null;
    this.holoSaveText=null;this.holoBackupKey=null;
    this.xingShardSaveText=null;this.xingShardBackupKey=null;
    this.storySaveText=null;this.storyBackupKey=null;
    this.lookSaveText=null;this.lookBackupKey=null;
    this.ri3SaveText=null;this.ri3BackupKey=null;
    this.load();
  }

  rememberFigures() {
    if (!this.storage?.setItem || !this.state.creation?.figures?.length) return;
    try { this.storage.setItem(FIGURES_KEY, JSON.stringify({ figures: this.state.creation.figures, nextId: this.state.creation.nextId })); }
    catch { /* the valley save still holds them when this copy cannot be written */ }
  }

  healFigures() {
    if (this.figuresHealed || !this.storage?.getItem) return;
    this.figuresHealed = true;
    if (this.state.creation.figures.length > 0) { this.rememberFigures(); return; }
    const records = [];
    const texts = [];
    if (typeof this.damagedSaveText === 'string') texts.push(this.damagedSaveText);
    for (const key of FIGURE_BACKUP_KEYS) {
      try { const text = this.storage.getItem(key); if (text) texts.push(text); } catch { /* skip one unread backup */ }
    }
    for (const text of texts) {
      try { records.push(...figureRecordsFrom(JSON.parse(text))); } catch { /* skip unreadable text */ }
    }
    if (!records.length) return;
    try {
      const merged = mergeFigures(this.state, records);
      if (merged.creation.figures.length > this.state.creation.figures.length) {
        this.state = merged;
        this.storageError = null;
        this.rememberFigures();
      }
    } catch { /* leave the current world if the creatures cannot be joined */ }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try { listener(this.state); } catch (error) { console.error('状态订阅出错', error); }
    }
  }

  mutate(fn) {
    fn(this.state);
    this.save();
    this.notify();
    return this.state;
  }

  save() {
    if (!this.storage?.setItem) {
      this.storageError = '进度只在当前窗口中暂时保留，刷新或关闭页面后不会恢复。请导出存档到文件。';
      return fail(this.storageError);
    }
    if(this.travelSaveText!==null){
      try{
        this.travelBackupKey=writeOriginalBackup(this.storage,TRAVEL_BACKUP_KEY,this.travelSaveText);
        this.travelSaveText=null;
      }catch{this.storageError='旅行升级前的世界未能备份。请先导出存档。';return fail(this.storageError);}
    }
    if(this.xingSaveText!==null){
      try{
        this.xingBackupKey=writeOriginalBackup(this.storage,XING_BACKUP_KEY,this.xingSaveText);
        this.xingSaveText=null;
      }catch{this.storageError='外星谷升级前的世界未能备份。请先导出存档。';return fail(this.storageError);}
    }
    if(this.meiSaveText!==null){
      try{
        this.meiBackupKey=writeOriginalBackup(this.storage,MEI_BACKUP_KEY,this.meiSaveText);
        this.meiSaveText=null;
      }catch{this.storageError='美谷升级前的世界未能备份。请先导出存档。';return fail(this.storageError);}
    }
    if(this.mei3SaveText!==null){
      try{
        this.mei3BackupKey=writeOriginalBackup(this.storage,MEI3_BACKUP_KEY,this.mei3SaveText);
        this.mei3SaveText=null;
      }catch{this.storageError='美谷片场升级前的世界未能备份。请先导出存档。';return fail(this.storageError);}
    }
    if(this.vistaSaveText!==null){
      try{
        this.vistaBackupKey=writeOriginalBackup(this.storage,VISTA_BACKUP_KEY,this.vistaSaveText);
        this.vistaSaveText=null;
      }catch{this.storageError='远眺升级前的世界未能备份。请先导出存档。';return fail(this.storageError);}
    }
    if(this.holoSaveText!==null){
      try{
        this.holoBackupKey=writeOriginalBackup(this.storage,HOLO_BACKUP_KEY,this.holoSaveText);
        this.holoSaveText=null;
      }catch{this.storageError='星网升级前的世界未能备份。请先导出存档。';return fail(this.storageError);}
    }
    if(this.xingShardSaveText!==null && this.state.travel?.realms?.xing?.storyShard === true){
      try{
        this.xingShardBackupKey=writeOriginalBackup(this.storage,XING_SHARD_BACKUP_KEY,this.xingShardSaveText);
        this.xingShardSaveText=null;
      }catch{this.storageError='星之片升级前的世界未能备份。请先导出存档。';return fail(this.storageError);}
    }
    if(this.storySaveText!==null){
      try{
        this.storyBackupKey=writeOriginalBackup(this.storage,STORY_BACKUP_KEY,this.storySaveText);
        this.storySaveText=null;
      }catch{this.storageError='故事升级前的世界未能备份。请先导出存档。';return fail(this.storageError);}
    }
    if(this.lookSaveText!==null){
      try{
        this.lookBackupKey=writeOriginalBackup(this.storage,LOOK_BACKUP_KEY,this.lookSaveText);
        this.lookSaveText=null;
      }catch{this.storageError='样子升级前的世界未能备份。请先导出存档。';return fail(this.storageError);}
    }
    if(this.ri3SaveText!==null && ri3InState(this.state)){
      try{
        this.ri3BackupKey=writeOriginalBackup(this.storage,RI3_BACKUP_KEY,this.ri3SaveText);
        this.ri3SaveText=null;
      }catch{this.storageError='日谷升级前的世界未能备份。请先导出存档。';return fail(this.storageError);}
    }
    if(this.legacySaveText!==null){
      try{
        this.legacyBackupKey=writeOriginalBackup(this.storage,this.legacyBackupBase,this.legacySaveText);
        this.legacySaveText=null;
      }catch{this.storageError='升级前的世界未能备份，原文仍保留。请先导出存档。';return fail(this.storageError);}
    }
    if (this.damagedSaveText !== null) {
      try {
        // Never replace the only original text until a separate copy exists.
        this.storage.setItem(DAMAGED_BACKUP_KEY, this.damagedSaveText);
        if (this.storage.getItem(DAMAGED_BACKUP_KEY) !== this.damagedSaveText) throw new Error('备份未写入');
        this.damagedSaveText = null;
      } catch {
        this.storageError = '原存档可能损坏，备份未能保存。请导出当前世界；原存档仍然保留。';
        return fail(this.storageError);
      }
    }
    this.healFigures();
    this.rememberFigures();
    if(this.xingSaveText===null && this.state.travel && !this.state.travel.realms.xing) this.state.travel.realms.xing = emptyRealm('xing');
    if(this.meiSaveText===null && this.state.travel && !this.state.travel.realms.mei) this.state.travel.realms.mei = emptyRealm('mei');
    settleHolo(this.state);
    try {
      this.storage.setItem(STORAGE_KEY, this.exportSave());
      this.storageError = null;
      return ok('世界已保存。');
    } catch {
      this.storageError = '浏览器未能保存，请导出存档到文件。';
      return fail(this.storageError);
    }
  }

  load() {
    if (!this.storage?.getItem) return fail('没有本地存档。');
    let text = null;
    try {
      text = this.storage.getItem(STORAGE_KEY);
      if (!text) return fail('没有本地存档。');
      const raw=JSON.parse(text);
      let next;
      try{ next = validateSave(raw); }
      catch(error){
        if(!error?.travel) throw error;
        const repaired=repairTravelRaw(raw);
        try{ next = validateSave(repaired.raw); }
        catch(again){
          if(!again?.travel) throw again;
          repaired.raw.travel=defaultTravel();
          next = validateSave(repaired.raw);
          repaired.notice='旅行记录有问题，已经回到河谷。家里的建筑和背包还在。';
        }
        this.travelSaveText=text;
        this.travelNotice=repaired.notice;
      }
      if(raw.travel===undefined) this.travelSaveText=text;
      const realmBag = raw.travel?.realms;
      const hasXing = Boolean(realmBag && Object.hasOwn(realmBag, 'xing'));
      const hasMei = Boolean(realmBag && Object.hasOwn(realmBag, 'mei'));
      if(!hasXing) this.xingSaveText=text;
      if(!hasMei) this.meiSaveText=text;
      const hasMei3 = Boolean(realmBag?.mei && typeof realmBag.mei.storyShard === 'boolean');
      if(!hasMei3) this.mei3SaveText=text;
      const hasVista = isRecord(raw.travel) && Object.hasOwn(raw.travel, 'discovered') && Object.hasOwn(raw.travel, 'keepsakes');
      if(!hasVista) this.vistaSaveText=text;
      if(xingLacksHolo(raw)) this.holoSaveText=text;
      const hasXingShard = Boolean(realmBag?.xing && typeof realmBag.xing.storyShard === 'boolean');
      if(!hasXingShard) this.xingShardSaveText=text;
      const storyRaw = raw.travel?.story;
      const hasStory = isRecord(storyRaw) && Object.hasOwn(storyRaw, 'fogIntro') && Object.hasOwn(storyRaw, 'restored') && Object.hasOwn(storyRaw, 'fogOff');
      if(!hasStory) this.storySaveText=text;
      if(!Object.hasOwn(raw, 'look')) this.lookSaveText=text;
      if(!rawHasRi3(raw)) this.ri3SaveText=text;
      this.legacySaveText=raw.clock===undefined||raw.flora===undefined||raw.land?.claimed===undefined?text:null;
      this.legacyBackupBase=raw.land?.claimed===undefined?LAND_BACKUP_KEY:LIFE_BACKUP_KEY;
      this.state = next;
      if(!hasXing && !this.state.travel.realms.xing) this.state.travel.realms.xing = emptyRealm('xing');
      if(!hasMei && !this.state.travel.realms.mei) this.state.travel.realms.mei = emptyRealm('mei');
      settleHolo(this.state);
      this.history = [];
      this.tickRemainder = 0;
      this.storageError = null;
      this.damagedSaveText = null;
      this.healFigures();
      this.notify();
      return ok('世界已恢复。暂停期间的植物与工坊没有推进。');
    } catch (error) {
      if (typeof text === 'string') this.damagedSaveText = text;
      let salvaged = null;
      try { salvaged = salvageSave(JSON.parse(text)); } catch { salvaged = null; }
      if (salvaged) this.state = salvaged;
      this.healFigures();
      if (this.state.creation.figures.length) {
        this.storageError = null;
        this.notify();
        return ok('造物已经找回。');
      }
      this.storageError = `存档未能读取：${error.message}`;
      return fail(this.storageError);
    }
  }

  exportSave() { return JSON.stringify(this.state, null, 2); }
  getLegacyBackup(){
    if(this.legacySaveText!==null)return this.legacySaveText;
    try{return this.storage?.getItem(this.legacyBackupKey||LAND_BACKUP_KEY)??this.storage?.getItem(LIFE_BACKUP_KEY)??null;}catch{return null;}
  }
  getTravelBackup(){
    if(this.travelSaveText!==null)return this.travelSaveText;
    try{return this.storage?.getItem(this.travelBackupKey||TRAVEL_BACKUP_KEY)??null;}catch{return null;}
  }
  getXingBackup(){
    if(this.xingSaveText!==null)return this.xingSaveText;
    try{return this.storage?.getItem(this.xingBackupKey||XING_BACKUP_KEY)??null;}catch{return null;}
  }
  getMeiBackup(){
    if(this.meiSaveText!==null)return this.meiSaveText;
    try{return this.storage?.getItem(this.meiBackupKey||MEI_BACKUP_KEY)??null;}catch{return null;}
  }
  getMei3Backup(){
    if(this.mei3SaveText!==null)return this.mei3SaveText;
    try{return this.storage?.getItem(this.mei3BackupKey||MEI3_BACKUP_KEY)??null;}catch{return null;}
  }
  getVistaBackup(){
    if(this.vistaSaveText!==null)return this.vistaSaveText;
    try{return this.storage?.getItem(this.vistaBackupKey||VISTA_BACKUP_KEY)??null;}catch{return null;}
  }
  getHoloBackup(){
    if(this.holoSaveText!==null)return this.holoSaveText;
    try{return this.storage?.getItem(this.holoBackupKey||HOLO_BACKUP_KEY)??null;}catch{return null;}
  }
  getXingShardBackup(){
    if(this.xingShardSaveText!==null)return this.xingShardSaveText;
    try{return this.storage?.getItem(this.xingShardBackupKey||XING_SHARD_BACKUP_KEY)??null;}catch{return null;}
  }
  getStoryBackup(){
    if(this.storySaveText!==null)return this.storySaveText;
    try{return this.storage?.getItem(this.storyBackupKey||STORY_BACKUP_KEY)??null;}catch{return null;}
  }
  getLookBackup(){
    if(this.lookSaveText!==null)return this.lookSaveText;
    try{return this.storage?.getItem(this.lookBackupKey||LOOK_BACKUP_KEY)??null;}catch{return null;}
  }
  getRi3Backup(){
    if(this.ri3SaveText!==null)return this.ri3SaveText;
    try{return this.storage?.getItem(this.ri3BackupKey||RI3_BACKUP_KEY)??null;}catch{return null;}
  }

  importSave(text) {
    try {
      if (typeof text !== 'string' || text.length > 5000000) return fail('存档文件太大或格式不正确。');
      const raw = JSON.parse(text);
      const next = validateSave(raw);
      const realmBag = raw.travel?.realms;
      const hasXing = Boolean(realmBag && Object.hasOwn(realmBag, 'xing'));
      const hasMei = Boolean(realmBag && Object.hasOwn(realmBag, 'mei'));
      if (!hasXing) {
        if (this.xingSaveText === null) this.xingSaveText = text;
        if (!next.travel.realms.xing) next.travel.realms.xing = emptyRealm('xing');
      }
      if (!hasMei) {
        if (this.meiSaveText === null) this.meiSaveText = text;
        if (!next.travel.realms.mei) next.travel.realms.mei = emptyRealm('mei');
      }
      const hasMei3 = Boolean(realmBag?.mei && typeof realmBag.mei.storyShard === 'boolean');
      if (!hasMei3 && this.mei3SaveText === null) this.mei3SaveText = text;
      const hasVista = isRecord(raw.travel) && Object.hasOwn(raw.travel, 'discovered') && Object.hasOwn(raw.travel, 'keepsakes');
      if (!hasVista && this.vistaSaveText === null) this.vistaSaveText = text;
      if (xingLacksHolo(raw) && this.holoSaveText === null) this.holoSaveText = text;
      const hasXingShard = Boolean(realmBag?.xing && typeof realmBag.xing.storyShard === 'boolean');
      if (!hasXingShard && this.xingShardSaveText === null) this.xingShardSaveText = text;
      if (!rawHasRi3(raw) && this.ri3SaveText === null) this.ri3SaveText = text;
      settleHolo(next);
      this.state = next;
      this.history = [];
      this.tickRemainder = 0;
      this.save();
      this.notify();
      return ok('世界已导入。植物与工坊从保存的时刻继续。');
    } catch (error) { return fail(`无法导入：${error.message}`); }
  }

  addItem(item, count) {
    if (!Object.hasOwn(ITEMS, item) || !isPositive(count) || !isCount(this.state.inventory[item] + count)) return fail('材料和数量不正确。');
    this.mutate(state => { state.inventory[item] += count; });
    return ok(`得到${count}份${ITEMS[item].name}。`, { item, count });
  }

  consumeItem(item, count) {
    if (!Object.hasOwn(ITEMS, item) || !isPositive(count)) return fail('材料和数量不正确。');
    if (this.state.inventory[item] < count) return fail(`${ITEMS[item].name}还差${count - this.state.inventory[item]}份，可以去采集。`);
    this.mutate(state => { state.inventory[item] -= count; });
    return ok(`使用${count}份${ITEMS[item].name}。`, { item, count });
  }

  harvest(item) {
    if (!COLLECTABLE_ITEMS.includes(item)) return fail('这种材料需要加工或种植得到。');
    if (ITEMS[item]?.origin === 'ri' && (this.state.travel?.current || 'he') !== 'ri') return fail('这种材料在日谷采集。楮树林和竹林一直都在，不用答题。');
    if (ITEMS[item]?.origin === 'mei' && this.currentRealm() !== 'mei') return fail('这种材料在美谷采集。枫树林、原木堆、南瓜地和旧衣回收箱一直都在，不用答题。');
    if (ITEMS[item]?.origin === 'xing' && (this.state.travel?.current || 'he') !== 'xing') return fail('这种材料在外星谷采集。盐湖一直可以取，不用答题。');
    if (!isCount(this.state.inventory[item] + 2)) return fail('背包里的这种材料已经很多了。');
    this.mutate(state => { state.inventory[item] += 2; state.stats.gathered += 2; });
    return ok(`采到2份${ITEMS[item].name}。`, { item, count: 2 });
  }

  currentRealm(state = this.state) {
    return state.travel?.current || 'he';
  }
  blockBag(state = this.state) {
    const id = this.currentRealm(state);
    if (id === 'he') return state;
    if (!state.travel.realms[id]) state.travel.realms[id] = emptyRealm(id);
    return state.travel.realms[id];
  }
  activeBlocks() { return this.blockBag().blocks; }
  chestBag(id) {
    const chests = this.blockBag().chests;
    return chests && Object.hasOwn(chests, id) ? chests[id] : null;
  }
  coversCell(block, x, y, z) {
    const w = block.w || 1, d = block.d || 1;
    return block.y === y && x >= block.x && x < block.x + w && z >= block.z && z < block.z + d;
  }

  placementProblem(item, position) {
    if (isFantasyLiving(item)) return QUARANTINE_NOTE;
    if (!ITEMS[item]?.placeable) return '这种物品暂时不能作为建筑放置。';
    if (!isRecord(position)) return '先选择一个空格。';
    const realm = this.currentRealm();
    const realmName = REALMS[realm]?.name || '这一谷';
    const blocks = this.activeBlocks();
    const spot = item === 'roof' && !position.w ? { ...position, ...roofSpan(blocks, position), rotation: 0 } : { w: 1, d: 1, rotation: 0, ...position };
    const { x, y, z, rotation = 0 } = spot;
    const w = spot.w || 1, d = spot.d || 1;
    if (!Number.isInteger(y) || y > MAX_BUILD_HEIGHT) return realm === 'he' ? '先开垦这片区域，再在空格里搭建。' : `这里出了${realmName}的范围。`;
    if (!Number.isInteger(rotation) || rotation < 0 || rotation > 3) return '方向不正确，转一转再放。';
    if (realm !== 'he' && blocks.length >= REALM_BLOCK_LIMIT) return `${realmName}的访客小院已经放了 ${REALM_BLOCK_LIMIT} 块，先取回一些再搭。`;
    const ground = (cx, cz) => realm === 'he' ? terrainHeight(cx, cz) : realmTerrainHeight(realm, cx);
    for (let dx = 0; dx < w; dx++) for (let dz = 0; dz < d; dz++) {
      const cx = x + dx, cz = z + dz;
      if (realm === 'he') {
        if (!inBounds(cx, cz, this.state.land) || y < ground(cx, cz)) return '先开垦这片区域，再在空格里搭建。';
        if (isDockCell(cx, cz, this.state.blocks)) return '这里是渡口，小船要停靠。旁边可以搭建。';
        if (isProtectedCell(cx, cz)) return '这里是大家共用的设施、菜地或通道，旁边的空地可以自由搭建。';
        if (landEncounters(this.state.land).some(e => Math.hypot(e.x - cx, e.z - cz) < 1.1)) return '给小动物和发现点留一点空间，旁边可以搭建。';
      } else {
        if (!Number.isInteger(cx) || !Number.isInteger(cz) || !realmContains(realm, cx, cz)) return `这里出了${realmName}的范围。`;
        if (!inVisitorYard(realm, cx, cz) || y < ground(cx, cz)) return '这里是朋友的家和园子，去访客小院搭建吧。';
      }
      if (blocks.some(block => {
        if (!this.coversCell(block, cx, y, cz)) return false;
        const wideRoof = block.item === 'roof' && ((block.w || 1) > 1 || (block.d || 1) > 1);
        if (wideRoof && item !== 'roof') return false;
        if (item === 'roof' && block.item !== 'roof') return false;
        return true;
      })) return '这里已经有东西了，换一个空格试试。';
    }
    const supported = item === 'roof' && spot.enclosed;
    if (!supported && y !== ground(x, z) && !blocks.some(block => Math.abs(block.x - x) + Math.abs(block.y - y) + Math.abs(block.z - z) === 1)) return '先连接地面或旁边的建筑。这是游戏的搭建规则，真实承重更复杂。';
    return null;
  }

  placeBlock(item, position) {
    if (!isRecord(position)) return fail('先选择一个空格。');
    const span = item === 'roof' ? roofSpan(this.activeBlocks(), position) : { x: position.x, z: position.z, w: 1, d: 1, enclosed: false };
    const spot = { ...position, ...span, rotation: item === 'roof' ? 0 : (position.rotation ?? 0) };
    const problem = this.placementProblem(item, spot);
    if (problem) return fail(problem);
    if (this.state.inventory[item] < 1) return fail(`${ITEMS[item].name}用完了，可以再采集或制作。`);
    const block = { id: `block-${this.state.nextId}`, item, x: spot.x, y: position.y, z: spot.z, rotation: spot.rotation, w: span.w, d: span.d };
    let note = null;
    this.mutate(state => {
      state.nextId++;
      state.inventory[item]--;
      const bag = this.blockBag(state);
      bag.blocks.push(block);
      if (item === 'chest') bag.chests[block.id] = blankInventory();
      state.stats.built++;
      note = this.fitRoofs(state);
    });
    this.history.push({ type: 'place', block: copy(block) });
    const covered = item === 'roof' && (block.w > 1 || block.d > 1);
    const placed = covered ? `屋顶盖住了这间 ${block.w}×${block.d} 的屋子。` : item === 'roof' ? '围墙还没围好，屋顶先盖住这一格。围好以后，它会自己变大。' : `放好了${ITEMS[item].name}。`;
    return ok(item === 'roof' ? placed : (note || placed), { id: block.id, block });
  }

  fitRoofs(state) {
    const bag = this.blockBag(state);
    const blocks = bag.blocks;
    const roofs = blocks.filter(block => block.item === 'roof');
    const claimed = [];
    const drop = [];
    let grew = false;
    let shrank = false;
    const overlaps = (a, b) => a.y === b.y && a.x < b.x + b.w && b.x < a.x + a.w && a.z < b.z + b.d && b.z < a.z + a.d;
    for (const roof of roofs) {
      const w = roof.w || 1;
      const d = roof.d || 1;
      const before = w * d;
      const cells = [[roof.x + Math.floor((w - 1) / 2), roof.z + Math.floor((d - 1) / 2)]];
      for (let dx = 0; dx < w; dx++) for (let dz = 0; dz < d; dz++) cells.push([roof.x + dx, roof.z + dz]);
      let best = null;
      const seen = new Set();
      for (const [x, z] of cells) {
        const key = `${x},${z}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (roofWallAt(blocks, x, z, roof.y)) continue;
        const span = roofSpan(blocks, { x, y: roof.y, z });
        if (span.enclosed && (!best || span.w * span.d > best.w * best.d)) best = span;
      }
      const mid = cells.find(([x, z]) => !roofWallAt(blocks, x, z, roof.y)) || cells[0];
      const box = best ? { x: best.x, z: best.z, w: best.w, d: best.d, y: roof.y } : { x: mid[0], z: mid[1], w: 1, d: 1, y: roof.y };
      if (claimed.some(held => overlaps(held, box))) {
        drop.push(roof);
        continue;
      }
      roof.x = box.x;
      roof.z = box.z;
      roof.w = box.w;
      roof.d = box.d;
      claimed.push(box);
      if (box.w * box.d > before) grew = true;
      if (box.w * box.d < before) shrank = true;
    }
    if (drop.length) {
      const ids = new Set(drop.map(roof => roof.id));
      bag.blocks = bag.blocks.filter(block => !ids.has(block.id));
      state.inventory.roof += drop.length;
      this.history = this.history.filter(action => !ids.has(action.block?.id));
    }
    if (drop.length) return '这间已经有屋顶了，多出来的回到背包。';
    if (grew) return '屋顶跟着围墙变大了。';
    if (shrank) return '屋顶跟着围墙变小了。';
    return null;
  }
  reclaim(cx,cz){
    const chunk=frontierChunks(this.state.land).find(p=>p.cx===cx&&p.cz===cz);
    if(!chunk)return fail('选一片与河谷相连、尚未整理的边缘草地。');
    if(!nearbyFrontiers(this.state.land,this.state.player).some(p=>p.id===chunk.id))return fail('先走到这片草地的边界，再来开垦吧。');
    this.mutate(s=>s.land.opened.push(chunk.id));
    return ok('草地整理好了！新区可以走动和搭建。',{chunk});
  }
  claimEncounter(id){
    const e=landEncounters(this.state.land).find(e=>e.id===id);
    if(!e||this.state.land.claimed.includes(id))return fail('这份发现补给已经领过啦，继续探索其它草地吧。');
    if(Object.entries(e.rewards).some(([item,n])=>!isCount(this.state.inventory[item]+n)))return fail('背包太满，先存放一些材料。');
    this.mutate(s=>{for(const [item,n] of Object.entries(e.rewards))s.inventory[item]+=n;s.land.claimed.push(id);});
    return ok(`${e.kind==='treasure'?'宝箱':'物资包'}里有：${Object.entries(e.rewards).map(([i,n])=>`${ITEMS[i].name}×${n}`).join('、')}。`,{rewards:e.rewards});
  }

  removeBlock(id, remember = true) {
    const bagNow = this.blockBag();
    const block = bagNow.blocks.find(block => block.id === id);
    if (!block) return fail('这里没有可以取回的建筑。');
    const contents = bagNow.chests[id] ? copy(bagNow.chests[id]) : null;
    const returned = { ...(contents ?? blankInventory()) };
    returned[block.item] = (returned[block.item] ?? 0) + 1;
    if (ITEM_KEYS.some(item => !isCount(this.state.inventory[item] + (returned[item] ?? 0)))) return fail('背包里的材料太多，请先存放一些。');
    let note = null;
    this.mutate(state => {
      const bag = this.blockBag(state);
      bag.blocks = bag.blocks.filter(block => block.id !== id);
      state.inventory[block.item]++;
      if (contents) for (const item of ITEM_KEYS) state.inventory[item] += contents[item];
      delete bag.chests[id];
      note = this.fitRoofs(state);
    });
    if (remember) this.history.push({ type: 'remove', block: copy(block), contents });
    const wideRoof = block.item === 'roof' && ((block.w || 1) > 1 || (block.d || 1) > 1);
    const removed = wideRoof ? '整片屋顶拆下来了，回到背包。' : '建筑和箱内材料都取回背包了。';
    return ok(block.item === 'roof' ? removed : (note || removed), { id, item: block.item, count: 1 });
  }

  undo() {
    const action = this.history.at(-1);
    if (!action) return fail('还没有可以撤回的搭建。');
    if (action.type === 'place') {
      const result = this.removeBlock(action.block.id, false);
      if (result.ok) this.history.pop();
      return result.ok ? ok('刚才的搭建已撤回，材料都返还了。') : result;
    }
    const { block, contents } = action;
    const problem = this.placementProblem(block.item, block);
    if (problem) return fail(problem);
    const required = { ...(contents ?? blankInventory()) };
    required[block.item] = (required[block.item] ?? 0) + 1;
    if (ITEM_KEYS.some(item => this.state.inventory[item] < (required[item] ?? 0))) return fail('取回的材料已经用掉一些，暂时不能完整撤回。');
    let note = null;
    this.mutate(state => {
      for (const item of ITEM_KEYS) state.inventory[item] -= required[item] ?? 0;
      const bag = this.blockBag(state);
      bag.blocks.push(copy(block));
      if (contents) bag.chests[block.id] = copy(contents);
      note = this.fitRoofs(state);
    });
    this.history.pop();
    return ok(note || '取回操作已撤回，建筑恢复了。', { id: block.id });
  }

  getMatches(grid) {
    const normalized = normalizeGrid(grid);
    if (!normalized?.length) return [];
    const key = JSON.stringify(normalized);
    return RECIPES.filter(recipe => JSON.stringify(normalizeGrid(recipe.pattern)) === key);
  }

  craft(grid, recipeId) {
    const matches = this.getMatches(grid);
    if (!matches.length) return fail('这个摆法还没有配方，看看配方书或再试试。');
    if (!recipeId && matches.length > 1) return { ...fail('这个摆法有两种做法，请选想要的物品。'), matches };
    const recipe = recipeId ? matches.find(recipe => recipe.id === recipeId) : matches[0];
    if (!recipe) return fail('选中的物品与格子摆法不同。');
    const restored = this.state.travel?.story?.restored || [];
    if (recipe.story && !restored.includes(recipe.story) && !restored.includes('all')) return fail('河水亮起来以后，可以用和纸和树枝做纸灯笼。');
    const required = blankInventory();
    for (const item of recipe.pattern.flat()) if (item) required[item]++;
    const missing = ITEM_KEYS.find(item => this.state.inventory[item] < required[item]);
    if (missing) return fail(`${ITEMS[missing].name}还差${required[missing] - this.state.inventory[missing]}份，可以去采集或制作。`);
    if (!isCount(this.state.inventory[recipe.output.item] - required[recipe.output.item] + recipe.output.count)) return fail('背包里的这种物品已经很多了。');
    this.mutate(state => {
      for (const item of ITEM_KEYS) state.inventory[item] -= required[item];
      state.inventory[recipe.output.item] += recipe.output.count;
      state.stats.crafted += recipe.output.count;
      if (recipe.output.item === 'paper-crane') grantStamp(state, 'ri-crane-first');
    });
    return ok(`做好了${recipe.output.count}份${recipe.name}。`, { item: recipe.output.item, count: recipe.output.count, recipe });
  }

  rewardOrder(id, reward, correct = true) {
    if (!correct) return fail('再数一数，可以继续试，材料不会扣掉。');
    if (typeof id !== 'string' || id.length < 1 || id.length > 128 || !isRecord(reward) || !COLLECTABLE_ITEMS.includes(reward.item) || !isPositive(reward.count) || reward.count > 10) return fail('这份补给的内容不正确。');
    if (this.state.claimedOrders.includes(id)) return fail('这份补给已经领过了，可以继续自由采集。');
    if (!isCount(this.state.inventory[reward.item] + reward.count)) return fail('背包里的这种材料已经很多了。');
    this.mutate(state => { state.inventory[reward.item] += reward.count; state.claimedOrders.push(id); state.stats.orders++; });
    return ok(`得到${reward.count}份${ITEMS[reward.item].name}补给。`, reward);
  }

  depositChest(id, item, count = 1) {
    const chest = this.chestBag(id);
    if (!chest) return fail('先放好一个储物箱。');
    if (!Object.hasOwn(ITEMS, item) || !isPositive(count) || !isCount(chest[item] + count)) return fail('材料和数量不正确。');
    if (this.state.inventory[item] < count) return fail('背包里的材料不够，少放一些试试。');
    this.mutate(state => { state.inventory[item] -= count; chest[item] += count; });
    return ok(`存入${count}份${ITEMS[item].name}。`);
  }

  withdrawChest(id, item, count = 1) {
    const chest = this.chestBag(id);
    if (!chest) return fail('这个箱子已经取回了。');
    if (!Object.hasOwn(ITEMS, item) || !isPositive(count) || !isCount(this.state.inventory[item] + count)) return fail('材料和数量不正确。');
    if (chest[item] < count) return fail('箱子里没有这么多，少取一些试试。');
    this.mutate(state => { chest[item] -= count; state.inventory[item] += count; });
    return ok(`取出${count}份${ITEMS[item].name}。`);
  }

  startKiln(count = 2, mode = 'normal') {
    if (!isPositive(count) || count > 10 || !KILN_MODES.includes(mode)) return fail('一次可以制作1到10份，请选一种工坊模式。');
    if (this.state.kiln.stage !== 'idle') return fail('先等待这批冷却完成并取出，再开新一批。');
    if (mode === 'normal' && (this.state.inventory.clay < count || this.state.inventory.branch < 1)) return fail(`需要${count}份制砖黏土和1份树枝，可以随时去采集。`);
    this.mutate(state => {
      if (mode === 'normal') { state.inventory.clay -= count; state.inventory.branch--; }
      state.kiln = { stage: 'moistening', elapsed: 0, count, mode };
    });
    return ok(mode === 'normal' ? '开始了。看窑口前面的黏土怎样变化。' : '试样开始了。看窑口前面的黏土。这次不消耗背包材料。');
  }

  getKilnStatus() {
    const kiln = this.state.kiln;
    return { ...kiln, label: KILN_LABELS[kiln.stage], progress: kiln.elapsed / 24 };
  }

  beginTravel(realmId, via = 'ferry', extra = {}) {
    if (this.currentRealm() !== 'he') return fail('先回到河谷，再出发。');
    if (realmId === 'xing' && via !== 'balloon') return fail('外星谷只能坐热气球去。');
    const realm = REALMS[realmId];
    if (!realm?.playable || realm.home) return fail('这一谷还没开放。');
    const way = realmId === 'xing' || via === 'balloon' ? 'balloon' : 'ferry';
    this.history = [];
    this.mutate(state => {
      if (!state.travel.realms[realmId]) state.travel.realms[realmId] = emptyRealm(realmId);
      state.travel.realms[realmId].player = arrivalFor(realmId, way);
      state.travel.current = realmId;
      state.travel.via = way;
      if (!state.travel.visited.includes(realmId)) state.travel.visited.push(realmId);
      if (realmId === 'ri') grantStamp(state, 'ri-arrive');
      if (realmId === 'mei') grantStamp(state, 'mei-arrive');
      if (realmId === 'xing') {
        grantStamp(state, 'xing-arrive');
        if (extra?.withGugu && !state.travel.story.seen.includes('gugu-riding')) state.travel.story.seen.push('gugu-riding');
      }
    });
    if (realmId === 'xing') return ok('热气球落到外星谷的草坪上。这是游戏里的幻想航线，真实的热气球飞不出大气层。');
    if (realmId === 'mei') return ok(way === 'balloon' ? '热气球落到美谷的草坪上。' : '大船到美谷的港口了。');
    return ok(way === 'balloon' ? '热气球落到日谷的草坪上。' : '小船到日谷的码头了。');
  }
  discoverVista(id) {
    const vista = VISTAS[id];
    if (!vista) return fail('那边还看不清。');
    if (this.state.travel.discovered?.[id]) return ok(`已经看见${vista.name}。`, { already: true, id });
    this.mutate((state) => {
      state.travel.discovered[id] = true;
      grantStamp(state, `vista-${id}`);
    });
    return ok(`发现${vista.name}。`, { id });
  }
  collectKeepsake(id) {
    const item = KEEPSAKES[id];
    if (!item) return fail('这个瓶子里没有东西。');
    if (this.state.travel.keepsakes?.includes(id)) return ok(`${item.name}已经在背包里。`, { already: true, id });
    this.mutate((state) => { state.travel.keepsakes.push(id); });
    return ok(`收下${item.name}。它会留在背包里。`, { id });
  }
  returnHome() {
    if (this.currentRealm() === 'he') return ok('已经在河谷。');
    this.history = [];
    this.mutate(state => { state.travel.current = 'he'; state.travel.via = null; });
    return ok('回到河谷了。家里的东西都在。');
  }
  washiStatus() {
    const proc = this.state.travel?.realms?.ri?.processes?.find(item => item.kind === 'washi') || null;
    if (!proc) return { stage: 'idle', elapsed: 0, label: '还没开始', ready: false, stages: WASHI_STAGES };
    const stage = WASHI_STAGES.find(item => item.id === proc.stage);
    return { stage: proc.stage, elapsed: proc.elapsed, label: proc.stage === 'ready' ? '可以收下' : (stage?.label || '制作中'), ready: proc.stage === 'ready', stages: WASHI_STAGES };
  }
  startWashi() {
    if (this.currentRealm() !== 'ri') return fail('先到日谷的纸坊。');
    const running = this.state.travel.realms.ri?.processes?.find(item => item.kind === 'washi' && item.stage !== 'ready');
    if (running) return fail('这张和纸还在做，做好再开始下一张。');
    if ((this.state.inventory.kozo || 0) < 1) return fail('楮皮还不够。去楮树林采集就有，不用答题。');
    this.mutate(state => {
      state.inventory.kozo -= 1;
      const realm = state.travel.realms.ri;
      realm.processes = realm.processes.filter(item => item.kind !== 'washi');
      realm.processes.push({ id: 'washi', kind: 'washi', elapsed: 0, stage: washiStage(0) });
    });
    return ok('开始做和纸。剥皮蒸煮、敲打、加水、竹帘抄纸，然后晾干。');
  }
  claimWashi() {
    const proc = this.state.travel?.realms?.ri?.processes?.find(item => item.kind === 'washi' && item.stage === 'ready');
    if (!proc) return fail('和纸还在晾，看一看步骤，过一会儿再来。');
    if (!isCount(this.state.inventory.washi + 1)) return fail('背包里的和纸已经很多了。');
    this.mutate(state => {
      state.inventory.washi += 1;
      const realm = state.travel.realms.ri;
      realm.processes = realm.processes.filter(item => item.id !== proc.id);
      grantStamp(state, 'ri-washi-first');
    });
    return ok('收下第一张和纸。时间在游戏里缩短了。');
  }
  repairKoinobori() {
    if (this.currentRealm() !== 'ri') return fail('先到日谷的旗杆。');
    if ((this.state.inventory['paper-koinobori'] || 0) < 1) return fail('先用和纸和竹篾做一面纸鲤鱼旗。不用答题。');
    const realm = this.state.travel.realms.ri;
    if (realm.claimed.includes('ri-flag-repaired')) return ok('鲤鱼旗已经补好了。');
    this.mutate(state => {
      const spot = state.travel.realms.ri;
      if (!spot.claimed.includes('ri-flag-repaired')) spot.claimed.push('ri-flag-repaired');
      grantStamp(state, 'ri-help-koharu');
    });
    return ok('纸鲤鱼旗补上了。小春说谢谢。这面旗还在背包里，也可以带回河谷。');
  }
  lightRiLantern(index) {
    if (this.currentRealm() !== 'ri' || !this.state.travel.realms?.ri) return fail('先到日谷的寺社。');
    if (!Number.isInteger(index) || index < 0 || index > 3) return fail('这盏石灯笼点不着。');
    const bit = 1 << index;
    this.mutate((state) => { const city = state.travel.realms.ri.city || freshCity(); city.lanterns |= bit; state.travel.realms.ri.city = city; });
    const all = (this.state.travel.realms.ri.city.lanterns & LANTERN_ALL) === LANTERN_ALL;
    return ok(all ? '四盏石灯笼都亮了。' : '石灯笼亮了。', { all, kind: 'lantern' });
  }
  lightRiShop(index) {
    if (this.currentRealm() !== 'ri' || !this.state.travel.realms?.ri) return fail('先到日谷的招牌街。');
    if (!Number.isInteger(index) || index < 0 || index > 5) return fail('这家店还没开门。');
    const bit = 1 << index;
    this.mutate((state) => { const city = state.travel.realms.ri.city || freshCity(); city.shops |= bit; state.travel.realms.ri.city = city; });
    const all = (this.state.travel.realms.ri.city.shops & SHOP_ALL) === SHOP_ALL;
    return ok(all ? '整条招牌街都亮了。' : '招牌亮了。', { all, kind: 'shop' });
  }
  finishRiTrain() {
    if (this.currentRealm() !== 'ri' || !this.state.travel.realms?.ri) return fail('先到日谷坐电车。');
    this.mutate((state) => {
      const city = state.travel.realms.ri.city || freshCity();
      city.trainLoops = Math.min(99, (city.trainLoops || 0) + 1);
      state.travel.realms.ri.city = city;
    });
    return ok('电车绕了一圈，三站都停过了。', { kind: 'train' });
  }
  markRiManner(kind) {
    if (this.currentRealm() !== 'ri' || !this.state.travel.realms?.ri) return fail('先到日谷。');
    const lines = { queue: '排好队了。', signal: '绿灯的时候再走。', shoes: '鞋已经脱在门口。', thanks: 'いただきます。' };
    if (!Object.hasOwn(lines, kind)) return fail('这一步先看图标。');
    this.mutate((state) => {
      const city = state.travel.realms.ri.city || freshCity();
      city[kind] = true;
      state.travel.realms.ri.city = city;
    });
    return ok(lines[kind], { kind });
  }
  claimRiShard() {
    if (this.currentRealm() !== 'ri' || !this.state.travel.realms?.ri) return fail('先到日谷的车站。');
    const realm = this.state.travel.realms.ri;
    if (realm.storyShard === true) return ok('潮之片已经拿到了。', { already: true, line: MIKO_CLUE });
    if (!canOpenCabinet(realm)) {
      const tasks = shardTasks(realm);
      const left = [];
      if (!tasks.flag) left.push('修鲤鱼旗');
      if (!tasks.street) left.push('点亮招牌');
      if (!tasks.train) left.push('坐一圈电车');
      const need = shardNeed();
      return fail(need === 1 ? `再完成一件就行：${left.join('、')}。` : `三件事里做到两件，柜子才会开。还可以：${left.join('、')}。`);
    }
    this.mutate((state) => {
      state.travel.realms.ri.storyShard = true;
      grantStamp(state, 'ri-tide-shard');
    });
    return ok('柜子开了。蓝色石片上有海浪，边上是一排小方孔。', { shard: true, line: MIKO_CLUE });
  }
  rewardTutorSupply(tutorId = 'ri') {
    if (typeof tutorId !== 'string' || !/^[a-z0-9-]{1,64}$/.test(tutorId)) return fail('这份补给的内容不正确。');
    const mei = this.currentRealm() === 'mei';
    const item = mei ? 'maple-sap' : 'kozo';
    const name = mei ? '枫树汁' : '楮皮';
    if ((this.state.clock.elapsed || 0) < (this.state.travel.supplyAt || 0)) {
      return fail(mei ? '这份小补给稍后再领。枫树林随时可以采，不用等。' : '这份小补给稍后再领。楮树林随时可以采，不用等。');
    }
    if (!isCount((this.state.inventory[item] || 0) + SUPPLY_COUNT)) return fail(`背包里的${name}已经很多了。`);
    this.mutate(state => {
      state.inventory[item] += SUPPLY_COUNT;
      state.travel.supplyAt = state.clock.elapsed + SUPPLY_COOLDOWN;
      const sticker = `${mei ? 'mei' : 'ri'}-quiz-${tutorId}`;
      if (!state.travel.stickers.includes(sticker)) state.travel.stickers.push(sticker);
    });
    return ok(`得到 ${SUPPLY_COUNT} 份${name}。这是可选补给，不去答题也能采集。`);
  }
  seeLetter(id = 'letter-ri-1') {
    if (typeof id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(id)) return fail('这封信还认不出。');
    this.mutate(state => {
      if (!state.travel.story.seen.includes(id)) state.travel.story.seen.push(id);
      if (!state.travel.story.letters.includes(id)) state.travel.story.letters.push(id);
    });
    return ok('信看过了。想坐船就去渡口，不看信也可以走。');
  }
  craftPaperLantern() {
    const restored = this.state.travel?.story?.restored || [];
    if (!restored.includes('water') && !restored.includes('all')) return fail('河水亮起来以后，可以用和纸和树枝做纸灯笼。');
    if ((this.state.inventory.washi || 0) < 1 || (this.state.inventory.branch || 0) < 1) return fail('纸灯笼要用一张和纸和一根树枝。这是游戏约定。');
    if (!isCount((this.state.inventory['paper-lantern'] || 0) + 1)) return fail('纸灯笼已经很多了。');
    this.mutate((state) => {
      state.inventory.washi -= 1;
      state.inventory.branch -= 1;
      state.inventory['paper-lantern'] += 1;
    });
    return ok('做成一盏纸灯笼。不会真的用火。');
  }
  claimKiln() {
    const kiln = this.state.kiln;
    if (!['ready', 'failed'].includes(kiln.stage)) return fail('还没完成冷却，继续探索一会儿再来。');
    const item = kiln.stage === 'ready' ? 'brick' : 'shard';
    const count = kiln.count;
    if (!isCount(this.state.inventory[item] + count)) return fail('背包里的这种材料已经很多了。');
    this.mutate(state => { state.inventory[item] += count; state.kiln = emptyKiln(); });
    return ok(item === 'brick' ? `得到${count}块已冷却的砖。` : '试样留下裂纹。太湿的坯料或不合适的冷却条件可能造成问题，并非一定都会开裂。', { item, count });
  }

  plant(plotId) {
    const blocked = sowCheck('seed');
    if (blocked) return blocked;
    const plot = this.state.garden.find(plot => plot.id === plotId);
    if (!plot) return fail('先选一个园地。');
    if (plot.planted) return fail('这里已经有植物，可以选另一格。');
    if (this.state.inventory.seed < 1) return fail('豆种用完了，可以去采集。');
    this.mutate(state => { state.inventory.seed--; Object.assign(plot, { planted: true, age: 0, harvested: false, moistureElapsed: 0, drainElapsed: 0 }); });
    return ok('种下豆种。这里光照合适，观察土的干湿和排水吧。');
  }

  water(plotId) {
    const plot = this.state.garden.find(plot => plot.id === plotId);
    if (!plot) return fail('先选一个园地。');
    if (plot.moisture >= 3) return fail('这里已经积水了，先等排水或把植物移到排水好的园地。');
    if (this.state.inventory.water < 1) return fail('清水用完了，可以到小溪采集。');
    this.mutate(state => { state.inventory.water--; plot.moisture++; plot.moistureElapsed = 0; plot.drainElapsed = 0; });
    return ok(plot.moisture === 3 ? '水有些多，观察它能不能排走。' : '土有水了，适量水帮助植物生长。');
  }

  transplant(fromId, toId) {
    const from = this.state.garden.find(plot => plot.id === fromId);
    const to = this.state.garden.find(plot => plot.id === toId);
    if (!from?.planted || !to || from === to) return fail('选择一株植物和另一个空园地。');
    if (to.planted) return fail('目标园地已经种了植物。');
    this.mutate(() => {
      Object.assign(to, { planted: true, age: from.age, moisture: from.moisture, harvested: false, moistureElapsed: 0, drainElapsed: 0 });
      Object.assign(from, { planted: false, age: 0, moisture: 1, harvested: false, moistureElapsed: 0, drainElapsed: 0 });
    });
    return ok(to.drainage === 'good' ? '移到排水好的园地了。观察积水慢慢退去。移栽在这里经过简化。' : '植物移好了。这格排水较慢，留意积水。');
  }

  harvestPlant(plotId) {
    const plot = this.state.garden.find(plot => plot.id === plotId);
    if (!plot?.planted) return fail('这里还没有可以收获的植物。');
    if (plot.age < 90) return fail('还没成熟。观察水分与排水，也可以继续建造。');
    if (!isCount(this.state.inventory.bean + 2) || !isCount(this.state.inventory.seed + 1)) return fail('背包里的收获已经很多了。');
    this.mutate(state => { state.inventory.bean += 2; state.inventory.seed++; Object.assign(plot, { planted: false, age: 0, harvested: true, moistureElapsed: 0, drainElapsed: 0 }); });
    return ok('收获2份豆子和1份豆种，可以接着种。', { item: 'bean', count: 2 });
  }

  tick(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 3600) return fail('经过的时间不正确。');
    if(this.state.clock.elapsed+seconds>LIFE_RULES.maxElapsed)return fail('游戏时间已达到存档支持范围，请先备份世界。');
    this.tickRemainder += seconds;
    const steps = Math.floor(this.tickRemainder + 1e-9);
    if (!steps) return ok('继续观察。');
    this.tickRemainder -= steps;
    this.mutate(state => {
      const blockedFlora=new Set(FLORA_SITES.filter(site=>floraBlocked(site,state.blocks)).map(site=>site.id));
      const season=realMoment();
      for (let i = 0; i < steps; i++) {
        state.clock.elapsed++;
        for(const plant of state.flora){
          const site=FLORA_BY_ID[plant.id];
          if(season.warm&&!blockedFlora.has(plant.id)&&(!site.shade||state.clock.elapsed%2===0))plant.age=(plant.age+1)%LIFE_RULES.flowerCycle;
        }
        const kiln = state.kiln;
        if (kiln.stage !== 'idle' && kiln.elapsed < 24) {
          kiln.elapsed++;
          kiln.stage = kiln.elapsed === 24 ? (kiln.mode === 'normal' ? 'ready' : 'failed') : KILN_STAGES[1 + Math.floor(kiln.elapsed / 6)];
        }
        for (const realm of Object.values(state.travel?.realms || {})) {
          for (const proc of realm.processes || []) {
            if (proc.kind === 'washi' && proc.stage !== 'ready') {
              proc.elapsed = Math.min(WASHI_TOTAL_SECONDS, proc.elapsed + 1);
              proc.stage = washiStage(proc.elapsed);
            } else if (proc.kind === 'maple') advanceMaple(proc);
          }
        }
        tickCrystals(state, 1);
        for (const plot of state.garden) {
          if (!plot.planted || plot.age >= 90) continue;
          if (plot.moisture === 3) {
            if (plot.drainage === 'good' && ++plot.drainElapsed >= 8) { plot.moisture = 2; plot.drainElapsed = 0; plot.moistureElapsed = 0; }
            continue;
          }
          if (plot.moisture === 0) continue;
          plot.age = Math.min(90, plot.age + 1);
          if (++plot.moistureElapsed >= 60) { plot.moisture--; plot.moistureElapsed = 0; }
        }
      }
    });
    return ok('工坊与植物按当前条件继续变化。');
  }

  update(seconds) { return this.tick(seconds); }

  startCrystal(much = true) { return beginCrystal(this, much); }
  claimCrystal() { return takeCrystal(this); }
  crystalStatus() { return crystalNow(this); }
  seeMoss() { return markMoss(this); }
  seeHopper() { return markHopper(this); }
  reuniteGugu() { return bringGugu(this); }
  grantPlaque() { return givePlaque(this); }
  recordExperiment(kind, band) { return noteExperiment(this, kind, band); }
  learnGlyphs(ids) { return rememberGlyphs(this, ids); }
  solvePuzzle(puzzle, choiceId) { return gradeXingPuzzle(this, puzzle, choiceId); }
  rewardXingSupply(tutorId) { return payXingSupply(this, tutorId); }
  setQuality(mode) {
    if (mode !== 'fast' && mode !== 'fine') return fail('画质不正确。');
    this.mutate((state) => { state.settings.quality = mode; });
    return ok(mode === 'fast' ? '已换成流畅。' : '已换成精美。');
  }
  noteHoloWelcome() {
    const fresh = markWelcomed(this.state);
    if (fresh) this.save();
    return { fresh, line: WELCOME_LINE };
  }
  noteHoloStage(stageId, record) {
    const result = noteStage(this.state, stageId, record);
    if (result.ok) this.save();
    return result;
  }
  claimXingShard(choice, options = {}) {
    if (this.currentRealm() !== 'xing' || !this.state.travel.realms?.xing) return fail('先到外星谷的星网。');
    if (this.xingShardSaveText === null && this.storage?.getItem) {
      try {
        const existing = this.storage.getItem(STORAGE_KEY);
        if (typeof existing === 'string') {
          const raw = JSON.parse(existing);
          if (typeof raw?.travel?.realms?.xing?.storyShard !== 'boolean') this.xingShardSaveText = existing;
        }
      } catch { /* 没有旧档时，不额外做备份 */ }
    }
    const story = JSON.stringify(this.state.travel.story || {});
    const result = claimDome(this.state, choice, options);
    if (JSON.stringify(this.state.travel.story || {}) !== story) return fail('星之片不能改河谷的故事。');
    if (!result.ok) return fail(result.message);
    if (result.shard) this.save();
    this.notify();
    return ok(result.message, result);
  }
  noteHoloTogether() {
    if (this.currentRealm() !== 'xing' || !this.state.travel.realms?.xing) return fail('先到外星谷的星网。');
    const result = noteTogether(this.state);
    if (!result.ok) return fail(result.message || '还不能一起算。');
    this.save();
    this.notify();
    return ok(result.message, result);
  }
  setHoloAvatar(patch) {
    const changed = setAvatar(this.state, patch);
    if (changed) this.save();
    return changed;
  }
  recordHoloGrowth(now) {
    const before = JSON.stringify(this.state.travel?.realms?.xing?.holo?.growth || []);
    const growth = snapshotGrowth(this.state, now);
    if (JSON.stringify(growth) !== before) this.save();
    return growth;
  }
  sow(plotId, itemId = 'seed') {
    const blocked = sowCheck(itemId);
    if (blocked) return blocked;
    return this.plant(plotId);
  }
  releaseCreature(itemId) { return releaseCheck(itemId); }
}

Object.assign(GameState.prototype, creationMethods);
attachMei(GameState);
