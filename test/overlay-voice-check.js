/** Panels must not cover real button centers. Tablet and desktop, across the valleys. */

import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { buttonBlockers } from './button-occlusion.js';

const url = process.env.GAME_TEST_URL || 'http://127.0.0.1:5174';
const shots = '/opt/cursor/artifacts';
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const passed = [];

function check(name, value) {
  assert.ok(value, name);
  passed.push(name);
  console.log(`✓ ${name}`);
}

async function boot(context) {
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  const api = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => { if (request.url().includes('/api')) api.push(request.url()); });
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
  await page.goto(`${url}/?tour=1`);
  await page.waitForFunction(() => window.__valley?.world);
  await page.click('#start-button');
  if (await page.locator('#wish-dismiss').isVisible().catch(() => false)) await page.click('#wish-dismiss');
  await page.evaluate(() => { for (let i = 0; i < 10; i += 1) __valley.step(0.05); });
  return { page, errors, api };
}

async function pump(page, seconds) {
  const steps = Math.ceil(seconds / 0.05);
  await page.evaluate((count) => {
    for (let i = 0; i < count; i += 1) __valley.step(0.05);
  }, steps);
}

async function buttons(page, label) {
  await pump(page, 0.2);
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  const blocked = await page.evaluate(buttonBlockers);
  if (blocked.length) console.log('BLOCKED', label, blocked);
  check(`${label} 每个可见按钮都能点到`, blocked.length === 0);
  return blocked;
}

