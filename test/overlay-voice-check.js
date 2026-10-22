import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

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

function overlaps(a, b) {
  if (!a || !b || a.width < 2 || b.width < 2) return false;
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

async function boot(context, path) {
  const page = await context.newPage();
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
  await page.goto(`${url}${path}`);
  await page.waitForFunction(() => window.__valley?.world);
  await page.click('#start-button');
  if (await page.locator('#wish-dismiss').isVisible().catch(() => false)) await page.click('#wish-dismiss');
  await page.evaluate(() => { for (let i = 0; i < 10; i += 1) __valley.step(0.05); });
  return { page, errors, api };
}

async function rects(page) {
  return page.evaluate(() => {
    const ids = ['balloon-hud', 'bounce-hud', 'land-question', 'tour-guide', 'story-banner', 'story-talk', 'story-home', 'vista-card', 'tutor-card', 'context-hint', 'letter-card', 'overlay-more'];
    const boxes = {};
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el || el.hidden || el.classList.contains('overlay-parked')) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      boxes[id] = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }
    const dock = document.querySelector('.bottom-dock').getBoundingClientRect();
    return { boxes, dock: { x: dock.x, y: dock.y, width: dock.width, height: dock.height } };
  });
}

try {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1, hasTouch: true });
  const { page, errors, api } = await boot(context, '/?tour=1');
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
    const ready = (id) => {
      const el = document.getElementById(id);
      return el && !el.hidden && !el.classList.contains('overlay-parked');
    };
    return ready('land-question') && ready('balloon-hud') && ready('tour-guide');
  });
  const scene = await rects(page);
  const names = Object.keys(scene.boxes);
  check('热气球、开垦和下一步同时出现', names.includes('balloon-hud') && names.includes('land-question') && names.includes('tour-guide'));
  for (let i = 0; i < names.length; i += 1) {
    for (let j = i + 1; j < names.length; j += 1) {
      check(`${names[i]} 不压住 ${names[j]}`, !overlaps(scene.boxes[names[i]], scene.boxes[names[j]]));
    }
    check(`${names[i]} 不挡住底部工具栏`, !overlaps(scene.boxes[names[i]], scene.dock));
  }
  const buttons = await page.evaluate(() => {
    const open = document.getElementById('land-question-open');
    const rect = open.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return { height: rect.height, hit: hit === open };
  });
  check('开垦按钮够大且能点到', buttons.height >= 44 && buttons.hit);
  await page.screenshot({ path: `${shots}/after-overlay-tablet.png` });

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
  const storyFile = voice.plays.some((src) => src.includes('/voice/story/'));
  check('播放的是角色录音', storyFile);

  for (let step = 0; step < 5; step += 1) {
    await page.click('#tour-next');
    await page.evaluate(() => { for (let i = 0; i < 8; i += 1) __valley.step(0.05); });
    const frame = await rects(page);
    const ids = Object.keys(frame.boxes);
    for (let i = 0; i < ids.length; i += 1) {
      check(`第 ${step + 1} 次跳章后 ${ids[i]} 不挡工具栏`, !overlaps(frame.boxes[ids[i]], frame.dock));
      for (let j = i + 1; j < ids.length; j += 1) {
        check(`第 ${step + 1} 次跳章后 ${ids[i]} 不压 ${ids[j]}`, !overlaps(frame.boxes[ids[i]], frame.boxes[ids[j]]));
      }
    }
  }
  check('体验过程没有脚本错误', errors.length === 0);
  const extraApi = api.filter((url) => !url.includes('/api/auth/me') && !url.includes('/api/knowledge/tutors'));
  check('体验过程没有新的后端请求', extraApi.length === 0);
  console.log(`overlay-voice-check passed ${passed.length}`);
  await context.close();
} finally {
  await browser.close();
}
