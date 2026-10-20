// Creation lab catalog: part types, joints, capabilities and real-object templates.
// Coordinates: +x forward, +y up, z sideways; one unit equals one world grid cell.
export const CATALOG_VERSION = 1;

export const CREATION_LIMITS = Object.freeze({
  titleLength: 20,
  ideaLength: 80,
  drafts: 12,
  strokes: 120,
  pointsPerStroke: 400,
  stamps: 40,
  blueprints: 12,
  partsPerBlueprint: 16,
  jointsPerBlueprint: 24,
  customPartTypes: 24,
  shapesPerPart: 12,
  portsPerPart: 8,
  partInstances: 80,
  assemblies: 6,
  experimentsKept: 8,
  transactionsKept: 60,
  textLength: 80,
  listLength: 8,
  coordinate: 2.4,
  minSize: 0.02,
  maxSize: 2,
  portTolerance: 0.2,
  sketchBytes: 1_500_000,
});

export const TRUTH_MODES = Object.freeze({
  'reality-grounded': '现实里也是这样',
  'game-simplification': '游戏简化',
  fantasy: '幻想设计',
});

export const PALETTE = Object.freeze({
  wood: '#b57b48',
  plank: '#dda66e',
  cream: '#f0e2c0',
  stone: '#a5b7ba',
  metal: '#73847b',
  tire: '#485c52',
  red: '#d97a5f',
  blue: '#6fa8c8',
  green: '#8fb26f',
  yellow: '#f0c95c',
  dark: '#4b4a40',
});

export const SHAPES = Object.freeze(['box', 'cylinder', 'sphere', 'torus', 'cone']);
export const AXES = Object.freeze(['x', 'y', 'z']);

// Ports connect only when the joint kind matches and genders are opposite.
export const JOINTS = Object.freeze({
  fixed: { label: '固定连接', hint: '连上后不会动' },
  revolute: { label: '转动轴', hint: '可以绕轴转' },
  steer: { label: '转向轴', hint: '可以左右转方向' },
  drive: { label: '传动连接', hint: '把踩踏的力传到轮子' },
});

export const PART_TAGS = Object.freeze(['wheel', 'axle', 'frame', 'fork', 'handle', 'steering', 'seat', 'sittable', 'crank', 'chain', 'post', 'blade', 'hull', 'mast', 'leg', 'board', 'body', 'light', 'decor']);

// Behaviours are program plugins. A blueprint may only request ids listed here.
export const CAPABILITIES = Object.freeze({
  roll: { label: '能滚着走', truthMode: 'reality-grounded', note: '轮子绕轴转动，摩擦比拖着走小。' },
  steer: { label: '能转方向', truthMode: 'reality-grounded', note: '前轮跟着转向轴偏转，前进方向就变了。' },
  pedal: { label: '能踩着走', truthMode: 'game-simplification', note: '踩脚踏带动链条，再带动后轮。河谷里的传动经过简化。' },
  spin: { label: '能转起来', truthMode: 'reality-grounded', note: '叶片被风推动，绕中心轴旋转。' },
  float: { label: '能浮在水上', truthMode: 'reality-grounded', note: '木头比水轻，船身排开水就能浮起来。' },
  sit: { label: '能坐上去', truthMode: 'game-simplification', note: '游戏不计算真实承重，只检查有没有座位。' },
  light: { label: '车灯会亮', truthMode: 'game-simplification', note: '真实车灯要用电池或发电机供电；河谷还没有电，亮光是游戏效果。' },
});

export const FIGURE_ANIMS = Object.freeze({
  none: '不动',
  wag: '左右摇摆',
  bob: '上下起伏',
  nod: '点点头',
  flap: '扇动',
  spin: '转圈',
});

export const FIGURE_GESTURES = Object.freeze({
  hop: '跳一跳',
  spin: '转一圈',
  wave: '挥挥手',
  flap: '扇翅膀',
});

// Idle motion is always on. These are the extra actions a placed model can play.
export function figureGestures(figure) {
  const parts = figure?.parts || [];
  const list = ['hop', 'spin'];
  if (parts.some(part => /^arm/i.test(part.id))) list.push('wave');
  if (parts.some(part => /^wing/i.test(part.id))) list.push('flap');
  return list;
}

export const STAMPS = Object.freeze({
  wheel: { label: '轮子', partType: 'wheel' },
  bar: { label: '杆子', partType: 'axle' },
  board: { label: '木板', partType: 'deck' },
  seat: { label: '座位', partType: 'seat' },
  handle: { label: '把手', partType: 'handlebar' },
  blade: { label: '叶片', partType: 'rotor' },
  hull: { label: '船身', partType: 'hull' },
});

// World targets where raw materials are normally collected.
export const MATERIAL_SOURCES = Object.freeze({
  wood: { targetId: 'wood-source', place: '林间木料' },
  branch: { targetId: 'branch-source', place: '干枝堆' },
  stone: { targetId: 'stone-source', place: '石料堆' },
  clay: { targetId: 'clay-source', place: '制砖黏土' },
  soil: { targetId: 'soil-source', place: '种植土' },
  water: { targetId: 'water-source', place: '溪边取水点' },
  seed: { targetId: 'seed-source', place: '豆子种子箱' },
});

const box = (size, at, color, rotZ = 0) => ({ shape: 'box', size, at, color, rot: [0, 0, rotZ] });
const cyl = (radius, length, axis, at, color) => ({ shape: 'cylinder', radius, length, axis, at, color });
const torus = (radius, tube, axis, at, color) => ({ shape: 'torus', radius, tube, axis, at, color });
const port = (id, joint, gender, at, label) => ({ id, joint, gender, at, label });

