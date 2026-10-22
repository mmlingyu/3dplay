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
  const viewWidth = Math.max(center * 2, maxWidth + 24);

  function placeAside(item, height) {
    if (item.id !== 'vista-card') return null;
    const wanted = Math.min(widthOf(item), 360);
    const minWidth = 200;
    if (safeTop + height > safeBottom) return null;
    const blockers = placements.filter((other) => !other.parked && other.y < safeTop + height && other.y + other.height > safeTop);
    const leftLimit = blockers.reduce((min, other) => Math.min(min, other.x), viewWidth);
    const rightLimit = blockers.reduce((max, other) => Math.max(max, other.x + other.width), 0);
    const leftRoom = leftLimit - 12 - gap;
    const rightRoom = viewWidth - 12 - gap - rightLimit;
    const choices = [];
    if (leftRoom >= minWidth) choices.push({ x: 12, width: Math.min(wanted, leftRoom) });
    if (rightRoom >= minWidth) choices.push({ x: viewWidth - 12 - Math.min(wanted, rightRoom), width: Math.min(wanted, rightRoom) });
    const spot = choices.find((choice) => choice.x === 12 && choice.width >= wanted - 1)
      || choices.find((choice) => choice.width >= wanted - 1)
      || choices[0];
    if (!spot) return null;
    const box = placeBox(item, spot.x, safeTop, spot.width, height);
    if (box.x < 0 || box.x + box.width > viewWidth + 0.5) return null;
    if (placements.some((other) => !other.parked && overlap(box, other))) return null;
    return box;
  }

  function placeBelowControl(item, height) {
    if (height > safeBottom - safeTop) return null;
    const control = placements.find((box) => !box.parked && (box.id === 'balloon-hud' || box.id === 'bounce-hud'));
    if (!control) return null;
    const y = safeBottom - height;
    const limit = y - gap;
    if (limit - control.y < 160) return null;
    if (control.y + control.height > limit) {
      control.height = limit - control.y;
      control.scroll = true;
      top = control.y + control.height + gap;
    }
    if (y < top - 0.5) return null;
    const width = widthOf(item);
    const box = placeBox(item, xOf(item, width), y, width, height);
    if (placements.some((other) => !other.parked && overlap(box, other))) return null;
    return box;
  }

  for (const control of controls) {
    const width = widthOf(control);
    const full = control.height;
    const room = bottom - top;
    if (full <= room) {
      placements.push(placeBox(control, xOf(control, width), top, width, full));
      top += full + gap;
      continue;
    }
    if (room >= full * 0.92 && room >= 160) {
      placements.push(placeBox(control, xOf(control, width), top, width, room, { scroll: true }));
      top = bottom;
      continue;
    }
    placements.push(parked(control));
  }

  for (const prompt of prompts) {
    const width = widthOf(prompt);
    const full = prompt.height;
    const collapsed = prompt.collapseTo && prompt.collapseTo < full - 4 ? prompt.collapseTo : 0;
    const room = bottom - top - gap;
    if (room < (collapsed || full)) {
      const aside = prompt.id === 'vista-card' ? (placeAside(prompt, full) || placeBelowControl(prompt, full)) : null;
      if (aside) {
        placements.push(aside);
        if (aside.x === xOf(prompt, aside.width)) bottom = aside.y - gap;
        continue;
      }
      placements.push(parked(prompt));
      continue;
    }
    if (full <= room) {
      const y = bottom - full;
      placements.push(placeBox(prompt, xOf(prompt, width), y, width, full));
      bottom = y - gap;
      placedPrompts.push(prompt);
      continue;
    }
    const y = bottom - collapsed;
    placements.push(placeBox(prompt, xOf(prompt, width), y, width, collapsed, { collapsed: true }));
    bottom = y - gap;
    placedPrompts.push(prompt);
  }

  for (const hint of hints) {
    if (placedPrompts.length || controls.length) {
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

  const occupied = () => placements.filter((item) => !item.parked);
  for (const notice of notices) {
    const slim = notice.height <= 64;
    const stamp = notice.id === 'vista-stamp';
    if (controls.length && !slim && !stamp) {
      placements.push(parked(notice));
      continue;
    }
    const width = widthOf(notice);
    if (top + notice.height + gap <= bottom) {
      const box = placeBox(notice, xOf(notice, width), top, width, notice.height);
      if (occupied().every((item) => !overlap(box, item))) {
        placements.push(box);
        top += notice.height + gap;
        continue;
      }
    }
    const sideWidth = Math.min(width, 200);
    const sideSpots = [
      { x: 12, y: safeTop },
      { x: Math.max(12, viewWidth - sideWidth - 12), y: safeTop },
    ];
    const side = sideSpots
      .map((spot) => placeBox(notice, spot.x, spot.y, sideWidth, notice.height))
      .find((box) => box.x >= 0 && box.x + box.width <= viewWidth && occupied().every((item) => !overlap(box, item)));
    if (side) {
      placements.push(side);
      continue;
    }
    const below = stamp ? placeBelowControl(notice, notice.height) : null;
    placements.push(below || parked(notice));
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
  ['tour-guide', 'prompt', 50],
  ['story-festival', 'prompt', 40],
  ['context-hint', 'hint', 10],
];

const RAILS = ['#ri-actions', '#mei-actions', '#xing-actions', '#holo-bar', '#travel-home', '#travel-go', '#travel-go-mei', '#holo-back', '#story-disk', '#model-menu'];
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

function hits(box, blocks) {
  return blocks.some((item) => box.left < item.right && box.right > item.left && box.top < item.bottom && box.bottom > item.top);
}

function placeToast(toast, safeTop, safeBottom, reserved) {
  const width = Math.min(Math.max(toast.offsetWidth || 180, 140), 280);
  const height = toast.offsetHeight || 0;
  toast.style.right = 'auto';
  toast.style.transform = 'none';
  if (height < 12) {
    toast.style.left = '12px';
    toast.style.top = `${Math.round(safeTop)}px`;
    return;
  }
  const blocks = reserved.map((box) => ({ left: box.left, top: box.top, right: box.right, bottom: box.bottom }));
  for (const selector of ['.minimap-card', '#wish-card']) {
    const el = document.querySelector(selector);
    if (!shown(el) || el.classList.contains('overlay-parked')) continue;
    const rect = el.getBoundingClientRect();
    blocks.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
  }
  const map = document.querySelector('.minimap-card');
  const underMap = map && shown(map) ? map.getBoundingClientRect().bottom + 8 : safeTop;
  const spots = [
    { x: 12, y: safeTop },
    { x: 12, y: Math.min(safeBottom - height, safeTop + 64) },
    { x: Math.max(12, window.innerWidth - width - 12), y: underMap },
    { x: 12, y: Math.max(safeTop, safeBottom - height) },
  ];
  const spot = spots.find((item) => {
    const box = { left: item.x, top: item.y, right: item.x + width, bottom: item.y + height };
    return item.y >= safeTop - 1 && item.y + height <= safeBottom + 1 && !hits(box, blocks);
  }) || spots[0];
  toast.style.left = `${Math.round(spot.x)}px`;
  toast.style.top = `${Math.round(spot.y)}px`;
  reserved.push({ left: spot.x, top: spot.y, right: spot.x + width, bottom: spot.y + height });
}

function keepButtonsClear(root) {
  const owners = [...root.querySelectorAll('#balloon-hud, #bounce-hud, #land-question, .minimap-card, .bottom-dock, .action-controls, .topbar')];
  for (const owner of owners) {
    if (!shown(owner) || owner.classList.contains('overlay-parked')) continue;
    const ownerRect = owner.getBoundingClientRect();
    for (const button of owner.querySelectorAll('button')) {
      if (button.hidden || button.closest('[hidden]')) continue;
      const rect = button.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) continue;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      if (cx < ownerRect.left || cx > ownerRect.right || cy < ownerRect.top || cy > ownerRect.bottom) continue;
      for (const id of ['tour-guide', 'land-question', 'story-banner', 'vista-card', 'context-hint', 'story-festival', 'toast-root']) {
        const other = root.getElementById(id);
        if (!other || other === owner || !shown(other) || other.classList.contains('overlay-parked')) continue;
        if (other.contains(button) || button.contains(other)) continue;
        const cover = other.getBoundingClientRect();
        if (cx < cover.left || cx > cover.right || cy < cover.top || cy > cover.bottom) continue;
        other.classList.add('overlay-parked');
        other.classList.remove('overlay-collapsed', 'overlay-scroll');
      }
    }
  }
}

function nudge(el, reserved) {
  if (!shown(el)) {
    el.style.top = '';
    return;
  }
  const original = el.getAttribute('data-overlay-top');
  if (original == null) el.setAttribute('data-overlay-top', el.style.top || '');
  el.style.top = el.getAttribute('data-overlay-top') || '';
  if (el.id === 'tour-guide') el.style.bottom = '';
  let guard = 0;
  let rect = el.getBoundingClientRect();
  while (guard < 24 && reserved.some((box) => rect.left < box.right && rect.right > box.left && rect.top < box.bottom && rect.bottom > box.top)) {
    const hit = reserved.find((box) => rect.left < box.right && rect.right > box.left && rect.top < box.bottom && rect.bottom > box.top);
    el.style.top = `${Math.round(hit.bottom + 8)}px`;
    if (el.id === 'tour-guide') el.style.bottom = 'auto';
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
      if (id === 'tour-guide' && el.classList.contains('is-icon')) continue;
      items.push(measureItem(el, role, priority, collapseTo));
    }
    const plan = planStack({
      safeTop,
      safeBottom,
      center: window.innerWidth / 2,
      maxWidth: Math.min(560, window.innerWidth - 24),
      items,
    });
    const map = root.querySelector('.minimap-card');
    if (map && shown(map)) {
      map.classList.remove('overlay-parked');
      const remembered = map.getAttribute('data-overlay-top');
      const previousTop = map.style.top;
      if (remembered == null) map.setAttribute('data-overlay-top', previousTop || '');
      map.style.top = map.getAttribute('data-overlay-top') || '';
      const rect = map.getBoundingClientRect();
      map.style.top = previousTop;
      for (const box of plan.placements) {
        if (box.parked || (box.id !== 'balloon-hud' && box.id !== 'bounce-hud')) continue;
        const right = box.x + box.width;
        const overlaps = right > rect.left && box.x < rect.right && box.y + box.height > rect.top && box.y < rect.bottom;
        if (!overlaps) continue;
        const shift = right - (rect.left - 8);
        if (box.x - shift >= 8) box.x -= shift;
      }
    }
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
      chip.className = 'fold-toggle';
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
      chip.textContent = '提示';
      chip.setAttribute('aria-label', `还有提示 ${parkedPrompts.length}`);
      const spot = chipSpot(safeTop, safeBottom, reserved);
      applyPlacement(chip, { parked: false, collapsed: false, scroll: false, ...spot });
      reserved.push({ left: spot.x, top: spot.y, right: spot.x + spot.width, bottom: spot.y + spot.height });
    } else chip.hidden = true;

    let chromeTop = window.innerHeight - 8;
    for (const selector of ['.bottom-dock', '#joystick', '.action-controls']) {
      const el = root.querySelector(selector);
      if (!shown(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.height < 8) continue;
      chromeTop = Math.min(chromeTop, rect.top - 8);
    }
    for (const selector of SIDES) {
      const el = root.querySelector(selector);
      if (!el) continue;
      el.classList.remove('overlay-parked');
      if (!shown(el)) continue;
      const remembered = el.getAttribute('data-overlay-top');
      if (remembered == null) el.setAttribute('data-overlay-top', el.style.top || '');
      el.style.top = el.getAttribute('data-overlay-top') || '';
      let guard = 0;
      let rect = el.getBoundingClientRect();
      const blocked = (box) => reserved.some((item) => box.left < item.right && box.right > item.left && box.top < item.bottom && box.bottom > item.top);
      while (guard < 8 && blocked(rect)) {
        const hit = reserved.find((item) => rect.left < item.right && rect.right > item.left && rect.top < item.bottom && rect.bottom > item.top);
        el.style.top = `${Math.round(hit.bottom + 8)}px`;
        rect = el.getBoundingClientRect();
        guard += 1;
      }
      if (blocked(rect) || rect.bottom > chromeTop || rect.top < 0) {
        el.classList.add('overlay-parked');
        el.style.top = '';
        continue;
      }
      reserved.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
    }
    const obstacles = reserved.map((box) => ({ left: box.left, right: box.right, top: box.top, bottom: box.bottom }));
    for (const selector of RAILS) {
      const el = root.querySelector(selector);
      if (!el) continue;
      nudge(el, obstacles);
      if (!shown(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.bottom > chromeTop && rect.top < chromeTop - 48) {
        el.style.maxHeight = `${Math.round(chromeTop - rect.top)}px`;
        el.style.overflow = 'auto';
      }
    }
    const toast = root.getElementById('toast-root');
    if (toast) placeToast(toast, safeTop, safeBottom, reserved);
    keepButtonsClear(root);
    settleVistaArrow(root.getElementById('vista-arrow'));
  } finally {
    laying = false;
  }
}

const ARROW_BLOCKS = '#balloon-hud, #tour-guide, #vista-card, #land-question, #vista-stamp, .minimap-card, .bottom-dock, .topbar, .wish-card, #toast-root, .action-controls, #story-banner, #bounce-hud, #overlay-more';

function arrowBlockers() {
  const blocks = [];
  for (const el of document.querySelectorAll(ARROW_BLOCKS)) {
    if (!shown(el) || el.classList.contains('overlay-parked')) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) continue;
    blocks.push(rect);
  }
  return blocks;
}

