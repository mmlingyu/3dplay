/** Beauty valley scene. Loaded only when the child travels here, and released on the way home. */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { balloonLook } from './balloon-data.js';
import { ITEMS } from './game-data.js';
import { GEYSER_NOTE } from './mei-data.js';
import { LOT_SITES } from './mei-lot.js';
import { frameMeiLot, mountMeiLot, syncMeiLot, tickMeiLot } from './mei-lot-view.js';
import { drawSouvenir, spinSouvenirs } from './mei-models.js';
import { REALMS, realmTerrainHeight } from './realm-data.js';
import { realMoment } from './life-data.js';
import { trackListeners, trackWorldCreated, trackWorldReleased } from './scene-stats.js';
import { bindMood } from './avatar-mood.js';

const MEI = REALMS.mei;
const LISTENER_COUNT = 6;

function person(world, parent, { skin = '#f3d2b5', shirt = '#7eb6e0', hair = '#3a2a22', pants = '#3d4c63', scale = 1, extra = null, compact = false, wearer = false }) {
  const g = new THREE.Group();
  g.scale.setScalar(scale);
  world.mesh(g, world.box, world.matColor(pants), [-0.1, 0.34, 0], [0.14, 0.66, 0.14]);
  world.mesh(g, world.box, world.matColor(pants), [0.1, 0.34, 0], [0.14, 0.66, 0.14]);
  const shirtMesh = world.mesh(g, world.box, world.matColor(shirt), [0, 0.92, 0], [0.38, 0.58, 0.2]);
  if (wearer) shirtMesh.userData.wearer = true;
  world.mesh(g, world.head, world.matColor(skin), [0, 1.42, 0], [0.5, 0.5, 0.5]);
  world.mesh(g, world.box, world.matColor(hair), [0, 1.56, 0], [0.28, 0.1, 0.26]);
  world.mesh(g, world.eye, world.mats.dark, [-0.06, 1.44, 0.15], [1, 1, 1]);
  world.mesh(g, world.eye, world.mats.dark, [0.06, 1.44, 0.15], [1, 1, 1]);
  if (compact) g.traverse((obj) => { if (obj.isMesh) obj.userData.compact = true; });
  if (extra) extra(g);
  parent.add(g);
  return g;
}

