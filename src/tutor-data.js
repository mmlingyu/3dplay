/** Valley tutors, ages 4–12. Characters and quizzes come from the knowledge pack. */

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

export async function loadTutorPack(realm = 'he') {
  const key = realmKey(realm);
  if (key === 'he') {
    const response = await fetch('/api/knowledge/tutors');
    if (!response.ok) throw new Error('知识包没取到');
    return applyPack(await response.json(), 'he');
  }
  try {
    const response = await fetch(`/api/knowledge/tutors?valley=${encodeURIComponent(key)}`);
    if (response.ok) {
      const pack = applyPack(await response.json(), key);
      if (pack.characters.length) return pack;
    }
  } catch { /* the day valley still plays from the local pack */ }
  const local = await import('./ri-tutors.js');
  return applyPack(local.riTutorPack, key);
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
  const order = band === 'older' ? ['older', 'bigger', 'little'] : band === 'bigger' ? ['bigger', 'little'] : ['little'];
  let list = [];
  for (const name of order) {
    if (Array.isArray(book[name]) && book[name].length) {
      list = book[name];
      break;
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
