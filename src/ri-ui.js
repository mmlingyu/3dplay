/** Day-valley prompts. Pictures and speech sit beside the words. */

import { icon } from './icons.js';
import { playRiAudio } from './ri-audio.js';
import {
  MIKO_CLUE,
  RI_SHOPS,
  RI_STATIONS,
  riBand,
  shrineAllows,
} from './ri-story.js';

let sheet;
let lastAudio = '';

function ensureSheet() {
  if (sheet) return sheet;
  const style = document.createElement('style');
  style.id = 'ri-sheet-style';
  style.textContent = `
    #ri-sheet { position: absolute; left: 50%; top: 14%; transform: translateX(-50%); z-index: 32; width: min(460px, 94vw); padding: 16px; border-radius: 24px; background: #f7f1e6; color: #24344a; border: 3px solid #c8402a; text-align: center; }
    #ri-sheet[hidden] { display: none !important; }
    #ri-sheet p { margin: 0 0 12px; font-size: 18px; line-height: 1.45; }
    #ri-sheet .ri-choices { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
    #ri-sheet .ri-choices button { min-width: 96px; min-height: 64px; font-size: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
    #ri-shard-film { display: flex; justify-content: center; gap: 6px; margin: 8px 0 12px; }
    #ri-shard-film i { width: 14px; height: 22px; border-radius: 3px; background: #2b3a67; display: block; }
    #ri-shard-stone { width: 92px; height: 64px; margin: 0 auto 8px; border-radius: 12px; background: linear-gradient(160deg, #9fd0e6, #2f6f9a); box-shadow: inset 0 0 0 3px #d5e7f2; }
  `;
  document.head.appendChild(style);
  sheet = document.createElement('div');
  sheet.id = 'ri-sheet';
  sheet.hidden = true;
  sheet.setAttribute('role', 'dialog');
  document.body.appendChild(sheet);
  return sheet;
}

export function riSheetOpen() {
  return Boolean(sheet && !sheet.hidden);
}

export function closeRiSheet() {
  if (sheet) sheet.hidden = true;
}

function choiceButton(label, iconName, attrs) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'primary-btn';
  button.innerHTML = `${icon(iconName, 28)}<span>${label}</span>`;
  Object.entries(attrs).forEach(([key, value]) => button.setAttribute(key, value));
  return button;
}

function openSheet(title, { replay } = {}) {
  const node = ensureSheet();
  node.replaceChildren();
  node.hidden = false;
  node.setAttribute('aria-label', title);
  const text = document.createElement('p');
  text.textContent = title;
  node.append(text);
  if (replay) {
    const again = document.createElement('button');
    again.type = 'button';
    again.className = 'secondary-btn';
    again.textContent = '再听一次';
    again.addEventListener('click', replay);
    node.append(again);
  }
  return node;
}

function shuffle(list, salt) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = (salt + i * 3) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function shopChoices(shop, band) {
  const others = RI_SHOPS.filter((item) => item.id !== shop.id).slice(0, 2);
  if (band === 'senior') {
    return shuffle([shop, ...others], shop.index).map((item) => ({
      id: item.id,
      label: item.meaning,
      icon: item.icon,
      ok: item.id === shop.id,
    }));
  }
  return shuffle([shop, ...others], shop.index + 1).map((item) => ({
    id: item.id,
    label: item.kana,
    icon: item.icon,
    ok: item.id === shop.id,
  }));
}

