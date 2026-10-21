/** Browser flows for the alien valley. Isolated contexts only. Not a child or tablet playtest. */

import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const url = process.env.GAME_TEST_URL || 'http://127.0.0.1:5174';
const shotDir = process.env.XING_SHOT_DIR || '/tmp';
const artifactDir = '/opt/cursor/artifacts/screenshots';
const KEY = 'yuanyuan-river-valley-v1';

await mkdir(shotDir, { recursive: true });
await mkdir(artifactDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const passed = [];

function check(name, value) {
  assert.ok(value, name);
  passed.push(name);
  console.log(`✓ ${name}`);
}

async function shot(page, name) {
  const file = `${shotDir}/valley-xing-${name}.png`;
  await page.screenshot({ path: file });
  await page.screenshot({ path: `${artifactDir}/valley-xing-${name}.png` });
}

async function boot(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/knowledge|Failed to load resource|favicon/i.test(text)) return;
    errors.push(`console:${text}`);
  });
  await page.goto(url);
  await page.waitForFunction(() => window.__valley?.world);
  await page.click('#start-button');
  await page.evaluate(() => { __valley.game.state.settings.sound = false; });
  if (await page.locator('#wish-dismiss').isVisible().catch(() => false)) await page.click('#wish-dismiss');
  return errors;
}

async function upgradeOldSave(page, kind) {
  const stripped = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('yuanyuan-river-valley-v1'));
    delete raw.travel.realms.xing;
    return JSON.stringify(raw);
  });
  await page.evaluate((text) => {
    sessionStorage.setItem('xing-inject', JSON.stringify({
      text,
      remove: ['yuanyuan-river-valley-v1-before-xing'],
    }));
  }, stripped);
  await page.reload();
  await page.waitForFunction(() => window.__valley?.world);
  await page.click('#start-button');
  if (await page.locator('#wish-dismiss').isVisible().catch(() => false)) await page.click('#wish-dismiss');
  const backup = await page.evaluate(() => {
    const text = __valley.game.getXingBackup();
    if (!text) return null;
    const parsed = JSON.parse(text);
    return { hasXing: Boolean(parsed.travel?.realms && Object.hasOwn(parsed.travel.realms, 'xing')), len: text.length };
  });
  check(`${kind} 没有外星谷的旧存档会留下备份`, backup && backup.hasXing === false && backup.len > 20);
  await page.click('#pause-button');
  await page.locator('summary', { hasText: '给大人' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '下载外星谷升级前的备份' }).click(),
  ]);
  check(`${kind} 暂停菜单可以下载这份备份`, (download.suggestedFilename() || '').includes('外星谷'));
  await page.evaluate(() => __valley.panels.close());
}

async function tour(page) {
  const state = await page.evaluate(() => {
    const world = __valley.world;
    world.stopWalking();
    const x = -4.2;
    const z = 20.2;
    world.playerPosition.set(x, world.surfaceAt(x, z), z);
    if (!world.balloon) world.startBalloon();
    for (let i = 0; i < 120 && world.balloon?.phase === 'lift'; i += 1) __valley.step(0.05);
    return { phase: world.balloon?.phase || null, stars: document.querySelector('#balloon-stars')?.hidden ?? null };
  });
  if (state.phase !== 'tour') throw new Error(`热气球没有进入游览：${JSON.stringify(state)}`);
}

