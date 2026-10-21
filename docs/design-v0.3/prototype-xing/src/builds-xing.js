import * as THREE from 'three';
import { M, B, C } from './kit.js';

const night = () => document.body.classList.contains('night');

// ---------- 日谷 ----------
// ---------- 外星谷 ----------
export function dome() {
  const g = new THREE.Group();
  const metal = M('#2A2E36', { r: 0.4, m: 0.8 }); const strip = M('#36E0E8', { e: '#36E0E8', eD: 1.2, eN: 2.4 });
  const R = 12;
  for (let i = 0; i < 40; i++) {
    const a = i / 40 * Math.PI * 2; const s = C(g, Math.cos(a) * 11, 1, Math.sin(a) * 11, 2.2, 2, 2.1, metal); s.rotation.y = -a;
    const l = C(g, Math.cos(a) * 12.1, 1.3, Math.sin(a) * 12.1, 0.1, 0.3, 1.9, strip, false); l.rotation.y = -a;
  }
  const hex = new THREE.CylinderGeometry(0.98, 0.98, 0.12, 6);
  const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  const pts = [];
  for (let ring = 0; ring < 8; ring++) {
    const phi = (ring + 0.5) / 8 * Math.PI / 2 * 0.96; const r = Math.cos(phi) * R; const n = Math.max(1, Math.round(2 * Math.PI * r / 2.05));
    for (let i = 0; i < n; i++) { const th = (i + (ring % 2) * 0.5) / n * Math.PI * 2; pts.push([phi, th]); }
  }
  const inst = new THREE.InstancedMesh(hex, mat, pts.length);
  const frame = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.05, 1.05, 0.08, 6), M('#1A2230', { r: 0.4, m: 0.7 }), pts.length);
  const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const up = new THREE.Vector3(0, 1, 0); const col = new THREE.Color();
  pts.forEach(([phi, th], i) => {
    const n = new THREE.Vector3(Math.cos(phi) * Math.cos(th), Math.sin(phi), Math.cos(phi) * Math.sin(th));
    q.setFromUnitVectors(up, n); const p = n.clone().multiplyScalar(R).add(new THREE.Vector3(0, 2, 0));
    m4.compose(p, q, new THREE.Vector3(1, 1, 1)); inst.setMatrixAt(i, m4);
    m4.compose(p.clone().addScaledVector(n, -0.08), q, new THREE.Vector3(1, 1, 1)); frame.setMatrixAt(i, m4);
    inst.setColorAt(i, col.set('#36E0E8'));
  });
  const gap = Math.floor(pts.length * 0.62);
  g.add(frame, inst);
  B(g, -2, 0, -2, 4, 1.2, 4, metal); B(g, -1.5, 1.2, -1.5, 3, 0.15, 3, M('#FFB347', { e: '#FFB347', eD: 1.4, eN: 2.6 }));
  const holo = new THREE.Mesh(new THREE.PlaneGeometry(3, 2), new THREE.MeshBasicMaterial({ color: '#36E0E8', transparent: true, opacity: 0.35, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  holo.position.set(0, 3.2, 0); g.add(holo);
  return { group: g, anim: (t, s) => {
    const n = night() ? 1.3 : 0.9; const fill = s === 'action' ? Math.min(1, (t % 8) / 5) : 0;
    pts.forEach(([phi, th], i) => {
      let v = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.3 + th * 3 + phi * 5));
      if (i === gap || i === gap + 1) v = s === 'action' ? (fill > 0.9 ? 1.2 : 0.05) : 0.04;
      else if (s === 'action') v = phi / (Math.PI / 2) < fill ? 1.1 : v * 0.4;
      col.setRGB(0.21 * v * n, 0.88 * v * n, 0.91 * v * n); inst.setColorAt(i, col);
    });
    inst.instanceColor.needsUpdate = true; holo.rotation.y = t * 0.4;
  } };
}

export function pad() {
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  const gr = M('#2A2E36', { r: 0.5, m: 0.7 }); const dk = M('#1A1D22', { r: 0.6 });
  const strip = M('#36E0E8', { e: '#36E0E8', eD: 1.2, eN: 2.4 }); const core = M('#FFB347', { e: '#FFB347', eD: 1.4, eN: 2.8 });
  B(body, -2.5, 4, -2.5, 5, 1, 5, gr); B(body, -1.5, 3.3, -1.5, 3, 0.7, 3, dk); B(body, -0.8, 2.8, -0.8, 1.6, 0.5, 1.6, gr);
  B(body, -3.5, 5, -2.5, 7, 1, 5, gr); B(body, -2.5, 5, -3.5, 5, 1, 7, gr);
  for (const [x, z, w, d] of [[-3.55, -2.5, 0.1, 5], [3.45, -2.5, 0.1, 5], [-2.5, -3.55, 5, 0.1], [-2.5, 3.45, 5, 0.1]]) B(body, x, 5.75, z, w, 0.2, d, strip, false);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; const c = C(body, Math.cos(a) * 3.55, 5.5, Math.sin(a) * 3.55, 1.45, 0.2, 0.1, strip, false); c.rotation.y = -a + Math.PI / 2; }
  B(body, -1.5, 6, -1.5, 3, 0.5, 3, dk); const coreM = B(body, -1.2, 6.2, -1.2, 2.4, 0.4, 2.4, core);
  for (const [x, z] of [[-2.6, -2.6], [1.6, -2.6], [-2.6, 1.6], [1.6, 1.6]]) { B(body, x, 6, z, 1, 1.5, 1, gr); B(body, x + 0.2, 7.5, z + 0.2, 0.6, 0.2, 0.6, strip, false); }
  for (let x = -3; x < 3; x += 1.5) B(body, x, 6.0, -0.05, 0.9, 0.02, 0.1, dk, false);
  const beamMat = new THREE.MeshBasicMaterial({ color: '#FFB347', transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 4, 16, 1, true), beamMat); beam.position.y = 0.9; body.add(beam);
  const beam2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.25, 4, 12, 1, true), beamMat); beam2.position.y = 0.9; body.add(beam2);
  return { group: g, anim: (t, s) => {
    body.position.y = Math.sin(t * Math.PI / 2) * 0.3; body.rotation.y = t * 0.08;
    const n = night() ? 1.8 : 1;
    core.emissiveIntensity = (1.2 + Math.sin(t * (s === 'action' ? 6 : 2)) * 0.6) * n;
    strip.color.set(s === 'action' ? '#FFF2C8' : '#36E0E8'); strip.emissive.set(s === 'action' ? '#FFE9A8' : '#36E0E8');
    strip.emissiveIntensity = (s === 'action' ? 2.4 : 1.2) * n;
    beamMat.opacity = 0.35 + Math.sin(t * 3) * 0.1;
  } };
}

