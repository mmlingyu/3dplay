/** Local beauty-valley characters. English lines are drafts until a native review. */

export const MEI_AUDIO = Object.freeze([
  'en-hello', 'en-sun', 'en-tree', 'en-friend', 'en-build',
  'en-cat', 'en-measure', 'en-test', 'en-fix', 'en-change',
  'en-action', 'en-cut', 'en-camera', 'en-star', 'en-light', 'en-take-two',
  'en-wide', 'en-medium', 'en-close', 'en-frames', 'en-ship',
  'zh-action', 'zh-cut', 'zh-board', 'zh-shot', 'zh-frames', 'zh-light', 'zh-shard', 'zh-back', 'zh-premiere',
]);

const review = Object.freeze({ status: 'draft', published: true });
const hidden = Object.freeze({ status: 'draft', published: false });

const WRIGHT = 'https://www.nps.gov/wrbr/learn/historyculture/theroadtothefirstflight.htm';
const YELLOWSTONE = 'https://www.nps.gov/yell/planyourvisit/parkfacts.htm';
const FOODS = 'https://www.si.edu/spotlight/thanksgiving/thanksgiving-foods';
const SYRUP = 'https://naturalresources.extension.iastate.edu/forestry/forest_products/syrup.html';
const NASA = 'https://www.nasa.gov/history/apollo-11-mission-overview/';

function ask(id, prompt, choices, yes, no, extra = {}) {
  return {
    id,
    ask: prompt,
    choices,
    yes,
    no,
    reading: extra.reading || '',
    audio: extra.audio || '',
    subject: extra.subject || 'lang-en',
    ref: extra.ref || WRIGHT,
    review,
  };
}

const hello = (id, subject = 'lang-en') => ask(
  id,
  '点一个打招呼的图',
  [
    { id: 'hello', text: 'hello', icon: 'heart', ok: true, audio: 'en-hello' },
    { id: 'tree', text: 'tree', icon: 'plant', ok: false, audio: 'en-tree' },
  ],
  'hello 是打招呼。',
  '再看一看图。材料不会少。',
  { reading: 'hello', audio: 'en-hello', subject },
);

