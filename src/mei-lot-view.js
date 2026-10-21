/** Beauty-valley lot scenery. Static pieces share one mesh so the smooth preset stays light. */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  LOT_SITES,
  STAR_COUNT,
  litStarCount,
  madeTokens,
  partSite,
  projectorStatus,
  readTour,
} from './mei-lot.js';

const MADE_COLOR = Object.freeze({
  'windmill-mini': '#d7c48a',
  'paper-plane': '#f4efe4',
  quilt: '#c46b6b',
  'pumpkin-lantern': '#e08a3c',
  'thanks-card': '#f3e2c4',
  'log-wall': '#a56b42',
  film: '#d9963a',
  star: '#ffe3a3',
});

function paint(geometry, hex) {
  const color = new THREE.Color(hex);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function box(parts, w, h, d, x, y, z, hex, rotY = 0) {
  const geometry = new THREE.BoxGeometry(w, h, d);
  if (rotY) geometry.rotateY(rotY);
  geometry.translate(x, y + h / 2, z);
  parts.push(paint(geometry, hex));
}

function at(parts, ox, oz, draw) {
  const local = [];
  draw(local);
  for (const geometry of local) {
    geometry.translate(ox, 0, oz);
    parts.push(geometry);
  }
}

export function mountMeiLot(world) {
  world.scene.background = new THREE.Color('#f0e2c4');
  world.scene.fog = new THREE.FogExp2('#e6d2ae', 0.015);
  const parts = [];
  hillSign(parts);
  cinema(parts);
  stage(parts);
  street(parts);
  western(parts);
  bridge(parts);
  rabbit(parts);
  walk(parts);
  const geometry = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.08 }));
  mesh.userData.live = true;
  world.scene.add(mesh);

  const lot = {
    mesh,
    bulbs: bulbs(world),
    stars: stars(world),
    beams: beams(world),
    ship: ship(world),
    parts: placeParts(world),
    faces: pumpkinFaces(world),
    shipT: -1,
  };
  world.lot = lot;
  addPeople(world);
  pickers(world);
  return lot;
}

function hillSign(parts) {
  const { x, z } = LOT_SITES.sign;
  at(parts, x, z, (local) => {
    box(local, 9.2, 1.1, 3.4, 0, 0, 0, '#6a5344');
    box(local, 7.4, 1.3, 2.6, 0, 1.1, 0.1, '#7b624f');
    box(local, 5.6, 0.7, 2.2, 0, 2.4, 0.15, '#8a705c');
    const y = 3.05;
    const letterZ = 1.55;
    box(local, 8.4, 3.5, 0.22, 0.3, y, letterZ - 0.45, '#2c241c');
    box(local, 0.42, 3.1, 0.42, -2.55, y, letterZ, '#f7f4ef');
    box(local, 0.42, 3.1, 0.42, -1.35, y, letterZ, '#f7f4ef');
    box(local, 1.7, 0.42, 0.42, -1.95, y, letterZ, '#f7f4ef');
    box(local, 1.55, 0.38, 0.4, 0.05, y + 2.55, letterZ, '#f7f4ef');
    box(local, 1.55, 0.38, 0.4, 0.05, y + 1.35, letterZ, '#f7f4ef');
    box(local, 1.55, 0.38, 0.4, 0.05, y, letterZ, '#f7f4ef');
    box(local, 0.36, 1.15, 0.4, -0.62, y + 1.7, letterZ, '#f7f4ef');
    box(local, 0.36, 1.15, 0.4, 0.72, y + 0.35, letterZ, '#f7f4ef');
    box(local, 0.4, 3.15, 0.4, 1.85, y, letterZ, '#f7f4ef', 0.22);
    box(local, 0.4, 3.15, 0.4, 3.15, y, letterZ, '#f7f4ef', -0.22);
    box(local, 1.35, 0.36, 0.4, 2.5, y + 1.25, letterZ, '#f7f4ef');
  });
}