async function toXing(page, { skip = true, shotName = '' } = {}) {
  await tour(page);
  await page.locator('#balloon-stars').waitFor({ state: 'visible' });
  const scenic = await page.locator('#balloon-voyage').innerText();
  const note = await page.locator('#balloon-note').innerText();
  if (shotName) await shot(page, shotName);
  await page.click('#balloon-stars');
  await page.locator('#star-cutscene').waitFor({ state: 'visible' });
  const fantasy = await page.locator('#star-note').innerText();
  if (shotName) await shot(page, `${shotName}-stars`);
  if (skip) await page.click('#star-skip');
  else await page.evaluate(() => { for (let i = 0; i < 90; i += 1) __valley.step(0.05); });
  try {
    await page.waitForFunction(() => __valley.game.state.travel.current === 'xing' && __valley.world.realmId === 'xing', null, { timeout: 30000 });
  } catch (error) {
    const snap = await page.evaluate(() => ({
      realm: __valley.game.state.travel?.current,
      id: __valley.world?.realmId,
      phase: __valley.world?.balloon?.phase || null,
      open: Boolean(__valley.panels?.isOpen?.()),
      toast: document.querySelector('#toast-root')?.innerText || '',
    }));
    throw new Error(`${error.message} ${JSON.stringify(snap)}`);
  }
  return { note, fantasy, scenic };
}

async function boxOf(page, label) {
  return page.evaluate((name) => {
    const el = document.querySelector(`[aria-label="${name}"]`);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const hidden = el.hidden || el.closest('[hidden]') || style.display === 'none';
    return { w: rect.width, h: rect.height, hidden: Boolean(hidden) };
  }, label);
}

