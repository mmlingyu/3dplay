/** Local alien-valley lines. Drafts until a content review. No live chat. */

const review = Object.freeze({ status: 'draft', published: true });
const hidden = Object.freeze({ status: 'draft', published: false });

const WEIGHT = 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/weight-equation-2/';
const ROSETTA = 'https://www.britishmuseum.org/blog/everything-you-ever-wanted-know-about-rosetta-stone';
const PARK = 'https://nps.gov/yell/planyourvisit/parkfacts.htm';

function ask(id, prompt, choices, yes, no, extra = {}) {
  return {
    id,
    ask: prompt,
    choices,
    yes,
    no,
    reading: extra.reading || '',
    audio: extra.audio || '',
    subject: extra.subject || 'logic',
    ref: extra.ref || '',
    icon: extra.icon || '',
    review,
  };
}

export const xingTutorPack = {
  audience: '4-12',
  valley: 'xing',
  subjects: [
    { id: 'logic', name: '逻辑' },
    { id: 'science', name: '科学' },
    { id: 'math', name: '数学' },
  ],
  characters: [
    {
      id: 'gugu',
      name: '小咕',
      valley: 'xing',
      role: 'peer',
      style: 'alien',
      prop: 'none',
      hello: '小咕是圆圆的，有四根手指，正指向热气球。',
      place: '热气球旁边',
      x: -6,
      z: 6,
      guard: 0,
      review,
      care: [
        { id: 'look-gugu', label: '看一看', play: 'text', say: '小咕挥挥四根手指，又指向热气球。一起飞，就能到家。不用认字。' },
        { id: 'look-dark', label: '点一盏灯', play: 'text', say: '小咕有点怕黑。我们一起点灯，路上就是暖的。' },
      ],
      quiz: {
        little: [
          ask('g-l1', '点蓝色的水', [
            { id: 'water', text: '水', icon: 'water', ok: true },
            { id: 'leaf', text: '叶子', icon: 'plant', ok: false },
          ], '蓝色是水。', '再看颜色。材料不会少。', { subject: 'logic', icon: 'water', audio: 'xing-gugu-hello' }),
        ],
        bigger: [
          ask('g-b1', '绿色的符号多半和什么有关？', [
            { id: 'plant', text: '植物', icon: 'plant', ok: true },
            { id: 'tool', text: '工具', icon: 'craft', ok: false },
          ], '绿色是植物。', '工具是灰色。再看一次。', { subject: 'logic' }),
        ],
        older: [
          ask('g-o1', '对照着看，才能读懂陌生的文字。罗塞塔石碑用了几种文字刻同一份诏令？', [
            { id: 'three', text: '三种', ok: true },
            { id: 'one', text: '一种', ok: false },
          ], '三种文字里有希腊文。商博良在 1822 年宣布了突破。', '再看那张线索卡。', { subject: 'logic', ref: ROSETTA }),
        ],
      },
    },
    {
      id: 'jingjing',
      name: '晶晶博士',
      valley: 'xing',
      role: 'guide',
      style: 'alien',
      prop: 'lens',
      hello: '晶晶博士戴着圆眼镜，喜欢问：你怎么知道的？',
      place: '试验站',
      x: -9,
      z: -2,
      guard: 0,
      review,
      care: [
        { id: 'look-lab', label: '看一看', play: 'text', say: '一次只改一个条件。猜一猜，改一改，做一做，看结果，再说结论。' },
        { id: 'look-crystal', label: '看晶体', play: 'text', say: '盐放得够多，静置后会析出晶体。放得少，就很少，或者没有。时间缩短了。', audio: 'xing-crystal' },
      ],
      quiz: {
        little: [
          ask('j-l1', '同一个球，哪里跳得更高？', [
            { id: 'xing', text: '力小的地方', icon: 'jump', ok: true },
            { id: 'same', text: '完全一样高', icon: 'ball', ok: false },
          ], '力小一点，跳得高一点。规律还是同一个。', '再看两次。材料不会少。', { subject: 'science', ref: WEIGHT }),
        ],
        bigger: [
          ask('j-b1', '对照实验要改几个条件？', [
            { id: 'one', text: '一个', icon: 'check', ok: true },
            { id: 'many', text: '一起改很多个', icon: 'craft', ok: false },
          ], '一次只改一个，才知道是哪一个造成了不同。', '改很多个就分不清了。', { subject: 'science', ref: WEIGHT }),
        ],
        older: [
          ask('j-o1', '黄石公园的介绍里，列出了多少种入侵植物？', [
            { id: '225', text: '225 种', ok: true },
            { id: 'zero', text: '一种也没有', ok: false },
          ], '所以活的生物不能随便带回家。展柜可以看。', '再看那张知识卡。', { subject: 'science', ref: PARK }),
        ],
      },
    },
    {
      id: 'lingyi',
      name: '零一',
      valley: 'xing',
      role: 'guide',
      style: 'robot',
      prop: 'none',
      hello: '零一是圆角的小机器人，说话很整齐。',
      place: '符号塔旁边',
      x: 0,
      z: -6,
      guard: 0,
      review,
      care: [
        { id: 'look-four', label: '看一看', play: 'text', say: '小咕有四根手指。外星的 10 等于我们的 4。' },
        { id: 'look-bits', label: '再看一位', play: 'text', say: '零和一也可以排成一串。这里先认识四进制，二进制只是旁边的一种排法。' },
      ],
      quiz: {
        little: [
          ask('z-l1', '点 1 个点', [
            { id: 'one', text: '1', icon: 'check', ok: true },
            { id: 'three', text: '3', icon: 'craft', ok: false },
          ], '一个点就是 1。', '再数一次。材料不会少。', { subject: 'math' }),
        ],
        bigger: [
          ask('z-b1', '2 个点加 2 个点是多少？', [
            { id: 'four', text: '4', ok: true },
            { id: 'two', text: '2', ok: false },
          ], '2 加 2 是 4。', '把点都数上。', { subject: 'math' }),
        ],
        older: [
          ask('z-o1', '外星的 10 等于我们的几？', [
            { id: 'four', text: '4', ok: true },
            { id: 'ten', text: '10', ok: false },
          ], '每一位是四倍，所以 10 等于 4。33 等于 15。', '再看四根手指。', { subject: 'math' }),
        ],
      },
    },
    {
      id: 'draft-xing',
      name: '未发布访客',
      valley: 'xing',
      role: 'guide',
      style: 'alien',
      prop: 'none',
      hello: '这篇还不能出现。',
      place: '不出现',
      x: 1,
      z: 1,
      guard: 0,
      review: hidden,
      published: false,
      care: [{ id: 'hidden', label: '看一看', play: 'text', say: '不发布。' }],
      quiz: { little: [], bigger: [], older: [] },
    },
  ],
};
