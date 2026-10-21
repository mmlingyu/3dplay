import * as THREE from 'three';
import { M, VB, pivot, V } from './kit.js';

const dark = M('#121418', { r: 0.6 });

/** Teen-proportioned humanoid, 24-ish voxels tall, front is +z. */
function humanoid(o) {
  const root = new THREE.Group();
  const legLen = o.legLen ?? 9; const hip = 2 + legLen; const torsoH = o.torsoH ?? 8;
  const sh = hip + torsoH; const neckTop = sh + 1;
  const P = {};
  P.legL = pivot(root, -1.3, hip, 0); P.legR = pivot(root, 1.3, hip, 0);
  for (const leg of [P.legL, P.legR]) {
    VB(leg, -1.1, -legLen, -1.4, 2.2, legLen, 2.8, o.legs);
    VB(leg, -1.2, -hip, -1.5, 2.4, 2, 3.4, o.shoes);
  }
  P.torso = pivot(root, 0, hip, 0);
  VB(P.torso, -2.6, 0, -1.9, 5.2, torsoH, 3.8, o.torso);
  P.armL = pivot(root, -2.6, sh, 0); P.armR = pivot(root, 2.6, sh, 0);
  VB(P.armL, -1.4, -(torsoH - 1.5), -1, 1.4, torsoH - 1.5, 2, o.arms ?? o.torso);
  VB(P.armL, -1.4, -torsoH, -0.9, 1.4, 1.5, 1.8, o.hands ?? o.skin);
  VB(P.armR, 0, -(torsoH - 1.5), -1, 1.4, torsoH - 1.5, 2, o.arms ?? o.torso);
  VB(P.armR, 0, -torsoH, -0.9, 1.4, 1.5, 1.8, o.hands ?? o.skin);
  VB(root, -0.9, sh, -0.9, 1.8, 1, 1.8, o.neck ?? o.skin);
  P.head = pivot(root, 0, neckTop, 0);
  const hw = o.headW ?? 4; const hh = o.headH ?? 4;
  VB(P.head, -hw / 2, 0, -2, hw, hh, 4, o.skin);
  if (!o.noFace) {
    VB(P.head, -1.4, hh * 0.45, 2, 0.8, 0.8, 0.15, o.eyes ?? dark);
    VB(P.head, 0.6, hh * 0.45, 2, 0.8, 0.8, 0.15, o.eyes ?? dark);
  }
  P.mouth = VB(P.head, -0.5, hh * 0.18, 2, 1, 0.35, 0.12, o.mouth ?? M('#5a2e2a'));
  P.mouth.userData.sy = P.mouth.scale.y;
  if (o.noFace) P.mouth.visible = false;
  return { root, P, hip, sh, neckTop, hh, hw };
}

function baseAnim(h, t, state, special) {
  const P = h.P; const breathe = Math.sin(t * 2.1);
  P.torso.scale.y = 1 + breathe * 0.012; P.head.position.y = h.neckTop * V + breathe * 0.004;
  P.head.rotation.set(0, 0, 0); P.armL.rotation.set(0, 0, 0.04 + breathe * 0.01); P.armR.rotation.set(0, 0, -0.04 - breathe * 0.01);
  P.legL.rotation.set(0, 0, 0); P.legR.rotation.set(0, 0, 0); h.root.rotation.z = 0;
  P.mouth.scale.y = P.mouth.userData.sy;
  if (state === 'idle') {
    P.head.rotation.y = Math.sin(t * 0.55) * 0.35 * Math.max(0, Math.sin(t * 0.27));
    h.root.rotation.z = Math.sin(t * 0.8) * 0.012;
  } else if (state === 'talk') {
    P.head.rotation.x = Math.sin(t * 5.5) * 0.07; P.head.rotation.z = Math.sin(t * 1.7) * 0.05;
    P.armR.rotation.x = -0.95 + Math.sin(t * 3.6) * 0.25; P.armR.rotation.z = -0.25;
    P.armL.rotation.x = Math.sin(t * 2.2) * 0.1;
    P.mouth.scale.y = P.mouth.userData.sy * (1 + Math.abs(Math.sin(t * 13)) * 2.2);
  } else if (special) special(t);
}

// ---------- 日谷 ----------

