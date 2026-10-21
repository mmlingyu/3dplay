import * as THREE from 'three';
import { ITEMS } from './game-data.js';
import { REALMS, realmTerrainHeight } from './realm-data.js';
import { BALLOON_CONTROL, balloonLook } from './balloon-data.js';
import { trackListeners, trackWorldCreated, trackWorldReleased } from './scene-stats.js';

const RI = REALMS.ri;
const LISTENER_COUNT = 6;

function person(world, parent, { shirt = '#7eb6e0', hair = '#3a2a22', scale = 1, apron = null, scarf = null }) {
  const g = new THREE.Group();
  g.scale.setScalar(scale);
  world.mesh(g, world.head, world.skin, [0, 1.45, 0]);
  world.mesh(g, world.box, world.matColor(shirt), [0, 0.92, 0], [0.46, 0.52, 0.28]);
  world.mesh(g, world.box, world.matColor(hair), [0, 1.62, 0], [0.5, 0.22, 0.48]);
  world.mesh(g, world.eye, world.mats.dark, [-0.1, 1.48, 0.16], [1, 1, 1]);
  world.mesh(g, world.eye, world.mats.dark, [0.1, 1.48, 0.16], [1, 1, 1]);
  world.mesh(g, world.box, world.matColor('#3d4c63'), [-0.12, 0.42, 0], [0.16, 0.42, 0.16]);
  world.mesh(g, world.box, world.matColor('#3d4c63'), [0.12, 0.42, 0], [0.16, 0.42, 0.16]);
  if (apron) world.mesh(g, world.box, world.matColor(apron), [0, 0.78, 0.12], [0.4, 0.36, 0.08]);
  if (scarf) world.mesh(g, world.box, world.matColor(scarf), [0, 1.2, 0.08], [0.42, 0.12, 0.32]);
  parent.add(g);
  return g;
}

