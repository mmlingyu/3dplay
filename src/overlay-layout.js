/** One stacking rule for prompts, controls, and dialogs. Low-priority lines collapse or wait. */

const GAP = 8;

function overlap(a, b, pad = 0) {
  return a.x < b.x + b.width + pad
    && a.x + a.width > b.x - pad
    && a.y < b.y + b.height + pad
    && a.y + a.height > b.y - pad;
}

function placeBox(item, x, y, width, height, extra = {}) {
  return {
    id: item.id,
    priority: item.priority || 0,
    x,
    y,
    width,
    height,
    parked: false,
    collapsed: false,
    scroll: false,
    ...extra,
  };
}

/**
 * @param {{ safeTop: number, safeBottom: number, center: number, maxWidth: number, gap?: number, items: {id:string, role:string, priority:number, width:number, height:number, open?:boolean, collapseTo?:number}[] }} input
 */
export function planStack(input) {
  const gap = input.gap ?? GAP;
  const { safeTop, safeBottom, center, maxWidth } = input;
  const open = (input.items || []).filter((item) => item.open !== false && item.height > 0);
  const widthOf = (item) => Math.min(item.width || maxWidth, maxWidth);
  const xOf = (item, width) => center - width / 2;
  const parked = (item) => ({ id: item.id, parked: true, collapsed: false, scroll: false, x: 0, y: -4000, width: 0, height: 0 });
  const placements = [];

  const dialogs = open.filter((item) => item.role === 'dialog').sort((a, b) => b.priority - a.priority);
  const controls = open.filter((item) => item.role === 'control').sort((a, b) => b.priority - a.priority);
  const notices = open.filter((item) => item.role === 'notice').sort((a, b) => b.priority - a.priority);
  const prompts = open.filter((item) => item.role === 'prompt').sort((a, b) => b.priority - a.priority);
  const hints = open.filter((item) => item.role === 'hint');

  if (dialogs.length) {
    const dialog = dialogs[0];
    const width = widthOf(dialog);
    const room = Math.max(120, safeBottom - safeTop);
    const height = Math.min(dialog.height, room);
    const y = safeTop + Math.max(0, (safeBottom - safeTop - height) / 2);
    placements.push(placeBox(dialog, xOf(dialog, width), y, width, height, { scroll: height < dialog.height - 2 }));
    dialogs.slice(1).forEach((item) => placements.push(parked(item)));
    const above = y - safeTop - gap;
    const control = controls[0];
    if (control && above >= 96) {
      const controlWidth = widthOf(control);
      const controlHeight = Math.min(control.height, above);
      placements.push(placeBox(control, xOf(control, controlWidth), safeTop, controlWidth, controlHeight, { scroll: controlHeight < control.height - 2 }));
      controls.slice(1).forEach((item) => placements.push(parked(item)));
    } else controls.forEach((item) => placements.push(parked(item)));
    [...notices, ...prompts, ...hints].forEach((item) => placements.push(parked(item)));
    return { placements };
  }

  let top = safeTop;
  let bottom = safeBottom;
  const placedPrompts = [];
  const controlReserve = controls.length ? Math.min(168, controls[0].height) : 0;

  for (const prompt of prompts) {
    const width = widthOf(prompt);
    const full = prompt.height;
    const collapsed = prompt.collapseTo && prompt.collapseTo < full - 4 ? prompt.collapseTo : 0;
    const room = bottom - top - controlReserve - gap;
    if (full <= room || (placedPrompts.length === 0 && full <= bottom - top - gap)) {
      const height = Math.min(full, bottom - top - gap);
      const y = bottom - height;
      placements.push(placeBox(prompt, xOf(prompt, width), y, width, height, { scroll: height < full - 2 }));
      bottom = y - gap;
      placedPrompts.push(prompt);
      continue;
    }
    if (collapsed && collapsed <= bottom - top - controlReserve - gap) {
      const y = bottom - collapsed;
      placements.push(placeBox(prompt, xOf(prompt, width), y, width, collapsed, { collapsed: true }));
      bottom = y - gap;
      placedPrompts.push(prompt);
      continue;
    }
    placements.push(parked(prompt));
  }

  for (const hint of hints) {
    if (placedPrompts.length) {
      placements.push(parked(hint));
      continue;
    }
    const width = widthOf(hint);
    if (hint.height <= bottom - top - gap) {
      const y = bottom - hint.height;
      placements.push(placeBox(hint, xOf(hint, width), y, width, hint.height));
      bottom = y - gap;
    } else placements.push(parked(hint));
  }

  for (const notice of notices) {
    const slim = notice.height <= 64;
    const stamp = notice.id === 'vista-stamp';
    if (controls.length && !slim && !stamp) {
      placements.push(parked(notice));
      continue;
    }
    const width = widthOf(notice);
    if (top + notice.height + gap <= bottom) {
      placements.push(placeBox(notice, xOf(notice, width), top, width, notice.height));
      top += notice.height + gap;
    } else placements.push(parked(notice));
  }

  for (const control of controls) {
    const room = bottom - top;
    if (room < 96) {
      placements.push(parked(control));
      continue;
    }
    const width = widthOf(control);
    const height = Math.min(control.height, room);
    placements.push(placeBox(control, xOf(control, width), top, width, height, { scroll: height < control.height - 2 }));
    top += height + gap;
  }

  const visible = placements.filter((item) => !item.parked);
  for (let i = 0; i < visible.length; i += 1) {
    if (visible[i].parked) continue;
    for (let j = i + 1; j < visible.length; j += 1) {
      if (visible[j].parked || !overlap(visible[i], visible[j])) continue;
      const loser = (visible[j].priority || 0) <= (visible[i].priority || 0) ? visible[j] : visible[i];
      loser.parked = true;
    }
  }
  return { placements };
}

