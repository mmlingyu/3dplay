import test from 'node:test';
import assert from 'node:assert/strict';
import { BALLOON_BASE, BALLOON_CONTROL, BALLOON_NAME, balloonHomeAngle, balloonHomeDuration, balloonLook, balloonNearBase, balloonReturnPose, balloonSteer, balloonTourPoint, onBalloonLawn, wrapHeading } from '../src/balloon-data.js';
import { createLand, isPointOpen } from '../src/land-data.js';
import { isProtectedCell } from '../src/game-data.js';

test('热气球草坪在南边空地', () => {
  assert.equal(BALLOON_NAME, '热气球草场');
  assert.ok(BALLOON_BASE.z > 16);
  assert.equal(onBalloonLawn(BALLOON_BASE.x, BALLOON_BASE.z), true);
  assert.equal(onBalloonLawn(0, 0), false);
  assert.equal(onBalloonLawn(13.1, 1.15), false);
  assert.equal(isProtectedCell(BALLOON_BASE.x, BALLOON_BASE.z), true);
  assert.equal(isProtectedCell(0, 0), false);
  assert.equal(isPointOpen(createLand(), BALLOON_BASE.x, BALLOON_BASE.z), true);
  assert.equal(isPointOpen(createLand(), -12, 20), true);
});

test('环游绕着已开地图中心转一圈', () => {
  const land = createLand();
  const a0 = balloonTourPoint(land, 0);
  const aHalf = balloonTourPoint(land, Math.PI);
  assert.ok(Number.isFinite(a0.cx));
  assert.ok(a0.cz > 0);
  assert.ok(a0.rx >= 8);
  assert.ok(Math.hypot(a0.x - aHalf.x, a0.z - aHalf.z) > 16);
  const home = balloonHomeAngle(land);
  const start = balloonTourPoint(land, home);
  assert.ok(Math.hypot(start.x - BALLOON_BASE.x, start.z - BALLOON_BASE.z) < 10);
  assert.equal(wrapHeading(0), 0);
  assert.equal(wrapHeading(Math.PI), 180);
  assert.equal(balloonLook('lift').title, '起飞');
  assert.match(balloonLook('tour', 0).note, /0°/);
  assert.equal(balloonLook('tour', 0).landing, false);
});

test('选择降落后沿空中航线回到草坪再落下', () => {
  const from = { x: 10, y: 16.5, z: -8 };
  assert.equal(balloonNearBase(from.x, from.z), false);
  assert.equal(balloonLook('home').landing, true);
  assert.match(balloonLook('home').note, /草坪基地/);
  const mid = balloonReturnPose(from, 'home', 0.5);
  assert.ok(mid.x < from.x);
  assert.ok(mid.z > from.z);
  assert.equal(mid.y, BALLOON_BASE.cruiseHeight);
  const arrived = balloonReturnPose(from, 'home', 1);
  assert.ok(Math.abs(arrived.x - BALLOON_BASE.x) < 0.01);
  assert.ok(Math.abs(arrived.z - BALLOON_BASE.z) < 0.01);
  const down = balloonReturnPose({ x: BALLOON_BASE.x, y: BALLOON_BASE.cruiseHeight, z: BALLOON_BASE.z }, 'descend', 1);
  assert.equal(down.x, BALLOON_BASE.x);
  assert.equal(down.z, BALLOON_BASE.z);
  assert.ok(down.y < 0.05);
  assert.ok(balloonHomeDuration(from.x, from.z) >= 2.2);
  assert.equal(balloonNearBase(BALLOON_BASE.x, BALLOON_BASE.z), true);
});

test('自己开时摇杆移动并限制在地图和高度里', () => {
  const land = createLand();
  const north = balloonSteer({ x: 0, y: 16.5, z: 0 }, { mx: 0, mz: -1, yaw: 0 }, 1, land);
  assert.ok(north.z < 0);
  assert.ok(Math.abs(north.y - 16.5) < 0.01);
  const up = balloonSteer({ x: 0, y: 16.5, z: 0 }, { climb: 1 }, 1, land);
  assert.ok(up.y > 16.5);
  const top = balloonSteer({ x: 0, y: 21.5, z: 0 }, { climb: 1 }, 1, land);
  assert.equal(top.y, BALLOON_CONTROL.maxHeight);
  assert.equal(balloonLook('tour', 0, 'steer').mode, 'steer');
  assert.match(balloonLook('tour', 0, 'steer').title, /自己开/);
});
