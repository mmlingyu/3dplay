/** Local day-valley characters. Japanese lines are drafts until a native review. */

export const RI_AUDIO = Object.freeze([
  'ja-konnichiwa',
  'ja-arigatou',
  'ja-oyasumi',
  'ja-sakura',
  'ja-yama',
  'ja-kawa',
  'ja-aiueo',
]);

export const RI_JAPANESE_DRAFT = Object.freeze([
  { text: 'こんにちは', reading: 'konnichiwa', note: '白天见面的招呼' },
  { text: 'ありがとう', reading: 'arigatou', note: '谢谢' },
  { text: 'おやすみ', reading: 'oyasumi', note: '休息时的招呼' },
  { text: 'さくら', reading: 'sakura', note: '樱花，平假名' },
  { text: 'やま', reading: 'yama', note: '山' },
  { text: 'かわ', reading: 'kawa', note: '河' },
  { text: 'あいうえお', reading: 'aiueo', note: '平假名的五个元音' },
  { text: '気', reading: 'ki', note: '和中文的「气」不是同一个字' },
]);

const review = Object.freeze({ status: 'draft', published: true });
const hidden = Object.freeze({ status: 'draft', published: false });

const HIRAGANA = 'https://www.britannica.com/topic/hiragana';
const WASHI = 'https://ich.unesco.org/en/RL/washi-craftsmanship-of-traditional-japanese-hand-made-paper-01001';
const GASSHO = 'https://whc.unesco.org/en/list/734';

function ask(id, prompt, choices, yes, no, extra = {}) {
  return {
    id,
    ask: prompt,
    choices,
    yes,
    no,
    reading: extra.reading || '',
    audio: extra.audio || '',
    subject: extra.subject || 'lang-ja',
    ref: extra.ref || HIRAGANA,
    review,
  };
}

