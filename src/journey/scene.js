/** Lightweight journey diorama. One unlit pass, merged static meshes, instanced movers. */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _color = new THREE.Color();
const _dummy = new THREE.Object3D();

function vertexBox(w, h, d, color, x, y, z) {
  const geometry = new THREE.BoxGeometry(w, h, d);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  _color.set(color);
  for (let i = 0; i < position.count; i += 1) {
    colors[i * 3] = _color.r;
    colors[i * 3 + 1] = _color.g;
    colors[i * 3 + 2] = _color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.translate(x, y, z);
  return geometry;
}

function mergeParts(parts) {
  if (!parts.length) return null;
  const geometry = parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
  if (parts.length > 1) for (const part of parts) part.dispose();
  return geometry;
}

function coloredMesh(parts) {
  const geometry = mergeParts(parts);
  if (!geometry) return null;
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true }));
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function skyDome(top, horizon) {
  const geometry = new THREE.SphereGeometry(96, 14, 8);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const above = new THREE.Color(top);
  const below = new THREE.Color(horizon);
  for (let i = 0; i < position.count; i += 1) {
    const y = position.getY(i) / 96;
    const t = THREE.MathUtils.clamp(y * 0.55 + 0.35, 0, 1);
    _color.copy(below).lerp(above, t);
    colors[i * 3] = _color.r;
    colors[i * 3 + 1] = _color.g;
    colors[i * 3 + 2] = _color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    depthWrite: false,
  }));
  mesh.castShadow = false;
  return mesh;
}

function makeCraft(kind, accent) {
  if (kind === 'liner') {
    return coloredMesh([
      vertexBox(2.4, 0.55, 6.2, '#f4efe4', 0, 0.45, 0),
      vertexBox(2.1, 0.7, 2.4, '#8d5a3c', 0, 1.05, -0.4),
      vertexBox(0.7, 0.9, 0.7, accent, 0, 1.7, -1.6),
      vertexBox(2.6, 0.16, 1.2, '#c44536', 0, 0.85, 2.2),
    ]);
  }
  if (kind === 'balloon') {
    const envelope = new THREE.Mesh(
      new THREE.SphereGeometry(1.35, 10, 8),
      new THREE.MeshBasicMaterial({ color: accent }),
    );
    envelope.position.y = 2.3;
    envelope.castShadow = false;
    const basket = coloredMesh([
      vertexBox(0.9, 0.55, 0.7, '#c9844a', 0, 0.4, 0),
      vertexBox(0.08, 1.3, 0.08, '#f4efe4', -0.35, 1.3, 0),
      vertexBox(0.08, 1.3, 0.08, '#f4efe4', 0.35, 1.3, 0),
    ]);
    const group = new THREE.Group();
    group.add(envelope);
    if (basket) group.add(basket);
    return group;
  }
  return coloredMesh([
    vertexBox(1.15, 0.38, 2.4, '#f3e2c4', 0, 0.32, 0),
    vertexBox(0.08, 1.5, 0.08, '#8d5a3c', 0, 1.15, 0.15),
    vertexBox(0.06, 1.15, 0.7, '#fffaf0', 0.28, 1.35, 0.15),
  ]);
}

function makeTower() {
  const parts = [];
  for (let i = 0; i < 7; i += 1) {
    parts.push(vertexBox(1.1 - i * 0.06, 0.7, 1.1 - i * 0.06, i % 2 ? '#f4f1ea' : '#d84b4b', 0, 0.4 + i * 0.7, 0));
  }
  parts.push(vertexBox(0.35, 0.8, 0.35, '#f4f1ea', 0, 5.5, 0));
  return coloredMesh(parts);
}

function makeTrain() {
  return coloredMesh([
    vertexBox(1.6, 0.7, 0.7, '#f7f3ea', 0, 0.55, 0),
    vertexBox(0.35, 0.35, 0.72, '#7eb6ea', -0.4, 0.7, 0),
    vertexBox(0.35, 0.35, 0.72, '#7eb6ea', 0.35, 0.7, 0),
    vertexBox(4.8, 0.18, 0.35, '#8d9398', 0, 0.12, 0),
  ]);
}

function makeBridge() {
  return coloredMesh([
    vertexBox(7.5, 0.28, 1.1, '#c44536', 0, 3.3, 0),
    vertexBox(0.35, 3.4, 0.35, '#a3262a', -3.2, 1.7, 0),
    vertexBox(0.35, 3.4, 0.35, '#a3262a', 3.2, 1.7, 0),
    vertexBox(6.4, 0.08, 0.08, '#f4efe4', 0, 2.4, 0.2),
  ]);
}

