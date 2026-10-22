export const BOUNCE_ISLAND = Object.freeze({
  x: 13.1, z: 1.15, radius: 1.78, height: 1.04, rampMinX: 10.6, rampMaxX: 11.5,
});

export const PARK_NAME = '数字乐园';

export const PLAY_MODES = Object.freeze([
  { id: 'count', star: 1, ages: '4+', title: '数一数', color: '#8fd0c6', dx: -1.85, dz: 1.95, hint: '一下一下往上数，听英文。' },
  { id: 'even', star: 2, ages: '5+', title: '双数蹦', color: '#7eb8e8', dx: 0.35, dz: 2.45, hint: '每次加 2：two、four、six。' },
  { id: 'make10', star: 2, ages: '6+', title: '凑十', color: '#e8b56a', dx: 2.40, dz: 1.15, hint: '数到 10。看看还差几。' },
  { id: 'skip', star: 3, ages: '7+', title: '跳着数', color: '#c9a0e8', dx: 2.35, dz: -1.20, hint: '按 2、5 或 10 往前跳。' },
  { id: 'times', star: 4, ages: '8+', title: '乘法蹦', color: '#e8897a', dx: 0.10, dz: -2.50, hint: '一蹦一格乘法表。' },
  { id: 'prime', star: 5, ages: '10+', title: '质数灯', color: '#9ec97a', dx: -1.75, dz: -2.05, hint: '质数只能被 1 和自己整除。' },
]);

export const SKIP_STEPS = Object.freeze([2, 5, 10]);
export const TIMES_TABLES = Object.freeze([2, 3, 4, 5, 6, 7, 8, 9, 10]);

const EN = Object.freeze(['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']);
const ZH = Object.freeze(['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十']);

export function playMode(id) {
  return PLAY_MODES.find(item => item.id === id) || PLAY_MODES[0];
}

export function bounceWord(n) {
  const count = Math.max(0, Math.floor(Number(n) || 0));
  if (count <= 20) return EN[count] || '';
  if (count < 30) return `twenty-${EN[count - 20]}`;
  return String(count);
}

export function bounceZh(n) {
  const count = Math.max(0, Math.floor(Number(n) || 0));
  if (count === 0) return '';
  return count <= 20 ? ZH[count] : String(count);
}

export function isPrime(n) {
  const value = Math.floor(Number(n) || 0);
  if (value < 2) return false;
  if (value % 2 === 0) return value === 2;
  for (let i = 3; i * i <= value; i += 2) if (value % i === 0) return false;
  return true;
}

export function factorPair(n) {
  const value = Math.floor(Number(n) || 0);
  if (value < 2) return null;
  for (let i = 2; i * i <= value; i += 1) if (value % i === 0) return [i, value / i];
  return [1, value];
}

function clampStep(step) {
  return SKIP_STEPS.includes(step) ? step : 2;
}

function clampTable(table) {
  return TIMES_TABLES.includes(table) ? table : 2;
}

function pack({ mode, n, count, note, formula = '', tone = 'plain', milestone = false, speechEn, speechZh }) {
  const even = count % 2 === 0;
  const word = bounceWord(count);
  const zh = bounceZh(count);
  return {
    mode, n, count, word, zh, even, note, formula, tone, milestone,
    speechEn: speechEn ?? word,
    speechZh: speechZh ?? (zh ? `${zh}，${count}` : note),
  };
}

