import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const browser = await chromium.launch({ headless: true });
const output = join(tmpdir(), 'valley-placement-check');
await mkdir(output, { recursive: true });
try {
  for (const [name, width, height, touch] of [
    ['desktop', 1440, 900, false], ['tablet', 1024, 768, true],
    ['portrait', 768, 1024, true], ['phone', 390, 844, true], ['small-phone', 320, 740, true],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.env.GAME_TEST_URL || 'http://127.0.0.1:5173');
    await page.waitForFunction(() => window.__valley?.world);
    const press = selector => page.locator(selector)[touch ? 'tap' : 'click']();
    await press('#start-button');
    await page.evaluate(() => { __valley.game.state.settings.sound = false; });
    assert.equal(await page.locator('#hotbar').isHidden(), true, '采集时建造格收起');
    await press('[data-mode="build"]');
    assert.equal(await page.locator('#hotbar').isVisible(), true, '搭建时建造格展开');
    await press('#hotbar [data-item="plank"]');
    assert.equal(await page.locator('#placement-controls').count(), 1, '选材料后应有就近的放置操作区');
    assert.ok(await page.locator('#placement-confirm').isDisabled(), '未选位置不能隐式放到角色前方');
    assert.ok(await page.evaluate(() => !__valley.world.preview.visible));
    const stock = await page.evaluate(() => __valley.game.state.inventory.plank);
    await page.evaluate(() => {
      const w = __valley.world;
      w.playerPosition.set(-5, 0, 5); w.stopWalking();
    });
    // Project a real ground cell; interact through the canvas rather than a placement hook.
    const point = await page.evaluate(() => {
      const w = __valley.world, p = w.playerPosition.clone().set(-4, .01, 5).project(w.camera);
      return { x: (p.x + 1) * innerWidth / 2, y: (1 - p.y) * innerHeight / 2 };
    });
    if (touch) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
    await page.waitForFunction(() => !document.getElementById('placement-confirm').disabled);
    assert.equal(await page.evaluate(() => __valley.game.state.inventory.plank), stock, '预览不扣材料');
    const tile = page.locator('#hotbar [data-item="plank"]');
    await tile.focus();
    await page.evaluate(() => __valley.game.notify());
    assert.ok(await tile.evaluate(el => document.activeElement === el), '刷新库存不应移除聚焦的物品格');
    const controls = await page.evaluate(() => {
      const selectors = ['#placement-confirm', '#placement-cancel', '#rotate-button', '#undo-button',
        '#hotbar [data-item="plank"]', '#hotbar [data-item="ball"]'];
      return selectors.map(s => {
        const el = document.querySelector(s), r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { s, width: r.width, height: r.height, visible: r.x >= 0 && r.y >= 0 &&
          r.right <= innerWidth && r.bottom <= innerHeight, reachable: el.contains(hit) };
      });
    });
    assert.ok(controls.every(c => c.visible && c.reachable && c.width >= 44 && c.height >= 44), JSON.stringify(controls));
    await page.screenshot({ path: join(output, `${name}-preview.png`) });
    if (touch) await press('#rotate-button'); else await page.keyboard.press('r');
    if (touch) await press('#placement-confirm'); else await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => __valley.game.state.inventory.plank), stock - 1);
    assert.ok(await page.locator('#placement-confirm').isDisabled(), '放完后要重新选位置，防止重复误放');
    await press('#undo-button');
    assert.equal(await page.evaluate(() => __valley.game.state.inventory.plank), stock);
    await press('#placement-cancel');
    assert.ok(await page.locator('#placement-controls').isHidden());
    assert.equal(await page.locator('[data-mode="gather"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#hotbar').isHidden(), true, '取消后建造格收回');
    await page.keyboard.press('2');
    assert.equal(await page.locator('[data-mode="gather"]').getAttribute('aria-pressed'), 'true', '没有的材料不切换到无法放置的模式');
    await press('[data-mode="build"]');
    await press('#hotbar [data-item="plank"]');
    await page.evaluate(() => __valley.setBuildCell({ x: -5, y: 0, z: 5 }));
    assert.ok(await page.locator('#placement-confirm').isDisabled(), '角色脚下不能放置');
    assert.ok(await page.evaluate(() => __valley.world.previewMaterial.color.getHexString() === 'e58471'));
    await page.evaluate(() => __valley.setBuildCell({ x: -10, y: 0, z: 6 }));
    await press('#placement-confirm');
    assert.ok(await page.evaluate(() => !!__valley.world.walkTarget), '远处确认后先走近');
    if (touch) await press('#placement-cancel'); else await page.keyboard.press('Escape');
    assert.ok(await page.evaluate(() => !__valley.world.walkTarget && !__valley.world.walkCallback), '取消时撤销待执行放置');
    assert.equal(await page.evaluate(() => __valley.game.state.inventory.plank), stock);
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(`${name}: 选择、场景点选、预览、旋转、确认、撤销、取消与控件命中通过`);
    await context.close();
  }
} finally {
  await browser.close();
}
