import test from 'node:test';
import assert from 'node:assert/strict';
import { AxleSession } from '../src/axle-session.js';

test('轮子通过匹配插槽装到固定轴上，连接关系可拆开', () => {
  const axle = new AxleSession();
  assert.equal(axle.attach('left').ok, true);
  assert.equal(axle.snapshot().connections.length, 1);
  assert.deepEqual(axle.snapshot().connections[0], {
    id: 'joint-left',
    kind: 'revolute',
    partId: 'wheel-left',
    portId: 'socket-left',
    parentId: 'axle',
  });

  assert.equal(axle.detach('left').ok, true);
  assert.equal(axle.snapshot().connections.length, 0);
  assert.equal(axle.snapshot().wheels.left.attached, false);
});

test('每个轮子只能装进自己的空插槽，失败不改变装配', () => {
  const axle = new AxleSession();
  const before = axle.snapshot();

  assert.equal(axle.attach('center').ok, false);
  assert.equal(axle.attach('left', 'wheel-right').ok, false);
  assert.deepEqual(axle.snapshot(), before);

  assert.equal(axle.attach('left').ok, true);
  const attached = axle.snapshot();
  assert.equal(axle.attach('left').ok, false);
  assert.deepEqual(axle.snapshot(), attached);
});

test('转动左轮不会带动固定轴或右轮，右轮也能单独转动', () => {
  const axle = new AxleSession();
  axle.attach('left');
  axle.attach('right');

  assert.equal(axle.turn('left', Math.PI / 2).ok, true);
  let snapshot = axle.snapshot();
  assert.equal(snapshot.wheels.left.angle, Math.PI / 2);
  assert.equal(snapshot.wheels.right.angle, 0);
  assert.equal(snapshot.axle.angle, 0);

  assert.equal(axle.turn('right', -Math.PI / 3).ok, true);
  snapshot = axle.snapshot();
  assert.equal(snapshot.wheels.left.angle, Math.PI / 2);
  assert.equal(snapshot.wheels.right.angle, -Math.PI / 3);
  assert.equal(snapshot.axle.angle, 0);
});

test('未安装的轮子不能转动，非法步进和关闭后的操作均被拒绝', () => {
  const axle = new AxleSession();
  assert.equal(axle.turn('left', 1).ok, false);
  axle.attach('left');
  assert.equal(axle.turn('left', Infinity).ok, false);
  assert.equal(axle.detach('right').ok, false);
  axle.dispose();
  assert.equal(axle.attach('right').ok, false);
  assert.equal(axle.turn('left', 1).ok, false);
});
