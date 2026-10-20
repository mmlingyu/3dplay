/** Gravity scale by valley. Valley, day valley and mei stay at 9.8. */

import { EARTH_GRAVITY, REALMS } from './realm-data.js';

export const PLAYER_FALL = 12;
export const BOUNCE_FALL = 16;
export const JUMP_SPEED = 4.6;
export const BALL_GRAVITY = 9.8;

export function gravityOf(realmId = 'he') {
  const configured = REALMS[realmId]?.gravity;
  return Number.isFinite(configured) ? configured : EARTH_GRAVITY;
}

/** 1 in the home valley, so the old 9.8 and 12 paths stay the same numbers. */
export function gravityScale(realmId = 'he') {
  return gravityOf(realmId) / EARTH_GRAVITY;
}

export function ballGravity(realmId = 'he') {
  return BALL_GRAVITY * gravityScale(realmId);
}

export function playerFall(realmId = 'he', bouncing = false) {
  return (bouncing ? BOUNCE_FALL : PLAYER_FALL) * gravityScale(realmId);
}

/** Same jump the valley uses: start at JUMP_SPEED, fall with playerFall, stop on the ground. */
export function simulateJump({ realmId = 'he', dt = 1 / 60, vy0 = JUMP_SPEED, ground = 0, maxSteps = 600 } = {}) {
  let y = ground;
  let vy = vy0;
  let apex = ground;
  let time = 0;
  const samples = [];
  for (let i = 0; i < maxSteps; i += 1) {
    vy -= playerFall(realmId, false) * dt;
    y += vy * dt;
    time += dt;
    if (y > apex) apex = y;
    samples.push(y);
    if (y <= ground) {
      y = ground;
      vy = 0;
      break;
    }
  }
  return { apex: apex - ground, time, samples, gravity: gravityOf(realmId) };
}

/** Flat-ground ball drop. Slope is zero, so only gravity and the ground stop change. */
export function simulateBallDrop({ realmId = 'he', y0 = 4, dt = 1 / 30, steps = 90 } = {}) {
  const sub = dt / 3;
  let y = y0;
  let vy = 0;
  const samples = [];
  const g = ballGravity(realmId);
  for (let n = 0; n < steps; n += 1) {
    for (let k = 0; k < 3; k += 1) {
      const ground = 0.22;
      if (y <= ground + 0.025 && vy <= 0) {
        y = ground;
        vy = 0;
      } else {
        vy -= g * sub;
      }
      y += vy * sub;
      if (y < ground) {
        y = ground;
        vy = 0;
      }
    }
    samples.push(Math.round(y * 1000) / 1000);
  }
  return { samples, gravity: g };
}
