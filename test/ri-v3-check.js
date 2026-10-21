import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { GameState, createInitialState } from '../src/game-state.js';
import { RI3_BACKUP_KEY, STORAGE_KEY } from '../src/game-data.js';
import { validateTravel } from '../src/travel-save.js';
import { canOpenCabinet, isTour, shrineAllows } from '../src/ri-story.js';

const url = process.env.GAME_TEST_URL || 'http://127.0.0.1:5174';
const shotDir = '/opt/cursor/artifacts';

class MemoryStorage {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, value); }
}

assert.equal(shrineAllows('点亮'), true);
assert.equal(shrineAllows('看看'), true);
assert.equal(shrineAllows('参拜'), false);
assert.equal(shrineAllows('抽签'), false);
assert.equal(shrineAllows('许愿'), false);
assert.equal(shrineAllows('知识'), false);
assert.equal(isTour(), false);

{
  const home = createInitialState();
  home.blocks = [{ id: 'block-9', item: 'stone', x: 1, y: 0, z: 1, rotation: 0 }];
  const text = JSON.stringify(home);
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, text);
  const game = new GameState(storage);
  assert.equal(game.beginTravel('ri').ok, true);
  assert.equal(game.finishRiTrain().ok, true);
  assert.equal(game.state.travel.realms.ri.city.trainLoops, 1);
  assert.equal(canOpenCabinet(game.state.travel.realms.ri), false);
  game.state.inventory['paper-koinobori'] = 1;
  assert.equal(game.repairKoinobori().ok, true);
  const opened = game.claimRiShard();
  assert.equal(opened.shard, true);
  assert.equal(game.state.travel.realms.ri.storyShard, true);
  assert.equal(game.state.travel.story.seen.includes('letter-ri-1'), false);
  assert.equal(game.state.blocks[0].item, 'stone');
  game.save();
  assert.equal(storage.getItem(RI3_BACKUP_KEY), text);
  const round = validateTravel(JSON.parse(JSON.stringify(game.state.travel)));
  assert.equal(round.realms.ri.storyShard, true);
  assert.equal(round.realms.ri.city.trainLoops, 1);
  const oldTravel = JSON.parse(JSON.stringify(game.state.travel));
  delete oldTravel.realms.ri.city;
  delete oldTravel.realms.ri.storyShard;
  const kept = validateTravel(oldTravel);
  assert.equal(Object.hasOwn(kept.realms.ri, 'city'), false);
  assert.equal(Object.hasOwn(kept.realms.ri, 'storyShard'), false);
}
console.log('✓ 规则：寺社、电车、碎片和旧档兼容');

