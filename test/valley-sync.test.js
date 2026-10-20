import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseSpace, personalScore, readSaveText } from '../src/valley-sync.js';
import { createInitialState } from '../src/game-state.js';

const userA = 'user-aaaa';
const userB = 'user-bbbb';

function world(name, extra = {}) {
  const save = createInitialState();
  if (name) {
    save.creation.figures.push({
      id: 'fig-1',
      figure: {
        name,
        scale: 1,
        parts: [{ id: 'body', parent: null, pivot: [0, 0, 0], anim: 'none', shapes: [{ shape: 'sphere', at: [0, 0.4, 0], color: '#f4f1ea', radius: 0.35 }] }],
      },
      placed: { x: 2, z: 3, rotY: 0 },
      assetId: null,
    });
  }
  Object.assign(save, extra);
  return save;
}

test('an empty account keeps a richer browser copy that nobody else owns', () => {
  const local = world('奥特曼');
  const choice = chooseSpace({ userId: userA, ownerId: null, remote: null, local, backups: [] });
  assert.equal(choice.source, 'local');
  assert.equal(choice.save.creation.figures[0].figure.name, '奥特曼');
});

test('a damaged backup is used when the current browser world is empty', () => {
  const choice = chooseSpace({
    userId: userA,
    ownerId: null,
    remote: null,
    local: createInitialState(),
    backups: [world('小鸟')],
  });
  assert.equal(choice.source, 'backup');
  assert.equal(choice.save.creation.figures[0].figure.name, '小鸟');
});

test('another person does not receive this browser world', () => {
  const local = world('奥特曼');
  local.inventory.plank += 6;
  local.blocks.push({ id: 'block-1', item: 'plank', x: 0, y: 0, z: 0, rotation: 0 });
  const choice = chooseSpace({
    userId: userB,
    ownerId: userA,
    remote: null,
    local,
    backups: [world('小鸟')],
  });
  assert.equal(choice.source, 'fresh');
  assert.equal(choice.save, null);
});

test('the account valley brings back that person\'s backpack and buildings', () => {
  const remote = createInitialState();
  remote.inventory.plank = 3;
  remote.blocks = [{ id: 'block-1', item: 'plank', x: 0, y: 0, z: 0, rotation: 0 }];
  remote.stats.built = 1;
  const choice = chooseSpace({
    userId: userA,
    ownerId: userB,
    remote,
    local: world('小鸟'),
    backups: [],
  });
  assert.equal(choice.source, 'remote');
  assert.equal(choice.save.inventory.plank, 3);
  assert.equal(choice.save.blocks.length, 1);
});

test('a signed-in account loads its own saved valley', () => {
  const remote = world('奥特曼');
  remote.settings.sound = false;
  const choice = chooseSpace({
    userId: userA,
    ownerId: userB,
    remote,
    local: world('小鸟'),
    backups: [],
  });
  assert.equal(choice.source, 'remote');
  assert.equal(choice.save.settings.sound, false);
  assert.equal(choice.save.creation.figures[0].figure.name, '奥特曼');
});

test('the same account keeps the browser copy when it has more work than the server', () => {
  const local = world('奥特曼');
  local.blocks.push({ id: 'block-1', item: 'plank', x: 0, y: 0, z: 0, rotation: 0 });
  const choice = chooseSpace({ userId: userA, ownerId: userA, remote: world('小鸟'), local, backups: [] });
  assert.equal(choice.source, 'local');
  assert.equal(personalScore(local) > personalScore(world('小鸟')), true);
});

test('a rejected world can still restore a valid creature', () => {
  const broken = world('小鸟');
  broken.inventory = { notAMaterial: 1 };
  const restored = readSaveText(JSON.stringify(broken));
  assert.equal(restored.creation.figures[0].figure.name, '小鸟');
  assert.equal(restored.inventory.wood, createInitialState().inventory.wood);
});

test('a rejected creature does not drop the backpack or the buildings', () => {
  const broken = createInitialState();
  broken.inventory.stone = 11;
  broken.blocks = [{ id: 'block-1', item: 'plank', x: 0, y: 0, z: 0, rotation: 0 }];
  broken.creation = { schemaVersion: 1 };
  const restored = readSaveText(JSON.stringify(broken));
  assert.equal(restored.inventory.stone, 11);
  assert.equal(restored.blocks[0].item, 'plank');
  assert.equal(restored.creation.figures.length, 0);
});