export function playBounce(modeId, n, opts = {}) {
  const mode = playMode(modeId).id;
  const bounce = Math.max(0, Math.floor(Number(n) || 0));
  const step = clampStep(Number(opts.step) || 2);
  const table = clampTable(Number(opts.table) || 2);
  if (bounce === 0) {
    const meta = playMode(mode);
    return {
      mode, n: 0, count: 0, word: meta.title, zh: meta.title, even: false,
      note: `${meta.ages} · ${meta.hint}`, formula: '', tone: 'plain', milestone: false,
      speechEn: '', speechZh: `${meta.title}。${meta.hint}`,
    };
  }

  if (mode === 'even') {
    const count = bounce * 2;
    const milestone = count === 10 || count === 20;
    return pack({
      mode, n: bounce, count,
      note: bounce === 1 ? 'even · 从 2 开始' : `${count - 2} + 2 = ${count}`,
      formula: bounce === 1 ? '2, 4, 6…' : `${count - 2} + 2 = ${count}`,
      tone: milestone ? 'win' : 'even',
      milestone,
      speechZh: milestone ? `${bounceZh(count)}，十的双数` : `${bounceZh(count)}，双数`,
    });
  }

  if (mode === 'make10') {
    const count = bounce;
    const left = 10 - count;
    if (count < 10) {
      return pack({
        mode, n: bounce, count,
        note: `还差 ${left}`,
        formula: `${count} + ${left} = 10`,
        speechZh: `${bounceZh(count)}，还差 ${left}`,
      });
    }
    if (count === 10) {
      return pack({
        mode, n: bounce, count, note: 'ten · 凑到十啦', formula: '10 = 10', tone: 'win', milestone: true,
        speechZh: '十，凑到十啦',
      });
    }
    return pack({
      mode, n: bounce, count,
      note: count % 2 === 0 ? 'even · 超过十了' : 'odd · 超过十了',
      formula: `10 + ${count - 10} = ${count}`,
      speechZh: `${bounceZh(count)}，是 10 加 ${count - 10}`,
    });
  }

  if (mode === 'skip') {
    const count = bounce * step;
    const milestone = count === 10 || count === 20 || count === 50 || count === 100;
    return pack({
      mode, n: bounce, count,
      note: `skip ${step} · 每次加 ${step}`,
      formula: bounce === 1 ? `${count}` : `${count - step} + ${step} = ${count}`,
      tone: milestone ? 'win' : 'plain',
      milestone,
      speechZh: `${bounceZh(count)}，每次加 ${step}`,
    });
  }

  if (mode === 'times') {
    const count = bounce * table;
    const milestone = bounce === 10;
    return pack({
      mode, n: bounce, count,
      note: `${bounce} times ${table}`,
      formula: `${bounce} × ${table} = ${count}`,
      tone: milestone ? 'win' : 'plain',
      milestone,
      speechEn: `${bounceWord(bounce)} times ${bounceWord(table)} equals ${bounceWord(count)}`,
      speechZh: `${bounceZh(bounce)} 乘 ${bounceZh(table)} 等于 ${bounceZh(count)}`,
    });
  }

  if (mode === 'prime') {
    const count = bounce;
    if (count === 1) {
      return pack({
        mode, n: bounce, count, note: 'one 不是质数', formula: '1 只有它自己',
        speechZh: '一，不是质数',
      });
    }
    if (isPrime(count)) {
      return pack({
        mode, n: bounce, count, note: 'prime · 质数', formula: `只有 1 和 ${count}`,
        tone: 'prime', milestone: count === 2 || count === 11 || count === 13,
        speechZh: `${bounceZh(count)}，质数`,
      });
    }
    const [a, b] = factorPair(count);
    return pack({
      mode, n: bounce, count, note: 'composite · 合数', formula: `${count} = ${a} × ${b}`,
      tone: 'plain',
      speechZh: `${bounceZh(count)}，等于 ${bounceZh(a)} 乘 ${bounceZh(b)}`,
    });
  }

  const count = bounce;
  const even = count % 2 === 0;
  let note = even ? 'even · 双数' : 'odd · 单数';
  let formula = '';
  let tone = even ? 'even' : 'odd';
  let milestone = false;
  if (count === 1) note = 'first · 第一下';
  else if (count === 2) { note = '1 + 1 = 2'; formula = '1 + 1 = 2'; }
  else if (count === 4) { note = '2 + 2 = 4'; formula = '2 + 2 = 4'; }
  else if (count === 5) note = 'high five';
  else if (count === 8) { note = '2 + 2 + 2 + 2 = 8'; formula = '2 + 2 + 2 + 2 = 8'; }
  else if (count === 10) { note = 'ten · 十下啦'; formula = '10'; tone = 'win'; milestone = true; }
  return pack({ mode: 'count', n: bounce, count, note, formula, tone, milestone });
}

export function bounceInfo(n) {
  return playBounce('count', n);
}

export function onBounceIsland(x, z, extra = 0) {
  return Math.hypot(x - BOUNCE_ISLAND.x, z - BOUNCE_ISLAND.z) <= BOUNCE_ISLAND.radius + extra;
}

export function parkPadAt(x, z) {
  for (const mode of PLAY_MODES) {
    if (Math.hypot(x - (BOUNCE_ISLAND.x + mode.dx), z - (BOUNCE_ISLAND.z + mode.dz)) <= 0.58) return mode.id;
  }
  return null;
}

export function inNumberPark(x, z, extra = 0) {
  if (onBounceIsland(x, z, extra)) return true;
  return PLAY_MODES.some(mode => Math.hypot(x - (BOUNCE_ISLAND.x + mode.dx), z - (BOUNCE_ISLAND.z + mode.dz)) <= 0.62 + extra);
}

const JUNIOR_MODES = Object.freeze(['count', 'even', 'make10']);

export function unlockedParkModes(band) {
  if (band === 'senior' || band === 'older') return PLAY_MODES.map((mode) => mode.id);
  if (band === 'junior' || band === 'little' || band === 'bigger') return [...JUNIOR_MODES];
  return PLAY_MODES.map((mode) => mode.id);
}

export function makeParkQuestion(mode = 'count', index = 0, simple = false) {
  const step = Math.abs(Math.floor(Number(index) || 0)) % 5;
  if (mode === 'even') {
    const answer = (step + 1) * 2;
    return { prompt: simple ? '哪一块是双数？' : '哪一块是双数？', choices: [answer, answer + 1, answer + 3], answer };
  }
  if (mode === 'make10') {
    const have = (step % 8) + 1;
    const answer = 10 - have;
    return { prompt: simple ? `有 ${have} 个，还差几是 10？` : `有 ${have} 个，还差几是 10？`, choices: [answer, answer + 1, Math.max(1, answer - 1)], answer };
  }
  if (mode === 'skip' || mode === 'times' || mode === 'prime') {
    const answer = mode === 'prime' ? [2, 3, 5, 7, 11][step] : (step + 2) * (mode === 'times' ? 3 : 2);
    const choices = [answer, answer + 1, answer + 4];
    const prompt = simple ? `跳到 ${answer}` : (mode === 'times' ? `几乘三是 ${answer}？` : `跳到 ${answer}`);
    return { prompt, choices, answer };
  }
  const answer = step + 1;
  return { prompt: simple ? `跳到数字 ${answer}` : `跳到数字 ${answer}`, choices: [answer, answer + 1, answer + 2], answer };
}

export function bounceSurface(x, z) {
  if (onBounceIsland(x, z)) return BOUNCE_ISLAND.height;
  if (z >= BOUNCE_ISLAND.z - 0.55 && z <= BOUNCE_ISLAND.z + 0.55 && x >= BOUNCE_ISLAND.rampMinX && x <= BOUNCE_ISLAND.x - BOUNCE_ISLAND.radius + 0.2) {
    const t = (x - BOUNCE_ISLAND.rampMinX) / (BOUNCE_ISLAND.x - BOUNCE_ISLAND.radius + 0.2 - BOUNCE_ISLAND.rampMinX);
    return Math.max(0, t) * BOUNCE_ISLAND.height;
  }
  return null;
}
