/** Alien-valley copy, stamps and switches. Festivals stay empty until a later pass. */

export const XING_OPEN = true;

export function starRouteVisible({ open = XING_OPEN, realm = 'he', phase = 'tour' } = {}) {
  return Boolean(open) && realm === 'he' && phase === 'tour';
}
export const STAR_SECONDS = 3.5;
export const PUZZLE_SALT = 2;

export const FANTASY_ROUTE = '这是游戏里的幻想航线，真实的热气球飞不出大气层。';
export const GRAVITY_LINE = '规律还是同一个，只是这颗星拉东西的力小一点（约为地球的 1/3）。';
export const MODEL_LINE = '同样的规律，不同的参数；这是简化模型，不是完整的行星物理。';
export const QUARANTINE_NOTE = '外星的植物要留在它自己的家，我们可以把它放进展柜看。';
export const HOME_SKY_NOTE = '那颗蓝色的小点，是家的方向。这是游戏里的想象。';

export const DOME_SPEAK = '这一块星星，和家里的夜空是同一张。点大星星，补上穹顶。';
export const DOME_HOME = '带着星之片回家。观星台就能看见星星。';
export const DOME_NORTH = '这块在家的北边。';
export const SHIP_LINE = '咕咕号停在旁边。星图可以看，这一版还不开船。';
export const FESTIVAL_LINE = '两颗月亮一起圆。这是幻想里的团圆夜。';
export const ARENA_SPEAK = '三个人合在一起算。没有输赢。';

export const XING_STAMPS = Object.freeze([
  { id: 'xing-arrive', name: '到达外星谷', icon: 'star', how: '坐热气球，点飞向星星。不用答题，也不用解谜。' },
  { id: 'xing-gugu-home', name: '送小咕回家', icon: 'alien', how: '跟着小咕的手势坐热气球。不用认字，也不用解谜。' },
  { id: 'xing-crystal-first', name: '第一块盐晶', icon: 'crystal', how: '盐放够，静置到析出。不用答题。' },
  { id: 'xing-experiment', name: '完成一次对照实验', icon: 'lab', how: '在试验站看一次跳跃，或做一次晶体对比。不用答题。' },
  { id: 'xing-moss-seen', name: '看见光苔', icon: 'moss', how: '走到光苔旁边看一看。不用答题。光苔是幻想生物。' },
  { id: 'xing-dome', name: '补全穹顶', icon: 'star', how: '在星网把缺掉的星图补上。体验模式点一次大星星就行。' },
]);

export const XING_SIGNS = Object.freeze([
  { id: 'sign-moss', glyph: 'moss', x: 3, z: 6, name: '路牌' },
  { id: 'sign-lamp', glyph: 'lamp', x: -2, z: 4, name: '路牌' },
]);

export const XING_AUDIO = Object.freeze([
  'xing-gugu-hello',
  'xing-crystal',
  'xing-lamp',
]);
