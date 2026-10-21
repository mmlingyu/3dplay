import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState, createInitialState } from '../src/game-state.js';
import { STORY_BACKUP_KEY, STORAGE_KEY } from '../src/game-data.js';
import { AGE_BANDS, emptyRealm, normalizeAgeBand } from '../src/realm-data.js';
import { readStory } from '../src/travel-save.js';
import { tourStorage, TOUR_STORAGE_KEY, CHILD_STORAGE_KEY, isTour } from '../src/tour-mode.js';
import {
  applySkip,
  fogProfile,
  pendingZones,
  prologueTrigger,
  storyChapter,
  storyFog,
} from '../src/story-data.js';

class MemoryStorage {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

function oldSave() {
  const save = createInitialState();
  save.inventory.wood = 11;
  save.blocks = [{ id: 'block-1', item: 'plank', x: -2, y: 0, z: 1, rotation: 0, w: 1, d: 1 }];
  save.nextId = 2;
  save.settings.ageBand = 'little';
  save.travel.story = { seen: ['letter-ri-1'], letters: ['letter-ri-1'] };
  save.travel.realms.ri = emptyRealm('ri');
  return save;
}

test('旧存档没有雾字段时不把河谷变灰，第一次写入前备份', () => {
  const save = oldSave();
  const text = JSON.stringify(save);
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, text);
  const game = new GameState(storage);
  assert.equal(game.state.inventory.wood, 11);
  assert.equal(game.state.blocks[0].item, 'plank');
  assert.equal(game.state.settings.ageBand, 'junior');
  assert.equal(game.state.travel.story.fogIntro, false);
  assert.deepEqual(game.state.travel.story.restored, []);
  assert.equal(game.state.travel.story.fogOff, false);
  assert.deepEqual(game.state.travel.story.letters, ['letter-ri-1']);
  const look = storyFog({ travel: game.state.travel, ageBand: game.state.settings.ageBand, height: 0 });
  assert.equal(look.visible, false);
  assert.equal(look.density, 0);
  game.save();
  assert.equal(storage.getItem(STORY_BACKUP_KEY), text);
  game.save();
  assert.equal(storage.getItem(`${STORY_BACKUP_KEY}-1`), null);
  const again = new GameState(storage);
  assert.equal(again.state.inventory.wood, 11);
  assert.equal(again.state.blocks.length, 1);
  assert.equal(again.state.travel.story.fogIntro, false);
});

test('碎片字段缺失当作 false，任意顺序恢复对应区域', () => {
  const bare = readStory({ seen: [], letters: [] });
  assert.equal(bare.fogIntro, false);
  const travel = {
    story: { fogIntro: true, restored: [], fogOff: false, homePlaces: [] },
    realms: { xing: { storyShard: true } },
  };
  assert.equal(travel.realms.ri?.storyShard === true, false);
  assert.deepEqual(pendingZones(travel), ['sky']);
  travel.story.restored = ['sky'];
  travel.realms.mei = { storyShard: true };
  assert.deepEqual(pendingZones(travel), ['light']);
  travel.story.restored = ['sky', 'light'];
  travel.realms.ri = { storyShard: true };
  assert.deepEqual(pendingZones(travel), ['water']);
  travel.story.restored = ['water', 'light', 'sky'];
  travel.story.homePlaces = ['yard', 'garden', 'dock'];
  assert.deepEqual(pendingZones(travel), ['all']);
  assert.equal(storyChapter(travel), 'finale');
});

test('序章由夜晚或热气球高度触发，体验模式一进河谷也触发', () => {
  assert.equal(prologueTrigger({ period: '中午', height: 0 }), null);
  assert.equal(prologueTrigger({ period: '晚上', height: 0 }), 'night');
  assert.equal(prologueTrigger({ period: '深夜', height: 1 }), 'night');
  assert.equal(prologueTrigger({ period: '中午', height: 12 }), 'balloon');
  assert.equal(prologueTrigger({ period: '中午', height: 11.9 }), null);
  assert.equal(prologueTrigger({ touring: true }), 'tour');
  assert.equal(prologueTrigger({ fogIntro: true, period: '晚上', height: 20, touring: true }), null);
});

