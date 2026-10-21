import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState, createInitialState } from '../src/game-state.js';
import { MEI_BACKUP_KEY, STORAGE_KEY, TRAVEL_BACKUP_KEY } from '../src/game-data.js';
import { MEI_STAMPS, lanternAnyDate, mapleStage } from '../src/mei-data.js';
import { emptyRealm } from '../src/realm-data.js';
import { applyPack, loadTutorPack, nextQuestion, useTutorRealm } from '../src/tutor-data.js';
import { meiTutorPack } from '../src/mei-tutors.js';

class MemoryStorage {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, value); }
}

function p1Save() {
  const save = createInitialState();
  delete save.travel.realms.mei;
  save.blocks = [{ id: 'block-1', item: 'plank', x: -2, y: 0, z: 1, rotation: 0, w: 1, d: 1 }];
  save.nextId = 2;
  save.inventory.wood = 9;
  save.travel.realms.ri = emptyRealm('ri');
  save.travel.realms.ri.blocks = [{ id: 'block-2', item: 'plank', x: 4, y: 0, z: 8, rotation: 0, w: 1, d: 1 }];
  save.travel.visited = ['ri'];
  save.travel.stamps = ['ri-arrive'];
  return save;
}

test('只有日谷的旧档保留家里和日谷，并写下美谷前备份', () => {
  const save = p1Save();
  const ri = JSON.parse(JSON.stringify(save.travel.realms.ri));
  const text = JSON.stringify(save);
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, text);
  const game = new GameState(storage);
  assert.equal(game.state.blocks[0].item, 'plank');
  assert.equal(game.state.inventory.wood, 9);
  assert.deepEqual(game.state.player, save.player);
  assert.deepEqual(game.state.travel.realms.ri, ri);
  assert.equal(game.state.travel.schema, 1);
  assert.ok(game.state.travel.realms.mei.projects);
  game.save();
  assert.equal(storage.getItem(MEI_BACKUP_KEY), text);
  assert.equal(storage.getItem(`${MEI_BACKUP_KEY}-1`), null);
  game.save();
  assert.equal(storage.getItem(`${MEI_BACKUP_KEY}-1`), null);
  const again = new GameState(storage);
  again.save();
  assert.equal(storage.getItem(`${MEI_BACKUP_KEY}-1`), null);
  assert.deepEqual(again.state.travel.realms.ri, ri);
});

test('已有不同的美谷备份时改用编号，写入失败不覆盖主存档', () => {
  const save = p1Save();
  const text = JSON.stringify(save);
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, text);
  storage.setItem(MEI_BACKUP_KEY, '{"other":true}');
  const game = new GameState(storage);
  game.save();
  assert.equal(storage.getItem(`${MEI_BACKUP_KEY}-1`), text);
  assert.equal(storage.getItem(MEI_BACKUP_KEY), '{"other":true}');
  const blocked = {
    getItem(key) { return key === STORAGE_KEY ? text : null; },
    setItem() { throw new Error('拒绝写入'); },
  };
  const failed = new GameState(blocked);
  assert.equal(failed.save().ok, false);
  assert.equal(blocked.getItem(STORAGE_KEY), text);
});

test('没有旅行记录的 v1 会先做旅行备份再做美谷备份，结果和分步升级一样', () => {
  const save = createInitialState();
  delete save.travel;
  delete save.settings.ageBand;
  save.inventory.wood = 7;
  const text = JSON.stringify(save);
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, text);
  const game = new GameState(storage);
  game.save();
  assert.equal(storage.getItem(TRAVEL_BACKUP_KEY), text);
  assert.equal(storage.getItem(MEI_BACKUP_KEY), text);
  assert.notEqual(TRAVEL_BACKUP_KEY, MEI_BACKUP_KEY);
  const step = createInitialState();
  step.inventory.wood = 7;
  step.settings.ageBand = null;
  assert.equal(game.state.inventory.wood, step.inventory.wood);
  assert.equal(game.state.travel.schema, step.travel.schema);
  assert.equal(game.state.travel.current, 'he');
  assert.ok(game.state.travel.realms.mei);
  assert.equal(game.state.blocks.length, step.blocks.length);
  const again = new GameState(storage);
  again.save();
  assert.equal(storage.getItem(`${TRAVEL_BACKUP_KEY}-1`), null);
  assert.equal(storage.getItem(`${MEI_BACKUP_KEY}-1`), null);
});

