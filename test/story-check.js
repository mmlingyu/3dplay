import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createInitialState } from '../src/game-state.js';
import { STORAGE_KEY } from '../src/game-data.js';
import { emptyRealm } from '../src/realm-data.js';

const url = process.env.GAME_TEST_URL || 'http://127.0.0.1:5174';
const shots = '/opt/cursor/artifacts';
await mkdir(shots, { recursive: true });

const browser = await chromium.launch({ headless: true });
const passed = [];
const calls = {};
function check(name, value) {
  assert.ok(value, name);
  passed.push(name);
  console.log(`✓ ${name}`);
}

async function boot(context, path = '/', save = null) {
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  if (save) {
    await page.addInitScript(({ key, text }) => {
      localStorage.setItem(key, text);
    }, { key: STORAGE_KEY, text: JSON.stringify(save) });
  }
  await page.goto(`${url}${path}`);
  await page.waitForFunction(() => window.__valley?.world && window.__valley.story);
  await page.evaluate(() => __valley.story.setMoment({ period: '中午', hour: 12, minute: 0, season: '春' }));
  await page.click('#start-button');
  await page.evaluate(() => { __valley.game.state.settings.sound = false; });
  if (await page.locator('#wish-dismiss').isVisible().catch(() => false)) await page.click('#wish-dismiss');
  return { page, errors };
}

async function step(page, n = 8) {
  await page.evaluate((count) => { for (let i = 0; i < count; i += 1) __valley.step(0.05); }, n);
}

async function giveShard(page, id) {
  await page.evaluate((realmId) => {
    __valley.game.mutate((state) => {
      const realms = state.travel.realms;
      if (!realms[realmId]) {
        const donor = realms.mei || realms.xing;
        realms[realmId] = donor ? JSON.parse(JSON.stringify(donor)) : { blocks: [], claimed: [], processes: [] };
        realms[realmId].blocks = [];
        realms[realmId].storyShard = false;
      }
      realms[realmId].storyShard = true;
    });
  }, id);
}

async function shot(page, name) {
  await page.screenshot({ path: `${shots}/${name}.png` });
}

function oldSave() {
  const save = createInitialState();
  save.inventory.wood = 11;
  save.blocks = [{ id: 'block-1', item: 'plank', x: -2, y: 0, z: 1, rotation: 0, w: 1, d: 1 }];
  save.nextId = 2;
  save.settings.ageBand = 'bigger';
  save.travel.story = { seen: ['letter-ri-1'], letters: ['letter-ri-1'] };
  return save;
}

