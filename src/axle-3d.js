import * as THREE from 'three';
import { AxleSession } from './axle-session.js';

export class Axle3D {
  constructor(root) {
    this.root = root;
    this.canvas = root.querySelector('#axle-canvas');
    this.session = new AxleSession();
    this.abort = new AbortController();
    this.geometries = [];
    this.materials = [];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#e8eddd');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.camera = new THREE.PerspectiveCamera(37, 1, 0.1, 30);
    this.camera.position.set(3.7, 2.45, 7.4);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(new THREE.HemisphereLight('#fff9e9', '#8b9b78', 2.1));
    const sun = new THREE.DirectionalLight('#fff3d8', 2.4);
    sun.position.set(-3, 7, 5);
    this.scene.add(sun);
    this.makeParts();
    this.bind();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas);
    this.resize();
    this.syncControls();
    this.renderer.setAnimationLoop((time) => {
      if (document.hidden) return;
      const now = Number.isFinite(time) ? time : performance.now();
      const dt = Math.min(Math.max((now - (this.lastFrame || now)) / 1000, 0), 0.05);
      this.lastFrame = now;
      for (const side of ['left', 'right']) {
        const target = this.session.wheels[side].angle;
        const spin = this.wheels[side].spin;
        spin.rotation.x += (target - spin.rotation.x) * Math.min(1, dt * 14);
      }
      this.renderer.render(this.scene, this.camera);
    });
  }

  geometry(value) {
    this.geometries.push(value);
    return value;
  }

  material(color, options = {}) {
    const value = new THREE.MeshStandardMaterial({ color, roughness: 0.82, ...options });
    this.materials.push(value);
    return value;
  }

  makeParts() {
    const wood = this.material('#b97944');
    const paleWood = this.material('#dfbd88');
    const darkWood = this.material('#805333');
    const metal = this.material('#73847b', { metalness: 0.35, roughness: 0.48 });
    const tire = this.material('#485c52', { roughness: 0.96 });
    const highlight = this.material('#f2d79c', { emissive: '#604a25', emissiveIntensity: 0.16 });
    this.partMaterial = paleWood;
    this.wheelTargets = [];
    this.wheels = {};

    const table = new THREE.Mesh(
      this.geometry(new THREE.BoxGeometry(5.4, 0.18, 2.7)),
      wood,
    );
    table.position.y = -1.02;
    this.scene.add(table);
    for (const x of [-2.15, 2.15]) {
      for (const z of [-0.95, 0.95]) {
        const leg = new THREE.Mesh(
          this.geometry(new THREE.BoxGeometry(0.16, 0.82, 0.16)),
          darkWood,
        );
        leg.position.set(x, -1.51, z);
        this.scene.add(leg);
      }
    }

    const axle = new THREE.Mesh(
      this.geometry(new THREE.CylinderGeometry(0.075, 0.075, 2.1, 20)),
      metal,
    );
    axle.rotation.z = Math.PI / 2;
    this.scene.add(axle);

    for (const x of [-0.52, 0.52]) {
      const bearing = new THREE.Mesh(
        this.geometry(new THREE.CylinderGeometry(0.2, 0.2, 0.17, 16)),
        paleWood,
      );
      bearing.rotation.z = Math.PI / 2;
      bearing.position.x = x;
      this.scene.add(bearing);
      const foot = new THREE.Mesh(
        this.geometry(new THREE.BoxGeometry(0.22, 0.76, 0.3)),
        wood,
      );
      foot.position.set(x, -0.42, 0);
      this.scene.add(foot);
    }

    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      const root = new THREE.Group();
      root.position.set(sign * 1.03, 0, 0);
      this.scene.add(root);
      const spin = new THREE.Group();
      root.add(spin);
      const wheelPlane = new THREE.Group();
      wheelPlane.rotation.y = Math.PI / 2;
      spin.add(wheelPlane);

      const outer = new THREE.Mesh(
        this.geometry(new THREE.TorusGeometry(0.64, 0.075, 10, 36)),
        tire,
      );
      wheelPlane.add(outer);
      const rim = new THREE.Mesh(
        this.geometry(new THREE.TorusGeometry(0.535, 0.026, 8, 32)),
        paleWood,
      );
      wheelPlane.add(rim);
      const hub = new THREE.Mesh(
        this.geometry(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 14)),
        highlight,
      );
      hub.rotation.x = Math.PI / 2;
      wheelPlane.add(hub);

      const spokePositions = [];
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4;
        const x = Math.cos(angle) * 0.51;
        const y = Math.sin(angle) * 0.51;
        spokePositions.push(0, 0, 0, x, y, 0);
      }
      const spokes = new THREE.LineSegments(
        this.geometry(new THREE.BufferGeometry().setAttribute(
          'position',
          new THREE.Float32BufferAttribute(spokePositions, 3),
        )),
        new THREE.LineBasicMaterial({ color: '#fff1cb' }),
      );
      this.materials.push(spokes.material);
      wheelPlane.add(spokes);

      const hit = new THREE.Mesh(
        this.geometry(new THREE.SphereGeometry(0.79, 12, 8)),
        this.material('#ffffff', { transparent: true, opacity: 0, depthWrite: false }),
      );
      hit.userData.side = side;
      spin.add(hit);
      this.wheelTargets.push(hit);
      this.wheels[side] = { root, spin, sign };
    }
  }

  resize() {
    const { clientWidth: width, clientHeight: height } = this.canvas;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  pointForWheel(side) {
    const wheel = this.wheels[side];
    if (!wheel) return null;
    this.scene.updateMatrixWorld(true);
    const point = wheel.root.getWorldPosition(new THREE.Vector3()).project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: rect.left + (point.x + 1) * rect.width / 2,
      y: rect.top + (1 - point.y) * rect.height / 2,
    };
  }

  hitSide(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      (clientX - rect.left) / rect.width * 2 - 1,
      1 - (clientY - rect.top) / rect.height * 2,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.wheelTargets, false)[0];
    return hit?.object.userData.side || null;
  }

  bind() {
    const signal = this.abort.signal;
    let gesture = null;
    this.canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const side = this.hitSide(event.clientX, event.clientY);
      if (!side) return;
      event.preventDefault();
      this.canvas.setPointerCapture(event.pointerId);
      gesture = { id: event.pointerId, side, x: event.clientX, moved: false };
    }, { signal });
    this.canvas.addEventListener('pointermove', (event) => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const dx = event.clientX - gesture.x;
      if (!gesture.moved && Math.abs(dx) < 4) return;
      gesture.moved = true;
      gesture.x = event.clientX;
      const result = this.session.turn(gesture.side, dx * 0.018);
      if (result.ok) this.syncControls();
    }, { signal });
    this.canvas.addEventListener('pointerup', (event) => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const { side, moved } = gesture;
      gesture = null;
      if (moved) return;
      const result = this.session.wheels[side].attached
        ? this.session.detach(side)
        : this.session.attach(side);
      this.showResult(result.message);
      this.syncControls();
    }, { signal });
    for (const type of ['pointercancel', 'lostpointercapture']) {
      this.canvas.addEventListener(type, () => { gesture = null; }, { signal });
    }
    window.addEventListener('blur', () => { gesture = null; }, { signal });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) gesture = null;
    }, { signal });
  }

  showResult(message) {
    this.root.querySelector('#axle-feedback').textContent = message;
  }

  toggle(side) {
    const result = this.session.wheels[side]?.attached
      ? this.session.detach(side)
      : this.session.attach(side);
    this.showResult(result.message);
    this.syncControls();
    return result;
  }

  turn(side, radians = Math.PI / 4) {
    const result = this.session.turn(side, radians);
    this.showResult(result.message);
    this.syncControls();
    return result;
  }

  syncControls() {
    if (!this.root.isConnected) return;
    const snapshot = this.session.snapshot();
    for (const side of ['left', 'right']) {
      const wheel = snapshot.wheels[side];
      const label = side === 'left' ? '左' : '右';
      const toggle = this.root.querySelector(`[data-action="axle-toggle"][data-side="${side}"]`);
      const turn = this.root.querySelector(`[data-action="axle-turn"][data-side="${side}"]`);
      const status = this.root.querySelector(`#axle-${side}-status`);
      if (!toggle || !turn || !status) continue;
      toggle.textContent = wheel.attached ? `取下${label}轮` : `装上${label}轮`;
      turn.disabled = !wheel.attached;
      status.textContent = `${wheel.attached ? '已装上' : '待装'} · ${Math.round(wheel.angle * 180 / Math.PI)}°`;
    }
    this.root.querySelector('#axle-joint-count').textContent = `${snapshot.connections.length} / 2 个插接`;
    const left = Math.round(snapshot.wheels.left.angle * 180 / Math.PI);
    const right = Math.round(snapshot.wheels.right.angle * 180 / Math.PI);
    this.root.querySelector('#axle-readout').textContent = `左轮 ${left}° · 右轮 ${right}° · 固定轴 0°`;
  }

  dispose() {
    this.session.dispose();
    this.abort.abort();
    this.resizeObserver?.disconnect();
    this.renderer.setAnimationLoop(null);
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
