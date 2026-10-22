import * as THREE from 'three';
import { terrainHeight } from './game-data.js';
import { TEST_FIELD, CAPABILITIES, FIGURE_GESTURES, figureGestures } from './creation-data.js';
import { partCatalog, capabilityStatus } from './creation-rules.js';
import { CreationMeshFactory, animateFigure, experimentPose } from './creation-mesh.js';

const ground = (x, z) => terrainHeight(Math.round(x), Math.round(z)) + 0.02;
function addPickVolume(holder, model) {
  holder.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(size.x, 0.9), Math.max(size.y, 0.9), Math.max(size.z, 0.9)),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  hit.position.copy(holder.worldToLocal(center));
  hit.name = 'pick-volume';
  holder.add(hit);
}
const PREFERRED = ['pedal', 'roll', 'spin', 'float', 'steer', 'light', 'sit'];

// The creation corner of the valley: stations, finished inventions on the test
// field and figures the child placed. Rebuilt only when the saved data changes.
export class CreationWorld {
  constructor(world) {
    this.world = world;
    this.factory = new CreationMeshFactory();
    this.root = new THREE.Group();
    world.scene.add(this.root);
    this.entries = new Map();
    this.signature = '';
    this.running = null;
    this.stations();
  }

  stations() {
    const w = this.world;
    const desk = new THREE.Group();
    desk.position.set(TEST_FIELD.desk.x, ground(TEST_FIELD.desk.x, TEST_FIELD.desk.z), TEST_FIELD.desk.z);
    w.scene.add(desk);
    w.cube(desk, 'wood', [0, .62, 0], [1.3, .1, .8], true);
    for (const [x, z] of [[-.55, -.3], [.55, -.3], [-.55, .3], [.55, .3]]) w.cube(desk, 'wood', [x, .3, z], [.1, .6, .1]);
    const board = w.cube(desk, 'cream', [0, 1.05, -.28], [1.05, .72, .05], true);
    board.rotation.x = -.18;
    for (const [i, color] of ['#e07a5f', '#5b8fd8', '#f2c94c'].entries()) {
      const dot = new THREE.Mesh(w.box, new THREE.MeshStandardMaterial({ color }));
      dot.scale.set(.12, .12, .02); dot.position.set(-.3 + i * .3, 1.06, -.24); dot.rotation.x = -.18;
      desk.add(dot);
    }
    w.target(desk, { id: 'idea-desk', type: 'station', panel: 'idea', name: '想法画板', action: '画一画', label: '想法画板', hint: '写下想造的东西，再画出来' });

    const lab = new THREE.Group();
    lab.position.set(TEST_FIELD.lab.x, ground(TEST_FIELD.lab.x, TEST_FIELD.lab.z), TEST_FIELD.lab.z);
    w.scene.add(lab);
    w.cube(lab, 'stone', [0, .35, 0], [2.0, .7, 1.1], true);
    w.cube(lab, 'wood', [0, .74, 0], [2.1, .08, 1.2], true);
    w.cube(lab, 'roof', [0, 2.05, -.2], [2.4, .12, 1.5], true);
    for (const x of [-1.05, 1.05]) w.cube(lab, 'wood', [x, 1.4, -.75], [.12, 1.3, .12]);
    w.mesh(lab, new THREE.TorusGeometry(.22, .05, 8, 18), 'cream', [-.5, 1.0, 0]);
    w.cube(lab, 'wood', [.4, .9, 0], [.6, .12, .3], true);
    w.target(lab, { id: 'invention-lab', type: 'station', panel: 'lab', name: '发明实验室', action: '去拼装', label: '发明实验室', hint: '看部件和连接图 · 做部件 · 拼装 · 实验 · 拆开' });

    const field = new THREE.Group();
    w.scene.add(field);
    for (const spot of TEST_FIELD.spots) {
      const pad = w.cube(field, 'cream', [spot.x, ground(spot.x, spot.z) + .01, spot.z], [1.9, .03, 1.3]);
      pad.receiveShadow = true; pad.castShadow = false;
    }
    const sign = new THREE.Group();
    sign.position.set(TEST_FIELD.sign.x, ground(TEST_FIELD.sign.x, TEST_FIELD.sign.z), TEST_FIELD.sign.z);
    w.scene.add(sign);
    w.sign(sign, 'cream', [0, .85, 0]);
    w.target(sign, { id: 'test-field', type: 'creation', name: '实验场', action: '看看', label: '实验场', hint: '送来的作品摆在这里，走过去试一试' });
  }

  signatureOf(state) {
    const c = state.creation;
    return JSON.stringify([
      c.assemblies.filter(a => a.status === 'world').map(a => [a.id, a.world, a.blueprintId, c.parts.filter(p => p.owner === a.id).map(p => p.slot).sort()]),
      c.figures.filter(f => f.placed).map(f => [f.id, f.placed, f.figure.parts.map(p => [p.id, p.parent, p.shapes.map(s => [s.shape, s.color, s.size || s.radius, s.at])])]),
      c.partTypes.length,
    ]);
  }

  clear() {
    const w = this.world;
    for (const id of this.entries.keys()) {
      w.targets.find(t => t.id === id)?.labelElement?.remove();
      w.targets = w.targets.filter(t => t.id !== id);
      w.pickMeshes = w.pickMeshes.filter(m => m.userData.targetId !== id);
    }
    this.root.clear();
    this.entries.clear();
    this.factory.dispose();
    this.running = null;
  }

