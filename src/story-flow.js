/** Glue the star-map story onto the home valley without moving the camera. */

import { emptyRealm, normalizeAgeBand } from './realm-data.js';
import { realMoment } from './life-data.js';
import { DISCOVER_HEIGHT } from './vista-data.js';
import { isTour } from './tour-mode.js';
import {
  STORY_LETTER_ID,
  PAPER_BOAT_TEXT,
  applySkip,
  chooseObservatorySite,
  clueLine,
  gameDay,
  guideBrief,
  guideText,
  homeChoices,
  nudgeSpeech,
  observatorySite,
  pendingZones,
  planNudge,
  prologueTrigger,
  storyChapter,
  storyFog,
} from './story-data.js';
import { createStoryScene } from './story-scene.js';
import { FINALE_LINE, LIBAI_FOG_LINE, RESTORE_LINES, restoreLine, valleyLine } from './valley-tutors.js';
import { playUrl, voiceToken } from './voice.js';

let bound = null;
let momentOverride = null;
let domReady = false;
let guideMode = 'icon';
let guideChapter = '';
let briefUntil = 0;
let pendingBrief = false;
let lastMove = 0;
let lastPos = null;
let idleOffered = false;

function $(id) { return document.getElementById(id); }

function baseUrl() {
  const base = import.meta.env?.BASE_URL || '/';
  return base.endsWith('/') ? base : `${base}/`;
}

function clipUrl(id) {
  return `${baseUrl()}voice/story/${id}.mp3`;
}

function playLine(id, text, fallback = true, ageBand = null) {
  const senior = normalizeAgeBand(ageBand) === 'senior';
  const allow = Boolean(fallback && text);
  const base = () => playUrl(clipUrl(id), { text, lang: 'zh-CN', fallback: allow });
  if (!senior) {
    base();
    return;
  }
  const mark = voiceToken();
  playUrl(clipUrl(`${id}-senior`), { fallback: false }).then((result) => {
    if (result === 'started' || result === 'aborted') return;
    if (voiceToken() !== mark + 1) return;
    base();
  });
}

function ageOf(game) {
  return game?.state?.settings?.ageBand || null;
}

function ensureDom() {
  if (domReady || typeof document === 'undefined') return;
  domReady = true;
  $('story-skip')?.addEventListener('click', () => skipCutscene());
  $('tour-next')?.addEventListener('click', () => skipTourChapter());
  $('story-disk')?.addEventListener('click', () => walkToDisk());
  $('story-talk-close')?.addEventListener('click', () => { const card = $('story-talk'); if (card) card.hidden = true; });
  $('story-home-close')?.addEventListener('click', () => { const card = $('story-home'); if (card) card.hidden = true; });
  $('story-home-done')?.addEventListener('click', () => confirmHome());
  $('story-festival')?.addEventListener('click', () => holdFestival());
  $('tour-guide-pin')?.addEventListener('click', () => {
    if (guideMode === 'icon') setGuide('brief', 8000);
    else if (guideMode === 'brief') setGuide('open');
    else setGuide('icon');
  });
  $('tour-guide-more')?.addEventListener('click', () => {
    if (guideMode === 'open') setGuide('icon');
    else setGuide('open');
  });
  const wake = () => { lastMove = performance.now(); idleOffered = false; };
  document.addEventListener('pointerdown', wake, true);
  document.addEventListener('keydown', wake, true);
}

export function setStoryMoment(moment) { momentOverride = moment; }

export function attachValleyStory(world, game, ui = {}) {
  ensureDom();
  const scene = createStoryScene(world);
  bound = {
    world,
    game,
    ui,
    scene,
    touring: Boolean(ui.touring || isTour()),
    entered: false,
    reveal: null,
    bannerUntil: 0,
    letterShown: false,
  };
  world.storyFrame = (dt, paused) => frame(dt, paused);
  world.storySync = (state) => sync(state);
  world.storySky = () => {};
  return bound;
}

export function storyEnter() {
  if (!bound) return;
  bound.entered = true;
  if (bound.touring) showTour(true);
  lastMove = performance.now();
  paintGuide();
  presentGuide();
}

