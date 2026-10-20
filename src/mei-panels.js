/** Beauty-valley panels. Shared panel code only asks this module for markup and clicks. */

import {
  LANTERN_NOTE,
  MAPLE_RATIO,
  MEI_TRADES,
  PUMPKIN_FACES,
  QUILT_COLORS,
  QUILT_NOTE,
  THANKS_NOTE,
  TRADE_NOTE,
} from './mei-data.js';
import { PLANE_NOTE, WINDMILL_NOTE, CABIN_NOTE } from './mei-data.js';
import { PROJECT_GOALS, projectBand, resultLine } from './project-board.js';

export const MEI_PANEL_TITLES = {
  maple: '熬枫糖',
  project: '项目板',
  quilt: '拼布',
  trade: '交换板',
  lantern: '南瓜灯',
  thanks: '感谢卡',
};

const NOTES = { windmill: WINDMILL_NOTE, plane: PLANE_NOTE, cabin: CABIN_NOTE };
let quiltPick = [];

export function meiPanelHtml(type, { game, button, escapeHTML }) {
  if (type === 'maple') return mapleView(game, button, escapeHTML);
  if (type === 'project') return projectView(game, button, escapeHTML);
  if (type === 'quilt') return quiltView(game, button, escapeHTML);
  if (type === 'trade') return tradeView(game, button, escapeHTML);
  if (type === 'lantern') return lanternView(game, button, escapeHTML);
  if (type === 'thanks') return thanksView(game, button, escapeHTML);
  return null;
}

export function handleMeiAction({ action, target, game, notifyResult, render }) {
  const known = ['maple-start', 'maple-claim', 'project-goal', 'project-draw', 'project-make', 'project-try', 'project-change', 'project-retry', 'project-skip', 'project-finish', 'quilt-color', 'quilt-done', 'trade-make', 'lantern-face', 'lantern-make', 'thanks-make', 'gift-give'];
  if (!known.includes(action)) return false;
  let result = { ok: false, message: '再点一次。' };
  if (action === 'maple-start') result = game.startMaple();
  if (action === 'maple-claim') result = game.claimMaple();
  if (action === 'project-goal') result = game.startMeiProject(target.dataset.goal);
  if (action === 'project-draw') result = game.drawMeiProject();
  if (action === 'project-make') result = game.makeMeiProject(4);
  if (action === 'project-try') result = game.tryMeiProject({ bellows: target.dataset.bellows === '1' });
  if (action === 'project-change') result = game.changeMeiProject({ [target.dataset.key]: Number(target.dataset.value) });
  if (action === 'project-retry') result = game.changeMeiProject({});
  if (action === 'project-skip') result = game.skipMeiProject();
  if (action === 'project-finish') result = game.finishMeiProject();
  if (action === 'quilt-color') {
    quiltPick = [...quiltPick, target.dataset.color].slice(-4);
    const name = QUILT_COLORS.find((item) => item.id === target.dataset.color)?.name || '';
    result = { ok: true, message: `选了${name}。` };
  }
  if (action === 'quilt-done') {
    result = game.finishQuilt(quiltPick);
    if (result.ok) quiltPick = [];
  }
  if (action === 'trade-make') result = game.tradeMei(target.dataset.id);
  if (action === 'lantern-face') result = game.setLanternFace(target.dataset.face);
  if (action === 'lantern-make') result = game.craft([['pumpkin', 'stick']], 'pumpkin-lantern');
  if (action === 'thanks-make') result = game.craft([['paper', 'quilt-patch']], 'thanks-card');
  if (action === 'gift-give') result = game.giveMeiGift(target.dataset.item, target.dataset.friend);
  notifyResult(result);
  render();
  return true;
}

