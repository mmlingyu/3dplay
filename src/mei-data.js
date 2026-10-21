/** Beauty-valley constants. Home stays neutral. This module does not import the travel framework. */

export const SHIP_NOTE = '坐大船可以过大洋到美谷。路程在游戏里变短了。进港时，船从红色吊桥下面穿过。';
export const VOYAGE_MEI_NOTE = '路程和天气在游戏里被简化了。真实的热气球跨海要看风向和天气。';
export const MAPLE_NOTE = '枫树汁大部分是水。现实里，含糖大约 2% 的树汁要很多份才能熬出 1 份糖浆。这里收成 10 份熬成 1 份，时间也缩短到大约 20 秒。这是游戏里的简化。';
export const PLANE_NOTE = '纸飞机的飞行距离来自一张定好的规则表。同样的机头和机翼，结果总是一样。这不是空气动力学计算。';
export const WINDMILL_NOTE = '叶片接到轮轴上才会转。有风的日子转得快。别的天气可以用风箱吹，风箱是送风工具，不会因为天气卡住。这里不模拟真实的风。';
export const GEYSER_NOTE = '间歇泉定时喷水只是景观表现，不是地质模拟。';
export const QUILT_NOTE = '旧布头剪开再缝，是重复利用。格子和对称是游戏里的拼法。';
export const CABIN_NOTE = '屋顶会按围好的范围自己盖上。这是游戏的盖法，不判断真实承重。';
export const TRADE_NOTE = '交换的份数是游戏约定，不是货币，也不是商店标价。';
export const LANTERN_NOTE = '南瓜灯全年都能做，和日期无关。表情只有笑脸、猫脸和星星，用暖色，不吓人。';
export const THANKS_NOTE = '感谢卡说的是收获与感谢。全年都能做，和日期无关。';

export const MAPLE_RATIO = 10;
export const MAPLE_TOTAL_SECONDS = 20;
export const MAPLE_STAGE_SECONDS = 4;
export const PROJECT_CARD_LIMIT = 20;

/** Same shape as the kiln clock: fixed stages, one visible second each tick, ready at the end. */
export const MAPLE_STAGES = Object.freeze([
  { id: 'pour', label: '树汁入锅', icon: 'water' },
  { id: 'heat', label: '加热', icon: 'lantern' },
  { id: 'steam', label: '水分蒸发', icon: 'cloud' },
  { id: 'thicken', label: '变稠', icon: 'syrup' },
  { id: 'cool', label: '晾一晾', icon: 'sun' },
]);

export function mapleStage(elapsed) {
  const time = Number(elapsed) || 0;
  if (time >= MAPLE_TOTAL_SECONDS) return 'ready';
  const index = Math.min(MAPLE_STAGES.length - 1, Math.floor(time / MAPLE_STAGE_SECONDS));
  return MAPLE_STAGES[index].id;
}

export function mapleSeasonNote(date = new Date()) {
  const month = date.getMonth();
  if (month === 2 || month === 3) return '这时候是早春，树汁多。别的日子也能采，不会卡住。';
  return '现在不是早春，树汁少一些。全年都能采，不用等。';
}

export const MEI_STAMPS = Object.freeze([
  { id: 'mei-arrive', name: '到达美谷', icon: 'ferry', how: '走到渡口坐大船，或坐热气球看风景。不用答题。' },
  { id: 'mei-syrup-first', name: '第一份枫糖浆', icon: 'syrup', how: '用枫树汁和树枝熬出来。不用答题。' },
  { id: 'mei-quilt-first', name: '第一块拼布', icon: 'quilt', how: '用旧衣回收箱的布头拼一块。不用答题。' },
  { id: 'mei-windmill-spin', name: '风车转起来了', icon: 'windmill', how: '叶片接到轮轴上，有风或用风箱让它转。不用答题。' },
  { id: 'mei-project', name: '完成一个项目', icon: 'project', how: '在项目板上画、做、试。可以改一个地方，也可以跳过。不用答题。' },
]);