// ---------- 外星谷：星核化身、小咕、零一 ----------
export function avatar() {
  const suit = M('#2A2E36', { r: 0.45, m: 0.6 }); const glow = M('#36E0E8', { e: '#36E0E8', eD: 0.9, eN: 2.4, r: 0.3 });
  const h = humanoid({ skin: M('#D8B090'), torso: suit, legs: suit, shoes: M('#1A1D22', { r: 0.4, m: 0.6 }), hands: suit, legLen: 8 });
  const { P } = h;
  VB(P.torso, -3.0, 5.5, -2.2, 6.0, 2.8, 4.4, M('#343944', { r: 0.4, m: 0.7 }));  // chest/shoulder armor
  VB(P.torso, -0.25, 0.5, 1.95, 0.5, 5, 0.15, glow); VB(P.torso, -2.0, 4.6, 1.95, 4, 0.35, 0.15, glow);
  for (const leg of [P.legL, P.legR]) { VB(leg, -1.2, -5, 1.4, 2.4, 1.6, 0.4, M('#343944', { m: 0.7, r: 0.4 })); VB(leg, -0.15, -8, 1.42, 0.3, 7, 0.1, glow); VB(leg, -1.3, -10.2, -1.6, 2.6, 0.3, 3.6, glow); }
  VB(P.armL, -1.5, -5, -1.05, 1.6, 0.3, 2.1, glow); VB(P.armR, -0.1, -5, -1.05, 1.6, 0.3, 2.1, glow);
  VB(P.head, -2.2, 3.1, -2.3, 4.4, 1.4, 4.5, M('#2C2420')); VB(P.head, -2.2, 0.8, -2.3, 4.4, 2.6, 1.0, M('#2C2420'));
  const visor = M('#36E0E8', { op: 0.55, r: 0.05, m: 0.3, e: '#36E0E8', eD: 0.4, eN: 1.2 });
  VB(P.head, -2.3, 1.5, 1.9, 4.6, 1.4, 0.5, visor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.36, 40), new THREE.MeshBasicMaterial({ color: '#36E0E8', transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; h.root.add(ring);
  return { group: h.root, anim: (t, s) => {
    baseAnim(h, t, s, () => { P.armL.rotation.z = 0.5; P.armR.rotation.z = -0.5; P.head.rotation.x = -0.2; });
    const base = glow.userData.eD;
    glow.emissiveIntensity = (s === 'special' ? 3 : base + 0.5 * (0.5 + 0.5 * Math.sin(t * 2.5))) * (document.body.classList.contains('night') ? 2 : 1);
    visor.emissiveIntensity = s === 'talk' && Math.sin(t * 6) > 0 ? 1.5 : 0.5;
    if (s === 'special') { const k = (t % 1.5) / 1.5; ring.scale.setScalar(1 + k * 6); ring.material.opacity = 1 - k; } else ring.material.opacity = 0;
  } };
}

export function gugu() {
  const skin = M('#7E9A7A', { r: 0.75 }); const coat = M('#2C3530', { r: 0.85 }); const line = M('#36E0E8', { e: '#36E0E8', eD: 0.8, eN: 2.2 });
  const h = humanoid({ skin, torso: coat, legs: M('#222826'), shoes: M('#15181A', { r: 0.4 }), hands: skin, legLen: 10, torsoH: 9, headW: 3.6, headH: 4.4, eyes: M('#101418', { r: 0.1, m: 0.4 }) });
  const { P } = h;
  VB(P.torso, -2.9, -4.5, -2.2, 5.8, 5, 4.4, coat);
  VB(P.torso, -0.3, -4.5, 2.2, 0.6, 13, 0.1, line); VB(P.torso, -2.9, -4.5, 2.21, 5.8, 0.3, 0.1, line);
  VB(P.torso, -3.0, 7.5, -2.3, 6.0, 2, 4.6, M('#353F3A'));
  for (const arm of [P.armL, P.armR]) { VB(arm, arm === P.armL ? -1.4 : 0, -9.6, 0.5, 0.4, 1.2, 0.4, skin); }
  const antenna = pivot(P.head, 0, 4.4, 0);
  VB(antenna, -0.25, 0, -0.25, 0.5, 2.6, 0.5, skin);
  const tip = M('#9DFF8A', { e: '#9DFF8A', eD: 1, eN: 2.5 }); VB(antenna, -0.6, 2.6, -0.6, 1.2, 1.2, 1.2, tip);
  // bigger dark eyes
  VB(P.head, -1.6, 1.7, 2.0, 1.2, 1.1, 0.15, M('#0A0D10', { r: 0.1, m: 0.5 })); VB(P.head, 0.4, 1.7, 2.0, 1.2, 1.1, 0.15, M('#0A0D10', { r: 0.1, m: 0.5 }));
  return { group: h.root, anim: (t, s) => {
    baseAnim(h, t, s, () => { const k = (t % 1.2) / 1.2; tip.emissiveIntensity = k < 0.5 && Math.sin(k * 40) > 0 ? 4 : 0.6; P.armR.rotation.x = -1.6; P.head.rotation.y = 0.3; antenna.rotation.z = -0.3; });
    if (s !== 'special') { antenna.rotation.z = Math.sin(t * 1.3) * 0.12; tip.emissiveIntensity = (document.body.classList.contains('night') ? 2.5 : 1) * (0.6 + 0.4 * Math.sin(t * 1.5)); }
    if (s === 'talk') { P.armL.rotation.x = -0.8; P.armL.rotation.z = 0.3; P.head.rotation.z = 0.18; }
    if (s === 'idle') h.root.rotation.x = Math.sin(t * 0.9) * 0.02; else h.root.rotation.x = 0;
  } };
}

export function zero() {
  const root = new THREE.Group(); const body = pivot(root, 0, 18, 0);
  const armor = M('#2A2E36', { r: 0.35, m: 0.8 }); const seam = M('#1A1D22', { r: 0.6 });
  VB(body, -3, -3, -3, 6, 6, 6, armor);
  VB(body, -3.2, -2.2, -2.2, 6.4, 4.4, 4.4, seam); VB(body, -2.2, -3.2, -2.2, 4.4, 6.4, 4.4, armor); VB(body, -2.2, -2.2, -3.2, 4.4, 4.4, 6.4, armor);
  const eye = M('#FF8A2A', { e: '#FF8A2A', eD: 1.2, eN: 2.6, r: 0.2 });
  VB(body, -1.5, -1.0, 3.2, 3, 2, 0.4, eye); VB(body, -1.0, -1.5, 3.2, 2, 3, 0.4, eye);
  VB(body, -0.6, -0.6, 3.5, 1.2, 1.2, 0.3, M('#1A0A00', { r: 0.1 }));
  const thrust = M('#5AC8FF', { e: '#5AC8FF', eD: 1, eN: 2.2 });
  for (const sx of [-1, 1]) {
    VB(body, sx > 0 ? 3.2 : -5.2, -1.5, -1.5, 2, 3, 3, armor);
    VB(body, sx > 0 ? 3.6 : -4.8, -2.0, -1.0, 1.2, 0.5, 2, thrust);
  }
  VB(body, -0.3, 3.2, -0.3, 0.6, 2, 0.6, armor); VB(body, -0.5, 5.2, -0.5, 1, 0.6, 1, eye);
  for (let i = 0; i < 4; i++) VB(body, -2 + i * 1.2, -3.4, 2.2, 0.6, 0.3, 0.6, thrust);
  const beamMat = new THREE.MeshBasicMaterial({ color: '#36E0E8', transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.6, 24, 1, true), beamMat); beam.rotation.x = -Math.PI / 2; beam.position.set(0, 0, 3.6 * V + 0.8); body.add(beam);
  const coneMat = new THREE.MeshBasicMaterial({ color: '#5AC8FF', transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.6, 12, 1, true), coneMat); c.position.set(sx * 4.2 * V, -2.4 * V - 0.3, 0); c.rotation.x = Math.PI; body.add(c); }
  return { group: root, anim: (t, s) => {
    body.position.y = 18 * V + Math.sin(t * 1.8) * 0.06; body.rotation.y = s === 'idle' ? Math.sin(t * 0.5) * 0.5 : 0;
    body.rotation.x = s === 'talk' ? Math.sin(t * 5) * 0.06 : 0;
    const n = document.body.classList.contains('night') ? 2 : 1;
    eye.color.set(s === 'special' ? '#36E0E8' : '#FF8A2A'); eye.emissive.set(s === 'special' ? '#36E0E8' : '#FF8A2A');
    eye.emissiveIntensity = (s === 'talk' ? (Math.sin(t * 9) > 0 ? 2.5 : 0.4) : 1.2) * n;
    beamMat.opacity = s === 'special' ? 0.25 + 0.15 * Math.sin(t * 6) : 0; beam.rotation.z = t;
  } };
}