export const BASE_PART_TYPES = Object.freeze([
  {
    id: 'wheel', name: '轮子', tags: ['wheel'],
    geometry: [torus(0.36, 0.06, 'z', [0, 0, 0], 'tire'), torus(0.3, 0.02, 'z', [0, 0, 0], 'plank'), box([0.6, 0.03, 0.03], [0, 0, 0], 'plank'), box([0.03, 0.6, 0.03], [0, 0, 0], 'plank'), cyl(0.07, 0.12, 'z', [0, 0, 0], 'yellow')],
    ports: [port('hub', 'revolute', 'socket', [0, 0, 0], '轮毂孔')],
    materials: [{ item: 'plank', count: 2 }],
    truthMode: 'game-simplification', realNote: '真实车轮多用金属轮圈和橡胶轮胎；河谷里用木板拼成。',
  },
  {
    id: 'axle', name: '轮轴', tags: ['axle'],
    geometry: [cyl(0.045, 1.1, 'z', [0, 0, 0], 'metal')],
    ports: [port('mid', 'fixed', 'plug', [0, 0, 0], '轴中间'), port('endA', 'revolute', 'plug', [0, 0, 0.52], '轴一端'), port('endB', 'revolute', 'plug', [0, 0, -0.52], '轴另一端')],
    materials: [{ item: 'stick', count: 1 }],
    truthMode: 'game-simplification', realNote: '真实轮轴常用钢做，才够结实；这里用木棍代替。',
  },
  {
    id: 'deck', name: '车板', tags: ['board', 'sittable'],
    geometry: [box([1.4, 0.1, 0.8], [0, 0, 0], 'plank')],
    ports: [port('front', 'fixed', 'socket', [0.5, -0.08, 0], '前面的轴座'), port('rear', 'fixed', 'socket', [-0.5, -0.08, 0], '后面的轴座'), port('top', 'fixed', 'socket', [0, 0.06, 0], '板面'), port('c1', 'fixed', 'socket', [0.6, -0.05, 0.3], '角一'), port('c2', 'fixed', 'socket', [0.6, -0.05, -0.3], '角二'), port('c3', 'fixed', 'socket', [-0.6, -0.05, 0.3], '角三'), port('c4', 'fixed', 'socket', [-0.6, -0.05, -0.3], '角四'), port('back', 'fixed', 'socket', [-0.66, 0.05, 0], '后边')],
    materials: [{ item: 'plank', count: 3 }],
    truthMode: 'reality-grounded', realNote: '木板车、木椅子在现实里都很常见。',
  },
  {
    id: 'frame', name: '车架', tags: ['frame'],
    geometry: [box([0.65, 0.05, 0.05], [-0.375, 0.42, 0], 'red'), box([0.05, 0.55, 0.05], [-0.2, 0.67, 0], 'red'), box([0.72, 0.05, 0.05], [0.15, 0.9, 0], 'red'), box([0.7, 0.05, 0.05], [0.225, 0.635, 0], 'red', 38), box([0.69, 0.04, 0.04], [-0.45, 0.66, 0], 'red', 44)],
    ports: [port('rearHub', 'revolute', 'plug', [-0.7, 0.42, 0], '后轮轴'), port('head', 'steer', 'socket', [0.5, 0.85, 0], '车头管'), port('seatPost', 'fixed', 'socket', [-0.25, 0.95, 0], '座管'), port('crank', 'revolute', 'socket', [-0.05, 0.42, 0], '中轴'), port('chainStay', 'drive', 'socket', [-0.4, 0.42, 0], '链条位置')],
    materials: [{ item: 'stick', count: 4 }],
    truthMode: 'game-simplification', realNote: '真实车架是钢或铝做的三角形管子；三角形让车架更稳。河谷里用木棍代替。',
  },
  {
    id: 'fork', name: '前叉', tags: ['fork'],
    geometry: [cyl(0.04, 0.3, 'y', [0, 0.1, 0], 'red'), box([0.47, 0.05, 0.05], [0.1, -0.215, 0], 'red', -65)],
    ports: [port('steerTop', 'steer', 'plug', [0, 0, 0], '转向轴'), port('wheelAxle', 'revolute', 'plug', [0.2, -0.43, 0], '前轮轴'), port('bar', 'fixed', 'socket', [0.02, 0.2, 0], '车把座')],
    materials: [{ item: 'stick', count: 2 }],
    truthMode: 'game-simplification', realNote: '前叉夹住前轮，车把一转，前轮跟着转。真实前叉是金属的。',
  },
  {
    id: 'handlebar', name: '车把', tags: ['handle'],
    geometry: [cyl(0.03, 0.12, 'y', [0, 0.05, 0], 'metal'), cyl(0.03, 0.6, 'z', [0, 0.11, 0], 'metal'), cyl(0.045, 0.12, 'z', [0, 0.11, 0.3], 'dark'), cyl(0.045, 0.12, 'z', [0, 0.11, -0.3], 'dark')],
    ports: [port('mount', 'fixed', 'plug', [0, 0, 0], '车把根')],
    materials: [{ item: 'stick', count: 1 }],
    truthMode: 'game-simplification', realNote: '握住车把控制方向。真实车把多是金属管。',
  },
  {
    id: 'seat', name: '座位', tags: ['seat', 'sittable'],
    geometry: [cyl(0.025, 0.1, 'y', [0, 0.05, 0], 'metal'), box([0.3, 0.07, 0.16], [0, 0.13, 0], 'dark')],
    ports: [port('post', 'fixed', 'plug', [0, 0, 0], '座杆')],
    materials: [{ item: 'plank', count: 1 }],
    truthMode: 'game-simplification', realNote: '真实车座常用皮革或塑料包软垫；这里用木板做。',
  },
  {
    id: 'crank', name: '脚踏', tags: ['crank'],
    geometry: [torus(0.12, 0.025, 'z', [0, 0, 0], 'metal'), box([0.04, 0.36, 0.04], [0, 0, 0.05], 'metal'), box([0.12, 0.03, 0.08], [0, 0.18, 0.1], 'dark'), box([0.12, 0.03, 0.08], [0, -0.18, -0.1], 'dark')],
    ports: [port('hub', 'revolute', 'plug', [0, 0, 0], '中轴')],
    materials: [{ item: 'stick', count: 1 }, { item: 'stone', count: 1 }],
    truthMode: 'game-simplification', realNote: '脚踩脚踏让牙盘转动。真实脚踏和牙盘是金属的。',
  },
  {
    id: 'chain', name: '链条', tags: ['chain'],
    geometry: [box([0.66, 0.02, 0.02], [0.025, 0.1, 0.04], 'dark'), box([0.66, 0.02, 0.02], [0.025, -0.1, 0.04], 'dark')],
    ports: [port('loop', 'drive', 'plug', [0, 0, 0], '链条')],
    materials: [{ item: 'stick', count: 2 }],
    truthMode: 'game-simplification', realNote: '真实链条由许多钢链节连成；河谷还没有金属，只能用木棍代替。',
  },
  {
    id: 'post', name: '立柱', tags: ['post'],
    geometry: [box([0.6, 0.08, 0.6], [0, 0.04, 0], 'stone'), box([0.16, 1.5, 0.16], [0, 0.8, 0], 'plank')],
    ports: [port('top', 'revolute', 'socket', [0, 1.45, 0.1], '顶上的轴')],
    materials: [{ item: 'plank', count: 2 }, { item: 'stone', count: 1 }],
    truthMode: 'reality-grounded', realNote: '风车要立得高，才能吹到更多的风。',
  },
  {
    id: 'rotor', name: '风车叶', tags: ['blade'],
    geometry: [cyl(0.08, 0.12, 'z', [0, 0, 0], 'yellow'), box([0.1, 0.6, 0.02], [0, 0.34, 0], 'cream'), box([0.1, 0.6, 0.02], [0, -0.34, 0], 'cream'), box([0.6, 0.1, 0.02], [0.34, 0, 0], 'cream'), box([0.6, 0.1, 0.02], [-0.34, 0, 0], 'cream')],
    ports: [port('hub', 'revolute', 'plug', [0, 0, 0], '叶片中心')],
    materials: [{ item: 'plank', count: 2 }],
    truthMode: 'reality-grounded', realNote: '叶片斜着迎风，风一推就转起来。',
  },
  {
    id: 'hull', name: '船身', tags: ['hull', 'sittable'],
    geometry: [box([1.3, 0.25, 0.6], [0, 0.125, 0], 'plank'), { shape: 'cone', radius: 0.3, length: 0.35, axis: 'x', at: [0.82, 0.13, 0], color: 'plank' }],
    ports: [port('deck', 'fixed', 'socket', [-0.2, 0.25, 0], '船舱'), port('mast', 'fixed', 'socket', [0.3, 0.25, 0], '桅杆座')],
    materials: [{ item: 'plank', count: 4 }],
    truthMode: 'reality-grounded', realNote: '木头比水轻，木船能浮起来；船身要严实，水才进不来。',
  },
  {
    id: 'mast', name: '桅杆和帆', tags: ['mast'],
    geometry: [cyl(0.03, 1, 'y', [0, 0.5, 0], 'wood'), box([0.5, 0.7, 0.02], [-0.27, 0.6, 0], 'cream')],
    ports: [port('base', 'fixed', 'plug', [0, 0, 0], '桅杆根')],
    materials: [{ item: 'stick', count: 1 }, { item: 'plank', count: 1 }],
    truthMode: 'game-simplification', realNote: '真实的帆用布做，风推着帆让船前进；河谷还没有布，先用薄木板代替。',
  },
  {
    id: 'leg', name: '椅腿', tags: ['leg'],
    geometry: [box([0.08, 0.5, 0.08], [0, -0.25, 0], 'wood')],
    ports: [port('top', 'fixed', 'plug', [0, 0, 0], '腿顶')],
    materials: [{ item: 'stick', count: 1 }],
    truthMode: 'reality-grounded', realNote: '四条腿把重量分到地面，椅子就站稳了。',
  },
  {
    id: 'backrest', name: '靠背', tags: ['board'],
    geometry: [box([0.06, 0.5, 0.8], [0, 0.25, 0], 'plank')],
    ports: [port('bottom', 'fixed', 'plug', [0, 0, 0], '靠背底')],
    materials: [{ item: 'plank', count: 1 }],
    truthMode: 'reality-grounded', realNote: '靠背让坐着的人可以向后靠。',
  },
  {
    id: 'car-body', name: '车体', tags: ['body', 'frame'],
    geometry: [box([1.7, 0.35, 0.9], [0, 0, 0], 'red'), box([0.5, 0.12, 0.86], [0.55, 0.2, 0], 'red'), box([0.04, 0.3, 0.84], [0.28, 0.33, 0], 'blue', -15), box([0.04, 0.24, 0.9], [-0.84, 0.29, 0], 'red')],
    ports: [port('frontAxle', 'fixed', 'socket', [0.55, -0.18, 0], '前轴座'), port('rearAxle', 'fixed', 'socket', [-0.55, -0.18, 0], '后轴座'), port('dash', 'fixed', 'socket', [0.12, 0.175, 0.2], '方向盘座'), port('seat1', 'fixed', 'socket', [-0.3, 0.175, 0.2], '前座位置'), port('seat2', 'fixed', 'socket', [-0.3, 0.175, -0.2], '副座位置'), port('lightL', 'fixed', 'socket', [0.85, 0, 0.28], '左车灯孔'), port('lightR', 'fixed', 'socket', [0.85, 0, -0.28], '右车灯孔')],
    materials: [{ item: 'plank', count: 4 }, { item: 'stick', count: 2 }],
    truthMode: 'game-simplification', realNote: '真实车体用钢板冲压焊接；河谷里用木板和木棍搭成。',
  },
  {
    id: 'steering-wheel', name: '方向盘', tags: ['steering', 'handle'],
    geometry: [cyl(0.025, 0.2, 'y', [0, 0.1, 0], 'metal'), torus(0.1, 0.02, 'x', [0, 0.22, 0], 'dark'), box([0.02, 0.18, 0.02], [0, 0.22, 0], 'dark')],
    ports: [port('column', 'fixed', 'plug', [0, 0, 0], '转向柱')],
    materials: [{ item: 'stick', count: 1 }],
    truthMode: 'game-simplification', realNote: '方向盘通过转向机构让前轮偏转；河谷里省略了里面的齿轮和拉杆。',
  },
  {
    id: 'car-seat', name: '座椅', tags: ['seat', 'sittable'],
    geometry: [box([0.3, 0.08, 0.3], [0, 0.04, 0], 'dark'), box([0.06, 0.32, 0.3], [-0.15, 0.2, 0], 'dark')],
    ports: [port('base', 'fixed', 'plug', [0, 0, 0], '座椅底')],
    materials: [{ item: 'plank', count: 1 }],
    truthMode: 'game-simplification', realNote: '真实座椅里有弹簧和软垫，还要配安全带。',
  },
  {
    id: 'headlight', name: '车灯', tags: ['light'],
    geometry: [cyl(0.08, 0.06, 'x', [0.03, 0, 0], 'yellow'), torus(0.08, 0.015, 'x', [0.05, 0, 0], 'metal')],
    ports: [port('mount', 'fixed', 'plug', [0, 0, 0], '灯座')],
    materials: [{ item: 'stone', count: 1 }],
    truthMode: 'game-simplification', realNote: '真实车灯有灯泡和电线，靠电发光；河谷里用磨亮的石头做灯罩。',
  },
]);

