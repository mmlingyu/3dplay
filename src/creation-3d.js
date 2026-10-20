import * as THREE from 'three';
import { CreationMeshFactory, animateFigure, experimentPose, explodePose } from './creation-mesh.js';

export class CreationView {
  constructor(canvas, { onSlot = () => {} } = {}) {
    this.canvas = canvas;
    this.onSlot = onSlot;
    this.abort = new AbortController();
    this.factory = new CreationMeshFactory();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#e8eddd');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.05, 40);
    this.scene.add(new THREE.HemisphereLight('#fff9e9', '#8b9b78', 2.1));
    const sun = new THREE.DirectionalLight('#fff3d8', 2.4);
    sun.position.set(-3, 7, 5);
    this.scene.add(sun);
    this.tableGeometry = new THREE.CylinderGeometry(2.1, 2.1, 0.12, 40);
    this.tableMaterial = new THREE.MeshStandardMaterial({ color: '#c9a274', roughness: 0.9 });
    this.waterGeometry = new THREE.PlaneGeometry(4, 4);
    this.waterMaterial = new THREE.MeshStandardMaterial({ color: '#76cbd7', transparent: true, opacity: 0.75 });
    this.table = new THREE.Mesh(this.tableGeometry, this.tableMaterial);
    this.table.position.y = -0.06;
    this.scene.add(this.table);
    this.water = new THREE.Mesh(this.waterGeometry, this.waterMaterial);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = 0.08;
    this.water.visible = false;
    this.scene.add(this.water);
    this.pivot = new THREE.Group();
    this.pivot.rotation.y = -0.6;
    this.scene.add(this.pivot);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.model = null;
    this.mode = null;
    this.playing = null;
    this.explode = 0;
    this.explodeTarget = 0;
    this.time = 0;
    this.bind();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.renderer.setAnimationLoop(now => this.frame(now));
  }

  clearModel() {
    if (this.model) this.pivot.remove(this.model);
    this.model = null;
    this.factory.dispose();
    this.playing = null;
    this.water.visible = false;
  }

  frameModel() {
    const box = new THREE.Box3().setFromObject(this.model);
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 0.6);
    this.model.position.x -= center.x;
    this.model.position.z -= center.z;
    this.model.userData.base = this.model.position.clone();
    this.table.scale.set(radius * 0.4, 1, radius * 0.4);
    this.water.scale.setScalar(radius * 0.5);
    this.camera.position.set(0, center.y + radius * 0.9, radius * 2.6);
    this.camera.lookAt(0, center.y * 0.8, 0);
  }

  showAssembly(bp, catalog, filled, { highlight = null, lit = false } = {}) {
    this.clearModel();
    this.mode = 'assembly';
    this.bp = bp; this.catalog = catalog;
    this.model = this.factory.assembly(bp, catalog, filled, { lit });
    this.pivot.add(this.model);
    this.frameModel();
    this.setHighlight(highlight);
  }

  setHighlight(slotId) {
    this.highlight = slotId;
    if (!this.model?.userData.slots) return;
    for (const [id, group] of this.model.userData.slots) group.scale.setScalar(id === slotId ? 1.08 : 1);
  }

  showFigure(figure) {
    this.clearModel();
    this.mode = 'figure';
    this.model = this.factory.figure(figure);
    this.pivot.add(this.model);
    this.frameModel();
  }

  play(capability) {
    if (this.mode !== 'assembly') return;
    this.playing = { capability, start: this.time };
    this.water.visible = capability === 'float';
  }

  setExplode(on) { this.explodeTarget = on ? 0.45 : 0; }

  frame(now) {
    if (document.hidden) return;
    const dt = Math.min(Math.max((now - (this.lastFrame || now)) / 1000, 0), 0.05);
    this.lastFrame = now;
    this.time += dt;
    if (this.model && this.mode === 'figure') animateFigure(this.model, this.time);
    if (this.model && this.mode === 'assembly') {
      const base = this.model.userData.base;
      if (this.playing) {
        const t = this.time - this.playing.start;
        experimentPose(this.model, this.bp, this.catalog, this.playing.capability, t);
        this.model.position.x += base.x; this.model.position.z = base.z;
        if (t > 3.2) { this.playing = null; experimentPose(this.model, this.bp, this.catalog, null, 0); this.model.position.copy(base); }
      } else {
        this.explode += (this.explodeTarget - this.explode) * Math.min(1, dt * 6);
        explodePose(this.model, this.explode);
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  hitSlot(clientX, clientY) {
    if (this.mode !== 'assembly' || !this.model) return null;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set((clientX - rect.left) / rect.width * 2 - 1, 1 - (clientY - rect.top) / rect.height * 2);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    for (const hit of this.raycaster.intersectObject(this.model, true)) {
      let node = hit.object;
      while (node && !node.userData.slotId) node = node.parent;
      if (node) return node.userData.slotId;
    }
    return null;
  }

  bind() {
    const signal = this.abort.signal;
    let gesture = null;
    this.canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0 || gesture) return;
      event.preventDefault();
      this.canvas.setPointerCapture(event.pointerId);
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    }, { signal });
    this.canvas.addEventListener('pointermove', event => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const dx = event.clientX - gesture.x;
      if (!gesture.moved && Math.hypot(dx, event.clientY - gesture.y) < 6) return;
      gesture.moved = true;
      this.pivot.rotation.y += dx * 0.012;
      gesture.x = event.clientX;
    }, { signal });
    this.canvas.addEventListener('pointerup', event => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const { moved } = gesture;
      gesture = null;
      if (!moved) { const slot = this.hitSlot(event.clientX, event.clientY); if (slot) this.onSlot(slot); }
    }, { signal });
    for (const type of ['pointercancel', 'lostpointercapture']) this.canvas.addEventListener(type, () => { gesture = null; }, { signal });
    window.addEventListener('blur', () => { gesture = null; }, { signal });
  }

  resize() {
    const { clientWidth: width, clientHeight: height } = this.canvas;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.abort.abort();
    this.resizeObserver?.disconnect();
    this.renderer.setAnimationLoop(null);
    this.clearModel();
    this.tableGeometry.dispose(); this.tableMaterial.dispose();
    this.waterGeometry.dispose(); this.waterMaterial.dispose();
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
