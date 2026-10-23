import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { STORAGE_KEY } from '../src/game-data.js';

const url = process.env.GAME_TEST_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({ headless: true });
const passed = [];
const shots = [];

function check(name, value) {
  assert.ok(value, name);
  passed.push(name);
  console.log(`✓ ${name}`);
}

async function boot(context, save = null) {
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  if (save) {
    await page.addInitScript(({ key, text }) => {
      localStorage.setItem(key, text);
    }, { key: STORAGE_KEY, text: save });
  }
  await page.goto(url);
  await page.waitForFunction(() => window.__valley?.world && !window.__valley.world.released);
  await page.waitForFunction(() => document.getElementById('boot-screen')?.hidden === true);
  await page.evaluate(() => { __valley.game.state.settings.sound = false; });
  return { page, errors };
}

async function readWorld(page) {
  return page.evaluate(() => {
    const world = __valley.world;
    const look = __valley.game.state.look;
    const shirt = world.player?.userData?.shirt;
    const body = world.player?.userData?.parts?.bodyMat?.color;
    const pose = world.avatarPose?.() || null;
    return {
      realm: world.realmId || 'he',
      travel: __valley.game.state.travel?.current || 'he',
      hasApplyLook: typeof world.applyLook === 'function',
      yaw: world.yaw,
      distance: world.distance,
      fov: world.camera.fov,
      player: [world.playerPosition.x, world.playerPosition.y, world.playerPosition.z],
      look,
      body: body ? `#${body.getHexString()}` : null,
      shirt: shirt?.material?.color ? `#${shirt.material.color.getHexString()}` : null,
      sharedShirt: shirt?.userData?.ownMat ? shirt.material === shirt.userData.ownMat : null,
      pose,
      journey: __valley.journey.status(),
      name: __valley.playerName(),
    };
  });
}

async function shot(page, name) {
  await page.screenshot({
    path: `/opt/cursor/artifacts/${name}`,
    animations: 'disabled',
    timeout: 120000,
  });
  shots.push(name);
}

async function clickLook(page, label) {
  const button = page.getByRole('button', { name: label, exact: true });
  await button.click();
}

async function retint(page, label) {
  await page.evaluate(() => __valley.openPanel('pause'));
  await page.locator('[data-action="look-open"]').click();
  await clickLook(page, label);
  await page.click('#look-dialog-close');
  await page.waitForFunction(() => document.getElementById('look-dialog')?.hidden === true);
}

async function retintNow(page, label) {
  await page.evaluate((name) => {
    __valley.openPanel('pause');
    const open = document.querySelector('[data-action="look-open"]');
    if (!open) throw new Error('没有换个样子');
    open.click();
    const button = [...document.querySelectorAll('#look-maker button')].find((el) => el.textContent.trim() === name);
    if (!button) throw new Error(`找不到${name}`);
    button.click();
    document.getElementById('look-dialog-close').click();
  }, label);
}

async function finishTrip(page, realm) {
  await page.evaluate(() => {
    const dialog = document.getElementById('look-dialog');
    if (dialog) dialog.hidden = true;
    __valley.panels?.close?.();
  });
  await page.evaluate(() => __valley.step(40));
  await page.waitForFunction((expected) => {
    const world = __valley.world;
    return Boolean(world && !world.released && world.realmId === expected && (__valley.game.state.travel?.current || 'he') === expected);
  }, realm);
}

const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