export class MeiWorld {
  constructor(canvas, callbacks = {}) {
    this.realmId = 'mei';
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.released = false;
    this.state = null;
    this.targets = [];
    this.pickMeshes = [];
    this.buildGroups = new Map();
    this.decorColliders = [];
    this.time = 0;
    this.walkTarget = null;
    this.walkCallback = null;
    this.yaw = 0.2;
    this.distance = 16;
    this.modelFocus = null;
    this.locomotion = 'walk';
    this.balloon = null;
    this.bounce = null;
    this.pool = null;
    this.playerPosition = new THREE.Vector3(MEI.dock.x, MEI.dock.y, MEI.dock.z);
    this.velocityY = 0;
    this.facing = MEI.dock.ry || 0;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#d7e4c8');
    this.scene.fog = new THREE.Fog('#d7e4c8', 28, 64);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(43, 1, 0.1, 140);
    this.lookAt = new THREE.Vector3();
    this.sun = new THREE.DirectionalLight('#fff1d2', 2.4);
    this.sun.position.set(14, 22, 6);
    this.sun.castShadow = true;
    this.scene.add(this.sun, new THREE.HemisphereLight('#f7f3e8', '#8fa36a', 1.7));
    this.box = new THREE.BoxGeometry(1, 1, 1);
    this.head = new THREE.SphereGeometry(0.28, 16, 12);
    this.eye = new THREE.SphereGeometry(0.035, 8, 8);
    this.cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
    this.mats = {};
    this.mats.dark = this.matColor('#243028');
    this.previewMaterial = new THREE.MeshStandardMaterial({ color: '#82c98c', transparent: true, opacity: 0.48, roughness: 0.9, depthWrite: false });
    this.player = new THREE.Group();
    const figure = person(this, this.player, { shirt: '#f2d27a', hair: '#4a3428', scale: 0.92, wearer: true });
    figure.traverse((obj) => { if (obj.userData?.wearer) this.player.userData.shirt = obj; });
    bindMood(this);
    this.scene.add(this.player);
    this.selectionRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.63, 32), new THREE.MeshBasicMaterial({ color: '#fff3be', side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthWrite: false }));
    this.selectionRing.rotation.x = -Math.PI / 2;
    this.selectionRing.visible = false;
    this.scene.add(this.selectionRing);
    this.preview = new THREE.Group();
    this.scene.add(this.preview);
    this.groundMeshes = [];
    this.creation = { snapshot: () => [], actionLabel: () => '', tryOut: () => '' };
    this.markCompact = true;
    this.frameShot = null;
    this.lotNight = false;
    this.buildScenery();
    this.applyQuality(null);
    this.bindPointer();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    trackWorldCreated();
    this.renderer.render(this.scene, this.camera);
  }

  matColor(color) {
    const key = String(color);
    if (!this.mats[key]) this.mats[key] = new THREE.MeshStandardMaterial({ color, roughness: 0.86 });
    return this.mats[key];
  }

  mesh(parent, geometry, material, pos = [0, 0, 0], scale = [1, 1, 1]) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(...pos);
    m.scale.set(...scale);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  cube(parent, color, pos, scale, solid = false) {
    const material = typeof color === 'object' ? color : this.matColor(color);
    const mesh = this.mesh(parent, this.box, material, pos, scale);
    if (solid) mesh.castShadow = true;
    if (this.markCompact) mesh.userData.compact = true;
    return mesh;
  }

  solid(x, z, w, d) {
    this.decorColliders.push({ x, z, width: w, depth: d });
  }

  lotSolids() {
    const s = LOT_SITES;
    this.solid(s.sign.x, s.sign.z, 6.2, 2.2);
    this.solid(s.cinema.x, s.cinema.z - 0.15, 5.2, 3.0);
    this.solid(s.stage.x, s.stage.z, 3.2, 4.0);
    this.solid(s.street.x - 0.2, s.street.z, 1.5, 4.0);
    this.solid(s.western.x + 0.15, s.western.z, 1.4, 3.4);
    this.solid(s.bridge.x - 4.3, s.bridge.z, 0.7, 0.7);
    this.solid(s.bridge.x + 4.3, s.bridge.z, 0.7, 0.7);
    this.solid(s.rabbit.x, s.rabbit.z, 1.1, 1.1);
  }

  compactMarked() {
    this.scene.updateMatrixWorld(true);
    const parts = [];
    const hidden = [];
    this.scene.traverse((obj) => {
      if (!obj.isMesh || obj.userData.compact !== true || obj.geometry !== this.box) return;
      const color = obj.material?.color;
      if (!color) return;
      const geometry = this.box.clone();
      geometry.applyMatrix4(obj.matrixWorld);
      const tint = new THREE.Color(color);
      const count = geometry.getAttribute('position').count;
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i += 1) {
        colors[i * 3] = tint.r;
        colors[i * 3 + 1] = tint.g;
        colors[i * 3 + 2] = tint.b;
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      parts.push(geometry);
      hidden.push(obj);
    });
    if (!parts.length) return;
    const merged = mergeGeometries(parts, false);
    for (const geometry of parts) geometry.dispose();
    if (!merged) return;
    const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 }));
    mesh.userData.live = true;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    for (const obj of hidden) obj.visible = false;
  }

  applyQuality(state) {
    const quality = state?.settings?.quality;
    const fancy = quality === 'pretty' || quality === 'fine' || quality === 'high' || quality === 'beautiful';
    this.renderer.shadowMap.enabled = fancy;
    this.sun.castShadow = fancy;
    this.renderer.setPixelRatio(fancy ? Math.min(window.devicePixelRatio || 1, 1.8) : 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
  }

  drawCalls() {
    return this.renderer.info.render.calls;
  }

  frameLot(id) {
    return frameMeiLot(this, id);
  }

  target(group, data) {
    const obj = { ...data, group, position: group.position.clone() };
    this.targets.push(obj);
    group.traverse((m) => {
      if (m.isMesh) {
        m.userData.targetId = data.id;
        this.pickMeshes.push(m);
      }
    });
    return obj;
  }

  buildScenery() {
    const bounds = MEI.bounds;
    const cols = bounds.maxX - bounds.minX + 1;
    const rows = bounds.maxZ - bounds.minZ + 1;
    const land = new THREE.InstancedMesh(this.box, this.matColor('#b7c98a'), cols * rows);
    const matrix = new THREE.Matrix4();
    let n = 0;
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      for (let z = bounds.minZ; z <= bounds.maxZ; z += 1) {
        const y = realmTerrainHeight('mei', x);
        matrix.makeTranslation(x, y - 0.9, z);
        land.setMatrixAt(n, matrix);
        n += 1;
      }
    }
    land.receiveShadow = true;
    this.scene.add(land);
    this.groundMeshes.push(land);
    const visitor = MEI.visitor;
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(visitor.maxX - visitor.minX + 1, visitor.maxZ - visitor.minZ + 1), this.matColor('#efe2b8'));
    yard.rotation.x = -Math.PI / 2;
    yard.position.set((visitor.minX + visitor.maxX) / 2, 0.03, (visitor.minZ + visitor.maxZ) / 2);
    this.scene.add(yard);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(2.2, bounds.maxZ - bounds.minZ), this.matColor('#8ebdc0'));
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.35, (bounds.minZ + bounds.maxZ) / 2);
    this.scene.add(water);
    this.logCabin();
    this.redBarn();
    this.coveredBridge();
    this.farmWindmill();
    this.geyser();
    this.rangerCabin();
    this.library();
    this.sugarShack();
    this.bikeShop();
    this.grove(MEI.sites.maple, '#c45d3a', '枫树林', 'maple-sap', '采树汁');
    this.grove(MEI.sites.logs, '#8d5a3c', '原木堆', 'log', '采原木');
    this.grove(MEI.sites.pumpkin, '#e07a2f', '南瓜地', 'pumpkin', '采南瓜');
    this.grove(MEI.sites.cloth, '#c45d6a', '旧衣回收箱', 'cloth', '拿布头');
    this.grove(MEI.sites.paper, '#f7f3ea', '纸架', 'paper', '拿纸');
    this.grove(MEI.sites.branch, '#8e6749', '树枝堆', 'branch', '捡树枝');
    this.port();
    this.balloonLawn();
    this.boardSign();
    this.letter();
    this.npc(MEI.sites.maya, 'maya', 'Maya', { skin: '#c48a62', shirt: '#f2c14e', hair: '#2a211c', pants: '#3d4c63', scale: 0.84 });
    this.npc(MEI.sites.will, 'will', 'Will', { skin: '#f0c9a0', shirt: '#7ea0c4', hair: '#6b4a32', pants: '#4d5d73', scale: 0.9 });
    this.npc(MEI.sites.orv, 'orv', 'Orv', { skin: '#8d5a3c', shirt: '#e07a4a', hair: '#1c1410', pants: '#3d4c63', scale: 0.88 });
    this.npc(MEI.sites.rivera, 'rivera', 'Rivera', { skin: '#d7a574', shirt: '#6f8f9a', hair: '#3a2a28', pants: '#4a403c', scale: 1.02 });
    this.npc(MEI.sites.joe, 'joe', 'Joe', { skin: '#e6c2a2', shirt: '#7a8f62', hair: '#d9dde2', pants: '#5c5348', scale: 1.05, bucket: true });
    mountMeiLot(this);
    this.lotSolids();
    this.compactMarked();
  }

  place(site, group, id, name, type, action, extra = {}) {
    group.position.set(site.x, 0, site.z);
    this.scene.add(group);
    this.solid(site.x, site.z, extra.w || 2.2, extra.d || 2.2);
    this.target(group, { id, type, name, label: extra.label || name, ariaLabel: extra.aria || name, action, ...extra, position: group.position });
  }

  logCabin() {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i += 1) {
      const y = 0.28 + i * 0.28;
      this.cube(g, i % 2 ? '#a56b42' : '#8d5a3c', [0, y, 0], [2.4, 0.22, 0.28], true);
      this.cube(g, i % 2 ? '#8d5a3c' : '#a56b42', [0, y, 0], [0.28, 0.22, 2.4], true);
    }
    this.cube(g, '#c98063', [0, 1.55, 0], [2.6, 0.16, 2.6], true);
    this.cube(g, '#efe2c4', [0, 0.7, 1.05], [0.46, 0.7, 0.08], true);
    this.place(MEI.sites.cabin, g, 'mei-cabin', '原木小屋', 'scenery', '看看');
  }

  redBarn() {
    const g = new THREE.Group();
    this.cube(g, '#b94a3a', [0, 0.9, 0], [2.6, 1.7, 2.2], true);
    this.cube(g, '#f4efe4', [0, 1.7, 0], [2.8, 0.12, 2.4], true);
    this.cube(g, '#8d3a2e', [0, 2.15, 0], [1.6, 0.7, 2.4], true);
    this.cube(g, '#f4efe4', [-0.28, 0.55, 1.12], [0.42, 0.9, 0.06], true);
    this.cube(g, '#f4efe4', [0.28, 0.55, 1.12], [0.42, 0.9, 0.06], true);
    this.place(MEI.sites.barn, g, 'mei-barn', '红色谷仓', 'scenery', '看看');
  }

  coveredBridge() {
    const g = new THREE.Group();
    g.position.set(0, 0, MEI.sites.bridge.z);
    this.cube(g, '#b97944', [0, 0.35, 0], [1.5, 0.16, 3.2], true);
    this.cube(g, '#8d5a3c', [-0.7, 0.9, 0], [0.12, 1.1, 3.1], true);
    this.cube(g, '#8d5a3c', [0.7, 0.9, 0], [0.12, 1.1, 3.1], true);
    this.cube(g, '#c98063', [0, 1.5, 0], [1.8, 0.14, 3.3], true);
    this.scene.add(g);
    this.target(g, { id: 'mei-bridge', type: 'scenery', name: '廊桥', label: '廊桥', action: '看看', position: g.position });
  }

  farmWindmill() {
    const g = new THREE.Group();
    this.cube(g, '#efe2c4', [0, 1.1, 0], [0.7, 2.2, 0.7], true);
    this.cube(g, '#8d5a3c', [0, 2.3, 0.4], [0.2, 0.2, 0.2], true);
    const blades = new THREE.Group();
    blades.position.set(0, 2.3, 0.55);
    this.markCompact = false;
    this.cube(blades, '#d7c48a', [0, 0, 0], [0.16, 1.8, 0.08], true);
    this.cube(blades, '#d7c48a', [0, 0, 0], [1.8, 0.16, 0.08], true);
    this.markCompact = true;
    g.add(blades);
    this.windBlades = blades;
    this.place(MEI.sites.windmill, g, 'mei-windmill', '抽水风车', 'scenery', '看看', { w: 1.6, d: 1.6 });
  }

  geyser() {
    const g = new THREE.Group();
    this.cube(g, '#9aa7a4', [0, 0.12, 0], [1.6, 0.16, 1.6], true);
    this.cube(g, '#8ebdc0', [0, 0.22, 0], [0.8, 0.08, 0.8], true);
    const sprayMat = new THREE.MeshStandardMaterial({ color: '#d5f3f6', transparent: true, opacity: 0.72, roughness: 0.35 });
    this.markCompact = false;
    const spray = this.cube(g, sprayMat, [0, 0.8, 0], [0.28, 0.8, 0.28], true);
    this.markCompact = true;
    this.geyserSpray = spray;
    this.place(MEI.sites.geyser, g, 'mei-geyser', '间歇泉', 'scenery', '看看', { label: '间歇泉', aria: `间歇泉。${GEYSER_NOTE}` });
  }

  rangerCabin() {
    const g = new THREE.Group();
    this.cube(g, '#6f8f55', [0, 0.7, 0], [1.6, 1.2, 1.4], true);
    this.cube(g, '#5d5348', [0, 1.45, 0], [1.8, 0.16, 1.6], true);
    this.cube(g, '#efe2c4', [0, 0.55, 0.72], [0.4, 0.7, 0.06], true);
    this.place(MEI.sites.ranger, g, 'mei-ranger', '守护员小屋', 'scenery', '看看', { w: 1.8, d: 1.6 });
  }

  library() {
    const g = new THREE.Group();
    this.cube(g, '#efe6d4', [0, 0.9, 0], [2.4, 1.6, 1.8], true);
    this.cube(g, '#7ea0c4', [0, 1.9, 0], [2.6, 0.16, 2], true);
    this.cube(g, '#6a90c0', [-0.55, 0.9, 0.92], [0.4, 0.5, 0.06], true);
    this.cube(g, '#6a90c0', [0.55, 0.9, 0.92], [0.4, 0.5, 0.06], true);
    this.cube(g, '#8f6238', [0, 0.45, 0.92], [0.46, 0.7, 0.06], true);
    this.place(MEI.sites.library, g, 'mei-library', '小镇图书馆', 'scenery', '看看');
  }

  sugarShack() {
    const g = new THREE.Group();
    this.cube(g, '#c4a574', [0, 0.7, 0], [1.8, 1.2, 1.5], true);
    this.cube(g, '#8d5a3c', [0, 1.45, 0], [2, 0.14, 1.7], true);
    this.cube(g, '#6d5344', [0.7, 1.5, 0], [0.28, 0.7, 0.28], true);
    this.place(MEI.sites.sugar, g, 'mei-sugar', '枫糖小屋', 'maple', '熬枫糖', { aria: '熬枫糖', label: '熬枫糖' });
  }

  bikeShop() {
    const g = new THREE.Group();
    this.cube(g, '#d9c7a4', [0, 0.7, 0], [2.2, 1.3, 1.5], true);
    this.cube(g, '#7ea0c4', [0, 1.5, 0], [2.4, 0.12, 1.7], true);
    this.cube(g, '#4d5d73', [-0.45, 0.35, 0.8], [0.7, 0.08, 0.08], true);
    this.cube(g, '#4d5d73', [0.15, 0.35, 0.8], [0.08, 0.4, 0.08], true);
    this.cube(g, '#4d5d73', [0.75, 0.35, 0.8], [0.08, 0.4, 0.08], true);
    this.place(MEI.sites.shop, g, 'mei-shop', '自行车铺', 'scenery', '看看');
  }

  grove(site, color, name, item, action) {
    const g = new THREE.Group();
    for (const [x, z] of [[-0.45, -0.2], [0.4, 0.15], [0, 0.45]]) {
      this.cube(g, '#6b4a32', [x, 0.35, z], [0.16, 0.7, 0.16], true);
      this.cube(g, color, [x, 0.9, z], [0.55, 0.45, 0.55], true);
    }
    this.place(site, g, `res-${item}`, name, 'resource', action, { item, label: name, aria: action, w: 1.8, d: 1.8 });
  }

  port() {
    const g = new THREE.Group();
    for (let i = -2; i <= 2; i += 1) this.cube(g, '#b97944', [0, 0.12, i * 0.55], [1.4, 0.12, 0.48], true);
    this.cube(g, '#6d5344', [1.5, 0.28, 0], [0.9, 0.36, 2.6], true);
    this.cube(g, '#efe2c4', [1.5, 0.62, -0.4], [0.7, 0.36, 0.9], true);
    this.cube(g, '#8d5a3c', [1.5, 1.05, -0.4], [0.08, 0.5, 0.08], true);
    this.place(MEI.sites.port, g, 'mei-port', '美谷港口', 'ferry', '回家', { label: '回家', aria: '回家', w: 2.4, d: 2.4 });
  }

  balloonLawn() {
    const g = new THREE.Group();
    this.cube(g, '#cfe0a8', [0, 0.04, 0], [3.2, 0.06, 3.2], true);
    this.cube(g, '#e27a5f', [0, 1.3, 0], [1.1, 1.3, 1.1], true);
    this.cube(g, '#8d5a3c', [0, 0.35, 0], [0.7, 0.4, 0.7], true);
    this.place(MEI.sites ? MEI.lawn : MEI.lawn, g, 'mei-lawn', '热气球草坪', 'balloon', '看看', { w: 3, d: 3, label: '热气球' });
    g.position.set(MEI.lawn.x, 0, MEI.lawn.z);
  }

  boardSign() {
    const g = new THREE.Group();
    this.cube(g, '#efe6d4', [0, 0.8, 0], [1.3, 0.9, 0.12], true);
    this.cube(g, '#8d5a3c', [-0.5, 0.4, 0], [0.1, 0.8, 0.1], true);
    this.cube(g, '#8d5a3c', [0.5, 0.4, 0], [0.1, 0.8, 0.1], true);
    this.place(MEI.sites.board, g, 'mei-board', '项目板', 'project', '做项目', { label: '项目板', aria: '项目板', w: 1.4, d: 0.6 });
  }

  letter() {
    const g = new THREE.Group();
    this.cube(g, '#f7f3ea', [0, 0.35, 0], [0.7, 0.08, 0.28], true);
    this.place({ x: 4, z: 8 }, g, 'mei-letter', '纸飞机来信', 'letter', '看信', { label: '看信', aria: '看信', w: 0.8, d: 0.6 });
  }

  npc(site, id, name, look) {
    const g = new THREE.Group();
    person(this, g, { ...look, compact: true });
    this.markCompact = false;
    if (look.bucket) this.cube(g, '#c4a574', [0.42, 0.7, 0.1], [0.22, 0.24, 0.2], true);
    this.markCompact = true;
    g.position.set(site.x, 0, site.z);
    this.scene.add(g);
    this.target(g, { id: `tutor-${id}`, type: 'tutor', tutorId: id, name, label: name, ariaLabel: name, action: '说说话', position: g.position });
  }

  bindPointer() {
    this.pointerAbort = new AbortController();
    const signal = this.pointerAbort.signal;
    const gesture = this.pointerGesture = { start: null, dragged: false };
    this.canvas.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      gesture.start = { x: event.clientX, y: event.clientY };
      gesture.dragged = false;
    }, { signal });
    this.canvas.addEventListener('pointermove', (event) => {
      if (!gesture.start) return;
      if (Math.hypot(event.clientX - gesture.start.x, event.clientY - gesture.start.y) > 9) {
        gesture.dragged = true;
        this.yaw -= event.movementX * 0.005;
      }
    }, { signal });
    this.canvas.addEventListener('pointerup', (event) => {
      if (gesture.start && !gesture.dragged) {
        const pick = this.pick(event.clientX, event.clientY);
        if (pick) this.callbacks.onTap?.(pick);
      }
      gesture.start = null;
    }, { signal });
    this.canvas.addEventListener('pointercancel', () => { gesture.start = null; }, { signal });
    this.canvas.addEventListener('dblclick', (event) => {
      const pick = this.pick(event.clientX, event.clientY);
      if (pick) this.callbacks.onQuickPlace?.(pick);
    }, { signal });
    this.canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      this.distance = Math.min(28, Math.max(10, this.distance + event.deltaY * 0.01));
    }, { passive: false, signal });
    trackListeners(LISTENER_COUNT);
  }

  pick(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(pointer, this.camera);
    const hits = ray.intersectObjects([...this.pickMeshes, ...this.groundMeshes], false);
    if (!hits.length) return null;
    const hit = hits[0];
    const target = this.targets.find((item) => item.id === hit.object.userData.targetId) || null;
    const cell = {
      x: Math.round(hit.point.x),
      z: Math.round(hit.point.z),
      y: realmTerrainHeight('mei', Math.round(hit.point.x)),
    };
    return { target, point: hit.point, cell };
  }

  surfaceAt(x, z) {
    let h = realmTerrainHeight('mei', x);
    if (Math.hypot(x - MEI.dock.x, z - MEI.dock.z) <= 2.2) h = Math.max(h, 0.28);
    if (Math.abs(x) <= 1.2 && Math.abs(z - MEI.sites.bridge.z) <= 1.6) h = Math.max(h, 0.48);
    if (Math.hypot(x - MEI.lawn.x, z - MEI.lawn.z) <= MEI.balloon.radius) h = Math.max(h, 0.08);
    return h;
  }

  blocked(x, z) {
    if (x < MEI.bounds.minX + 0.4 || x > MEI.bounds.maxX - 0.4 || z < MEI.bounds.minZ + 0.4 || z > MEI.bounds.maxZ - 0.4) return true;
    const onDock = Math.hypot(x - MEI.dock.x, z - MEI.dock.z) <= 2.2;
    const onBridge = Math.abs(z - MEI.sites.bridge.z) <= 1.5 && Math.abs(x) <= 0.9;
    if (x >= MEI.stream.minX && x <= MEI.stream.maxX && !onDock && !onBridge) return true;
    return this.decorColliders.some((c) => Math.abs(x - c.x) < c.width / 2 && Math.abs(z - c.z) < c.depth / 2);
  }

  canMove(x, z) { return !this.blocked(x, z); }

  sync(state) {
    if (!state || state.travel?.current !== 'mei') return;
    const spot = state.travel.realms?.mei;
    if (!spot) return;
    const first = this.state !== state;
    this.state = state;
    this.applyLook?.(state.look);
    if (first && spot.player) this.playerPosition.set(spot.player.x, spot.player.y || 0, spot.player.z);
    const ids = new Set((spot.blocks || []).map((block) => block.id));
    for (const [id, group] of this.buildGroups) {
      if (!ids.has(id)) {
        this.scene.remove(group);
        this.buildGroups.delete(id);
        this.targets = this.targets.filter((item) => item.id !== id);
      }
    }
    for (const block of spot.blocks || []) {
      const sig = `${block.item}:${block.x}:${block.y}:${block.z}`;
      if (this.buildGroups.get(block.id)?.userData.sig === sig) continue;
      const old = this.buildGroups.get(block.id);
      if (old) this.scene.remove(old);
      const group = this.blockModel(block);
      group.userData.sig = sig;
      this.scene.add(group);
      this.buildGroups.set(block.id, group);
      this.target(group, { id: block.id, type: 'block', item: block.item, name: ITEMS[block.item]?.name || block.item, action: '看看方块', block, position: group.position });
    }
    this.applyQuality(state);
    syncMeiLot(this, state);
  }

  blockModel(block) {
    const g = new THREE.Group();
    g.position.set(block.x, (block.y || 0) + 0.02, block.z);
    if (!drawSouvenir(this, g, block, false)) this.cube(g, ITEMS[block.item]?.color || '#d7c48a', [0, 0.5, 0], [0.96, 0.96, 0.96], true);
    return g;
  }

  beginArrivalDescend() {
    this.balloon = { phase: 'descend', t: 0 };
    this.playerPosition.set(MEI.lawn.x, MEI.balloon.cruiseHeight, MEI.lawn.z);
    this.locomotion = 'balloon';
  }

  update(dt, input = {}, paused = false) {
    if (this.released) return this.playerPosition;
    this.time += dt;
    if (this.windBlades && !paused) {
      const wind = realMoment().weather.kind === 'wind';
      this.windBlades.rotation.z += dt * (wind ? 1.8 : 0.15);
    }
    if (!paused) spinSouvenirs(this, dt);
    if (this.geyserSpray) {
      const puff = (Math.sin(this.time * 1.3) + 1) / 2;
      this.geyserSpray.scale.set(0.28 + puff * 0.2, 0.4 + puff * 1.3, 0.28 + puff * 0.2);
      this.geyserSpray.position.y = 0.55 + puff * 0.7;
    }
    let mx = input.x || 0;
    let mz = input.z || 0;
    if (!paused && this.balloon?.phase === 'descend') {
      this.balloon.t += dt;
      const u = Math.min(1, this.balloon.t / MEI.balloon.descendSeconds);
      this.playerPosition.set(MEI.lawn.x, MEI.balloon.cruiseHeight * (1 - u), MEI.lawn.z);
      if (u >= 1) {
        this.balloon = null;
        this.locomotion = 'walk';
        this.playerPosition.y = this.surfaceAt(MEI.lawn.x, MEI.lawn.z);
        this.callbacks.onBalloonStop?.();
      }
    } else if (!paused) {
      if (mx || mz) this.stopWalking();
      if (this.walkTarget) {
        const dx = this.walkTarget.x - this.playerPosition.x;
        const dz = this.walkTarget.z - this.playerPosition.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 2.4 && this.walkCallback) {
          const cb = this.walkCallback;
          this.stopWalking();
          cb();
        } else if (dist < 0.15) this.stopWalking();
        else {
          const c = Math.cos(this.yaw);
          const s = Math.sin(this.yaw);
          mx = (dx * c - dz * s) / dist;
          mz = (dx * s + dz * c) / dist;
        }
      }
      const length = Math.hypot(mx, mz);
      if (length > 1) { mx /= length; mz /= length; }
      const wx = mx * Math.cos(this.yaw) + mz * Math.sin(this.yaw);
      const wz = -mx * Math.sin(this.yaw) + mz * Math.cos(this.yaw);
      const nx = this.playerPosition.x + wx * 3.15 * dt;
      const nz = this.playerPosition.z + wz * 3.15 * dt;
      if (this.canMove(nx, this.playerPosition.z)) this.playerPosition.x = nx;
      if (this.canMove(this.playerPosition.x, nz)) this.playerPosition.z = nz;
      if (Math.hypot(wx, wz) > 0.05) this.facing = Math.atan2(wx, wz);
      this.playerPosition.y = this.surfaceAt(this.playerPosition.x, this.playerPosition.z);
    }
    this.player.position.copy(this.playerPosition);
    this.player.rotation.y = this.facing;
    tickMeiLot(this, paused ? 0 : dt);
    if (this.frameShot) {
      const shot = this.frameShot;
      this.yaw = shot.yaw;
      this.distance = shot.distance;
      const center = new THREE.Vector3(shot.x, shot.y, shot.z);
      this.lookAt.copy(center);
      const offset = new THREE.Vector3(Math.sin(shot.yaw) * shot.distance, shot.distance * 0.55, Math.cos(shot.yaw) * shot.distance);
      this.camera.position.copy(center).add(offset);
      this.camera.lookAt(center);
    } else {
      const center = this.playerPosition.clone();
      center.y += 0.8;
      this.lookAt.lerp(center, 1 - Math.exp(-3 * dt));
      const v = new THREE.Vector3(Math.sin(this.yaw) * this.distance, this.distance * 0.72, Math.cos(this.yaw) * this.distance);
      this.camera.position.lerp(this.lookAt.clone().add(v), 1 - Math.exp(-5 * dt));
      this.camera.lookAt(this.lookAt);
    }
    if (!paused) this.stepMoodScale?.(dt);
    if (!this.holdPaint) this.renderer.render(this.scene, this.camera);
    this.positionLabels();
    return this.playerPosition;
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  createLabels(onClick) {
    this.labelOnClick = onClick;
    const root = document.getElementById('world-labels');
    if (!root) return;
    for (const item of this.targets) {
      if (!item.label || item.labelElement) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'world-label';
      button.textContent = item.label;
      button.setAttribute('aria-label', item.ariaLabel || item.label);
      button.addEventListener('click', () => onClick(item));
      button.hidden = true;
      root.appendChild(button);
      item.labelElement = button;
    }
  }

  positionLabels() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    for (const item of this.targets) {
      if (!item.labelElement) continue;
      if (item.hidden) { item.labelElement.hidden = true; continue; }
      const p = item.position.clone();
      p.y += 1.8;
      p.project(this.camera);
      const x = (p.x + 1) * w / 2;
      const y = (-p.y + 1) * h / 2;
      const near = Math.hypot(item.position.x - this.playerPosition.x, item.position.z - this.playerPosition.z) <= 4.8;
      item.labelElement.hidden = !(p.z < 1 && near);
      item.labelElement.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
    }
  }

  nearestTarget(max = 3) {
    let best = null;
    let dist = max;
    for (const item of this.targets) {
      if (item.hidden) continue;
      const d = this.distanceTo(item);
      if (d < dist) { best = item; dist = d; }
    }
    return best;
  }

  distanceTo(target) {
    return Math.hypot(target.position.x - this.playerPosition.x, target.position.z - this.playerPosition.z);
  }

  walkTo(point, cb = null) {
    if (!point) return;
    this.walkTarget = { x: point.x, z: point.z ?? point.y };
    this.walkCallback = cb;
  }

  stopWalking() {
    this.walkTarget = null;
    this.walkCallback = null;
  }

  select(target) {
    this.selectedTarget = target;
    this.selectionRing.visible = !!target;
    if (target) this.selectionRing.position.set(target.position.x, 0.05, target.position.z);
  }

  setPreview(item, rotation, cell, valid = true) {
    this.preview.clear();
    this.previewMaterial.color.set(valid ? '#82c98c' : '#e58471');
    if (!cell) return;
    const ghost = this.blockModel({ ...cell, item, rotation });
    ghost.traverse((m) => { if (m.isMesh) m.material = this.previewMaterial; });
    this.preview.add(ghost);
  }

  celebrate() {}
  jump() { this.velocityY = 4; }
  cancelPointerGesture() { if (this.pointerGesture) this.pointerGesture.start = null; }
  serializeBalls() { return []; }
  setFrontier() {}
  requestBalloonLand() { return false; }
  startBalloon() { return false; }
  releaseBall() { return false; }
  recallBall() { return false; }
  setParkMode() {}
  stopBounce() {}
  bounceLook() { return null; }
  setBalloonMode() { return false; }
  setBalloonClimb() { return false; }
  balloonLook() { return balloonLook(this.balloon?.phase || 'idle', 0, 'orbit', 'mei'); }
  toggleModelFocus() { return false; }
  cancelScheduledTap() {}
  forwardCell() {
    return {
      x: Math.round(this.playerPosition.x + Math.sin(this.facing) * 1.4),
      z: Math.round(this.playerPosition.z + Math.cos(this.facing) * 1.4),
      y: 0,
    };
  }

  release() {
    if (this.released) return;
    this.released = true;
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
    this.renderer.dispose();
    trackWorldReleased(LISTENER_COUNT);
  }

  dispose() { this.release(); }
}
