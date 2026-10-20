import test from 'node:test';
import assert from 'node:assert/strict';
import * as life from '../src/life-data.js';

test('季节按北温带月份对齐本地日期', () => {
  const season = (iso) => life.realMoment(new Date(iso)).season;
  assert.equal(season('2026-03-01T10:00:00'), '春');
  assert.equal(season('2026-05-31T10:00:00'), '春');
  assert.equal(season('2026-06-01T12:00:00'), '夏');
  assert.equal(season('2026-08-31T12:00:00'), '夏');
  assert.equal(season('2026-09-01T15:00:00'), '秋');
  assert.equal(season('2026-10-16T09:30:00'), '秋');
  assert.equal(season('2026-11-30T15:00:00'), '秋');
  assert.equal(season('2026-12-01T08:00:00'), '冬');
  assert.equal(season('2026-01-15T21:00:00'), '冬');
  assert.equal(season('2026-02-28T08:00:00'), '冬');
});

test('钟点和昼夜跟本地时刻走', () => {
  const morning = life.realMoment(new Date('2026-10-16T09:39:00'));
  assert.equal(morning.hour, 9);
  assert.equal(morning.minute, 39);
  assert.equal(morning.period, '早上');
  assert.equal(morning.dateLabel, '10月16日');
  assert.equal(life.realMoment(new Date('2026-07-01T12:10:00')).period, '中午');
  assert.equal(life.realMoment(new Date('2026-07-01T15:00:00')).period, '下午');
  assert.equal(life.realMoment(new Date('2026-07-01T18:30:00')).period, '晚上');
  assert.equal(life.realMoment(new Date('2026-01-15T21:05:00')).period, '晚上');
  assert.equal(life.realMoment(new Date('2026-01-15T23:10:00')).period, '深夜');
  assert.equal(life.realMoment(new Date('2026-01-15T05:59:00')).period, '早上');
  assert.equal(life.realMoment(new Date('2026-04-02T06:00:00')).period, '早上');
});

test('同一天天气稳定，并带有季节特征', () => {
  const day = new Date('2026-10-16T09:00:00');
  const later = new Date('2026-10-16T21:00:00');
  assert.equal(life.weatherKind(day), life.weatherKind(later));
  assert.ok(['sun', 'wind', 'cloud', 'fog'].includes(life.weatherKind(day)));
  const winter = life.realMoment(new Date('2026-01-15T11:00:00'));
  assert.ok(['snow', 'cloud', 'fog'].includes(winter.weather.kind));
  const summer = life.realMoment(new Date('2026-07-20T11:00:00'));
  assert.ok(['sun', 'cloud', 'storm'].includes(summer.weather.kind));
  assert.equal(life.skyLook(winter).grass, '#d7ddd4');
  assert.equal(life.skyLook(life.realMoment(new Date('2026-10-16T15:00:00'))).grass, '#c4a15a');
});

test('蒲公英阶段跟现实季节，不跟游戏日', () => {
  const plant = { age: 120 };
  assert.equal(life.floraStage(plant, { elapsed: 0 }, new Date('2026-04-10T11:00:00')), 'flower');
  assert.equal(life.floraStage(plant, { elapsed: 0 }, new Date('2026-04-10T21:00:00')), 'closed');
  assert.equal(life.floraStage(plant, { elapsed: 0 }, new Date('2026-10-16T11:00:00')), 'leaf');
  assert.equal(life.floraStage(plant, { elapsed: 0 }, new Date('2026-01-15T11:00:00')), 'rest');
});
