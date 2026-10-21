/** Chapter 3 tour: fill the dome, return home, open one star zone. Isolated context. */

import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const url = process.env.GAME_TEST_URL || 'http://127.0.0.1:5173';
const shotDir = '/opt/cursor/artifacts';
await mkdir(shotDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
});
const passed = [];

function check(name, value) {
  assert.ok(value, name);
  passed.push(name);
  console.log(`✓ ${name}`);
}

async function shot(page, name) {
  await page.evaluate(() => {
    const world = __valley.world;
    world.paint?.();
    const url = world.renderer.domElement.toDataURL('image/jpeg', 0.8);
    const canvas = world.canvas;
    let img = document.getElementById('shot-standin');
    if (!img) {
      img = document.createElement('img');
      img.id = 'shot-standin';
      img.alt = '';
      canvas.parentElement?.appendChild(img);
    }
    img.src = url;
    img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;pointer-events:none';
    canvas.style.visibility = 'hidden';
  });
  await page.screenshot({ path: `${shotDir}/${name}.png`, animations: 'disabled', timeout: 20000 });
  await page.evaluate(() => {
    const canvas = document.getElementById('world-canvas');
    if (canvas) canvas.style.visibility = '';
    document.getElementById('shot-standin')?.remove();
  });
}

async function boot(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/knowledge|Failed to load resource|favicon|net::ERR/i.test(text)) return;
    errors.push(`console:${text}`);
  });
  await page.goto(`${url}/?tour=1`, { waitUntil: 'commit', timeout: 120000 });
  await page.waitForFunction(() => window.__valley?.world && document.querySelector('#start-button'));
  await page.evaluate(() => {
    document.querySelector('#start-button')?.click();
    __valley.game.state.settings.sound = false;
    const wish = document.querySelector('#wish-dismiss');
    if (wish && !wish.closest('[hidden]')) wish.click();
  });
  await page.waitForFunction(() => __valley.touring === true && __valley.game.state.travel.story.fogIntro === true);
  return errors;
}

async function toXing(page) {
  let ready = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    ready = await page.evaluate(() => {
      const world = __valley.world;
      world.cancelPointerGesture?.();
      world.stopWalking?.();
      const x = -4.2;
      const z = 20.2;
      world.playerPosition.set(x, world.surfaceAt(x, z), z);
      if (world.balloon) {
        world.balloon = null;
        world.locomotion = 'walk';
      }
      world.startBalloon();
      for (let i = 0; i < 400 && world.balloon?.phase === 'lift'; i += 1) __valley.step(0.05);
      const button = document.querySelector('#balloon-stars');
      const before = { phase: world.balloon?.phase || null, hidden: button?.hidden ?? null };
      if (before.phase === 'tour' && before.hidden === false) button.click();
      return { ...before, voyage: world.balloon?.phase || null, shown: document.querySelector('#star-cutscene')?.hidden === false };
    });
    if (ready.shown) break;
  }
  if (!ready?.shown) throw new Error(`热气球没有飞向星星 ${JSON.stringify(ready)}`);
  await page.locator('#star-cutscene').waitFor({ state: 'visible', timeout: 20000 });
  await page.evaluate(() => document.querySelector('#star-skip')?.click());
  await page.waitForFunction(() => __valley.game.state.travel.current === 'xing' && __valley.world.realmId === 'xing', null, { timeout: 30000 });
  await page.evaluate(() => {
    const world = __valley.world;
    for (let i = 0; i < 180 && world.balloon; i += 1) __valley.step(0.05);
    if (world.balloon) {
      world.balloon = null;
      world.locomotion = 'walk';
    }
  });
}

async function enterHall(page) {
  const started = await page.evaluate(() => {
    const world = __valley.world;
    if (world.balloon) {
      world.balloon = null;
      world.locomotion = 'walk';
    }
    if (__valley.holoPhase() !== 'off') __valley.leaveHolo();
    for (let i = 0; i < 4; i += 1) __valley.step(0.05);
    const ok = !!__valley.enterHolo();
    return { ok, phase: __valley.holoPhase(), realm: world.realmId || null, balloon: !!world.balloon };
  });
  if (!started.ok) throw new Error(`没有进星网 ${JSON.stringify(started)}`);
  await page.locator('#holo-transition').waitFor({ state: 'visible', timeout: 20000 });
  await page.evaluate(async () => { await __valley.skipHolo(); });
  await page.waitForFunction(() => __valley.holoPhase() === 'in', null, { timeout: 20000 });
}

