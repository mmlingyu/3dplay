import assert from 'node:assert/strict';
import test from 'node:test';
import { planStack } from '../src/overlay-layout.js';

function boxes(result) {
  return result.placements.filter((item) => !item.parked);
}

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

test('热气球、开垦和下一章上下分开，不压过安全区', () => {
  const plan = planStack({
    safeTop: 78,
    safeBottom: 586,
    center: 512,
    maxWidth: 560,
    items: [
      { id: 'balloon-hud', role: 'control', priority: 80, width: 220, height: 389 },
      { id: 'land-question', role: 'prompt', priority: 70, width: 330, height: 136 },
      { id: 'tour-guide', role: 'prompt', priority: 50, width: 560, height: 92, collapseTo: 64 },
      { id: 'story-banner', role: 'notice', priority: 60, width: 400, height: 92 },
      { id: 'context-hint', role: 'hint', priority: 10, width: 315, height: 35 },
    ],
  });
  const byId = Object.fromEntries(plan.placements.map((item) => [item.id, item]));
  assert.equal(byId['balloon-hud'].parked, false);
  assert.equal(byId['balloon-hud'].scroll, false);
  assert.equal(byId['balloon-hud'].height, 389);
  assert.equal(byId['land-question'].parked, true);
  assert.equal(byId['tour-guide'].parked, false);
  assert.equal(byId['tour-guide'].collapsed, false);
  assert.equal(byId['story-banner'].parked, true);
  assert.equal(byId['context-hint'].parked, true);
  const open = boxes(plan);
  for (const box of open) {
    assert.ok(box.y >= 78 - 0.1, box.id);
    assert.ok(box.y + box.height <= 586 + 0.1, box.id);
  }
  for (let i = 0; i < open.length; i += 1) {
    for (let j = i + 1; j < open.length; j += 1) assert.equal(overlaps(open[i], open[j]), false, `${open[i].id} ${open[j].id}`);
  }
});

test('对话框打开时，其他提示先让开', () => {
  const plan = planStack({
    safeTop: 70,
    safeBottom: 600,
    center: 512,
    maxWidth: 520,
    items: [
      { id: 'story-talk', role: 'dialog', priority: 90, width: 420, height: 460 },
      { id: 'land-question', role: 'prompt', priority: 70, width: 330, height: 136 },
      { id: 'balloon-hud', role: 'control', priority: 80, width: 220, height: 300 },
    ],
  });
  const byId = Object.fromEntries(plan.placements.map((item) => [item.id, item]));
  assert.equal(byId['story-talk'].parked, false);
  assert.equal(byId['land-question'].parked, true);
  assert.equal(byId['balloon-hud'].parked, true);
  assert.ok(byId['story-talk'].y + byId['story-talk'].height <= 600);
});

test('出发说明和热气球标题可以同时看见', () => {
  const plan = planStack({
    safeTop: 78,
    safeBottom: 586,
    center: 512,
    maxWidth: 520,
    items: [
      { id: 'travel-cutscene', role: 'dialog', priority: 92, width: 420, height: 180 },
      { id: 'balloon-hud', role: 'control', priority: 80, width: 220, height: 389 },
    ],
  });
  const byId = Object.fromEntries(plan.placements.map((item) => [item.id, item]));
  assert.equal(byId['travel-cutscene'].parked, false);
  assert.equal(byId['balloon-hud'].parked, false);
  assert.equal(overlaps(byId['travel-cutscene'], byId['balloon-hud']), false);
  assert.ok(byId['balloon-hud'].y + byId['balloon-hud'].height <= byId['travel-cutscene'].y);
});

test('发现章留在热气球旁边', () => {
  const plan = planStack({
    safeTop: 78,
    safeBottom: 586,
    center: 512,
    maxWidth: 520,
    items: [
      { id: 'balloon-hud', role: 'control', priority: 80, width: 220, height: 389 },
      { id: 'vista-stamp', role: 'notice', priority: 55, width: 180, height: 120 },
      { id: 'story-banner', role: 'notice', priority: 60, width: 400, height: 92 },
    ],
  });
  const byId = Object.fromEntries(plan.placements.map((item) => [item.id, item]));
  assert.equal(byId['vista-stamp'].parked, false);
  assert.equal(byId['balloon-hud'].parked, false);
  assert.equal(byId['story-banner'].parked, true);
  assert.equal(overlaps(byId['vista-stamp'], byId['balloon-hud']), false);
});

