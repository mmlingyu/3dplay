/** Star-net hall. One instanced dome, merged pads, optional particles. */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HOLO_PADS } from './holo-data.js';
import { makeAvatar, makeStarling, makeZero } from './holo-figures.js';

const PAD = 3.4;

function mergedBoxes(list, material) {
  const parts = list.map(([x, y, z, w, h, d]) => {
    const geometry = new THREE.BoxGeometry(w, h, d);
    geometry.translate(x, y, z);
    return geometry;
  });
  const geometry = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

function buildDome() {
  const radius = 32;
  const points = [];
  for (let ring = 0; ring < 7; ring += 1) {
    const phi = ((ring + 0.5) / 7) * Math.PI * 0.46;
    const ringRadius = Math.cos(phi) * radius;
    const count = Math.max(8, Math.round((2 * Math.PI * ringRadius) / 3.4));
    for (let i = 0; i < count; i += 1) {
      const theta = ((i + (ring % 2) * 0.5) / count) * Math.PI * 2;
      points.push({ phi, theta, index: points.length });
    }
  }
  const plate = new THREE.CylinderGeometry(1.2, 1.2, 0.08, 6);
  const frame = new THREE.CylinderGeometry(1.32, 1.32, 0.05, 6);
  const plateMat = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#1A2230', roughness: 0.45, metalness: 0.55 });
  const plates = new THREE.InstancedMesh(plate, plateMat, points.length);
  const frames = new THREE.InstancedMesh(frame, frameMat, points.length);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const color = new THREE.Color();
  points.forEach((item, index) => {
    const normal = new THREE.Vector3(
      Math.cos(item.phi) * Math.cos(item.theta),
      Math.sin(item.phi),
      Math.cos(item.phi) * Math.sin(item.theta),
    );
    quaternion.setFromUnitVectors(up, normal);
    const position = normal.clone().multiplyScalar(radius).add(new THREE.Vector3(0, 2, 0));
    matrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1));
    plates.setMatrixAt(index, matrix);
    matrix.compose(position.clone().addScaledVector(normal, -0.06), quaternion, new THREE.Vector3(1, 1, 1));
    frames.setMatrixAt(index, matrix);
    plates.setColorAt(index, color.set('#36E0E8'));
  });
  plates.instanceColor.needsUpdate = true;
  return { plates, frames, points, gap: Math.floor(points.length * 0.62), plateMat };
}

function buildPads() {
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#2A2E36', roughness: 0.5, metalness: 0.55 });
  const farMat = new THREE.MeshStandardMaterial({ color: '#243044', roughness: 0.6, metalness: 0.4, emissive: new THREE.Color('#36E0E8'), emissiveIntensity: 0.15 });
  const near = [];
  const far = [];
  for (const pad of HOLO_PADS) {
    const list = pad.play ? near : far;
    list.push([pad.x, pad.y + 0.35, pad.z, 7, 0.7, 7]);
    list.push([pad.x, pad.y + 0.9, pad.z, 3.2, 0.35, 3.2]);
  }
  const nearMesh = mergedBoxes(near, bodyMat);
  nearMesh.castShadow = true;
  nearMesh.receiveShadow = true;
  const farMesh = mergedBoxes(far, farMat);
  const beamGeo = new THREE.CylinderGeometry(0.28, 0.45, 1, 8, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: '#FFB347',
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });
  const beams = new THREE.InstancedMesh(beamGeo, beamMat, HOLO_PADS.length);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  HOLO_PADS.forEach((pad, index) => {
    matrix.compose(
      new THREE.Vector3(pad.x, pad.y / 2, pad.z),
      quaternion,
      new THREE.Vector3(1, Math.max(0.2, pad.y), 1),
    );
    beams.setMatrixAt(index, matrix);
  });
  return { nearMesh, farMesh, beams, beamMat, bodyMat };
}

function buildShip() {
  const group = new THREE.Group();
  const armor = new THREE.MeshStandardMaterial({ color: '#3A3F48', roughness: 0.42, metalness: 0.6 });
  const glow = new THREE.MeshStandardMaterial({ color: '#5AC8FF', emissive: new THREE.Color('#5AC8FF'), emissiveIntensity: 1.1, roughness: 0.3 });
  const hull = mergedBoxes([
    [0, 2.2, 0, 4, 2.4, 12],
    [0, 3.6, 3, 2.4, 0.8, 3],
    [-3.2, 2.3, -1, 2, 1.6, 6],
    [3.2, 2.3, -1, 2, 1.6, 6],
  ].map(([x, y, z, w, h, d]) => [x, y, z, w, h, d]), armor);
  const jets = mergedBoxes([
    [-3.2, 2.4, -4.2, 1.2, 1.1, 0.3],
    [3.2, 2.4, -4.2, 1.2, 1.1, 0.3],
  ], glow);
  group.add(hull, jets);
  group.position.set(0, 16.5, 16);
  return { group, glow };
}

function makeSea(count) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const theta = (i / count) * Math.PI * 2 * 7;
    const radius = 6 + (i % 18);
    positions[i * 3] = Math.cos(theta) * radius;
    positions[i * 3 + 1] = -6 - (i % 9) * 0.8;
    positions[i * 3 + 2] = Math.sin(theta) * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: '#36E0E8',
    size: 0.12,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}

