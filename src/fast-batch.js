/** Fast picture quality: fewer draw calls. Fine quality keeps every original mesh. */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _inv = new THREE.Matrix4();
const _local = new THREE.Matrix4();
const _sized = new THREE.Matrix4();
const _color = new THREE.Color();

function blocked(mesh) {
  let node = mesh;
  while (node) {
    if (node.userData?.live || node.userData?.roofAnim || node.userData?.spin) return true;
    node = node.parent;
  }
  return false;
}

function movingRoot(mesh) {
  let node = mesh.parent;
  while (node) {
    if (node.userData?.batchLive || node.userData?.batchRoot) return node;
    node = node.parent;
  }
  return null;
}

function eligible(mesh) {
  if (!mesh.isMesh || mesh.isInstancedMesh || mesh.userData.fastBatch) return false;
  if (!mesh.visible || Array.isArray(mesh.material)) return false;
  return !blocked(mesh);
}

function hide(world, mesh) {
  mesh.visible = false;
  world.fastHidden.push(mesh);
}

function remember(world, mesh, disposeGeometry, disposeMaterial) {
  mesh.userData.fastBatch = true;
  mesh.userData.disposeGeometry = disposeGeometry;
  mesh.userData.disposeMaterial = disposeMaterial;
  mesh.raycast = () => {};
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  world.fastBatches.push(mesh);
}

export function clearFastBatch(world) {
  for (const mesh of world.fastHidden || []) mesh.visible = true;
  world.fastHidden = [];
  for (const mesh of world.fastBatches || []) {
    mesh.removeFromParent();
    if (mesh.userData.disposeGeometry) mesh.geometry?.dispose?.();
    if (mesh.userData.disposeMaterial) mesh.material?.dispose?.();
  }
  world.fastBatches = [];
  world.fastLive = [];
}

function bakedGeometry(mesh, matrix) {
  const source = mesh.geometry;
  const geo = source.index ? source.toNonIndexed() : source.clone();
  geo.applyMatrix4(matrix);
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  if (!geo.getAttribute('uv')) {
    const count = geo.getAttribute('position').count;
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  for (const name of Object.keys(geo.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') geo.deleteAttribute(name);
  }
  geo.clearGroups?.();
  return geo;
}

function coloredGeometry(mesh, matrix) {
  const geo = bakedGeometry(mesh, matrix);
  const color = mesh.material?.color || _color.set('#ffffff');
  const count = geo.getAttribute('position').count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    arr[i * 3] = color.r;
    arr[i * 3 + 1] = color.g;
    arr[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  geo.deleteAttribute('uv');
  return geo;
}

function mergeKeep(world, meshes, material, parent, root) {
  if (meshes.length < 2) return false;
  const parts = [];
  for (const mesh of meshes) {
    const matrix = new THREE.Matrix4();
    if (root) {
      _inv.copy(root.matrixWorld).invert();
      matrix.multiplyMatrices(_inv, mesh.matrixWorld);
    } else matrix.copy(mesh.matrixWorld);
    try { parts.push(bakedGeometry(mesh, matrix)); }
    catch { parts.forEach((geo) => geo.dispose()); return false; }
  }
  let merged = null;
  try { merged = mergeGeometries(parts, false); }
  catch { merged = null; }
  parts.forEach((geo) => geo.dispose());
  if (!merged) return false;
  const visual = new THREE.Mesh(merged, material);
  remember(world, visual, true, false);
  parent.add(visual);
  meshes.forEach((mesh) => hide(world, mesh));
  return true;
}

function mergeColored(world, meshes, parent, root) {
  if (meshes.length < 2) return false;
  const parts = [];
  for (const mesh of meshes) {
    const matrix = new THREE.Matrix4();
    if (root) {
      _inv.copy(root.matrixWorld).invert();
      matrix.multiplyMatrices(_inv, mesh.matrixWorld);
    } else matrix.copy(mesh.matrixWorld);
    try { parts.push(coloredGeometry(mesh, matrix)); }
    catch { parts.forEach((geo) => geo.dispose()); return false; }
  }
  let merged = null;
  try { merged = mergeGeometries(parts, false); }
  catch { merged = null; }
  parts.forEach((geo) => geo.dispose());
  if (!merged) return false;
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  const visual = new THREE.Mesh(merged, material);
  remember(world, visual, true, true);
  parent.add(visual);
  meshes.forEach((mesh) => hide(world, mesh));
  return true;
}

function batchRipples(world, root, meshes) {
  const sample = meshes.find((mesh) => mesh.geometry?.parameters?.width) || meshes[0];
  const material = sample.material;
  const batch = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, meshes.length);
  remember(world, batch, true, false);
  root.add(batch);
  world.fastLive.push({ batch, meshes, root });
  writeLiveMatrices(batch, meshes, root);
  meshes.forEach((mesh) => hide(world, mesh));
}

function writeLiveMatrices(batch, meshes, root) {
  root.updateWorldMatrix(true, false);
  _inv.copy(root.matrixWorld).invert();
  meshes.forEach((mesh, index) => {
    mesh.updateWorldMatrix(true, false);
    const width = mesh.geometry?.parameters?.width || 1;
    const height = mesh.geometry?.parameters?.height || 1;
    _sized.makeScale(width, height, 1);
    _local.multiplyMatrices(mesh.matrixWorld, _sized);
    _local.premultiply(_inv);
    batch.setMatrixAt(index, _local);
  });
  batch.instanceMatrix.needsUpdate = true;
  batch.computeBoundingSphere?.();
}

function placeGroup(world, meshes, parent, root) {
  const byMaterial = new Map();
  const colored = [];
  for (const mesh of meshes) {
    const material = mesh.material;
    if (!material) continue;
    if (!material.transparent && !material.map && !material.alphaMap) {
      colored.push(mesh);
      continue;
    }
    if (!byMaterial.has(material)) byMaterial.set(material, []);
    byMaterial.get(material).push(mesh);
  }
  mergeColored(world, colored, parent, root);
  for (const [material, group] of byMaterial) mergeKeep(world, group, material, parent, root);
}

export function rebuildFastBatch(world) {
  try {
    rebuildFastBatchNow(world);
  } catch (error) {
    console.warn('流畅档合批停下了', error);
    clearFastBatch(world);
    world.fastDirty = false;
  }
}

function rebuildFastBatchNow(world) {
  clearFastBatch(world);
  world.fastDirty = false;
  if (world.pictureQuality === 'fine') return;
  world.scene.updateMatrixWorld(true);
  const loose = [];
  const roots = new Map();
  const live = new Map();
  world.scene.traverse((mesh) => {
    if (!eligible(mesh)) return;
    const root = movingRoot(mesh);
    if (root?.userData.batchLive) {
      if (!live.has(root)) live.set(root, []);
      live.get(root).push(mesh);
    } else if (root?.userData.batchRoot) {
      if (!roots.has(root)) roots.set(root, []);
      roots.get(root).push(mesh);
    } else loose.push(mesh);
  });
  for (const [root, meshes] of live) batchRipples(world, root, meshes);
  for (const [root, meshes] of roots) placeGroup(world, meshes, root, root);
  placeGroup(world, loose, world.scene, null);
}

export function refreshFastLive(world) {
  if (!world.fastLive?.length) return;
  for (const entry of world.fastLive) {
    if (!entry.root?.parent && entry.root !== world.scene) continue;
    writeLiveMatrices(entry.batch, entry.meshes, entry.root);
  }
}