async function showHints(page) {
  await page.evaluate(() => {
    const root = document.getElementById('toast-root');
    root.replaceChildren();
    for (const text of ['坐稳，热气球起飞啦。转一圈看整个河谷。', '看那边，有一座认得出来的影子。']) {
      const el = document.createElement('div');
      el.className = 'toast';
      el.textContent = text;
      root.append(el);
    }
  });
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function flyNorth(page) {
  await page.evaluate(() => {
    __valley.game.mutate((state) => { state.travel.story.fogIntro = true; });
    const world = __valley.world;
    world.startBalloon();
    world.balloon.phase = 'tour';
    world.balloon.mode = 'steer';
    world.balloon.height = 14;
    world.balloonCraft?.position.set(-5, 14, -14.4);
    world.playerPosition.set(-5, 14.7, -14.4);
    world.sync(__valley.game.state);
    for (let i = 0; i < 6; i += 1) world.update(0.05);
  });
  await page.waitForFunction(() => {
    const hud = document.getElementById('balloon-hud');
    const land = document.getElementById('land-question');
    return hud && !hud.hidden && !hud.classList.contains('overlay-parked') && land && land.hidden;
  });
}

try {
  for (const viewport of [
    { width: 1024, height: 768, name: '平板', shot: `${shots}/after-overlay-tablet.png`, voice: true },
    { width: 1280, height: 800, name: '桌面', shot: `${shots}/after-overlay-desktop.png`, voice: false },
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      hasTouch: viewport.width < 1100,
    });
    const { page, errors, api } = await boot(context);
    const tag = viewport.name;

    if (viewport.voice) {
      const voice = await page.evaluate(async () => {
        window.__voice.plays = [];
        window.__voice.synths = 0;
        const world = __valley.world;
        const target = world.targets.find((item) => item.type === 'story' && item.storyId && item.storyId !== 'disk');
        if (!target) return { missing: true };
        world.playerPosition.set(target.position.x + 0.4, world.playerPosition.y, target.position.z + 0.4);
        window.__voice.audios = [];
        __valley.interact(target);
        __valley.interact(target);
        await new Promise((resolve) => setTimeout(resolve, 400));
        const playing = window.__voice.audios.filter((audio) => audio.src && !audio.paused && !audio.ended);
        return { id: target.storyId, plays: window.__voice.plays.slice(), synths: window.__voice.synths, live: playing.length };
      });
      check('点到了会说话的角色', !voice.missing && Boolean(voice.id));
      check('有录音时不再朗读', voice.synths === 0 && voice.plays.length >= 1);
      check('连点两下不会叠两条声音', voice.live <= 1);
      check('播放的是角色录音', voice.plays.some((src) => src.includes('/voice/story/')));
      if (await page.locator('#story-talk-close').isVisible().catch(() => false)) await page.locator('#story-talk-close').click();
    }

    await flyNorth(page);
    check(`${tag} 飞行中不弹出开垦`, await page.evaluate(() => document.getElementById('land-question').hidden));
    await showHints(page);
    const hints = await page.evaluate(() => {
      const map = document.querySelector('.minimap-card').getBoundingClientRect();
      const toasts = [...document.querySelectorAll('#toast-root .toast')].map((el) => el.getBoundingClientRect());
      const mapBox = { x: map.x, y: map.y, width: map.width, height: map.height };
      const covered = toasts.some((rect) => rect.width > 2 && rect.left < map.right && rect.right > map.left && rect.top < map.bottom && rect.bottom > map.top);
      const hud = document.getElementById('balloon-hud').getBoundingClientRect();
      const ids = ['balloon-orbit', 'balloon-steer', 'balloon-up', 'balloon-down', 'balloon-land', 'balloon-voyage', 'balloon-voyage-mei'];
      const outside = [];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el || el.hidden) continue;
        const rect = el.getBoundingClientRect();
        const inside = rect.top >= hud.top - 1 && rect.bottom <= hud.bottom + 1 && rect.left >= hud.left - 1 && rect.right <= hud.right + 1;
        if (!inside) outside.push(id);
      }
      return { covered, outside, scrolling: document.getElementById('balloon-hud').classList.contains('overlay-scroll') };
    });
    check(`${tag} 小提示不压住地图`, hints.covered === false);
    check(`${tag} 热气球按钮都在面板里面`, hints.outside.length === 0 && hints.scrolling === false);
    await buttons(page, `${tag} 热气球`);
    await page.screenshot({ path: viewport.shot });

    await page.evaluate(() => {
      if (__valley.world.balloon) __valley.world.finishBalloon(true);
      const talk = document.getElementById('story-talk');
      if (talk) talk.hidden = true;
      document.getElementById('toast-root').replaceChildren();
    });
    await page.evaluate(() => {
      const world = __valley.world;
      const site = world.dockSite;
      world.stopWalking();
      world.playerPosition.set(site.x + 1.2, world.surfaceAt?.(site.x, site.z) ?? 0, site.z);
    });
    await pump(page, 0.4);
    await page.locator('#travel-go').waitFor({ state: 'visible' });
    await buttons(page, `${tag} 渡口`);

    await page.locator('#travel-go').click();
    await page.locator('#travel-skip').waitFor({ state: 'visible' });
    await buttons(page, `${tag} 去日谷`);
    await page.locator('#travel-skip').click();
    await page.waitForFunction(() => __valley.game.state.travel.current === 'ri' && __valley.world?.realmId === 'ri');
    await pump(page, 0.3);
    await buttons(page, `${tag} 日谷`);
    await page.click('#travel-home');
    await page.waitForFunction(() => (__valley.game.state.travel.current || 'he') === 'he');

    await page.evaluate(() => {
      const world = __valley.world;
      const site = world.dockSite;
      world.playerPosition.set(site.x + 1.2, world.surfaceAt?.(site.x, site.z) ?? 0, site.z);
    });
    await pump(page, 0.4);
    await page.locator('#travel-go-mei').click();
    await page.locator('#travel-skip').click();
    await page.waitForFunction(() => __valley.game.state.travel.current === 'mei');
    await pump(page, 0.3);
    await buttons(page, `${tag} 美谷`);
    await page.click('#travel-home');
    await page.waitForFunction(() => (__valley.game.state.travel.current || 'he') === 'he');

    await flyNorth(page);
    await page.evaluate(() => {
      const card = document.getElementById('vista-card');
      const later = document.getElementById('vista-later');
      if (card && !card.hidden && !card.classList.contains('overlay-parked') && later) later.click();
    });
    await page.locator('#balloon-stars').click();
    for (let i = 0; i < 40; i += 1) {
      const there = await page.evaluate(() => __valley.game.state.travel.current === 'xing' && __valley.world?.realmId === 'xing');
      if (there) break;
      if (await page.locator('#star-skip').isVisible().catch(() => false)) await page.locator('#star-skip').click();
      await pump(page, 0.15);
    }
    await page.waitForFunction(() => __valley.game.state.travel.current === 'xing');
    await pump(page, 0.3);
    await buttons(page, `${tag} 外星谷`);

    for (let step = 0; step < 2; step += 1) {
      if (await page.locator('#tour-next').isVisible().catch(() => false)) {
        await page.click('#tour-next');
        await pump(page, 0.4);
      }
      await buttons(page, `${tag} 第 ${step + 1} 章`);
    }

    check(`${tag} 没有脚本错误`, errors.length === 0);
    const extraApi = api.filter((item) => !item.includes('/api/auth/me') && !item.includes('/api/knowledge/tutors'));
    check(`${tag} 没有新的后端请求`, extraApi.length === 0);
    await context.close();
  }
  console.log(`overlay-voice-check passed ${passed.length}`);
} finally {
  await browser.close();
}