function makeUsa() {
  const parts = [
    vertexBox(0.22, 1.3, 0.22, '#fffaf0', -1.15, 1.5, 0),
    vertexBox(0.22, 1.3, 0.22, '#fffaf0', -0.45, 1.5, 0),
    vertexBox(0.7, 0.22, 0.22, '#fffaf0', -0.8, 0.95, 0),
    vertexBox(0.7, 0.2, 0.22, '#fffaf0', 0.15, 2.05, 0),
    vertexBox(0.7, 0.2, 0.22, '#fffaf0', 0.15, 1.45, 0),
    vertexBox(0.7, 0.2, 0.22, '#fffaf0', 0.15, 0.9, 0),
    vertexBox(0.22, 1.3, 0.22, '#fffaf0', 1.15, 1.5, 0),
    vertexBox(0.22, 1.3, 0.22, '#fffaf0', 1.7, 1.5, 0),
    vertexBox(0.55, 0.2, 0.22, '#fffaf0', 1.42, 2.05, 0),
  ];
  const letters = coloredMesh(parts);
  const hill = coloredMesh([
    vertexBox(6.5, 1.4, 3.2, '#7ea15a', 0, 0.5, 0.4),
    vertexBox(3.2, 0.2, 2.2, '#c9d89a', 0.2, 0.15, 2.2),
  ]);
  const group = new THREE.Group();
  if (hill) group.add(hill);
  if (letters) {
    letters.position.set(0, 1.15, -0.2);
    group.add(letters);
  }
  return group;
}

function makeDock() {
  return coloredMesh([
    vertexBox(2.2, 0.18, 0.8, '#c9844a', 0, 0.2, 0),
    vertexBox(0.12, 0.7, 0.12, '#8d5a3c', -0.8, 0.5, 0),
    vertexBox(0.12, 0.7, 0.12, '#8d5a3c', 0.8, 0.5, 0),
    vertexBox(1.4, 0.9, 1.1, '#f4efe4', 2.2, 0.6, -0.2),
    vertexBox(1.6, 0.3, 1.3, '#c45a3a', 2.2, 1.2, -0.2),
  ]);
}

function makePlatform() {
  return coloredMesh([
    vertexBox(3.4, 0.22, 1.1, '#d9d3c7', 0, 0.2, 0),
    vertexBox(0.7, 1.1, 0.5, '#f4efe4', -1.1, 0.8, -0.2),
    vertexBox(0.16, 1.6, 0.16, '#d84b4b', 1.2, 1.1, 0),
  ]);
}

