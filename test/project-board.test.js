import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLANE_DISTANCE,
  cabinResult,
  changeProject,
  finishProject,
  makeProject,
  planeDistance,
  skipProject,
  startProject,
  tryProject,
  windmillSpin,
} from '../src/project-board.js';
import { AxleSession } from '../src/axle-session.js';

test('纸飞机中间机头和中间机翼最远，结果来自固定表', () => {
  assert.equal(planeDistance(1, 1), 14);
  assert.equal(PLANE_DISTANCE[1][1], 14);
  for (let wing = 0; wing < 3; wing += 1) {
    for (let nose = 0; nose < 3; nose += 1) {
      if (nose === 1 && wing === 1) continue;
      assert.ok(planeDistance(nose, wing) < 14);
    }
  }
  const card = startProject([], 'plane').projects[0];
  const drawn = makeProject(drawProjectReady(card), 4).card;
  const tried = tryProject(drawn, {}).card;
  assert.equal(tried.trials[0].result.distance, 14);
  const again = tryProject(tried, {}).card;
  assert.equal(again.trials[1].result.distance, again.trials[0].result.distance);
});

test('改一个变量，小孩可以再试，跳过也能完成，改不消耗材料字段', () => {
  let card = startProject([], 'windmill').projects[0];
  card = makeProject({ ...card, step: 'make' }, 4).card;
  card = tryProject(card, { weather: 'calm', bellows: false }).card;
  assert.equal(card.trials[0].result.spinning, false);
  assert.equal(changeProject(card, { blades: 2, size: 2 }, 'bigger').ok, false);
  const one = changeProject(card, { blades: 2 }, 'bigger');
  assert.equal(one.ok, true);
  assert.equal(one.card.parts.size, 1);
  assert.equal(one.card.parts.blades, 2);
  const little = changeProject(card, {}, 'little');
  assert.equal(little.ok, true);
  assert.equal(skipProject(card).card.done, true);
  assert.equal(skipProject(card).card.skipped, true);
  assert.equal(finishProject(card).card.done, true);
});

test('风车有风或风箱才转，转速随表变化', () => {
  const calm = windmillSpin(1, 1, 'calm', false);
  assert.equal(calm.spinning, false);
  assert.equal(calm.spin, 0);
  const bellows = windmillSpin(1, 1, 'calm', true);
  const wind = windmillSpin(1, 1, 'wind', false);
  const both = windmillSpin(1, 1, 'wind', true);
  assert.equal(bellows.spinning, true);
  assert.equal(wind.spinning, true);
  assert.ok(wind.spin > bellows.spin - 2);
  assert.ok(both.spin > wind.spin);
  assert.ok(both.spin > bellows.spin);
});

test('原木小屋用屋顶是否围好，不判断承重', () => {
  assert.equal(cabinResult([]).enclosed, false);
  assert.equal(cabinResult([{ item: 'roof', x: 4, y: 1, z: 8, w: 3, d: 3 }]).enclosed, true);
});

test('叶片接到轮轴上会一起转，不装叶片时快照和原来一样', () => {
  const plain = new AxleSession();
  assert.equal(Object.hasOwn(plain.snapshot(), 'blades'), false);
  plain.turn('left', 0.2);
  assert.equal(plain.snapshot().axle.angle, 0);
  const axle = new AxleSession();
  assert.equal(axle.attachBlade('windmill-blade').ok, true);
  assert.equal(axle.driveAxle(Math.PI / 8).ok, true);
  assert.equal(axle.snapshot().axle.angle, Math.PI / 8);
  assert.equal(axle.snapshot().blades[0].angle, Math.PI / 8);
  assert.equal(axle.snapshot().connections.at(-1).portId, 'socket-axle');
  axle.dispose();
  assert.equal(axle.driveAxle(0.1).ok, false);
});

function drawProjectReady(card) {
  return { ...card, step: 'make' };
}
