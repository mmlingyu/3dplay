import './style.css';
import { icon } from './icons.js';
import { ITEMS, GUEST_PLAYER_NAME, resolvePlayerName, setTutorGuards, roofSpan, terrainHeight } from './game-data.js';
import { GameState } from './game-state.js';
import { createPanels } from './panels.js';
import { RiverWorld } from './world.js';
import { POOL, inPoolReservedArea } from './water-data.js';
import { floraStage, realMoment } from './life-data.js';
import { realAnalogClock } from './clock-ui.js';
import { nearbyFrontiers, LAND_RULES, landBounds } from './land-data.js';
import { accountSession } from './engine-client.js';
import { markLocalPlayAccount, staticPreviewEnabled } from './static-preview.js';
import { startValleySync } from './valley-sync.js';
import { BOUNCE_ISLAND, PARK_NAME, PLAY_MODES, SKIP_STEPS, TIMES_TABLES, bounceInfo, inNumberPark, onBounceIsland, playMode, unlockedParkModes } from './bounce-data.js';
import { BALLOON_BASE, BALLOON_CONTROL, BALLOON_NAME, balloonBaseFor, onBalloonLawn } from './balloon-data.js';
import { LOOK_COLORS, LOOK_HATS, LOOK_SHAPES, NAME_PRESETS, lookColor, normalizeLook } from './avatar-data.js';
import { emitMood, lookMarkup, MOOD_LABELS, PREVIEW_MOODS, pupilShift } from './avatar-mood.js';
import { yardPlankCount } from './yard-goal.js';
import { nearestShard, shardNote } from './story-data.js';
import { gradeQuestion, loadTutorPack, nextQuestion, primeTutorPack, tutorById, tutors, useTutorRealm } from './tutor-data.js';
import { chooseDockSite, contentAgeBand, FERRY_NOTE, normalizeAgeBand, REALMS, VOYAGE_NOTE } from './realm-data.js';
import { VISTAS } from './vista-data.js';
import { MEI_AUDIO, SHIP_NOTE, VOYAGE_MEI_NOTE } from './mei-data.js';
import { projectBand } from './project-board.js';
import { createCutscene } from './travel.js';
import { createJourneyDirector, nextDivertRealm, planJourney } from './journey/index.js';
import { sceneStats } from './scene-stats.js';
import { RI_AUDIO } from './ri-tutors.js';
import { riBand } from './ri-story.js';
import { setRiSound, warmRiAudio } from './ri-audio.js';
import { handleRiTap, playQuestionAudio, resetQuestionAudio, riSheetOpen } from './ri-ui.js';
import { FANTASY_ROUTE, XING_AUDIO, XING_OPEN, starRouteVisible } from './xing-data.js';
import { HOLO_AUDIO, WELCOME_LINE } from './holo-data.js';
import { recordedIds } from './voice-lines.js';
import { bindVoiceUnlock, speakPair, speakText, stopVoice, voiceReady } from './voice.js';
import { bindOverlayLayout, layoutOverlays, settleVistaArrow } from './overlay-layout.js';
import { mountHoloUi } from './holo-ui.js';
import { attachHomeVisitor, METEOR_LETTER } from './xing-home.js';
import { closeXingSheet, crystalView, guguView, labView, mossView, paintXingSheet, puzzleView } from './xing-ui.js';
import { kindsFor, makePuzzle } from './glyph-data.js';
import { gravityCompare } from './experiment-lab.js';
import { renderA2UI } from './a2ui.js';
import { npcTalkMessages, talkActivities } from './npc-surface.js';
import { isTour, tourStorage } from './tour-mode.js';
import { attachValleyStory, storyApi, storyEnter, storyTalk } from './story-flow.js';

const $ = (id) => document.getElementById(id);
document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon, 24); });
const touring = isTour();
const game = new GameState(touring ? tourStorage(globalThis.localStorage) : undefined);
game.localPlay = staticPreviewEnabled();
if (game.localPlay) markLocalPlayAccount(document);
const hotItems = ['plank', 'brick', 'door', 'window', 'roof', 'ramp'];
const keys = new Set();
const joystick = { x: 0, z: 0 };
const cooldowns = new Map();
let world, panels, started = false, mode = 'gather', selectedItem = 'plank';
let rotation = 0, buildCell = null, chosenTarget = null, modelMenu = null, panelType = null, savedTime = 0;
let lastFrame = performance.now(), uiTime = 0, completedWish = false, speechTimer, vistaStampTimer;
let tutorBand = game.state.settings.ageBand || 'little', tutorUsed = [], tutorCurrent = null, tutorPick = null, tutorStage = 'menu', tutorActivity = null, tutorPage = 0, tutorGreeted = new Set();
let switching = false, cutscene = null, finishingJourney = false, pendingHomeFlight = false, xingPuzzle = null, xingSheet = '', crystalMarkup = '';
let holoUi = null;
const missingAudio = new Set([...RI_AUDIO, ...MEI_AUDIO, ...XING_AUDIO, ...HOLO_AUDIO]);
for (const id of recordedIds()) missingAudio.delete(id);
bindVoiceUnlock();
warmRiAudio(missingAudio);
setRiSound(game.state.settings.sound);
const riReady = import('./ri-world.js');
const meiReady = import('./mei-world.js');
const xingReady = import('./xing-world.js');
function journeyAge() {
  return normalizeAgeBand(game.state.settings?.ageBand) === 'senior' ? 'senior' : 'junior';
}
const journeyDirector = createJourneyDirector({
  world: () => world,
  age: journeyAge,
  tour: () => touring,
  sound: () => game.state.settings?.sound !== false,
  quality: () => game.state.settings?.quality,
  warm: (realm) => {
    if (realm === 'mei') return meiReady;
    if (realm === 'xing') return xingReady;
    if (realm === 'ri') return riReady;
    return Promise.resolve();
  },
  plan: (spec) => planJourney({ ...spec, age: journeyAge(), tour: touring }),
  onDivert: (route) => presentJourney(route),
});
const journeyApi = {
  status: () => journeyDirector.status(),
  land: () => journeyDirector.land(),
  divert: (realmId) => journeyDirector.divert(realmId),
};
let landHint=null;
let balloonDriveOpen = false;
const statusTimers = new WeakMap();
const dismissedFrontiers=new Set();
let playerName = GUEST_PLAYER_NAME;
let accountUser = null;
let balloonPanelOpen = false;
let balloonPhaseSeen = '';
let journeyChipOn = false;
let journeyPanelFolded = true;
let lastSpoken = { text: '', at: 0 };

function setPlayerName(user) {
  accountUser = user || null;
  refreshPlayerName();
}
function refreshPlayerName() {
  playerName = resolvePlayerName(game.state.look, accountUser);
  game.playerName = playerName;
  const map = $('minimap');
  if (map) map.setAttribute('aria-label', `河谷地图，绿色点是${playerName}的位置`);
  paintLookStage();
}

