/** Play recorded star-net lines. Fall back to speechSynthesis when a file is missing. */

import { clipIdFor, voiceFile } from './voice-lines.js';

let ctx = null;
let current = null;
let token = 0;
const buffers = new Map();

function audioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  return ctx;
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
  if (!current) return;
  try { current.stop(); } catch { /* already ended */ }
  current = null;
}

export async function playVoice(id, { enabled = () => true } = {}) {
  if (!id || !enabled()) return false;
  const mine = ++token;
  if (current) {
    try { current.stop(); } catch { /* already ended */ }
    current = null;
  }
  const audio = audioContext();
  if (!audio) return false;
  let buffer = buffers.get(id);
  if (!buffer) {
    let response;
    try { response = await fetch(voiceFile(id)); } catch { return false; }
    if (!response.ok) return false;
    try {
      const data = await response.arrayBuffer();
      buffer = await audio.decodeAudioData(data.slice(0));
    } catch { return false; }
    buffers.set(id, buffer);
  }
  if (mine !== token || !enabled()) return false;
  if (audio.state === 'suspended') {
    try { await audio.resume(); } catch { return false; }
  }
  if (audio.state !== 'running') return false;
  const src = audio.createBufferSource();
  src.buffer = buffer;
  src.connect(audio.destination);
  current = src;
  src.onended = () => { if (current === src) current = null; };
  try { src.start(); } catch { return false; }
  return true;
}

export { clipIdFor };