function momentNow() {
  return momentOverride || realMoment();
}

function showTour(on) {
  const guide = $('tour-guide');
  const next = $('tour-next');
  if (guide) guide.hidden = !on;
  if (next) next.hidden = !on;
}

function setGuide(mode, ms = 8000) {
  const guide = $('tour-guide');
  if (!guide) return;
  if (guideMode === mode && mode !== 'brief') return;
  guideMode = mode;
  guide.classList.remove('is-icon', 'is-brief', 'is-open', 'overlay-collapsed', 'overlay-parked', 'overlay-scroll');
  guide.classList.add(mode === 'open' ? 'is-open' : mode === 'brief' ? 'is-brief' : 'is-icon');
  if (mode === 'icon') {
    for (const key of ['left', 'top', 'bottom', 'right', 'width', 'maxHeight', 'transform', 'overflow']) guide.style[key] = '';
  }
  const more = $('tour-guide-more');
  if (more) more.textContent = mode === 'open' ? '收起' : '全文';
  if (mode === 'brief') briefUntil = performance.now() + ms;
  bound?.ui?.layout?.();
}

function paintGuide() {
  if (!bound?.touring) return;
  const travel = bound.game.state.travel;
  const chapter = storyChapter(travel);
  const text = $('tour-guide-text');
  const brief = $('tour-guide-brief');
  if (text) text.textContent = guideText(travel);
  if (brief) brief.textContent = guideBrief(travel);
  if (chapter !== guideChapter) {
    guideChapter = chapter;
    pendingBrief = true;
    idleOffered = false;
  }
}

function balloonOrDialog() {
  const hud = $('balloon-hud');
  if (hud && !hud.hidden) return true;
  for (const id of ['story-talk', 'story-home', 'letter-card', 'mei-letter', 'tutor-card', 'travel-cutscene', 'star-cutscene', 'holo-panel', 'xing-sheet']) {
    const el = $(id);
    if (el && !el.hidden) return true;
  }
  return false;
}

function presentGuide() {
  if (!bound?.touring || !bound.entered) return;
  const now = performance.now();
  const player = bound.world?.playerPosition;
  if (player && lastPos && Math.hypot(player.x - lastPos.x, player.z - lastPos.z) > 0.25) {
    lastMove = now;
    idleOffered = false;
  }
  if (player) lastPos = { x: player.x, z: player.z };
  if (!lastMove) lastMove = now;
  if (balloonOrDialog()) {
    lastMove = now;
    if (guideMode !== 'icon') setGuide('icon');
    return;
  }
  if (pendingBrief) {
    pendingBrief = false;
    setGuide('brief', 8000);
    return;
  }
  if (guideMode === 'brief' && now > briefUntil) {
    setGuide('icon');
    return;
  }
  if (guideMode === 'icon' && !idleOffered && now - lastMove > 18000) {
    idleOffered = true;
    setGuide('brief', 8000);
  }
}

function showBanner(text, seconds, audioId, ageBand = null) {
  const banner = $('story-banner');
  const node = $('story-banner-text');
  if (node) node.textContent = text;
  if (banner) banner.hidden = false;
  bound.bannerUntil = (bound.world?.time || 0) + seconds;
  bound.bannerLeft = seconds;
  playLine(audioId || 'fog-libai', text, bound.ui.speak, ageBand);
}

function hideBanner() {
  const banner = $('story-banner');
  if (banner) banner.hidden = true;
  bound.bannerLeft = 0;
}

export function skipCutscene() {
  if (!bound) return;
  if (bound.reveal) bound.reveal.t = bound.reveal.dur;
  hideBanner();
}

function skipTourChapter() {
  if (!bound?.touring) return;
  bound.game.mutate((state) => { applySkip(state, emptyRealm); });
  hideBanner();
  paintGuide();
  presentGuide();
  bound.ui.toast?.('这一章先记下了。回到河谷时，对应的那一块会亮起来。');
}