export const MEI_PREMIERE_STAMP = Object.freeze(
  { id: 'mei-premiere', name: '首映', icon: 'star', how: '和 Will、Orv、咔嚓修好影院的老放映机。不用答题，也不用先做别的故事。' },
);

export const MEI_AUDIO = Object.freeze([
  'en-hello', 'en-sun', 'en-tree', 'en-friend', 'en-build',
  'en-cat', 'en-measure', 'en-test', 'en-fix', 'en-change',
  'en-action', 'en-cut', 'en-camera', 'en-star', 'en-light', 'en-take-two',
  'en-wide', 'en-medium', 'en-close', 'en-frames', 'en-ship',
  'zh-action', 'zh-cut', 'zh-board', 'zh-shot', 'zh-frames', 'zh-light', 'zh-shard', 'zh-back', 'zh-premiere',
]);

export const QUILT_COLORS = Object.freeze([
  { id: 'red', name: '红', hex: '#c45d5d' },
  { id: 'blue', name: '蓝', hex: '#6a90c0' },
  { id: 'gold', name: '黄', hex: '#e2b657' },
  { id: 'green', name: '绿', hex: '#6f8f55' },
]);

export const PUMPKIN_FACES = Object.freeze([
  { id: 'smile', name: '笑脸' },
  { id: 'cat', name: '猫脸' },
  { id: 'star', name: '星星' },
]);

export const MEI_TRADES = Object.freeze([
  {
    id: 'bean-syrup',
    giveItem: 'bean',
    giveCount: 3,
    getItem: 'maple-syrup',
    getCount: 1,
    note: '3 份豆子换 1 份枫糖浆。这是游戏约定。',
  },
]);

export const MATERIAL_CAP = Object.freeze({ windmill: 6, plane: 4, cabin: 8 });

export const MEI_DOCK = Object.freeze({ x: 0, y: 0, z: -12, ry: 0 });
export const MEI_LAWN = Object.freeze({ x: -10, y: 0, z: 12, ry: 0 });

const MEI_BALLOON = Object.freeze({
  x: -10,
  z: 12,
  radius: 2.8,
  padHeight: 0.14,
  basketHeight: 0.72,
  cruiseHeight: 16.5,
  liftSeconds: 4.2,
  descendSeconds: 3.4,
  homeSpeed: 4.2,
  tourSeconds: 48,
});

export const MEI_REALM = Object.freeze({
  id: 'mei',
  name: '美谷',
  playable: true,
  theme: 'usa',
  entry: 'dock',
  altEntry: 'balloon',
  festivals: Object.freeze([
    Object.freeze({ id: 'premiere-night', name: '星光首映夜', note: '孩子自己打开。放自己拍的照片和小电影。不评名次。相关手工全年都能做。' }),
  ]),
  bounds: Object.freeze({ minX: -16, maxX: 15, minZ: -16, maxZ: 15 }),
  flight: Object.freeze({ minX: -14, maxX: 14, minZ: -14, maxZ: 14 }),
  visitor: Object.freeze({ minX: 2, maxX: 10, minZ: 4, maxZ: 11 }),
  stream: Object.freeze({ minX: -1, maxX: 1 }),
  balloon: MEI_BALLOON,
  dock: MEI_DOCK,
  lawn: MEI_LAWN,
  sites: Object.freeze({
    port: Object.freeze({ x: 0, z: -12, name: '港口' }),
    cabin: Object.freeze({ x: -8, z: 6, name: '原木小屋' }),
    barn: Object.freeze({ x: 12, z: 8, name: '红色谷仓' }),
    bridge: Object.freeze({ x: 0, z: 0, name: '廊桥' }),
    windmill: Object.freeze({ x: 11, z: 2, name: '抽水风车' }),
    geyser: Object.freeze({ x: -12, z: 11, name: '间歇泉' }),
    ranger: Object.freeze({ x: -13, z: 6, name: '守护员小屋' }),
    library: Object.freeze({ x: 7, z: -10, name: '小镇图书馆' }),
    maple: Object.freeze({ x: -12, z: -8, name: '枫树林' }),
    logs: Object.freeze({ x: -12, z: -2, name: '原木堆' }),
    pumpkin: Object.freeze({ x: 12, z: -8, name: '南瓜地' }),
    cloth: Object.freeze({ x: 10, z: -6, name: '旧衣回收箱' }),
    paper: Object.freeze({ x: 5, z: -11, name: '纸架' }),
    sugar: Object.freeze({ x: -8, z: -6, name: '枫糖小屋' }),
    board: Object.freeze({ x: 1, z: 6, name: '项目板' }),
    shop: Object.freeze({ x: 8, z: 1, name: '自行车铺' }),
    branch: Object.freeze({ x: -6, z: -12, name: '树枝堆' }),
    maya: Object.freeze({ x: 3.2, z: 5.2 }),
    will: Object.freeze({ x: 6.5, z: 1.4 }),
    orv: Object.freeze({ x: 9.4, z: 1.6 }),
    rivera: Object.freeze({ x: 6.2, z: -8.4 }),
    joe: Object.freeze({ x: -9.2, z: -6.2 }),
  }),
});