function gullGeometry() {
  const geometry = new THREE.ConeGeometry(0.16, 0.7, 4);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

export function createJourneyScene(route, { quality = 'fast' } = {}) {
  const fine = quality === 'fine';
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(route.skyHorizon);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 220);
  const sky = skyDome(route.skyTop, route.skyHorizon);
  scene.add(sky);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 180),
    new THREE.MeshBasicMaterial({ color: route.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.castShadow = false;
  scene.add(sea);

  const craft = makeCraft(route.craft, route.accent);
  if (craft) scene.add(craft);

  const pickables = [];
  const pops = { gull: [], cloud: [], star: [], light: 0, whale: 0, meteor: 0 };
  const beatOn = new Set();

  const gullCount = route.critter === 'gulls' ? (fine ? 8 : 5) : 0;
  let gulls = null;
  if (gullCount) {
    gulls = new THREE.InstancedMesh(gullGeometry(), new THREE.MeshBasicMaterial({ color: '#f7f4ee' }), gullCount);
    gulls.castShadow = false;
    gulls.userData.pick = 'gull';
    scene.add(gulls);
    pickables.push(gulls);
  }

  const cloudCount = route.critter === 'clouds' || route.mood.startsWith('star') ? (fine ? 9 : 6) : 0;
  let clouds = null;
  if (cloudCount) {
    clouds = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1.1, 7, 5),
      new THREE.MeshBasicMaterial({ color: '#f4f7fb', transparent: true, opacity: 0.92 }),
      cloudCount,
    );
    clouds.castShadow = false;
    clouds.userData.pick = 'cloud';
    scene.add(clouds);
    pickables.push(clouds);
  }

  let whale = null;
  if (route.critter === 'whale') {
    whale = coloredMesh([
      vertexBox(1.5, 0.55, 3.2, '#35586a', 0, 0.4, 0),
      vertexBox(0.7, 0.4, 0.8, '#35586a', -0.2, 0.7, -1.3),
      vertexBox(0.15, 0.7, 0.45, '#c9d7df', 0, 0.95, 0.2),
    ]);
    if (whale) {
      whale.userData.pick = 'whale';
      scene.add(whale);
      pickables.push(whale);
    }
  }

  const starCount = route.critter === 'stars' ? (fine ? 140 : 64) : 0;
  let starField = null;
  if (starCount) {
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 70;
      positions[i * 3 + 1] = 8 + Math.random() * 28;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starField = new THREE.Points(geometry, new THREE.PointsMaterial({
      color: route.accent,
      size: fine ? 0.28 : 0.36,
      sizeAttenuation: true,
    }));
    scene.add(starField);
  }

  const cityCount = route.mood.includes('night') || route.mood === 'star-home' ? (fine ? 70 : 32) : 0;
  let city = null;
  if (cityCount) {
    const positions = new Float32Array(cityCount * 3);
    for (let i = 0; i < cityCount; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 22;
      positions[i * 3 + 1] = 0.3 + Math.random() * 1.4;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 16;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    city = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#ffd978', size: 0.34, sizeAttenuation: true }));
    scene.add(city);
  }

  const tower = route.mood === 'sea-day' || route.mood === 'night-city' || route.mood === 'sea-home' || route.mood === 'night-home' ? makeTower() : null;
  const train = tower ? makeTrain() : null;
  const bridge = route.mood === 'sea-dusk' || route.mood === 'dusk-home' ? makeBridge() : null;
  const usa = route.mood === 'dusk-hill' || route.mood === 'hill-home' ? makeUsa() : null;
  const dock = makeDock();
  const platform = route.mood === 'sea-day' ? makePlatform() : null;
  const fogSheet = route.mood.startsWith('star') ? new THREE.Mesh(
    new THREE.PlaneGeometry(90, 28),
    new THREE.MeshBasicMaterial({ color: '#c5ced6', transparent: true, opacity: 0.45, depthWrite: false }),
  ) : null;
  if (fogSheet) {
    fogSheet.castShadow = false;
    scene.add(fogSheet);
  }
  for (const mesh of [tower, train, bridge, usa, dock, platform]) {
    if (!mesh) continue;
    scene.add(mesh);
  }

  const lights = [];
  if (route.interaction === 'searchlight' || route.mood === 'sea-dusk') {
    for (const side of [-1, 1]) {
      const beam = new THREE.Mesh(
        new THREE.ConeGeometry(0.45, 3.2, 5),
        new THREE.MeshBasicMaterial({ color: '#fff1b8', transparent: true, opacity: 0.85 }),
      );
      beam.castShadow = false;
      beam.userData.pick = 'light';
      beam.userData.side = side;
      scene.add(beam);
      pickables.push(beam);
      lights.push(beam);
    }
  }

  const meteors = [];
  if (route.interaction === 'meteor') {
    for (let i = 0; i < 4; i += 1) {
      const star = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 6, 5),
        new THREE.MeshBasicMaterial({ color: '#fffaf0' }),
      );
      star.castShadow = false;
      star.userData.pick = 'star';
      star.userData.index = i;
      scene.add(star);
      pickables.push(star);
      meteors.push(star);
    }
  }

  const lamps = (route.beats || []).length
    ? new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.12, 5, 4),
      new THREE.MeshBasicMaterial({ color: '#fff4d2' }),
      route.beats.length,
    )
    : null;
  if (lamps) {
    lamps.castShadow = false;
    if (craft) craft.add(lamps);
    else scene.add(lamps);
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function placeInstance(mesh, index, x, y, z, scale = 1) {
    _dummy.position.set(x, y, z);
    _dummy.scale.setScalar(scale);
    _dummy.rotation.set(0, 0, 0);
    _dummy.updateMatrix();
    mesh.setMatrixAt(index, _dummy.matrix);
  }

  function look(x, y, z, tx, ty, tz) {
    camera.position.set(x, y, z);
    camera.lookAt(tx, ty, tz);
  }

  function update(progress, elapsed, fx = {}) {
    const u = THREE.MathUtils.clamp(progress, 0, 1);
    const sway = THREE.MathUtils.clamp(fx.sway || 0, -1, 1);
    const time = elapsed || 0;
    const span = 42;
    const outbound = route.direction !== 'return';
    const travel = outbound ? u * span : (1 - u) * span;
    const bob = Math.sin(time * 1.6) * 0.08;
    if (craft) {
      const lift = route.craft === 'balloon' ? 6 + Math.sin(time * 0.8) * 0.15 : bob;
      craft.position.set(sway * (route.craft === 'balloon' ? 3.2 : 0.35), lift, 0);
      if (route.craft === 'balloon') craft.rotation.z = sway * -0.12;
    }
    if (gulls) {
      for (let i = 0; i < gullCount; i += 1) {
        const pop = pops.gull[i] || 0;
        if (pop > 0) pops.gull[i] = Math.max(0, pop - 0.02);
        const wing = Math.sin(time * 3 + i) * 0.4;
        const x = Math.sin(time * 0.7 + i * 1.3) * 4.5 + (i - gullCount / 2) * 0.8;
        const y = 2.2 + (i % 3) * 0.45 + pop * 1.4 + wing;
        const z = 3 + (i * 1.7) - travel * 0.15;
        placeInstance(gulls, i, x, y, z, 1 + pop);
      }
      gulls.instanceMatrix.needsUpdate = true;
    }
    if (clouds) {
      for (let i = 0; i < cloudCount; i += 1) {
        const pop = pops.cloud[i] || 0;
        if (pop > 0) pops.cloud[i] = Math.max(0, pop - 0.015);
        const gap = sway * 3.2;
        const x = (i - cloudCount / 2) * 3.4 + (i % 2 ? 1.2 : -0.6);
        const nudged = x + Math.sign(x - gap) * pop * 1.6;
        const y = route.mood.startsWith('star') ? 7 + (i % 3) : 8.5 + (i % 2);
        const z = 6 + (i % 4) * 3 - travel * 0.25;
        placeInstance(clouds, i, nudged, y, z, 1.15 + pop * 0.6);
      }
      clouds.instanceMatrix.needsUpdate = true;
    }
    if (whale) {
      if (pops.whale > 0) pops.whale = Math.max(0, pops.whale - 0.012);
      const base = Math.max(0, Math.sin(time * 0.9));
      whale.position.set(4.8, -0.2 + base * 0.8 + pops.whale * 1.5, 8 - travel * 0.35);
      whale.rotation.z = Math.sin(time * 0.9) * 0.2;
    }
    if (tower) {
      const z = (outbound ? 28 : 8) - travel * 0.82;
      tower.position.set(2.1, 0, z);
      const near = outbound ? THREE.MathUtils.smoothstep(u, 0.48, 0.78) : 1 - u * 0.7;
      tower.scale.setScalar(0.7 + near * 1.05);
    }
    if (train && tower) {
      const run = ((time * 1.4) % 8) - 4;
      train.position.set(tower.position.x - 1.5 + run * 0.22, 2.35, tower.position.z + 0.8);
      train.scale.setScalar(tower.scale.x);
      train.visible = outbound ? u > 0.48 : u < 0.55;
    }
    if (bridge) {
      bridge.position.set(0, 0, (outbound ? 33 : 10) - travel);
      bridge.visible = true;
    }
    if (usa) {
      const come = outbound ? THREE.MathUtils.smoothstep(u, 0.48, 0.84) : 1 - u;
      usa.position.set(3.2, 0, (outbound ? 30 : 6) - travel * 0.8);
      usa.scale.setScalar(0.4 + come * 0.9);
    }
    if (dock) {
      const home = outbound ? 4 - travel * 1.15 : -8 + u * 16;
      dock.position.set(-3.6, 0, home);
      dock.visible = outbound ? u < 0.45 : u > 0.4;
    }
    if (platform) {
      const anchor = tower ? tower.position.z : (outbound ? 30 : 4) - travel * 0.92;
      platform.position.set(-1.8, 0, anchor + 0.2);
      platform.scale.setScalar(tower ? tower.scale.x : 1);
      platform.visible = u > 0.58;
    }
    if (city) {
      city.position.set(0, 0, (outbound ? 26 : 4) - travel * 0.7);
      const twinkle = 0.75 + Math.sin(time * 3) * 0.25;
      city.material.opacity = twinkle;
      city.material.transparent = true;
    }
    if (starField) {
      starField.rotation.y = time * 0.02;
      starField.position.y = route.mood === 'star-home' ? 6 * (1 - u) : 4 * u;
    }
    if (fogSheet) {
      const lift = route.mood === 'star-rise' ? 4 + u * 16 : 14 - u * 10;
      fogSheet.position.set(0, lift, 6);
      fogSheet.material.opacity = route.mood === 'star-rise'
        ? THREE.MathUtils.clamp(0.62 - u * 0.7, 0.05, 0.62)
        : THREE.MathUtils.clamp(u * 0.4, 0.05, 0.4);
    }
    if (lamps && craft) {
      const beats = route.beats || [];
      for (let i = 0; i < beats.length; i += 1) {
        const lit = beatOn.has(i) || u >= beats[i];
        const x = (i - (beats.length - 1) / 2) * 0.28;
        placeInstance(lamps, i, x, route.craft === 'liner' ? 1.15 : 0.72, 0.2, lit ? 1.25 : 0.7);
        lamps.setColorAt(i, _color.set(lit ? '#fff4d2' : '#8a8070'));
      }
      lamps.instanceMatrix.needsUpdate = true;
      if (lamps.instanceColor) lamps.instanceColor.needsUpdate = true;
    }
    lights.forEach((beam, index) => {
      const flash = pops.light > 0 && Math.ceil(pops.light * 10) % 2 === 0;
      beam.material.opacity = flash ? 1 : 0.72;
      beam.position.set(beam.userData.side * 4.5, 1.6, (outbound ? 24 : 10) - travel * 0.6);
      beam.rotation.z = beam.userData.side * (0.7 + Math.sin(time * 0.8 + index) * 0.25);
    });
    if (pops.light > 0) pops.light = Math.max(0, pops.light - 0.02);
    meteors.forEach((star, index) => {
      const shot = pops.star[index] || 0;
      if (shot > 0) pops.star[index] = Math.max(0, shot - 0.03);
      const base = (index / meteors.length) * Math.PI * 2;
      star.position.set(Math.cos(base + time * 0.15) * 7, 12 + index * 0.4 - shot * 6, 8 + Math.sin(base) * 4);
      star.scale.setScalar(1 + shot * 1.8);
    });

    const under = bridge && Math.abs(bridge.position.z - 1.2) < 3.2 && u > 0.55;
    if (route.mood === 'sea-day') {
      look(0.2 + sway, 2.15, -6.4, 1.4, 1.3, 7);
    } else if (route.mood === 'sea-dusk') {
      look(0, under ? 1.15 : 3.1, -7, 0, under ? 3.4 : 1.5, 8);
    } else if (route.mood === 'sea-home' || route.mood === 'dusk-home') {
      look(-0.4, 2.4, -6.2, 0, 1.1, 6);
    } else if (route.mood === 'night-city' || route.mood === 'night-home') {
      const high = route.mood === 'night-home' ? 12 - u * 6 : 13 - u * 4;
      look(sway * 1.4, high, -8, sway, 1.5, 12);
    } else if (route.mood === 'dusk-hill' || route.mood === 'hill-home') {
      look(-2.2 + sway, 7.5 - u * 2, -7.5, 3, 2, 10);
    } else if (route.mood === 'star-rise') {
      const climb = 5 + u * 9;
      look(sway, climb, -8, 0, climb - 1, 14);
    } else {
      const drop = 14 - u * 8;
      look(0, drop, -7, 0, 1.2, 8);
    }
    if (craft && route.craft !== 'balloon') craft.position.y = bob + (under ? 0.05 : 0);
  }

  function resize(width, height) {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    camera.aspect = Math.max(0.2, w / h);
    const lift = Math.round(h * 0.12);
    camera.setViewOffset(w, h, 0, -lift, w, h);
    camera.updateProjectionMatrix();
  }

  function pick(x, y) {
    pointer.set(x, y);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    const hit = hits[0];
    if (!hit) return null;
    return {
      kind: hit.object.userData.pick,
      index: hit.instanceId ?? hit.object.userData.index ?? 0,
    };
  }

  function react(kind, index = 0) {
    if (kind === 'gull') pops.gull[index] = 1;
    else if (kind === 'cloud') pops.cloud[index] = 1;
    else if (kind === 'star') {
      pops.star[index] = 1;
      pops.meteor += 1;
    } else if (kind === 'whale') pops.whale = 1;
    else if (kind === 'light') pops.light = 1;
    else if (kind === 'beat') beatOn.add(index);
  }

  function nearestBeat(progress) {
    const beats = route.beats || [];
    for (let i = 0; i < beats.length; i += 1) {
      if (!beatOn.has(i) && Math.abs(progress - beats[i]) <= 0.045) return i;
    }
    return -1;
  }

  function dispose() {
    scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
      for (const material of materials) material.dispose?.();
    });
  }

  return { scene, camera, update, resize, pick, react, nearestBeat, dispose };
}
