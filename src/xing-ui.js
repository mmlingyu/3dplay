/** Big-button sheets for puzzles, the lab and the crystal dish. */

import { GRAVITY_CHILD, GRAVITY_NOTE, LAB_STEPS, QUARANTINE_CARD, gravityCompare } from './experiment-lab.js';
import { ROSETTA_CARD, glyphById, kindsFor, makePuzzle } from './glyph-data.js';
import { FANTASY_ROUTE, GRAVITY_LINE, MODEL_LINE, XING_STAMPS } from './xing-data.js';

function button(label, attrs = '') {
  return `<button type="button" class="primary-btn xing-choice" ${attrs}>${label}</button>`;
}

export function paintXingSheet(root, view) {
  if (!root) return;
  root.innerHTML = view;
  root.hidden = false;
}

export function closeXingSheet(root) {
  if (!root) return;
  root.hidden = true;
  root.innerHTML = '';
}

export function puzzleView(band, seed, puzzle = null) {
  const age = kindsFor(band).length ? band : 'little';
  const kind = kindsFor(age).includes(puzzle?.kind) ? puzzle.kind : kindsFor(age)[0];
  const card = puzzle || makePuzzle(age, kind, seed);
  const choices = (card?.choices || []).map((choice) => button(choice.label, `data-xing="answer" data-choice="${choice.id}" aria-label="${choice.label}"`)).join('');
  const kinds = kindsFor(age).map((item) => button(kindLabel(item), `data-xing="kind" data-kind="${item}" aria-label="${kindLabel(item)}"`)).join('');
  const rosetta = age === 'older' ? `<p class="xing-note">${ROSETTA_CARD.text}</p>` : '';
  return `<strong>符号谜题</strong><p>${card?.prompt || '选一个'}</p><div class="xing-row">${kinds}</div><div class="xing-row">${choices}</div><div class="xing-row">${button('提示', 'data-xing="hint" aria-label="提示"')}${button('看答案', 'data-xing="reveal" aria-label="看答案"')}</div><p id="xing-puzzle-note" class="xing-note">${card?.hint ? '' : '想做再做。不做也能回家。'}</p>${rosetta}<button type="button" class="secondary-btn" data-xing="close" aria-label="先去玩">先去玩</button>`;
}

function kindLabel(kind) {
  return { pair: '配对', color: '颜色', count: '数量', order: '顺序' }[kind] || kind;
}

export function labView(band) {
  const compare = gravityCompare();
  const home = compare.home.apex.toFixed(2);
  const away = compare.xing.apex.toFixed(2);
  const steps = band === 'little' ? '' : `<ol class="xing-steps">${LAB_STEPS.map((step) => `<li>${step.label}</li>`).join('')}</ol>`;
  const table = band === 'older' ? `<table class="xing-table"><tr><th>河谷</th><td>${home}</td></tr><tr><th>外星谷</th><td>${away}</td></tr></table><p class="xing-note">${QUARANTINE_CARD.text}</p>` : '';
  return `<strong>试验站</strong><p>${GRAVITY_LINE}</p><p>${MODEL_LINE}</p>${steps}<p>同一个跳起的速度。河谷高度 ${home}，这里 ${away}。</p>${table}<div class="xing-row">${button('看两次，哪个跳得高', 'data-xing="experiment" data-kind="gravity" aria-label="看两次，哪个跳得高"')}</div><p class="xing-note">${GRAVITY_NOTE} ${GRAVITY_CHILD}</p><button type="button" class="secondary-btn" data-xing="close" aria-label="先去玩">先去玩</button>`;
}

export function crystalView(status) {
  const label = status?.stage === 'ready' ? '可以收下' : status?.stage === 'sparse' ? '几乎没有' : status?.stage === 'rest' ? '静置' : status?.stage === 'dissolve' ? '溶解' : '还没开始';
  return `<strong>培养盐晶</strong><p>${label}</p><div class="xing-row">${button('盐少', 'data-xing="crystal" data-much="0" aria-label="盐放得少"')}${button('盐多', 'data-xing="crystal" data-much="1" aria-label="盐放得多"')}</div>${status?.ready ? button('收下盐晶', 'data-xing="claim-crystal" aria-label="收下盐晶"') : ''}${status?.sparse ? button('看结果', 'data-xing="claim-crystal" aria-label="看这次的结果"') : ''}<p class="xing-note">盐加清水，加热溶解，再静置。饱和才会析出。暂停或离开页面就停住。时间缩短了。</p><button type="button" class="secondary-btn" data-xing="close" aria-label="先去玩">先去玩</button>`;
}

export function guguView() {
  return `<strong>送小咕回家</strong><p class="xing-picture" aria-hidden="true">🟢 → 🎈</p><p>小咕指向家的方向。</p>${button('抱一抱', 'data-xing="reunite" aria-label="抱一抱"')}<button type="button" class="secondary-btn" data-xing="close" aria-label="先去玩">先去玩</button>`;
}

export function mossView() {
  return `<strong>光苔</strong><p>这是游戏里的幻想生物。</p>${button('看一看', 'data-xing="moss" aria-label="看看光苔"')}<p class="xing-note">${FANTASY_ROUTE}</p><button type="button" class="secondary-btn" data-xing="close" aria-label="先去玩">先去玩</button>`;
}

export function stampLine() {
  return XING_STAMPS.map((stamp) => stamp.name).join('、');
}

export function focusGlyph(puzzle) {
  return puzzle?.focus ? glyphById(puzzle.focus) : null;
}
