import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const browser = await chromium.launch({ headless: true });
const output = join(tmpdir(), 'valley-placement-gestures');
await mkdir(output, { recursive: true });
try {
  for (const [name, width, height, touch] of [
    ['desktop', 1440, 900, false], ['tablet', 1024, 768, true], ['phone', 390, 844, true],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.env.GAME_TEST_URL || 'http://127.0.0.1:5173');
    await page.waitForFunction(() => window.__valley?.world);
    await page.locator('#start-button')[touch ? 'tap' : 'click']();
    await page.evaluate(() => { __valley.game.state.settings.sound = false; });
    await page.locator('#hotbar [data-item="plank"]')[touch ? 'tap' : 'click']();
    const project = async (x, y, z) => page.evaluate(([x, y, z]) => {
      const w = __valley.world, p = w.playerPosition.clone().set(x, y, z).project(w.camera);
      return { x: (p.x + 1) * innerWidth / 2, y: (1 - p.y) * innerHeight / 2 };
    }, [x, y, z]);
    const stock = await page.evaluate(() => __valley.game.state.inventory.plank);
    const point = await project(-4, .01, 5);
    if (!touch) {
      await page.mouse.dblclick(point.x, point.y);
      assert.equal(await page.evaluate(() => __valley.game.state.inventory.plank), stock - 1, '电脑双击应仅放置一次');
    } else {
      await page.touchscreen.tap(point.x, point.y);
      assert.equal(await page.evaluate(() => __valley.game.state.inventory.plank), stock, '触屏点选只预览');
      const start = await project(-4, .5, 5), destination = await project(-3, .5, 5);
      const cdp = await context.newCDPSession(page);
      const send = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
      await send('touchStart', [{ ...start, id: 0 }]);
      await send('touchMove', [{ ...destination, id: 0 }]);
      assert.equal(await page.evaluate(() => __valley.game.state.inventory.plank), stock, '拖动过程不扣料');
      await page.screenshot({ path: join(output, `${name}-drag.png`) });
      await send('touchEnd', []);
      assert.equal(await page.evaluate(() => __valley.game.state.inventory.plank), stock - 1, '触屏拖动预览松手应自动放置');
      assert.ok(await page.evaluate(() => __valley.game.state.blocks.some(b => b.x === -3 && b.z === 5 && b.y === 0)), '放在拖动后的格子而不是起始位置');
      await page.locator('#undo-button').tap();
      await page.evaluate(() => __valley.setBuildCell({ x: -4, y: 0, z: 5 }));
      const ghost = await project(-4, .5, 5);
      await send('touchStart', [{ ...ghost, id: 0 }]);
      await send('touchMove', [{ ...destination, id: 0 }]);
      await send('touchCancel', []);
      assert.equal(await page.evaluate(() => __valley.game.state.inventory.plank), stock, '取消触控不放置');
      await page.evaluate(() => __valley.setBuildCell({ x: -4, y: 0, z: 5 }));
      await send('touchStart', [{ ...ghost, id: 0 }]);
      await send('touchStart', [{ ...ghost, id: 0 }, { x: ghost.x + 50, y: ghost.y, id: 1 }]);
      await send('touchMove', [{ ...ghost, id: 0 }, { x: ghost.x + 80, y: ghost.y, id: 1 }]);
      await send('touchEnd', []);
      assert.equal(await page.evaluate(() => __valley.game.state.inventory.plank), stock, '双指缩放取消拖放而不扣料');
      await page.evaluate(() => __valley.setBuildCell({ x: -4, y: 0, z: 5 }));
      const currentGhost = await project(-4, .5, 5), blocked = await project(-5, .5, 5);
      await send('touchStart', [{ ...currentGhost, id: 0 }]);
      await send('touchMove', [{ ...blocked, id: 0 }]);
      await send('touchEnd', []);
      assert.equal(await page.evaluate(() => __valley.game.state.inventory.plank), stock, '拖到圆圆脚下不放置');
      await page.evaluate(() => __valley.setBuildCell({ x: -4, y: 0, z: 5 }));
      await send('touchStart', [{ ...currentGhost, id: 0 }]);
      const ui = await page.locator('#placement-confirm').boundingBox();
      await send('touchMove', [{ x: ui.x + ui.width / 2, y: ui.y + ui.height / 2, id: 0 }]);
      await send('touchEnd', []);
      assert.equal(await page.evaluate(() => __valley.game.state.inventory.plank), stock, '在界面上松手不穿透放置');
      await page.evaluate(() => __valley.setBuildCell({ x: -4, y: 0, z: 5 }));
      await send('touchStart', [{ ...currentGhost, id: 0 }]);
      await send('touchMove', [{ ...destination, id: 0 }]);
      await page.evaluate(() => __valley.selectItem('stone'));
      const stone = await page.evaluate(() => __valley.game.state.inventory.stone);
      await send('touchEnd', []);
      assert.equal(await page.evaluate(() => __valley.game.state.inventory.stone), stone, '切材料后旧拖放不能确认新材料');
      const yaw = await page.evaluate(() => __valley.world.yaw);
      await send('touchStart', [{ x: width * .5, y: height * .38, id: 0 }]);
      await send('touchMove', [{ x: width * .5 + 60, y: height * .38, id: 0 }]);
      await send('touchEnd', []);
      assert.notEqual(await page.evaluate(() => __valley.world.yaw), yaw, '拖空白仍可转视角');
      assert.equal(await page.evaluate(() => __valley.game.state.inventory.plank), stock);
      await cdp.detach();
    }
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(`${name}: 快捷放置与防误触通过`);
    await context.close();
  }
} finally {
  await browser.close();
}
