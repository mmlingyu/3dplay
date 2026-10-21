/** Valley pictures for the star map. One instanced batch, one fog plane, no camera move. */

import * as THREE from 'three';
import { VALLEY_CAST } from './valley-tutors.js';
import { observatorySite } from './story-data.js';

const WATER = '#8ebdc0';
const WINDOW = '#9ec9c4';
const LANTERN = '#e0a35a';

const COLOR = {
  wood: '#b97944',
  dark: '#354438',
  cream: '#fff5db',
  balloon: '#e27a5f',
  leaf: '#789957',
  flower: '#eed396',
  stone: '#8b9c9b',
  lantern: '#e0a35a',
  mint: '#8fd0c6',
  paper: '#f7f1e4',
  disk: '#6d7580',
  eye: '#2c3330',
  star: '#fff6d0',
  terminal: '#9ae7f2',
  fifth: '#fff1c2',
  fifthOff: '#2c3138',
  slotOff: '#3d4450',
};

const SLOT_ON = ['#7eb7d8', '#e0a35a', '#6a7fd0', '#f4efe4'];
const _matrix = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3();
const _color = new THREE.Color();

function qualityOf(state) {
  return state?.settings?.quality === 'fine' ? 'fine' : 'fast';
}

function addBox(list, color, x, y, z, sx, sy, sz) {
  list.push({ color, x, y, z, sx, sy, sz });
}

function addPerson(list, ox, oz, look) {
  const cloth = COLOR[look.cloth] || COLOR.wood;
  const skin = COLOR.cream;
  addBox(list, cloth, ox, 0.28, oz, 0.16, 0.5, 0.16);
  addBox(list, cloth, ox + 0.18, 0.28, oz, 0.16, 0.5, 0.16);
  addBox(list, cloth, ox + 0.09, 0.78, oz, 0.42, 0.48, 0.24);
  addBox(list, skin, ox + 0.09, 1.28, oz, 0.28, 0.28, 0.26);
  addBox(list, COLOR.eye, ox + 0.02, 1.32, oz + 0.14, 0.05, 0.05, 0.04);
  addBox(list, COLOR.eye, ox + 0.16, 1.32, oz + 0.14, 0.05, 0.05, 0.04);
  if (look.hat) addBox(list, COLOR[look.hat] || COLOR.wood, ox + 0.09, 1.48, oz, 0.32, 0.1, 0.3);
  if (look.prop === 'bell') addBox(list, COLOR.lantern, ox + 0.34, 0.7, oz + 0.1, 0.1, 0.1, 0.1);
  if (look.prop === 'beads') addBox(list, COLOR.flower, ox + 0.34, 0.9, oz + 0.08, 0.12, 0.08, 0.08);
  if (look.prop === 'wood') addBox(list, COLOR.wood, ox + 0.36, 0.62, oz + 0.12, 0.08, 0.28, 0.08);
}

function placeInstance(mesh, index, x, y, z, sx, sy, sz, color) {
  _matrix.compose(_pos.set(x, y, z), _quat, _scl.set(sx, sy, sz));
  mesh.setMatrixAt(index, _matrix);
  if (color) mesh.setColorAt(index, _color.set(color));
}