test('非法美谷记录整份拒绝，位置出界则回到港口并留在美谷', () => {
  const game = new GameState(new MemoryStorage());
  const before = game.exportSave();
  const badItem = JSON.parse(before);
  badItem.travel.realms.mei.projects = [{ id: 'card-1', goal: 'rocket', step: 'draw', skipped: false, done: false, used: 0, parts: {}, trials: [] }];
  assert.equal(game.importSave(JSON.stringify(badItem)).ok, false);
  assert.equal(game.exportSave(), before);
  const tooMany = JSON.parse(before);
  tooMany.travel.realms.mei.blocks = Array.from({ length: 601 }, (_, index) => ({
    id: `block-${index + 1}`, item: 'plank', x: 4, y: 0, z: 8, rotation: 0, w: 1, d: 1,
  }));
  assert.equal(game.importSave(JSON.stringify(tooMany)).ok, false);
  const badFace = JSON.parse(before);
  badFace.travel.realms.mei.decor = { face: 'skull' };
  assert.equal(game.importSave(JSON.stringify(badFace)).ok, false);
  const home = p1Save();
  home.travel.current = 'mei';
  home.travel.visited = ['mei'];
  home.travel.realms.mei = emptyRealm('mei');
  home.travel.realms.mei.player = { x: 80, y: 0, z: 0, ry: 0 };
  const text = JSON.stringify(home);
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, text);
  const loaded = new GameState(storage);
  assert.equal(loaded.state.travel.current, 'mei');
  assert.equal(loaded.state.travel.realms.mei.player.z, -12);
  assert.match(loaded.travelNotice, /港口/);
  assert.equal(loaded.state.blocks[0].x, -2);
  assert.equal(loaded.state.travel.realms.ri.blocks[0].id, 'block-2');
});

test('枫糖按阶段推进，不调用 tick 就不变，10 份换 1 份', () => {
  const game = new GameState(null);
  assert.equal(game.startMaple().ok, false);
  assert.ok(game.beginTravel('mei').ok);
  assert.match(game.startMaple().message, /枫树林/);
  assert.match(game.startMaple().message, /不用答题/);
  game.state.inventory['maple-sap'] = 10;
  game.state.inventory.branch = 1;
  assert.ok(game.startMaple().ok);
  assert.equal(game.state.inventory['maple-sap'], 0);
  assert.equal(game.state.travel.realms.mei.processes[0].stage, mapleStage(0));
  const elapsed = game.state.travel.realms.mei.processes[0].elapsed;
  assert.equal(elapsed, 0);
  game.tick(4);
  assert.equal(game.state.travel.realms.mei.processes[0].stage, 'heat');
  game.tick(16);
  assert.equal(game.state.travel.realms.mei.processes[0].stage, 'ready');
  assert.ok(game.claimMaple().ok);
  assert.equal(game.state.inventory['maple-syrup'], 1);
  assert.ok(game.state.travel.stamps.includes('mei-syrup-first'));
});

