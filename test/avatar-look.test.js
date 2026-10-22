import assert from 'node:assert/strict';
import test from 'node:test';
import { GameState, createInitialState } from '../src/game-state.js';
import { GUEST_PLAYER_NAME, resolvePlayerName } from '../src/game-data.js';
import { defaultLook, normalizeLook } from '../src/avatar-data.js';

test('没选名字时仍叫小谷，选了名字就用选的', () => {
  assert.equal(resolvePlayerName(defaultLook(), null), GUEST_PLAYER_NAME);
  assert.equal(resolvePlayerName({ name: '  豆豆  ' }, { name: '账号' }), '豆豆');
  assert.equal(resolvePlayerName({ name: '' }, { name: '账号' }), '账号');
  assert.equal(normalizeLook({ name: '豆豆果果小星团团呀', shape: 'nope', color: 'nope', hat: 'nope' }).name, '豆豆果果小星团团');
});

test('旧存档没有样子时不丢世界，玩过的直接接着玩', () => {
  const fresh = createInitialState();
  assert.equal(fresh.look.ready, false);
  const old = createInitialState();
  delete old.look;
  old.stats.built = 2;
  const storage = { data: new Map(), getItem(k) { return this.data.get(k) ?? null; }, setItem(k, v) { this.data.set(k, v); } };
  storage.setItem('yuanyuan-river-valley-v1', JSON.stringify(old));
  const game = new GameState(storage);
  assert.equal(game.state.look.ready, true);
  assert.equal(game.state.blocks.length, 0);
  assert.equal(game.save().ok, true);
  assert.equal(storage.getItem('yuanyuan-river-valley-v1-before-look') == null, false);
});

test('新游戏第一次保存不额外写样子备份', () => {
  const storage = { data: new Map(), getItem(k) { return this.data.get(k) ?? null; }, setItem(k, v) { this.data.set(k, v); } };
  const game = new GameState(storage);
  assert.equal(game.save().ok, true);
  assert.equal(storage.getItem('yuanyuan-river-valley-v1-before-look'), null);
});