export const meiTutorPack = {
  audience: '4-12',
  valley: 'mei',
  subjects: [
    { id: 'lang-en', name: '英语' },
    { id: 'craft', name: '手工' },
    { id: 'history', name: '历史' },
    { id: 'nature', name: '自然' },
    { id: 'math', name: '数学' },
  ],
  characters: [
    {
      id: 'maya',
      name: 'Maya',
      valley: 'mei',
      role: 'peer',
      style: 'kid',
      prop: 'plane',
      hello: "Maya 穿着黄衬衫，举起一只纸飞机。她说 Let's try!",
      place: '项目板旁边',
      x: 3.2,
      z: 5.2,
      guard: 0,
      review,
      care: [
        {
          id: 'look-try',
          label: '看一看',
          play: 'text',
          say: "Maya 说 Let's try! 先画，再做，再试。没飞远也可以改一个地方。不用答题。",
        },
        {
          id: 'make-plane',
          label: '做手工',
          play: 'text',
          say: '纸在图书馆，木棍可以用木板做。纸飞机的距离看一张定好的表。这是游戏里的简化模型。',
        },
      ],
      quiz: {
        little: [hello('maya-l1', 'craft')],
        bigger: [
          ask('maya-b1', 'c-a-t 拼起来是什么？', [
            { id: 'cat', text: 'cat', ok: true, audio: 'en-cat' },
            { id: 'sun', text: 'sun', ok: false, audio: 'en-sun' },
          ], 'c-a-t 是 cat。', '再听一遍三个音。', { reading: 'cat', audio: 'en-cat', subject: 'lang-en' }),
        ],
        older: [
          ask('maya-o1', '试过一次没成，下一句怎么说？', [
            { id: 'change', text: "It didn't work. Let's change one thing.", ok: true, audio: 'en-change' },
            { id: 'hello', text: 'hello', ok: false, audio: 'en-hello' },
          ], '一次只改一个地方。', '再听一遍。材料不会少。', { reading: "It didn't work. Let's change one thing.", audio: 'en-change', subject: 'craft', ref: WRIGHT }),
        ],
      },
    },
    {
      id: 'will',
      name: 'Will',
      valley: 'mei',
      role: 'maker',
      style: 'adult',
      prop: 'wheel',
      hello: 'Will 穿着蓝衬衫，站在自行车铺门口。他是以真实历史人物为原型的游戏角色。',
      place: '自行车铺',
      x: 6.5,
      z: 1.4,
      guard: 0,
      review,
      care: [
        {
          id: 'look-shop',
          label: '看一看',
          play: 'text',
          say: 'Will 和弟弟在自行车铺里试飞。1902 年的滑翔机大约试了 400 次，后来又试了 600 多次。1903 年才有动力飞行。这是以真实历史人物为原型的游戏角色。',
        },
        {
          id: 'make-wing',
          label: '做手工',
          play: 'text',
          say: '改一个地方再试。不用答题也能做纸飞机和风车。',
        },
        {
          id: 'fix-projector',
          label: '修放映机',
          play: 'text',
          say: '影院的老放映机缺齿轮、镜头和灯。和 Orv、咔嚓一起装上就行。不用答题，也不用先做别的故事。',
        },
      ],
      quiz: {
        little: [
          ask('will-l1', '点一棵树', [
            { id: 'tree', text: 'tree', icon: 'plant', ok: true, audio: 'en-tree' },
            { id: 'sun', text: 'sun', icon: 'sun', ok: false, audio: 'en-sun' },
          ], 'tree 是树。', '再看一看图。', { reading: 'tree', audio: 'en-tree', subject: 'lang-en' }),
        ],
        bigger: [
          ask('will-b1', '试飞之前先做什么？', [
            { id: 'test', text: 'test', ok: true, audio: 'en-test' },
            { id: 'hello', text: 'hello', ok: false },
          ], 'test 是试一试。', '再听一遍。', { reading: 'test', audio: 'en-test', subject: 'history', ref: WRIGHT }),
        ],
        older: [
          ask('will-o1', '莱特兄弟的动力飞行是哪一年？', [
            { id: '1903', text: '1903', ok: true },
            { id: '1872', text: '1872', ok: false },
          ], '1903 年他们飞起来了。这是游戏里的短句，细节在国家公园的说明里。', '1872 是黄石成为国家公园的年份。再看一看。', { subject: 'history', ref: WRIGHT }),
        ],
      },
    },
    {
      id: 'orv',
      name: 'Orv',
      valley: 'mei',
      role: 'maker',
      style: 'adult',
      prop: 'wheel',
      hello: 'Orv 穿着橙色衬衫，在铺子另一边。他是以真实历史人物为原型的游戏角色。',
      place: '自行车铺',
      x: 9.4,
      z: 1.6,
      guard: 0,
      review,
      care: [
        {
          id: 'look-glider',
          label: '看一看',
          play: 'text',
          say: 'Orv 说：滑翔机先试，再改一个地方。以真实历史人物为原型的游戏角色。1902 年大约 400 次，后来又有 600 多次试验。',
        },
        {
          id: 'make-fix',
          label: '做手工',
          play: 'text',
          say: '没转起来就改叶片或用风箱。不用答题。',
        },
      ],
      quiz: {
        little: [
          ask('orv-l1', '点一个朋友', [
            { id: 'friend', text: 'friend', icon: 'heart', ok: true, audio: 'en-friend' },
            { id: 'sun', text: 'sun', icon: 'sun', ok: false },
          ], 'friend 是朋友。', '再看一看。', { reading: 'friend', audio: 'en-friend' }),
        ],
        bigger: [
          ask('orv-b1', '坏了以后怎么说？', [
            { id: 'fix', text: 'fix', ok: true, audio: 'en-fix' },
            { id: 'cat', text: 'cat', ok: false, audio: 'en-cat' },
          ], 'fix 是改一改。', '再听一遍。', { reading: 'fix', audio: 'en-fix', subject: 'craft', ref: WRIGHT }),
        ],
        older: [
          ask('orv-o1', '哪一句是改一个地方？', [
            { id: 'change', text: "It didn't work. Let's change one thing.", ok: true, audio: 'en-change' },
            { id: 'build', text: 'build', ok: false, audio: 'en-build' },
          ], '一次只改一个地方。', 'build 是做。再听一遍。', { reading: "It didn't work. Let's change one thing.", audio: 'en-change', subject: 'history', ref: WRIGHT }),
        ],
      },
    },
    {
      id: 'rivera',
      name: 'Rivera',
      valley: 'mei',
      role: 'guide',
      style: 'adult',
      prop: 'book',
      hello: 'Rivera 老师穿着灰蓝色衬衫，在图书馆门口。',
      place: '小镇图书馆',
      x: 6.2,
      z: -8.4,
      guard: 0,
      review,
      care: [
        {
          id: 'look-words',
          label: '看一看',
          play: 'text',
          say: 'Rivera 老师指着书。hello、sun、tree、friend、build 都可以听。这些英语还是草稿，等母语者看过再定稿。',
        },
        {
          id: 'make-card',
          label: '做手工',
          play: 'text',
          say: '图书馆有纸。纸可以做纸飞机，也可以和拼布做成感谢卡。不用答题。',
        },
      ],
      quiz: {
        little: [
          ask('riv-l1', '点太阳', [
            { id: 'sun', text: 'sun', icon: 'sun', ok: true, audio: 'en-sun' },
            { id: 'tree', text: 'tree', icon: 'plant', ok: false, audio: 'en-tree' },
          ], 'sun 是太阳。', 'tree 是树。再看一看。', { reading: 'sun', audio: 'en-sun' }),
        ],
        bigger: [
          ask('riv-b1', 'build 是什么？', [
            { id: 'build', text: '做、搭建', ok: true, audio: 'en-build' },
            { id: 'cat', text: '猫', ok: false, audio: 'en-cat' },
          ], 'build 是做、搭建。', '猫是 cat。再听一遍。', { reading: 'build', audio: 'en-build', subject: 'lang-en' }),
        ],
        older: [
          ask('riv-o1', '测一测用哪个词？', [
            { id: 'measure', text: 'measure', ok: true, audio: 'en-measure' },
            { id: 'hello', text: 'hello', ok: false },
          ], 'measure 是量一量。', '再听一遍。', { reading: 'measure', audio: 'en-measure', subject: 'lang-en' }),
        ],
      },
    },
    {
      id: 'joe',
      name: 'Joe',
      valley: 'mei',
      role: 'elder',
      style: 'elder',
      prop: 'bucket',
      hello: 'Joe 爷爷提着桶，站在枫糖小屋旁边。',
      place: '枫糖小屋',
      x: -9.2,
      z: -6.2,
      guard: 0,
      review,
      care: [
        {
          id: 'look-sap',
          label: '看一看',
          play: 'text',
          say: '树汁大部分是水。现实里，含糖大约 2% 的树汁要很多份才熬出 1 份糖浆。游戏里 10 份熬成 1 份。早春树汁多，别的日子也能采。',
        },
        {
          id: 'make-syrup',
          label: '做手工',
          play: 'text',
          say: '去枫树林采树汁，拿一根树枝当燃料。不用答题。看锅的时候，熬制继续；暂停或离开页面就停。',
        },
      ],
      quiz: {
        little: [
          ask('joe-l1', '点一棵可以采树汁的树', [
            { id: 'tree', text: '枫树', icon: 'plant', ok: true, audio: 'en-tree' },
            { id: 'stone', text: '石块', icon: 'stone', ok: false },
          ], '枫树会流出树汁。', '石块不是树。再看一看。', { subject: 'nature', ref: SYRUP, reading: 'tree', audio: 'en-tree' }),
        ],
        bigger: [
          ask('joe-b1', '游戏里几份树汁熬成 1 份糖浆？', [
            { id: 'ten', text: '10', ok: true },
            { id: 'one', text: '1', ok: false },
          ], '这里是 10 比 1。现实里要多得多。', '1 份树汁熬不成 1 份糖浆。再看一看。', { subject: 'math', ref: SYRUP }),
        ],
        older: [
          ask('joe-o1', '黄石在哪一年成为国家公园？', [
            { id: '1872', text: '1872', ok: true },
            { id: '1903', text: '1903', ok: false },
          ], '1872 年黄石成为第一个国家公园。间歇泉只是景观，不是地质模拟。', '1903 是动力飞行的年份。再看一看。', { subject: 'nature', ref: YELLOWSTONE }),
        ],
      },
    },
    {
      id: 'draft-hidden',
      name: '未发布',
      valley: 'mei',
      role: 'peer',
      style: 'kid',
      published: false,
      review: hidden,
      care: [{ id: 'hidden', label: '看一看', play: 'text', say: '这段还没给孩子看。' }],
      quiz: { little: [ask('hid-1', '不要出现', [{ id: 'a', text: '甲', ok: true }], '不该看到。', '不该看到。')] },
    },
  ],
  cards: [
    {
      id: 'card-wright',
      title: '自行车铺里的试验',
      ref: WRIGHT,
      review,
      say: '以真实历史人物为原型的游戏角色。1902 年滑翔机大约试了 400 次，后来又有 600 多次。1903 年有了动力飞行。',
    },
    {
      id: 'card-yellowstone',
      title: '黄石',
      ref: YELLOWSTONE,
      review,
      say: '1872 年黄石成为第一个国家公园。游戏里的间歇泉只是景观。',
    },
    {
      id: 'card-foods',
      title: '美洲来的食物',
      ref: FOODS,
      review,
      say: '玉米、土豆、番茄和辣椒都起源于美洲。',
    },
    {
      id: 'card-apollo',
      title: '一句更长的话',
      ref: NASA,
      review,
      band: 'older',
      say: 'Ages 10–12 can read one longer sentence: people flew to the Moon in 1969. This line stays a draft.',
    },
  ],
};