function walkToDisk() {
  if (!bound?.world) return;
  const site = observatorySite(bound.game.state.travel, bound.game.state.blocks);
  bound.world.walkTo?.({ x: site.x + 1.6, z: site.z + 1.8 });
  bound.ui.speak?.(LIBAI_FOG_LINE);
}

function sync(state) {
  if (!bound?.scene) return;
  const height = rideHeight();
  const look = visualLook(state, height);
  bound.scene.apply(state, look);
  paintDisk(look);
  if (bound.touring) dusk(bound.world);
}

function rideHeight() {
  const ride = bound?.world?.balloon;
  if (ride && (ride.phase === 'tour' || ride.phase === 'lift' || ride.phase === 'hold')) return ride.height || 0;
  return 0;
}

function visualLook(state, height) {
  const reveal = bound?.reveal && bound.reveal.t < bound.reveal.dur ? bound.reveal : null;
  return storyFog({ travel: state?.travel, ageBand: ageOf(bound.game), height, reveal });
}

function paintDisk(look) {
  const button = $('story-disk');
  if (!button) return;
  const show = Boolean(look?.icon) && bound?.entered && (bound.game.state.travel?.current || 'he') === 'he';
  button.hidden = !show;
}

function dusk(world) {
  if (!world?.scene) return;
  const restored = bound?.game?.state?.travel?.story?.restored || [];
  const night = restored.includes('sky') && !restored.includes('all');
  if (night) {
    world.scene.background.set('#1a2744');
    if (world.scene.fog?.color) world.scene.fog.color.set('#243044');
    if (world.sun) world.sun.intensity = Math.min(world.sun.intensity || 1, 0.32);
    return;
  }
  world.scene.background.set('#c97b62');
  if (world.scene.fog?.color) world.scene.fog.color.set('#e0b196');
  if (world.sun) world.sun.intensity = Math.min(world.sun.intensity || 1, 1.05);
}

function frame(dt, paused) {
  if (!bound?.scene) return;
  if (bound.world?.realmId && bound.world.realmId !== 'he') {
    if (guideMode !== 'icon') setGuide('icon');
    return;
  }
  const state = bound.game.state;
  const height = rideHeight();
  if (!paused && bound.bannerLeft > 0) {
    bound.bannerLeft -= dt;
    if (bound.bannerLeft <= 0) hideBanner();
  }
  if (!paused && bound.reveal) {
    bound.reveal.t += dt;
    if (bound.reveal.t >= bound.reveal.dur) bound.reveal = null;
  }
  const look = visualLook(state, height);
  bound.scene.tick(dt, height);
  bound.scene.apply(state, look);
  paintDisk(look);
  if (bound.touring) dusk(bound.world);
  if (!bound.entered || paused) return;
  if ((state.travel?.current || 'he') !== 'he') return;
  considerPrologue(height);
  considerRestore();
  considerNudge(height);
  paintGuide();
  presentGuide();
}

function considerPrologue(height) {
  const story = bound.game.state.travel?.story || {};
  const reason = prologueTrigger({
    fogIntro: story.fogIntro,
    period: momentNow().period,
    height,
    touring: bound.touring && !story.fogIntro,
  });
  if (!reason || bound.opening) return;
  bound.opening = true;
  const site = chooseObservatorySite(bound.game.state.blocks);
  bound.game.mutate((state) => {
    state.travel.story.fogIntro = true;
    if (!state.travel.story.site) state.travel.story.site = { x: site.x, z: site.z };
    const seen = state.travel.story.seen;
    if (!seen.includes('fog-intro')) seen.push('fog-intro');
  });
  showBanner(LIBAI_FOG_LINE, 10, 'fog-libai');
  bound.ui.toast?.('小燕叼来一只纸船。点小燕可以看信。');
}

function openBoatLetter() {
  const card = $('letter-card');
  const text = $('letter-text');
  if (text) text.textContent = PAPER_BOAT_TEXT;
  if (card) card.hidden = false;
  bound.game.seeLetter?.(STORY_LETTER_ID);
  playLine('swallow', valleyLine('swallow', ageOf(bound.game)), bound.ui.speak, ageOf(bound.game));
}

