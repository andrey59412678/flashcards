// Pure exam logic: drawing, timing, scoring and persistence checks. No DOM here.

// The four modules of the Banco Nacional de Questões (Senatran, v1.0).
export const TOPICS = {
  placas: 'Placas, cores e caminhos',
  escolhas: 'Escolhas e consequências',
  seguranca: 'Na direção da segurança',
  cuidar: 'Cuidar, agir e preservar',
};

export function shuffled(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function validateBank(payload) {
  if (!payload || payload.version !== 1 || !Array.isArray(payload.questions) || !payload.questions.length) throw new Error('Invalid bank');
  const { exam } = payload;
  if (!exam || !Number.isInteger(exam.questions) || !Number.isInteger(exam.passScore) || !Number.isInteger(exam.minutes) || exam.passScore > exam.questions) throw new Error('Invalid exam config');
  if (!exam.distribution || Object.keys(exam.distribution).some(topic => !TOPICS[topic])) throw new Error('Invalid distribution');
  if (Object.values(exam.distribution).reduce((sum, count) => sum + count, 0) !== exam.questions) throw new Error('Distribution does not add up');
  const ids = new Set();
  for (const question of payload.questions) {
    const { id, topic, text, options, answer } = question;
    if (typeof id !== 'string' || ids.has(id) || !TOPICS[topic] || typeof text !== 'string' || !text.trim()) throw new Error(`Invalid question ${id}`);
    if (!Array.isArray(options) || options.length < 2 || options.some(option => typeof option !== 'string' || !option.trim())) throw new Error(`Invalid options ${id}`);
    if (new Set(options).size !== options.length) throw new Error(`Repeated option ${id}`);
    if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) throw new Error(`Invalid answer ${id}`);
    if (question.image !== undefined) validateImage(question.image, id);
    ids.add(id);
  }
  return payload;
}

function validateImage(image, id) {
  const { src, width, height, crop } = image ?? {};
  if (typeof src !== 'string' || !src.startsWith('/assets/') || src.includes('..') || !(width > 0) || !(height > 0) || !Array.isArray(crop) || crop.length !== 4 || crop.some(value => !Number.isFinite(value))) throw new Error(`Invalid image ${id}`);
  const [x, y, w, h] = crop;
  if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > width || y + h > height) throw new Error(`Invalid crop ${id}`);
}

// Questions never answered come first, so repeated rounds walk through the whole bank before repeating.
function unseenFirst(questions, seen, random) {
  const seenSet = new Set(seen);
  return [...shuffled(questions.filter(q => !seenSet.has(q.id)), random), ...shuffled(questions.filter(q => seenSet.has(q.id)), random)];
}

// Mirrors the real exam: N questions per topic, topped up from other topics if one runs short.
export function drawExam(bank, random = Math.random, seen = []) {
  const { distribution, questions: size } = bank.exam;
  const picked = [];
  for (const [topic, count] of Object.entries(distribution)) {
    picked.push(...unseenFirst(bank.questions.filter(q => q.topic === topic), seen, random).slice(0, count).map(q => q.id));
  }
  if (picked.length < size) {
    const taken = new Set(picked);
    picked.push(...unseenFirst(bank.questions.filter(q => !taken.has(q.id)), seen, random).slice(0, size - picked.length).map(q => q.id));
  }
  return shuffled(picked, random);
}

export function drawStudy(bank, topic, size, random = Math.random, seen = []) {
  return unseenFirst(bank.questions.filter(q => q.topic === topic), seen, random).slice(0, size).map(q => q.id);
}

// A hand-picked study set that cuts across modules, such as the questions about lines on the road.
export function drawSet(bank, ids, size, random = Math.random, seen = []) {
  const wanted = new Set(ids);
  return unseenFirst(bank.questions.filter(q => wanted.has(q.id)), seen, random).slice(0, size).map(q => q.id);
}

export function coverage(bank, seen) {
  const seenSet = new Set(seen ?? []);
  const result = {};
  for (const topic of Object.keys(TOPICS)) {
    const ids = bank.questions.filter(q => q.topic === topic).map(q => q.id);
    result[topic] = { seen: ids.filter(id => seenSet.has(id)).length, total: ids.length };
  }
  return result;
}

export function updateSeen(seen, attempt, bank) {
  const known = new Set(bank.questions.map(q => q.id));
  const next = new Set((seen ?? []).filter(id => known.has(id)));
  attempt.ids.forEach((id, position) => { if (attempt.answers[position] !== null) next.add(id); });
  return [...next];
}

// Option order is reshuffled per attempt so position never becomes the thing memorised.
export function optionOrders(bank, ids, random = Math.random) {
  const byId = new Map(bank.questions.map(q => [q.id, q]));
  return ids.map(id => shuffled(byId.get(id).options.map((_, index) => index), random));
}