function showCaption(text) {
  const cap = $('voice-caption');
  if (!cap) return;
  cap.hidden = !text;
  cap.textContent = text || '';
  if (!text) return;
  clearTimeout(showCaption.timer);
  showCaption.timer = setTimeout(() => { if (cap.textContent === text) cap.hidden = true; }, 4200);
}
function toast(message, gain = false) {
  const el = document.createElement('div'); el.className = `toast${gain ? ' gain-toast' : ''}`;
  el.innerHTML = icon(gain ? 'sparkle' : 'leaf', 22);
  const text = document.createElement('span'); text.textContent = message; el.append(text);
  $('toast-root').replaceChildren(el);
  const ms = Math.max(4200, Math.min(8000, 1800 + String(message || '').length * 80));
  setTimeout(() => { if (el.isConnected) el.remove(); }, ms);
  speak(message);
}
function speak(text, options = {}) {
  if (text) emitMood('talking', { soft: true });
  if (!game.state.settings.sound || !text) return;
  const now = performance.now();
  if (lastSpoken.text === text && now - lastSpoken.at < 500) return;
  lastSpoken = { text, at: now };
  const button = document.activeElement?.closest?.('.speak-btn, #wish-read, #story-talk-hear, #look-heart');
  document.querySelectorAll('.is-speaking').forEach((node) => node.classList.remove('is-speaking'));
  button?.classList.add('is-speaking');
  // Toasts and scene lines already show their own words. A second caption
  // only appears when the child asked to hear the current card.
  if (options.caption || button) showCaption(text);
  else showCaption('');
  clearTimeout(speechTimer);
  speakText(text, { enabled: () => game.state.settings.sound !== false });
}
function speakBounce(info) {
  if (!game.state.settings.sound || !info) return;
  clearTimeout(speechTimer);
  speakPair(info.speechEn || '', info.speechZh || info.note || '', { enabled: () => game.state.settings.sound !== false });
}
function paintParkHud(info) {
  const modes = $('bounce-modes');
  const picks = $('bounce-picks');
  if (!modes || !picks) return;
  const current = info?.mode || world?.parkMode || 'count';
  if (!modes.dataset.ready) {
    modes.innerHTML = PLAY_MODES.map(mode => `<button type="button" class="bounce-chip" data-park="${mode.id}" aria-pressed="false">${mode.title}<small>${mode.ages}</small></button>`).join('');
    modes.dataset.ready = '1';
  }
  const open = new Set(unlockedParkModes(game.state.settings?.ageBand));
  for (const btn of modes.querySelectorAll('[data-park]')) {
    const allowed = open.has(btn.dataset.park);
    btn.hidden = !allowed;
    btn.disabled = !allowed;
    btn.setAttribute('aria-pressed', btn.dataset.park === current ? 'true' : 'false');
  }
  const ask = $('bounce-ask');
  const question = world?.parkQuestion;
  if (ask) {
    ask.hidden = !question?.prompt;
    ask.textContent = question?.prompt || '';
  }
  if (current === 'skip') {
    picks.hidden = false;
    picks.innerHTML = SKIP_STEPS.map(step => `<button type="button" class="bounce-chip pick" data-skip="${step}" aria-pressed="${(info?.n ? world?.bounce?.step : world?.parkStep) === step ? 'true' : 'false'}">+${step}</button>`).join('');
  } else if (current === 'times') {
    picks.hidden = false;
    const table = world?.bounce?.table || world?.parkTable || 2;
    picks.innerHTML = TIMES_TABLES.map(item => `<button type="button" class="bounce-chip pick" data-table="${item}" aria-pressed="${table === item ? 'true' : 'false'}">${item}×</button>`).join('');
  } else {
    picks.hidden = true;
    picks.innerHTML = '';
  }
}
function showBounce(info) {
  const hud = $('bounce-hud');
  if (!hud || !info) return;
  hud.hidden = false;
  hud.dataset.tone = info.tone || 'plain';
  paintParkHud(info);
  $('bounce-count').textContent = info.n ? String(info.count) : '★';
  $('bounce-word').textContent = info.word;
  const formula = $('bounce-formula');
  if (formula) {
    formula.textContent = info.formula || '';
    formula.hidden = !info.formula;
  }
  $('bounce-note').textContent = info.note;
  hud.classList.remove('pop');
  void hud.offsetWidth;
  hud.classList.add('pop');
  speakBounce(info);
}
function hideBounce() {
  const hud = $('bounce-hud');
  if (!hud) return;
  hud.hidden = true;
}
function paintBalloonDrive(info) {
  const drive = $('balloon-drive');
  const steer = $('balloon-steer');
  const landing = !!info?.landing;
  if (landing) balloonDriveOpen = false;
  if (drive) drive.hidden = landing || !balloonDriveOpen;
  if (steer) steer.hidden = landing || balloonDriveOpen;
}
function showBalloon(info) {
  const hud = $('balloon-hud');
  if (!hud || !info) return;
  hud.hidden = false;
  const voyaging = info.phase === 'voyage';
  if (voyaging && balloonPhaseSeen !== 'voyage') balloonPanelOpen = false;
  balloonPhaseSeen = info.phase || '';
  hud.classList.toggle('is-flight', voyaging);
  hud.classList.toggle('is-chip', voyaging && !balloonPanelOpen);
  const rideStatus = journeyDirector.status();
  const scenic = rideStatus.active && rideStatus.via === 'balloon';
  const ride = world?.balloon;
  const progress = scenic
    ? Math.round(rideStatus.progress * 100)
    : (voyaging ? Math.round(Math.min(1, (ride?.height || 0) / BALLOON_CONTROL.maxHeight) * 100) : 0);
  const chip = $('balloon-chip');
  if (chip) {
    chip.hidden = scenic ? false : !voyaging;
    const name = scenic ? (rideStatus.destinationName || info.title || '飞行中') : (info.title || '飞行中');
    chip.textContent = `${name} ${progress}%`;
    chip.setAttribute('aria-expanded', String(balloonPanelOpen));
    chip.setAttribute('aria-label', scenic ? `${name}，路上进度 ${progress}%` : `${name} ${progress}%`);
  }
  const panel = $('balloon-panel');
  if (panel) panel.hidden = (voyaging || scenic) && !balloonPanelOpen;
  $('balloon-title').textContent = info.title || '热气球游览';
  const note = $('balloon-note');
  if (note) {
    note.textContent = info.note || '转一圈看河谷';
    note.hidden = scenic;
  }
  const landing = !!info.landing && !voyaging && !scenic;
  const land = $('balloon-land');
  if (land) {
    const here = voyaging || scenic;
    land.disabled = scenic ? !rideStatus.canLand : landing;
    land.textContent = landing ? '正在降落' : (here ? '在这里降落' : '降落到草坪基地');
    land.setAttribute('aria-label', scenic ? (rideStatus.canLand ? '在这里降落' : '现在还不能降落') : (landing ? '正在降落' : (here ? '在这里降落' : '降落到草坪基地')));
  }
  const reroute = $('balloon-reroute');
  if (reroute) reroute.hidden = scenic ? (!rideStatus.canDivert || !balloonPanelOpen) : (!voyaging || !balloonPanelOpen);
  paintBalloonDrive(info);
  const voyage = $('balloon-voyage');
  const voyageMei = $('balloon-voyage-mei');
  const touring = info.phase === 'tour' && (game.state.travel?.current || 'he') === 'he';
  if (voyage) voyage.hidden = !touring;
  if (voyageMei) voyageMei.hidden = !touring || !REALMS.mei?.playable;
  paintStarButtons();
  for (const btn of document.querySelectorAll('[data-balloon-mode]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.balloonMode === (info.mode || 'orbit')));
  }
}
function hideBalloon() {
  balloonDriveOpen = false;
  balloonPanelOpen = false;
  balloonPhaseSeen = '';
  const hud = $('balloon-hud');
  if (hud) { hud.hidden = true; hud.classList.remove('is-flight', 'is-chip'); }
  const land = $('balloon-land');
  if (land) {
    land.disabled = false;
    land.textContent = '降落到草坪基地';
    land.setAttribute('aria-label', '降落到草坪基地');
  }
  paintBalloonDrive(null);
}
function storePlayer() {
  if (!world || world.released || switching) return;
  const realm = game.state.travel?.current || 'he';
  if ((world.realmId || 'he') !== realm) return;
  const p = world.playerPosition;
  if (realm === 'he') {
    if (world.balloon?.phase === 'voyage') game.state.player = { x: BALLOON_BASE.x, y: 0, z: BALLOON_BASE.z };
    else game.state.player = { x: p.x, y: p.y, z: p.z };
    game.state.toys = world.serializeBalls();
  } else {
    const spot = game.state.travel.realms?.[realm];
    if (spot) {
      if (realm === 'xing' && world.inHolo?.()) {
        const front = world.gateFront?.() || { x: 2, y: 0, z: 0 };
        spot.player = { x: front.x, y: front.y || 0, z: front.z, ry: 0 };
      } else if (world.balloon?.phase === 'voyage') {
        const pad = balloonBaseFor(realm);
        spot.player = { x: pad.x, y: 0, z: pad.z, ry: 0 };
      } else spot.player = { x: p.x, y: p.y || 0, z: p.z, ry: world.facing || 0 };
    }
  }
}
function showCutscene(text, realmId = 'ri', ship = realmId === 'mei') {
  const box = $('travel-cutscene');
  if (!box) return;
  $('travel-cutscene-text').textContent = text;
  box.classList.toggle('craft-ship', ship === true);
  box.classList.toggle('craft-boat', ship !== true);
  box.hidden = false;
}
function hideCutscene() {
  const box = $('travel-cutscene');
  if (box) box.hidden = true;
}
function paintStarButtons() {
  const realm = game.state.travel?.current || 'he';
  const phase = world?.balloon?.phase || '';
  const stars = $('balloon-stars');
  const back = $('balloon-return');
  if (stars) stars.hidden = !starRouteVisible({ realm, phase });
  if (back) back.hidden = realm !== 'xing' || phase === 'voyage' || phase === 'descend';
}
function paintTravel() {
  const realm = game.state.travel?.current || 'he';
  const home = $('travel-home');
  const go = $('travel-go');
  const goMei = $('travel-go-mei');
  const actions = $('ri-actions');
  const xingActions = $('xing-actions');
  const meiActions = $('mei-actions');
  const map = document.querySelector('.minimap-card');
  if (map) map.hidden = realm !== 'he';
  if (home) home.hidden = realm === 'he';
  if (actions) actions.hidden = realm !== 'ri';
  if (xingActions) xingActions.hidden = realm !== 'xing' || !!world?.inHolo?.();
  paintHoloChrome();
  if (meiActions) meiActions.hidden = realm !== 'mei';
  const claim = $('ri-claim');
  if (claim) claim.hidden = realm !== 'ri' || !game.washiStatus?.().ready;
  const trade = $('mei-trade');
  if (trade) trade.hidden = projectBand(game.state.settings?.ageBand) !== 'older';
  const nearDock = () => {
    if (!world || realm !== 'he') return false;
    const site = chooseDockSite(game.state.blocks);
    const p = world.playerPosition;
    return !!p && (!site || Math.hypot(p.x - site.x, p.z - site.z) < (site.radius || 2) + 2.3);
  };
  const near = nearDock() && !cutscene;
  if (go) go.hidden = !near;
  if (goMei) goMei.hidden = !near || !REALMS.mei?.playable;
  const touring = realm === 'he' && world?.balloon?.phase === 'tour';
  const voyage = $('balloon-voyage');
  if (voyage) voyage.hidden = !touring;
  const voyageMei = $('balloon-voyage-mei');
  if (voyageMei) voyageMei.hidden = !touring || !REALMS.mei?.playable;
  paintStarButtons();
}
function hideVistaCard() {
  const card = $('vista-card');
  const arrow = $('vista-arrow');
  if (card) card.hidden = true;
  if (arrow) arrow.hidden = true;
}
function showVistaCard(id) {
  const vista = VISTAS[id];
  const card = $('vista-card');
  if (!vista || !card) return;
  card.hidden = false;
  const line = $('vista-line');
  const extra = shardNote(id, game.state.travel);
  if (line) line.textContent = extra ? `${vista.line}${extra}` : vista.line;
  const mark = $('vista-icon');
  if (mark) mark.innerHTML = icon(vista.icon, 48);
  const look = $('vista-look');
  const skip = $('vista-skip');
  const later = $('vista-later');
  if (look) { look.hidden = false; look.setAttribute('aria-label', `看向${vista.name}`); }
  if (skip) skip.hidden = true;
  if (later) later.hidden = false;
  speak($('vista-line')?.textContent || vista.line);
}
function showVistaZoom(id) {
  const look = $('vista-look');
  const skip = $('vista-skip');
  const later = $('vista-later');
  if (look) look.hidden = true;
  if (later) later.hidden = true;
  if (skip) skip.hidden = false;
  const vista = VISTAS[id];
  if (vista) speak(vista.line);
}
function showVistaStamp(id, result) {
  hideVistaCard();
  const vista = VISTAS[id];
  const stamp = $('vista-stamp');
  if (!vista || !stamp) return;
  if (result?.already) { toast(result.message); return; }
  stamp.hidden = false;
  const name = $('vista-stamp-name');
  if (name) name.textContent = `发现${vista.name}`;
  const mark = $('vista-stamp-icon');
  if (mark) mark.innerHTML = icon(vista.icon, 64);
  speak(`发现${vista.name}`);
  clearTimeout(vistaStampTimer);
  vistaStampTimer = setTimeout(() => { stamp.hidden = true; }, 2600);
}
function paintVistaHud() {
  const arrow = $('vista-arrow');
  if (!arrow || !world?.vistaPointer) return;
  const card = $('vista-card');
  if (!card || card.hidden || !world.vistaGlance) { arrow.hidden = true; return; }
  const spot = world.vistaPointer();
  if (!spot?.visible) { arrow.hidden = true; return; }
  arrow.hidden = false;
  arrow.dataset.aimX = String(Math.round(spot.x));
  arrow.dataset.aimY = String(Math.round(spot.y));
  const vista = VISTAS[world.vistaGlance.id];
  if (vista) arrow.setAttribute('aria-label', `看向${vista.name}`);
  settleVistaArrow(arrow);
}
function showStar(title = '飞向星星') {
  const box = $('star-cutscene');
  const heading = $('star-title');
  const note = $('star-note');
  if (heading) heading.textContent = title;
  if (note) note.textContent = title === '飞回河谷' ? '热气球穿过云，回到家的草坪。' : FANTASY_ROUTE;
  if (box) box.hidden = false;
}
function qualityEnv() {
  const shortSide = Math.min(window.innerWidth || 0, window.innerHeight || 0);
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  return { pointerCoarse: coarse, maxTouchPoints: navigator.maxTouchPoints || 0, shortSide };
}
function paintHoloChrome() {
  const phase = world?.holo?.phase || 'off';
  const back = $('holo-back');
  const bar = $('holo-bar');
  const veil = $('holo-transition');
  if (back) back.hidden = phase !== 'in';
  if (bar) bar.hidden = phase !== 'in';
  if (veil) veil.hidden = phase !== 'enter';
}
function hideStar() {
  const box = $('star-cutscene');
  if (box) box.hidden = true;
}
function presentJourney(route) {
  if (!route) return;
  if (route.card === 'star') {
    hideCutscene();
    showStar(route.starTitle || (route.direction === 'return' ? '飞回河谷' : '飞向星星'));
  } else {
    hideStar();
    showCutscene(route.note, route.realm, route.ship === true);
  }
  if (world?.balloon && route.direction === 'out') {
    world.balloon.realmId = route.realm;
    world.balloon.scripted = true;
    showBalloon(world.balloonLook());
  }
}
function beginPlannedJourney(planned, kind) {
  if (!planned) return false;
  cutscene = createCutscene(kind, planned.seconds);
  cutscene.realmId = planned.route.direction === 'return' ? 'he' : planned.route.realm;
  presentJourney(planned.route);
  journeyDirector.begin(planned, cutscene);
  return true;
}
function paintJourneyChip() {
  const status = journeyDirector.status();
  const scenic = status.active && status.via === 'balloon';
  if (!scenic) {
    journeyChipOn = false;
    return;
  }
  const hud = $('balloon-hud');
  const appeared = !journeyChipOn || hud?.hidden;
  const folded = !balloonPanelOpen;
  const foldChanged = journeyChipOn && folded !== journeyPanelFolded;
  journeyChipOn = true;
  journeyPanelFolded = folded;
  if (hud) {
    hud.hidden = false;
    hud.classList.add('is-flight');
    hud.classList.toggle('is-chip', !balloonPanelOpen);
  }
  const panel = $('balloon-panel');
  if (panel && panel.hidden !== !balloonPanelOpen) panel.hidden = !balloonPanelOpen;
  const pct = Math.round((status.progress || 0) * 100);
  const name = status.destinationName || '飞行中';
  const chip = $('balloon-chip');
  if (chip) {
    chip.hidden = false;
    const label = `${name} ${pct}%`;
    if (chip.textContent !== label) chip.textContent = label;
    chip.setAttribute('aria-expanded', String(balloonPanelOpen));
    chip.setAttribute('aria-label', `${name}，路上进度 ${pct}%`);
  }
  const land = $('balloon-land');
  if (land) {
    land.disabled = !status.canLand;
    if (land.textContent !== '在这里降落') land.textContent = '在这里降落';
    land.setAttribute('aria-label', status.canLand ? '在这里降落' : '现在还不能降落');
  }
  const reroute = $('balloon-reroute');
  const hideReroute = !status.canDivert || !balloonPanelOpen;
  if (reroute && reroute.hidden !== hideReroute) reroute.hidden = hideReroute;
  const note = $('balloon-note');
  if (note) note.hidden = true;
  const steer = $('balloon-steer');
  if (steer) steer.hidden = true;
  const drive = $('balloon-drive');
  if (drive) drive.hidden = true;
  if (appeared || foldChanged) layoutOverlays();
}
function hideJourneyChip() {
  journeyChipOn = false;
  journeyPanelFolded = true;
  balloonPanelOpen = false;
  const chip = $('balloon-chip');
  if (chip) chip.hidden = true;
  const phase = world?.balloon?.phase;
  if (phase === 'tour' || phase === 'lift') {
    const hud = $('balloon-hud');
    if (hud) hud.classList.remove('is-flight', 'is-chip');
    if (world?.balloonLook) showBalloon(world.balloonLook());
    return;
  }
  hideBalloon();
}
function abortScenicJourney() {
  if (finishingJourney || !cutscene) return;
  cutscene = null;
  journeyDirector.cancel();
  hideJourneyChip();
  hideCutscene();
  hideStar();
}
function scenicKind(kind = cutscene?.kind) {
  return kind === 'ferry' || kind === 'voyage' || kind === 'stars' || kind === 'return';
}
function tickScenic(dt) {
  if (!scenicKind()) return;
  const paused = !started || panelType === 'pause' || !!panels?.isOpen();
  const done = cutscene.tick(dt, { paused, hidden: false });
  journeyDirector.sync(cutscene, { paused });
  paintJourneyChip();
  if (done) finishCutscene();
}
function worldHooks() {
  return {
    tutors: tutors(),
    onTap, onPick, onQuickPlace, onPreviewDrag: onTap, onAim,
    canDragPreview: () => started && mode === 'build' && !!buildCell && !!game.state.inventory[selectedItem] && !panels?.isOpen(),
    onBall: (message) => { if (started) { toast(message); save(); } },
    onWater: message => { if (started) toast(message); },
    onModelFocus: target => { if ($('focus-exit')) $('focus-exit').hidden = !target; if (!started) return; feel(target ? [10, 24, 16] : 8); toast(target ? `靠近看${target.name}。点退出近看可以回来。` : '回到原来的视角。'); refreshModelMenu(); updateContext(); },
    canFocusModel: () => started && mode !== 'build' && mode !== 'remove' && !panels?.isOpen() && (world?.realmId || 'he') === 'he',
    onBounce: info => { if (!started) return; showBounce(info); updateContext(); },
    onParkMode: info => { if (!started) return; if (world.bounce) showBounce(info); const modeName = playMode(info.mode); toast(`${modeName.title} · ${modeName.ages}`); updateContext(); },
    onParkAsk: (question) => {
      const ask = $('bounce-ask');
      const hud = $('bounce-hud');
      if (ask) { ask.hidden = !question?.prompt; ask.textContent = question?.prompt || ''; }
      if (question?.prompt && started) speak(question.prompt);
      if (!hud) return;
      if (question?.prompt && !world?.bounce) {
        hud.hidden = false;
        const word = $('bounce-word');
        if (word && !word.textContent) word.textContent = '？';
      } else if (!question && !world?.bounce) hud.hidden = true;
    },
    onParkAnswer: ({ correct, prompt, answer }) => {
      if (!started) return;
      const line = correct ? '点亮啦。' : `${prompt}再试一次。对的是 ${answer}。`;
      toast(line, correct);
      if (correct) world?.celebrate?.(world.playerPosition, '#c6efb4');
    },
    onBounceStop: () => { hideBounce(); const trampoline = world.targets.find(t => t.id === 'bounce-island'); if (trampoline) trampoline.action = '跳上去'; updateContext(); toast('停下来啦。走下来，再走上去，会重新从 1 开始。也可以先点一块玩法石。'); },
    onBalloonStart: info => { if (!started) return; hideBounce(); showBalloon(info); toast('坐稳，热气球起飞啦。转一圈看整个河谷。'); speak('坐上热气球，飞起来看整个河谷。'); updateContext(); },
    onBalloonLook: info => {
      if (!started) return;
      showBalloon(info);
      updateContext();
      if (pendingHomeFlight && info.phase === 'tour' && (game.state.travel?.current || 'he') === 'xing' && world.startVoyage('he')) {
        pendingHomeFlight = false;
        beginStarReturn();
      }
    },
    onBalloonStop: (info) => { hideBalloon(); hideVistaCard(); if (info?.silent) return; toast('已经降落。想再看，再点乘坐。'); updateContext(); },
    onVistaSpot: (id) => { if (!started) return; showVistaCard(id); },
    onVistaZoom: (id) => { if (!started) return; showVistaZoom(id); },
    onVistaStamp: (id) => { if (!started) return; const result = game.discoverVista(id); showVistaStamp(id, result); },
    onVistaHide: () => hideVistaCard(),
    onHolo: (info) => {
      paintHoloChrome();
      if (info?.phase === 'in') {
        const welcome = game.noteHoloWelcome();
        world?.setDomeFilled?.(game.state.travel?.realms?.xing?.storyShard === true);
        world?.applyAvatar?.(game.state.travel?.realms?.xing?.holo);
        world?.setFigureMode?.('zero', 'scan');
        if (welcome.fresh) { toast(WELCOME_LINE); speak(WELCOME_LINE); }
        save();
      }
      if (info?.phase === 'off') {
        holoUi?.close();
        world?.setFigureMode?.('zero', 'idle');
        save();
      }
    },
    onHoloPad: (pad) => { if (pad?.stage) holoUi?.openStage(pad.stage); },
    onVoyageArrive: (realmId) => {
      hideStar();
      hideCutscene();
      if (realmId === 'xing') goXing();
      else if (realmId === 'he' || (game.state.travel?.current || 'he') === 'xing') goHome();
      else goRealm('balloon', realmId || 'ri');
    },
  };
}
async function mountWorld(realm, mod, options = {}) {
  const canvas = $('world-canvas');
  const outer = realm && realm !== 'he' && REALMS[realm]?.playable;
  if (outer) {
    useTutorRealm(realm);
    try { primeTutorPack(realm); } catch { /* the scene still opens */ }
    loadTutorPack(realm).catch(() => {});
  }
  if (world) {
    world.release?.();
    world = null;
  }
  if (realm === 'ri') {
    const ready = mod || await riReady;
    world = new ready.RiWorld(canvas, worldHooks());
    const spot = game.state.travel.realms?.ri;
    if (spot?.player) {
      world.playerPosition.set(spot.player.x, spot.player.y || 0, spot.player.z);
      world.facing = spot.player.ry || 0;
    }
  } else if (realm === 'mei') {
    const ready = mod || await meiReady;
    world = new ready.MeiWorld(canvas, worldHooks());
    const spot = game.state.travel.realms?.mei;
    if (spot?.player) {
      world.playerPosition.set(spot.player.x, spot.player.y || 0, spot.player.z);
      world.facing = spot.player.ry || 0;
    }
  } else if (realm === 'xing') {
    const ready = mod || await xingReady;
    world = new ready.XingWorld(canvas, worldHooks());
    const spot = game.state.travel.realms?.xing;
    if (spot?.player && !options.descend) {
      world.playerPosition.set(spot.player.x, spot.player.y || 0, spot.player.z);
      world.facing = spot.player.ry || 0;
    }
  } else {
    useTutorRealm('he');
    setTutorGuards(tutors());
    world = new RiverWorld(canvas, worldHooks());
    world.facing = 0;
    attachHomeVisitor(world, game);
    attachValleyStory(world, game, { speak, toast, touring, layout: () => layoutOverlays() });
    if (started) storyEnter();
  }
  if (realm === 'xing' && world.deviceEnv) world.deviceEnv = qualityEnv();
  world.sync(game.state);
  if (outer) emitMood('surprise');
  if ((realm === 'ri' || realm === 'mei') && game.state.travel.via === 'balloon') world.beginArrivalDescend?.();
  if (realm === 'xing' && options.descend) world.beginArrivalDescend?.();
  world.createLabels((target) => approach(target, true));
  paintTravel();
}
async function goXing() {
  if (switching) return;
  pendingHomeFlight = false;
  abortScenicJourney();
  hideCutscene();
  hideStar();
  const fromHome = (game.state.travel?.current || 'he') === 'he';
  try {
    const mod = await xingReady;
    if (fromHome && (game.state.travel?.current || 'he') !== 'he') return;
    storePlayer();
    switching = true;
    if (fromHome) {
      const seen = game.state.travel?.story?.letters || [];
      const result = game.beginTravel('xing', 'balloon', { withGugu: seen.includes('letter-xing-meteor') });
      if (!result.ok) { toast(result.message); return; }
      await mountWorld('xing', mod, { descend: true });
      toast(result.message);
      speak(FANTASY_ROUTE);
    } else if ((game.state.travel?.current || 'he') !== 'xing') {
      return;
    } else {
      await mountWorld('xing', mod);
    }
    updateContext();
  } catch (error) {
    console.warn('去外星谷没有完成', error);
    if ((game.state.travel?.current || 'he') === 'xing' && fromHome) game.returnHome();
    if (!world || world.released) await mountWorld('he');
    toast('这一次还在原来的地方。');
  } finally {
    switching = false;
  }
}
async function goRealm(via = 'ferry', realmId = 'ri') {
  if (realmId === 'xing') return goXing();
  if (switching || (game.state.travel?.current || 'he') !== 'he') return;
  const id = REALMS[realmId]?.playable && realmId !== 'he' ? realmId : 'ri';
  abortScenicJourney();
  hideCutscene();
  try {
    const mod = id === 'mei' ? await meiReady : await riReady;
    if ((game.state.travel?.current || 'he') !== 'he') return;
    storePlayer();
    switching = true;
    const result = game.beginTravel(id, via);
    if (!result.ok) { toast(result.message); return; }
    await mountWorld(id, mod);
    toast(result.message);
    const note = via === 'balloon' ? (id === 'mei' ? VOYAGE_MEI_NOTE : VOYAGE_NOTE) : (id === 'mei' ? SHIP_NOTE : FERRY_NOTE);
    speak(note);
    updateContext();
  } catch (error) {
    console.warn('出发没有完成', error);
    if ((game.state.travel?.current || 'he') !== 'he') game.returnHome();
    if (!world || world.released) await mountWorld('he');
    toast('这一次没能出发，还在河谷。');
  } finally {
    switching = false;
  }
}
async function goHome() {
  if (switching || (game.state.travel?.current || 'he') === 'he') return;
  pendingHomeFlight = false;
  abortScenicJourney();
  holoUi?.close();
  hideBalloon();
  hideCutscene();
  hideStar();
  try {
    storePlayer();
    switching = true;
    const result = game.returnHome();
    await mountWorld('he');
    toast(result.message);
    updateContext();
  } finally {
    switching = false;
  }
}
function startFerry(realmId = 'ri') {
  if (cutscene || switching || (game.state.travel?.current || 'he') !== 'he') return;
  const id = realmId === 'mei' && REALMS.mei?.playable ? 'mei' : 'ri';
  const planned = planJourney({ via: 'ferry', realm: id, direction: 'out', age: journeyAge(), tour: touring });
  beginPlannedJourney(planned, 'ferry');
  paintTravel();
}
function startBalloonJourney(realmId) {
  if (!started || cutscene || switching || !world?.startVoyage?.(realmId)) return false;
  world.balloon.scripted = true;
  const planned = planJourney({ via: 'balloon', realm: realmId, direction: 'out', age: journeyAge(), tour: touring });
  beginPlannedJourney(planned, realmId === 'xing' ? 'stars' : 'voyage');
  showBalloon(world.balloonLook());
  storePlayer();
  return true;
}
function beginStarReturn() {
  if (!world?.balloon) return false;
  world.balloon.scripted = true;
  const planned = planJourney({ via: 'balloon', realm: 'xing', direction: 'return', age: journeyAge(), tour: touring });
  beginPlannedJourney(planned, 'stars');
  showBalloon(world.balloonLook());
  return true;
}
function startReturnJourney() {
  if (!started || cutscene || switching) return false;
  const realm = game.state.travel?.current || 'he';
  if (realm === 'he') return false;
  const via = realm === 'xing' || game.state.travel?.via === 'balloon' ? 'balloon' : 'ferry';
  const planned = planJourney({ via, realm, direction: 'return', age: journeyAge(), tour: touring });
  if (world?.balloon) world.balloon.scripted = true;
  beginPlannedJourney(planned, 'return');
  paintTravel();
  return true;
}
async function finishCutscene() {
  if (finishingJourney || !cutscene) return;
  finishingJourney = true;
  const kind = cutscene.kind;
  const realmId = cutscene.realmId || 'ri';
  cutscene = null;
  journeyDirector.complete();
  hideJourneyChip();
  hideCutscene();
  hideStar();
  try {
    if (kind === 'ferry') await goRealm('ferry', realmId);
    else if (kind === 'return') await goHome();
    else if (kind === 'voyage' || kind === 'stars') world?.completeVoyage?.();
  } finally {
    finishingJourney = false;
  }
}
function save() {
  try { if (sessionStorage.getItem('xing-inject')) return; } catch { /* still save */ }
  storePlayer();
  const result = game.save();
  updateSaveStatus();
  return result;
}
const valleySync = touring
  ? { bind: async () => ({ changed: false, source: 'tour' }), flush: async () => false }
  : startValleySync(game);
function figureNames() {
  return (game.state.creation?.figures || []).map(item => item.figure?.name).filter(Boolean);
}
async function refreshAccount() {
  const chip = $('account-chip'), label = $('account-label'), dot = $('account-dot');
  if (!chip || !label) return;
  if (staticPreviewEnabled()) {
    markLocalPlayAccount(document);
    flashChip(chip, label.textContent);
    updateSaveStatus();
    refreshWelcome();
    return;
  }
  const session = await accountSession();
  const user = session.user;
  setPlayerName(user);
  if (!session.online) {
    label.textContent = '本机';
    chip.removeAttribute('href');
    chip.removeAttribute('target');
    delete chip.dataset.signedIn;
    chip.title = '现在只记在这台浏览器里。';
    if (dot) dot.style.background = '#84a369';
  } else if (user?.name) {
    label.textContent = user.name;
    chip.href = '/account';
    chip.target = '_blank';
    chip.rel = 'noopener';
    chip.dataset.signedIn = '1';
    chip.title = '已登录。建造、造物和设置记在这个账号上。';
    if (dot) dot.style.background = '#84a369';
  } else {
    label.textContent = '登录';
    chip.href = '/account';
    chip.target = '_blank';
    chip.rel = 'noopener';
    delete chip.dataset.signedIn;
    chip.title = '还没登录。登录后，每个人会进入自己的河谷。';
    if (dot) dot.style.background = '#c98958';
  }
  flashChip(chip, label.textContent);
  const space = await valleySync.bind(user);
  updateSaveStatus();
  refreshWelcome();
  if (!space?.changed || space.source === 'guest' || space.source === 'offline') return;
  const names = figureNames().slice(0, 3);
  if (space.source === 'backup') toast(names.length ? `找回了${names.join('、')}，已经记到这个账号上。` : '找回了以前的河谷，已经记到这个账号上。');
  else if (space.switched) toast(names.length ? `这是你的河谷：${names.join('、')}。` : '这是你自己的河谷。');
  else if (space.source === 'fresh') toast('这是你自己的河谷。建造和设置会记在这个账号上。');
}
function refreshWelcome() {
  if (started) return;
  const stats = game.state.stats || {};
  const made = (game.state.creation?.figures?.length || 0) + (game.state.creation?.assemblies?.length || 0) + (game.state.blocks?.length || 0);
  if (stats.built || stats.gathered || stats.crafted || made) $('start-button').innerHTML = `继续我的河谷 ${icon('arrow-right', 22)}`;
}
function flashChip(el, signature, sticky = false) {
  if (!el) return;
  el.classList.toggle('is-problem', sticky);
  if (sticky) {
    el.classList.add('is-live');
    return;
  }
  if (el.dataset.shown === signature) return;
  el.dataset.shown = signature;
  el.classList.add('is-live');
  clearTimeout(statusTimers.get(el));
  statusTimers.set(el, setTimeout(() => el.classList.remove('is-live'), 2000));
}
function updateSaveStatus() {
  const error = game.storageError || !game.storage;
  const onAccount = Boolean(game.accountId) && !error;
  const text = error ? '请导出备份' : (onAccount ? '已记到账号' : '自动保存');
  $('save-status').innerHTML = `<i class="save-dot" style="${error ? 'background:#c98958' : ''}"></i>${text}`;
  flashChip($('save-status'), text, Boolean(error));
  $('save-status').title = game.storageError || (!game.storage
    ? '当前窗口无法持久保存，请在暂停菜单导出备份。'
    : (game.accountId
      ? '背包物品、放下的建筑和设置保存在当前登录账号上。换一个人登录，会进入那个人自己的河谷。'
      : (staticPreviewEnabled()
        ? '本地游玩，只保存在这台浏览器。'
        : '还没登录，只保存在这台浏览器。登录后会记到账号上。')));
}
function resetInput() {
  keys.clear(); joystick.x = joystick.z = 0;
  document.querySelector('.joystick-knob').style.transform = '';
  world?.stopWalking();
  world?.cancelPointerGesture();
}
function openPanel(type, context = {}) {
  if (!world) return;
  hideModelMenu();
  resetInput(); save(); panelType = type; panels.open(type, context);
  updateContext();
}
function hideModelMenu() {
  modelMenu = null;
  const menu = $('model-menu');
  if (menu) menu.hidden = true;
}
function showModelMenu(target) {
  modelMenu = { id: target.id, figureId: target.figureId || null, assemblyId: target.assemblyId || null, name: target.name };
  const menu = $('model-menu');
  menu.hidden = false;
  $('model-menu-name').textContent = target.name;
  $('model-menu-recall').textContent = target.figureId ? '收回背包' : '送回实验室';
  refreshModelMenu();
  placeModelMenu();
}
function refreshModelMenu() {
  if (!modelMenu) return;
  $('model-menu-act').textContent = world.creation.actionLabel(modelMenu.id) || '做个动作';
  const guide = $('model-menu-guide');
  if (guide) guide.textContent = world.modelFocus?.id === modelMenu.id
    ? '点「退出近看」，或再双击一次，回到原来的视角。'
    : '双击靠近看看。再双击一次，或点「退出近看」。';
}
function placeModelMenu() {
  const menu = $('model-menu');
  if (!menu || menu.hidden || !modelMenu || !world) return;
  const live = world.targets.find(t => t.id === modelMenu.id);
  if (!live) { hideModelMenu(); chosenTarget = null; world.select(null); return; }
  const point = live.position.clone();
  point.y += 1.7;
  point.project(world.camera);
  const w = world.canvas.clientWidth, h = world.canvas.clientHeight;
  if (point.z > 1) { menu.style.visibility = 'hidden'; return; }
  menu.style.visibility = '';
  const px = (point.x + 1) * w / 2;
  const py = (-point.y + 1) * h / 2;
  const menuW = 210;
  let x = px + 78;
  if (x + menuW > w - 12) x = px - menuW - 28;
  x = Math.min(Math.max(12, x), Math.max(12, w - menuW));
  const y = Math.min(Math.max(76, py - 36), Math.max(76, h - 210));
  const left = Math.round(x);
  const top = Math.round(y);
  if (menu.dataset.pin === `${left},${top}`) return;
  menu.dataset.pin = `${left},${top}`;
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}
function recallFromMenu() {
  if (!modelMenu) return;
  const { id, figureId, assemblyId } = modelMenu;
  const result = figureId ? game.recallFigure(figureId) : assemblyId ? game.recallAssembly(assemblyId) : null;
  if (!result) return;
  toast(result.message, result.ok);
  if (!result.ok) return;
  if (world.modelFocus?.id === id) world.modelFocus = null;
  chosenTarget = null;
  world.select(null);
  hideModelMenu();
  updateContext();
}
function editFromMenu() {
  if (!modelMenu) return;
  const { figureId, assemblyId } = modelMenu;
  hideModelMenu();
  if (figureId) openPanel('lab', { figureId });
  else if (assemblyId) openPanel('lab', { blueprintId: game.assembly(assemblyId)?.blueprintId });
}
function actFromMenu() {
  const target = world.targets.find(t => t.id === modelMenu?.id);
  if (!target) return;
  interact(target);
  refreshModelMenu();
}
// Figures go a step in front of the player, falling back to nearby open land.
function placeFigureNearby(figureId){
  if(!started)return {ok:false,message:'先进入河谷，再把造物放出来。'};
  const p=world.playerPosition,f=world.facing;
  let last=null;
  for(const [dist,turn] of [[1.6,0],[1.6,.8],[1.6,-.8],[2.4,0],[1.2,1.6],[1.2,-1.6],[2.4,Math.PI]]){
    const x=p.x+Math.sin(f+turn)*dist,z=p.z+Math.cos(f+turn)*dist;
    last=game.placeFigure(figureId,{x,z,rotY:f+Math.PI});
    if(last.ok){world.sync(game.state);world.celebrate({x,y:p.y,z});return last;}
  }
  return last;
}
function reclaimNearby(cx,cz){
  storePlayer();
  if(!started)return {ok:false,message:'先进入河谷，走到边界看看吧。'};
  const result=game.reclaim(cx,cz);
  if(result.ok){resetInput();chosenTarget=null;world.select(null);world.celebrate(world.playerPosition);}
  updateContext();
  return result;
}
function updateLandGuidance(){
  const ferryOpen = ['travel-go', 'travel-go-mei'].some((id) => {
    const button = $(id);
    return button && !button.hidden;
  });
  if ((game.state.travel?.current || 'he') !== 'he' || world.balloon || ferryOpen) {
    landHint = null;
    $('land-question').hidden = true;
    world.setFrontier?.(null);
    return;
  }
  const nearby=nearbyFrontiers(game.state.land,world.playerPosition);
  for(const id of dismissedFrontiers)if(!nearby.some(p=>p.id===id))dismissedFrontiers.delete(id);
  landHint=started&&mode==='gather'&&!panels?.isOpen()&&!document.hidden?nearby.find(p=>!dismissedFrontiers.has(p.id))??null:null;
  const question=$('land-question');question.hidden=!landHint;question.dataset.chunk=landHint?.id??'';
  if(landHint){
    $('land-question-detail').textContent=`身边的${landHint.direction}草地 · ${LAND_RULES.chunkSize} × ${LAND_RULES.chunkSize} 格`;
    $('context-text').textContent='到了边界 · 可以整理身边草地，也可以转身继续玩';
  }
  world.setFrontier(landHint);
}
function changeMode(next) {
  world?.cancelPointerGesture();
  mode = next; buildCell = null; chosenTarget = null; hideModelMenu(); world?.select(null); world?.stopWalking();
  updateUI(); updateContext();
}
function selectItem(item) {
  if (!ITEMS[item]) return;
  if (!game.state.inventory[item]) { toast(`${ITEMS[item].name}暂时没有，去采集或在工坊制作吧。`); return; }
  selectedItem = item; changeMode('build');
}
function feel(pattern = 12) {
  try { navigator.vibrate?.(pattern); } catch { /* 这台设备没有震动 */ }
}
function selectTarget(target) { chosenTarget = target; world.select(target); updateContext(); }
function onAim(pick) {
  if (!started || mode !== 'build' || panels?.isOpen() || buildCell || !pick?.cell) return;
  buildCell = pick.cell;
  updateContext();
}
function onPick(pick) {
  if (!started || !pick?.target) return;
  if (mode === 'remove' && pick.target.type !== 'block') return;
  selectTarget(pick.target);
  const button = $('action-button');
  if (button) { button.classList.remove('attention'); void button.offsetWidth; button.classList.add('attention'); }
  feel(12);
}
function approach(target, action = false) {
  if (!started || panels.isOpen()) return;
  selectTarget(target);
  if (world.distanceTo(target) > 2.8) world.walkTo(target.position, action ? () => interact(target) : null);
  else if (action) interact(target);
}
function tutorOpen() {
  return $('tutor-card') && !$('tutor-card').hidden;
}
function tutorResult() {
  if (tutorStage !== 'play') return { picked: '', result: '' };
  if (tutorActivity?.play === 'pick' || tutorActivity?.play === 'quiz') {
    return { picked: tutorPick?.choiceId || '', result: tutorPick ? (tutorPick.ok ? 'ok' : 'no') : '' };
  }
  return { picked: '', result: tutorPick?.seen ? 'seen' : '' };
}
function beginActivity(tutor, activity) {
  tutorActivity = activity;
  tutorStage = 'play';
  tutorPick = null;
  tutorPage = 0;
  tutorUsed = [];
  tutorCurrent = activity?.play === 'quiz' ? nextQuestion(tutor.id, tutorBand, tutorUsed) : null;
}
function paintTutor() {
  const tutor = tutorById($('tutor-card').dataset.tutor);
  const surface = $('npc-surface');
  if (!tutor || !surface) return;
  const marked = tutorResult();
  renderA2UI(surface, npcTalkMessages({
    tutor,
    stage: tutorStage,
    activity: tutorActivity,
    band: tutorBand,
    question: tutorActivity?.play === 'pick' ? { ask: tutorActivity.ask, choices: tutorActivity.choices } : tutorCurrent,
    page: tutorPage,
    picked: marked.picked,
    result: marked.result,
  }), (action) => {
    if (action.name === 'close') { closeTutor(); return; }
    if (action.name === 'menu') {
      tutorStage = 'menu';
      tutorActivity = null;
      tutorPick = null;
      tutorPage = 0;
      paintTutor();
      return;
    }
    if (action.name === 'done') {
      tutorPick = { seen: true };
      speak('看完了');
      paintTutor();
      return;
    }
    if (action.name === 'page') {
      tutorPage = Math.max(0, Number(action.context?.page) || 0);
      paintTutor();
      return;
    }
    if (action.name === 'band') {
      tutorBand = ['little', 'bigger', 'older'].includes(action.context?.band) ? action.context.band : 'little';
      tutorUsed = [];
      tutorPick = null;
      tutorCurrent = nextQuestion(tutor.id, tutorBand, tutorUsed);
      paintTutor();
      return;
    }
    if (action.name === 'next') {
      tutorPick = null;
      tutorCurrent = nextQuestion(tutor.id, tutorBand, tutorUsed);
      paintTutor();
      return;
    }
    if (action.name !== 'choose' || tutorPick) return;
    if (tutorStage !== 'play') {
      const activity = talkActivities(tutor).find((item) => item.id === action.context?.value);
      if (!activity) return;
      beginActivity(tutor, activity);
      paintTutor();
      return;
    }
    const graded = gradeQuestion(
      tutorActivity?.play === 'pick' ? { choices: tutorActivity.choices } : tutorCurrent,
      action.context?.value,
    );
    tutorPick = { ok: graded.ok, choiceId: action.context?.value };
    if (tutorCurrent?.id) tutorUsed.push(tutorCurrent.id);
    if (graded.ok && tutorActivity?.play === 'quiz') {
      if (tutor.valley === 'xing') {
        const supply = game.rewardXingSupply(tutor.id);
        if (supply.ok) toast(supply.message);
      } else if (tutor.valley === 'ri' || tutor.valley === 'mei') {
        const supply = game.rewardTutorSupply(tutor.id);
        if (supply.ok) toast(supply.message);
      }
    }
    speak(graded.ok ? '对了' : '再选一次');
    paintTutor();
  });
  if (tutor?.valley === 'ri' && tutorActivity?.play === 'quiz') playQuestionAudio(tutorCurrent, riBand(tutorBand), speak);
}
function openTutor(tutorId) {
  const tutor = tutorById(tutorId);
  if (!tutor || tutorOpen()) return;
  tutorUsed = [];
  tutorPick = null;
  tutorPage = 0;
  tutorStage = 'menu';
  tutorActivity = null;
  tutorCurrent = nextQuestion(tutor.id, tutorBand, tutorUsed);
  if (tutorId === 'gugu') world?.setFigureMode?.('gugu', 'talk');
  if (tutorId === 'lingyi') world?.setFigureMode?.('zero', 'scan');
  $('tutor-card').hidden = false;
  $('tutor-card').dataset.tutor = tutor.id;
  resetQuestionAudio();
  world?.setFigureMode?.(tutor.id, 'talk');
  paintTutor();
  world?.stopWalking();
}
function closeTutor() {
  if ($('tutor-card')) $('tutor-card').hidden = true;
  tutorCurrent = null;
  resetQuestionAudio();
  world?.setFigureMode?.('gugu', 'idle');
  world?.setFigureMode?.('zero', 'idle');
  world?.setFigureMode?.(null, null);
}
function bandName() {
  return contentAgeBand(game.state.settings?.ageBand || tutorBand || 'little');
}
function openXing(kind = 'lab') {
  const sheet = $('xing-sheet');
  if (!sheet) return;
  const band = bandName();
  xingSheet = kind;
  if (kind === 'puzzle') {
    const kinds = kindsFor(band);
    xingPuzzle = makePuzzle(band, kinds[0], `xing-${game.state.clock.elapsed}`);
    paintXingSheet(sheet, puzzleView(band, xingPuzzle?.id || 'xing', xingPuzzle));
  } else if (kind === 'crystal') {
    crystalMarkup = crystalView(game.crystalStatus());
    paintXingSheet(sheet, crystalMarkup);
  }
  else if (kind === 'gugu') paintXingSheet(sheet, guguView());
  else if (kind === 'moss') paintXingSheet(sheet, mossView());
  else paintXingSheet(sheet, labView(band));
  world?.stopWalking?.();
}
function closeXing() {
  xingSheet = '';
  xingPuzzle = null;
  crystalMarkup = '';
  closeXingSheet($('xing-sheet'));
}
function paintCrystalSheet() {
  const view = crystalView(game.crystalStatus());
  if (view === crystalMarkup) return;
  crystalMarkup = view;
  paintXingSheet($('xing-sheet'), view);
}
function handleXingSheet(event) {
  const button = event.target.closest('[data-xing]');
  if (!button) return;
  const act = button.dataset.xing;
  const band = bandName();
  if (act === 'close') { closeXing(); return; }
  if (act === 'kind') {
    xingPuzzle = makePuzzle(band, button.dataset.kind, `xing-${game.state.clock.elapsed}-${button.dataset.kind}`);
    paintXingSheet($('xing-sheet'), puzzleView(band, xingPuzzle?.id || 'xing', xingPuzzle));
    return;
  }
  if (act === 'hint') {
    const note = $('xing-puzzle-note');
    if (note) note.textContent = xingPuzzle?.hint || '再看一次也没关系。';
    return;
  }
  if (act === 'reveal') {
    const note = $('xing-puzzle-note');
    if (note) note.textContent = xingPuzzle?.answer ? `答案是：${xingPuzzle.answer}` : '这题可以先跳过。';
    return;
  }
  if (act === 'answer') {
    const result = game.solvePuzzle(xingPuzzle, button.dataset.choice);
    toast(result.message, true);
    const note = $('xing-puzzle-note');
    if (note) note.textContent = result.message;
    world?.refreshSigns?.();
    return;
  }
  if (act === 'experiment') {
    const result = game.recordExperiment(button.dataset.kind || 'gravity', band);
    toast(result.message, true);
    return;
  }
  if (act === 'crystal') {
    const result = game.startCrystal(button.dataset.much !== '0');
    toast(result.message, result.ok);
    paintCrystalSheet();
    return;
  }
  if (act === 'claim-crystal') {
    const result = game.claimCrystal();
    toast(result.message, result.ok);
    paintCrystalSheet();
    return;
  }
  if (act === 'reunite') {
    const result = game.reuniteGugu();
    toast(result.message, true);
    closeXing();
    world?.sync?.(game.state);
    return;
  }
  if (act === 'moss') {
    const result = game.seeMoss();
    toast(result.message, true);
    return;
  }
}
function interact(target = null) {
  if (!started || panels.isOpen() || tutorOpen() || riSheetOpen()) return;
  if (!target && mode === 'build') return build();
  target ||= chosenTarget || world.nearestTarget(2.8);
  if(mode!=='remove'&&world.locomotion==='swim'&&world.pool&&(!target||target.type==='pool')){
    chosenTarget=null;world.select(null);world.walkTo({x:POOL.x,z:POOL.entryZ});toast('朝木坡道游，上岸后可以继续走。');return;
  }
  if (!target) { toast(mode === 'remove' ? '先点选自己放的方块，再点取回。' : '走近木料、石料或工坊，就能操作啦。'); return; }
  selectTarget(target);
  const placedModel = Boolean(target.figureId || target.assemblyId);
  if (world.distanceTo(target) > 2.8 && !placedModel && !world.balloon) { world.walkTo(target.position, () => interact(target)); return; }
  if (target.type === 'ball') { world.recallBall(target.id); chosenTarget = null; world.select(null); updateContext(); return; }
  if (mode === 'remove') {
    if (target.type !== 'block') { toast('这些是大家的设施，自己放的方块可以取回。'); return; }
    const result = game.removeBlock(target.id); toast(result.message, result.ok);
    if (result.ok) { chosenTarget = null; world.select(null); world.celebrate(target.position); updateUI(); }
    return;
  }
  if (target.riKind) {
    handleRiTap(target, { game, world, toast, speak, band: riBand(game.state.settings?.ageBand || tutorBand) });
    updateContext();
    return;
  }
  if (target.type === 'resource') {
    const now = performance.now();
    if (now - (cooldowns.get(target.id) || -10000) < 1500) { toast('刚取过啦，材料很快补好。'); return; }
    const result = game.harvest(target.item); toast(result.message, result.ok);
    if (result.ok) { cooldowns.set(target.id, now); world.celebrate(target.position, ITEMS[target.item].color); emitMood('happy'); }
  } else if(target.type==='encounter'){
    const result=game.claimEncounter(target.id);toast(result.message,result.ok);
    chosenTarget=null;world.select(null);if(result.ok){world.celebrate(target.position);emitMood('happy');}updateContext();
  } else if (target.type === 'pool') { world.walkTo({x:POOL.x,z:POOL.z}); toast('从木坡道入水，游向池沿就能上岸。'); }
  else if (target.type === 'bounce') {
    if (world.bounce) { world.stopBounce(); toast('停下来啦。想再跳，再走上小岛。'); }
    else world.walkTo(target.position);
  } else if (target.type === 'story') {
    storyTalk(target);
    return;
  } else if (target.type === 'tutor') {
    openTutor(target.tutorId);
  } else if (target.type === 'ferry') {
    if ((game.state.travel?.current || 'he') !== 'he') goHome();
    else startFerry(target.realmId || 'ri');
  } else if (target.type === 'letter') {
    if (target.id === 'mei-letter') {
      const card = $('mei-letter');
      if (card) card.hidden = false;
      game.seeLetter('letter-mei-1');
    } else if (target.id === 'xing-meteor') {
      const card = $('letter-card');
      const text = $('letter-text');
      if (text) text.textContent = METEOR_LETTER;
      if (card) card.hidden = false;
      game.seeLetter('letter-xing-meteor');
    } else {
      const card = $('letter-card');
      const text = $('letter-text');
      if (text) text.textContent = '纸船上画着一面缺了角的鲤鱼旗。';
      if (card) card.hidden = false;
      game.seeLetter('letter-ri-1');
    }
  } else if (target.type === 'meteor') {
    const card = $('letter-card');
    const text = $('letter-text');
    if (text) text.textContent = METEOR_LETTER;
    if (card) card.hidden = false;
    game.seeLetter('letter-xing-meteor');
  } else if (target.type === 'holo') {
    if (world.beginHolo?.()) toast('光从脚下慢慢亮起来。');
    return;
  } else if (target.type === 'xing') {
    if (target.xing === 'sign') {
      const known = (game.state.travel?.realms?.xing?.glyphs || []).includes(target.glyph);
      toast(known ? `路牌写着：${target.name}。` : '路牌上是还不认识的符号。想认可以再看，不认也能走。');
      return;
    }
    if (target.xing === 'hopper') { toast(game.seeHopper().message, true); return; }
    openXing(target.xing === 'moss' ? 'moss' : 'lab');
  } else if (target.type === 'mei-part') {
    const result = game.collectMeiPart(target.part);
    toast(result.message, result.ok);
    speak(result.speak || result.message);
    world.sync?.(game.state);
    return;
  } else if (target.type === 'maple' || target.type === 'project' || target.type === 'quilt') {
    openPanel(target.type);
  } else if (target.type === 'flag') {
    const result = game.repairKoinobori();
    toast(result.message, result.ok);
    world.sync(game.state);
  } else if (target.type === 'bottle') {
    const result = game.collectKeepsake(target.keepsake);
    toast(result.message, result.ok);
    speak(result.message);
    if (result.ok && !result.already) world.celebrate(target.position);
    chosenTarget = null;
    world.select(null);
    return;
  } else if (target.type === 'vista') {
    if (world.balloon) world.zoomVista(target.vistaId);
    return;
  } else if (target.type === 'balloon') {
    if (world.balloon) {
      if (world.requestBalloonLand()) { toast('好，热气球自己飞回草坪基地。'); speak('热气球飞回草坪基地。'); }
    }
    else world.startBalloon();
  } else if (target.type === 'guide') {
    world.walkTo(BALLOON_BASE);
    toast('顺着小路再往南，就到热气球草场。');
  } else if (target.type === 'park') {
    world.setParkMode(target.park);
    if (!world.bounce) world.walkTo(BOUNCE_ISLAND);
  }
  else if (target.panel) openPanel(target.panel, target.context || {});
  else if (target.type === 'creation') { const message = world.creation.tryOut(target.id) || `${target.name}很开心！`; world.celebrate(target.position); emitMood('happy'); toast(message); speak(message); updateContext(); }
  else if (target.type === 'experiment') { world.releaseBall(); }
  else if (target.type === 'block') {
    if (target.item === 'glyph-plaque') { const hello = '咕咕。小咕向你问好。'; toast(hello); speak(hello); return; }
    toast(`${target.name}，可以接着搭建，也可以点“取回”。`);
  }
}
function build() {
  if (!buildCell) { toast('先点场景选位置，看看预览，再确认放置。'); return; }
  const cell = buildCell, item = selectedItem;
  world.cancelPointerGesture();
  const problem = placementIssue(cell);
  if (problem) { toast(problem); speak(problem); return; }
  if (Math.hypot(cell.x - world.playerPosition.x, cell.z - world.playerPosition.z) > 3.7) {
    toast(`${playerName}走近后放在选好的位置。`);
    world.walkTo(cell, () => { if (mode === 'build' && buildCell === cell && selectedItem === item && !panels.isOpen()) build(); });
    return;
  }
  if (selectedItem === 'ball') {
    if(world.releaseBall(cell)) buildCell = null; updateContext(); return;
  }
  const result = game.placeBlock(selectedItem, { ...cell, rotation });
  toast(result.message, result.ok);
  if (result.ok) { world.celebrate({ x: cell.x, y: cell.y, z: cell.z }, ITEMS[selectedItem].color); emitMood('happy'); buildCell = null; updateUI(); updateContext(); }
}
function placementIssue(cell) {
  if (!game.state.inventory[selectedItem]) return `${ITEMS[selectedItem].name}用完了，换一种材料吧。`;
  if (selectedItem === 'ball') return null;
  const realm = game.state.travel?.current || 'he';
  if (realm === 'he' && world.pool && inPoolReservedArea(cell.x,cell.z,.5)) return '这里是公共泳池和入口，给大家留出空间。';
  if (realm === 'he' && terrainHeight(cell.x, cell.z) < 0) return '这里是小溪，换一块干的草地吧。';
  if (realm === 'he' && inNumberPark(cell.x, cell.z, 0.6)) return `这里是${PARK_NAME}，给蹦床和玩法石留出空间。`;
  if (onBalloonLawn(cell.x, cell.z, 0.4, realm)) return realm === 'he' ? `这里是${BALLOON_NAME}，给热气球和草坪留出空间。` : '这里是热气球草坪，给降落留出空间。';
  const problem = game.placementProblem(selectedItem, { ...cell, rotation });
  if (problem) return problem;
  const footprint = selectedItem === 'roof' ? roofSpan(game.activeBlocks(), cell) : { x: cell.x, z: cell.z, w: 1, d: 1 };
  for (let dx = 0; dx < footprint.w; dx++) for (let dz = 0; dz < footprint.d; dz++) {
    const cx = footprint.x + dx, cz = footprint.z + dz;
    if (Math.abs(cx - world.playerPosition.x) < .7 && Math.abs(cz - world.playerPosition.z) < .7 && cell.y <= world.playerPosition.y + .8) return `这里站着${playerName}，选旁边的空格吧。`;
  }
  return null;
}
function usesTap(target) {
  if (!target) return false;
  if (target.figureId || target.assemblyId || target.type === 'ball') return false;
  if (target.type === 'block' && !target.panel) return false;
  return true;
}
function onTap(pick) {
  if (!started || panels?.isOpen()) return;
  if (pick.target?.type === 'vista' && world?.balloon) {
    world.zoomVista(pick.target.vistaId);
    feel(12);
    return;
  }
  if (mode === 'remove') {
    hideModelMenu();
    if (pick.target?.type === 'block') { approach(pick.target, true); feel(12); return; }
    if (pick.target) { toast('这些是大家的设施，自己放的方块可以取回。'); return; }
    chosenTarget = null; world.select(null); world.walkTo(pick.point);
    return;
  }
  if (pick.target?.figureId || pick.target?.assemblyId) {
    if (mode === 'build') changeMode('gather');
    selectTarget(pick.target);
    showModelMenu(pick.target);
    feel(12);
    return;
  }
  if (pick.target?.type === 'tutor' && mode !== 'build') {
    hideModelMenu();
    approach(pick.target, true);
    feel(12);
    return;
  }
  hideModelMenu();
  if (pick.target?.type === 'ball') { if(mode==='build') changeMode('gather'); approach(pick.target); return; }
  if (mode === 'build') { world.stopWalking(); buildCell = pick.cell; updateContext(); }
  else if (pick.target && usesTap(pick.target)) approach(pick.target, true);
  else if (pick.target) approach(pick.target);
  else { chosenTarget = null; world.select(null); world.walkTo(pick.point); }
}
function onQuickPlace(pick) {
  if (!started || mode !== 'build' || panels?.isOpen()) return;
  onTap(pick); build();
}
function updateUI() {
  if (!$('hotbar').children.length) $('hotbar').innerHTML = hotItems.map((item, i) => `<button class="slot" data-item="${item}"><span class="slot-key">${i + 1}</span><span class="slot-count"></span>${icon(item, 31)}<span class="slot-name">${ITEMS[item].name}</span><span class="slot-selected" aria-hidden="true">✓</span></button>`).join('');
  for (const el of $('hotbar').children) {
    const item = el.dataset.item, count = game.state.inventory[item], selected = selectedItem === item && mode === 'build';
    el.classList.toggle('selected', selected); el.classList.toggle('empty', !count);
    el.setAttribute('aria-label', `选择${ITEMS[item].name}，现有${count}份`);
    el.setAttribute('aria-pressed', String(selected));
    el.querySelector('.slot-count').textContent = count ? `×${count}` : '暂无';
  }
  $('hotbar').hidden = mode !== 'build';
  document.querySelectorAll('[data-mode]').forEach(el => { el.classList.toggle('active', el.dataset.mode === mode); el.setAttribute('aria-pressed', String(el.dataset.mode === mode)); });
  $('sound-button').innerHTML = icon(game.state.settings.sound ? 'sound' : 'mute', 23);
  $('sound-button').setAttribute('aria-label', game.state.settings.sound ? '关闭声音' : '打开声音');
  $('undo-button').disabled = !game.history.length;
  $('rotate-button').disabled = mode !== 'build';
  updateSaveStatus(); updateWish();
}
function updateWish() {
  const count = yardPlankCount(game.state.blocks);
  $('wish-progress').innerHTML = Array.from({ length: 6 }, (_, i) => icon(i < count ? 'check' : 'plank', 18)).join('') + `<span>${Math.min(count, 6)} / 6</span>`;
  if (count >= 6 && !completedWish) {
    completedWish = true;
    $('wish-title').textContent = '小院铺好啦！'; $('wish-description').textContent = '想加一面墙，还是去看看小球？接下来由你决定。';
    if (started) { toast('自己的小院，完成啦！', true); world.celebrate(world.playerPosition); emitMood('happy'); }
  }
  if (count < 6 && completedWish) {
    completedWish = false; $('wish-title').textContent = '铺一块自己的小院'; $('wish-description').textContent = '试着铺 6 格木板。也可以先去逛逛。';
  }
}
function updateContext() {
  if (!world) return;
  if ($('focus-exit')) $('focus-exit').hidden = !world.modelFocus;
  if (chosenTarget && !world.targets.some(t => t.id === chosenTarget.id)) chosenTarget = null;
  const near = world.nearestTarget(2.8, mode === 'remove' ? 'block' : null);
  const target = chosenTarget || near;
  $('placement-controls').hidden = !started || mode !== 'build' || panels?.isOpen();
  if (panels?.isOpen()) hideModelMenu();
  $('action-button').disabled = false;
  document.querySelector('.action-controls').classList.toggle('building', mode === 'build');
  if (mode === 'build') {
    const problem = buildCell ? placementIssue(buildCell) : null;
    const ready = !!buildCell && !problem;
    $('placement-item').textContent = `${ITEMS[selectedItem].name} ×${game.state.inventory[selectedItem]}`;
    const touch = matchMedia('(pointer: coarse)').matches;
    $('placement-status').textContent = problem || (touch
      ? ready ? '按住预览拖动 · 松手放置' : '点场景选位置 · 再拖动预览'
      : ready ? '双击场景直接放置 · R 旋转' : '单击预览 · 双击直接放置');
    $('placement-controls').classList.toggle('invalid', !!problem);
    $('placement-confirm').disabled = !ready;
    $('placement-confirm').textContent = !buildCell ? '先选位置' : problem ? '换个位置' : selectedItem === 'ball' ? '放小球' : '确认放置';
    $('action-button').disabled = !ready;
    $('action-icon').innerHTML = icon(selectedItem === 'ball' ? 'ball' : 'hammer', 30);
    $('action-name').textContent = selectedItem === 'ball' ? '放小球' : '放这里';
    $('context-text').textContent = '电脑双击放置 · 触屏拖动预览松手放置 · 也可以按确认';
    world.setPreview(selectedItem, rotation, buildCell, !problem, game.activeBlocks());
  } else {
    world.setPreview(selectedItem, rotation, null);
    $('action-icon').innerHTML = icon(mode === 'remove' ? 'pickaxe' : target?.item || (target?.type === 'station' ? 'hammer' : 'hand'), 30);
    if (modelMenu && target?.id === modelMenu.id) {
      const label = world.creation.actionLabel(modelMenu.id);
      if (label) target.action = label;
    }
    $('action-name').textContent = mode === 'remove' ? '取回来' : target?.action || '采集';
    const focused = world.modelFocus;
    $('focus-exit').hidden = !focused;
    $('context-text').textContent = mode === 'remove' ? '点自己放的方块，马上拆下来 · 材料完整返还' : focused
      ? `正在靠近看${world.targets.find(t => t.id === focused.id)?.name || ''}。点「退出近看」，或再双击一次。`
      : modelMenu
      ? (world.modelFocus?.id === modelMenu.id ? '再双击，或点退出近看。' : '点旁边的菜单。双击靠近看，再双击或点退出近看。')
      : target?.hint || (matchMedia('(pointer: coarse)').matches ? '点地面走过去，也可以用左下摇杆。' : 'WASD 或点地面走路，拖动画面转视角。');
    if (world.bounce) {
      const look = world.bounceLook() || bounceInfo(world.bounce.count);
      const trampoline = world.targets.find(t => t.id === 'bounce-island');
      if (trampoline) trampoline.action = '停下来';
      $('action-name').textContent = '停下来';
      $('action-icon').innerHTML = icon('jump', 30);
      const title = playMode(look.mode).title;
      $('context-text').textContent = `${PARK_NAME} · ${title} · ${look.n ? `${look.count} · ${look.word}` : look.note}。点停下来才停止。`;
    } else if(world.locomotion==='swim'){
      $('context-text').textContent='游泳中 · 摇杆划水 · 游向池沿，或点上岸';
      if(mode!=='remove'&&world.pool&&(!target||target.type==='pool')){$('action-name').textContent='上岸';$('action-icon').innerHTML=icon('footsteps',30);}
    }
    else if(world.locomotion==='wade') $('context-text').textContent='浅水里慢慢走 · 水深了才需要游泳';
    if (world.balloon) {
      const look = world.balloonLook();
      const craft = world.targets.find(t => t.id === 'balloon-craft' || t.id === 'balloon-base');
      if (craft) craft.action = look.landing ? '正在降落' : '降落到草坪基地';
      $('action-name').textContent = look.landing ? '正在降落' : '降落到草坪基地';
      $('action-icon').innerHTML = icon('balloon', 30);
      $('context-text').textContent = look.landing
        ? `${look.title} · ${look.note}`
        : `${look.title} · ${look.note} · 摇杆开热气球，升高降低看远近。`;
    }
  }
  const tutorNear = world.targets.find((item) => item.type === 'tutor' && world.distanceTo(item) <= (item.reach || 2.7));
  const storyOpen = ['story-talk', 'story-home', 'letter-card', 'mei-letter'].some((id) => {
    const card = $(id);
    return card && !card.hidden;
  });
  if (tutorNear && !tutorGreeted.has(tutorNear.id) && !tutorOpen() && !panels?.isOpen() && !storyOpen) {
    tutorGreeted.add(tutorNear.id);
    toast(tutorNear.hello || `${tutorNear.name}在等你。`);
    speak(tutorNear.hello || `${tutorNear.name}在等你。`);
  }
  const p = world.playerPosition;
  const realmNow = game.state.travel?.current || 'he';
  let place = '';
  if (realmNow === 'ri') place = '日谷';
  else if (realmNow === 'mei') place = '美谷';
  else if (realmNow === 'xing') place = world.balloon?.phase === 'voyage' ? '飞回河谷' : world.balloon ? '外星谷的热气球' : '外星谷';
  else if (world.balloon?.phase === 'voyage') {
    const id = world.balloon.realmId;
    place = id === 'xing' ? '飞向星星' : id === 'mei' ? '看风景去美谷' : '看风景去日谷';
  } else if (world.balloon) place = world.balloonLook().landing ? '飞回草坪基地' : '热气球上看河谷';
  else if (tutorNear) place = `${tutorNear.name}的${tutorNear.place || '身边'}`;
  else place = onBalloonLawn(p.x, p.z, 1.2) || p.z > 16 ? BALLOON_NAME : inNumberPark(p.x, p.z, 1.2) ? PARK_NAME : p.x > 5 ? (p.z < 0 ? '溪边球道' : '豆苗的东岸') : p.z < -2 ? '林间小工坊' : '河谷小院';
  $('location-name').textContent = place;
  paintTravel();
  const clock=realMoment();
  const hh=String(clock.hour).padStart(2,'0'),mm=String(clock.minute).padStart(2,'0');
  $('clock-label').textContent=`${clock.period} ${hh}:${mm} · ${clock.season}`;
  $('clock-drawing').innerHTML=realAnalogClock(54);
  $('life-button').setAttribute('aria-label',`现在${clock.dateLabel}${clock.season}，${clock.weather.label}，${clock.period}，看季节与植物`);
  const riding = Boolean(world.balloon && $('balloon-hud') && !$('balloon-hud').hidden);
  $('action-button').hidden = riding;
  const hint = $('context-text').textContent || '';
  const specific = Boolean(target?.hint) || Boolean(world.modelFocus) || Boolean(modelMenu) || mode === 'remove' || world.locomotion === 'swim' || Boolean(world.bounce);
  $('context-hint').hidden = !started || !!panels?.isOpen() || riding || !specific || /摇杆|点材料|双击放置|拖动预览/.test(hint);
  updateLandGuidance();
  layoutOverlays();
}
function commitLook() {
  const draft = normalizeLook(game.state.look);
  const typed = $('look-name')?.value ?? draft.name;
  draft.name = String(typed || '').replace(/\s+/g, '').slice(0, 8);
  draft.ready = true;
  game.state.look = draft;
  refreshPlayerName();
  world?.applyLook?.(draft);
}
function start() {
  if (!world) return;
  commitLook();
  started = true; $('welcome').hidden = true; $('look-dialog').hidden = true; resetInput(); save();
  storyEnter();
  toast(touring ? '体验模式。右上角可以跳到下一章。孩子的存档不会被改。' : '去逛逛吧！左边摇杆走路，点材料，再点右边采集。');
  speak(touring ? '雾慢慢进来了。它不会伤害任何东西。' : '欢迎来到河谷。想去哪里，由你决定。');
  updateContext();
  if (game.storageError) toast(game.storageError);
}

async function bootValley() {
  await loadTutorPack();
  try {
  const saved = game.state.travel?.current;
  const savedRealm = REALMS[saved]?.playable && saved !== 'he' ? saved : 'he';
  await mountWorld(savedRealm);
  panels = createPanels({
    game, icon, toast, speak, onSelect: selectItem, onReclaim: reclaimNearby, onPlaceFigure: placeFigureNearby,
    onTravelHome: () => { panels?.close?.(); goHome(); },
    onAge: (ageBand) => { if (!tutorOpen()) tutorBand = ageBand || 'little'; },
    onChanged: () => { world?.sync(game.state); updateUI(); },
    onClose: (told) => { panelType = null; resetInput(); save(); updateContext(); if (told) toast('收起来了'); },
    onLook: () => openLookDialog(),
    onWalkShard: (realm) => {
      const pos = world?.playerPosition;
      const near = nearestShard(game.state.travel, pos ? { x: pos.x, z: pos.z } : null);
      const id = realm || near?.id || 'ri';
      const spot = id === 'xing' ? BALLOON_BASE : { x: 4, z: 14 };
      world?.walkTo?.(spot);
      const item = id === 'xing' ? '星之片' : id === 'mei' ? '光之片' : '潮之片';
      toast(id === 'xing' ? `去南边坐热气球，找${item}。` : `去渡口坐船，找${item}。`);
    },
  });
  game.subscribe(() => {
    if (switching || !world || world.released) return;
    if ((world.realmId || 'he') !== (game.state.travel?.current || 'he')) return;
    if (world.state !== game.state) { chosenTarget = null; buildCell = null; dismissedFrontiers.clear(); world.select(null); }
    world.sync(game.state); updateUI();
    if (panelType === 'garden' || panelType === 'life' || panelType === 'washi' || panelType === 'maple' || panelType === 'project' || panelType === 'quilt') panels.refresh();
    if (xingSheet === 'crystal') paintCrystalSheet();
    else if (panelType === 'kiln') panels.touchKiln();
  });
  if (game.state.stats.built || game.state.stats.gathered || game.state.stats.crafted) $('start-button').innerHTML = `继续我的河谷 ${icon('arrow-right', 22)}`;
  holoUi = mountHoloUi({
    game, speak, toast, world: () => world,
    band: () => game.state.settings?.ageBand || tutorBand || null,
    tour: () => touring,
    onPaint: paintHoloChrome,
  });
  updateUI(); updateContext();
  const boot = $('boot-screen');
  if (boot) boot.hidden = true;
  } catch (error) {
    console.error('河谷启动失败', error);
    $('webgl-fallback').hidden = false; $('welcome').hidden = true;
    const boot = $('boot-screen');
    if (boot) boot.hidden = true;
  }
}
bootValley();

$('start-button').addEventListener('click', start);
$('welcome-help').addEventListener('click', () => openPanel('help'));
$('help-button').addEventListener('click', () => openPanel('help'));
$('life-button').addEventListener('click',()=>openPanel('life'));
$('land-button').addEventListener('click',()=>openPanel('land'));
$('land-question-open').addEventListener('click',()=>{
  const id=$('land-question').dataset.chunk,candidate=nearbyFrontiers(game.state.land,world.playerPosition).find(p=>p.id===id);
  if(!candidate||panels.isOpen()||mode!=='gather'){updateContext();return;}
  const result=reclaimNearby(candidate.cx,candidate.cz);toast(result.message,result.ok);
});
$('land-question-skip').addEventListener('click',()=>{
  for(const p of nearbyFrontiers(game.state.land,world.playerPosition))dismissedFrontiers.add(p.id);
  resetInput();updateContext();
});
$('pause-button').addEventListener('click', () => openPanel('pause'));
$('craft-button').addEventListener('click', () => openPanel('craft'));
$('inventory-button').addEventListener('click', () => openPanel('inventory'));
$('sound-button').addEventListener('click', () => { game.mutate(s => { s.settings.sound = !s.settings.sound; }); setRiSound(game.state.settings.sound); if (!game.state.settings.sound) { clearTimeout(speechTimer); stopVoice(); window.speechSynthesis?.cancel(); } else speak('声音打开了。点喇叭可以听说明。'); });
function setFold(card, button, folded) {
  if (!card || !button) return;
  card.classList.toggle('is-folded', folded);
  button.setAttribute('aria-expanded', String(!folded));
  layoutOverlays();
}
$('wish-toggle')?.addEventListener('click', () => setFold($('wish-card'), $('wish-toggle'), !$('wish-card').classList.contains('is-folded')));
$('map-toggle')?.addEventListener('click', () => setFold(document.querySelector('.minimap-card'), $('map-toggle'), !document.querySelector('.minimap-card')?.classList.contains('is-folded')));
$('wish-dismiss').addEventListener('click', () => setFold($('wish-card'), $('wish-toggle'), true));
$('wish-read').addEventListener('click', () => speak(`${$('wish-title').textContent}。${$('wish-description').textContent}`));
$('action-button').addEventListener('click', () => interact());
$('focus-exit').addEventListener('click', () => {
  if (!world?.modelFocus) return;
  world.toggleModelFocus(null);
  feel(8);
});
$('model-menu').addEventListener('dblclick', event => {
  if (event.target.closest('button') || !modelMenu) return;
  const target = world.targets.find(t => t.id === modelMenu.id);
  if (target) world.toggleModelFocus({ target });
});
$('model-menu-act').addEventListener('click', () => actFromMenu());
$('model-menu-edit').addEventListener('click', () => editFromMenu());
$('model-menu-recall').addEventListener('click', () => recallFromMenu());
$('placement-confirm').addEventListener('click', () => { if (started && !panels.isOpen() && mode === 'build') build(); });
$('placement-cancel').addEventListener('click', () => changeMode('gather'));
$('jump-button').addEventListener('click', () => { if (started && !panels.isOpen()) world.jump(); });
$('bounce-stop').addEventListener('click', () => { if (started) world.stopBounce(); });
$('travel-home')?.addEventListener('click', () => { if (started && !startReturnJourney()) goHome(); });
$('travel-go')?.addEventListener('click', () => { if (started && !panels?.isOpen()) startFerry(); });
$('travel-skip')?.addEventListener('click', () => {
  if (scenicKind()) finishCutscene();
  else if (world?.balloon?.phase === 'voyage') { hideCutscene(); world.completeVoyage(); }
});
$('letter-close')?.addEventListener('click', () => { const card = $('letter-card'); if (card) card.hidden = true; });
$('ri-washi')?.addEventListener('click', () => {
  if (!started || (game.state.travel?.current || 'he') !== 'ri') return;
  const site = { x: -8, z: -6 };
  const begin = () => { const result = game.startWashi(); toast(result.message, result.ok); openPanel('washi'); };
  if (Math.hypot(world.playerPosition.x - site.x, world.playerPosition.z - site.z) > 3.4) world.walkTo(site, begin);
  else begin();
});
$('ri-claim')?.addEventListener('click', () => { const result = game.claimWashi(); toast(result.message, result.ok); paintTravel(); });
$('ri-crane')?.addEventListener('click', () => {
  const result = game.craft([['washi']], 'paper-crane');
  toast(result.message, result.ok);
  if (!result.ok) openPanel('fold');
});
$('ri-stamps')?.addEventListener('click', () => openPanel('stamps'));
$('ri-flag')?.addEventListener('click', () => {
  const result = game.repairKoinobori();
  toast(result.message, result.ok);
  world?.sync(game.state);
});
$('balloon-voyage')?.addEventListener('click', () => { startBalloonJourney('ri'); });
$('balloon-stars')?.addEventListener('click', () => {
  if (!XING_OPEN) return;
  startBalloonJourney('xing');
});
$('balloon-return')?.addEventListener('click', () => {
  if (!started || (game.state.travel?.current || 'he') !== 'xing') return;
  if (!world.balloon) { pendingHomeFlight = true; world.startBalloon(); return; }
  if (world.balloon.phase === 'lift') { pendingHomeFlight = true; return; }
  if (world.balloon.phase === 'tour' && world.startVoyage('he')) beginStarReturn();
});
$('star-skip')?.addEventListener('click', () => { if (scenicKind()) finishCutscene(); });
$('xing-lab')?.addEventListener('click', () => { if (started) openXing('lab'); });
$('xing-crystal')?.addEventListener('click', () => { if (started) openXing('crystal'); });
$('xing-gugu')?.addEventListener('click', () => { if (started) openXing('gugu'); });
$('xing-case')?.addEventListener('click', () => {
  if (!started) return;
  const result = game.craft([['glowmoss', 'glass-dome']], 'glowmoss-case');
  toast(result.message, result.ok);
});
$('xing-stamps')?.addEventListener('click', () => openPanel('stamps'));
$('xing-sheet')?.addEventListener('click', handleXingSheet);
$('balloon-voyage-mei')?.addEventListener('click', () => {
  if (!REALMS.mei?.playable) return;
  startBalloonJourney('mei');
});
$('travel-go-mei')?.addEventListener('click', () => { if (started && !panels?.isOpen()) startFerry('mei'); });
$('mei-letter-close')?.addEventListener('click', () => { const card = $('mei-letter'); if (card) card.hidden = true; });
for (const [id, panel] of [['mei-maple', 'maple'], ['mei-project', 'project'], ['mei-quilt', 'quilt'], ['mei-trade', 'trade'], ['mei-lantern', 'lantern'], ['mei-thanks', 'thanks'], ['mei-stage', 'stage'], ['mei-projector', 'projector'], ['mei-premiere', 'premiere']]) {
  $(id)?.addEventListener('click', () => { if (started && (game.state.travel?.current || 'he') === 'mei') openPanel(panel); });
}
$('mei-stamps')?.addEventListener('click', () => { if (started) openPanel('stamps'); });
$('balloon-land')?.addEventListener('click', () => {
  if (!started || !world) return;
  const ride = journeyDirector.status();
  if (ride.active && ride.via === 'balloon') {
    if (!ride.canLand || !journeyDirector.land()) return;
    balloonPanelOpen = false;
    paintJourneyChip();
    toast('好，快要到了。');
    return;
  }
  if (world.balloon?.phase === 'voyage') {
    if (!world.landFromVoyage()) return;
    balloonPanelOpen = false;
    showBalloon(world.balloonLook());
    toast('好，掉头飞回草坪。');
    return;
  }
  if (!world.requestBalloonLand()) return;
  toast('好，热气球自己飞回草坪基地。');
});
$('balloon-chip')?.addEventListener('click', () => {
  const ride = journeyDirector.status();
  const scenic = ride.active && ride.via === 'balloon';
  if (!started || (!scenic && world?.balloon?.phase !== 'voyage')) return;
  balloonPanelOpen = !balloonPanelOpen;
  if (world?.balloonLook && world.balloon) showBalloon(world.balloonLook());
  paintJourneyChip();
});
$('balloon-reroute')?.addEventListener('click', () => {
  const ride = journeyDirector.status();
  if (ride.active && ride.via === 'balloon') {
    const next = nextDivertRealm(ride.destination);
    if (!ride.canDivert || !next) return;
    balloonPanelOpen = false;
    if (!journeyDirector.divert(next)) return;
    if (world?.balloonLook && world.balloon) showBalloon(world.balloonLook());
    paintJourneyChip();
    toast(`改去${journeyDirector.status().destinationName}。`);
    return;
  }
  if (!started || !world?.rerouteVoyage()) return;
  balloonPanelOpen = false;
  showBalloon(world.balloonLook());
  toast('可以改去日谷、美谷，或者飞向星星。');
});
$('vista-map-button')?.addEventListener('click', () => { if (started) openPanel('vista'); });
$('vista-look')?.addEventListener('click', () => { if (started && world?.vistaGlance) world.zoomVista(world.vistaGlance.id); });
$('vista-arrow')?.addEventListener('click', () => { if (started && world?.vistaGlance) world.zoomVista(world.vistaGlance.id); });
$('vista-skip')?.addEventListener('click', () => { if (started) world?.skipVistaZoom(); });
$('vista-later')?.addEventListener('click', () => { if (started) world?.dismissVista(); });
$('balloon-hud')?.addEventListener('click', event => {
  const picked = event.target.closest('[data-balloon-mode]')?.dataset.balloonMode;
  if (!started || !world?.balloon || !picked) return;
  world.setBalloonMode(picked);
  balloonDriveOpen = picked === 'steer';
  showBalloon(world.balloonLook());
  toast(picked === 'steer' ? '自己开啦。摇杆前后左右飞。' : '转一圈看河谷。');
});
function holdBalloonClimb(value) {
  return event => {
    event.preventDefault();
    if (!started || !world?.balloon) return;
    world.setBalloonClimb(event.type === 'pointerup' || event.type === 'pointercancel' ? 0 : value);
  };
}
for (const [id, value] of [['balloon-up', 1], ['balloon-down', -1]]) {
  const btn = $(id);
  if (!btn) continue;
  for (const name of ['pointerdown', 'pointerup', 'pointercancel']) btn.addEventListener(name, holdBalloonClimb(value));
}
$('bounce-hud')?.addEventListener('click', event => {
  if (!started || !world) return;
  const park = event.target.closest('[data-park]')?.dataset.park;
  const skip = event.target.closest('[data-skip]')?.dataset.skip;
  const table = event.target.closest('[data-table]')?.dataset.table;
  if (park) {
    if (!unlockedParkModes(game.state.settings?.ageBand).includes(park)) return;
    world.setParkMode(park);
  }
  else if (skip) world.setParkMode('skip', { step: Number(skip) });
  else if (table) world.setParkMode('times', { table: Number(table) });
});
$('rotate-button').addEventListener('click', () => { rotation = (rotation + 1) % 4; updateContext(); toast('转好了，再看看方向。'); });
$('undo-button').addEventListener('click', () => { const result = game.undo(); toast(result.message, result.ok); updateUI(); });
$('hotbar').addEventListener('click', e => { const item = e.target.closest('[data-item]')?.dataset.item; if (item) selectItem(item); });
document.querySelectorAll('[data-mode]').forEach(el => el.addEventListener('click', () => changeMode(el.dataset.mode)));

const pad = $('joystick'), knob = pad.querySelector('.joystick-knob'); let padPointer = null;
function padMove(e) {
  if (e.pointerId !== padPointer || !started || panels.isOpen()) return;
  const r = pad.getBoundingClientRect(), dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
  const d = Math.hypot(dx, dy), limit = 36, scale = d > limit ? limit / d : 1;
  joystick.x = dx * scale / limit; joystick.z = dy * scale / limit;
  knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
  world.cancelPointerGesture();
  chosenTarget = null; buildCell = null; world.select(null);
}
pad.addEventListener('pointerdown', e => { if (!started || panels.isOpen()) return; e.preventDefault(); padPointer = e.pointerId; pad.setPointerCapture(e.pointerId); padMove(e); });
pad.addEventListener('pointermove', padMove);
for (const event of ['pointerup', 'pointercancel']) pad.addEventListener(event, e => { if (e.pointerId === padPointer) { padPointer = null; joystick.x = joystick.z = 0; knob.style.transform = ''; } });
document.addEventListener('keydown', e => {
  if (e.defaultPrevented || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || !started || panels?.isOpen()) return;
  const key = e.key.toLowerCase();
  if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' '].includes(key)) e.preventDefault();
  if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)) { keys.add(key); chosenTarget = null; buildCell = null; world.select(null); world.cancelPointerGesture(); }
  if (e.repeat) return;
  if (key === ' ') world.jump();
  else if (key === 'e') interact();
  else if (key === 'b') openPanel('craft');
  else if (key === 'i') openPanel('inventory');
  else if (key === 'r' && mode === 'build') { rotation = (rotation + 1) % 4; updateContext(); }
  else if (key === 'enter' && mode === 'build' && (!e.target.closest('button') || e.target.closest('.slot'))) { e.preventDefault(); build(); }
  else if (key === 'escape') { if (mode === 'build') changeMode('gather'); else openPanel('pause'); }
  else if (/^[1-6]$/.test(key)) selectItem(hotItems[Number(key) - 1]);
});
document.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => { resetInput(); if (started) save(); });
document.addEventListener('visibilitychange', () => { resetInput(); lastFrame = performance.now(); if (started) save(); if(world)updateContext(); if (!document.hidden) refreshAccount(); });
document.addEventListener('valley-account', () => refreshAccount());

