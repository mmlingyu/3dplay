/** A meteor note beside the home balloon. It is not a land claim and not a reward. */

import * as THREE from 'three';
import { BALLOON_BASE } from './balloon-data.js';

export function attachHomeVisitor(world, game) {
  if (!world?.scene || world.xingHome || world.realmId === 'ri' || world.realmId === 'xing') return;
  world.xingHome = true;
  const reunited = game.state.travel?.stamps?.includes('xing-gugu-home');
  const group = new THREE.Group();
  const x = BALLOON_BASE.x + 4.4;
  const z = BALLOON_BASE.z - 1.6;
  group.position.set(x, 0, z);
  const rock = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), new THREE.MeshStandardMaterial({ color: '#8d847c', roughness: 0.9 }));
  rock.position.y = 0.28;
  rock.scale.set(1.2, 0.8, 1);
  group.add(rock);
  const glow = new THREE.PointLight('#ffd9a0', 0.45, 6);
  glow.position.set(0, 0.8, 0);
  group.add(glow);
  if (!reunited) {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), new THREE.MeshStandardMaterial({ color: '#c9f0d8', roughness: 0.8 }));
    body.position.set(0.7, 0.55, 0.2);
    group.add(body);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.08), new THREE.MeshStandardMaterial({ color: '#c9f0d8' }));
    arm.position.set(0.95, 0.85, 0.15);
    arm.rotation.z = -0.9;
    group.add(arm);
  }
  world.scene.add(group);
  world.target(group, {
    id: 'xing-meteor',
    type: 'meteor',
    name: '流星来信',
    label: '一颗小流星',
    ariaLabel: '一颗小流星',
    action: '看看',
  });
  if (world.createLabels && world.labelOnClick) world.createLabels(world.labelOnClick);
}

export const METEOR_LETTER = '夜里有一颗小流星落在草坪旁边。里面是迷路的小咕，它指向热气球。这封信可以先放着，不去也没关系。';
