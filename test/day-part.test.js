import test from 'node:test';
import assert from 'node:assert/strict';
import { dayPart, realMoment, skyLook } from '../src/life-data.js';

function at(hour, minute) {
  return new Date(2026, 9, 16, hour, minute, 0);
}

test('local clock maps onto morning, noon, afternoon, evening, and late night', () => {
  assert.equal(dayPart(4, 59), '深夜');
  assert.equal(dayPart(5, 0), '早上');
  assert.equal(dayPart(10, 59), '早上');
  assert.equal(dayPart(11, 0), '中午');
  assert.equal(dayPart(12, 59), '中午');
  assert.equal(dayPart(13, 0), '下午');
  assert.equal(dayPart(17, 59), '下午');
  assert.equal(dayPart(18, 0), '晚上');
  assert.equal(dayPart(22, 59), '晚上');
  assert.equal(dayPart(23, 0), '深夜');
  assert.equal(dayPart(0, 30), '深夜');
  assert.equal(realMoment(at(14, 20)).period, '下午');
});

test('noon is brighter and the sun sits higher than late night', () => {
  const noon = skyLook(realMoment(at(12, 0)));
  const late = skyLook(realMoment(at(1, 0)));
  const evening = skyLook(realMoment(at(19, 0)));
  assert.ok(noon.sun > evening.sun);
  assert.ok(evening.sun > late.sun);
  assert.ok(noon.sunY > evening.sunY);
  assert.notEqual(noon.sky, late.sky);
});