const slot = (id, typeId, at) => ({ id, typeId, at, rotY: 0 });
const joint = (id, a, b) => {
  const [ap, aport] = a.split('.');
  const [bp, bport] = b.split('.');
  return { id, a: { part: ap, port: aport }, b: { part: bp, port: bport } };
};

// Real-object knowledge used by the instant local analyzer.
// `core` lists parts the real object needs even if the child did not draw them.
export const OBJECT_TEMPLATES = Object.freeze([
  {
    id: 'car', name: '小汽车', keywords: ['汽车', '小汽车', '轿车', '赛车', '跑车', '骑车', '方向盘', 'car'],
    reason: '真实汽车由车体承载，轮轴连着四个轮子，方向盘控制方向，座椅坐人，车灯照路。',
    blueprint: {
      name: '我的小汽车',
      parts: [slot('body', 'car-body', [0, 0.58, 0]), slot('frontAxle', 'axle', [0.55, 0.4, 0]), slot('rearAxle', 'axle', [-0.55, 0.4, 0]), slot('w1', 'wheel', [0.55, 0.4, 0.52]), slot('w2', 'wheel', [0.55, 0.4, -0.52]), slot('w3', 'wheel', [-0.55, 0.4, 0.52]), slot('w4', 'wheel', [-0.55, 0.4, -0.52]), slot('steer', 'steering-wheel', [0.12, 0.755, 0.2]), slot('seat1', 'car-seat', [-0.3, 0.755, 0.2]), slot('seat2', 'car-seat', [-0.3, 0.755, -0.2]), slot('light1', 'headlight', [0.85, 0.58, 0.28]), slot('light2', 'headlight', [0.85, 0.58, -0.28])],
      joints: [joint('j1', 'body.frontAxle', 'frontAxle.mid'), joint('j2', 'body.rearAxle', 'rearAxle.mid'), joint('j3', 'frontAxle.endA', 'w1.hub'), joint('j4', 'frontAxle.endB', 'w2.hub'), joint('j5', 'rearAxle.endA', 'w3.hub'), joint('j6', 'rearAxle.endB', 'w4.hub'), joint('j7', 'body.dash', 'steer.column'), joint('j8', 'body.seat1', 'seat1.base'), joint('j9', 'body.seat2', 'seat2.base'), joint('j10', 'body.lightL', 'light1.mount'), joint('j11', 'body.lightR', 'light2.mount')],
      capabilities: ['roll', 'steer', 'sit', 'light'],
    },
    core: { body: '车体把所有部件连在一起，也保护坐车的人。', frontAxle: '轮子要装在轮轴上才能转。', rearAxle: '后面的轮子也需要一根轮轴。', steer: '方向盘控制汽车往哪边开。', seat1: '开车的人需要座椅。', seat2: '旁边也可以坐一个人。', light1: '晚上靠车灯照路，也让别人看见你。', light2: '两盏车灯照得更宽。' },
  },
  {
    id: 'bicycle', name: '自行车', keywords: ['自行车', '单车', '脚踏车', '骑的车', 'bike', 'bicycle'],
    reason: '真实自行车靠两个轮子滚动、前叉转向、脚踏和链条带动后轮。',
    blueprint: {
      name: '我的自行车',
      parts: [slot('frame', 'frame', [0, 0, 0]), slot('rearWheel', 'wheel', [-0.7, 0.42, 0]), slot('fork', 'fork', [0.5, 0.85, 0]), slot('frontWheel', 'wheel', [0.7, 0.42, 0]), slot('bar', 'handlebar', [0.52, 1.05, 0]), slot('seat', 'seat', [-0.25, 0.95, 0]), slot('crank', 'crank', [-0.05, 0.42, 0]), slot('chain', 'chain', [-0.4, 0.42, 0])],
      joints: [joint('j1', 'frame.rearHub', 'rearWheel.hub'), joint('j2', 'frame.head', 'fork.steerTop'), joint('j3', 'fork.wheelAxle', 'frontWheel.hub'), joint('j4', 'fork.bar', 'bar.mount'), joint('j5', 'frame.seatPost', 'seat.post'), joint('j6', 'frame.crank', 'crank.hub'), joint('j7', 'frame.chainStay', 'chain.loop')],
      capabilities: ['roll', 'steer', 'pedal', 'sit'],
    },
    core: { frame: '车架把所有部件连在一起。', fork: '没有前叉，前轮装不上，也转不了方向。', crank: '要有脚踏，才能踩着走。', chain: '链条把脚踏的力传到后轮。', seat: '骑车要有地方坐。', bar: '车把用来控制方向。' },
  },
  {
    id: 'cart', name: '小推车', keywords: ['小车', '推车', '板车', '汽车', '卡车', '车', 'cart', 'car'],
    reason: '真实的车子需要车板承载，轮轴把轮子和车板连起来。',
    blueprint: {
      name: '我的小推车',
      parts: [slot('deck', 'deck', [0, 0.55, 0]), slot('frontAxle', 'axle', [0.5, 0.47, 0]), slot('rearAxle', 'axle', [-0.5, 0.47, 0]), slot('w1', 'wheel', [0.5, 0.47, 0.52]), slot('w2', 'wheel', [0.5, 0.47, -0.52]), slot('w3', 'wheel', [-0.5, 0.47, 0.52]), slot('w4', 'wheel', [-0.5, 0.47, -0.52])],
      joints: [joint('j1', 'deck.front', 'frontAxle.mid'), joint('j2', 'deck.rear', 'rearAxle.mid'), joint('j3', 'frontAxle.endA', 'w1.hub'), joint('j4', 'frontAxle.endB', 'w2.hub'), joint('j5', 'rearAxle.endA', 'w3.hub'), joint('j6', 'rearAxle.endB', 'w4.hub')],
      capabilities: ['roll', 'sit'],
    },
    core: { frontAxle: '轮子要装在轮轴上才能转。', rearAxle: '后面也需要一根轮轴。', deck: '车板用来放东西或坐人。' },
  },
  {
    id: 'windmill', name: '风车', keywords: ['风车', '风扇', '螺旋桨', 'windmill'],
    reason: '真实风车要有高高的立柱和能转动的叶片。',
    blueprint: {
      name: '我的风车',
      parts: [slot('post', 'post', [0, 0, 0]), slot('rotor', 'rotor', [0, 1.45, 0.1])],
      joints: [joint('j1', 'post.top', 'rotor.hub')],
      capabilities: ['spin'],
    },
    core: { post: '叶片要装在高处的转轴上。' },
  },
  {
    id: 'boat', name: '小船', keywords: ['船', '木筏', '帆船', 'boat'],
    reason: '真实的船要有严实的船身；帆船还要桅杆和帆。',
    blueprint: {
      name: '我的小船',
      parts: [slot('hull', 'hull', [0, 0, 0]), slot('mast', 'mast', [0.3, 0.25, 0]), slot('seat', 'seat', [-0.2, 0.25, 0])],
      joints: [joint('j1', 'hull.mast', 'mast.base'), joint('j2', 'hull.deck', 'seat.post')],
      capabilities: ['float', 'sit'],
    },
    core: { hull: '船身让船浮在水上。', mast: '帆可以借风前进。' },
  },
  {
    id: 'chair', name: '椅子', keywords: ['椅子', '凳子', '板凳', 'chair'],
    reason: '真实的椅子要有座板和至少三条腿才站得稳。',
    blueprint: {
      name: '我的椅子',
      parts: [slot('board', 'deck', [0, 0.55, 0]), slot('l1', 'leg', [0.6, 0.5, 0.3]), slot('l2', 'leg', [0.6, 0.5, -0.3]), slot('l3', 'leg', [-0.6, 0.5, 0.3]), slot('l4', 'leg', [-0.6, 0.5, -0.3]), slot('back', 'backrest', [-0.66, 0.6, 0])],
      joints: [joint('j1', 'board.c1', 'l1.top'), joint('j2', 'board.c2', 'l2.top'), joint('j3', 'board.c3', 'l3.top'), joint('j4', 'board.c4', 'l4.top'), joint('j5', 'board.back', 'back.bottom')],
      capabilities: ['sit'],
    },
    core: { l1: '椅腿把椅子撑起来。', l2: '椅腿把椅子撑起来。', l3: '椅腿把椅子撑起来。', l4: '椅腿把椅子撑起来。' },
  },
]);

