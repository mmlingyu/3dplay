import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const url = process.env.GAME_TEST_URL || 'http://127.0.0.1:5174';
const artifactDir = '/opt/cursor/artifacts';
const KEY = 'yuanyuan-river-valley-v1';

await mkdir(artifactDir, { recursive: true });
await mkdir(`${artifactDir}/screenshots`, { recursive: true });

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
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console:${msg.text()}`);
  });
  await page.goto(page.url() === 'about:blank' ? url : page.url());
  await page.waitForFunction(() => window.__valley?.world);
  await page.click('#start-button');
  await page.evaluate(() => { __valley.game.state.settings.sound = false; });
  if (await page.locator('#wish-dismiss').isVisible().catch(() => false)) await page.click('#wish-dismiss');
  return errors;
}

async function arrive(page) {
  await page.evaluate(() => {
    const world = __valley.world;
    world.stopWalking();
    world.playerPosition.set(4, world.surfaceAt(4, 14), 14);
  });
  await page.locator('#travel-go-mei').click();
  await page.locator('#travel-cutscene').waitFor({ state: 'visible' });
  const ship = await page.evaluate(() => {
    const box = document.querySelector('#travel-cutscene');
    const pass = document.querySelector('#travel-cutscene .ship-pass');
    return box.classList.contains('craft-ship') && getComputedStyle(pass).display !== 'none';
  });
  await page.locator('#travel-skip').click();
  await page.waitForFunction(() => __valley.game.state.travel.current === 'mei' && __valley.world?.realmId === 'mei');
  return ship;
}

async function frame(page, id) {
  await page.evaluate((shot) => {
    __valley.world.frameLot(shot);
    __valley.world.update(0.05, { x: 0, z: 0 }, false);
  }, id);
  await page.waitForTimeout(180);
}

async function shot(page, name) {
  const file = `${artifactDir}/${name}.png`;
  await page.screenshot({ path: file });
  await page.screenshot({ path: `${artifactDir}/screenshots/${name}.png` });
  return file;
}

async function runShots(kind, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  const errors = await boot(page);
  const under = await arrive(page);
  check(`${kind} 大船过场从吊桥下穿过`, under);
  check(`${kind} 进港记下船从桥下过`, await page.evaluate(() => __valley.world.arrivalShip === true));
  await page.evaluate(() => {
    for (const id of ['mei-actions', 'travel-home', 'hotbar']) {
      const el = document.getElementById(id);
      if (el) el.style.visibility = 'hidden';
    }
  });
  const calls = await page.evaluate(() => {
    __valley.world.update(0.016, { x: 0, z: 0 }, false);
    return __valley.world.drawCalls();
  });
  console.log(`${kind} draw calls ${calls}`);
  check(`${kind} 流畅档绘制调用不超过 150`, calls > 0 && calls <= 150);
  await frame(page, 'sign');
  await shot(page, `mei-sign-${kind}`);
  await frame(page, 'cinema');
  await shot(page, `mei-cinema-${kind}`);
  await frame(page, 'stage');
  await shot(page, `mei-stage-${kind}`);
  await frame(page, 'back');
  await shot(page, `mei-back-${kind}`);
  const noisy = errors.filter((item) => !/知识引擎|知识包|Failed to load resource|404|502|net::ERR/.test(item));
  if (noisy.length) console.log(`${kind} errors`, noisy.join('\n'));
  check(`${kind} 没有未捕获的页面错误`, noisy.length === 0);
  await context.close();
}

await runShots('desktop', { width: 1280, height: 800 });
await runShots('tablet', { width: 1024, height: 768 });

const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await context.addInitScript(() => {
  const raw = sessionStorage.getItem('mei3-inject');
  if (!raw) return;
  sessionStorage.removeItem('mei3-inject');
  const payload = JSON.parse(raw);
  localStorage.setItem('yuanyuan-river-valley-v1', payload.text);
  for (const key of payload.remove || []) localStorage.removeItem(key);
});
const page = await context.newPage();
page.setDefaultTimeout(60000);
const errors = await boot(page);
await arrive(page);

await page.evaluate(() => { __valley.game.state.settings.ageBand = 'little'; });
await page.locator('#mei-stage').click();
await page.locator('.game-panel').waitFor({ state: 'visible' });
const junior = await page.locator('.game-panel').innerText();
check('6–8 岁有 Action、Cut 和三格', junior.includes('Action') && junior.includes('Cut') && junior.includes('三格'));
await page.locator('.panel-header [data-action="close"]').click();

await page.evaluate(() => { __valley.game.state.settings.ageBand = 'older'; });
await page.locator('#mei-stage').click();
const senior = await page.locator('.game-panel').innerText();
check('9–12 岁有镜头、24 帧和三点布光', senior.includes('远景') && senior.includes('24') && senior.includes('三点布光'));
await page.locator('.panel-header [data-action="close"]').click();

await page.locator('#mei-premiere').click();
const premiere = await page.locator('.game-panel').innerText();
check('首映夜不评名次', premiere.includes('不评名次') && !premiere.includes('排名') && !premiere.includes('第一名'));
await page.locator('.panel-header [data-action="close"]').click();

const oldText = await page.evaluate((key) => {
  const data = JSON.parse(localStorage.getItem(key));
  delete data.travel.realms.mei.storyShard;
  delete data.travel.realms.mei.projector;
  delete data.travel.realms.mei.films;
  delete data.travel.realms.mei.premiere;
  return JSON.stringify(data);
}, KEY);
await page.evaluate((text) => {
  sessionStorage.setItem('mei3-inject', JSON.stringify({ text, remove: [`${'yuanyuan-river-valley-v1'}-before-mei3`] }));
}, oldText);
await page.reload();
await page.waitForFunction(() => window.__valley?.game);
await page.click('#start-button');
await page.evaluate(() => __valley.game.save());
const backup = await page.evaluate((key) => localStorage.getItem(`${key}-before-mei3`), KEY);
check('旧档先备份 before-mei3', backup === oldText);
await page.evaluate(() => __valley.game.save());
check('第二次保存不再编号备份', await page.evaluate((key) => localStorage.getItem(`${key}-before-mei3-1`) == null, KEY));
await context.close();

const tourContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const tour = await tourContext.newPage();
tour.setDefaultTimeout(60000);
const tourErrors = [];
tour.on('pageerror', (error) => tourErrors.push(error.message));
tour.on('console', (msg) => { if (msg.type() === 'error') tourErrors.push(`console:${msg.text()}`); });
await tour.goto(`${url}?tour=1`);
await tour.waitForFunction(() => window.__valley?.world);
await tour.click('#start-button');
await tour.evaluate(() => { __valley.game.state.settings.sound = false; });
if (await tour.locator('#wish-dismiss').isVisible().catch(() => false)) await tour.click('#wish-dismiss');
check('体验参数是 tour=1', await tour.evaluate(() => new URLSearchParams(location.search).get('tour') === '1'));
await tour.evaluate(() => {
  const world = __valley.world;
  world.stopWalking();
  world.playerPosition.set(4, world.surfaceAt(4, 14), 14);
});
await tour.locator('#travel-go-mei').click();
await tour.locator('#travel-skip').click();
await tour.waitForFunction(() => __valley.world?.realmId === 'mei');
const missing = await tour.evaluate(() => __valley.game.lotStatus().missing.join(','));
check('体验里放映机只缺灯', missing === 'lamp');
const picked = await tour.evaluate(() => __valley.game.collectMeiPart('lamp'));
check('灯就在旁边，可以捡起', picked.ok === true);
await tour.locator('#mei-projector').click();
await tour.locator('.game-panel').waitFor({ state: 'visible' });
check('面板写灯在旁边', (await tour.locator('.game-panel').innerText()).includes('灯就在旁边'));
await tour.getByRole('button', { name: '装上放映机' }).click();
await tour.waitForFunction(() => __valley.game.state.travel.realms.mei.storyShard === true);
const shard = await tour.locator('.game-panel').innerText();
check('修好后看到光之片、首映和飞船', shard.includes('光之片') && shard.includes('首映') && shard.includes('飞船') && shard.includes('热气球'));
check('星空这段可以跳过', shard.includes('跳过这段'));
await shot(tour, 'mei-shard-desktop');
await tour.getByRole('button', { name: '跳过星空这段' }).click();
check('跳过之后碎片还在', await tour.evaluate(() => __valley.game.state.travel.realms.mei.storyShard === true && __valley.game.state.travel.stamps.includes('mei-premiere')));
const ignoreNoise = (item) => /知识引擎|知识包|Failed to load resource|404|502|net::ERR/.test(item);
const tourNoisy = tourErrors.filter((item) => !ignoreNoise(item));
const pageNoisy = errors.filter((item) => !ignoreNoise(item));
if (tourNoisy.length) console.log('tour errors', tourNoisy.join('\n'));
if (pageNoisy.length) console.log('page errors', pageNoisy.join('\n'));
check('体验页没有未捕获的页面错误', tourNoisy.length === 0);
check('学习页没有未捕获的页面错误', pageNoisy.length === 0);
await tourContext.close();
await browser.close();
console.log(`mei-v3-check passed ${passed.length}`);
