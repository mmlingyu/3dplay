import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/game-state.js';

const { WorkshopSession }=await import('../src/workshop-session.js').catch(()=>({}));
const create=large=>{
  assert.equal(typeof WorkshopSession,'function','存在可验证的实体工坊试摆会话');
  return new WorkshopSession(new GameState(null),{large});
};

test('实体插槽试摆不消耗，原配方确认一次才提交，关闭后不再制作',()=>{
  const session=create(false),g=session.game,before={...g.state.inventory};
  assert.ok(session.put(0,0,'wood'));
  assert.deepEqual(g.state.inventory,before);
  assert.equal(session.snapshot().ready,true);
  assert.ok(session.craft().ok);
  assert.equal(g.state.inventory.wood,before.wood-1);
  assert.equal(g.state.inventory.plank,before.plank+4);
  assert.equal(session.craft().ok,false);
  session.example('planks');session.dispose();
  assert.equal(session.craft().ok,false);
});

test('四块木板只做工作台，两块木板只做木球，不能凭空制造',()=>{
  const session=create(false),g=session.game;
  assert.equal(session.resize(3),false);
  for(const [x,y] of [[0,0],[1,0],[0,1],[1,1]])session.put(x,y,'plank');
  assert.equal(session.snapshot().selectedRecipe,'workbench');
  assert.equal(session.snapshot().ready,true);
  const before={...g.state.inventory};
  assert.equal(session.choose('unknown'),false);
  assert.ok(session.craft().ok);
  assert.equal(g.state.inventory.workbench,before.workbench+1);
  assert.equal(g.state.inventory.plank,before.plank-4);
  session.put(0,0,'plank');session.put(1,0,'plank');
  assert.equal(session.snapshot().selectedRecipe,'ball');
  assert.ok(session.craft().ok);
  assert.equal(g.state.inventory.ball,before.ball+1);
  g.state.inventory.wood=0;session.example('planks');
  assert.equal(session.snapshot().ready,false);assert.equal(session.craft().ok,false);
  assert.equal(session.put(-1,0,'wood'),false);
  assert.equal(session.put(0,0,'unknown'),false);
  assert.equal(session.example('chest'),false);
});

test('公共工作台大插槽可做空心箱，移动/取出和目标演示都不扣料',()=>{
  const session=create(true),g=session.game;
  assert.ok(session.resize(3));assert.ok(session.example('chest'));
  assert.equal(session.grid[1][1],null);
  const before={...g.state.inventory};
  assert.ok(session.move(0,0,1,1));
  assert.equal(session.grid[0][0],null);assert.equal(session.grid[1][1],'plank');
  assert.deepEqual(g.state.inventory,before);
  assert.equal(session.snapshot().ready,false);
  session.example('chest');assert.ok(session.craft().ok);
  assert.equal(g.state.inventory.chest,before.chest+1);
  assert.equal(g.state.inventory.plank,before.plank-8);
  session.put(0,0,'wood');session.put(0,0,null);
  assert.equal(session.grid[0][0],null);
});