// Living things and whole sculptures are modelled as one figure instead of craftable parts.
export const FIGURE_LIMITS = Object.freeze({ parts: 16, shapes: 60, minScale: 0.3, maxScale: 2 });

const ball = (radius, at, color, scale) => ({ shape: 'sphere', radius, at, color, ...(scale ? { scale } : {}) });
const figPart = (id, parent, pivot, anim, shapes) => ({ id, parent, pivot, anim, shapes });

function quadruped({ name, fur, belly, ear, earLength = 0.16, tailLength = 0.5, tailAnim = 'wag', earAnim = 'none' }) {
  const legs = [[0.28, 0.15], [0.28, -0.15], [-0.28, 0.15], [-0.28, -0.15]].map(([x, z]) => cyl(0.06, 0.3, 'y', [x, 0.15, z], fur));
  return {
    name,
    scale: 1,
    parts: [
      figPart('body', null, [0, 0, 0], 'bob', [ball(0.3, [0, 0.45, 0], fur, [1.5, 0.95, 0.95]), ball(0.22, [0.05, 0.38, 0], belly, [1.4, 0.8, 0.9]), ...legs]),
      figPart('head', 'body', [0.48, 0.66, 0], 'nod', [ball(0.24, [0, 0, 0], fur), ball(0.11, [0.17, -0.06, 0], belly, [1, 0.8, 1.2]), ball(0.035, [0.19, 0.06, 0.09], 'dark'), ball(0.035, [0.19, 0.06, -0.09], 'dark'), ball(0.03, [0.27, -0.03, 0], '#d98b8b')]),
      figPart('ears', 'head', [0, 0.18, 0], earAnim, [{ shape: 'cone', radius: 0.07, length: earLength, axis: 'y', at: [0, earLength / 2, 0.11], color: ear }, { shape: 'cone', radius: 0.07, length: earLength, axis: 'y', at: [0, earLength / 2, -0.11], color: ear }]),
      figPart('tail', 'body', [-0.44, 0.52, 0], tailAnim, [
        { ...cyl(0.045, tailLength, 'y', [-0.29 * tailLength, 0.41 * tailLength, 0], fur), rot: [0, 0, 35] },
        ball(tailLength < 0.15 ? 0.08 : 0.055, [-0.57 * tailLength, 0.82 * tailLength, 0], fur),
      ]),
    ],
  };
}

