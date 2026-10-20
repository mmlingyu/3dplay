import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const url = process.env.GAME_TEST_URL || 'http://127.0.0.1:5178';
await mkdir('output', { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
const check = (name, value) => {
  assert.ok(value, name);
  results.push(name);
  console.log(`✓ ${name}`);
};

try {
  for (const [name, width, height, touch] of [
    ['desktop', 1440, 900, false],
    ['tablet', 1024, 768, true],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    try {
      await page.goto(url);
      await page.waitForFunction(() => window.__valley?.world);
      const before = await page.evaluate(() => ({
        inventory: { ...__valley.game.state.inventory },
        blocks: [...__valley.game.state.blocks],
      }));
      const hasStation = await page.evaluate(() => {
        const station = __valley.world.targets.find((target) => target.id === 'axle-station');
        if (!station || station.panel !== 'axle') return false;
        __valley.start();
        __valley.world.playerPosition.set(station.position.x, station.position.y, station.position.z);
        __valley.world.stopWalking();
        __valley.interact(station);
        return true;
      });
      check(`${name}: 河谷实体试装台可打开轮轴面板`, hasStation);
      await page.waitForFunction(() => __valley.panels.type() === 'axle');
      await page.waitForFunction(() => __valley.panels.axle()?.renderer);
      check(`${name}: 三维试装台正常打开`, await page.locator('#axle-canvas').isVisible());

      await page.locator('[data-action="axle-toggle"][data-side="left"]').click();
      await page.locator('[data-action="axle-toggle"][data-side="right"]').click();
      await page.locator('[data-action="axle-turn"][data-side="left"]').click();
      const leftTurn = await page.evaluate(() => __valley.panels.axle().session.snapshot());
      check(`${name}: 两轮可分别装入对应转轴插槽`, leftTurn.connections.length === 2);
      check(`${name}: 控件转动左轮时右轮和固定轴保持不动`,
        leftTurn.wheels.left.angle === Math.PI / 4
        && leftTurn.wheels.right.angle === 0
        && leftTurn.axle.angle === 0);

      if (!touch) {
        const point = await page.evaluate(() => __valley.panels.axle().pointForWheel('right'));
        await page.mouse.move(point.x, point.y);
        await page.mouse.down();
        await page.mouse.move(point.x + 32, point.y, { steps: 5 });
        await page.mouse.up();
        await page.waitForFunction(() => __valley.panels.axle().session.wheels.right.angle > 0.4);
        const dragged = await page.evaluate(() => __valley.panels.axle().session.snapshot());
        check('desktop: 直接拖动三维右轮改变其角度，不带动左轮', dragged.wheels.right.angle > 0.4
          && dragged.wheels.left.angle === Math.PI / 4
          && dragged.axle.angle === 0);
      } else {
        const buttons = await page.locator('.axle-control button').evaluateAll((elements) =>
          elements.map((element) => {
            const rect = element.getBoundingClientRect();
            return { width: rect.width, height: rect.height };
          }));
        check('tablet: 触屏轮轴按钮命中尺寸至少44像素',
          buttons.every((rect) => rect.width >= 44 && rect.height >= 44));
        await page.locator('[data-action="axle-turn"][data-side="right"]').click();
        const rightTurn = await page.evaluate(() => __valley.panels.axle().session.snapshot());
        check('tablet: 触屏按钮可独立转动右轮', rightTurn.wheels.right.angle === Math.PI / 4
          && rightTurn.wheels.left.angle === Math.PI / 4);
      }

      await page.locator('[data-action="axle-toggle"][data-side="left"]').click();
      const detached = await page.evaluate(() => __valley.panels.axle().session.snapshot());
      check(`${name}: 轮子可拆下且另一个转动连接保留`,
        !detached.wheels.left.attached && detached.connections.length === 1);
      check(`${name}: 试装不扣背包材料、不写入建筑`,
        await page.evaluate((state) => JSON.stringify(__valley.game.state.inventory) === JSON.stringify(state.inventory)
          && JSON.stringify(__valley.game.state.blocks) === JSON.stringify(state.blocks), before));

      if (!touch) await page.screenshot({ path: 'output/axle-desktop.png' });
      await page.evaluate(() => {
        window.closedAxle = __valley.panels.axle();
        __valley.panels.close();
      });
      check(`${name}: 关闭试装台时释放三维会话`,
        await page.evaluate(() => window.closedAxle.session.disposed && !window.closedAxle.canvas.isConnected));
      check(`${name}: 操作期间无浏览器异常`, errors.length === 0);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
console.log(`轮轴浏览器检查通过：${results.length} 项`);
