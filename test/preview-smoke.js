import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const url = process.env.PREVIEW_URL || 'http://127.0.0.1:4173/3dplay/';
const shotDir = '/opt/cursor/artifacts/screenshots';
await mkdir(shotDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const pageErrors = [];
const dialogs = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('dialog', async (dialog) => {
  dialogs.push(dialog.message());
  await dialog.dismiss();
});

const check = (name, value) => {
  assert.ok(value, name);
  console.log(`✓ ${name}`);
};

function stand(page, x, z) {
  return page.evaluate(({ x, z }) => {
    const world = __valley.world;
    world.stopWalking();
    world.playerPosition.set(x, world.surfaceAt?.(x, z) ?? 0, z);
    world.positionLabels?.();
  }, { x, z });
}

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__valley?.world, null, { timeout: 60000 });
  check('欢迎页能打开', await page.locator('#start-button').isVisible());
  check('没有三维失败提示', await page.locator('#webgl-fallback').isHidden());
  await page.screenshot({ path: `${shotDir}/preview-welcome.png` });

  await page.click('#start-button');
  if (await page.locator('#wish-dismiss').isVisible()) await page.click('#wish-dismiss');
  await page.evaluate(() => { __valley.game.state.settings.sound = false; });
  const bootText = await page.locator('#toast-root').innerText();
  check('开局没有报错提示', !/错误|失败|连不上|没取到|损坏|未能/.test(bootText));
  check('账号入口不跳到不存在的登录页', await page.locator('#account-chip').evaluate((el) => !el.getAttribute('href')));
  check('进度记在本机', await page.evaluate(() => {
    const text = localStorage.getItem('yuanyuan-river-valley-v1') || '';
    return text.includes('"version": 1') && !text.includes('/api/');
  }));

  await stand(page, 4, 14);
  await page.locator('#travel-go').waitFor({ state: 'visible', timeout: 8000 });
  await page.screenshot({ path: `${shotDir}/preview-dock.png` });
  await page.click('#travel-go');
  await page.locator('#travel-skip').waitFor({ state: 'visible' });
  await page.locator('#travel-skip').click();
  await page.waitForFunction(() => __valley.game.state.travel.current === 'ri' && __valley.world.realmId === 'ri', null, { timeout: 30000 });
  check('渡口可以到日谷', true);
  check('日谷有回家按钮', await page.locator('#travel-home').isVisible());
  const place = await page.evaluate(() => __valley.world.targets.map((item) => item.name));
  check('日谷有小春、纸坊和合掌大屋', ['小春', '纸坊', '合掌大屋'].every((name) => place.includes(name)));
  await page.screenshot({ path: `${shotDir}/preview-ri.png` });

  await stand(page, -6.2, -2.2);
  const koharu = page.getByRole('button', { name: '小春' });
  await koharu.waitFor({ state: 'visible', timeout: 8000 });
  await koharu.click();
  await page.locator('#tutor-card').waitFor({ state: 'visible' });
  const talk = await page.locator('#tutor-card').innerText();
  check('第一次见面先是看一看，不是答题', talk.includes('看一看') && !talk.includes('点一个白天的图'));
  await page.getByRole('button', { name: '看一看' }).click();
  await page.getByRole('button', { name: '下一句' }).click();
  await page.waitForFunction(() => document.querySelector('#tutor-card')?.innerText.includes('こんにちは'));
  check('看一看能读到こんにちは', true);
  await page.screenshot({ path: `${shotDir}/preview-learn.png` });
  await page.getByRole('button', { name: '先去玩' }).click();
  await page.locator('#tutor-card').waitFor({ state: 'hidden' });

  await stand(page, -12, -9);
  const grove = page.getByRole('button', { name: '楮树林' });
  await grove.waitFor({ state: 'visible', timeout: 8000 });
  await grove.click();
  await page.waitForFunction(() => (__valley.game.state.inventory.kozo || 0) >= 2, null, { timeout: 20000 });
  check('楮皮不用答题就能采到', true);

  await stand(page, -8, -6);
  await page.click('#ri-washi');
  await page.waitForFunction(() => document.body.innerText.includes('剥皮蒸煮'));
  await page.evaluate(() => { for (let i = 0; i < 25; i += 1) __valley.game.tick(1); });
  const claim = page.locator('[data-action="washi-claim"]');
  await claim.waitFor({ state: 'visible', timeout: 8000 });
  await claim.click();
  await page.waitForFunction(() => (__valley.game.state.inventory.washi || 0) >= 1);
  check('和纸可以做完并收下', true);
  await page.screenshot({ path: `${shotDir}/preview-washi.png` });
  const panelClose = page.locator('.panel-header [data-action="close"]');
  if (await panelClose.isVisible()) await panelClose.click();

  await page.click('#travel-home');
  await page.waitForFunction(() => __valley.game.state.travel.current === 'he' && __valley.world.realmId === 'he', null, { timeout: 30000 });
  check('可以从日谷回家', true);
  check('回家后和纸还在背包', await page.evaluate(() => (__valley.game.state.inventory.washi || 0) >= 1));
  await page.screenshot({ path: `${shotDir}/preview-home.png` });

  const later = await page.locator('#toast-root').innerText();
  check('流程里没有报错提示', !/错误|失败|连不上|没取到|损坏|未能/.test(later));
  check('没有弹出对话框', dialogs.length === 0);
  check('没有未捕获的页面错误', pageErrors.length === 0);
  console.log('PREVIEW SMOKE PASS', url);
} finally {
  await browser.close();
}
