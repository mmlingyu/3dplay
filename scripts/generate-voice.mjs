/**
 * Generate star-net voice clips from scripts/voice-lines.json.
 *
 * Needs Python edge-tts (no API key) and ffmpeg:
 *   python3 -m pip install --user edge-tts
 *   node scripts/generate-voice.mjs
 *   node scripts/generate-voice.mjs --lang ja
 *
 * Chinese clips go to public/voice/holo/. Other languages go to public/voice/<lang>/holo/.
 * Output is mono mp3. The whole set must stay under 1.5 MB.
 */

import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = join(root, 'scripts', 'voice-lines.json');
const limitBytes = 1.5 * 1024 * 1024;
const args = process.argv.slice(2);
const langArg = args.find((item, index) => args[index - 1] === '--lang') || '';

function run(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (chunk) => { err += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${commandArgs.join(' ')} 退出 ${code} ${err.slice(-400)}`));
    });
  });
}

function outDir(lang) {
  return lang === 'zh' ? join(root, 'public', 'voice', 'holo') : join(root, 'public', 'voice', lang, 'holo');
}

async function synthesize(line, voice, dir) {
  const raw = join(dir, `.${line.id}.raw.mp3`);
  const dest = join(dir, `${line.id}.mp3`);
  await run('python3', [
    '-m', 'edge_tts',
    '--voice', voice.voice,
    `--rate=${voice.rate || '-12%'}`,
    `--pitch=${voice.pitch || '+0Hz'}`,
    '--text', line.text,
    '--write-media', raw,
  ]);
  await run('ffmpeg', [
    '-y', '-i', raw, '-ac', '1', '-ar', '22050', '-b:a', '24k', '-codec:a', 'libmp3lame', dest,
  ]);
  await run('rm', ['-f', raw]);
}

async function main() {
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const langs = langArg ? [langArg] : Object.keys(catalog.languages);
  let files = 0;
  for (const lang of langs) {
    const pack = catalog.languages[lang];
    if (!pack) throw new Error(`没有这种语言：${lang}`);
    if (!pack.lines?.length) {
      console.log(`${lang} 还没有台词，跳过。`);
      continue;
    }
    const dir = outDir(lang);
    await mkdir(dir, { recursive: true });
    for (const line of pack.lines) {
      const voice = pack.voices?.[line.role];
      if (!voice?.voice) throw new Error(`${lang} 的角色 ${line.role} 没有声音`);
      process.stdout.write(`${lang} ${line.id} ${line.role}\n`);
      await synthesize(line, voice, dir);
      files += 1;
    }
  }
  let total = 0;
  async function walk(dir) {
    let names = [];
    try { names = await readdir(dir); } catch { return; }
    for (const name of names) {
      const path = join(dir, name);
      const info = await stat(path);
      if (info.isDirectory()) await walk(path);
      else if (name.endsWith('.mp3')) total += info.size;
    }
  }
  await walk(join(root, 'public', 'voice'));
  const summary = { files, bytes: total, limit: limitBytes };
  console.log(JSON.stringify(summary));
  if (total > limitBytes) throw new Error(`语音一共 ${total} 字节，超过 1.5 MB`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
