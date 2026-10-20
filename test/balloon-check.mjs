import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { BALLOON_BASE } from '../src/balloon-data.js';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/api/valley', route => {
  if (route.request().method() === 'PUT') return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  return route.continue();
});
try {
  await page.goto('http://127.0.0.1:5179/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__valley?.world);
  await page.evaluate(() => __valley.start());
  const base = await page.evaluate(() => {
    const target = __valley.world.targets.find(t => t.id === 'balloon-base');
    return { name: target?.name, action: target?.action, type: target?.type, hasCraft: __valley.world.targets.some(t => t.id === 'balloon-craft') };
  });
  assert.equal(base.name, '热气球草场');
  assert.equal(await page.evaluate(() => __valley.world.targets.some(t => t.id === 'balloon-gate')), true);
  assert.equal(base.action, '乘坐热气球');
  assert.equal(base.type, 'balloon');
  assert.equal(base.hasCraft, true);
  const boarded = await page.evaluate(({ x, z }) => {
    const world = __valley.world;
    world.playerPosition.set(x + 1.6, 0.2, z);
    const started = world.startBalloon();
    world.stepBalloon(0.4);
    return { started, phase: world.balloon?.phase, y: world.playerPosition.y, locomotion: world.locomotion };
  }, BALLOON_BASE);
  assert.equal(boarded.started, true);
  assert.equal(boarded.locomotion, 'balloon');
  assert.equal(boarded.phase, 'lift');
  await page.waitForSelector('#balloon-hud:not([hidden])');
  assert.match(await page.locator('#balloon-title').innerText(), /起飞|热气球/);
  const touring = await page.evaluate(() => {
    const world = __valley.world;
    for (let i = 0; i < 12; i++) world.stepBalloon(0.4);
    return { phase: world.balloon?.phase, y: world.playerPosition.y, angle: world.balloon?.angle };
  });
  assert.equal(touring.phase, 'tour');
  assert.ok(touring.y > 10);
  const orbit = await page.evaluate(start => {
    const world = __valley.world;
    for (let i = 0; i < 8; i++) world.stepBalloon(0.4, 0.8);
    const p = world.playerPosition;
    return { y: p.y, angle: world.balloon.angle, heading: world.balloonLook().heading, moved: Math.abs(world.balloon.angle - start) > 0.2 };
  }, touring.angle);
  assert.equal(orbit.moved, true);
  assert.ok(orbit.y > 12);
  assert.ok(Number.isFinite(orbit.heading));
  const steered = await page.evaluate(() => {
    const world = __valley.world;
    world.yaw = 0;
    world.balloonCraft.position.set(0, 16.5, 0);
    world.setBalloonMode('steer');
    const before = { x: world.balloonCraft.position.x, y: world.balloonCraft.position.y, z: world.balloonCraft.position.z };
    for (let i = 0; i < 6; i++) world.stepBalloon(0.3, 0, -1);
    const moved = Math.hypot(world.balloonCraft.position.x - before.x, world.balloonCraft.position.z - before.z);
    world.setBalloonClimb(1);
    world.stepBalloon(0.4, 0, 0);
    return {
      mode: world.balloon.mode,
      moved: moved > 1,
      climbed: world.balloonCraft.position.y > before.y + 0.4,
    };
  });
  assert.equal(steered.mode, 'steer');
  assert.equal(steered.moved, true);
  assert.equal(steered.climbed, true);
  await page.locator('#balloon-steer').click();
  assert.equal(await page.locator('#balloon-steer').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#balloon-land').innerText(), '降落到草坪基地');
  await page.locator('#balloon-land').click();
  const returning = await page.evaluate(() => {
    const world = __valley.world;
    const began = world.balloon?.phase;
    world.stepBalloon(0.3);
    return { began, phase: world.balloon?.phase, headingHome: world.balloon?.phase === 'home' || world.balloon?.phase === 'descend' };
  });
  assert.equal(['home', 'descend'].includes(returning.began), true);
  assert.equal(returning.headingHome, true);
  assert.match(await page.locator('#balloon-land').innerText(), /正在降落/);
  const landed = await page.evaluate(({ x, z }) => {
    const world = __valley.world;
    for (let i = 0; i < 40 && world.balloon; i++) world.stepBalloon(0.4);
    const p = world.playerPosition;
    return { flying: !!world.balloon, locomotion: world.locomotion, y: p.y, near: Math.hypot(p.x - x, p.z - z) < 4 };
  }, BALLOON_BASE);
  assert.equal(landed.flying, false);
  assert.equal(landed.locomotion, 'walk');
  assert.equal(await page.locator('#balloon-hud').getAttribute('hidden'), '');
  assert.ok(landed.y < 2);
  assert.equal(landed.near, true);
  assert.deepEqual(errors, []);
  console.log('balloon tour ok');
} finally {
  await browser.close();
}