function considerRestore() {
  if (bound.reveal) return;
  const zone = pendingZones(bound.game.state.travel)[0];
  if (!zone) return;
  bound.reveal = { zone, t: 0, dur: zone === 'all' ? 12 : 8 };
  bound.game.mutate((state) => {
    const list = state.travel.story.restored;
    if (!list.includes(zone)) list.push(zone);
    const id = `restore-${zone}`;
    if (!state.travel.story.seen.includes(id)) state.travel.story.seen.push(id);
  });
  const line = restoreLine(zone, ageOf(bound.game));
  showBanner(line, zone === 'all' ? 12 : 10, `restore-${zone}`, ageOf(bound.game));
  bound.ui.toast?.(line);
}

function considerNudge(height) {
  const travel = bound.game.state.travel;
  const player = bound.world.playerPosition;
  const dock = bound.world.dockSite;
  const nearDock = Boolean(dock && player && Math.hypot(player.x - dock.x, player.z - dock.z) < 4.5);
  const nearBalloon = Boolean(player && Math.hypot(player.x + 4.2, player.z - 20.2) < 5);
  const plan = planNudge({
    travel,
    day: gameDay(bound.game.state.clock?.elapsed),
    height,
    nearDock,
    nearBalloon,
    discovered: travel?.discovered || {},
    period: momentNow().period,
  });
  if (!plan) return;
  const talking = $('story-talk') && !$('story-talk').hidden;
  if (talking) return;
  if (plan.reset) {
    bound.game.mutate((state) => {
      state.travel.story.nudges = {
        vista: 0, bottle: 0, dock: 0, balloon: 0, stuck: 0, day: -1, last: '', chapter: plan.chapter,
      };
    });
    return;
  }
  bound.game.mutate((state) => {
    const nudges = state.travel.story.nudges;
    nudges.day = plan.day;
    nudges.last = plan.id;
    nudges.chapter = plan.chapter;
    nudges[plan.id] = (nudges[plan.id] || 0) + 1;
  });
  const line = nudgeSpeech(plan.id, ageOf(bound.game));
  bound.ui.toast?.(line);
  if (normalizeAgeBand(ageOf(bound.game)) !== 'senior') bound.ui.speak?.(line);
}

export function storyTalk(target) {
  if (!bound || !target) return;
  const id = target.storyId;
  if (id === 'disk') return openDisk();
  if (id === 'swallow') return openBoatLetter();
  if (id === 'wharf') return craftLantern();
  if (id === 'screen') {
    bound.ui.toast?.('晚上，这面墙放你在各个谷看见的颜色。这是游戏里的放映，不是真的电影。');
    return;
  }
  if (id === 'gugu') {
    bound.ui.toast?.('小咕来河谷做客了。它说穹顶上的星星，和家里的夜空是同一张。');
    bound.ui.speak?.('小咕来家里做客了。');
    return;
  }
  if (id === 'festival') {
    bound.ui.toast?.('朋友们来河谷聚一聚。不评分，也不限时。');
    return;
  }
  const senior = normalizeAgeBand(ageOf(bound.game)) === 'senior';
  const line = valleyLine(id, ageOf(bound.game));
  const name = $('story-talk-name');
  const body = $('story-talk-line');
  const extra = $('story-talk-extra');
  if (name) name.textContent = target.name || '';
  if (body) body.textContent = line;
  if (extra) {
    const offer = id === 'boatman' && storyChapter(bound.game.state.travel) === 'mei';
    extra.hidden = !offer;
    extra.textContent = '帮船伯记一份豆子';
    extra.onclick = () => {
      bound.game.mutate((state) => {
        if (!state.travel.gifts.given.includes('mei-beans')) state.travel.gifts.given.push('mei-beans');
      });
      bound.ui.toast?.('记下了。不带豆子，也不影响找光之片。');
    };
  }
  const card = $('story-talk');
  if (card) card.hidden = false;
  playLine(id, line, senior ? null : bound.ui.speak, ageOf(bound.game));
}

