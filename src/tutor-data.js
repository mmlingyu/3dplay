/** Valley tutors, ages 4–12. Characters and quizzes come from the knowledge pack. */

import { meiTutorPack } from './mei-tutors.js';
import { mergedQuizOrder } from './realm-data.js';
import { riTutorPack } from './ri-tutors.js';
import { xingTutorPack } from './xing-tutors.js';
import { staticPreviewEnabled } from './static-preview.js';

const packs = {
  he: { audience: '4-12', subjects: [], characters: [] },
  ri: { audience: '4-12', subjects: [], characters: [] },
};
let active = 'he';

function realmKey(realm) {
  return realm && realm !== 'he' ? realm : 'he';
}

export function applyPack(next, realm = null) {
  const key = realmKey(realm);
  const characters = Array.isArray(next?.characters) ? next.characters : [];
  const kept = characters.filter((item) => {
    if (!item?.id) return false;
    if (item.published === false || item.review?.published === false) return false;
    const valley = item.valley || 'he';
    if (key === 'he') return valley === 'he';
    if (valley !== key) return false;
    return Boolean(item.quiz || item.role === 'guide' || item.care);
  }).filter((item) => {
    if (key === 'he') return Boolean(item.quiz);
    return Boolean(item.quiz || item.role === 'guide' || item.care);
  });
  packs[key] = {
    audience: '4-12',
    subjects: Array.isArray(next?.subjects) ? next.subjects : [],
    characters: kept,
  };
  if (active === key) return packs[key];
  return packs[key];
}

export function useTutorRealm(realm) {
  active = realmKey(realm);
  if (!packs[active]) packs[active] = { audience: '4-12', subjects: [], characters: [] };
  return packs[active];
}

function fetchPack(url, ms = 800) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

function applyLocalPack(key) {
  if (key === 'xing') return applyPack(xingTutorPack, 'xing');
  if (key === 'mei') return applyPack(meiTutorPack, 'mei');
  return applyPack(riTutorPack, key);
}

async function refreshRemotePack(key) {
  if (staticPreviewEnabled()) return key === 'he' ? packs[key] : applyLocalPack(key);
  const url = key === 'he' ? '/api/knowledge/tutors' : `/api/knowledge/tutors?valley=${encodeURIComponent(key)}`;
  try {
    const response = await fetchPack(url);
    if (!response.ok) return packs[key];
    const pack = applyPack(await response.json(), key);
    if (key !== 'he' && !pack.characters.length) return applyLocalPack(key);
    return pack;
  } catch {
    return packs[key];
  }
}

/** Apply the bundled pack immediately. The knowledge service may refresh it later. */
export function primeTutorPack(realm = 'he') {
  const key = realmKey(realm);
  if (key === 'he') return packs.he;
  return applyLocalPack(key);
}

export async function loadTutorPack(realm = 'he') {
  const key = realmKey(realm);
  if (key !== 'he') primeTutorPack(key);
  return refreshRemotePack(key);
}

export function tutors() {
  return packs[active]?.characters || [];
}

export function tutorById(id) {
  return tutors().find((tutor) => tutor.id === id) || null;
}

export function careTopics(tutorId) {
  const care = tutorById(tutorId)?.care;
  return Array.isArray(care) ? care : [];
}

export function nextQuestion(tutorId, band, usedIds = []) {
  const book = tutorById(tutorId)?.quiz || {};
  const order = mergedQuizOrder(band);
  let list = [];
  if (band === 'junior' || band === 'senior') {
    const seen = new Set();
    for (const name of order) {
      for (const item of book[name] || []) {
        if (!item?.id || seen.has(item.id)) continue;
        seen.add(item.id);
        list.push(item);
      }
    }
  } else {
    for (const name of order) {
      if (Array.isArray(book[name]) && book[name].length) {
        list = book[name];
        break;
      }
    }
  }
  if (!list.length) return null;
  const fresh = list.filter((item) => !usedIds.includes(item.id));
  return (fresh.length ? fresh : list)[0];
}

export function gradeQuestion(question, choiceId) {
  if (!question) return { ok: false, message: '这一题还没准备好。' };
  const picked = question.choices.find((item) => item.id === choiceId);
  if (!picked) return { ok: false, message: '点一个答案吧。' };
  return { ok: Boolean(picked.ok), message: picked.ok ? question.yes : question.no };
}
