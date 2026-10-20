/** Beauty-valley actions. Called from GameState. Does not replace the travel framework. */

import { AxleSession } from './axle-session.js';
import { ITEMS } from './game-data.js';
import { realMoment } from './life-data.js';
import {
  MAPLE_NOTE,
  MAPLE_RATIO,
  MAPLE_STAGES,
  MAPLE_TOTAL_SECONDS,
  MEI_TRADES,
  PUMPKIN_FACES,
  QUILT_COLORS,
  lanternAnyDate,
  mapleSeasonNote,
  mapleStage,
  quiltReady,
} from './mei-data.js';
import {
  capNote,
  changeProject,
  compareTrials,
  drawProject,
  finishProject,
  makeProject,
  projectBand,
  skipProject,
  startProject,
  tryProject,
} from './project-board.js';

const isCount = (value) => Number.isSafeInteger(value) && value >= 0 && value <= 1000000;
const ok = (message, extra = {}) => ({ ok: true, message, ...extra });
const fail = (message) => ({ ok: false, message });

function grant(state, id) {
  if (!state.travel.stamps.includes(id)) state.travel.stamps.push(id);
}

function realmOf(state) {
  return state.travel?.realms?.mei || null;
}

function replaceCard(state, card) {
  const realm = realmOf(state);
  realm.projects = realm.projects.map((item) => (item.id === card.id ? card : item));
}

const SOUVENIR = { windmill: 'windmill-mini', plane: 'paper-plane', cabin: 'log-wall' };

function giveSouvenir(state, item) {
  const realm = realmOf(state);
  const key = `souvenir-${item}`;
  if (realm.claimed.includes(key)) return false;
  if (!isCount((state.inventory[item] || 0) + 1)) return false;
  state.inventory[item] += 1;
  realm.claimed.push(key);
  return true;
}

