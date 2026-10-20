import assert from 'node:assert/strict';
import test from 'node:test';
import { parseLookText } from '../src/look-text.js';

test('本机小模型的 JSON 能从说明文字里取出来', () => {
  const look = parseLookText('看完了\n{"name":"泡泡兽","kind":"creature","arms":4,"parts":[{"name":"螺旋壳","shape":"cone","anchor":"back","size":"large","color":"accent"}]}\n完毕');
  assert.equal(look.name, '泡泡兽');
  assert.equal(look.arms, 4);
  assert.equal(look.parts[0].name, '螺旋壳');
});

test('没有 JSON 时不把乱码交给模型', () => {
  assert.throws(() => parseLookText('我看见一只动物'), /没有返回能用的结果/);
});