function cinema(parts) {
  const { x, z } = LOT_SITES.cinema;
  at(parts, x, z, (local) => {
    box(local, 7.2, 0.28, 4.4, 0, 0, 0, '#c9a048');
    box(local, 6.6, 3.2, 3.8, 0, 0.28, 0.1, '#1f3b36');
    box(local, 5.4, 2.1, 3.2, 0, 3.48, 0.15, '#1f3b36');
    box(local, 3.4, 1.5, 2.4, 0, 5.58, 0.2, '#18312d');
    box(local, 0.55, 3.4, 0.7, 0, 4.4, 1.55, '#c9a048');
    box(local, 6.8, 0.18, 1.3, 0, 3.35, -1.7, '#c9a048');
    box(local, 1.1, 2.2, 0.12, -1.7, 0.4, -2.05, '#f4d8a0');
    box(local, 1.1, 2.2, 0.12, -0.45, 0.4, -2.05, '#f4d8a0');
    box(local, 1.1, 2.2, 0.12, 0.8, 0.4, -2.05, '#f4d8a0');
    box(local, 0.7, 1.2, 0.5, 2.55, 4.6, -0.4, '#c9a048');
    box(local, 0.7, 1.2, 0.5, -2.55, 4.6, -0.4, '#c9a048');
    box(local, 1.4, 0.9, 0.8, 2.2, 1.3, -0.2, '#142824');
  });
}

function stage(parts) {
  const { x, z } = LOT_SITES.stage;
  at(parts, x, z, (local) => {
    box(local, 4.4, 3.6, 5.4, 0, 0, 0, '#8e4a32');
    box(local, 3.6, 1.1, 4.8, 0, 3.6, 0, '#6b4a30');
    box(local, 2.2, 0.7, 3.6, 0, 4.7, 0, '#6b4a30');
    box(local, 0.28, 0.7, 0.28, -1.4, 5.4, -1.2, '#6b4a30');
    box(local, 0.28, 0.7, 0.28, 0, 5.4, 0.4, '#6b4a30');
    box(local, 0.28, 0.7, 0.28, 1.4, 5.4, 1.4, '#6b4a30');
    box(local, 2.2, 2.4, 0.16, 0, 0.2, 2.75, '#3a3d42');
    box(local, 0.35, 0.7, 0.16, -0.35, 3.7, 2.78, '#f4efe4');
    box(local, 0.7, 0.16, 0.16, 0.15, 3.85, 2.78, '#f4efe4');
  });
}

function street(parts) {
  const { x, z } = LOT_SITES.street;
  at(parts, x, z, (local) => {
    for (let i = 0; i < 3; i += 1) {
      const oz = -1.7 + i * 1.7;
      box(local, 0.28, 2.4 + (i % 2) * 0.8, 1.45, -0.9, 0, oz, i === 1 ? '#c8b89a' : '#9a5a3e');
      box(local, 0.2, 0.55, 0.4, -1.05, 0.7, oz, '#3a4250');
      box(local, 0.7, 0.12, 0.5, -1.15, 2.1, oz, '#c9a048');
    }
    for (const ox of [0.15, 0.85]) {
      box(local, 0.16, 2.8, 0.16, ox, 0, -1.7, '#7a5a3a');
      box(local, 0.16, 2.8, 0.16, ox, 0, 0, '#7a5a3a');
      box(local, 0.16, 2.8, 0.16, ox, 0, 1.7, '#7a5a3a');
    }
    box(local, 0.12, 2.2, 0.12, 0.5, 0.4, -0.85, '#7a5a3a', 0.7);
    box(local, 0.12, 2.2, 0.12, 0.5, 0.4, 0.85, '#7a5a3a', -0.7);
    box(local, 0.45, 0.28, 0.35, 0.55, 0, -1.5, '#a89270');
    box(local, 0.45, 0.28, 0.35, 0.7, 0, 1.4, '#a89270');
  });
}

