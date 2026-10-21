import assert from 'node:assert/strict';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { clipIdFor, recordedIds, voiceLanguages, voiceLines } from '../src/voice-lines.js';

const REQUIRED = [
  'holo-zero-welcome',
  'holo-count',
  'holo-color-cyan',
  'holo-color-amber',
  'holo-color-purple',
  'holo-color-white',
  'holo-color-green',
  'holo-hint',
  'holo-tier',
  'holo-echo',
];

test('星网台词表按语言和角色配声音', () => {
  const languages = voiceLanguages();
  for (const lang of ['zh', 'ja', 'en']) {
    assert.ok(languages[lang].voices.narrator.voice);
    assert.ok(languages[lang].voices.gugu.voice);
    assert.ok(languages[lang].voices.zero.voice);
  }
  const lines = voiceLines('zh');
  for (const id of REQUIRED) assert.ok(lines.some((line) => line.id === id), id);
  for (const line of lines) {
    assert.match(line.id, /^[a-z0-9-]+$/);
    assert.ok(languages.zh.voices[line.role], line.role);
    assert.ok(line.text);
  }
  assert.equal(clipIdFor('这里是星网，你的光的身体在这里。'), 'holo-zero-welcome');
  assert.equal(clipIdFor('青'), 'holo-color-cyan');
  assert.equal(clipIdFor('再点一盏。跟着声音数。'), 'holo-count');
  assert.equal(clipIdFor('这是你的第一次记录'), 'holo-echo');
  assert.equal(clipIdFor('下一格是 (3,2)。'), null);
});

test('星网语音是小文件并且都在', async () => {
  const dir = join(process.cwd(), 'public', 'voice', 'holo');
  const names = (await readdir(dir)).filter((name) => name.endsWith('.mp3'));
  const ids = new Set(recordedIds('zh'));
  assert.equal(names.length, ids.size);
  let total = 0;
  for (const id of ids) {
    const info = await stat(join(dir, `${id}.mp3`));
    assert.ok(info.size > 400, id);
    total += info.size;
  }
  assert.ok(total < 1.5 * 1024 * 1024, `语音一共 ${total} 字节`);
});