export const FIGURE_TEMPLATES = Object.freeze([
  { id: 'cat', name: '小猫', keywords: ['猫', '猫咪', '小猫', 'cat', 'kitty'], reason: '小猫有圆脑袋、三角形耳朵、长尾巴和四条腿。', figure: quadruped({ name: '小猫', fur: '#e9a25f', belly: '#f6dfc1', ear: '#e9a25f' }) },
  { id: 'dog', name: '小狗', keywords: ['狗', '小狗', '狗狗', 'dog', 'puppy'], reason: '小狗有长一点的嘴巴、耷拉的耳朵和会摇的尾巴。', figure: quadruped({ name: '小狗', fur: '#c89666', belly: '#f2e3c8', ear: '#7a5a3c', earLength: 0.12, tailLength: 0.35 }) },
  { id: 'rabbit', name: '小兔', keywords: ['兔', '兔子', '小兔', 'rabbit', 'bunny'], reason: '小兔有长长的耳朵和短短的尾巴。', figure: quadruped({ name: '小兔', fur: '#f3efe6', belly: '#ffffff', ear: '#f3efe6', earLength: 0.42, tailLength: 0.08, tailAnim: 'none', earAnim: 'wag' }) },
  {
    id: 'bird', name: '小鸟', keywords: ['鸟', '小鸟', '鸽子', '鹦鹉', 'bird'], reason: '小鸟有尖嘴、两只翅膀和两条细腿。',
    figure: { name: '小鸟', scale: 1, parts: [
      figPart('body', null, [0, 0, 0], 'bob', [ball(0.24, [0, 0.45, 0], '#6fa8c8', [1.3, 1, 1]), ball(0.17, [0.24, 0.62, 0], '#6fa8c8'), ball(0.03, [0.36, 0.67, 0.08], 'dark'), ball(0.03, [0.36, 0.67, -0.08], 'dark'), { shape: 'cone', radius: 0.05, length: 0.14, axis: 'x', at: [0.44, 0.6, 0], color: '#f0c95c' }, cyl(0.02, 0.24, 'y', [0.02, 0.12, 0.08], '#f0c95c'), cyl(0.02, 0.24, 'y', [0.02, 0.12, -0.08], '#f0c95c')]),
      figPart('wingL', 'body', [0, 0.52, 0.22], 'flap', [box([0.36, 0.04, 0.3], [-0.05, 0, 0.13], '#4e86a6')]),
      figPart('wingR', 'body', [0, 0.52, -0.22], 'flap', [box([0.36, 0.04, 0.3], [-0.05, 0, -0.13], '#4e86a6')]),
    ] },
  },
  {
    id: 'fish', name: '小鱼', keywords: ['鱼', '小鱼', '金鱼', 'fish'], reason: '小鱼有流线型的身体、鳍和摆动的尾巴。',
    figure: { name: '小鱼', scale: 1, parts: [
      figPart('body', null, [0, 0.4, 0], 'bob', [ball(0.26, [0, 0, 0], '#f08a4b', [1.5, 1, 0.6]), ball(0.035, [0.27, 0.06, 0.1], 'dark'), ball(0.035, [0.27, 0.06, -0.1], 'dark'), box([0.2, 0.16, 0.02], [0, 0.24, 0], '#f6b77f', 20)]),
      figPart('tail', 'body', [-0.36, 0, 0], 'wag', [{ shape: 'cone', radius: 0.18, length: 0.3, axis: 'x', at: [-0.12, 0, 0], color: '#f6b77f' }]),
    ] },
  },
]);

// Words that route a drawing to the figure branch even when no template matches.
export const FIGURE_KEYWORDS = Object.freeze(['猫', '狗', '兔', '鸟', '鱼', '熊', '猪', '马', '牛', '羊', '鸭', '鸡', '龙', '恐龙', '怪兽', '娃娃', '小人', '人', '花', '树', '蘑菇', '雪人', '星星', '动物', 'animal']);

export const GENERIC_FIGURE = Object.freeze(quadruped({ name: '小伙伴', fur: '#9cc7a0', belly: '#e8f2e2', ear: '#9cc7a0' }));

const FIGURE_COLORS = ['#d97a5f', '#5b8fd8', '#8fb26f', '#f0c95c', '#b57b48', '#6fa8c8', '#c98063', '#9cc7a0'];
const CHARACTER_HINT = /奥特|超人|英雄|机器人|战士|公主|国王|骑士|人偶|怪兽|妖怪|精灵|娃娃|侠|曼$/;

function hashColor(text, salt = 0) {
  let h = salt;
  for (const ch of String(text)) h = (h * 33 + ch.codePointAt(0)) >>> 0;
  return FIGURE_COLORS[h % FIGURE_COLORS.length];
}

function sketchColor(draft) {
  const counts = new Map();
  for (const stroke of draft?.strokes || []) {
    if (typeof stroke.c !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(stroke.c)) continue;
    counts.set(stroke.c.toLowerCase(), (counts.get(stroke.c.toLowerCase()) || 0) + (stroke.p?.length || 1));
  }
  let best = null, most = 0;
  for (const [color, count] of counts) if (count > most) { best = color; most = count; }
  return best;
}

export function humanoidFigure({ name, suit, accent = '#f0c95c' }) {
  return {
    name, scale: 1,
    parts: [
      figPart('body', null, [0, 0, 0], 'bob', [box([0.38, 0.46, 0.22], [0, 0.74, 0], suit), ball(0.07, [0.14, 0.8, 0], accent)]),
      figPart('head', 'body', [0, 1.02, 0], 'nod', [ball(0.16, [0, 0.12, 0], suit), ball(0.035, [0.13, 0.14, 0.06], accent), ball(0.035, [0.13, 0.14, -0.06], accent), { shape: 'cone', radius: 0.05, length: 0.16, axis: 'y', at: [0, 0.32, 0], color: accent }]),
      figPart('armL', 'body', [0, 0.9, 0.16], 'flap', [box([0.3, 0.08, 0.08], [0.12, 0, 0.08], suit)]),
      figPart('armR', 'body', [0, 0.9, -0.16], 'flap', [box([0.3, 0.08, 0.08], [0.12, 0, -0.08], suit)]),
      figPart('legL', 'body', [0, 0.52, 0.08], 'none', [box([0.1, 0.46, 0.1], [0.02, -0.16, 0], suit)]),
      figPart('legR', 'body', [0, 0.52, -0.08], 'none', [box([0.1, 0.46, 0.1], [0.02, -0.16, 0], suit)]),
    ],
  };
}

export function sculptureFigure({ name, color, accent }) {
  return {
    name, scale: 1,
    parts: [
      figPart('base', null, [0, 0, 0], 'none', [cyl(0.28, 0.08, 'y', [0, 0.04, 0], '#f0e2c0')]),
      figPart('body', 'base', [0, 0.08, 0], 'bob', [box([0.4, 0.46, 0.34], [0, 0.28, 0], color), ball(0.16, [0, 0.64, 0], accent), { shape: 'cone', radius: 0.1, length: 0.22, axis: 'y', at: [0, 0.9, 0], color: accent }]),
    ],
  };
}

export function unknownFigure(draft, title) {
  const suit = sketchColor(draft) || hashColor(title);
  const accent = sketchColor(draft) ? hashColor(title, 7) : hashColor(title, 3);
  return CHARACTER_HINT.test(title) ? humanoidFigure({ name: title, suit, accent }) : sculptureFigure({ name: title, color: suit, accent });
}

const LOOK_FEATURES = new Set(['crest', 'chest-lamp', 'wings', 'tail', 'long-ears', 'horns', 'hat', 'fins', 'wheels', 'spots', 'beak', 'mane', 'cape', 'belt', 'antenna', 'gloves', 'boots', 'stripes', 'armor', 'joints', 'thruster', 'visor', 'claws', 'gear', 'pipes']);
const FEATURE_LABELS = Object.freeze({
  crest: '头冠', 'chest-lamp': '胸口的灯', wings: '翅膀', tail: '尾巴', 'long-ears': '长耳朵', horns: '角', hat: '帽子',
  fins: '鳍', wheels: '轮子', spots: '斑点', beak: '嘴巴', mane: '鬃毛', cape: '披风', belt: '腰带', antenna: '天线',
  gloves: '手套', boots: '靴子', stripes: '条纹', armor: '装甲', joints: '关节', thruster: '推进器', visor: '面罩',
  claws: '爪子', gear: '齿轮', pipes: '管子',
});
const DETAIL_RULES = Object.freeze([
  [/翅膀|机翼/, 'wings'], [/装甲|铠甲/, 'armor'], [/关节/, 'joints'], [/推进|喷气|喷射/, 'thruster'],
  [/面罩|护目/, 'visor'], [/爪子|利爪/, 'claws'], [/齿轮/, 'gear'], [/管子|管道/, 'pipes'], [/轮子/, 'wheels'],
]);
const CN_DIGIT = Object.freeze({ 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8 });
const hexColor = value => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : '';