function western(parts) {
  const { x, z } = LOT_SITES.western;
  at(parts, x, z, (local) => {
    for (let i = 0; i < 3; i += 1) {
      const oz = -1.5 + i * 1.5;
      box(local, 0.24, 2.1, 1.25, 0.85, 0, oz, '#6e4a32');
      box(local, 1.15, 0.16, 0.4, 0.7, 2.05, oz, '#8d6548');
    }
    box(local, 0.7, 0.16, 0.7, -0.2, 2.5, 1.5, '#6e4a32');
    box(local, 0.28, 2.5, 0.28, -0.2, 0, 1.5, '#5c4030');
    for (const ox of [-0.55, -1.05]) {
      box(local, 0.14, 2.3, 0.14, ox, 0, -1.5, '#7a5a3a');
      box(local, 0.14, 2.3, 0.14, ox, 0, 0, '#7a5a3a');
      box(local, 0.14, 2.3, 0.14, ox, 0, 1.5, '#7a5a3a');
    }
    box(local, 0.1, 1.8, 0.1, -0.8, 0.3, -0.75, '#7a5a3a', 0.6);
    box(local, 0.4, 0.24, 0.3, -0.7, 0, 0.2, '#a89270');
  });
}

function bridge(parts) {
  const { x, z } = LOT_SITES.bridge;
  at(parts, x, z, (local) => {
    box(local, 0.55, 4.6, 0.55, -4.3, 0, 0, '#c44536');
    box(local, 0.55, 4.6, 0.55, 4.3, 0, 0, '#c44536');
    box(local, 0.9, 0.28, 0.7, -4.3, 4.6, 0, '#a3262a');
    box(local, 0.9, 0.28, 0.7, 4.3, 4.6, 0, '#a3262a');
    box(local, 9.2, 0.22, 0.55, 0, 2.55, 0, '#a3262a');
    box(local, 0.08, 2.3, 0.08, -2.2, 2.7, 0, '#e7d2a8', 0.35);
    box(local, 0.08, 2.3, 0.08, 2.2, 2.7, 0, '#e7d2a8', -0.35);
    box(local, 0.08, 2.1, 0.08, -3.2, 2.7, 0.15, '#e7d2a8', 0.55);
    box(local, 0.08, 2.1, 0.08, 3.2, 2.7, 0.15, '#e7d2a8', -0.55);
  });
}

function rabbit(parts) {
  const { x, z } = LOT_SITES.rabbit;
  at(parts, x, z, (local) => {
    box(local, 1.3, 0.35, 1.3, 0, 0, 0, '#8d8f93');
    box(local, 0.72, 1.15, 0.55, 0, 0.35, 0, '#f4efe8');
    box(local, 0.7, 0.45, 0.16, 0, 0.7, 0.22, '#3d6f8f');
    box(local, 0.62, 0.58, 0.55, 0, 1.5, 0, '#f7f1e6');
    box(local, 0.16, 0.85, 0.16, -0.16, 2.05, 0, '#f7f1e6');
    box(local, 0.16, 0.85, 0.16, 0.16, 2.05, 0, '#f7f1e6');
    box(local, 0.16, 0.22, 0.16, -0.16, 2.9, 0, '#e7b7c0');
    box(local, 0.16, 0.22, 0.16, 0.16, 2.9, 0, '#e7b7c0');
    box(local, 0.18, 0.7, 0.16, 0.42, 1.15, 0.1, '#f4efe8');
    box(local, 0.28, 0.34, 0.28, 0.62, 1.85, 0.15, '#c9a048');
    box(local, 0.18, 0.18, 0.18, 0.62, 2.15, 0.15, '#ffe3a3');
    box(local, 0.14, 0.45, 0.14, -0.38, 0.35, 0, '#f4efe8');
    box(local, 0.14, 0.45, 0.14, 0.28, 0.35, 0.12, '#f4efe8');
  });
}

function walk(parts) {
  const { x, z } = LOT_SITES.stars;
  at(parts, x, z, (local) => {
    box(local, 1.3, 0.06, 6.4, 0, 0, 0, '#2a2624');
    box(local, 0.7, 0.04, 6.1, 0, 0.06, 0, '#3a342c');
  });
}

