import assert from 'node:assert/strict';
import test from 'node:test';
import { yardPlankCount } from '../src/yard-goal.js';

test('小院第一块木板算 1/6，看得见的院边也算', () => {
  assert.equal(yardPlankCount([]), 0);
  assert.equal(yardPlankCount([{ item: 'plank', x: -5, y: 0, z: 5 }]), 1);
  assert.equal(yardPlankCount([{ item: 'plank', x: -7.2, y: 0, z: 3.4 }]), 1);
  assert.equal(yardPlankCount([{ item: 'plank', x: 9, y: 0, z: 5 }]), 0);
  const many = [];
  for (let i = 0; i < 8; i += 1) many.push({ item: 'plank', x: -6 + (i % 3), y: 0, z: 4 + Math.floor(i / 3) });
  assert.equal(yardPlankCount(many), 6);
});
