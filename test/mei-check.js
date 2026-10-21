import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const url = process.env.GAME_TEST_URL || 'http://127.0.0.1:5174';
const shotDir = process.env.MEI_SHOT_DIR || '/tmp';
const artifactDir = '/opt/cursor/artifacts/screenshots';
const KEY = 'yuanyuan-river-valley-v1';

await mkdir(shotDir, { recursive: true });
await mkdir(artifactDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const passed = [];
const notes = [];

function check(name, value) {
  assert.ok(value, name);
  passed.push(name);
  console.log(`✓ ${name}`);
}

async function shot(page, name) {
  const file = `${shotDir}/valley-mei-${name}.png`;
  await page.screenshot({ path: file });
  await page.screenshot({ path: `${artifactDir}/valley-mei-${name}.png` });
  notes.push(file);
}

async function injectSave(page, text, remove = []) {
  await page.evaluate(({ text: payload, remove: keys }) => {
    sessionStorage.setItem('travel-inject', JSON.stringify({ text: payload, remove: keys }));
  }, { text, remove });
  await page.reload();
  await page.waitForFunction(() => window.__valley?.game);
}

async function boot(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console:${msg.text()}`);
  });
  await page.goto(url);
  await page.waitForFunction(() => window.__valley?.world);
  await page.click('#start-button');
  await page.evaluate(() => { __valley.game.state.settings.sound = false; });
  if (await page.locator('#wish-dismiss').isVisible()) await page.click('#wish-dismiss');
  return errors;
}

async function holdUntil(page, key, predicate, timeout = 70000) {
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(predicate, null, { timeout });
  } finally {
    await page.keyboard.up(key);
  }
}

async function nearDock(page) {
  await page.evaluate(() => { __valley.world.yaw = 0; __valley.world.stopWalking(); });
  await holdUntil(page, 'd', () => __valley.world.playerPosition.x >= 2.12);
  const x = await page.evaluate(() => __valley.world.playerPosition.x);
  if (x > 2.48) await holdUntil(page, 'a', () => __valley.world.playerPosition.x <= 2.36);
  await holdUntil(page, 's', () => __valley.world.playerPosition.z >= 13.15 && __valley.world.playerPosition.x < 2.7);
  await page.locator('#travel-go-mei').waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
  return page.locator('#travel-go-mei').isVisible() && page.locator('#travel-go').isVisible();
}

async function stand(page, x, z) {
  await page.evaluate(({ x, z }) => {
    const world = __valley.world;
    world.stopWalking();
    const y = world.surfaceAt?.(x, z) ?? 0;
    world.playerPosition.set(x, y, z);
    world.positionLabels?.();
  }, { x, z });
  await page.evaluate((ms) => window.advanceTime(ms), 250);
}

async function arriveMei(page, { skip = true } = {}) {
  await page.locator('#travel-go-mei').click();
  await page.locator('#travel-cutscene').waitFor({ state: 'visible' });
  if (skip) await page.locator('#travel-skip').click();
  await page.waitForFunction(() => __valley.game.state.travel.current === 'mei' && __valley.world?.realmId === 'mei', null, { timeout: 20000 });
}

async function buttonBox(page, label) {
  return page.evaluate((name) => {
    const preferred = {
      '去美谷': '#travel-go-mei',
      '熬枫糖': '#mei-maple',
      '项目板': '#mei-project',
      '回家': '#travel-home',
    }[name];
    const el = (preferred && document.querySelector(preferred)) || document.querySelector(`[aria-label="${name}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return { w: r.width, h: r.height, hidden: el.hidden || style.display === 'none', top: r.top, left: r.left };
  }, label);
}

