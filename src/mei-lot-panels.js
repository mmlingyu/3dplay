/** Lot panels: two age bands, projector, premiere. No scores. */

import { LANTERN_NOTE } from './mei-data.js';
import {
  LIGHTS,
  LOT_NOTE,
  PREMIERE_NOTE,
  RABBIT_NOTE,
  SET_NOTE,
  SHARD_LINE,
  SIGN_NOTE,
  meiAgeBand,
  playMeiLine,
} from './mei-lot.js';

let board = [];
let lights = { key: true, fill: false, rim: false };
let reelOpen = false;
let heard = '';
let audioOn = true;

function useSound(game) {
  audioOn = game?.state?.settings?.sound !== false;
}

function say(id, text, lang = 'zh-CN') {
  if (!audioOn) return;
  playMeiLine(id, text, lang);
}

export const LOT_PANEL_TITLES = {
  stage: '摄影棚',
  projector: '放映机',
  premiere: '星光首映夜',
  'pumpkin-head': '南瓜头',
  setback: '布景背面',
};

function iconButton(button, svg, action, label, icon, options = {}) {
  const picture = svg ? svg(icon, 28) : '';
  return button(action, `${picture}<span>${label}</span>`, options);
}

function hear(id, text, lang = 'zh-CN') {
  if (!audioOn || heard === id) return;
  heard = id;
  playMeiLine(id, text, lang);
}

export function lotPanelHtml(type, { game, button, escapeHTML, svg }) {
  if (!LOT_PANEL_TITLES[type]) return null;
  useSound(game);
  if (type === 'stage') return stageView(game, button, escapeHTML, svg);
  if (type === 'projector') return projectorView(game, button, escapeHTML, svg);
  if (type === 'premiere') return premiereView(game, button, escapeHTML, svg);
  if (type === 'pumpkin-head') return pumpkinView(button, escapeHTML, svg);
  return setbackView(game, button, escapeHTML, svg);
}

export function handleLotAction({ action, target, game, notifyResult, render }) {
  const known = ['lot-action', 'lot-cut', 'lot-card', 'lot-board', 'lot-shot', 'lot-fps', 'lot-light', 'lot-photo', 'lot-fix', 'lot-skip', 'lot-hear', 'premiere-play'];
  if (!known.includes(action)) return false;
  useSound(game);
  if (action === 'lot-action') {
    notifyResult({ ok: true, message: 'Action！开拍。' });
    say('en-action', 'Action!', 'en-US');
  } else if (action === 'lot-cut') {
    notifyResult({ ok: true, message: 'Cut！停下。' });
    say('en-cut', 'Cut!', 'en-US');
  } else if (action === 'lot-card') {
    board = [...board, target.dataset.card].slice(-3);
    say('zh-board', '选三张图，排好开头、中间和结尾。', 'zh-CN');
    notifyResult({ ok: true, message: '放进一格。' });
  } else if (action === 'lot-board') {
    const result = game.saveMeiFilm(board);
    if (result.ok) board = [];
    notifyResult(result);
  } else if (action === 'lot-shot') {
    const shot = target.dataset.shot;
    notifyResult(game.saveMeiPhoto(target.dataset.card || 'star', shot));
    say(target.dataset.audio, target.dataset.en || shot, 'en-US');
  } else if (action === 'lot-fps') {
    notifyResult({ ok: true, message: '每秒 24 张更连贯。6 张会一顿一顿。这是游戏里的对比。' });
    say('en-frames', 'twenty-four frames', 'en-US');
  } else if (action === 'lot-light') {
    const id = target.dataset.light;
    if (lights[id] != null) lights = { ...lights, [id]: !lights[id] };
    say('zh-light', '一次只改一盏灯。', 'zh-CN');
    notifyResult({ ok: true, message: '一次只改一盏。影子跟着变。' });
  } else if (action === 'lot-photo') {
    notifyResult(game.saveMeiPhoto('star', 'medium'));
  } else if (action === 'lot-fix') {
    const result = game.fixMeiProjector();
    if (result.shard) reelOpen = true;
    if (result.audio) say(result.audio, result.speak || result.message, 'zh-CN');
    notifyResult(result);
  } else if (action === 'lot-skip') {
    reelOpen = false;
    notifyResult({ ok: true, message: '这段先跳过。光之片还在。' });
  } else if (action === 'lot-hear') {
    say(target.dataset.audio, target.dataset.text, target.dataset.lang || 'zh-CN');
    notifyResult({ ok: true, message: '再听一遍。' });
  } else if (action === 'premiere-play') {
    const result = game.openPremiere();
    if (result.audio) say(result.audio, result.speak || result.message, 'zh-CN');
    notifyResult(result);
  }
  render();
  return true;
}