export class RiWorld {
  constructor(canvas, callbacks = {}) {
    this.realmId = 'ri';
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
    this.yaw = 0.4;
    this.distance = 16;
    this.modelFocus = null;
    this.locomotion = 'walk';
    this.balloon = null;
    this.bounce = null;
    this.pool = null;
    this.playerPosition = new THREE.Vector3(RI.dock.x, RI.dock.y, RI.dock.z);
    this.velocityY = 0;
    this.facing = RI.dock.ry || 0;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#f3e7cf');
    this.scene.fog = new THREE.Fog('#f3e7cf', 28, 62);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    this.renderer.shadowMap.enabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(43, 1, 0.1, 140);
    this.lookAt = new THREE.Vector3();
    this.sun = new THREE.DirectionalLight('#fff1d2', 2.4);
    this.sun.position.set(12, 22, 8);
    this.sun.castShadow = true;
    this.scene.add(this.sun, new THREE.HemisphereLight('#f7f3e8', '#b7a48a', 1.8));
    this.box = new THREE.BoxGeometry(1, 1, 1);
    this.head = new THREE.SphereGeometry(0.28, 16, 12);
    this.eye = new THREE.SphereGeometry(0.035, 8, 8);
    this.cyl = new THREE.CylinderGeometry(1, 1, 1, 8);
    this.mats = {};
    this.skin = this.matColor('#f3d2b5');
    this.mats.dark = this.matColor('#243028');
    this.previewMaterial = new THREE.MeshStandardMaterial({ color: '#fff0ae', transparent: true, opacity: 0.46, roughness: 0.9, depthWrite: false });
    this.player = new THREE.Group();
    person(this, this.player, { shirt: '#f2d27a', hair: '#4a3428', scale: 0.92 });
    this.scene.add(this.player);
    this.selectionRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.63, 32), new THREE.MeshBasicMaterial({ color: '#fff3be', side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthWrite: false }));
    this.selectionRing.rotation.x = -Math.PI / 2;
    this.selectionRing.visible = false;
    this.scene.add(this.selectionRing);
    this.preview = new THREE.Group();
    this.scene.add(this.preview);
    this.groundMeshes = [];
    this.buildScenery();
    this.creation = { snapshot: () => [], actionLabel: () => '', tryOut: () => '' };
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

  cube(parent, color, pos, scale) {
    return this.mesh(parent, this.box, typeof color === 'string' && this.mats[color] ? this.mats[color] : this.matColor(color), pos, scale);
  }

  solid(x, z, w, d) {
    this.decorColliders.push({ x, z, width: w, depth: d });
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
    const bounds = RI.bounds;
    const grass = this.matColor('#d7c48a');
    const yard = this.matColor('#efe2b8');
    const cols = bounds.maxX - bounds.minX + 1;
    const rows = bounds.maxZ - bounds.minZ + 1;
    const land = new THREE.InstancedMesh(this.box, [this.matColor('#c4b089'), this.matColor('#c4b089'), grass, this.matColor('#c4b089'), this.matColor('#c4b089'), this.matColor('#c4b089')], cols * rows);
    const matrix = new THREE.Matrix4();
    let n = 0;
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      for (let z = bounds.minZ; z <= bounds.maxZ; z += 1) {
        const y = realmTerrainHeight('ri', x);
        matrix.makeTranslation(x, y - 0.9, z);
        land.setMatrixAt(n, matrix);
        n += 1;
      }
    }
    land.receiveShadow = true;
    this.scene.add(land);
    this.groundMeshes.push(land);
    const visitor = RI.visitor;
    const yardMesh = new THREE.Mesh(new THREE.PlaneGeometry(visitor.maxX - visitor.minX + 1, visitor.maxZ - visitor.minZ + 1), yard);
    yardMesh.rotation.x = -Math.PI / 2;
    yardMesh.position.set((visitor.minX + visitor.maxX) / 2, 0.02, (visitor.minZ + visitor.maxZ) / 2);
    yardMesh.receiveShadow = true;
    this.scene.add(yardMesh);
    this.groundMeshes.push(yardMesh);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(2.2, bounds.maxZ - bounds.minZ), this.matColor('#8ebdc0'));
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.35, (bounds.minZ + bounds.maxZ) / 2);
    this.scene.add(water);

    this.placeBuilding(RI.sites.workshop, '纸坊', this.machiya());
    this.placeBuilding(RI.sites.gassho, '合掌大屋', this.gassho());
    this.grove(RI.sites.kozo, '#6f8f55', '楮树林', 'kozo', '采楮皮');
    this.grove(RI.sites.bamboo, '#7ea35a', '竹林', 'bamboo', '采竹子', 0.12);
    this.drumBridge();
    this.flagPole();
    this.balloonLawn();
    this.dock();
    this.mailbox();
    this.npc(RI.sites.koharu, 'koharu', '小春', '#7eb6e0', '#4a3428', 0.82, null);
    this.npc(RI.sites.elder, 'kozo-elder', '楮叶奶奶', '#d8d2c8', '#d9dde2', 0.98, '#c47a60');
    this.animal(RI.sites.ponta);
  }

  placeBuilding(site, name, group) {
    group.position.set(site.x, 0, site.z);
    this.scene.add(group);
    this.solid(site.x, site.z, 2.1, 2.1);
    this.target(group, { id: `scenery-${name}`, type: 'scenery', name, label: name, action: '看看', position: group.position });
  }

  machiya() {
    const g = new THREE.Group();
    this.cube(g, '#8d6244', [0, 1.1, 0], [3.1, 2.2, 2.6]);
    this.cube(g, '#f4efe4', [0, 1.15, 1.32], [2.2, 1.5, 0.08]);
    for (const x of [-0.7, 0, 0.7]) this.cube(g, '#5c4030', [x, 1.15, 1.36], [0.06, 1.5, 0.04]);
    this.cube(g, '#6e4e38', [0, 2.45, 0], [3.4, 0.28, 3]);
    this.cube(g, '#5a3e2e', [0, 2.7, 0], [2.4, 0.2, 2.2]);
    return g;
  }

  gassho() {
    const g = new THREE.Group();
    this.cube(g, '#b08968', [0, 0.7, 0], [2.8, 1.4, 2.2]);
    this.cube(g, '#c4b48a', [-0.7, 2.2, 0], [0.12, 2.2, 2.4]);
    this.cube(g, '#c4b48a', [0.7, 2.2, 0], [0.12, 2.2, 2.4]);
    this.cube(g, '#d9cba6', [0, 3.3, 0], [0.2, 0.5, 2.5]);
    this.cube(g, '#b7a37a', [-0.55, 2.3, 0], [1.3, 0.18, 2.6]);
    this.cube(g, '#b7a37a', [0.55, 2.3, 0], [1.3, 0.18, 2.6]);
    return g;
  }

  grove(site, color, name, item, action, thin = 0.28) {
    const g = new THREE.Group();
    g.position.set(site.x, 0, site.z);
    for (const [x, z] of [[-0.8, -0.4], [0.6, 0.2], [0, 0.9], [-0.3, -1]]) {
      this.mesh(g, this.cyl, this.matColor(color), [x, 1.1, z], [thin, 2.2, thin]);
      if (item === 'kozo') this.mesh(g, this.head, this.matColor('#6f8f55'), [x, 2.2, z], [1.1, 0.8, 1.1]);
    }
    this.scene.add(g);
    this.target(g, { id: `grove-${item}`, type: 'resource', item, name, label: name, action, position: g.position });
  }

  drumBridge() {
    const site = RI.sites.bridge;
    const g = new THREE.Group();
    g.position.set(site.x, 0, site.z);
    for (let i = -3; i <= 3; i += 1) {
      const arch = Math.cos((i / 3) * 1.1) * 0.85;
      this.cube(g, '#c47a60', [0, 0.35 + arch * 0.35, i * 0.42], [1.5, 0.22, 0.4]);
    }
    this.scene.add(g);
    this.target(g, { id: 'drum-bridge', type: 'scenery', name: '太鼓桥', label: '太鼓桥', action: '走走', position: g.position });
  }

  flagPole() {
    const site = RI.sites.flag;
    const g = new THREE.Group();
    g.position.set(site.x, 0, site.z);
    this.cube(g, '#8d6244', [0, 1.6, 0], [0.12, 3.2, 0.12]);
    this.flagCloth = this.cube(g, '#e07a4a', [0.55, 2.5, 0], [0.9, 0.42, 0.08]);
    this.cube(g, '#f7f1e4', [0.85, 2.15, 0], [0.35, 0.28, 0.06]);
    this.scene.add(g);
    this.solid(site.x, site.z, 0.6, 0.6);
    this.target(g, { id: 'koinobori-pole', type: 'flag', name: '鲤鱼旗杆', label: '鲤鱼旗', ariaLabel: '修鲤鱼旗', action: '修鲤鱼旗', position: g.position });
  }

  balloonLawn() {
    const site = RI.lawn;
    const g = new THREE.Group();
    g.position.set(site.x, 0.05, site.z);
    this.mesh(g, new THREE.CircleGeometry(RI.balloon.radius, 28), this.matColor('#b7d48a'), [0, 0, 0]).rotation.x = -Math.PI / 2;
    this.cube(g, '#e27a5f', [0, 1.6, 0], [1.1, 1.5, 1.1]);
    this.cube(g, '#8d6244', [0, 0.4, 0], [0.7, 0.4, 0.7]);
    this.scene.add(g);
    this.target(g, { id: 'ri-balloon', type: 'balloon', name: '日谷草坪', label: '热气球草坪', action: '看看草坪', position: g.position });
  }

  dock() {
    const site = RI.dock;
    const g = new THREE.Group();
    g.position.set(site.x, 0.1, site.z);
    for (let i = -1; i <= 1; i += 1) this.cube(g, '#b97944', [0, 0.16, i * 0.7], [1.6, 0.16, 0.6]);
    this.cube(g, '#8d6244', [1.2, 0.28, 0.4], [0.55, 0.24, 1.2]);
    this.scene.add(g);
    this.target(g, { id: 'ri-dock', type: 'ferry', name: '日谷码头', label: '码头', ariaLabel: '回家', action: '回家', position: g.position });
  }

  mailbox() {
    const g = new THREE.Group();
    g.position.set(1.8, 0, -10.5);
    this.cube(g, '#8d6244', [0, 0.55, 0], [0.16, 1.1, 0.16]);
    this.cube(g, '#f4efe4', [0, 1.15, 0], [0.46, 0.36, 0.28]);
    this.scene.add(g);
    this.target(g, { id: 'ri-letter', type: 'letter', name: '信箱', label: '一封画', ariaLabel: '看信', action: '看信', position: g.position });
  }

  npc(site, id, name, shirt, hair, scale, apron) {
    const g = new THREE.Group();
    g.position.set(site.x, 0, site.z);
    person(this, g, { shirt, hair, scale, apron });
    this.scene.add(g);
    this.solid(site.x, site.z, 0.7, 0.7);
    this.target(g, { id: `tutor-${id}`, type: 'tutor', tutorId: id, name, label: name, action: '说说话', reach: 2.7, position: g.position });
  }

  animal(site) {
    const g = new THREE.Group();
    g.position.set(site.x, 0, site.z);
    this.mesh(g, this.head, this.matColor('#c48a55'), [0, 0.55, 0], [1.5, 1.2, 1.6]);
    this.mesh(g, this.head, this.matColor('#c48a55'), [0, 0.95, 0.15], [0.9, 0.8, 0.9]);
    this.mesh(g, this.eye, this.mats.dark, [-0.12, 1.02, 0.38]);
    this.mesh(g, this.eye, this.mats.dark, [0.12, 1.02, 0.38]);
    this.mesh(g, this.head, this.matColor('#a87448'), [-0.22, 1.25, 0], [0.35, 0.45, 0.2]);
    this.mesh(g, this.head, this.matColor('#a87448'), [0.22, 1.25, 0], [0.35, 0.45, 0.2]);
    this.cube(g, '#7eb6e0', [0, 0.7, 0.15], [0.55, 0.14, 0.4]);
    this.scene.add(g);
    this.solid(site.x, site.z, 0.8, 0.8);
    this.target(g, { id: 'tutor-ponta', type: 'tutor', tutorId: 'ponta', name: '狸猫阿哲', label: '阿哲', action: '说说话', reach: 2.7, position: g.position });
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
      y: realmTerrainHeight('ri', Math.round(hit.point.x)),
    };
    return { target, point: hit.point, cell };
  }

  surfaceAt(x, z) {
    let h = realmTerrainHeight('ri', x);
    if (Math.hypot(x - RI.dock.x, z - RI.dock.z) <= 2.2) h = Math.max(h, 0.28);
    if (Math.abs(x) <= 1.1 && Math.abs(z - RI.sites.bridge.z) <= 1.5) h = Math.max(h, 0.55);
    if (Math.hypot(x - RI.lawn.x, z - RI.lawn.z) <= RI.balloon.radius) h = Math.max(h, 0.08);
    return h;
  }

  blocked(x, z) {
    if (x < RI.bounds.minX + 0.4 || x > RI.bounds.maxX - 0.4 || z < RI.bounds.minZ + 0.4 || z > RI.bounds.maxZ - 0.4) return true;
    const onDock = Math.hypot(x - RI.dock.x, z - RI.dock.z) <= 2.2;
    const onBridge = Math.abs(z - RI.sites.bridge.z) <= 1.35;
    if (x >= RI.stream.minX && x <= RI.stream.maxX && !onDock && !onBridge) return true;
    return this.decorColliders.some((c) => Math.abs(x - c.x) < c.width / 2 && Math.abs(z - c.z) < c.depth / 2);
  }

  canMove(x, z) {
    return !this.blocked(x, z);
  }

  sync(state) {
    if (!state || state.travel?.current !== 'ri') return;
    const spot = state.travel.realms?.ri;
    if (!spot) return;
    const first = this.state !== state;
    this.state = state;
    if (first && spot.player) this.playerPosition.set(spot.player.x, spot.player.y || 0, spot.player.z);
    if (this.flagCloth) {
      const fixed = spot.claimed?.includes('ri-flag-repaired');
      this.flagCloth.scale.set(fixed ? 1.35 : 0.9, fixed ? 0.62 : 0.42, 0.08);
      this.flagCloth.material.color.set(fixed ? '#e07a4a' : '#c98462');
    }
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
  }

  blockModel(block) {
    const g = new THREE.Group();
    g.position.set(block.x, block.y, block.z);
    const color = ITEMS[block.item]?.color || '#f4efe4';
    if (block.item === 'paper-crane') this.cube(g, color, [0, 0.35, 0], [0.7, 0.28, 0.7]);
    else if (block.item === 'paper-boat') this.cube(g, color, [0, 0.22, 0], [0.8, 0.28, 0.4]);
    else if (block.item === 'paper-koinobori') this.cube(g, '#e07a4a', [0, 0.45, 0], [0.3, 0.7, 0.3]);
    else if (block.item === 'paper-door') this.cube(g, color, [0, 0.55, 0], [0.9, 1.1, 0.08]);
    else this.cube(g, color, [0, 0.5, 0], [0.96, 0.96, 0.96]);
    return g;
  }

  beginArrivalDescend() {
    this.balloon = { phase: 'descend', t: 0 };
    this.playerPosition.set(RI.lawn.x, RI.balloon.cruiseHeight, RI.lawn.z);
    this.locomotion = 'balloon';
  }

  update(dt, input = {}, paused = false) {
    if (this.released) return this.playerPosition;
    this.time += dt;
    let mx = input.x || 0;
    let mz = input.z || 0;
    if (!paused && this.balloon?.phase === 'descend') {
      this.balloon.t += dt;
      const u = Math.min(1, this.balloon.t / RI.balloon.descendSeconds);
      this.playerPosition.set(RI.lawn.x, RI.balloon.cruiseHeight * (1 - u), RI.lawn.z);
      if (u >= 1) {
        this.balloon = null;
        this.locomotion = 'walk';
        this.playerPosition.y = this.surfaceAt(RI.lawn.x, RI.lawn.z);
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
      const speed = 3.15;
      const nx = this.playerPosition.x + wx * speed * dt;
      const nz = this.playerPosition.z + wz * speed * dt;
      if (this.canMove(nx, this.playerPosition.z)) this.playerPosition.x = nx;
      if (this.canMove(this.playerPosition.x, nz)) this.playerPosition.z = nz;
      if (Math.hypot(wx, wz) > 0.05) this.facing = Math.atan2(wx, wz);
      this.playerPosition.y = this.surfaceAt(this.playerPosition.x, this.playerPosition.z);
    }
    this.player.position.copy(this.playerPosition);
    this.player.rotation.y = this.facing;
    const center = this.playerPosition.clone();
    center.y += 0.8;
    this.lookAt.lerp(center, 1 - Math.exp(-3 * dt));
    const v = new THREE.Vector3(Math.sin(this.yaw) * this.distance, this.distance * 0.72, Math.cos(this.yaw) * this.distance);
    this.camera.position.lerp(this.lookAt.clone().add(v), 1 - Math.exp(-5 * dt));
    this.camera.lookAt(this.lookAt);
    this.renderer.render(this.scene, this.camera);
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
      const p = item.position.clone();
      p.y += 1.8;
      p.project(this.camera);
      const x = (p.x + 1) * w / 2;
      const y = (-p.y + 1) * h / 2;
      const near = Math.hypot(item.position.x - this.playerPosition.x, item.position.z - this.playerPosition.z) <= 4.5;
      item.labelElement.hidden = !(p.z < 1 && near);
      item.labelElement.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
    }
  }

  nearestTarget(max = 3) {
    let best = null;
    let dist = max;
    for (const item of this.targets) {
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

  setPreview(item, rotation, cell) {
    this.preview.clear();
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
  balloonLook() { return balloonLook(this.balloon?.phase || 'idle', 0, 'orbit'); }
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

void BALLOON_CONTROL;
