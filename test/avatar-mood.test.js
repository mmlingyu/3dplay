import assert from 'node:assert/strict';
import test from 'node:test';
import { LOOK_HATS, LOOK_SHAPES } from '../src/avatar-data.js';
import {
  bindMood,
  createBlink,
  createMoodClock,
  lookMarkup,
  paintOuterLook,
  pupilShift,
  setMood,
  shade,
  stepBlink,
  stepMood,
} from '../src/avatar-mood.js';

test('预览外形沿用河谷的样子、颜色和帽子', () => {
  for (const shape of LOOK_SHAPES) {
    for (const hat of LOOK_HATS) {
      const svg = lookMarkup({ shape: shape.id, color: '#93b7a0', hat: hat.id, mood: 'idle' });
      assert.match(svg, /class="av mood-idle"/);
      assert.match(svg, new RegExp(shape.id === 'round' ? 'M50 10' : 'path d="'));
      assert.match(svg, /class="lid"/);
      assert.match(svg, /class="pupil"/);
      assert.match(svg, /class="mouth"/);
      if (hat.id === 'none') assert.doesNotMatch(svg, /class="hat"/);
      else assert.match(svg, /class="hat"/);
    }
  }
  const happy = lookMarkup({ shape: 'cat', color: '#7eb6d6', hat: 'flower', mood: 'happy' });
  assert.match(happy, /mood-happy/);
  assert.match(happy, /#7eb6d6/);
  assert.match(happy, /aria-label="开心"/);
  assert.doesNotMatch(happy, /思考|出错|休眠/);
});

test('未知外形和颜色会回到圆圆叶绿，不会把坏颜色写进画面', () => {
  const svg = lookMarkup({ shape: 'alien', color: 'red', hat: 'ghost', mood: 'error' });
  assert.match(svg, /mood-idle/);
  assert.match(svg, /#93b7a0/);
  assert.doesNotMatch(svg, /fill="red"/);
});

test('颜色加减停在 0 和 255', () => {
  assert.equal(shade('#000000', -40), '#000000');
  assert.equal(shade('#ffffff', 40), '#ffffff');
  assert.notEqual(shade('#93b7a0', 36), '#93b7a0');
});

test('开心会自己结束，好奇按住时不结束', () => {
  const clock = createMoodClock();
  assert.equal(setMood(clock, 'happy'), true);
  assert.equal(stepMood(clock, 1.8), 'idle');
  assert.equal(clock.name, 'idle');
  setMood(clock, 'curious', { hold: true });
  assert.equal(stepMood(clock, 8), 'curious');
  setMood(clock, 'idle');
  assert.equal(clock.name, 'idle');
  assert.equal(clock.held, false);
});

test('说话不会盖住正在开心', () => {
  const clock = createMoodClock();
  setMood(clock, 'happy');
  assert.equal(setMood(clock, 'talking', { soft: true }), false);
  assert.equal(clock.name, 'happy');
});

test('眨眼会闭上再睁开，不会一直闭着', () => {
  const blink = createBlink(() => 0);
  let sawShut = false;
  let sawOpenAfter = false;
  for (let t = 0; t < 6; t += 0.05) {
    const shut = stepBlink(blink, 0.05);
    if (shut) sawShut = true;
    else if (sawShut) sawOpenAfter = true;
  }
  assert.equal(sawShut, true);
  assert.equal(sawOpenAfter, true);
  assert.equal(blink.shutFor <= 0.1, true);
});

test('外谷能接住 applyLook，只换自己的衣服颜色，不改相机', () => {
  const shared = { hex: '#f2d27a', set(next) { this.hex = next; } };
  const material = {
    color: shared,
    clone() {
      const color = { hex: shared.hex, set(next) { this.hex = next; } };
      return { color };
    },
  };
  const shirt = { material, userData: {} };
  const camera = { yaw: 0.64, distance: 20, fov: 43 };
  const host = {
    player: { userData: { shirt }, scale: { set() {} } },
    time: 0,
    camera,
    yaw: camera.yaw,
    distance: camera.distance,
  };
  bindMood(host);
  assert.equal(typeof host.applyLook, 'function');
  host.applyLook({ color: 'sky' });
  assert.equal(shirt.userData.ownMat.color.hex, '#7eb6d6');
  assert.equal(shared.hex, '#f2d27a');
  host.applyLook({ color: 'berry' });
  assert.equal(shirt.userData.ownMat.color.hex, '#e07a8a');
  host.applyLook(null);
  assert.equal(shirt.userData.ownMat.color.hex, '#e07a8a');
  const bare = { player: { userData: {} }, yaw: 0.2, distance: 16 };
  paintOuterLook(bare, { color: 'sand' });
  bindMood(bare);
  bare.applyLook({ color: 'sand' });
  host.setMood('happy');
  host.time = 0.2;
  const mood = host.stepMoodScale(0.05);
  assert.equal(mood, 'happy');
  assert.equal(camera.yaw, 0.64);
  assert.equal(camera.distance, 20);
  assert.equal(camera.fov, 43);
  assert.equal(host.yaw, 0.64);
  assert.equal(bare.yaw, 0.2);
  assert.equal(bare.distance, 16);
});

test('瞳孔跟随有上限', () => {
  const near = pupilShift(10, 0);
  const far = pupilShift(400, 0);
  assert.ok(near.x > 0 && near.x < 3.2);
  assert.ok(Math.abs(far.x - 3.2) < 0.001);
  assert.equal(pupilShift(0, 0).x, 0);
});
