import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState, createInitialState } from '../src/game-state.js';
import { MEI_BACKUP_KEY, STORAGE_KEY, VISTA_BACKUP_KEY, XING_BACKUP_KEY } from '../src/game-data.js';
import { emptyRealm } from '../src/realm-data.js';
import { isPointOpen, createLand } from '../src/land-data.js';
import {
  BOTTLE_SPOTS,
  DISCOVER_HEIGHT,
  VISTAS,
  activeBottle,
  gradeVistaQuiz,
  inferDiscovered,
  nearestVista,
  realmShowsVisit,
  vistaBand,
  vistaClarity,
  vistaDistanceCopy,
  vistaOpacity,
  vistaSignals,
} from '../src/vista-data.js';

class MemoryStorage {
  constructor(seed = []) { this.data = new Map(seed); }
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
}

function oldTravelSave() {
  const save = createInitialState();
  delete save.travel.discovered;
  delete save.travel.keepsakes;
  save.travel.visited = ['mei'];
  save.travel.realms.xing = emptyRealm('xing');
  save.inventory.wood = 11;
  save.blocks = [{ id: 'block-1', item: 'plank', x: 0, y: 0, z: 0, rotation: 0 }];
  save.nextId = 2;
  return save;
}

test('地面剪影淡，热气球升高后更清楚，最近的未发现谷是日谷', () => {
  assert.equal(vistaBand(null), 'little');
  assert.equal(vistaBand('bigger'), 'bigger');
  assert.ok(vistaClarity(0, { flying: false }) < vistaClarity(DISCOVER_HEIGHT, { flying: true }));
  assert.ok(vistaClarity(18, { flying: true }) > vistaClarity(DISCOVER_HEIGHT, { flying: true }));
  assert.ok(vistaOpacity(vistaClarity(0, { flying: false })) < 0.45);
  assert.ok(vistaOpacity(vistaClarity(16, { flying: true })) > 0.7);
  assert.equal(nearestVista({ x: -4.2, z: 20.2 }, {}), 'ri');
  assert.equal(nearestVista({ x: -4.2, z: 20.2 }, { ri: true }), 'mei');
  assert.equal(nearestVista({ x: -4.2, z: 20.2 }, { ri: true, mei: true, xing: true }), null);
  assert.equal(VISTAS.ri.routes.includes('ferry'), true);
  assert.equal(VISTAS.xing.routes.includes('ferry'), false);
  assert.equal(VISTAS.xing.routes.includes('balloon'), true);
  assert.match(vistaDistanceCopy('ri', 'little'), /唱 3 首歌/);
  assert.match(vistaDistanceCopy('ri', 'bigger'), /东南/);
  assert.match(vistaDistanceCopy('mei', 'older'), /48/);
  assert.match(vistaDistanceCopy('xing', 'little'), /星星/);
  assert.equal(vistaDistanceCopy('xing', 'little').includes('东南'), false);
});

test('昼夜信号和漂流瓶只在一段白天出现，纪念物不重复', () => {
  assert.equal(vistaSignals({ period: '中午' }).kite, true);
  assert.equal(vistaSignals({ period: '中午' }).lantern, false);
  assert.equal(vistaSignals({ period: '晚上' }).crystal, true);
  assert.equal(vistaSignals({ period: '深夜' }).kite, false);
  assert.equal(vistaSignals({ period: '早上' }).windmill, true);
  assert.equal(activeBottle({ elapsed: 0 }, []), null);
  const noon = activeBottle({ elapsed: 120 }, []);
  assert.equal(noon.id, 'crane');
  assert.equal(activeBottle({ elapsed: 200 }, []), null);
  assert.equal(activeBottle({ elapsed: 120 }, ['crane']).id, 'maple');
  assert.equal(activeBottle({ elapsed: 120 }, ['crane', 'maple', 'pebble']), null);
  const land = createLand();
  for (const spot of Object.values(BOTTLE_SPOTS)) assert.equal(isPointOpen(land, spot.x, spot.z), true);
});

