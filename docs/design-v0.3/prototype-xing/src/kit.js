import * as THREE from 'three';

export const BOX = new THREE.BoxGeometry(1, 1, 1);
export const V = 0.075; // character voxel size in blocks

let grain = null;
function grainTex() {
  if (grain) return grain;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const img = g.createImageData(64, 64);
  for (let i = 0; i < 64 * 64; i++) {
    const v = 205 + Math.floor(Math.random() * 50);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grain = new THREE.CanvasTexture(c); grain.colorSpace = THREE.SRGBColorSpace;
  grain.magFilter = THREE.NearestFilter; grain.minFilter = THREE.NearestFilter;
  return grain;
}

export const glowMats = new Set();
/** Material. opts: r roughness, m metalness, e emissive color, eD/eN day/night intensity, op opacity, add additive */
export function M(color, o = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color, roughness: o.r ?? 0.85, metalness: o.m ?? 0,
    map: o.flat ? null : grainTex(),
  });
  if (o.op !== undefined) { mat.transparent = true; mat.opacity = o.op; mat.depthWrite = o.op > 0.7; }
  if (o.add) { mat.blending = THREE.AdditiveBlending; mat.depthWrite = false; mat.transparent = true; }
  if (o.e) {
    mat.emissive = new THREE.Color(o.e);
    mat.userData.eD = o.eD ?? 0.08; mat.userData.eN = o.eN ?? 1.6;
    mat.emissiveIntensity = mat.userData.eD; glowMats.add(mat);
  }
  return mat;
}

export function setNight(night) {
  for (const m of glowMats) m.emissiveIntensity = night ? m.userData.eN : m.userData.eD;
}

/** Box by min corner (block units). */
export function B(parent, x, y, z, w, h, d, mat, cast = true) {
  const mesh = new THREE.Mesh(BOX, mat);
  mesh.scale.set(w, h, d);
  mesh.position.set(x + w / 2, y + h / 2, z + d / 2);
  mesh.castShadow = cast; mesh.receiveShadow = true;
  parent.add(mesh); return mesh;
}
/** Box by center (block units). */
export function C(parent, x, y, z, w, h, d, mat, cast = true) {
  const mesh = new THREE.Mesh(BOX, mat);
  mesh.scale.set(w, h, d); mesh.position.set(x, y, z);
  mesh.castShadow = cast; mesh.receiveShadow = true;
  parent.add(mesh); return mesh;
}
/** Voxel box by min corner in voxel units (for characters). */
export function VB(parent, x, y, z, w, h, d, mat) {
  return B(parent, x * V, y * V, z * V, w * V, h * V, d * V, mat);
}
/** Pivot group at voxel coords. */
export function pivot(parent, x, y, z) {
  const g = new THREE.Group(); g.position.set(x * V, y * V, z * V); parent.add(g); return g;
}