function mentionedCount(text, nouns) {
  const re = new RegExp(`([0-8一二两三四五六七八])\\s*[只条个]?\\s*(?:${nouns.join('|')})`, 'g');
  let found = null;
  for (const match of String(text || '').matchAll(re)) found = CN_DIGIT[match[1]] ?? Number(match[1]);
  return Number.isInteger(found) ? found : null;
}

function limbCount(value) {
  const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  return Number.isInteger(n) && n >= 0 && n <= 6 ? n : null;
}

function resolveCount(given, text, nouns, fallback) {
  const fromText = mentionedCount(text, nouns);
  const fromField = limbCount(given);
  if (fromText != null && (fromField == null || fromText > fromField)) return Math.min(fromText, 6);
  return fromField ?? fallback;
}

export function lookFacts(look = {}) {
  const kind = look.kind === 'humanoid' || look.kind === 'creature' ? look.kind : 'object';
  const features = [...new Set((Array.isArray(look.features) ? look.features : []).filter(item => LOOK_FEATURES.has(item)))];
  const details = [];
  for (const item of Array.isArray(look.details) ? look.details : []) {
    const phrase = String(item || '').trim().slice(0, 16);
    if (phrase && !details.includes(phrase)) details.push(phrase);
    if (details.length >= 12) break;
  }
  const blob = `${look.summary || ''} ${details.join(' ')}`;
  for (const [pattern, feature] of DETAIL_RULES) if (pattern.test(blob) && !features.includes(feature)) features.push(feature);
  const kept = features.slice(0, 16);
  const usual = kind === 'humanoid' ? 2 : 0;
  const arms = resolveCount(look.arms, blob, ['胳膊', '手臂'], usual);
  const legs = resolveCount(look.legs, blob, ['腿'], usual);
  const eyes = resolveCount(look.eyes, blob, ['眼睛', '眼'], kind === 'object' ? 0 : 2);
  const wings = resolveCount(look.wings, blob, ['翅膀', '机翼'], kept.includes('wings') ? 2 : 0);
  const marks = [];
  if (arms !== usual) marks.push(`${arms}条胳膊`);
  if (legs !== usual) marks.push(`${legs}条腿`);
  if (eyes !== (kind === 'object' ? 0 : 2)) marks.push(`${eyes}只眼睛`);
  if (wings > 0 && !marks.some(mark => mark.includes('翅膀'))) marks.push(`${wings}只翅膀`);
  for (const phrase of details) if (!marks.includes(phrase)) marks.push(phrase);
  for (const feature of features) {
    const label = FEATURE_LABELS[feature];
    if (label && !marks.some(mark => mark.includes(label))) marks.push(label);
  }
  const bits = readBits(look);
  for (const bit of bits) if (!marks.includes(bit.name)) marks.push(bit.name);
  return { kind, features: new Set(kept), arms, legs, eyes, wings, details, bits, marks };
}

const BIT_SHAPES = new Set(['box', 'sphere', 'cylinder', 'cone']);
const BIT_ANCHORS = new Set(['head', 'body', 'back', 'chest', 'left', 'right', 'top']);
const BIT_SIZES = Object.freeze({ small: 0.1, medium: 0.18, large: 0.3 });
const BIT_ANCHOR = Object.freeze({
  head: { parent: 'head', pivot: [0, 0.22, 0] },
  top: { parent: 'head', pivot: [0, 0.3, 0] },
  chest: { parent: 'body', pivot: [0.18, 0.82, 0] },
  back: { parent: 'body', pivot: [-0.2, 0.78, 0] },
  left: { parent: 'body', pivot: [0, 0.82, 0.22] },
  right: { parent: 'body', pivot: [0, 0.82, -0.22] },
  body: { parent: 'body', pivot: [0.08, 0.7, 0] },
});