function arrowFits(x, y, blocks) {
  const box = { left: x - 24, top: y - 24, right: x + 24, bottom: y + 24 };
  if (box.left < 4 || box.top < 4 || box.right > window.innerWidth - 4 || box.bottom > window.innerHeight - 4) return false;
  return !blocks.some((item) => box.left < item.right && box.right > item.left && box.top < item.bottom && box.bottom > item.top);
}

export function settleVistaArrow(arrow = document.getElementById('vista-arrow')) {
  if (!arrow || arrow.hidden || typeof arrow.getBoundingClientRect !== 'function') return;
  const aimX = Number(arrow.dataset.aimX);
  const aimY = Number(arrow.dataset.aimY);
  if (!Number.isFinite(aimX) || !Number.isFinite(aimY)) return;
  const blocks = arrowBlockers();
  const place = (x, y) => {
    arrow.style.left = `${Math.round(x)}px`;
    arrow.style.top = `${Math.round(y)}px`;
  };
  if (arrowFits(aimX, aimY, blocks)) {
    place(aimX, aimY);
    return;
  }
  for (let radius = 56; radius <= 280; radius += 28) {
    for (let i = 0; i < 12; i += 1) {
      const angle = (Math.PI * 2 * i) / 12;
      const x = aimX + Math.cos(angle) * radius;
      const y = aimY + Math.sin(angle) * radius;
      if (arrowFits(x, y, blocks)) {
        place(x, y);
        return;
      }
    }
  }
  const corners = [
    [36, window.innerHeight * 0.42],
    [window.innerWidth - 36, window.innerHeight * 0.42],
    [36, 96],
  ];
  const spare = corners.find(([x, y]) => arrowFits(x, y, blocks));
  if (spare) place(spare[0], spare[1]);
  else arrow.hidden = true;
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