export function quiltReady(cells, band) {
  if (!Array.isArray(cells) || cells.length !== 4) return false;
  const known = new Set(QUILT_COLORS.map((item) => item.id));
  if (!cells.every((item) => known.has(item))) return false;
  if (band === 'older') return cells[0] === cells[2] && cells[1] === cells[3];
  if (band === 'bigger') return cells[0] === cells[3] && cells[1] === cells[2];
  return true;
}

export function lanternAnyDate() {
  return true;
}

/**
 * Game convention, not aerodynamics.
 * Windy days add speed. A hand bellows also adds speed in any weather.
 */
export function windmillRate(weatherKind, bellowsOn) {
  const wind = weatherKind === 'wind' ? 2.4 : 0;
  const bellows = bellowsOn ? 1.6 : 0;
  return Math.round((wind + bellows) * 10) / 10;
}

export const MEI_ITEMS = {
  'maple-sap': { name: '枫树汁', color: '#e8d7a8', emoji: '🍁', placeable: false, origin: 'mei', description: '枫树流出的树汁，大部分是水。美谷枫树林全年都能采，不用答题。' },
  'maple-syrup': { name: '枫糖浆', color: '#c47a2a', emoji: '🍯', placeable: false, origin: 'mei', description: '加热树汁，让水蒸发后得到。游戏里 10 份熬成 1 份，现实里要多得多。时间也缩短了。' },
  log: { name: '原木', color: '#8d5a3c', emoji: '🪵', placeable: false, origin: 'mei', description: '带皮的圆木。剥皮、开槽是真实做法。游戏里用格子做成原木墙。' },
  'log-wall': { name: '原木墙', color: '#a56b42', emoji: '🏚️', placeable: true, origin: 'mei', description: '圆木在转角咬合。格子和咬合是游戏约定，不判断真实承重。' },
  cloth: { name: '旧布头', color: '#c45d6a', emoji: '🧵', placeable: false, origin: 'mei', description: '旧衣回收箱里的布。剪开再缝，是重复利用。' },
  'quilt-patch': { name: '拼布块', color: '#d98b7a', emoji: '🔲', placeable: false, origin: 'mei', description: '按颜色拼好的一块布。对称是游戏里的拼法。' },
  quilt: { name: '拼布挂毯', color: '#c46b6b', emoji: '🟦', placeable: true, origin: 'mei', description: '四块拼布缝成的挂毯。可以带回河谷。格子是游戏约定。' },
  paper: { name: '纸', color: '#f7f3ea', emoji: '📄', placeable: false, origin: 'mei', description: '小镇图书馆的纸。折纸飞机用。日谷的和纸是另一种纸。' },
  axle: { name: '轮轴', color: '#8a6239', emoji: '⚙️', placeable: false, origin: 'mei', description: '木棍叠成的小轴。两根并排已经是篱笆，所以轴用三根叠起来。叶片接到它的转动接口上。这是游戏约定。' },
  'paper-plane': { name: '纸飞机摆件', color: '#f4efe4', emoji: '✈️', placeable: true, origin: 'mei', description: '纸和木棍做成的纸飞机。飞行距离看规则表，不是空气动力学计算。可以摆在河谷。' },
  'windmill-mini': { name: '小风车', color: '#d7c48a', emoji: '🌬️', placeable: true, origin: 'mei', description: '木板叶片接到轮轴上。有风的日子会转。这是游戏里的简化。' },
  pumpkin: { name: '南瓜', color: '#e07a2f', emoji: '🎃', placeable: false, origin: 'mei', description: '南瓜地里的南瓜。任何一天都能采。不拿回河谷种植。' },
  'pumpkin-lantern': { name: '南瓜灯', color: '#e08a3c', emoji: '🎃', placeable: true, origin: 'mei', description: '南瓜加木棍。表情是笑脸、猫脸或星星。暖色，不吓人。全年都能做。' },
  'thanks-card': { name: '感谢卡', color: '#f3e2c4', emoji: '💌', placeable: true, origin: 'mei', description: '纸和拼布做成的卡，说收获与感谢。全年都能做。' },
};

