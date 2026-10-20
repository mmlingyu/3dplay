import { landBounds } from './land-data.js';

export const BALLOON_NAME = '热气球草场';

export const BALLOON_BASE = Object.freeze({
  x: -4.2,
  z: 20.2,
  radius: 2.8,
  padHeight: 0.14,
  basketHeight: 0.72,
  cruiseHeight: 16.5,
  liftSeconds: 4.2,
  descendSeconds: 3.4,
  homeSpeed: 4.2,
  tourSeconds: 48,
});

export const BALLOON_CONTROL = Object.freeze({
  flySpeed: 4.8,
  climbSpeed: 2.6,
  minHeight: 8,
  maxHeight: 22,
  margin: 1.8,
  minScale: 0.22,
  maxScale: 0.48,
});

const ease = u => {
  const t = Math.min(1, Math.max(0, Number(u) || 0));
  return t * t * (3 - 2 * t);
};

export function balloonHomeDuration(fromX, fromZ) {
  const dist = Math.hypot((Number(fromX) || 0) - BALLOON_BASE.x, (Number(fromZ) || 0) - BALLOON_BASE.z);
  return Math.min(7.5, Math.max(2.2, dist / BALLOON_BASE.homeSpeed));
}

export function balloonNearBase(x, z, extra = 1.8) {
  return Math.hypot(x - BALLOON_BASE.x, z - BALLOON_BASE.z) <= extra;
}

export function balloonReturnPose(from, phase, u) {
  const t = ease(u);
  if (phase === 'home') {
    return {
      x: from.x + (BALLOON_BASE.x - from.x) * t,
      y: from.y ?? BALLOON_BASE.cruiseHeight,
      z: from.z + (BALLOON_BASE.z - from.z) * t,
    };
  }
  return {
    x: BALLOON_BASE.x,
    y: (from.y ?? BALLOON_BASE.cruiseHeight) * (1 - t),
    z: BALLOON_BASE.z,
  };
}

export function onBalloonLawn(x, z, extra = 0) {
  return Math.hypot(x - BALLOON_BASE.x, z - BALLOON_BASE.z) <= BALLOON_BASE.radius + extra;
}

export function balloonTourPoint(land, angle, scale = 0.36) {
  const bounds = landBounds(land);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const span = Math.min(BALLOON_CONTROL.maxScale, Math.max(BALLOON_CONTROL.minScale, Number(scale) || 0.36));
  const rx = Math.max(8, (bounds.maxX - bounds.minX) * span);
  const rz = Math.max(8, (bounds.maxZ - bounds.minZ) * span);
  return {
    x: cx + Math.cos(angle) * rx,
    z: cz + Math.sin(angle) * rz,
    cx,
    cz,
    rx,
    rz,
    scale: span,
    bounds,
  };
}

export function clampBalloonPose(land, x, y, z) {
  const bounds = landBounds(land);
  const m = BALLOON_CONTROL.margin;
  const low = Math.min(BALLOON_CONTROL.maxHeight, Math.max(BALLOON_CONTROL.minHeight, Number(y) || BALLOON_BASE.cruiseHeight));
  return {
    x: Math.min(bounds.maxX - m, Math.max(bounds.minX + m, Number(x) || 0)),
    y: low,
    z: Math.min(bounds.maxZ - m, Math.max(bounds.minZ + m, Number(z) || 0)),
  };
}

export function balloonSteer(from, { mx = 0, mz = 0, climb = 0, yaw = 0 }, dt, land) {
  const wx = mx * Math.cos(yaw) + mz * Math.sin(yaw);
  const wz = -mx * Math.sin(yaw) + mz * Math.cos(yaw);
  const speed = BALLOON_CONTROL.flySpeed;
  return clampBalloonPose(
    land,
    from.x + wx * speed * dt,
    from.y + climb * BALLOON_CONTROL.climbSpeed * dt,
    from.z + wz * speed * dt,
  );
}

export function balloonAngleFrom(land, x, z) {
  const tour = balloonTourPoint(land, 0);
  return Math.atan2(z - tour.cz, x - tour.cx);
}

export function balloonScaleFrom(land, x, z) {
  const tour = balloonTourPoint(land, 0, 0.36);
  const nx = tour.rx || 1;
  const nz = tour.rz || 1;
  const scale = 0.36 * Math.hypot((x - tour.cx) / nx, (z - tour.cz) / nz);
  return Math.min(BALLOON_CONTROL.maxScale, Math.max(BALLOON_CONTROL.minScale, scale));
}

export function balloonHomeAngle(land) {
  const bounds = landBounds(land);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  return Math.atan2(BALLOON_BASE.z - cz, BALLOON_BASE.x - cx);
}

export function wrapHeading(angle) {
  const turn = ((Number(angle) || 0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  return Math.round(turn / Math.PI * 180);
}

export function balloonLook(phase, angle = 0, mode = 'orbit') {
  if (phase === 'lift') {
    return { phase, title: '起飞', note: '慢慢升起来，看整个河谷。', hint: '坐稳，热气球正在升起。想下来就点降落。', landing: false, mode };
  }
  if (phase === 'home') {
    return { phase, title: '飞回基地', note: '热气球自己飞回南边的草坪基地。', hint: '坐好，它会自动降落到草坪上。', landing: true, mode };
  }
  if (phase === 'descend' || phase === 'land') {
    return { phase: 'descend', title: '降落', note: '对准草坪，慢慢下来。', hint: '马上回到热气球草坪基地。', landing: true, mode };
  }
  const heading = wrapHeading(angle);
  const steer = mode === 'steer';
  return {
    phase: 'tour',
    title: steer ? '自己开热气球' : '空中游览',
    note: steer ? `摇杆飞 · ${heading}°` : `转一圈看地图 · ${heading}°`,
    hint: steer ? '摇杆前后左右飞，点升高降低。想下来就降落到草坪基地。' : '摇杆左右换方向，前后拉近拉远。点自己开可以到处飞。',
    heading,
    landing: false,
    mode: steer ? 'steer' : 'orbit',
  };
}
