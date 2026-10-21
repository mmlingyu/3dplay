import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game-state.js';
import { STORAGE_KEY } from '../src/game-data.js';

const url = process.env.GAME_TEST_URL || 'http://127.0.0.1:5174';

// 62c1af9 新开局、站在 (-5, 0, 5)、yaw .64、距离 20、地面俯仰 .76 时的相机。
// 之后各次合并没有改初始 yaw、距离、出生点、lookAt 种子或 FOV。
const ENTRY_62C1AF9 = {
  position: [6.943908827247842, 15.65, 21.041915157685853],
  direction: [-0.47546443291539664, -0.6050832675335578, -0.6385983184939912],
};

const browser = await chromium.launch({ headless: true });
const passed = [];

function check(name, value) {
  assert.ok(value, name);
  passed.push(name);
  console.log(`✓ ${name}`);
}

function gap(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

async function boot(page, save = null) {
  if (save) {
    await page.addInitScript(({ key, text }) => {
      localStorage.setItem(key, text);
    }, { key: STORAGE_KEY, text: JSON.stringify(save) });
  }
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__valley?.world);
  await page.click('#start-button');
  await page.evaluate(() => { __valley.game.state.settings.sound = false; });
  if (await page.locator('#wish-dismiss').isVisible().catch(() => false)) await page.click('#wish-dismiss');
  await page.evaluate(() => { for (let i = 0; i < 40; i += 1) __valley.step(0.05); });
  return errors;
}

async function readPose(page) {
  return page.evaluate(() => {
    const world = __valley.world;
    const cam = world.camera.position;
    const look = world.lookAt;
    const dx = look.x - cam.x;
    const dy = look.y - cam.y;
    const dz = look.z - cam.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    const horiz = Math.hypot(cam.x - look.x, cam.z - look.z) || 1;
    const flying = !!world.balloon;
    const dist = flying ? Math.max(world.distance, 24) : world.distance;
    const pitch = flying ? 0.48 : 0.76;
    const expectedLook = [world.playerPosition.x, world.playerPosition.y + (flying ? 1.8 : 0.45), world.playerPosition.z];
    const expectedCam = [
      expectedLook[0] + Math.sin(world.yaw) * dist,
      expectedLook[1] + dist * pitch,
      expectedLook[2] + Math.cos(world.yaw) * dist,
    ];
    const ex = expectedLook[0] - expectedCam[0];
    const ey = expectedLook[1] - expectedCam[1];
    const ez = expectedLook[2] - expectedCam[2];
    const elen = Math.hypot(ex, ey, ez) || 1;
    return {
      position: [cam.x, cam.y, cam.z],
      direction: [dx / len, dy / len, dz / len],
      expectedPosition: expectedCam,
      expectedDirection: [ex / elen, ey / elen, ez / elen],
      pitch: (cam.y - look.y) / horiz,
      yaw: world.yaw,
      distance: world.distance,
      fov: world.camera.fov,
      far: world.camera.far,
      player: [world.playerPosition.x, world.playerPosition.y, world.playerPosition.z],
      glance: world.vistaGlance?.phase || null,
    };
  });
}

function expectOriginalRig(pose, label, { position, direction } = {}) {
  check(`${label} 朝向仍是初始 yaw`, Math.abs(pose.yaw - 0.64) < 1e-6);
  check(`${label} 距离仍是 20`, pose.distance === 20);
  check(`${label} 视野仍是 43 度`, pose.fov === 43);
  check(`${label} 远处裁剪仍是 140`, pose.far === 140);
  check(`${label} 没有远眺引导`, pose.glance === null);
  const positionGap = gap(pose.position, pose.expectedPosition);
  const directionGap = gap(pose.direction, pose.expectedDirection);
  check(`${label} 相机位置符合原来的俯仰`, positionGap < 0.05);
  check(`${label} 相机朝向符合原来的俯仰`, directionGap < 0.02);
  check(`${label} 地面俯仰仍是 .76`, Math.abs(pose.pitch - 0.76) < 0.02);
  if (position) check(`${label} 位置与 62c1af9 一致`, gap(pose.position, position) < 0.05);
  if (direction) check(`${label} 朝向与 62c1af9 一致`, gap(pose.direction, direction) < 0.02);
  console.log(label, 'gap', positionGap.toFixed(5), directionGap.toFixed(5), 'pitch', pose.pitch.toFixed(4), 'player', pose.player.map((n) => n.toFixed(3)).join(','));
}

