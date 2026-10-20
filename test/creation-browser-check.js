import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

// Runs in a fresh browser context, so the child's real save is never touched.
const url = process.env.GAME_TEST_URL || 'http://127.0.0.1:5179';
await mkdir('output', { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.PW_CHANNEL || undefined });
const check = (name, value) => { assert.ok(value, name); console.log(`✓ ${name}`); };
const panelIs = (page, type) => page.waitForFunction(t => __valley.panels.type() === t, type);
const snap = page => page.evaluate(() => JSON.parse(render_game_to_text()).creation);
const shot = async (page, path) => { await page.waitForTimeout(700); await page.screenshot({ path }); };

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|\/api\/creation/.test(m.text())) errors.push(m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__valley?.world);
  await page.evaluate(() => {
    __valley.start();
    __valley.game.mutate(s => { s.inventory.wood = 80; s.inventory.stone = 30; s.inventory.plank = 0; s.inventory.stick = 0; });
    const desk = __valley.world.targets.find(t => t.id === 'idea-desk');
    __valley.world.playerPosition.set(desk.position.x + 1, desk.position.y, desk.position.z + 1);
    __valley.world.stopWalking();
    __valley.interact(desk);
  });
  await panelIs(page, 'idea');
  check('河谷里的想法画板能打开', await page.locator('#idea-canvas').isVisible());

  await page.fill('#idea-title', '骑车');
  const box = await page.locator('#idea-canvas').boundingBox();
  await page.mouse.move(box.x + box.width * .2, box.y + box.height * .55);
  await page.mouse.down();
  for (let i = 0; i <= 12; i++) await page.mouse.move(box.x + box.width * (.2 + i * .05), box.y + box.height * (.55 - Math.sin(i / 12 * Math.PI) * .2));
  await page.mouse.up();
  await page.locator('[data-action="idea-stamp"][data-stamp="wheel"]').click();
  await page.mouse.click(box.x + box.width * .3, box.y + box.height * .7);
  await page.mouse.click(box.x + box.width * .7, box.y + box.height * .7);
  let s = await snap(page);
  check('画板记下一笔和两个轮子贴纸', s.idea.strokes === 1 && s.idea.stamps === 2);

  await page.locator('[data-action="idea-analyze"]').click();
  await page.waitForSelector('.proposal-card');
  s = await snap(page);
  check('本机马上认出“骑车”是机器', s.idea.local === 'assembly');
  const cardText = await page.locator('.proposal-card').first().innerText();
  check('拆出轮子/车体/方向盘/座椅/车灯', ['轮子', '车体', '方向盘', '座椅', '车灯'].every(w => cardText.includes(w)));
  check('列出 AI 补充的核心部件', cardText.includes('AI 补充的核心部件'));
  await page.waitForFunction(() => JSON.parse(render_game_to_text()).creation.idea.engine !== 'working', null, { timeout: 15000 });
  await shot(page, 'output/creation-idea.png');

  await page.locator('.proposal-card [data-action="idea-adopt"]').first().click();
  await panelIs(page, 'lab');
  await page.waitForSelector('#creation-canvas');
  check('连接示意图画出 12 个部件', await page.locator('.diagram-node').count() === 12);
  await shot(page, 'output/creation-lab-empty.png');

  for (let i = 0; i < 6 && await page.locator('[data-action="lab-process"]:not([disabled])').count(); i++) {
    await page.locator('[data-action="lab-process"]:not([disabled])').first().click();
  }
  const craft = page.locator('[data-action="lab-craft"]');
  check('材料加工后可以制作全部部件', !(await craft.isDisabled()));
  await craft.click();
  s = await snap(page);
  check('部件做好放进背包', s.parts === 12);

  await page.locator('[data-action="lab-auto"]').click();
  s = await snap(page);
  check('一键拼装装满 12 个位置', s.lab.filled === 12);
  await page.locator('[data-action="lab-experiment"][data-cap="roll"]').click();
  await page.waitForTimeout(1300);
  check('滚动实验成功', (await page.locator('.lab-result.ok').count()) === 1);
  await shot(page, 'output/creation-lab-roll.png');
  await page.locator('[data-action="lab-experiment"][data-cap="light"]').click();
  await page.waitForTimeout(500);
  await shot(page, 'output/creation-lab-light.png');

  const inventoryBefore = await page.evaluate(() => ({ ...__valley.game.state.inventory }));
  await page.locator('[data-action="lab-deploy"]').click();
  s = await snap(page);
  check('完整作品送到实验场', s.assemblies[0].status === 'world');
  await page.locator('.panel-footer [data-action="close"]').click();
  await page.evaluate(() => {
    const t = __valley.world.targets.find(x => x.type === 'creation');
    __valley.world.playerPosition.set(t.position.x + 1.5, t.position.y, t.position.z - 2.5);
    __valley.world.stopWalking();
    __valley.interact(t);
  });
  await page.waitForTimeout(1200);
  s = await snap(page);
  check('河谷里渲染出实验场作品', s.inWorld.some(e => e.kind === 'assembly'));
  await shot(page, 'output/creation-world-car.png');

  await page.evaluate(() => { const lab = __valley.world.targets.find(t => t.id === 'invention-lab'); __valley.world.playerPosition.set(lab.position.x + 1, lab.position.y, lab.position.z + 1); __valley.interact(lab); });
  await panelIs(page, 'lab');
  await page.locator('[data-action="lab-recall"]').click();
  await page.locator('[data-action="lab-disassemble"]').click();
  s = await snap(page);
  check('送回后拆开，部件回到背包', s.lab.filled === 0 && s.parts === 12);
  await page.locator('.diagram-node').first().click();
  s = await snap(page);
  check('点连接图圆圈装上第一个部件', s.lab.filled === 1);
  await page.locator('[data-action="lab-auto"]').click();
  const inventoryAfter = await page.evaluate(() => ({ ...__valley.game.state.inventory }));
  s = await snap(page);
  check('重新组装完整且不再花材料', s.lab.filled === 12 && JSON.stringify(inventoryBefore) === JSON.stringify(inventoryAfter));

  await page.locator('[data-action="lab-idea"]').click();
  await panelIs(page, 'idea');
  await page.locator('[data-action="idea-new"]').click().catch(() => {});
  await page.fill('#idea-title', '小猫');
  await page.locator('[data-action="idea-analyze"]').click();
  await page.waitForSelector('.proposal-card');
  s = await snap(page);
  check('“小猫”走造物分支', s.idea.local === 'figure');
  await page.locator('.proposal-card [data-action="idea-adopt"]').first().click();
  await panelIs(page, 'lab');
  await page.waitForTimeout(600);
  await shot(page, 'output/creation-lab-cat.png');
  await page.locator('.panel-footer [data-action="close"]').click();
  await page.evaluate(() => { __valley.world.playerPosition.set(-6, 0, 6); __valley.world.facing = 0; });
  await page.evaluate(() => { __valley.openPanel('inventory'); });
  await panelIs(page, 'inventory');
  await page.locator('.inventory-creations [data-action="figure-place"]').first().click();
  s = await snap(page);
  check('小猫从背包放到河谷', s.figures[0].placed && s.inWorld.some(e => e.kind === 'figure'));
  await page.locator('.panel-footer [data-action="close"]').click();
  await page.waitForTimeout(800);
  await shot(page, 'output/creation-world-cat.png');

  await page.reload();
  await page.waitForFunction(() => window.__valley?.world);
  s = await snap(page);
  check('刷新后作品和小猫都还在', s.assemblies.length === 1 && s.figures[0].placed);
  check('页面没有报错', errors.length === 0 || (console.log(errors), false));
  await context.close();
} finally {
  await browser.close();
}
