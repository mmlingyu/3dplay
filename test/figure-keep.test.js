import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState, createInitialState, salvageSave } from '../src/game-state.js';
import { DAMAGED_BACKUP_KEY, STORAGE_KEY } from '../src/game-data.js';

function memory() {
  const data = new Map();
  return {
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

function withFigure(name, id = 'fig-1') {
  const save = createInitialState();
  save.creation.nextId = 2;
  save.creation.figures.push({
    id,
    figure: {
      name,
      scale: 1,
      parts: [{ id: 'body', parent: null, pivot: [0, 0, 0], anim: 'none', shapes: [{ shape: 'sphere', at: [0, 0.4, 0], color: '#f4f1ea', radius: 0.35 }] }],
    },
    placed: { x: 2, z: 3, rotY: 0 },
    assetId: null,
  });
  return save;
}

test('an empty world reloads creatures kept in the backup', () => {
  const store = memory();
  const empty = createInitialState();
  empty.inventory.plank = 3;
  store.setItem(STORAGE_KEY, JSON.stringify(empty));
  store.setItem(DAMAGED_BACKUP_KEY, JSON.stringify(withFigure('奥特曼')));
  const game = new GameState(store);
  assert.equal(game.state.creation.figures[0].figure.name, '奥特曼');
  assert.equal(game.state.creation.figures[0].placed.x, 2);
  assert.equal(game.state.inventory.plank, 3);
});

test('a broken creation record still keeps a valid creature', () => {
  const broken = withFigure('小鸟');
  broken.creation.drafts = [{ id: 'not-a-draft' }];
  const restored = salvageSave(broken);
  assert.equal(restored.creation.figures[0].figure.name, '小鸟');
  assert.equal(restored.creation.drafts.length, 0);
});
