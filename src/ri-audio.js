/** Japanese and Chinese clips. speechSynthesis speaks only when the file itself cannot play. */

import { RI_AUDIO } from './ri-tutors.js';
import { playUrl, stopVoice } from './voice.js';

let soundOn = true;

export function setRiSound(on) {
  const next = on !== false;
  if (soundOn && !next) stopVoice();
  soundOn = next;
}

export function riClipUrl(id) {
  const base = import.meta.env.BASE_URL || './';
  return `${base}audio/ri/${id}.mp3`;
}

export function playRiAudio(id, { text = '', lang = 'ja-JP' } = {}) {
  if (!soundOn || !id) return Promise.resolve('aborted');
  return playUrl(riClipUrl(id), { text, lang, fallback: Boolean(text), enabled: () => soundOn });
}

export function playBeep() {
  if (!soundOn || !globalThis.AudioContext && !globalThis.webkitAudioContext) return;
  try {
    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => ctx.close();
  } catch { /* the picture of the green light still tells the step */ }
}

export function warmRiAudio(missing) {
  if (!missing?.delete) return;
  for (const id of RI_AUDIO) {
    fetch(riClipUrl(id)).then((res) => {
      if (res.ok) missing.delete(id);
    }).catch(() => {});
  }
}
