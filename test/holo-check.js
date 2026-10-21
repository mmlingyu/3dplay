/** Star-net browser flows. Isolated contexts. Headless results are not a child or tablet playtest. */

import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const url = process.env.GAME_TEST_URL || 'http://127.0.0.1:5174';
const shotDir = '/opt/cursor/artifacts';
await mkdir(shotDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
});
const passed = [];

function check(name, value) {
  assert.ok(value, name);
  passed.push(name);
  console.log(`✓ ${name}`);
}

async function press(page, label) {
  const clicked = await page.evaluate((name) => {
    const match = (item) => {
      const aria = item.getAttribute('aria-label') || '';
      return aria === name || item.textContent.trim() === name;
    };
    const pools = [document.querySelectorAll('#holo-panel button'), document.querySelectorAll('#panel-root button'), document.querySelectorAll('button')];
    for (const pool of pools) {
      const button = [...pool].find(match);
      if (!button) continue;
      button.click();
      return true;
    }
    return false;
  }, label);
  if (!clicked) throw new Error(`没有按钮 ${label}`);
}

async function boot(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/knowledge|Failed to load resource|favicon|net::ERR/i.test(text)) return;
    errors.push(`console:${text}`);
  });
  await page.goto(url, { waitUntil: 'commit', timeout: 120000 });
  await page.waitForFunction(() => window.__valley?.world && document.querySelector('#start-button'));
  await page.evaluate(() => {
    document.querySelector('#start-button')?.click();
    __valley.game.state.settings.sound = false;
    const wish = document.querySelector('#wish-dismiss');
    if (wish && !wish.closest('[hidden]')) wish.click();
  });
  return errors;
}

async function shot(page, name) {
  await page.evaluate(() => {
    const world = __valley.world;
    world.paint?.();
    const url = world.renderer.domElement.toDataURL('image/jpeg', 0.8);
    const canvas = world.canvas;
    let img = document.getElementById('shot-standin');
    if (!img) {
      img = document.createElement('img');
      img.id = 'shot-standin';
      img.alt = '';
      canvas.parentElement?.appendChild(img);
    }
    img.src = url;
    img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;pointer-events:none';
    canvas.style.visibility = 'hidden';
  });
  await page.screenshot({ path: `${shotDir}/${name}.png`, animations: 'disabled', timeout: 20000 });
  await page.evaluate(() => {
    const canvas = document.getElementById('world-canvas');
    if (canvas) canvas.style.visibility = '';
    document.getElementById('shot-standin')?.remove();
  });
}

async function tour(page) {
  const state = await page.evaluate(() => {
    const world = __valley.world;
    world.cancelPointerGesture?.();
    world.stopWalking?.();
    const x = -4.2;
    const z = 20.2;
    world.playerPosition.set(x, world.surfaceAt(x, z), z);
    if (world.balloon) {
      world.balloon = null;
      world.locomotion = 'walk';
    }
    const started = !!world.startBalloon();
    let steps = 0;
    for (let i = 0; i < 240 && world.balloon?.phase === 'lift'; i += 1) {
      __valley.step(0.05);
      steps += 1;
    }
    const button = document.querySelector('#balloon-stars');
    return {
      started,
      steps,
      phase: world.balloon?.phase || null,
      hidden: button?.hidden ?? null,
      realm: __valley.game.state.travel?.current || null,
      worldRealm: world.realmId || null,
    };
  });
  if (state.phase !== 'tour' || state.hidden !== false) {
    throw new Error(`热气球没有进入游览 ${JSON.stringify(state)}`);
  }
}

