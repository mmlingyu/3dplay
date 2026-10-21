import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createInitialState } from '../src/game-state.js';
import { emptyRealm } from '../src/realm-data.js';

const url = process.env.GAME_TEST_URL || 'http://127.0.0.1:5174';
const shotDir = '/opt/cursor/artifacts';
const KEY = 'yuanyuan-river-valley-v1';
const VISTA_BACKUP = `${KEY}-before-vista`;
const MEI_BACKUP = `${KEY}-before-mei`;
const XING_BACKUP = `${KEY}-before-xing`;

await mkdir(shotDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const passed = [];

function check(name, value) {
  assert.ok(value, name);
  passed.push(name);
  console.log(`✓ ${name}`);
}

async function shot(page, name) {
  const file = `${shotDir}/${name}.png`;
  await page.screenshot({ path: file });
  console.log('shot', file);
}

async function boot(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console:${msg.text()}`);
  });
  await page.goto(url);
  await page.waitForFunction(() => window.__valley?.world);
  await page.click('#start-button');
  await page.evaluate(() => { __valley.game.state.settings.sound = false; });
  if (await page.locator('#wish-dismiss').isVisible().catch(() => false)) await page.click('#wish-dismiss');
  await page.waitForFunction(() => __valley.world?.vistaView, null, { timeout: 20000 });
  return errors;
}

async function boxOf(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      w: r.width,
      h: r.height,
      hidden: el.hidden || style.display === 'none' || style.visibility === 'hidden',
    };
  }, selector);
}

async function assertTap(page, selector, label) {
  const box = await boxOf(page, selector);
  check(`${label} 至少 44 像素`, box && !box.hidden && box.w >= 44 && box.h >= 44);
}

async function lookSouth(page) {
  await page.evaluate(() => {
    __valley.world.yaw = Math.PI;
    __valley.world.vistaMomentOverride = { period: '中午' };
    for (let i = 0; i < 12; i += 1) __valley.step(0.08);
  });
}

async function discoverFromBalloon(page, kind) {
  await lookSouth(page);
  const ground = await page.evaluate(() => ({
    opacity: __valley.world.vistaView.opacity,
    clarity: __valley.world.vistaView.clarity,
    meshes: __valley.world.vistaView.meshCount,
    names: __valley.world.vistaView.group.children.map((child) => child.name || child.type),
    kite: __valley.world.vistaView.signals.kite,
    lantern: __valley.world.vistaView.signals.lantern,
    windmill: __valley.world.vistaView.signals.windmill,
    flying: !!__valley.world.balloon,
  }));
  console.log(kind, 'ground', JSON.stringify(ground));
  check(`${kind} 地面剪影更淡`, ground.opacity < 0.45 && ground.clarity <= 0.25 && !ground.flying);
  check(`${kind} 远景网格很少`, ground.meshes > 0 && ground.meshes <= 14);
  check(`${kind} 白天有风筝，风车一直转`, ground.kite && !ground.lantern && ground.windmill);
  await shot(page, `vista-${kind}-ground`);

  await page.evaluate(() => { __valley.world.startBalloon(); });
  await page.waitForFunction(() => {
    const ride = __valley.world.balloon;
    if (!ride) return false;
    if (ride.phase === 'lift' || ride.phase === 'tour') __valley.step(0.25);
    return ride.phase === 'tour' && __valley.world.vistaGlance?.id === 'ri';
  }, null, { timeout: 20000 });
  await page.locator('#vista-card').waitFor({ state: 'visible' });
  await page.waitForFunction(() => __valley.world.vistaGlance?.phase === 'hold');
  await page.evaluate(() => { for (let i = 0; i < 12; i += 1) __valley.step(0.08); });
  const line = await page.locator('#vista-line').innerText();
  check(`${kind} 阿姨说出那边是日谷`, line.includes('看，那边是日谷'));
  const high = await page.evaluate(() => ({
    opacity: __valley.world.vistaView.opacity,
    height: __valley.world.balloon.height,
    discovered: { ...__valley.game.state.travel.discovered },
  }));
  console.log(kind, 'high', JSON.stringify(high));
  check(`${kind} 升高后剪影更清楚`, high.opacity > 0.7 && high.height >= 12);
  check(`${kind} 看见以前还不算发现`, high.discovered.ri === false && high.discovered.mei === false && high.discovered.xing === false);
  const voyage = await page.evaluate(() => ['#balloon-voyage', '#balloon-voyage-mei', '#balloon-stars'].map((sel) => {
    const el = document.querySelector(sel);
    return el ? { sel, hidden: el.hidden, disabled: el.disabled } : null;
  }));
  check(`${kind} 没发现也能去三个谷`, voyage.every((item) => item && !item.hidden && !item.disabled));
  await assertTap(page, '#vista-look', `${kind} 看过去`);
  await assertTap(page, '#vista-later', `${kind} 先不看`);
  await assertTap(page, '#vista-map-button', `${kind} 远处的谷`);
  const arrow = await boxOf(page, '#vista-arrow');
  if (arrow && !arrow.hidden) check(`${kind} 箭头至少 44 像素`, arrow.w >= 44 && arrow.h >= 44);
  await shot(page, `vista-${kind}-high`);

  await page.locator('#vista-look').click();
  await page.waitForFunction(() => __valley.world.vistaGlance?.phase === 'zoom');
  await assertTap(page, '#vista-skip', `${kind} 跳过靠近`);
  await page.evaluate(() => { for (let i = 0; i < 6; i += 1) __valley.step(0.1); });
  await page.locator('#vista-skip').click();
  await page.locator('#vista-stamp').waitFor({ state: 'visible' });
  const stamped = await page.evaluate(() => ({
    name: document.querySelector('#vista-stamp-name')?.textContent || '',
    discovered: __valley.game.state.travel.discovered.ri,
    stamp: __valley.game.state.travel.stamps.includes('vista-ri'),
    mei: __valley.game.state.travel.discovered.mei,
    xing: __valley.game.state.travel.discovered.xing,
  }));
  check(`${kind} 盖上发现日谷`, stamped.name.includes('发现日谷') && stamped.discovered && stamped.stamp);
  check(`${kind} 这一次只发现最近的日谷`, stamped.mei === false && stamped.xing === false);
  await shot(page, `vista-${kind}-stamp`);
}

async function ageMaps(page, kind) {
  await page.evaluate(() => __valley.openPanel('vista'));
  await page.waitForFunction(() => __valley.panels?.type() === 'vista');
  const little = await page.locator('.panel-body').innerText();
  check(`${kind} 4到6岁用唱歌和图`, little.includes('坐船要唱 3 首歌') && little.includes('海面上还有雾') && !little.includes('东南') && !little.includes('估一估'));
  check(`${kind} 地图点亮日谷`, await page.locator('[data-vista="ri"]').getAttribute('data-known') === 'yes');
  check(`${kind} 没发现的谷还在雾里`, await page.locator('[data-vista="mei"]').getAttribute('data-known') === 'no' && await page.locator('[data-vista="xing"]').getAttribute('data-known') === 'no');
  if (kind !== 'desktop') {
    await page.evaluate(() => {
      __valley.game.mutate((state) => { state.settings.ageBand = 'bigger'; });
      __valley.panels.refresh();
    });
    const bigger = await page.locator('.panel-body').innerText();
    check(`${kind} 7到9岁有东南`, bigger.includes('东南') && !bigger.includes('估一估'));
    await page.evaluate(() => {
      __valley.game.mutate((state) => { state.settings.ageBand = 'older'; });
      __valley.panels.refresh();
    });
    const older = await page.locator('.panel-body').innerText();
    check(`${kind} 10到12岁有比例和估远近`, older.includes('大约 18') && older.includes('1 首歌') && older.includes('估一估') && older.includes('答错不扣东西'));
    const before = await page.evaluate(() => JSON.stringify(__valley.game.state.inventory));
    await page.getByRole('button', { name: '日谷，坐船唱 3 首歌' }).click();
    const note = await page.locator('#vista-quiz-note').innerText();
    const after = await page.evaluate(() => JSON.stringify(__valley.game.state.inventory));
    check(`${kind} 估错不拿走东西`, note.includes('还在') && before === after);
  }
  const close = await boxOf(page, '.panel-header [data-action="close"]');
  check(`${kind} 关闭按钮至少 44 像素`, close && !close.hidden && close.w >= 44 && close.h >= 44);
  await page.locator('.panel-header [data-action="close"]').click();
}

async function climbTo(page, id) {
  const name = id === 'mei' ? '美谷' : '外星谷';
  await page.evaluate(() => {
    const world = __valley.world;
    const ride = world.balloon;
    ride.phase = 'tour';
    ride.mode = 'steer';
    ride.height = 8;
    ride.climb = 0;
    ride.vistaChecked = false;
    world.balloonCraft?.position.set(-4.2, 8, 20.2);
    world.vistaGlance = null;
    const stamp = document.querySelector('#vista-stamp');
    if (stamp) stamp.hidden = true;
    __valley.step(0.05);
  });
  await page.waitForFunction((want) => {
    const ride = __valley.world.balloon;
    if (!ride) return false;
    if (__valley.world.vistaGlance) return __valley.world.vistaGlance.id === want;
    ride.mode = 'steer';
    ride.climb = 1;
    ride.phase = 'tour';
    __valley.step(0.2);
    return false;
  }, id, { timeout: 20000 });
  await page.locator('#vista-card').waitFor({ state: 'visible' });
  await page.locator('#vista-look').click();
  await page.locator('#vista-skip').click();
  await page.waitForFunction((label) => {
    const el = document.querySelector('#vista-stamp');
    return el && !el.hidden && (el.textContent || '').includes(label);
  }, name, { timeout: 10000 });
}

async function fullAgeMaps(page) {
  await climbTo(page, 'mei');
  check('第二次升高发现美谷', await page.evaluate(() => __valley.game.state.travel.discovered.mei && __valley.game.state.travel.stamps.includes('vista-mei')));
  await climbTo(page, 'xing');
  check('第三次升高发现外星谷', await page.evaluate(() => __valley.game.state.travel.discovered.xing && __valley.game.state.travel.stamps.includes('vista-xing')));
  const bands = [
    ['little', 'vista-map-little', '坐船要唱 3 首歌', '往上看星星'],
    ['bigger', 'vista-map-bigger', '东南', '西南'],
    ['older', 'vista-map-older', '大约 48', '估一估'],
  ];
  for (const [band, file, a, b] of bands) {
    await page.evaluate((next) => {
      __valley.game.mutate((state) => { state.settings.ageBand = next === 'little' ? null : next; });
      __valley.openPanel('vista');
      __valley.panels.refresh();
    }, band);
    await page.waitForFunction(() => __valley.panels?.type() === 'vista');
    const text = await page.locator('.panel-body').innerText();
    check(`全图 ${band} 文案`, text.includes(a) && text.includes(b));
    if (band === 'little') check('三座谷都点亮', await page.evaluate(() => ['ri', 'mei', 'xing'].every((id) => document.querySelector(`[data-vista="${id}"]`)?.dataset.known === 'yes')));
    if (band === 'older') {
      check('大孩子地图没有把答错变成惩罚', text.includes('答错不扣东西'));
      const before = await page.evaluate(() => JSON.stringify(__valley.game.state.inventory));
      await page.getByRole('button', { name: '日谷，坐船唱 3 首歌' }).click();
      check('估错不拿走东西', (await page.locator('#vista-quiz-note').innerText()).includes('还在') && before === await page.evaluate(() => JSON.stringify(__valley.game.state.inventory)));
    }
    await shot(page, file);
    await page.locator('.panel-header [data-action="close"]').click();
  }
}

async function roundTrips(page) {
  const plan = [
    ['ferry', 'ri'],
    ['ferry', 'mei'],
    ['balloon', 'xing'],
  ];
  for (const [via, id] of plan) {
    const before = await page.evaluate(() => ({ ...__valley.game.state.travel.discovered, stamps: [...__valley.game.state.travel.stamps] }));
    await page.evaluate(({ via, id }) => __valley.goRealm(via, id), { via, id });
    await page.waitForFunction((realm) => __valley.game.state.travel.current === realm && __valley.world?.realmId === realm, id, { timeout: 30000 });
    await assertTap(page, '#travel-home', `从${id}回家`);
    const away = await page.evaluate(() => ({ ...__valley.game.state.travel.discovered }));
    check(`去${id}没有改成远眺发现`, JSON.stringify(away) === JSON.stringify({ ri: before.ri, mei: before.mei, xing: before.xing }));
    await page.evaluate(() => __valley.goHome());
    await page.waitForFunction(() => __valley.game.state.travel.current === 'he' && __valley.world?.realmId === 'he', null, { timeout: 20000 });
    await page.waitForFunction(() => __valley.world?.vistaView, null, { timeout: 20000 });
  }
  check('三个谷都能去并能回来', true);
}

async function runViewport(kind, viewport) {
  const context = await browser.newContext({ viewport, hasTouch: kind === 'phone' });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = await boot(page);
  try {
    await roundTrips(page);
    await discoverFromBalloon(page, kind);
    await ageMaps(page, kind);
    if (kind === 'desktop') await fullAgeMaps(page);
    await page.evaluate(() => {
      __valley.world.vistaMomentOverride = { period: '晚上' };
      __valley.step(0.05);
    });
    const night = await page.evaluate(() => __valley.world.vistaView.signals);
    check(`${kind} 晚上换灯笼，水晶才亮`, night.lantern && night.crystal && !night.kite && night.windmill);
    const noisy = errors.filter((item) => !/知识引擎|知识包|Failed to load resource|404|net::ERR|speechSynthesis/.test(item));
    if (noisy.length) console.log(kind, 'page issues', noisy);
    check(`${kind} 没有未捕获的页面错误`, noisy.length === 0);
  } finally {
    await context.close();
  }
}

async function oldSave() {
  const save = createInitialState();
  delete save.travel.discovered;
  delete save.travel.keepsakes;
  save.travel.visited = ['mei'];
  save.travel.realms.xing = emptyRealm('xing');
  save.inventory.wood = 11;
  save.blocks = [{ id: 'block-1', item: 'plank', x: 0, y: 0, z: 0, rotation: 0 }];
  save.nextId = 2;
  const text = JSON.stringify(save);
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.addInitScript(({ text, KEY, MEI_BACKUP, XING_BACKUP }) => {
    localStorage.setItem(KEY, text);
    localStorage.setItem(MEI_BACKUP, 'keep-mei');
    localStorage.setItem(XING_BACKUP, 'keep-xing');
  }, { text, KEY, MEI_BACKUP, XING_BACKUP });
  page.setDefaultTimeout(30000);
  await boot(page);
  const result = await page.evaluate(({ text, VISTA_BACKUP, MEI_BACKUP, XING_BACKUP, KEY }) => {
    const main = JSON.parse(localStorage.getItem(KEY));
    return {
      discovered: __valley.game.state.travel.discovered,
      wood: __valley.game.state.inventory.wood,
      block: __valley.game.state.blocks[0]?.item || null,
      backup: localStorage.getItem(VISTA_BACKUP),
      mei: localStorage.getItem(MEI_BACKUP),
      xing: localStorage.getItem(XING_BACKUP),
      version: main.version,
      written: main.travel.discovered,
    };
  }, { text, VISTA_BACKUP, MEI_BACKUP, XING_BACKUP, KEY });
  check('旧档去过美谷算发现，空壳子不算', result.discovered.mei === true && result.discovered.ri === false && result.discovered.xing === false);
  check('旧档木头和积木还在', result.wood === 11 && result.block === 'plank');
  check('第一次写入前留下远眺备份', result.backup === text && result.version === 1 && result.written.mei === true);
  check('美谷和外星谷备份没有被盖掉', result.mei === 'keep-mei' && result.xing === 'keep-xing');
  await context.close();
}

try {
  await oldSave();
  await runViewport('desktop', { width: 1280, height: 800 });
  await runViewport('tablet', { width: 1024, height: 768 });
  await runViewport('phone', { width: 390, height: 844 });
  console.log(`远眺流程通过 ${passed.length} 项`);
} finally {
  await browser.close();
}
