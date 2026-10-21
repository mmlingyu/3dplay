import test from 'node:test';
import assert from 'node:assert/strict';
import { EARTH_GRAVITY, REALMS } from '../src/realm-data.js';
import { JUMP_SPEED, ballGravity, gravityOf, gravityScale, playerFall, simulateBallDrop, simulateJump } from '../src/motion-gravity.js';

function legacyJump(dt = 1 / 60) {
  let y = 0;
  let vy = 4.6;
  let apex = 0;
  const samples = [];
  for (let i = 0; i < 600; i += 1) {
    vy -= 12 * dt;
    y += vy * dt;
    if (y > apex) apex = y;
    samples.push(y);
    if (y <= 0) break;
  }
  return { apex, samples };
}

function legacyBall(dt = 1 / 30) {
  const sub = dt / 3;
  let y = 4;
  let vy = 0;
  const samples = [];
  for (let n = 0; n < 90; n += 1) {
    for (let k = 0; k < 3; k += 1) {
      const ground = 0.22;
      if (y <= ground + 0.025 && vy <= 0) {
        y = ground;
        vy = 0;
      } else vy -= 9.8 * sub;
      y += vy * sub;
      if (y < ground) {
        y = ground;
        vy = 0;
      }
    }
    samples.push(Math.round(y * 1000) / 1000);
  }
  return samples;
}

test('河谷、日谷、美谷的重力比例仍是 1，轨迹和原来的 9.8 / 12 相同', () => {
  assert.equal(gravityScale('he'), 1);
  assert.equal(gravityScale('ri'), 1);
  assert.equal(gravityScale('mei'), 1);
  assert.equal(gravityOf('he'), EARTH_GRAVITY);
  assert.equal(REALMS.ri.gravity, EARTH_GRAVITY);
  assert.equal(REALMS.mei.gravity, EARTH_GRAVITY);
  assert.equal(ballGravity('he'), 9.8);
  assert.equal(playerFall('he', false), 12);
  assert.equal(playerFall('he', true), 16);
  assert.equal(JUMP_SPEED, 4.6);
  const legacy = legacyJump();
  for (const realmId of ['he', 'ri', 'mei']) {
    const next = simulateJump({ realmId });
    assert.equal(next.apex, legacy.apex);
    assert.deepEqual(next.samples, legacy.samples);
    assert.deepEqual(simulateBallDrop({ realmId }).samples, legacyBall());
  }
});

test('外星谷只有重力变成约三分之一，跳起高度大约是三倍', () => {
  assert.equal(REALMS.xing.gravity, EARTH_GRAVITY / 3);
  assert.ok(Math.abs(gravityScale('xing') - 1 / 3) < 1e-12);
  assert.ok(Math.abs(ballGravity('xing') - 9.8 / 3) < 1e-12);
  assert.ok(Math.abs(playerFall('xing', false) - 4) < 1e-12);
  const home = simulateJump({ realmId: 'he' });
  const away = simulateJump({ realmId: 'xing' });
  assert.ok(away.apex > home.apex * 2.8 && away.apex < home.apex * 3.2);
  assert.equal(away.samples.length > home.samples.length, true);
});
