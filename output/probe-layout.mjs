import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:5179');
await page.waitForFunction(() => window.__valley?.world);
const out = await page.evaluate(async () => {
  const { isPointOpen } = await import('/src/land-data.js');
  const { inPoolReservedArea } = await import('/src/water-data.js');
  const w = __valley.world, land = __valley.game.state.land;
  const trees = [[-12,10],[-8,12],[-13,14],[-14,-4],[-13,-9],[12,11],[14,14]];
  const fixed = w.targets.filter(t => !String(t.id).startsWith('block-') && t.type !== 'creation' && !['idea-desk', 'invention-lab'].includes(t.id)).map(t => [t.id, +t.position.x.toFixed(1), +t.position.z.toFixed(1)]);
  const free = [];
  for (let x = -14; x <= 14; x += 1) for (let z = -14; z <= 14; z += 1) {
    if (!isPointOpen(land, x, z, .5) || inPoolReservedArea(x, z, .5)) continue;
    const dT = Math.min(...trees.map(([a, b]) => Math.hypot(a - x, b - z)));
    const dF = Math.min(...fixed.map(([, a, b]) => Math.hypot(a - x, b - z)));
    if (dT >= 2.2 && dF >= 2.5) free.push([x, z]);
  }
  return { fixed, blocks: __valley.game.state.blocks.length, free: free.map(p => p.join(',')).join(' ') };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
