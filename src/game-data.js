import { isCreationReserved } from './creation-data.js';
import { MEI_COLLECTABLES, MEI_ITEMS, MEI_RECIPES } from './mei-data.js';
import { isRealmProtected } from './realm-data.js';

export const WORLD_SIZE = 32;
export const MAX_BUILD_HEIGHT = 12;
export const STORAGE_KEY = 'yuanyuan-river-valley-v1';
export const GUEST_PLAYER_NAME = '小谷';

export function playerDisplayName(user) {
  const raw = typeof user?.name === 'string' ? user.name.replace(/\s+/g, ' ').trim() : '';
  return raw || GUEST_PLAYER_NAME;
}
export const DAMAGED_BACKUP_KEY = `${STORAGE_KEY}-damaged-backup`;
export const FIGURES_KEY = `${STORAGE_KEY}-figures`;
export const LIFE_BACKUP_KEY = `${STORAGE_KEY}-before-life`;
export const LAND_BACKUP_KEY = `${STORAGE_KEY}-before-expansion`;
export const TRAVEL_BACKUP_KEY = `${STORAGE_KEY}-before-travel`;
export const MEI_BACKUP_KEY = `${STORAGE_KEY}-before-mei`;
export const XING_BACKUP_KEY = `${STORAGE_KEY}-before-xing`;
export const CRAFT_RULES = Object.freeze({ dragThreshold: 7 });

// Integer y coordinates describe the bottom of a placed block.
export function terrainHeight(x, z) {
  return x >= 3 && x <= 5 ? -1 : 0;
}

const tutorGuards = [];

export function setTutorGuards(list = []) {
  tutorGuards.length = 0;
  for (const tutor of list) {
    const x = Number(tutor?.x);
    const z = Number(tutor?.z);
    const radius = Number(tutor?.guard);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    tutorGuards.push({ x, z, radius: Number.isFinite(radius) ? radius : 1.4 });
  }
}

export function isProtectedCell(x, z, realm = 'he') {
  if (realm && realm !== 'he') return isRealmProtected(realm, x, z);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return true;
  // Shared facilities stay accessible, including their approach space.
  const facilities = [
    { x: -9, z: -7, radius: 1.1 },
    { x: -10, z: -4, radius: 0.9 },
    { x: -12.2, z: -6.2, radius: 0.9 },
    { x: -4.2, z: -7.6, radius: 0.9 },
    { x: -5.9, z: -4.2, radius: 0.9 },
    { x: -2.6, z: -4.5, radius: 0.9 },
    { x: -11.5, z: 3.8, radius: 0.9 },
    { x: 10, z: 8.5, radius: 0.9 },
    { x: 7, z: 5, radius: 0.9 },
    { x: 3.1, z: 6.5, radius: 0.9 },
    { x: 13.1, z: 1.15, radius: 3.6 },
    { x: -4.2, z: 20.2, radius: 3.0 },
  ];
  return facilities.concat(tutorGuards).some(point => Math.hypot(x - point.x, z - point.z) <= point.radius)
    || isCreationReserved(x, z)
    || (x >= 2.1 && x <= 5.9 && z >= 1.65 && z <= 3.35)
    || (x >= 7.5 && x <= 11.5 && z >= 4.2 && z <= 7.1)
    // A placed cube extends half a cell beyond its center; include overlap.
    || (Math.abs(x + 12) <= 1.6 + 0.5 && Math.abs(z + 1.5) <= 1.35 + 0.5)
    || (Math.abs(x - 9) <= 1.55 / 2 + 0.5 && z >= -7.5 && z <= -2.5)
    || (Math.abs(x - 9) <= 1.6 / 2 + 0.5 && Math.abs(z + 1.6) <= 1.3 / 2 + 0.5);
}