const CATALOG = [
  ['balloon-hud', 'control', 80],
  ['bounce-hud', 'control', 78],
  ['story-talk', 'dialog', 90],
  ['story-home', 'dialog', 90],
  ['tutor-card', 'dialog', 88],
  ['letter-card', 'dialog', 86],
  ['mei-letter', 'dialog', 86],
  ['travel-cutscene', 'dialog', 92],
  ['holo-transition', 'dialog', 92],
  ['star-cutscene', 'dialog', 92],
  ['xing-sheet', 'dialog', 86],
  ['holo-panel', 'dialog', 84],
  ['ri-sheet', 'dialog', 90],
  ['story-banner', 'notice', 60],
  ['vista-stamp', 'notice', 55],
  ['focus-exit', 'notice', 70],
  ['land-question', 'prompt', 70],
  ['vista-card', 'prompt', 62],
  ['tour-guide', 'prompt', 50, 64],
  ['story-festival', 'prompt', 40, 52],
  ['context-hint', 'hint', 10],
];

const RAILS = ['#ri-actions', '#mei-actions', '#xing-actions', '#holo-bar', '#travel-home', '#travel-go', '#travel-go-mei', '#holo-back', '#story-disk', '#vista-arrow', '#model-menu'];
const SIDES = ['#wish-card', '.minimap-card'];

function shown(el) {
  return Boolean(el) && !el.hidden && el.getAttribute('aria-hidden') !== 'true' && getComputedStyle(el).display !== 'none';
}

function clearPlacement(el) {
  el.classList.remove('overlay-parked', 'overlay-collapsed', 'overlay-scroll');
  for (const key of ['left', 'top', 'bottom', 'width', 'maxHeight', 'transform', 'overflow', 'right']) el.style[key] = '';
}

let bound = false;
let laying = false;
let prefer = '';

function measureItem(el, role, priority, collapseTo) {
  clearPlacement(el);
  const rect = el.getBoundingClientRect();
  const width = Math.max(120, Math.min(rect.width || el.offsetWidth || 280, window.innerWidth - 24));
  const height = Math.max(44, rect.height || el.offsetHeight || 80);
  return { id: el.id, role, priority: el.id === prefer ? priority + 100 : priority, width, height, open: true, collapseTo, el };
}

function applyPlacement(el, box) {
  if (box.parked) {
    el.classList.add('overlay-parked');
    el.classList.remove('overlay-collapsed', 'overlay-scroll');
    return;
  }
  el.classList.toggle('overlay-collapsed', box.collapsed);
  el.classList.toggle('overlay-scroll', box.scroll);
  el.style.left = `${Math.round(box.x)}px`;
  el.style.top = `${Math.round(box.y)}px`;
  el.style.bottom = 'auto';
  el.style.right = 'auto';
  el.style.transform = 'none';
  el.style.width = `${Math.round(box.width)}px`;
  if (box.scroll || box.collapsed) {
    el.style.maxHeight = `${Math.round(box.height)}px`;
    el.style.overflow = box.scroll ? 'auto' : 'hidden';
  } else {
    el.style.maxHeight = '';
    el.style.overflow = '';
  }
}

function safeEdges() {
  const topbar = document.querySelector('.topbar');
  let safeTop = 68;
  if (topbar) safeTop = Math.max(safeTop, topbar.getBoundingClientRect().bottom + 8);
  let safeBottom = window.innerHeight - 8;
  for (const selector of ['.bottom-dock', '#joystick', '.action-controls']) {
    const el = document.querySelector(selector);
    if (!shown(el)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.height < 8) continue;
    safeBottom = Math.min(safeBottom, rect.top - 8);
  }
  return { safeTop, safeBottom };
}

