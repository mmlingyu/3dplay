// Turn a vision model's free-text reply into the look object the figure builder already accepts.
export function parseLookText(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) throw new Error('本机小模型没有返回能用的结果。');
  try {
    const raw = JSON.parse(match[0]);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('empty');
    return raw;
  } catch {
    throw new Error('本机小模型没有返回能用的结果。');
  }
}