function bulbs(world) {
  const geo = new THREE.SphereGeometry(0.08, 6, 5);
  const mat = new THREE.MeshStandardMaterial({ color: '#ffe3a3', emissive: '#ffe3a3', emissiveIntensity: 0.2, roughness: 0.4 });
  const count = 28;
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.userData.live = true;
  const dummy = new THREE.Object3D();
  const { x, z } = LOT_SITES.cinema;
  let n = 0;
  for (let i = 0; i < 14; i += 1) {
    dummy.position.set(x - 3.1 + i * 0.48, 3.55, z - 2.15);
    dummy.updateMatrix();
    mesh.setMatrixAt(n, dummy.matrix);
    n += 1;
    dummy.position.set(x, 4.5 + (i % 7) * 0.42, z - 1.9);
    dummy.updateMatrix();
    mesh.setMatrixAt(n, dummy.matrix);
    n += 1;
  }
  mesh.count = n;
  world.scene.add(mesh);
  return mesh;
}

function stars(world) {
  const geo = new THREE.OctahedronGeometry(0.22, 0);
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffe3a3', emissiveIntensity: 0.15, roughness: 0.45, vertexColors: false });
  const mesh = new THREE.InstancedMesh(geo, mat, STAR_COUNT);
  mesh.userData.live = true;
  const made = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), new THREE.MeshStandardMaterial({ roughness: 0.7 }), STAR_COUNT);
  made.userData.live = true;
  const { x, z } = LOT_SITES.stars;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < STAR_COUNT; i += 1) {
    dummy.position.set(x, 0.28, z - 2.6 + i * 0.74);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 0.62;
    dummy.updateMatrix();
    made.setMatrixAt(i, dummy.matrix);
  }
  world.scene.add(mesh, made);
  return { mesh, made };
}

function beams(world) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: '#ffe3a3', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  const geo = new THREE.ConeGeometry(0.55, 5.5, 6, 1, true);
  geo.translate(0, 2.4, 0);
  geo.rotateX(1.15);
  const left = new THREE.Mesh(geo, mat);
  const right = new THREE.Mesh(geo, mat.clone());
  const { x, z } = LOT_SITES.bridge;
  left.position.set(x - 4.3, 4.7, z);
  right.position.set(x + 4.3, 4.7, z);
  group.add(left, right);
  group.visible = false;
  world.scene.add(group);
  return group;
}

function ship(world) {
  const parts = [];
  box(parts, 1.8, 0.35, 0.7, 0, 0.15, 0, '#f4efe4');
  box(parts, 0.7, 0.45, 0.45, -0.2, 0.5, 0, '#8d5a3c');
  box(parts, 0.08, 0.7, 0.08, 0.45, 0.5, 0, '#6d5344');
  const geometry = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
  mesh.position.set(0, 0, -18);
  mesh.visible = false;
  mesh.userData.live = true;
  world.scene.add(mesh);
  return mesh;
}

function placeParts(world) {
  const groups = {};
  for (const part of ['gear', 'lens', 'lamp']) {
    const site = LOT_SITES[part];
    const group = new THREE.Group();
    const color = part === 'lamp' ? '#ffe3a3' : (part === 'lens' ? '#9fc6d9' : '#c9a048');
    world.mesh(group, world.cyl, world.matColor(color), [0, 0.35, 0], [0.22, 0.28, 0.22]);
    group.position.set(site.x, 0, site.z);
    group.userData.live = true;
    world.scene.add(group);
    world.target(group, {
      id: `mei-part-${part}`,
      type: 'mei-part',
      part,
      name: LOT_SITES[part].name,
      label: LOT_SITES[part].name,
      ariaLabel: LOT_SITES[part].name,
      action: '捡起来',
      position: group.position,
    });
    groups[part] = group;
  }
  const tour = new THREE.Group();
  world.mesh(tour, world.cyl, world.matColor('#ffe3a3'), [0, 0.4, 0], [0.26, 0.32, 0.26]);
  tour.position.set(LOT_SITES.lampTour.x, 0, LOT_SITES.lampTour.z);
  tour.visible = false;
  world.scene.add(tour);
  world.target(tour, {
    id: 'mei-part-lamp-tour',
    type: 'mei-part',
    part: 'lamp',
    name: '灯',
    label: '灯',
    ariaLabel: '灯就在旁边',
    action: '捡起来',
    position: tour.position,
  });
  groups.lampTour = tour;
  return groups;
}