function chipSpot(safeTop, safeBottom, reserved) {
  const width = Math.min(180, Math.max(120, window.innerWidth - 24));
  const height = 48;
  const candidates = [
    { x: 12, y: safeTop },
    { x: window.innerWidth - width - 12, y: safeTop },
    { x: 12, y: Math.max(safeTop, safeBottom - height) },
    { x: window.innerWidth - width - 12, y: Math.max(safeTop, safeBottom - height) },
  ];
  for (const spot of candidates) {
    const box = { x: spot.x, y: spot.y, width, height };
    const clear = !reserved.some((item) => overlap(box, { x: item.left, y: item.top, width: item.right - item.left, height: item.bottom - item.top }));
    if (clear && box.y >= safeTop - 1 && box.y + height <= safeBottom + 1) return box;
  }
  return { x: 12, y: safeTop, width, height };
}

function nudge(el, reserved) {
  if (!shown(el)) {
    el.style.top = '';
    return;
  }
  const original = el.getAttribute('data-overlay-top');
  if (original == null) el.setAttribute('data-overlay-top', el.style.top || '');
  el.style.top = el.getAttribute('data-overlay-top') || '';
  let guard = 0;
  let rect = el.getBoundingClientRect();
  while (guard < 24 && reserved.some((box) => rect.left < box.right && rect.right > box.left && rect.top < box.bottom && rect.bottom > box.top)) {
    const hit = reserved.find((box) => rect.left < box.right && rect.right > box.left && rect.top < box.bottom && rect.bottom > box.top);
    el.style.top = `${Math.round(hit.bottom + 8)}px`;
    el.style.transform = el.id === 'model-menu' ? 'none' : el.style.transform;
    rect = el.getBoundingClientRect();
    guard += 1;
  }
  reserved.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
}

export function layoutOverlays(root = document) {
  if (laying || typeof root?.getElementById !== 'function') return;
  laying = true;
  try {
    const { safeTop, safeBottom } = safeEdges();
    const items = [];
    for (const [id, role, priority, collapseTo] of CATALOG) {
      const el = root.getElementById(id);
      if (!shown(el)) continue;
      items.push(measureItem(el, role, priority, collapseTo));
    }
    const plan = planStack({
      safeTop,
      safeBottom,
      center: window.innerWidth / 2,
      maxWidth: Math.min(560, window.innerWidth - 24),
      items,
    });
    const reserved = [];
    for (const box of plan.placements) {
      const el = root.getElementById(box.id);
      if (!el) continue;
      applyPlacement(el, box);
      if (!box.parked) reserved.push({ left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height });
    }
    const parkedPrompts = plan.placements.filter((box) => box.parked && items.find((item) => item.id === box.id && item.role === 'prompt'));
    let chip = root.getElementById('overlay-more');
    if (!chip) {
      chip = document.createElement('button');
      chip.type = 'button';
      chip.id = 'overlay-more';
      chip.className = 'secondary-btn';
      chip.addEventListener('click', () => {
        const waiting = chip.dataset.wait || '';
        prefer = waiting;
        layoutOverlays(root);
        prefer = '';
      });
      root.getElementById('app')?.append(chip);
    }
    if (parkedPrompts.length) {
      chip.hidden = false;
      chip.dataset.wait = parkedPrompts[0].id;
      chip.textContent = `还有提示 ${parkedPrompts.length}`;
      const spot = chipSpot(safeTop, safeBottom, reserved);
      applyPlacement(chip, { parked: false, collapsed: false, scroll: false, ...spot });
      reserved.push({ left: spot.x, top: spot.y, right: spot.x + spot.width, bottom: spot.y + spot.height });
    } else chip.hidden = true;

    for (const selector of SIDES) {
      const el = root.querySelector(selector);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const hits = reserved.some((box) => rect.left < box.right && rect.right > box.left && rect.top < box.bottom && rect.bottom > box.top);
      el.classList.toggle('overlay-parked', hits && reserved.length > 0);
    }
    const obstacles = reserved.map((box) => ({ left: box.left, right: box.right, top: box.top, bottom: box.bottom }));
    for (const selector of RAILS) {
      const el = root.querySelector(selector);
      if (el) nudge(el, obstacles);
    }
    const toast = root.getElementById('toast-root');
    if (toast) {
      toast.style.left = 'auto';
      toast.style.right = '12px';
      toast.style.top = `${Math.round(safeTop)}px`;
      toast.style.transform = 'none';
    }
  } finally {
    laying = false;
  }
}

export function bindOverlayLayout() {
  if (bound || typeof document === 'undefined') return;
  bound = true;
  const app = document.getElementById('app');
  if (!app) return;
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (laying || scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (!laying) layoutOverlays(document);
    });
  });
  observer.observe(app, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
  window.addEventListener('resize', () => layoutOverlays(document));
  layoutOverlays(document);
}
