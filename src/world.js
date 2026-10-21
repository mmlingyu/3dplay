import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ITEMS, terrainHeight, WORLD_SIZE, roofSpan } from './game-data.js';
import { BALL_RULES } from './ball-data.js';
import { WATER_RULES, POOL, inPoolReservedArea } from './water-data.js';
import { FLORA_BY_ID, floraStage, floraBlocked, realMoment, skyLook } from './life-data.js';
import { LAND_RULES, FACILITY_CHUNKS, isPointOpen, landBounds, openChunks, landEncounters } from './land-data.js';
import { CreationWorld } from './creation-world.js';
import { BOUNCE_ISLAND, PARK_NAME, PLAY_MODES, bounceSurface, onBounceIsland, parkPadAt, playBounce, playMode } from './bounce-data.js';
import { BALLOON_BASE, BALLOON_CONTROL, BALLOON_NAME, balloonAngleFrom, balloonHomeAngle, balloonHomeDuration, balloonLook, balloonNearBase, balloonReturnPose, balloonScaleFrom, balloonSteer, balloonTourPoint, onBalloonLawn } from './balloon-data.js';
import { dockShip, drawSouvenir, spinSouvenirs } from './mei-models.js';
import { chooseDockSite } from './realm-data.js';
import { DISCOVER_HEIGHT, VISTAS, activeBottle, nearestVista, vistaClarity } from './vista-data.js';
import { ballGravity, playerFall } from './motion-gravity.js';
import { trackListeners, trackWorldCreated, trackWorldReleased } from './scene-stats.js';

