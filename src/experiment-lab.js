/** One-change experiments: gravity compare, and whether salty water grows a crystal. */

import { ballGravity, gravityOf, simulateJump } from './motion-gravity.js';

export const CRYSTAL_SECONDS = 20;
export const SATURATION_SALT = 2;
export const EXPERIMENT_LIMIT = 24;

export const CRYSTAL_NOTE = '盐加清水，先溶解，再静置。溶液饱和时会析出盐晶；不饱和时长不出来，或者只有很少。时间在游戏里缩短了。这是真实规律的简化，不是完整的结晶过程。';
export const GRAVITY_NOTE = '同样的规律，不同的参数；这是简化模型，不是完整的行星物理。';
export const GRAVITY_CHILD = '规律还是同一个，只是这颗星拉东西的力小一点（约为地球的 1/3）。';

const NASA_WEIGHT = 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/weight-equation-2/';
const NASA_MOON = 'https://science.nasa.gov/moon/by-the-numbers/';

export const GRAVITY_REF = Object.freeze({
  text: '外星谷的重力按火星表面重量大约是地球的三分之一来取参数。月球大约是六分之一，这里不用月球的数。外星谷本身是虚构的。',
  refs: Object.freeze([NASA_WEIGHT, NASA_MOON]),
  review: Object.freeze({ status: 'draft' }),
});

export function crystalPlan(salt, water = 1) {
  const amount = Number(salt) || 0;
  const cups = Number(water) || 1;
  const saturated = amount >= SATURATION_SALT * cups;
  return {
    salt: amount,
    water: cups,
    saturated,
    yield: saturated ? 1 : 0,
    sparse: !saturated && amount > 0,
  };
}

export function crystalStage(elapsed, saturated) {
  const time = Number(elapsed) || 0;
  if (time >= CRYSTAL_SECONDS) return saturated ? 'ready' : 'sparse';
  if (time >= CRYSTAL_SECONDS / 2) return 'rest';
  return 'dissolve';
}

export function advanceCrystal(proc, seconds = 1, { paused = false, hidden = false } = {}) {
  if (!proc || proc.kind !== 'crystal') return proc;
  if (paused || hidden) return { ...proc };
  if (proc.stage === 'ready' || proc.stage === 'sparse') return { ...proc };
  const elapsed = Math.min(CRYSTAL_SECONDS, (Number(proc.elapsed) || 0) + Math.max(0, Number(seconds) || 0));
  return { ...proc, elapsed, stage: crystalStage(elapsed, proc.saturated === true) };
}

export function gravityCompare(dt = 1 / 60) {
  const home = simulateJump({ realmId: 'he', dt });
  const xing = simulateJump({ realmId: 'xing', dt });
  return {
    home,
    xing,
    homeGravity: gravityOf('he'),
    xingGravity: gravityOf('xing'),
    ballHome: ballGravity('he'),
    ballXing: ballGravity('xing'),
    note: GRAVITY_NOTE,
    child: GRAVITY_CHILD,
    ref: GRAVITY_REF,
  };
}

export const LAB_STEPS = Object.freeze([
  { id: 'guess', label: '猜一猜' },
  { id: 'change', label: '只改一个条件' },
  { id: 'do', label: '做' },
  { id: 'look', label: '看结果' },
  { id: 'say', label: '说结论' },
]);

export const QUARANTINE_CARD = Object.freeze({
  title: '活的不能随便带回家',
  text: '黄石公园的公开介绍里列出 225 种入侵植物。把外地的活植物或动物带回家，可能挤占原来生活在那里的生物。所以外星谷的幻想生物只放进展柜，不种、不放养。',
  ref: 'https://nps.gov/yell/planyourvisit/parkfacts.htm',
  review: Object.freeze({ status: 'draft' }),
});