function stageView(game, button, escapeHTML, svg) {
  const band = meiAgeBand(game.state.settings?.ageBand);
  hear(band === 'senior' ? 'zh-shot' : 'zh-action', band === 'senior' ? '远景、中景、特写，选一张。' : '点绿色按钮，一起喊 Action。');
  const junior = band === 'junior';
  const note = junior
    ? '6–8 岁：先喊 Action 和 Cut，再排三格。每一步都有图和声音。'
    : '9–12 岁：看镜头、比一比每秒 24 帧、试三点布光。一次只改一盏灯。';
  return `<p>${escapeHTML(LOT_NOTE)}</p><p>${escapeHTML(note)}</p>${junior ? juniorStage(game, button, escapeHTML, svg) : seniorStage(button, escapeHTML, svg)}<div class="panel-row">${iconButton(button, svg, 'lot-photo', '拍一张', 'sparkle', { className: 'primary-btn', label: '拍一张' })}${iconButton(button, svg, 'lot-hear', '听一听', 'sound', { label: '听一听', data: { audio: junior ? 'zh-board' : 'zh-frames', text: junior ? '选三张图。' : '每秒二十四张。' } })}</div>`;
}

function juniorStage(game, button, escapeHTML, svg) {
  const names = board.map((id) => game.lotStatus().cards.find((card) => card.id === id)?.name || id);
  const slots = [0, 1, 2].map((index) => `<span class="step-chip">${escapeHTML(names[index] || '空')}</span>`).join('');
  const cards = game.lotStatus().cards.map((card) => iconButton(button, svg, 'lot-card', card.name, card.icon, { label: card.name, data: { card: card.id } })).join('');
  return `<div class="panel-row">${iconButton(button, svg, 'lot-action', 'Action', 'play', { className: 'primary-btn', label: 'Action 开拍' })}${iconButton(button, svg, 'lot-cut', 'Cut', 'minus', { className: 'secondary-btn', label: 'Cut 停下' })}</div><p>三格分镜：开头、中间、结尾。</p><div class="panel-row">${slots}</div><div class="panel-row">${cards}</div><div class="panel-row">${iconButton(button, svg, 'lot-board', '排好了', 'check', { className: 'primary-btn', label: '三格排好了' })}</div>`;
}

function seniorStage(button, escapeHTML, svg) {
  const shots = [
    ['wide', '远景', 'wide shot', 'en-wide', 'map', 'sun'],
    ['medium', '中景', 'medium shot', 'en-medium', 'play', 'friend'],
    ['close', '特写', 'close-up', 'en-close', 'sparkle', 'star'],
  ].map(([id, name, en, audio, icon, card]) => iconButton(button, svg, 'lot-shot', name, icon, { label: `${name} ${en}`, data: { shot: id, audio, en, card } })).join('');
  const lamps = LIGHTS.map((item) => iconButton(button, svg, 'lot-light', `${item.name}${lights[item.id] ? ' 亮' : ''}`, item.icon, { className: lights[item.id] ? 'primary-btn' : 'secondary-btn', label: item.name, data: { light: item.id } })).join('');
  const face = `<div class="light-face" data-key="${lights.key ? 1 : 0}" data-fill="${lights.fill ? 1 : 0}" data-rim="${lights.rim ? 1 : 0}"><span>脸</span></div>`;
  return `<p>镜头语言</p><div class="panel-row">${shots}</div><p>每秒 24 帧。上面一顿一顿，下面更连贯。</p><div class="fps-stage"><div class="fps-row" data-fps="6"><i></i><b>6</b></div><div class="fps-row" data-fps="24"><i></i><b>24</b></div></div><div class="panel-row">${iconButton(button, svg, 'lot-fps', '看 24 帧', 'play', { className: 'primary-btn', label: '对比每秒 24 帧' })}${iconButton(button, svg, 'lot-hear', 'Take two', 'sound', { label: 'Take two', data: { audio: 'en-take-two', text: 'Take two!', lang: 'en-US' } })}</div><p>三点布光。一次只点一盏。</p>${face}<div class="panel-row">${lamps}</div>`;
}