export const ITEMS = {
  wood: { name: '木料', color: '#b57b48', emoji: '🪵', placeable: true, description: '采来的木料。把它分成木板是游戏约定，现实中需要工具加工。' },
  plank: { name: '木板', color: '#dda66e', emoji: '🟨', placeable: true, description: '可以搭路、墙和小屋。格子合成的数量与形状是游戏约定。' },
  stick: { name: '木棍', color: '#b77e4d', emoji: '🥢', placeable: false, description: '加工后的木棍，与树上采来的树枝不同。' },
  stone: { name: '石块', color: '#a5b7ba', emoji: '🪨', placeable: true, description: '从石堆采来，可用于建造。两份泥土不会直接变成石块。' },
  clay: { name: '制砖黏土', color: '#c99c85', emoji: '🟫', placeable: true, description: '这里提供的是适合制砖的黏土原料；并非随便一把泥土都适合。' },
  branch: { name: '树枝', color: '#8e6749', emoji: '🌿', placeable: false, description: '地上捡到的树枝，在工坊里用作燃料。' },
  soil: { name: '种植土', color: '#977755', emoji: '🟤', placeable: true, description: '这里是适合种植的土，和制砖黏土的用途不同。' },
  water: { name: '清水', color: '#76cbd7', emoji: '💧', placeable: false, description: '给植物浇水。植物需要适量水，积水也会妨碍生长。' },
  seed: { name: '豆种', color: '#a9bf75', emoji: '🌱', placeable: false, description: '种在园地里，观察土的干湿与排水。' },
  brick: { name: '砖块', color: '#dc8d6c', emoji: '🧱', placeable: true, description: '黏土经过成形、干燥、烧制和冷却得到的砖。时间在游戏中缩短了。' },
  shard: { name: '试样碎片', color: '#ba8f7b', emoji: '🧩', placeable: false, description: '来自加工条件不合适的试样，可观察裂纹。不会变成高级材料。' },
  workbench: { name: '工作台', color: '#c9895b', emoji: '🛠️', placeable: true, description: '四块木板组成工作台是游戏配方。放好后可以使用三乘三格子。' },
  chest: { name: '储物箱', color: '#d19a58', emoji: '📦', placeable: true, description: '可以存放材料。挖回箱子时，箱内材料也会完整返还。' },
  ramp: { name: '斜坡', color: '#e3b77e', emoji: '📐', placeable: true, description: '木板加石块做成斜坡。也可以当上台的台阶。数量是游戏约定。' },
  post: { name: '挡板', color: '#b98c68', emoji: '🚧', placeable: true, description: '一根木棍做成挡板。放在球的路径上，观察碰撞如何改变方向。' },
  ball: { name: '木球', color: '#f4c963', emoji: '🟡', placeable: false, description: '两块木板合成圆球是游戏约定，现实中还需要切削等加工。' },
  roof: { name: '屋顶', color: '#c98063', emoji: '🏠', placeable: true, description: '三块木板拼成一片屋顶。用木板、篱笆、砖、门或窗把屋子围好，屋顶会自己变大或变小，盖住整间。中间可以后铺地板。这是游戏里的盖法，不判断真实承重。' },
  window: { name: '窗', color: '#9ec9c4', emoji: '🪟', placeable: true, description: '木板加木棍做成窗。嵌在墙上，走不过去。' },
  door: { name: '门', color: '#8f6238', emoji: '🚪', placeable: true, description: '两块木板加一根木棍做成门。所在格子可以走过去，是游戏约定。' },
  bed: { name: '床', color: '#efe0b8', emoji: '🛏️', placeable: true, description: '两块木板做面，两根木棍做腿。放在屋里。' },
  fence: { name: '篱笆', color: '#b97944', emoji: '🪵', placeable: true, description: '两根木棍围成篱笆，围院子用。' },
  pot: { name: '花盆', color: '#c47a60', emoji: '🪴', placeable: true, description: '一份黏土捏成花盆。烧砖仍要去窑炉。' },
  wreath: { name: '花环', color: '#5f8a48', emoji: '⭕', placeable: true, description: '一根树枝绕成花环，是游戏约定的装饰。' },
  lantern: { name: '灯笼', color: '#e0a35a', emoji: '🏮', placeable: true, description: '木板加树枝做成灯笼。不会真的发光取暖。' },
  flag: { name: '旗帜', color: '#d36b5a', emoji: '🚩', placeable: true, description: '木棍加树枝做成旗帜。旗面用树枝是游戏约定。' },
  bean: { name: '豆子', color: '#b7d584', emoji: '🫘', placeable: false, description: '在适宜条件下长成的收获。成熟时间在游戏中缩短了。' },
  kozo: { name: '楮皮', color: '#c4a574', emoji: '🌿', placeable: false, origin: 'ri', description: '楮树皮。和纸用它的纤维。在日谷的楮树林采集，不用答题。' },
  bamboo: { name: '竹子', color: '#7ea35a', emoji: '🎋', placeable: false, origin: 'ri', description: '日谷竹林里的竹子。劈成竹篾是游戏约定。' },
  'bamboo-strip': { name: '竹篾', color: '#d2c48a', emoji: '🥢', placeable: false, origin: 'ri', description: '竹子劈成的细条。格子份数是游戏约定。抄纸的竹帘也用竹条。' },
  washi: { name: '和纸', color: '#f4efe4', emoji: '📄', placeable: false, origin: 'ri', description: '楮皮纤维做成的纸。剥皮蒸煮、敲打、加水、竹帘抄纸、晾干。这里的时间缩短了。' },
  'paper-crane': { name: '纸鹤', color: '#f7f1e4', emoji: '🕊️', placeable: true, origin: 'ri', description: '和纸折的纸鹤。游戏里一次折好，真实折纸有很多步。可以带回河谷摆放。' },
  'paper-boat': { name: '纸船', color: '#f7f1e4', emoji: '⛵', placeable: true, origin: 'ri', description: '两张和纸并排折成纸船。真实折纸船通常一张纸、很多步；分成两种格子是游戏约定。可以带回河谷摆放。' },
  'paper-koinobori': { name: '纸鲤鱼旗', color: '#e07a4a', emoji: '🎏', placeable: true, origin: 'ri', description: '用和纸和竹篾做的鲤鱼旗装饰，挂在杆上随风飘。它不是国旗。' },
  'paper-door': { name: '纸拉门', color: '#f3ecdf', emoji: '🚪', placeable: true, origin: 'ri', description: '木格上糊和纸的门。格子配方是游戏约定，真实拉门还有木框和纸的糊法。' },
  salt: { name: '盐', color: '#f4f1ea', emoji: '🧂', placeable: false, origin: 'xing', description: '盐湖边取到的盐。盐湖是真实存在的地貌。这里的取盐被简化了。' },
  'salt-crystal': { name: '盐晶', color: '#f7fbff', emoji: '💎', placeable: true, origin: 'xing', description: '盐加清水后静置。溶液饱和时析出晶体。时间缩短了。这是简化模型，不是完整的结晶过程。' },
  meteorite: { name: '陨石碎块', color: '#6d625c', emoji: '🌑', placeable: false, origin: 'xing', description: '可以看一看。不能加工成金属。' },
  glowmoss: { name: '光苔', color: '#7ddea8', emoji: '🌿', placeable: false, origin: 'xing', fantasy: true, living: true, description: '这是游戏里的幻想生物。只在外星谷生长，不能种回河谷，可以装进展柜。' },
  'glowmoss-case': { name: '光苔展柜', color: '#b7f3d0', emoji: '🪟', placeable: true, origin: 'xing', fantasy: true, living: false, case: true, description: '光苔放在游戏里直接提供的玻璃罩里。这是装饰，不是种植。光苔是幻想生物。' },
  'glass-dome': { name: '玻璃罩', color: '#d5f3f6', emoji: '🔮', placeable: false, origin: 'xing', description: '游戏里直接提供的玻璃罩。不是沙子变成的玻璃。' },
  'glyph-plaque': { name: '小咕的符号牌', color: '#f2c14e', emoji: '🔤', placeable: true, origin: 'xing', description: '点一下会听到小咕的问候。这是纪念品，不用解谜也能收下。' },
  ...MEI_ITEMS,
};

