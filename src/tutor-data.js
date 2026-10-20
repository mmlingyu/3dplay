/** Valley tutors, ages 4–12. Characters and quizzes come from the knowledge pack. */

let pack = { characters: [] };

export function applyPack(next) {
  const characters = Array.isArray(next?.characters) ? next.characters : [];
  pack = {
    audience: '4-12',
    subjects: Array.isArray(next?.subjects) ? next.subjects : [],
    characters: characters.filter((item) => item && item.id && item.quiz),
  };
  return pack;
}

export async function loadTutorPack() {
  const response = await fetch('/api/knowledge/tutors');
  if (!response.ok) throw new Error('知识包没取到');
  return applyPack(await response.json());
}

export function tutors() {
  return pack.characters;
}

export function tutorById(id) {
  return pack.characters.find((tutor) => tutor.id === id) || null;
}

export function careTopics(tutorId) {
  const care = tutorById(tutorId)?.care;
  return Array.isArray(care) ? care : [];
}

export function nextQuestion(tutorId, band, usedIds = []) {
  const book = tutorById(tutorId)?.quiz || {};
  const list = book[band] || book.little || [];
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
