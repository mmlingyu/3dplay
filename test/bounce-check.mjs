import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { BOUNCE_ISLAND } from '../src/bounce-data.js';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto('http://127.0.0.1:5179/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__valley?.world);
  await page.evaluate(() => __valley.start());
  const island = await page.evaluate(() => {
    const target = __valley.world.targets.find(t => t.id === 'bounce-island');
    return { name: target?.name, label: target?.label, parks: __valley.world.targets.filter(t => t.type === 'park').map(t => t.park) };
  });
  assert.equal(island.name, '数字乐园');
  assert.equal(island.label, '数字乐园');
  assert.deepEqual(island.parks, ['count', 'even', 'make10', 'skip', 'times', 'prime']);
  await page.evaluate(({ x, z, height }) => {
    const world = __valley.world;
    world.playerPosition.set(x, height + 0.02, z);
    world.update(0.05, { x: 0, z: 0 }, false);
  }, BOUNCE_ISLAND);
  await page.waitForFunction(() => __valley.world.bounce?.count >= 1);
  await page.waitForSelector('#bounce-hud:not([hidden])');
  assert.match(await page.locator('#bounce-word').innerText(), /one/i);
  assert.equal(await page.locator('#bounce-count').innerText(), '1');
  assert.equal(await page.locator('#bounce-park').innerText(), '数字乐园');
  await page.waitForFunction(() => __valley.world.bounce?.count >= 2, null, { timeout: 4000 });
  await page.waitForFunction(() => document.getElementById('bounce-word').textContent.toLowerCase() === 'two');
  await page.locator('[data-park="even"]').click();
  await page.waitForFunction(() => __valley.world.bounce?.mode === 'even' && __valley.world.bounce?.count >= 1, null, { timeout: 4000 });
  assert.equal(await page.locator('#bounce-count').innerText(), '2');
  await page.locator('[data-park="times"]').click();
  await page.waitForSelector('[data-table="3"]');
  await page.locator('[data-table="3"]').click();
  await page.waitForFunction(() => __valley.world.bounce?.mode === 'times' && __valley.world.bounce?.table === 3 && __valley.world.bounce?.count >= 1, null, { timeout: 4000 });
  assert.match(await page.locator('#bounce-formula').innerText(), /× 3/);
  await page.locator('#bounce-stop').click();
  await page.waitForFunction(() => __valley.world.bounce == null);
  assert.equal(await page.locator('#bounce-hud').getAttribute('hidden'), '');
  assert.deepEqual(errors, []);
  console.log('number park ok');
} finally {
  await browser.close();
}