function makeInstances(geometry, material, parts) {
  const mesh = new THREE.InstancedMesh(geometry, material, parts.length);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  parts.forEach((part, index) => placeInstance(mesh, index, part.x, part.y, part.z, part.sx, part.sy, part.sz, part.color));
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

export function createStoryScene(world) {
  const root = new THREE.Group();
  root.name = 'valley-story';
  world.scene.add(root);
  const mistMat = new THREE.MeshBasicMaterial({
    color: '#f4e4d2',
    transparent: true,
    opacity: 0,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(42, 42, 1, 1), mistMat);
  mist.rotation.x = -Math.PI / 2;
  mist.position.y = 0.35;
  mist.renderOrder = 2;
  mist.visible = false;
  root.add(mist);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
  const boxMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  const cylMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  const glowMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const hitGeo = new THREE.BoxGeometry(1, 1, 1);
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
  if (world.mats && !world.mats['paper-lantern']) world.mats['paper-lantern'] = world.mats.lantern;

  const api = {
    root,
    mist,
    signature: '',
    site: null,
    targets: [],
    batches: [],
    bird: [],
    perch: null,
    blocks: null,
    apply(state, look) {
      paint(world, api, state, look);
    },
    tick(dt, height) {
      const above = height >= 12;
      mist.position.y = above ? -2 : 0.35;
      if (!api.blocks || !api.bird.length || !api.perch) return;
      const t = world.time * 0.6;
      const x = api.perch.x + Math.cos(t) * 1.1;
      const y = api.perch.y + 1.5 + Math.sin(t * 2) * 0.2;
      const z = api.perch.z + Math.sin(t) * 1.1;
      for (const part of api.bird) {
        placeInstance(api.blocks, part.index, x + part.lx, y + part.ly, z + part.lz, part.sx, part.sy, part.sz);
      }
      api.blocks.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      clearTargets(world, api);
      dropBatches(api);
      world.scene.remove(root);
      boxGeo.dispose();
      cylGeo.dispose();
      hitGeo.dispose();
      boxMat.dispose();
      cylMat.dispose();
      glowMat.dispose();
      hitMat.dispose();
      mist.geometry.dispose();
      mistMat.dispose();
    },
  };
  api.boxGeo = boxGeo;
  api.cylGeo = cylGeo;
  api.boxMat = boxMat;
  api.cylMat = cylMat;
  api.glowMat = glowMat;
  api.hitGeo = hitGeo;
  api.hitMat = hitMat;
  return api;
}

function dropBatches(api) {
  for (const mesh of api.batches) {
    mesh.removeFromParent();
    mesh.dispose();
  }
  api.batches = [];
  api.blocks = null;
  api.bird = [];
}

function clearTargets(world, api) {
  for (const target of api.targets) target.labelElement?.remove();
  const ids = new Set(api.targets.map((target) => target.id));
  world.targets = world.targets.filter((target) => !ids.has(target.id));
  world.pickMeshes = world.pickMeshes.filter((mesh) => !ids.has(mesh.userData.targetId));
  api.targets = [];
  api.hits?.removeFromParent();
  api.hits = null;
  api.marker?.removeFromParent();
  api.marker = null;
}

function addTarget(world, api, object, spec) {
  const target = world.target(object, { ...spec, story: true, type: 'story' });
  api.targets.push(target);
  return target;
}

function hit(api, parent, x, y, z, sx, sy, sz) {
  const mesh = new THREE.Mesh(api.hitGeo, api.hitMat);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.visible = false;
  parent.add(mesh);
  return mesh;
}

function paint(world, api, state, look) {
  const travel = state?.travel;
  const story = travel?.story || {};
  const site = observatorySite(travel, state?.blocks || []);
  const quality = qualityOf(state);
  const sign = [
    story.fogIntro ? 1 : 0,
    (story.restored || []).join(','),
    (story.homePlaces || []).length,
    story.festival ? 1 : 0,
    site.x,
    site.z,
    look?.zones?.sky ? 1 : 0,
    look?.zones?.water ? 1 : 0,
    look?.zones?.light ? 1 : 0,
    quality,
  ].join('|');
  if (sign !== api.signature) {
    api.signature = sign;
    api.site = site;
    api.quality = quality;
    clearTargets(world, api);
    dropBatches(api);
    buildCast(world, api, state, look, quality, story);
    if (world.labelOnClick) world.createLabels(world.labelOnClick);
  }
  const show = Boolean(look?.visible) && !look?.above;
  const mist = api.mist;
  if (mist?.material) {
    mist.material.color.set(look?.color || '#f4e4d2');
    const gain = quality === 'fine' ? 28 : 18;
    mist.material.opacity = show ? Math.min(quality === 'fine' ? 0.5 : 0.34, (look?.density || 0) * gain) : 0;
    mist.visible = mist.material.opacity > 0.01;
  }
  tintValley(world, look, story, api);
}

function rememberColors(world, api) {
  if (api.baseColors || !world.water?.material) return;
  api.baseColors = {
    water: world.water.material.color.getHex(),
    window: world.mats?.window?.color.getHex(),
    lantern: world.mats?.lantern?.color.getHex(),
  };
}

function tintValley(world, look, story, api) {
  if (!world.water?.material || !world.mats) return;
  rememberColors(world, api);
  if (!story?.fogIntro || look?.zones?.all || !look?.visible) {
    if (api.tinted) {
      world.water.material.color.setHex(api.baseColors.water);
      if (world.mats.window && api.baseColors.window != null) world.mats.window.color.setHex(api.baseColors.window);
      if (world.mats.lantern && api.baseColors.lantern != null) world.mats.lantern.color.setHex(api.baseColors.lantern);
      if (world.mats.lantern) world.mats.lantern.emissiveIntensity = 0;
      api.tinted = false;
    }
    return;
  }
  api.tinted = true;
  world.water.material.color.set(look.zones?.water ? WATER : (look.warm ? '#a9b8b4' : '#7d8b90'));
  const lamp = look.zones?.light ? '#fff1c9' : (look.warm ? '#c4a27a' : '#6e6258');
  if (world.mats.lantern) {
    world.mats.lantern.color.set(look.zones?.light ? LANTERN : lamp);
    world.mats.lantern.emissive = world.mats.lantern.emissive || new THREE.Color(LANTERN);
    world.mats.lantern.emissive.set(LANTERN);
    world.mats.lantern.emissiveIntensity = look.zones?.light ? 0.45 : (look.lamp < 0.5 ? 0.05 : 0.12);
  }
  if (world.mats.window) world.mats.window.color.set(look.zones?.light ? WINDOW : (look.warm ? '#b7c2b8' : '#66756f'));
}

function buildCast(world, api, state, look, quality, story) {
  const boxes = [];
  const rounds = [];
  const glows = [];
  const dock = world.dockSite;
  const spots = {
    boatman: dock ? { x: 0.4, z: dock.z + 1.6 } : { x: 0.4, z: 12 },
    aunt: { x: -7.2, z: 17.4 },
    grandma: { x: 1.2, z: -6.2 },
    mumu: { x: 12.2, z: 1.2 },
  };
  const looks = {
    boatman: { cloth: 'dark', hat: 'wood', prop: 'bell' },
    aunt: { cloth: 'balloon', hat: 'leaf' },
    grandma: { cloth: 'flower', prop: 'beads' },
    mumu: { cloth: 'wood', prop: 'wood' },
  };
  const hits = new THREE.Group();
  hits.name = 'story-hits';
  api.root.add(hits);
  api.hits = hits;
  for (const personSpec of VALLEY_CAST) {
    if (personSpec.id === 'swallow') continue;
    const spot = spots[personSpec.id];
    addPerson(boxes, spot.x, spot.z, looks[personSpec.id] || {});
    const group = new THREE.Group();
    group.position.set(spot.x, 0, spot.z);
    hits.add(group);
    hit(api, group, 0.09, 0.85, 0, 0.7, 1.7, 0.55);
    addTarget(world, api, group, {
      id: `story-${personSpec.id}`,
      storyId: personSpec.id,
      name: personSpec.name,
      label: personSpec.label,
      action: personSpec.action,
      position: group.position,
    });
  }
  const perch = api.site ? { x: api.site.x + 1.4, y: 1.2, z: api.site.z + 1.2 } : { x: -11, y: 1.2, z: 2 };
  api.perch = perch;
  const wings = [
    { color: COLOR.dark, lx: 0, ly: 0, lz: 0, sx: 0.22, sy: 0.1, sz: 0.36 },
    { color: COLOR.cream, lx: -0.16, ly: 0.02, lz: 0, sx: 0.18, sy: 0.04, sz: 0.12 },
    { color: COLOR.cream, lx: 0.16, ly: 0.02, lz: 0, sx: 0.18, sy: 0.04, sz: 0.12 },
  ];
  for (const part of wings) {
    part.index = boxes.length;
    addBox(boxes, part.color, perch.x + part.lx, perch.y + 1.5 + part.ly, perch.z + part.lz, part.sx, part.sy, part.sz);
    api.bird.push(part);
  }
  if (state?.travel?.story?.fogIntro) {
    const bird = new THREE.Group();
    bird.position.set(perch.x, perch.y, perch.z);
    hits.add(bird);
    hit(api, bird, 0, 1.5, 0, 2.6, 1.3, 2.6);
    addTarget(world, api, bird, {
      id: 'story-swallow',
      storyId: 'swallow',
      name: '观察员小燕',
      label: '小燕',
      action: '看纸船',
      position: bird.position,
    });
    buildObservatory(world, api, boxes, rounds, glows, look, quality, story);
  }
  if (look?.zones?.water && dock) buildWharf(world, api, boxes, dock);
  if (look?.zones?.light) buildScreen(world, api, boxes);
  if (look?.zones?.sky) buildGuest(world, api, boxes);
  if (state?.travel?.story?.festival) buildFestival(world, api, boxes);
  const blocks = makeInstances(api.boxGeo, api.boxMat, boxes);
  api.root.add(blocks);
  api.batches.push(blocks);
  api.blocks = blocks;
  if (rounds.length) {
    const disk = makeInstances(api.cylGeo, api.cylMat, rounds);
    api.root.add(disk);
    api.batches.push(disk);
  }
  if (quality === 'fine' && glows.length) {
    const glow = makeInstances(api.boxGeo, api.glowMat, glows);
    api.root.add(glow);
    api.batches.push(glow);
  }
}

function buildObservatory(world, api, boxes, rounds, glows, look, quality, story) {
  const site = api.site;
  const ox = site.x;
  const oz = site.z;
  addBox(boxes, COLOR.stone, ox, 0.18, oz, 3.2, 0.28, 3.2);
  addBox(boxes, COLOR.stone, ox - 1.2, 0.9, oz - 1.2, 0.28, 1.3, 0.28);
  addBox(boxes, COLOR.stone, ox + 1.2, 0.55, oz + 1.1, 0.24, 0.7, 0.24);
  addBox(boxes, COLOR.wood, ox, 0.55, oz - 1.35, 1.4, 0.16, 0.2);
  rounds.push({ color: COLOR.disk, x: ox, y: 0.46, z: oz + 0.15, sx: 0.74, sy: 0.12, sz: 0.74 });
  const restored = new Set(story?.restored || []);
  const flags = [restored.has('water'), restored.has('light'), restored.has('sky'), restored.has('all')];
  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2 - Math.PI / 2;
    const x = ox + Math.cos(angle) * 0.38;
    const z = oz + 0.15 + Math.sin(angle) * 0.38;
    const on = flags[i];
    rounds.push({ color: on ? SLOT_ON[i] : COLOR.slotOff, x, y: 0.56, z, sx: 0.11, sy: 0.06, sz: 0.11 });
    if (quality === 'fine' && on) addBox(glows, SLOT_ON[i], x, 0.62, z, 0.08, 0.04, 0.08);
  }
  const fifthOn = restored.has('all');
  rounds.push({
    color: fifthOn ? COLOR.fifth : COLOR.fifthOff,
    x: ox + 0.62,
    y: 0.56,
    z: oz + 0.15,
    sx: 0.08,
    sy: 0.05,
    sz: 0.08,
  });
  if (quality === 'fine' && fifthOn) addBox(glows, COLOR.fifth, ox + 0.62, 0.64, oz + 0.15, 0.06, 0.04, 0.06);
  if (look?.zones?.sky) {
    for (let i = 0; i < (quality === 'fine' ? 8 : 4); i += 1) {
      addBox(boxes, COLOR.star, ox + Math.cos(i) * 1.3, 2.4 + (i % 3) * 0.18, oz + Math.sin(i) * 1.1, 0.08, 0.08, 0.08);
    }
    addBox(boxes, COLOR.terminal, ox, 1.15, oz - 1.2, 0.7, 0.45, 0.06);
  }
  const marker = new THREE.Object3D();
  marker.name = 'slot-0';
  marker.position.set(ox, 0.56, oz);
  api.root.add(marker);
  api.marker = marker;
  const group = new THREE.Group();
  group.position.set(ox, 0, oz);
  api.hits.add(group);
  hit(api, group, 0, 0.7, 0, 3.4, 1.6, 3.4);
  addTarget(world, api, group, {
    id: 'story-disk',
    storyId: 'disk',
    name: '星河图石盘',
    label: '石盘',
    action: '看石盘',
    position: group.position,
  });
}

function buildWharf(world, api, boxes, dock) {
  const ox = dock.x + 2.3;
  const oz = dock.z;
  addBox(boxes, COLOR.wood, ox, 0.16, oz, 1.1, 0.16, 0.8);
  addBox(boxes, COLOR.wood, ox, 0.7, oz, 0.08, 0.9, 0.08);
  addBox(boxes, COLOR.lantern, ox, 1.15, oz, 0.22, 0.28, 0.22);
  const group = new THREE.Group();
  group.position.set(ox, 0, oz);
  api.hits.add(group);
  hit(api, group, 0, 0.7, 0, 1.3, 1.5, 1);
  addTarget(world, api, group, {
    id: 'story-wharf',
    storyId: 'wharf',
    name: '渡口小站台',
    label: '小站台',
    action: '做纸灯笼',
    position: group.position,
  });
}

function buildScreen(world, api, boxes) {
  const ox = 8.2;
  const oz = -8.2;
  addBox(boxes, COLOR.wood, ox - 0.8, 0.7, oz, 0.12, 1.3, 0.12);
  addBox(boxes, COLOR.wood, ox + 0.8, 0.7, oz, 0.12, 1.3, 0.12);
  addBox(boxes, COLOR.paper, ox, 0.95, oz, 1.5, 0.9, 0.08);
  const group = new THREE.Group();
  group.position.set(ox, 0, oz);
  api.hits.add(group);
  hit(api, group, 0, 0.85, 0, 1.9, 1.6, 0.4);
  addTarget(world, api, group, {
    id: 'story-screen',
    storyId: 'screen',
    name: '露天放映墙',
    label: '放映墙',
    action: '看一看',
    position: group.position,
  });
}

function buildGuest(world, api, boxes) {
  const ox = -1.2;
  const oz = 17.2;
  addPerson(boxes, ox, oz, { cloth: 'mint', hat: 'leaf' });
  const group = new THREE.Group();
  group.position.set(ox, 0, oz);
  api.hits.add(group);
  hit(api, group, 0.09, 0.85, 0, 0.7, 1.7, 0.55);
  addTarget(world, api, group, {
    id: 'story-gugu',
    storyId: 'gugu',
    name: '小咕',
    label: '小咕',
    action: '打招呼',
    position: group.position,
  });
}

function buildFestival(world, api, boxes) {
  const site = api.site || { x: -13, z: 2 };
  const guests = [
    { id: 'ri', name: '日谷的朋友', x: -1.4, color: 'flower' },
    { id: 'mei', name: '美谷的朋友', x: 0, color: 'balloon' },
    { id: 'xing', name: '外星谷的朋友', x: 1.4, color: 'mint' },
  ];
  for (const guest of guests) {
    const ox = site.x + guest.x;
    const oz = site.z + 2.2;
    addPerson(boxes, ox, oz, { cloth: guest.color });
    addBox(boxes, COLOR.lantern, ox + 0.09, 1.7, oz, 0.16, 0.2, 0.16);
    const group = new THREE.Group();
    group.position.set(ox, 0, oz);
    api.hits.add(group);
    hit(api, group, 0.09, 0.9, 0, 0.7, 1.9, 0.55);
    addTarget(world, api, group, {
      id: `story-guest-${guest.id}`,
      storyId: 'festival',
      name: guest.name,
      label: guest.name,
      action: '打招呼',
      position: group.position,
    });
  }
}
