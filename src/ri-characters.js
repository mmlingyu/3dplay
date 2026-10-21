/** Six-head-tall day-valley people. 1 voxel = 0.075 grid units. */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V = 0.075;

function put(list, color, x, y, z, w, h, d) {
  list.push({ color, x, y, z, w, h, d });
}

function mergeList(world, list, { shadow = false } = {}) {
  const group = new THREE.Group();
  const buckets = new Map();
  for (const box of list) {
    const geometry = new THREE.BoxGeometry(box.w * V, box.h * V, box.d * V);
    geometry.translate((box.x + box.w / 2) * V, (box.y + box.h / 2) * V, (box.z + box.d / 2) * V);
    const bucket = buckets.get(box.color) || [];
    bucket.push(geometry);
    buckets.set(box.color, bucket);
  }
  for (const [color, geos] of buckets) {
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (geos.length > 1) geos.forEach((geometry) => geometry.dispose());
    const mesh = new THREE.Mesh(merged, world.matColor(color));
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

function partAt(world, list, y0) {
  const local = list.map((box) => ({ ...box, y: box.y - y0 }));
  const group = mergeList(world, local, { shadow: true });
  group.position.y = y0 * V;
  return group;
}

function koharuParts() {
  const body = [];
  const head = [];
  const arm = [];
  put(body, '#2b2e38', -1.3, 0, -1.1, 1.2, 2, 2.2);
  put(body, '#2b2e38', 0.2, 0, -1.1, 1.2, 2, 2.2);
  put(body, '#2b2e38', -1.2, 2, -1.2, 1.1, 9, 2.4);
  put(body, '#2b2e38', 0.2, 2, -1.2, 1.1, 9, 2.4);
  put(body, '#26375e', -2.3, 11, -1.6, 4.6, 8, 3.2);
  put(body, '#f4f1ea', -0.15, 11.4, 1.5, 0.3, 7, 0.2);
  put(body, '#7a5236', 1.6, 8, 0.4, 1.5, 2.2, 1.6);
  put(arm, '#26375e', 0, 0, 0, 1.3, 7.2, 1.3);
  put(head, '#e8c4a0', -1.7, 0, -1.6, 3.4, 3.2, 3.2);
  put(head, '#1e1e28', -2, 2.2, -1.8, 4, 1.8, 3.6);
  put(head, '#1e1e28', -1.8, 1.2, -1.9, 3.6, 1.2, 0.6);
  put(head, '#243028', -0.9, 1.5, 1.3, 0.4, 0.45, 0.3);
  put(head, '#243028', 0.5, 1.5, 1.3, 0.4, 0.45, 0.3);
  put(head, '#3a3f4a', -2.3, -0.4, -0.4, 4.6, 0.8, 0.8);
  put(head, '#3fd0e0', 1.8, -0.3, 0.2, 0.45, 0.45, 0.3);
  return { body, head, arm, neck: 20 };
}

function azeParts() {
  const body = [];
  const head = [];
  const arm = [];
  const tail = [];
  put(body, '#3a342c', -1.6, 0, -1.3, 1.4, 2, 2.6);
  put(body, '#3a342c', 0.3, 0, -1.3, 1.4, 2, 2.6);
  put(body, '#4a4f3a', -1.7, 2, -1.5, 1.5, 9, 3);
  put(body, '#4a4f3a', 0.3, 2, -1.5, 1.5, 9, 3);
  put(body, '#6e6e6a', -2.4, 11, -1.8, 4.8, 9, 3.6);
  put(body, '#8a7560', -0.4, 12, 1.6, 0.8, 0.5, 0.3);
  put(arm, '#6e6e6a', 0, 0, 0, 1.4, 8, 1.4);
  put(head, '#8a7560', -2, 0, -1.8, 4, 4.2, 3.6);
  put(head, '#3a3029', -2.1, 1.2, 0.6, 4.2, 1.6, 1.4);
  put(head, '#f1ede6', -0.8, 0.3, 1.4, 1.6, 1.1, 0.8);
  put(head, '#243028', -1, 2.2, 1.5, 0.45, 0.5, 0.3);
  put(head, '#243028', 0.6, 2.2, 1.5, 0.45, 0.5, 0.3);
  put(head, '#8a7560', -1.6, 4, -0.6, 1.1, 2.4, 0.8);
  put(head, '#8a7560', 0.6, 4, -0.6, 1.1, 2.4, 0.8);
  put(tail, '#8a7560', 0, 0, 0, 1.1, 1.1, 2.4);
  put(tail, '#3a3029', 0, 0, 1.6, 1.1, 1.1, 1.2);
  return { body, head, arm, tail, neck: 20 };
}

function mikoParts() {
  const body = [];
  const head = [];
  const arm = [];
  const tail = [];
  const hat = [];
  put(body, '#1a1c22', -1.3, 0, -1.2, 1.2, 2, 2.4);
  put(body, '#1a1c22', 0.2, 0, -1.2, 1.2, 2, 2.4);
  put(body, '#1e2a48', -1.5, 2, -1.4, 1.4, 9, 2.8);
  put(body, '#1e2a48', 0.2, 2, -1.4, 1.4, 9, 2.8);
  put(body, '#1e2a48', -2.2, 11, -1.7, 4.4, 9, 3.4);
  put(body, '#c9a048', -0.9, 14, 1.55, 0.45, 0.45, 0.25);
  put(body, '#c9a048', 0.45, 14, 1.55, 0.45, 0.45, 0.25);
  put(body, '#c9a048', -1.5, 18.2, 0.2, 0.7, 0.35, 1.2);
  put(body, '#c9a048', 0.8, 18.2, 0.2, 0.7, 0.35, 1.2);
  put(arm, '#1e2a48', 0, 0, 0, 1.3, 7.5, 1.3);
  put(head, '#f1ede6', -1.8, 0, -1.7, 3.6, 3.4, 3.4);
  put(head, '#d98a3c', -1.8, 1.6, -1.2, 1.6, 1.8, 1.4);
  put(head, '#2a2624', 0.4, 1.4, -0.4, 1.4, 1.6, 1.6);
  put(head, '#243028', -0.8, 1.6, 1.4, 0.4, 0.45, 0.25);
  put(head, '#243028', 0.45, 1.6, 1.4, 0.4, 0.45, 0.25);
  put(head, '#f1ede6', -1.3, 3.2, -0.5, 0.9, 1.5, 0.7);
  put(head, '#2a2624', 0.4, 3.2, -0.5, 0.9, 1.5, 0.7);
  put(hat, '#1e2a48', -1.8, 0, -1.6, 3.6, 1.3, 3.2);
  put(hat, '#c9a048', -1.9, 1.1, -1.7, 3.8, 0.35, 3.4);
  put(tail, '#f1ede6', 0, 0, 0, 1, 1, 1.4);
  put(tail, '#d98a3c', 0, 0, 1.2, 1, 1, 1);
  put(tail, '#2a2624', 0, 0, 2, 1, 1,1, 0.8);
  return { body, head, arm, tail, hat, neck: 20 };
}

function elderParts() {
  const body = [];
  const head = [];
  put(body, '#3d4c63', -1.4, 0, -1.2, 1.3, 2, 2.4);
  put(body, '#3d4c63', 0.2, 0, -1.2, 1.3, 2, 2.4);
  put(body, '#d8d2c8', -1.8, 2, -1.5, 3.6, 9, 3);
  put(body, '#c47a60', -1.5, 6, 1.2, 3, 4.2, 0.5);
  put(body, '#d9dde2', -1.7, 11, -1.6, 3.4, 6, 3.2);
  put(head, '#e6c2a4', -1.6, 0, -1.5, 3.2, 3, 3);
  put(head, '#d9dde2', -1.8, 1.8, -1.7, 3.6, 1.8, 3.4);
  put(head, '#d9dde2', -0.5, 3.2, -0.6, 1, 1.3, 1);
  put(head, '#243028', -0.7, 1.3, 1.2, 0.35, 0.4, 0.25);
  put(head, '#243028', 0.4, 1.3, 1.2, 0.35, 0.4, 0.25);
  return { body, head, neck: 17 };
}

function assemble(world, id, parts, extras = {}) {
  const root = new THREE.Group();
  const body = mergeList(world, parts.body, { shadow: true });
  const head = partAt(world, parts.head, parts.neck);
  root.add(body, head);
  const info = { id, body, head, phase: id.length };
  if (parts.arm) {
    const arm = mergeList(world, parts.arm, { shadow: true });
    arm.position.set(1.15 * V * 2.2, (parts.neck - 1) * V, 0);
    root.add(arm);
    info.arm = arm;
  }
  if (parts.tail) {
    const tail = mergeList(world, parts.tail);
    tail.position.set(0, 8 * V, -1.6 * V);
    root.add(tail);
    info.tail = tail;
  }
  if (parts.hat) {
    const hat = partAt(world, parts.hat, 25);
    root.add(hat);
    info.hat = hat;
  }
  Object.assign(info, extras);
  root.userData.figure = info;
  return root;
}

export function buildKoharu(world) {
  const root = assemble(world, 'koharu', koharuParts());
  const camera = new THREE.Group();
  world.cube(camera, '#2a2e33', [0, 0, 0], [0.28, 0.16, 0.12]);
  world.cube(camera, '#9fc6d9', [0, 0, 0.08], [0.12, 0.1, 0.06]);
  camera.position.set(0.42, 1.15, 0.2);
  root.add(camera);
  root.userData.figure.prop = camera;
  return root;
}

export function buildAze(world) {
  const root = assemble(world, 'ponta', azeParts());
  const crane = new THREE.Group();
  world.cube(crane, '#e9e4d8', [0, 0, 0], [0.22, 0.08, 0.22]);
  crane.position.set(0.46, 1.05, 0.28);
  root.add(crane);
  root.userData.figure.crane = crane;
  return root;
}

export function buildMiko(world) {
  const root = assemble(world, 'miko', mikoParts());
  const whistle = new THREE.Group();
  world.cube(whistle, '#c9a048', [0, 0, 0], [0.08, 0.08, 0.14]);
  whistle.position.set(0.28, 1.25, 0.22);
  root.add(whistle);
  root.userData.figure.prop = whistle;
  return root;
}

export function buildElder(world) {
  return assemble(world, 'kozo-elder', elderParts());
}

export function buildDenden(world) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  world.cube(body, '#f4f1ea', [0, 0.72, 0], [0.62, 0.7, 0.48]);
  world.cube(body, '#f7f4ef', [0, 0.28, 0], [0.22, 0.36, 0.22]);
  world.cube(body, '#d9d4cc', [-0.18, 0.16, 0], [0.12, 0.12, 0.16]);
  world.cube(body, '#d9d4cc', [0.18, 0.16, 0], [0.12, 0.12, 0.16]);
  const seamMat = new THREE.MeshStandardMaterial({ color: '#c8402a', emissive: '#ff4a3a', emissiveIntensity: 0.7, roughness: 0.45 });
  const seam = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.05, 0.5), seamMat);
  seam.position.set(0, 0.95, 0);
  const seam2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.5), seamMat);
  seam2.position.set(0, 0.72, 0);
  body.add(seam, seam2);
  const head = new THREE.Group();
  world.cube(head, '#f7f4ef', [0, 0.16, 0], [0.46, 0.28, 0.4]);
  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.16, 0.08),
    new THREE.MeshStandardMaterial({ color: '#ffb25e', emissive: '#ffb25e', emissiveIntensity: 0.9, roughness: 0.4 }),
  );
  glow.position.set(0, 0.16, 0.18);
  head.add(glow);
  head.position.y = 1.12;
  const lid = new THREE.Group();
  world.cube(lid, '#c8402a', [0, 0.08, 0], [0.5, 0.12, 0.44]);
  lid.position.set(0, 1.28, -0.02);
  root.add(body, head, lid);
  root.userData.figure = { id: 'denden', body, head, lid, seam: seamMat, phase: 2 };
  return root;
}

