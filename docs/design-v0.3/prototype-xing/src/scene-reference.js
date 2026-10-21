import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { setNight, M, B } from './kit.js';
import * as CH from './chars.js';
import * as BD from './builds.js';

const VALLEYS = {
  ri: { name: '日谷', fogDay: '#9DB0CC', fogNight: '#1B2546', ground: '#2E3238', groundR: 0.35, groundM: 0.25, density: 0.012,
    models: [
      { id: 'tower', name: '红白铁塔', kind: 'b', make: BD.tower, act: '点亮', dims: '正面 11×30 · 侧面 11×30 · 俯视 11×11（格）', note: '混凝土底座 → 四腿收分钢架 → 下观景台 → 中段 → 上观景台 → 天线和航空灯。交互：电梯门、望远镜（反向远眺）、点灯开关。' },
      { id: 'viaduct', name: '高架电车', kind: 'b', make: BD.viaduct, act: '到站开门', dims: '正面 24×8 · 侧面 4×8 · 俯视 24×4（格）', note: '桥墩 → 桥面和护栏 → 铁轨和枕木 → 两节电车 → 接触网。交互：上车点、车门、车窗。' },
      { id: 'shrine', name: '山坡寺社', kind: 'b', make: BD.shrine, act: '点亮石灯笼', dims: '正面 12×10 · 侧面 12×10 · 俯视 12×12（格）', note: '石台基和石阶 → 鸟居 → 四座石灯笼 → 主殿（柱、墙、五层瓦顶）。交互：石灯笼、知识牌。不能拆，不做参拜。' },
      { id: 'xiaochun', name: '小春', kind: 'c', make: CH.xiaochun, act: '拍照', dims: '正面 8×25 · 侧面 6×25 · 俯视 8×6（体素，1 体素 = 0.075 格）', note: '防风外套、耳机（青色小灯自发光）、邮差包。交互：日语对话、一起拍照。' },
      { id: 'azhe', name: '阿哲', kind: 'c', make: CH.azhe, act: '抛纸鹤', dims: '正面 9×28 · 侧面 9×28 · 俯视 9×9（体素）', note: '狸猫族少年：连帽外套、工装裤、环纹尾巴、纸鹤。交互：折纸几何、纸鹤。' },
      { id: 'miko', name: '咪可站长', kind: 'c', make: CH.miko, act: '吹哨', dims: '正面 8×27 · 侧面 8×27 · 俯视 8×8（体素）', note: '三花猫站长：制服、黄铜扣和肩章、站长帽。交互：礼仪、失物招领柜。' },
    ] },
  mei: { name: '美谷', fogDay: '#C99A68', fogNight: '#1B2233', ground: '#4A4038', groundR: 0.9, groundM: 0, density: 0.009,
    models: [
      { id: 'stage', name: '1 号摄影棚', kind: 'b', make: BD.stage, act: '开门拍摄', dims: '正面 10×9 · 侧面 14×9 · 俯视 10×14（格）', note: '砖墙和壁柱 → 推拉大门 → 阶梯拱顶 → 通风口；壁灯和拍摄中红灯自发光。交互：推拉门、拍摄中灯、门牌。' },
      { id: 'palace', name: '星光大影院', kind: 'b', make: BD.palace, act: '首映夜', dims: '正面 12×15 · 侧面 10×15 · 俯视 12×10（格）', note: '台阶 → 大厅玻璃门 → 灯泡雨棚 → 三级退台立面 → 竖招牌（只有灯泡，没有字）。交互：售票窗、大门、放映机房窗口。' },
      { id: 'street', name: '街景布景', kind: 'b', make: BD.streetset, act: '打开假门', dims: '正面 14×8 · 侧面 5×8 · 俯视 14×5（格）', note: '三栋楼的立面 → 背后木架和斜撑 → 沙袋。交互：正门（后面是木架）、背面知识牌。' },
      { id: 'maya', name: 'Maya', kind: 'c', make: CH.maya, act: '打板', dims: '正面 8×25 · 侧面 6×25 · 俯视 8×6（体素）', note: '工装马甲、护目镜、场记板。交互：项目方法、开拍。' },
      { id: 'klik', name: '咔嚓', kind: 'c', make: CH.klik, act: '对焦', dims: '正面 9×22 · 侧面 9×22 · 俯视 9×9（体素）', note: '黑漆机身、黄铜镜头、两只片盘、三脚架腿；说话时镜头发光、指示灯闪。交互：镜头语言、拍照。' },
      { id: 'rudy', name: 'Rudy', kind: 'c', make: CH.rudy, act: '喊开拍', dims: '正面 9×28 · 侧面 8×28 · 俯视 9×8（体素）', note: '浣熊族导演：长风衣、贝雷帽、黄铜喇叭、环纹尾巴。交互：英语片场词、分镜。' },
    ] },
  xing: { name: '外星谷', fogDay: '#14284A', fogNight: '#070D1E', ground: '#141A26', groundR: 0.3, groundM: 0.6, density: 0.016,
    models: [
      { id: 'dome', name: '数据穹顶', kind: 'b', make: BD.dome, act: '补全穹顶', dims: '正面 24×13 · 侧面 24×13 · 俯视 24×24（格，原型缩小版）', note: '基环和青色灯带 → 六边形全息板拼成的半球（会呼吸）→ 中央终端台。交互：终端台、缺口板（第 3 章）。' },
      { id: 'pad', name: '悬浮修炼平台', kind: 'b', make: BD.pad, act: '完成挑战', dims: '正面 7×8 · 侧面 7×8 · 俯视 7×7（格）', note: '能量光柱 → 倒锥底座 → 八边形主盘 → 边沿灯带 → 能量核 → 四根导引柱。交互：能量核、边沿、导引柱。' },
      { id: 'ship', name: '星舰「咕咕号」', kind: 'b', make: BD.ship, act: '起飞', dims: '正面 9×6 · 侧面 18×6 · 俯视 9×18（格）', note: '起落架 → 主机身和面板缝 → 座舱罩（半透明）→ 引擎舱和喷口（自发光）→ 短翼和尾翼 → 舷梯。交互：舷梯、座舱、能量舱口。' },
      { id: 'avatar', name: '星核化身', kind: 'c', make: CH.avatar, act: '升星阶', dims: '正面 8×25 · 侧面 6×25 · 俯视 8×6（体素）', note: '石墨外骨骼、接缝光纹（自发光，可换色）、半透明面罩。交互：化身面板、回声台。' },
      { id: 'gugu', name: '小咕', kind: 'c', make: CH.gugu, act: '天线指路', dims: '正面 8×29 · 侧面 7×29 · 俯视 8×7（体素）', note: '修长的外星少年：四指、长款飞行员外套（发光线）、发光天线。交互：外星符号、天线指方向。' },
      { id: 'zero', name: '零一', kind: 'c', make: CH.zero, act: '扫描', dims: '正面 10×8 · 侧面 8×8 · 俯视 10×8（体素，悬浮在 14–22 体素高）', note: '切角立方装甲、六角传感眼（自发光）、两侧推进器。交互：数学出题、扫描。' },
    ] },
};