export const COLLECTABLE_ITEMS = ['wood', 'stone', 'clay', 'branch', 'soil', 'water', 'seed', 'kozo', 'bamboo', 'salt', 'meteorite', 'glowmoss', 'glass-dome', ...MEI_COLLECTABLES.filter((item) => item !== 'branch')];
export const ROOF_WALLS = ['plank', 'fence', 'post', 'brick', 'door', 'window', 'stone', 'log-wall'];
export const ROOF_LIMIT = 8;

function roofSolid(list, x, z, y) {
  return list.some(block => block.x === x && block.z === z && block.y <= y && block.y >= y - 1 && ROOF_WALLS.includes(block.item));
}

export function roofWallAt(blocks, x, z, y) {
  const list = Array.isArray(blocks) ? blocks : [];
  const here = list.filter(block => block.x === x && block.z === z && block.y <= y && block.y >= y - 1 && ROOF_WALLS.includes(block.item));
  if (!here.length) return false;
  if (here.some(block => block.item !== 'plank')) return true;
  const underRoof = list.some(block => block.item === 'roof' && block.y === y && ((block.w || 1) > 1 || (block.d || 1) > 1) && x >= block.x && x < block.x + (block.w || 1) && z >= block.z && z < block.z + (block.d || 1));
  if (underRoof) return false;
  const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => roofSolid(list, x + dx, z + dz, y)).length;
  return around < 4;
}

