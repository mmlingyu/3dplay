import assert from 'node:assert/strict';
import test from 'node:test';
import { LOOK_HATS, LOOK_SHAPES } from '../src/avatar-data.js';
import {
  createBlink,
  createMoodClock,
  lookMarkup,
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

test('瞳孔跟随有上限', () => {
  const near = pupilShift(10, 0);
  const far = pupilShift(400, 0);
  assert.ok(near.x > 0 && near.x < 3.2);
  assert.ok(Math.abs(far.x - 3.2) < 0.001);
  assert.equal(pupilShift(0, 0).x, 0);
});
