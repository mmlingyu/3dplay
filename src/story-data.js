/** Star-map story rules. Fog is a picture. Shards are read from each valley. */

import { DISCOVER_HEIGHT } from './vista-data.js';
import { normalizeAgeBand } from './realm-data.js';
import { PAPER_BOAT_LETTER } from './valley-tutors.js';

export { DISCOVER_HEIGHT };

export const STORY_LETTER_ID = 'letter-story-boat';
export const PAPER_BOAT_TEXT = PAPER_BOAT_LETTER;
export const RESTORE_IDS = Object.freeze(['water', 'light', 'sky', 'all']);
export const PLACE_IDS = Object.freeze(['yard', 'garden', 'dock', 'balloon', 'observatory']);
export const SHARD_REALMS = Object.freeze({
  tide: 'ri',
  light: 'mei',
  star: 'xing',
});
export const ZONE_FOR_SHARD = Object.freeze({
  tide: 'water',
  light: 'light',
  star: 'sky',
});

const OBSERVATORY_SITES = Object.freeze([
  { id: 'west-clearing', x: -13, z: 2, radius: 2.3 },
  { id: 'west-lower', x: -13, z: 6, radius: 2.2 },
  { id: 'east-clearing', x: 12, z: 2, radius: 2.2 },
  { id: 'east-north', x: 12, z: -6, radius: 2.2 },
  { id: 'south-west', x: -8, z: 8, radius: 2.0 },
]);

function occupied(blocks, x, z, radius) {
  return (blocks || []).some((block) => Math.hypot((Number(block?.x) || 99) - x, (Number(block?.z) || 99) - z) <= radius + 0.55);
}

/** Same idea as chooseDockSite: first empty patch, then a short scan. */
export function chooseObservatorySite(blocks = []) {
  for (const site of OBSERVATORY_SITES) {
    if (!occupied(blocks, site.x, site.z, site.radius)) return { ...site };
  }
  for (const z of [2, 6, -2, 8, -6, 10, -10]) {
    const site = { id: `clear-${z}`, x: -13, z, radius: 1.8 };
    if (!occupied(blocks, site.x, site.z, site.radius)) return site;
  }
  return { id: 'fallback', x: -13, z: 2, radius: 1.6 };
}

export function observatorySite(travel, blocks = []) {
  const saved = travel?.story?.site;
  if (saved && Number.isInteger(saved.x) && Number.isInteger(saved.z)) {
    return { id: 'saved', x: saved.x, z: saved.z, radius: 2.2 };
  }
  return chooseObservatorySite(blocks);
}

export function emptyNudges(chapter = 'prologue') {
  return { vista: 0, bottle: 0, dock: 0, balloon: 0, stuck: 0, day: -1, last: '', chapter };
}

export function realmShards(travel) {
  const realms = travel?.realms || {};
  return {
    tide: realms.ri?.storyShard === true,
    light: realms.mei?.storyShard === true,
    star: realms.xing?.storyShard === true,
  };
}

export function storyChapter(travel) {
  const story = travel?.story || {};
  if (!story.fogIntro) return 'prologue';
  const shards = realmShards(travel);
  if (!shards.tide) return 'ri';
  if (!shards.light) return 'mei';
  if (!shards.star) return 'xing';
  if ((story.homePlaces || []).length < 3) return 'finale';
  if (!(story.restored || []).includes('all')) return 'finale';
  if (!story.festival) return 'festival';
  return 'done';
}

export function pendingZones(travel) {
  const story = travel?.story || {};
  const restored = new Set(story.restored || []);
  if (restored.has('all')) return [];
  const shards = realmShards(travel);
  const list = [];
  if (shards.tide && !restored.has('water')) list.push('water');
  if (shards.light && !restored.has('light')) list.push('light');
  if (shards.star && !restored.has('sky')) list.push('sky');
  const home = (story.homePlaces || []).length >= 3;
  if (home && shards.tide && shards.light && shards.star && list.length === 0) list.push('all');
  return list;
}

export function prologueTrigger({ fogIntro = false, period = '', height = 0, touring = false } = {}) {
  if (fogIntro) return null;
  if (touring) return 'tour';
  if (period === '晚上' || period === '深夜') return 'night';
  if (Number(height) >= DISCOVER_HEIGHT) return 'balloon';
  return null;
}