async function run(kind, contextOptions) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = await boot(page);
  await toXing(page);
  await enterHall(page);
  check(`${kind} 还没写星之片`, await page.evaluate(() => __valley.game.state.travel.realms.xing.storyShard !== true));
  await page.evaluate(() => document.querySelector('#holo-dome-open')?.click());
  await page.locator('#holo-panel').waitFor({ state: 'visible' });
  await page.evaluate(() => document.querySelector('[data-holo="dome-home"]')?.click());
  await page.waitForFunction(() => __valley.game.state.travel.realms.xing.storyShard === true);
  const shard = await page.evaluate(() => {
    const realm = __valley.game.state.travel.realms.xing;
    const story = __valley.game.state.travel.story;
    let visible = false;
    __valley.world.holoLayer?.group?.traverse((obj) => {
      if (obj.name === 'holo-shard') visible = obj.visible;
    });
    return {
      shard: realm.storyShard === true,
      stamp: __valley.game.state.travel.stamps.includes('xing-dome'),
      sky: (story.restored || []).includes('sky'),
      visible,
      text: document.querySelector('#holo-panel')?.textContent || '',
    };
  });
  check(`${kind} 拿到星之片和印章`, shard.shard && shard.stamp);
  check(`${kind} 外星谷没有替河谷写下天空`, shard.sky === false);
  check(`${kind} 穹顶碎片亮着`, shard.visible === true && shard.text.includes('观星台'));
  await shot(page, `${kind}-星之片`);

  await page.evaluate(() => document.querySelector('#holo-zones-open')?.click());
  await page.evaluate(() => document.querySelector('[data-holo="zone"][data-stage="shape-1"]')?.click());
  await page.waitForFunction(() => (__valley.peekStage()?.id) === 'shape-1');
  const answer = await page.evaluate(() => __valley.peekStage().answer);
  await page.evaluate((value) => {
    const button = [...document.querySelectorAll('#holo-panel [data-holo="choice"]')].find((item) => item.dataset.value === value);
    button?.click();
  }, answer);
  await page.waitForFunction(() => (__valley.game.state.travel.realms.xing.holo.zones.shape || []).includes('shape-1'));
  check(`${kind} 形之阵可以点亮`, true);
  await shot(page, `${kind}-星区`);

  await page.evaluate(async () => {
    document.querySelector('#holo-back')?.click();
    if (__valley.holoPhase() !== 'off') __valley.leaveHolo();
    await __valley.goHome();
  });
  await page.waitForFunction(() => __valley.game.state.travel.current === 'he' && __valley.world.realmId === 'he', null, { timeout: 30000 });
  await page.waitForFunction(() => (__valley.game.state.travel.story.restored || []).includes('sky'), null, { timeout: 15000 });
  const home = await page.evaluate(() => {
    for (let i = 0; i < 220; i += 1) __valley.step(0.05);
    const story = __valley.game.state.travel.story;
    const site = __valley.story.site();
    const world = __valley.world;
    world.stopWalking?.();
    world.playerPosition.set(site.x + 2.2, world.surfaceAt(site.x + 2.2, site.z + 1.4), site.z + 1.4);
    world.yaw = Math.atan2(-2.2, -1.4);
    world.distance = 11;
    world.updateCamera?.(1, true);
    for (let i = 0; i < 8; i += 1) __valley.step(0.05);
    const names = world.targets.map((item) => item.id);
    return {
      sky: (story.restored || []).includes('sky'),
      disk: names.includes('story-disk'),
      gugu: names.includes('story-gugu'),
      names,
      shard: __valley.game.state.travel.realms.xing.storyShard === true,
      bg: world.scene.background.getStyle(),
    };
  });
  check(`${kind} 回到河谷后天空恢复 ${JSON.stringify(home)}`, home.sky && home.disk && home.gugu && home.shard);
  check(`${kind} 体验模式夜空变深`, /1a2744|26,\s*39,\s*68/i.test(home.bg));
  await shot(page, `${kind}-观星台`);
  check(`${kind} 没有页面错误`, errors.length === 0);
  await context.close();
}

const only = process.env.SHARD_ONLY || '';
if (!only || only === 'desktop') await run('desktop', { viewport: { width: 1280, height: 800 } });
if (!only || only === 'tablet') await run('tablet', { viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true });
console.log(`XING SHARD CHECK PASS ${passed.length}`);
await browser.close();