function mapleView(game, button, escapeHTML) {
  const status = game.mapleStatus();
  const steps = status.stages.map((stage) => `<span class="step-chip ${status.stage === stage.id ? 'now' : ''}">${escapeHTML(stage.label)}</span>`).join('');
  return `<div class="panel-note"><span>${escapeHTML(status.label)}。${MAPLE_RATIO} 份树汁熬成 1 份糖浆。</span></div><div class="panel-row">${steps}</div><p>${escapeHTML(status.season)}</p><details class="panel-details" open><summary>和真实熬糖有什么不同</summary><p>${escapeHTML(status.note)}</p></details><div class="panel-row">${button('maple-start', '开始熬', { className: 'primary-btn', label: '开始熬枫糖', disabled: status.ready || status.stage !== 'idle' })}${button('maple-claim', '收下糖浆', { className: 'primary-btn', label: '收下枫糖浆', disabled: !status.ready })}</div>`;
}

function projectView(game, button, escapeHTML) {
  const status = game.projectStatus();
  const band = status.band || projectBand(game.state.settings?.ageBand);
  if (!status.card || status.card.done) {
    const goals = PROJECT_GOALS.map((goal) => button('project-goal', goal.name, { className: 'primary-btn', label: goal.name, data: { goal: goal.id } })).join('');
    return `<div class="panel-note"><span>选一个想做的：风车、纸飞机或原木小屋。</span></div><div class="panel-row">${goals}</div><p>画 → 做 → 试 → 改。没有倒计时，也不会扣分。</p>`;
  }
  const card = status.card;
  const note = NOTES[card.goal] || '';
  const steps = ['画', '做', '试', '改'].map((label, index) => {
    const order = ['draw', 'make', 'try', 'change'];
    const on = order.indexOf(card.step) >= index || card.step === 'done';
    return `<span class="step-chip ${on ? 'now' : ''}" aria-label="${label}">${label}</span>`;
  }).join('');
  let controls = '';
  if (card.step === 'draw') controls = button('project-draw', '画好了', { className: 'primary-btn', label: '画好了' });
  if (card.step === 'make') controls = button('project-make', '做好了', { className: 'primary-btn', label: '做好了' });
  if (card.step === 'try') {
    controls = `${button('project-try', '试一试', { className: 'primary-btn', label: '试一试', data: { bellows: '0' } })}${card.goal === 'windmill' ? button('project-try', '用风箱试', { className: 'primary-btn', label: '用风箱试', data: { bellows: '1' } }) : ''}`;
  }
  if (card.step === 'change') {
    if (band === 'little') {
      controls = `${button('project-retry', '再试一次', { className: 'primary-btn', label: '再试一次' })}${button('project-finish', '完成', { className: 'primary-btn', label: '完成项目' })}`;
    }
    else controls = changeButtons(card, button) + button('project-skip', '跳过修改', { label: '跳过修改' }) + button('project-finish', '完成', { className: 'primary-btn', label: '完成项目' });
  }
  const compare = band === 'little' ? '' : compareHtml(card, escapeHTML);
  const cap = status.cap ? `<p class="panel-note">${escapeHTML(status.cap)}</p>` : '';
  const record = band === 'older' ? recordHtml(card, escapeHTML) : '';
  return `<div class="panel-row" aria-label="项目步骤">${steps}</div><p>${escapeHTML(note)}</p>${cap}${compare}${record}<div class="panel-row">${controls}</div>`;
}

function changeButtons(card, button) {
  if (card.goal === 'windmill') {
    const blades = Math.min(2, card.parts.blades + 1);
    const size = card.parts.size === 1 ? 2 : 1;
    return `${button('project-change', '叶片多一片', { className: 'primary-btn', label: '叶片多一片', data: { key: 'blades', value: blades } })}${button('project-change', '叶片大一号', { label: '叶片大一号', data: { key: 'size', value: size } })}`;
  }
  if (card.goal === 'plane') {
    const nose = Math.min(2, card.parts.nose + 1);
    const wing = card.parts.wing === 1 ? 0 : 1;
    return `${button('project-change', '机头加重', { className: 'primary-btn', label: '机头加重', data: { key: 'nose', value: nose } })}${button('project-change', '改机翼', { label: '改机翼角度', data: { key: 'wing', value: wing } })}`;
  }
  const walls = Math.min(12, card.parts.walls + 1);
  return button('project-change', '多加一面墙', { className: 'primary-btn', label: '多加一面墙', data: { key: 'walls', value: walls } });
}

