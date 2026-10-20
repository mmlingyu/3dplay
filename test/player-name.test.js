import test from 'node:test';
import assert from 'node:assert/strict';
import { GUEST_PLAYER_NAME, playerDisplayName } from '../src/game-data.js';

test('未登录或没有名字时角色叫小谷', () => {
  assert.equal(GUEST_PLAYER_NAME, '小谷');
  assert.equal(playerDisplayName(null), '小谷');
  assert.equal(playerDisplayName({}), '小谷');
  assert.equal(playerDisplayName({ name: '   ' }), '小谷');
});

test('已登录用账号名称作为角色名', () => {
  assert.equal(playerDisplayName({ name: '阿谷' }), '阿谷');
  assert.equal(playerDisplayName({ name: '  阿谷  ' }), '阿谷');
});
