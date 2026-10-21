// Game units and simplified solid wooden-sphere parameters, not a full material simulation.
import { REALMS } from './realm-data.js';

export const BALL_RULES = Object.freeze({
  radius: .22, maxCount: 4, boundary: 15.55, maxSpeed: 12,
  rollingDrag: .9, sleepSpeed: .03, pushReach: .52, pushGain: .85,
});

/** Home keeps the original 15.55. Other valleys use their own number when they have one. */
export function ballBoundaryFor(realmId = 'he') {
  if (!realmId || realmId === 'he') return BALL_RULES.boundary;
  const value = REALMS[realmId]?.ballBoundary;
  return Number.isFinite(value) ? value : BALL_RULES.boundary;
}