function currentLookDraft() {
  const look = normalizeLook({ ...game.state.look, ready: game.state.look?.ready });
  const typed = $('look-name');
  if (typed) look.name = String(typed.value || '').replace(/\s+/g, '').slice(0, 8);
  return look;
}
let previewMoodAt = -1;
function paintLookMood(name) {
  const stage = $('look-avatar');
  const mood = MOOD_LABELS[name] ? name : 'idle';
  if (stage) stage.dataset.mood = mood;
  const svg = stage?.querySelector('.av');
  if (svg) {
    for (const item of [...svg.classList]) if (item.startsWith('mood-')) svg.classList.remove(item);
    svg.classList.add(`mood-${mood}`);
    svg.setAttribute('aria-label', MOOD_LABELS[mood]);
  }
  const hint = document.querySelector('.look-mood-hint');
  if (hint) hint.textContent = mood === 'idle' ? '点一下，看表情' : MOOD_LABELS[mood];
}
function showLookMood(name) {
  const mood = MOOD_LABELS[name] ? name : 'idle';
  paintLookMood(mood);
  clearTimeout(showLookMood.timer);
  if (mood !== 'idle') showLookMood.timer = setTimeout(() => paintLookMood('idle'), 2400);
}
function paintLookStage() {
  const stage = $('look-avatar');
  if (!stage) return;
  const look = currentLookDraft();
  stage.dataset.shape = look.shape;
  stage.dataset.hat = look.hat;
  const mood = stage.dataset.mood || 'idle';
  const key = `${look.shape}|${look.color}|${look.hat}`;
  if (stage.dataset.key !== key || !stage.querySelector('.av')) {
    stage.dataset.key = key;
    stage.innerHTML = lookMarkup({ shape: look.shape, color: lookColor(look), hat: look.hat, mood });
  }
  if (world) world.applyLook(look);
}
function chooseLook(patch) {
  const next = { ...currentLookDraft(), ...patch };
  game.state.look = normalizeLook(next);
  const input = $('look-name');
  if (input && patch.name != null) input.value = next.name;
  paintLookStage();
  if (patch.name) speak(patch.name);
  else speak(LOOK_SHAPES.find((item) => item.id === next.shape)?.label || LOOK_COLORS.find((item) => item.id === next.color)?.label || '换好了');
}
function fillLookRow(id, items, key, onPick) {
  const row = $(id);
  if (!row || row.dataset.ready) return;
  row.dataset.ready = '1';
  for (const item of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'look-choice';
    button.textContent = item.label || item.name;
    button.addEventListener('click', () => onPick(item));
    row.append(button);
  }
}
function mountLook() {
  const maker = $('look-maker');
  if (!maker) return;
  if (game.state.look?.ready) maker.hidden = true;
  const input = $('look-name');
  if (input) {
    input.value = game.state.look?.name || '';
    input.addEventListener('input', () => {
      game.state.look = { ...currentLookDraft(), name: input.value.replace(/\s+/g, '').slice(0, 8) };
      paintLookStage();
    });
  }
  fillLookRow('look-names', NAME_PRESETS, 'name', (item) => chooseLook({ name: item.name }));
  fillLookRow('look-shapes', LOOK_SHAPES, 'shape', (item) => chooseLook({ shape: item.id }));
  fillLookRow('look-colors', LOOK_COLORS, 'color', (item) => chooseLook({ color: item.id }));
  fillLookRow('look-hats', LOOK_HATS, 'hat', (item) => chooseLook({ hat: item.id }));
  $('look-heart')?.addEventListener('click', () => {
    const name = currentLookDraft().name || GUEST_PLAYER_NAME;
    emitMood('happy');
    speak(`${name}，就这个。`);
  });
  $('look-stage')?.addEventListener('click', (event) => {
    if (event.target.closest('button, input')) return;
    previewMoodAt = (previewMoodAt + 1) % PREVIEW_MOODS.length;
    emitMood(PREVIEW_MOODS[previewMoodAt], { seconds: 2.4 });
  });
  document.addEventListener('pointermove', (event) => {
    const root = $('look-avatar');
    const svg = root?.querySelector('.av');
    if (!svg || svg.classList.contains('mood-yawn') || root.closest('[hidden]')) return;
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return;
    const shift = pupilShift(event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2));
    const bias = svg.classList.contains('mood-curious') ? -1.1 : 0;
    svg.querySelectorAll('.pupil').forEach((node) => {
      node.setAttribute('transform', `translate(${shift.x.toFixed(2)} ${(shift.y + bias).toFixed(2)})`);
    });
  });
  window.addEventListener('valley-mood', (event) => {
    const detail = event.detail || {};
    const applied = world ? world.setMood?.(detail.name, detail) : true;
    if (applied !== false) showLookMood(detail.name);
  });
  setInterval(() => {
    const root = $('look-avatar');
    const svg = root?.querySelector('.av');
    if (!svg || svg.classList.contains('mood-yawn') || root.closest('[hidden]')) return;
    if (Math.random() > 0.2) return;
    svg.querySelectorAll('.lid').forEach((lid) => {
      lid.classList.remove('blink');
      try { void lid.getBBox(); } catch { /* not painted yet */ }
      lid.classList.add('blink');
      setTimeout(() => lid.classList.remove('blink'), 200);
    });
  }, 520);
  $('look-dialog-close')?.addEventListener('click', () => {
    commitLook();
    $('look-dialog').hidden = true;
    save();
    toast('样子记住了。');
  });
  $('minimap')?.addEventListener('click', (event) => {
    if (!started || !world || panels?.isOpen()) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const bounds = landBounds(world.state?.land);
    const x = (event.clientX - rect.left) / rect.width;
    const z = (event.clientY - rect.top) / rect.height;
    world.walkTo({
      x: bounds.minX + x * (bounds.maxX - bounds.minX),
      z: bounds.minZ + z * (bounds.maxZ - bounds.minZ),
    });
  });
  paintLookStage();
}
function openLookDialog() {
  const maker = $('look-maker');
  const dialog = $('look-dialog');
  const body = $('look-dialog-body');
  if (!maker || !dialog || !body) return;
  maker.hidden = false;
  body.append(maker);
  dialog.hidden = false;
  paintLookStage();
}
mountLook();
setPlayerName(null);
refreshAccount();
window.addEventListener('pagehide', () => {
  try { if (sessionStorage.getItem('xing-inject')) return; } catch { /* still save */ }
  if (started) save();
});

