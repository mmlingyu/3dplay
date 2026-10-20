import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const url = process.env.GAME_TEST_URL || 'http://127.0.0.1:5179';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__valley?.world);
  await page.evaluate(() => __valley.start());
  const placed = await page.evaluate(() => {
    const { game, world } = __valley;
    world.updateCamera(1, true);
    const cam = world.camera.position;
    const look = world.playerPosition;
    const x = look.x + (cam.x - look.x) * 0.22;
    const z = look.z + (cam.z - look.z) * 0.22;
    game.mutate(s => {
      s.creation.figures = s.creation.figures.filter(f => f.id !== 'fig-browser');
      s.creation.figures.push({
        id: 'fig-browser',
        figure: {
          name: '小灯',
          scale: 1.4,
          parts: [
            { id: 'body', parent: null, pivot: [0, 0, 0], anim: 'bob', shapes: [{ shape: 'box', size: [0.5, 0.8, 0.4], at: [0, 0.6, 0], color: '#d97a5f' }] },
            { id: 'armL', parent: 'body', pivot: [0, 0.9, 0.28], anim: 'none', shapes: [{ shape: 'box', size: [0.36, 0.1, 0.1], at: [0.12, 0, 0], color: '#f0c95c' }] },
            { id: 'armR', parent: 'body', pivot: [0, 0.9, -0.28], anim: 'none', shapes: [{ shape: 'box', size: [0.36, 0.1, 0.1], at: [0.12, 0, 0], color: '#f0c95c' }] },
          ],
        },
        placed: null,
      });
    });
    const result = game.placeFigure('fig-browser', { x, z, rotY: 0 });
    world.updateCamera(1, true);
    const target = world.targets.find(t => t.figureId === 'fig-browser');
    if (!target) return { ok: false, message: result.message, targets: world.targets.map(t => t.id) };
    const point = target.position.clone();
    point.y += 0.7;
    point.project(world.camera);
    const rect = world.canvas.getBoundingClientRect();
    return {
      ok: result.ok,
      message: result.message,
      x: rect.left + (point.x + 1) * rect.width / 2,
      y: rect.top + (1 - point.y) * rect.height / 2,
      ndc: { x: point.x, y: point.y, z: point.z },
    };
  });
  assert.equal(placed.ok, true, placed.message);
  assert.ok(placed.ndc.z < 1 && Math.abs(placed.ndc.x) < 1 && Math.abs(placed.ndc.y) < 1, JSON.stringify(placed.ndc));
  await page.mouse.click(placed.x, placed.y);
  await page.waitForSelector('#model-menu:not([hidden])');
  assert.equal(await page.locator('#model-menu-edit').innerText(), '继续修改');
  assert.equal(await page.locator('#model-menu-recall').innerText(), '收回背包');
  assert.match(await page.locator('#model-menu-act').innerText(), /跳一跳/);
  await page.locator('#model-menu-edit').click();
  await page.waitForFunction(() => __valley.panels.type() === 'lab');
  assert.equal(await page.evaluate(() => JSON.parse(render_game_to_text()).creation.lab.figureId), 'fig-browser');
  assert.match(await page.locator('.panel-body').innerText(), /在原来的上面改/);
  const before = await page.evaluate(() => __valley.game.state.creation.figures.find(f => f.id === 'fig-browser').figure.parts.length);
  await page.locator('[data-action="figure-add"]').click();
  await page.waitForFunction(n => __valley.game.state.creation.figures.find(f => f.id === 'fig-browser').figure.parts.length === n + 1, before);
  const still = await page.evaluate(() => __valley.game.state.creation.figures.find(f => f.id === 'fig-browser').placed);
  assert.ok(still);
  await page.locator('.panel-header [data-action=close]').click();
  await page.waitForFunction(() => __valley.panels.type() === null);
  await page.mouse.click(placed.x, placed.y);
  await page.locator('#model-menu-act').click();
  await page.waitForFunction(() => document.getElementById('model-menu-act').textContent.includes('转一圈'));
  await page.mouse.dblclick(placed.x, placed.y);
  await page.waitForFunction(() => {
    const focus = __valley.world.modelFocus;
    return focus?.id === 'fig-browser' && __valley.world.camera.position.distanceTo(focus.point) < 12;
  });
  await page.mouse.dblclick(placed.x, placed.y);
  await page.waitForFunction(() => __valley.world.modelFocus == null);
  await page.locator('#model-menu-recall').click();
  await page.waitForFunction(() => !__valley.game.state.creation.figures.find(f => f.id === 'fig-browser')?.placed);
  assert.equal(await page.locator('#model-menu').isHidden(), true);
  assert.deepEqual(errors, []);
  console.log('placed model menu, edit, gesture, focus, and recall ok');
} finally {
  await browser.close();
}