const C = { grass: '#a8bf7a', leaf: '#789957', leafLight: '#b6c785', soil: '#b48d64', wood: '#b97944', stone: '#8b9c9b', cream: '#fff5db', roof: '#c98063', water: '#8ebdc0', green: '#426b58' };
const NAME_SHOW_DISTANCE = 3;
const clamp = THREE.MathUtils.clamp;
function lerpAngle(a, b, t) {
  const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + delta * t;
}
function vistaYaw(from, vista) {
  return Math.atan2(vista.x - from.x, vista.z - from.z) + Math.PI;
}
const seeded = (x, z, n = 0) => { const s = Math.sin(x * 127.1 + z * 311.7 + n * 74.7) * 43758.5453; return s - Math.floor(s); };
function texture(kind, color) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, 128, 128);
  if (kind === 'wood') {
    for (let j = 0; j < 4; j++) {
      ctx.fillStyle = j % 2 ? '#b58151' : '#c99a68'; ctx.fillRect(j * 32 + 1, 0, 30, 128);
      ctx.strokeStyle = '#9e6c4140'; ctx.lineWidth = 1;
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(j * 32 + 6 + k * 6, 0); ctx.bezierCurveTo(j * 32 + 8 + k * 6, 36, j * 32 + 3 + k * 6, 70, j * 32 + 6 + k * 6, 128); ctx.stroke(); }
    }
  } else if (kind === 'brick') {
    ctx.fillStyle = '#d2aa87'; ctx.fillRect(0, 39, 128, 3); ctx.fillRect(0, 83, 128, 3);
    for (let i = 0; i < 3; i++) { const x = i === 1 ? 30 : 64; ctx.fillRect(x, i * 43, 3, 40); }
  } else {
    for (let i = 0; i < 400; i++) { const x = seeded(i, 4) * 128, y = seeded(i, 2) * 128; ctx.fillStyle = kind === 'grass' ? (i % 2 ? '#c9d59b35' : '#738a5225') : (i % 2 ? '#ffffff18' : '#4c4c3b20'); const s = kind === 'stone' ? 2.8 : 1.8; ctx.fillRect(x, y, s, s); }
  }
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
function wedgeGeometry() {
  const g = new THREE.BufferGeometry();
  const p = [
    -.5,0,.5, .5,0,.5, .5,1,-.5, -.5,0,.5, .5,1,-.5, -.5,1,-.5,
    -.5,0,-.5, -.5,1,-.5, .5,1,-.5, -.5,0,-.5, .5,1,-.5, .5,0,-.5,
    -.5,0,.5, -.5,1,-.5, -.5,0,-.5, .5,0,.5, .5,0,-.5, .5,1,-.5,
    -.5,0,.5, -.5,0,-.5, .5,0,-.5, -.5,0,.5, .5,0,-.5, .5,0,.5
  ]; g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const uv = []; for (let i = 0; i < p.length / 3; i++) uv.push((p[i * 3] + .5), (p[i * 3 + 2] + .5));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
}
function roofRise(spanW, spanD) {
  return Math.min(1.6, 0.85 + Math.min(spanW, spanD) * 0.08);
}
function gableGeometry(spanW, spanD) {
  const eaves = 0.85;
  const width = spanW + eaves * 2;
  const depth = spanD + eaves * 2;
  const rise = roofRise(spanW, spanD);
  const hw = width / 2, hd = depth / 2, eaveY = 0.92, peakY = eaveY + rise;
  const p = [];
  const add = (...v) => p.push(...v);
  const L = [-hw, eaveY, -hd], R = [hw, eaveY, -hd], L2 = [-hw, eaveY, hd], R2 = [hw, eaveY, hd];
  const RL = [-hw, peakY, 0], RR = [hw, peakY, 0];
  add(...L, ...RL, ...RR, ...L, ...RR, ...R);
  add(...L2, ...R2, ...RL, ...R2, ...RR, ...RL);
  add(...L, ...L2, ...RL);
  add(...R, ...RR, ...R2);
  add(...L, ...R, ...R2, ...L, ...R2, ...L2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}

export class RiverWorld {
  constructor(canvas, callbacks = {}) {
    this.realmId = 'he';
    this.released = false;
    this.canvas = canvas; this.callbacks = callbacks; this.state = null; this.selectedTarget = null;
    this.targets = []; this.pickMeshes = []; this.buildGroups = new Map(); this.plantGroups = new Map(); this.decorColliders = [];
    this.floraGroups=new Map();this.floraGeometry=new THREE.SphereGeometry(1,8,6);
    this.chunkGroups=new Map();this.encounterGroups=new Map();this.landGeometry=new THREE.BoxGeometry(.998,1.8,.998);
    this.time = 0; this.walkTarget = null; this.walkCallback = null; this.yaw = .64; this.distance = 20; this.modelFocus = null; this.rotation = 0;
    this.motionTime = 0; this.locomotion = 'walk'; this.pool = null; this.poolGroup = null;
    this.playerPosition = new THREE.Vector3(-5, 0, 5); this.velocityY = 0; this.facing = Math.PI; this.lastMove = false;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#dbe8d6'); this.scene.fog = new THREE.Fog('#dbe8d6', 42, 86);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8)); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.25;
    this.camera = new THREE.PerspectiveCamera(43, 1, .1, 140); this.lookAt = new THREE.Vector3(-4, 0, 3);
    this.sun = new THREE.DirectionalLight('#fff4d8', 2.6); this.sun.position.set(-12, 24, 10); this.sun.castShadow = true;
    Object.assign(this.sun.shadow.camera, { left: -23, right: 23, top: 23, bottom: -23, near: 1, far: 70 }); this.sun.shadow.mapSize.set(1536, 1536); this.sun.shadow.bias = -.0003; this.sun.shadow.normalBias = .025;
    this.scene.add(this.sun);this.skyLight=new THREE.HemisphereLight('#e4ecdf', '#afa083', 2.1);this.scene.add(this.skyLight);
    this.box = new THREE.BoxGeometry(1, 1, 1); this.roundBox = new RoundedBoxGeometry(1, 1, 1, 2, .06); this.wedge = wedgeGeometry(); this.roofGeometries = new Map();
    this.cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
    this.previewBallGeometry = new THREE.SphereGeometry(.22,12,8);
    this.mats = {};
    this.mat('wood', C.wood, texture('wood', C.wood)); this.mat('soil', C.soil, texture('soil', C.soil)); this.mat('grass', C.grass, texture('grass', C.grass));
    this.mat('stone', C.stone, texture('stone', C.stone)); this.mat('clay', '#bc8165', texture('soil', '#bc8165')); this.mat('brick', C.roof, texture('brick', C.roof));
    this.mat('cream', C.cream); this.mat('roof', C.roof); this.mat('leaf', C.leaf); this.mat('leafLight', C.leafLight); this.mat('green', C.green); this.mat('dark', '#354438'); this.mat('flower', '#eed396'); this.mat('mint', '#8fd0c6'); this.mat('bounce', '#ffe4c4');
    this.mat('door', '#8f6238'); this.mat('window', '#9ec9c4'); this.mat('bed', '#efe0b8'); this.mat('fence', C.wood); this.mat('pot', '#c47a60'); this.mat('wreath', '#5f8a48'); this.mat('lantern', '#e0a35a'); this.mat('flag', '#d36b5a'); this.mat('balloon', '#e27a5f'); this.mat('paper', '#f7f1e4'); this.mat('carp', '#e07a4a');
    this.groundMeshes = []; this.terrain(); this.landmarks(); this.details(); this.batchDecorations();
    this.creation = new CreationWorld(this);
    this.player = this.avatar(); this.scene.add(this.player);
    this.swimRipple=new THREE.Mesh(new THREE.RingGeometry(.42,.46,32),new THREE.MeshBasicMaterial({color:'#f3f6df',transparent:true,opacity:.48,side:THREE.DoubleSide,depthWrite:false}));
    this.swimRipple.rotation.x=-Math.PI/2;this.swimRipple.visible=false;this.scene.add(this.swimRipple);
    this.selectionRing = new THREE.Mesh(new THREE.RingGeometry(.55, .63, 40), new THREE.MeshBasicMaterial({ color: '#fff3be', side: THREE.DoubleSide, transparent: true, opacity: .85, depthWrite: false }));
    this.selectionRing.rotation.x = -Math.PI / 2; this.selectionRing.visible = false; this.scene.add(this.selectionRing);
    this.frontierPreview=new THREE.Group();this.frontierPreview.visible=false;this.scene.add(this.frontierPreview);
    this.frontierFillMaterial=new THREE.MeshBasicMaterial({color:C.grass,transparent:true,opacity:.28,depthWrite:false});
    this.frontierLineMaterial=new THREE.MeshBasicMaterial({color:'#fff3be',transparent:true,opacity:.85,depthWrite:false});
    this.frontierFill=new THREE.Mesh(this.box,this.frontierFillMaterial);this.frontierPreview.add(this.frontierFill);
    this.frontierLine=new THREE.Mesh(this.box,this.frontierLineMaterial);this.frontierPreview.add(this.frontierLine);
    this.preview = new THREE.Group(); this.previewMaterial = new THREE.MeshStandardMaterial({ color: '#fff0ae', transparent: true, opacity: .46, roughness: .9, depthWrite: false, side: THREE.DoubleSide }); this.scene.add(this.preview); this.preview.visible = false;
    this.roofMat = this.mats.roof.clone(); this.roofMat.side = THREE.DoubleSide;
    this.particles = []; this.balls = []; this.ballMaterial = new THREE.MeshStandardMaterial({ color: '#d9ac70', map: this.mats.wood.map, roughness: .83 }); this.minimap = document.getElementById('minimap');
    this.vistaPick = [];
    this.vistaGlance = null;
    this.vistaView = null;
    this.vistaMomentOverride = null;
    this.makeBottle();
    this.vistaReady = import('./vista-view.js').then((mod) => {
      if (this.released) return;
      this.vistaView = mod.mountVistas(this.scene);
      this.vistaPick = this.vistaView.pick;
    }).catch((error) => { console.warn('远景还没装上', error); });
    this.bindPointer(); this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(canvas); this.resize();
    this.updateCamera(1, true); this.renderer.render(this.scene, this.camera);
    trackWorldCreated();
  }
  mat(name, color, map = null) { const m = new THREE.MeshStandardMaterial({ color, map, roughness: .87, metalness: 0 }); this.mats[name] = m; return m; }
  mesh(parent, geometry, material, pos = [0, 0, 0], scale = [1, 1, 1]) { const m = new THREE.Mesh(geometry, typeof material === 'string' ? this.mats[material] : material); m.position.set(...pos); m.scale.set(...scale); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
  roofGeometry(spanW, spanD) {
    const key = `${spanW}x${spanD}`;
    if (!this.roofGeometries.has(key)) this.roofGeometries.set(key, gableGeometry(spanW, spanD));
    return this.roofGeometries.get(key);
  }
  cube(parent, material, pos, scale = [1, 1, 1], rounded = false) { return this.mesh(parent, rounded ? this.roundBox : this.box, material, pos, scale); }
  batchDecorations() {
    // Repeated static blocks share draw calls; interactive objects keep their own hit targets.
    this.scene.updateMatrixWorld(true);
    const buckets = new Map();
    this.scene.traverse(m => {
      if (!m.isMesh || m.isInstancedMesh || m.userData.targetId || Array.isArray(m.material)) return;
      let ancestor = m.parent;
      while (ancestor) { if (ancestor === this.clouds) return; ancestor = ancestor.parent; }
      const key = `${m.geometry.uuid}:${m.material.uuid}:${m.castShadow}:${m.receiveShadow}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(m);
    });
    for (const meshes of buckets.values()) {
      if (meshes.length < 3) continue;
      const first = meshes[0], instances = new THREE.InstancedMesh(first.geometry, first.material, meshes.length);
      instances.castShadow = first.castShadow; instances.receiveShadow = first.receiveShadow;
      meshes.forEach((m, i) => { instances.setMatrixAt(i, m.matrixWorld); m.removeFromParent(); });
      this.scene.add(instances);
    }
  }
  target(group, data) {
    group.userData.target = data; const obj = { ...data, group, position: group.position.clone() }; this.targets.push(obj);
    group.traverse(m => { if (m.isMesh) { m.userData.targetId = data.id; this.pickMeshes.push(m); } }); return obj;
  }
  terrain() {
    const size = WORLD_SIZE || 32; const materials = [this.mats.soil, this.mats.soil, this.mats.grass, this.mats.soil, this.mats.soil, this.mats.soil];
    const geometry = new THREE.BoxGeometry(.998, 1.8, .998); const land = new THREE.InstancedMesh(geometry, materials, size * size); const matrix = new THREE.Matrix4(); const color = new THREE.Color();
    let n = 0;
    for (let x = -16; x < 16; x++) for (let z = -16; z < 16; z++) { const y = terrainHeight(x, z); matrix.makeTranslation(x, y - .9, z); land.setMatrixAt(n, matrix); color.setScalar(.93 + seeded(x, z) * .13); land.setColorAt(n++, color); }
    land.receiveShadow = true; this.scene.add(land); this.groundMeshes.push(land);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(3, 33, 1, 32), new THREE.MeshStandardMaterial({ color: C.water, transparent: true, opacity: .84, roughness: .24, metalness: .05 })); water.rotation.x = -Math.PI / 2; water.position.set(4, WATER_RULES.riverLevel, -.5); water.receiveShadow = true; this.scene.add(water); this.water = water;
    this.ripples = new THREE.Group(); this.scene.add(this.ripples);
    for (let i = 0; i < 16; i++) { const line = new THREE.Mesh(new THREE.PlaneGeometry(.3 + seeded(i, 4) * .8, .025), new THREE.MeshBasicMaterial({ color: '#e0eddb', transparent: true, opacity: .35, depthWrite: false })); line.rotation.x = -Math.PI / 2; line.position.set(3 + seeded(i, 6) * 2, -.609, -15 + i * 2); this.ripples.add(line); }
    const path = new THREE.InstancedMesh(new THREE.BoxGeometry(.92, .055, .92), new THREE.MeshStandardMaterial({ color: '#d5c49c', roughness: 1 }), 130); let count = 0;
    for (let x = -13; x <= 11; x++) for (let z = -6; z <= 7; z++) {
      if (((z === 2 || z === 3) && (x < 3 || x > 5)) || (x === -7 && z < 2) || (x === 10 && z > 2)) { matrix.makeTranslation(x, terrainHeight(x, z) + .027, z); path.setMatrixAt(count++, matrix); }
    }
    path.count = count; path.receiveShadow = true; this.scene.add(path);
    const bridge = new THREE.Group(); bridge.position.set(4, .02, 2.5); this.scene.add(bridge);
    for (let x = -1.8; x <= 1.8; x += .4) this.cube(bridge, 'wood', [x, -.03, 0], [.36, .15, 1.7]);
    for (const x of [-1.4, 1.4]) for (const z of [-.9, .9]) this.cube(bridge, 'wood', [x, .4, z], [.13, .8, .13]);
    for (const z of [-.9, .9]) this.cube(bridge, 'wood', [0, .6, z], [3.2, .12, .12]);
    this.bridge = { minX: 2.1, maxX: 5.9, minZ: 1.65, maxZ: 3.35, height: .10 };
    const edges = new THREE.Group(); this.scene.add(edges);
    for (let i = 0; i < 18; i++) { const x = -18 + i * 2.2, z = -22 - seeded(i, 8) * 5; const hill = this.cube(edges, i % 2 ? 'leaf' : 'leafLight', [x, 1, z], [4 + seeded(i, 1) * 3, 3 + seeded(i, 4) * 4, 6], true); hill.castShadow = false; }
  }
  tree(x, z, scale = 1, leafColor = 'leaf') {
    const g = new THREE.Group(); const y = terrainHeight(Math.round(x), Math.round(z)); g.position.set(x, y, z); this.scene.add(g);
    this.cube(g, 'wood', [0, .95 * scale, 0], [.32 * scale, 1.9 * scale, .32 * scale], true);
    const a = this.cube(g, leafColor, [0, 2.1 * scale, 0], [1.55 * scale, 1.1 * scale, 1.5 * scale], true); a.rotation.y = .13;
    this.cube(g, 'leafLight', [-.43 * scale, 2.7 * scale, .1], [1.15 * scale, .8 * scale, 1.05 * scale], true);
    this.cube(g, leafColor, [.44 * scale, 2.45 * scale, -.2], [1.2 * scale, .9 * scale, 1.2 * scale], true);
    this.decorColliders.push({ x, z, radius: .3 }); return g;
  }
  log(parent, x, y, z, rotation = Math.PI / 2) {
    const g = new THREE.Group(); g.position.set(x, y, z); const log = this.mesh(g, new THREE.CylinderGeometry(.16, .16, 1.12, 8), 'wood'); log.rotation.z = rotation;
    const cap = this.mesh(g, new THREE.CylinderGeometry(.165, .165, .018, 8), new THREE.MeshStandardMaterial({ color: '#e8c78c', roughness: .95 })); cap.rotation.z = rotation; cap.position.x = -.567; parent.add(g); return g;
  }
  sign(parent, color, pos) { this.cube(parent, 'wood', [pos[0], pos[1] - .3, pos[2]], [.1, .7, .1]); this.cube(parent, color, pos, [.65, .4, .08], true); }
  landmarks() {
    const wood = new THREE.Group(); wood.position.set(-9, 0, -7); this.scene.add(wood);
    for (let i = 0; i < 5; i++) this.log(wood, i < 3 ? (i - 1) * .06 : .02, i < 3 ? .18 : .47, (i % 3 - 1) * .36);
    this.sign(wood, 'cream', [.75, .8, .2]); this.target(wood, { id: 'wood-source', type: 'resource', item: 'wood', name: '林间木料', action: '采木料', label: '木料', hint: '木料 ×2 · 游戏补料点' });
    const branches = new THREE.Group(); branches.position.set(-10, 0, -4); this.scene.add(branches);
    for (let i = 0; i < 7; i++) { const twig = this.cube(branches, 'wood', [(seeded(i, 3) - .5), .09, (seeded(i, 5) - .5) * .65], [.1, .1, .8], true); twig.rotation.y = i * .7; }
    this.target(branches, { id: 'branch-source', type: 'resource', item: 'branch', name: '干枝堆', action: '拾干枝', label: '', hint: '干枝可以给窑炉当燃料' });
    const stone = new THREE.Group(); stone.position.set(-12.2, 0, -6.2); this.scene.add(stone);
    for (let i = 0; i < 7; i++) { const r = this.cube(stone, 'stone', [(seeded(i, 6) - .5) * 1.4, .2 + (i > 4 ? .4 : 0), (seeded(i, 8) - .5) * .9], [.5, .45, .5], true); r.rotation.y = i * .8; }
    this.target(stone, { id: 'stone-source', type: 'resource', item: 'stone', name: '石料堆', action: '取石料', label: '石料', hint: '石料 ×2 · 游戏补料点' });
    const clay = new THREE.Group(); clay.position.set(-4.2, 0, -7.6); this.scene.add(clay);
    this.cube(clay, 'wood', [0, .12, 0], [1.4, .24, 1.1], true); for (let i = 0; i < 5; i++) this.cube(clay, 'clay', [(i % 3 - 1) * .36, .36 + Math.floor(i / 3) * .28, 0], [.36, .3, .6], true);
    this.target(clay, { id: 'clay-source', type: 'resource', item: 'clay', name: '制砖黏土', action: '取黏土', label: '黏土', hint: '适宜的黏土原料，去工坊制砖' });
    const workshop = new THREE.Group(); workshop.position.set(-5.9, 0, -4.2); this.scene.add(workshop);
    this.cube(workshop, 'wood', [0, .72, 0], [1.8, .18, 1.1], true); for (const x of [-.72, .72]) for (const z of [-.38, .38]) this.cube(workshop, 'wood', [x, .36, z], [.17, .72, .17]);
    this.cube(workshop, 'cream', [-.3, .87, .05], [.58, .1, .58]); this.cube(workshop, 'green', [.5, .92, .08], [.3, .2, .3], true); this.log(workshop, -.2, 1, -.35);
    this.target(workshop, { id: 'public-workbench', type: 'station', panel: 'craft', context: { atWorkbench: true }, name: '公共工作台', action: '来合成', label: '工作台', hint: '摆一摆材料，看看能做什么' });
    const axleStation = new THREE.Group(); axleStation.position.set(-7.9, 0, -3.4); this.scene.add(axleStation);
    this.cube(axleStation, 'wood', [0, .68, 0], [1.5, .16, .8], true);
    for (const x of [-.52, .52]) this.cube(axleStation, 'wood', [x, .34, 0], [.14, .68, .14], true);
    const demoAxle = this.mesh(axleStation, new THREE.CylinderGeometry(.045, .045, 1.12, 10), 'stone', [0, .95, 0]);
    demoAxle.rotation.z = Math.PI / 2;
    for (const x of [-.53, .53]) {
      const demoWheel = this.mesh(axleStation, new THREE.TorusGeometry(.27, .045, 7, 16), 'cream', [x, .95, 0]);
      demoWheel.rotation.y = Math.PI / 2;
    }
    this.sign(axleStation, 'cream', [0, 1.55, -.34]);
    this.target(axleStation, { id: 'axle-station', type: 'station', panel: 'axle', name: '轮轴试装台', action: '试装轮轴', label: '轮轴试装', hint: '把轮子装上固定轴，再试着分别转动它们' });
    const canopy = new THREE.Group(); canopy.position.set(-6.4, 0, -5.3); this.scene.add(canopy);
    for (const x of [-1.5, 1.5]) for (const z of [-1.1, 1.1]) this.cube(canopy, 'wood', [x, 1.35, z], [.14, 2.7, .14]);
    for (let i = 0; i < 9; i++) this.cube(canopy, i % 2 ? 'leafLight' : 'cream', [-1.6 + i * .4, 2.76, 0], [.4, .12, 2.7]);
    const kiln = new THREE.Group(); kiln.position.set(-2.6, 0, -4.5); this.scene.add(kiln);
    this.cube(kiln, 'brick', [0, .65, 0], [1.25, 1.3, 1.25], true); this.cube(kiln, 'dark', [0, .44, .635], [.68, .58, .035], true); this.cube(kiln, 'wood', [0, .22, .68], [.55, .09, .12]); this.cube(kiln, 'brick', [.3, 1.67, -.3], [.4, .8, .4]);
    this.kilnGlow = this.cube(kiln, new THREE.MeshStandardMaterial({ color: '#f1b875', emissive: '#eab070', emissiveIntensity: .15 }), [0, .45, .66], [.43, .24, .02]);
    const clayMat = new THREE.MeshStandardMaterial({ color: '#6e3d2a', roughness: 0.72, emissive: '#6e3d2a', emissiveIntensity: 0.45 });
    this.kilnPiece = this.mesh(kiln, new THREE.BoxGeometry(0.58, 0.2, 0.28), clayMat, [0, 0.4, 0.74]);
    this.kilnPiece.visible = false;
    this.kilnCrack = this.mesh(kiln, new THREE.BoxGeometry(0.045, 0.24, 0.02), new THREE.MeshBasicMaterial({ color: '#2c1814' }), [0.05, 0.42, 0.9]);
    this.kilnCrack.rotation.z = 0.7;
    this.kilnCrack.visible = false;
    this.kilnSteam = [0, 1, 2, 3].map(() => {
      const puff = this.mesh(kiln, new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshBasicMaterial({ color: '#f4fbff', transparent: true, opacity: 0, depthWrite: false }), [0, 0.8, 0.74]);
      puff.castShadow = false;
      puff.visible = false;
      return puff;
    });
    this.kilnFlames = ['#ffd27a', '#ff8a32', '#ffb15a'].map((color, index) => {
      const flame = this.mesh(kiln, new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color }), [(index - 1) * 0.16, 0.48, 0.7]);
      flame.castShadow = false;
      flame.visible = false;
      return flame;
    });
    this.kilnFireLight = new THREE.PointLight('#ff9a45', 0, 3.2);
    this.kilnFireLight.position.set(0, 0.55, 0.85);
    kiln.add(this.kilnFireLight);
    this.kilnShown = 0;
    this.target(kiln, { id: 'kiln', type: 'station', panel: 'kiln', name: '小小制砖坊', action: '去制砖', label: '制砖坊', hint: '调湿 → 干燥 → 烧制 → 冷却' });
    const warehouse = new THREE.Group(); warehouse.position.set(-11.5, 0, 3.8); this.scene.add(warehouse);
    for (let i = 0; i < 3; i++) { this.cube(warehouse, 'wood', [(i - 1) * .7, .34, 0], [.66, .68, .65], true); this.cube(warehouse, 'cream', [(i - 1) * .7, .45, .335], [.28, .18, .02]); }
    this.sign(warehouse, 'green', [0, 1.38, -.3]); this.target(warehouse, { id: 'warehouse', type: 'station', panel: 'warehouse', name: '邻居的补给仓库', action: '看看补给', label: '补给仓库', hint: '可选的清点小帮忙，领取额外原料' });
    const neighbor = this.avatar('#ca9864'); neighbor.scale.setScalar(.8); neighbor.position.set(-12.5, 0, 5); neighbor.rotation.y = .6; this.scene.add(neighbor);
    this.cottage(-12, -1.5); this.buildingPlot(); this.garden(); this.demoSlope(); this.bounceIsland(); this.balloonLawn(); this.placeTutors(); this.zoneYards();
    const waterStation = new THREE.Group(); waterStation.position.set(3.1, -.05, 6.5); this.scene.add(waterStation);
    this.cube(waterStation, 'wood', [-.3, 0, 0], [.65, .13, .9]); this.mesh(waterStation, new THREE.CylinderGeometry(.23, .19, .4, 10), 'wood', [0, .2, 0]);
    this.target(waterStation, { id: 'water-source', type: 'resource', item: 'water', name: '溪边取水点', action: '装点水', label: '', hint: '水 ×2，带回菜地给豆苗浇水' });
  }
  placeTutors() {
    this.tutors = [];
    for (const tutor of this.callbacks.tutors || []) {
      const spot = new THREE.Group();
      spot.position.set(tutor.x, terrainHeight(tutor.x, tutor.z), tutor.z);
      this.scene.add(spot);
      const poet = tutor.look?.style === 'poet' || tutor.look?.prop === 'brush';
      const rooster = tutor.look?.style === 'rooster';
      const pad = poet ? 0.72 : rooster ? 0.64 : 0.9;
      this.mesh(spot, new THREE.CylinderGeometry(pad, pad + 0.08, 0.12, 8), 'stone', [0, 0.06, 0]);
      const figure = this.tutorFigure(tutor);
      figure.position.y = 0.12;
      spot.add(figure);
      this.sign(spot, 'cream', poet ? [1.25, 1.85, 0.15] : rooster ? [0.9, 1.25, 0.12] : [0, 1.85, 0.15]);
      const target = this.target(spot, {
        id: `tutor-${tutor.id}`,
        type: 'tutor',
        tutorId: tutor.id,
        subject: tutor.subject,
        name: tutor.name,
        action: tutor.action,
        label: tutor.label,
        hint: tutor.hint,
        hello: tutor.hello,
        place: tutor.place,
        corpus: tutor.corpus,
        reach: tutor.reach,
      });
      this.tutors.push({ ...tutor, group: spot, figure, target });
      this.decorColliders.push({ x: tutor.x, z: tutor.z, width: 0.7, depth: 0.7 });
    }
  }
  tutorFigure(tutor) {
    const look = tutor.look || {};
    if (look.style === 'rooster') return this.roosterFigure(look);
    if (look.style === 'poet' || look.prop === 'brush') return this.poetFigure(look);
    const g = new THREE.Group();
    const cloth = new THREE.MeshStandardMaterial({ color: look.robe || '#d7e6f5', roughness: 0.86 });
    const skin = new THREE.MeshStandardMaterial({ color: look.face || '#f4d8a5', roughness: 0.9 });
    const hat = new THREE.MeshStandardMaterial({ color: look.hat || '#354438', roughness: 0.8 });
    const accent = new THREE.MeshStandardMaterial({ color: look.accent || '#c45c4a', roughness: 0.8 });
    this.mesh(g, new THREE.SphereGeometry(0.42, 16, 12), cloth, [0, 0.72, 0], [1.05, 1.25, 0.9]);
    this.mesh(g, new THREE.SphereGeometry(0.34, 16, 12), skin, [0, 1.2, 0.04]);
    this.mesh(g, new THREE.CylinderGeometry(0.46, 0.48, 0.08, 12), hat, [0, 1.42, 0]);
    this.mesh(g, new THREE.CylinderGeometry(0.22, 0.28, 0.22, 10), hat, [0, 1.54, 0]);
    for (const x of [-0.1, 0.1]) this.mesh(g, new THREE.SphereGeometry(0.03, 8, 6), hat, [x, 1.24, 0.32]);
    const sash = this.mesh(g, new THREE.SphereGeometry(0.08, 8, 6), accent, [0.16, 0.78, 0.28]);
    sash.scale.set(1.4, 0.5, 0.4);
    const prop = this.tutorProp(g, look.prop || 'scroll', accent);
    g.userData.wave = look.wave === false ? null : prop;
    g.userData.facePlayer = look.facePlayer !== false;
    return g;
  }
  roosterFigure(look) {
    const g = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: look.robe || '#f2b34a', roughness: 0.68 });
    const red = new THREE.MeshStandardMaterial({ color: look.ribbon || '#d23b3b', roughness: 0.55 });
    const beakMat = new THREE.MeshStandardMaterial({ color: look.accent || '#f0c14a', roughness: 0.45 });
    const tailMat = new THREE.MeshStandardMaterial({ color: look.hat || '#c46a2a', roughness: 0.7 });
    const dark = new THREE.MeshStandardMaterial({ color: look.boots || '#3a2a22', roughness: 0.8 });
    this.mesh(g, new THREE.SphereGeometry(0.32, 16, 12), body, [0, 0.46, 0], [1.2, 0.92, 0.86]);
    this.mesh(g, new THREE.SphereGeometry(0.18, 14, 10), body, [0, 0.78, 0.2]);
    [[-0.05, 0.96], [0, 1.02], [0.05, 0.95]].forEach(([x, y]) => this.mesh(g, new THREE.SphereGeometry(0.04, 8, 6), red, [x, y, 0.18]));
    const bill = this.mesh(g, new THREE.ConeGeometry(0.045, 0.12, 6), beakMat, [0, 0.74, 0.36]);
    bill.rotation.x = Math.PI / 2;
    this.mesh(g, new THREE.SphereGeometry(0.035, 8, 6), red, [0, 0.66, 0.32], [0.7, 1.15, 0.55]);
    for (const x of [-0.06, 0.06]) this.mesh(g, new THREE.SphereGeometry(0.026, 8, 6), new THREE.MeshBasicMaterial({ color: '#2a211c' }), [x, 0.82, 0.34]);
    [[-0.16, 0.45], [0, 0.15], [0.16, -0.45]].forEach(([x, tilt]) => {
      const feather = this.mesh(g, new THREE.SphereGeometry(0.09, 8, 6), tailMat, [-0.22 + x * 0.2, 0.62, -0.18], [0.55, 1.5, 0.7]);
      feather.rotation.z = tilt;
    });
    this.mesh(g, new THREE.SphereGeometry(0.11, 8, 6), body, [0.2, 0.46, 0.04], [0.45, 0.75, 0.85]);
    for (const x of [-0.08, 0.08]) this.mesh(g, new THREE.CylinderGeometry(0.018, 0.018, 0.2, 6), dark, [x, 0.14, 0.04]);
    const card = this.mesh(g, new THREE.BoxGeometry(0.16, 0.11, 0.02), new THREE.MeshStandardMaterial({ color: '#fff6e4', roughness: 0.6 }), [0.28, 0.4, 0.12]);
    card.userData.waveZ = 0.12;
    g.userData.wave = look.wave === false ? null : card;
    g.userData.facePlayer = look.facePlayer !== false;
    return g;
  }
  poetFigure(look) {
    const g = new THREE.Group();
    const body = new THREE.Group();
    const tall = Number(look.height);
    body.scale.setScalar(Number.isFinite(tall) ? tall : 1.16);
    g.add(body);
    const cloth = new THREE.MeshStandardMaterial({ color: look.robe || '#f4f1e6', roughness: 0.38, metalness: 0.02 });
    const trim = new THREE.MeshStandardMaterial({ color: look.trim || '#7dbaa0', roughness: 0.5 });
    const skin = new THREE.MeshStandardMaterial({ color: look.face || '#f8d0b4', roughness: 0.48, emissive: '#e8b090', emissiveIntensity: 0.12 });
    const hair = new THREE.MeshStandardMaterial({ color: look.hair || look.hat || '#1a1614', roughness: 0.4 });
    const ribbon = new THREE.MeshStandardMaterial({ color: look.ribbon || look.accent || '#d23b3b', roughness: 0.42 });
    const beltMat = new THREE.MeshStandardMaterial({ color: look.belt || '#c4894a', roughness: 0.55 });
    const boot = new THREE.MeshStandardMaterial({ color: look.boots || '#2a2724', roughness: 0.7 });
    const pants = new THREE.MeshStandardMaterial({ color: '#f7f5f0', roughness: 0.8 });
    const gourdMat = new THREE.MeshStandardMaterial({ color: '#c9843f', roughness: 0.46 });
    const bamboo = new THREE.MeshStandardMaterial({ color: '#e2c07a', roughness: 0.48 });
    const node = new THREE.MeshStandardMaterial({ color: '#b88848', roughness: 0.5 });
    const bristle = new THREE.MeshStandardMaterial({ color: '#f6f1e4', roughness: 0.9 });
    const blush = new THREE.MeshBasicMaterial({ color: '#f2a898', transparent: true, opacity: 0.72 });
    const white = new THREE.MeshBasicMaterial({ color: '#fffdf8' });
    const iris = new THREE.MeshBasicMaterial({ color: '#c47a32' });
    const pupil = new THREE.MeshBasicMaterial({ color: '#2a1c14' });
    const tooth = new THREE.MeshBasicMaterial({ color: '#fffaf4' });
    const mouth = new THREE.MeshBasicMaterial({ color: '#c46a62' });
    const put = (parent, geometry, material, pos, rot = null, scale = null) => {
      const mesh = this.mesh(parent, geometry, material, pos);
      if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
      if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
      return mesh;
    };
    for (const x of [-0.11, 0.11]) {
      put(body, new THREE.BoxGeometry(0.15, 0.1, 0.2), boot, [x, 0.06, 0.03]);
      put(body, new THREE.CapsuleGeometry(0.06, 0.1, 3, 8), pants, [x, 0.2, 0.01]);
    }
    put(body, new THREE.CylinderGeometry(0.32, 0.36, 0.72, 16), cloth, [0, 0.62, 0]);
    put(body, new THREE.SphereGeometry(0.2, 12, 10), cloth, [-0.24, 0.92, 0.02], null, [0.9, 0.7, 0.8]);
    put(body, new THREE.SphereGeometry(0.2, 12, 10), cloth, [0.24, 0.92, 0.02], null, [0.9, 0.7, 0.8]);
    const hem = put(body, new THREE.TorusGeometry(0.35, 0.028, 8, 20), trim, [0, 0.28, 0]);
    hem.rotation.x = Math.PI / 2;
    const belt = put(body, new THREE.TorusGeometry(0.34, 0.03, 8, 20), beltMat, [0, 0.7, 0]);
    belt.rotation.x = Math.PI / 2;
    put(body, new THREE.BoxGeometry(0.22, 0.045, 0.025), trim, [-0.08, 0.9, 0.3], [0.2, 0, 0.7]);
    put(body, new THREE.BoxGeometry(0.22, 0.045, 0.025), trim, [0.08, 0.86, 0.31], [0.15, 0, -0.7]);
    put(body, new THREE.CylinderGeometry(0.1, 0.12, 0.06, 10), skin, [0, 1.0, 0.04]);
    const head = put(body, new THREE.SphereGeometry(0.38, 28, 20), skin, [0, 1.28, 0.04]);
    head.scale.set(1.04, 1.02, 0.98);
    for (const x of [-0.34, 0.34]) put(body, new THREE.SphereGeometry(0.065, 10, 8), skin, [x, 1.26, 0.02]);
    put(body, new THREE.SphereGeometry(0.4, 20, 16), hair, [0, 1.4, -0.08], null, [1.08, 0.72, 0.82]);
    put(body, new THREE.SphereGeometry(0.18, 12, 8), hair, [0, 1.47, 0.36], null, [1.55, 0.28, 0.32]);
    put(body, new THREE.CapsuleGeometry(0.04, 0.26, 3, 6), hair, [-0.36, 1.12, 0.22]);
    put(body, new THREE.CapsuleGeometry(0.04, 0.26, 3, 6), hair, [0.36, 1.12, 0.22]);
    for (const x of [-0.18, 0.18]) {
      put(body, new THREE.SphereGeometry(0.13, 14, 12), hair, [x, 1.66, -0.01]);
      const bow = put(body, new THREE.BoxGeometry(0.16, 0.045, 0.02), ribbon, [x * 1.85, 1.6, 0.04]);
      bow.rotation.z = x > 0 ? 0.45 : -0.45;
      const tail = put(body, new THREE.BoxGeometry(0.1, 0.035, 0.016), ribbon, [x * 1.45, 1.54, 0.05]);
      tail.rotation.z = x > 0 ? -0.5 : 0.5;
    }
    const eyeWhite = new THREE.CircleGeometry(0.068, 20);
    const eyeIris = new THREE.CircleGeometry(0.044, 18);
    const eyePupil = new THREE.CircleGeometry(0.02, 12);
    const shine = new THREE.CircleGeometry(0.011, 8);
    for (const x of [-0.12, 0.12]) {
      put(body, eyeWhite, white, [x, 1.3, 0.4]);
      put(body, eyeIris, iris, [x, 1.292, 0.406]);
      put(body, eyePupil, pupil, [x, 1.288, 0.41]);
      put(body, shine, white, [x + 0.016, 1.312, 0.414]);
      const brow = put(body, new THREE.BoxGeometry(0.09, 0.016, 0.01), hair, [x, 1.39, 0.39]);
      brow.rotation.z = x < 0 ? 0.25 : -0.25;
      put(body, new THREE.CircleGeometry(0.04, 12), blush, [x * 1.6, 1.2, 0.36]);
    }
    put(body, new THREE.SphereGeometry(0.018, 8, 6), skin, [0, 1.22, 0.41]);
    const smile = put(body, new THREE.TorusGeometry(0.04, 0.008, 6, 12, Math.PI), mouth, [0, 1.13, 0.39]);
    smile.rotation.z = Math.PI;
    for (const x of [-0.01, 0.01]) put(body, new THREE.BoxGeometry(0.014, 0.016, 0.006), tooth, [x, 1.132, 0.408]);
    const sleeve = new THREE.CapsuleGeometry(0.07, 0.16, 3, 8);
    const raised = put(body, sleeve, cloth, [-0.52, 0.98, 0.16], [0.35, 0, 1.05]);
    raised.scale.set(1.05, 1, 1);
    put(body, new THREE.CylinderGeometry(0.07, 0.075, 0.04, 10), trim, [-0.62, 0.98, 0.2], [0.5, 0, 1.2]);
    put(body, new THREE.SphereGeometry(0.045, 10, 8), skin, [-0.64, 1.04, 0.24]);
    const brush = new THREE.Group();
    brush.position.set(-0.68, 1.32, 0.26);
    brush.userData.waveZ = 0.15;
    body.add(brush);
    put(brush, new THREE.CylinderGeometry(0.016, 0.018, 0.46, 8), bamboo, [0, 0, 0]);
    for (const y of [-0.12, 0, 0.12]) put(brush, new THREE.CylinderGeometry(0.02, 0.02, 0.012, 8), node, [0, y, 0]);
    put(brush, new THREE.SphereGeometry(0.026, 8, 6), bristle, [0, 0.26, 0], null, [0.65, 1.15, 0.65]);
    const hung = put(body, sleeve, cloth, [0.5, 0.78, 0.1], [0.15, 0, -0.45]);
    hung.scale.set(1.05, 1, 1);
    put(body, new THREE.CylinderGeometry(0.065, 0.07, 0.035, 10), trim, [0.58, 0.66, 0.14], [0.35, 0, -0.55]);
    put(body, new THREE.SphereGeometry(0.042, 10, 8), skin, [0.62, 0.58, 0.16]);
    const gourd = new THREE.Group();
    gourd.position.set(0.46, 0.52, 0.28);
    body.add(gourd);
    put(gourd, new THREE.SphereGeometry(0.085, 12, 10), gourdMat, [0, 0, 0], null, [1, 0.9, 1]);
    put(gourd, new THREE.SphereGeometry(0.05, 10, 8), gourdMat, [0, 0.1, 0]);
    put(gourd, new THREE.CylinderGeometry(0.012, 0.012, 0.08, 6), ribbon, [-0.04, 0.16, -0.02]);
    g.userData.wave = look.wave === false ? null : brush;
    g.userData.facePlayer = look.facePlayer !== false;
    return g;
  }
  tutorProp(group, prop, accent) {
    if (prop === 'abacus') {
      const board = this.mesh(group, new THREE.BoxGeometry(0.28, 0.2, 0.04), 'cream', [0.32, 0.72, 0.16]);
      board.rotation.z = 0.2;
      for (const y of [-0.04, 0.04]) this.mesh(board, new THREE.SphereGeometry(0.025, 8, 6), accent, [0, y, 0.03]);
      return board;
    }
    if (prop === 'card') {
      const card = this.mesh(group, new THREE.BoxGeometry(0.22, 0.3, 0.02), 'cream', [0.32, 0.74, 0.16]);
      card.rotation.z = 0.15;
      return card;
    }
    const scroll = this.mesh(group, new THREE.CylinderGeometry(0.05, 0.05, 0.34, 8), 'cream', [0.34, 0.7, 0.16]);
    scroll.rotation.z = 0.4;
    return scroll;
  }
  cottage(x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); this.scene.add(g);
    this.cube(g, 'stone', [0, .1, 0], [3.2, .2, 2.65]); this.cube(g, 'cream', [0, 1.15, 0], [2.9, 2.1, 2.5]);
    for (const xx of [-1.46, 1.46]) this.cube(g, 'wood', [xx, 1.15, 0], [.15, 2.1, 2.5]);
    for (let i = 0; i < 5; i++) { const yy = 2.28 + i * .18; this.cube(g, 'roof', [0, yy, 0], [3.55 - i * .6, .2, 3]); }
    this.cube(g, 'wood', [0, .8, 1.27], [.75, 1.6, .045], true);
    this.cube(g, new THREE.MeshStandardMaterial({ color: '#b9d4c1', roughness: .45 }), [-.85, 1.24, 1.275], [.48, .55, .02]);
    this.cube(g, 'wood', [-.85, 1.24, 1.30], [.05, .6, .03]); this.cube(g, 'wood', [-.85, 1.24, 1.30], [.53, .05, .03]);
    this.decorColliders.push({ x, z, width: 3, depth: 2.55 });
    const pot = this.mesh(g, new THREE.CylinderGeometry(.28, .21, .36, 8), 'clay', [.92, .18, 1.55]); this.cube(g, 'leaf', [.92, .5, 1.55], [.45, .35, .45], true);
  }
  buildingPlot() {
    const g = new THREE.Group(); g.position.set(-4.5, .025, 5.5); this.scene.add(g);
    const lineMat = new THREE.LineBasicMaterial({ color: '#eee6c1', transparent: true, opacity: .6 });
    for (let i = 0; i <= 6; i++) { const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(i - 3, 0, -2), new THREE.Vector3(i - 3, 0, 2)]); g.add(new THREE.Line(geo, lineMat)); }
    for (let i = 0; i <= 4; i++) { const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-3, 0, i - 2), new THREE.Vector3(3, 0, i - 2)]); g.add(new THREE.Line(geo, lineMat)); }
    for (const x of [-3, 3]) for (const z of [-2, 2]) this.cube(g, 'wood', [x, .17, z], [.09, .34, .09]);
  }
  garden() {
    this.gardenBase = new THREE.Group(); this.gardenBase.position.set(9.5, 0, 5); this.scene.add(this.gardenBase);
    const g = this.gardenBase;
    for (let i = 0; i < 6; i++) { const x = i % 3 - 1, z = Math.floor(i / 3); this.cube(g, 'soil', [x * 1.3, .09, z * 1.3], [1.12, .18, 1.12], true); for (let j = 0; j < 4; j++) this.cube(g, 'clay', [x * 1.3, .195, z * 1.3 - .39 + j * .25], [1.0, .02, .07]); }
    this.sign(g, 'cream', [-1.8, .9, 0]); this.target(g, { id: 'garden', type: 'station', panel: 'garden', name: '豆苗小菜地', action: '照料豆苗', label: '小菜地', hint: '种一颗豆子，看看它需要什么' });
    const soil = new THREE.Group(); soil.position.set(10, 0, 8.5); this.scene.add(soil); this.cube(soil, 'wood', [0, .22, 0], [1, .45, .8], true); this.cube(soil, 'soil', [0, .47, 0], [.92, .1, .72], true);
    this.target(soil, { id: 'soil-source', type: 'resource', item: 'soil', name: '种植土', action: '取种植土', label: '', hint: '种植土 ×2 · 游戏补料点' });
    const seeds = new THREE.Group(); seeds.position.set(7, 0, 5); this.scene.add(seeds); this.cube(seeds, 'cream', [0, .3, 0], [.65, .6, .52], true); this.cube(seeds, 'leaf', [0, .62, 0], [.48, .1, .4], true);
    this.target(seeds, { id: 'seed-source', type: 'resource', item: 'seed', name: '豆子种子箱', action: '拿点种子', label: '', hint: '种子 ×2，可以一直取用' });
  }
  demoSlope() {
    const g = new THREE.Group(); g.position.set(9, 0, -5); this.scene.add(g);
    const ramp = this.mesh(g, this.wedge, 'wood', [0, 0, 0], [1.55, 2.4, 4]); ramp.position.z = 0;
    for (const x of [-.85, .85]) { const beam = this.cube(g, 'wood', [x, 1.4, 0], [.12, .13, 4.65]); beam.rotation.x = .54; }
    this.cube(g, 'wood', [0, 1.15, -1.7], [.12, 2.3, .12]);
    this.cube(g, 'cream', [0, .04, 3.4], [1.6, .08, 1.3], true);
    for (const x of [-.8,.8]) this.cube(g,'wood',[x,.25,3.4],[.1,.5,1.4],true);
    this.cube(g,'wood',[0,.25,4.05],[1.7,.5,.1],true);
    this.target(g, { id: 'ball-slope', type: 'experiment', name: '溪边球道', action: '试试小球', label: '试试小球', hint: '球会滚到哪里？也可以搭自己的球道' });
    this.demoRamp = { x: 9, minZ: -7, maxZ: -3, width: 1.55, height: 2.4 };
  }
  bounceIsland() {
    const g = new THREE.Group(); g.position.set(BOUNCE_ISLAND.x, 0, BOUNCE_ISLAND.z); this.scene.add(g);
    for (let i = 0; i < 6; i++) {
      const a = (i + 0.5) * Math.PI / 3;
      this.cube(g, 'wood', [Math.cos(a) * 1.45, 0.42, Math.sin(a) * 1.45], [0.18, 0.84, 0.18], true);
    }
    this.mesh(g, new THREE.CylinderGeometry(1.82, 1.88, 0.16, 6), 'mint', [0, 0.92, 0]);
    this.bounceMat = this.mesh(g, new THREE.CylinderGeometry(1.58, 1.58, 0.1, 6), 'bounce', [0, 1.02, 0]);
    this.bounceMat.userData.baseY = 1.02;
    this.mesh(g, new THREE.CylinderGeometry(0.22, 0.22, 0.08, 6), 'cream', [0, 1.08, 0]);
    this.cube(g, 'wood', [-2.05, 0.22, 0], [1.35, 0.12, 0.78], true);
    this.cube(g, 'wood', [-1.55, 0.52, 0], [0.9, 0.12, 0.7], true);
    PLAY_MODES.forEach((mode, i) => {
      const a = (i + 0.5) * Math.PI / 3;
      this.mesh(g, new THREE.CylinderGeometry(0.22, 0.22, 0.06, 6), new THREE.MeshStandardMaterial({ color: mode.color, roughness: 0.62 }), [Math.cos(a) * 0.95, 1.08, Math.sin(a) * 0.95]);
    });
    this.sign(g, 'mint', [0, 1.85, -1.55]);
    this.bouncePad = { x: BOUNCE_ISLAND.x, z: BOUNCE_ISLAND.z, radius: BOUNCE_ISLAND.radius, height: BOUNCE_ISLAND.height };
    this.bounce = null; this.bounceHold = false; this.bounceSquash = 0;
    this.parkMode = 'count'; this.parkStep = 2; this.parkTable = 2;
    this.target(g, { id: 'bounce-island', type: 'bounce', name: PARK_NAME, action: '跳上去', label: PARK_NAME, hint: '走上小岛就会一直跳。点玩法可以换数一数、双数、凑十、跳着数、乘法或质数。点停下来才停止。' });
    for (const mode of PLAY_MODES) {
      const pad = new THREE.Group();
      pad.position.set(BOUNCE_ISLAND.x + mode.dx, 0, BOUNCE_ISLAND.z + mode.dz);
      this.scene.add(pad);
      this.mesh(pad, new THREE.CylinderGeometry(0.52, 0.56, 0.14, 6), new THREE.MeshStandardMaterial({ color: mode.color, roughness: 0.62 }), [0, 0.08, 0]);
      this.target(pad, { id: `park-${mode.id}`, type: 'park', park: mode.id, name: mode.title, action: '来玩', label: mode.title, hint: `${mode.ages} · ${mode.hint}` });
    }
  }
  balloonLawn() {
    const { x, z, radius, padHeight } = BALLOON_BASE;
    const gate = new THREE.Group(); gate.position.set(-5, 0, 15.5); this.scene.add(gate);
    this.cube(gate, 'wood', [-1.1, 0.7, 0], [0.14, 1.4, 0.14], true);
    this.cube(gate, 'wood', [1.1, 0.7, 0], [0.14, 1.4, 0.14], true);
    this.cube(gate, 'balloon', [0, 1.45, 0], [2.5, 0.12, 0.12], true);
    this.sign(gate, 'balloon', [0, 1.85, 0.2]);
    this.target(gate, { id: 'balloon-gate', type: 'guide', name: BALLOON_NAME, action: '去草场', label: '热气球草场', hint: '顺着小路再往南走，就是专门的热气球草场。' });
    for (let step = 8; step <= 19; step++) this.cube(this.scene, 'cream', [-5, 0.03, step], [0.9, 0.05, 0.9], true);
    const lawn = new THREE.Group(); lawn.position.set(x, 0, z); this.scene.add(lawn);
    this.mesh(lawn, new THREE.CylinderGeometry(radius + 0.35, radius + 0.5, padHeight, 18), 'leafLight', [0, padHeight / 2, 0]);
    this.mesh(lawn, new THREE.CylinderGeometry(radius - 0.1, radius, 0.05, 18), 'grass', [0, padHeight + 0.02, 0]);
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5;
      this.mesh(lawn, this.floraGeometry, i % 2 ? 'flower' : 'cream', [Math.cos(a) * 2.25, padHeight + 0.06, Math.sin(a) * 2.25], [0.12, 0.05, 0.12]);
    }
    for (const a of [0.4, 1.5, 2.7, 4.0, 5.2]) this.cube(lawn, 'wood', [Math.cos(a) * 2.55, 0.16, Math.sin(a) * 2.55], [0.1, 0.32, 0.1], true);
    this.sign(lawn, 'balloon', [0, 1.35, -2.35]);
    this.target(lawn, { id: 'balloon-base', type: 'balloon', name: BALLOON_NAME, action: '乘坐热气球', label: '热气球', hint: '这是专门的热气球草场。坐上热气球，飞起来看整个河谷。想下来就点降落到草坪基地。' });
    const craft = new THREE.Group(); craft.position.set(x, 0, z); this.scene.add(craft);
    this.balloonCraft = craft;
    this.cube(craft, 'wood', [0, 0.42, 0], [0.95, 0.55, 0.95], true);
    this.cube(craft, 'cream', [0, 0.68, 0], [1.02, 0.08, 1.02], true);
    for (const sx of [-0.42, 0.42]) for (const sz of [-0.42, 0.42]) this.cube(craft, 'wood', [sx, 0.78, sz], [0.06, 0.28, 0.06]);
    this.cube(craft, 'dark', [0, 1.12, 0], [0.22, 0.16, 0.22], true);
    const envelope = new THREE.Group(); envelope.position.set(0, 3.7, 0); craft.add(envelope);
    this.balloonEnvelope = envelope;
    this.mesh(envelope, new THREE.SphereGeometry(1, 14, 12), 'balloon', [0, 0, 0], [1.62, 1.92, 1.62]);
    this.mesh(envelope, new THREE.SphereGeometry(1, 14, 12), 'cream', [-0.18, 0.05, 0], [1.42, 1.78, 1.42]);
    this.mesh(envelope, new THREE.SphereGeometry(1, 10, 8), 'mint', [0.12, -0.15, 0.1], [1.2, 1.55, 1.2]);
    this.mesh(craft, new THREE.CylinderGeometry(0.18, 0.48, 0.85, 10), 'mint', [0, 2.42, 0]);
    for (const sx of [-0.38, 0.38]) for (const sz of [-0.38, 0.38]) {
      const rope = this.mesh(craft, new THREE.CylinderGeometry(0.018, 0.018, 2.05, 6), 'wood', [sx * 0.5, 1.72, sz * 0.5]);
      rope.lookAt(sx, 2.5, sz);
    }
    this.target(craft, { id: 'balloon-craft', type: 'balloon', name: '热气球', action: '乘坐热气球', label: '', hint: '坐进篮子，飞起来看整个世界地图。' });
    this.balloon = null;
  }
  zoneYards() {
    const yard = (color) => new THREE.MeshStandardMaterial({ color, roughness: 1, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const pad = (x, z, w, d, material) => this.cube(this.scene, material, [x, 0.016, z], [w, 0.02, d]);
    const posts = (x, z, w, d) => {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.cube(this.scene, 'wood', [x + sx * (w / 2 - 0.2), 0.28, z + sz * (d / 2 - 0.2)], [0.08, 0.5, 0.08]);
    };
    const workshop = yard('#d7c4a2');
    pad(-7.2, -5.4, 12.2, 6.4, workshop);
    posts(-7.2, -5.4, 12.2, 6.4);
    const court = yard('#efe6c8');
    pad(-4.5, 5.5, 6.6, 4.4, court);
    posts(-4.5, 5.5, 6.6, 4.4);
    pad(9, -4.6, 2.3, 7.2, yard('#e6d3ae'));
    this.cube(this.scene, 'leaf', [9.5, 0.05, 4.15], [4.4, 0.06, 0.1]);
    this.cube(this.scene, 'leaf', [9.5, 0.05, 7.15], [4.4, 0.06, 0.1]);
    this.cube(this.scene, 'leaf', [7.45, 0.05, 5.65], [0.1, 0.06, 3.1]);
    this.cube(this.scene, 'leaf', [11.55, 0.05, 5.65], [0.1, 0.06, 3.1]);
    this.mesh(this.scene, new THREE.CylinderGeometry(3.15, 3.15, 0.02, 24), yard('#c5d7a8'), [BOUNCE_ISLAND.x, 0.016, BOUNCE_ISLAND.z]);
  }
  details() {
    const trees = [[-13,-9,1.2],[-11,-12,1.35],[-7,-11,.92],[-14,-4,1.05],[-12,10,1.2],[-8,12,.93],[12,-10,1.2],[14,-4,.95],[12,11,1.05],[-3,-12,1.15],[7,-12,.95],[-13,14,.92],[14,14,1.2],[-14,-14,1.25]];
    trees.forEach(([x,z,s],i) => this.tree(x,z,s,i%3 ? 'leaf' : 'leafLight'));
    for (let i=0;i<12;i++) { const x=-15+seeded(i,22)*30,z=-15+seeded(i,23)*30; if(x>2&&x<6)continue; const stone=this.cube(this.scene,'stone',[x,terrainHeight(Math.round(x),Math.round(z))+.15,z],[.3,.3,.4],true);stone.rotation.y=i; }
    this.clouds = new THREE.Group(); this.scene.add(this.clouds);
    const cloudMat = new THREE.MeshBasicMaterial({color:'#f6f5df',transparent:true,opacity:.77,depthWrite:false});
    [[-12,11,-22],[10,13,-28],[21,10,-16]].forEach(([x,y,z])=>{const g=new THREE.Group();g.position.set(x,y,z);for(let i=0;i<3;i++)this.mesh(g,new THREE.SphereGeometry(1,10,8),cloudMat,[(i-1)*1.6,i===1?.35:0,0],[1.8,.65,.65]);this.clouds.add(g);});
    this.skyScratch=new THREE.Color();this.grassScratch=new THREE.Color();this.lifeKey='';
    this.rain=this.makeFall('#c5d5dc',220,4);
    this.snow=this.makeFall('#f7fbff',180,6);
    this.leaves=this.makeFall('#c4783a',80,7);
  }
  makeFall(color,count,size){
    const geo=new THREE.BufferGeometry(),pos=new Float32Array(count*3);
    for(let i=0;i<count;i++){pos[i*3]=(Math.random()-.5)*26;pos[i*3+1]=Math.random()*12;pos[i*3+2]=(Math.random()-.5)*26;}
    geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
    const pts=new THREE.Points(geo,new THREE.PointsMaterial({color,size,transparent:true,opacity:.82,depthWrite:false,sizeAttenuation:false}));
    pts.visible=false;pts.frustumCulled=false;this.scene.add(pts);return pts;
  }
  applySky(moment){
    const look=skyLook(moment);
    this.sun.intensity=look.sun;this.skyLight.intensity=look.skyLight;
    this.sun.color.set(look.sunColor);this.skyLight.color.set(look.sky);this.skyLight.groundColor.set(look.ground);
    this.sun.position.set(look.sunX,look.sunY,look.sunZ);
    this.skyScratch.set(look.sky);
    if(moment.weather.kind==='storm')this.skyScratch.lerp(new THREE.Color('#6d7682'),.45);
    else if(moment.weather.kind==='rain')this.skyScratch.lerp(new THREE.Color('#9aab9a'),.28);
    else if(moment.weather.kind==='fog'||moment.weather.kind==='snow')this.skyScratch.lerp(new THREE.Color('#d5dde3'),.25);
    else if(moment.weather.kind==='cloud')this.skyScratch.lerp(new THREE.Color('#d5ddd8'),.18);
    this.scene.background.copy(this.skyScratch);this.scene.fog.color.copy(this.skyScratch);
    this.scene.fog.near=this.balloon?48:look.fogNear;this.scene.fog.far=this.balloon?130:look.fogFar;
    this.grassScratch.set(look.grass);
    if(moment.weather.kind==='rain'||moment.weather.kind==='storm')this.grassScratch.lerp(new THREE.Color('#6e8a55'),.25);
    this.mats.grass.color.copy(this.grassScratch);
    const foliage=[{leaf:'#789957',light:'#b6c785'},{leaf:'#6a9a48',light:'#9cbf6a'},{leaf:'#c4783a',light:'#e2b15a'},{leaf:'#c9d2c8',light:'#e4ebe3'}][moment.seasonIndex];
    this.mats.leaf.color.set(foliage.leaf);this.mats.leafLight.color.set(foliage.light);
    this.storySky?.(moment);
  }
  stepWeather(moment,dt){
    const kind=moment.weather.kind;
    this.rain.visible=kind==='rain'||kind==='storm';
    this.snow.visible=kind==='snow';
    this.leaves.visible=moment.seasonIndex===2&&(kind==='wind'||kind==='sun');
    const speed=kind==='storm'?16:kind==='snow'?2.4:kind==='rain'?9:1.6;
    const drift=kind==='wind'||kind==='snow'?2.2:.35;
    for(const bits of [this.rain,this.snow,this.leaves])if(bits.visible)this.fall(bits,dt,bits===this.snow?2.4:bits===this.leaves?1.6:speed,bits===this.leaves?1.8:drift);
    const wind=kind==='wind'?.09:kind==='storm'?.05:.025;
    this.clouds.position.x=Math.sin(this.time*wind)*(kind==='wind'?2.4:.5);
  }
  fall(points,dt,speed,drift){
    const arr=points.geometry.attributes.position.array,px=this.playerPosition.x,pz=this.playerPosition.z;
    for(let i=0;i<arr.length;i+=3){
      arr[i]+=drift*dt*Math.sin(this.time+i);arr[i+1]-=speed*dt;arr[i+2]+=drift*dt*.35;
      if(arr[i+1]<0||Math.abs(arr[i]-px)>18||Math.abs(arr[i+2]-pz)>18){
        arr[i]=px+(Math.random()-.5)*26;arr[i+1]=8+Math.random()*6;arr[i+2]=pz+(Math.random()-.5)*26;
      }
    }
    points.geometry.attributes.position.needsUpdate=true;
  }
  followSky(dt){
    const moment=realMoment();
    const key=`${moment.seasonIndex}:${moment.period}:${moment.weather.kind}:${moment.hour}`;
    if(key!==this.lifeKey){this.lifeKey=key;if(this.state)this.syncLife(this.state);}
    this.applySky(moment);
    this.stepWeather(moment,dt);
  }
  avatar(bodyColor = '#93b7a0') {
    const g = new THREE.Group(); const bodyMat = new THREE.MeshStandardMaterial({color:bodyColor,roughness:.85}); const faceMat=new THREE.MeshStandardMaterial({color:'#f4d8a5',roughness:.9}); const shoeMat=new THREE.MeshStandardMaterial({color:'#e6c59a',roughness:.9});
    this.mesh(g,new THREE.SphereGeometry(.39,18,14),bodyMat,[0,.68,0],[1,1.1,.86]); this.mesh(g,new THREE.SphereGeometry(.35,20,14),faceMat,[0,1.12,.04],[1,1,.96]);
    const hat=this.mesh(g,new THREE.CylinderGeometry(.41,.42,.11,16),'cream',[0,1.34,.01]);this.mesh(g,new THREE.SphereGeometry(.31,16,10),'cream',[0,1.36,0],[1,.54,1]);
    const leaf=this.mesh(g,new THREE.SphereGeometry(.12,8,6),'leaf',[.23,1.47,.05],[.5,1.1,.3]);leaf.rotation.z=-.6;
    for(const x of[-.112,.112]) this.mesh(g,new THREE.SphereGeometry(.032,8,6),'dark',[x,1.16,.357],[1,1.15,.55]);
    const smile=new THREE.Mesh(new THREE.TorusGeometry(.045,.008,4,12,Math.PI),this.mats.dark);smile.position.set(0,1.078,.37);smile.rotation.z=Math.PI;g.add(smile);
    const blushMat=new THREE.MeshStandardMaterial({color:'#dfad8a',roughness:.9});for(const x of[-.2,.2])this.mesh(g,new THREE.SphereGeometry(.045,8,6),blushMat,[x,1.09,.29],[1,.6,.3]);
    g.userData.feet=[];g.userData.arms=[];
    for(const x of[-.16,.16]) {const foot=this.mesh(g,new THREE.SphereGeometry(.14,12,8),shoeMat,[x,.13,.065],[1,.65,1.45]);g.userData.feet.push(foot);const arm=this.mesh(g,new THREE.SphereGeometry(.13,12,8),faceMat,[x<0?-.38:.38,.69,.05],[.85,1.2,.85]);g.userData.arms.push(arm);}
    this.cube(g,'wood',[0,.72,-.32],[.35,.43,.18],true);this.cube(g,'cream',[0,.91,-.33],[.3,.07,.17],true); return g;
  }
  blockModel(block, ghost = false) {
    const g = new THREE.Group(); g.position.set(block.x, block.y, block.z); g.rotation.y = (block.rotation || 0) * Math.PI / 2;
    const woodish = ['plank', 'post', 'workbench', 'chest', 'fence', 'bed', 'door'];
    const m = ghost ? this.previewMaterial : (this.mats[woodish.includes(block.item) ? 'wood' : block.item] || this.mats.wood);
    if(block.item==='ball') this.mesh(g,this.previewBallGeometry,m,[0,.23,0]);
    else if(block.item==='roof') {
      const w = block.w || 1, d = block.d || 1, alongX = w >= d;
      const shell = new THREE.Group();
      shell.position.set((w - 1) / 2, 0, (d - 1) / 2);
      g.add(shell);
      const piece = this.mesh(shell, this.roofGeometry(alongX ? w : d, alongX ? d : w), ghost ? this.previewMaterial : this.roofMat, [0, 0, 0]);
      if (!alongX) piece.rotation.y = Math.PI / 2;
      const rise = roofRise(alongX ? w : d, alongX ? d : w);
      this.cube(shell, ghost ? this.previewMaterial : 'cream', [0, 0.92 + rise, 0], alongX ? [Math.max(w, d) + 1.5, 0.14, 0.22] : [0.22, 0.14, Math.max(w, d) + 1.5]);
      g.userData.roofShell = shell;
      g.userData.roofHome = { x: block.x, z: block.z, w, d };
    }
    else if(block.item==='ramp') this.mesh(g,this.wedge,m);
    else if(block.item==='post') this.cube(g,m,[0,.5,0],[.97,1,.18],true);
    else if(block.item==='fence') { for(const x of[-.32,0,.32]) this.cube(g,m,[x,.42,0],[.12,.84,.12],true); this.cube(g,m,[0,.52,0],[.9,.1,.08]); this.cube(g,m,[0,.28,0],[.9,.1,.08]); }
    else if(block.item==='chest') { this.cube(g,m,[0,.35,0],[.85,.7,.75],true);this.cube(g,ghost?m:this.mats.cream,[0,.35,.387],[.16,.16,.035]); }
    else if(block.item==='workbench') {this.cube(g,m,[0,.83,0],[.97,.2,.9],true);for(const x of[-.34,.34])for(const z of[-.3,.3])this.cube(g,m,[x,.36,z],[.15,.72,.15]);}
    else if(block.item==='door') { this.cube(g,m,[0,.55,0],[.7,1.1,.08],true); this.cube(g,ghost?m:this.mats.flower,[.22,.52,.05],[.08,.08,.04]); }
    else if(block.item==='window') { this.cube(g,m,[0,.55,0],[.9,1,.08],true); this.cube(g,ghost?m:this.mats.mint,[0,.55,.05],[.62,.62,.03]); this.cube(g,m,[0,.55,.06],[.04,1,.04]); this.cube(g,m,[0,.55,.06],[.9,.04,.04]); }
    else if(block.item==='bed') { this.cube(g,m,[0,.18,0],[.95,.16,.7],true); this.cube(g,ghost?m:this.mats.cream,[-.22,.28,0],[.4,.14,.58]); for(const x of[-.38,.38]) for(const z of[-.26,.26]) this.cube(g,m,[x,.08,z],[.1,.16,.1]); }
    else if(block.item==='pot') { this.mesh(g,this.cyl,m,[0,.18,0],[.22,.36,.22]); this.cube(g,ghost?m:this.mats.leaf,[0,.42,0],[.28,.22,.28],true); }
    else if(block.item==='wreath') { this.cube(g,ghost?m:this.mats.leaf,[0,.55,.42],[.7,.7,.08],true); this.cube(g,ghost?m:this.mats.flower,[0,.82,.46],[.14,.14,.06]); }
    else if(block.item==='lantern') { this.cube(g,m,[0,.42,0],[.32,.5,.32],true); this.cube(g,ghost?m:this.mats.flower,[0,.42,0],[.2,.28,.2]); }
    else if(block.item==='flag') { this.cube(g,m,[0,.55,0],[.08,1.1,.08],true); this.cube(g,ghost?m:this.mats.flag,[.28,.78,0],[.52,.32,.04]); }
    else if(block.item==='paper-crane') { this.cube(g,ghost?m:this.mats.paper,[0,.35,0],[.7,.22,.55],true); this.cube(g,ghost?m:this.mats.paper,[-.28,.42,0],[.4,.08,.16],true); }
    else if(block.item==='paper-boat') this.cube(g,ghost?m:this.mats.paper,[0,.22,0],[.8,.24,.42],true);
    else if(block.item==='paper-koinobori') { this.cube(g,m,[0,.55,0],[.08,1.1,.08],true); this.cube(g,ghost?m:this.mats.carp,[.32,.8,0],[.55,.28,.08],true); }
    else if(block.item==='paper-door') { this.cube(g,ghost?m:this.mats.paper,[0,.55,0],[.86,1.1,.08],true); this.cube(g,m,[0,.55,.05],[.04,1.1,.04]); this.cube(g,m,[0,.55,.05],[.86,.04,.04]); }
    else if (!drawSouvenir(this, g, block, ghost)) this.cube(g,m,[0,.5,0],[.97,.98,.97],true);
    return g;
  }
  applyPictureQuality(mode) {
    // Fast preset skips the shadow map. Block data, build placement, and the camera stay as they are.
    const fine = mode === 'fine';
    const next = fine ? 'fine' : 'fast';
    if (this.pictureQuality === next) return;
    this.pictureQuality = next;
    this.renderer.shadowMap.enabled = fine;
    this.sun.castShadow = fine;
  }
  sync(state) {
    this.applyPictureQuality(state?.settings?.quality);
    const swapping = this.state !== state;
    if (swapping) {
      this.setupPool(state);
      if (this.balloon) this.finishBalloon(true);
      this.locomotion = 'walk'; this.player.rotation.x = 0; this.swimRipple.visible=false;
      for (const b of [...this.balls]) this.recallBall(b.id, false);
      for (const t of state.toys || []) this.spawnBall(t.id, new THREE.Vector3(t.x,t.y,t.z), new THREE.Vector3(t.vx,t.vy,t.vz));
    }
    if(this.state!==state) {this.playerPosition.set(state.player?.x??-5,state.player?.y??0,state.player?.z??5);this.state=state;this.walkTarget=null;this.selectedTarget=null;for(const g of this.buildGroups.values())this.scene.remove(g);this.buildGroups.clear();this.targets=this.targets.filter(t=>t.type!=='block');this.pickMeshes=this.pickMeshes.filter(m=>!String(m.userData.targetId).startsWith('block-'));this.plantSignature=null;}
    const ids=new Set(state.blocks.map(b=>b.id));
    for(const [id,g] of this.buildGroups)if(!ids.has(id)){this.scene.remove(g);this.buildGroups.delete(id);this.targets=this.targets.filter(t=>t.id!==id);this.pickMeshes=this.pickMeshes.filter(m=>m.userData.targetId!==id);}
    for(const b of state.blocks) {
      const sig=`${b.item}:${b.x}:${b.y}:${b.z}:${b.w||1}:${b.d||1}:${b.rotation||0}`;
      if(this.buildGroups.get(b.id)?.userData.sig===sig) continue;
      const old=this.buildGroups.get(b.id);
      const prev=old?.userData.roofHome || null;
      if(old){this.scene.remove(old);this.buildGroups.delete(b.id);this.targets=this.targets.filter(t=>t.id!==b.id);this.pickMeshes=this.pickMeshes.filter(m=>m.userData.targetId!==b.id);}
      const g=this.blockModel(b);g.userData.sig=sig;this.scene.add(g);this.buildGroups.set(b.id,g);
      if(this.roofMotionReady && !swapping && b.item==='roof' && g.userData.roofShell) this.startRoofMotion(g, b, prev);
      const obj=this.target(g,{id:b.id,type:'block',item:b.item,name:ITEMS[b.item]?.name||b.item,action:b.item==='chest'?'打开箱子':b.item==='workbench'?'来合成':'看看方块',panel:b.item==='chest'?'chest':b.item==='workbench'?'craft':null,context:b.item==='chest'?{id:b.id}:{atWorkbench:true},block:b});
      const w=b.w||1,d=b.d||1;if(b.item==='roof')obj.position.set(b.x+(w-1)/2,b.y+1,b.z+(d-1)/2);
    }
    this.roofMotionReady=true;
    if(this.selectedTarget && !this.targets.some(t=>t===this.selectedTarget)) this.select(this.targets.find(t=>t.id===this.selectedTarget.id) || null);
    const kilnTalk = { idle: '调湿 → 干燥 → 烧制 → 冷却', moistening: '看窑口：黏土变湿，捏成砖坯', drying: '看窑口：砖坯变浅，冒出水汽', firing: '看窑口：火光里，砖坯在烧', cooling: '看窑口：火变小，颜色在变稳', ready: '砖冷却好了，可以领取', failed: '坯上有裂纹，可以领取看看' };
    const kilnTarget = this.targets.find(t => t.id === 'kiln');
    if (kilnTarget && state.kiln) {
      kilnTarget.hint = kilnTalk[state.kiln.stage] || kilnTalk.idle;
      kilnTarget.action = state.kiln.stage === 'ready' || state.kiln.stage === 'failed' ? '领取结果' : state.kiln.stage === 'idle' ? '去制砖' : '看制砖';
    }
    this.syncLife(state);
    this.syncLand(state);
    this.creation.sync(state);
    this.placeBottle(state);
    if (!this.dockReady) this.ensureDock(state.blocks);
    this.storySync?.(state);
    const plants=state.garden||[]; const plantSignature=plants.map(p=>`${p.id}:${p.planted}:${Math.floor((p.age||0)/18)}:${p.moisture}`).join('|');
    if(plantSignature!==this.plantSignature) {this.plantSignature=plantSignature;for(const g of this.plantGroups.values())this.scene.remove(g);this.plantGroups.clear();plants.forEach((p,i)=>{if(!p.planted)return;const x=Number.isFinite(p.x)?p.x:9.5+(i%3-1)*1.3,z=Number.isFinite(p.z)?p.z:5+Math.floor(i/3)*1.3;const g=new THREE.Group();g.position.set(x,.2,z);const stage=Math.min(5,Math.floor((p.age||0)/18));const h=.12+stage*.12;this.cube(g,'leaf',[0,h/2,0],[.045,h,.045]);for(let j=0;j<Math.min(stage+1,5);j++){const sign=j%2?1:-1;const leaf=this.mesh(g,new THREE.SphereGeometry(.16,8,6),'leaf',[sign*.15,.11+j*.085,0],[1,.38,.62]);leaf.rotation.z=sign*.3;}if(stage>=3)this.mesh(g,new THREE.SphereGeometry(.07,6,6),'cream',[.15,h,.01]);if(stage>=4)for(const sign of[-1,1])this.mesh(g,new THREE.CapsuleGeometry(.035,.18,2,6),'leafLight',[sign*.2,h*.7,.04],[1,1,1]);if(p.moisture>=3){const wet=new THREE.Mesh(new THREE.PlaneGeometry(.85,.85),this.water.material);wet.rotation.x=-Math.PI/2;wet.position.y=.008;g.add(wet);}this.scene.add(g);this.plantGroups.set(p.id,g);});}
  }
  setPreview(item, rotation, cell, valid = true, blocks = null) {
    const span = item === 'roof' && cell ? roofSpan(blocks, cell) : { x: cell?.x, z: cell?.z, w: 1, d: 1 };
    const model = cell ? { ...cell, ...span, item, rotation: item === 'roof' ? 0 : rotation } : null;
    const key=`${item}:${model?.rotation}:${model?.x}:${model?.y}:${model?.z}:${model?.w}:${model?.d}`;
    if(key!==this.previewKey){
      const previous = this.previewSpan;
      this.previewKey=key;this.preview.clear();
      if(model){
        const ghost=this.blockModel(model,true);
        this.preview.add(ghost);
        if(item==='roof' && ghost.userData.roofShell) this.startRoofMotion(ghost, model, previous);
      }
    }
    this.previewSpan = item === 'roof' && model ? { x: model.x, z: model.z, w: model.w || 1, d: model.d || 1 } : null;
    this.preview.visible=!!cell;
    this.previewMaterial.color.set(valid ? '#82c98c' : '#e58471');
  }
  startRoofMotion(group, block, previous) {
    const shell = group.userData.roofShell;
    if (!shell) return;
    const w = block.w || 1, d = block.d || 1;
    const to = { x: (w - 1) / 2, z: (d - 1) / 2, sx: 1, sz: 1 };
    const from = previous
      ? { x: previous.x + (previous.w - 1) / 2 - block.x, z: previous.z + (previous.d - 1) / 2 - block.z, sx: previous.w / w, sz: previous.d / d }
      : { x: to.x, z: to.z, sx: w === 1 && d === 1 ? 0.35 : 1 / w, sz: w === 1 && d === 1 ? 0.35 : 1 / d };
    if (Math.abs(from.sx - 1) < 0.02 && Math.abs(from.sz - 1) < 0.02 && Math.abs(from.x - to.x) < 0.02 && Math.abs(from.z - to.z) < 0.02) return;
    group.userData.roofAnim = { shell, from, to, t: 0, dur: previous ? 0.72 : 0.62 };
    shell.position.x = from.x;
    shell.position.z = from.z;
    shell.scale.set(from.sx, 1, from.sz);
  }
  stepRoofMotions(dt) {
    const step = Math.min(Math.max(dt, 0), 0.05);
    const ease = t => 1 - (1 - t) ** 3;
    const hosts = [...this.buildGroups.values(), this.preview.children[0]].filter(Boolean);
    for (const host of hosts) {
      const anim = host.userData?.roofAnim;
      if (!anim) continue;
      anim.t = Math.min(1, anim.t + step / anim.dur);
      const k = ease(anim.t);
      anim.shell.position.x = anim.from.x + (anim.to.x - anim.from.x) * k;
      anim.shell.position.z = anim.from.z + (anim.to.z - anim.from.z) * k;
      anim.shell.scale.set(anim.from.sx + (anim.to.sx - anim.from.sx) * k, 1, anim.from.sz + (anim.to.sz - anim.from.sz) * k);
      if (anim.t >= 1) delete host.userData.roofAnim;
    }
  }
  syncLife(state){
    const info=realMoment();
    this.applySky(info);
    this.lifeKey=`${info.seasonIndex}:${info.period}:${info.weather.kind}:${info.hour}`;
    for(const plant of state.flora){
      const site=FLORA_BY_ID[plant.id],stage=floraStage(plant,state.clock),blocked=floraBlocked(site,state.blocks);
      const old=this.floraGroups.get(plant.id);
      if(old?.userData.stage===stage&&old.userData.blocked===blocked)continue;
      if(old)this.scene.remove(old);
      this.targets=this.targets.filter(t=>t.id!==plant.id);this.pickMeshes=this.pickMeshes.filter(m=>m.userData.targetId!==plant.id);
      const g=new THREE.Group();g.position.set(site.x,terrainHeight(site.x,site.z)+.025,site.z);
      g.userData.stage=stage;g.userData.blocked=blocked;this.floraGroups.set(plant.id,g);
      if(blocked)continue;
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5,leaf=this.mesh(g,this.floraGeometry,'leaf',[Math.cos(a)*.13,.035,Math.sin(a)*.13],[.18,stage==='rest'?.018:.035,.065]);leaf.rotation.y=-a;}
      if(!['leaf','rest'].includes(stage)){
        this.cube(g,'leaf',[0,.16,0],[.035,.32,.035]);
        const color=stage==='seed'?'cream':stage==='flower'?'flower':'leafLight';
        this.mesh(g,this.floraGeometry,color,[0,.34,0],stage==='flower'?[.16,.05,.16]:stage==='seed'?[.14,.14,.14]:[.07,.1,.07]);
      }
      this.scene.add(g);
      this.target(g,{id:plant.id,type:'flora',name:'蒲公英',action:'观察',panel:'life',context:{id:plant.id},hint:'一株蒲公英 · 点观察，看看它怎样变化'});
    }
  }
  syncLand(state){
    const wanted=new Set([...(state.land.opened||[]), ...FACILITY_CHUNKS]),changedSeed=this.landSeed!==state.land.seed;
    for(const [key,g] of this.chunkGroups)if(!wanted.has(key)||changedSeed){
      this.scene.remove(g);this.groundMeshes=this.groundMeshes.filter(m=>m.userData.chunkId!==key);
      g.traverse(m=>{if(m.isMesh&&m.geometry!==this.landGeometry)m.geometry.dispose();});this.chunkGroups.delete(key);
    }
    this.landSeed=state.land.seed;
    for(const key of wanted){
      if(this.chunkGroups.has(key))continue;
      const [cx,cz]=key.split(',').map(Number),s=LAND_RULES.chunkSize,g=new THREE.Group();
      const land=new THREE.InstancedMesh(this.landGeometry,[this.mats.soil,this.mats.soil,this.mats.grass,this.mats.soil,this.mats.soil,this.mats.soil],s*s);
      const matrix=new THREE.Matrix4(),color=new THREE.Color();let i=0;
      for(let x=cx*s;x<(cx+1)*s;x++)for(let z=cz*s;z<(cz+1)*s;z++){
        matrix.makeTranslation(x,terrainHeight(x,z)-.9,z);land.setMatrixAt(i,matrix);
        color.setScalar(.93+seeded(x+state.land.seed,z)*.13);land.setColorAt(i++,color);
      }
      land.receiveShadow=true;land.userData.chunkId=key;g.add(land);this.groundMeshes.push(land);
      if(cx===0){const water=new THREE.Mesh(new THREE.PlaneGeometry(3,s),this.water.material);water.rotation.x=-Math.PI/2;water.position.set(4,WATER_RULES.riverLevel,cz*s+(s-1)/2);g.add(water);}
      this.scene.add(g);this.chunkGroups.set(key,g);
    }
    const encounters=landEncounters(state.land),ids=new Set(encounters.map(e=>e.id));
    for(const [id,g] of this.encounterGroups)if(!ids.has(id)||changedSeed){
      this.removeEncounter(id,g);this.encounterGroups.delete(id);
    }
    for(const e of encounters){
      const claimed=state.land.claimed.includes(e.id),old=this.encounterGroups.get(e.id);
      if(old?.userData.claimed===claimed)continue;
      if(old)this.removeEncounter(e.id,old);
      const g=new THREE.Group();g.position.set(e.x,terrainHeight(e.x,e.z),e.z);g.userData.claimed=claimed;g.userData.kind=e.kind;
      if(e.kind==='treasure'){
        this.cube(g,'wood',[0,.3,0],[.85,.6,.65],true);this.cube(g,'wood',[0,claimed?.95:.63,claimed?-.28:0],[.9,.12,.7],true);
      }else if(e.kind==='animal'){
        const body=new THREE.Group();g.add(body);g.userData.animalBody=body;
        this.mesh(body,this.floraGeometry,'cream',[0,.26,0],[.25,.25,.32]);this.mesh(body,this.floraGeometry,'cream',[0,.55,.17],[.2,.2,.2]);
        for(const x of [-.09,.09]){this.mesh(body,this.floraGeometry,'cream',[x,.81,.15],[.055,.25,.065]);this.mesh(body,this.floraGeometry,'wood',[x,.56,.35],[.025,.025,.025]);}
      }else{
        for(const x of [-.18,.18]){this.cube(g,'leaf',[x,.18,0],[.035,.36,.035]);this.mesh(g,this.floraGeometry,'flower',[x,.38,0],[.11,.06,.11]);}
      }
      if(e.kind!=='treasure'&&!claimed)this.cube(g,'wood',[.55,.13,0],[.25,.26,.24],true);
      this.scene.add(g);this.encounterGroups.set(e.id,g);
      this.target(g,{...e,type:'encounter',action:claimed?'看看':'领取发现',label:e.kind==='treasure'?'宝箱':e.kind==='animal'?'小兔':'草地发现',hint:claimed?'已经领取 · 还可以观察，不用重复领取':'点击发现补给 · 不伤害动物，材料在物资包或宝箱里'});
    }
    if(this.labelOnClick)this.createLabels(this.labelOnClick);
  }
  removeEncounter(id,g){
    this.targets.find(t=>t.id===id)?.labelElement?.remove();this.targets=this.targets.filter(t=>t.id!==id);
    this.pickMeshes=this.pickMeshes.filter(m=>m.userData.targetId!==id);this.scene.remove(g);
  }
  setupPool(state) {
    if (this.poolGroup) {
      const target=this.targets.find(t=>t.id==='swimming-pool');target?.labelElement?.remove();
      this.targets=this.targets.filter(t=>t.id!=='swimming-pool');
      this.pickMeshes=this.pickMeshes.filter(m=>m.userData.targetId!=='swimming-pool');
      this.poolGroup.traverse(m=>{if(m.isMesh&&m.geometry!==this.box&&m.geometry!==this.roundBox&&m.geometry!==this.wedge)m.geometry.dispose();});
      this.poolWater.material.dispose();this.scene.remove(this.poolGroup);
    }
    this.pool=null;this.poolGroup=null;
    // A new public facility must never overwrite an existing player's building.
    if(state.blocks.some(b=>inPoolReservedArea(b.x,b.z,.5)))return;
    this.pool=POOL;
    const g=this.poolGroup=new THREE.Group();g.position.set(POOL.x,0,POOL.z);this.scene.add(g);
    const wall=(x,z,sx,sz)=>this.cube(g,'stone',[x,POOL.rim/2,z],[sx,POOL.rim,sz],true);
    wall(-1.6,0,.2,3.4);wall(1.6,0,.2,3.4);wall(0,1.6,3.4,.2);wall(0,-1.6,3.4,.2);
    const surface=this.poolWater=new THREE.Mesh(new THREE.PlaneGeometry(3,3),this.water.material.clone());
    surface.rotation.x=-Math.PI/2;surface.position.y=POOL.level;surface.material.opacity=.76;g.add(surface);
    const ramp=this.mesh(g,this.wedge,'wood',[0,0,-2.25],[1.3,POOL.rim,1.5]);ramp.rotation.y=Math.PI;
    const t=this.target(g,{id:'swimming-pool',type:'pool',name:'游泳小水池',action:'去游泳',label:'游泳池',hint:'从木坡道入水 · 游向池沿就能上岸'});
    t.position.set(POOL.x,0,POOL.entryZ);
    if(this.labelOnClick)this.createLabels(this.labelOnClick);
  }
  waterState() {
    const p=this.playerPosition,ground=this.surfaceAt(p.x,p.z);
    let level=null;
    if(p.x>=WATER_RULES.riverMinX&&p.x<=WATER_RULES.riverMaxX&&isPointOpen(this.state?.land,p.x,p.z))level=WATER_RULES.riverLevel;
    if(this.pool&&Math.abs(p.x-POOL.x)<=POOL.halfWidth&&Math.abs(p.z-POOL.z)<=POOL.halfDepth)level=POOL.level;
    if(level===null||ground>=level||p.y>=level)return {mode:'walk',level};
    return {mode:level-ground>=WATER_RULES.swimDepth&&p.y<level-WATER_RULES.immersion?'swim':'wade',level};
  }
  pick(clientX,clientY) {
    const rect=this.canvas.getBoundingClientRect();const pointer=new THREE.Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1);const ray=new THREE.Raycaster();ray.setFromCamera(pointer,this.camera);
    const vistaMeshes = (this.balloon || this.vistaGlance) ? (this.vistaPick || []) : [];
    const hits=ray.intersectObjects([...this.pickMeshes,...this.groundMeshes,...vistaMeshes],false);if(!hits.length)return null;const h=hits[0];
    const vistaId = h.object.userData.vistaId;
    if (vistaId && VISTAS[vistaId]) {
      const vista = VISTAS[vistaId];
      return { target: { id: `vista-${vistaId}`, type: 'vista', vistaId, name: vista.name, position: new THREE.Vector3(vista.x, vista.y || 0, vista.z) }, point: h.point, cell: null };
    }
    const target=this.targets.find(t=>t.id===h.object.userData.targetId);
    let cell={x:Math.round(h.point.x),y:terrainHeight(Math.round(h.point.x),Math.round(h.point.z)),z:Math.round(h.point.z)};
    if(target?.type==='block'){const b=target.block;const normal=h.face.normal.clone().transformDirection(h.object.matrixWorld);cell={x:b.x,y:b.y,z:b.z};if(normal.y>.55)cell.y++;else if(Math.abs(normal.x)>Math.abs(normal.z))cell.x+=Math.sign(normal.x);else cell.z+=Math.sign(normal.z);}
    return {target,point:h.point,cell};
  }
  bindPointer() {
    this.pointerAbort = new AbortController();
    this.pointerSignal = this.pointerAbort.signal;
    this.pointers = new Map();
    const gesture = this.pointerGesture = { start: null, dragged: false, pinch: 0, previewOffset: null, dragPick: null, pointerType: null, mouseTap: false };
    this.canvas.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this.canvas.setPointerCapture(e.pointerId);
      if (this.tapTimer) this.cancelScheduledTap();
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      gesture.pointerType = e.pointerType;
      if (this.pointers.size === 1) {
        gesture.start = { x: e.clientX, y: e.clientY }; gesture.dragged = false;
        gesture.previewOffset = null; gesture.dragPick = null;
        if (e.pointerType === 'touch' && this.callbacks.canDragPreview?.() && this.hitPreview(e.clientX, e.clientY)) {
          // Keep the grabbed point aligned with the finger instead of jumping to its ground ray.
          const base = this.preview.children[0].position.clone().project(this.camera), rect = this.canvas.getBoundingClientRect();
          gesture.previewOffset = { x: rect.left + (base.x + 1) * rect.width / 2 - e.clientX, y: rect.top + (1 - base.y) * rect.height / 2 - e.clientY };
          this.stopWalking();
        }
      } else {
        gesture.previewOffset = null; gesture.dragPick = null; gesture.dragged = true;
        const p = [...this.pointers.values()];
        gesture.pinch = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      }
    }, { signal: this.pointerSignal });
    this.canvas.addEventListener('pointermove', e => {
      const old = this.pointers.get(e.pointerId); if (!old) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size >= 2) {
        const p = [...this.pointers.values()], d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        if (gesture.pinch) this.zoomBy((gesture.pinch - d) * .045);
        gesture.pinch = d; gesture.dragged = true;
      } else if (gesture.start && (gesture.dragged || Math.hypot(e.clientX - gesture.start.x, e.clientY - gesture.start.y) > 9)) {
        gesture.dragged = true;
        if (gesture.previewOffset) {
          gesture.dragPick = document.elementFromPoint(e.clientX, e.clientY) === this.canvas
            ? this.pick(e.clientX + gesture.previewOffset.x, e.clientY + gesture.previewOffset.y) : null;
          if (gesture.dragPick) this.callbacks.onPreviewDrag?.(gesture.dragPick);
        } else this.yaw -= (e.clientX - old.x) * .005;
      }
    }, { signal: this.pointerSignal });
    this.canvas.addEventListener('pointerup', e => {
      gesture.mouseTap = e.pointerType === 'mouse' && !gesture.dragged && this.pointers.size === 1;
      if (this.pointers.size === 1) {
        if (gesture.previewOffset) {
          if (gesture.dragged && gesture.dragPick && document.elementFromPoint(e.clientX, e.clientY) === this.canvas) this.callbacks.onQuickPlace?.(gesture.dragPick);
        } else if (!gesture.dragged) {
          const pick = this.pick(e.clientX, e.clientY); if (pick) this.scheduleTap(pick);
        }
      }
      this.pointers.delete(e.pointerId); gesture.start = null; gesture.previewOffset = null; gesture.dragPick = null;
    }, { signal: this.pointerSignal });
    this.canvas.addEventListener('pointercancel', () => this.cancelPointerGesture(), { signal: this.pointerSignal });
    this.canvas.addEventListener('dblclick', e => {
      if (e.button !== 0) return;
      this.cancelScheduledTap();
      const pick = this.pick(e.clientX, e.clientY);
      if (this.callbacks.canFocusModel?.() !== false && this.toggleModelFocus(pick)) return;
      if (gesture.pointerType !== 'mouse' || !gesture.mouseTap) return;
      if (pick) this.callbacks.onQuickPlace?.(pick);
    }, { signal: this.pointerSignal });
    this.canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoomBy(e.deltaY*.008);},{passive:false, signal: this.pointerSignal});
    trackListeners(6);
  }
  hitPreview(clientX, clientY) {
    if (!this.preview.visible || !this.preview.children.length) return false;
    this.preview.updateMatrixWorld(true);
    const rect = this.canvas.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, 1 - (clientY - rect.top) / rect.height * 2), this.camera);
    return ray.intersectObjects(this.preview.children, true).length > 0;
  }
  cancelPointerGesture() {
    this.pointers?.clear();
    if (this.pointerGesture) Object.assign(this.pointerGesture, { start: null, dragged: true, previewOffset: null, dragPick: null, mouseTap: false });
  }
  select(target) {this.selectedTarget=target;this.selectionRing.visible=!!target;if(target){this.selectionPulse=1;this.selectionRing.position.set(target.position.x,terrainHeight(Math.round(target.position.x),Math.round(target.position.z))+.025,target.position.z);}}
  cancelScheduledTap() { clearTimeout(this.tapTimer); this.tapTimer = 0; }
  scheduleTap(pick) {
    this.cancelScheduledTap();
    const lookable = this.focusTarget(pick);
    if (lookable && this.callbacks.canFocusModel?.() !== false) {
      this.callbacks.onPick?.(pick);
      this.tapTimer = setTimeout(() => { this.tapTimer = 0; this.callbacks.onTap?.(pick); }, 320);
      return;
    }
    if (pick?.target && this.callbacks.canFocusModel?.() !== false) this.callbacks.onPick?.(pick);
    if (pick) this.callbacks.onTap?.(pick);
  }
  setFrontier(chunk){
    this.frontierPreview.visible=!!chunk;this.frontierPreview.userData.chunk=chunk?.id??null;
    if(!chunk)return;
    const s=LAND_RULES.chunkSize,{x,z,dx,dz}=chunk.edge;
    this.frontierFill.position.set(chunk.cx*s+(s-1)/2,.015,chunk.cz*s+(s-1)/2);this.frontierFill.scale.set(s,.025,s);
    this.frontierLine.position.set(dx?x-.5:chunk.cx*s+(s-1)/2,.06,dz?z-.5:chunk.cz*s+(s-1)/2);
    this.frontierLine.scale.set(dx?.12:s,.08,dz?.12:s);
  }
  walkTo(point,callback=null) {this.walkTarget=new THREE.Vector2(point.x,point.z);this.walkCallback=callback;}
  stopWalking(){this.walkTarget=null;this.walkCallback=null;}
  jump(){
    if(this.locomotion==='swim'){this.callbacks.onWater?.('游向池沿或木坡道，就能上岸。');return;}
    if(this.balloon){
      if(this.balloon.phase==='home'||this.balloon.phase==='descend')return;
      this.setBalloonClimb(1, 0.45);
      return;
    }
    if(this.bounce)return;
    if(this.bounceHold&&onBounceIsland(this.playerPosition.x,this.playerPosition.z)){this.startBounce();return;}
    if(this.playerPosition.y<=this.surfaceAt(this.playerPosition.x,this.playerPosition.z)+.08)this.velocityY=4.6;
  }
  setParkMode(id, extra = {}) {
    const mode = playMode(id);
    const nextStep = extra.step || this.parkStep || 2;
    const nextTable = extra.table || this.parkTable || 2;
    const same = this.parkMode === mode.id && nextStep === this.parkStep && nextTable === this.parkTable;
    this.parkMode = mode.id;
    this.parkStep = nextStep;
    this.parkTable = nextTable;
    if (this.bounce && !this.bounce.stop) {
      this.bounce.mode = this.parkMode;
      this.bounce.step = this.parkStep;
      this.bounce.table = this.parkTable;
      if (!same) this.bounce.count = 0;
    }
    if (!same) this.callbacks.onParkMode?.(this.bounceLook());
    return mode;
  }
  startBounce(){
    if(this.balloon||this.bounce)return;
    this.bounce={count:0,stop:false,mode:this.parkMode||'count',step:this.parkStep||2,table:this.parkTable||2};this.bounceHold=false;this.locomotion='bounce';this.stopWalking();
    this.velocityY=5.8;this.playerPosition.y=BOUNCE_ISLAND.height+0.02;
    this.landBounce();
  }
  stopBounce(){
    if(!this.bounce)return false;
    this.bounce.stop=true;this.bounceHold=true;return true;
  }
  landBounce(){
    if(!this.bounce||this.bounce.stop)return;
    this.bounce.count+=1;this.velocityY=6.1;this.bounceSquash=1;
    this.callbacks.onBounce?.(this.bounceLook());
  }
  bounceLook(){
    const mode=this.bounce?.mode||this.parkMode||'count';
    const n=this.bounce?this.bounce.count:0;
    return playBounce(mode,n,{step:this.bounce?.step||this.parkStep,table:this.bounce?.table||this.parkTable});
  }
  surfaceAt(x,z) {
    let h=terrainHeight(Math.round(x),Math.round(z));
    if(this.pool){
      const dx=Math.abs(x-POOL.x),dz=Math.abs(z-POOL.z);
      if((dx>=1.5&&dx<=1.7&&dz<=1.7)||(dz>=1.5&&dz<=1.7&&dx<=1.7))h=Math.max(h,POOL.rim);
      if(dx<=POOL.rampHalfWidth&&z>=POOL.rampMinZ&&z<=POOL.rampMaxZ)h=Math.max(h,(z-POOL.rampMinZ)/(POOL.rampMaxZ-POOL.rampMinZ)*POOL.rim);
    }
    if(x>=this.bridge.minX&&x<=this.bridge.maxX&&z>=this.bridge.minZ&&z<=this.bridge.maxZ)h=Math.max(h,this.bridge.height);
    const bounceH=bounceSurface(x,z);if(bounceH!==null)h=Math.max(h,bounceH);
    if(onBalloonLawn(x,z))h=Math.max(h,BALLOON_BASE.padHeight);
    if(this.dockSite && Math.hypot(x-this.dockSite.x,z-this.dockSite.z)<=this.dockSite.radius+0.35)h=Math.max(h,0.28);
    if(this.demoRamp&&Math.abs(x-this.demoRamp.x)<this.demoRamp.width/2&&z>=this.demoRamp.minZ&&z<=this.demoRamp.maxZ)h=Math.max(h,(this.demoRamp.maxZ-z)/4*this.demoRamp.height);
    if(Math.abs(x-9)<.85&&z>=-2.25&&z<=-.9){h=Math.max(h,.08);if(Math.abs(x-9)>.74||z>-.99)h=Math.max(h,.5);}
    for(const b of this.state?.blocks||[]){if(b.item==='roof')continue;if(Math.abs(x-b.x)>.5||Math.abs(z-b.z)>.5)continue;if(b.item==='door')continue;const angle=(b.rotation||0)*Math.PI/2;const localZ=(x-b.x)*Math.sin(angle)+(z-b.z)*Math.cos(angle);if((b.item==='post'||b.item==='fence'||b.item==='flag')&&Math.abs(localZ)>.13)continue;let bh=b.y+1;if(b.item==='ramp'){bh=b.y+.5-localZ;}else if(b.item==='chest')bh=b.y+.7;else if(b.item==='bed')bh=b.y+.35;else if(b.item==='pot'||b.item==='lantern')bh=b.y+.45;else if(b.item==='wreath')bh=b.y+.08;h=Math.max(h,bh);}return h;
  }
  canMove(x,z) {
    if(!isPointOpen(this.state?.land,x,z,LAND_RULES.bodyMargin))return false;
    for(const c of this.decorColliders){if(c.width&&Math.abs(x-c.x)<c.width/2+.18&&Math.abs(z-c.z)<c.depth/2+.18)return false;if(c.radius&&Math.hypot(x-c.x,z-c.z)<c.radius+.25)return false;}
    const y=this.surfaceAt(x,z);return y-this.playerPosition.y<1.05;
  }
  nearestTarget(max=3){let best=null,dist=max;for(const t of this.targets){if(t.type==='flora')continue;const d=Math.hypot(t.position.x-this.playerPosition.x,t.position.z-this.playerPosition.z);if(d<dist){best=t;dist=d;}}return best;}
  distanceTo(target){return Math.hypot(target.position.x-this.playerPosition.x,target.position.z-this.playerPosition.z);}
  forwardCell(){const x=Math.round(this.playerPosition.x+Math.sin(this.facing)*1.65),z=Math.round(this.playerPosition.z+Math.cos(this.facing)*1.65);return{x,y:terrainHeight(x,z),z};}
  releaseBall(point = null) {
    if(this.balls.length>=BALL_RULES.maxCount){this.callbacks.onBall?.('已经有四个球啦，先点一个球取回，再放新的。');return false;}
    let p;if(point)p=new THREE.Vector3(point.x,this.surfaceAt(point.x,point.z)+.55,point.z);else p=new THREE.Vector3(9,2.95,-6.7);
    const bounds=landBounds(this.state?.land),margin=LAND_RULES.ballMargin;
    p.x=clamp(p.x,bounds.minX+margin,bounds.maxX-margin);p.z=clamp(p.z,bounds.minZ+margin,bounds.maxZ-margin);
    if(!isPointOpen(this.state?.land,p.x,p.z,margin)){this.callbacks.onBall?.('先开垦这片草地，再把球放过去。');return false;}
    const id=`ball-${Math.max(0,...this.balls.map(b=>Number(b.id.slice(5))))+1}`;
    this.spawnBall(id,p,new THREE.Vector3());this.callbacks.onBall?.('小球出发啦！走过去推一推，或点球取回。');return true;
  }
  spawnBall(id,p,v) {
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(BALL_RULES.radius,18,14),this.ballMaterial);mesh.castShadow=true;mesh.position.copy(p);this.scene.add(mesh);
    const target=this.target(mesh,{id,type:'ball',item:'ball',name:'木球',action:'收起球',hint:'走过去可以推球 · 点球，再点收起球'});
    target.position=p;
    this.balls.push({id,mesh,p,v,age:0,landed:false});
  }
  recallBall(id, notify = true) {
    const b=this.balls.find(b=>b.id===id);if(!b)return false;
    this.scene.remove(b.mesh);b.mesh.geometry.dispose();
    this.balls=this.balls.filter(b=>b!==b);this.targets=this.targets.filter(t=>t.id!==id);this.pickMeshes=this.pickMeshes.filter(m=>m!==b.mesh);
    if(notify)this.callbacks.onBall?.('木球收好了，可以再放出来。');return true;
  }
  serializeBalls() {
    return this.balls.map(b=>({id:b.id,x:b.p.x,y:b.p.y,z:b.p.z,vx:b.v.x,vy:b.v.y,vz:b.v.z}));
  }
  pushBalls(vx,vz) {
    for(const b of this.balls){
      const dx=b.p.x-this.playerPosition.x,dz=b.p.z-this.playerPosition.z,d=Math.hypot(dx,dz);
      if(d<.001||d>BALL_RULES.pushReach||Math.abs(b.p.y-this.playerPosition.y-BALL_RULES.radius)>.5)continue;
      const nx=dx/d,nz=dz/d,approach=vx*nx+vz*nz;if(approach<=.01)continue;
      const impulse=Math.max(0,approach*BALL_RULES.pushGain-(b.v.x*nx+b.v.z*nz));
      b.v.x+=nx*impulse;b.v.z+=nz*impulse;b.landed=false;
      const x=this.playerPosition.x+nx*BALL_RULES.pushReach,z=this.playerPosition.z+nz*BALL_RULES.pushReach;
      if(this.surfaceAt(x,z)<b.p.y+.12){b.p.x=x;b.p.z=z;}
    }
  }
  updateBalls(dt){
    const steps=3,step=dt/steps;
    for(const ball of this.balls){ball.age+=dt;for(let k=0;k<steps;k++){const h=this.surfaceAt(ball.p.x,ball.p.z),r=.22;
        if(ball.p.y<=h+r+.025&&ball.v.y<=0){ball.p.y=h+r;ball.v.y=0;const e=.035;let gx=clamp((this.surfaceAt(ball.p.x+e,ball.p.z)-this.surfaceAt(ball.p.x-e,ball.p.z))/(e*2),-3,3),gz=clamp((this.surfaceAt(ball.p.x,ball.p.z+e)-this.surfaceAt(ball.p.x,ball.p.z-e))/(e*2),-3,3);const g=ballGravity(this.realmId||'he');const f=(5/7)*g/(1+gx*gx+gz*gz);ball.v.x-=gx*f*step;ball.v.z-=gz*f*step;ball.v.x*=Math.exp(-BALL_RULES.rollingDrag*step);ball.v.z*=Math.exp(-BALL_RULES.rollingDrag*step);if(Math.hypot(gx,gz)<.01&&Math.hypot(ball.v.x,ball.v.z)<BALL_RULES.sleepSpeed){ball.v.x=0;ball.v.z=0;}}
        else ball.v.y-=ballGravity(this.realmId||'he')*step;
        const nx=ball.p.x+ball.v.x*step,nz=ball.p.z+ball.v.z*step,nh=this.surfaceAt(nx,nz);
        if(nh>ball.p.y+r*.3&&nh-h>.35){if(this.surfaceAt(nx,ball.p.z)>ball.p.y)ball.v.x*=-.32;if(this.surfaceAt(ball.p.x,nz)>ball.p.y)ball.v.z*=-.32;}else{
          if(isPointOpen(this.state?.land,nx,ball.p.z,LAND_RULES.ballMargin))ball.p.x=nx;else ball.v.x*=-.32;
          if(isPointOpen(this.state?.land,ball.p.x,nz,LAND_RULES.ballMargin))ball.p.z=nz;else ball.v.z*=-.32;
        }
        ball.p.y+=ball.v.y*step;
        const bounds=landBounds(this.state?.land);
        for(const [axis,min,max] of [['x',bounds.minX,bounds.maxX],['z',bounds.minZ,bounds.maxZ]]){
          const limited=clamp(ball.p[axis],min+LAND_RULES.ballMargin,max-LAND_RULES.ballMargin);
          if(limited!==ball.p[axis]){ball.p[axis]=limited;ball.v[axis]*=-.32;}
        }
        for(const axis of ['x','y','z'])ball.v[axis]=clamp(ball.v[axis],-BALL_RULES.maxSpeed,BALL_RULES.maxSpeed);
      }ball.mesh.position.copy(ball.p);ball.mesh.rotation.x+=ball.v.z*dt/.22;ball.mesh.rotation.z-=ball.v.x*dt/.22;
      if(!ball.landed&&ball.age>3&&ball.v.length()<.08){ball.landed=true;this.callbacks.onBall?.('小球停下了。换个起点，或试着改一块坡道');}
    }this.balls=this.balls.filter(b=>!b.done);
  }
  celebrate(position,color='#f4d991') {for(let i=0;i<12;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(.06,.06,.06),new THREE.MeshBasicMaterial({color}));m.position.set(position.x,position.y+.8,position.z);this.scene.add(m);this.particles.push({mesh:m,v:new THREE.Vector3((seeded(i,this.time)-.5)*2,.8+seeded(i,10), (seeded(i,1)-.5)*2),age:0});}}
  placedModel(pick) {
    return this.focusTarget(pick);
  }
  focusTarget(pick) {
    const target = pick?.target;
    if (!target) return null;
    if (target.figureId || target.assemblyId || target.type === 'tutor' || target.type === 'station') return target;
    if (target.type === 'block' && target.panel) return target;
    return null;
  }
  toggleModelFocus(pick) {
    const target = this.focusTarget(pick);
    if (this.modelFocus && (!target || target.id === this.modelFocus.id)) {
      this.modelFocus = null;
      this.callbacks.onModelFocus?.(null);
      return true;
    }
    if (!target) return false;
    this.stopWalking();
    const tutor = target.type === 'tutor';
    const station = target.type === 'station' || Boolean(target.panel);
    this.modelFocus = { id: target.id, point: target.position.clone(), distance: tutor ? 5.2 : station ? 7.4 : 6.5, lift: tutor ? 1.05 : 1.15 };
    this.callbacks.onModelFocus?.(target);
    return true;
  }
  zoomBy(delta) {
    if (this.modelFocus) this.modelFocus.distance = clamp(this.modelFocus.distance + delta, 3.5, 12);
    else this.distance = clamp(this.distance + delta, 12, this.balloon ? 42 : 29);
  }
  startBalloon() {
    if (this.balloon) return false;
    if (this.bounce) {
      this.bounce = null;
      this.bounceHold = true;
      this.callbacks.onBounceStop?.();
    }
    const angle = balloonHomeAngle(this.state?.land);
    this.balloon = { phase: 'lift', t: 0, angle, turn: 1, travelled: 0, mode: 'orbit', scale: 0.36, climb: 0, height: BALLOON_BASE.cruiseHeight };
    this.locomotion = 'balloon';
    this.stopWalking();
    this.velocityY = 0;
    this.modelFocus = null;
    const tour = balloonTourPoint(this.state?.land, angle);
    this.facing = Math.atan2(tour.cx - BALLOON_BASE.x, tour.cz - BALLOON_BASE.z);
    this.yaw = this.facing + Math.PI;
    this.camera.far = 180;
    this.camera.updateProjectionMatrix();
    const base = this.targets.find(t => t.id === 'balloon-base');
    const craft = this.targets.find(t => t.id === 'balloon-craft');
    if (base) base.action = '降落到草坪基地';
    if (craft) craft.action = '降落到草坪基地';
    this.callbacks.onBalloonStart?.(this.balloonLook());
    return true;
  }
  requestBalloonLand() {
    if (this.balloon?.phase === 'voyage') return false;
    return this.stopBalloon();
  }
  startVoyage(realmId = 'ri') {
    if (!this.balloon || this.balloon.phase !== 'tour') return false;
    this.balloon.phase = 'voyage';
    this.balloon.t = 0;
    this.balloon.realmId = realmId;
    this.balloon.arrived = false;
    this.balloon.scripted = realmId === 'xing';
    this.dismissVista();
    this.callbacks.onBalloonLook?.(this.balloonLook());
    return true;
  }
  completeVoyage() {
    if (!this.balloon || this.balloon.phase !== 'voyage' || this.balloon.arrived) return false;
    this.balloon.arrived = true;
    this.callbacks.onVoyageArrive?.(this.balloon.realmId || 'ri');
    return true;
  }
  stopBalloon() {
    if (!this.balloon || this.balloon.phase === 'home' || this.balloon.phase === 'descend' || this.balloon.phase === 'voyage') return false;
    const p = this.balloonCraft?.position || this.playerPosition;
    const near = balloonNearBase(p.x, p.z);
    this.balloon.phase = near ? 'descend' : 'home';
    this.balloon.t = 0;
    this.balloon.from = { x: p.x, y: p.y, z: p.z, angle: this.balloon.angle };
    this.balloon.climb = 0;
    this.balloon.homeSeconds = balloonHomeDuration(p.x, p.z);
    this.callbacks.onBalloonLook?.(this.balloonLook());
    return true;
  }
  finishBalloon(silent = false) {
    this.dismissVista();
    this.balloon = null;
    this.locomotion = 'walk';
    this.velocityY = 0;
    if (this.balloonCraft) this.balloonCraft.position.set(BALLOON_BASE.x, 0, BALLOON_BASE.z);
    const craftTarget = this.targets.find(t => t.id === 'balloon-craft');
    if (craftTarget && this.balloonCraft) craftTarget.position.copy(this.balloonCraft.position);
    this.playerPosition.set(BALLOON_BASE.x + 1.35, this.surfaceAt(BALLOON_BASE.x + 1.35, BALLOON_BASE.z), BALLOON_BASE.z);
    const base = this.targets.find(t => t.id === 'balloon-base');
    const craft = this.targets.find(t => t.id === 'balloon-craft');
    if (base) base.action = '乘坐热气球';
    if (craft) craft.action = '乘坐热气球';
    this.camera.far = 140;
    this.camera.updateProjectionMatrix();
    if (!silent) this.callbacks.onBalloonStop?.();
  }
  balloonLook() {
    const phase = this.balloon?.phase || 'idle';
    const destination = phase === 'voyage' ? (this.balloon?.realmId || 'ri') : null;
    return balloonLook(phase, this.balloon?.angle || 0, this.balloon?.mode || 'orbit', destination);
  }
  setBalloonMode(mode) {
    if (!this.balloon || this.balloon.phase === 'home' || this.balloon.phase === 'descend' || this.balloon.phase === 'voyage') return false;
    const next = mode === 'steer' ? 'steer' : 'orbit';
    if (next === 'orbit' && this.balloonCraft) {
      const p = this.balloonCraft.position;
      this.balloon.angle = balloonAngleFrom(this.state?.land, p.x, p.z);
      this.balloon.scale = balloonScaleFrom(this.state?.land, p.x, p.z);
    }
    if (this.balloon.mode === next) return true;
    this.balloon.mode = next;
    this.callbacks.onBalloonLook?.(this.balloonLook());
    return true;
  }
  setBalloonClimb(value, hold = 0) {
    if (!this.balloon || this.balloon.phase === 'home' || this.balloon.phase === 'descend' || this.balloon.phase === 'voyage') return false;
    this.balloon.climb = Math.max(-1, Math.min(1, Number(value) || 0));
    this.balloon.climbUntil = hold > 0 ? this.time + hold : 0;
    if (this.balloon.phase === 'tour') this.setBalloonMode('steer');
    return true;
  }
  stepBalloon(dt, mx = 0, mz = 0) {
    const ride = this.balloon;
    if (!ride || !this.balloonCraft) return;
    const home = BALLOON_BASE;
    const bob = Math.sin(this.time * 1.35) * 0.14;
    if (ride.climbUntil && this.time >= ride.climbUntil) { ride.climb = 0; ride.climbUntil = 0; }
    if (this.balloonEnvelope) this.balloonEnvelope.rotation.y += dt * 0.35 * (ride.turn || 1);
    if (ride.phase === 'lift') {
      ride.t += dt;
      const u = Math.min(1, ride.t / home.liftSeconds);
      const ease = u * u * (3 - 2 * u);
      const tour = balloonTourPoint(this.state?.land, ride.angle, ride.scale);
      this.balloonCraft.position.set(
        home.x + (tour.x - home.x) * ease,
        home.cruiseHeight * ease + bob * ease,
        home.z + (tour.z - home.z) * ease,
      );
      ride.height = home.cruiseHeight * ease;
      if (u >= 1) {
        ride.phase = 'tour';
        ride.t = 0;
        ride.height = home.cruiseHeight;
        this.callbacks.onBalloonLook?.(this.balloonLook());
      }
    } else if (ride.phase === 'tour') {
      if (ride.mode !== 'steer' && Math.hypot(mx, mz) > 0.22 && Math.abs(mz) > 0.16) this.setBalloonMode('steer');
      if (ride.mode === 'steer') {
        const pose = balloonSteer(this.balloonCraft.position, { mx, mz, climb: ride.climb || 0, yaw: this.yaw }, dt, this.state?.land);
        this.balloonCraft.position.set(pose.x, pose.y + bob * 0.4, pose.z);
        ride.height = pose.y;
        if (Math.hypot(mx, mz) > 0.08) this.facing = Math.atan2(mx * Math.cos(this.yaw) + mz * Math.sin(this.yaw), -mx * Math.sin(this.yaw) + mz * Math.cos(this.yaw));
        ride.angle = balloonAngleFrom(this.state?.land, pose.x, pose.z);
      } else {
        ride.turn = Math.abs(mx) > 0.12 ? Math.sign(mx) : ride.turn || 1;
        if (Math.abs(mz) > 0.12) ride.scale = Math.min(BALLOON_CONTROL.maxScale, Math.max(BALLOON_CONTROL.minScale, (ride.scale || 0.36) - mz * 0.12 * dt));
        const rate = (Math.PI * 2) / home.tourSeconds;
        const before = ride.travelled;
        ride.angle += rate * ride.turn * (1 + Math.abs(mx) * 0.8) * dt;
        ride.travelled += Math.abs(rate * (1 + Math.abs(mx) * 0.8) * dt);
        ride.height = Math.min(BALLOON_CONTROL.maxHeight, Math.max(BALLOON_CONTROL.minHeight, (ride.height || home.cruiseHeight) + (ride.climb || 0) * BALLOON_CONTROL.climbSpeed * dt));
        const tour = balloonTourPoint(this.state?.land, ride.angle, ride.scale);
        this.balloonCraft.position.set(tour.x, ride.height + bob, tour.z);
        this.facing = Math.atan2(tour.cx - tour.x, tour.cz - tour.z);
        if (Math.floor(ride.travelled / (Math.PI / 2)) !== Math.floor(before / (Math.PI / 2))) {
          this.callbacks.onBalloonLook?.(this.balloonLook());
        }
      }
    } else if (ride.phase === 'home') {
      ride.t += dt;
      const u = Math.min(1, ride.t / (ride.homeSeconds || balloonHomeDuration(ride.from.x, ride.from.z)));
      const pose = balloonReturnPose(ride.from, 'home', u);
      this.balloonCraft.position.set(pose.x, pose.y + bob, pose.z);
      this.facing = Math.atan2(home.x - pose.x, home.z - pose.z);
      if (u >= 1) {
        ride.phase = 'descend';
        ride.t = 0;
        ride.from = { x: home.x, y: ride.from?.y ?? home.cruiseHeight, z: home.z, angle: ride.angle };
        this.callbacks.onBalloonLook?.(this.balloonLook());
      }
    } else if (ride.phase === 'voyage') {
      ride.height = Math.min(BALLOON_CONTROL.maxHeight, (ride.height || home.cruiseHeight) + BALLOON_CONTROL.climbSpeed * dt);
      this.balloonCraft.position.y = ride.height + bob;
      if (ride.height >= BALLOON_CONTROL.maxHeight - 0.05 && !ride.scripted) {
        this.completeVoyage();
        return;
      }
    } else if (ride.phase === 'descend' || ride.phase === 'land') {
      ride.t += dt;
      const u = Math.min(1, ride.t / home.descendSeconds);
      const pose = balloonReturnPose(ride.from, 'descend', u);
      this.balloonCraft.position.set(pose.x, pose.y, pose.z);
      this.facing = Math.atan2(home.x - this.playerPosition.x, home.z - this.playerPosition.z);
      if (u >= 1) {
        this.finishBalloon();
        return;
      }
    }
    const c = this.balloonCraft.position;
    this.playerPosition.set(c.x, c.y + home.basketHeight, c.z);
    const craftTarget = this.targets.find(t => t.id === 'balloon-craft');
    if (craftTarget) craftTarget.position.copy(c);
    this.maybeSpotVista();
  }
  updateCamera(dt,instant=false){
    const glance = this.vistaGlance;
    // 压低俯仰只发生在远眺引导的转身和靠近。平时地面 .76、飞行 .48，不因朝向远景改变。
    if (glance?.phase === 'zoom') {
      const vista = VISTAS[glance.id];
      const u = Math.min(1, glance.t / 3.2);
      const ease = u * u * (3 - 2 * u);
      const focus = new THREE.Vector3(vista.x, (vista.y || 0) + 8, vista.z);
      this.lookAt.lerp(focus, instant ? 1 : 1 - Math.exp(-2.4 * dt));
      const dist = 16 - ease * 6;
      const v = new THREE.Vector3(Math.sin(this.yaw) * dist, dist * 0.16, Math.cos(this.yaw) * dist);
      const desired = this.lookAt.clone().add(v);
      this.camera.position.lerp(desired, instant ? 1 : 1 - Math.exp(-3 * dt));
      this.camera.lookAt(this.lookAt);
      return;
    }
    if (this.modelFocus && !this.targets.some(t => t.id === this.modelFocus.id)) this.modelFocus = null;
    const focus = this.modelFocus;
    const live = focus && this.targets.find(t => t.id === focus.id);
    if (live) focus.point.copy(live.position);
    const flying = !!this.balloon;
    const center = focus ? focus.point.clone() : this.playerPosition.clone();
    center.y += focus ? focus.lift : flying ? 1.8 : .45;
    const turning = glance?.phase === 'turn' ? VISTAS[glance.id] : null;
    if (flying && this.balloon.mode !== 'steer' && this.state?.land && !turning) {
      const tour = balloonTourPoint(this.state.land, this.balloon.angle, this.balloon.scale);
      center.x += (tour.cx - center.x) * 0.35;
      center.z += (tour.cz - center.z) * 0.35;
      center.y = Math.max(2.4, center.y - 4);
    }
    let glanceEase = 0;
    if (turning) {
      const aim = new THREE.Vector3(turning.x, (turning.y || 0) + 8, turning.z);
      const u = Math.min(1, glance.t / 1.25);
      glanceEase = u * u * (3 - 2 * u);
      center.lerp(aim, 0.92 * glanceEase);
    }
    this.lookAt.lerp(center, instant ? 1 : 1 - Math.exp(-3 * dt));
    let dist = focus ? focus.distance : flying ? Math.max(this.distance, 24) : this.distance;
    if (turning && !focus) dist = 26 - glanceEase * 14;
    const pitch = focus ? .42 : turning ? .16 : flying ? .48 : .76;
    const v = new THREE.Vector3(Math.sin(this.yaw) * dist, dist * pitch, Math.cos(this.yaw) * dist);
    const desired = this.lookAt.clone().add(v);
    this.camera.position.lerp(desired, instant ? 1 : 1 - Math.exp(-5 * dt));
    this.camera.lookAt(this.lookAt);
  }
  update(dt,input={x:0,z:0},paused=false){
    this.time+=dt;this.stepRoofMotions(dt);spinSouvenirs(this, dt);let mx=input.x||0,mz=input.z||0;
    if(!paused){this.motionTime+=dt;if(!this.bounce&&!this.balloon)this.locomotion=this.waterState().mode;}
    if(!paused){if(mx||mz)this.stopWalking();if(this.walkTarget){const dx=this.walkTarget.x-this.playerPosition.x,dz=this.walkTarget.y-this.playerPosition.z,d=Math.hypot(dx,dz);if(d<1.9&&this.walkCallback){const cb=this.walkCallback;this.stopWalking();cb();}else if(d<.15)this.stopWalking();else{const c=Math.cos(this.yaw),s=Math.sin(this.yaw);mx=(dx*c-dz*s)/d;mz=(dx*s+dz*c)/d;}}
      const length=Math.hypot(mx,mz);if(length>1){mx/=length;mz/=length;}
      const flying=!!this.balloon;
      if(flying){
        this.stopWalking();
        this.stepBalloon(dt,mx,mz);
        this.lastMove=this.balloon?.mode==='steer'&&Math.hypot(mx,mz)>0.08;
        this.velocityY=0;
      } else {
      const onPad=onBounceIsland(this.playerPosition.x,this.playerPosition.z);
      if(this.bounceHold&&!onPad)this.bounceHold=false;
      if(!this.bounce){
        const pad=parkPadAt(this.playerPosition.x,this.playerPosition.z);
        if(pad&&pad!==this.parkMode)this.setParkMode(pad);
      }
      if(!this.bounce&&onPad&&!this.bounceHold&&this.playerPosition.y<=BOUNCE_ISLAND.height+.2)this.startBounce();
      const bouncing=!!this.bounce;
      const wx=mx*Math.cos(this.yaw)+mz*Math.sin(this.yaw),wz=-mx*Math.sin(this.yaw)+mz*Math.cos(this.yaw);
      const speed=this.locomotion==='swim'?WATER_RULES.swimSpeed:this.locomotion==='wade'?WATER_RULES.wadeSpeed:WATER_RULES.walkSpeed;
      const oldX=this.playerPosition.x,oldZ=this.playerPosition.z;
      if(!bouncing){
        const nx=this.playerPosition.x+wx*speed*dt,nz=this.playerPosition.z+wz*speed*dt;
        if(this.canMove(nx,this.playerPosition.z))this.playerPosition.x=nx;if(this.canMove(this.playerPosition.x,nz))this.playerPosition.z=nz;
        if(Math.hypot(wx,wz)>.05){this.facing=Math.atan2(wx,wz);this.lastMove=true;}else this.lastMove=false;
      }else{
        this.stopWalking();
        this.playerPosition.x+=(BOUNCE_ISLAND.x-this.playerPosition.x)*(1-Math.exp(-4*dt));
        this.playerPosition.z+=(BOUNCE_ISLAND.z-this.playerPosition.z)*(1-Math.exp(-4*dt));
        this.lastMove=false;
      }
      if(dt>0)this.pushBalls((this.playerPosition.x-oldX)/dt,(this.playerPosition.z-oldZ)/dt);
      const water=this.waterState();if(!bouncing)this.locomotion=water.mode;
      const ground=this.surfaceAt(this.playerPosition.x,this.playerPosition.z);
      if(this.locomotion==='swim'&&!bouncing){this.velocityY=0;this.playerPosition.y+=(water.level-WATER_RULES.floatOffset-this.playerPosition.y)*(1-Math.exp(-WATER_RULES.floatRate*dt));}
      else if(ground>this.playerPosition.y&&this.velocityY<=0){
        this.playerPosition.y=ground;
        if(bouncing){if(this.bounce.stop){this.bounce=null;this.velocityY=0;this.locomotion='walk';this.callbacks.onBounceStop?.();}else this.landBounce();}
        else this.velocityY=0;
      }else{this.velocityY-=playerFall(this.realmId||'he',bouncing)*dt;this.playerPosition.y+=this.velocityY*dt;if(this.playerPosition.y<=ground){
        this.playerPosition.y=ground;
        if(bouncing){if(this.bounce.stop){this.bounce=null;this.velocityY=0;this.locomotion='walk';this.callbacks.onBounceStop?.();}else this.landBounce();}
        else this.velocityY=0;
      }}
      }
      this.updateBalls(dt);
    }
    this.player.position.copy(this.playerPosition);let angle=this.facing-this.player.rotation.y;angle=Math.atan2(Math.sin(angle),Math.cos(angle));this.player.rotation.y+=angle*Math.min(1,dt*12);
    for (const tutor of this.tutors || []) {
      const wave = tutor.figure?.userData.wave;
      if (wave) wave.rotation.z = (wave.userData.waveZ ?? 0.4) + Math.sin(performance.now() / 420) * 0.08;
      if (tutor.figure?.userData.facePlayer !== false) {
        const face = Math.atan2(this.playerPosition.x - tutor.group.position.x, this.playerPosition.z - tutor.group.position.z);
        tutor.figure.rotation.y = face;
      }
    }
    if(!paused){
      for(const g of this.encounterGroups.values())if(g.userData.animalBody)g.userData.animalBody.position.y=Math.max(0,Math.sin(this.motionTime*2))*.045;
      this.creation.update();
      const swimming=this.locomotion==='swim',bouncing=!!this.bounce,flying=!!this.balloon,stride=this.lastMove?Math.sin(this.motionTime*12):0;
      this.player.rotation.x+=((swimming?WATER_RULES.swimTilt:bouncing?Math.min(.18,this.velocityY*.03):flying?0.04:0)-this.player.rotation.x)*(1-Math.exp(-WATER_RULES.poseRate*dt));
      this.player.userData.feet.forEach((foot,i)=>{const kick=Math.sin(this.motionTime*9+i*Math.PI);foot.position.y=.13+(swimming?kick*.06:flying?0.02:bouncing?.04+Math.max(0,-this.velocityY)*.02:Math.max(0,i?-stride:stride)*.07);foot.position.z=.065+(swimming?kick*.1:flying?0.08:0);});
      this.player.userData.arms.forEach((arm,i)=>{const stroke=Math.sin(this.motionTime*5+i*Math.PI);arm.position.set(i?.38:-.38,flying?0.92:bouncing?1.05:swimming?.78+stroke*.07:.69,flying?0.18:bouncing?.12:swimming?.08+stroke*.23:.05+(i?1:-1)*stride*.09);});
      if(this.bounceMat){this.bounceSquash=Math.max(0,(this.bounceSquash||0)-dt*4);const s=this.bounceSquash;this.bounceMat.scale.y=1-s*.45;this.bounceMat.position.y=this.bounceMat.userData.baseY-s*.04;}
      this.swimRipple.visible=swimming;
      if(swimming){this.swimRipple.position.set(this.playerPosition.x,this.waterState().level+.025,this.playerPosition.z);this.swimRipple.scale.setScalar(1+Math.sin(this.motionTime*5)*.15);}
    }
    this.stepVista(dt, paused);
    if (this.vistaView) {
      const flying = !!this.balloon;
      const clarity = vistaClarity(flying ? this.balloon.height : 0, { flying });
      this.vistaView.update(dt, this.vistaMomentOverride || realMoment(), clarity);
    }
    if (this.bottle?.visible) this.bottle.rotation.y += dt * 0.6;
    this.updateCamera(dt);this.followSky(dt);this.ripples.children.forEach((m,i)=>{m.position.z=-15+i*2+(this.time*.1)%2;});
    this.selectionRing.rotation.z=this.time*.15;
    if (this.selectionPulse > 0) { this.selectionPulse = Math.max(0, this.selectionPulse - dt * 2.4); const s = 1 + Math.sin((1 - this.selectionPulse) * Math.PI) * 0.35; this.selectionRing.scale.setScalar(s); }
    for(const p of this.particles){p.age+=dt;p.v.y-=2*dt;p.mesh.position.addScaledVector(p.v,dt);if(p.age>1){this.scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();}}this.particles=this.particles.filter(p=>p.age<=1);
    this.animateKiln(dt, paused);
    this.storyFrame?.(dt, paused);
    this.renderer.render(this.scene,this.camera);this.positionLabels();if(Math.floor(this.time*5)!==this.lastMapTime){this.lastMapTime=Math.floor(this.time*5);this.drawMinimap();}
    return this.playerPosition;
  }
  resize(){const w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();if(w<600)this.distance=Math.min(this.distance,18);}
  createLabels(onClick){
    this.labelOnClick = onClick;
    const root = document.getElementById('world-labels');
    for (const t of this.targets) {
      if (!t.label || t.labelElement) continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'world-label';
      b.textContent = t.label;
      const lookable = Boolean(t.figureId || t.assemblyId || t.type === 'tutor' || t.type === 'station' || (t.type === 'block' && t.panel));
      b.setAttribute('aria-label', t.ariaLabel || (lookable ? `点一下${t.name}，双击靠近看` : `前往${t.name}`));
      if (lookable) {
        b.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          this.scheduleTap({ target: t, point: t.position, cell: null });
        });
        b.addEventListener('dblclick', event => {
          event.preventDefault();
          event.stopPropagation();
          this.cancelScheduledTap();
          if (this.callbacks.canFocusModel?.() !== false) this.toggleModelFocus({ target: t });
        });
      } else b.addEventListener('click', () => onClick(t));
      b.hidden = true;
      root.appendChild(b);
      t.labelElement = b;
    }
  }
  animateKiln(dt = 0.016, paused = false) {
    const piece = this.kilnPiece;
    const kiln = this.state?.kiln;
    if (!piece || !kiln) return;
    const stage = kiln.stage || 'idle';
    const active = stage !== 'idle';
    piece.visible = active;
    if (!active) {
      this.kilnShown = 0;
      this.kilnCrack.visible = false;
      this.kilnSteam.forEach(puff => { puff.visible = false; });
      this.kilnFlames.forEach(flame => { flame.visible = false; });
      this.kilnGlow.material.emissiveIntensity = 0.12;
      this.kilnGlow.scale.set(0.43, 0.24, 0.02);
      if (this.kilnFireLight) this.kilnFireLight.intensity = 0;
      return;
    }
    const target = Math.min(24, kiln.elapsed || 0);
    this.kilnShown += (target - (this.kilnShown || 0)) * (paused ? 1 : Math.min(1, dt * 3));
    const shown = this.kilnShown;
    const local = (shown % 6) / 6;
    const tones = {
      moistening: ['#6e3d2a', '#8a5640'],
      drying: ['#cbb892', '#efe2c4'],
      firing: ['#ff7a32', '#ffc56a'],
      cooling: ['#e07a48', '#c46548'],
      ready: ['#c46548', '#c46548'],
      failed: ['#d2bfb4', '#d2bfb4'],
    };
    const pair = tones[stage] || tones.ready;
    const color = new THREE.Color(pair[0]).lerp(new THREE.Color(pair[1]), local);
    piece.material.color.copy(color);
    piece.material.emissive.copy(color);
    const firing = stage === 'firing';
    const cooling = stage === 'cooling';
    piece.material.emissiveIntensity = firing ? 0.9 : 0.55;
    const forming = stage === 'moistening' ? local : 1;
    const height = 1.85 - forming * 1;
    piece.scale.set(0.72 + forming * 0.28, height, 0.9);
    const restZ = 0.86;
    const fireZ = 0.74;
    const z = firing ? fireZ : cooling ? fireZ + (restZ - fireZ) * local : restZ;
    const bob = !paused && stage === 'moistening' ? Math.sin(this.time * 3) * 0.018 : 0;
    piece.position.set(0, 0.265 + 0.1 * height + bob, z);
    const crack = stage === 'failed' || (kiln.mode !== 'normal' && cooling && local > 0.4);
    this.kilnCrack.visible = crack;
    this.kilnCrack.position.set(0.06, piece.position.y, piece.position.z + 0.14);
    this.kilnCrack.scale.set(1, Math.max(0.85, height * 0.7), 1);
    const flicker = paused ? 0 : Math.sin(this.time * 9) * 0.35;
    this.kilnGlow.material.emissiveIntensity = firing ? 1.6 + flicker : cooling ? 0.45 : 0.12;
    this.kilnGlow.scale.set(0.43 * (firing ? 1.35 : 1), 0.24 * (firing ? 1.6 : 1), 0.02);
    if (this.kilnFireLight) this.kilnFireLight.intensity = firing ? 2.6 + flicker : cooling ? 0.55 : 0;
    const steam = stage === 'moistening' || stage === 'drying';
    this.kilnSteam.forEach((puff, index) => {
      puff.visible = steam && !paused;
      if (!puff.visible) return;
      const rise = (this.time * 0.28 + index * 0.25) % 1;
      puff.position.set((index - 1.5) * 0.12, piece.position.y + 0.18 + rise * 0.85, piece.position.z + 0.02);
      puff.material.opacity = (1 - rise) * (stage === 'drying' ? 0.82 : 0.5);
      puff.scale.setScalar(0.7 + rise * 1.5);
    });
    this.kilnFlames.forEach((flame, index) => {
      flame.visible = firing;
      if (!firing) return;
      const flick = paused ? 1 : 0.75 + Math.sin(this.time * 12 + index) * 0.28;
      flame.position.set((index - 1) * 0.16, piece.position.y + 0.02 + (paused ? 0 : Math.sin(this.time * 14 + index) * 0.05), piece.position.z + 0.02);
      flame.scale.set(flick * 1.3, 1.7 + (paused ? 0 : Math.sin(this.time * 15 + index) * 0.45), flick);
    });
  }
  positionLabels() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const player = this.playerPosition;
    for (const t of this.targets) {
      if (!t.labelElement) continue;
      const p = t.position.clone();
      p.y += t.type === 'tutor' ? 2.6 : t.type === 'station' ? 2.0 : 1.1;
      p.project(this.camera);
      const x = (p.x + 1) * w / 2, y = (-p.y + 1) * h / 2;
      const onScreen = p.z < 1 && x > 30 && x < w - 30 && y > 95 && y < h - 155;
      const near = this.modelFocus?.id === t.id
        || this.selectedTarget?.id === t.id
        || Math.hypot(t.position.x - player.x, t.position.z - player.z) <= NAME_SHOW_DISTANCE;
      t.labelElement.hidden = !(onScreen && near);
      t.labelElement.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
    }
  }
  drawMinimap(){if(!this.minimap)return;const ctx=this.minimap.getContext('2d'),w=this.minimap.width,h=this.minimap.height,bounds=landBounds(this.state?.land);
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#e8ebdf';ctx.fillRect(4,4,w-8,h-8);
    const point=(x,z)=>[4+(x-bounds.minX)/(bounds.maxX-bounds.minX)*(w-8),4+(z-bounds.minZ)/(bounds.maxZ-bounds.minZ)*(h-8)];
    for(const key of openChunks(this.state?.land)){const [cx,cz]=key.split(',').map(Number),s=LAND_RULES.chunkSize,[x,y]=point(cx*s,cz*s),[x2,y2]=point((cx+1)*s,(cz+1)*s);ctx.fillStyle='#b8c990';ctx.fillRect(x,y,x2-x,y2-y);if(cx===0){const [rx]=point(3,0),[rx2]=point(6,0);ctx.fillStyle='#8ebdc0';ctx.fillRect(rx,y,rx2-rx,y2-y);}}
    ctx.strokeStyle='#e1d3aa';ctx.lineWidth=3;ctx.beginPath();let a=point(-13,2.5),b=point(12,2.5);ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
    for(const t of this.targets){if(t.type==='block')continue;const [x,y]=point(t.position.x,t.position.z);ctx.fillStyle=t.type==='resource'?'#819165':t.id==='garden'?'#637c4b':t.id==='bounce-island'||t.type==='park'?'#7ec8c0':t.type==='balloon'?'#e27a5f':'#b48760';const s=t.type==='park'?1.6:2.3;ctx.beginPath();ctx.roundRect(x-s,y-s,s*2,s*2,1);ctx.fill();}
    for(const b of this.state?.blocks||[]){const [x,y]=point(b.x,b.z);ctx.fillStyle='#b58a55';ctx.fillRect(x-1.7,y-1.7,3.4,3.4);}
    const [px,py]=point(this.playerPosition.x,this.playerPosition.z);ctx.fillStyle='#fff9e5';ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.fill();ctx.fillStyle=C.green;ctx.beginPath();ctx.arc(px,py,3,0,Math.PI*2);ctx.fill();
  }
  ensureDock(blocks) {
    this.dockReady = true;
    const site = chooseDockSite(blocks || []);
    this.dockSite = site;
    if (!site) return;
    const g = new THREE.Group();
    g.position.set(site.x, 0.12, site.z);
    for (let i = -2; i <= 2; i += 1) this.cube(g, 'wood', [0, 0.08, i * 0.62], [1.35, 0.14, 0.55]);
    this.cube(g, 'wood', [-0.62, 0.45, 1.2], [0.14, 0.8, 0.14]);
    this.cube(g, 'wood', [0.62, 0.45, 1.2], [0.14, 0.8, 0.14]);
    this.cube(g, 'wood', [1.15, 0.28, 0], [0.62, 0.24, 1.35], true);
    dockShip(this, g);
    this.scene.add(g);
    this.dockGroup = g;
    this.target(g, { id: 'ferry-dock', type: 'ferry', name: '渡口', label: '去日谷', ariaLabel: '去日谷', action: '去日谷' });
  }
  makeBottle() {
    const bottle = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.55, 8), new THREE.MeshStandardMaterial({ color: '#d5f3f6', transparent: true, opacity: 0.72, roughness: 0.2 }));
    glass.position.y = 0.28;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.18, 8), glass.material);
    neck.position.y = 0.62;
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 8), this.mats.wood);
    cork.position.y = 0.74;
    bottle.add(glass, neck, cork);
    bottle.visible = false;
    this.scene.add(bottle);
    this.bottle = bottle;
    this.bottleTarget = this.target(bottle, { id: 'drift-bottle', type: 'bottle', name: '漂流瓶', label: '漂流瓶', action: '捡起来', hint: '海里漂来的瓶子。捡起来留个纪念，不限时。', keepsake: null });
  }
  placeBottle(state) {
    if (!this.bottle || !this.bottleTarget) return;
    const bottle = activeBottle(state?.clock, state?.travel?.keepsakes);
    if (!bottle) {
      this.bottle.visible = false;
      this.bottleTarget.keepsake = null;
      return;
    }
    this.bottle.visible = true;
    this.bottle.position.set(bottle.x, 0.05, bottle.z);
    this.bottleTarget.position.set(bottle.x, 0.4, bottle.z);
    this.bottleTarget.keepsake = bottle.id;
    this.bottleTarget.name = bottle.name;
  }
  maybeSpotVista() {
    const ride = this.balloon;
    if (!ride || !this.balloonCraft) return;
    if (ride.phase === 'voyage' || ride.phase === 'home' || ride.phase === 'descend') return;
    const height = ride.height || 0;
    if (height < DISCOVER_HEIGHT - 1.5) {
      if (!this.vistaGlance) ride.vistaChecked = false;
      return;
    }
    if (ride.vistaChecked || this.vistaGlance || height < DISCOVER_HEIGHT) return;
    const from = this.balloonCraft.position;
    const id = nearestVista(from, this.state?.travel?.discovered);
    ride.vistaChecked = true;
    if (!id) return;
    const vista = VISTAS[id];
    this.vistaGlance = { id, phase: 'turn', t: 0, fromYaw: this.yaw, toYaw: vistaYaw(from, vista) };
    this.callbacks.onVistaSpot?.(id);
  }
  stepVista(dt, paused) {
    const glance = this.vistaGlance;
    if (!glance || paused) return;
    glance.t += dt;
    if (glance.phase === 'turn') {
      const u = Math.min(1, glance.t / 1.25);
      this.yaw = lerpAngle(glance.fromYaw, glance.toYaw, u * u * (3 - 2 * u));
      if (u >= 1) {
        glance.phase = 'hold';
        glance.t = 0;
        this.callbacks.onVistaReady?.(glance.id);
      }
    } else if (glance.phase === 'zoom' && glance.t >= 3.2) this.completeVistaZoom();
  }
  zoomVista(id) {
    if (!this.balloon || !VISTAS[id]) return false;
    const from = this.balloonCraft?.position || this.playerPosition;
    const yaw = vistaYaw(from, VISTAS[id]);
    if (!this.vistaGlance || this.vistaGlance.id !== id) this.vistaGlance = { id, phase: 'zoom', t: 0, fromYaw: this.yaw, toYaw: yaw };
    else {
      this.vistaGlance.phase = 'zoom';
      this.vistaGlance.t = 0;
      this.vistaGlance.toYaw = yaw;
    }
    this.yaw = this.vistaGlance.toYaw;
    this.callbacks.onVistaZoom?.(id);
    return true;
  }
  completeVistaZoom() {
    const id = this.vistaGlance?.id || null;
    this.vistaGlance = null;
    if (id) this.callbacks.onVistaStamp?.(id);
  }
  dismissVista() {
    const had = !!this.vistaGlance;
    this.vistaGlance = null;
    if (this.balloon) this.balloon.vistaChecked = true;
    if (had) this.callbacks.onVistaHide?.();
  }
  skipVistaZoom() {
    if (this.vistaGlance?.phase === 'zoom') this.completeVistaZoom();
    else this.dismissVista();
  }
  vistaPointer() {
    if (!this.vistaGlance || !this.camera || !this.canvas) return null;
    const vista = VISTAS[this.vistaGlance.id];
    const point = new THREE.Vector3(vista.x, (vista.y || 0) + 8, vista.z);
    point.project(this.camera);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    return { x: (point.x + 1) * w / 2, y: (-point.y + 1) * h / 2, visible: point.z < 1 };
  }
  release() {
    if (this.released) return;
    this.released = true;
    this.vistaView?.dispose();
    this.vistaView = null;
    this.pointerAbort?.abort();
    this.resizeObserver?.disconnect();
    document.getElementById('world-labels')?.replaceChildren();
    const materials = new Set();
    this.scene.traverse((obj) => {
      const list = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
      for (const material of list) materials.add(material);
      if (obj.geometry) obj.geometry.dispose?.();
    });
    for (const material of materials) material.dispose?.();
    this.frontierFillMaterial?.dispose();
    this.frontierLineMaterial?.dispose();
    this.renderer.dispose();
    trackWorldReleased(6);
  }
  dispose() { this.release(); }
}