function openDisk() {
  const travel = bound.game.state.travel;
  const chapter = storyChapter(travel);
  if (chapter === 'finale') return openHomePicker();
  if (chapter === 'festival' || (travel.story.restored || []).includes('all')) {
    const card = $('story-home');
    if (card) card.hidden = true;
    bound.ui.toast?.('石盘上四片都亮了。第五个凹槽留给以后的新谷。想办星河节，就点今天就办。');
    const fest = $('story-festival');
    if (fest) fest.hidden = false;
    return;
  }
  const shards = [
    travel.realms?.ri?.storyShard ? '潮之片' : '空',
    travel.realms?.mei?.storyShard ? '光之片' : '空',
    travel.realms?.xing?.storyShard ? '星之片' : '空',
  ];
  bound.ui.toast?.(`石盘上四个凹槽。现在：${shards.join('、')}，还有家之片。`);
  bound.ui.speak?.(LIBAI_FOG_LINE);
}

function openHomePicker() {
  const card = $('story-home');
  const box = $('story-home-picks');
  if (!card || !box) return;
  const chosen = new Set(bound.game.state.travel.story.homePlaces || []);
  const choices = homeChoices(bound.game.state.blocks);
  box.replaceChildren();
  for (const choice of choices) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = chosen.has(choice.id) ? 'primary-btn' : 'secondary-btn';
    button.textContent = choice.label;
    button.dataset.place = choice.id;
    button.addEventListener('click', () => {
      button.classList.toggle('primary-btn');
      button.classList.toggle('secondary-btn');
    });
    box.appendChild(button);
  }
  card.hidden = false;
  const line = FINALE_LINE;
  playLine('finale-libai', line, true, ageOf(bound.game));
}

function confirmHome() {
  if (!bound) return;
  const picks = [...document.querySelectorAll('#story-home-picks button.primary-btn')].map((button) => button.dataset.place);
  if (picks.length !== 3) {
    bound.ui.toast?.('选 3 个就好。多了少了都可以再点。');
    return;
  }
  bound.game.mutate((state) => { state.travel.story.homePlaces = picks.slice(0, 3); });
  const card = $('story-home');
  if (card) card.hidden = true;
  const fest = $('story-festival');
  if (fest) fest.hidden = false;
}

function holdFestival() {
  if (!bound) return;
  bound.game.mutate((state) => { state.travel.story.festival = true; });
  const fest = $('story-festival');
  if (fest) fest.hidden = true;
  bound.ui.toast?.('今天就办四谷星河节。朋友们来河谷看看，不评分。');
  bound.ui.speak?.('四谷星河节开始了。');
}

function craftLantern() {
  const game = bound.game;
  if ((game.state.travel.story.restored || []).includes('water') === false && !(game.state.travel.story.restored || []).includes('all')) {
    bound.ui.toast?.('河水亮起来以后，这里可以做纸灯笼。');
    return;
  }
  const result = game.craftPaperLantern?.();
  bound.ui.toast?.(result?.message || '和纸加树枝，做成一盏纸灯笼。格子是游戏约定。');
}

export function storyApi() {
  return {
    fog: () => bound ? storyFog({ travel: bound.game.state.travel, ageBand: ageOf(bound.game), height: rideHeight(), reveal: bound.reveal }) : null,
    guide: () => bound ? guideText(bound.game.state.travel) : '',
    chapter: () => bound ? storyChapter(bound.game.state.travel) : 'prologue',
    setMoment: setStoryMoment,
    site: () => bound ? observatorySite(bound.game.state.travel, bound.game.state.blocks) : null,
    clue: (realm) => clueLine(realm, ageOf(bound?.game)),
    skipCutscene,
    enter: storyEnter,
  };
}

export function storyMapNote(travel, ageBand) {
  if (!travel?.story?.fogIntro) return '';
  const realms = ['ri', 'mei', 'xing'];
  return realms.map((id) => {
    const name = id === 'ri' ? '日谷' : id === 'mei' ? '美谷' : '外星谷';
    return `${name}：${clueLine(id, ageBand)}`;
  }).join(' ');
}

export { DISCOVER_HEIGHT, RESTORE_LINES };