  sync(state) {
    if (!state?.creation) return;
    const signature = this.signatureOf(state);
    if (signature === this.signature) return;
    this.signature = signature;
    this.clear();
    const c = state.creation, catalog = partCatalog(c.partTypes);
    for (const asm of c.assemblies.filter(a => a.status === 'world')) {
      const bp = c.blueprints.find(b => b.id === asm.blueprintId);
      const filled = new Set(bp.parts.map(p => p.id));
      const holder = new THREE.Group();
      holder.userData.live = true;
      holder.position.set(asm.world.x, ground(asm.world.x, asm.world.z), asm.world.z);
      const model = this.factory.assembly(bp, catalog, filled, { showGhosts: false });
      holder.add(model);
      this.root.add(holder);
      addPickVolume(holder, model);
      const status = capabilityStatus(bp, catalog, filled);
      const capability = PREFERRED.find(cap => status[cap]?.ok) || null;
      this.entries.set(asm.id, { kind: 'assembly', holder, model, bp, catalog, capability });
      this.world.target(holder, { id: asm.id, type: 'creation', name: bp.name, action: capability ? `试一试${CAPABILITIES[capability].label}` : '看看', label: bp.name, hint: '单击后，旁边的菜单可以试一试、继续修改，或送回实验室', assemblyId: asm.id });
    }
    for (const fig of c.figures.filter(f => f.placed)) {
      const holder = new THREE.Group();
      holder.userData.live = true;
      holder.position.set(fig.placed.x, ground(fig.placed.x, fig.placed.z), fig.placed.z);
      holder.rotation.y = fig.placed.rotY;
      const model = this.factory.figure(fig.figure);
      holder.add(model);
      this.root.add(holder);
      addPickVolume(holder, model);
      const gestures = figureGestures(fig.figure);
      this.entries.set(fig.id, { kind: 'figure', holder, model, name: fig.figure.name, gestures, gesture: 0, baseYaw: fig.placed.rotY });
      this.world.target(holder, { id: fig.id, type: 'creation', name: fig.figure.name, action: FIGURE_GESTURES[gestures[0]], label: fig.figure.name, hint: '单击后，旁边的菜单可以做动作、继续修改，或收回背包', figureId: fig.id });
    }
    if (this.world.labelOnClick) this.world.createLabels(this.world.labelOnClick);
  }

  actionLabel(id) {
    const entry = this.entries.get(id);
    if (!entry) return null;
    if (entry.kind === 'figure') return FIGURE_GESTURES[entry.gestures[entry.gesture % entry.gestures.length]];
    return entry.capability ? `试一试${CAPABILITIES[entry.capability].label}` : '看看';
  }

  // Returns a short sentence for the toast; the motion itself is only a picture.
  tryOut(id) {
    if (id === 'test-field') return this.entries.size ? '实验场：走到作品旁边，点一下试一试。' : '实验场还空着。在发明实验室拼好作品，就能送过来。';
    const entry = this.entries.get(id);
    if (!entry) return null;
    if (entry.kind === 'figure') {
      const capability = entry.gestures[entry.gesture % entry.gestures.length];
      entry.gesture += 1;
      this.running = { id, start: this.world.time, capability, baseYaw: entry.baseYaw };
      return `${entry.name}：${FIGURE_GESTURES[capability]}！`;
    }
    if (!entry.capability) return `${entry.bp.name}放在实验场上。`;
    this.running = { id, start: this.world.time, capability: entry.capability };
    return `${entry.bp.name}：${CAPABILITIES[entry.capability].label}！`;
  }

  update() {
    const t = this.world.time;
    const running = this.running;
    const elapsed = running ? t - running.start : 0;
    for (const [id, entry] of this.entries) {
      if (entry.kind !== 'figure') continue;
      const active = running?.id === id;
      const capability = active ? running.capability : null;
      entry.model.userData.flapBoost = capability === 'flap' ? 2.6 : 1;
      animateFigure(entry.model, t + id.length);
      entry.model.position.y = capability === 'hop' ? Math.max(0, Math.sin(elapsed * 8)) * 0.28 : 0;
      entry.holder.rotation.y = capability === 'spin' ? running.baseYaw + Math.min(elapsed / 1.1, 1) * Math.PI * 2 : entry.baseYaw;
      if (capability === 'wave') {
        const swing = Math.sin(elapsed * 10) * 0.9;
        for (const [partId, group] of entry.model.userData.parts || []) {
          if (!/^arm/i.test(partId)) continue;
          group.rotation.z += swing * (group.position.z >= 0 ? -1 : 1);
        }
      }
    }
    if (!running) return;
    const entry = this.entries.get(running.id);
    if (entry?.kind === 'assembly') experimentPose(entry.model, entry.bp, entry.catalog, running.capability, elapsed);
    if (!entry || elapsed > 3.2) {
      if (entry?.kind === 'assembly') experimentPose(entry.model, entry.bp, entry.catalog, null, 0);
      if (entry?.kind === 'figure') entry.holder.rotation.y = entry.baseYaw;
      this.running = null;
    }
  }

  snapshot() {
    return [...this.entries].map(([id, e]) => ({ id, kind: e.kind, x: e.holder.position.x, z: e.holder.position.z, capability: e.capability || null }));
  }
}