test('旧档按去过的谷推断发现，空的外谷壳子不算', () => {
  const empty = inferDiscovered({ current: 'he', visited: [], realms: { mei: emptyRealm('mei'), xing: emptyRealm('xing') } });
  assert.deepEqual(empty, { ri: false, mei: false, xing: false });
  assert.equal(realmShowsVisit('mei', emptyRealm('mei')), false);
  const visited = inferDiscovered({ current: 'he', visited: ['mei'], realms: { mei: emptyRealm('mei') } });
  assert.equal(visited.mei, true);
  assert.equal(visited.ri, false);
  const moved = emptyRealm('xing');
  moved.player = { x: 4, y: 0, z: 4, ry: 0 };
  assert.equal(inferDiscovered({ current: 'he', visited: [], realms: { xing: moved } }).xing, true);
  assert.equal(inferDiscovered({ current: 'ri', visited: [], realms: {} }).ri, true);
});

test('远眺字段第一次写入前备份，失败不覆盖主档，也不动美谷和外星谷备份', () => {
  const save = oldTravelSave();
  const text = JSON.stringify(save);
  const storage = new MemoryStorage([
    [STORAGE_KEY, text],
    [MEI_BACKUP_KEY, 'keep-mei'],
    [XING_BACKUP_KEY, 'keep-xing'],
  ]);
  const game = new GameState(storage);
  assert.equal(game.state.inventory.wood, 11);
  assert.equal(game.state.blocks[0].item, 'plank');
  assert.equal(game.state.travel.discovered.mei, true);
  assert.equal(game.state.travel.discovered.ri, false);
  assert.equal(game.state.travel.discovered.xing, false);
  assert.equal(game.save().ok, true);
  assert.equal(storage.getItem(VISTA_BACKUP_KEY), text);
  assert.equal(storage.getItem(MEI_BACKUP_KEY), 'keep-mei');
  assert.equal(storage.getItem(XING_BACKUP_KEY), 'keep-xing');
  const written = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.equal(written.travel.discovered.mei, true);
  assert.equal(written.version, 1);
  game.save();
  assert.equal(storage.getItem(`${VISTA_BACKUP_KEY}-1`), null);
  const blocked = {
    getItem(key) {
      if (key === STORAGE_KEY) return text;
      if (key === MEI_BACKUP_KEY) return 'keep-mei';
      if (key === XING_BACKUP_KEY) return 'keep-xing';
      return null;
    },
    setItem(key) { if (String(key).includes('before-vista')) throw new Error('拒绝写入'); },
  };
  const failed = new GameState(blocked);
  assert.equal(failed.save().ok, false);
  assert.equal(blocked.getItem(STORAGE_KEY), text);
  assert.equal(blocked.getItem(MEI_BACKUP_KEY), 'keep-mei');
  assert.equal(blocked.getItem(XING_BACKUP_KEY), 'keep-xing');
});

test('新游戏不写远眺备份，发现不是出发门槛，纪念和估远近都不扣材料', () => {
  const storage = new MemoryStorage();
  const game = new GameState(storage);
  assert.equal(game.save().ok, true);
  assert.equal(storage.getItem(VISTA_BACKUP_KEY), null);
  assert.equal(game.state.travel.discovered.ri, false);
  assert.equal(game.beginTravel('ri', 'ferry').ok, true);
  assert.equal(game.state.travel.discovered.ri, false);
  assert.equal(game.state.travel.visited.includes('ri'), true);
  assert.equal(game.beginTravel('xing', 'ferry').ok, false);
  game.returnHome();
  const wood = game.state.inventory.wood;
  assert.equal(game.collectKeepsake('crane').ok, true);
  assert.equal(game.state.inventory.wood, wood);
  assert.deepEqual(game.state.travel.keepsakes, ['crane']);
  assert.equal(game.collectKeepsake('crane').already, true);
  assert.equal(game.state.travel.keepsakes.length, 1);
  const before = JSON.stringify(game.state.inventory);
  assert.equal(gradeVistaQuiz('ri').ok, false);
  assert.match(gradeVistaQuiz('ri').message, /还在/);
  assert.equal(gradeVistaQuiz('mei').ok, true);
  assert.equal(JSON.stringify(game.state.inventory), before);
  assert.equal(game.discoverVista('ri').ok, true);
  assert.equal(game.state.travel.discovered.ri, true);
  assert.equal(game.state.travel.stamps.includes('vista-ri'), true);
  assert.equal(game.discoverVista('ri').already, true);
  const bad = JSON.parse(game.exportSave());
  bad.travel.discovered = { ri: 'yes' };
  const other = new GameState(new MemoryStorage());
  const snapshot = other.exportSave();
  assert.equal(other.importSave(JSON.stringify(bad)).ok, false);
  assert.equal(other.exportSave(), snapshot);
});