export function fogProfile(ageBand) {
  const senior = normalizeAgeBand(ageBand) === 'senior';
  return senior
    ? { density: 0.018, color: '#9aa8b8', warm: false, lamp: 0.35, icon: false }
    : { density: 0.009, color: '#f4e4d2', warm: true, lamp: 0.62, icon: true };
}

/** Picture only. Density is not stored. 6–8 is about half of 9–12, and warmer. */
export function storyFog({ travel, ageBand = null, height = 0, reveal = null } = {}) {
  const story = travel?.story || {};
  const profile = fogProfile(ageBand);
  const shards = realmShards(travel);
  const restored = new Set(story.restored || []);
  const zones = {
    water: restored.has('water') || restored.has('all'),
    light: restored.has('light') || restored.has('all'),
    sky: restored.has('sky') || restored.has('all'),
    all: restored.has('all'),
  };
  if (reveal?.zone && zones[reveal.zone]) zones[reveal.zone] = false;
  const above = Number(height) >= DISCOVER_HEIGHT;
  if (!story.fogIntro || story.fogOff || zones.all) {
    return { visible: false, density: 0, above, warm: profile.warm, color: profile.color, icon: false, lamp: 1, zones, shards };
  }
  const covered = ['water', 'light', 'sky'].filter((zone) => !zones[zone]).length;
  const base = covered === 0 ? 0 : profile.density * (0.55 + covered * 0.2);
  const density = above ? 0 : base;
  return {
    visible: density > 0,
    density,
    above,
    warm: profile.warm,
    color: profile.color,
    icon: profile.icon && !zones.all,
    lamp: zones.light ? 1 : profile.lamp,
    zones,
    shards,
  };
}

export function guideText(travel) {
  const chapter = storyChapter(travel);
  const lines = {
    prologue: '先看雾慢慢进来。可以点「跳过」。然后去西边的观星台，看石盘。',
    ri: '下一步去日谷：走到渡口，点「去日谷」。找到潮之片再回家。右上角「跳到下一章」也能先把这一片记下。',
    mei: '下一步去美谷：渡口坐大船，或热气球上看风景。找到光之片再回家。',
    xing: '下一步坐热气球，飞高以后点「飞向星星」。找到星之片再回家。这是游戏里的幻想航线。',
    finale: '三片都在了。到观星台选 3 个最喜欢的地方，刻成家之片。',
    festival: '雾散开了。想办四谷星河节，就在观星台点「今天就办」。不办也可以接着玩。',
    done: '星河节可以再看。想去哪一谷，都由你决定。',
  };
  return lines[chapter] || lines.prologue;
}

export function clueLine(realm, ageBand) {
  const senior = normalizeAgeBand(ageBand) === 'senior';
  const lines = {
    ri: senior ? '去找有胶片孔的地方。日谷的石片背面连着一排小孔。' : '去日谷。纸船上画着红白塔。',
    mei: senior ? '去找会发光的影院。光穿过的那块石头，就是光之片。' : '去美谷。那边有暖暖的灯。',
    xing: senior ? '星网穹顶缺的那一块，和家里的夜空是同一张图。' : '坐热气球，飞向星星。',
  };
  return lines[realm] || '慢慢找就好。';
}

export function routeClear(travel) {
  const shards = realmShards(travel);
  const restored = new Set(travel?.story?.restored || []);
  return {
    ri: shards.tide || restored.has('water') || restored.has('all'),
    mei: shards.light || restored.has('light') || restored.has('all'),
    xing: shards.star || restored.has('sky') || restored.has('all'),
  };
}

const NUDGE_ORDER = ['vista', 'dock', 'balloon', 'bottle'];

export function planNudge({ travel, day = 0, height = 0, nearDock = false, nearBalloon = false, discovered = {}, period = '' } = {}) {
  const story = travel?.story || {};
  if (!story.fogIntro || story.hintsOff || story.fogOff) return null;
  const chapter = storyChapter(travel);
  if (chapter === 'done' || chapter === 'festival' || chapter === 'finale' || chapter === 'prologue') return null;
  const nudges = { ...emptyNudges(chapter), ...(story.nudges || {}) };
  if (nudges.chapter && nudges.chapter !== chapter) return { reset: true, chapter };
  if (nudges.day === day) return null;
  const shards = realmShards(travel);
  const candidates = [];
  if (Number(height) >= DISCOVER_HEIGHT) {
    const goal = chapter === 'mei' ? 'mei' : chapter === 'xing' ? 'xing' : 'ri';
    if (!discovered?.[goal]) candidates.push('vista');
  }
  if (nearDock && (chapter === 'ri' || chapter === 'mei')) candidates.push('dock');
  if (nearBalloon && (shards.light || chapter === 'xing')) candidates.push('balloon');
  if ((period === '傍晚' || period === '晚上') && discovered) {
    const missing = ['ri', 'mei', 'xing'].find((id) => discovered[id] && !realmShards(travel)[{ ri: 'tide', mei: 'light', xing: 'star' }[id]]);
    if (missing) candidates.push('bottle');
  }
  for (const id of NUDGE_ORDER) {
    if (!candidates.includes(id)) continue;
    if ((nudges[id] || 0) >= 3) continue;
    return { id, chapter, day };
  }
  return null;
}

