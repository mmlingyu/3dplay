/** Spoken lines for the valley journeys. Playback stays in voice.js. */

export const JOURNEY_CLIPS = Object.freeze([
  { id: 'journey-ferry-ri', voice: 'boatman', text: '今天风正好。替我向咪可站长问好。' },
  { id: 'journey-ferry-ri-senior', voice: 'boatman', text: '咪可站长是我的老搭档。到了日谷，替我问一声好。' },
  { id: 'journey-ferry-mei', voice: 'boatman', text: '这袋豆子带给 Joe 爷爷。不带也没关系。' },
  { id: 'journey-ferry-mei-senior', voice: 'boatman', text: '每年我都托船给 Joe 爷爷带豆子。你愿带就带，不带也找得到路。' },
  { id: 'journey-balloon-ri', voice: 'aunt', text: '你看，整座城的灯都在脚下。' },
  { id: 'journey-balloon-ri-senior', voice: 'aunt', text: '夜景在下面。铁塔和电车快出现了。' },
  { id: 'journey-balloon-mei', voice: 'aunt', text: '我们落到大字旁边的草坪。' },
  { id: 'journey-balloon-mei-senior', voice: 'aunt', text: '山坡上的大字是 USA。草坪就在它前面。' },
  { id: 'journey-balloon-xing', voice: 'aunt', text: '穿过云，去找小咕。这是游戏里的飞法。' },
  { id: 'journey-balloon-xing-senior', voice: 'aunt', text: '小咕在星星那边。这是幻想航线，真实的热气球飞不出大气层。' },
  { id: 'journey-back-ferry-ri', voice: 'boatman', text: '河水在前面。我们到家了。' },
  { id: 'journey-back-ferry-ri-senior', voice: 'boatman', text: '渡口在前面。回到河谷了。' },
  { id: 'journey-back-ferry-mei', voice: 'boatman', text: '晚霞留在后面。绿河到了。' },
  { id: 'journey-back-ferry-mei-senior', voice: 'boatman', text: '大船掉头。河谷的渡口在前面。' },
  { id: 'journey-back-balloon-ri', voice: 'aunt', text: '夜城变小了。家在雾下面。' },
  { id: 'journey-back-balloon-ri-senior', voice: 'aunt', text: '灯火留在后面。我们回河谷的草坪。' },
  { id: 'journey-back-balloon-mei', voice: 'aunt', text: '离开大字。往家里的河飞。' },
  { id: 'journey-back-balloon-mei-senior', voice: 'aunt', text: '晚霞淡了。河谷的草坪在下面。' },
  { id: 'journey-back-balloon-xing', voice: 'aunt', text: '雾在下面。家的草坪到了。' },
  { id: 'journey-back-balloon-xing-senior', voice: 'aunt', text: '穿过云，回到河谷的草坪。' },
]);

const BY_ID = new Map(JOURNEY_CLIPS.map((clip) => [clip.id, clip]));

export function journeySpeech(clipId, age = 'junior') {
  const senior = age === 'senior';
  const id = senior ? `${clipId}-senior` : clipId;
  return BY_ID.get(id) || BY_ID.get(clipId) || null;
}
