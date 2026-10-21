/** Japanese and Chinese clips. speechSynthesis is the fallback when a file cannot play. */

import { RI_AUDIO } from './ri-tutors.js';

let soundOn = true;
let clip = null;

export function setRiSound(on) {
  soundOn = on !== false;
  if (!soundOn && clip) {
    clip.pause();
    clip = null;
  }
}

export function riClipUrl(id) {
  const base = import.meta.env.BASE_URL || './';
  return `${base}audio/ri/${id}.mp3`;
}

function speakSynth(text, lang) {
  if (!text || !globalThis.speechSynthesis) return;
  const voices = speechSynthesis.getVoices();
  const voice = voices.find((item) => item.lang?.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.9;
  utterance.volume = 0.7;
  if (voice) utterance.voice = voice;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

export function playRiAudio(id, { text = '', lang = 'ja-JP' } = {}) {
  if (!soundOn || !id) return;
  const finish = () => speakSynth(text, lang);
  try {
    if (clip) {
      clip.pause();
      clip = null;
    }
    const audio = new Audio(riClipUrl(id));
    clip = audio;
    audio.addEventListener('error', finish, { once: true });
    const played = audio.play();
    if (played?.catch) played.catch(() => finish());
  } catch {
    finish();
  }
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
