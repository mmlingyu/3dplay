/** Valley cast for the star-map story. Lines live here so the valley plays with no knowledge service. */

import { normalizeAgeBand } from './realm-data.js';

export const VALLEY_AUDIO = Object.freeze([
  'fog-libai',
  'restore-water',
  'restore-light',
  'restore-sky',
  'restore-all',
  'boatman',
  'aunt',
  'grandma',
  'mumu',
  'swallow',
  'finale-libai',
]);

export const LIBAI_FOG_LINE = '雾不会伤害任何东西，只是让大家看不清彼此。把星河图拼回来，雾就会散。';

export const PAPER_BOAT_LETTER = '纸船上画着三格：红白铁塔、一列电车、河边的渡口。小燕说，海那边的日谷有这样的塔。不去也没关系。';

export const VALLEY_CAST = Object.freeze([
  {
    id: 'boatman',
    name: '船伯',
    label: '船伯',
    action: '问船伯',
    junior: '今天风正好。想去日谷，就上船。不想去，就在河边看看。',
    senior: '今天风正好，去日谷吗？我年轻时的老搭档在那边守车站。不带豆子也找得到东西。',
    gift: '豆子我帮你备在心里了。不带也不耽误找潮之片。',
  },
  {
    id: 'aunt',
    name: '气球阿姨',
    label: '气球阿姨',
    action: '问阿姨',
    junior: '坐稳。飞高了，就到雾的上面。',
    senior: '小咕说，今晚的星星特别清楚。飞向星星是游戏里的幻想航线，真实的热气球飞不出大气层。',
  },
  {
    id: 'grandma',
    name: '珠珠奶奶',
    label: '珠珠奶奶',
    action: '问奶奶',
    junior: '雾会散的。你慢慢找，珠子还在。',
    senior: '雾只是看不清，珠子一颗都不会少。满十进一，数到三片就好。',
  },
  {
    id: 'mumu',
    name: '木木',
    label: '木木',
    action: '问木木',
    junior: '观星台的木头我看过了，还结实。',
    senior: '观星台是木头和石头搭的。这是游戏里的建筑，不判断真实承重。',
  },
  {
    id: 'swallow',
    name: '观察员小燕',
    label: '小燕',
    action: '看纸船',
    junior: '纸船到了。上面有塔，有车，还有渡口。',
    senior: '这是三格图画信。铁塔和电车在日谷，渡口就在咱们河边。',
  },
]);

export function valleyLine(id, ageBand, key = null) {
  if (id === 'libai') {
    return normalizeAgeBand(ageBand) === 'senior'
      ? `${LIBAI_FOG_LINE}旧观星台上有一面空石盘。`
      : LIBAI_FOG_LINE;
  }
  const person = VALLEY_CAST.find((item) => item.id === id);
  if (!person) return '';
  if (key && person[key]) return person[key];
  return normalizeAgeBand(ageBand) === 'senior' ? person.senior : person.junior;
}

export const RESTORE_LINES = Object.freeze({
  water: { junior: '看，河水又亮了！', senior: '潮之片放进石盘了。小河和渡口这一块，雾退开了。', icon: 'water' },
  light: { junior: '看，灯又亮了！', senior: '光之片放进石盘了。家里的灯和窗户又暖了。', icon: 'lantern' },
  sky: { junior: '看，星星回来了！', senior: '星之片放进石盘了。观星台又看得见星星。', icon: 'star' },
  all: { junior: '雾都散开了！', senior: '家之片放进去了。石盘边上又亮起一个暗暗的第五个凹槽。', icon: 'sparkle' },
});

export function restoreLine(zone, ageBand) {
  const row = RESTORE_LINES[zone] || RESTORE_LINES.all;
  return normalizeAgeBand(ageBand) === 'senior' ? row.senior : row.junior;
}
