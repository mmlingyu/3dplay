import { chromium } from 'playwright';
import fs from 'node:fs';

const out = 'C:/Users/mmlin/AppData/Local/Temp/valley-zones';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:6010/play/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.__valley?.world, null, { timeout: 60000 });
await page.click('#start-button');
await page.waitForTimeout(600);

async function shot(name, x, z, yaw, dist) {
  await page.evaluate(({ x, z, yaw, dist }) => {
    const w = window.__valley.world;
    w.playerPosition.set(x, 0, z);
    w.yaw = yaw;
    w.distance = dist;
    w.update(1, { x: 0, z: 0 }, true);
  }, { x, z, yaw, dist });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/${name}.png` });
}

await shot('court', -4.5, 4.2, 0.55, 16);
await shot('workshop', -7.2, -6.2, 0.4, 18);
await shot('east', 10.5, 0.5, 0.2, 20);
const places = await page.evaluate(() => window.__valley.world.targets
  .filter(t => ['stone-source', 'clay-source', 'public-workbench', 'kiln', 'garden'].includes(t.id))
  .map(t => ({ id: t.id, x: +t.position.x.toFixed(2), z: +t.position.z.toFixed(2) })));
console.log(JSON.stringify(places));
await browser.close();