test('热气球占满时，下一步先排队，不裁切热气球按钮', () => {
  const plan = planStack({
    safeTop: 78,
    safeBottom: 470,
    center: 512,
    maxWidth: 560,
    items: [
      { id: 'balloon-hud', role: 'control', priority: 80, width: 220, height: 389 },
      { id: 'land-question', role: 'prompt', priority: 70, width: 330, height: 136 },
      { id: 'tour-guide', role: 'prompt', priority: 50, width: 560, height: 92, collapseTo: 64 },
    ],
  });
  const byId = Object.fromEntries(plan.placements.map((item) => [item.id, item]));
  assert.equal(byId['balloon-hud'].parked, false);
  assert.equal(byId['balloon-hud'].height, 389);
  assert.equal(byId['balloon-hud'].scroll, false);
  assert.equal(byId['tour-guide'].parked, true);
  assert.equal(byId['land-question'].parked, true);
  const open = boxes(plan);
  for (let i = 0; i < open.length; i += 1) {
    for (let j = i + 1; j < open.length; j += 1) assert.equal(overlaps(open[i], open[j]), false);
    assert.ok(open[i].y + open[i].height <= 470.1);
  }
});

test('竖向空间只够一行时，下一步收成一行', () => {
  const plan = planStack({
    safeTop: 78,
    safeBottom: 470,
    center: 512,
    maxWidth: 560,
    items: [
      { id: 'balloon-hud', role: 'control', priority: 80, width: 220, height: 306 },
      { id: 'tour-guide', role: 'prompt', priority: 50, width: 560, height: 92, collapseTo: 64 },
    ],
  });
  const guide = plan.placements.find((item) => item.id === 'tour-guide');
  const balloon = plan.placements.find((item) => item.id === 'balloon-hud');
  assert.equal(balloon.scroll, false);
  assert.equal(balloon.height, 306);
  assert.equal(guide.parked, false);
  assert.equal(guide.collapsed, true);
  assert.equal(overlaps(balloon, guide), false);
});

test('观星卡让开开垦，热气球和下一步仍留在画面里', () => {
  const plan = planStack({
    safeTop: 100,
    safeBottom: 587,
    center: 512,
    maxWidth: 560,
    items: [
      { id: 'balloon-hud', role: 'control', priority: 80, width: 220, height: 389 },
      { id: 'vista-card', role: 'prompt', priority: 62, width: 358, height: 220 },
      { id: 'land-question', role: 'prompt', priority: 70, width: 330, height: 136 },
      { id: 'tour-guide', role: 'prompt', priority: 50, width: 560, height: 92, collapseTo: 64 },
    ],
  });
  const byId = Object.fromEntries(plan.placements.map((item) => [item.id, item]));
  assert.equal(byId['land-question'].parked, true);
  assert.equal(byId['balloon-hud'].parked, false);
  assert.equal(byId['balloon-hud'].height, 389);
  assert.equal(byId['tour-guide'].collapsed, true);
  assert.equal(byId['vista-card'].parked, false);
  assert.ok(byId['vista-card'].x + byId['vista-card'].width <= byId['balloon-hud'].x);
  assert.equal(overlaps(byId['vista-card'], byId['balloon-hud']), false);
  assert.equal(overlaps(byId['vista-card'], byId['tour-guide']), false);
  const open = boxes(plan);
  for (let i = 0; i < open.length; i += 1) {
    for (let j = i + 1; j < open.length; j += 1) assert.equal(overlaps(open[i], open[j]), false);
    assert.ok(open[i].y >= 100 - 0.1);
    assert.ok(open[i].y + open[i].height <= 587.1);
  }
});

