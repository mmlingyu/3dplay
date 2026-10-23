/** Route table for valley journeys. No rendering and no save writes. */

import { FERRY_NOTE, VOYAGE_NOTE } from '../realm-data.js';
import { SHIP_NOTE, VOYAGE_MEI_NOTE } from '../mei-data.js';
import { FANTASY_ROUTE } from '../xing-data.js';

const NAMES = Object.freeze({
  he: '河谷',
  ri: '日谷',
  mei: '美谷',
  xing: '外星谷',
});

const trips = new Map();

export function destinationName(id) {
  return NAMES[id] || '这一谷';
}

export function tripCount(id) {
  return trips.get(id) || 0;
}

export function noteTrip(id) {
  if (!id || !ROUTES[id]) return 0;
  const next = tripCount(id) + 1;
  trips.set(id, next);
  return next;
}

export function resetTrips() {
  trips.clear();
}

export function routeId({ via = 'ferry', realm = 'ri', direction = 'out' } = {}) {
  const way = via === 'balloon' ? 'balloon' : 'ferry';
  const place = realm === 'mei' || realm === 'xing' || realm === 'ri' ? realm : 'ri';
  if (direction === 'return') return `return-${way}-${place}`;
  return `${way}-${place}`;
}

export function journeyPhase(progress) {
  const u = Math.min(1, Math.max(0, Number(progress) || 0));
  if (u < 0.18) return 'depart';
  if (u < 0.62) return 'enroute';
  if (u < 0.86) return 'sight';
  return 'arrive';
}

export function journeyCaption(route, phase) {
  if (!route) return '';
  if (phase === 'enroute') return route.enroute;
  if (phase === 'sight') return route.sight;
  if (phase === 'arrive') return route.arrive;
  return route.depart;
}

export function journeySeconds(id, { age = 'junior', tour = false, trips: seen = 0 } = {}) {
  const route = ROUTES[id];
  if (!route) return 8;
  if (tour) return route.tour;
  const base = age === 'senior' ? route.senior : route.junior;
  if (seen > 0) return Math.max(route.repeatFloor, Math.round(base * 0.62 * 10) / 10);
  return base;
}

export function canDivertRoute({ via, direction, progress, routeId: current, nextRealm } = {}) {
  if (via !== 'balloon' || direction !== 'out') return false;
  if ((Number(progress) || 0) >= 0.68) return false;
  const next = routeId({ via: 'balloon', realm: nextRealm, direction: 'out' });
  return Boolean(ROUTES[next]) && next !== current;
}

export function canLandRoute({ via, progress, active } = {}) {
  const u = Number(progress) || 0;
  return Boolean(active) && via === 'balloon' && u > 0.08 && u < 0.9;
}

const DIVERT_ORDER = ['ri', 'mei', 'xing'];

export function nextDivertRealm(current) {
  const index = DIVERT_ORDER.indexOf(current);
  if (index < 0) return null;
  for (let step = 1; step < DIVERT_ORDER.length; step += 1) {
    const id = DIVERT_ORDER[(index + step) % DIVERT_ORDER.length];
    if (canDivertRoute({
      via: 'balloon',
      direction: 'out',
      progress: 0.2,
      routeId: routeId({ via: 'balloon', realm: current, direction: 'out' }),
      nextRealm: id,
    })) return id;
  }
  return null;
}

export function planJourney({ via = 'ferry', realm = 'ri', direction = 'out', age = 'junior', tour = false } = {}) {
  const id = routeId({ via, realm, direction });
  const route = ROUTES[id];
  if (!route) return null;
  return {
    routeId: id,
    seconds: journeySeconds(id, { age, tour, trips: tripCount(id) }),
    route,
  };
}

function route(spec) {
  return Object.freeze(spec);
}