const BUILDERS = {
  koharu: buildKoharu,
  ponta: buildAze,
  miko: buildMiko,
  'kozo-elder': buildElder,
  denden: buildDenden,
};

export function attachFigure(world, parent, id) {
  const build = BUILDERS[id] || buildKoharu;
  const figure = build(world);
  parent.add(figure);
  world.figures = world.figures || [];
  world.figures.push(figure);
  return figure;
}

export function stepFigures(figures, time, player) {
  if (!figures) return;
  for (const fig of figures) {
    const info = fig.userData.figure;
    if (!info) continue;
    const spot = fig.getWorldPosition(stepFigures._p);
    const near = player && Math.hypot(spot.x - player.x, spot.z - player.z) < 2.7;
    const special = !info.force && Math.floor(time + info.phase) % 9 === 0;
    const mode = info.force || (near ? 'talk' : (special ? 'special' : 'idle'));
    const bob = Math.sin(time * 2 + info.phase) * (mode === 'idle' ? 0.025 : 0.012);
    if (info.body) info.body.position.y = bob;
    if (info.head) {
      info.head.rotation.x = mode === 'talk' ? Math.sin(time * 5) * 0.14 : 0;
      info.head.rotation.y = mode === 'idle' ? Math.sin(time * 0.7 + info.phase) * 0.28 : 0.05;
    }
    if (info.arm) info.arm.rotation.x = mode === 'talk' ? -0.9 : (mode === 'special' && info.id === 'koharu' ? -1.25 : -0.2);
    if (info.tail) info.tail.rotation.z = Math.sin(time * 1.6 + info.phase) * 0.35;
    if (info.lid) info.lid.rotation.x = mode === 'special' || mode === 'talk' ? -0.65 : Math.sin(time) * 0.04;
    if (info.seam) info.seam.emissiveIntensity = 0.35 + (mode === 'talk' ? 0.5 : 0.25) * (0.5 + 0.5 * Math.sin(time * 4));
    if (info.crane) {
      const fly = mode === 'special';
      info.crane.position.y = fly ? 1.35 + Math.sin(time * 6) * 0.18 : 1.05;
      info.crane.position.z = fly ? 0.45 : 0.28;
      info.crane.rotation.z = fly ? Math.sin(time * 5) * 0.4 : 0;
    }
    if (info.hat) info.hat.rotation.x = mode === 'special' ? -0.28 : 0;
    if (info.prop && info.id === 'miko' && mode === 'special') info.prop.position.y = 1.38;
    else if (info.prop && info.id === 'miko') info.prop.position.y = 1.25;
  }
}

stepFigures._p = new THREE.Vector3();