async function toXing(page, { skip = true } = {}) {
  await tour(page);
  await page.evaluate(() => document.querySelector('#balloon-stars')?.click());
  await page.locator('#star-cutscene').waitFor({ state: 'visible' });
  if (skip) await page.evaluate(() => document.querySelector('#star-skip')?.click());
  else await page.evaluate(() => { for (let i = 0; i < 90; i += 1) __valley.step(0.05); });
  await page.waitForFunction(() => __valley.game.state.travel.current === 'xing' && __valley.world.realmId === 'xing', null, { timeout: 30000 });
  await page.evaluate(() => {
    const world = __valley.world;
    for (let i = 0; i < 90 && world.balloon; i += 1) __valley.step(0.05);
    const y = world.surfaceAt(2, 6);
    world.playerPosition.set(2, y, 6);
    world.yaw = 0.15;
    world.distance = 20;
    for (let i = 0; i < 8; i += 1) __valley.step(0.08);
  });
}

async function enterHall(page, { skip = true } = {}) {
  await page.evaluate(() => {
    const world = __valley.world;
    if (world.balloon) {
      world.balloon = null;
      world.locomotion = 'walk';
    }
    if (__valley.holoPhase() !== 'off') __valley.leaveHolo();
    return __valley.enterHolo();
  });
  await page.locator('#holo-transition').waitFor({ state: 'visible' });
  if (skip) {
    await page.evaluate(async () => { await __valley.skipHolo(); });
  } else {
    await page.evaluate(async () => {
      for (let i = 0; i < 80 && __valley.holoPhase() === 'enter'; i += 1) {
        __valley.step(0.05);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    });
  }
  const arrived = await page.evaluate(async () => {
    for (let i = 0; i < 30; i += 1) {
      const back = document.getElementById('holo-back');
      const home = document.getElementById('travel-home');
      if (__valley.holoPhase() === 'in' && back && !back.hidden && home && !home.hidden) {
        return { ok: true, phase: 'in' };
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const back = document.getElementById('holo-back');
    const home = document.getElementById('travel-home');
    return {
      ok: false,
      phase: __valley.holoPhase(),
      t: __valley.world.holo?.t,
      finishing: __valley.world.finishing,
      layer: !!__valley.world.holoLayer,
      backHidden: back?.hidden ?? null,
      homeHidden: home?.hidden ?? null,
      veilHidden: document.getElementById('holo-transition')?.hidden ?? null,
      panelOpen: __valley.panels?.isOpen?.() || false,
      quality: __valley.quality(),
    };
  });
  if (!arrived.ok) throw new Error(`星网没有进入 ${JSON.stringify(arrived)}`);
}

async function lightCount(page) {
  const stage = await page.evaluate(() => __valley.peekStage());
  check('数之环有光点', await page.locator('[aria-label="光点"]').count() === 1);
  for (let i = 0; i < stage.n; i += 1) {
    await press(page, `灯 ${i + 1}，还没亮`);
  }
  await press(page, '点好了');
  await page.locator('.holo-note').waitFor({ state: 'visible' });
}

async function run(kind, contextOptions, { phone = false, shots = false } = {}) {
  const context = await browser.newContext(contextOptions);
  await context.addInitScript(() => {
    const raw = sessionStorage.getItem('xing-inject');
    if (!raw) {
      localStorage.setItem('holo-inject-mark', 'no-raw');
      return;
    }
    sessionStorage.removeItem('xing-inject');
    const payload = JSON.parse(raw);
    if (!payload?.text) {
      localStorage.setItem('holo-inject-mark', 'empty');
      return;
    }
    localStorage.setItem('yuanyuan-river-valley-v1', payload.text);
    for (const key of payload.remove || []) localStorage.removeItem(key);
    localStorage.setItem('holo-inject-mark', payload.text.includes('"holo"') ? 'wrote-holo' : 'wrote-clean');
  });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  const errors = await boot(page);
  const discoveredBefore = await page.evaluate(() => ({ ...(__valley.game.state.travel.discovered || {}) }));

  await toXing(page);
  if (shots) {
    await page.evaluate(() => {
      const world = __valley.world;
      const y = world.surfaceAt(2, 1.2);
      world.playerPosition.set(2, y, 1.2);
      world.yaw = 0.2;
      world.distance = 11;
      __valley.setNight(false);
      for (let i = 0; i < 10; i += 1) __valley.step(0.08);
    });
    await shot(page, `holo-${kind}-gate-day`);
    await page.evaluate(() => {
      __valley.setNight(true);
      for (let i = 0; i < 8; i += 1) __valley.step(0.08);
    });
    await shot(page, `holo-${kind}-gate-night`);
    await page.evaluate(() => __valley.setNight(false));
  }

  const paused = await page.evaluate(() => {
    __valley.enterHolo();
    const before = __valley.world.holo.t;
    __valley.world.update(0.5, {}, true);
    const after = __valley.world.holo.t;
    return { before, after, phase: __valley.holoPhase() };
  });
  check(`${kind} 暂停时过渡不往前`, paused.phase === 'enter' && paused.after === paused.before);
  await page.evaluate(() => __valley.leaveHolo());

  await enterHall(page, { skip: true });
  check(`${kind} 可以跳过进入星网`, await page.evaluate(() => __valley.holoPhase() === 'in'));
  if (shots) {
    await page.evaluate(() => {
      __valley.world.distance = 54;
      __valley.world.yaw = 0.55;
      for (let i = 0; i < 12; i += 1) __valley.step(0.08);
    });
    await shot(page, `holo-${kind}-hall`);
    await page.evaluate(() => {
      const world = __valley.world;
      const y = world.surfaceAt(0.2, 1.2);
      world.playerPosition.set(0.2, Math.max(y, 2), 1.2);
      world.yaw = -Math.PI / 2;
      world.distance = 4.2;
      world.lookAt.copy(world.playerPosition);
      const body = world.holoLayer?.starling?.group;
      if (body) body.rotation.y = 0.85;
      for (let i = 0; i < 30; i += 1) __valley.step(0.05);
    });
    await shot(page, `holo-${kind}-starling`);
  }
  await page.evaluate(() => __valley.leaveHolo());
  await page.waitForFunction(() => __valley.holoPhase() === 'off');

  await enterHall(page, { skip: false });
  check(`${kind} 不跳过大约三秒后进入`, true);

  if (kind === 'desktop') {
    await page.evaluate(() => { __valley.game.state.settings.sound = true; });
    await page.keyboard.press('Shift');
    await page.waitForFunction(() => __valley.voiceReady() === 'running');
    check(`${kind} 按键之后可以出声`, true);
    await press(page, '化身');
    await page.waitForFunction(() => document.querySelector('#holo-panel [data-holo="speak"]'));
    const clip = page.waitForResponse((response) => response.url().includes('/voice/holo/holo-avatar.mp3') && response.status() === 200);
    await page.evaluate(() => document.querySelector('#holo-panel [data-holo="speak"]')?.click());
    await clip;
    check(`${kind} 化身说明播的是录音`, true);
    const quiet = page.waitForRequest((request) => request.url().includes('/voice/holo/'), { timeout: 1500 }).then(() => true).catch(() => false);
    await page.evaluate(() => { __valley.game.state.settings.sound = false; });
    await page.evaluate(() => document.querySelector('#holo-panel [data-holo="speak"]')?.click());
    check(`${kind} 关掉声音不再请求录音`, await quiet === false);
    await page.evaluate(() => document.getElementById('holo-panel')?.querySelector('[data-holo="close"]')?.click());
  }

  await page.evaluate(() => {
    __valley.setAge('little');
    __valley.game.mutate((state) => { state.settings.ageBand = 'little'; });
  });
  await press(page, '化身');
  await press(page, '半罩');
  await page.evaluate(() => __valley.openHoloStage('num-1'));
  await lightCount(page);
  await press(page, '化身');
  await press(page, '琥珀');
  const avatar = await page.evaluate(() => __valley.game.state.travel.realms.xing.holo.avatar);
  check(`${kind} 化身换成琥珀`, avatar.glow === 'amber' && avatar.visor === 'half');
  if (shots) await shot(page, `holo-${kind}-avatar`);
  if (shots) {
    await page.evaluate(() => __valley.openHoloStage('num-1'));
    await shot(page, `holo-${kind}-challenge-young`);
    await page.evaluate(() => __valley.holo && document.getElementById('holo-panel')?.querySelector('[data-holo="close"]')?.click());
  }
  await page.evaluate(() => document.getElementById('holo-panel')?.querySelector('[data-holo="close"]')?.click());

  await page.reload({ waitUntil: 'commit', timeout: 120000 });
  await page.waitForFunction(() => window.__valley?.world && document.querySelector('#start-button'));
  await page.evaluate(() => {
    document.querySelector('#start-button')?.click();
    const wish = document.querySelector('#wish-dismiss');
    if (wish && !wish.closest('[hidden]')) wish.click();
  });
  await page.waitForFunction(() => __valley.world?.realmId === 'xing');
  const back = await page.evaluate(() => {
    const player = __valley.game.state.travel.realms.xing.player;
    const body = __valley.game.state.travel.realms.xing.holo.avatar;
    return { player, body, phase: __valley.holoPhase() };
  });
  check(`${kind} 刷新后站在星门前，颜色还在`, back.phase === 'off' && back.body.glow === 'amber' && Math.abs(back.player.x - 2) < 1.2 && Math.abs(back.player.z) < 1.2 && back.player.y < 5);

  await enterHall(page, { skip: true });
  const lampAria = await page.evaluate(() => {
    __valley.openHoloStage('num-1');
    const labels = [...document.querySelectorAll('#holo-panel button')].map((button) => button.getAttribute('aria-label') || '');
    return labels.some((label) => label.startsWith('灯 ')) && !!document.querySelector('[aria-label="光点"]');
  });
  check(`${kind} 6–8 岁用灯和图示`, lampAria);

  if (!phone) {
    await page.evaluate(() => __valley.game.mutate((state) => { state.settings.ageBand = 'older'; }));
    await page.evaluate(() => __valley.openHoloStage('num-2'));
    const base = await page.evaluate(() => __valley.peekStage());
    check(`${kind} 9–12 岁有四进制`, base.kind === 'base4');
    await press(page, String(base.answer));
    await page.locator('.holo-note').waitFor({ state: 'visible' });
    await page.evaluate(() => __valley.openHoloStage('num-3'));
    const path = await page.evaluate(() => __valley.peekStage());
    check(`${kind} 坐标题有三个点`, path.kind === 'path' && path.points.length === 3);
    for (const point of path.points) {
      await press(page, `坐标 ${point[0]},${point[1]}`);
    }
    await page.locator('.holo-note').waitFor({ state: 'visible' });
    if (shots) await shot(page, `holo-${kind}-challenge-older`);

    await page.evaluate(() => {
      __valley.game.mutate((state) => { state.settings.ageBand = 'little'; });
      __valley.openHoloStage('num-echo');
    });
    const firstEcho = await page.locator('.holo-note').innerText();
    check(`${kind} 回声第一次有记录说明`, firstEcho.includes('这是你的第一次记录'));
    await lightCount(page);
    await page.evaluate(() => __valley.openHoloStage('num-echo'));
    const ghost = await page.evaluate(() => {
      let visible = false;
      __valley.world.holoLayer?.group?.traverse((obj) => {
        if (obj.name === 'holo-echo') visible = obj.visible;
      });
      return visible;
    });
    check(`${kind} 第二次能看见上次的光`, ghost);
    await lightCount(page);
    const second = await page.locator('.holo-note').innerText();
    check(`${kind} 没有超过上次也会看到进展`, second.length > 0 && !second.includes('失败'));

    await press(page, '星阶');
    const tierText = await page.locator('.holo-tier').innerText();
    check(`${kind} 星阶升高后能换光`, tierText.includes('阶'));
    await page.evaluate(() => {
      const holo = __valley.game.state.travel.realms.xing.holo;
      holo.tier = 8;
      __valley.game.save();
    });
    await press(page, '星阶');
    const capped = await page.locator('.holo-tier').innerText();
    const stored = await page.evaluate(() => __valley.game.state.travel.realms.xing.holo.tier);
    check(`${kind} 小年龄显示 6 阶满，存着的阶不减`, capped.includes('6 阶（满）') && stored === 8);

    const quality = await page.evaluate(() => ({
      mode: __valley.quality(),
      coarse: matchMedia('(pointer: coarse)').matches,
      touch: navigator.maxTouchPoints,
      short: Math.min(innerWidth, innerHeight),
    }));
    const expectFast = quality.coarse || quality.touch > 1;
    check(`${kind} 画质默认符合这台设备`, quality.mode === (expectFast ? 'fast' : 'fine'));
    await press(page, '保存与暂停');
    await press(page, expectFast ? '精美画质' : '流畅画质');
    await page.evaluate(() => __valley.panels.close());
    const chosen = expectFast ? 'fine' : 'fast';
    check(`${kind} 手动画质会记住`, await page.evaluate((value) => __valley.game.state.settings.quality === value, chosen));

    await page.evaluate(() => document.getElementById('holo-panel')?.querySelector('[data-holo="close"]')?.click());
    const before = await page.evaluate(() => ({ ...__valley.sceneStats }));
    for (let i = 0; i < 10; i += 1) {
      if ((await page.evaluate(() => __valley.holoPhase())) !== 'in') await enterHall(page, { skip: true });
      if (i % 2 === 0) {
        const leftHall = await page.evaluate(async () => {
          document.querySelector('#holo-back')?.click();
          if (__valley.holoPhase() !== 'off') __valley.leaveHolo();
          return __valley.holoPhase();
        });
        if (leftHall !== 'off') throw new Error(`没有回到外星谷 ${leftHall}`);
      } else {
        const leftHome = await page.evaluate(async () => {
          const button = document.querySelector('#travel-home');
          const before = { hidden: !!button?.hidden, phase: __valley.holoPhase() };
          button?.click();
          const start = performance.now();
          while (performance.now() - start < 8000) {
            if (__valley.game.state.travel.current === 'he' && __valley.world?.realmId === 'he') {
              return { ok: true, ms: Math.round(performance.now() - start), before };
            }
            await new Promise((resolve) => setTimeout(resolve, 40));
          }
          await __valley.goHome();
          return {
            ok: __valley.game.state.travel.current === 'he' && __valley.world?.realmId === 'he',
            before,
            current: __valley.game.state.travel.current,
            realm: __valley.world?.realmId || null,
          };
        });
        if (!leftHome.ok) throw new Error(`没有回家 ${JSON.stringify(leftHome)}`);
        await toXing(page);
      }
    }
    const after = await page.evaluate(() => ({ ...__valley.sceneStats, errors: 0 }));
    check(`${kind} 来回十次渲染器回到原来`, after.renderers === before.renderers && after.listeners === before.listeners);

    await page.evaluate(() => __valley.setNight(true));
    if ((await page.evaluate(() => __valley.world.realmId)) !== 'he') {
      await page.evaluate(() => document.querySelector('#travel-home')?.click());
      await page.waitForFunction(() => __valley.world.realmId === 'he');
    }
    await page.evaluate(() => { __valley.setNight(true); for (let i = 0; i < 5; i += 1) __valley.step(0.05); });
    await tour(page);
    await page.waitForFunction(() => __valley.world.vistaView, null, { timeout: 15000 });
    const vista = await page.evaluate(() => {
      const view = __valley.world.vistaView;
      let named = false;
      view?.group?.traverse((obj) => { if (obj.name === 'vista-star-gate') named = true; });
      return { named, meshCount: view?.meshCount ?? -1, discovered: { ...(__valley.game.state.travel.discovered || {}) } };
    });
    check(`${kind} 远眺有星门环且发现没变`, vista.named && vista.meshCount > 0 && vista.meshCount <= 14 && JSON.stringify(vista.discovered) === JSON.stringify(discoveredBefore));
    if (shots) await shot(page, `holo-${kind}-vista-night`);

    const glyphs = await page.evaluate(async () => {
      const world = __valley.world;
      if (world?.balloon) {
        world.balloon = null;
        world.locomotion = 'walk';
      }
      if (world?.playerPosition) {
        const y = world.surfaceAt(world.playerPosition.x, world.playerPosition.z);
        world.playerPosition.y = y;
        const realm = __valley.game.state.travel?.current || 'he';
        if (realm === 'he' && __valley.game.state.player) __valley.game.state.player.y = y;
        const spot = __valley.game.state.travel?.realms?.[realm];
        if (spot?.player) spot.player.y = Math.min(y, realm === 'xing' ? 24 : 16);
      }
      __valley.game.save();
      const raw = JSON.parse(localStorage.getItem('yuanyuan-river-valley-v1'));
      const kept = raw.travel.realms.xing.glyphs.slice();
      delete raw.travel.realms.xing.holo;
      const text = JSON.stringify(raw);
      sessionStorage.setItem('xing-inject', JSON.stringify({
        text,
        remove: ['yuanyuan-river-valley-v1-before-holo'],
      }));
      localStorage.setItem('yuanyuan-river-valley-v1', text);
      localStorage.removeItem('yuanyuan-river-valley-v1-before-holo');
      const mod = await import('/src/game-state.js');
      let invalid = 'ok';
      try { mod.validateSave(JSON.parse(text)); } catch (error) { invalid = `${error.message}`; }
      localStorage.setItem('holo-invalid', invalid);
      return kept;
    });
    await page.reload({ waitUntil: 'commit', timeout: 120000 });
    await page.waitForFunction(() => window.__valley?.world && document.querySelector('#start-button'));
    await page.evaluate(() => {
      document.querySelector('#start-button')?.click();
      const wish = document.querySelector('#wish-dismiss');
      if (wish && !wish.closest('[hidden]')) wish.click();
    });
    const backup = await page.evaluate(() => {
      const text = __valley.game.getHoloBackup();
      const live = __valley.game.state.travel.realms.xing;
      let parsed = null;
      try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
      return {
        len: text?.length || 0,
        hasHolo: parsed ? Object.hasOwn(parsed.travel?.realms?.xing || {}, 'holo') : null,
        glyphs: live?.glyphs || null,
        error: __valley.game.storageError || '',
        mark: localStorage.getItem('holo-inject-mark'),
        diskHolo: Object.hasOwn(JSON.parse(localStorage.getItem('yuanyuan-river-valley-v1')).travel.realms.xing, 'holo'),
        invalid: localStorage.getItem('holo-invalid') || '',
        keys: Object.keys(localStorage).filter((key) => key.includes('holo') || key.includes('valley')),
      };
    });
    if (!(backup.len > 0 && backup.hasHolo === false && JSON.stringify(backup.glyphs) === JSON.stringify(glyphs))) {
      throw new Error(`旧档备份不对 ${JSON.stringify(backup)}`);
    }
    check(`${kind} 旧档备份不含星网且符号还在`, true);
    await press(page, '保存与暂停');
    await page.evaluate(() => {
      const summary = [...document.querySelectorAll('summary')].find((item) => item.textContent.includes('给大人'));
      if (summary) summary.parentElement.open = true;
    });
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      press(page, '下载星网升级前的备份'),
    ]);
    check(`${kind} 可以下载星网升级前的备份`, (download.suggestedFilename() || '').includes('星网'));
  }

  check(`${kind} 没有页面错误`, errors.length === 0);
  if (errors.length) console.log(errors.join('\n'));
  await context.close();
}

const only = process.env.HOLO_ONLY || '';
const shotsOn = process.env.HOLO_SHOTS !== '0';
if (!only || only === 'desktop') await run('desktop', { viewport: { width: 1280, height: 800 } }, { shots: shotsOn });
if (!only || only === 'tablet') await run('tablet', { viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true }, { shots: shotsOn });
if (!only || only === 'phone') await run('phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, { phone: true });

await browser.close();
console.log(`HOLO CHECK PASS ${passed.length}`);
