import test from 'node:test';
import assert from 'node:assert/strict';
import { GLYPHS, PUZZLE_KINDS, fromAlien, gradePuzzle, kindsFor, makePuzzle, toAlien } from '../src/glyph-data.js';

test('同一个种子生成同一道题，而且只有一个正确答案', () => {
  assert.ok(GLYPHS.length >= 16 && GLYPHS.length <= 24);
  for (const band of ['little', 'bigger', 'older']) {
    for (const kind of PUZZLE_KINDS[band]) {
      const first = makePuzzle(band, kind, `seed-${band}-${kind}`);
      const second = makePuzzle(band, kind, `seed-${band}-${kind}`);
      assert.deepEqual(second, first);
      const winners = first.choices.filter((choice) => choice.ok);
      assert.equal(winners.length, 1);
      assert.equal(gradePuzzle(first, winners[0].id).ok, true);
      const wrong = first.choices.find((choice) => !choice.ok);
      assert.equal(gradePuzzle(first, wrong.id).ok, false);
    }
  }
});

test('四进制在 0 到 63 之间来回都对', () => {
  assert.equal(toAlien(0), '0');
  assert.equal(toAlien(4), '10');
  assert.equal(toAlien(15), '33');
  assert.equal(toAlien(63), '333');
  assert.equal(fromAlien('10'), 4);
  assert.equal(fromAlien('33'), 15);
  assert.equal(fromAlien('333'), 63);
  for (let n = 0; n <= 63; n += 1) assert.equal(fromAlien(toAlien(n)), n);
  assert.equal(fromAlien('3333'), null);
  assert.throws(() => toAlien(64));
  assert.throws(() => toAlien(-1));
});

test('年龄档的题型和设计表一致', () => {
  assert.deepEqual(kindsFor('little'), ['pair', 'color', 'count']);
  assert.deepEqual(kindsFor('bigger'), ['pair', 'color', 'count', 'order']);
  assert.deepEqual(kindsFor('older'), ['pair', 'color', 'count', 'order']);
  assert.equal(makePuzzle('little', 'order', 1), null);
  const older = makePuzzle('older', 'count', 7);
  assert.equal(older.base4, true);
  assert.equal(fromAlien(older.alien), older.decimal);
});
