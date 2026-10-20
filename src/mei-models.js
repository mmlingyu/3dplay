/** Placeable keepsakes and the harbor ship. Home and the beauty valley both use these. */

import { realMoment } from './life-data.js';

export function drawSouvenir(world, group, block, ghost) {
  const item = block?.item;
  if (item === 'windmill-mini') {
    world.cube(group, '#8d5a3c', [0, 0.35, 0], [0.16, 0.7, 0.16], true);
    const blades = world.cube(group, '#d7c48a', [0, 0.72, 0.08], [0.9, 0.12, 0.08], true);
    world.cube(group, '#d7c48a', [0, 0.72, 0.08], [0.12, 0.9, 0.08], true);
    group.userData.blades = blades.parent || blades;
    const hub = blades.parent;
    if (hub) group.userData.blades = hub;
    group.userData.spin = true;
    return true;
  }
  if (item === 'paper-plane') {
    world.cube(group, '#f7f3ea', [0, 0.28, 0], [0.9, 0.06, 0.28], true);
    world.cube(group, '#e7d7b8', [0.28, 0.32, 0], [0.22, 0.08, 0.12], true);
    return true;
  }
  if (item === 'log-wall') {
    world.cube(group, '#8d5a3c', [0, 0.28, 0], [1.05, 0.22, 0.28], true);
    world.cube(group, '#a56b42', [0, 0.52, 0], [0.28, 0.22, 1.05], true);
    world.cube(group, '#8d5a3c', [0, 0.76, 0], [1.05, 0.22, 0.28], true);
    return true;
  }
  if (item === 'quilt') {
    world.cube(group, '#c45d5d', [-0.2, 0.55, 0], [0.42, 0.42, 0.08], true);
    world.cube(group, '#6a90c0', [0.2, 0.55, 0], [0.42, 0.42, 0.08], true);
    world.cube(group, '#e2b657', [-0.2, 0.15, 0], [0.42, 0.36, 0.08], true);
    world.cube(group, '#6f8f55', [0.2, 0.15, 0], [0.42, 0.36, 0.08], true);
    return true;
  }
  if (item === 'pumpkin-lantern') {
    world.cube(group, '#e07a2f', [0, 0.32, 0], [0.55, 0.48, 0.55], true);
    world.cube(group, '#f2c14e', [-0.12, 0.36, 0.28], [0.08, 0.08, 0.04], true);
    world.cube(group, '#f2c14e', [0.12, 0.36, 0.28], [0.08, 0.08, 0.04], true);
    world.cube(group, '#f2c14e', [0, 0.22, 0.28], [0.16, 0.06, 0.04], true);
    return true;
  }
  if (item === 'thanks-card') {
    world.cube(group, '#f3e2c4', [0, 0.4, 0], [0.5, 0.62, 0.06], true);
    world.cube(group, '#d98b7a', [0, 0.42, 0.04], [0.18, 0.18, 0.04], true);
    return true;
  }
  return false;
}

export function spinSouvenirs(world, dt) {
  if (realMoment().weather.kind !== 'wind') return;
  for (const group of world.buildGroups?.values?.() || []) {
    if (!group.userData?.spin) continue;
    group.rotation.y += dt * 1.4;
  }
}

/** A longer hull with a cabin, beside the small skiff. No flag. */
export function dockShip(world, parent) {
  world.cube(parent, '#6d5344', [-1.85, 0.2, 0.15], [0.72, 0.28, 2.5], true);
  world.cube(parent, '#efe2c4', [-1.85, 0.48, -0.25], [0.55, 0.32, 0.8], true);
  world.cube(parent, '#8d5a3c', [-1.85, 0.82, -0.25], [0.08, 0.42, 0.08], true);
  world.cube(parent, '#c9b89a', [-1.85, 0.34, 0.85], [0.5, 0.08, 0.4], true);
}