function readBits(look) {
  const bits = [];
  for (const item of Array.isArray(look.parts) ? look.parts : []) {
    if (!item || typeof item !== 'object') continue;
    const name = String(item.name || '').replace(/[\u0000-\u001f<>`]/g, '').trim().slice(0, 8);
    if (!name) continue;
    const color = item.color === 'main' || item.color === 'accent' || item.color === 'extra' || hexColor(item.color) ? (hexColor(item.color) || item.color) : 'accent';
    bits.push({
      name,
      shape: BIT_SHAPES.has(item.shape) ? item.shape : 'sphere',
      anchor: BIT_ANCHORS.has(item.anchor) ? item.anchor : 'body',
      size: BIT_SIZES[item.size] || BIT_SIZES.medium,
      color,
    });
    if (bits.length >= 8) break;
  }
  return bits;
}

function bitShape(shape, size, color) {
  if (shape === 'box') return box([size, size * 0.75, size * 0.6], [0, 0, 0], color);
  if (shape === 'cylinder') return cyl(Math.max(0.04, size * 0.28), size * 1.2, 'y', [0, size * 0.3, 0], color);
  if (shape === 'cone') return { shape: 'cone', radius: Math.max(0.04, size * 0.35), length: size * 1.2, axis: 'y', at: [0, size * 0.3, 0], color };
  return ball(Math.max(0.05, size * 0.45), [0, 0, 0], color);
}

export const EDIT_COLORS = Object.freeze(['#d97a5f', '#5b8fd8', '#8fb26f', '#f0c95c', '#f4f1ea', '#354438']);
export const EDIT_SHAPES = Object.freeze({ sphere: '圆球', box: '方块', cylinder: '圆柱', cone: '尖角' });
export const EDIT_ANCHORS = Object.freeze({ head: '头上', body: '身上', back: '背上', chest: '胸口', left: '左边', right: '右边', top: '头顶' });
export const EDIT_SIZES = Object.freeze({ small: '小', medium: '中', large: '大' });

export function partLabel(id) {
  if (id === 'body') return '身体';
  if (id === 'head') return '头';
  if (/^arm/i.test(id)) return '胳膊';
  if (/^leg/i.test(id)) return '腿';
  if (/^wing/i.test(id)) return '翅膀';
  if (id === 'tail') return '尾巴';
  if (id === 'ears') return '耳朵';
  if (/^(bit|edit)/.test(id)) return '加上的';
  return '一块';
}

// Adds one solid onto a copy of the same figure. The caller keeps the original id and place.
export function appendPiece(figure, spec = {}) {
  const next = JSON.parse(JSON.stringify(figure));
  if (next.parts.length >= 16 || next.parts.reduce((n, part) => n + part.shapes.length, 0) >= 60) return null;
  const shape = Object.hasOwn(EDIT_SHAPES, spec.shape) ? spec.shape : 'sphere';
  const anchor = Object.hasOwn(EDIT_ANCHORS, spec.anchor) ? spec.anchor : 'body';
  const sizeName = Object.hasOwn(EDIT_SIZES, spec.size) ? spec.size : 'medium';
  const color = hexColor(spec.color) || EDIT_COLORS[0];
  const spot = BIT_ANCHOR[anchor] || BIT_ANCHOR.body;
  const has = id => next.parts.some(part => part.id === id);
  const parent = has(spot.parent) ? spot.parent : has('body') ? 'body' : next.parts[0]?.id;
  if (!parent) return null;
  let n = 1;
  while (next.parts.some(part => part.id === `edit${n}`)) n += 1;
  const siblings = next.parts.filter(part => part.parent === parent && /^edit/.test(part.id)).length;
  const pivot = [spot.pivot[0], spot.pivot[1] + siblings * 0.06, spot.pivot[2] + (siblings % 2 ? -1 : 1) * siblings * 0.08];
  next.parts.push(figPart(`edit${n}`, parent, pivot, 'bob', [bitShape(shape, BIT_SIZES[sizeName], color)]));
  return next;
}

export function recolorPart(figure, partId, color) {
  const hex = hexColor(color);
  if (!hex) return null;
  const next = JSON.parse(JSON.stringify(figure));
  const part = next.parts.find(item => item.id === partId);
  if (!part) return null;
  for (const shape of part.shapes) shape.color = hex;
  return next;
}

export function removePart(figure, partId) {
  const next = JSON.parse(JSON.stringify(figure));
  const part = next.parts.find(item => item.id === partId);
  if (!part || part.id === next.parts[0].id || next.parts.some(item => item.parent === partId)) return null;
  next.parts = next.parts.filter(item => item.id !== partId);
  return next;
}

function placeImagined(parts, bits, colors) {
  const used = {};
  const has = id => parts.some(part => part.id === id);
  bits.forEach((bit, index) => {
    if (parts.length >= 16) return;
    const spec = BIT_ANCHOR[bit.anchor] || BIT_ANCHOR.body;
    const parent = has(spec.parent) ? spec.parent : (has('body') ? 'body' : null);
    if (!parent) return;
    const n = used[`${parent}:${bit.anchor}`] || 0;
    used[`${parent}:${bit.anchor}`] = n + 1;
    const side = n % 2 === 0 ? 1 : -1;
    const pivot = [spec.pivot[0], spec.pivot[1] + n * 0.04, spec.pivot[2] + side * n * 0.08];
    const color = colors[bit.color] || bit.color;
    parts.push(figPart(`bit${index + 1}`, parent, pivot, 'bob', [bitShape(bit.shape, bit.size, color)]));
  });
}

export function figureFromLook(look = {}) {
  const name = String(look.name || '我的发明').slice(0, 20);
  const main = hexColor(look.main) || hashColor(name);
  const accent = hexColor(look.accent) || hashColor(name, 3);
  const extra = hexColor(look.extra) || '#f4d8a5';
  const facts = lookFacts(look);
  if (facts.kind === 'humanoid') return humanoidLook(name, main, accent, extra, facts);
  if (facts.kind === 'creature') return creatureLook(name, main, accent, extra, facts);
  return objectLook(name, main, accent, extra, facts);
}

function placeEyes(head, count, color) {
  const n = Math.min(count, 4);
  for (let i = 0; i < n; i += 1) {
    const z = n === 1 ? 0 : (i - (n - 1) / 2) * 0.06;
    head.push(ball(0.035, [0.13, 0.14, z], color));
  }
}

function placeArms(parts, count, color, glove) {
  const n = Math.min(count, Math.max(0, 16 - parts.length));
  for (let i = 0; i < n; i += 1) {
    const side = i % 2 === 0 ? 1 : -1;
    const row = Math.floor(i / 2);
    const y = 0.98 - row * 0.2;
    const z = side * 0.16;
    const shapes = [box([0.3, 0.07, 0.07], [0.12, 0, side * 0.06], color)];
    if (glove) shapes.push(box([0.06, 0.08, 0.08], [0.28, 0, side * 0.06], glove));
    parts.push(figPart(`arm${i + 1}`, 'body', [0, y, z], row ? 'flap' : 'none', shapes));
  }
}

function placeLegs(parts, count, color, boot) {
  const n = Math.min(count, Math.max(0, 16 - parts.length));
  for (let i = 0; i < n; i += 1) {
    const side = i % 2 === 0 ? 1 : -1;
    const row = Math.floor(i / 2);
    const z = side * (0.08 + row * 0.1);
    const shapes = [box([0.1, 0.46, 0.1], [0.02, -0.16, 0], color)];
    if (boot) shapes.push(box([0.12, 0.08, 0.12], [0.04, -0.36, 0], boot));
    parts.push(figPart(`leg${i + 1}`, 'body', [0, 0.52, z], 'none', shapes));
  }
}

function pushPart(parts, part) {
  if (parts.length < 16) parts.push(part);
}

function placeWings(parts, count, color) {
  const n = Math.min(count, Math.max(0, 16 - parts.length));
  for (let i = 0; i < n; i += 1) {
    const side = i % 2 === 0 ? 1 : -1;
    const row = Math.floor(i / 2);
    const y = 0.92 - row * 0.22;
    const z = side * (0.18 + row * 0.02);
    parts.push(figPart(`wing${i + 1}`, 'body', [0, y, z], 'flap', [box([0.5, 0.05, 0.36], [-0.02, 0.02, side * 0.2], color)]));
  }
}

function addMechanical(parts, features, accent, extra) {
  const body = parts.find(part => part.id === 'body');
  const head = parts.find(part => part.id === 'head');
  if (body && features.has('armor') && body.shapes.length < 10) {
    body.shapes.push(box([0.42, 0.16, 0.26], [0.02, 0.86, 0], accent));
    body.shapes.push(box([0.34, 0.1, 0.26], [0.02, 0.66, 0], extra));
  }
  if (body && features.has('gear') && body.shapes.length < 11) body.shapes.push(cyl(0.08, 0.04, 'x', [0.2, 0.78, 0.1], extra));
  if (body && features.has('pipes') && body.shapes.length < 11) body.shapes.push(cyl(0.03, 0.28, 'y', [-0.16, 0.7, 0.12], extra));
  if (head && features.has('visor') && head.shapes.length < 11) head.shapes.push(box([0.06, 0.06, 0.2], [0.14, 0.14, 0], accent));
  if (features.has('joints')) {
    const limbs = parts.filter(part => /^arm|^leg/.test(part.id));
    if (limbs.length) {
      for (const part of limbs) {
        if (part.shapes.length >= 11) continue;
        part.shapes.push(cyl(0.05, 0.05, 'z', [0.02, 0, 0], extra));
      }
    } else if (body && body.shapes.length < 10) {
      body.shapes.push(cyl(0.05, 0.05, 'z', [0.1, 0.4, 0.12], extra), cyl(0.05, 0.05, 'z', [0.1, 0.4, -0.12], extra));
    }
  }
  if (features.has('claws')) {
    for (const part of parts) {
      if (!part.id.startsWith('arm') || part.shapes.length >= 11) continue;
      part.shapes.push({ shape: 'cone', radius: 0.03, length: 0.08, axis: 'x', at: [0.28, 0, 0], color: extra });
    }
  }
  if (features.has('thruster')) {
    pushPart(parts, figPart('thrust1', 'body', [-0.12, 0.72, 0.1], 'none', [{ shape: 'cone', radius: 0.06, length: 0.16, axis: 'y', at: [0, -0.08, 0], color: accent }]));
    pushPart(parts, figPart('thrust2', 'body', [-0.12, 0.72, -0.1], 'none', [{ shape: 'cone', radius: 0.06, length: 0.16, axis: 'y', at: [0, -0.08, 0], color: accent }]));
  }
  if (features.has('wheels') && !parts.some(part => part.id.startsWith('wheel'))) {
    pushPart(parts, figPart('wheelL', 'body', [0, 0.16, 0.2], 'spin', [cyl(0.1, 0.05, 'z', [0, 0, 0.04], extra)]));
    pushPart(parts, figPart('wheelR', 'body', [0, 0.16, -0.2], 'spin', [cyl(0.1, 0.05, 'z', [0, 0, -0.04], extra)]));
  }
}

function humanoidLook(name, main, accent, extra, facts) {
  const features = facts.features;
  const body = [box([0.38, 0.46, 0.22], [0, 0.74, 0], main)];
  if (features.has('chest-lamp')) body.push(ball(0.07, [0.16, 0.8, 0], accent));
  if (features.has('spots')) body.push(ball(0.05, [0.08, 0.62, 0.08], extra), ball(0.04, [-0.02, 0.84, -0.06], extra));
  if (features.has('belt')) body.push(box([0.4, 0.06, 0.24], [0, 0.62, 0], accent));
  if (features.has('stripes')) body.push(box([0.4, 0.05, 0.23], [0, 0.9, 0], extra));
  const head = [ball(0.16, [0, 0.12, 0], main)];
  placeEyes(head, facts.eyes, accent);
  if (features.has('crest')) head.push({ shape: 'cone', radius: 0.05, length: 0.16, axis: 'y', at: [0, 0.32, 0], color: accent });
  if (features.has('horns')) head.push({ shape: 'cone', radius: 0.04, length: 0.16, axis: 'y', at: [0.02, 0.26, 0.08], color: extra }, { shape: 'cone', radius: 0.04, length: 0.16, axis: 'y', at: [0.02, 0.26, -0.08], color: extra });
  if (features.has('hat')) head.push(cyl(0.12, 0.08, 'y', [0, 0.3, 0], accent));
  if (features.has('antenna')) head.push({ shape: 'cone', radius: 0.02, length: 0.18, axis: 'y', at: [0, 0.36, 0], color: extra });
  if (features.has('beak')) head.push({ shape: 'cone', radius: 0.04, length: 0.12, axis: 'x', at: [0.2, 0.08, 0], color: accent });
  const parts = [
    figPart('body', null, [0, 0, 0], 'bob', body),
    figPart('head', 'body', [0, 1.02, 0], 'nod', head),
  ];
  placeArms(parts, facts.arms, main, features.has('gloves') ? accent : '');
  placeLegs(parts, facts.legs, main, features.has('boots') ? extra : '');
  if (features.has('cape')) pushPart(parts, figPart('cape', 'body', [-0.16, 0.95, 0], 'none', [box([0.08, 0.55, 0.28], [-0.06, -0.2, 0], accent)]));
  placeWings(parts, facts.wings, accent);
  if (features.has('tail')) pushPart(parts, figPart('tail', 'body', [-0.16, 0.7, 0], 'wag', [box([0.28, 0.06, 0.06], [-0.16, 0.04, 0], accent)]));
  if (features.has('mane')) pushPart(parts, figPart('mane', 'head', [0, 0.12, 0], 'none', [ball(0.08, [-0.08, 0.12, 0], extra), ball(0.07, [-0.04, 0.2, 0.08], extra)]));
  addMechanical(parts, features, accent, extra);
  placeImagined(parts, facts.bits, { main, accent, extra });
  return { name, scale: 1, parts };
}

function creatureLook(name, main, accent, extra, facts) {
  const features = facts.features;
  const ears = features.has('long-ears') ? 0.42 : 0.16;
  const body = [ball(0.3, [0, 0.45, 0], main, [1.5, 0.95, 0.95]), ball(0.2, [0.05, 0.36, 0], extra, [1.2, 0.7, 0.85])];
  [[0.28, 0.15], [0.28, -0.15], [-0.28, 0.15], [-0.28, -0.15]].forEach(([x, z]) => body.push(cyl(0.06, 0.3, 'y', [x, 0.15, z], main)));
  if (features.has('spots')) body.push(ball(0.06, [0.1, 0.55, 0.16], accent), ball(0.05, [-0.12, 0.5, -0.14], accent));
  const head = [ball(0.22, [0, 0, 0], main), ball(0.035, [0.16, 0.05, 0.08], 'dark'), ball(0.035, [0.16, 0.05, -0.08], 'dark')];
  if (features.has('beak')) head.push({ shape: 'cone', radius: 0.05, length: 0.14, axis: 'x', at: [0.24, -0.02, 0], color: accent });
  else head.push(ball(0.03, [0.22, -0.04, 0], '#d98b8b'));
  const parts = [
    figPart('body', null, [0, 0, 0], 'bob', body),
    figPart('head', 'body', [0.48, 0.66, 0], 'nod', head),
  ];
  if (features.has('horns')) parts.push(figPart('horns', 'head', [0, 0.16, 0], 'none', [{ shape: 'cone', radius: 0.04, length: 0.18, axis: 'y', at: [0, 0.1, 0.08], color: accent }, { shape: 'cone', radius: 0.04, length: 0.18, axis: 'y', at: [0, 0.1, -0.08], color: accent }]));
  else parts.push(figPart('ears', 'head', [0, 0.16, 0], features.has('long-ears') ? 'wag' : 'none', [{ shape: 'cone', radius: 0.06, length: ears, axis: 'y', at: [0, ears / 2, 0.1], color: main }, { shape: 'cone', radius: 0.06, length: ears, axis: 'y', at: [0, ears / 2, -0.1], color: main }]));
  if (features.has('tail') || features.has('fins')) parts.push(figPart('tail', 'body', [-0.42, 0.5, 0], 'wag', [{ ...cyl(0.045, features.has('fins') ? 0.2 : 0.42, 'y', [-0.12, 0.18, 0], accent), rot: [0, 0, 35] }]));
  placeWings(parts, facts.wings, accent);
  if (features.has('mane')) parts.push(figPart('mane', 'head', [-0.08, 0.08, 0], 'none', [ball(0.1, [-0.08, 0.08, 0], extra)]));
  addMechanical(parts, features, accent, extra);
  placeImagined(parts, facts.bits, { main, accent, extra });
  return { name, scale: 1, parts };
}

function objectLook(name, main, accent, extra, facts) {
  const features = facts.features;
  const body = [box([0.46, 0.36, 0.34], [0, 0.42, 0], main)];
  if (features.has('spots')) body.push(ball(0.06, [0.1, 0.5, 0.12], accent));
  if (features.has('hat') || features.has('crest')) body.push({ shape: 'cone', radius: 0.12, length: 0.28, axis: 'y', at: [0, 0.74, 0], color: accent });
  const parts = [figPart('body', null, [0, 0, 0], 'bob', body)];
  if (features.has('wheels')) {
    parts.push(figPart('wheelL', 'body', [0, 0.16, 0.2], 'spin', [cyl(0.12, 0.06, 'z', [0, 0, 0.04], extra)]));
    parts.push(figPart('wheelR', 'body', [0, 0.16, -0.2], 'spin', [cyl(0.12, 0.06, 'z', [0, 0, -0.04], extra)]));
  } else parts.unshift(figPart('base', null, [0, 0, 0], 'none', [cyl(0.26, 0.08, 'y', [0, 0.04, 0], '#f0e2c0')]));
  if (features.has('fins')) parts.push(figPart('fin', 'body', [0, 0.6, 0], 'wag', [box([0.28, 0.16, 0.04], [0, 0.12, 0], accent)]));
  if (features.has('tail')) parts.push(figPart('tail', 'body', [-0.24, 0.4, 0], 'wag', [box([0.24, 0.08, 0.08], [-0.16, 0, 0], accent)]));
  placeWings(parts, facts.wings, accent);
  addMechanical(parts, features, accent, extra);
  placeImagined(parts, facts.bits, { main, accent, extra });
  return { name, scale: 1, parts };
}

// Test field in the valley where finished creations can be tried out.
export const TEST_FIELD = Object.freeze({
  lab: { x: -6.3, z: 9.6 },
  desk: { x: -3.7, z: 9.8 },
  // West of the lab and north of the warehouse, clear of the river, trees and dandelion sites.
  spots: [{ x: -9.7, z: 6.2 }, { x: -9.7, z: 8.2 }, { x: -12.3, z: 7.3 }, { x: -13.7, z: 5.4 }],
  sign: { x: -8.7, z: 5.0 },
  rollDistance: 2.4,
});

export function isCreationReserved(x, z) {
  if (Math.hypot(x - TEST_FIELD.lab.x, z - TEST_FIELD.lab.z) <= 1.6) return true;
  if (Math.hypot(x - TEST_FIELD.desk.x, z - TEST_FIELD.desk.z) <= 1.2) return true;
  return x >= -14.6 && x <= -8.6 && z >= 4.8 && z <= 9;
}
