/** Alien-valley actions. Stamps and souvenirs do not require a puzzle. */

import { CRYSTAL_SECONDS, advanceCrystal, crystalPlan, crystalStage, gravityCompare } from './experiment-lab.js';
import { GLYPH_IDS, gradePuzzle } from './glyph-data.js';
import { XING_STAMPS, PUZZLE_SALT } from './xing-data.js';
import { quarantineMessage } from './xing-save.js';

const ok = (message, extra = {}) => ({ ok: true, message, ...extra });
const fail = (message) => ({ ok: false, message });
const isCount = (value) => Number.isSafeInteger(value) && value >= 0 && value <= 1000000;

function grantStamp(state, id) {
  if (!state.travel.stamps.includes(id)) state.travel.stamps.push(id);
}

function realm(state) {
  return state.travel.realms.xing;
}

export function startCrystal(game, much = true) {
  if (game.currentRealm() !== 'xing') return fail('先到外星谷的试验站。');
  const salt = much ? 2 : 1;
  if ((game.state.inventory.salt || 0) < salt) return fail('盐还不够。盐湖一直可以取，不用答题。');
  if ((game.state.inventory.water || 0) < 1) return fail('还要一份清水。不用答题。');
  const running = realm(game.state)?.processes?.find((item) => item.kind === 'crystal' && item.stage !== 'ready' && item.stage !== 'sparse');
  if (running) return fail('这杯还在静置。');
  const plan = crystalPlan(salt, 1);
  game.mutate((state) => {
    state.inventory.salt -= salt;
    state.inventory.water -= 1;
    const spot = realm(state);
    spot.processes = spot.processes.filter((item) => item.kind !== 'crystal');
    spot.processes.push({
      id: 'crystal',
      kind: 'crystal',
      elapsed: 0,
      stage: crystalStage(0, plan.saturated),
      salt,
      saturated: plan.saturated,
    });
  });
  return ok(plan.saturated ? '盐放得比较多。静置之后，饱和的溶液会析出晶体。时间缩短了。' : '盐放得少一些。不饱和时晶体很少，或者长不出来。');
}

export function crystalStatus(game) {
  const proc = game.state.travel?.realms?.xing?.processes?.find((item) => item.kind === 'crystal') || null;
  if (!proc) return { stage: 'idle', elapsed: 0, ready: false, sparse: false, saturated: false };
  return {
    stage: proc.stage,
    elapsed: proc.elapsed,
    ready: proc.stage === 'ready',
    sparse: proc.stage === 'sparse',
    saturated: proc.saturated === true,
    total: CRYSTAL_SECONDS,
  };
}

export function claimCrystal(game) {
  const proc = game.state.travel?.realms?.xing?.processes?.find((item) => item.kind === 'crystal');
  if (!proc) return fail('还没有开始培养盐晶。');
  if (proc.stage === 'sparse') {
    game.mutate((state) => {
      realm(state).processes = realm(state).processes.filter((item) => item.kind !== 'crystal');
    });
    return ok('这次盐不够饱和，没有可以收下的晶体。可以再取盐试一次。');
  }
  if (proc.stage !== 'ready') return fail('还在溶解或静置。看面板时它会继续。暂停或离开页面就停住。');
  if (!isCount((game.state.inventory['salt-crystal'] || 0) + 1)) return fail('背包里的盐晶已经很多了。');
  game.mutate((state) => {
    state.inventory['salt-crystal'] += 1;
    realm(state).processes = realm(state).processes.filter((item) => item.kind !== 'crystal');
    grantStamp(state, 'xing-crystal-first');
  });
  return ok('收下一块盐晶。时间在游戏里缩短了。这是简化的结晶。');
}

export function tickCrystals(state, seconds, { paused = false, hidden = false } = {}) {
  for (const spot of Object.values(state.travel?.realms || {})) {
    for (const proc of spot.processes || []) {
      if (proc.kind !== 'crystal') continue;
      const next = advanceCrystal(proc, seconds, { paused, hidden });
      proc.elapsed = next.elapsed;
      proc.stage = next.stage;
    }
  }
}

export function seeMoss(game) {
  if (game.currentRealm() !== 'xing') return fail('光苔长在外星谷。');
  game.mutate((state) => {
    const spot = realm(state);
    if (!spot.claimed.includes('xing-moss-seen')) spot.claimed.push('xing-moss-seen');
    grantStamp(state, 'xing-moss-seen');
  });
  return ok('这是游戏里的幻想生物。可以装进展柜，不能种回河谷。');
}

export function seeHopper(game) {
  if (game.currentRealm() !== 'xing') return fail('跳跳球兽住在外星谷。');
  return ok('跳跳球兽是游戏里的幻想动物。它留在这里，不会变成材料。');
}

export function reuniteGugu(game) {
  if (game.currentRealm() !== 'xing') return fail('先和小咕一起到外星谷。');
  const already = game.state.travel.stamps.includes('xing-gugu-home');
  game.mutate((state) => {
    if (!state.travel.story.seen.includes('xing-gugu-home')) state.travel.story.seen.push('xing-gugu-home');
    grantStamp(state, 'xing-gugu-home');
    if ((state.inventory['glyph-plaque'] || 0) < 1 && isCount((state.inventory['glyph-plaque'] || 0) + 1)) {
      state.inventory['glyph-plaque'] += 1;
    }
  });
  return ok(already ? '小咕已经回家了。符号牌还在。' : '小咕到家了。印章盖好，符号牌也在背包里。不用解谜。');
}