export function handleRiTap(target, hooks) {
  const { game, world, toast, speak, band } = hooks;
  const city = world?.riCity;
  if (!target?.riKind || !city) return false;
  world.stopWalking?.();
  if (target.zone === 'shrine' && !shrineAllows(target.action)) {
    toast('这里只点亮石灯笼。');
    return true;
  }
  if (target.riKind === 'shrine') {
    toast('石灯笼可以点亮。');
    return true;
  }
  if (target.riKind === 'lantern') {
    const result = game.lightRiLantern(target.lanternIndex);
    toast(result.message, result.ok);
    speak(result.message);
    world.sync(game.state);
    if (result.all) showNightLine('四盏石灯笼都亮了。院子安静下来。');
    return true;
  }
  if (target.riKind === 'shop') {
    const shop = RI_SHOPS[target.shopIndex];
    const junior = band !== 'senior';
    const say = () => {
      playRiAudio(shop.audio, { text: shop.reading, lang: 'ja-JP' });
    };
    say();
    const node = openSheet(junior ? '听一听，点亮这家店。' : `招牌写着 ${shop.kana}。它是什么？`, { replay: say });
    const row = document.createElement('div');
    row.className = 'ri-choices';
    for (const choice of shopChoices(shop, band)) {
      const button = choiceButton(choice.label, choice.icon, { 'aria-label': junior ? `${choice.label}，${choice.id === shop.id ? shop.meaning : choice.label}` : choice.label });
      button.addEventListener('click', () => {
        if (!choice.ok) {
          toast('再听一次，点另一个。');
          say();
          return;
        }
        const result = game.lightRiShop(shop.index);
        closeRiSheet();
        toast(result.message, result.ok);
        speak(result.message);
        world.sync(game.state);
        if (result.all) showNightLine('招牌街都亮了。雨后的地面映着灯。');
      });
      row.append(button);
    }
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'secondary-btn';
    skip.textContent = '先去玩';
    skip.addEventListener('click', () => closeRiSheet());
    node.append(row, skip);
    return true;
  }
  if (target.riKind === 'station') {
    const station = RI_STATIONS.find((item) => item.id === target.stationId) || RI_STATIONS[0];
    const started = city.startRide(() => {
      const result = game.finishRiTrain();
      toast(result.message, result.ok);
      speak(result.message);
      world.sync(game.state);
    });
    if (!started) {
      toast('电车还在这一圈里。');
      return true;
    }
    if (band !== 'senior') {
      playRiAudio(station.audio, { text: station.kana, lang: 'ja-JP' });
      const node = openSheet('下一站是哪一个？点图标。', {
        replay: () => playRiAudio(station.audio, { text: station.kana, lang: 'ja-JP' }),
      });
      const row = document.createElement('div');
      row.className = 'ri-choices';
      for (const item of RI_STATIONS) {
        const button = choiceButton(item.kana, item.icon, { 'aria-label': item.name });
        button.addEventListener('click', () => {
          toast(item.id === station.id ? `对，${item.name}。` : '电车还会停。再听一次站名。');
          speak(item.id === station.id ? '对了。' : '再听一次。');
          closeRiSheet();
        });
        row.append(button);
      }
      node.append(row);
    }
    return true;
  }
  if (target.riKind === 'tower-up') {
    if (city.startLift()) toast('电梯往上走。');
    return true;
  }
  if (target.riKind === 'tower-look') {
    if (!city.startLook()) {
      toast('先坐电梯到顶。');
      return true;
    }
    showNightLine('塔顶望回去，河谷的河还在。雾只是让远处淡一点。');
    return true;
  }
  if (target.riKind === 'tower-down') {
    city.startDown();
    closeRiSheet();
    return true;
  }
  if (target.riKind === 'signal') {
    if (!city.greenNow()) {
      playRiAudio('zh-wait', { text: '红灯先等一等。', lang: 'zh-CN' });
      toast('红灯先等一等。');
      return true;
    }
    const result = game.markRiManner('signal');
    playRiAudio('zh-green', { text: '绿灯亮了，可以走。', lang: 'zh-CN' });
    toast(result.message, result.ok);
    return true;
  }
  if (target.riKind === 'queue') {
    const result = game.markRiManner('queue');
    playRiAudio('zh-queue', { text: '请站到脚印上，排好队。', lang: 'zh-CN' });
    toast(result.message, result.ok);
    return true;
  }
  if (target.riKind === 'shoes') {
    const result = game.markRiManner('shoes');
    playRiAudio('zh-shoes', { text: '进屋前，把鞋脱下来。', lang: 'zh-CN' });
    toast(result.message, result.ok);
    return true;
  }
  if (target.riKind === 'thanks') {
    const result = game.markRiManner('thanks');
    playRiAudio('ja-itadakimasu', { text: 'いただきます', lang: 'ja-JP' });
    toast(result.message, result.ok);
    return true;
  }
  if (target.riKind === 'cabinet') {
    const result = game.claimRiShard();
    toast(result.message, result.ok);
    if (result.shard && !result.already) showShard(speak);
    else speak(result.message);
    world.sync(game.state);
    return true;
  }
  return false;
}

function showNightLine(text) {
  const node = openSheet(text);
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'primary-btn';
  skip.textContent = '跳过';
  skip.addEventListener('click', () => closeRiSheet());
  node.append(skip);
  setTimeout(() => { if (!node.hidden && node.textContent.includes(text.slice(0, 6))) closeRiSheet(); }, 4200);
}

function showShard(speak) {
  const node = openSheet('潮之片');
  const stone = document.createElement('div');
  stone.id = 'ri-shard-stone';
  const film = document.createElement('div');
  film.id = 'ri-shard-film';
  for (let i = 0; i < 6; i += 1) film.append(document.createElement('i'));
  const line = document.createElement('p');
  line.textContent = `咪可站长说：${MIKO_CLUE}`;
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'primary-btn';
  skip.setAttribute('aria-label', '跳过');
  skip.textContent = '跳过';
  skip.addEventListener('click', () => closeRiSheet());
  node.append(stone, film, line, skip);
  playRiAudio('zh-miko-film', { text: MIKO_CLUE, lang: 'zh-CN' });
}

export function playQuestionAudio(question, band, speak) {
  if (!question?.audio) return;
  const key = `${question.id}:${question.audio}`;
  if (lastAudio === key) return;
  lastAudio = key;
  playRiAudio(question.audio, { text: question.reading || question.ask || '', lang: 'ja-JP' });
}

export function resetQuestionAudio() {
  lastAudio = '';
}