function pumpkinFaces(world) {
  const site = LOT_SITES.pumpkin;
  const root = new THREE.Group();
  root.position.set(site.x, 0, site.z);
  const body = new THREE.Group();
  world.mesh(body, world.box, world.matColor('#3a342c'), [-0.12, 0.36, 0], [0.14, 0.66, 0.16]);
  world.mesh(body, world.box, world.matColor('#3a342c'), [0.12, 0.36, 0], [0.14, 0.66, 0.16]);
  world.mesh(body, world.box, world.matColor('#6e4a32'), [0, 1.02, 0], [0.46, 0.62, 0.26]);
  world.mesh(body, world.box, world.matColor('#c45d5d'), [0, 1.05, 0.14], [0.34, 0.28, 0.06]);
  world.mesh(body, world.head, world.matColor('#e07a2f'), [0, 1.58, 0], [0.72, 0.62, 0.72]);
  root.add(body);
  const faces = {};
  for (const id of ['smile', 'cat', 'star']) {
    const face = new THREE.Group();
    if (id === 'smile') {
      world.mesh(face, world.box, world.mats.dark, [-0.1, 1.62, 0.2], [0.08, 0.08, 0.04]);
      world.mesh(face, world.box, world.mats.dark, [0.1, 1.62, 0.2], [0.08, 0.08, 0.04]);
      world.mesh(face, world.box, world.mats.dark, [0, 1.46, 0.2], [0.16, 0.05, 0.04]);
      world.mesh(face, world.box, world.mats.dark, [-0.1, 1.5, 0.2], [0.06, 0.05, 0.04]);
      world.mesh(face, world.box, world.mats.dark, [0.1, 1.5, 0.2], [0.06, 0.05, 0.04]);
    } else if (id === 'cat') {
      world.mesh(face, world.box, world.matColor('#e07a2f'), [-0.12, 1.82, 0.02], [0.1, 0.16, 0.08]);
      world.mesh(face, world.box, world.matColor('#e07a2f'), [0.12, 1.82, 0.02], [0.1, 0.16, 0.08]);
      world.mesh(face, world.box, world.mats.dark, [-0.08, 1.6, 0.2], [0.1, 0.04, 0.04], );
      world.mesh(face, world.box, world.mats.dark, [0.08, 1.6, 0.2], [0.1, 0.04, 0.04]);
      world.mesh(face, world.box, world.mats.dark, [0, 1.5, 0.2], [0.05, 0.05, 0.04]);
    } else {
      world.mesh(face, world.box, world.matColor('#ffe3a3'), [0, 1.58, 0.2], [0.16, 0.16, 0.04]);
      world.mesh(face, world.box, world.matColor('#ffe3a3'), [0, 1.58, 0.2], [0.08, 0.28, 0.05]);
    }
    face.visible = id === 'smile';
    root.add(face);
    faces[id] = face;
  }
  world.scene.add(root);
  world.target(root, {
    id: 'tutor-pumpkin-head',
    type: 'lot',
    panel: 'pumpkin-head',
    name: '南瓜头',
    label: '南瓜头',
    ariaLabel: '南瓜头',
    action: '说说话',
    position: root.position,
  });
  return faces;
}

function addPeople(world) {
  cameraBot(world);
  rudy(world);
}

function cameraBot(world) {
  const site = LOT_SITES.kacha;
  const g = new THREE.Group();
  world.mesh(g, world.box, world.matColor('#b58a3c'), [-0.28, 0.55, 0.12], [0.08, 1.05, 0.08]);
  world.mesh(g, world.box, world.matColor('#b58a3c'), [0.28, 0.55, 0.12], [0.08, 1.05, 0.08]);
  world.mesh(g, world.box, world.matColor('#b58a3c'), [0, 0.5, -0.28], [0.08, 0.95, 0.08]);
  world.mesh(g, world.box, world.matColor('#1c1c1e'), [0, 1.25, 0], [0.62, 0.42, 0.4]);
  const lens = world.mesh(g, world.cyl, world.matColor('#203040'), [0, 1.28, 0.32], [0.2, 0.18, 0.2]);
  lens.material = new THREE.MeshStandardMaterial({ color: '#203040', emissive: '#d9963a', emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.4 });
  world.mesh(g, world.cyl, world.matColor('#b58a3c'), [-0.28, 1.58, 0], [0.16, 0.06, 0.16]);
  world.mesh(g, world.cyl, world.matColor('#b58a3c'), [0.28, 1.58, 0], [0.16, 0.06, 0.16]);
  world.mesh(g, world.box, world.matColor('#ff3b30'), [0.34, 1.35, 0.16], [0.06, 0.06, 0.06]);
  g.position.set(site.x, 0, site.z);
  world.scene.add(g);
  world.target(g, {
    id: 'tutor-kacha',
    type: 'lot',
    panel: 'stage',
    name: '咔嚓',
    label: '咔嚓',
    ariaLabel: '咔嚓',
    action: '说说话',
    position: g.position,
  });
}

