/** Low-detail silhouettes. One merged mesh per valley, plus a few moving parts. */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { VISTAS, vistaOpacity, vistaSignals } from './vista-data.js';

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

function box(w, h, d, x, y, z, color) {
  const geometry = new THREE.BoxGeometry(w, h, d);
  geometry.translate(x, y, z);
  return paint(geometry, color);
}

function cone(radius, height, x, y, z, color, segments = 6) {
  const geometry = new THREE.ConeGeometry(radius, height, segments);
  geometry.translate(x, y, z);
  return paint(geometry, color);
}

function sphere(radius, x, y, z, color, sx = 1, sy = 1, sz = 1) {
  const geometry = new THREE.SphereGeometry(radius, 7, 5);
  geometry.scale(sx, sy, sz);
  geometry.translate(x, y, z);
  return paint(geometry, color);
}

function mergeParts(parts) {
  const geometry = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  return geometry;
}

function basic(opacity) {
  return new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
}

function flat(color, opacity) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
}

function addMesh(group, geometry, material, vistaId, pick) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.vistaId = vistaId;
  mesh.frustumCulled = true;
  group.add(mesh);
  if (pick) pick.push(mesh);
  return mesh;
}

export function mountVistas(scene) {
  const group = new THREE.Group();
  group.name = 'vistas';
  const pick = [];
  const materials = [];
  const ri = new THREE.Group();
  ri.position.set(VISTAS.ri.x, VISTAS.ri.y, VISTAS.ri.z);
  const riMat = basic(0.3);
  materials.push(riMat);
  addMesh(ri, mergeParts([
    cone(7.2, 16, 0, 8, 0, '#f7f4ef', 7),
    cone(2.4, 5, 3.2, 4.2, 1.2, '#d9e4ea', 6),
    box(1.5, 7.2, 1.5, -2.4, 3.6, 2.2, '#cbb59a'),
    cone(1.3, 2.2, -2.4, 8.2, 2.2, '#b4533a', 5),
    cone(1.6, 3.4, 4.6, 1.8, -1.4, '#e7a0b4', 6),
    cone(1.3, 2.8, 6.4, 1.5, 0.6, '#f0b7c6', 6),
    cone(1.1, 2.4, 3.4, 1.3, -2.6, '#e08aa6', 5),
  ]), riMat, 'ri', pick);
  const kiteMat = flat('#f6d56a', 0.3);
  const kite = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.8), kiteMat);
  kite.position.set(3.2, 11.5, 1.4);
  kite.userData.vistaId = 'ri';
  ri.add(kite);
  materials.push(kiteMat);
  const lanternMat = flat('#ffd27a', 0.3);
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.45, 6, 5), lanternMat);
  lantern.position.set(-2.4, 6.4, 2.4);
  lantern.userData.vistaId = 'ri';
  ri.add(lantern);
  materials.push(lanternMat);

  const mei = new THREE.Group();
  mei.position.set(VISTAS.mei.x, VISTAS.mei.y, VISTAS.mei.z);
  const meiMat = basic(0.3);
  materials.push(meiMat);
  addMesh(mei, mergeParts([
    box(6.4, 4.2, 4.2, 0, 2.2, 0, '#c45c4a'),
    box(7.2, 1.6, 4.8, 0, 4.8, 0, '#8f3b32'),
    box(0.28, 6.4, 0.28, 4.8, 3.2, 0, '#f2e2c4'),
    cone(1.8, 3.6, -4.2, 1.8, 1.2, '#c4503a', 6),
    cone(1.5, 3, -6.2, 1.5, -0.4, '#d4653a', 6),
    cone(1.3, 2.6, -3.2, 1.3, -1.6, '#b84332', 5),
    cone(1.2, 2.4, -5.4, 1.2, 2.2, '#e07a45', 5),
  ]), meiMat, 'mei', pick);
  const bladeMat = flat('#f7f1e4', 0.3);
  const blades = new THREE.Mesh(mergeParts([
    box(4.6, 0.28, 0.18, 0, 0, 0, '#f7f1e4'),
    box(0.28, 4.6, 0.18, 0, 0, 0, '#f7f1e4'),
  ]), bladeMat);
  blades.position.set(4.8, 6.2, 0.4);
  blades.userData.vistaId = 'mei';
  mei.add(blades);
  materials.push(bladeMat);

  const xing = new THREE.Group();
  xing.position.set(VISTAS.xing.x, VISTAS.xing.y, VISTAS.xing.z);
  const xingMat = basic(0.3);
  materials.push(xingMat);
  addMesh(xing, mergeParts([
    sphere(3.2, 0, 0.4, 0, '#7d8c9a', 1.5, 0.55, 1.1),
    cone(0.7, 2.2, 1.4, 2.2, 0.2, '#b7fff0', 5),
  ]), xingMat, 'xing', pick);
  const crystalMat = flat('#9ef6c9', 0.3);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), crystalMat);
  crystal.position.set(-0.8, 2.4, 0.4);
  crystal.userData.vistaId = 'xing';
  xing.add(crystal);
  materials.push(crystalMat);
  const planetMat = flat('#7eb6e6', 0.3);
  const planet = new THREE.Group();
  planet.position.set(2.4, 7.6, -1.2);
  const planetBall = new THREE.Mesh(new THREE.SphereGeometry(1.15, 8, 6), planetMat);
  planetBall.userData.vistaId = 'xing';
  const ringMat = flat('#e7d7a1', 0.3);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.12, 5, 12), ringMat);
  ring.rotation.x = Math.PI / 2.4;
  ring.userData.vistaId = 'xing';
  planet.add(planetBall, ring);
  xing.add(planet);
  materials.push(planetMat, ringMat);
  pick.push(planetBall);

  const seaMat = flat('#8ebdc0', 0.22);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(96, 42), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-4, 0.03, 46);
  sea.name = 'vista-sea';
  materials.push(seaMat);

  group.add(ri, mei, xing, sea);
  scene.add(group);

  const view = {
    group,
    pick,
    clarity: 0.2,
    opacity: vistaOpacity(0.2),
    signals: vistaSignals(null),
    meshCount: 0,
    update(dt, moment, clarity) {
      view.clarity = clarity;
      const opacity = vistaOpacity(clarity);
      view.opacity = opacity;
      const signals = vistaSignals(moment);
      view.signals = signals;
      for (const material of materials) {
        if (material !== crystalMat && material !== kiteMat && material !== lanternMat) material.opacity = material === seaMat ? 0.12 + clarity * 0.28 : opacity;
      }
      kiteMat.opacity = signals.kite ? opacity : 0.02;
      kite.visible = signals.kite;
      lanternMat.opacity = signals.lantern ? Math.min(1, opacity + 0.2) : 0.02;
      lantern.visible = signals.lantern;
      blades.rotation.z += dt * 1.4;
      crystalMat.opacity = signals.crystal ? opacity * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(performance.now() / 280))) : opacity * 0.22;
      planet.rotation.y += dt * 0.25;
      kite.position.y = 11.5 + Math.sin(performance.now() / 500) * 0.45;
    },
    dispose() {
      scene.remove(group);
      group.traverse((obj) => { obj.geometry?.dispose?.(); });
      for (const material of materials) material.dispose();
    },
  };
  let count = 0;
  group.traverse((obj) => { if (obj.isMesh) { obj.renderOrder = 20; count += 1; } });
  view.meshCount = count;
  return view;
}