await mkdir(shotDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const passed = [];

function check(name, value) {
  assert.ok(value, name);
  passed.push(name);
  console.log(`✓ ${name}`);
}

async function boot(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console:${msg.text()}`); });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__valley?.world);
  await page.click('#start-button');
  await page.evaluate(() => { __valley.game.state.settings.sound = false; });
  if (await page.locator('#wish-dismiss').isVisible().catch(() => false)) await page.click('#wish-dismiss');
  return errors;
}

async function arrive(page) {
  await page.evaluate(() => __valley.goRealm('ferry', 'ri'));
  await page.waitForFunction(() => __valley.game.state.travel.current === 'ri' && __valley.world?.realmId === 'ri');
  await page.evaluate((ms) => window.advanceTime(ms), 400);
}

async function frameAt(page, x, z, lookX, lookZ, distance = 18, pitch = 0.28) {
  await page.evaluate(({ x, z, lookX, lookZ, distance, pitch }) => {
    const world = __valley.world;
    world.stopWalking();
    world.distance = distance;
    world.pitch = pitch;
    const yaw = Math.atan2(-(lookX - x), -(lookZ - z));
    world.yaw = yaw;
    const y = world.surfaceAt?.(x, z) ?? 0;
    world.playerPosition.set(x, Math.max(0, y), z);
    world.facing = yaw;
  }, { x, z, lookX, lookZ, distance, pitch });
  await page.evaluate((ms) => window.advanceTime(ms), 1100);
}

async function shot(page, name) {
  await page.screenshot({ path: `${shotDir}/${name}.png` });
}

async function runShots(kind, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  const errors = await boot(page);
  await arrive(page);
  const actions = await page.evaluate(() => __valley.world.targets.filter((item) => item.zone === 'shrine').map((item) => item.action));
  check(`${kind} 寺社目标只有点亮或看看`, actions.length >= 5 && actions.every((action) => action === '点亮' || action === '看看'));
  check(`${kind} 没有参拜抽签许愿`, actions.every((action) => !/参拜|抽签|许愿|知识/.test(action)));
  await frameAt(page, -8.2, 3.4, -13.2, 7.4, 16, 0.32);
  await page.evaluate(() => {
    const lantern = __valley.world.targets.find((item) => item.riKind === 'lantern');
    __valley.world.playerPosition.set(lantern.position.x + 0.8, 3, lantern.position.z);
    __valley.interact(lantern);
  });
  await page.evaluate((ms) => window.advanceTime(ms), 200);
  const lit = await page.evaluate(() => (__valley.game.state.travel.realms.ri.city?.lanterns || 0) & 1);
  check(`${kind} 点亮一盏石灯笼`, lit === 1);
  for (let i = 1; i < 4; i += 1) {
    await page.evaluate((index) => __valley.game.lightRiLantern(index), i);
  }
  await page.evaluate(() => __valley.world.sync(__valley.game.state));
  await frameAt(page, -8.2, 3.4, -13.2, 7.4, 16, 0.32);
  await shot(page, `${kind}-shrine-lanterns`);

  await frameAt(page, 3.2, -1.2, 13, 7, 34, 0.16);
  await shot(page, `${kind}-tower`);
  const climbed = await page.evaluate(() => {
    const up = __valley.world.targets.find((item) => item.riKind === 'tower-up');
    __valley.world.playerPosition.set(up.position.x, 0, up.position.z + 1.2);
    __valley.interact(up);
    for (let i = 0; i < 40; i += 1) __valley.step(0.05);
    const look = __valley.world.targets.find((item) => item.riKind === 'tower-look');
    __valley.interact(look);
    return { mode: __valley.world.riCity.mode, y: __valley.world.playerPosition.y };
  });
  check(`${kind} 铁塔可以登顶并反向远眺`, climbed.mode === 'look' && climbed.y > 10);
  await page.evaluate(() => {
    const sheet = document.getElementById('ri-sheet');
    if (sheet) sheet.hidden = true;
  });
  await page.evaluate((ms) => window.advanceTime(ms), 800);
  await shot(page, `${kind}-tower-top`);
  await page.evaluate(() => {
    const down = __valley.world.targets.find((item) => item.riKind === 'tower-down');
    __valley.interact(down);
    for (let i = 0; i < 40; i += 1) __valley.step(0.05);
  });

  await frameAt(page, 3.2, 6.4, 2, 14.15, 18, 0.26);
  await shot(page, `${kind}-train`);
  const train = await page.evaluate(() => {
    const station = __valley.world.targets.find((item) => item.stationId === 'village');
    __valley.world.playerPosition.set(station.position.x, 0, station.position.z + 1.1);
    __valley.interact(station);
    const sheet = document.getElementById('ri-sheet');
    if (sheet) sheet.hidden = true;
    return __valley.world.riCity.mode;
  });
  check(`${kind} 可以坐上高架电车`, train === 'ride');
  await page.evaluate(() => {
    for (let i = 0; i < 280; i += 1) __valley.step(0.05);
  });
  const loops = await page.evaluate(() => __valley.game.state.travel.realms.ri.city.trainLoops);
  check(`${kind} 坐完一圈写入 trainLoops`, loops >= 1);
  const before = await page.evaluate(() => {
    const result = __valley.game.claimRiShard();
    return { ok: result.ok, shard: __valley.game.state.travel.realms.ri.storyShard === true };
  });
  check(`${kind} 只做一件事时柜子不开`, before.ok === false && before.shard === false);

  await frameAt(page, 2.4, -9.4, 5.8, -5.2, 14, 0.3);
  for (let i = 0; i < 6; i += 1) await page.evaluate((index) => __valley.game.lightRiShop(index), i);
  await page.evaluate(() => __valley.world.sync(__valley.game.state));
  await page.evaluate((ms) => window.advanceTime(ms), 400);
  await shot(page, `${kind}-neon-street`);
  await frameAt(page, 1.6, -11.6, 3.55, -10.35);
  await page.evaluate(() => {
    const box = __valley.world.targets.find((item) => item.riKind === 'cabinet');
    __valley.world.playerPosition.set(box.position.x - 1.2, 0, box.position.z);
    __valley.interact(box);
  });
  await page.locator('#ri-sheet').waitFor({ state: 'visible' });
  const line = await page.locator('#ri-sheet').innerText();
  check(`${kind} 失物柜给出潮之片和胶片孔线索`, line.includes('潮之片') && line.includes('电影院') && line.includes('跳过'));
  await shot(page, `${kind}-shard`);
  await page.getByRole('button', { name: '跳过' }).click();
  await page.waitForFunction(() => document.getElementById('ri-sheet')?.hidden === true);
  const shard = await page.evaluate(() => ({
    flag: __valley.game.state.travel.realms.ri.storyShard,
    stamp: __valley.game.state.travel.stamps.includes('ri-tide-shard'),
    seen: __valley.game.state.travel.story.seen.length,
  }));
  check(`${kind} 碎片写入 storyShard 且不依赖序章`, shard.flag === true && shard.stamp && shard.seen === 0);
  const calls = await page.evaluate(() => {
    __valley.step(0.05);
    return __valley.world.renderer.info.render.calls;
  });
  console.log(`${kind} draw calls`, calls);
  check(`${kind} 画面调用次数不超过 150`, calls > 0 && calls <= 150);
  const noisy = errors.filter((item) => !/favicon|net::ERR|Failed to load resource|502/.test(item));
  if (noisy.length) console.log(kind, 'errors', noisy);
  check(`${kind} 页面没有脚本错误`, noisy.length === 0);
  await context.close();
  return calls;
}

const desktopCalls = await runShots('desktop', { width: 1280, height: 800 });
const tabletCalls = await runShots('tablet', { width: 1024, height: 768 });

{
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript((payload) => {
    localStorage.setItem('yuanyuan-river-valley-v1', payload);
  }, JSON.stringify(createInitialState()));
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  await boot(page);
  await arrive(page);
  const backup = await page.evaluate(() => {
    const before = localStorage.getItem('yuanyuan-river-valley-v1');
    __valley.game.lightRiLantern(0);
    __valley.game.save();
    return {
      backup: localStorage.getItem('yuanyuan-river-valley-v1-before-ri3'),
      again: localStorage.getItem('yuanyuan-river-valley-v1-before-ri3-1'),
      current: localStorage.getItem('yuanyuan-river-valley-v1'),
      held: before,
    };
  });
  check('旧档第一次写入 city 前备份到 -before-ri3', backup.backup && !JSON.parse(backup.backup).travel?.realms?.ri?.city && JSON.parse(backup.current).travel.realms.ri.city);
  check('日谷升级前备份只写一次', backup.again === null);
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  await page.goto(`${url}?tour=1`);
  await page.waitForFunction(() => window.__valley?.world);
  await page.click('#start-button');
  await page.evaluate(() => { __valley.game.state.settings.sound = false; });
  await arrive(page);
  const tour = await page.evaluate(() => {
    __valley.game.finishRiTrain();
    return __valley.game.claimRiShard();
  });
  check('?tour=1 只做一件事就能拿到潮之片', tour.ok === true && tour.shard === true);
  await context.close();
}

await browser.close();
console.log(`ri-v3-check passed ${passed.length}`);
console.log(JSON.stringify({ desktopCalls, tabletCalls }));
