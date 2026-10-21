import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const url = process.env.GAME_TEST_URL || 'http://127.0.0.1:5174';
const shotDir = process.env.TRAVEL_SHOT_DIR || '/tmp';
const artifactDir = '/opt/cursor/artifacts/screenshots';
const KEY = 'yuanyuan-river-valley-v1';

await mkdir(shotDir, { recursive: true });
await mkdir(artifactDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const passed = [];
const notes = [];

function check(name, value) {
  assert.ok(value, name);
  passed.push(name);
  console.log(`✓ ${name}`);
}

async function shot(page, name) {
  const file = `${shotDir}/valley-travel-${name}.png`;
  await page.screenshot({ path: file });
  await page.screenshot({ path: `${artifactDir}/valley-travel-${name}.png` });
  notes.push(file);
}

async function injectSave(page, text, remove = []) {
  await page.evaluate(({ text: payload, remove: keys }) => {
    sessionStorage.setItem('travel-inject', JSON.stringify({ text: payload, remove: keys }));
  }, { text, remove });
  await page.reload();
  await page.waitForFunction(() => window.__valley?.game);
}

async function boot(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console:${msg.text()}`);
  });
  await page.goto(url);
  await page.waitForFunction(() => window.__valley?.world);
  await page.click('#start-button');
  await page.evaluate(() => { __valley.game.state.settings.sound = false; });
  if (await page.locator('#wish-dismiss').isVisible()) await page.click('#wish-dismiss');
  return errors;
}

async function pos(page) {
  return page.evaluate(() => {
    const p = __valley.world.playerPosition;
    return {
      x: p.x, y: p.y, z: p.z,
      yaw: __valley.world.yaw,
      realm: __valley.game.state.travel.current,
      phase: __valley.world.balloon?.phase || null,
    };
  });
}

async function holdUntil(page, key, predicate, timeout = 70000) {
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(predicate, null, { timeout });
  } finally {
    await page.keyboard.up(key);
  }
}

async function nearDock(page) {
  await page.evaluate(() => { __valley.world.yaw = 0; __valley.world.stopWalking(); });
  await holdUntil(page, 'd', () => __valley.world.playerPosition.x >= 2.12);
  const x = await page.evaluate(() => __valley.world.playerPosition.x);
  if (x > 2.48) await holdUntil(page, 'a', () => __valley.world.playerPosition.x <= 2.36);
  await holdUntil(page, 's', () => __valley.world.playerPosition.z >= 13.15 && __valley.world.playerPosition.x < 2.7);
  const go = page.locator('#travel-go');
  await go.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
  return { where: await pos(page), visible: await go.isVisible() };
}

async function arriveByFerry(page, { skip = false } = {}) {
  await page.locator('#travel-go').click();
  await page.locator('#travel-cutscene').waitFor({ state: 'visible' });
  check('出发说明写明路程在游戏里变短了', (await page.locator('#travel-cutscene-text').innerText()).includes('路程在游戏里变短了'));
  if (skip) {
    await page.locator('#travel-skip').click();
  } else {
    await page.waitForFunction(() => __valley.game.state.travel.current === 'ri', null, { timeout: 45000 });
  }
  await page.waitForFunction(() => __valley.game.state.travel.current === 'ri' && __valley.world?.realmId === 'ri', null, { timeout: 45000 });
}

async function openTutor(page, tutorId) {
  await page.evaluate((id) => {
    const target = __valley.world.targets.find((item) => item.tutorId === id);
    __valley.world.stopWalking();
    __valley.world.playerPosition.set(target.position.x + 1.3, 0, target.position.z);
  }, tutorId);
  await page.evaluate((ms) => window.advanceTime(ms), 400);
  const card = page.locator('#tutor-card');
  check('走近角色时先不自动打开题目', await card.isHidden());
  const label = tutorId === 'koharu' ? '小春' : tutorId === 'kozo-elder' ? '楮叶奶奶' : '阿哲';
  await page.getByRole('button', { name: label, exact: true }).click();
  await card.waitFor({ state: 'visible' });
}

async function childButtons(page) {
  const names = ['做和纸', '折纸鹤', '回家', '印章本'];
  const boxes = await page.evaluate((labels) => labels.map((label) => {
    const el = document.querySelector(`[aria-label="${label}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return { label, w: r.width, h: r.height, hidden: el.hidden || style.display === 'none', top: r.top, left: r.left };
  }), names);
  return boxes;
}