export function grantPlaque(game) {
  if ((game.state.inventory['glyph-plaque'] || 0) >= 1) return ok('符号牌已经在背包里。点一下会听到问候。');
  if (!isCount(1)) return fail('背包里的符号牌已经很多了。');
  game.mutate((state) => { state.inventory['glyph-plaque'] += 1; });
  return ok('收下小咕的符号牌。不用解谜。');
}

export function recordExperiment(game, kind, band = 'little') {
  if (game.currentRealm() !== 'xing') return fail('试验站在外星谷。');
  if (kind !== 'gravity' && kind !== 'crystal') return fail('这个实验还不认识。');
  const age = band === 'bigger' || band === 'older' ? band : 'little';
  const compare = gravityCompare();
  game.mutate((state) => {
    const spot = realm(state);
    if (spot.experiments.length < 24 && !spot.experiments.some((item) => item.kind === kind && item.band === age)) {
      const number = spot.experiments.length + 1;
      spot.experiments.push({
        id: `exp-${kind}-${number}`,
        kind,
        band: age,
        homeApex: Math.round(compare.home.apex * 1000) / 1000,
        xingApex: Math.round(compare.xing.apex * 1000) / 1000,
      });
    }
    grantStamp(state, 'xing-experiment');
  });
  return ok('做完一次对照。只改了重力这一个条件。', { compare });
}

export function learnGlyphs(game, ids = []) {
  if (game.currentRealm() !== 'xing') return fail('符号路牌在外星谷。');
  game.mutate((state) => {
    const spot = realm(state);
      for (const id of ids) {
      if (typeof id === 'string' && GLYPH_IDS.has(id) && !spot.glyphs.includes(id) && spot.glyphs.length < 32) spot.glyphs.push(id);
    }
  });
  return ok('这个符号学会了。路牌会写出意思。不学也能到处走。');
}

export function solvePuzzle(game, puzzle, choiceId) {
  const graded = gradePuzzle(puzzle, choiceId);
  if (!graded.ok) return ok('再看一次也没关系。材料不会少。', { correct: false, learn: [] });
  if (game.currentRealm() === 'xing' && puzzle?.id) {
    game.mutate((state) => {
      const spot = realm(state);
      if (typeof puzzle.id === 'string' && /^p-(little|bigger|older)-(pair|color|count|order)-[a-z0-9-]{1,24}$/.test(puzzle.id) && !spot.puzzles.includes(puzzle.id) && spot.puzzles.length < 64) spot.puzzles.push(puzzle.id);
      for (const id of graded.learn) {
        if (GLYPH_IDS.has(id) && !spot.glyphs.includes(id) && spot.glyphs.length < 32) spot.glyphs.push(id);
      }
      const sticker = `xing-puzzle-${puzzle.kind}`;
      if (!state.travel.stickers.includes(sticker) && state.travel.stickers.length < 64) state.travel.stickers.push(sticker);
      if (isCount((state.inventory.salt || 0) + PUZZLE_SALT)) state.inventory.salt += PUZZLE_SALT;
    });
  }
  return ok(`解开了。得到 ${PUZZLE_SALT} 份盐。不解开也能采集。`, { correct: true, learn: graded.learn });
}

export function rewardXingSupply(game, tutorId = 'gugu') {
  if (typeof tutorId !== 'string' || !/^[a-z0-9-]{1,64}$/.test(tutorId)) return fail('这份补给的内容不正确。');
  if ((game.state.clock.elapsed || 0) < (game.state.travel.supplyAt || 0)) return fail('这份小补给稍后再领。盐湖随时可以取，不用等。');
  if (!isCount((game.state.inventory.salt || 0) + PUZZLE_SALT)) return fail('背包里的盐已经很多了。');
  game.mutate((state) => {
    state.inventory.salt += PUZZLE_SALT;
    state.travel.supplyAt = state.clock.elapsed + 180;
    const sticker = `xing-quiz-${tutorId}`;
    if (!state.travel.stickers.includes(sticker)) state.travel.stickers.push(sticker);
  });
  return ok(`得到 ${PUZZLE_SALT} 份盐。这是可选补给，不去答题也能采集。`);
}

export function sowCheck(itemId = 'seed') {
  const blocked = quarantineMessage(itemId);
  if (blocked) return fail(blocked);
  if (itemId !== 'seed') return fail('这里种的是豆种。');
  return null;
}

export function releaseCheck(itemId) {
  const blocked = quarantineMessage(itemId);
  if (blocked) return fail(blocked);
  return fail('动物留在原地看一看，不会变成材料。');
}

export function stampIds() {
  return XING_STAMPS.map((stamp) => stamp.id);
}

export function stampsWithoutQuiz(game) {
  return XING_STAMPS.every((stamp) => game.state.travel.stamps.includes(stamp.id));
}
