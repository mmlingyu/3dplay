import { icon } from './icons.js';

const ICONS = new Set(['check', 'rotate']);

function resolve(value, data) {
  if (!value || typeof value !== 'object' || typeof value['@path'] !== 'string') return value;
  return value['@path'].split('/').filter(Boolean).reduce((current, key) => current?.[key], data) ?? '';
}

function applyData(data, path, value) {
  const keys = String(path || '/').split('/').filter(Boolean);
  if (!keys.length) return value && typeof value === 'object' ? { ...value } : {};
  const next = { ...data };
  let cursor = next;
  keys.slice(0, -1).forEach((key) => {
    cursor[key] = { ...(cursor[key] || {}) };
    cursor = cursor[key];
  });
  cursor[keys.at(-1)] = value;
  return next;
}

export function readSurface(messages) {
  const components = new Map();
  let surface = null;
  let data = {};
  for (const message of messages || []) {
    if (message?.createSurface) surface = message.createSurface;
    for (const item of message?.updateComponents?.components || []) components.set(item.id, item);
    if (message?.updateDataModel) data = applyData(data, message.updateDataModel.path, message.updateDataModel.value);
  }
  return { surface, components, data };
}

function paint(component, components, data, onAction) {
  if (!component) return document.createElement('span');
  const type = component.component;
  if (type === 'Card') return paint(components.get(component.child), components, data, onAction);
  if (type === 'Column' || type === 'Row') {
    const box = document.createElement('div');
    box.className = type === 'Row' ? 'a2ui-row' : 'a2ui-column';
    if (component.id === 'kinds' || component.id === 'pager' || component.id === 'image-switch') box.classList.add('a2ui-kinds');
    for (const id of component.children || []) box.append(paint(components.get(id), components, data, onAction));
    return box;
  }
  if (type === 'Image') {
    const img = document.createElement('img');
    img.className = 'a2ui-image';
    img.alt = String(component.description || '');
    img.src = String(resolve(component.url, data) || '');
    return img;
  }
  if (type === 'Video') {
    const video = document.createElement('video');
    video.className = 'a2ui-video';
    video.controls = true;
    video.playsInline = true;
    video.setAttribute('aria-label', String(component.description || '视频'));
    const source = String(resolve(component.url, data) || '');
    if (source) video.src = source;
    return video;
  }
  if (type === 'Text') {
    const text = document.createElement(component.variant === 'h1' ? 'strong' : 'p');
    text.className = `a2ui-text ${component.variant || 'body'}`;
    text.textContent = String(resolve(component.text, data) ?? '');
    return text;
  }
  if (type === 'Icon') {
    const mark = document.createElement('span');
    mark.className = 'a2ui-icon';
    if (ICONS.has(component.name)) mark.innerHTML = icon(component.name, 22);
    return mark;
  }
  if (type === 'Divider') {
    const line = document.createElement('hr');
    line.className = 'a2ui-divider';
    return line;
  }
  if (type === 'Button') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `a2ui-button ${component.variant || 'default'}`;
    const child = components.get(component.child);
    const label = child?.component === 'Text' ? String(resolve(child.text, data) ?? '') : '';
    button.textContent = label;
    const event = component.action?.event;
    if (event?.name) {
      button.addEventListener('click', () => onAction?.({
        name: event.name,
        sourceComponentId: component.id,
        context: event.context || {},
      }));
    }
    return button;
  }
  if (type === 'ChoicePicker') {
    const box = document.createElement('div');
    box.className = 'a2ui-choices';
    box.setAttribute('role', 'group');
    const picked = String(resolve(component.value, data) ?? '');
    const result = String(data.result || '');
    for (const option of component.options || []) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'a2ui-choice';
      button.textContent = String(option.label || '');
      button.disabled = Boolean(result);
      if (picked && option.value === picked) button.classList.add(result === 'no' ? 'no' : result ? 'ok' : 'picked');
      button.addEventListener('pointerdown', () => {
        if (result) return;
        button.classList.remove('ripple');
        void button.offsetWidth;
        button.classList.add('ripple');
      });
      button.addEventListener('click', () => {
        if (result) return;
        onAction?.({ name: 'choose', sourceComponentId: component.id, context: { value: option.value } });
      });
      box.append(button);
    }
    return box;
  }
  if (type === 'Filmstrip') {
    const strip = document.createElement('div');
    strip.className = 'a2ui-strip';
    strip.setAttribute('role', 'group');
    for (const option of component.options || []) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'a2ui-card';
      const mark = document.createElement('span');
      mark.className = 'a2ui-mark';
      mark.textContent = String(option.mark || '');
      const label = document.createElement('span');
      label.textContent = String(option.label || '');
      card.append(mark, label);
      card.addEventListener('click', () => onAction?.({
        name: 'choose',
        sourceComponentId: component.id,
        context: { value: option.value },
      }));
      strip.append(card);
    }
    return strip;
  }
  if (type === 'Book') {
    const book = document.createElement('div');
    book.className = 'a2ui-book';
    book.tabIndex = 0;
    const pageText = document.createElement('p');
    pageText.className = 'a2ui-text h2';
    pageText.textContent = String(resolve(component.text, data) ?? '');
    book.append(pageText);
    const index = Math.max(0, Number(component.index) || 0);
    const pages = Math.max(1, Number(component.pages) || 1);
    let startX = 0;
    const turn = (next) => {
      if (next < 0 || next >= pages || next === index) return;
      onAction?.({ name: 'page', sourceComponentId: component.id, context: { page: next } });
    };
    book.addEventListener('pointerdown', (event) => {
      startX = event.clientX;
      book.setPointerCapture?.(event.pointerId);
    });
    book.addEventListener('pointerup', (event) => {
      const delta = event.clientX - startX;
      if (delta <= -28) turn(index + 1);
      else if (delta >= 28) turn(index - 1);
    });
    book.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') turn(index - 1);
      if (event.key === 'ArrowRight') turn(index + 1);
    });
    return book;
  }
  const empty = document.createElement('span');
  empty.hidden = true;
  return empty;
}

export function renderA2UI(root, messages, onAction) {
  const { components, data } = readSurface(messages);
  root.replaceChildren(paint(components.get('root'), components, data, onAction));
}
