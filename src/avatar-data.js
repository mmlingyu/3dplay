/** Player look chosen before the first visit. Optional on old saves. */

export const NAME_PRESETS = Object.freeze([
  { id: 'doudou', name: '豆豆' },
  { id: 'guoguo', name: '果果' },
  { id: 'xiaoxing', name: '小星' },
  { id: 'tuantuan', name: '团团' },
]);

export const LOOK_SHAPES = Object.freeze([
  { id: 'round', label: '圆圆' },
  { id: 'square', label: '方方' },
  { id: 'cat', label: '猫耳' },
  { id: 'hood', label: '斗篷' },
]);

export const LOOK_COLORS = Object.freeze([
  { id: 'leaf', label: '叶绿', hex: '#93b7a0' },
  { id: 'sand', label: '沙色', hex: '#e7a15a' },
  { id: 'sky', label: '天蓝', hex: '#7eb6d6' },
  { id: 'berry', label: '莓红', hex: '#e07a8a' },
  { id: 'cream', label: '奶油', hex: '#f3e2b8' },
]);

export const LOOK_HATS = Object.freeze([
  { id: 'sprout', label: '嫩芽' },
  { id: 'cap', label: '小帽' },
  { id: 'flower', label: '小花' },
  { id: 'none', label: '不戴' },
]);

export function defaultLook() {
  return { name: '', shape: 'round', color: 'leaf', hat: 'sprout', ready: false };
}

export function lookColor(look) {
  return LOOK_COLORS.find((item) => item.id === look?.color)?.hex || LOOK_COLORS[0].hex;
}

export function normalizeLook(raw, { played = false } = {}) {
  const base = defaultLook();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...base, ready: Boolean(played) };
  const name = String(raw.name || '').replace(/\s+/g, '').slice(0, 8);
  const shape = LOOK_SHAPES.some((item) => item.id === raw.shape) ? raw.shape : base.shape;
  const color = LOOK_COLORS.some((item) => item.id === raw.color) ? raw.color : base.color;
  const hat = LOOK_HATS.some((item) => item.id === raw.hat) ? raw.hat : base.hat;
  const ready = raw.ready === true || (raw.ready !== false && Boolean(played));
  return { name, shape, color, hat, ready };
}
