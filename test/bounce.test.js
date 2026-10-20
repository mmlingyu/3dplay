import test from 'node:test';
import assert from 'node:assert/strict';
import { BOUNCE_ISLAND, PARK_NAME, PLAY_MODES, bounceInfo, bounceSurface, bounceWord, bounceZh, inNumberPark, onBounceIsland, parkPadAt, playBounce, playMode } from '../src/bounce-data.js';

test('蹦床数字带英文和中文', () => {
  const first = bounceInfo(1);
  assert.equal(first.count, 1);
  assert.equal(first.word, 'one');
  assert.equal(first.zh, '一');
  assert.equal(first.even, false);
  assert.equal(first.note, 'first · 第一下');
  assert.equal(bounceInfo(2).word, 'two');
  assert.equal(bounceInfo(2).note, '1 + 1 = 2');
  assert.equal(bounceInfo(4).note, '2 + 2 = 4');
  assert.equal(bounceInfo(3).even, false);
  assert.equal(bounceInfo(6).even, true);
  assert.equal(bounceInfo(6).note, 'even · 双数');
  assert.equal(bounceInfo(7).note, 'odd · 单数');
  assert.equal(bounceWord(21), 'twenty-one');
  assert.equal(bounceZh(10), '十');
});

test('数字乐园进阶玩法', () => {
  assert.equal(PARK_NAME, '数字乐园');
  assert.equal(PLAY_MODES.length, 6);
  assert.equal(playMode('times').ages, '8+');
  assert.equal(playBounce('even', 1).count, 2);
  assert.equal(playBounce('even', 2).formula, '2 + 2 = 4');
  assert.equal(playBounce('make10', 7).formula, '7 + 3 = 10');
  assert.equal(playBounce('make10', 10).milestone, true);
  assert.equal(playBounce('skip', 3, { step: 5 }).count, 15);
  assert.equal(playBounce('skip', 3, { step: 5 }).formula, '10 + 5 = 15');
  assert.equal(playBounce('times', 4, { table: 3 }).formula, '4 × 3 = 12');
  assert.equal(playBounce('times', 4, { table: 3 }).word, 'twelve');
  assert.match(playBounce('times', 4, { table: 3 }).speechEn, /four times three equals twelve/i);
  assert.equal(playBounce('prime', 1).note.includes('不是质数'), true);
  assert.equal(playBounce('prime', 7).tone, 'prime');
  assert.equal(playBounce('prime', 9).formula, '9 = 3 × 3');
  assert.equal(playBounce('count', 0).word, '数一数');
});

test('小岛范围和坡道高度', () => {
  assert.equal(onBounceIsland(BOUNCE_ISLAND.x, BOUNCE_ISLAND.z), true);
  assert.equal(onBounceIsland(0, 0), false);
  assert.equal(bounceSurface(BOUNCE_ISLAND.x, BOUNCE_ISLAND.z), BOUNCE_ISLAND.height);
  assert.ok(bounceSurface(BOUNCE_ISLAND.rampMinX + 0.2, BOUNCE_ISLAND.z) > 0);
  assert.equal(bounceSurface(0, 0), null);
  assert.equal(parkPadAt(BOUNCE_ISLAND.x + playMode('even').dx, BOUNCE_ISLAND.z + playMode('even').dz), 'even');
  assert.equal(inNumberPark(BOUNCE_ISLAND.x + playMode('times').dx, BOUNCE_ISLAND.z + playMode('times').dz), true);
  assert.equal(inNumberPark(0, 0), false);
});
