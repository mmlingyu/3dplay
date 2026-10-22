/** Panels must not cover real button centers. Tablet and desktop, across the valleys. */

import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { arrowClear, buttonBlockers, foldChipMatch, wrappedButtonLabels } from './button-occlusion.js';

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
  const wrapped = await page.evaluate(wrappedButtonLabels);
  if (blocked.length) console.log('BLOCKED', label, blocked);
  if (wrapped.length) console.log('WRAPPED', label, wrapped);
  check(`${label} 每个可见按钮都能点到`, blocked.length === 0);
  check(`${label} 按钮文字不换行`, wrapped.length === 0);
  return blocked;
}

async function showHints(page) {
  const count = await page.evaluate(() => {
    __valley.toast('坐稳，热气球起飞啦。转一圈看整个河谷。');
    __valley.toast('看那边，有一座认得出来的影子。');
    return document.querySelectorAll('#toast-root .toast').length;
  });
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  return count;
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
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const prologue = await page.evaluate(() => {
      const shown = (el) => {
        if (!el || el.hidden || el.closest('[hidden]')) return false;
        const style = getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      };
      return {
        banner: shown(document.getElementById('story-banner')),
        skip: shown(document.getElementById('story-skip')),
      };
    });
    check(`${tag} 序章提示还在`, prologue.banner && prologue.skip);
    const introWrap = await page.evaluate(wrappedButtonLabels);
    if (introWrap.length) console.log('WRAPPED', `${tag} 序章`, introWrap);
    check(`${tag} 序章按钮文字不换行`, introWrap.length === 0);
    const folds = await page.evaluate(foldChipMatch);
    if (folds.length) console.log('FOLD', tag, folds);
    check(`${tag} 折叠按钮样式一致`, folds.length === 0);

    await page.waitForTimeout(2200);
    const quiet = await page.evaluate(() => {
      const brief = document.getElementById('tour-guide-brief');
      const full = document.getElementById('tour-guide-text');
      const guide = document.getElementById('tour-guide');
      const briefShown = brief && getComputedStyle(brief).display !== 'none';
      return {
        balloon: document.getElementById('balloon-hud').hidden,
        ferry: document.getElementById('travel-go').hidden && document.getElementById('travel-go-mei').hidden,
        hotbar: document.getElementById('hotbar').hidden,
        map: document.querySelector('.minimap-card').classList.contains('is-folded'),
        wish: document.getElementById('wish-card').classList.contains('is-folded'),
        saveLive: document.getElementById('save-status').classList.contains('is-live'),
        accountLive: document.getElementById('account-chip').classList.contains('is-live'),
        saveProblem: document.getElementById('save-status').classList.contains('is-problem'),
        briefShown,
        brief: brief?.textContent || '',
        full: full?.textContent || '',
        clipped: Boolean(briefShown && brief.scrollWidth > brief.clientWidth + 2),
        icon: guide.classList.contains('is-icon'),
      };
    });
    check(`${tag} 没飞时不显示热气球`, quiet.balloon === true);
    check(`${tag} 没到渡口不显示渡口`, quiet.ferry === true);
    check(`${tag} 采集时建造格收起`, quiet.hotbar === true);
    check(`${tag} 地图平时收起`, quiet.map === true);
    check(`${tag} 点子平时收起`, quiet.wish === true);
    check(`${tag} 状态标签只闪一下`, quiet.saveProblem || (quiet.saveLive === false && quiet.accountLive === false));
    if (quiet.briefShown) {
      check(`${tag} 下一步是完整短句`, /。$/.test(quiet.brief) && quiet.clipped === false && quiet.full.length > quiet.brief.length);
    } else check(`${tag} 下一步平时是小图标`, quiet.icon === true);
    await page.evaluate(() => {
      const pin = document.getElementById('tour-guide-pin');
      for (let i = 0; i < 4 && !document.getElementById('tour-guide').classList.contains('is-icon'); i += 1) pin.click();
    });
    await page.click('#tour-guide-pin');
    const opened = await page.evaluate(() => {
      const brief = document.getElementById('tour-guide-brief');
      const guide = document.getElementById('tour-guide');
      return {
        brief: guide.classList.contains('is-brief'),
        text: brief.textContent,
        clipped: brief.scrollWidth > brief.clientWidth + 2,
        full: document.getElementById('tour-guide-text').textContent,
      };
    });
    check(`${tag} 点下一步出现完整一句`, opened.brief && /。$/.test(opened.text) && opened.clipped === false && opened.full.length > opened.text.length);
    await page.click('#tour-guide-more');
    const fullOpen = await page.evaluate(() => {
      const text = document.getElementById('tour-guide-text');
      return document.getElementById('tour-guide').classList.contains('is-open') && getComputedStyle(text).display !== 'none' && text.textContent.length > 8;
    });
    check(`${tag} 全文能展开`, fullOpen);
    await page.click('#tour-guide-more');
    check(`${tag} 全文可以收起`, await page.evaluate(() => document.getElementById('tour-guide').classList.contains('is-icon')));
    await page.click('[data-mode="build"]');
    check(`${tag} 搭建时建造格出现`, await page.locator('#hotbar').isVisible());
    await page.click('[data-mode="gather"]');
    check(`${tag} 离开搭建后建造格消失`, await page.locator('#hotbar').isHidden());
    await page.click('#map-toggle');
    check(`${tag} 点地图才展开`, await page.evaluate(() => !document.querySelector('.minimap-card').classList.contains('is-folded') && !document.getElementById('vista-map-button').hidden && !document.getElementById('land-button').hidden));
    await page.click('#map-toggle');

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
    const flight = await page.evaluate(() => {
      const visibleLand = [...document.querySelectorAll('button')].filter((el) => {
        if (el.hidden || el.closest('[hidden]')) return false;
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        return /降落/.test(`${el.textContent} ${el.getAttribute('aria-label') || ''}`);
      }).map((el) => el.id || el.textContent);
      return {
        hud: document.getElementById('balloon-hud').hidden === false,
        action: document.getElementById('action-button').hidden,
        drive: document.getElementById('balloon-drive').hidden,
        lands: visibleLand,
        guide: document.getElementById('tour-guide').classList.contains('is-icon') || document.getElementById('tour-guide').hidden,
      };
    });
    check(`${tag} 飞行才出现热气球面板`, flight.hud && flight.drive && flight.action);
    check(`${tag} 降落只留一个`, flight.lands.length === 1);
    check(`${tag} 飞行时下一步收成图标`, flight.guide);
    const hintCount = await showHints(page);
    check(`${tag} 一次只有一条提示`, hintCount === 1);
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
        if (!el || el.hidden || el.closest('[hidden]')) continue;
        const rect = el.getBoundingClientRect();
        const inside = rect.top >= hud.top - 1 && rect.bottom <= hud.bottom + 1 && rect.left >= hud.left - 1 && rect.right <= hud.right + 1;
        if (!inside) outside.push(id);
      }
      return { covered, outside, scrolling: document.getElementById('balloon-hud').classList.contains('overlay-scroll') };
    });
    check(`${tag} 小提示不压住地图`, hints.covered === false);
    check(`${tag} 热气球按钮都在面板里面`, hints.outside.length === 0 && hints.scrolling === false);
    const aim = await page.evaluate(arrowClear);
    check(`${tag} 方向箭头不压住面板`, aim.ok === true);
    await buttons(page, `${tag} 热气球`);
    await page.screenshot({ path: viewport.shot });
    await page.click('#balloon-steer');
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const drive = await page.evaluate(() => {
      const hud = document.getElementById('balloon-hud').getBoundingClientRect();
      const ids = ['balloon-up', 'balloon-down', 'balloon-orbit'];
      const outside = [];
      const missed = [];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el || el.hidden || el.closest('[hidden]')) {
          missed.push(id);
          continue;
        }
        const rect = el.getBoundingClientRect();
        const inside = rect.top >= hud.top - 1 && rect.bottom <= hud.bottom + 1 && rect.left >= hud.left - 1 && rect.right <= hud.right + 1;
        if (!inside) outside.push(id);
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        if (!hit || (hit !== el && !el.contains(hit))) missed.push(id);
      }
      return { outside, missed, steerHidden: document.getElementById('balloon-steer').hidden };
    });
    check(`${tag} 自己开才出现升高和降低`, drive.outside.length === 0 && drive.missed.length === 0 && drive.steerHidden);
    await page.click('#balloon-orbit');
    check(`${tag} 转一圈后收回驾驶按钮`, await page.evaluate(() => document.getElementById('balloon-drive').hidden === true));

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
    check(`${tag} 到了渡口才出现渡口按钮`, await page.evaluate(() => document.getElementById('balloon-hud').hidden && document.getElementById('travel-go').hidden === false));
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
