import assert from 'node:assert/strict';
import test from 'node:test';
import { guideBrief, guideText, nearestShard, shardBoard } from '../src/story-data.js';
import { valleyLine } from '../src/valley-tutors.js';

function travel(flags = {}) {
  return {
    story: { fogIntro: true, restored: [], hintsOff: false, fogOff: false },
    realms: {
      ri: { storyShard: flags.ri === true },
      mei: { storyShard: flags.mei === true },
      xing: { storyShard: flags.xing === true },
    },
  };
}

test('奶奶不再把星河碎片说成珠子', () => {
  for (const band of ['junior', 'senior']) {
    const line = valleyLine('grandma', band);
    assert.equal(line.includes('珠子'), false);
    assert.match(line, /星河碎片/);
    assert.match(line, /日谷/);
    assert.match(line, /美谷/);
    assert.match(line, /热气球/);
  }
  assert.match(valleyLine('grandma', 'junior'), /雾会散的。你慢慢找，星河碎片还在。/);
});

test('没传位置时下一步短句仍是完整的一句', () => {
  const line = guideBrief({ story: { restored: [] }, realms: { ri: {}, mei: {}, xing: {} } });
  assert.match(line, /。$/);
  assert.equal(line.includes('…'), false);
  assert.ok(line.length < 24);
});

test('家门口最近的未拿碎片是渡口去日谷', () => {
  const line = guideBrief(travel(), { x: -5, z: 5 });
  assert.equal(line, '下一步：渡口坐船去日谷。');
  assert.ok(line.length < 24);
  assert.match(line, /。$/);
  const near = nearestShard(travel(), { x: -5, z: 5 });
  assert.equal(near.id, 'ri');
  assert.equal(near.spot, 'dock');
  const text = guideText(travel());
  assert.ok(text.length > line.length);
  assert.match(text, /潮之片/);
  assert.match(text, /光之片/);
  assert.match(text, /星之片/);
  assert.match(text, /还没有/);
});

test('拿到潮之片后，站在热气球旁就指向星之片', () => {
  const board = shardBoard(travel({ ri: true }));
  assert.equal(board.find((item) => item.id === 'ri').got, true);
  const line = guideBrief(travel({ ri: true }), { x: -4, z: 20 });
  assert.equal(line, '下一步：热气球找星之片。');
});