test('6到8岁雾更淡更暖，升到12格以上就在雾上面，家长可以关', () => {
  assert.deepEqual(AGE_BANDS.map((item) => item.id), ['junior', 'senior']);
  const young = fogProfile('little');
  const older = fogProfile('older');
  assert.equal(young.density * 2, older.density);
  assert.equal(young.warm, true);
  assert.equal(older.warm, false);
  assert.equal(young.icon, true);
  const travel = {
    story: { fogIntro: true, restored: [], fogOff: false },
    realms: {},
  };
  const low = storyFog({ travel, ageBand: 'junior', height: 0 });
  const high = storyFog({ travel, ageBand: 'senior', height: 12 });
  assert.equal(low.visible, true);
  assert.ok(low.density > 0 && low.density < storyFog({ travel, ageBand: 'senior', height: 0 }).density);
  assert.equal(high.visible, false);
  assert.equal(high.above, true);
  assert.equal(high.density, 0);
  travel.story.fogOff = true;
  assert.equal(storyFog({ travel, ageBand: 'senior', height: 0 }).visible, false);
});

test('三片齐了还留淡雾，刻完家之片才散', () => {
  const travel = {
    story: { fogIntro: true, restored: ['water', 'light', 'sky'], fogOff: false, homePlaces: [] },
    realms: { ri: { storyShard: true }, mei: { storyShard: true }, xing: { storyShard: true } },
  };
  const mist = storyFog({ travel, ageBand: 'junior', height: 0 });
  const oneLeft = storyFog({
    travel: { story: { ...travel.story, restored: ['water', 'light'] }, realms: travel.realms },
    ageBand: 'junior',
    height: 0,
  });
  assert.equal(storyChapter(travel), 'finale');
  assert.equal(mist.visible, true);
  assert.equal(mist.zones.all, false);
  assert.ok(mist.density > 0 && mist.density < oneLeft.density);
  travel.story.restored = ['water', 'light', 'sky', 'all'];
  const clear = storyFog({ travel, ageBand: 'junior', height: 0 });
  assert.equal(clear.visible, false);
  assert.equal(clear.density, 0);
  assert.equal(clear.zones.all, true);
  const during = storyFog({ travel, ageBand: 'junior', height: 0, reveal: { zone: 'all' } });
  assert.equal(during.visible, false);
  assert.equal(during.density, 0);
});

test('终章刻完三个地方后雾全部散开', () => {
  const state = createInitialState();
  state.travel.story.fogIntro = true;
  state.travel.realms.ri = emptyRealm('ri');
  state.travel.realms.mei = emptyRealm('mei');
  state.travel.realms.xing = emptyRealm('xing');
  state.travel.realms.ri.storyShard = true;
  state.travel.realms.mei.storyShard = true;
  state.travel.realms.xing.storyShard = true;
  assert.equal(storyChapter(state.travel), 'finale');
  applySkip(state, emptyRealm);
  assert.deepEqual(state.travel.story.homePlaces, ['yard', 'garden', 'dock']);
  state.travel.story.restored = ['water', 'light', 'sky', 'all'];
  const clear = storyFog({ travel: state.travel, ageBand: 'junior', height: 0 });
  assert.equal(clear.visible, false);
  assert.equal(clear.zones.all, true);
  assert.equal(storyChapter(state.travel), 'festival');
});

test('体验模式使用独立存档键，不读写孩子的正式存档', () => {
  assert.equal(isTour('?tour=1'), true);
  assert.equal(isTour(''), false);
  const storage = new MemoryStorage();
  storage.setItem(CHILD_STORAGE_KEY, 'child-save');
  storage.setItem(`${CHILD_STORAGE_KEY}-before-vista`, 'child-vista');
  const wrapped = tourStorage(storage);
  const game = new GameState(wrapped);
  game.mutate((state) => { state.travel.story.fogIntro = true; });
  assert.equal(game.save().ok, true);
  assert.equal(storage.getItem(CHILD_STORAGE_KEY), 'child-save');
  assert.equal(storage.getItem(`${CHILD_STORAGE_KEY}-before-vista`), 'child-vista');
  assert.equal(storage.getItem(TOUR_STORAGE_KEY) == null, false);
  assert.equal(storage.getItem(TOUR_STORAGE_KEY).includes('child-save'), false);
  const keys = [...storage.data.keys()];
  assert.equal(keys.some((key) => key === CHILD_STORAGE_KEY || key.startsWith(`${CHILD_STORAGE_KEY}-`) && !key.startsWith(TOUR_STORAGE_KEY)), true);
  assert.equal(keys.includes(CHILD_STORAGE_KEY), true);
  assert.equal(storage.getItem(CHILD_STORAGE_KEY), 'child-save');
});

test('年龄两档：4到6和7到9都读成6到8', () => {
  assert.equal(normalizeAgeBand('little'), 'junior');
  assert.equal(normalizeAgeBand('bigger'), 'junior');
  assert.equal(normalizeAgeBand('junior'), 'junior');
  assert.equal(normalizeAgeBand('older'), 'senior');
  assert.equal(normalizeAgeBand('senior'), 'senior');
  assert.equal(normalizeAgeBand(null), null);
  assert.equal(normalizeAgeBand('adult'), null);
});