export function newAttempt(ids, { now, minutes = null, kind = 'exam', orders, set = null }) {
  return {
    version: 1,
    kind,
    set,
    ids: [...ids],
    orders: orders.map(order => [...order]),
    answers: ids.map(() => null),
    index: 0,
    startedAt: now,
    deadline: minutes ? now + minutes * 60_000 : null,
    finishedAt: null,
  };
}

export function choose(attempt, option) {
  if (attempt.finishedAt) return attempt;
  // Outside the exam the answer is revealed right away, so the first choice is final.
  if (attempt.kind !== 'exam' && attempt.answers[attempt.index] !== null) return attempt;
  const answers = [...attempt.answers];
  answers[attempt.index] = answers[attempt.index] === option ? null : option;
  return { ...attempt, answers };
}

export function goTo(attempt, index) {
  return { ...attempt, index: Math.min(Math.max(0, index), attempt.ids.length - 1) };
}

export function remainingMs(attempt, now) {
  return attempt.deadline === null ? null : Math.max(0, attempt.deadline - now);
}

export function isExpired(attempt, now) {
  return attempt.deadline !== null && now >= attempt.deadline;
}

export function finish(attempt, now) {
  if (attempt.finishedAt) return attempt;
  return { ...attempt, finishedAt: attempt.deadline === null ? now : Math.min(now, attempt.deadline), index: 0 };
}

export function unanswered(attempt) {
  return attempt.answers.filter(answer => answer === null).length;
}

export function score(attempt, bank) {
  const byId = new Map(bank.questions.map(q => [q.id, q]));
  const byTopic = {};
  const wrong = [];
  let correct = 0;
  attempt.ids.forEach((id, position) => {
    const question = byId.get(id);
    const topic = (byTopic[question.topic] ??= { correct: 0, total: 0 });
    topic.total++;
    if (attempt.answers[position] === question.answer) {
      correct++;
      topic.correct++;
    } else {
      wrong.push(id);
    }
  });
  const total = attempt.ids.length;
  // A practice round on a handful of misses is scored by the same percentage as the real exam.
  const needed = attempt.kind === 'exam' ? bank.exam.passScore : Math.ceil(total * bank.exam.passScore / bank.exam.questions);
  return { correct, total, needed, passed: correct >= needed, byTopic, wrong };
}

export function restoreAttempt(bank, saved) {
  if (!saved || saved.version !== 1 || !['exam', 'review', 'study'].includes(saved.kind)) return null;
  const known = new Set(bank.questions.map(q => q.id));
  const { ids, answers, index } = saved;
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length || ids.some(id => !known.has(id))) return null;
  if (!Array.isArray(answers) || answers.length !== ids.length) return null;
  const byId = new Map(bank.questions.map(q => [q.id, q]));
  if (answers.some((answer, i) => answer !== null && !(Number.isInteger(answer) && answer >= 0 && answer < byId.get(ids[i]).options.length))) return null;
  if (!Number.isInteger(index) || index < 0 || index >= ids.length) return null;
  const { orders } = saved;
  if (!Array.isArray(orders) || orders.length !== ids.length) return null;
  const validOrder = (order, i) => Array.isArray(order) && order.length === byId.get(ids[i]).options.length && [...order].sort((a, b) => a - b).every((value, k) => value === k);
  if (!orders.every(validOrder)) return null;
  if (!Number.isFinite(saved.startedAt) || (saved.deadline !== null && !Number.isFinite(saved.deadline)) || (saved.finishedAt !== null && !Number.isFinite(saved.finishedAt))) return null;
  return { version: 1, kind: saved.kind, set: typeof saved.set === 'string' ? saved.set : null, ids: [...ids], orders: orders.map(order => [...order]), answers: [...answers], index, startedAt: saved.startedAt, deadline: saved.deadline, finishedAt: saved.finishedAt };
}

// A finished round as kept in the history, with its answers, so its correction can be reopened later.
export function historyEntry(attempt, bank, topic) {
  const { correct, total, passed } = score(attempt, bank);
  const { ids, orders, answers, startedAt, kind, set } = attempt;
  return { at: attempt.finishedAt, kind, topic, set: set ?? undefined, correct, total, passed, review: { ids, orders, answers, startedAt } };
}

// Rebuilds the finished round behind a history entry. Null for entries saved before answers were kept,
// or when the bank no longer has one of its questions.
export function reviewFromHistory(bank, entry) {
  const review = entry?.review;
  if (!review || !Number.isFinite(entry.at)) return null;
  return restoreAttempt(bank, { version: 1, kind: entry.kind, set: entry.set ?? null, ids: review.ids, orders: review.orders, answers: review.answers, index: 0, startedAt: review.startedAt, deadline: null, finishedAt: entry.at });
}

// Positions of a finished round to show in its correction: the misses (blank counts as a miss), the hits, or all.
export function reviewPositions(attempt, bank, filter = 'wrong') {
  const byId = new Map(bank.questions.map(q => [q.id, q]));
  return attempt.ids.flatMap((id, position) => {
    const right = attempt.answers[position] === byId.get(id).answer;
    return filter === 'all' || (filter === 'right') === right ? [position] : [];
  });
}
