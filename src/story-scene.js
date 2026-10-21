/** Valley pictures for the star map: mist, observatory, cast. The camera stays put. */

import * as THREE from 'three';
import { VALLEY_CAST } from './valley-tutors.js';
import { observatorySite } from './story-data.js';

const WATER = '#8ebdc0';
const WINDOW = '#9ec9c4';
const LANTERN = '#e0a35a';

function box(world, parent, name, at, size) {
  return world.cube(parent, name, at, size, true);
}

function person(world, parent, look) {
  const g = new THREE.Group();
  parent.add(g);
  const cloth = look.cloth || 'wood';
  const skin = look.skin || 'cream';
  box(world, g, cloth, [0, 0.28, 0], [0.16, 0.5, 0.16]);
  box(world, g, cloth, [0.18, 0.28, 0], [0.16, 0.5, 0.16]);
  box(world, g, cloth, [0.09, 0.78, 0], [0.42, 0.48, 0.24]);
  box(world, g, skin, [0.09, 1.28, 0], [0.28, 0.28, 0.26]);
  const eye = new THREE.MeshStandardMaterial({ color: '#2c3330', roughness: 0.6 });
  world.mesh(g, new THREE.SphereGeometry(0.03, 6, 6), eye, [0.02, 1.32, 0.12]);
  world.mesh(g, new THREE.SphereGeometry(0.03, 6, 6), eye, [0.16, 1.32, 0.12]);
  if (look.hat) box(world, g, look.hat, [0.09, 1.48, 0], [0.32, 0.1, 0.3]);
  if (look.prop === 'bell') box(world, g, 'lantern', [0.34, 0.7, 0.1], [0.1, 0.1, 0.1]);
  if (look.prop === 'beads') box(world, g, 'flower', [0.34, 0.9, 0.08], [0.12, 0.08, 0.08]);
  if (look.prop === 'wood') box(world, g, 'wood', [0.36, 0.62, 0.12], [0.08, 0.28, 0.08]);
  g.userData.baseY = 0;
  return g;
}

function swallow(world, parent) {
  const g = new THREE.Group();
  parent.add(g);
  box(world, g, 'dark', [0, 0, 0], [0.22, 0.1, 0.36]);
  box(world, g, 'cream', [-0.16, 0.02, 0], [0.18, 0.04, 0.12]);
  box(world, g, 'cream', [0.16, 0.02, 0], [0.18, 0.04, 0.12]);
  return g;
}