function rudy(world) {
  const site = LOT_SITES.rudy;
  const g = new THREE.Group();
  world.mesh(g, world.box, world.matColor('#2a2a2a'), [-0.1, 0.4, 0], [0.12, 0.75, 0.14]);
  world.mesh(g, world.box, world.matColor('#2a2a2a'), [0.1, 0.4, 0], [0.12, 0.75, 0.14]);
  world.mesh(g, world.box, world.matColor('#6b4a30'), [0, 1.15, 0], [0.48, 0.78, 0.26]);
  world.mesh(g, world.head, world.matColor('#8c8c88'), [0, 1.68, 0], [0.48, 0.5, 0.48]);
  world.mesh(g, world.box, world.matColor('#2a2a2a'), [0, 1.7, 0.08], [0.28, 0.08, 0.06]);
  world.mesh(g, world.box, world.matColor('#1e1e22'), [0.06, 1.88, 0], [0.32, 0.1, 0.32]);
  world.mesh(g, world.box, world.matColor('#8c8c88'), [-0.12, 1.98, 0], [0.08, 0.16, 0.08]);
  world.mesh(g, world.box, world.matColor('#8c8c88'), [0.12, 1.98, 0], [0.08, 0.16, 0.08]);
  world.mesh(g, world.cyl, world.matColor('#c9a048'), [0.32, 1.25, 0.12], [0.08, 0.28, 0.08]);
  const tail = world.mesh(g, world.box, world.matColor('#2a2a2a'), [0, 0.85, -0.28], [0.1, 0.1, 0.35]);
  tail.userData.live = true;
  g.position.set(site.x, 0, site.z);
  world.scene.add(g);
  world.target(g, {
    id: 'tutor-rudy',
    type: 'lot',
    panel: 'stage',
    name: 'Rudy',
    label: 'Rudy',
    ariaLabel: 'Rudy',
    action: '说说话',
    position: g.position,
  });
}

function pickers(world) {
  const specs = [
    ['sign', 'scenery', null, SIGN_LABEL, 2.2],
    ['cinema', 'lot', 'projector', '放映机', 3.2],
    ['stage', 'lot', 'stage', '摄影棚', 2.4],
    ['street', 'lot', 'setback', '看看架子', 1.6],
    ['western', 'lot', 'setback', '看看架子', 1.6],
    ['bridge', 'scenery', null, '吊桥', 1.4],
    ['rabbit', 'scenery', null, '灯塔兔', 1.2],
    ['stars', 'scenery', null, '星光步道', 1.2],
  ];
  for (const [key, type, panel, label, size] of specs) {
    const site = LOT_SITES[key];
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, 1.6, size), world.previewMaterial);
    mesh.visible = false;
    group.add(mesh);
    group.position.set(site.x, 0.8, site.z);
    world.scene.add(group);
    world.target(group, {
      id: `mei-${key}`,
      type,
      panel,
      name: site.name,
      label,
      ariaLabel: key === 'street' || key === 'western' ? `${site.name}，看看架子` : site.name,
      action: label,
      position: group.position,
    });
  }
}

const SIGN_LABEL = '大字';