test('热气球很宽时，观星卡缩到左侧空位', () => {
  const plan = planStack({
    safeTop: 78,
    safeBottom: 586,
    center: 512,
    maxWidth: 560,
    items: [
      { id: 'balloon-hud', role: 'control', priority: 80, width: 400, height: 389 },
      { id: 'vista-card', role: 'prompt', priority: 62, width: 358, height: 220 },
    ],
  });
  const byId = Object.fromEntries(plan.placements.map((item) => [item.id, item]));
  assert.equal(byId['balloon-hud'].height, 389);
  assert.equal(byId['balloon-hud'].scroll, false);
  assert.equal(byId['vista-card'].parked, false);
  assert.equal(byId['vista-card'].x, 12);
  assert.ok(byId['vista-card'].width >= 200);
  assert.ok(byId['vista-card'].x + byId['vista-card'].width <= byId['balloon-hud'].x);
  assert.equal(overlaps(byId['vista-card'], byId['balloon-hud']), false);
});

test('两侧都放不下时，观星卡改到热气球下面', () => {
  const plan = planStack({
    safeTop: 78,
    safeBottom: 470,
    center: 400,
    maxWidth: 560,
    items: [
      { id: 'balloon-hud', role: 'control', priority: 80, width: 560, height: 360 },
      { id: 'vista-card', role: 'prompt', priority: 62, width: 358, height: 180 },
    ],
  });
  const byId = Object.fromEntries(plan.placements.map((item) => [item.id, item]));
  assert.equal(byId['balloon-hud'].parked, false);
  assert.equal(byId['balloon-hud'].scroll, true);
  assert.equal(byId['vista-card'].parked, false);
  assert.ok(byId['balloon-hud'].y + byId['balloon-hud'].height <= byId['vista-card'].y);
  assert.equal(overlaps(byId['vista-card'], byId['balloon-hud']), false);
  assert.ok(byId['vista-card'].y + byId['vista-card'].height <= 470.1);
});

test('窄屏幕上发现章改到热气球下面', () => {
  const plan = planStack({
    safeTop: 70,
    safeBottom: 537,
    center: 195,
    maxWidth: 366,
    items: [
      { id: 'balloon-hud', role: 'control', priority: 80, width: 220, height: 400 },
      { id: 'vista-stamp', role: 'notice', priority: 55, width: 180, height: 120 },
    ],
  });
  const byId = Object.fromEntries(plan.placements.map((item) => [item.id, item]));
  assert.equal(byId['vista-stamp'].parked, false);
  assert.equal(byId['balloon-hud'].parked, false);
  assert.ok(byId['balloon-hud'].y + byId['balloon-hud'].height <= byId['vista-stamp'].y);
  assert.equal(overlaps(byId['vista-stamp'], byId['balloon-hud']), false);
  assert.ok(byId['vista-stamp'].y + byId['vista-stamp'].height <= 537.1);
});

test('高得放不下时，观星卡排队', () => {
  const plan = planStack({
    safeTop: 78,
    safeBottom: 280,
    center: 400,
    maxWidth: 560,
    items: [
      { id: 'balloon-hud', role: 'control', priority: 80, width: 560, height: 180 },
      { id: 'vista-card', role: 'prompt', priority: 62, width: 358, height: 220 },
    ],
  });
  const byId = Object.fromEntries(plan.placements.map((item) => [item.id, item]));
  assert.equal(byId['balloon-hud'].parked, false);
  assert.equal(byId['balloon-hud'].scroll, false);
  assert.equal(byId['vista-card'].parked, true);
});

test('只有下一步时保持整段文字', () => {
  const plan = planStack({
    safeTop: 70,
    safeBottom: 600,
    center: 400,
    maxWidth: 560,
    items: [{ id: 'tour-guide', role: 'prompt', priority: 50, width: 560, height: 92, collapseTo: 64 }],
  });
  const guide = plan.placements[0];
  assert.equal(guide.collapsed, false);
  assert.equal(guide.height, 92);
  assert.ok(guide.y + guide.height <= 600);
});