export function attachMei(GameState) {
  Object.assign(GameState.prototype, {
    mapleStatus() {
      const proc = realmOf(this.state)?.processes?.find((item) => item.kind === 'maple') || null;
      const season = mapleSeasonNote();
      if (!proc) {
        return { stage: 'idle', elapsed: 0, label: '还没开始', ready: false, stages: MAPLE_STAGES, note: MAPLE_NOTE, season };
      }
      const stage = MAPLE_STAGES.find((item) => item.id === proc.stage);
      return {
        stage: proc.stage,
        elapsed: proc.elapsed,
        label: proc.stage === 'ready' ? '可以收下' : (stage?.label || '熬着'),
        ready: proc.stage === 'ready',
        stages: MAPLE_STAGES,
        note: MAPLE_NOTE,
        season,
      };
    },
    startMaple() {
      if (this.currentRealm() !== 'mei') return fail('先到美谷的枫糖小屋。');
      const running = realmOf(this.state)?.processes?.find((item) => item.kind === 'maple' && item.stage !== 'ready');
      if (running) return fail('这锅还在熬，熬好再开始下一锅。');
      const sap = this.state.inventory['maple-sap'] || 0;
      if (sap < MAPLE_RATIO) {
        return fail(`枫树汁还差 ${MAPLE_RATIO - sap} 份。去枫树林采集就有，全年都能采，不用答题。${mapleSeasonNote()}`);
      }
      if ((this.state.inventory.branch || 0) < 1) return fail('需要 1 份树枝当燃料。地上可以捡树枝，不用答题。');
      this.mutate((state) => {
        state.inventory['maple-sap'] -= MAPLE_RATIO;
        state.inventory.branch -= 1;
        const realm = realmOf(state);
        realm.processes = realm.processes.filter((item) => item.kind !== 'maple');
        realm.processes.push({ id: 'maple', kind: 'maple', elapsed: 0, stage: mapleStage(0) });
      });
      return ok(`开始熬枫糖。${MAPLE_RATIO} 份树汁会熬成 1 份糖浆。现实里要多得多，这里缩小了。`);
    },
    claimMaple() {
      const proc = realmOf(this.state)?.processes?.find((item) => item.kind === 'maple' && item.stage === 'ready');
      if (!proc) return fail('糖浆还在熬。看一看锅，过一会儿再来。暂停的时候它不会自己变好。');
      if (!isCount((this.state.inventory['maple-syrup'] || 0) + 1)) return fail('背包里的枫糖浆已经很多了。');
      this.mutate((state) => {
        state.inventory['maple-syrup'] += 1;
        const realm = realmOf(state);
        realm.processes = realm.processes.filter((item) => item.id !== proc.id);
        grant(state, 'mei-syrup-first');
      });
      return ok('收下枫糖浆。10 份树汁变成了 1 份。现实里要多得多。');
    },
    projectStatus() {
      const realm = realmOf(this.state);
      const cards = realm?.projects || [];
      const card = cards[cards.length - 1] || null;
      const band = projectBand(this.state.settings?.ageBand);
      return {
        cards,
        card,
        band,
        compare: card ? compareTrials(card) : null,
        cap: card ? capNote(card, band) : '',
        full: cards.length >= 20,
      };
    },
    startMeiProject(goal) {
      if (this.currentRealm() !== 'mei') return fail('项目板在美谷。走到渡口就能去，不用答题。');
      const realm = realmOf(this.state);
      const begun = startProject(realm?.projects || [], goal);
      if (!begun.ok) return begun;
      this.mutate((state) => { realmOf(state).projects = begun.projects; });
      return begun;
    },
    drawMeiProject(parts) {
      const card = this.projectStatus().card;
      const drawn = drawProject(card, parts);
      if (!drawn.ok) return drawn;
      this.mutate((state) => replaceCard(state, drawn.card));
      return drawn;
    },
    makeMeiProject(used) {
      const card = this.projectStatus().card;
      if (card?.goal === 'windmill') {
        const axle = new AxleSession();
        const attached = axle.attachBlade('windmill-blade');
        const turned = axle.driveAxle(Math.PI / 8);
        axle.dispose();
        if (!attached.ok || !turned.ok) return fail('叶片还没接到轮轴上。');
      }
      const made = makeProject(card, used);
      if (!made.ok) return made;
      this.mutate((state) => replaceCard(state, made.card));
      return made;
    },
    tryMeiProject(extra = {}) {
      const card = this.projectStatus().card;
      const weather = extra.weather || realMoment().weather.kind;
      const tried = tryProject(card, {
        weather,
        bellows: Boolean(extra.bellows),
        blocks: realmOf(this.state)?.blocks || [],
      });
      if (!tried.ok) return tried;
      this.mutate((state) => {
        replaceCard(state, tried.card);
        if (tried.card.goal === 'windmill' && tried.result?.spinning) grant(state, 'mei-windmill-spin');
      });
      return tried;
    },
    changeMeiProject(patch) {
      const card = this.projectStatus().card;
      const changed = changeProject(card, patch, this.state.settings?.ageBand);
      if (!changed.ok) return changed;
      const before = JSON.stringify(this.state.inventory);
      this.mutate((state) => replaceCard(state, changed.card));
      if (JSON.stringify(this.state.inventory) !== before) return fail('改一个地方不应该扣材料。');
      return changed;
    },
    skipMeiProject() {
      return this.completeMeiCard(skipProject(this.projectStatus().card));
    },
    finishMeiProject() {
      return this.completeMeiCard(finishProject(this.projectStatus().card));
    },
    completeMeiCard(result) {
      if (!result?.ok) return result;
      const item = SOUVENIR[result.card.goal];
      this.mutate((state) => {
        replaceCard(state, result.card);
        grant(state, 'mei-project');
        if (item) giveSouvenir(state, item);
      });
      const name = item ? ITEMS[item].name : '纪念品';
      return ok(`项目完成了。印章盖好了，${name}可以带回河谷。`, result);
    },
    finishQuilt(cells) {
      if (this.currentRealm() !== 'mei') return fail('拼布台在美谷的图书馆旁边。');
      const band = this.state.settings?.ageBand;
      if (!quiltReady(cells, band)) {
        if (band === 'older') return fail('转一转，让斜对角的颜色一样。');
        if (band === 'bigger') return fail('让左右两边变成对称。');
        return fail('先点四个颜色。');
      }
      if ((this.state.inventory.cloth || 0) < 1) return fail('旧布头还不够。去旧衣回收箱拿，不用答题。');
      if (!isCount((this.state.inventory['quilt-patch'] || 0) + 1)) return fail('拼布块已经很多了。');
      this.mutate((state) => {
        state.inventory.cloth -= 1;
        state.inventory['quilt-patch'] += 1;
        grant(state, 'mei-quilt-first');
      });
      const colors = cells.map((id) => QUILT_COLORS.find((item) => item.id === id)?.name || id).join('、');
      return ok(`拼好一块：${colors}。这和今天的日期无关。`);
    },
    setLanternFace(face) {
      if (!PUMPKIN_FACES.some((item) => item.id === face)) return fail('选笑脸、猫脸或星星。');
      if (!lanternAnyDate()) return fail('今天也能做。');
      const realm = realmOf(this.state);
      if (!realm) return fail('先到美谷。');
      this.mutate((state) => { realmOf(state).decor.face = face; });
      return ok(`选了${PUMPKIN_FACES.find((item) => item.id === face).name}。暖暖的，不吓人。`);
    },
    tradeMei(id = 'bean-syrup') {
      if (this.state.settings?.ageBand !== 'older') return fail('交换板是给 10–12 岁看比例的。想送东西，可以直接送礼物。');
      if (this.currentRealm() !== 'mei') return fail('交换板在美谷。');
      const offer = MEI_TRADES.find((item) => item.id === id);
      if (!offer) return fail('这一换还没有。');
      if ((this.state.inventory[offer.giveItem] || 0) < offer.giveCount) {
        return fail(`${ITEMS[offer.giveItem].name}还差 ${offer.giveCount - (this.state.inventory[offer.giveItem] || 0)} 份。这是游戏约定的比例。`);
      }
      if (!isCount((this.state.inventory[offer.getItem] || 0) + offer.getCount)) return fail('背包里这种东西已经很多了。');
      this.mutate((state) => {
        state.inventory[offer.giveItem] -= offer.giveCount;
        state.inventory[offer.getItem] += offer.getCount;
        const realm = realmOf(state);
        const prev = realm.trades.find((item) => item.id === offer.id);
        if (prev) prev.count += 1;
        else realm.trades.push({ id: offer.id, count: 1 });
      });
      return ok(`换到了 ${offer.getCount} 份${ITEMS[offer.getItem].name}。${offer.note}`);
    },
    giveMeiGift(item = 'thanks-card', friendId = 'joe') {
      if (this.currentRealm() !== 'mei') return fail('先到美谷，再把礼物送给朋友。');
      if (!['thanks-card', 'maple-syrup', 'quilt'].includes(item)) return fail('可以送感谢卡、枫糖浆或拼布挂毯。');
      if ((this.state.inventory[item] || 0) < 1) return fail(`背包里还没有${ITEMS[item].name}。`);
      const names = { maya: 'Maya', will: 'Will', orv: 'Orv', rivera: 'Rivera 老师', joe: 'Joe 爷爷' };
      const friend = names[friendId] ? friendId : 'joe';
      this.mutate((state) => {
        state.inventory[item] -= 1;
        const gift = `${friend}:${item}`;
        if (!state.travel.gifts.given.includes(gift)) state.travel.gifts.given.push(gift);
      });
      const line = item === 'thanks-card' ? '谢谢你记得收获。' : '谢谢你带来的礼物。';
      return ok(`${names[friend]}说：${line}`);
    },
  });
}

export function advanceMaple(proc) {
  if (!proc || proc.kind !== 'maple' || proc.stage === 'ready') return proc;
  proc.elapsed = Math.min(MAPLE_TOTAL_SECONDS, proc.elapsed + 1);
  proc.stage = mapleStage(proc.elapsed);
  return proc;
}