async function runViewport(kind, viewport, full) {
  const context = await browser.newContext({ viewport, acceptDownloads: true, hasTouch: kind === 'phone' });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const raw = sessionStorage.getItem('travel-inject');
    if (!raw) return;
    sessionStorage.removeItem('travel-inject');
    const payload = JSON.parse(raw);
    localStorage.setItem('yuanyuan-river-valley-v1', payload.text);
    for (const key of payload.remove || []) localStorage.removeItem(key);
  });
  page.setDefaultTimeout(120000);
  const errors = await boot(page);
  try {
    await page.evaluate(() => { __valley.world.yaw = 0; });
    const dock = await nearDock(page);
    console.log(kind, 'dock', JSON.stringify(dock.where));
    check(`${kind} 用方向键走到渡口后出现去日谷`, dock.visible && dock.where.realm === 'he');
    await shot(page, `${kind}-dock`);
    if (!full) {
      await arriveByFerry(page, { skip: true });
      await shot(page, `${kind}-ri`);
      const boxes = await childButtons(page);
      for (const box of boxes) {
        check(`${kind} ${box?.label || '按钮'} 可点且高度至少 44`, box && !box.hidden && box.h >= 44 && box.w >= 44);
      }
      const home = await page.evaluate(() => {
        const el = document.querySelector('#travel-home');
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height, text: el.textContent };
      });
      check(`${kind} 回家按钮高度至少 44`, home.h >= 44 && home.w >= 44);
      await page.locator('#ri-washi').click();
      await page.waitForFunction(() => __valley.panels?.type() === 'washi', null, { timeout: 40000 });
      if (await page.locator('.panel-header [data-action="close"]').isVisible()) await page.locator('.panel-header [data-action="close"]').click();
      await page.locator('#travel-home').click();
      await page.waitForFunction(() => __valley.game.state.travel.current === 'he' && __valley.world.realmId === 'he', null, { timeout: 15000 });
      check(`${kind} 大按钮可以回家`, true);
      return;
    }

    await arriveByFerry(page, { skip: false });
    check('不跳过时渡船结束后进入日谷', (await pos(page)).realm === 'ri');
    check('到达日谷盖章且没有先答题', await page.evaluate(() => __valley.game.state.travel.stamps.includes('ri-arrive') && __valley.game.state.travel.stickers.length === 0));
    await shot(page, 'desktop-ri');

    await page.locator('#travel-home').click();
    await page.waitForFunction(() => __valley.game.state.travel.current === 'he', null, { timeout: 15000 });
    await page.locator('#travel-go').click();
    await page.locator('#pause-button').click();
    const elapsedBefore = await page.evaluate(() => document.querySelector('#travel-cutscene-text')?.textContent || '');
    await page.waitForTimeout(2500);
    check('暂停时渡船不结束，人还在河谷', await page.evaluate(() => __valley.game.state.travel.current === 'he' && !document.querySelector('#travel-cutscene').hidden));
    check('暂停时出发说明还在', (await page.locator('#travel-cutscene-text').innerText()) === elapsedBefore);
    await page.locator('.panel-header [data-action="close"]').click();
    await page.locator('#travel-skip').click();
    await page.waitForFunction(() => __valley.game.state.travel.current === 'ri' && __valley.world.realmId === 'ri', null, { timeout: 15000 });
    check('跳过后进入日谷', true);

    await openTutor(page, 'koharu');
    const menu = await page.locator('#npc-surface').innerText();
    check('第一次见面是菜单，不是题目', menu.includes('想做哪一件') && menu.includes('看一看') && menu.includes('做手工') && !menu.includes('点一个白天的图'));
    await page.getByRole('button', { name: '做一题' }).click();
    const quiz = await page.locator('#npc-surface').innerText();
    check('题目里可以换三档长短', quiz.includes('短一点') && quiz.includes('再长一点') && quiz.includes('挑战一下'));
    check('默认短一点是看图的题', quiz.includes('点一个白天的图'));
    await page.getByRole('button', { name: '再长一点', exact: true }).click();
    check('再长一点换成另一题', (await page.locator('#npc-surface').innerText()).includes('さくら是什么'));
    await page.getByRole('button', { name: '挑战一下', exact: true }).click();
    check('挑战一下换成更长的题', (await page.locator('#npc-surface').innerText()).includes('平假名'));
    const beforeWrong = await page.evaluate(() => ({ ...__valley.game.state.inventory, stamps: [...__valley.game.state.travel.stamps] }));
    await page.getByRole('button', { name: 'い', exact: true }).click();
    const afterWrong = await page.evaluate(() => ({ ...__valley.game.state.inventory, stamps: [...__valley.game.state.travel.stamps] }));
    check('答错不扣材料也不盖章', JSON.stringify(beforeWrong) === JSON.stringify(afterWrong));
    await page.getByRole('button', { name: '先去玩', exact: true }).click();
    await page.locator('#tutor-card').waitFor({ state: 'hidden' });

    await page.evaluate(() => {
      const target = __valley.world.targets.find((item) => item.id === 'grove-kozo');
      __valley.world.playerPosition.set(target.position.x + 1.6, 0, target.position.z);
    });
    await page.evaluate((ms) => window.advanceTime(ms), 300);
    const kozoBefore = await page.evaluate(() => __valley.game.state.inventory.kozo || 0);
    await page.getByRole('button', { name: '楮树林', exact: true }).click();
    await page.waitForFunction((before) => (__valley.game.state.inventory.kozo || 0) >= before + 2, kozoBefore);
    check('楮树林直接采集，不用答题', true);

    await page.locator('#ri-washi').click();
    await page.waitForFunction(() => __valley.panels.type() === 'washi', null, { timeout: 40000 });
    const washiText = await page.locator('.game-panel').innerText();
    check('和纸面板列出五步', ['剥皮蒸煮', '敲打成纤维', '加水', '竹帘抄纸', '晾干'].every((step) => washiText.includes(step)));
    await page.locator('.game-panel summary').click();
    check('和纸说明写明时间缩短了', (await page.locator('.game-panel').innerText()).includes('缩短'));
    await shot(page, 'desktop-washi');
    await page.locator('.panel-header [data-action="close"]').click();
    await page.locator('#pause-button').click();
    await page.waitForFunction(() => __valley.panels.type() === 'pause');
    const running = await page.evaluate(() => __valley.game.washiStatus().elapsed);
    await page.waitForTimeout(1600);
    check('暂停时和纸不推进', await page.evaluate((t) => __valley.game.washiStatus().elapsed === t && __valley.panels.type() === 'pause', running));
    await page.locator('.panel-header [data-action="close"]').click();
    await page.evaluate(() => __valley.openPanel('washi'));
    const seen = await page.evaluate(() => __valley.game.washiStatus().elapsed);
    await page.waitForTimeout(1200);
    check('看着和纸面板时过程继续', await page.evaluate((t) => __valley.game.washiStatus().elapsed > t, seen));
    const hiddenOk = await page.evaluate(async () => {
      const before = __valley.game.washiStatus().elapsed;
      const desc = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
      Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => true });
      await window.advanceTime(1500);
      const mid = __valley.game.washiStatus().elapsed;
      if (desc) Object.defineProperty(Document.prototype, 'hidden', desc);
      else delete Document.prototype.hidden;
      return { before, mid, held: mid === before };
    });
    check('页面隐藏时和纸不推进', hiddenOk.held);
    await page.evaluate(() => { __valley.panels.close(); __valley.game.tick(20); });
    await page.evaluate((ms) => window.advanceTime(ms), 250);
    await page.locator('#ri-claim').click();
    check('不用答题收下和纸并盖章', await page.evaluate(() => __valley.game.state.inventory.washi >= 1 && __valley.game.state.travel.stamps.includes('ri-washi-first')));

    await page.locator('#ri-crane').click();
    await page.waitForTimeout(300);
    check('折纸鹤盖章且仍在日谷', await page.evaluate(() => __valley.game.state.inventory['paper-crane'] >= 1 && __valley.game.state.travel.stamps.includes('ri-crane-first') && __valley.game.state.travel.current === 'ri'));

    await page.evaluate(() => {
      const target = __valley.world.targets.find((item) => item.id === 'grove-bamboo');
      __valley.world.playerPosition.set(target.position.x - 1.6, 0, target.position.z);
      __valley.interact(target);
      __valley.game.craft([['bamboo']], 'bamboo-strips');
      __valley.game.startWashi();
      __valley.game.tick(20);
      __valley.game.claimWashi();
      __valley.game.craft([['washi', 'bamboo-strip']], 'paper-koinobori');
    });
    await page.locator('#ri-flag').click();
    check('修好鲤鱼旗盖章且旗还在背包', await page.evaluate(() => __valley.game.state.travel.stamps.includes('ri-help-koharu') && __valley.game.state.inventory['paper-koinobori'] >= 1 && __valley.game.state.travel.realms.ri.claimed.includes('ri-flag-repaired')));

    await page.evaluate(() => {
      __valley.world.playerPosition.set(4, 0, 6.4);
      __valley.selectItem('paper-crane');
      __valley.setBuildCell({ x: 4, y: 0, z: 8 });
    });
    await page.locator('#placement-confirm').click();
    await page.waitForFunction(() => __valley.game.state.travel.realms.ri.blocks.some((block) => block.item === 'paper-crane' && block.x === 4 && block.z === 8));
    check('访客小院可以放下纸鹤', true);
    await page.evaluate(() => { __valley.selectItem('plank'); __valley.setBuildCell({ x: -8, y: 0, z: -6 }); });
    const campus = await page.locator('#placement-status').innerText();
    check('朋友的家不能搭建', campus.includes('朋友的家'));
    await shot(page, 'desktop-yard');

    await page.locator('#ri-stamps').click();
    const stampText = await page.locator('.game-panel').innerText();
    check('印章本有四枚且都已盖上', ['到达日谷', '第一张和纸', '第一只纸鹤', '帮小春修鲤鱼旗'].every((name) => stampText.includes(name)) && (stampText.match(/已经盖上/g) || []).length === 4);
    await shot(page, 'desktop-stamps');
    await page.locator('.panel-header [data-action="close"]').click();

    await page.evaluate(() => {
      const target = __valley.world.targets.find((item) => item.id === 'ri-letter');
      __valley.world.playerPosition.set(target.position.x + 1.2, 0, target.position.z);
    });
    await page.evaluate((ms) => window.advanceTime(ms), 300);
    await page.getByRole('button', { name: '看信', exact: true }).click();
    check('信可以打开也可以先放着', await page.locator('#letter-card').isVisible() && await page.evaluate(() => __valley.game.state.travel.story.seen.includes('letter-ri-1')));
    await page.locator('#letter-close').click();
    check('不看信也不挡着回家', await page.locator('#letter-card').isHidden() && await page.locator('#travel-home').isVisible());

    await page.evaluate(() => {
      const target = __valley.world.targets.find((item) => item.id === 'grove-kozo');
      __valley.world.playerPosition.set(target.position.x + 1.6, 0, target.position.z);
      __valley.interact(target);
      __valley.game.startWashi();
      __valley.game.tick(20);
      __valley.game.claimWashi();
      __valley.game.craft([['washi']], 'paper-crane');
    });
    await page.locator('#travel-home').click();
    await page.waitForFunction(() => __valley.world.realmId === 'he', null, { timeout: 15000 });
    await page.evaluate(() => {
      __valley.world.playerPosition.set(-6, 0, 4.4);
      __valley.selectItem('paper-crane');
      __valley.setBuildCell({ x: -6, y: 0, z: 6 });
    });
    await page.locator('#placement-confirm').click();
    await page.waitForFunction(() => __valley.game.state.blocks.some((block) => block.item === 'paper-crane' && block.x === -6));
    check('纸鹤可以带回河谷摆放', true);
    const homeIds = await page.evaluate(() => __valley.game.state.blocks.map((block) => block.id));
    const saved = await page.evaluate(() => ({
      blocks: __valley.game.state.blocks.map((block) => ({ id: block.id, item: block.item, x: block.x, z: block.z })),
      yard: __valley.game.state.travel.realms.ri.blocks.length,
    }));
    await page.reload();
    await page.waitForFunction(() => window.__valley?.world);
    check('重载后河谷里的纸鹤还在', await page.evaluate((snap) => {
      const now = __valley.game.state.blocks.map((block) => ({ id: block.id, item: block.item, x: block.x, z: block.z }));
      return JSON.stringify(now) === JSON.stringify(snap.blocks) && __valley.game.state.travel.current === 'he';
    }, saved));
    await page.click('#start-button');
    await page.evaluate(() => __valley.goRealm('ferry'));
    await page.waitForFunction(() => __valley.world.realmId === 'ri');
    await page.reload();
    await page.waitForFunction(() => window.__valley?.game);
    check('在日谷重载还留在日谷', await page.evaluate(() => __valley.game.state.travel.current === 'ri'));
    await page.click('#start-button');
    await page.waitForFunction(() => __valley.world.realmId === 'ri');

    const parked = await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('yuanyuan-river-valley-v1'));
      data.travel.realms.ri.player.x = 80;
      return JSON.stringify(data);
    });
    await injectSave(page, parked);
    check('日谷位置出界回到码头，家里建筑还在', await page.evaluate((ids) => {
      const travel = __valley.game.state.travel;
      const homeIds = __valley.game.state.blocks.map((block) => block.id);
      return travel.current === 'ri' && travel.realms.ri.player.z === -12 && homeIds.join() === ids.join() && /码头/.test(__valley.game.travelNotice || '');
    }, homeIds));
    await page.click('#start-button');

    const beforeCorrupt = await page.evaluate(() => ({
      blocks: __valley.game.state.blocks.map((block) => ({ id: block.id, item: block.item })),
      inventory: { ...__valley.game.state.inventory },
    }));
    const broken = await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('yuanyuan-river-valley-v1'));
      data.travel.realms.ri.blocks = [{ id: 'block-9', x: -8, y: 0, z: -6, item: 'plank', rotation: 0 }];
      return JSON.stringify(data);
    });
    await injectSave(page, broken);
    check('日谷建筑不合法时回到河谷且家里不变', await page.evaluate((snap) => {
      const blocks = __valley.game.state.blocks.map((block) => ({ id: block.id, item: block.item }));
      return __valley.game.state.travel.current === 'he'
        && JSON.stringify(blocks) === JSON.stringify(snap.blocks)
        && JSON.stringify(__valley.game.state.inventory) === JSON.stringify(snap.inventory)
        && /回到河谷/.test(__valley.game.travelNotice || '');
    }, beforeCorrupt));
    await page.click('#start-button');
    await page.click('#pause-button');
    check('大人区能看到旅行记录提示', (await page.locator('.panel-notice').first().innerText()).includes('回到河谷'));
    await page.locator('.panel-header [data-action="close"]').click();

    const stripped = await page.evaluate((key) => {
      const text = localStorage.getItem(key);
      const data = JSON.parse(text);
      const home = { blocks: data.blocks, inventory: data.inventory, kiln: data.kiln, garden: data.garden };
      delete data.travel;
      if (data.settings) delete data.settings.ageBand;
      return { next: JSON.stringify(data), home };
    }, KEY);
    await injectSave(page, stripped.next, [`${KEY}-before-travel`, `${KEY}-before-travel-1`]);
    await page.click('#start-button');
    await page.evaluate(() => __valley.goRealm('ferry'));
    await page.waitForFunction(() => __valley.game.state.travel.current === 'ri');
    await page.evaluate(() => __valley.goHome());
    await page.waitForFunction(() => __valley.game.state.travel.current === 'he');
    check('旧存档补上旅行后家里的背包和建筑不变', await page.evaluate((home) => {
      const state = __valley.game.state;
      return JSON.stringify(state.blocks) === JSON.stringify(home.blocks)
        && JSON.stringify(state.inventory) === JSON.stringify(home.inventory)
        && JSON.stringify(state.kiln) === JSON.stringify(home.kiln)
        && JSON.stringify(state.garden) === JSON.stringify(home.garden);
    }, stripped.home));
    check('旧存档只写一次旅行前备份', await page.evaluate((backup) => localStorage.getItem('yuanyuan-river-valley-v1-before-travel') === backup && localStorage.getItem('yuanyuan-river-valley-v1-before-travel-1') === null, stripped.next));
    await page.click('#pause-button');
    await page.getByText('给大人：备份与导入存档').click();
    const downloadEvent = page.waitForEvent('download');
    await page.locator('[data-action="export-travel"]').click();
    const download = await downloadEvent;
    const downloaded = await download.path().then(async (file) => {
      const { readFileSync } = await import('node:fs');
      return readFileSync(file, 'utf8');
    });
    check('暂停里单独的按钮下载旅行升级前的原文', downloaded === stripped.next && download.suggestedFilename().includes('旅行'));
    await page.locator('#age-band').selectOption('junior');
    check('年龄档可以设置且说明不记录生日', await page.evaluate(() => __valley.game.state.settings.ageBand === 'junior') && (await page.locator('.game-panel').innerText()).includes('不记录生日'));
    await page.locator('.panel-header [data-action="close"]').click();

    const statsBefore = await page.evaluate(() => ({ ...__valley.sceneStats }));
    for (let i = 0; i < 10; i += 1) {
      await page.evaluate(() => __valley.goRealm('ferry'));
      await page.waitForFunction(() => __valley.world.realmId === 'ri' && __valley.game.state.travel.current === 'ri');
      await page.evaluate(() => __valley.goHome());
      await page.waitForFunction(() => __valley.world.realmId === 'he' && __valley.game.state.travel.current === 'he');
    }
    const statsAfter = await page.evaluate(() => ({ ...__valley.sceneStats, realm: __valley.world.realmId, current: __valley.game.state.travel.current }));
    console.log('sceneStats', statsBefore, statsAfter);
    check('来回十次后仍只有一个渲染器', statsAfter.renderers === 1 && statsAfter.realm === 'he');
    check('来回十次场景有释放', statsAfter.created === statsBefore.created + 20 && statsAfter.released === statsBefore.released + 20 && statsAfter.listeners === statsBefore.listeners);

    await page.evaluate(() => { __valley.world.playerPosition.set(-4.2, 0, 18); __valley.world.startBalloon(); });
    await page.waitForFunction(() => __valley.world.balloon?.phase === 'tour', null, { timeout: 60000 });
    await page.locator('#balloon-voyage').click();
    check('看风景说明路程和天气被简化', (await page.locator('#travel-cutscene-text').innerText()).includes('简化'));
    check('风景飞行中途还没改成日谷', await page.evaluate(() => __valley.game.state.travel.current === 'he' && __valley.world.balloon?.phase === 'voyage' && __valley.game.state.player.y < 1));
    await page.reload();
    await page.waitForFunction(() => window.__valley?.game);
    check('风景飞行中刷新回到河谷草坪，不留在半空', await page.evaluate(() => {
      const player = __valley.game.state.player;
      return __valley.game.state.travel.current === 'he' && Math.abs(player.y) < 0.2 && player.z > 16;
    }));
    await page.click('#start-button');
    await page.evaluate(() => __valley.world.startBalloon());
    await page.waitForFunction(() => __valley.world.balloon?.phase === 'tour', null, { timeout: 60000 });
    await page.locator('#balloon-voyage').click();
    await page.waitForFunction(() => __valley.game.state.travel.current === 'ri' && __valley.world.realmId === 'ri', null, { timeout: 60000 });
    check('看风景降落在日谷草坪', await page.evaluate(() => {
      const player = __valley.game.state.travel.realms.ri.player;
      return Math.abs(player.x + 10) < 1.2 && Math.abs(player.z - 12) < 1.2 && __valley.game.state.travel.via === 'balloon';
    }));
    await shot(page, 'desktop-lawn');

    const noisy = errors.filter((item) => !/知识引擎|知识包|Failed to load resource|404|net::ERR/.test(item));
    if (noisy.length) console.log('page issues', noisy);
    check('旅行流程没有未捕获的页面错误', noisy.length === 0);
  } finally {
    await context.close();
  }
}

const only = process.env.TRAVEL_ONLY || '';
try {
  if (!only || only === 'desktop') await runViewport('desktop', { width: 1280, height: 800 }, true);
  if (!only || only === 'tablet') await runViewport('tablet', { width: 1024, height: 768 }, false);
  if (!only || only === 'phone') await runViewport('phone', { width: 390, height: 844 }, false);
  console.log(`旅行流程通过 ${passed.length} 项`);
  console.log(notes.join('\n'));
} finally {
  await browser.close();
}