function compareHtml(card, escapeHTML) {
  if ((card.trials || []).length < 2) return '';
  const before = card.trials[card.trials.length - 2];
  const after = card.trials[card.trials.length - 1];
  return `<div class="compare-row" aria-label="并排对比"><article><strong>上一次</strong><p>${escapeHTML(resultLine(card.goal, before.result))}</p></article><article><strong>这一次</strong><p>${escapeHTML(resultLine(card.goal, after.result))}</p></article></div>`;
}

function recordHtml(card, escapeHTML) {
  if (!card.trials.length) return '';
  const rows = card.trials.slice(-2).map((trial, index) => `<tr><td>${index === 0 && card.trials.length > 1 ? '前一次' : '这一次'}</td><td>${escapeHTML(resultLine(card.goal, trial.result))}</td></tr>`).join('');
  return `<table class="record-table" aria-label="试验记录"><tbody>${rows}</tbody></table>`;
}

function quiltView(game, button, escapeHTML) {
  const band = projectBand(game.state.settings?.ageBand);
  const hint = band === 'older' ? '让斜对角一样。' : band === 'bigger' ? '让左右对称。' : '点四个颜色就好。';
  const colors = QUILT_COLORS.map((color) => button('quilt-color', color.name, { className: 'primary-btn quilt-swatch', label: color.name, data: { color: color.id } })).join('');
  const picked = quiltPick.map((id) => QUILT_COLORS.find((item) => item.id === id)?.name || id).join(' ');
  return `<div class="panel-note"><span>${escapeHTML(hint)}</span></div><div class="quilt-board panel-row" data-cells="${escapeHTML(quiltPick.join(','))}" aria-label="拼布">${colors}</div><p aria-label="已选颜色">${escapeHTML(picked)}</p><p>${escapeHTML(QUILT_NOTE)}</p><div class="panel-row">${button('quilt-done', '拼好了', { className: 'primary-btn', label: '拼好了' })}</div>`;
}

function tradeView(game, button, escapeHTML) {
  if (game.state.settings?.ageBand !== 'older') {
    return `<p>交换板给 10–12 岁看比例。想送东西，可以直接送礼物。</p><div class="panel-row">${button('gift-give', '送感谢卡', { className: 'primary-btn', label: '送感谢卡', data: { item: 'thanks-card', friend: 'joe' } })}</div>`;
  }
  const offer = MEI_TRADES[0];
  return `<p>${escapeHTML(TRADE_NOTE)} ${escapeHTML(offer.note)}</p><div class="panel-row">${button('trade-make', '交换', { className: 'primary-btn', label: '用豆子换枫糖浆', data: { id: offer.id } })}</div>`;
}

function lanternView(game, button, escapeHTML) {
  const face = game.state.travel?.realms?.mei?.decor?.face || 'smile';
  const faces = PUMPKIN_FACES.map((item) => button('lantern-face', item.name, { className: item.id === face ? 'primary-btn' : 'secondary-btn', label: item.name, data: { face: item.id } })).join('');
  return `<div class="panel-note"><span>选一个可爱的表情。</span></div><div class="panel-row" aria-label="南瓜灯表情">${faces}</div><p>${escapeHTML(LANTERN_NOTE)}</p><div class="lantern-face face-${escapeHTML(face)}" aria-hidden="true"></div><div class="panel-row">${button('lantern-make', '做好了', { className: 'primary-btn', label: '做好南瓜灯' })}</div>`;
}

function thanksView(game, button, escapeHTML) {
  return `<p>${escapeHTML(THANKS_NOTE)}</p><div class="panel-row">${button('thanks-make', '做好了', { className: 'primary-btn', label: '做好感谢卡' })}${button('gift-give', '送给 Joe', { className: 'primary-btn', label: '把感谢卡送给朋友', data: { item: 'thanks-card', friend: 'joe' } })}</div>`;
}
