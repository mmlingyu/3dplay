/** One character voice at a time. A recorded file never shares the speaker with speechSynthesis. */

import { clipIdFor, voiceFile } from './voice-lines.js';

let ctx = null;
let current = null;
let htmlClip = null;
let token = 0;
let synthTimer = null;
const buffers = new Map();
const retired = new WeakSet();

function audioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  return ctx;
}

function retireClip(clip) {
  if (!clip) return;
  retired.add(clip);
  clip.onended = null;
  clip.onerror = null;
  try { clip.pause(); } catch { /* already quiet */ }
  try {
    clip.removeAttribute('src');
    clip.load();
  } catch { /* a detached clip can ignore load */ }
}

function haltPlayback() {
  if (current) {
    try { current.stop(); } catch { /* already ended */ }
    current = null;
  }
  if (htmlClip) {
    const clip = htmlClip;
    htmlClip = null;
    retireClip(clip);
  }
  if (synthTimer) {
    clearTimeout(synthTimer);
    synthTimer = null;
  }
  try { globalThis.speechSynthesis?.cancel(); } catch { /* no speaker */ }
}

/** iPad Safari only starts audio after a tap. Resume the context on that tap. */
export function unlockVoice() {
  const audio = audioContext();
  if (!audio) return;
  if (audio.state === 'suspended') audio.resume();
  const buffer = audio.createBuffer(1, 1, audio.sampleRate || 22050);
  const src = audio.createBufferSource();
  src.buffer = buffer;
  src.connect(audio.destination);
  try { src.start(); } catch { /* a second tap can resume again */ }
}

export function bindVoiceUnlock() {
  const onGesture = () => unlockVoice();
  window.addEventListener('pointerdown', onGesture, { capture: true });
  window.addEventListener('touchend', onGesture, { capture: true });
  window.addEventListener('keydown', onGesture, { capture: true });
}

export function voiceReady() {
  return ctx?.state || 'closed';
}

export function stopVoice() {
  token += 1;
  haltPlayback();
  return token;
}

export function voiceToken() {
  return token;
}

function speakNow(text, lang = 'zh-CN') {
  if (!text || typeof speechSynthesis === 'undefined') return;
  const voices = speechSynthesis.getVoices();
  const prefix = String(lang || 'zh').slice(0, 2).toLowerCase();
  const voice = prefix === 'zh'
    ? (voices.find((item) => item.lang?.startsWith('zh') && /Ting|婷婷|中文|Mandarin/.test(item.name)) || voices.find((item) => item.lang?.startsWith('zh')))
    : voices.find((item) => item.lang?.toLowerCase().startsWith(prefix));
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang || 'zh-CN';
  utterance.rate = prefix === 'zh' ? 0.9 : 0.86;
  utterance.volume = 0.7;
  if (voice) utterance.voice = voice;
  speechSynthesis.cancel();
  const kick = new SpeechSynthesisUtterance('\u200b');
  kick.volume = 0;
  kick.rate = 2;
  speechSynthesis.speak(kick);
  speechSynthesis.speak(utterance);
}

/**
 * Play one recording. Resolves 'started', 'failed', or 'aborted'.
 * A file that starts does not also speak. Aborting the previous clip does not speak.
 */
export function playUrl(url, { text = '', lang = 'zh-CN', enabled = () => true, fallback = true } = {}) {
  if (!url || !enabled()) return Promise.resolve('aborted');
  const mine = ++token;
  haltPlayback();
  const audio = new Audio();
  htmlClip = audio;
  audio.preload = 'auto';
  audio.volume = 0.8;
  let settled = false;
  return new Promise((resolve) => {
    const finish = (status) => {
      if (settled) return;
      settled = true;
      const aborted = status === 'aborted' || retired.has(audio) || mine !== token || !enabled();
      if (htmlClip === audio && status !== 'started') htmlClip = null;
      if (aborted) {
        resolve('aborted');
        return;
      }
      if (status === 'failed') {
        try { audio.pause(); } catch { /* keep the speaker free for the fallback */ }
        if (fallback && text) speakNow(text, lang);
      }
      resolve(status);
    };
    audio.addEventListener('error', () => finish(retired.has(audio) ? 'aborted' : 'failed'), { once: true });
    audio.addEventListener('ended', () => { if (htmlClip === audio) htmlClip = null; }, { once: true });
    audio.src = url;
    const played = audio.play();
    if (played && typeof played.then === 'function') {
      played.then(() => finish('started')).catch((error) => {
        const name = error?.name || '';
        finish(retired.has(audio) || name === 'AbortError' || mine !== token ? 'aborted' : 'failed');
      });
    } else finish('started');
  });
}

