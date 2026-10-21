/** Modern day-valley district: tower, train, neon street, shrine lanterns, lantern gate. */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { attachFigure } from './ri-characters.js';
import { playBeep, playRiAudio } from './ri-audio.js';
import {
  LANTERN_ALL,
  RI_LAYOUT,
  RI_SHOPS,
  RI_STATIONS,
  readCity,
} from './ri-story.js';

function parts() {
  const buckets = new Map();
  return {
    add(color, x, y, z, w, h, d) {
      const geometry = new THREE.BoxGeometry(w, h, d);
      geometry.translate(x, y, z);
      const list = buckets.get(color) || [];
      list.push(geometry);
      buckets.set(color, list);
    },
    flush(parent, materialFor, { shadow = false } = {}) {
      for (const [color, geos] of buckets) {
        const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
        if (geos.length > 1) geos.forEach((geometry) => geometry.dispose());
        const mesh = new THREE.Mesh(merged, materialFor(color));
        mesh.castShadow = shadow;
        mesh.receiveShadow = true;
        parent.add(mesh);
      }
      buckets.clear();
    },
  };
}

function signTexture(kana, lit) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = lit ? '#241428' : '#1a1e28';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = lit ? '#ff4f8b' : '#3a4458';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, 240, 112);
  ctx.fillStyle = lit ? '#ffd2e6' : '#9aa3b2';
  ctx.font = '700 64px "WenQuanYi Micro Hei", "Droid Sans Fallback", "Noto Sans JP", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(kana, 128, 68);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function attachRiCity(world) {
  const city = new RiCity(world);
  world.riCity = city;
  return city;
}

class RiCity {
  constructor(world) {
    this.world = world;
    this.mode = 'walk';
    this.liftY = 0;
    this.liftT = 0;
    this.trainT = 0;
    this.trainX = -8;
    this.trainDir = 1;
    this.signalT = 0;
    this.signalHold = 0;
    this.ride = null;
    this.lookT = 0;
    this.flames = [];
    this.signs = [];
    this.petals = [];
    this.beacon = null;
    this.gateLight = null;
    this.greenLamp = null;
    this.redLamp = null;
    this.deckGroup = null;
    this.valley = null;
    this.buildGate();
    this.buildShops();
    this.buildCrosswalk();
    this.buildTower();
    this.buildShrine();
    this.buildTrain();
    this.buildPeople();
    this.buildFestival();
    this.buildValley();
  }

  mat(color, extra = {}) {
    const key = `${color}|${extra.emissive || ''}|${extra.roughness ?? ''}`;
    if (!this.world.mats[key]) {
      this.world.mats[key] = new THREE.MeshStandardMaterial({
        color,
        roughness: extra.roughness ?? 0.72,
        metalness: extra.metalness ?? 0.04,
        emissive: extra.emissive || '#000000',
        emissiveIntensity: extra.emissive ? 0.8 : 0,
        transparent: extra.opacity != null,
        opacity: extra.opacity ?? 1,
      });
    }
    return this.world.mats[key];
  }