export const MEI_RECIPES = [
  { id: 'log-wall', name: '原木墙', pattern: [['log', 'log']], output: { item: 'log-wall', count: 1 }, hint: '两根原木开槽，转角咬合。格子是游戏约定，不判断承重。', group: '美谷', kind: '咬合', empty: '两根圆木' },
  { id: 'axle-part', name: '轮轴', pattern: [['stick'], ['stick'], ['stick']], output: { item: 'axle', count: 1 }, hint: '三根木棍叠成一根小轴。两根并排是篱笆，轴多用一根。这是游戏约定。', group: '美谷', kind: '相加', empty: '三根木棍叠起来' },
  { id: 'windmill-mini', name: '小风车', pattern: [['plank', 'axle']], output: { item: 'windmill-mini', count: 1 }, hint: '木板当叶片，接到轮轴上。有风才会转得快。不是空气动力学模拟。', group: '美谷', kind: '两种材料', empty: '板做叶，轴来转' },
  { id: 'paper-plane', name: '纸飞机', pattern: [['paper', 'stick']], output: { item: 'paper-plane', count: 1 }, hint: '一张纸加一根木棍。飞行距离看规则表，不是真实飞行计算。', group: '美谷', kind: '两种材料', empty: '纸做翼，棍做骨' },
  { id: 'quilt', name: '拼布挂毯', pattern: [['quilt-patch', 'quilt-patch'], ['quilt-patch', 'quilt-patch']], output: { item: 'quilt', count: 1 }, hint: '四块拼布缝成挂毯。每一块先在拼布台上按年龄拼好。', group: '美谷', kind: '相加', empty: '四块布' },
  { id: 'pumpkin-lantern', name: '南瓜灯', pattern: [['pumpkin', 'stick']], output: { item: 'pumpkin-lantern', count: 1 }, hint: '南瓜加木棍。先选笑脸、猫脸或星星。全年都能做，不吓人。', group: '美谷', kind: '两种材料', empty: '瓜做灯，棍做把' },
  { id: 'thanks-card', name: '感谢卡', pattern: [['paper', 'quilt-patch']], output: { item: 'thanks-card', count: 1 }, hint: '纸加一块拼布，说收获与感谢。全年都能做。', group: '美谷', kind: '两种材料', empty: '纸做卡，布做花' },
];

export const MEI_COLLECTABLES = Object.freeze(['maple-sap', 'log', 'cloth', 'paper', 'pumpkin', 'branch']);