function roofFlood(blocks, { x, y, z }) {
  const one = { x, z, w: 1, d: 1, enclosed: false };
  const list = Array.isArray(blocks) ? blocks : [];
  const isWall = (cx, cz) => roofWallAt(list, cx, cz, y);
  if (isWall(x, z)) return one;
  const seen = new Set();
  const queue = [[x, z]];
  const interior = [];
  let leaked = false;
  while (queue.length) {
    const [cx, cz] = queue.pop();
    const key = `${cx},${cz}`;
    if (seen.has(key)) continue;
    if (Math.abs(cx - x) > ROOF_LIMIT || Math.abs(cz - z) > ROOF_LIMIT) {
      if (!isWall(cx, cz)) { leaked = true; break; }
      continue;
    }
    seen.add(key);
    if (isWall(cx, cz)) continue;
    interior.push([cx, cz]);
    queue.push([cx + 1, cz], [cx - 1, cz], [cx, cz + 1], [cx, cz - 1]);
  }
  const touches = interior.some(([cx, cz]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => isWall(cx + dx, cz + dz)));
  if (leaked || !touches || interior.length < 2) return one;
  const xs = interior.map(([cx]) => cx);
  const zs = interior.map(([, cz]) => cz);
  const minX = Math.min(...xs);
  const minZ = Math.min(...zs);
  const w = Math.max(...xs) - minX + 1;
  const d = Math.max(...zs) - minZ + 1;
  if (interior.length !== w * d) return one;
  return { x: minX, z: minZ, w, d, enclosed: true };
}

export function roofSpan(blocks, { x, y, z }) {
  const direct = roofFlood(blocks, { x, y, z });
  if (direct.enclosed || !roofWallAt(blocks, x, z, y)) return direct;
  let best = null;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const next = roofFlood(blocks, { x: x + dx, y, z: z + dz });
    if (next.enclosed && (!best || next.w * next.d > best.w * best.d)) best = next;
  }
  return best || { x, z, w: 1, d: 1, enclosed: false };
}