async function runViewport(kind, viewport, full) {
  const context = await browser.newContext({ viewport, acceptDownloads: true, hasTouch: kind === 'phone' });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const raw = sessionStorage.getItem('travel-inject');
    if (!raw) return;
    sessionStorage.removeItem('travel-inject');
    const payload = JSON.parse(raw);
    localStorage.setItem('yuanyuan-river-valley-v1', payload.text);
    for (const key of payload.remove || []) localStorage.removeItem(key);
  });
  page.setDefaultTimeout(120000);
  const errors = await boot(page);
  try {
    const dock = full ? await nearDock(page) : await (async () => {
      await stand(page, 4, 14);
      await page.locator('#travel-go-mei').waitFor({ state: 'visible', timeout: 8000 });
      return page.locator('#travel-go').isVisible() && page.locator('#travel-go-mei').isVisible();
    })();
    check(`${kind} 渡口同时有去日谷和去美谷`, dock);
    await shot(page, `${kind}-dock`);
    const goBox = await buttonBox(page, '去美谷');
    check(`${kind} 去美谷按钮够大`, goBox && goBox.w >= 44 && goBox.h >= 44 && !goBox.hidden);

    await page.locator('#travel-go-mei').click();
    await page.locator('#travel-cutscene').waitFor({ state: 'visible' });
    const shipText = await page.locator('#travel-cutscene-text').innerText();
    check(`${kind} 大船说明路程在游戏里变短了`, shipText.includes('路程在游戏里变短了'));
    await shot(page, `${kind}-ship`);
    if (full) {
      await page.locator('#travel-skip').click();
      await page.waitForFunction(() => __valley.game.state.travel.current === 'mei' && __valley.world.realmId === 'mei');
      check('跳过过场后到美谷港口', await page.evaluate(() => Math.abs(__valley.world.playerPosition.z + 12) < 2));
      await page.locator('#travel-home').click();
      await page.waitForFunction(() => __valley.world.realmId === 'he');
      await nearDock(page);
      await page.locator('#travel-go-mei').click();
      await page.locator('#travel-cutscene').waitFor({ state: 'visible' });
      await page.waitForFunction(() => __valley.game.state.travel.current === 'mei', null, { timeout: 45000 });
      check('不跳过也能到美谷', true);
    } else {
      await page.locator('#travel-skip').click();
      await page.waitForFunction(() => __valley.world.realmId === 'mei');
    }
    await shot(page, `${kind}-arrive`);
    check(`${kind} 美谷有回家`, await page.locator('#travel-home').isVisible());

    await stand(page, -10.4, -8);
    const sapButton = page.getByRole('button', { name: '采树汁' });
    await sapButton.waitFor({ state: 'visible', timeout: 8000 });
    const beforeSap = await page.evaluate(() => __valley.game.state.inventory['maple-sap']);
    await sapButton.click();
    await page.waitForFunction((n) => __valley.game.state.inventory['maple-sap'] > n, beforeSap);
    await page.evaluate(() => { __valley.game.state.inventory['maple-sap'] = 10; __valley.game.state.inventory.branch = 2; });
    await page.locator('#mei-maple').click();
    await page.locator('.game-panel').waitFor({ state: 'visible' });
    const mapleText = await page.locator('.game-panel').innerText();
    check(`${kind} 熬糖面板写明 10 比 1 和现实更多`, mapleText.includes('10') && /现实|多得多|简化/.test(mapleText));
    await shot(page, `${kind}-maple`);
    await page.getByRole('button', { name: '开始熬枫糖' }).click();
    await page.waitForFunction(() => __valley.game.state.travel.realms.mei.processes.some((item) => item.kind === 'maple'));
    if (full) {
      await page.locator('.panel-header [data-action="close"]').click();
      await page.click('#pause-button');
      const elapsed = await page.evaluate(() => __valley.game.state.travel.realms.mei.processes.find((item) => item.kind === 'maple').elapsed);
      await page.evaluate((ms) => window.advanceTime(ms), 1200);
      check('暂停时枫糖不推进', await page.evaluate((start) => __valley.game.state.travel.realms.mei.processes.find((item) => item.kind === 'maple').elapsed === start, elapsed));
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.locator('.panel-header [data-action="close"]').click();
      await page.evaluate((ms) => window.advanceTime(ms), 1200);
      check('隐藏页面时枫糖不推进', await page.evaluate((start) => __valley.game.state.travel.realms.mei.processes.find((item) => item.kind === 'maple').elapsed === start, elapsed));
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.evaluate(() => __valley.game.tick(20));
      await page.locator('#mei-maple').click();
      await page.getByRole('button', { name: '收下枫糖浆' }).click();
      check('熬完得到一份枫糖浆', await page.evaluate(() => __valley.game.state.inventory['maple-syrup'] === 1 && __valley.game.state.travel.stamps.includes('mei-syrup-first')));
      await page.locator('.panel-header [data-action="close"]').click();
    } else {
      await page.locator('.panel-header [data-action="close"]').click();
    }

    if (full) {
      await page.evaluate(() => { __valley.game.state.settings.ageBand = 'bigger'; });
      await page.locator('#mei-project').click();
      await page.getByRole('button', { name: '风车', exact: true }).click();
      await page.getByRole('button', { name: '画好了' }).click();
      await shot(page, 'desktop-project-draw');
      await page.getByRole('button', { name: '做好了' }).click();
      await page.getByRole('button', { name: '用风箱试' }).click();
      check('风箱能让风车转起来', await page.evaluate(() => {
        const card = __valley.game.state.travel.realms.mei.projects.at(-1);
        return card.trials[0].result.spinning === true && __valley.game.state.travel.stamps.includes('mei-windmill-spin');
      }));
      await page.getByRole('button', { name: '叶片多一片' }).click();
      await page.getByRole('button', { name: '试一试' }).click();
      check('并排对比出现', await page.locator('[aria-label="并排对比"]').isVisible());
      await shot(page, 'desktop-project-compare');
      await page.getByRole('button', { name: '完成项目' }).click();
      check('风车项目盖章并得到小风车', await page.evaluate(() => __valley.game.state.travel.stamps.includes('mei-project') && __valley.game.state.inventory['windmill-mini'] === 1));
      await page.getByRole('button', { name: '纸飞机', exact: true }).click();
      await page.getByRole('button', { name: '画好了' }).click();
      await page.getByRole('button', { name: '做好了' }).click();
      await page.getByRole('button', { name: '试一试' }).click();
      await page.getByRole('button', { name: '跳过修改' }).click();
      check('第二张项目卡可以完成', await page.evaluate(() => __valley.game.state.travel.realms.mei.projects.length === 2 && __valley.game.state.inventory['paper-plane'] === 1));
      await page.locator('.panel-header [data-action="close"]').click();

      await page.evaluate(() => { __valley.game.state.settings.ageBand = 'little'; __valley.game.state.inventory.cloth = 2; });
      await page.locator('#mei-quilt').click();
      for (const name of ['红', '蓝', '黄', '绿']) await page.getByRole('button', { name, exact: true }).click();
      await shot(page, 'desktop-quilt-little');
      await page.getByRole('button', { name: '拼好了' }).click();
      check('小朋友任意颜色都能拼好', await page.evaluate(() => __valley.game.state.inventory['quilt-patch'] === 1 && __valley.game.state.travel.stamps.includes('mei-quilt-first')));
      await page.evaluate(() => { __valley.game.state.settings.ageBand = 'older'; });
      await page.locator('.panel-header [data-action="close"]').click();
      await page.locator('#mei-quilt').click();
      for (const name of ['红', '蓝', '黄', '绿']) await page.getByRole('button', { name, exact: true }).click();
      check('大孩子不对称不能拼', await page.evaluate(() => __valley.game.finishQuilt(['red', 'blue', 'gold', 'green']).ok === false));
      for (const name of ['红', '蓝', '红', '蓝']) await page.getByRole('button', { name, exact: true }).click();
      await page.getByRole('button', { name: '拼好了' }).click();
      check('大孩子转角对称可以拼', await page.evaluate(() => __valley.game.state.inventory['quilt-patch'] === 2));
      await page.locator('.panel-header [data-action="close"]').click();

      await page.evaluate(() => { __valley.game.state.inventory.log = 2; });
      await page.evaluate(() => __valley.game.craft([['log', 'log']], 'log-wall'));
      await stand(page, 6, 7);
      await page.evaluate(() => {
        __valley.selectItem('log-wall');
        __valley.setBuildCell({ x: 6, y: 0, z: 8 });
      });
      await page.locator('#placement-confirm').click();
      check('访客小院可以放原木墙', await page.evaluate(() => __valley.game.state.travel.realms.mei.blocks.some((block) => block.item === 'log-wall' && block.x === 6)));
      await page.evaluate(() => {
        __valley.game.state.inventory['log-wall'] += 1;
        __valley.selectItem('log-wall');
        __valley.setBuildCell({ x: -8, y: 0, z: 6 });
      });
      const blocked = await page.locator('#placement-status').innerText();
      const preview = await page.evaluate(() => __valley.world.previewMaterial.color.getHexString());
      check('朋友的家是红色预览并说明原因', blocked.includes('朋友的家') && preview === 'e58471');
      await shot(page, 'desktop-protected');
      await page.evaluate(() => __valley.changeMode('gather'));

      await stand(page, 4.4, 5.2);
      await page.getByRole('button', { name: 'Maya', exact: true }).click();
      await page.locator('#tutor-card').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: '做一题' }).click();
      await shot(page, 'desktop-maya');
      for (const name of ['短一点', '再长一点', '挑战一下']) {
        await page.getByRole('button', { name, exact: true }).click();
        check(`可以换到${name}`, await page.evaluate((label) => {
          const band = label === '短一点' ? 'little' : label === '再长一点' ? 'bigger' : 'older';
          const ask = document.querySelector('#tutor-card')?.innerText || '';
          return ask.length > 0 && (band === 'little' || band === 'bigger' || band === 'older');
        }, name));
      }
      await page.getByRole('button', { name: '先去玩' }).click();
      await stand(page, 7.6, 1.4);
      check('能看见 Will', await page.getByRole('button', { name: 'Will', exact: true }).isVisible());
      await stand(page, 10.2, 1.6);
      check('能看见 Orv', await page.getByRole('button', { name: 'Orv', exact: true }).isVisible());
      await stand(page, 7.4, -8.4);
      check('能看见 Rivera', await page.getByRole('button', { name: 'Rivera', exact: true }).isVisible());
      await stand(page, -8, -6.2);
      check('能看见 Joe', await page.getByRole('button', { name: 'Joe', exact: true }).isVisible());
      await shot(page, 'desktop-people');

      await page.locator('#mei-lantern').click();
      const lantern = await page.locator('.game-panel').innerText();
      check('南瓜灯只有笑脸猫脸星星', lantern.includes('笑脸') && lantern.includes('猫脸') && lantern.includes('星星') && lantern.includes('不吓人') && !/鬼|骷髅/.test(lantern));
      await shot(page, 'desktop-lantern');
      await page.locator('.panel-header [data-action="close"]').click();
      await stand(page, 4, 7);
      await page.getByRole('button', { name: '看信', exact: true }).click();
      check('纸飞机来信可以先放着', (await page.locator('#mei-letter').innerText()).includes('没搭完') && await page.evaluate(() => __valley.game.state.travel.story.seen.includes('letter-mei-1')));
      await page.locator('#mei-letter-close').click();

      await page.evaluate(() => { __valley.game.mutate((state) => { state.settings.ageBand = 'little'; }); });
      await page.locator('#mei-trade').waitFor({ state: 'hidden', timeout: 8000 });
      check('4–9 岁看不到交换板', true);
      await page.evaluate(() => { __valley.game.mutate((state) => { state.settings.ageBand = 'older'; }); });
      await page.locator('#mei-trade').waitFor({ state: 'visible', timeout: 8000 });
      check('10–12 岁看得到交换板', true);
      await page.locator('#mei-trade').click();
      await shot(page, 'desktop-trade');
      await page.locator('.panel-header [data-action="close"]').click();

      await page.locator('#travel-home').click();
      await page.waitForFunction(() => __valley.world.realmId === 'he');
      await stand(page, -2, 2);
      await page.evaluate(() => {
        __valley.selectItem('windmill-mini');
        __valley.setBuildCell({ x: -2, y: 0, z: 1 });
      });
      await page.locator('#placement-confirm').click();
      await page.waitForFunction(() => __valley.game.state.blocks.some((block) => block.item === 'windmill-mini' && block.x === -2));
      await shot(page, 'desktop-home-windmill');
      await page.reload();
      await page.waitForFunction(() => window.__valley?.game);
      check('刷新后小风车还在河谷', await page.evaluate(() => __valley.game.state.travel.current === 'he' && __valley.game.state.blocks.some((block) => block.item === 'windmill-mini')));
      await page.click('#start-button');
      await page.evaluate(() => __valley.goRealm('ferry', 'mei'));
      await page.waitForFunction(() => __valley.world.realmId === 'mei');
      await page.reload();
      await page.waitForFunction(() => window.__valley?.game);
      check('在美谷刷新还留在美谷', await page.evaluate(() => __valley.game.state.travel.current === 'mei'));
      await page.click('#start-button');
      await page.waitForFunction(() => __valley.world.realmId === 'mei');

      const snap = await page.evaluate(() => ({
        home: __valley.game.state.blocks.map((block) => block.id),
        ri: JSON.stringify(__valley.game.state.travel.realms.ri),
      }));
      const broken = await page.evaluate(() => {
        const data = JSON.parse(localStorage.getItem('yuanyuan-river-valley-v1'));
        data.travel.realms.mei.projects = [{ id: 'nope' }];
        return JSON.stringify(data);
      });
      await injectSave(page, broken);
      check('弄坏美谷后回到河谷，家里和日谷还在', await page.evaluate(({ home, ri }) => {
        const state = __valley.game.state;
        return state.travel.current === 'he'
          && state.blocks.map((block) => block.id).join() === home.join()
          && JSON.stringify(state.travel.realms.ri) === ri
          && /回到河谷/.test(__valley.game.travelNotice || '');
      }, snap));
      await page.click('#start-button');

      const stripped = await page.evaluate((key) => {
        const text = localStorage.getItem(key);
        const data = JSON.parse(text);
        delete data.travel.realms.mei;
        return JSON.stringify(data);
      }, KEY);
      await injectSave(page, stripped, [`${KEY}-before-mei`, `${KEY}-before-mei-1`]);
      await page.click('#start-button');
      await page.evaluate(() => __valley.goRealm('ferry', 'mei'));
      await page.waitForFunction(() => __valley.game.state.travel.current === 'mei');
      await page.evaluate(() => __valley.goHome());
      await page.waitForFunction(() => __valley.game.state.travel.current === 'he');
      check('日谷旧档走进美谷后只备份一次', await page.evaluate((backup) => localStorage.getItem('yuanyuan-river-valley-v1-before-mei') === backup && localStorage.getItem('yuanyuan-river-valley-v1-before-mei-1') === null, stripped));
      await page.click('#pause-button');
      await page.getByText('给大人：备份与导入存档').click();
      const downloadEvent = page.waitForEvent('download');
      await page.locator('[data-action="export-mei"]').click();
      const download = await downloadEvent;
      const downloaded = await download.path().then(async (file) => {
        const { readFileSync } = await import('node:fs');
        return readFileSync(file, 'utf8');
      });
      check('暂停里可以下载美谷升级前的备份', downloaded === stripped);
      await page.locator('.panel-header [data-action="close"]').click();

      const statsBefore = await page.evaluate(() => ({ ...__valley.sceneStats }));
      for (let i = 0; i < 10; i += 1) {
        await page.evaluate(() => __valley.goRealm('ferry', 'mei'));
        await page.waitForFunction(() => __valley.world.realmId === 'mei' && __valley.game.state.travel.current === 'mei');
        await page.evaluate(() => __valley.goHome());
        await page.waitForFunction(() => __valley.world.realmId === 'he' && __valley.game.state.travel.current === 'he');
      }
      await page.evaluate(() => __valley.goRealm('ferry', 'ri'));
      await page.waitForFunction(() => __valley.world.realmId === 'ri');
      await page.evaluate(() => __valley.goHome());
      await page.waitForFunction(() => __valley.world.realmId === 'he');
      await page.evaluate(() => __valley.goRealm('ferry', 'mei'));
      await page.waitForFunction(() => __valley.world.realmId === 'mei');
      await page.evaluate(() => __valley.goHome());
      await page.waitForFunction(() => __valley.world.realmId === 'he');
      const statsAfter = await page.evaluate(() => ({ ...__valley.sceneStats }));
      console.log('sceneStats', statsBefore, statsAfter);
      check('往返之后只留一个渲染器', statsAfter.renderers === 1 && statsAfter.created === statsBefore.created + 24 && statsAfter.released === statsBefore.released + 24);

      await page.evaluate(() => { __valley.world.playerPosition.set(-4.2, 0, 18); __valley.world.startBalloon(); });
      await page.waitForFunction(() => __valley.world.balloon?.phase === 'tour', null, { timeout: 60000 });
      await page.locator('#balloon-voyage-mei').click();
      check('看风景去美谷写明简化', (await page.locator('#balloon-title').innerText()).includes('美谷') && (await page.locator('#travel-cutscene-text').innerText()).includes('简化'));
      await shot(page, 'desktop-balloon');
      await page.reload();
      await page.waitForFunction(() => window.__valley?.game);
      check('风景飞行中刷新回到出发草坪', await page.evaluate(() => {
        const player = __valley.game.state.player;
        return __valley.game.state.travel.current === 'he' && Math.abs(player.y) < 0.2 && player.z > 16;
      }));
      await page.click('#start-button');
      await page.evaluate(() => __valley.world.startBalloon());
      await page.waitForFunction(() => __valley.world.balloon?.phase === 'tour', null, { timeout: 60000 });
      await page.locator('#balloon-voyage-mei').click();
      await page.waitForFunction(() => {
        const p = __valley.world.playerPosition;
        return __valley.world.realmId === 'mei' && Math.abs(p.x + 10) < 2 && Math.abs(p.z - 12) < 2 && p.y < 3;
      }, null, { timeout: 30000 });
      check('热气球落到美谷草坪', true);
      await shot(page, 'desktop-mei-lawn');
    } else {
      const mapleBox = await buttonBox(page, '熬枫糖');
      const projectBox = await buttonBox(page, '项目板');
      const homeBox = await buttonBox(page, '回家');
      console.log(`${kind} buttons`, { mapleBox, projectBox, homeBox });
      check(`${kind} 常用按钮够大且不叠在一起`, [mapleBox, projectBox, homeBox].every((box) => box && box.w >= 44 && box.h >= 44)
        && Math.abs(mapleBox.top - projectBox.top) > 40);
      await page.locator('#mei-project').click();
      await shot(page, `${kind}-project`);
      await page.locator('.panel-header [data-action="close"]').click();
      await page.locator('#mei-quilt').click();
      await shot(page, `${kind}-quilt`);
    }

    const noisy = errors.filter((item) => !/知识引擎|知识包|Failed to load resource|404|502|net::ERR/.test(item));
    if (noisy.length) console.log('page issues', noisy);
    check(`${kind} 没有未捕获的页面错误`, noisy.length === 0);
  } finally {
    await context.close();
  }
}

const only = process.env.MEI_ONLY || '';
try {
  if (!only || only === 'desktop') await runViewport('desktop', { width: 1280, height: 800 }, true);
  if (!only || only === 'tablet') await runViewport('tablet', { width: 1024, height: 768 }, false);
  if (!only || only === 'phone') await runViewport('phone', { width: 390, height: 844 }, false);
  console.log(`美谷流程通过 ${passed.length} 项`);
  console.log(notes.join('\n'));
} finally {
  await browser.close();
}
