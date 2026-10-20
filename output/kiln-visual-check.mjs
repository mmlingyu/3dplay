import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const url = 'http://127.0.0.1:6010/play/';
await mkdir('output', { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__valley?.world);
await page.click('#start-button');
await page.evaluate(() => { __valley.game.state.settings.sound = false; });

const stages = [
  ['moistening', 1, 'normal'],
  ['drying', 9, 'normal'],
  ['firing', 14, 'normal'],
  ['cooling', 21, 'normal'],
  ['ready', 24, 'normal'],
  ['failed', 24, 'wet'],
];

async function pose(stage, elapsed, mode) {
  return page.evaluate(({ stage, elapsed, mode }) => {
    const world = __valley.world;
    const game = __valley.game;
    game.state.kiln = { stage, elapsed, count: 2, mode };
    world.sync(game.state);
    world.kilnShown = elapsed;
    world.time = 1.4;
    const kiln = world.targets.find((t) => t.id === 'kiln');
    world.modelFocus = { id: 'kiln', point: kiln.position.clone(), distance: 4.6, lift: 0.62 };
    world.stopWalking();
    world.playerPosition.set(-2.6, 0, -1.1);
    for (let i = 0; i < 30; i++) world.update(1 / 30, { x: 0, z: 0 }, true);
    world.animateKiln(0.016, false);
    const color = world.kilnPiece.material.color;
    return {
      hint: kiln.hint,
      visible: world.kilnPiece.visible,
      color: `#${color.getHexString()}`,
      y: Number(world.kilnPiece.position.y.toFixed(3)),
      z: Number(world.kilnPiece.position.z.toFixed(3)),
      crack: world.kilnCrack.visible,
      steam: world.kilnSteam.filter((puff) => puff.visible).length,
      flames: world.kilnFlames.filter((flame) => flame.visible).length,
      glow: Number(world.kilnGlow.material.emissiveIntensity.toFixed(2)),
    };
  }, { stage, elapsed, mode });
}

const report = { errors, stages: {}, panel: null };
for (const [stage, elapsed, mode] of stages) {
  report.stages[stage] = await pose(stage, elapsed, mode);
  await page.screenshot({ path: `output/kiln-${stage}.png` });
}

report.panel = await page.evaluate(() => {
  const game = __valley.game;
  game.state.inventory.clay = 4;
  game.state.inventory.branch = 2;
  game.state.kiln = { stage: 'idle', elapsed: 0, count: 0, mode: 'normal' };
  const started = game.startKiln(2, 'normal');
  __valley.openPanel('kiln');
  const card = document.querySelector('.kiln-stage-card');
  const before = document.querySelector('#kiln-phase')?.textContent;
  game.tick(7);
  const afterCard = document.querySelector('.kiln-stage-card');
  return {
    started: started.message,
    panelOpen: __valley.panels.type(),
    sameCard: card === afterCard,
    before,
    after: document.querySelector('#kiln-phase')?.textContent,
    note: document.querySelector('#kiln-progress')?.textContent,
    width: document.querySelector('.progress-fill')?.style.width,
    closedOnStart: false,
  };
});

report.closedOnStart = await page.evaluate(() => {
  __valley.game.state.kiln = { stage: 'idle', elapsed: 0, count: 0, mode: 'normal' };
  __valley.game.state.inventory.clay = 4;
  __valley.game.state.inventory.branch = 2;
  __valley.openPanel('kiln');
  document.querySelector('[data-action="kiln-start"][data-mode="normal"]').click();
  return { panel: __valley.panels.type(), stage: __valley.game.state.kiln.stage, piece: __valley.world.kilnPiece.visible };
});

console.log(JSON.stringify(report, null, 2));
await browser.close();
if (errors.length) process.exitCode = 1;
