/** Alien valley scene. Loaded only when the balloon arrives. */

import * as THREE from 'three';
import { ITEMS } from './game-data.js';
import { REALMS, realmTerrainHeight } from './realm-data.js';
import { BALLOON_CONTROL, balloonLook } from './balloon-data.js';
import { ballBoundaryFor } from './ball-data.js';
import { ballGravity, playerFall, JUMP_SPEED } from './motion-gravity.js';
import { glyphById } from './glyph-data.js';
import { XING_SIGNS } from './xing-data.js';
import { trackListeners, trackWorldCreated, trackWorldReleased } from './scene-stats.js';
import { realMoment } from './life-data.js';
import { GATE_FRONT, HOLO_TRANSITION_SECONDS, STAR_GATE, resolveQuality } from './holo-data.js';
import { makeGate, makeGugu, makeZero } from './holo-figures.js';
import { bindMood } from './avatar-mood.js';

const XING = REALMS.xing;
const LISTENER_COUNT = 6;
const STAR_CAP = 64;

export class XingWorld {
  constructor(canvas, callbacks = {}) {
    this.realmId = 'xing';
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
    this.playerPosition = new THREE.Vector3(XING.lawn.x, 0, XING.lawn.z);
    this.velocityY = 0;
    this.facing = 0;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#243456');
    this.scene.fog = new THREE.Fog('#243456', 26, 70);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(43, 1, 0.1, 160);
    this.lookAt = new THREE.Vector3();
    this.sun = new THREE.DirectionalLight('#fff4df', 1.7);
    this.sun.position.set(-8, 18, 10);
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 80;
    this.sun.shadow.camera.left = -30;
    this.sun.shadow.camera.right = 30;
    this.sun.shadow.camera.top = 30;
    this.sun.shadow.camera.bottom = -30;
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun, new THREE.HemisphereLight('#ffe8c4', '#6d7ea8', 1.35));
    this.box = new THREE.BoxGeometry(1, 1, 1);
    this.head = new THREE.SphereGeometry(0.28, 14, 10);
    this.eye = new THREE.SphereGeometry(0.035, 8, 6);
    this.mats = {};
    this.skin = this.matColor('#d7c4ef');
    this.mats.dark = this.matColor('#243028');
    this.previewMaterial = new THREE.MeshStandardMaterial({ color: '#fff0ae', transparent: true, opacity: 0.46, roughness: 0.9, depthWrite: false });
    this.player = new THREE.Group();
    this.scene.add(this.player);
    this.paintPlayer();
    bindMood(this);
    this.selectionRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.63, 28), new THREE.MeshBasicMaterial({ color: '#fff3be', side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthWrite: false }));
    this.selectionRing.rotation.x = -Math.PI / 2;
    this.selectionRing.visible = false;
    this.scene.add(this.selectionRing);
    this.preview = new THREE.Group();
    this.scene.add(this.preview);
    this.valleyRoot = new THREE.Group();
    this.valleyRoot.name = 'xing-valley';
    this.scene.add(this.valleyRoot);
    this.figures = {};
    this.figureMode = { gugu: 'idle', zero: 'idle' };
    this.gate = null;
    this.holo = { phase: 'off', t: 0, padId: '' };
    this.finishing = false;
    this.finishPromise = null;
    this.holoGeneration = 0;
    this.holoLayer = null;
    this.holoMod = null;
    this.bloom = null;
    this.pixelCap = 1.5;
    this.qualityMode = 'fine';
    this.deviceEnv = { pointerCoarse: false, maxTouchPoints: 0, shortSide: 1280 };
    this.nightOverride = null;
    this.dust = null;
    this.savedLook = null;
    this.holoReady = import('./holo-scene.js').then((mod) => {
      this.holoMod = mod;
      if (!this.released && this.qualityMode === 'fine' && !this.bloom) {
        this.bloom = mod.attachBloom(this.renderer, this.scene, this.camera);
      }
      return mod;
    });
    this.groundMeshes = [];
    this.stars = null;
    this.homeDot = null;
    this.ball = null;
    this.buildScenery();
    this.bindPointer();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    trackWorldCreated();
    this.renderer.render(this.scene, this.camera);
  }

  matColor(color) {
    const key = String(color);
    if (!this.mats[key]) this.mats[key] = new THREE.MeshStandardMaterial({ color, roughness: 0.84 });
    return this.mats[key];
  }

  mesh(parent, geometry, material, pos = [0, 0, 0], scale = [1, 1, 1]) {
    const body = new THREE.Mesh(geometry, material);
    body.position.set(...pos);
    body.scale.set(...scale);
    parent.add(body);
    return body;
  }

  cube(parent, color, pos, scale) {
    return this.mesh(parent, this.box, this.matColor(color), pos, scale);
  }

  solid(x, z, w, d) {
    this.decorColliders.push({ x, z, width: w, depth: d });
  }

  target(group, data) {
    const obj = { ...data, group, position: group.position.clone() };
    this.targets.push(obj);
    group.traverse((child) => {
      if (child.isMesh) {
        child.userData.targetId = data.id;
        this.pickMeshes.push(child);
      }
    });
    return obj;
  }

  paintPlayer() {
    this.mesh(this.player, this.head, this.skin, [0, 1.35, 0]);
    const shirt = this.mesh(this.player, this.box, this.matColor('#f2d27a'), [0, 0.86, 0], [0.42, 0.48, 0.26]);
    shirt.userData.wearer = true;
    this.player.userData.shirt = shirt;
  }

  buildScenery() {
    const bounds = XING.bounds;
    const grass = this.matColor('#6f8f78');
    const cols = bounds.maxX - bounds.minX + 1;
    const rows = bounds.maxZ - bounds.minZ + 1;
    const land = new THREE.InstancedMesh(this.box, grass, cols * rows);
    const matrix = new THREE.Matrix4();
    let n = 0;
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      for (let z = bounds.minZ; z <= bounds.maxZ; z += 1) {
        matrix.makeTranslation(x, realmTerrainHeight('xing', x) - 0.9, z);
        land.setMatrixAt(n, matrix);
        n += 1;
      }
    }
    land.receiveShadow = true;
    this.place(land);
    this.groundMeshes.push(land);
    const yard = XING.visitor;
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(yard.maxX - yard.minX + 1, yard.maxZ - yard.minZ + 1), this.matColor('#efe2b8'));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set((yard.minX + yard.maxX) / 2, 0.03, (yard.minZ + yard.maxZ) / 2);
    pad.receiveShadow = true;
    this.place(pad);
    this.groundMeshes.push(pad);
    this.sky();
    this.dome();
    this.tower();
    this.lab();
    this.saltLake();
    this.mossPatch();
    this.hopper();
    this.meteorite();
    this.glassShelf();
    this.people();
    this.starGate();
    this.signs();
    this.balloonPad();
    this.warmLamps();
    this.spawnBall();
  }

  sky() {
    const positions = new Float32Array(STAR_CAP * 3);
    for (let i = 0; i < STAR_CAP; i += 1) {
      const angle = (i / STAR_CAP) * Math.PI * 2;
      const radius = 28 + (i % 7);
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = 18 + (i % 5) * 1.4;
      positions[i * 3 + 2] = Math.sin(angle) * radius * 0.72;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.stars = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#fff6d8', size: 0.18, sizeAttenuation: true }));
    this.place(this.stars);
    const moonA = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), new THREE.MeshBasicMaterial({ color: '#f7f1df' }));
    moonA.position.set(-14, 22, -18);
    const moonB = new THREE.Mesh(new THREE.SphereGeometry(0.72, 14, 10), new THREE.MeshBasicMaterial({ color: '#f0d2a8' }));
    moonB.position.set(12, 20, -16);
    this.place(moonA);
    this.place(moonB);
    this.homeDot = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), new THREE.MeshBasicMaterial({ color: '#7eb6e8' }));
    this.homeDot.position.set(0, 24, -22);
    this.homeDot.visible = false;
    this.place(this.homeDot);
  }

  dome() {
    const site = XING.sites.dome;
    const group = new THREE.Group();
    group.position.set(site.x, 0, site.z);
    this.mesh(group, new THREE.SphereGeometry(1.5, 18, 12), this.matColor('#d7efe8'), [0, 1.15, 0]);
    this.cube(group, '#f6e7b2', [0, 1.2, 1.15], [0.7, 0.7, 0.12]);
    const lamp = new THREE.PointLight('#ffd9a0', 1.4, 12);
    lamp.position.set(0, 2.2, 0);
    group.add(lamp);
    this.place(group);
    this.solid(site.x, site.z, 2.4, 2.4);
    this.target(group, { id: 'xing-dome', type: 'scenery', name: '穹顶屋', label: '穹顶屋', action: '看看' });
  }

  tower() {
    const site = XING.sites.tower;
    const group = new THREE.Group();
    group.position.set(site.x, 0, site.z);
    this.cube(group, '#d5e7f5', [0, 1.6, 0], [1.1, 3.2, 1.1]);
    this.cube(group, '#f7fbff', [0, 3.4, 0], [0.7, 0.7, 0.7]);
    this.place(group);
    this.solid(site.x, site.z, 1.6, 1.6);
    this.target(group, { id: 'xing-tower', type: 'scenery', name: '晶体塔', label: '晶体塔', action: '看看' });
  }

  lab() {
    const site = XING.sites.lab;
    const group = new THREE.Group();
    group.position.set(site.x, 0, site.z);
    this.cube(group, '#efe6d4', [0, 0.45, 0], [2.2, 0.9, 1.2]);
    this.cube(group, '#f7fbff', [0.4, 0.95, 0], [0.35, 0.45, 0.35]);
    this.place(group);
    this.solid(site.x, site.z, 2.2, 1.4);
    this.target(group, { id: 'xing-lab', type: 'xing', xing: 'lab', name: '试验站', label: '试验站', ariaLabel: '试验站', action: '做实验' });
  }

  saltLake() {
    const site = XING.sites.salt;
    const group = new THREE.Group();
    group.position.set(site.x, 0, site.z);
    const skin = new THREE.Mesh(new THREE.CircleGeometry(2.2, 20), this.matColor('#f4f7fb'));
    skin.rotation.x = -Math.PI / 2;
    skin.position.y = 0.04;
    group.add(skin);
    this.place(group);
    this.target(group, { id: 'xing-salt', type: 'resource', item: 'salt', name: '盐湖', label: '盐湖', ariaLabel: '取盐', action: '取盐' });
  }

  mossPatch() {
    const site = XING.sites.moss;
    const group = new THREE.Group();
    group.position.set(site.x, 0, site.z);
    const glow = this.matColor('#8ee0b0');
    glow.emissive = new THREE.Color('#6dca96');
    glow.emissiveIntensity = 0.35;
    this.mesh(group, this.head, glow, [0, 0.28, 0], [1.4, 0.7, 1.2]);
    this.mesh(group, this.head, glow, [0.45, 0.22, 0.2], [0.8, 0.5, 0.8]);
    this.place(group);
    this.target(group, { id: 'xing-moss', type: 'xing', xing: 'moss', name: '光苔', label: '光苔', ariaLabel: '看看光苔', action: '看看' });
  }

  hopper() {
    const site = XING.sites.hopper;
    const group = new THREE.Group();
    group.position.set(site.x, 0, site.z);
    this.mesh(group, this.head, this.matColor('#f0a05a'), [0, 0.72, 0], [1.3, 1.1, 1.2]);
    this.mesh(group, this.eye, this.mats.dark, [-0.12, 0.82, 0.28]);
    this.mesh(group, this.eye, this.mats.dark, [0.12, 0.82, 0.28]);
    this.cube(group, '#e08a45', [-0.16, 0.28, 0], [0.12, 0.4, 0.12]);
    this.cube(group, '#e08a45', [0.16, 0.28, 0], [0.12, 0.4, 0.12]);
    this.place(group);
    this.solid(site.x, site.z, 1.1, 1.1);
    this.target(group, { id: 'xing-hopper', type: 'xing', xing: 'hopper', name: '跳跳球兽', label: '跳跳球兽', ariaLabel: '看看跳跳球兽', action: '看看' });
  }

  meteorite() {
    const site = XING.sites.meteor;
    const group = new THREE.Group();
    group.position.set(site.x, 0, site.z);
    this.mesh(group, this.head, this.matColor('#6d625c'), [0, 0.35, 0], [1.1, 0.8, 0.9]);
    this.place(group);
    this.target(group, { id: 'xing-meteorite', type: 'resource', item: 'meteorite', name: '陨石碎块', label: '陨石', ariaLabel: '看看陨石', action: '看看' });
  }

  glassShelf() {
    const site = XING.sites.glass;
    const group = new THREE.Group();
    group.position.set(site.x, 0, site.z);
    this.mesh(group, new THREE.SphereGeometry(0.42, 14, 10), new THREE.MeshStandardMaterial({ color: '#d5f3f6', transparent: true, opacity: 0.55, roughness: 0.2 }), [0, 0.55, 0]);
    this.cube(group, '#efe6d4', [0, 0.16, 0], [0.9, 0.28, 0.7]);
    this.place(group);
    this.target(group, { id: 'xing-glass', type: 'resource', item: 'glass-dome', name: '玻璃罩', label: '玻璃罩', ariaLabel: '拿玻璃罩', action: '拿一个' });
  }

  people() {
    this.gugu(XING.sites.gugu);
    this.doctor(XING.sites.doctor);
    this.robot(XING.sites.robot);
  }

  gugu(site) {
    const fig = makeGugu();
    fig.group.position.set(site.x, 0, site.z);
    this.place(fig.group);
    this.figures.gugu = fig;
    this.target(fig.group, { id: 'tutor-gugu', type: 'tutor', tutorId: 'gugu', name: '小咕', label: '小咕', ariaLabel: '小咕', action: '看看' });
  }

  doctor(site) {
    const group = new THREE.Group();
    group.position.set(site.x, 0, site.z);
    this.mesh(group, this.head, this.matColor('#d9ecf7'), [0, 0.95, 0], [1.05, 1.2, 0.9]);
    this.mesh(group, this.head, this.matColor('#f4fbff'), [0, 1.42, 0.02], [0.72, 0.7, 0.7]);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 14), this.matColor('#243028'));
    ring.position.set(-0.1, 1.42, 0.2);
    const ringB = ring.clone();
    ringB.position.x = 0.1;
    group.add(ring, ringB);
    this.place(group);
    this.solid(site.x, site.z, 0.9, 0.9);
    this.target(group, { id: 'tutor-jingjing', type: 'tutor', tutorId: 'jingjing', name: '晶晶博士', label: '晶晶博士', ariaLabel: '晶晶博士', action: '看看' });
  }

  robot(site) {
    const fig = makeZero();
    fig.group.position.set(site.x, 0, site.z);
    this.place(fig.group);
    this.figures.zero = fig;
    this.solid(site.x, site.z, 0.8, 0.8);
    this.target(fig.group, { id: 'tutor-lingyi', type: 'tutor', tutorId: 'lingyi', name: '零一', label: '零一', ariaLabel: '零一', action: '看看' });
  }

  starGate() {
    const gate = makeGate();
    gate.group.position.set(STAR_GATE.x, 0, STAR_GATE.z);
    this.place(gate.group);
    this.gate = gate;
    this.target(gate.group, { id: 'xing-gate', type: 'holo', name: '星门', label: '星门', ariaLabel: '进入星网', action: '进入星网' });
  }

  place(obj) {
    (this.valleyRoot || this.scene).add(obj);
    return obj;
  }

  setDomeFilled(on) {
    this.domeFilled = Boolean(on);
    this.holoLayer?.setGapFilled?.(this.domeFilled);
  }

  isNight() {
    if (this.nightOverride === true || this.nightOverride === false) return this.nightOverride;
    const period = realMoment().period;
    return period === '晚上' || period === '深夜';
  }

  setDeviceEnv(env) {
    this.deviceEnv = { ...this.deviceEnv, ...env };
    this.applyQuality(resolveQuality(this.state?.settings?.quality, this.deviceEnv));
  }

  applyQuality(mode) {
    const fast = mode === 'fast';
    this.qualityMode = fast ? 'fast' : 'fine';
    this.pixelCap = fast ? 1.15 : 1.5;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.pixelCap));
    const size = fast ? 512 : 1024;
    this.sun.shadow.mapSize.set(size, size);
    this.sun.castShadow = this.inHolo();
    this.holoLayer?.setQuality(this.qualityMode);
    if (fast && this.bloom) {
      this.bloom.dispose();
      this.bloom = null;
    } else if (!fast && !this.bloom && this.holoMod?.attachBloom) {
      this.bloom = this.holoMod.attachBloom(this.renderer, this.scene, this.camera);
    }
    this.resize();
  }

  inHolo() {
    return this.holo.phase === 'in' || this.holo.phase === 'enter';
  }

  gateFront() {
    return { x: GATE_FRONT.x, y: this.valleySurface(GATE_FRONT.x, GATE_FRONT.z), z: GATE_FRONT.z, ry: 0 };
  }

  valleySurface(x, z) {
    let height = realmTerrainHeight('xing', x);
    if (Math.hypot(x - XING.lawn.x, z - XING.lawn.z) <= XING.balloon.radius) height = Math.max(height, 0.08);
    return height;
  }

  beginHolo() {
    if (this.holo.phase !== 'off' || this.balloon) return false;
    this.holo.phase = 'enter';
    this.holo.t = 0;
    this.ensureDust();
    this.callbacks.onHolo?.({ phase: 'enter', t: 0, total: HOLO_TRANSITION_SECONDS });
    return true;
  }

  skipHolo() {
    if (this.holo.phase === 'in') return Promise.resolve(true);
    if (this.holo.phase !== 'enter') return Promise.resolve(false);
    this.holo.t = HOLO_TRANSITION_SECONDS;
    return this.finishEnter().then(() => this.holo.phase === 'in');
  }

  finishEnter() {
    if (this.holo.phase === 'in') return Promise.resolve();
    if (this.finishPromise) return this.finishPromise;
    const generation = this.holoGeneration;
    this.finishing = true;
    this.finishPromise = this._finishEnter(generation).finally(() => {
      this.finishing = false;
      this.finishPromise = null;
    });
    return this.finishPromise;
  }

  async _finishEnter(generation) {
    await this.holoReady;
    if (this.released || this.holo.phase !== 'enter' || generation !== this.holoGeneration) return;
    if (!this.holoLayer && this.holoMod) {
      this.holoLayer = this.holoMod.createHoloLayer();
      this.scene.add(this.holoLayer.group);
      this.holoLayer.setQuality(this.qualityMode);
      if (this.qualityMode === 'fine' && !this.bloom) this.bloom = this.holoMod.attachBloom(this.renderer, this.scene, this.camera);
    }
    this.holoLayer?.setGapFilled?.(this.domeFilled || this.state?.travel?.realms?.xing?.storyShard === true);
    if (!this.savedLook) {
      this.savedLook = { background: this.scene.background.clone(), fog: this.scene.fog };
    }
    this.scene.background = new THREE.Color('#0B1630');
    this.scene.fog = new THREE.FogExp2('#0B1630', 0.011);
    this.valleyRoot.visible = false;
    this.player.visible = false;
    this.selectionRing.visible = false;
    if (this.dust) this.dust.visible = false;
    if (this.holoLayer) this.holoLayer.group.visible = true;
    const pad = this.holoLayer?.pads?.[0];
    this.playerPosition.set(pad?.x || 0, pad?.y || 2, pad?.z || 0);
    this.velocityY = 0;
    this.holo.phase = 'in';
    this.holo.padId = '';
    this.sun.castShadow = true;
    this.applyAvatar(this.state?.travel?.realms?.xing?.holo);
    this.callbacks.onHolo?.({ phase: 'in' });
  }

  applyAvatar(holo) {
    const avatar = this.holoLayer?.avatar;
    if (!avatar || !holo?.avatar) return;
    const glow = holo.avatar.glow || 'cyan';
    const hex = { cyan: '#36E0E8', amber: '#FFB347', purple: '#9D7BFF', white: '#F4F7FF', green: '#8EE0B0' }[glow] || '#36E0E8';
    avatar.setGlow(hex);
    avatar.setVisor(holo.avatar.visor || 'clear');
  }

  setStarDots(count) {
    this.holoLayer?.starling?.setDots(count);
  }

  showEcho(path) {
    if (!path?.length) this.holoLayer?.hideEcho?.();
    else this.holoLayer?.showEcho?.(path);
  }

  leaveHolo() {
    if (this.holo.phase === 'off') return false;
    this.holoGeneration += 1;
    this.holo.phase = 'off';
    this.holo.t = 0;
    this.holo.padId = '';
    this.valleyRoot.visible = true;
    this.player.visible = true;
    if (this.holoLayer) {
      this.holoLayer.group.visible = false;
      this.holoLayer.hideEcho?.();
    }
    if (this.savedLook) {
      this.scene.background = this.savedLook.background;
      this.scene.fog = this.savedLook.fog;
      this.savedLook = null;
    }
    const front = this.gateFront();
    this.playerPosition.set(front.x, front.y, front.z);
    this.velocityY = 0;
    this.sun.castShadow = false;
    this.finishing = false;
    this.callbacks.onHolo?.({ phase: 'off' });
    return true;
  }

  ensureDust() {
    if (this.dust) {
      this.dust.visible = true;
      return;
    }
    const positions = new Float32Array(180 * 3);
    for (let i = 0; i < 180; i += 1) {
      positions[i * 3] = STAR_GATE.x + (i % 15) * 0.5 - 3.5;
      positions[i * 3 + 1] = 0.15;
      positions[i * 3 + 2] = STAR_GATE.z + Math.floor(i / 15) * 0.45 - 2.2;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.dust = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#36E0E8', size: 0.14, transparent: true, opacity: 0, depthWrite: false }));
    this.scene.add(this.dust);
  }

  setFigureMode(id, mode) {
    if (this.figureMode[id]) this.figureMode[id] = mode;
  }

  sampleStats() {
    const info = this.renderer.info;
    return {
      calls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
    };
  }

  signs() {
    this.signTargets = [];
    for (const sign of XING_SIGNS) {
      const group = new THREE.Group();
      group.position.set(sign.x, 0, sign.z);
      this.cube(group, '#efe6d4', [0, 0.7, 0], [0.12, 1.3, 0.12]);
      this.cube(group, '#7eb6e0', [0, 1.35, 0], [0.8, 0.46, 0.08]);
      this.place(group);
      const target = this.target(group, { id: sign.id, type: 'xing', xing: 'sign', glyph: sign.glyph, name: '路牌', label: '路牌', ariaLabel: '路牌', action: '看看' });
      this.signTargets.push(target);
    }
  }

  balloonPad() {
    const base = XING.balloon;
    const group = new THREE.Group();
    group.position.set(base.x, 0, base.z);
    const pad = new THREE.Mesh(new THREE.CircleGeometry(base.radius, 24), this.matColor('#d8ead0'));
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.05;
    group.add(pad);
    this.mesh(group, new THREE.SphereGeometry(0.85, 16, 12), this.matColor('#f27d62'), [0, 1.7, 0]);
    this.cube(group, '#f4efe4', [0, 0.55, 0], [0.7, 0.4, 0.7]);
    this.place(group);
    this.balloonCraft = group;
    this.target(group, { id: 'xing-balloon', type: 'balloon', name: '热气球草坪', label: '热气球', ariaLabel: '乘坐热气球', action: '乘坐热气球' });
  }

  warmLamps() {
    for (const spot of [[-4, 4], [2, 8], [6, -4], [-10, 8]]) {
      const group = new THREE.Group();
      group.position.set(spot[0], 0, spot[1]);
      this.cube(group, '#efe6d4', [0, 0.45, 0], [0.1, 0.9, 0.1]);
      const bulb = this.mesh(group, this.eye, new THREE.MeshBasicMaterial({ color: '#ffd9a0' }), [0, 1.05, 0], [3, 3, 3]);
      bulb.material.depthWrite = false;
      const light = new THREE.PointLight('#ffd2a2', 0.7, 8);
      light.position.set(0, 1.1, 0);
      group.add(light);
      this.place(group);
    }
  }

  spawnBall() {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), this.matColor('#e0b15a'));
    mesh.castShadow = true;
    mesh.position.set(6, 0.4, 4);
    this.place(mesh);
    this.ball = { mesh, p: mesh.position, v: new THREE.Vector3(0, 0, 0) };
    this.target(mesh, { id: 'xing-ball', type: 'ball', name: '木球', label: '木球', ariaLabel: '推一推木球', action: '推一推' });
  }

  surfaceAt(x, z) {
    if (this.holo?.phase === 'in' && this.holoMod?.padUnder) return this.holoMod.padUnder(x, z)?.y ?? -4;
    return this.valleySurface(x, z);
  }

  blocked(x, z) {
    if (x < XING.bounds.minX + 0.4 || x > XING.bounds.maxX - 0.4 || z < XING.bounds.minZ + 0.4 || z > XING.bounds.maxZ - 0.4) return true;
    return this.decorColliders.some((box) => Math.abs(x - box.x) < box.width / 2 && Math.abs(z - box.z) < box.depth / 2);
  }

  canMove(x, z) {
    return !this.blocked(x, z);
  }

  refreshSigns() {
    const learned = new Set(this.state?.travel?.realms?.xing?.glyphs || []);
    for (const sign of this.signTargets || []) {
      const glyph = glyphById(sign.glyph);
      const known = learned.has(sign.glyph);
      const text = known && glyph ? glyph.name : '路牌';
      sign.name = text;
      sign.label = text;
      if (sign.labelElement) {
        sign.labelElement.textContent = text;
        sign.labelElement.setAttribute('aria-label', known ? `${text}，已经翻译` : '路牌');
      }
    }
  }

  sync(state) {
    if (!state || state.travel?.current !== 'xing') return;
    const spot = state.travel.realms?.xing;
    if (!spot) return;
    const first = this.state !== state;
    this.state = state;
    this.applyLook?.(state.look);
    if (first && spot.player && this.holo.phase === 'off') this.playerPosition.set(spot.player.x, spot.player.y || this.valleySurface(spot.player.x, spot.player.z), spot.player.z);
    const mode = resolveQuality(state.settings?.quality, this.deviceEnv);
    if (first || mode !== this.qualityMode) this.applyQuality(mode);
    this.refreshSigns();
    const ids = new Set((spot.blocks || []).map((block) => block.id));
    for (const [id, group] of this.buildGroups) {
      if (!ids.has(id)) {
        group.parent?.remove(group);
        this.buildGroups.delete(id);
        this.targets = this.targets.filter((item) => item.id !== id);
      }
    }
    for (const block of spot.blocks || []) {
      const sig = `${block.item}:${block.x}:${block.y}:${block.z}`;
      if (this.buildGroups.get(block.id)?.userData.sig === sig) continue;
      const old = this.buildGroups.get(block.id);
      if (old) old.parent?.remove(old);
      const group = new THREE.Group();
      group.position.set(block.x, block.y, block.z);
      this.cube(group, ITEMS[block.item]?.color || '#f4efe4', [0, 0.45, 0], [0.9, 0.9, 0.9]);
      group.userData.sig = sig;
      this.place(group);
      this.buildGroups.set(block.id, group);
      this.target(group, { id: block.id, type: 'block', item: block.item, name: ITEMS[block.item]?.name || block.item, action: '看看方块', block, position: group.position });
    }
  }

  beginArrivalDescend() {
    this.balloon = { phase: 'descend', t: 0, realmId: 'xing' };
    this.playerPosition.set(XING.lawn.x, XING.balloon.cruiseHeight, XING.lawn.z);
    this.locomotion = 'balloon';
    this.homeDot.visible = true;
  }

  startBalloon() {
    if (this.balloon || this.inHolo()) return false;
    this.balloon = { phase: 'lift', t: 0, mode: 'orbit', height: 0, realmId: null, arrived: false, scripted: false };
    this.locomotion = 'balloon';
    this.velocityY = 0;
    this.callbacks.onBalloonStart?.(this.balloonLook());
    return true;
  }

  startVoyage(realmId = 'he') {
    if (!this.balloon || this.balloon.phase !== 'tour') return false;
    this.balloon.phase = 'voyage';
    this.balloon.t = 0;
    this.balloon.realmId = realmId;
    this.balloon.arrived = false;
    this.balloon.scripted = true;
    this.callbacks.onBalloonLook?.(this.balloonLook());
    return true;
  }

  completeVoyage() {
    if (!this.balloon || this.balloon.phase !== 'voyage' || this.balloon.arrived) return false;
    this.balloon.arrived = true;
    this.callbacks.onVoyageArrive?.(this.balloon.realmId || 'he');
    return true;
  }

  requestBalloonLand() {
    if (!this.balloon || this.balloon.phase === 'voyage' || this.balloon.phase === 'descend') return false;
    this.balloon.phase = 'descend';
    this.balloon.t = 0;
    this.callbacks.onBalloonLook?.(this.balloonLook());
    return true;
  }

  balloonLook() {
    const phase = this.balloon?.phase || 'idle';
    const dest = phase === 'voyage' ? (this.balloon?.realmId || 'he') : null;
    return balloonLook(phase, 0, this.balloon?.mode || 'orbit', dest);
  }

  setBalloonMode() { return false; }
  setBalloonClimb() { return false; }

  jump() {
    if (this.balloon) return;
    const ground = this.surfaceAt(this.playerPosition.x, this.playerPosition.z);
    if (this.playerPosition.y <= ground + 0.08) this.velocityY = JUMP_SPEED;
  }

  update(dt, input = {}, paused = false) {
    if (this.released) return this.playerPosition;
    this.time += dt;
    this.gate?.update(this.time, this.isNight());
    this.figures.gugu?.update(this.time, this.figureMode.gugu || 'idle');
    this.figures.zero?.update(this.time, this.figureMode.zero || 'idle');
    if (this.holo.phase !== 'off') {
      this.stepHolo(dt, input, paused);
      this.player.position.copy(this.playerPosition);
      this.frameCamera(dt);
      this.paint();
      this.positionLabels();
      return this.playerPosition;
    }
    if (this.stars) this.stars.rotation.y += dt * 0.015;
    let mx = input.x || 0;
    let mz = input.z || 0;
    const ride = this.balloon;
    if (!paused && ride) {
      this.homeDot.visible = true;
      const base = XING.balloon;
      const bob = Math.sin(this.time * 1.2) * 0.08;
      if (ride.phase === 'lift') {
        ride.t += dt;
        const u = Math.min(1, ride.t / base.liftSeconds);
        this.playerPosition.set(base.x, base.cruiseHeight * u, base.z);
        if (u >= 1) {
          ride.phase = 'tour';
          ride.height = base.cruiseHeight;
          this.callbacks.onBalloonLook?.(this.balloonLook());
        }
      } else if (ride.phase === 'tour') {
        this.playerPosition.set(base.x, base.cruiseHeight + bob, base.z);
      } else if (ride.phase === 'voyage') {
        ride.height = Math.min(BALLOON_CONTROL.maxHeight, (ride.height || base.cruiseHeight) + BALLOON_CONTROL.climbSpeed * dt);
        this.playerPosition.set(base.x, ride.height + bob, base.z);
      } else if (ride.phase === 'descend') {
        ride.t += dt;
        const u = Math.min(1, ride.t / base.descendSeconds);
        this.playerPosition.set(base.x, base.cruiseHeight * (1 - u), base.z);
        if (u >= 1) {
          this.balloon = null;
          this.locomotion = 'walk';
          this.homeDot.visible = false;
          this.playerPosition.y = this.surfaceAt(base.x, base.z);
          this.callbacks.onBalloonStop?.();
        }
      }
    } else if (!paused) {
      if (mx || mz) this.stopWalking();
      if (this.walkTarget) {
        const dx = this.walkTarget.x - this.playerPosition.x;
        const dz = this.walkTarget.z - this.playerPosition.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 2.4 && this.walkCallback) {
          const callback = this.walkCallback;
          this.stopWalking();
          callback();
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
      const ground = this.surfaceAt(this.playerPosition.x, this.playerPosition.z);
      if (this.playerPosition.y <= ground && this.velocityY <= 0) {
        this.playerPosition.y = ground;
        this.velocityY = 0;
      } else {
        this.velocityY -= playerFall('xing') * dt;
        this.playerPosition.y += this.velocityY * dt;
        if (this.playerPosition.y <= ground) {
          this.playerPosition.y = ground;
          this.velocityY = 0;
        }
      }
      this.stepBall(dt);
    }
    this.player.position.copy(this.playerPosition);
    this.player.rotation.y = this.facing;
    if (!paused) this.stepMoodScale?.(dt);
    this.frameCamera(dt);
    this.paint();
    this.positionLabels();
    return this.playerPosition;
  }

  stepHolo(dt, input, paused) {
    const hidden = typeof document !== 'undefined' && document.hidden;
    if (this.holo.phase === 'enter') {
      if (!paused && !hidden) {
        this.holo.t += dt;
        if (this.dust) {
          const u = Math.min(1, this.holo.t / HOLO_TRANSITION_SECONDS);
          this.dust.material.opacity = Math.sin(u * Math.PI) * 0.75;
          const pos = this.dust.geometry.attributes.position;
          for (let i = 0; i < pos.count; i += 1) pos.setY(i, 0.15 + u * (1.6 + (i % 5) * 0.25));
          pos.needsUpdate = true;
        }
        if (this.holo.t >= HOLO_TRANSITION_SECONDS) this.finishEnter();
      }
      if (this.holo.phase === 'enter') this.callbacks.onHolo?.({ phase: 'enter', t: this.holo.t, total: HOLO_TRANSITION_SECONDS });
      return;
    }
    if (this.holo.phase !== 'in' || paused || !this.holoMod) return;
    let mx = input.x || 0;
    let mz = input.z || 0;
    const length = Math.hypot(mx, mz);
    if (length > 1) { mx /= length; mz /= length; }
    const wx = mx * Math.cos(this.yaw) + mz * Math.sin(this.yaw);
    const wz = -mx * Math.sin(this.yaw) + mz * Math.cos(this.yaw);
    this.playerPosition.x = Math.max(-22, Math.min(22, this.playerPosition.x + wx * 3.15 * dt));
    this.playerPosition.z = Math.max(-22, Math.min(22, this.playerPosition.z + wz * 3.15 * dt));
    if (Math.hypot(wx, wz) > 0.05) this.facing = Math.atan2(wx, wz);
    const ground = this.surfaceAt(this.playerPosition.x, this.playerPosition.z);
    const falling = this.velocityY < -0.2;
    if (this.playerPosition.y <= ground && this.velocityY <= 0) {
      if (falling) this.landedAt = this.time;
      this.playerPosition.y = ground;
      this.velocityY = 0;
    } else {
      this.velocityY -= playerFall('xing') * dt;
      this.playerPosition.y += this.velocityY * dt;
      if (this.playerPosition.y <= ground) {
        if (this.velocityY < 0) this.landedAt = this.time;
        this.playerPosition.y = ground;
        this.velocityY = 0;
      }
    }
    if (this.playerPosition.y < 0) {
      const back = this.holoMod.nearestLowerPad(this.playerPosition.x, this.playerPosition.z, 40);
      this.playerPosition.set(back.x, back.y, back.z);
      this.velocityY = 0;
    }
    const pad = this.holoMod.padUnder(this.playerPosition.x, this.playerPosition.z);
    if (pad?.stage && pad.id !== this.holo.padId) {
      this.holo.padId = pad.id;
      this.callbacks.onHoloPad?.(pad);
    }
    let mode = 'idle';
    if (this.velocityY > 0.3) mode = 'jump';
    else if (this.time - (this.landedAt || 0) < 0.7) mode = 'land';
    else if (Math.hypot(wx, wz) > 0.05) mode = 'walk';
    this.holoLayer?.update(this.time, dt, {
      x: this.playerPosition.x,
      y: this.playerPosition.y,
      z: this.playerPosition.z,
      yaw: this.facing,
      mode,
      night: this.isNight(),
      guide: this.figureMode.zero || 'idle',
    });
  }

  frameCamera(dt) {
    const center = this.playerPosition.clone();
    center.y += this.holo.phase === 'in' ? 1.2 : 0.8;
    this.lookAt.lerp(center, 1 - Math.exp(-3 * dt));
    const dist = this.distance;
    const view = new THREE.Vector3(Math.sin(this.yaw) * dist, dist * 0.72, Math.cos(this.yaw) * dist);
    this.camera.position.lerp(this.lookAt.clone().add(view), 1 - Math.exp(-5 * dt));
    this.camera.lookAt(this.lookAt);
  }

  paint() {
    if (this.holdPaint) return;
    if (this.bloom && this.qualityMode === 'fine') {
      const info = this.renderer.info;
      info.autoReset = false;
      info.reset();
      this.bloom.render();
      info.autoReset = true;
      return;
    }
    this.renderer.render(this.scene, this.camera);
  }

  stepBall(dt) {
    const ball = this.ball;
    if (!ball) return;
    const sub = dt / 3;
    const g = ballGravity('xing');
    const limit = ballBoundaryFor('xing');
    for (let k = 0; k < 3; k += 1) {
      const ground = this.surfaceAt(ball.p.x, ball.p.z) + 0.22;
      if (ball.p.y <= ground + 0.025 && ball.v.y <= 0) {
        ball.p.y = ground;
        ball.v.y = 0;
        ball.v.x *= Math.exp(-0.9 * sub);
        ball.v.z *= Math.exp(-0.9 * sub);
      } else ball.v.y -= g * sub;
      ball.p.x += ball.v.x * sub;
      ball.p.y += ball.v.y * sub;
      ball.p.z += ball.v.z * sub;
      if (ball.p.x < -limit) { ball.p.x = -limit; ball.v.x *= -0.32; }
      if (ball.p.x > limit) { ball.p.x = limit; ball.v.x *= -0.32; }
      if (ball.p.z < -limit) { ball.p.z = -limit; ball.v.z *= -0.32; }
      if (ball.p.z > limit) { ball.p.z = limit; ball.v.z *= -0.32; }
    }
    const dx = ball.p.x - this.playerPosition.x;
    const dz = ball.p.z - this.playerPosition.z;
    if (Math.hypot(dx, dz) < 0.7 && Math.abs(ball.p.y - this.playerPosition.y) < 0.8) {
      ball.v.x += dx * 1.4;
      ball.v.z += dz * 1.4;
      ball.v.y = Math.max(ball.v.y, 1.2);
    }
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.pixelCap || 1.5));
    this.renderer.setSize(w, h, false);
    this.bloom?.resize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  createLabels(onClick) {
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
    this.refreshSigns();
  }

  positionLabels() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (this.holo.phase !== 'off') {
      for (const item of this.targets) if (item.labelElement) item.labelElement.hidden = true;
      return;
    }
    for (const item of this.targets) {
      if (!item.labelElement) continue;
      const point = item.position.clone();
      point.y += 1.8;
      point.project(this.camera);
      const x = (point.x + 1) * w / 2;
      const y = (-point.y + 1) * h / 2;
      const near = Math.hypot(item.position.x - this.playerPosition.x, item.position.z - this.playerPosition.z) <= 5;
      item.labelElement.hidden = !(point.z < 1 && near);
      item.labelElement.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
    }
  }

  nearestTarget(max = 3) {
    let best = null;
    let dist = max;
    for (const item of this.targets) {
      const gap = Math.hypot(item.position.x - this.playerPosition.x, item.position.z - this.playerPosition.z);
      if (gap < dist) { best = item; dist = gap; }
    }
    return best;
  }

  distanceTo(target) {
    return Math.hypot(target.position.x - this.playerPosition.x, target.position.z - this.playerPosition.z);
  }

  walkTo(point, callback = null) {
    if (!point) return;
    this.walkTarget = { x: point.x, z: point.z ?? point.y };
    this.walkCallback = callback;
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
    const ghost = new THREE.Group();
    ghost.position.set(cell.x, cell.y || 0, cell.z);
    this.cube(ghost, ITEMS[item]?.color || '#fff0ae', [0, 0.45, 0], [0.9, 0.9, 0.9]);
    ghost.traverse((child) => { if (child.isMesh) child.material = this.previewMaterial; });
    this.preview.add(ghost);
  }

  bindPointer() {
    this.pointerAbort = new AbortController();
    const signal = this.pointerAbort.signal;
    const gesture = { start: null, dragged: false };
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
    const found = this.targets.find((item) => item.id === hit.object.userData.targetId) || null;
    return {
      target: found,
      point: hit.point,
      cell: {
        x: Math.round(hit.point.x),
        z: Math.round(hit.point.z),
        y: realmTerrainHeight('xing', Math.round(hit.point.x)),
      },
    };
  }

  celebrate() {}
  cancelPointerGesture() {}
  serializeBalls() { return []; }
  setFrontier() {}
  releaseBall() { return false; }
  recallBall() { return false; }
  setParkMode() {}
  stopBounce() {}
  bounceLook() { return null; }
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
    this.bloom?.dispose();
    this.bloom = null;
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
    this.stars = null;
    this.renderer.dispose();
    trackWorldReleased(LISTENER_COUNT);
  }

  dispose() { this.release(); }
}
