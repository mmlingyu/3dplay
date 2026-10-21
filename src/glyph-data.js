/** Alien glyph rules. Color is category, dots are count, order is who-did-what. Digits are base 4. */

export const GLYPH_COLORS = Object.freeze({
  blue: '水',
  green: '植物',
  orange: '动物',
  gray: '工具',
  violet: '动作',
  ink: '数字',
});

export const GLYPHS = Object.freeze([
  { id: 'drop', name: '水滴', color: 'blue', kind: 'thing', category: 'water' },
  { id: 'pool', name: '水洼', color: 'blue', kind: 'thing', category: 'water' },
  { id: 'rain', name: '雨', color: 'blue', kind: 'thing', category: 'water' },
  { id: 'sprout', name: '嫩芽', color: 'green', kind: 'thing', category: 'plant' },
  { id: 'leaf', name: '叶子', color: 'green', kind: 'thing', category: 'plant' },
  { id: 'moss', name: '光苔', color: 'green', kind: 'thing', category: 'plant', fantasy: true },
  { id: 'hopper', name: '跳跳球兽', color: 'orange', kind: 'thing', category: 'animal', fantasy: true },
  { id: 'bird', name: '圆鸟', color: 'orange', kind: 'thing', category: 'animal' },
  { id: 'lens', name: '放大镜', color: 'gray', kind: 'thing', category: 'tool' },
  { id: 'lamp', name: '小灯', color: 'gray', kind: 'thing', category: 'tool' },
  { id: 'case', name: '展柜', color: 'gray', kind: 'thing', category: 'tool' },
  { id: 'basket', name: '篮子', color: 'gray', kind: 'thing', category: 'tool' },
  { id: 'see', name: '看', color: 'violet', kind: 'action', category: 'action' },
  { id: 'give', name: '给', color: 'violet', kind: 'action', category: 'action' },
  { id: 'grow', name: '长', color: 'violet', kind: 'action', category: 'action' },
  { id: 'jump', name: '跳', color: 'violet', kind: 'action', category: 'action' },
  { id: 'd0', name: '0', color: 'ink', kind: 'digit', category: 'digit', value: 0 },
  { id: 'd1', name: '1', color: 'ink', kind: 'digit', category: 'digit', value: 1 },
  { id: 'd2', name: '2', color: 'ink', kind: 'digit', category: 'digit', value: 2 },
  { id: 'd3', name: '3', color: 'ink', kind: 'digit', category: 'digit', value: 3 },
]);

export const GLYPH_IDS = new Set(GLYPHS.map((glyph) => glyph.id));

const THINGS = GLYPHS.filter((glyph) => glyph.kind === 'thing');
const ACTIONS = GLYPHS.filter((glyph) => glyph.kind === 'action');
const BASKETS = Object.freeze([
  { id: 'water', label: '水', icon: 'drop' },
  { id: 'plant', label: '植物', icon: 'sprout' },
  { id: 'animal', label: '动物', icon: 'bird' },
  { id: 'tool', label: '工具', icon: 'lens' },
]);

export const PUZZLE_KINDS = Object.freeze({
  little: Object.freeze(['pair', 'color', 'count']),
  bigger: Object.freeze(['pair', 'color', 'count', 'order']),
  older: Object.freeze(['pair', 'color', 'count', 'order']),
});

export function glyphById(id) {
  return GLYPHS.find((glyph) => glyph.id === id) || null;
}

export function kindsFor(band) {
  return PUZZLE_KINDS[band] ? [...PUZZLE_KINDS[band]] : [];
}

/** Alien digits use four fingers. "10" is our 4. "33" is our 15. Range 0..63. */
export function toAlien(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 63) throw new Error('外星数字这里只写 0 到 63。');
  if (n === 0) return '0';
  let rest = n;
  let text = '';
  while (rest > 0) {
    text = String(rest % 4) + text;
    rest = Math.floor(rest / 4);
  }
  return text;
}

export function fromAlien(text) {
  if (typeof text !== 'string' || !/^[0-3]+$/.test(text) || text.length > 3) return null;
  let n = 0;
  for (const ch of text) n = n * 4 + Number(ch);
  if (n > 63) return null;
  return n;
}

