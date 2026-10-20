export const NPC_CATALOG = 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';
export const NPC_SURFACE = 'npc-talk';

export const PLAY_KINDS = [
  { id: 'text', label: '文本' },
  { id: 'pick', label: '选择' },
  { id: 'quiz', label: '答题' },
  { id: 'video', label: '视频' },
  { id: 'image', label: '图片' },
];

export const NPC_IMAGES = [
  { id: 'moon', label: '月亮', url: './npc/moon.svg', description: '一轮月亮挂在河谷上空' },
  { id: 'falls', label: '瀑布', url: './npc/falls.svg', description: '一道瀑布从山上流下来' },
  { id: 'washi', label: '和纸步骤', url: './npc/ri-washi-steps.svg', description: '和纸的五步：蒸、敲、加水、抄纸、晾干' },
];

export const NPC_VIDEO = { url: './npc/note.mp4', description: '一小段河谷动画' };

const BANDS = [
  { id: 'little', label: '短一点' },
  { id: 'bigger', label: '再长一点' },
  { id: 'older', label: '挑战一下' },
];

const FEEDBACK = { ok: '对了', no: '再选一次', picked: '选好了', seen: '看完了' };
const PLAY_MARK = { text: '书', image: '图', pick: '选', video: '看', quiz: '题' };

function text(id, value, variant) {
  return { id, component: 'Text', text: value, ...(variant ? { variant } : {}) };
}

function button(id, child, name, context, variant) {
  return {
    id,
    component: 'Button',
    child,
    variant,
    action: { event: { name, ...(context ? { context } : {}) } },
  };
}

const PLAYS = new Set(PLAY_KINDS.map((item) => item.id));

function sentencePages(say) {
  const lines = String(say || '').split(/(?<=。)/).map((item) => item.trim()).filter(Boolean);
  return lines.length ? lines : ['看一句。'];
}

export function textPages(tutor) {
  const lines = (Array.isArray(tutor?.care) ? tutor.care : []).flatMap((item) => sentencePages(item.say));
  return lines.length ? lines : ['点一件事，再开始。'];
}

export function talkActivities(tutor) {
  const care = Array.isArray(tutor?.care) ? tutor.care : [];
  const items = care.map((topic) => ({
    id: topic.id,
    label: topic.label,
    play: PLAYS.has(topic.play) ? topic.play : 'text',
    lines: sentencePages(topic.say),
    ask: topic.ask || topic.label,
    choices: Array.isArray(topic.choices) ? topic.choices : [],
    image: NPC_IMAGES.some((item) => item.id === topic.image) ? topic.image : 'moon',
  }));
  const questions = [...(tutor?.quiz?.little || []), ...(tutor?.quiz?.bigger || []), ...(tutor?.quiz?.older || [])];
  if (!items.some((item) => item.play === 'quiz') && questions.length) {
    items.push({ id: 'quiz', label: '做一题', play: 'quiz', lines: [], ask: '', choices: [], image: 'moon' });
  }
  if (!items.length) {
    items.push({ id: 'quiz', label: '做一题', play: 'quiz', lines: [], ask: '', choices: [], image: 'moon' });
  }
  return items;
}

function resolveKind(kind, mode) {
  if (PLAY_KINDS.some((item) => item.id === kind)) return kind;
  if (mode === 'care' || kind === 'pick') return 'pick';
  return 'quiz';
}