try {
  const { page, errors } = await boot(context);
  const entry = await readWorld(page);
  check('进河谷前是家里，而且已有 applyLook', entry.realm === 'he' && entry.hasApplyLook);
  check('进河谷默认相机仍是 yaw 0.64、距离 20、视野 43', Math.abs(entry.yaw - 0.64) < 0.001 && entry.distance === 20 && entry.fov === 43);

  await clickLook(page, '豆豆');
  await clickLook(page, '方方');
  await clickLook(page, '天蓝');
  await shot(page, 'apply-look-welcome.png');
  await page.click('#look-heart');
  const heart = await page.evaluate(() => document.querySelector('#look-avatar .av')?.classList.contains('mood-happy'));
  check('就这个会让预览出现开心', heart === true);
  await page.click('#start-button');
  await page.waitForFunction(() => document.getElementById('welcome')?.hidden === true);
  await page.evaluate(() => { __valley.game.state.settings.sound = false; });
  const played = await readWorld(page);
  check('就这个之后进入河谷，名字和样子记下了', played.look?.name === '豆豆' && played.look?.shape === 'square' && played.look?.color === 'sky' && played.look?.ready === true);
  check('河谷小人穿上了选定的颜色', played.body === '#7eb6d6');
  check('进河谷后相机焦距和距离没有变', played.realm === 'he' && Math.abs(played.yaw - 0.64) < 0.001 && played.distance === 20 && played.fov === 43);
  await shot(page, 'apply-look-valley.png');

  await retint(page, '莓红');
  const changed = await readWorld(page);
  check('暂停里换个样子，好了之后颜色换了', changed.look?.color === 'berry' && changed.body === '#e07a8a' && changed.look?.shape === 'square');
  const mood = await page.evaluate(() => {
    const world = __valley.world;
    for (let i = 0; i < 40; i += 1) world.update(0.05, { x: 0, z: 0 }, false);
    world.setMood('idle');
    const shut = [];
    for (let i = 0; i < 140; i += 1) {
      world.update(0.05, { x: 0, z: 0 }, false);
      shut.push(world.avatarPose().eyeY);
    }
    world.setMood('happy');
    world.update(0.05, { x: 0, z: 0 }, false);
    const joyful = world.avatarPose();
    for (let i = 0; i < 50; i += 1) world.update(0.05, { x: 0, z: 0 }, false);
    return {
      sawBlink: shut.some((value) => value < 0.3),
      sawOpen: shut.some((value) => value > 0.8),
      joyful,
      after: world.avatarPose(),
      yaw: world.yaw,
      distance: world.distance,
      fov: world.camera.fov,
    };
  });
  check('换样子之后小人仍会眨眼再睁开', mood.sawBlink && mood.sawOpen);
  check('开心的短表情仍会把嘴变大，然后回到平时', mood.joyful.mood === 'happy' && mood.joyful.smileX > 1.2 && mood.after.mood === 'idle');
  check('表情没有改相机', Math.abs(mood.yaw - 0.64) < 0.02 && mood.distance === 20 && mood.fov === 43);
  await shot(page, 'apply-look-changed.png');

  await page.evaluate(() => __valley.startFerry('ri'));
  await page.waitForFunction(() => __valley.journey.status().active === true);
  await retintNow(page, '小帽');
  const riding = await readWorld(page);
  check('去日谷的旅途中换帽子不会丢掉 applyLook', riding.travel === 'he' && riding.hasApplyLook && riding.journey.active === true && riding.look?.hat === 'cap');
  await finishTrip(page, 'ri');
  const ri = await readWorld(page);
  check('抵达日谷后世界有 applyLook，衣服是选中的颜色', ri.realm === 'ri' && ri.hasApplyLook && ri.shirt === '#e07a8a' && ri.sharedShirt === true);
  await retint(page, '奶油');
  const riLook = await readWorld(page);
  check('日谷里换颜色不会抛错，衣服跟着变', riLook.realm === 'ri' && riLook.shirt === '#f3e2b8' && riLook.look?.color === 'cream');
  await shot(page, 'apply-look-ri.png');

  const save = await page.evaluate(() => {
    __valley.game.save();
    return localStorage.getItem('yuanyuan-river-valley-v1');
  });
  const resumed = await boot(context, save);
  await resumed.page.click('#start-button');
  await resumed.page.waitForFunction(() => document.getElementById('welcome')?.hidden === true && __valley.world?.realmId === 'ri');
  const resumedWorld = await readWorld(resumed.page);
  check('存档停在日谷时，点继续仍有 applyLook', resumedWorld.realm === 'ri' && resumedWorld.hasApplyLook && resumedWorld.shirt === '#f3e2b8');
  await retint(resumed.page, '猫耳');
  const resumedLook = await readWorld(resumed.page);
  check('日谷里换外形，好了不会抛错', resumedLook.look?.shape === 'cat' && resumedLook.hasApplyLook);
  check('续玩日谷没有脚本错误', resumed.errors.length === 0);
  await resumed.page.close();

  await page.click('#travel-home');
  await page.waitForFunction(() => __valley.journey.status().active === true && __valley.world?.realmId === 'ri');
  await retintNow(page, '沙色');
  const returning = await readWorld(page);
  check('从日谷回家的旅途里换颜色，当前世界仍接得住', returning.realm === 'ri' && returning.hasApplyLook && returning.journey.active === true && returning.shirt === '#e7a15a');
  await finishTrip(page, 'he');
  const home = await readWorld(page);
  check('回到河谷后默认相机仍是原来的', home.realm === 'he' && Math.abs(home.yaw - 0.64) < 0.001 && home.distance === 20 && home.fov === 43 && home.body === '#e7a15a');

  await page.evaluate(() => __valley.startFerry('mei'));
  await page.waitForFunction(() => __valley.journey.status().active === true);
  await retintNow(page, '斗篷');
  const meiRide = await readWorld(page);
  check('去美谷的旅途中换外形不会抛错', meiRide.travel === 'he' && meiRide.look?.shape === 'hood' && meiRide.journey.active === true);
  await finishTrip(page, 'mei');
  const mei = await readWorld(page);
  check('抵达美谷后有 applyLook，衣服是旅途里选定的颜色', mei.realm === 'mei' && mei.hasApplyLook && mei.shirt === '#e7a15a');
  await shot(page, 'apply-look-mei.png');
  await page.click('#travel-home');
  await page.waitForFunction(() => __valley.journey.status().active === true && __valley.world?.realmId === 'mei');
  await page.evaluate(() => __valley.world.applyLook(__valley.game.state.look));
  await finishTrip(page, 'he');

  await page.evaluate(() => __valley.goXing());
  await page.waitForFunction(() => __valley.world?.realmId === 'xing' && !__valley.world.released);
  const xing = await readWorld(page);
  check('抵达外星谷后有 applyLook，衣服带着选定颜色', xing.realm === 'xing' && xing.hasApplyLook && xing.shirt === '#e7a15a');
  await retint(page, '叶绿');
  const xingLook = await readWorld(page);
  check('外星谷里换颜色不会抛错', xingLook.realm === 'xing' && xingLook.shirt === '#93b7a0' && xingLook.look?.color === 'leaf');
  await shot(page, 'apply-look-xing.png');
  await page.click('#travel-home');
  await page.waitForFunction(() => __valley.journey.status().active === true && __valley.world?.realmId === 'xing');
  await retintNow(page, '圆圆');
  const starReturn = await readWorld(page);
  check('从外星谷回家的旅途里换外形不会抛错', starReturn.realm === 'xing' && starReturn.journey.active === true && starReturn.look?.shape === 'round' && starReturn.hasApplyLook);
  await finishTrip(page, 'he');
  const back = await readWorld(page);
  check('再次进河谷，默认相机仍不变', back.realm === 'he' && Math.abs(back.yaw - 0.64) < 0.001 && back.distance === 20 && back.fov === 43 && back.body === '#93b7a0');
  await shot(page, 'apply-look-home.png');

  const applyErrors = errors.filter((item) => /applyLook|is not a function/i.test(item));
  check('整段游玩没有 applyLook 脚本错误', applyErrors.length === 0);
  check('整段游玩没有未捕获脚本错误', errors.length === 0);
  console.log('APPLY_LOOK', JSON.stringify({ passed: passed.length, shots, errors, back }));
  console.log(`apply-look-check passed ${passed.length}`);
} finally {
  await context.close();
  await browser.close();
}