try {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const old = await boot(desktop, '/', oldSave());
  const before = await old.page.evaluate(() => ({
    fog: __valley.game.state.travel.story.fogIntro,
    wood: __valley.game.state.inventory.wood,
    blocks: __valley.game.state.blocks.length,
    age: __valley.game.state.settings.ageBand,
    opacity: __valley.world.scene.getObjectByName('valley-story')?.children?.[0]?.material?.opacity || 0,
    letters: __valley.game.state.travel.story.letters.slice(),
  }));
  check('旧存档开局还没有雾', before.fog === false && before.opacity === 0);
  check('旧存档的木头和方块还在', before.wood === 11 && before.blocks === 1);
  check('旧的 7–9 岁读成 6–8', before.age === 'junior');
  check('旧信件还在', before.letters.includes('letter-ri-1'));
  await old.page.evaluate(() => __valley.story.setMoment({ period: '晚上', hour: 20, minute: 0, season: '秋' }));
  await step(old.page, 6);
  const intro = await old.page.evaluate(() => ({
    fog: __valley.game.state.travel.story.fogIntro,
    text: document.getElementById('story-banner-text')?.textContent || '',
    opacity: __valley.world.scene.getObjectByName('valley-story')?.children?.[0]?.material?.opacity || 0,
    backup: localStorage.getItem('yuanyuan-river-valley-v1-before-story'),
    blocks: __valley.game.state.blocks.length,
    disk: __valley.world.scene.getObjectByName('valley-story')?.getObjectByName?.('slot-0') ? true : !!__valley.world.targets.find((item) => item.storyId === 'disk'),
  }));
  check('第一次夜晚触发序章', intro.fog === true && intro.text.includes('雾不会伤害任何东西'));
  check('雾只是画面，方块没有少', intro.blocks === 1 && intro.opacity > 0);
  check('第一次写入前有故事备份', typeof intro.backup === 'string' && intro.backup.includes('letter-ri-1'));
  check('观星台石盘出现了', intro.disk === true);
  await old.page.evaluate(() => {
    const world = __valley.world;
    world.playerPosition.set(-5, 0, 5);
    world.yaw = 0.64;
    world.distance = 20;
    world.stopWalking();
    world.updateCamera(1, true);
  });
  await step(old.page, 2);
  calls.fog = await old.page.evaluate(() => __valley.world.renderer.info.render.calls);
  await shot(old.page, 'story-fog-valley');
  await old.page.evaluate(() => {
    const site = __valley.story.site();
    const world = __valley.world;
    const yaw = 0.64;
    world.playerPosition.set(site.x + Math.sin(yaw) * 2.4, 0, site.z + Math.cos(yaw) * 2.4);
    world.yaw = yaw;
    world.distance = 9;
    world.stopWalking();
    world.updateCamera(1, true);
  });
  await step(old.page, 2);
  await shot(old.page, 'story-observatory-disk');
  await old.page.click('#story-skip');
  check('序章可以跳过', await old.page.locator('#story-banner').isHidden());

  await giveShard(old.page, 'xing');
  await step(old.page, 4);
  const starFirst = await old.page.evaluate(() => ({
    restored: __valley.game.state.travel.story.restored.slice(),
    shard: __valley.game.state.travel.realms.ri?.storyShard === true,
  }));
  check('先拿星之片只恢复天空', starFirst.restored.includes('sky') && !starFirst.restored.includes('water') && starFirst.shard === false);
  await old.page.evaluate(() => {
    const world = __valley.world;
    world.playerPosition.set(0.4, 0, 6);
    world.yaw = -1.15;
    world.distance = 14;
    world.stopWalking();
    world.updateCamera(1, true);
  });
  await step(old.page, 2);
  await shot(old.page, 'story-restore-before');
  await giveShard(old.page, 'ri');
  await step(old.page, 3);
  await old.page.evaluate(() => __valley.story.skipCutscene());
  await step(old.page, 4);
  const waterBack = await old.page.evaluate(() => __valley.game.state.travel.story.restored.slice());
  check('再拿潮之片恢复河水', waterBack.includes('water') && waterBack.includes('sky'));
  await shot(old.page, 'story-restore-after');

  if (await old.page.locator('.minimap-card.is-folded').count()) await old.page.click('#map-toggle');
  await old.page.click('#vista-map-button');
  await old.page.waitForSelector('#vista-map');
  await shot(old.page, 'story-star-map');
  const mapText = await old.page.locator('.star-map-key').innerText();
  check('地图叠着星河图', mapText.includes('星河图') && mapText.includes('日谷'));
  await old.page.locator('.panel-header [data-action="close"]').click();

  await giveShard(old.page, 'mei');
  await step(old.page, 6);
  await old.page.evaluate(() => __valley.story.skipCutscene());
  await step(old.page, 2);
  const finale = await old.page.evaluate(() => __valley.story.chapter());
  check('三片齐了进入终章', finale === 'finale');
  await old.page.evaluate(() => {
    const site = __valley.story.site();
    const world = __valley.world;
    const yaw = 0.64;
    world.playerPosition.set(site.x + Math.sin(yaw) * 2.2, 0, site.z + Math.cos(yaw) * 2.2);
    world.yaw = yaw;
    world.distance = 11;
    world.stopWalking();
    world.updateCamera(1, true);
  });
  await step(old.page, 2);
  await old.page.evaluate(() => __valley.interact(__valley.world.targets.find((item) => item.storyId === 'disk')));
  await old.page.waitForSelector('#story-home:not([hidden])');
  const picks = old.page.locator('#story-home-picks button');
  await picks.nth(0).click();
  await picks.nth(1).click();
  await picks.nth(2).click();
  await old.page.click('#story-home-done');
  await step(old.page, 4);
  await old.page.evaluate(() => __valley.story.skipCutscene());
  await step(old.page, 3);
  const home = await old.page.evaluate(() => ({
    places: __valley.game.state.travel.story.homePlaces.length,
    restored: __valley.game.state.travel.story.restored.includes('all'),
    visible: __valley.story.fog().visible,
    blocks: __valley.game.state.blocks.length,
  }));
  check('家之片刻好后雾散开', home.places === 3 && home.restored === true && home.visible === false && home.blocks === 1);
  await old.page.click('#story-festival');
  await step(old.page, 4);
  check('可以自己决定今天办星河节', await old.page.evaluate(() => __valley.game.state.travel.story.festival === true && __valley.story.chapter() === 'done'));
  await shot(old.page, 'story-finale');
  calls.finale = await old.page.evaluate(() => __valley.world.renderer.info.render.calls);
  check('序章页面没有脚本错误', old.errors.length === 0);
  await desktop.close();

  const tablet = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const tourPage = await tablet.newPage();
  tourPage.setDefaultTimeout(30000);
  const tourErrors = [];
  tourPage.on('pageerror', (error) => tourErrors.push(error.message));
  await tourPage.addInitScript(() => {
    localStorage.setItem('yuanyuan-river-valley-v1', 'child-save-marker');
  });
  await tourPage.goto(`${url}/?tour=1`);
  await tourPage.waitForFunction(() => window.__valley?.world);
  await tourPage.click('#start-button');
  await tourPage.evaluate(() => { __valley.game.state.settings.sound = false; });
  await step(tourPage, 6);
  const tour = await tourPage.evaluate(() => ({
    touring: __valley.touring,
    fog: __valley.game.state.travel.story.fogIntro,
    child: localStorage.getItem('yuanyuan-river-valley-v1'),
    tourSave: localStorage.getItem('yuanyuan-river-valley-v1-tour'),
    guide: document.getElementById('tour-guide-text')?.textContent || '',
    next: document.getElementById('tour-next')?.hidden === false,
    bg: __valley.world.scene.background.getStyle(),
  }));
  check('体验模式用独立存档', tour.touring === true && tour.child === 'child-save-marker' && tour.tourSave && !tour.tourSave.includes('child-save-marker'));
  check('体验模式直接进入傍晚并触发序章', tour.fog === true && tour.guide.length > 8);
  check('体验模式有跳到下一章', tour.next === true);
  await tourPage.evaluate(() => {
    const world = __valley.world;
    world.playerPosition.set(-5, 0, 5);
    world.yaw = 0.64;
    world.distance = 20;
    world.stopWalking();
    world.updateCamera(1, true);
  });
  await step(tourPage, 2);
  await shot(tourPage, 'story-tour-guide-tablet');
  await tourPage.evaluate(() => {
    const site = __valley.story.site();
    const world = __valley.world;
    const yaw = 0.64;
    world.playerPosition.set(site.x + Math.sin(yaw) * 2.4, 0, site.z + Math.cos(yaw) * 2.4);
    world.yaw = yaw;
    world.distance = 9;
    world.stopWalking();
    world.updateCamera(1, true);
  });
  await step(tourPage, 2);
  await shot(tourPage, 'story-tablet-disk');
  await tourPage.click('#tour-next');
  await step(tourPage, 4);
  const skipped = await tourPage.evaluate(() => ({
    shard: __valley.game.state.travel.realms.ri.storyShard === true,
    child: localStorage.getItem('yuanyuan-river-valley-v1'),
  }));
  check('跳到下一章只记下当前碎片', skipped.shard === true && skipped.child === 'child-save-marker');
  await tourPage.click('#pause-button');
  await tourPage.getByText('给大人：备份与导入存档').click();
  await tourPage.locator('#age-band').selectOption('senior');
  check('家长可以把年龄改成 9–12', await tourPage.evaluate(() => __valley.game.state.settings.ageBand === 'senior'));
  await tourPage.locator('#story-fog').selectOption('off');
  await step(tourPage, 3);
  check('家长可以关掉雾的画面', await tourPage.evaluate(() => __valley.game.state.travel.story.fogOff === true && __valley.story.fog().visible === false));
  check('体验模式没有脚本错误', tourErrors.length === 0);
  calls.tour = await tourPage.evaluate(() => __valley.world.renderer.info.render.calls);
  await tablet.close();

  await writeFile(`${shots}/story-render-calls.json`, JSON.stringify(calls, null, 2));
  console.log('render.calls', JSON.stringify(calls));
  console.log(`故事检查通过 ${passed.length} 项`);
} finally {
  await browser.close();
}