const qs = new URLSearchParams(location.search);
const state = { v: VALLEYS[qs.get('v')] ? qs.get('v') : 'xing', m: qs.get('m') ?? 'all', night: qs.get('night') === '1', fancy: qs.get('q') !== 'fast', anim: qs.get('s') || 'idle' };

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 600);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.495; controls.minDistance = 1; controls.maxDistance = 200;

const hemi = new THREE.HemisphereLight('#cfe0ff', '#3a3028', 1.0); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffe2b8', 2.4); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight('#8fb0ff', 0.4); fill.position.set(-30, 20, -20); scene.add(fill);
const key = new THREE.DirectionalLight('#ffffff', 0.5); key.position.set(0.4, 0.6, 1); camera.add(key); scene.add(camera);

const groundMat = new THREE.MeshStandardMaterial({ color: '#333', roughness: 0.5, metalness: 0.1 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), groundMat); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const grid = new THREE.GridHelper(120, 120, '#ffffff', '#ffffff'); grid.material.transparent = true; grid.material.opacity = 0.06; grid.position.y = 0.005; scene.add(grid);

const starGeo = new THREE.BufferGeometry(); const sp = [];
for (let i = 0; i < 1400; i++) { const th = Math.random() * Math.PI * 2; const ph = Math.random() * Math.PI * 0.45 + 0.05; const r = 260; sp.push(Math.cos(th) * Math.cos(ph) * r, Math.sin(ph) * r, Math.sin(th) * Math.cos(ph) * r); }
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#cfe8ff', size: 1.3, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9 }));
scene.add(stars);