export const riTutorPack = {
  audience: '4-12',
  valley: 'ri',
  subjects: [
    { id: 'lang-ja', name: '日语' },
    { id: 'craft', name: '手工' },
  ],
  characters: [
    {
      id: 'koharu',
      name: '小春',
      valley: 'ri',
      role: 'peer',
      style: 'kid',
      prop: 'paper',
      hello: '小春穿着蓝衬衫，站在纸坊门口。',
      place: '纸坊门口',
      x: -6.2,
      z: -4.2,
      guard: 0,
      review,
      care: [
        {
          id: 'look-hello',
          label: '看一看',
          play: 'text',
          say: '小春挥挥手。白天见面可以说こんにちは。阅读：konnichiwa。字「気」和中文的「气」不是同一个字。',
        },
        {
          id: 'look-flag',
          label: '做手工',
          play: 'text',
          say: '旗杆上的纸鲤鱼旗缺了一块。用和纸和竹篾补上就好。不用答题，楮树林里也能采到楮皮。',
        },
      ],
      quiz: {
        little: [
          ask('k-l1', '点一个白天的图', [
            { id: 'sun', text: '太阳', icon: 'sun', ok: true },
            { id: 'water', text: '水滴', icon: 'water', ok: false },
          ], 'こんにちは是白天的招呼。', '再看一看图。材料不会少。', { reading: 'こんにちは', audio: 'ja-konnichiwa' }),
        ],
        bigger: [
          ask('k-b1', 'さくら是什么？', [
            { id: 'flower', text: '樱花', icon: 'plant', ok: true },
            { id: 'mountain', text: '山', icon: 'stone', ok: false },
          ], 'さくら是樱花。', '山是やま。再试一次。', { reading: 'さくら', audio: 'ja-sakura' }),
        ],
        older: [
          ask('k-o1', '平假名的五个元音，开头是哪一个？', [
            { id: 'a', text: 'あ', ok: true },
            { id: 'i', text: 'い', ok: false },
          ], 'あいうえお从あ开始。', '再听一遍五个音。', { reading: 'あいうえお', audio: 'ja-aiueo' }),
        ],
      },
    },
    {
      id: 'kozo-elder',
      name: '楮叶奶奶',
      valley: 'ri',
      role: 'guide',
      style: 'elder',
      prop: 'paper',
      hello: '楮叶奶奶系着围裙，在纸坊里。',
      place: '纸坊',
      x: -9.2,
      z: -4.5,
      guard: 0,
      review,
      care: [
        {
          id: 'look-washi',
          label: '看一看',
          play: 'image',
          image: 'washi',
          say: '和纸用楮树皮的纤维。剥皮蒸煮、敲打、加水、竹帘抄纸，然后晾干。这里的时间缩短了。',
        },
        {
          id: 'make-washi',
          label: '做手工',
          play: 'text',
          say: '去楮树林采楮皮，再来纸坊做和纸。答题只是可选的小补给，不做也能做纸。',
        },
      ],
      quiz: {
        little: [
          ask('e-l1', '和纸的纤维从哪来？点一棵树', [
            { id: 'tree', text: '楮树', icon: 'plant', ok: true },
            { id: 'stone', text: '石块', icon: 'stone', ok: false },
          ], '楮树皮里有做纸的纤维。', '石块不能做成纸。再看一看。', { subject: 'craft', ref: WASHI, audio: 'ja-arigatou', reading: 'ありがとう' }),
        ],
        bigger: [
          ask('e-b1', '抄纸时用什么把纤维捞起来？', [
            { id: 'screen', text: '竹帘', icon: 'craft', ok: true },
            { id: 'fire', text: '火焰', icon: 'sun', ok: false },
          ], '竹帘用来抄纸。', '火是后来才用不上的。再选一次。', { subject: 'craft', ref: WASHI }),
        ],
      },
    },
    {
      id: 'ponta',
      name: '狸猫阿哲',
      valley: 'ri',
      role: 'peer',
      style: 'animal',
      prop: 'paper',
      hello: '狸猫阿哲围着围巾，坐在竹林边。',
      place: '竹林边',
      x: 9.2,
      z: -6.2,
      guard: 0,
      review,
      care: [
        {
          id: 'look-fold',
          label: '看一看',
          play: 'text',
          say: '对折、再对折，两边一样长，这是折纸。游戏里一次折好，真实折纸有很多步。',
        },
        {
          id: 'make-crane',
          label: '做手工',
          play: 'text',
          say: '一张和纸可以折纸鹤或纸船。这是游戏约定。不用答题。',
        },
      ],
      quiz: {
        little: [
          ask('p-l1', '哪一张是对折？点左右一样的图', [
            { id: 'same', text: '左右一样', icon: 'check', ok: true },
            { id: 'drop', text: '水滴', icon: 'water', ok: false },
          ], '对折以后两边一样。', '再看一看两边。', { subject: 'craft', reading: 'やま', audio: 'ja-yama' }),
        ],
        bigger: [
          ask('p-b1', 'かわ是什么？', [
            { id: 'river', text: '河', icon: 'water', ok: true },
            { id: 'flower', text: '花', icon: 'plant', ok: false },
          ], 'かわ是河。', '花可以是さくら。再试一次。', { reading: 'かわ', audio: 'ja-kawa' }),
        ],
      },
    },
    {
      id: 'gassho-note',
      name: '合掌大屋说明',
      valley: 'ri',
      role: 'guide',
      style: 'elder',
      prop: 'paper',
      hello: '陡陡的茅草屋顶是合掌屋。',
      place: '合掌大屋',
      x: -8,
      z: 5,
      guard: 0,
      review,
      care: [
        {
          id: 'look-house',
          label: '看一看',
          play: 'text',
          say: '合掌屋的屋顶又陡又厚，用茅草盖住木架。这里是白川乡那一类屋的样子，时间和国家的细节可以以后再读。',
        },
      ],
      quiz: {
        little: [
          ask('g-l1', '屋顶为什么陡？', [
            { id: 'snow', text: '好让厚雪滑下去', icon: 'home', ok: true },
            { id: 'flag', text: '为了挂旗', icon: 'flag', ok: false },
          ], '陡屋顶让雪不容易堆住。', '再看一看屋顶。', { subject: 'craft', ref: GASSHO }),
        ],
      },
    },
    {
      id: 'draft-hidden',
      name: '未发布',
      valley: 'ri',
      role: 'peer',
      style: 'kid',
      published: false,
      review: hidden,
      care: [{ id: 'hidden', label: '看一看', play: 'text', say: '这段还没给孩子看。' }],
      quiz: { little: [ask('h1', '不要出现', [{ id: 'a', text: '甲', ok: true }], '不该看到。', '不该看到。')] },
    },
  ],
};
