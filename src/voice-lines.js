/** Star-net voice catalog. Playback stays in voice.js. */

import catalog from '../scripts/voice-lines.json' with { type: 'json' };

const PUNCT = /[。！!？?\s]+$/g;

function norm(text) {
  return String(text || '').trim().replace(PUNCT, '');
}

export function voiceLanguages() {
  return catalog.languages;
}

export function voiceLines(lang = 'zh') {
  return catalog.languages[lang]?.lines || [];
}

export function recordedIds(lang = 'zh') {
  return voiceLines(lang).map((line) => line.id);
}

export function countWord(n) {
  const line = voiceLines('zh').find((item) => item.id === `holo-count-${n}`);
  return line?.text || '';
}

export function clipIdFor(text, lang = 'zh') {
  const key = norm(text);
  if (!key) return null;
  for (const line of voiceLines(lang)) {
    const keys = [line.text, ...(line.alias || [])].map(norm);
    if (keys.includes(key)) return line.id;
  }
  return null;
}

export function voiceFile(id, lang = 'zh') {
  const folder = lang === 'zh' ? 'voice/holo/' : `voice/${lang}/holo/`;
  const base = import.meta.env?.BASE_URL || '/';
  return `${base}${folder}${id}.mp3`;
}