const shaftMat = new THREE.MeshBasicMaterial({ color: '#ffe2b0', transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
const shafts = new THREE.Group(); scene.add(shafts);
for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(1.5 + i, 4 + i * 1.5, 70, 24, 1, true), shaftMat); s.position.set(-40 + i * 18, 30, -70 - i * 6); s.rotation.z = 0.5; shafts.add(s); }

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.45, 0.82); composer.addPass(bloom);
composer.addPass(new OutputPass());

let current = []; let root = null; let t0 = performance.now();

function frame(obj, items) {
  const box = new THREE.Box3().setFromObject(obj); const size = box.getSize(new THREE.Vector3()); const c = box.getCenter(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z);
  const aspect = camera.aspect; const fit = r / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * (aspect < 1 ? 1.25 / aspect : (state.m === 'all' ? 0.95 : 1.3));
  controls.target.copy(c);
  const dir = new THREE.Vector3(0.55, 0.5, 1).normalize();
  camera.position.copy(c).addScaledVector(dir, fit);
  camera.near = Math.max(0.02, fit / 200); camera.far = fit * 20 + 300; camera.updateProjectionMatrix();
  sun.position.copy(c).add(new THREE.Vector3(r * 0.9, r * 1.4, r * 0.7)); sun.target.position.copy(c);
  const sc = sun.shadow.camera; sc.left = sc.bottom = -r; sc.right = sc.top = r; sc.near = 0.1; sc.far = r * 5; sc.updateProjectionMatrix();
  controls.minDistance = r * 0.3; controls.maxDistance = fit * 4;
}

function pedestal(g, w) { const p = B(g, -w / 2, -0.02, -w / 2, w, 0.12, w, M('#20242C', { r: 0.4, m: 0.6 })); p.position.y = 0.04; }

function build() {
  if (root) scene.remove(root);
  root = new THREE.Group(); scene.add(root); current = [];
  const V = VALLEYS[state.v];
  if (state.m === 'all') {
    let x = 0; const bs = V.models.filter((m) => m.kind === 'b'); const cs = V.models.filter((m) => m.kind === 'c');
    const placed = [];
    bs.forEach((m) => { const o = m.make(); const b = new THREE.Box3().setFromObject(o.group); const w = b.max.x - b.min.x; o.group.position.x = x - b.min.x; x += w + 3; root.add(o.group); current.push({ m, o }); placed.push(o); });
    const total = x - 3; placed.forEach((o) => { o.group.position.x -= total / 2; });
    const scale = 5; const step = 7;
    cs.forEach((m, i) => { const o = m.make(); const holder = new THREE.Group(); holder.add(o.group); pedestal(holder, 1.2); holder.scale.setScalar(scale); holder.position.set((i - 1) * step, 0, 17); root.add(holder); current.push({ m, o }); });
  } else {
    const m = V.models[Number(state.m)] || V.models[0]; const o = m.make();
    if (m.kind === 'c') pedestal(o.group, 1.2);
    root.add(o.group); current.push({ m, o });
  }
  root.traverse((n) => { if (n.isMesh) { n.castShadow = n.castShadow !== false; n.receiveShadow = true; } });
  frame(root);
  applyEnv(); renderUI();
}