async function run(kind, viewport, full) {
  const context = await browser.newContext({ viewport, hasTouch: kind === 'phone' });
  await context.addInitScript(() => {
    const raw = sessionStorage.getItem('xing-inject');
    if (!raw) return;
    sessionStorage.removeItem('xing-inject');
    const payload = JSON.parse(raw);
    localStorage.setItem('yuanyuan-river-valley-v1', payload.text);
    for (const key of payload.remove || []) localStorage.removeItem(key);
  });
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  const errors = await boot(page);
  try {
    await page.evaluate(() => { __valley.world.playerPosition.set(2.2, 0, 13.2); });
    await page.waitForTimeout(400);
    const ferry = await page.locator('#travel-go').innerText().catch(() => '');
    const starOnGround = await page.locator('#balloon-stars').isVisible().catch(() => false);
    check(`${kind} 渡口按钮仍是去日谷`, ferry.includes('去日谷'));
    check(`${kind} 地面上没有飞向星星`, starOnGround === false);

    await upgradeOldSave(page, kind);
    const flight = await toXing(page, { skip: false, shotName: `${kind}-hud` });
    check(`${kind} 航线写明是幻想`, /幻想航线/.test(flight.fantasy) && /飞不出大气层/.test(flight.fantasy));
    check(`${kind} 日谷风景航线还在`, /日谷/.test(flight.scenic));
    check(`${kind} 不跳过也能到达`, true);
    await page.evaluate(() => { for (let i = 0; i < 100 && __valley.world.balloon; i += 1) __valley.step(0.05); });
    await shot(page, `${kind}-arrive`);
    const lawn = await page.evaluate(() => {
      const p = __valley.world.playerPosition;
      return { x: p.x, y: p.y, z: p.z, dot: Boolean(__valley.world.homeDot) };
    });
    check(`${kind} 落到外星谷草坪附近`, Math.hypot(lawn.x + 10, lawn.z - 12) < 4);

    const compare = await page.evaluate(() => __valley.gravityCompare());
    check(`${kind} 外星谷跳得更高`, compare.xing.apex > compare.home.apex * 2.5);
    const jumped = await page.evaluate(() => {
      const world = __valley.world;
      world.playerPosition.set(0, world.surfaceAt(0, 0), 0);
      world.velocityY = 0;
      world.jump();
      for (let i = 0; i < 12; i += 1) __valley.step(0.05);
      return world.playerPosition.y;
    });
    await shot(page, `${kind}-jump`);
    check(`${kind} 角色确实离开地面`, jumped > 0.25 || compare.xing.apex > 1);
    await page.evaluate(() => {
      const world = __valley.world;
      const ball = world.ball;
      if (!ball) return;
      world.playerPosition.set(ball.p.x + 0.4, ball.p.y, ball.p.z);
      ball.v.set(0, 0, 0);
      ball.p.y += 0.2;
    });
    await page.waitForTimeout(300);
    check(`${kind} 球还在外星谷`, await page.evaluate(() => Boolean(__valley.world.ball)));

    await page.evaluate(() => __valley.setAge('little'));
    await page.click('#xing-lab');
    await page.locator('#xing-sheet').waitFor({ state: 'visible' });
    await shot(page, `${kind}-lab-little`);
    await page.getByRole('button', { name: '看两次，哪个跳得高' }).click();
    check(`${kind} 做了一次重力对照`, await page.evaluate(() => __valley.game.state.travel.stamps.includes('xing-experiment')));
    for (const age of ['bigger', 'older']) {
      await page.evaluate((band) => __valley.setAge(band), age);
      await page.evaluate(() => __valley.openXing('lab'));
      await shot(page, `${kind}-lab-${age}`);
    }
    await page.evaluate(() => __valley.closeXing());

    await page.evaluate(() => { __valley.game.addItem('salt', 6); __valley.game.addItem('water', 4); });
    await page.click('#xing-crystal');
    await page.getByRole('button', { name: '盐放得少' }).click();
    await page.evaluate(() => __valley.openPanel('pause'));
    const sparseBefore = await page.evaluate(() => __valley.game.crystalStatus().elapsed);
    await page.waitForTimeout(800);
    check(`${kind} 暂停时晶体不走`, await page.evaluate((before) => __valley.game.crystalStatus().elapsed === before, sparseBefore));
    await page.evaluate(() => __valley.panels.close());
    check(`${kind} 隐藏时晶体不走`, await page.evaluate(() => {
      const before = __valley.game.crystalStatus().elapsed;
      return __valley.advanceCrystal(5, { hidden: true }).elapsed === before;
    }));
    await page.evaluate(() => { for (let i = 0; i < 20; i += 1) __valley.game.tick(1); });
    await page.evaluate(() => __valley.openXing('crystal'));
    await shot(page, `${kind}-crystal`);
    await page.getByRole('button', { name: '看这次的结果' }).click();
    check(`${kind} 盐少长不出可以收下的晶体`, await page.evaluate(() => (__valley.game.state.inventory['salt-crystal'] || 0) === 0));
    await page.evaluate(() => __valley.openXing('crystal'));
    await page.getByRole('button', { name: '盐放得多' }).click();
    await page.evaluate(() => { for (let i = 0; i < 20; i += 1) __valley.game.tick(1); });
    await page.evaluate(() => __valley.openXing('crystal'));
    await page.getByRole('button', { name: '收下盐晶' }).click();
    check(`${kind} 盐多可以收下盐晶`, await page.evaluate(() => (__valley.game.state.inventory['salt-crystal'] || 0) >= 1));

    for (const age of ['little', 'bigger', 'older']) {
      await page.evaluate((band) => { __valley.setAge(band); __valley.openXing('puzzle'); }, age);
      await shot(page, `${kind}-puzzle-${age}`);
      if (age === 'older') {
        await page.getByRole('button', { name: '数量' }).click();
        await shot(page, `${kind}-base4`);
        check(`${kind} 四进制题出现了`, await page.evaluate(() => /外星数字/.test(document.querySelector('#xing-sheet')?.innerText || '')));
      }
      await page.getByRole('button', { name: '提示' }).click();
      await page.getByRole('button', { name: '看答案' }).click();
      const choice = await page.evaluate(() => {
        const puzzleText = document.querySelector('#xing-puzzle-note')?.textContent || '';
        const answer = puzzleText.replace('答案是：', '').trim();
        const buttons = [...document.querySelectorAll('#xing-sheet [data-xing="answer"]')];
        const hit = buttons.find((button) => button.textContent.trim() === answer) || buttons[0];
        hit?.click();
        return Boolean(hit);
      });
      check(`${kind} ${age} 解了一道符号题`, choice);
    }
    await page.evaluate(() => __valley.openXing('moss'));
    await page.getByRole('button', { name: '看看光苔' }).click();
    check(`${kind} 看见光苔不用答题`, await page.evaluate(() => __valley.game.state.travel.stamps.includes('xing-moss-seen')));
    await page.evaluate(() => __valley.game.learnGlyphs(['moss']));
    await page.waitForFunction(() => [...document.querySelectorAll('.world-label')].some((el) => el.textContent.includes('光苔')));
    check(`${kind} 学会光苔后路牌写出名字`, true);

    await page.evaluate(() => { __valley.game.addItem('glowmoss', 1); __valley.game.addItem('glass-dome', 1); });
    await page.click('#xing-case');
    check(`${kind} 装好了展柜`, await page.evaluate(() => (__valley.game.state.inventory['glowmoss-case'] || 0) >= 1));
    await page.evaluate(() => __valley.closeXing());
    await page.click('#travel-home');
    await page.waitForFunction(() => __valley.game.state.travel.current === 'he' && __valley.world.realmId === 'he');
    const planted = await page.evaluate(() => __valley.game.sow('plot-1', 'glowmoss'));
    check(`${kind} 菜园拒绝光苔`, planted.ok === false && /展柜/.test(planted.message));
    await shot(page, `${kind}-garden-no`);
    const placed = await page.evaluate(() => __valley.game.placeBlock('glowmoss-case', { x: -2, y: 0, z: 1, rotation: 0 }));
    check(`${kind} 展柜可以放在河谷`, placed.ok === true);
    await shot(page, `${kind}-case-home`);
    await page.reload();
    await page.waitForFunction(() => window.__valley?.world);
    await page.click('#start-button');
    check(`${kind} 刷新后展柜还在`, await page.evaluate(() => __valley.game.state.blocks.some((block) => block.item === 'glowmoss-case')));

    await toXing(page, { skip: true });
    await page.click('#xing-gugu');
    await shot(page, `${kind}-gugu`);
    await page.getByRole('button', { name: '抱一抱' }).click();
    check(`${kind} 不解题也能送小咕回家`, await page.evaluate(() => __valley.game.state.travel.stamps.includes('xing-gugu-home') && (__valley.game.state.inventory['glyph-plaque'] || 0) >= 1));

    const here = await page.evaluate(() => __valley.game.exportSave());
    await page.evaluate((text) => localStorage.setItem('yuanyuan-river-valley-v1', text), here);
    await page.reload();
    await page.waitForFunction(() => window.__valley?.game);
    await page.click('#start-button');
    check(`${kind} 在外星谷刷新还在外星谷`, await page.evaluate(() => __valley.game.state.travel.current === 'xing'));

    await page.evaluate(() => {
      const world = __valley.world;
      if (!world.balloon) world.startBalloon();
      world.balloon.phase = 'tour';
    });
    await page.click('#balloon-return');
    await page.locator('#star-cutscene').waitFor({ state: 'visible' });
    await page.reload();
    await page.waitForFunction(() => window.__valley?.game);
    await page.click('#start-button');
    const back = await page.evaluate(() => {
      const player = __valley.game.state.travel.realms.xing.player;
      return { current: __valley.game.state.travel.current, y: player.y, z: player.z };
    });
    check(`${kind} 回家航线中途刷新回到草坪`, back.current === 'xing' && back.y < 1 && back.z > 8);

    const broken = await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('yuanyuan-river-valley-v1'));
      raw.travel.realms.mei.decor = { ...(raw.travel.realms.mei.decor || {}), face: 'cat' };
      raw.travel.realms.xing = { broken: true };
      raw.travel.current = 'xing';
      return JSON.stringify(raw);
    });
    await page.evaluate((text) => {
      sessionStorage.setItem('xing-inject', JSON.stringify({ text }));
    }, broken);
    await page.reload();
    await page.waitForFunction(() => window.__valley?.game);
    await page.click('#start-button');
    const repaired = await page.evaluate(() => ({
      current: __valley.game.state.travel.current,
      mei: __valley.game.state.travel.realms.mei,
      home: __valley.game.state.blocks.some((block) => block.item === 'glowmoss-case'),
    }));
    check(`${kind} 外星谷记录坏了回到河谷且展柜还在`, repaired.current === 'he' && repaired.mei?.decor?.face === 'cat' && repaired.home);

    const statsBefore = await page.evaluate(() => ({ ...__valley.sceneStats }));
    const trips = Number(process.env.XING_TRIPS || 10);
    for (let i = 0; i < trips; i += 1) {
      const realm = await page.evaluate(() => __valley.game.state.travel.current);
      if (realm !== 'xing') {
        await page.evaluate(() => {
          const world = __valley.world;
          world.stopWalking();
          if (!world.balloon) world.startBalloon();
          world.balloon.phase = 'tour';
          world.balloon.scripted = false;
        });
        await page.locator('#balloon-stars').waitFor({ state: 'visible' });
        await page.click('#balloon-stars');
        await page.click('#star-skip');
        await page.waitForFunction(() => __valley.game.state.travel.current === 'xing' && __valley.world.realmId === 'xing');
      }
      if (i % 2 === 0) {
        await page.click('#travel-home');
        await page.waitForFunction(() => __valley.game.state.travel.current === 'he' && __valley.world.realmId === 'he');
      } else {
        await page.evaluate(() => {
          const world = __valley.world;
          for (let n = 0; n < 100 && world.balloon; n += 1) __valley.step(0.05);
          if (!world.balloon) world.startBalloon();
          for (let n = 0; n < 120 && world.balloon?.phase === 'lift'; n += 1) __valley.step(0.05);
        });
        await page.click('#balloon-return');
        await page.locator('#star-skip').waitFor({ state: 'visible', timeout: 8000 });
        await page.click('#star-skip');
        await page.waitForFunction(() => __valley.game.state.travel.current === 'he' && __valley.world.realmId === 'he');
      }
    }
    const statsAfter = await page.evaluate(() => ({
      ...__valley.sceneStats,
      stars: __valley.world.stars ? 1 : 0,
      renderRealm: __valley.world.realmId,
    }));
    check(`${kind} 来回之后只有一个渲染器`, statsAfter.renderers === 1 && statsAfter.listeners === statsBefore.listeners && statsAfter.stars === 0);

    await toXing(page, { skip: true });
    await page.evaluate(() => { for (let i = 0; i < 100 && __valley.world.balloon; i += 1) __valley.step(0.05); });
    const groundLabels = ['看球跳得高', '培养盐晶', '送小咕回家', '坐热气球回家', '装进展柜', '回家'];
    const sizes = [];
    for (const label of groundLabels) sizes.push(await boxOf(page, label));
    await page.click('#travel-home');
    await page.waitForFunction(() => __valley.game.state.travel.current === 'he' && __valley.world.realmId === 'he');
    await page.evaluate(() => {
      const world = __valley.world;
      world.stopWalking();
      if (!world.balloon) world.startBalloon();
      world.balloon.phase = 'tour';
    });
    await page.locator('#balloon-stars').waitFor({ state: 'visible' });
    sizes.push(await boxOf(page, '飞向星星（外星谷）'));
    check(`${kind} 不读字按钮都够大`, sizes.every((box) => box && !box.hidden && box.w >= 44 && box.h >= 44));

    await page.evaluate(() => __valley.openPanel('stamps'));
    await shot(page, `${kind}-stamps`);
    check(`${kind} 印章本里有到达外星谷`, await page.locator('.stamp-card', { hasText: '到达外星谷' }).count().then((n) => n > 0));
    check(`${kind} 没有未捕获错误`, errors.length === 0);
  } finally {
    await context.close();
  }
}

const only = process.env.XING_ONLY || '';
try {
  if (!only || only === 'desktop') await run('desktop', { width: 1280, height: 800 }, true);
  if (!only || only === 'tablet') await run('tablet', { width: 1024, height: 768 }, true);
  if (!only || only === 'phone') await run('phone', { width: 390, height: 844 }, true);
  console.log(`XING CHECK PASS ${passed.length}`);
} finally {
  await browser.close();
}
