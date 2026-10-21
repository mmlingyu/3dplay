/** Block figures for the alien valley. Voxel size matches the design reference. */

import * as THREE from 'three';

const V = 0.075;

function material(color, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.r ?? 0.62,
    metalness: opts.m ?? 0.15,
  });
  if (opts.op != null) {
    mat.transparent = true;
    mat.opacity = opts.op;
    mat.depthWrite = opts.op > 0.75;
  }
  if (opts.e) {
    mat.emissive = new THREE.Color(opts.e);
    mat.emissiveIntensity = opts.ei ?? 0.9;
  }
  return mat;
}

function bone(parent, x, y, z) {
  const group = new THREE.Group();
  group.position.set(x * V, y * V, z * V);
  parent.add(group);
  return group;
}

function boxes(parent, mat, origin, w, h, d) {
  const [x, y, z] = origin;
  const geometry = new THREE.BoxGeometry(w * V, h * V, d * V);
  geometry.translate((x + w / 2) * V, (y + h / 2) * V, (z + d / 2) * V);
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function idle(parts, t) {
  const breathe = Math.sin(t * 2.1);
  if (parts.torso) parts.torso.scale.y = 1 + breathe * 0.012;
  if (parts.head) parts.head.rotation.y = Math.sin(t * 0.55) * 0.18;
  if (parts.armL) parts.armL.rotation.z = 0.08;
  if (parts.armR) parts.armR.rotation.z = -0.08;
  if (parts.legL) parts.legL.rotation.x = 0;
  if (parts.legR) parts.legR.rotation.x = 0;
}

function talk(parts, t) {
  idle(parts, t);
  if (parts.head) parts.head.rotation.z = Math.sin(t * 1.7) * 0.08;
  if (parts.armR) parts.armR.rotation.x = -0.7 + Math.sin(t * 3) * 0.15;
}

export function makeGugu() {
  const root = new THREE.Group();
  const skin = material('#7E9A7A', { r: 0.78, m: 0 });
  const coat = material('#2C3530', { r: 0.84, m: 0 });
  const line = material('#36E0E8', { e: '#36E0E8', ei: 0.9, r: 0.4 });
  const shoe = material('#15181A', { r: 0.45, m: 0.3 });
  const eye = material('#101418', { r: 0.2, m: 0.4 });
  const tip = material('#9DFF8A', { e: '#9DFF8A', ei: 1.2, r: 0.3 });
  const parts = {};
  parts.legL = bone(root, -1.3, 12, 0);
  parts.legR = bone(root, 1.3, 12, 0);
  boxes(parts.legL, coat, [-1.1, -10, -1.3], 2.2, 10, 2.6);
  boxes(parts.legR, coat, [-1.1, -10, -1.3], 2.2, 10, 2.6);
  boxes(parts.legL, shoe, [-1.2, -12, -1.5], 2.4, 2, 3.2);
  boxes(parts.legR, shoe, [-1.2, -12, -1.5], 2.4, 2, 3.2);
  parts.torso = bone(root, 0, 12, 0);
  boxes(parts.torso, coat, [-2.7, 0, -1.8], 5.4, 9, 3.6);
  boxes(parts.torso, coat, [-2.9, -4.2, -2], 5.8, 4.4, 4);
  boxes(parts.torso, line, [-0.2, -4, 1.9], 0.4, 13, 0.12);
  boxes(parts.torso, line, [-2.8, -4.2, 1.95], 5.6, 0.28, 0.1);
  parts.armL = bone(root, -2.7, 20, 0);
  parts.armR = bone(root, 2.7, 20, 0);
  boxes(parts.armL, coat, [-1.3, -8, -0.9], 1.3, 8, 1.8);
  boxes(parts.armR, coat, [0, -8, -0.9], 1.3, 8, 1.8);
  boxes(parts.armL, skin, [-1.5, -9.2, -0.7], 1.6, 1.3, 1.6);
  boxes(parts.armR, skin, [-0.1, -9.2, -0.7], 1.6, 1.3, 1.6);
  for (const arm of [parts.armL, parts.armR]) {
    const x0 = arm === parts.armL ? -1.3 : 0;
    boxes(arm, skin, [x0, -10.2, 0.2], 0.28, 1.1, 0.28);
    boxes(arm, skin, [x0 + 0.34, -10.2, 0.2], 0.28, 1.1, 0.28);
    boxes(arm, skin, [x0 + 0.68, -10.2, 0.2], 0.28, 1.1, 0.28);
    boxes(arm, skin, [x0 + 1.02, -10.2, 0.2], 0.28, 1.1, 0.28);
  }
  parts.head = bone(root, 0, 22, 0);
  boxes(parts.head, skin, [-1.8, 0, -1.8], 3.6, 4.4, 3.6);
  boxes(parts.head, eye, [-1.4, 1.8, 1.7], 1, 1, 0.15);
  boxes(parts.head, eye, [0.4, 1.8, 1.7], 1, 1, 0.15);
  parts.antenna = bone(parts.head, 0, 4.4, 0);
  boxes(parts.antenna, skin, [-0.25, 0, -0.25], 0.5, 2.4, 0.5);
  boxes(parts.antenna, tip, [-0.55, 2.3, -0.55], 1.1, 1.1, 1.1);
  return {
    group: root,
    update(t, mode = 'idle') {
      if (mode === 'talk') talk(parts, t);
      else idle(parts, t);
      parts.antenna.rotation.z = Math.sin(t * 1.3) * 0.12;
      tip.emissiveIntensity = 0.7 + Math.sin(t * 1.5) * 0.35;
      root.rotation.x = mode === 'idle' ? Math.sin(t * 0.9) * 0.02 : 0;
    },
  };
}

export function makeZero() {
  const root = new THREE.Group();
  const body = bone(root, 0, 18, 0);
  const armor = material('#2A2E36', { r: 0.35, m: 0.75 });
  const seam = material('#1A1D22', { r: 0.55, m: 0.2 });
  const eye = material('#FF8A2A', { e: '#FF8A2A', ei: 1.3, r: 0.25 });
  const thrust = material('#5AC8FF', { e: '#5AC8FF', ei: 1.1, r: 0.3 });
  boxes(body, armor, [-3, -3, -3], 6, 6, 6);
  boxes(body, seam, [-3.1, -2, -2], 6.2, 4, 4);
  boxes(body, eye, [-1.4, -1.3, 3], 2.8, 2.6, 0.35);
  boxes(body, armor, [-4.8, -1.4, -1.3], 1.8, 2.8, 2.6);
  boxes(body, armor, [3, -1.4, -1.3], 1.8, 2.8, 2.6);
  boxes(body, thrust, [-4.5, -1.8, -0.8], 1.1, 0.45, 1.6);
  boxes(body, thrust, [3.4, -1.8, -0.8], 1.1, 0.45, 1.6);
  const beamMat = new THREE.MeshBasicMaterial({
    color: '#36E0E8',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.1, 6, 1, true), beamMat);
  beam.rotation.x = Math.PI / 2;
  beam.position.set(0, 0, 0.7);
  body.add(beam);
  return {
    group: root,
    update(t, mode = 'idle') {
      body.position.y = 18 * V + Math.sin(t * 1.6) * 0.05;
      body.rotation.y = mode === 'idle' ? Math.sin(t * 0.45) * 0.35 : 0;
      const scanning = mode === 'scan';
      eye.color.set(scanning ? '#36E0E8' : '#FF8A2A');
      eye.emissive.set(scanning ? '#36E0E8' : '#FF8A2A');
      eye.emissiveIntensity = mode === 'talk' ? (Math.sin(t * 8) > 0 ? 2 : 0.5) : 1.2;
      beamMat.opacity = scanning ? 0.28 : 0;
    },
  };
}

export function makeAvatar() {
  const root = new THREE.Group();
  const suit = material('#2A2E36', { r: 0.45, m: 0.55 });
  const glow = material('#36E0E8', { e: '#36E0E8', ei: 1, r: 0.35 });
  const shoe = material('#1A1D22', { r: 0.4, m: 0.45 });
  const visor = material('#36E0E8', { e: '#36E0E8', ei: 0.45, op: 0.5, r: 0.08, m: 0.2 });
  const parts = {};
  parts.legL = bone(root, -1.2, 11, 0);
  parts.legR = bone(root, 1.2, 11, 0);
  for (const leg of [parts.legL, parts.legR]) {
    boxes(leg, suit, [-1, -8, -1.2], 2, 8, 2.4);
    boxes(leg, shoe, [-1.1, -10, -1.4], 2.2, 2, 3);
    boxes(leg, glow, [-0.12, -8, 1.15], 0.24, 6, 0.08);
  }
  parts.torso = bone(root, 0, 11, 0);
  boxes(parts.torso, suit, [-2.4, 0, -1.6], 4.8, 8, 3.2);
  boxes(parts.torso, suit, [-2.8, 5.2, -1.9], 5.6, 2.4, 3.8);
  boxes(parts.torso, glow, [-0.15, 0.4, 1.55], 0.3, 6, 0.1);
  parts.armL = bone(root, -2.5, 18, 0);
  parts.armR = bone(root, 2.5, 18, 0);
  boxes(parts.armL, suit, [-1.2, -7, -0.8], 1.2, 7, 1.6);
  boxes(parts.armR, suit, [0, -7, -0.8], 1.2, 7, 1.6);
  boxes(parts.armL, glow, [-1.2, -4, -0.9], 1.2, 0.2, 1.8);
  boxes(parts.armR, glow, [0, -4, -0.9], 1.2, 0.2, 1.8);
  parts.head = bone(root, 0, 20, 0);
  boxes(parts.head, suit, [-1.8, 0, -1.8], 3.6, 4, 3.6);
  boxes(parts.head, visor, [-1.9, 1.2, 1.5], 3.8, 1.3, 0.35);
  const ringMat = new THREE.MeshBasicMaterial({
    color: '#36E0E8',
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.34, 24), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  root.add(ring);
  return {
    group: root,
    parts,
    setGlow(hex) {
      glow.color.set(hex);
      glow.emissive.set(hex);
      ringMat.color.set(hex);
      visor.color.set(hex);
      visor.emissive.set(hex);
    },
    setVisor(kind) {
      if (kind === 'goggles') {
        visor.opacity = 0.85;
        parts.head.scale.set(1, 1, 1);
      } else if (kind === 'half') visor.opacity = 0.72;
      else visor.opacity = 0.42;
    },
    update(t, mode = 'idle') {
      const moving = mode === 'walk';
      const jumping = mode === 'jump';
      const swing = moving ? Math.sin(t * 8) * 0.45 : 0;
      parts.legL.rotation.x = jumping ? -0.4 : swing;
      parts.legR.rotation.x = jumping ? 0.3 : -swing;
      parts.armL.rotation.x = jumping ? -0.6 : -swing;
      parts.armR.rotation.x = jumping ? 0.4 : swing;
      if (!moving && !jumping) idle(parts, t);
      glow.emissiveIntensity = 0.75 + Math.sin(t * 2.4) * 0.25;
      if (mode === 'land') {
        const k = (t % 0.7) / 0.7;
        ring.scale.setScalar(1 + k * 5);
        ringMat.opacity = 1 - k;
      } else ringMat.opacity = Math.max(0, ringMat.opacity - 0.04);
    },
  };
}

export function makeStarling() {
  const root = new THREE.Group();
  const crystal = material('#9D7BFF', { e: '#7A5CFF', ei: 0.28, op: 0.7, r: 0.18, m: 0.08 });
  crystal.depthWrite = false;
  const core = material('#F4F7FF', { e: '#F4F7FF', ei: 1.5, r: 0.25 });
  const eye = material('#36E0E8', { e: '#36E0E8', ei: 0.7, r: 0.3 });
  const body = bone(root, 0, 7.2, 0);
  boxes(body, crystal, [-3.1, 0, -6.2], 6.2, 4.4, 10.6);
  boxes(body, crystal, [-3.4, -0.3, -7.4], 6.8, 3.4, 2.8);
  boxes(body, crystal, [-1.5, 2.4, 3.6], 3, 2.2, 2.2);
  const head = bone(body, 0, 4.4, 5.4);
  boxes(head, crystal, [-1.7, 0, 0], 3.4, 2.6, 3.2);
  boxes(head, crystal, [-1.7, 2.2, 0.2], 0.9, 1.8, 0.8);
  boxes(head, crystal, [0.8, 2.2, 0.2], 0.9, 1.8, 0.8);
  boxes(head, crystal, [-1, 0.2, 2.8], 2, 1.2, 1.5);
  boxes(head, eye, [-1.2, 1.2, 4], 0.5, 0.42, 0.16);
  boxes(head, eye, [0.7, 1.2, 4], 0.5, 0.42, 0.16);
  const tail = bone(body, 0, 2.2, -6.6);
  boxes(tail, crystal, [-0.7, -0.2, -4.2], 1.4, 1.3, 4.2);
  boxes(tail, crystal, [-0.45, 0.1, -7.4], 0.9, 0.8, 3.2);
  const hips = [[-2.2, 1.6], [2.2, 1.6], [-2.1, -4.6], [2.1, -4.6]];
  const legs = hips.map(([x, z]) => {
    const leg = bone(body, x, 0, z);
    boxes(leg, crystal, [-0.85, -7.2, -0.85], 1.7, 7.2, 1.7);
    boxes(leg, crystal, [-1, -7.5, -1.1], 2, 0.7, 2.2);
    return leg;
  });
  root.scale.setScalar(1.25);
  const stars = [];
  for (let i = 0; i < 5; i += 1) {
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), core);
    mesh.position.set(-0.12 + i * 0.06, 0.2, -0.02);
    body.add(mesh);
    stars.push(mesh);
  }
  const dots = [];
  const dotMat = material('#F4F7FF', { e: '#F4F7FF', ei: 1.5, r: 0.2 });
  for (let i = 0; i < 20; i += 1) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 5), dotMat);
    const col = i % 5;
    const row = Math.floor(i / 5);
    mesh.position.set(0.48, 0.16 + row * 0.07, 0.22 - col * 0.08);
    mesh.visible = false;
    body.add(mesh);
    dots.push(mesh);
  }
  return {
    group: root,
    setDots(count) {
      const n = Math.max(0, Math.min(20, Number(count) || 0));
      dots.forEach((dot, index) => { dot.visible = index < n; });
    },
    update(t) {
      const step = Math.sin(t * 2.1) * 0.28;
      legs[0].rotation.x = step;
      legs[3].rotation.x = step;
      legs[1].rotation.x = -step;
      legs[2].rotation.x = -step;
      body.position.y = 7.2 * V + Math.abs(Math.sin(t * 2.1)) * 0.015;
      tail.rotation.x = -0.4;
      tail.rotation.y = Math.sin(t * 1.2) * 0.22;
      head.rotation.y = Math.sin(t * 0.6) * 0.1;
      stars.forEach((star, index) => {
        star.position.y = 0.16 + Math.sin(t * 1.5 + index) * 0.035;
        star.rotation.y = t * 0.7 + index;
      });
      dotMat.emissiveIntensity = 1.1 + Math.sin(t * 2) * 0.25;
    },
  };
}

export function makeGate() {
  const group = new THREE.Group();
  const frameMat = material('#2A2E36', { e: '#36E0E8', ei: 0.55, r: 0.35, m: 0.7 });
  const frame = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.09, 5, 6), frameMat);
  frame.position.y = 1.5;
  const portalMat = new THREE.MeshBasicMaterial({
    color: '#36E0E8',
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const portal = new THREE.Mesh(new THREE.CircleGeometry(1.12, 6), portalMat);
  portal.position.y = 1.5;
  group.add(frame, portal);
  return {
    group,
    update(t, night) {
      const base = night ? 1.15 : 0.45;
      frameMat.emissiveIntensity = base + Math.sin(t * 0.7) * 0.12;
      portalMat.opacity = (night ? 0.58 : 0.36) + Math.sin(t * 0.5) * 0.04;
    },
  };
}
