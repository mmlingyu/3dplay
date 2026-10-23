import assert from 'node:assert/strict';
import test from 'node:test';
import { STORAGE_KEY } from '../src/game-data.js';
import { FANTASY_ROUTE } from '../src/xing-data.js';
import { FERRY_NOTE, VOYAGE_NOTE } from '../src/realm-data.js';
import { SHIP_NOTE, VOYAGE_MEI_NOTE } from '../src/mei-data.js';
import {
  canDivertRoute,
  canLandRoute,
  nextDivertRealm,
  journeyPhase,
  journeySeconds,
  noteTrip,
  outboundRoutes,
  planJourney,
  resetTrips,
  routeId,
  tripCount,
  ROUTES,
} from '../src/journey/routes.js';
import { JOURNEY_CLIPS } from '../src/journey/lines.js';

test('存档键仍是河谷那一把', () => {
  assert.equal(STORAGE_KEY, 'yuanyuan-river-valley-v1');
});

test('五条出门路线的天色、船或气球、路上的东西都不一样', () => {
  const outbound = outboundRoutes();
  assert.equal(outbound.length, 5);
  const signatures = outbound.map((route) => [
    route.mood, route.craft, route.critter, route.interaction, route.skyTop, route.sea, route.sight,
  ].join('|'));
  assert.equal(new Set(signatures).size, 5);
  assert.equal(ROUTES['ferry-ri'].craft, 'skiff');
  assert.equal(ROUTES['ferry-mei'].craft, 'liner');
  assert.equal(ROUTES['balloon-xing'].card, 'star');
  assert.equal(ROUTES['balloon-ri'].note, VOYAGE_NOTE);
  assert.equal(ROUTES['balloon-mei'].note, VOYAGE_MEI_NOTE);
  assert.equal(ROUTES['ferry-ri'].note, FERRY_NOTE);
  assert.equal(ROUTES['ferry-mei'].note, SHIP_NOTE);
  assert.match(ROUTES['balloon-xing'].note, /幻想航线/);
  assert.equal(ROUTES['balloon-xing'].note, FANTASY_ROUTE);
});

test('6–8 岁比 9–12 岁短，再走一次更短，体验模式更短，回程更短', () => {
  resetTrips();
  for (const route of outboundRoutes()) {
    const junior = journeySeconds(route.id, { age: 'junior' });
    const senior = journeySeconds(route.id, { age: 'senior' });
    const tour = journeySeconds(route.id, { tour: true, age: 'senior' });
    assert.ok(junior >= 15 && junior <= 30, route.id);
    assert.ok(senior >= 15 && senior <= 30, route.id);
    assert.ok(junior < senior, route.id);
    assert.ok(tour < junior, route.id);
    const again = journeySeconds(route.id, { age: 'junior', trips: 1 });
    assert.ok(again < junior, route.id);
    const back = ROUTES[`return-${route.via}-${route.realm}`];
    assert.ok(back, route.id);
    assert.ok(journeySeconds(back.id, { age: 'junior' }) < junior, back.id);
    assert.notEqual(back.mood, route.mood);
  }
});

test('热气球可以在看见目的地之前改道，船不行，降落只在半途', () => {
  const mid = { via: 'balloon', direction: 'out', progress: 0.4, routeId: 'balloon-ri' };
  assert.equal(canDivertRoute({ ...mid, nextRealm: 'mei' }), true);
  assert.equal(canDivertRoute({ ...mid, nextRealm: 'xing' }), true);
  assert.equal(canDivertRoute({ ...mid, nextRealm: 'ri' }), false);
  assert.equal(canDivertRoute({ ...mid, progress: 0.8, nextRealm: 'mei' }), false);
  assert.equal(canDivertRoute({ via: 'ferry', direction: 'out', progress: 0.3, routeId: 'ferry-ri', nextRealm: 'mei' }), false);
  assert.equal(canDivertRoute({ ...mid, direction: 'return', nextRealm: 'mei' }), false);
  assert.equal(canLandRoute({ via: 'balloon', progress: 0.4, active: true }), true);
  assert.equal(canLandRoute({ via: 'balloon', progress: 0.02, active: true }), false);
  assert.equal(canLandRoute({ via: 'ferry', progress: 0.4, active: true }), false);
  assert.equal(nextDivertRealm('ri'), 'mei');
  assert.equal(nextDivertRealm('mei'), 'xing');
  assert.equal(nextDivertRealm('xing'), 'ri');
  assert.equal(nextDivertRealm('he'), null);
});

test('同一条路记下一次之后，计划时长变短，但不写存档', () => {
  resetTrips();
  const first = planJourney({ via: 'ferry', realm: 'ri', direction: 'out', age: 'junior' });
  assert.equal(first.routeId, 'ferry-ri');
  assert.equal(tripCount('ferry-ri'), 0);
  noteTrip('ferry-ri');
  const second = planJourney({ via: 'ferry', realm: 'ri', direction: 'out', age: 'junior' });
  assert.ok(second.seconds < first.seconds);
  assert.equal(routeId({ via: 'balloon', realm: 'xing', direction: 'return' }), 'return-balloon-xing');
  resetTrips();
});

test('阶段从出发走到抵达', () => {
  assert.equal(journeyPhase(0.05), 'depart');
  assert.equal(journeyPhase(0.4), 'enroute');
  assert.equal(journeyPhase(0.7), 'sight');
  assert.equal(journeyPhase(0.95), 'arrive');
});

test('每条路线都有一句中文台词', () => {
  const ids = new Set(JOURNEY_CLIPS.map((clip) => clip.id));
  for (const route of Object.values(ROUTES)) {
    assert.ok(ids.has(route.clip), route.id);
    assert.ok(ids.has(`${route.clip}-senior`), route.id);
    assert.ok(route.depart && route.sight && route.arrive);
  }
});
