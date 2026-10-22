/** Tablet tour: prologue through the finale, with no stacked panels, voices, or /api calls. */

import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const base = process.env.PREVIEW_URL || process.env.GAME_TEST_URL || 'http://127.0.0.1:4173/3dplay/';
const staticMode = process.env.PREVIEW_MODE !== 'live';
const shots = '/opt/cursor/artifacts';
await mkdir(shots, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const passed = [];

function check(name, value) {
  assert.ok(value, name);
  passed.push(name);
  console.log(`✓ ${name}`);
}

function overlaps(a, b) {
  if (!a || !b || a.width < 2 || b.width < 2 || a.height < 2 || b.height < 2) return false;
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1, hasTouch: true });
page.setDefaultTimeout(20000);
const errors = [];
const api = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => { if (request.url().includes('/api') || request.url().includes('/account')) api.push(request.url()); });
await page.addInitScript(() => {
  window.__voice = { plays: [], synths: 0, audios: [] };
  const play = Audio.prototype.play;
  Audio.prototype.play = function playTracked() {
    window.__voice.plays.push(this.currentSrc || this.src || '');
    if (!window.__voice.audios.includes(this)) window.__voice.audios.push(this);
    return play.apply(this, arguments);
  };
  const synth = window.speechSynthesis;
  if (synth) {
    synth.speak = () => { window.__voice.synths += 1; };
    synth.cancel = () => {};
  }
});

async function pump(seconds) {
  const steps = Math.ceil(seconds / 0.05);
  await page.evaluate((count) => {
    for (let i = 0; i < count; i += 1) __valley.step(0.05);
  }, steps);
}

async function stand(x, z) {
  await page.evaluate(({ x, z }) => {
    const world = __valley.world;
    world.stopWalking();
    world.playerPosition.set(x, world.surfaceAt?.(x, z) ?? 0, z);
    world.positionLabels?.();
  }, { x, z });
}

async function waitRealm(realm) {
  await page.waitForFunction((id) => __valley.game.state.travel.current === id && __valley.world?.realmId === id, realm);
}

async function skipIfShown(selector) {
  const button = page.locator(selector);
  if (await button.isVisible().catch(() => false)) await button.click();
}

async function dismissVista() {
  if (await page.locator('#vista-later').isVisible().catch(() => false)) await page.locator('#vista-later').click();
  if (await page.locator('#vista-skip').isVisible().catch(() => false)) await page.locator('#vista-skip').click();
}

async function finishScenic(realm, skip = '#travel-skip') {
  for (let i = 0; i < 50; i += 1) {
    const there = await page.evaluate((id) => __valley.game.state.travel.current === id && __valley.world?.realmId === id, realm);
    if (there) return;
    await skipIfShown(skip);
    await pump(0.15);
  }
  await waitRealm(realm);
}

async function layout(label) {
  await page.evaluate(() => { for (let i = 0; i < 4; i += 1) __valley.step(0.05); });
  const scene = await page.evaluate(() => {
    const ids = ['balloon-hud', 'bounce-hud', 'land-question', 'tour-guide', 'story-banner', 'story-talk', 'story-home', 'vista-card', 'tutor-card', 'context-hint', 'letter-card', 'mei-letter', 'travel-cutscene', 'holo-transition', 'star-cutscene', 'xing-sheet', 'holo-panel', 'ri-sheet', 'vista-stamp', 'focus-exit', 'story-festival', 'overlay-more', 'ri-actions', 'mei-actions', 'xing-actions', 'holo-bar'];
    const boxes = {};
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el || el.hidden || el.classList.contains('overlay-parked')) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      boxes[id] = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }
    const dock = document.querySelector('.bottom-dock')?.getBoundingClientRect();
    return {
      boxes,
      dock: dock ? { x: dock.x, y: dock.y, width: dock.width, height: dock.height } : null,
      chapter: __valley.game.state.travel?.story ? (document.getElementById('tour-guide-text')?.textContent || '') : '',
    };
  });
  const names = Object.keys(scene.boxes);
  let clear = true;
  for (let i = 0; i < names.length; i += 1) {
    for (let j = i + 1; j < names.length; j += 1) {
      if (overlaps(scene.boxes[names[i]], scene.boxes[names[j]])) {
        clear = false;
        console.log('OVERLAP', label, names[i], scene.boxes[names[i]], names[j], scene.boxes[names[j]]);
      }
    }
    if (scene.dock && overlaps(scene.boxes[names[i]], scene.dock)) {
      clear = false;
      console.log('DOCK', label, names[i], scene.boxes[names[i]], scene.dock);
    }
  }
  check(`${label} 浮层不互相遮挡也不挡工具栏`, clear);
  return scene;
}

async function voiceNow() {
  return page.evaluate(() => {
    const playing = window.__voice.audios.filter((audio) => audio.src && !audio.paused && !audio.ended);
    return { live: playing.length, synths: window.__voice.synths, plays: window.__voice.plays.length };
  });
}

