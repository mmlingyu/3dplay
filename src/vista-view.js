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
  group.userData.live = true;
  const pick = [];
  const materials = [];
  const ri = new THREE.Group();
  ri.position.set(VISTAS.ri.x, VISTAS.ri.y, VISTAS.ri.z);
  const riMat = basic(0.3);
  materials.push(riMat);
  addMesh(ri, mergeParts([
    cone(7.4, 14.5, -2.2, 7.2, 0.4, '#f7f4ef', 7),
    cone(2.1, 4, 1.4, 3.2, 1.6, '#e4eef4', 6),
    box(2.1, 1.5, 1.5, 3.6, 0.85, -1.4, '#8d8f93'),
    box(1.5, 2.2, 1.3, 5.8, 1.2, 1.1, '#6e7580'),
    box(0.55, 12.2, 0.55, 4.6, 6.2, -0.4, '#c8402a'),
    box(0.68, 1.15, 0.68, 4.6, 11.6, -0.4, '#f4efe6'),
    box(0.62, 1.2, 0.62, 4.6, 9.4, -0.4, '#f4efe6'),
    box(0.62, 1.2, 0.62, 4.6, 6.6, -0.4, '#f4efe6'),
    box(8.2, 0.16, 0.26, 0.4, 4.5, 2.2, '#8d8f93'),
  ]), riMat, 'ri', pick);
  const kiteMat = flat('#f6d56a', 0.3);
  const kite = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.8), kiteMat);
  kite.position.set(-4.2, 11.2, 1.2);
  kite.userData.vistaId = 'ri';
  ri.add(kite);
  materials.push(kiteMat);
  const lanternMat = flat('#ffd27a', 0.3);
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.42, 6, 5), lanternMat);
  lantern.position.set(-5.4, 2.4, 1.8);
  lantern.userData.vistaId = 'ri';
  const towerTip = new THREE.Mesh(new THREE.SphereGeometry(0.34, 6, 5), lanternMat);
  towerTip.position.set(4.6, 12.6, -0.4);
  towerTip.userData.vistaId = 'ri';
  ri.add(lantern, towerTip);
  materials.push(lanternMat);

  const mei = new THREE.Group();
  mei.position.set(VISTAS.mei.x, VISTAS.mei.y, VISTAS.mei.z);
  const meiMat = basic(0.3);
  materials.push(meiMat);
  addMesh(mei, mergeParts([
    box(7.4, 1.5, 3.2, 0, 1.15, -1.4, '#6a5344'),
    box(5.4, 1.15, 2.4, 0, 2.35, -1.25, '#7b624f'),
    box(0.32, 2.15, 0.32, -2.35, 4.2, -0.55, '#f7f4ef'),
    box(0.32, 2.15, 0.32, -1.25, 4.2, -0.55, '#f7f4ef'),
    box(1.4, 0.28, 0.28, -1.8, 3.25, -0.55, '#f7f4ef'),
    box(1.15, 0.24, 0.26, 0.05, 5.15, -0.55, '#f7f4ef'),
    box(1.15, 0.24, 0.26, 0.05, 4.15, -0.55, '#f7f4ef'),
    box(1.15, 0.24, 0.26, 0.05, 3.15, -0.55, '#f7f4ef'),
    box(0.24, 0.85, 0.26, -0.48, 4.55, -0.55, '#f7f4ef'),
    box(0.24, 0.85, 0.26, 0.58, 3.55, -0.55, '#f7f4ef'),
    box(0.3, 2.2, 0.3, 1.55, 4.15, -0.55, '#f7f4ef'),
    box(0.3, 2.2, 0.3, 2.55, 4.15, -0.55, '#f7f4ef'),
    box(1.15, 0.24, 0.26, 2.05, 4.55, -0.55, '#f7f4ef'),
    box(0.42, 3.3, 0.42, -3.7, 1.7, 2.5, '#c44536'),
    box(0.42, 3.3, 0.42, 3.7, 1.7, 2.5, '#c44536'),
    box(7.8, 0.24, 0.42, 0, 3.15, 2.5, '#a3262a'),
  ]), meiMat, 'mei', pick);
  const beamMat = flat('#ffe3a3', 0.02);
  const beamGeo = new THREE.ConeGeometry(0.38, 3.4, 5, 1, true);
  beamGeo.translate(0, 1.5, 0);
  beamGeo.rotateX(1.05);
  const beamL = new THREE.Mesh(beamGeo, beamMat);
  const beamRMat = flat('#ffe3a3', 0.02);
  const beamR = new THREE.Mesh(beamGeo, beamRMat);
  beamL.position.set(-3.7, 4.5, 2.5);
  beamR.position.set(3.7, 4.5, 2.5);
  beamL.userData.vistaId = 'mei';
  beamR.userData.vistaId = 'mei';
  beamL.visible = false;
  beamR.visible = false;
  mei.add(beamL, beamR);
  materials.push(beamMat, beamRMat);
  pick.push(beamL, beamR);

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
  const gateRingMat = flat('#36E0E8', 0.3);
  const gateRing = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.06, 6, 6), gateRingMat);
  gateRing.rotation.x = Math.PI / 2;
  gateRing.position.set(0.2, 1.15, 0.15);
  gateRing.name = 'vista-star-gate';
  gateRing.userData.vistaId = 'xing';
  xing.add(gateRing);
  materials.push(gateRingMat);

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
        if (material !== crystalMat && material !== kiteMat && material !== lanternMat && material !== gateRingMat) material.opacity = material === seaMat ? 0.12 + clarity * 0.28 : opacity;
      }
      kiteMat.opacity = signals.kite ? opacity : 0.02;
      kite.visible = signals.kite;
      lanternMat.opacity = signals.lantern ? Math.min(1, opacity + 0.2) : 0.02;
      lantern.visible = signals.lantern;
      towerTip.visible = signals.lantern;
      const sweep = signals.searchlight ? Math.sin(performance.now() / 700) * 0.65 : 0;
      beamMat.opacity = signals.searchlight ? Math.min(0.85, opacity + 0.2) : 0.02;
      beamRMat.opacity = beamMat.opacity;
      beamL.visible = !!signals.searchlight;
      beamR.visible = !!signals.searchlight;
      beamL.rotation.y = sweep;
      beamR.rotation.y = -sweep + 0.35;
      crystalMat.opacity = signals.crystal ? opacity * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(performance.now() / 280))) : opacity * 0.22;
      const breathe = 0.5 + 0.5 * Math.sin(performance.now() / 900);
      gateRingMat.opacity = signals.crystal ? opacity * (0.55 + 0.45 * breathe) : opacity * 0.4;
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