function frame(now) {
  const elapsed = Math.max(0, Math.min((now - lastFrame) / 1000, 2));
  const dt = Math.min(elapsed, .05); lastFrame = now;
  if (world && !document.hidden && !switching) {
    const input = { x: joystick.x + (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0), z: joystick.z + (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0) };
    const holding = scenicKind();
    const sheet = riSheetOpen();
    setRiSound(game.state.settings.sound);
    if (holding) world.holdPaint = true;
    world.update(dt, sheet ? { x: 0, z: 0 } : input, !started || panels.isOpen() || holding); storePlayer();
    tickScenic(dt);
    paintVistaHud();
    if (started && panelType !== 'pause') game.tick(elapsed);
    uiTime += dt; savedTime += dt;
    placeModelMenu();
    if (uiTime > .15) { uiTime = 0; updateContext(); }
    if (started && savedTime > 4) { savedTime = 0; save(); }
  }
  requestAnimationFrame(frame);
}
bindOverlayLayout();
requestAnimationFrame(frame);

// The browser checks inspect state and exercise the same actions used by the UI.
window.__valley = { game, toast, get world() { return world; }, get panels() { return panels; }, get story() { return storyApi(); }, touring, start, openPanel, selectItem, changeMode, interact, goHome, goRealm, goXing, openXing, closeXing, startFerry, journey: journeyApi, sceneStats, missingAudio: () => [...missingAudio], voiceReady, playerName: () => playerName, setBuildCell: cell => { buildCell = cell; updateContext(); }, gravityCompare, advanceCrystal: (seconds, flags = {}) => { if (flags?.paused || flags?.hidden) return game.crystalStatus(); game.tick(seconds); return game.crystalStatus(); }, setAge: (band) => { const known = ['little', 'bigger', 'older', 'junior', 'senior']; tutorBand = known.includes(band) ? band : 'little'; }, step(dt = 0.05) { if (!world || world.released || switching) return { realm: game.state.travel?.current || 'he', phase: null, holo: null }; const holding = scenicKind(); if (holding) world.holdPaint = true; world.update(dt, { x: 0, z: 0 }, holding); tickScenic(dt); paintTravel(); return { realm: game.state.travel?.current || 'he', phase: world.balloon?.phase || null, cutscene: cutscene?.kind || null, holo: world.holo?.phase || null, journey: journeyDirector.status() }; }, enterHolo() { return world?.beginHolo?.() || false; }, skipHolo() { return world?.skipHolo?.() || false; }, leaveHolo() { return world?.leaveHolo?.() || false; }, holoPhase() { return world?.holo?.phase || 'off'; }, openHoloStage(id) { holoUi?.openStage(id); }, peekStage() { return holoUi?.peek?.() || null; }, setNight(value) { if (world) world.nightOverride = value; if (world) world.vistaMomentOverride = value ? { period: '晚上' } : null; }, sampleStats() { return world?.sampleStats?.() || null; }, quality() { return world?.qualityMode || game.state.settings?.quality || null; } };
window.render_game_to_text = () => JSON.stringify({
  coords: 'world x/east, y/up, z/south; integer building grid',
  started, mode, selectedItem, rotation, buildCell, panel: panels?.type() ?? null,
  workshop: panels?.workshop()?.session.snapshot() ?? null,
  axle: panels?.axle()?.session.snapshot() ?? null,
  creation: { ...panels?.studio()?.snapshot(), engine: game.state.creation.settings.engine, drafts: game.state.creation.drafts.length, blueprints: game.state.creation.blueprints.map(b => b.id), parts: game.state.creation.parts.length, assemblies: game.state.creation.assemblies.map(a => ({ id: a.id, status: a.status, world: a.world })), figures: game.state.creation.figures.map(f => ({ id: f.id, name: f.figure.name, placed: f.placed })), inWorld: world?.creation.snapshot() ?? [], modelFocus: world?.modelFocus?.id ?? null },
  player: game.state.player, inventory: game.state.inventory, blocks: game.state.blocks.length,
  balls: world?.serializeBalls(),
  locomotion: world?.locomotion,
  balloon: world?.balloon ? { phase: world.balloon.phase, angle: world.balloon.angle, height: world.balloon.height } : null,
  vista: { discovered: game.state.travel?.discovered || null, keepsakes: game.state.travel?.keepsakes || [], glance: world?.vistaGlance?.phase || null, id: world?.vistaGlance?.id || null, clarity: world?.vistaView?.clarity ?? null, opacity: world?.vistaView?.opacity ?? null, signals: world?.vistaView?.signals || null },
  clock:game.state.clock,season:realMoment(),
  flora:game.state.flora.map(p=>({...p,stage:floraStage(p,game.state.clock)})),
  land:game.state.land,
  landHint:landHint?{id:landHint.id,direction:landHint.direction,distance:landHint.distance}:null,
});
window.advanceTime = ms => new Promise(resolve => {
  const start = performance.now();
  function wait(now) { if(now-start>=ms) resolve(); else requestAnimationFrame(wait); }
  requestAnimationFrame(wait);
});