export async function playVoice(id, { enabled = () => true, fallbackText = '', lang = 'zh-CN' } = {}) {
  if (!id || !enabled()) return false;
  const mine = ++token;
  haltPlayback();
  const audio = audioContext();
  if (!audio) {
    if (fallbackText && mine === token && enabled()) speakNow(fallbackText, lang);
    return false;
  }
  let buffer = buffers.get(id);
  if (!buffer) {
    let response;
    try { response = await fetch(voiceFile(id)); } catch { response = null; }
    if (!response?.ok || mine !== token || !enabled()) {
      if (!response?.ok && fallbackText && mine === token && enabled()) speakNow(fallbackText, lang);
      return false;
    }
    try {
      const data = await response.arrayBuffer();
      buffer = await audio.decodeAudioData(data.slice(0));
    } catch {
      if (fallbackText && mine === token && enabled()) speakNow(fallbackText, lang);
      return false;
    }
    buffers.set(id, buffer);
  }
  if (mine !== token || !enabled()) return false;
  if (audio.state === 'suspended') {
    try { await audio.resume(); } catch { /* still locked */ }
  }
  if (audio.state !== 'running' || mine !== token || !enabled()) return false;
  const src = audio.createBufferSource();
  src.buffer = buffer;
  src.connect(audio.destination);
  current = src;
  src.onended = () => { if (current === src) current = null; };
  try { src.start(); } catch { return false; }
  return true;
}

export function speakText(text, { lang = 'zh-CN', enabled = () => true } = {}) {
  if (!text || !enabled()) return Promise.resolve(false);
  const id = clipIdFor(text);
  if (id) return playVoice(id, { enabled, fallbackText: text, lang });
  const mine = ++token;
  haltPlayback();
  return new Promise((resolve) => {
    synthTimer = setTimeout(() => {
      if (mine !== token || !enabled()) {
        resolve(false);
        return;
      }
      speakNow(text, lang);
      resolve(true);
    }, 80);
  });
}

/** English then Chinese, still one speaker. A newer line cancels the second half. */
export function speakPair(english, chinese, { enabled = () => true } = {}) {
  if (!enabled() || (!english && !chinese)) return;
  const mine = ++token;
  haltPlayback();
  synthTimer = setTimeout(() => {
    if (mine !== token || !enabled() || typeof speechSynthesis === 'undefined') return;
    const voices = speechSynthesis.getVoices();
    const en = voices.find((item) => /^en/i.test(item.lang || ''));
    const zh = voices.find((item) => item.lang?.startsWith('zh') && /Ting|婷婷|中文|Mandarin/.test(item.name)) || voices.find((item) => item.lang?.startsWith('zh'));
    const speakZh = () => {
      if (mine !== token || !chinese || !enabled()) return;
      const line = new SpeechSynthesisUtterance(chinese);
      line.lang = 'zh-CN';
      line.rate = 0.95;
      line.volume = 0.65;
      if (zh) line.voice = zh;
      speechSynthesis.speak(line);
    };
    if (english) {
      const line = new SpeechSynthesisUtterance(english);
      line.lang = 'en-US';
      line.rate = 0.85;
      line.volume = 0.72;
      if (en) line.voice = en;
      line.onend = speakZh;
      speechSynthesis.speak(line);
    } else speakZh();
  }, 30);
}

export { clipIdFor };
