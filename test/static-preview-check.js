/** Browser check for the GitHub Pages static preview and the default backend build. */

import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const url = process.env.PREVIEW_URL || 'http://127.0.0.1:4173/3dplay/';
const mode = process.env.PREVIEW_MODE === 'live' ? 'live' : 'static';
const shotDir = '/opt/cursor/artifacts/screenshots';
await mkdir(shotDir, { recursive: true });
await mkdir('/opt/cursor/artifacts', { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const requests = [];
const badResponses = [];
const consoleMessages = [];
const dialogs = [];

page.on('request', (request) => requests.push({ url: request.url(), method: request.method() }));
page.on('response', (response) => {
  if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() });
});
page.on('requestfailed', (request) => {
  badResponses.push({ url: request.url(), status: 0, error: request.failure()?.errorText || 'failed' });
});
page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
page.on('pageerror', (error) => consoleMessages.push({ type: 'pageerror', text: error.message }));
page.on('dialog', async (dialog) => {
  dialogs.push(dialog.message());
  await dialog.dismiss();
});

function backendPath(raw) {
  try {
    const path = new URL(raw).pathname.replace(/\/$/, '');
    return path === '/api' || path.startsWith('/api/') || path === '/account' || path.startsWith('/account/');
  } catch {
    return false;
  }
}

const check = (name, value) => {
  assert.ok(value, name);
  console.log(`✓ ${name}`);
};

function stand(x, z) {
  return page.evaluate(({ x, z }) => {
    const world = __valley.world;
    world.stopWalking();
    world.playerPosition.set(x, world.surfaceAt?.(x, z) ?? 0, z);
    world.positionLabels?.();
  }, { x, z });
}

async function pump(seconds) {
  const steps = Math.ceil(seconds / 0.05);
  await page.evaluate((count) => {
    for (let i = 0; i < count; i += 1) __valley.step(0.05);
  }, steps);
}

async function waitRealm(realm) {
  await page.waitForFunction((id) => __valley.game.state.travel.current === id && __valley.world?.realmId === id, realm, { timeout: 20000 });
}

async function skipIfShown(selector) {
  const button = page.locator(selector);
  if (await button.isVisible().catch(() => false)) await button.click();
}

async function finishScenic(realm, skip = '#travel-skip') {
  for (let i = 0; i < 50; i += 1) {
    const there = await page.evaluate((id) => __valley.game.state.travel.current === id && __valley.world?.realmId === id, realm);
    if (there) return;
    await skipIfShown(skip);
    await pump(0.15);
  }
  await waitRealm(realm);
}

async function ferry(button, realm) {
  await stand(4, 14);
  await page.locator(button).waitFor({ state: 'visible', timeout: 8000 });
  await page.locator(button).click();
  await page.locator('#travel-skip').waitFor({ state: 'visible' });
  await page.locator('#travel-skip').click();
  await waitRealm(realm);
}