export function ship() {
  const g = new THREE.Group(); const hull = new THREE.Group(); g.add(hull);
  const armor = M('#5A606C', { r: 0.4, m: 0.6 }); const seam = M('#1A1D22', { r: 0.6 }); const warn = M('#FF8A2A', { r: 0.6 });
  const canopy = M('#36E0E8', { op: 0.5, r: 0.05, m: 0.4, e: '#36E0E8', eD: 0.3, eN: 1 });
  const jet = M('#5AC8FF', { e: '#5AC8FF', eD: 1.4, eN: 2.6 }); const nav = M('#36E0E8', { e: '#36E0E8', eD: 1, eN: 2.6 });
  B(hull, -2, 2, -6, 4, 3, 12, armor); B(hull, -1.5, 2.2, 6, 3, 2.4, 2, armor); B(hull, -1, 2.5, 8, 2, 1.6, 1, armor);
  B(hull, -1.2, 4.4, 5, 2.4, 0.9, 3, canopy); B(hull, -1.6, 5, -5, 3.2, 1, 7, armor);
  for (let z = -5; z < 6; z += 2.2) { B(hull, -2.02, 2.3, z, 0.05, 2.4, 0.08, seam, false); B(hull, 1.97, 2.3, z, 0.05, 2.4, 0.08, seam, false); }
  B(hull, -2.03, 3.6, -4, 0.05, 0.3, 6, warn, false); B(hull, 1.98, 3.6, -4, 0.05, 0.3, 6, warn, false);
  const jets = [];
  for (const sx of [-1, 1]) {
    const x = sx > 0 ? 2 : -4;
    B(hull, x, 2.2, -8, 2, 2, 7, armor); B(hull, x + 0.2, 2.4, -8.3, 1.6, 1.6, 0.3, seam);
    jets.push(B(hull, x + 0.4, 2.6, -8.4, 1.2, 1.2, 0.15, jet, false));
    B(hull, sx > 0 ? 2 : -4.5, 3, -3, 2.5, 0.5, 5, armor); B(hull, sx > 0 ? 4.3 : -4.5, 3, -3, 0.2, 0.5, 5, warn);
    B(hull, sx > 0 ? 4.3 : -4.5, 3.5, -1, 0.2, 0.2, 0.2, nav, false);
    B(hull, sx * 1.2 - 0.25, 5, -6, 0.5, 2, 2, armor);
  }
  B(g, -0.9, 2.05, 1.5, 1.8, 0.1, 0.4, warn);
  const gear = [];
  for (const [x, z] of [[-1.6, -4], [1.1, -4], [-1.6, 3], [1.1, 3]]) { const leg = new THREE.Group(); g.add(leg); B(leg, x, 0.3, z, 0.5, 1.7, 0.5, seam); B(leg, x - 0.25, 0, z - 0.25, 1, 0.3, 1, armor); gear.push(leg); }
  const ramp = new THREE.Group(); ramp.position.set(2, 2.2, 1); g.add(ramp);
  const rampMesh = B(ramp, 0, -0.1, -0.8, 3.2, 0.2, 1.6, armor); rampMesh.position.x = 1.6;
  const plumeMat = new THREE.MeshBasicMaterial({ color: '#5AC8FF', transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
  const plumes = jets.map((j) => { const c = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.4, 16, 1, true), plumeMat); c.rotation.x = -Math.PI / 2; c.position.set(j.position.x, j.position.y, -9.6); hull.add(c); return c; });
  return { group: g, anim: (t, s) => {
    const n = night() ? 1.6 : 1;
    const takeoff = s === 'action' ? Math.min(1, (t % 8) / 3) : 0;
    hull.position.y = takeoff * 2; hull.rotation.x = -takeoff * 0.06;
    gear.forEach((l) => { l.scale.y = 1 - takeoff * 0.8; l.visible = takeoff < 0.95; });
    ramp.rotation.z = s === 'action' ? 0 : -0.45; ramp.visible = takeoff < 0.3;
    const c = takeoff > 0.2 ? '#FFB347' : '#5AC8FF';
    jet.color.set(c); jet.emissive.set(c); plumeMat.color.set(c);
    jet.emissiveIntensity = (1.2 + Math.sin(t * 3) * 0.4 + takeoff * 2) * n;
    plumes.forEach((p) => { p.scale.set(1, 0.6 + takeoff * 1.6 + Math.sin(t * 20) * 0.05, 1); });
    plumeMat.opacity = 0.2 + takeoff * 0.4;
    nav.emissiveIntensity = Math.sin(t * 3) > 0.5 ? 3 : 0.3;
  } };
}