export function nudgeSpeech(id, ageBand) {
  const senior = normalizeAgeBand(ageBand) === 'senior';
  const lines = {
    vista: senior ? '那是纸船上画的方向。发现以后会盖一枚章。' : '看那边，有一座认得出来的影子。',
    dock: senior ? '今天风正好。上船或走开，都可以。' : '今天风正好，要去看看吗？',
    balloon: senior ? '小咕说，今晚的星星特别清楚。飞向星星是幻想航线。' : '小咕说，今晚的星星特别清楚。',
    bottle: senior ? '瓶子里有一张小图，画着碎片可能在的地方。' : '岸边漂来一只瓶子，里面有一张小图。',
    stuck: '再去的时候，跟着亮亮的脚印走就好。不跟着也能自己找。',
  };
  return lines[id] || '';
}

export function homeChoices(blocks = []) {
  const list = [
    { id: 'yard', label: '我的小院' },
    { id: 'garden', label: '菜园' },
    { id: 'dock', label: '渡口' },
    { id: 'balloon', label: '热气球草场' },
    { id: 'observatory', label: '观星台' },
  ];
  const built = (blocks || []).find((block) => block?.item === 'plank' || block?.item === 'roof' || block?.item === 'door');
  if (built?.id) list.unshift({ id: built.id, label: '我盖的地方' });
  return list.slice(0, 6);
}

export function drawStarOverlay(ctx, layout, travel) {
  if (!travel?.story?.fogIntro || !ctx || !layout) return;
  const clear = routeClear(travel);
  ctx.save();
  ctx.strokeStyle = 'rgba(186, 214, 255, .85)';
  ctx.lineWidth = 2;
  ctx.setLineDash([2, 6]);
  ctx.beginPath();
  ctx.moveTo(layout.home.x - 36, layout.home.y - 8);
  ctx.quadraticCurveTo(layout.home.x, layout.home.y - 46, layout.xing.x, layout.xing.y + 16);
  ctx.stroke();
  ctx.setLineDash([]);
  const routes = [
    ['ri', layout.dock, layout.ri],
    ['mei', layout.dock, layout.mei],
    ['xing', layout.balloon, layout.xing],
  ];
  for (const [id, from, to] of routes) {
    ctx.strokeStyle = clear[id] ? 'rgba(255, 236, 170, .95)' : 'rgba(120, 132, 140, .45)';
    ctx.lineWidth = clear[id] ? 4 : 6;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    if (!clear[id]) {
      ctx.fillStyle = '#3d4a55';
      ctx.font = '700 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', (from.x + to.x) / 2, (from.y + to.y) / 2);
    }
  }
  ctx.fillStyle = '#fff6d8';
  ctx.beginPath();
  ctx.arc(layout.home.x, layout.home.y - 18, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function applySkip(state, emptyRealm) {
  const travel = state.travel;
  const story = travel.story;
  const chapter = storyChapter(travel);
  if (chapter === 'prologue') {
    story.fogIntro = true;
    if (!story.site) {
      const site = chooseObservatorySite(state.blocks);
      story.site = { x: site.x, z: site.z };
    }
    return chapter;
  }
  if (chapter === 'ri' || chapter === 'mei' || chapter === 'xing') {
    if (!travel.realms[chapter] && emptyRealm) travel.realms[chapter] = emptyRealm(chapter);
    if (travel.realms[chapter]) travel.realms[chapter].storyShard = true;
    return chapter;
  }
  if ((story.homePlaces || []).length < 3) story.homePlaces = ['yard', 'garden', 'dock'];
  else story.festival = true;
  return chapter;
}

export function gameDay(elapsed = 0) {
  const value = Number(elapsed) || 0;
  return Math.floor(value / 240);
}