async function rideBalloon() {
  await page.evaluate(() => { __valley.world.select?.(null); });
  await stand(-4.2, 20.2);
  await page.waitForFunction(() => (document.querySelector('#action-name')?.textContent || '').includes('热气球'), null, { timeout: 8000 });
  await page.click('#action-button');
  for (let i = 0; i < 30; i += 1) {
    const phase = await page.evaluate(() => __valley.world.balloon?.phase || '');
    if (phase === 'tour') return;
    await pump(0.2);
  }
  throw new Error('热气球没有进入游览');
}

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__valley?.world, null, { timeout: 60000 });
  if (mode === 'live') {
    await page.waitForTimeout(1200);
    const urls = requests.map((item) => item.url);
    check('默认构建会请求 /api/auth/me', urls.some((item) => item.includes('/api/auth/me')));
    check('默认构建会请求 /api/knowledge/tutors', urls.some((item) => item.includes('/api/knowledge/tutors')));
    const report = { mode, url, requests, badResponses, consoleMessages, dialogs };
    await writeFile('/opt/cursor/artifacts/static-preview-live.json', JSON.stringify(report, null, 2));
    console.log('LIVE BACKEND REQUESTS', urls.filter((item) => backendPath(item)));
    console.log('STATIC PREVIEW CHECK PASS', mode, url);
  } else {
    const chip = page.locator('#account-chip');
    await page.waitForFunction(() => document.querySelector('#account-label')?.textContent === '本地游玩');
    check('登录入口显示本地游玩', (await page.locator('#account-label').innerText()) === '本地游玩');
    check('本地游玩没有账号链接', await chip.evaluate((el) => !el.getAttribute('href') && !el.getAttribute('target')));
    check('页面上没有 /account 链接', await page.evaluate(() => [...document.querySelectorAll('a')].every((el) => !String(el.getAttribute('href') || '').includes('/account'))));
    await page.screenshot({ path: `${shotDir}/static-preview-local-play.png` });

    await page.click('#start-button');
    if (await page.locator('#wish-dismiss').isVisible()) await page.click('#wish-dismiss');
    await page.evaluate(() => { __valley.game.state.settings.sound = false; });
    const bootText = await page.locator('#toast-root').innerText();
    check('开局没有报错提示', !/错误|失败|连不上|没取到|损坏|未能/.test(bootText));

    await page.click('#pause-button');
    await page.locator('#modal-root').waitFor({ state: 'visible' });
    const pauseText = await page.locator('#modal-root').innerText();
    check('暂停说明是本地游玩', pauseText.includes('本地游玩'));
    check('暂停里没有去登录的入口', !/登录/.test(pauseText) && !pauseText.includes('/account'));
    await page.getByRole('button', { name: '继续玩' }).click();
    await page.locator('#modal-root').waitFor({ state: 'hidden' });

    await ferry('#travel-go', 'ri');
    check('渡口到日谷', true);
    await page.screenshot({ path: `${shotDir}/static-preview-ri.png` });
    await page.click('#travel-home');
    await waitRealm('he');
    check('从日谷回家', true);

    await ferry('#travel-go-mei', 'mei');
    check('渡口到美谷', true);
    await page.screenshot({ path: `${shotDir}/static-preview-mei.png` });
    await page.click('#travel-home');
    await waitRealm('he');
    check('从美谷回家', true);

    await rideBalloon();
    const look = await page.evaluate(() => {
      const info = __valley.world.balloonLook();
      const canvas = document.querySelector('#minimap');
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let ink = 0;
      for (let i = 3; i < data.length; i += 16) if (data[i] > 10) ink += 1;
      return {
        title: info.title,
        note: info.note,
        phase: info.phase,
        y: __valley.world.playerPosition.y,
        mapLabel: canvas.getAttribute('aria-label') || '',
        ink,
        hud: document.querySelector('#balloon-hud')?.hidden === false,
      };
    });
    check('热气球远眺能看见河谷', look.hud && look.y > 8 && /看|地图|河谷/.test(`${look.title}${look.note}`));
    check('地图已经画出来', look.ink > 20 && look.mapLabel.includes('地图'));
    await page.screenshot({ path: `${shotDir}/static-preview-lookout-map.png` });

    const before = look.y;
    await page.locator('#balloon-up').dispatchEvent('pointerdown');
    await pump(2);
    await page.locator('#balloon-up').dispatchEvent('pointerup');
    const higher = await page.evaluate(() => __valley.world.playerPosition.y);
    check('升高以后看得更远', higher > before + 2);
    await page.screenshot({ path: `${shotDir}/static-preview-higher.png` });

    await page.locator('#balloon-land').click();
    for (let i = 0; i < 40; i += 1) {
      const riding = await page.evaluate(() => Boolean(__valley.world.balloon));
      if (!riding) break;
      await pump(0.2);
    }
    check('远眺后可以降落', await page.evaluate(() => !__valley.world.balloon && (__valley.game.state.travel?.current || 'he') === 'he'));

    await rideBalloon();
    await page.locator('#balloon-voyage').click();
    await finishScenic('ri');
    check('看风景可以到日谷', true);
    await page.click('#travel-home');
    await waitRealm('he');

    await rideBalloon();
    await page.locator('#balloon-voyage-mei').click();
    await finishScenic('mei');
    check('看风景可以到美谷', true);
    await page.click('#travel-home');
    await waitRealm('he');

    await rideBalloon();
    await page.locator('#balloon-stars').click();
    await finishScenic('xing', '#star-skip');
    check('飞向星星可以到外星谷', true);
    await page.screenshot({ path: `${shotDir}/static-preview-xing.png` });
    for (let i = 0; i < 40; i += 1) {
      const riding = await page.evaluate(() => Boolean(__valley.world.balloon));
      if (!riding) break;
      await pump(0.2);
    }
    await page.locator('#balloon-return').click();
    await finishScenic('he', '#star-skip');
    check('从外星谷坐热气球回家', true);

    await page.waitForTimeout(1000);
    const backend = requests.filter((item) => backendPath(item.url));
    const failedLoads = consoleMessages.filter((item) => /Failed to load resource|404|502|net::ERR/i.test(item.text));
    check('没有向 /api 或 /account 发请求', backend.length === 0);
    check('没有 4xx 或 5xx', badResponses.length === 0);
    check('控制台没有加载失败', failedLoads.length === 0);
    check('没有弹出对话框', dialogs.length === 0);
    const later = await page.locator('#toast-root').innerText();
    check('流程里没有报错提示', !/错误|失败|连不上|没取到|损坏|未能/.test(later));
    const report = {
      mode,
      url,
      backend,
      badResponses,
      failedLoads,
      dialogs,
      requestCount: requests.length,
      requests: requests.map((item) => item.url),
    };
    await writeFile('/opt/cursor/artifacts/static-preview-static.json', JSON.stringify(report, null, 2));
    console.log('STATIC REQUESTS', report.requestCount);
    console.log('STATIC PREVIEW CHECK PASS', mode, url);
  }
} finally {
  await browser.close();
}
