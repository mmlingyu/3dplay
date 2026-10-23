/**
 * Journey playback on the current world's renderer.
 * Balloon panel can read status(): destination, progress 0–1, canLand, canDivert.
 * land() fast-forwards into the arrival. divert(realmId) changes a balloon trip
 * before the destination comes into view. Neither call changes the save.
 */

import { playUrl, stopVoice, voiceToken } from '../voice.js';
import { journeySpeech } from './lines.js';
import {
  canDivertRoute,
  canLandRoute,
  destinationName,
  journeyCaption,
  journeyPhase,
  noteTrip,
  routeId,
} from './routes.js';
import { createJourneyScene } from './scene.js';

function clipUrl(id) {
  const base = import.meta.env?.BASE_URL || '/';
  const root = base.endsWith('/') ? base : `${base}/`;
  return `${root}voice/story/${id}.mp3`;
}

export function createJourneyDirector(hooks = {}) {
  const state = {
    route: null,
    routeId: '',
    cutscene: null,
    view: null,
    age: 'junior',
    tour: false,
    phase: 'depart',
    sway: 0,
    swayTarget: 0,
    drawCalls: 0,
    triangles: 0,
    listening: false,
  };

  function world() {
    return hooks.world?.() || null;
  }

  function progress() {
    const cutscene = state.cutscene;
    if (!cutscene?.seconds) return 0;
    return Math.min(1, Math.max(0, cutscene.elapsed / cutscene.seconds));
  }

  function status() {
    const route = state.route;
    const active = Boolean(route && state.view);
    const u = active ? progress() : 0;
    const destination = !route ? null : (route.direction === 'return' ? 'he' : route.realm);
    return {
      active,
      routeId: active ? state.routeId : '',
      via: route?.via || null,
      direction: route?.direction || null,
      from: route?.direction === 'return' ? route.realm : 'he',
      destination,
      destinationName: destination ? destinationName(destination) : '',
      progress: u,
      phase: active ? journeyPhase(u) : 'idle',
      canLand: canLandRoute({ via: route?.via, progress: u, active }),
      canDivert: canDivertRoute({
        via: route?.via,
        direction: route?.direction,
        progress: u,
        routeId: state.routeId,
        nextRealm: 'ri',
      }) || canDivertRoute({
        via: route?.via,
        direction: route?.direction,
        progress: u,
        routeId: state.routeId,
        nextRealm: 'mei',
      }) || canDivertRoute({
        via: route?.via,
        direction: route?.direction,
        progress: u,
        routeId: state.routeId,
        nextRealm: 'xing',
      }),
      drawCalls: state.drawCalls,
      triangles: state.triangles,
      seconds: state.cutscene?.seconds || 0,
    };
  }

  function setLine(phase) {
    const text = journeyCaption(state.route, phase);
    const travel = document.getElementById('travel-journey-line');
    const star = document.getElementById('star-journey-line');
    if (travel) travel.textContent = text;
    if (star) star.textContent = text;
  }

  function speak() {
    const clip = journeySpeech(state.route?.clip, state.age);
    if (!clip || hooks.sound?.() === false) return;
    const senior = state.age === 'senior';
    const play = (id, fallback) => playUrl(clipUrl(id), {
      text: clip.text,
      lang: 'zh-CN',
      enabled: () => hooks.sound?.() !== false,
      fallback,
    });
    if (!senior) {
      play(clip.id, true);
      return;
    }
    const mark = voiceToken();
    playUrl(clipUrl(`${state.route.clip}-senior`), {
      text: clip.text,
      lang: 'zh-CN',
      enabled: () => hooks.sound?.() !== false,
      fallback: false,
    }).then((result) => {
      if (result === 'started' || result === 'aborted') return;
      if (voiceToken() !== mark + 1) return;
      play(state.route.clip, true);
    });
  }

  function bind(canvas) {
    if (!canvas || state.listening) return;
    state.listening = true;
    canvas.addEventListener('pointerdown', onPointerDown, true);
    canvas.addEventListener('pointermove', onPointerMove, true);
  }

  function canvasOf() {
    return world()?.renderer?.domElement || null;
  }

  function onPointerMove(event) {
    if (!state.view || !state.route) return;
    if (state.route.interaction !== 'cloud-steer') return;
    const canvas = canvasOf();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    state.swayTarget = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
  }

  function onPointerDown(event) {
    if (!state.view || !state.route) return;
    const canvas = canvasOf();
    if (!canvas || event.target !== canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    state.swayTarget = Math.max(-1, Math.min(1, x));
    const u = progress();
    const beat = state.view.nearestBeat(u);
    if (beat >= 0 && (state.route.interaction === 'clap-gull' || state.route.interaction === 'whale-beat')) {
      state.view.react('beat', beat);
    }
    const hit = state.view.pick(x, y);
    if (hit?.kind) state.view.react(hit.kind, hit.index);
    event.stopPropagation();
  }

  function render() {
    const current = world();
    const renderer = current?.renderer;
    if (!renderer || !state.view) return;
    const canvas = renderer.domElement;
    const width = canvas.clientWidth || canvas.width || 1;
    const height = canvas.clientHeight || canvas.height || 1;
    state.view.resize(width, height);
    bind(canvas);
    const shadows = renderer.shadowMap.enabled;
    renderer.shadowMap.enabled = false;
    renderer.render(state.view.scene, state.view.camera);
    state.drawCalls = renderer.info.render.calls;
    state.triangles = renderer.info.render.triangles;
    renderer.shadowMap.enabled = shadows;
  }

  function release() {
    state.view?.dispose();
    state.view = null;
    state.route = null;
    state.routeId = '';
    state.cutscene = null;
    state.phase = 'depart';
    state.sway = 0;
    state.swayTarget = 0;
    const current = world();
    if (current) current.holdPaint = false;
    document.documentElement.classList.remove('journey-on');
    const travel = document.getElementById('travel-journey-line');
    const star = document.getElementById('star-journey-line');
    if (travel) travel.textContent = '';
    if (star) star.textContent = '';
    stopVoice();
  }

  return {
    status,
    begin(planned, cutscene) {
      if (!planned?.route || !cutscene) return false;
      if (state.view) release();
      state.route = planned.route;
      state.routeId = planned.routeId;
      state.cutscene = cutscene;
      state.age = hooks.age?.() === 'senior' ? 'senior' : 'junior';
      state.tour = Boolean(hooks.tour?.());
      state.phase = 'depart';
      const current = world();
      if (current) current.holdPaint = true;
      document.documentElement.classList.add('journey-on');
      state.view = createJourneyScene(planned.route, { quality: hooks.quality?.() === 'fine' ? 'fine' : 'fast' });
      state.view.update(0, 0, { sway: 0 });
      setLine('depart');
      render();
      speak();
      const warmRealm = planned.route.direction === 'return' ? 'he' : planned.route.realm;
      hooks.warm?.(warmRealm);
      return true;
    },
    sync(cutscene, { paused = false } = {}) {
      if (!state.view || !cutscene) return status();
      state.cutscene = cutscene;
      const u = progress();
      const phase = journeyPhase(u);
      if (!paused && phase !== state.phase) {
        state.phase = phase;
        setLine(phase);
      }
      if (!paused) state.sway += (state.swayTarget - state.sway) * 0.12;
      state.view.update(u, cutscene.elapsed || 0, { sway: state.sway });
      render();
      return status();
    },
    land() {
      const now = status();
      if (!canLandRoute(now) || !state.cutscene) return false;
      state.cutscene.elapsed = Math.max(state.cutscene.elapsed, state.cutscene.seconds * 0.78);
      return true;
    },
    divert(realmId) {
      const now = status();
      if (!canDivertRoute({ ...now, routeId: state.routeId, nextRealm: realmId }) || !state.cutscene) return false;
      const nextId = routeId({ via: 'balloon', realm: realmId, direction: 'out' });
      const planned = hooks.plan?.({ via: 'balloon', realm: realmId, direction: 'out', age: state.age, tour: state.tour });
      if (!planned || planned.routeId !== nextId) return false;
      state.view?.dispose();
      state.route = planned.route;
      state.routeId = nextId;
      state.age = hooks.age?.() === 'senior' ? 'senior' : 'junior';
      state.view = createJourneyScene(planned.route, { quality: hooks.quality?.() === 'fine' ? 'fine' : 'fast' });
      state.cutscene.seconds = planned.seconds;
      state.cutscene.elapsed = planned.seconds * 0.16;
      state.cutscene.done = false;
      state.cutscene.realmId = realmId;
      state.phase = 'depart';
      setLine('depart');
      hooks.onDivert?.(planned.route);
      speak();
      hooks.warm?.(realmId);
      render();
      return true;
    },
    complete() {
      if (!state.routeId) return false;
      noteTrip(state.routeId);
      release();
      return true;
    },
    cancel() {
      if (!state.routeId && !state.view) return false;
      release();
      return true;
    },
    release,
  };
}