export function npcTalkMessages({
  tutor,
  kind,
  mode,
  stage = 'menu',
  activity = null,
  band = 'little',
  question,
  picked = '',
  result = '',
  page = 0,
  image = 'moon',
}) {
  const catalog = talkActivities(tutor);
  const playing = stage === 'play' && activity;
  const play = playing ? (PLAYS.has(activity.play) ? activity.play : resolveKind(kind, mode)) : 'pick';
  const active = BANDS.some((item) => item.id === band) ? band : 'little';
  const lines = playing && activity.play === 'text' ? (activity.lines?.length ? activity.lines : ['看一句。']) : textPages(tutor);
  const pageIndex = Math.min(Math.max(0, Number(page) || 0), Math.max(0, lines.length - 1));
  const picture = NPC_IMAGES.find((item) => item.id === (playing ? activity.image : image)) || NPC_IMAGES[0];
  const note = FEEDBACK[result] || '';
  const stack = ['name'];
  if (!playing) stack.push('prompt', 'strip');
  else if (play === 'text') stack.push('prompt', 'book', 'pager');
  else if (play === 'pick') stack.push('prompt', 'choices');
  else if (play === 'quiz') stack.push('bands', 'prompt', 'choices');
  else if (play === 'video') stack.push('prompt', 'clip');
  else if (play === 'image') stack.push('prompt', 'picture');
  if (playing && note) stack.push('feedback');
  stack.push('actions');

  const menuOptions = catalog.map((item) => ({ label: item.label, value: item.id, mark: PLAY_MARK[item.play] || '玩' }));
  const pickOptions = (activity?.choices || []).map((item) => ({ label: item.text, value: item.id }));
  const quizOptions = (question?.choices || []).map((item) => ({ label: item.text, value: item.id, icon: item.icon || '' }));
  const choiceOptions = !playing ? menuOptions : play === 'pick' ? pickOptions : quizOptions;
  const prompt = !playing ? '想做哪一件？' : play === 'text' ? (activity?.label || '读一句') : play === 'video' ? '看一小段' : play === 'image' ? (activity?.label || '看一张') : (play === 'pick' ? (activity?.ask || '选一个') : (question?.ask || '今天先到这里'));
  const components = [
    { id: 'root', component: 'Card', child: 'stack' },
    { id: 'stack', component: 'Column', children: stack },
    text('name', tutor?.name || '朋友', 'h1'),
  ];
  components.push(text('line', lines[pageIndex] || '', 'h2'));
  components.push({
    id: 'book',
    component: 'Book',
    text: lines[pageIndex] || '',
    index: pageIndex,
    pages: Math.max(1, lines.length),
  });
  components.push({
    id: 'strip',
    component: 'Filmstrip',
    options: menuOptions,
  });
  const pager = [];
  if (pageIndex > 0) pager.push('prev');
  pager.push('page-label');
  if (pageIndex < lines.length - 1) pager.push('next-line');
  components.push({ id: 'pager', component: 'Row', children: pager });
  components.push(text('prev-label', '上一句'));
  components.push(button('prev', 'prev-label', 'page', { page: pageIndex - 1 }, 'borderless'));
  components.push(text('page-label', `${pageIndex + 1} / ${lines.length}`, 'caption'));
  components.push(text('next-line-label', '下一句'));
  components.push(button('next-line', 'next-line-label', 'page', { page: pageIndex + 1 }, 'primary'));

  components.push({ id: 'bands', component: 'Row', children: BANDS.map((item) => `band-${item.id}`) });
  for (const item of BANDS) {
    components.push(text(`band-${item.id}-label`, item.label));
    components.push(button(`band-${item.id}`, `band-${item.id}-label`, 'band', { band: item.id }, item.id === active ? 'primary' : 'borderless'));
  }

  components.push(text('prompt', prompt));
  components.push({
    id: 'choices',
    component: 'ChoicePicker',
    variant: 'mutuallyExclusive',
    options: choiceOptions,
    value: { '@path': '/picked' },
  });
  components.push({
    id: 'clip',
    component: 'Video',
    url: NPC_VIDEO.url,
    description: NPC_VIDEO.description,
  });
  components.push({
    id: 'picture',
    component: 'Image',
    url: picture.url,
    description: picture.description,
    fit: 'contain',
    variant: 'mediumFeature',
  });
  components.push({ id: 'feedback', component: 'Row', children: ['feedback-icon', 'feedback-label'] });
  components.push({ id: 'feedback-icon', component: 'Icon', name: result === 'no' ? 'rotate' : 'check' });
  components.push(text('feedback-label', note, 'caption'));

  const actions = [];
  const textDone = play === 'text' && pageIndex >= lines.length - 1;
  const media = play === 'video' || play === 'image';
  if (playing && play === 'quiz' && note) actions.push('next');
  if (playing && ((textDone && play === 'text') || media) && !note) actions.push('done');
  if (playing && note) actions.push('menu');
  actions.push('close');
  components.push({ id: 'actions', component: 'Row', children: [...new Set(actions)] });
  components.push(text('next-label', '再来一题'));
  components.push(button('next', 'next-label', 'next', null, 'primary'));
  components.push(text('done-label', '看完了'));
  components.push(button('done', 'done-label', 'done', null, 'primary'));
  components.push(text('menu-label', '换一个'));
  components.push(button('menu', 'menu-label', 'menu', null, 'borderless'));
  components.push(text('close-label', '先去玩'));
  components.push(button('close', 'close-label', 'close', null, 'borderless'));

  return [
    { version: 'v1.0', createSurface: { surfaceId: NPC_SURFACE, catalogId: NPC_CATALOG } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: NPC_SURFACE,
        path: '/',
        value: { kind: play, band: active, picked, result, page: pageIndex, image: picture.id },
      },
    },
    { version: 'v1.0', updateComponents: { surfaceId: NPC_SURFACE, components } },
  ];
}

export function visibleText(messages) {
  const map = new Map();
  for (const message of messages || []) {
    for (const item of message?.updateComponents?.components || []) map.set(item.id, item);
  }
  const lines = [];
  const visit = (id, seen) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    const item = map.get(id);
    if (!item) return;
    if ((item.component === 'Text' || item.component === 'Book') && item.text) lines.push(String(item.text));
    for (const option of item.options || []) if (option.label) lines.push(String(option.label));
    visit(item.child, seen);
    for (const child of item.children || []) visit(child, seen);
  };
  visit('root', new Set());
  return lines;
}
