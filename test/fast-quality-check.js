import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { STORAGE_KEY } from '../src/game-data.js';

const url = process.env.GAME_TEST_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({ headless: true });
const passed = [];

function check(name, value) {
  assert.ok(value, name);
  passed.push(name);
  console.log(`✓ ${name}`);
}

async function boot(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__valley?.world);
  await page.click('#start-button');
  await page.evaluate(() => { __valley.game.state.settings.sound = false; });
  if (await page.locator('#wish-dismiss').isVisible().catch(() => false)) await page.click('#wish-dismiss');
  await page.evaluate(() => { for (let i = 0; i < 8; i += 1) __valley.step(0.05); });
  return { context, page, errors };
}

async function sample(page, spot) {
  return page.evaluate(async (name) => {
    const world = __valley.world;
    const frames = [];
    for (let i = 0; i < 20; i += 1) {
      world.renderer.info.reset();
      const start = performance.now();
      world.update(1 / 60, { x: 0, z: 0 }, false);
      frames.push({
        calls: world.renderer.info.render.calls,
        triangles: world.renderer.info.render.triangles,
        ms: performance.now() - start,
      });
    }
    const calls = frames.map((frame) => frame.calls);
    const triangles = frames.map((frame) => frame.triangles);
    const ms = frames.map((frame) => frame.ms);
    const mid = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
    const avg = (list) => list.reduce((sum, value) => sum + value, 0) / list.length;
    return {
      spot: name,
      calls: mid(calls),
      callsMax: Math.max(...calls),
      triangles: mid(triangles),
      frameMs: { avg: +avg(ms).toFixed(2), median: +mid(ms).toFixed(2), min: +Math.min(...ms).toFixed(2), max: +Math.max(...ms).toFixed(2) },
      quality: world.pictureQuality,
      shadows: world.renderer.shadowMap.enabled,
      yaw: world.yaw,
      distance: world.distance,
      fov: world.camera.fov,
      player: [world.playerPosition.x, world.playerPosition.y, world.playerPosition.z],
    };
  }, spot);
}

try {
  const report = [];
  for (const [width, height] of [[1024, 768], [1280, 800]]) {
    const { context, page, errors } = await boot(width, height);
    const pose = await page.evaluate(() => ({
      yaw: __valley.world.yaw,
      distance: __valley.world.distance,
      fov: __valley.world.camera.fov,
      player: [__valley.world.playerPosition.x, __valley.world.playerPosition.y, __valley.world.playerPosition.z],
    }));
    check(`${width}入口视角没有被画质改动`, Math.abs(pose.yaw - 0.64) < 0.001 && pose.distance === 20 && pose.fov === 43 && pose.player[0] === -5 && pose.player[2] === 5);
    const spawn = await sample(page, 'spawn');
    const dock = await page.evaluate(() => {
      const world = __valley.world;
      const site = world.dockSite || { x: 4, z: 14 };
      world.playerPosition.set(site.x + 1.6, 0, site.z);
      world.updateCamera(0, true);
      return { x: site.x, z: site.z };
    });
    const dockSample = await sample(page, 'dock');
    const observatory = await page.evaluate(() => {
      __valley.game.mutate((state) => { state.travel.story.fogIntro = true; });
      const world = __valley.world;
      world.playerPosition.set(-13 + 2.2, 0, 2 + 1.4);
      world.updateCamera(0, true);
      world.sync(__valley.game.state);
      return true;
    });
    check(`${width}观星台可以站过去`, observatory === true);
    const starSample = await sample(page, 'observatory');
    for (const row of [spawn, dockSample, starSample]) {
      row.viewport = `${width}x${height}`;
      row.dock = dock;
      report.push(row);
      check(`${width} ${row.spot} 绘制调用 ≤150（${row.calls}）`, row.calls > 0 && row.calls <= 150 && row.callsMax <= 150);
      check(`${width} ${row.spot} 仍是流畅档且没有阴影`, row.quality === 'fast' && row.shadows === false);
    }
    const flora = await page.evaluate(() => {
      const world = __valley.world;
      const target = world.targets.find((item) => item.type === 'flora');
      const mesh = world.pickMeshes.find((item) => item.userData.targetId === target?.id);
      if (!mesh) return { picked: null };
      const point = world.camera.position.clone();
      mesh.getWorldPosition(point);
      point.y += 0.15;
      const camera = point.clone();
      camera.x += 1.4;
      camera.y += 1.6;
      camera.z += 1.4;
      world.camera.position.copy(camera);
      world.camera.lookAt(point);
      world.camera.updateMatrixWorld();
      const projected = point.clone().project(world.camera);
      const rect = world.canvas.getBoundingClientRect();
      const x = rect.left + (projected.x * 0.5 + 0.5) * rect.width;
      const y = rect.top + (-projected.y * 0.5 + 0.5) * rect.height;
      const hit = world.pick(x, y);
      return { picked: hit?.target?.type === 'flora' ? { id: hit.target.id, visible: mesh.visible } : null };
    });
    check(`${width}蒲公英仍能点中`, Boolean(flora.picked?.id));
    const regrow = await page.evaluate((id) => {
      const world = __valley.world;
      const group = world.floraGroups.get(id);
      const x = group.position.x;
      const z = group.position.z;
      const before = world.state.blocks.length;
      __valley.game.mutate((state) => {
        state.blocks.push({ id: 'fast-flora-cover', item: 'plank', x, y: 0, z, rotation: 0 });
      });
      world.update(0.05);
      const covered = world.floraGroups.get(id);
      const hidden = !covered?.parent;
      __valley.game.mutate((state) => {
        state.blocks = state.blocks.filter((block) => block.id !== 'fast-flora-cover');
      });
      world.update(0.05);
      const back = world.floraGroups.get(id);
      return { before, after: world.state.blocks.length, hidden, back: Boolean(back?.parent), version: __valley.game.state.version };
    }, flora.picked.id);
    check(`${width}盖住蒲公英后它会消失，拿走方块后又回来`, regrow.hidden && regrow.back && regrow.after === regrow.before);
    check(`${width}存档版本仍是 1`, regrow.version === 1);
    await page.evaluate(() => __valley.game.setQuality('fine'));
    await page.evaluate(() => { for (let i = 0; i < 3; i += 1) __valley.step(0.05); });
    const fine = await page.evaluate(() => ({
      quality: __valley.world.pictureQuality,
      shadows: __valley.world.renderer.shadowMap.enabled,
      hidden: (__valley.world.fastHidden || []).length,
      yaw: __valley.world.yaw,
      distance: __valley.world.distance,
      fov: __valley.world.camera.fov,
    }));
    check(`${width}精美档恢复原来的网格和阴影`, fine.quality === 'fine' && fine.shadows === true && fine.hidden === 0);
    check(`${width}切回精美档不改相机焦距和距离`, fine.fov === 43 && fine.distance === 20);
    const saved = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      const other = Object.keys(localStorage).filter((name) => name.startsWith('yuanyuan-river-valley') && name !== key && !name.includes('tour'));
      return { raw: raw ? JSON.parse(raw).version : null, other };
    }, STORAGE_KEY);
    check(`${width}存档键没变`, saved.raw === 1 && saved.other.length === 0);
    check(`${width}页面没有脚本错误`, errors.length === 0);
    await context.close();
  }
  console.log('FAST_QUALITY', JSON.stringify(report));
  console.log(`fast-quality-check passed ${passed.length}`);
} finally {
  await browser.close();
}