try {
  const target = base.includes('?') ? base : `${base}${base.endsWith('/') ? '' : '/'}?tour=1`.replace('//?', '/?');
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__valley?.world, null, { timeout: 60000 });
  await page.click('#start-button');
  if (await page.locator('#wish-dismiss').isVisible().catch(() => false)) await page.click('#wish-dismiss');
  await pump(0.4);
  let scene = await layout('序章');
  check('序章有下一步引导', /雾|观星台|下一步/.test(scene.chapter));
  await page.screenshot({ path: `${shots}/tour-prologue-tablet.png` });

  const voice = await page.evaluate(async () => {
    window.__voice.plays = [];
    window.__voice.synths = 0;
    window.__voice.audios = [];
    const target = __valley.world.targets.find((item) => item.type === 'story' && item.storyId && item.storyId !== 'disk');
    if (!target) return { missing: true };
    __valley.world.playerPosition.set(target.position.x + 0.4, __valley.world.playerPosition.y, target.position.z + 0.4);
    __valley.interact(target);
    __valley.interact(target);
    await new Promise((resolve) => setTimeout(resolve, 400));
    const playing = window.__voice.audios.filter((audio) => audio.src && !audio.paused && !audio.ended);
    return {
      id: target.storyId,
      live: playing.length,
      synths: window.__voice.synths,
      file: window.__voice.plays.some((src) => src.includes('/voice/story/')),
    };
  });
  check('序章点到角色', !voice.missing);
  if (!(voice.live <= 1 && voice.synths === 0 && voice.file)) console.log('voice', JSON.stringify(voice));
  check('序章角色只有一条声音', voice.live <= 1 && voice.synths === 0 && voice.file);
  if (await page.locator('#story-talk-close').isVisible().catch(() => false)) await page.locator('#story-talk-close').click();

  await page.evaluate(() => {
    const world = __valley.world;
    world.startBalloon();
    world.balloon.phase = 'tour';
    world.balloon.mode = 'steer';
    world.balloon.height = 14;
    world.balloonCraft.position.set(-5, 14, -14.4);
    for (let i = 0; i < 8; i += 1) world.update(0.05, { x: 0, z: 0 }, false);
  });
  await page.waitForFunction(() => {
    const ready = (id) => {
      const el = document.getElementById(id);
      return el && !el.hidden && !el.classList.contains('overlay-parked');
    };
    return ready('balloon-hud') && ready('land-question') && ready('tour-guide');
  });
  await layout('热气球、开垦和下一步');
  await page.screenshot({ path: `${shots}/tour-balloon-land-tablet.png` });
  await page.evaluate(() => {
    const world = __valley.world;
    if (world.balloon) world.finishBalloon(true);
    const talk = document.getElementById('story-talk');
    if (talk) talk.hidden = true;
  });
  await pump(0.3);

  async function ferry(button, realm) {
    await page.evaluate(() => { if (__valley.world.balloon) __valley.world.finishBalloon(true); });
    await stand(4, 14);
    await pump(0.4);
    await page.locator(button).waitFor({ state: 'visible' });
    await page.locator(button).click();
    await layout(`${realm} 出发`);
    await page.locator('#travel-skip').waitFor({ state: 'visible' });
    await page.locator('#travel-skip').click();
    await waitRealm(realm);
    await pump(0.3);
    await layout(realm === 'ri' ? '日谷' : '美谷');
  }

  await ferry('#travel-go', 'ri');
  await page.screenshot({ path: `${shots}/tour-ri-tablet.png` });
  const riVoice = await voiceNow();
  check('日谷同时最多一条声音', riVoice.live <= 1);
  await page.click('#travel-home');
  await waitRealm('he');
  await layout('从日谷回家');

  await ferry('#travel-go-mei', 'mei');
  await page.screenshot({ path: `${shots}/tour-mei-tablet.png` });
  const meiVoice = await voiceNow();
  check('美谷同时最多一条声音', meiVoice.live <= 1);
  await page.click('#travel-home');
  await waitRealm('he');

  await stand(-4.2, 20.2);
  await page.waitForFunction(() => (document.querySelector('#action-name')?.textContent || '').includes('热气球'));
  await page.click('#action-button');
  for (let i = 0; i < 30; i += 1) {
    const phase = await page.evaluate(() => __valley.world.balloon?.phase || '');
    if (phase === 'tour') break;
    await pump(0.2);
  }
  check('热气球升空', await page.evaluate(() => __valley.world.balloon?.phase === 'tour'));
  await dismissVista();
  await layout('热气球游览');
  await page.locator('#balloon-stars').click();
  await finishScenic('xing', '#star-skip');
  await layout('外星谷');
  await page.screenshot({ path: `${shots}/tour-xing-tablet.png` });
  const xingVoice = await voiceNow();
  check('外星谷同时最多一条声音', xingVoice.live <= 1);
  for (let i = 0; i < 40; i += 1) {
    if (!await page.evaluate(() => Boolean(__valley.world.balloon))) break;
    await pump(0.2);
  }
  await dismissVista();
  await page.locator('#balloon-return').click();
  await finishScenic('he', '#star-skip');
  check('从外星谷回家', await page.evaluate(() => (__valley.game.state.travel.current || 'he') === 'he'));

  const seen = [];
  for (let i = 0; i < 8; i += 1) {
    const chapter = await page.evaluate(() => document.getElementById('tour-guide-text')?.textContent || '');
    seen.push(chapter);
    await layout(`第 ${i + 1} 章引导`);
    if (/家之片|星河节|由你决定/.test(chapter)) break;
    await page.click('#tour-next');
    await pump(1.2);
  }
  check('走到终章或星河节', seen.some((line) => /家之片|星河节|三片都在了/.test(line)) || seen.some((line) => /飞向星星|星之片/.test(line)));
  await page.screenshot({ path: `${shots}/tour-finale-tablet.png` });

  check('整段体验没有脚本错误', errors.length === 0);
  if (staticMode) check('整段体验没有请求 /api', api.length === 0);
  const playing = await voiceNow();
  check('结束时没有叠着的声音', playing.live <= 1);
  console.log(`tour-tablet-check passed ${passed.length}`);
  console.log('chapters', seen);
} finally {
  await browser.close();
}
