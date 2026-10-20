import * as THREE from 'three';
import { resolveColor } from './creation-rules.js';

const DEG = Math.PI / 180;

// Builds Three.js objects from validated geometry data. Owns every geometry and
// material it creates so callers release them with one dispose().
export class CreationMeshFactory {
  constructor() {
    this.geometries = [];
    this.materials = new Map();
  }

  material(color, { ghost = false, glow = false } = {}) {
    const key = `${color}|${ghost}|${glow}`;
    if (!this.materials.has(key)) {
      this.materials.set(key, new THREE.MeshStandardMaterial({
        color: resolveColor(color), roughness: 0.82, metalness: 0,
        transparent: ghost, opacity: ghost ? 0.22 : 1, depthWrite: !ghost,
        emissive: glow ? '#ffe28a' : '#000000', emissiveIntensity: glow ? 1.4 : 0,
      }));
    }
    return this.materials.get(key);
  }

  geometry(shape) {
    let value;
    if (shape.shape === 'box') value = new THREE.BoxGeometry(...shape.size);
    else if (shape.shape === 'cylinder') value = new THREE.CylinderGeometry(shape.radius, shape.radius, shape.length, 18);
    else if (shape.shape === 'cone') value = new THREE.ConeGeometry(shape.radius, shape.length, 18);
    else if (shape.shape === 'torus') value = new THREE.TorusGeometry(shape.radius, shape.tube, 10, 32);
    else value = new THREE.SphereGeometry(shape.radius, 18, 12);
    this.geometries.push(value);
    return value;
  }

  shape(shape, options = {}) {
    const holder = new THREE.Group();
    holder.position.set(...shape.at);
    if (shape.rot) holder.rotation.set(shape.rot[0] * DEG, shape.rot[1] * DEG, shape.rot[2] * DEG);
    const mesh = new THREE.Mesh(this.geometry(shape), this.material(shape.color, options));
    const axis = shape.axis || 'y';
    if (shape.shape === 'cylinder') { if (axis === 'x') mesh.rotation.z = Math.PI / 2; if (axis === 'z') mesh.rotation.x = Math.PI / 2; }
    if (shape.shape === 'cone') { if (axis === 'x') mesh.rotation.z = -Math.PI / 2; if (axis === 'z') mesh.rotation.x = Math.PI / 2; }
    if (shape.shape === 'torus') { if (axis === 'x') mesh.rotation.y = Math.PI / 2; if (axis === 'y') mesh.rotation.x = Math.PI / 2; }
    if (shape.scale) mesh.scale.set(...shape.scale);
    mesh.castShadow = !options.ghost;
    mesh.receiveShadow = !options.ghost;
    holder.add(mesh);
    return holder;
  }

  part(type, options = {}) {
    const group = new THREE.Group();
    const glow = options.lit && type.tags.includes('light');
    for (const shape of type.geometry) group.add(this.shape(shape, { ...options, glow }));
    return group;
  }

  // Each blueprint slot becomes its own group so experiments can move single parts.
  assembly(bp, catalog, filled, { showGhosts = true, lit = false } = {}) {
    const root = new THREE.Group();
    const slots = new Map();
    for (const slot of bp.parts) {
      const isFilled = filled.has(slot.id);
      if (!isFilled && !showGhosts) continue;
      const group = this.part(catalog.get(slot.typeId), { ghost: !isFilled, lit });
      group.position.set(...slot.at);
      group.rotation.y = (slot.rotY || 0) * DEG;
      group.userData = { slotId: slot.id, filled: isFilled, home: group.position.clone() };
      root.add(group);
      slots.set(slot.id, group);
    }
    root.userData.slots = slots;
    return root;
  }

  // A figure part's pivot is relative to its parent's pivot; its shapes are relative to its own pivot.
  figure(figure) {
    const root = new THREE.Group();
    const groups = new Map();
    for (const part of figure.parts) {
      const group = new THREE.Group();
      group.position.set(...part.pivot);
      for (const shape of part.shapes) group.add(this.shape(shape));
      group.userData = { anim: part.anim, base: group.position.clone(), baseRot: group.rotation.clone() };
      (part.parent ? groups.get(part.parent) : root).add(group);
      groups.set(part.id, group);
    }
    root.scale.setScalar(figure.scale || 1);
    root.userData.parts = groups;
    return root;
  }

  dispose() {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.geometries = [];
    this.materials.clear();
  }
}

export function animateFigure(root, time) {
  for (const group of root.userData.parts?.values?.() || []) {
    const { anim, base, baseRot } = group.userData;
    group.position.copy(base);
    group.rotation.copy(baseRot);
    if (anim === 'wag') group.rotation.y = baseRot.y + Math.sin(time * 4) * 0.45;
    else if (anim === 'bob') group.position.y = base.y + Math.sin(time * 2.2) * 0.03;
    else if (anim === 'nod') group.rotation.z = baseRot.z + Math.sin(time * 1.6) * 0.12;
    else if (anim === 'flap') group.rotation.x = baseRot.x + Math.sin(time * 9) * 0.5 * (root.userData.flapBoost || 1) * Math.sign(base.z || 1);
    else if (anim === 'spin') group.rotation.y = baseRot.y + time * 2;
  }
}

// Experiment motion shared by the lab bench and the valley test field.
export function experimentPose(root, bp, catalog, capability, t) {
  const slots = root.userData.slots;
  if (!slots) return;
  const withTag = tag => bp.parts.filter(p => catalog.get(p.typeId).tags.includes(tag)).map(p => slots.get(p.id)).filter(Boolean);
  for (const g of slots.values()) { g.position.copy(g.userData.home); g.rotation.set(0, 0, 0); }
  root.position.x = 0; root.position.y = 0; root.rotation.z = 0;
  const travel = Math.sin(Math.min(t, 3) / 3 * Math.PI) * 1.2;
  if (capability === 'roll' || capability === 'pedal') {
    root.position.x = travel;
    for (const wheel of withTag('wheel')) wheel.rotation.z = -travel / 0.36;
    if (capability === 'pedal') for (const crank of withTag('crank')) crank.rotation.z = -travel / 0.2;
  } else if (capability === 'steer') {
    const turn = Math.sin(t * 2) * 0.45;
    const front = withTag('wheel').filter(g => g.userData.home.x > 0);
    for (const wheel of front) wheel.rotation.y = turn;
    for (const bar of [...withTag('handle'), ...withTag('fork')]) bar.rotation.y = turn;
    for (const steering of withTag('steering')) steering.rotation.x = turn * 2;
  } else if (capability === 'spin') {
    for (const blade of withTag('blade')) blade.rotation.z = t * 5;
  } else if (capability === 'float') {
    root.position.y = Math.sin(t * 2) * 0.05 - 0.1;
    root.rotation.z = Math.sin(t * 1.3) * 0.04;
  } else if (capability === 'sit') {
    root.position.y = -Math.abs(Math.sin(t * 3)) * 0.03;
  }
}

export function explodePose(root, amount) {
  const slots = root.userData.slots;
  if (!slots) return;
  const center = new THREE.Vector3();
  for (const g of slots.values()) center.add(g.userData.home);
  center.divideScalar(Math.max(1, slots.size));
  for (const g of slots.values()) {
    const away = g.userData.home.clone().sub(center);
    if (away.lengthSq() < 1e-4) away.set(0, 1, 0);
    g.position.copy(g.userData.home).addScaledVector(away.normalize(), amount);
  }
}
