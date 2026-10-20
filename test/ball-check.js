import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.GAME_TEST_URL || 'http://127.0.0.1:5173');
  await page.waitForFunction(() => window.__valley?.world);
  await page.locator('#start-button').tap();
  const result = await page.evaluate(() => {
    const { world: w, game } = __valley;
    game.state.settings.sound = false;
    w.playerPosition.set(-7, 0, 5);
    w.releaseBall({ x: -4, z: 5 });
    const b = w.balls[0];
    for (let i = 0; i < 400; i++) w.updateBalls(.05);
    const persists = w.balls.includes(b);
    // Drive the real movement/collision update without spending test time drawing 200 frames.
    const render = w.renderer.render;
    w.renderer.render = () => {};
    try {
      w.playerPosition.set(-4.7, 0, 5); w.yaw = 0;
      for (let i = 0; i < 12; i++) w.update(.05, { x: 1, z: 0 }, false);
      const pushed = b.p.x > -3.85 && b.v.x > 0;
      const p = b.p.clone();
      w.update(.05, {}, true);
      const paused = b.p.equals(p);
      for (let i = 0; i < 200; i++) w.updateBalls(.05);
      const slowed = b.v.length() < .08;
      w.playerPosition.set(b.p.x - .6, 0, b.p.z);
      for (let i = 0; i < 8; i++) w.update(.05, { x: 1, z: 0 }, false);
      const repushed = b.v.x > .1;
      w.recallBall(b.id);
      w.releaseBall(); const slopeBall = w.balls[0], start = slopeBall.p.z;
      for (let i = 0; i < 120; i++) w.updateBalls(.05);
      const slope = slopeBall.p.z > start + .5;
      for(let i=0;i<3;i++)w.releaseBall({x:-8,z:5+i});
      const ids=w.balls.map(b=>b.id).join(',');
      const capped=w.releaseBall({x:-9,z:5})===false && w.balls.map(b=>b.id).join(',')===ids;
      slopeBall.p.x=16;slopeBall.v.x=2;w.updateBalls(.05);
      const boundary=slopeBall.p.x<=15.55 && w.balls.includes(slopeBall);
      return { persists, pushed, paused, slowed, repushed, slope, capped, boundary };
    } finally { w.renderer.render = render; }
  });
  assert.ok(Object.values(result).every(Boolean), JSON.stringify(result));
  await page.evaluate(() => {
    const { world: w } = __valley;
    for (const b of [...w.balls]) w.recallBall(b.id);
    w.playerPosition.set(-5, 0, 5);
    w.releaseBall({ x: -4, z: 5 }); __valley.openPanel('pause');
  });
  const before = await page.evaluate(() => __valley.game.state.toys);
  assert.equal(before.length, 1);
  await page.screenshot({ path: join(tmpdir(), 'valley-ball-check.png') });
  await page.reload();
  await page.waitForFunction(() => window.__valley?.world);
  assert.deepEqual(await page.evaluate(() => __valley.world.serializeBalls()), before, '刷新恢复球但不推进离线运动');
  await page.locator('#start-button').tap();
  const point = await page.evaluate(() => {
    const w=__valley.world,p=w.balls[0].p.clone().project(w.camera);
    return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};
  });
  await page.touchscreen.tap(point.x,point.y);
  await page.waitForFunction(() => document.getElementById('action-name').textContent === '收起球');
  await page.screenshot({ path: join(tmpdir(), 'valley-ball-check.png') });
  await page.locator('#action-button').tap();
  assert.equal(await page.evaluate(() => __valley.world.balls.length),0,'通过真实触控和动作按钮取回球');
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('木球保留、推动、减速、再推动、下坡、暂停、回收、存档恢复通过');
  await context.close();
} finally { await browser.close(); }
