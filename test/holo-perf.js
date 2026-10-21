/** Headless frame samples. These are not measurements from a real tablet. */

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const url = process.env.GAME_TEST_URL || 'http://127.0.0.1:5174';
const out = '/opt/cursor/artifacts/holo-perf.json';
await mkdir('/opt/cursor/artifacts', { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
});

async function boot(page) {
  await page.goto(url, { waitUntil: 'commit', timeout: 120000 });
  await page.waitForFunction(() => window.__valley?.world && document.querySelector('#start-button'));
  await page.evaluate(() => {
    document.querySelector('#start-button')?.click();
    __valley.game.state.settings.sound = false;
    const wish = document.querySelector('#wish-dismiss');
    if (wish && !wish.closest('[hidden]')) wish.click();
  });
}

async function toXing(page) {
  const state = await page.evaluate(() => {
    const world = __valley.world;
    world.cancelPointerGesture?.();
    world.playerPosition.set(-4.2, world.surfaceAt(-4.2, 20.2), 20.2);
    if (world.balloon) { world.balloon = null; world.locomotion = 'walk'; }
    const started = !!world.startBalloon();
    for (let i = 0; i < 240 && world.balloon?.phase === 'lift'; i += 1) __valley.step(0.05);
    const button = document.querySelector('#balloon-stars');
    return { started, phase: world.balloon?.phase || null, hidden: button?.hidden ?? null };
  });
  if (state.phase !== 'tour' || state.hidden !== false) throw new Error(`热气球没有进入游览 ${JSON.stringify(state)}`);
  await page.evaluate(() => document.querySelector('#balloon-stars')?.click());
  await page.evaluate(() => document.querySelector('#star-skip')?.click());
  await page.waitForFunction(() => __valley.world.realmId === 'xing');
  await page.evaluate(() => {
    const world = __valley.world;
    for (let i = 0; i < 90 && world.balloon; i += 1) __valley.step(0.05);
    world.playerPosition.set(2, world.surfaceAt(2, 0), 0);
  });
}

async function sample(page, ms) {
  return page.evaluate(async (limit) => {
    const frames = [];
    let last = performance.now();
    const start = last;
    await new Promise((resolve) => {
      function loop(now) {
        frames.push(now - last);
        last = now;
        if (now - start < limit) requestAnimationFrame(loop);
        else resolve();
      }
      requestAnimationFrame(loop);
    });
    const sorted = frames.slice().sort((a, b) => a - b);
    const sum = frames.reduce((total, item) => total + item, 0);
    const low = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))] || 16;
    const world = __valley.world;
    world.paint?.();
    const paintStart = performance.now();
    world.paint?.();
    const paintMs = Math.round((performance.now() - paintStart) * 10) / 10;
    const stats = __valley.sampleStats() || {};
    return {
      frames: frames.length,
      avgFps: frames.length ? Math.round((1000 / (sum / frames.length)) * 10) / 10 : 0,
      lowFps: Math.round((1000 / low) * 10) / 10,
      paintMs,
      calls: stats.calls,
      triangles: stats.triangles,
      geometries: stats.geometries,
      textures: stats.textures,
      quality: __valley.quality(),
      bloom: !!world.bloom,
    };
  }, ms);
}

async function measure(label, contextOptions, throttle, quality) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  await boot(page);
  if (quality) await page.evaluate((mode) => __valley.game.setQuality(mode), quality);
  await toXing(page);
  let client = null;
  if (throttle) {
    client = await context.newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  }
  const ground = await sample(page, 10000);
  await page.evaluate(async () => {
    __valley.enterHolo();
    await __valley.skipHolo();
  });
  await page.waitForFunction(() => __valley.holoPhase() === 'in');
  const hall = await sample(page, 10000);
  if (client) await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await context.close();
  return { label, throttle: throttle || 1, ground, hall, note: '无头浏览器模拟，不是真实平板。待真实试玩验证。' };
}

const tablet = { viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true };
const desktop = { viewport: { width: 1280, height: 800 } };
const results = [];
results.push(await measure('tablet-fast', tablet, 0, 'fast'));
results.push(await measure('tablet-fast-throttled', tablet, 4, 'fast'));
results.push(await measure('tablet-fine', tablet, 0, 'fine'));
results.push(await measure('desktop-fine', desktop, 0, 'fine'));

await writeFile(out, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