function projectorView(game, button, escapeHTML, svg) {
  const status = game.lotStatus();
  const rows = status.parts.map((part) => {
    const ready = status[part.id];
    return `<span class="step-chip ${ready ? 'now' : ''}">${svg ? svg(part.icon, 22) : ''}${escapeHTML(part.name)}${ready ? ' 有了' : ' 还缺'}</span>`;
  }).join('');
  const tour = status.tour ? '<p>体验一下：放映机只缺一盏灯，灯就在旁边。</p>' : '<p>和 Will、Orv、咔嚓一起装齿轮、镜头和灯。</p>';
  const reel = status.storyShard && reelOpen
    ? `<div class="reel-sky" aria-label="星空和飞船"><span class="reel-ship"></span><i></i><i></i><i></i></div><p>${escapeHTML(SHARD_LINE)}</p><div class="panel-row">${iconButton(button, svg, 'lot-skip', '跳过这段', 'check', { className: 'primary-btn', label: '跳过星空这段' })}</div>`
    : '';
  const shard = status.storyShard ? '<p>光之片已经拿到。印章是「首映」。</p>' : '';
  return `${tour}<div class="panel-row">${rows}</div>${shard}${reel}<div class="panel-row">${iconButton(button, svg, 'lot-fix', '装上', 'lantern', { className: 'primary-btn', label: '装上放映机', disabled: status.missing.length > 0 && !status.storyShard })}${iconButton(button, svg, 'lot-hear', '听一听', 'sound', { label: '听光之片', data: { audio: 'zh-shard', text: SHARD_LINE } })}</div>`;
}

function premiereView(game, button, escapeHTML, svg) {
  const films = game.lotStatus().films;
  const list = films.length
    ? films.map((film) => `<span class="step-chip">${escapeHTML(film.kind === 'photo' ? '照片' : '小电影')}</span>`).join('')
    : '<p>还没有片子。去摄影棚排三格，或拍一张。</p>';
  return `<p>${escapeHTML(PREMIERE_NOTE)}</p><div class="panel-row">${list}</div><div class="panel-row">${iconButton(button, svg, 'premiere-play', '放映', 'play', { className: 'primary-btn', label: '放我的片子' })}${iconButton(button, svg, 'lot-hear', '听一听', 'sound', { label: '听首映夜', data: { audio: 'zh-premiere', text: '首映夜不排名。' } })}</div>`;
}

function pumpkinView(button, escapeHTML, svg) {
  return `<p>${escapeHTML(LANTERN_NOTE)}</p><div class="panel-row">${iconButton(button, svg, 'lot-hear', '笑脸', 'heart', { label: '笑脸', data: { audio: 'zh-back', text: '南瓜头只有笑脸、猫脸和星星。' } })}${iconButton(button, svg, 'lot-hear', '猫脸', 'heart', { label: '猫脸', data: { audio: 'en-cat', text: 'cat', lang: 'en-US' } })}${iconButton(button, svg, 'lot-hear', '星星', 'star', { label: '星星', data: { audio: 'en-star', text: 'star', lang: 'en-US' } })}</div><p>没有尖牙。</p>`;
}

function setbackView(game, button, escapeHTML, svg) {
  const extra = meiAgeBand(game.state.settings?.ageBand) === 'senior' ? '正面是薄薄的楼，后面才是木头架子。这是布景。' : '';
  return `<p>${escapeHTML(SET_NOTE)}</p><p>${escapeHTML(extra)}</p><p>${escapeHTML(RABBIT_NOTE)} ${escapeHTML(SIGN_NOTE)}</p><div class="panel-row">${iconButton(button, svg, 'lot-hear', '听一听', 'sound', { className: 'primary-btn', label: '听布景', data: { audio: 'zh-back', text: SET_NOTE } })}</div>`;
}
