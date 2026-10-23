import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const url = process.env.GAME_TEST_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({ headless: true });
const passed = [];

function check(name, value) {
  assert.ok(value, name);
  passed.push(name);
  console.log(`✓ ${name}`);
}

const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.setDefaultTimeout(120000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

try {
  await page.goto(url);
  await page.waitForFunction(() => window.__valley?.world);
  await page.waitForSelector('#look-avatar .av');
  const idle = await page.evaluate(() => {
    const svg = document.querySelector('#look-avatar .av');
    const pose = __valley.world.avatarPose?.() || null;
    return {
      mood: svg?.classList.contains('mood-idle'),
      lids: svg?.querySelectorAll('.lid').length || 0,
      pupils: svg?.querySelectorAll('.pupil').length || 0,
      hint: document.querySelector('.look-mood-hint')?.textContent || '',
      yaw: __valley.world.yaw,
      distance: __valley.world.distance,
      fov: __valley.world.camera.fov,
      pose,
    };
  });
  check('预览一开始是平时，有眼皮和瞳孔', idle.mood && idle.lids === 2 && idle.pupils >= 2);
  check('入口相机没有被表情改动', Math.abs(idle.yaw - 0.64) < 0.001 && idle.distance === 20 && idle.fov === 43);
  await page.locator('#look-avatar').screenshot({ path: '/opt/cursor/artifacts/look-idle.png' });
  await page.locator('#look-stage').click();
  const happy = await page.evaluate(() => {
    const svg = document.querySelector('#look-avatar .av');
    return {
      mood: svg?.classList.contains('mood-happy'),
      label: svg?.getAttribute('aria-label') || '',
      hint: document.querySelector('.look-mood-hint')?.textContent || '',
    };
  });
  check('点一下预览出现开心', happy.mood && happy.label === '开心' && happy.hint === '开心');
  await page.waitForTimeout(220);
  await page.locator('#look-avatar').screenshot({ path: '/opt/cursor/artifacts/look-happy.png' });
  await page.locator('#look-maker').screenshot({ path: '/opt/cursor/artifacts/look-maker.png' });
  await page.waitForFunction(() => document.querySelector('#look-avatar .av')?.classList.contains('mood-idle'), null, { timeout: 4000 });
  check('开心会自己回到平时', true);
  const blinked = await page.evaluate(async () => {
    const root = document.querySelector('#look-avatar');
    const started = performance.now();
    while (performance.now() - started < 8000) {
      if (root.querySelector('.lid.blink')) return true;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    return false;
  });
  check('静止预览会眨眼', blinked);
  await page.click('#start-button');
  const play = await page.evaluate(() => {
    const world = __valley.world;
    for (let i = 0; i < 80; i += 1) world.update(0.05, { x: 0, z: 0 }, false);
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
    const after = world.avatarPose();
    const boat = world.targets.find((item) => item.storyId === 'boatman');
    let curious = null;
    let left = null;
    if (boat?.position) {
      world.playerPosition.set(boat.position.x, world.playerPosition.y, boat.position.z + 1.2);
      world.setMood('idle');
      world.stepAvatar(0.05);
      curious = world.avatarPose().mood;
      world.playerPosition.set(-5, 0, 5);
      world.stepAvatar(0.05);
      left = world.avatarPose().mood;
    }
    world.renderer.info.reset();
    world.update(1 / 60, { x: 0, z: 0 }, false);
    return {
      sawBlink: shut.some((value) => value < 0.3),
      sawOpen: shut.some((value) => value > 0.8),
      joyful,
      after,
      curious,
      left,
      calls: world.renderer.info.render.calls,
      yaw: world.yaw,
      distance: world.distance,
      fov: world.camera.fov,
      player: [world.playerPosition.x, world.playerPosition.z],
    };
  });
  check('三维小人静止会眨眼，也会再睁开', play.sawBlink && play.sawOpen);
  check('三维开心时嘴会变大', play.joyful.mood === 'happy' && play.joyful.smileX > 1.2);
  check('开心不会卡住', play.after.mood === 'idle' && play.after.eyeY > 0.5);
  check('靠近船伯会好奇，走开就恢复', play.curious === 'curious' && play.left === 'idle');
  check('出生点绘制调用没有新增到 150 以上', play.calls > 0 && play.calls <= 150);
  check('玩的时候相机焦距和距离仍是原来的', play.fov === 43 && play.distance === 20 && Math.abs(play.yaw - 0.64) < 0.02);
  console.log('LOOK_MOOD', JSON.stringify({ calls: play.calls, joyful: play.joyful, after: play.after, errors }));
  check('页面没有脚本错误', errors.length === 0);
  await page.screenshot({ path: '/opt/cursor/artifacts/look-valley.png' });
  console.log(`look-mood-check passed ${passed.length}`);
} finally {
  await context.close();
  await browser.close();
}