  buildGate() {
    const site = RI_LAYOUT.gate;
    const g = new THREE.Group();
    g.position.set(site.x, 0, site.z);
    const kit = parts();
    kit.add('#8a3a32', -3.1, 2.6, 0, 0.7, 5.2, 0.7);
    kit.add('#8a3a32', 3.1, 2.6, 0, 0.7, 5.2, 0.7);
    kit.add('#3e434c', 0, 5.5, 0, 7.4, 0.45, 1.3);
    kit.add('#3e434c', 0, 6.15, 0, 6.2, 0.7, 1.6);
    kit.flush(g, (color) => this.mat(color, { roughness: 0.6 }));
    const lantern = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 16, 12),
      this.mat('#c8402a', { emissive: '#ff7a45', roughness: 0.4 }),
    );
    lantern.position.set(0, 3.7, 0);
    const wave = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.7, 0.08),
      this.mat('#f4efe4', { emissive: '#ffd7a8', roughness: 0.5 }),
    );
    wave.position.set(0, 3.7, 0.9);
    g.add(lantern, wave);
    this.gateLight = lantern;
    this.world.scene.add(g);
    this.world.solid(site.x - 3.1, site.z, 0.8, 0.8);
    this.world.solid(site.x + 3.1, site.z, 0.8, 0.8);
    const made = this.world.target(g, {
      id: 'ri-gate', type: 'scenery', name: '大灯笼门', label: '灯笼门', action: '看看', position: g.position,
    });
    made.labelLift = 6.2;
  }

  buildShops() {
    RI_SHOPS.forEach((shop, index) => {
      const g = new THREE.Group();
      g.position.set(shop.x, 0, shop.z);
      const kit = parts();
      const wall = index % 2 ? '#d7cbb8' : '#c9b59a';
      kit.add(wall, 0, 1.7, 0, 1.7, 3.4, 1.15);
      kit.add('#6e543c', 0, 3.7, 0, 1.9, 0.28, 1.35);
      kit.add('#2e3238', 0, 0.7, -0.62, 0.7, 1.3, 0.08);
      kit.flush(g, (color) => this.mat(color, { roughness: 0.8 }));
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(1.35, 0.62, 0.08),
        new THREE.MeshStandardMaterial({
          map: signTexture(shop.kana, false),
          emissive: '#ff4f8b',
          emissiveIntensity: 0.05,
          roughness: 0.4,
        }),
      );
      board.position.set(0, 2.7, -0.62);
      g.add(board);
      this.signs.push({ shop, board });
      this.world.scene.add(g);
      this.world.solid(shop.x, shop.z, 1.5, 1.05);
      const made = this.world.target(g, {
        id: `ri-shop-${shop.id}`,
        riKind: 'shop',
        shopIndex: index,
        name: shop.kana,
        label: '招牌',
        ariaLabel: `招牌 ${shop.kana}`,
        action: '点亮',
        position: g.position,
      });
      made.labelLift = 3.4;
    });
    const wet = new THREE.Mesh(
      new THREE.PlaneGeometry(6.5, 10.5),
      this.mat('#2e3238', { roughness: 0.22, metalness: 0.18 }),
    );
    wet.rotation.x = -Math.PI / 2;
    wet.position.set(4.3, 0.03, -4.2);
    wet.receiveShadow = true;
    this.world.scene.add(wet);
  }

  buildCrosswalk() {
    const site = RI_LAYOUT.crosswalk;
    const g = new THREE.Group();
    g.position.set(site.x, 0.04, site.z);
    const kit = parts();
    for (let i = -2; i <= 2; i += 1) kit.add('#f4f1ea', i * 0.55, 0, 0, 0.32, 0.04, 2.4);
    for (let i = -2; i <= 2; i += 1) kit.add('#f4f1ea', 0, 0, i * 0.55, 2.4, 0.04, 0.32);
    kit.flush(g, (color) => this.mat(color, { roughness: 0.45 }));
    const pole = new THREE.Group();
    this.world.cube(pole, '#8d8f93', [0, 1.6, 0], [0.12, 3.2, 0.12]);
    this.redLamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.12), this.mat('#ff5a4a', { emissive: '#ff3b30', roughness: 0.4 }));
    this.greenLamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.12), this.mat('#7dffa8', { emissive: '#39d98a', roughness: 0.4 }));
    this.redLamp.position.set(0, 2.9, 0.1);
    this.greenLamp.position.set(0, 2.55, 0.1);
    pole.position.set(1.5, 0, 0);
    pole.add(this.redLamp, this.greenLamp);
    g.add(pole);
    this.world.scene.add(g);
    const made = this.world.target(g, {
      id: 'ri-signal', riKind: 'signal', name: '红绿灯', label: '红绿灯', ariaLabel: '看红绿灯', action: '过马路', position: g.position.clone().set(site.x, 0, site.z),
    });
    made.position.set(site.x, 0, site.z);
    made.labelLift = 3.2;
  }

  buildTower() {
    const site = RI_LAYOUT.tower;
    const g = new THREE.Group();
    g.position.set(site.x, 0, site.z);
    const kit = parts();
    kit.add('#8d8f93', 0, 0.45, 0, 4.4, 0.9, 4.4);
    const bands = [
      [1.1, 1.6, 3.6, '#c8402a'],
      [2.7, 1.6, 3.2, '#e9e6df'],
      [4.3, 1.6, 2.8, '#c8402a'],
      [5.9, 1.6, 2.4, '#e9e6df'],
      [7.5, 1.4, 2, '#c8402a'],
      [8.9, 1.4, 1.7, '#e9e6df'],
    ];
    for (const [y, h, w, color] of bands) {
      kit.add(color, -w / 2 + 0.18, y, -w / 2 + 0.18, 0.28, h, 0.28);
      kit.add(color, w / 2 - 0.18, y, -w / 2 + 0.18, 0.28, h, 0.28);
      kit.add(color, -w / 2 + 0.18, y, w / 2 - 0.18, 0.28, h, 0.28);
      kit.add(color, w / 2 - 0.18, y, w / 2 - 0.18, 0.28, h, 0.28);
      kit.add(color, 0, y + h / 2, 0, w, 0.12, 0.12);
      kit.add(color, 0, y + h / 2, 0, 0.12, 0.12, w);
    }
    kit.add('#e9e6df', 0, 10.5, 0, 2.3, 1.1, 2.3);
    kit.add('#c8402a', 0, 12.2, 0, 1.15, 2.2, 1.15);
    kit.add('#e9e6df', 0, 14.2, 0, 1.5, 0.7, 1.5);
    kit.add('#c8402a', 0, 16.2, 0, 0.28, 3.4, 0.28);
    kit.flush(g, (color) => this.mat(color, { roughness: 0.48, metalness: 0.35 }));
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.7, 2.5),
      this.mat('#9fc6d9', { emissive: '#ffd8a8', roughness: 0.15, metalness: 0.1, opacity: 0.55 }),
    );
    glass.position.y = 10.15;
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshStandardMaterial({ color: '#ff3b30', emissive: '#ff3b30', emissiveIntensity: 1.4, roughness: 0.35 }),
    );
    beacon.position.y = 18.1;
    g.add(glass, beacon);
    this.beacon = beacon;
    this.world.scene.add(g);
    this.world.solid(site.x, site.z, 2.2, 2.2);
    const door = new THREE.Group();
    door.position.set(site.x, 0, site.z - 2.3);
    this.world.cube(door, '#c8402a', [0, 0.8, 0], [0.7, 1.5, 0.12]);
    this.world.scene.add(door);
    const lift = this.world.target(door, {
      id: 'ri-tower-lift', riKind: 'tower-up', name: '红白铁塔', label: '上塔', ariaLabel: '坐电梯上红白铁塔', action: '上塔', position: door.position,
    });
    lift.labelLift = 2.2;
    this.deckGroup = new THREE.Group();
    this.deckGroup.position.set(site.x, site.deckY, site.z);
    this.world.scene.add(this.deckGroup);
    const look = this.world.target(this.deckGroup, {
      id: 'ri-tower-look', riKind: 'tower-look', name: '塔顶', label: '看河谷', ariaLabel: '从塔顶看河谷', action: '看河谷', position: this.deckGroup.position,
    });
    look.labelLift = 1.4;
    const down = new THREE.Group();
    down.position.set(site.x + 0.8, site.deckY, site.z);
    this.world.scene.add(down);
    this.world.target(down, {
      id: 'ri-tower-down', riKind: 'tower-down', name: '下塔', label: '下塔', ariaLabel: '坐电梯下塔', action: '下塔', position: down.position,
    });
  }

  buildShrine() {
    const site = RI_LAYOUT.shrine;
    const g = new THREE.Group();
    g.position.set(site.x, site.floor, site.z);
    const kit = parts();
    kit.add('#7b7f84', 0, -site.floor / 2, 0.2, 5.4, site.floor, 5.2);
    kit.add('#b8392a', -1.5, 3, -2.3, 0.28, 4.2, 0.28);
    kit.add('#b8392a', 1.5, 3, -2.3, 0.28, 4.2, 0.28);
    kit.add('#b8392a', 0, 4.5, -2.3, 3.6, 0.28, 0.32);
    kit.add('#b8392a', 0, 5.15, -2.3, 4.1, 0.32, 0.36);
    kit.add('#b8392a', -1.6, 2.2, 1.1, 0.28, 3.2, 0.28);
    kit.add('#b8392a', 1.6, 2.2, 1.1, 0.28, 3.2, 0.28);
    kit.add('#efe6d6', 0, 2, 1.1, 2.6, 2.6, 0.2);
    kit.add('#3e434c', 0, 4.3, 1.15, 3.6, 0.4, 2.4);
    kit.add('#3e434c', 0, 5.1, 1.15, 2.4, 0.9, 1.8);
    kit.add('#5e7d4a', -2.2, 0.15, 1.6, 0.8, 0.2, 0.8);
    kit.flush(g, (color) => this.mat(color, { roughness: 0.86 }));
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.4, 0.08),
      this.mat('#ffc56b', { emissive: '#ffb25e', roughness: 0.5 }),
    );
    door.position.set(0, 1.1, 1.02);
    g.add(door);
    const spots = [[-1.8, -0.4], [1.8, -0.4], [-1.8, 1.8], [1.8, 1.8]];
    spots.forEach((spot, index) => {
      const lantern = new THREE.Group();
      lantern.position.set(site.x + spot[0], site.floor, site.z + spot[1]);
      this.world.cube(lantern, '#7b7f84', [0, 0.35, 0], [0.36, 0.7, 0.36]);
      this.world.cube(lantern, '#6a6e74', [0, 0.85, 0], [0.5, 0.16, 0.5]);
      const flame = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.22, 0.16),
        new THREE.MeshStandardMaterial({ color: '#ffb25e', emissive: '#000000', emissiveIntensity: 0, roughness: 0.4 }),
      );
      flame.position.y = 0.72;
      lantern.add(flame);
      this.flames.push(flame);
      this.world.scene.add(lantern);
      const made = this.world.target(lantern, {
        id: `ri-lantern-${index}`,
        riKind: 'lantern',
        zone: 'shrine',
        lanternIndex: index,
        name: '石灯笼',
        label: '灯笼',
        ariaLabel: `点亮石灯笼 ${index + 1}`,
        action: '点亮',
        position: lantern.position,
      });
      made.labelLift = 1.6;
    });
    this.world.scene.add(g);
    this.world.solid(site.x, site.z + 1.1, 2.4, 1.8);
    const yard = this.world.target(g, {
      id: 'ri-shrine',
      riKind: 'shrine',
      zone: 'shrine',
      type: 'scenery',
      name: '山坡寺社',
      label: '寺社',
      ariaLabel: '看看山坡寺社',
      action: '看看',
      position: g.position,
    });
    yard.labelLift = 4.2;
  }

  buildTrain() {
    const deck = new THREE.Group();
    const kit = parts();
    for (const x of [-12, -6, 0, 6, 12]) {
      kit.add('#8d8f93', x, 3, RI_LAYOUT.trackZ, 0.55, 6, 0.55);
    }
    kit.add('#8d8f93', 0, RI_LAYOUT.trackY, RI_LAYOUT.trackZ, 28, 0.35, 2.4);
    kit.add('#55585e', 0, RI_LAYOUT.trackY + 0.28, RI_LAYOUT.trackZ - 0.35, 27, 0.08, 0.12);
    kit.add('#55585e', 0, RI_LAYOUT.trackY + 0.28, RI_LAYOUT.trackZ + 0.35, 27, 0.08, 0.12);
    kit.flush(deck, (color) => this.mat(color, { roughness: 0.86, metalness: color === '#55585e' ? 0.7 : 0 }));
    this.world.scene.add(deck);
    for (const x of [-12, 0, 12]) this.world.solid(x, RI_LAYOUT.trackZ, 0.7, 0.7);
    this.train = new THREE.Group();
    const body = parts();
    body.add('#d5d9de', -3.2, 1.15, 0, 6.2, 1.7, 1.7);
    body.add('#22325a', -3.2, 0.85, 0, 6.2, 0.28, 1.74);
    body.add('#d5d9de', 3.4, 1.15, 0, 5.4, 1.7, 1.7);
    body.add('#22325a', 3.4, 0.85, 0, 5.4, 0.28, 1.74);
    body.flush(this.train, (color) => this.mat(color, { roughness: 0.35, metalness: 0.55 }));
    const windows = new THREE.Mesh(
      new THREE.BoxGeometry(11.2, 0.55, 1.76),
      this.mat('#ffd98a', { emissive: '#ffc56b', roughness: 0.2, opacity: 0.85 }),
    );
    windows.position.y = 1.45;
    this.train.add(windows);
    this.train.position.set(this.trainX, RI_LAYOUT.trackY + 0.4, RI_LAYOUT.trackZ);
    this.world.scene.add(this.train);
    for (const station of RI_STATIONS) {
      const pad = new THREE.Group();
      pad.position.set(station.x, 0, station.z);
      this.world.cube(pad, '#c8c2b6', [0, 0.18, 0], [1.8, 0.28, 1.1]);
      this.world.cube(pad, '#22325a', [0, 1.1, 0], [0.12, 1.6, 0.12]);
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.4, 0.06),
        new THREE.MeshStandardMaterial({ map: signTexture(station.kana, true), roughness: 0.45 }),
      );
      plate.position.set(0, 1.55, 0.1);
      pad.add(plate);
      this.world.scene.add(pad);
      const made = this.world.target(pad, {
        id: `ri-station-${station.id}`,
        riKind: 'station',
        stationId: station.id,
        name: station.name,
        label: station.name,
        ariaLabel: `坐电车，${station.name}`,
        action: '上车',
        position: pad.position,
      });
      made.labelLift = 2.2;
    }
    const queue = new THREE.Group();
    queue.position.set(RI_LAYOUT.queue.x, 0.05, RI_LAYOUT.queue.z);
    this.world.cube(queue, '#f4efe4', [-0.45, 0, 0], [0.4, 0.04, 0.55]);
    this.world.cube(queue, '#f4efe4', [0.45, 0, 0], [0.4, 0.04, 0.55]);
    this.world.scene.add(queue);
    this.world.target(queue, {
      id: 'ri-queue', riKind: 'queue', name: '脚印', label: '排队', ariaLabel: '站到脚印上排队', action: '排队', position: queue.position,
    });
  }

  buildPeople() {
    const miko = new THREE.Group();
    miko.position.set(RI_LAYOUT.miko.x, 0, RI_LAYOUT.miko.z);
    attachFigure(this.world, miko, 'miko');
    this.world.scene.add(miko);
    this.world.solid(RI_LAYOUT.miko.x, RI_LAYOUT.miko.z, 0.7, 0.7);
    const mikoTarget = this.world.target(miko, {
      id: 'tutor-miko', type: 'tutor', tutorId: 'miko', name: '咪可站长', label: '咪可', ariaLabel: '和咪可站长说话', action: '说说话', reach: 2.7, position: miko.position,
    });
    mikoTarget.labelLift = 2.5;
    const lamp = new THREE.Group();
    lamp.position.set(RI_LAYOUT.denden.x, 0, RI_LAYOUT.denden.z);
    attachFigure(this.world, lamp, 'denden');
    this.world.scene.add(lamp);
    this.world.solid(RI_LAYOUT.denden.x, RI_LAYOUT.denden.z, 0.7, 0.7);
    const lampTarget = this.world.target(lamp, {
      id: 'tutor-denden', type: 'tutor', tutorId: 'denden', name: '灯灯', label: '灯灯', ariaLabel: '和灯灯说话', action: '说说话', reach: 2.7, position: lamp.position,
    });
    lampTarget.labelLift = 2.2;
    const cabinet = new THREE.Group();
    cabinet.position.set(RI_LAYOUT.cabinet.x, 0, RI_LAYOUT.cabinet.z);
    this.world.cube(cabinet, '#8d6244', [0, 0.7, 0], [0.9, 1.4, 0.55]);
    this.world.cube(cabinet, '#f4efe4', [0, 0.85, 0.28], [0.7, 0.9, 0.06]);
    this.world.cube(cabinet, '#c9a048', [0.22, 0.85, 0.32], [0.08, 0.08, 0.06]);
    this.world.scene.add(cabinet);
    const box = this.world.target(cabinet, {
      id: 'ri-cabinet', riKind: 'cabinet', name: '失物招领柜', label: '失物柜', ariaLabel: '打开失物招领柜', action: '打开', position: cabinet.position,
    });
    box.labelLift = 1.8;
    const shoes = new THREE.Group();
    shoes.position.set(RI_LAYOUT.shoes.x, 0.05, RI_LAYOUT.shoes.z);
    this.world.cube(shoes, '#2b2e38', [-0.18, 0.08, 0], [0.28, 0.12, 0.16]);
    this.world.cube(shoes, '#2b2e38', [0.18, 0.08, 0], [0.28, 0.12, 0.16]);
    this.world.scene.add(shoes);
    this.world.target(shoes, {
      id: 'ri-shoes', riKind: 'shoes', name: '鞋子', label: '脱鞋', ariaLabel: '进屋前脱鞋', action: '脱鞋', position: shoes.position,
    });
    const stall = new THREE.Group();
    stall.position.set(RI_LAYOUT.stall.x, 0, RI_LAYOUT.stall.z);
    this.world.cube(stall, '#8d6244', [0, 0.55, 0], [1.1, 1.1, 0.7]);
    this.world.cube(stall, '#ffc56b', [0, 1.2, 0], [0.7, 0.12, 0.5]);
    this.world.scene.add(stall);
    this.world.solid(RI_LAYOUT.stall.x, RI_LAYOUT.stall.z, 1.1, 0.7);
    this.world.target(stall, {
      id: 'ri-thanks', riKind: 'thanks', name: '小食摊', label: '开动', ariaLabel: '说いただきます', action: '开动', position: stall.position,
    });
  }

  buildFestival() {
    const kit = parts();
    for (let i = 0; i < 5; i += 1) {
      const x = -6 + i * 3.2;
      kit.add('#e07a4a', x, 4.3, 12.4, 0.7, 0.28, 0.16);
      kit.add('#f7f1e4', x + 0.35, 4.05, 12.4, 0.28, 0.18, 0.12);
    }
    const flags = new THREE.Group();
    kit.flush(flags, (color) => this.mat(color, { roughness: 0.6 }));
    this.world.scene.add(flags);
    for (let i = 0; i < 6; i += 1) {
      const lantern = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 6),
        this.mat('#ffb25e', { emissive: '#ff9a4a', roughness: 0.45 }),
      );
      lantern.position.set(5.55, 3.55, -7.15 + i * 1.32);
      this.world.scene.add(lantern);
    }
    const geo = new THREE.PlaneGeometry(0.18, 0.18);
    const mat = this.mat('#f3b7c8', { roughness: 0.8, opacity: 0.85 });
    for (let i = 0; i < 8; i += 1) {
      const petal = new THREE.Mesh(geo, mat);
      petal.position.set(-13 + (i % 4) * 0.6, 3.2 + (i % 3), 6 + (i % 3) * 0.4);
      petal.userData.spin = i;
      this.world.scene.add(petal);
      this.petals.push(petal);
    }
  }

  buildValley() {
    const g = new THREE.Group();
    g.position.set(-1, 0, -30);
    const kit = parts();
    kit.add('#9eb4c4', -4, 4, 0, 6, 8, 4);
    kit.add('#f7f4ef', -4, 8.2, 0, 3.2, 1.6, 2.4);
    kit.add('#7ea36a', 3, 1.2, 1, 5, 2.4, 3);
    kit.add('#8ebdc0', 1, 0.4, 2.2, 8, 0.3, 1.2);
    kit.add('#e7d3a1', 2.2, 1.6, 2.4, 1.2, 1.1, 1);
    kit.flush(g, (color) => this.mat(color, { roughness: 0.9 }));
    g.name = 'ri-valley-far';
    this.valley = g;
    this.world.scene.add(g);
  }

  greenNow() {
    if (this.signalHold > 0) return true;
    return (this.signalT % 10) < 5;
  }

  forceGreen() {
    this.signalHold = 30;
  }

  locksMove() {
    return this.mode === 'ride' || this.mode === 'lift' || this.mode === 'deck' || this.mode === 'look' || this.mode === 'down';
  }

  anchor() {
    const tower = RI_LAYOUT.tower;
    if (this.mode === 'ride') {
      return { x: this.trainX, y: RI_LAYOUT.trackY + 1.15, z: RI_LAYOUT.trackZ, facing: this.trainDir > 0 ? 0 : Math.PI };
    }
    if (this.mode === 'lift' || this.mode === 'deck' || this.mode === 'look' || this.mode === 'down') {
      return { x: tower.x, y: this.liftY, z: tower.z - 0.4, facing: Math.PI };
    }
    return null;
  }

  lookPose() {
    if (this.mode !== 'look') return null;
    const tower = RI_LAYOUT.tower;
    return {
      pos: new THREE.Vector3(tower.x - 1.2, tower.deckY + 2.4, tower.z - 0.2),
      target: new THREE.Vector3(-1, 6.5, -30),
    };
  }

  onRoad(x, z) {
    return Math.abs(x) <= 1.45 && z <= -6.05 && z >= -12.7;
  }

  floorAt(x, z) {
    if (this.mode === 'ride') return RI_LAYOUT.trackY + 1.15;
    if (this.mode === 'lift' || this.mode === 'deck' || this.mode === 'look' || this.mode === 'down') return this.liftY;
    const shrine = RI_LAYOUT.shrine;
    const dx = x - shrine.x;
    const dz = z - shrine.z;
    if (Math.abs(dx) < 2.5 && dz > -1.3 && dz < 2.5) return shrine.floor;
    if (Math.abs(dx) < 1.15 && dz <= -1.3 && dz > -2.7) {
      const t = (dz + 2.7) / 1.4;
      return shrine.floor * Math.max(0, Math.min(1, t));
    }
    if (this.onRoad(x, z)) return 0.32;
    return null;
  }

  startRide(done) {
    if (this.ride) return false;
    this.mode = 'ride';
    this.ride = { t: 0, duration: 12.5, done, heard: new Set() };
    playRiAudio('zh-train', { text: '电车要进站了。', lang: 'zh-CN' });
    return true;
  }

  startLift() {
    if (this.mode === 'lift' || this.mode === 'deck' || this.mode === 'look') return false;
    this.mode = 'lift';
    this.liftT = 0;
    this.liftFrom = this.world.playerPosition.y || 0;
    this.liftY = this.liftFrom;
    playRiAudio('zh-tower', { text: '坐电梯到顶，可以回头看河谷。', lang: 'zh-CN' });
    return true;
  }

  startLook() {
    if (this.mode !== 'deck' && this.mode !== 'look') return false;
    this.mode = 'look';
    this.lookT = 0;
    return true;
  }

  skipLook() {
    if (this.mode === 'look') this.mode = 'deck';
  }

  startDown() {
    if (this.mode !== 'deck' && this.mode !== 'look') return false;
    this.mode = 'down';
    this.liftT = 0;
    this.liftFrom = RI_LAYOUT.tower.deckY;
    this.liftY = this.liftFrom;
    return true;
  }

  scriptTrain(u) {
    const stops = [RI_STATIONS[0].x, RI_STATIONS[1].x, RI_STATIONS[2].x, RI_STATIONS[0].x];
    const leg = Math.min(stops.length - 1, Math.floor(u * (stops.length - 1)));
    const local = u * (stops.length - 1) - leg;
    const from = stops[leg];
    const to = stops[Math.min(stops.length - 1, leg + 1)];
    this.trainDir = to >= from ? 1 : -1;
    return from + (to - from) * local;
  }

  update(dt, paused) {
    const step = paused ? 0 : dt;
    this.trainT += step;
    this.signalT += step;
    if (this.signalHold > 0) this.signalHold = Math.max(0, this.signalHold - step);
    if (this.ride) {
      this.ride.t += step;
      const u = Math.min(1, this.ride.t / this.ride.duration);
      this.trainX = this.scriptTrain(u);
      RI_STATIONS.forEach((station) => {
        if (!this.ride.heard.has(station.id) && Math.abs(this.trainX - station.x) < 1.1) {
          this.ride.heard.add(station.id);
          playRiAudio(station.audio, { text: station.kana, lang: 'ja-JP' });
        }
      });
      if (u >= 1 && !paused) {
        const done = this.ride.done;
        this.ride = null;
        this.mode = 'walk';
        const home = RI_STATIONS[0];
        this.world.playerPosition.set(home.x, 0, home.z + 1.3);
        done?.();
      }
    } else if (this.mode !== 'ride') {
      const ping = (this.trainT % 18) / 18;
      const wave = ping < 0.5 ? ping * 2 : (1 - ping) * 2;
      this.trainX = -11 + wave * 23;
      this.trainDir = ping < 0.5 ? 1 : -1;
    }
    if (this.train) this.train.position.set(this.trainX, RI_LAYOUT.trackY + 0.45, RI_LAYOUT.trackZ);
    if (this.mode === 'lift') {
      this.liftT += step;
      const u = Math.min(1, this.liftT / 1.5);
      this.liftY = this.liftFrom + (RI_LAYOUT.tower.deckY - this.liftFrom) * u;
      if (u >= 1) this.mode = 'deck';
    } else if (this.mode === 'down') {
      this.liftT += step;
      const u = Math.min(1, this.liftT / 1.4);
      this.liftY = this.liftFrom * (1 - u);
      if (u >= 1) {
        this.mode = 'walk';
        this.liftY = 0;
        const tower = RI_LAYOUT.tower;
        this.world.playerPosition.set(tower.x, 0, tower.z - 2.6);
      }
    } else if (this.mode === 'look') {
      this.lookT += step;
      this.liftY = RI_LAYOUT.tower.deckY;
      if (this.lookT > 7) this.mode = 'deck';
    } else if (this.mode === 'deck') this.liftY = RI_LAYOUT.tower.deckY;
    if (this.beacon) {
      const blink = Math.floor(this.trainT / 1.5) % 2 === 0;
      this.beacon.material.emissiveIntensity = blink ? 1.8 : 0.15;
    }
    const green = this.greenNow();
    if (this.greenLamp) this.greenLamp.material.emissiveIntensity = green ? 1.3 : 0.05;
    if (this.redLamp) this.redLamp.material.emissiveIntensity = green ? 0.05 : 1.2;
    for (const petal of this.petals) {
      petal.position.y -= step * 0.35;
      petal.rotation.z += step;
      if (petal.position.y < 3.1) petal.position.y = 6.2;
    }
    const high = this.mode === 'deck' || this.mode === 'look';
    for (const item of this.world.targets) {
      if (item.riKind === 'tower-look' || item.riKind === 'tower-down') item.hideLabel = !high;
      if (item.riKind === 'tower-up') item.hideLabel = high || this.mode === 'lift';
    }
  }

  sync(realm) {
    const city = readCity(realm);
    this.flames.forEach((flame, index) => {
      const on = (city.lanterns & (1 << index)) !== 0;
      flame.material.emissive.set(on ? '#ffb25e' : '#000000');
      flame.material.emissiveIntensity = on ? 1.5 : 0;
      flame.material.color.set(on ? '#ffd7a1' : '#ffb25e');
    });
    const allLanterns = (city.lanterns & LANTERN_ALL) === LANTERN_ALL;
    this.signs.forEach(({ shop, board }) => {
      const on = (city.shops & (1 << shop.index)) !== 0;
      if (board.userData.on !== on) {
        board.material.map?.dispose();
        board.material.map = signTexture(shop.kana, on);
        board.material.emissive.set(on ? (shop.index % 2 ? '#3fd0e0' : '#ff4f8b') : '#000000');
        board.material.emissiveIntensity = on ? 0.85 : 0.02;
        board.material.needsUpdate = true;
        board.userData.on = on;
      }
    });
    if (this.gateLight) this.gateLight.material.emissiveIntensity = allLanterns || (city.shops & 1) ? 1.15 : 0.55;
  }
}
