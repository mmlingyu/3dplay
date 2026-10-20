import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyPack, careTopics, gradeQuestion, nextQuestion, tutorById, tutors } from '../src/tutor-data.js';

const pack = JSON.parse(readFileSync(new URL('../../knowledge/valley-tutors.json', import.meta.url), 'utf8'));
applyPack(pack);

test('libai is a poetry tutor from the knowledge pack', () => {
  const tutor = tutorById('libai');
  assert.equal(tutor.subject, 'poetry');
  assert.equal(tutor.name, '小李白');
  assert.deepEqual(careTopics('libai').map((item) => item.id), ['school', 'method', 'think', 'friend']);
  assert.equal(tutorById('rooster').name, '小公鸡');
  assert.equal(tutorById('rooster').look.style, 'rooster');
  assert.ok(careTopics('rooster').some((item) => item.id === 'outside'));
  assert.equal(careTopics('missing').length, 0);
  assert.equal(tutor.corpus.q, '李白');
  assert.ok(tutor.reach >= 2);
  assert.equal(tutors().filter((item) => item.subject === 'poetry').length, 1);
  assert.deepEqual(pack.subjects.map((item) => item.id), ['poetry', 'math', 'words']);
});

test('little questions stay short and have one answer', () => {
  const seen = [];
  const first = nextQuestion('libai', 'little', seen);
  assert.ok(first.ask.length <= 24);
  assert.equal(first.choices.filter((item) => item.ok).length, 1);
  seen.push(first.id);
  const second = nextQuestion('libai', 'little', seen);
  assert.notEqual(second.id, first.id);
  assert.equal(gradeQuestion(first, first.choices.find((item) => item.ok).id).ok, true);
  assert.equal(gradeQuestion(first, first.choices.find((item) => !item.ok).id).ok, false);
});

test('bigger band is a separate set for the same npc', () => {
  const easy = nextQuestion('libai', 'little', []);
  const hard = nextQuestion('libai', 'bigger', []);
  assert.notEqual(easy.id, hard.id);
});
