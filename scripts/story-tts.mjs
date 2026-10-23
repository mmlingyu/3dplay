#!/usr/bin/env node
/**
 * Regenerates the valley story clips with edge-tts.
 *
 *   node scripts/story-tts.mjs
 *   node scripts/story-tts.mjs --force
 *
 * Writes public/voice/story/<id>.mp3. Running it again keeps files that
 * already exist, unless --force is set. Install the tool once with
 * `pip install edge-tts`. Each character uses a different zh-CN voice.
 * 小李白 speaks the prologue, the restore lines, and the finale.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JOURNEY_CLIPS } from '../src/journey/lines.js';
import { FINALE_LINE, LIBAI_FOG_LINE, VALLEY_CAST, restoreLine, valleyLine } from '../src/valley-tutors.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'voice', 'story');
const force = process.argv.includes('--force');

const VOICE = {
  libai: 'zh-CN-YunxiNeural',
  boatman: 'zh-CN-YunyangNeural',
  aunt: 'zh-CN-XiaoxiaoNeural',
  grandma: 'zh-CN-XiaoyiNeural',
  mumu: 'zh-CN-YunxiaNeural',
  swallow: 'zh-CN-liaoning-XiaobeiNeural',
};

const clips = [
  { id: 'fog-libai', voice: VOICE.libai, text: LIBAI_FOG_LINE },
  { id: 'fog-libai-senior', voice: VOICE.libai, text: valleyLine('libai', 'senior') },
  { id: 'finale-libai', voice: VOICE.libai, text: FINALE_LINE },
  { id: 'finale-libai-senior', voice: VOICE.libai, text: FINALE_LINE },
];

for (const zone of ['water', 'light', 'sky', 'all']) {
  clips.push({ id: `restore-${zone}`, voice: VOICE.libai, text: restoreLine(zone, 'junior') });
  clips.push({ id: `restore-${zone}-senior`, voice: VOICE.libai, text: restoreLine(zone, 'senior') });
}

for (const person of VALLEY_CAST) {
  clips.push({ id: person.id, voice: VOICE[person.id], text: person.junior });
  clips.push({ id: `${person.id}-senior`, voice: VOICE[person.id], text: person.senior });
}

for (const clip of JOURNEY_CLIPS) {
  clips.push({ id: clip.id, voice: VOICE[clip.voice], text: clip.text });
}

function edgeCommand() {
  const direct = spawnSync('edge-tts', ['--version'], { encoding: 'utf8' });
  if (direct.status === 0) return ['edge-tts'];
  const python = spawnSync('python3', ['-m', 'edge_tts', '--version'], { encoding: 'utf8' });
  if (python.status === 0) return ['python3', '-m', 'edge_tts'];
  console.error('edge-tts is not installed. Run: pip install edge-tts');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const bin = edgeCommand();
let wrote = 0;
let skipped = 0;
for (const clip of clips) {
  const file = join(outDir, `${clip.id}.mp3`);
  if (!force && existsSync(file) && statSync(file).size > 1000) {
    skipped += 1;
    console.log(`keep ${clip.id}`);
    continue;
  }
  let result = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    if (existsSync(file)) unlinkSync(file);
    result = spawnSync(bin[0], [
      ...bin.slice(1),
      '--voice', clip.voice,
      '--rate=-10%',
      '--text', clip.text,
      '--write-media', file,
    ], { encoding: 'utf8' });
    if (result.status === 0 && existsSync(file) && statSync(file).size > 1000) break;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 800 * attempt);
  }
  if (!result || result.status !== 0 || !existsSync(file) || statSync(file).size <= 1000) {
    console.error(result?.stderr || result?.stdout || `edge-tts failed for ${clip.id}`);
    process.exit(1);
  }
  wrote += 1;
  console.log(`wrote ${clip.id}`);
}
console.log(`story voice: wrote ${wrote}, skipped ${skipped}`);