function applyEnv() {
  const V = VALLEYS[state.v]; document.body.classList.toggle('night', state.night);
  const fogC = new THREE.Color(state.night ? V.fogNight : V.fogDay);
  scene.background = fogC; scene.fog = new THREE.FogExp2(fogC, V.density * (state.m === 'all' ? 0.55 : 1) * (state.v === 'xing' || state.night ? 1 : 0.8));
  groundMat.color.set(V.ground); groundMat.roughness = V.groundR; groundMat.metalness = V.groundM;
  const warm = state.v === 'mei' ? '#ffc27a' : state.v === 'ri' ? '#ffd6b0' : '#b8d8ff';
  if (state.night) { sun.color.set('#9fb8ff'); sun.intensity = 0.9; hemi.intensity = 0.65; hemi.color.set('#7f98d8'); hemi.groundColor.set('#141821'); fill.intensity = 0.25; key.intensity = 0.9; key.color.set('#b8ccff'); renderer.toneMappingExposure = 1.05; }
  else { sun.color.set(warm); sun.intensity = state.v === 'xing' ? 2.0 : 2.6; hemi.intensity = state.v === 'xing' ? 1.0 : 1.0; hemi.color.set(state.v === 'mei' ? '#ffe0b8' : '#cfe0ff'); hemi.groundColor.set('#3a3028'); fill.intensity = 0.45; key.intensity = 0.45; key.color.set('#ffffff'); renderer.toneMappingExposure = state.v === 'xing' ? 1.15 : 1.0; }
  stars.visible = state.night || state.v === 'xing';
  shafts.visible = !state.night && state.v !== 'xing' && !(state.m !== 'all' && VALLEYS[state.v].models[Number(state.m)]?.kind === 'c'); shaftMat.color.set(warm); shaftMat.opacity = state.v === 'mei' ? 0.035 : 0.03;
  setNight(state.night);
  scene.environmentIntensity = state.night ? 0.28 : (state.v === 'xing' ? 0.45 : 0.35);
  bloom.strength = state.night ? 0.8 : 0.45;
}

const $ = (s) => document.querySelector(s);
function renderUI() {
  const V = VALLEYS[state.v];
  $('#valleys').innerHTML = Object.entries(VALLEYS).map(([id, v]) => `<button data-v="${id}" class="${id === state.v ? 'on' : ''}">${v.name}</button>`).join('');
  $('#models').innerHTML = `<button data-m="all" class="${state.m === 'all' ? 'on' : ''}">全部</button>` + V.models.map((m, i) => `<button data-m="${i}" class="${String(i) === String(state.m) ? 'on' : ''}"><i>${m.kind === 'b' ? '建' : '角'}</i>${m.name}</button>`).join('');
  $('#daynight').textContent = state.night ? '🌙 夜晚' : '☀️ 白天';
  $('#quality').textContent = state.fancy ? '画质：精美' : '画质：流畅';
  const single = state.m !== 'all'; const m = single ? V.models[Number(state.m)] : null;
  const states = m ? (m.kind === 'c' ? [['idle', '待机'], ['talk', '说话'], ['special', m.act]] : [['idle', '默认'], ['action', m.act]]) : [];
  if (m && !states.some(([k]) => k === state.anim)) state.anim = 'idle';
  $('#anims').innerHTML = states.map(([k, l]) => `<button data-a="${k}" class="${k === state.anim ? 'on' : ''}">${l}</button>`).join('');
  $('#info').innerHTML = m ? `<b>${m.name}</b><span>${m.dims}</span><p>${m.note}</p>` : `<b>${V.name} · 全部原型</b><span>3 个建筑（真实比例）+ 3 个角色（放大 5 倍展示）</span><p>点上面的名字看单个模型。拖动旋转，双指或滚轮缩放。</p>`;
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.v) { state.v = b.dataset.v; state.m = 'all'; state.anim = 'idle'; build(); }
  else if (b.dataset.m) { state.m = b.dataset.m; state.anim = 'idle'; build(); }
  else if (b.dataset.a) { state.anim = b.dataset.a; t0 = performance.now(); renderUI(); }
  else if (b.id === 'daynight') { state.night = !state.night; applyEnv(); renderUI(); }
  else if (b.id === 'quality') { state.fancy = !state.fancy; renderer.shadowMap.enabled = true; sun.shadow.mapSize.set(state.fancy ? 2048 : 1024, state.fancy ? 2048 : 1024); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } renderUI(); }
  else if (b.id === 'reset') frame(root);
  else if (b.id === 'toggleInfo') document.body.classList.toggle('noinfo');
});

function resize() {
  const w = window.innerWidth; const h = window.innerHeight;
  renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', () => { resize(); });
resize(); build();

const tStart = performance.now();
function loop() {
  const t = (performance.now() - tStart) / 1000; const ta = (performance.now() - t0) / 1000;
  for (const { o } of current) o.anim?.(state.m === 'all' ? t : ta, state.m === 'all' ? 'idle' : state.anim);
  controls.update();
  if (state.fancy) composer.render(); else renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();
window.__ready = true;