test('美谷印章和纪念品不靠答题，答题只给树汁和贴纸', () => {
  const game = new GameState(null);
  assert.ok(game.beginTravel('mei').ok);
  assert.equal(game.beginTravel('mei').ok, false);
  game.state.inventory['maple-sap'] = 10;
  game.state.inventory.branch = 1;
  game.startMaple();
  game.tick(20);
  game.claimMaple();
  game.state.inventory.cloth = 1;
  assert.ok(game.finishQuilt(['red', 'blue', 'gold', 'green']).ok);
  assert.ok(game.startMeiProject('windmill').ok);
  game.drawMeiProject();
  game.makeMeiProject(4);
  game.tryMeiProject({ bellows: true, weather: 'calm' });
  game.finishMeiProject();
  for (const stamp of MEI_STAMPS) assert.ok(game.state.travel.stamps.includes(stamp.id), stamp.id);
  assert.equal(game.state.inventory['windmill-mini'], 1);
  const before = game.state.travel.stamps.length;
  assert.ok(game.rewardTutorSupply('joe').ok);
  assert.equal(game.state.inventory['maple-sap'], 2);
  assert.equal(game.state.travel.stamps.length, before);
  assert.ok(game.state.travel.stickers.includes('mei-quiz-joe'));
  assert.equal(game.rewardTutorSupply('joe').ok, false);
});

test('项目板改一个地方不扣材料，完成只发一次纪念品', () => {
  const game = new GameState(null);
  game.beginTravel('mei');
  game.state.settings.ageBand = 'bigger';
  game.startMeiProject('plane');
  game.drawMeiProject();
  game.makeMeiProject(4);
  const before = JSON.stringify(game.state.inventory);
  game.tryMeiProject({ weather: 'calm' });
  assert.equal(JSON.stringify(game.state.inventory), before);
  assert.equal(game.changeMeiProject({ nose: 2, wing: 0 }).ok, false);
  assert.ok(game.changeMeiProject({ nose: 2 }).ok);
  assert.equal(JSON.stringify(game.state.inventory), before);
  game.tryMeiProject({ weather: 'calm' });
  assert.ok(game.finishMeiProject().ok);
  assert.equal(game.state.inventory['paper-plane'], 1);
  game.finishMeiProject();
  assert.equal(game.state.inventory['paper-plane'], 1);
});

test('交换板只在 10–12 岁开放，南瓜灯和感谢卡不看日期', () => {
  const game = new GameState(null);
  game.beginTravel('mei');
  game.state.inventory.bean = 3;
  assert.equal(game.tradeMei().ok, false);
  game.state.settings.ageBand = 'older';
  assert.ok(game.tradeMei().ok);
  assert.equal(game.state.inventory.bean, 0);
  assert.equal(game.state.inventory['maple-syrup'], 1);
  assert.equal(lanternAnyDate(), true);
  game.state.inventory.pumpkin = 1;
  game.state.inventory.stick = 1;
  assert.ok(game.setLanternFace('cat').ok);
  assert.equal(game.state.travel.realms.mei.decor.face, 'cat');
  assert.ok(game.craft([['pumpkin', 'stick']], 'pumpkin-lantern').ok);
  game.state.inventory.paper = 1;
  game.state.inventory['quilt-patch'] = 1;
  assert.ok(game.craft([['paper', 'quilt-patch']], 'thanks-card').ok);
  assert.ok(game.giveMeiGift('thanks-card', 'joe').ok);
  assert.equal(game.state.inventory['thanks-card'], 0);
});

test('美谷知识包按谷过滤，未发布角色不出现，大孩子能读到改一句', async () => {
  applyPack(meiTutorPack, 'mei');
  useTutorRealm('mei');
  const pack = useTutorRealm('mei');
  assert.equal(pack.characters.some((item) => item.id === 'draft-hidden'), false);
  assert.equal(pack.characters.length, 5);
  const older = nextQuestion('maya', 'older', []);
  assert.match(older.yes, /一个地方|改/);
  assert.equal(older.review.status, 'draft');
  const loaded = await loadTutorPack('mei');
  assert.ok(loaded.characters.some((item) => item.id === 'joe'));
  useTutorRealm('ri');
  assert.equal(useTutorRealm('ri').characters.some((item) => item.id === 'maya'), false);
});