function seedNumber(seed) {
  const text = String(seed ?? '0');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rngFor(seed) {
  let state = seedNumber(seed) || 1;
  return () => {
    state |= 0;
    state = (state + 0x6D2B79F5) | 0;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next;
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function take(rng, list) {
  return list[Math.floor(rng() * list.length) % list.length];
}

function shuffle(rng, list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function choiceSet(rng, correct, distractors) {
  const items = [
    { id: String(correct.id), label: correct.label, icon: correct.icon || correct.id, ok: true },
    ...distractors.map((item) => ({ id: String(item.id), label: item.label, icon: item.icon || item.id, ok: false })),
  ];
  const ids = new Set(items.map((item) => item.id));
  if (ids.size !== items.length) throw new Error('谜题选项重复了。');
  return shuffle(rng, items);
}

function safeSeed(seed) {
  const text = String(seed ?? '0').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
  return text || '0';
}

function puzzleShell(band, kind, seed, extra) {
  return {
    id: `p-${band}-${kind}-${safeSeed(seed)}`,
    band,
    kind,
    seed: safeSeed(seed),
    base4: false,
    ...extra,
  };
}

function pairPuzzle(band, rng, seed) {
  const pool = band === 'little' ? THINGS.slice(0, 6) : THINGS.slice(0, 10);
  const glyph = take(rng, pool);
  const wrong = shuffle(rng, pool.filter((item) => item.id !== glyph.id)).slice(0, 2);
  if (band === 'older') {
    const action = take(rng, ACTIONS);
    const object = take(rng, THINGS.filter((item) => item.id !== glyph.id));
    const right = `${glyph.name}${action.name}${object.name}`;
    const swapped = `${object.name}${action.name}${glyph.name}`;
    const other = `${glyph.name}${take(rng, ACTIONS.filter((item) => item.id !== action.id)).name}${object.name}`;
    return puzzleShell(band, 'pair', seed, {
      prompt: '这些符号连起来是哪一句？',
      speak: '谁，做了什么，对谁。',
      learn: [glyph.id, action.id, object.id],
      hint: '顺序是：谁，动作，对象。',
      answer: right,
      choices: choiceSet(rng, { id: 'phrase-right', label: right, icon: glyph.id }, [
        { id: 'phrase-swap', label: swapped, icon: object.id },
        { id: 'phrase-other', label: other, icon: action.id },
      ]),
    });
  }
  return puzzleShell(band, 'pair', seed, {
    prompt: band === 'little' ? '点一样的图' : `这是哪一个符号？`,
    speak: glyph.name,
    focus: glyph.id,
    learn: [glyph.id],
    hint: `${GLYPH_COLORS[glyph.color]}这一类里，找${glyph.name}。`,
    answer: glyph.name,
    choices: choiceSet(rng, { id: glyph.id, label: glyph.name, icon: glyph.id }, wrong.map((item) => ({ id: item.id, label: item.name, icon: item.id }))),
  });
}

function colorPuzzle(band, rng, seed) {
  const glyph = take(rng, THINGS);
  if (band === 'older') {
    return puzzleShell(band, 'color', seed, {
      prompt: '颜色在这套符号里表示什么？',
      speak: '看颜色，再说规则。',
      learn: [glyph.id],
      hint: '蓝色是水，绿色是植物，橙色是动物，灰色是工具。',
      answer: '颜色表示类别',
      ruleCard: true,
      choices: choiceSet(rng, { id: 'category', label: '颜色表示类别', icon: glyph.id }, [
        { id: 'amount', label: '颜色表示数量', icon: 'd1' },
        { id: 'order', label: '颜色表示谁先谁后', icon: 'see' },
      ]),
    });
  }
  const correct = BASKETS.find((item) => item.id === glyph.category);
  const wrong = shuffle(rng, BASKETS.filter((item) => item.id !== correct.id)).slice(0, 2);
  return puzzleShell(band, 'color', seed, {
    prompt: band === 'little' ? '把它放进同样颜色的篮子' : '看颜色，猜这个新符号和什么有关',
    speak: GLYPH_COLORS[glyph.color],
    focus: glyph.id,
    learn: [glyph.id],
    hint: `${GLYPH_COLORS[glyph.color]}用的是这个颜色。`,
    answer: correct.label,
    choices: choiceSet(rng, correct, wrong),
  });
}

function countPuzzle(band, rng, seed) {
  if (band === 'older') {
    const value = Math.floor(rng() * 64);
    const alien = toAlien(value);
    const distract = new Set([value]);
    const wrong = [];
    while (wrong.length < 2) {
      const next = Math.floor(rng() * 64);
      if (distract.has(next)) continue;
      distract.add(next);
      wrong.push(next);
    }
    return puzzleShell(band, 'count', seed, {
      prompt: `外星数字 ${alien} 等于我们的几？`,
      speak: `外星的 ${alien}`,
      learn: ['d0', 'd1', 'd2', 'd3'],
      hint: '小咕有四根手指。外星的 10 等于我们的 4。',
      answer: String(value),
      base4: true,
      alien,
      decimal: value,
      choices: choiceSet(rng, { id: `n-${value}`, label: String(value), icon: 'd1' }, wrong.map((item) => ({ id: `n-${item}`, label: String(item), icon: 'd2' }))),
    });
  }
  if (band === 'bigger') {
    const left = 1 + Math.floor(rng() * 3);
    const right = 1 + Math.floor(rng() * 3);
    const sum = left + right;
    const wrong = [sum + 1, Math.max(1, sum - 1)].filter((item, index, list) => item !== sum && list.indexOf(item) === index);
    while (wrong.length < 2) wrong.push(sum + 2 + wrong.length);
    return puzzleShell(band, 'count', seed, {
      prompt: `${left} 个点再加上 ${right} 个点，是多少？`,
      speak: `${left} 加 ${right}`,
      learn: ['d1', 'd2', 'd3'],
      hint: '把两边的点一个一个数完。',
      answer: String(sum),
      choices: choiceSet(rng, { id: `n-${sum}`, label: String(sum), icon: 'd1' }, wrong.slice(0, 2).map((item) => ({ id: `n-${item}`, label: String(item), icon: 'd2' }))),
    });
  }
  const dots = 1 + Math.floor(rng() * 3);
  return puzzleShell(band, 'count', seed, {
    prompt: '数一数有几个点',
    speak: '数一点',
    learn: [`d${dots}`],
    dots,
    hint: '用手指点着数。',
    answer: String(dots),
    choices: [1, 2, 3].map((item) => ({ id: `n-${item}`, label: String(item), icon: `d${item}`, ok: item === dots })),
  });
}

function orderPuzzle(band, rng, seed) {
  const subject = take(rng, THINGS.filter((item) => item.category === 'animal'));
  const action = take(rng, ACTIONS);
  const object = take(rng, THINGS.filter((item) => item.category !== 'animal'));
  if (band === 'older') {
    const right = `${subject.name}${action.name}${object.name}`;
    const early = `${action.name}${subject.name}${object.name}`;
    const swap = `${object.name}${action.name}${subject.name}`;
    return puzzleShell(band, 'order', seed, {
      prompt: '谁对谁做了什么？',
      speak: '先看谁，再看动作。',
      learn: [subject.id, action.id, object.id],
      hint: '主体在前，动作在中，对象在后。',
      answer: right,
      choices: choiceSet(rng, { id: 'sentence-right', label: right, icon: subject.id }, [
        { id: 'sentence-early', label: early, icon: action.id },
        { id: 'sentence-swap', label: swap, icon: object.id },
      ]),
    });
  }
  return puzzleShell(band, 'order', seed, {
    prompt: '谁应该写在前面？',
    speak: '先是谁，再是动作。',
    learn: [subject.id, action.id],
    hint: '做事情的那个写在前面。',
    answer: subject.name,
    choices: choiceSet(rng, { id: subject.id, label: subject.name, icon: subject.id }, [
      { id: action.id, label: action.name, icon: action.id },
    ]),
  });
}

export function makePuzzle(band, kind, seed = 1) {
  if (!PUZZLE_KINDS[band] || !PUZZLE_KINDS[band].includes(kind)) return null;
  const rng = rngFor(`${band}:${kind}:${seed}`);
  if (kind === 'pair') return pairPuzzle(band, rng, seed);
  if (kind === 'color') return colorPuzzle(band, rng, seed);
  if (kind === 'count') return countPuzzle(band, rng, seed);
  if (kind === 'order') return orderPuzzle(band, rng, seed);
  return null;
}

export function gradePuzzle(puzzle, choiceId) {
  if (!puzzle || !Array.isArray(puzzle.choices)) return { ok: false, learn: [] };
  const winners = puzzle.choices.filter((choice) => choice.ok);
  if (winners.length !== 1) return { ok: false, learn: [] };
  const picked = puzzle.choices.find((choice) => choice.id === choiceId);
  if (!picked?.ok) return { ok: false, learn: [] };
  return { ok: true, learn: [...(puzzle.learn || [])] };
}

export const ROSETTA_CARD = Object.freeze({
  title: '对照着看',
  text: '罗塞塔石碑上刻着同一份诏令的三种文字。人们认得其中的希腊文。商博良在 1822 年宣布，读象形文字有了突破。对照着看，才能读懂陌生的文字。',
  ref: 'https://www.britishmuseum.org/blog/everything-you-ever-wanted-know-about-rosetta-stone',
  review: Object.freeze({ status: 'draft' }),
});