export const RECIPES = [
  { id: 'planks', name: '木板', pattern: [['wood']], output: { item: 'plank', count: 4 }, hint: '一份木料分成四块木板。数量是游戏约定。', group: '材料', kind: '切开', empty: '1 份切开成 4 块' },
  { id: 'sticks', name: '木棍', pattern: [['plank']], output: { item: 'stick', count: 2 }, hint: '一块木板加倍成两根木棍。', group: '材料', kind: '加倍', empty: '1 变成 2' },
  { id: 'post', name: '挡板', pattern: [['stick']], output: { item: 'post', count: 1 }, hint: '一根木棍做成挡板。', group: '玩具', kind: '一对一', empty: '一根做成一个' },
  { id: 'fence', name: '篱笆', pattern: [['stick', 'stick']], output: { item: 'fence', count: 1 }, hint: '两根木棍围成篱笆。', group: '房子', kind: '相加', empty: '点左边的坑，放进去' },
  { id: 'window', name: '窗', pattern: [['plank', 'stick']], output: { item: 'window', count: 1 }, hint: '木板加木棍做成窗。', group: '房子', kind: '两种材料', empty: '板做面，棍做框' },
  { id: 'ramp', name: '斜坡', pattern: [['plank', 'stone']], output: { item: 'ramp', count: 1 }, hint: '木板加石块做成斜坡，也可以当台阶。', group: '房子', kind: '两种材料', empty: '板做坡，石块垫底' },
  { id: 'roof', name: '屋顶', pattern: [['plank', 'plank'], ['plank', null]], output: { item: 'roof', count: 1 }, hint: '三块木板拼成一片屋顶。围墙变大或变小，屋顶会跟着改。', group: '房子', kind: '凑三', empty: '点左边的坑，放进去' },
  { id: 'door', name: '门', pattern: [['plank', 'plank'], ['stick', null]], output: { item: 'door', count: 1 }, hint: '两块木板加一根木棍做成门。所在格可以走过去。', group: '房子', kind: '板加棍', empty: '两块板加一根闩' },
  { id: 'bed', name: '床', pattern: [['plank', 'plank'], ['stick', 'stick']], output: { item: 'bed', count: 1 }, hint: '两块木板做面，两根木棍做腿。', group: '家具', kind: '板面棍腿', empty: '板做面，棍做腿' },
  { id: 'workbench', name: '工作台', pattern: [['plank', 'plank'], ['plank', 'plank']], output: { item: 'workbench', count: 1 }, hint: '四块木板摆成小方块。', group: '家具', kind: '相加', empty: '四块板拼成桌' },
  { id: 'ball', name: '木球', pattern: [['plank', 'plank']], output: { item: 'ball', count: 1 }, hint: '两块木板合成圆球是游戏约定。', group: '玩具', kind: '相加', empty: '两块板合成圆' },
  { id: 'chest', name: '储物箱', pattern: [['plank', 'plank', 'plank'], ['plank', null, 'plank'], ['plank', 'plank', 'plank']], output: { item: 'chest', count: 1 }, hint: '八块木板围一圈，中间留空。', group: '家具', kind: '分组相加', empty: '4 + 4 = 8', pits: [{ item: 'plank', count: 4 }, { item: 'plank', count: 4 }] },
  { id: 'pot', name: '花盆', pattern: [['clay']], output: { item: 'pot', count: 1 }, hint: '一份黏土捏成花盆。烧砖仍去窑炉。', group: '装饰', kind: '一对一', empty: '一份黏土捏花盆' },
  { id: 'wreath', name: '花环', pattern: [['branch']], output: { item: 'wreath', count: 1 }, hint: '一根树枝绕成花环。', group: '装饰', kind: '一对一', empty: '一根树枝绕成环' },
  { id: 'lantern', name: '灯笼', pattern: [['plank', 'branch']], output: { item: 'lantern', count: 1 }, hint: '木板加树枝做成灯笼。', group: '装饰', kind: '两种材料', empty: '板做罩，枝做把' },
  { id: 'flag', name: '旗帜', pattern: [['stick', 'branch']], output: { item: 'flag', count: 1 }, hint: '木棍加树枝做成旗帜。', group: '装饰', kind: '两种材料', empty: '棍做杆，枝当旗面' },
  { id: 'bamboo-strips', name: '竹篾', pattern: [['bamboo']], output: { item: 'bamboo-strip', count: 4 }, hint: '一根竹子分成四条竹篾。数量是游戏约定。', group: '日谷', kind: '切开', empty: '1 根分成 4 条' },
  { id: 'paper-crane', name: '纸鹤', pattern: [['washi']], output: { item: 'paper-crane', count: 1 }, hint: '一张和纸折成纸鹤。游戏里一次折好，真实折纸有很多步。这是游戏约定。', group: '日谷', kind: '对折', empty: '一张和纸' },
  { id: 'paper-boat', name: '纸船', pattern: [['washi', 'washi']], output: { item: 'paper-boat', count: 1 }, hint: '两张和纸并排折成纸船。真实折纸船通常只用一张纸。这里和纸鹤分成两种格子，是游戏约定。', group: '日谷', kind: '对折', empty: '两张并排' },
  { id: 'paper-koinobori', name: '纸鲤鱼旗', pattern: [['washi', 'bamboo-strip']], output: { item: 'paper-koinobori', count: 1 }, hint: '和纸加竹篾做成纸鲤鱼旗。这是装饰，不是国旗。格子是游戏约定。', group: '日谷', kind: '两种材料', empty: '纸做鱼，篾做骨' },
  { id: 'paper-door', name: '纸拉门', pattern: [['washi', 'stick']], output: { item: 'paper-door', count: 1 }, hint: '和纸加木棍做成纸拉门。格子是游戏约定。', group: '日谷', kind: '两种材料', empty: '纸做面，棍做框' },
  { id: 'glowmoss-case', name: '光苔展柜', pattern: [['glowmoss', 'glass-dome']], output: { item: 'glowmoss-case', count: 1 }, hint: '光苔放进玻璃罩。不能种在菜园。玻璃罩是游戏里直接提供的。', group: '外星谷', kind: '装起来', empty: '苔加罩' },
  ...MEI_RECIPES,
];

export const GARDEN_PLOTS = [
  { id: 'plot-1', x: 8.2, z: 5, drainage: 'poor' },
  { id: 'plot-2', x: 9.5, z: 5, drainage: 'poor' },
  { id: 'plot-3', x: 10.8, z: 5, drainage: 'good' },
  { id: 'plot-4', x: 8.2, z: 6.3, drainage: 'good' },
  { id: 'plot-5', x: 9.5, z: 6.3, drainage: 'good' },
  { id: 'plot-6', x: 10.8, z: 6.3, drainage: 'good' },
];