export function createHoloLayer() {
  const group = new THREE.Group();
  group.name = 'holo-hall';
  group.visible = false;
  const dome = buildDome();
  const pads = buildPads();
  const ship = buildShip();
  group.add(dome.frames, dome.plates, pads.nearMesh, pads.farMesh, pads.beams, ship.group);
  const avatar = makeAvatar();
  avatar.group.position.set(0, 2, 0);
  group.add(avatar.group);
  const starling = makeStarling();
  starling.group.position.set(1.4, 2, 1.2);
  group.add(starling.group);
  const guide = makeZero();
  guide.group.position.set(-1.6, 2, 1.4);
  group.add(guide.group);
  const echo = makeAvatar();
  echo.group.name = 'holo-echo';
  echo.group.visible = false;
  echo.group.traverse((obj) => {
    if (obj.isMesh && obj.material) {
      obj.material = obj.material.clone();
      obj.material.transparent = true;
      obj.material.opacity = 0.35;
      obj.material.depthWrite = false;
    }
  });
  group.add(echo.group);
  const shard = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.42, 0),
    new THREE.MeshStandardMaterial({ color: '#9ecbff', emissive: new THREE.Color('#7eb6ff'), emissiveIntensity: 0.9, roughness: 0.35 }),
  );
  shard.name = 'holo-shard';
  shard.position.set(0.9, 2.6, 0.2);
  shard.visible = false;
  group.add(shard);
  let sea = null;
  let fast = true;
  let gapFilled = false;
  let breathAt = 0;
  let echoPath = [];
  let echoClock = 0;
  const color = new THREE.Color();
  const layer = {
    group,
    pads: HOLO_PADS,
    plateCount: dome.points.length,
    gapIndex: dome.gap,
    avatar,
    starling,
    guide,
    fast,
    setQuality(mode) {
      fast = mode !== 'fine';
      layer.fast = fast;
      if (fast && sea) {
        group.remove(sea);
        sea.geometry.dispose();
        sea.material.dispose();
        sea = null;
      } else if (!fast && !sea) {
        sea = makeSea(900);
        group.add(sea);
      }
    },
    setPlate() {
      return dome.points.length;
    },
    showEcho(path) {
      echoPath = Array.isArray(path) ? path : [];
      echo.group.visible = echoPath.length > 1;
      echoClock = 0;
    },
    hideEcho() {
      echo.group.visible = false;
      echoPath = [];
    },
    setGapFilled(on) {
      gapFilled = Boolean(on);
      shard.visible = gapFilled;
    },
    update(t, dt, pose = {}) {
      const step = fast ? 0.4 : 0;
      if (gapFilled) shard.rotation.y = t * 0.6;
      if (!fast || t - breathAt >= step) {
        breathAt = t;
        const night = pose.night ? 1.15 : 0.85;
        dome.points.forEach((item, index) => {
          let level = 0.55 + 0.3 * (0.5 + 0.5 * Math.sin(t * 1.1 + item.theta * 3 + item.phi * 4));
          if (index === dome.gap && !gapFilled) level = 0.05;
          if (index === dome.gap && gapFilled) {
            color.setRGB(1, 0.78, 0.35);
          } else {
            color.setRGB(0.21 * level * night, 0.88 * level * night, 0.91 * level * night);
          }
          dome.plates.setColorAt(index, color);
        });
        if (dome.plates.instanceColor) dome.plates.instanceColor.needsUpdate = true;
      }
      pads.beamMat.opacity = 0.32 + Math.sin(t * 2) * 0.06;
      ship.glow.emissiveIntensity = 0.8 + Math.sin(t * 2.2) * 0.35;
      ship.group.position.y = 16.5 + Math.sin(t * 0.8) * 0.15;
      avatar.group.position.set(pose.x || 0, pose.y || 0, pose.z || 0);
      avatar.group.rotation.y = pose.yaw || 0;
      avatar.update(t, pose.mode || 'idle');
      starling.update(t);
      guide.update(t, pose.guide || 'idle');
      if (sea) sea.rotation.y += dt * 0.02;
      if (echo.group.visible && echoPath.length > 1) {
        echoClock += dt;
        const span = Math.max(1, echoPath.length - 1);
        const cursor = (echoClock * 0.6) % span;
        const index = Math.floor(cursor);
        const mix = cursor - index;
        const a = echoPath[index];
        const b = echoPath[Math.min(echoPath.length - 1, index + 1)];
        echo.group.position.set(
          a.x + (b.x - a.x) * mix,
          a.y + (b.y - a.y) * mix,
          a.z + (b.z - a.z) * mix,
        );
        echo.update(t, 'walk');
      }
    },
  };
  return layer;
}

export function padUnder(x, z) {
  let found = null;
  for (const pad of HOLO_PADS) {
    if (!pad.play) continue;
    if (Math.abs(x - pad.x) <= PAD && Math.abs(z - pad.z) <= PAD) {
      if (!found || pad.y > found.y) found = pad;
    }
  }
  return found;
}

export function nearestLowerPad(x, z, y) {
  let found = HOLO_PADS[0];
  let best = Infinity;
  for (const pad of HOLO_PADS) {
    if (!pad.play || pad.y > y + 0.2) continue;
    const gap = Math.hypot(pad.x - x, pad.z - z) + Math.abs(pad.y - y) * 0.2;
    if (gap < best) { best = gap; found = pad; }
  }
  return found;
}

export function attachBloom(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.4, 0.86);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return {
    composer,
    resize(w, h) { composer.setSize(w, h); },
    render() { composer.render(); },
    dispose() {
      bloom.dispose();
      composer.dispose();
    },
  };
}
