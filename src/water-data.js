export const WATER_RULES = Object.freeze({
  riverLevel: -.62, riverMinX: 2.5, riverMaxX: 5.5,
  swimDepth: .75, immersion: .15, floatOffset: .22,
  walkSpeed: 3.15, wadeSpeed: 2.55, swimSpeed: 2.05,
  floatRate: 9, poseRate: 8, swimTilt: .85,
});

export const POOL = Object.freeze({
  x: 0, z: 11, halfWidth: 1.5, halfDepth: 1.5, level: 1.15, rim: 1.25,
  minX: -2, maxX: 2, minZ: 8, maxZ: 13,
  rampMinZ: 8, rampMaxZ: 9.5, rampHalfWidth: .65,
  entryZ: 8.1,
});

export function inPoolReservedArea(x, z, margin = 0) {
  return x + margin >= POOL.minX && x - margin <= POOL.maxX &&
    z + margin >= POOL.minZ && z - margin <= POOL.maxZ;
}