export function syncMeiLot(world, state) {
  const lot = world.lot;
  if (!lot || !state) return;
  const realm = state.travel?.realms?.mei;
  const status = projectorStatus(realm);
  const tour = status.tour;
  for (const part of ['gear', 'lens', 'lamp']) {
    const got = status[part];
    lot.parts[part].visible = !got && !(tour && part !== 'lamp');
    const target = world.targets.find((item) => item.id === `mei-part-${part}`);
    if (target) target.hidden = !lot.parts[part].visible;
  }
  lot.parts.lampTour.visible = tour && !status.lamp;
  if (tour && lot.parts.lampTour.visible) {
    lot.parts.lamp.visible = false;
    const far = world.targets.find((item) => item.id === 'mei-part-lamp');
    if (far) far.hidden = true;
  }
  const tourTarget = world.targets.find((item) => item.id === 'mei-part-lamp-tour');
  if (tourTarget) tourTarget.hidden = !lot.parts.lampTour.visible;
  const face = realm?.decor?.face || 'smile';
  for (const [id, group] of Object.entries(lot.faces)) group.visible = id === face;
  const lit = litStarCount(state.travel?.stamps);
  const tokens = madeTokens(state);
  const color = new THREE.Color();
  for (let i = 0; i < STAR_COUNT; i += 1) {
    const on = i < lit;
    color.set(on ? '#ffe3a3' : '#4a463c');
    lot.stars.mesh.setColorAt(i, color);
    const token = on ? (tokens[i % Math.max(1, tokens.length)] || 'star') : 'star';
    color.set(on ? (MADE_COLOR[token] || MADE_COLOR.star) : '#2a2624');
    lot.stars.made.setColorAt(i, color);
  }
  lot.stars.mesh.instanceColor.needsUpdate = true;
  lot.stars.made.instanceColor.needsUpdate = true;
  if (state.travel?.via === 'ferry' && world.arrivalShip == null && (state.travel?.current === 'mei')) {
    world.arrivalShip = true;
    lot.ship.visible = true;
    lot.ship.position.set(0, 0, -18.2);
    lot.shipT = 0;
  }
}

export function tickMeiLot(world, dt) {
  const lot = world.lot;
  if (!lot) return;
  const night = world.lotNight || nightNow();
  lot.beams.visible = night;
  lot.bulbs.material.emissiveIntensity = night ? 1.4 : 0.18;
  if (night) {
    const sweep = Math.sin(world.time * 0.7) * 0.7;
    lot.beams.children[0].rotation.y = sweep;
    lot.beams.children[1].rotation.y = -sweep + 0.4;
  }
  if (lot.shipT >= 0) {
    lot.shipT += dt;
    const u = Math.min(1, lot.shipT / 4.2);
    lot.ship.position.z = -18.2 + u * 6.4;
    lot.ship.visible = u < 1;
    if (u >= 1) lot.shipT = -1;
  }
  if (world.scene.fog) {
    world.scene.background?.set(night ? '#1b2233' : '#f0e2c4');
    world.scene.fog.color?.set(night ? '#2a241c' : '#e6d2ae');
  }
}

function nightNow() {
  try {
    const hour = new Date().getHours();
    return hour >= 18 || hour < 5;
  } catch {
    return false;
  }
}

export function frameMeiLot(world, id) {
  const shots = {
    sign: { x: 1.6, y: 5.1, z: 15.2, yaw: 0, distance: 8.4, night: false },
    cinema: { x: LOT_SITES.cinema.x, y: 3.2, z: LOT_SITES.cinema.z, yaw: Math.PI, distance: 9.5, night: true },
    stage: { x: LOT_SITES.stage.x, y: 2.6, z: LOT_SITES.stage.z, yaw: 0, distance: 7.2, night: false },
    back: { x: LOT_SITES.street.x + 0.4, y: 1.8, z: LOT_SITES.street.z, yaw: Math.PI / 2, distance: 8, night: false },
    western: { x: LOT_SITES.western.x - 0.4, y: 1.6, z: LOT_SITES.western.z, yaw: -Math.PI / 2, distance: 8, night: false },
    bridge: { x: 0, y: 2.2, z: LOT_SITES.bridge.z, yaw: 0.4, distance: 16, night: true },
  };
  const shot = shots[id] || shots.sign;
  world.frameShot = shot;
  world.lotNight = !!shot.night;
  return shot;
}

export const LOT_FRAMES = Object.freeze(['sign', 'cinema', 'stage', 'back']);