export const ROUTES = Object.freeze({
  'ferry-ri': route({
    id: 'ferry-ri', via: 'ferry', realm: 'ri', direction: 'out',
    junior: 16, senior: 22, tour: 3.2, repeatFloor: 10,
    card: 'travel', ship: true, note: FERRY_NOTE, clip: 'journey-ferry-ri',
    mood: 'sea-day', craft: 'skiff', critter: 'gulls', interaction: 'clap-gull',
    skyTop: '#7eb6ea', skyHorizon: '#f6e2b8', sea: '#2f86a8', accent: '#d84b4b',
    beats: [0.3, 0.42, 0.54],
    depart: '船开了。想拍就跟着拍三下。',
    enroute: '点海鸥，它会打招呼。不拍也继续走。',
    sight: '前面是红白铁塔，电车从高架桥开过。',
    arrive: '小船靠上车站站台了。',
  }),
  'ferry-mei': route({
    id: 'ferry-mei', via: 'ferry', realm: 'mei', direction: 'out',
    junior: 18, senior: 26, tour: 3.4, repeatFloor: 11,
    card: 'travel', ship: true, note: SHIP_NOTE, clip: 'journey-ferry-mei',
    mood: 'sea-dusk', craft: 'liner', critter: 'whale', interaction: 'whale-beat',
    skyTop: '#f08a3c', skyHorizon: '#f6c9a0', sea: '#c45a3a', accent: '#ffd36a',
    beats: [0.24, 0.3, 0.36, 0.42, 0.48, 0.54, 0.6, 0.66],
    depart: '大船开了。船伯唱一首长歌。',
    enroute: '点鲸鱼，它会甩尾巴。不点也到得了。',
    sight: '船从晚霞大桥下面穿过。探照灯亮了。',
    arrive: '大船进港了。',
  }),
  'balloon-ri': route({
    id: 'balloon-ri', via: 'balloon', realm: 'ri', direction: 'out',
    junior: 16, senior: 22, tour: 3.2, repeatFloor: 10,
    card: 'travel', ship: false, note: VOYAGE_NOTE, clip: 'journey-balloon-ri',
    mood: 'night-city', craft: 'balloon', critter: 'clouds', interaction: 'cloud-steer',
    skyTop: '#1b2450', skyHorizon: '#f2a15a', sea: '#18243f', accent: '#ffd978',
    depart: '热气球升起来。整座城的灯在脚下。',
    enroute: '手指左右挪，气球会让开云。点云也行。',
    sight: '夜色里先看见铁塔，再看见电车。',
    arrive: '气球落到日谷的草坪。',
  }),
  'balloon-mei': route({
    id: 'balloon-mei', via: 'balloon', realm: 'mei', direction: 'out',
    junior: 17, senior: 24, tour: 3.3, repeatFloor: 10,
    card: 'travel', ship: false, note: VOYAGE_MEI_NOTE, clip: 'journey-balloon-mei',
    mood: 'dusk-hill', craft: 'balloon', critter: 'clouds', interaction: 'searchlight',
    skyTop: '#e36a4f', skyHorizon: '#ffd7a1', sea: '#e39a62', accent: '#fff4d2',
    depart: '往晚霞飞。风是游戏里简化过的。',
    enroute: '点探照灯，它会闪一下。',
    sight: '山坡大字 USA 旁边，就是草坪。',
    arrive: '气球落在离大字最近的草坪。',
  }),
  'balloon-xing': route({
    id: 'balloon-xing', via: 'balloon', realm: 'xing', direction: 'out',
    junior: 16, senior: 24, tour: 3.4, repeatFloor: 11,
    card: 'star', ship: false, note: FANTASY_ROUTE, clip: 'journey-balloon-xing',
    starTitle: '飞向星星',
    mood: 'star-rise', craft: 'balloon', critter: 'stars', interaction: 'meteor',
    skyTop: '#070b18', skyHorizon: '#6d7ea8', sea: '#141a2e', accent: '#d7e4ff',
    depart: '气球钻进河谷的雾。',
    enroute: '穿过云层。点流星，许一个愿。',
    sight: '星河铺在前面。',
    arrive: '落到星星旁边的草坪。这是幻想航线。',
  }),
  'return-ferry-ri': route({
    id: 'return-ferry-ri', via: 'ferry', realm: 'ri', direction: 'return',
    junior: 5, senior: 7.5, tour: 2.3, repeatFloor: 4.2,
    card: 'travel', ship: false, note: '小船往回开。路程在游戏里变短了。', clip: 'journey-back-ferry-ri',
    mood: 'sea-home', craft: 'skiff', critter: 'gulls', interaction: 'clap-gull',
    skyTop: '#9fd0c8', skyHorizon: '#e7f0c8', sea: '#3e9a86', accent: '#d84b4b',
    beats: [0.34, 0.5],
    depart: '站台留在后面。',
    enroute: '海往回走。点海鸥也行。',
    sight: '绿色的河出现了。',
    arrive: '渡口到了。',
  }),
  'return-ferry-mei': route({
    id: 'return-ferry-mei', via: 'ferry', realm: 'mei', direction: 'return',
    junior: 5.2, senior: 8, tour: 2.4, repeatFloor: 4.2,
    card: 'travel', ship: true, note: '大船往回开。路程在游戏里变短了。', clip: 'journey-back-ferry-mei',
    mood: 'dusk-home', craft: 'liner', critter: 'whale', interaction: 'whale-beat',
    skyTop: '#d98b6a', skyHorizon: '#d7e7c4', sea: '#4f8f78', accent: '#ffd36a',
    beats: [0.3, 0.46],
    depart: '离开晚霞港。',
    enroute: '点鲸鱼打个招呼。',
    sight: '河谷的绿水在前面。',
    arrive: '回到渡口了。',
  }),
  'return-balloon-ri': route({
    id: 'return-balloon-ri', via: 'balloon', realm: 'ri', direction: 'return',
    junior: 5, senior: 7.5, tour: 2.3, repeatFloor: 4.2,
    card: 'travel', ship: false, note: '热气球往回飞。路程和天气在游戏里被简化了。', clip: 'journey-back-balloon-ri',
    mood: 'night-home', craft: 'balloon', critter: 'clouds', interaction: 'cloud-steer',
    skyTop: '#24345f', skyHorizon: '#c9d7b0', sea: '#1d3148', accent: '#ffd978',
    depart: '夜城在下面变小。',
    enroute: '云往后退。手指可以挪一挪气球。',
    sight: '河谷的雾在脚下。',
    arrive: '草坪到了。',
  }),
  'return-balloon-mei': route({
    id: 'return-balloon-mei', via: 'balloon', realm: 'mei', direction: 'return',
    junior: 5.2, senior: 8, tour: 2.4, repeatFloor: 4.2,
    card: 'travel', ship: false, note: '热气球离开美谷。路程和天气在游戏里被简化了。', clip: 'journey-back-balloon-mei',
    mood: 'hill-home', craft: 'balloon', critter: 'clouds', interaction: 'searchlight',
    skyTop: '#e7a07a', skyHorizon: '#d5e6bf', sea: '#6a9478', accent: '#fff4d2',
    depart: '大字留在山坡上。',
    enroute: '晚霞淡下去。',
    sight: '看见家里的河。',
    arrive: '落到河谷的草坪。',
  }),
  'return-balloon-xing': route({
    id: 'return-balloon-xing', via: 'balloon', realm: 'xing', direction: 'return',
    junior: 5.4, senior: 8.5, tour: 2.5, repeatFloor: 4.4,
    card: 'star', ship: false, note: '热气球穿过云，回到家的草坪。', clip: 'journey-back-balloon-xing',
    starTitle: '飞回河谷',
    mood: 'star-home', craft: 'balloon', critter: 'stars', interaction: 'meteor',
    skyTop: '#10182e', skyHorizon: '#b7c9a4', sea: '#1a2438', accent: '#d7e4ff',
    depart: '星星留在后面。',
    enroute: '穿过云，再穿过雾。点流星也行。',
    sight: '河谷在雾下面。',
    arrive: '家的草坪到了。',
  }),
});

export function outboundRoutes() {
  return ['ferry-ri', 'ferry-mei', 'balloon-ri', 'balloon-mei', 'balloon-xing'].map((id) => ROUTES[id]);
}