export function createStoryScene(world) {
  const root = new THREE.Group();
  root.name = 'valley-story';
  world.scene.add(root);
  const mistMat = new THREE.MeshBasicMaterial({
    color: '#f4e4d2',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(42, 42), mistMat);
  mist.rotation.x = -Math.PI / 2;
  mist.position.y = 0.42;
  mist.renderOrder = 2;
  root.add(mist);
  const riverMat = mistMat.clone();
  const river = new THREE.Mesh(new THREE.PlaneGeometry(5, 30), riverMat);
  river.rotation.x = -Math.PI / 2;
  river.position.set(4, 0.5, 0);
  river.renderOrder = 3;
  root.add(river);
  const flowMat = new THREE.MeshBasicMaterial({
    color: '#d5f3f6',
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const flow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 28), flowMat);
  flow.rotation.x = -Math.PI / 2;
  flow.position.set(4, 0.08, 0);
  root.add(flow);
  if (world.mats && !world.mats['paper-lantern']) world.mats['paper-lantern'] = world.mats.lantern;

  const api = {
    root,
    signature: '',
    site: null,
    targets: [],
    apply(state, look) {
      paint(world, api, state, look);
    },
    tick(dt, height) {
      flow.position.z = Math.sin(world.time * (api.flowSpeed || 0.2)) * 0.2;
      const above = height >= 12;
      mist.position.y = above ? -2 : 0.42;
      river.position.y = above ? -2 : 0.5;
      if (api.bird) {
        const t = world.time * 0.6;
        api.bird.position.set(Math.cos(t) * 1.1, 1.5 + Math.sin(t * 2) * 0.2, Math.sin(t) * 1.1);
      }
    },
    dispose() {
      clearTargets(world, api);
      world.scene.remove(root);
    },
  };
  return api;
}

function clearTargets(world, api) {
  for (const target of api.targets) target.labelElement?.remove();
  const ids = new Set(api.targets.map((target) => target.id));
  world.targets = world.targets.filter((target) => !ids.has(target.id));
  world.pickMeshes = world.pickMeshes.filter((mesh) => !ids.has(mesh.userData.targetId));
  api.targets = [];
}

function addTarget(world, api, object, spec) {
  const target = world.target(object, { ...spec, story: true, type: 'story' });
  api.targets.push(target);
  return target;
}

function paint(world, api, state, look) {
  const travel = state?.travel;
  const story = travel?.story || {};
  const site = observatorySite(travel, state?.blocks || []);
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
  ].join('|');
  if (sign !== api.signature) {
    api.signature = sign;
    api.site = site;
    clearTargets(world, api);
    while (api.cast) {
      api.root.remove(api.cast);
      api.cast = null;
    }
    api.cast = new THREE.Group();
    api.root.add(api.cast);
    buildCast(world, api, state, look);
    if (story.fogIntro) buildObservatory(world, api, story, look);
    if (look?.zones?.water) buildWharf(world, api);
    if (look?.zones?.light) buildScreen(world, api);
    if (look?.zones?.sky) buildGuest(world, api);
    if (story.festival) buildFestival(world, api);
    if (world.labelOnClick) world.createLabels(world.labelOnClick);
  }
  const show = Boolean(look?.visible) && !look?.above;
  api.root.children.forEach((child) => {
    if (child.material?.opacity !== undefined && (child === api.root.children[0] || child === api.root.children[1])) {
      /* mist planes are the first two */
    }
  });
  const mist = api.root.children[0];
  const river = api.root.children[1];
  const flow = api.root.children[2];
  if (mist?.material) {
    mist.material.color.set(look?.color || '#f4e4d2');
    mist.material.opacity = show ? Math.min(0.5, (look?.density || 0) * 28) : 0;
  }
  if (river?.material) {
    const waterFog = show && look?.zones && !look.zones.water;
    river.material.color.set(look?.warm ? '#f7efe4' : '#c5d0d8');
    river.material.opacity = waterFog ? (look?.warm ? 0.46 : 0.58) : 0;
  }
  if (flow?.material) {
    const moving = Boolean(story.fogIntro);
    flow.material.opacity = moving ? (look?.zones?.water ? 0.45 : 0.18) : 0;
    api.flowSpeed = look?.zones?.water ? 0.85 : 0.22;
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

function buildCast(world, api, state, look) {
  const parent = api.cast;
  const dock = world.dockSite;
  const spots = {
    boatman: dock ? { x: 0.4, z: dock.z + 1.6 } : { x: 0.4, z: 12 },
    aunt: { x: -7.2, z: 17.4 },
    grandma: { x: 1.2, z: -6.2 },
    mumu: { x: 12.2, z: 1.2 },
    swallow: api.site ? { x: api.site.x + 1.4, z: api.site.z + 1.2 } : { x: -11, z: 2 },
  };
  const looks = {
    boatman: { cloth: 'dark', skin: 'cream', hat: 'wood', prop: 'bell' },
    aunt: { cloth: 'balloon', skin: 'cream', hat: 'leaf' },
    grandma: { cloth: 'flower', skin: 'cream', prop: 'beads' },
    mumu: { cloth: 'wood', skin: 'cream', prop: 'wood' },
  };
  for (const personSpec of VALLEY_CAST) {
    if (personSpec.id === 'swallow') continue;
    const spot = spots[personSpec.id];
    const group = new THREE.Group();
    group.position.set(spot.x, 0, spot.z);
    parent.add(group);
    person(world, group, looks[personSpec.id] || {});
    addTarget(world, api, group, {
      id: `story-${personSpec.id}`,
      storyId: personSpec.id,
      name: personSpec.name,
      label: personSpec.label,
      action: personSpec.action,
      position: group.position,
    });
  }
  const birdHome = new THREE.Group();
  parent.add(birdHome);
  api.bird = swallow(world, birdHome);
  const perch = spots.swallow;
  birdHome.position.set(perch.x, 1.2, perch.z);
  if (state?.travel?.story?.fogIntro) {
    addTarget(world, api, birdHome, {
      id: 'story-swallow',
      storyId: 'swallow',
      name: '观察员小燕',
      label: '小燕',
      action: '看纸船',
      position: birdHome.position,
    });
  }
}

function buildObservatory(world, api, story, look) {
  const site = api.site;
  const g = new THREE.Group();
  g.position.set(site.x, 0, site.z);
  api.cast.add(g);
  box(world, g, 'stone', [0, 0.18, 0], [3.2, 0.28, 3.2]);
  box(world, g, 'stone', [-1.2, 0.9, -1.2], [0.28, 1.3, 0.28]);
  box(world, g, 'stone', [1.2, 0.55, 1.1], [0.24, 0.7, 0.24]);
  box(world, g, 'wood', [0, 0.55, -1.35], [1.4, 0.16, 0.2]);
  const diskMat = new THREE.MeshStandardMaterial({ color: '#6d7580', roughness: 0.8, metalness: 0.08 });
  const disk = world.mesh(g, new THREE.CylinderGeometry(0.72, 0.78, 0.12, 16), diskMat, [0, 0.46, 0.15]);
  disk.material.emissive = new THREE.Color('#d7e4ff');
  disk.material.emissiveIntensity = look?.icon ? 0.35 : 0.12;
  const restored = new Set(story.restored || []);
  const colors = ['#7eb7d8', '#e0a35a', '#6a7fd0', '#f4efe4'];
  const flags = [restored.has('water'), restored.has('light'), restored.has('sky'), restored.has('all')];
  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2 - Math.PI / 2;
    const slot = world.mesh(
      g,
      new THREE.CylinderGeometry(0.1, 0.12, 0.06, 8),
      new THREE.MeshStandardMaterial({
        color: flags[i] ? colors[i] : '#3d4450',
        emissive: flags[i] ? colors[i] : '#000000',
        emissiveIntensity: flags[i] ? 0.7 : 0,
        roughness: 0.45,
      }),
      [Math.cos(angle) * 0.38, 0.56, 0.15 + Math.sin(angle) * 0.38],
    );
    slot.name = `slot-${i}`;
  }
  const fifth = world.mesh(
    g,
    new THREE.CylinderGeometry(0.08, 0.08, 0.05, 8),
    new THREE.MeshStandardMaterial({
      color: restored.has('all') ? '#fff1c2' : '#2c3138',
      emissive: restored.has('all') ? '#ffe7a0' : '#000000',
      emissiveIntensity: restored.has('all') ? 0.9 : 0.02,
      roughness: 0.4,
    }),
    [0.62, 0.56, 0.15],
  );
  fifth.name = 'slot-five';
  if (look?.zones?.sky) {
    const stars = new THREE.Group();
    g.add(stars);
    for (let i = 0; i < 8; i += 1) {
      const star = world.mesh(
        stars,
        new THREE.SphereGeometry(0.05, 6, 6),
        new THREE.MeshBasicMaterial({ color: '#fff6d0' }),
        [Math.cos(i) * 1.3, 2.4 + (i % 3) * 0.18, Math.sin(i) * 1.1],
      );
      star.name = `star-${i}`;
    }
    const panel = world.mesh(
      g,
      new THREE.BoxGeometry(0.7, 0.45, 0.06),
      new THREE.MeshStandardMaterial({ color: '#16324a', emissive: '#7ddef0', emissiveIntensity: 0.55, roughness: 0.35 }),
      [0, 1.15, -1.2],
    );
    panel.name = 'star-terminal';
  }
  addTarget(world, api, g, {
    id: 'story-disk',
    storyId: 'disk',
    name: '星河图石盘',
    label: '石盘',
    action: '看石盘',
    position: g.position,
  });
}

function buildWharf(world, api) {
  const dock = world.dockSite;
  if (!dock) return;
  const g = new THREE.Group();
  g.position.set(dock.x + 2.3, 0, dock.z);
  api.cast.add(g);
  box(world, g, 'wood', [0, 0.16, 0], [1.1, 0.16, 0.8]);
  box(world, g, 'wood', [0, 0.7, 0], [0.08, 0.9, 0.08]);
  box(world, g, 'lantern', [0, 1.15, 0], [0.22, 0.28, 0.22]);
  addTarget(world, api, g, {
    id: 'story-wharf',
    storyId: 'wharf',
    name: '渡口小站台',
    label: '小站台',
    action: '做纸灯笼',
    position: g.position,
  });
}

function buildScreen(world, api) {
  const g = new THREE.Group();
  g.position.set(8.2, 0, -8.2);
  api.cast.add(g);
  box(world, g, 'wood', [-0.8, 0.7, 0], [0.12, 1.3, 0.12]);
  box(world, g, 'wood', [0.8, 0.7, 0], [0.12, 1.3, 0.12]);
  const screen = world.mesh(
    g,
    new THREE.BoxGeometry(1.5, 0.9, 0.08),
    new THREE.MeshStandardMaterial({ color: '#f7f1e4', emissive: '#f0d48a', emissiveIntensity: 0.35, roughness: 0.7 }),
    [0, 0.95, 0],
  );
  screen.name = 'screen-wall';
  addTarget(world, api, g, {
    id: 'story-screen',
    storyId: 'screen',
    name: '露天放映墙',
    label: '放映墙',
    action: '看一看',
    position: g.position,
  });
}

function buildGuest(world, api) {
  const g = new THREE.Group();
  g.position.set(-1.2, 0, 17.2);
  api.cast.add(g);
  person(world, g, { cloth: 'mint', skin: 'cream', hat: 'leaf' });
  addTarget(world, api, g, {
    id: 'story-gugu',
    storyId: 'gugu',
    name: '小咕',
    label: '小咕',
    action: '打招呼',
    position: g.position,
  });
}

function buildFestival(world, api) {
  const site = api.site || { x: -13, z: 2 };
  const guests = [
    { id: 'ri', name: '日谷的朋友', x: -1.4, color: 'flower' },
    { id: 'mei', name: '美谷的朋友', x: 0, color: 'balloon' },
    { id: 'xing', name: '外星谷的朋友', x: 1.4, color: 'mint' },
  ];
  for (const guest of guests) {
    const g = new THREE.Group();
    g.position.set(site.x + guest.x, 0, site.z + 2.2);
    api.cast.add(g);
    person(world, g, { cloth: guest.color, skin: 'cream' });
    box(world, g, 'lantern', [0, 1.7, 0], [0.16, 0.2, 0.16]);
    addTarget(world, api, g, {
      id: `story-guest-${guest.id}`,
      storyId: 'festival',
      name: guest.name,
      label: guest.name,
      action: '打招呼',
      position: g.position,
    });
  }
}