try {
  const fresh = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await fresh.newPage();
  page.setDefaultTimeout(30000);
  await boot(page);
  const entered = await readPose(page);
  check('新开局出生点没变', gap(entered.player, [-5, 0, 5]) < 0.05);
  expectOriginalRig(entered, '新开局进入河谷', ENTRY_62C1AF9);

  const south = await page.evaluate(() => {
    const world = __valley.world;
    world.yaw = Math.PI;
    world.updateCamera(1, true);
    const cam = world.camera.position;
    const look = world.lookAt;
    const horiz = Math.hypot(cam.x - look.x, cam.z - look.z) || 1;
    return { pitch: (cam.y - look.y) / horiz, lookY: look.y, playerY: world.playerPosition.y };
  });
  check('地面朝南仍用 .76，不因远景压低', Math.abs(south.pitch - 0.76) < 0.02 && Math.abs(south.lookY - (south.playerY + 0.45)) < 0.05);

  const flight = await page.evaluate(() => {
    const world = __valley.world;
    world.balloon = { phase: 'tour', mode: 'steer', angle: 0, scale: 0.36, height: 16 };
    world.yaw = Math.PI;
    world.updateCamera(1, true);
    const cam = world.camera.position;
    const look = world.lookAt;
    const horiz = Math.hypot(cam.x - look.x, cam.z - look.z) || 1;
    const pitch = (cam.y - look.y) / horiz;
    const lookY = look.y;
    const playerY = world.playerPosition.y;
    world.balloon = null;
    world.yaw = 0.64;
    world.updateCamera(1, true);
    return { pitch, lookY, playerY };
  });
  check('飞行朝南仍用 .48，不因远景压低', Math.abs(flight.pitch - 0.48) < 0.02 && Math.abs(flight.lookY - (flight.playerY + 1.8)) < 0.05);

  const glance = await page.evaluate(() => {
    const world = __valley.world;
    const from = world.playerPosition;
    world.vistaGlance = {
      id: 'ri',
      phase: 'turn',
      t: 0,
      fromYaw: world.yaw,
      toYaw: Math.atan2(18 - from.x, 36 - from.z) + Math.PI,
    };
    for (let i = 0; i < 16; i += 1) __valley.step(0.05);
    const cam = world.camera.position;
    const look = world.lookAt;
    const horiz = Math.hypot(cam.x - look.x, cam.z - look.z) || 1;
    const turning = (cam.y - look.y) / horiz;
    for (let i = 0; i < 40; i += 1) __valley.step(0.05);
    const heldCam = world.camera.position;
    const heldLook = world.lookAt;
    const heldHoriz = Math.hypot(heldCam.x - heldLook.x, heldCam.z - heldLook.z) || 1;
    const held = (heldCam.y - heldLook.y) / heldHoriz;
    const phase = world.vistaGlance?.phase || null;
    world.vistaGlance = { id: 'ri', phase: 'zoom', t: 0.4, fromYaw: world.yaw, toYaw: world.yaw };
    world.updateCamera(1, true);
    const zoomCam = world.camera.position;
    const zoomLook = world.lookAt;
    const zoomHoriz = Math.hypot(zoomCam.x - zoomLook.x, zoomCam.z - zoomLook.z) || 1;
    const zoom = (zoomCam.y - zoomLook.y) / zoomHoriz;
    world.skipVistaZoom();
    for (let i = 0; i < 30; i += 1) __valley.step(0.05);
    const backCam = world.camera.position;
    const backLook = world.lookAt;
    const backHoriz = Math.hypot(backCam.x - backLook.x, backCam.z - backLook.z) || 1;
    return {
      turning,
      held,
      phase,
      zoom,
      back: (backCam.y - backLook.y) / backHoriz,
      glance: world.vistaGlance?.phase || null,
    };
  });
  console.log('glance', JSON.stringify(glance));
  check('转身阶段会临时压低', glance.turning < 0.4);
  check('转身结束后停留阶段回到原来的俯仰', glance.phase === 'hold' && glance.held > 0.7);
  check('靠近阶段会临时压低', Math.abs(glance.zoom - 0.16) < 0.02);
  check('跳过后平滑回到原来的俯仰', glance.glance === null && glance.back > 0.7);

  await page.evaluate(() => __valley.goRealm('ferry', 'ri'));
  await page.waitForFunction(() => __valley.game.state.travel.current === 'ri' && __valley.world?.realmId === 'ri');
  await page.evaluate(() => __valley.goHome());
  await page.waitForFunction(() => __valley.game.state.travel.current === 'he' && __valley.world?.realmId === 'he');
  await page.evaluate(() => { for (let i = 0; i < 40; i += 1) __valley.step(0.05); });
  const home = await readPose(page);
  check('回家后还在原来的出生点附近', gap(home.player, [-5, 0, 5]) < 0.05);
  expectOriginalRig(home, '从外谷回家', ENTRY_62C1AF9);
  await fresh.close();

  const save = createInitialState();
  save.player = { x: 2, y: 0, z: 14 };
  const loaded = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const savedPage = await loaded.newPage();
  savedPage.setDefaultTimeout(30000);
  await boot(savedPage, save);
  const resumed = await readPose(savedPage);
  check('读档站在朝向远景的位置', Math.hypot(resumed.player[0] - 2, resumed.player[2] - 14) < 0.05 && resumed.player[1] > -0.5 && resumed.player[1] < 2);
  expectOriginalRig(resumed, '读取朝向远景的存档');
  await loaded.close();

  console.log(`进入视角通过 ${passed.length} 项`);
} finally {
  await browser.close();
}
