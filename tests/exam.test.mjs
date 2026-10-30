import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { TOPICS, validateBank, drawExam, drawStudy, coverage, updateSeen, optionOrders, newAttempt as rawAttempt, choose, goTo, remainingMs, isExpired, finish, unanswered, score, restoreAttempt, updateMissed, historyEntry, reviewFromHistory, reviewPositions } from '../public/exam.js';

const real = validateBank(JSON.parse(await readFile(new URL('../public/questions.json', import.meta.url), 'utf8')));

let current;
const newAttempt = (ids, options) => rawAttempt(ids, { ...options, orders: optionOrders(current, ids) });

function syntheticBank(perTopic = 20) {
  const questions = Object.keys(TOPICS).flatMap(topic => Array.from({ length: perTopic }, (_, i) => ({
    id: `${topic}-${i}`, topic, text: `Pergunta ${i}?`, options: ['a', 'b', 'c', 'd'], answer: i % 4,
  })));
  current = validateBank({ version: 1, exam: real.exam, questions });
  return current;
}

test('the real bank is large, consistent and can fill every topic of an exam', () => {
  assert.ok(real.questions.length >= 1000, `only ${real.questions.length} questions`);
  for (const [topic, count] of Object.entries(real.exam.distribution)) {
    assert.ok(real.questions.filter(q => q.topic === topic).length >= count * 2, topic);
  }
  // Generic prompts ("O que essa placa indica?") legitimately repeat for different signs.
  const keys = real.questions.map(q => [q.text.trim().toLowerCase(), q.sign ?? '', q.options[q.answer]].join('|'));
  assert.equal(new Set(keys).size, keys.length, 'duplicated question');
  assert.equal(real.exam.questions, 30);
});

test('an exam follows the official topic distribution without repeating questions', () => {
  for (let seed = 0; seed < 20; seed++) {
    let state = seed + 1;
    const random = () => (state = (state * 16807) % 2147483647) / 2147483647;
    const ids = drawExam(real, random);
    assert.equal(ids.length, 30);
    assert.equal(new Set(ids).size, 30);
    const topics = {};
    for (const id of ids) {
      const topic = real.questions.find(q => q.id === id).topic;
      topics[topic] = (topics[topic] ?? 0) + 1;
    }
    assert.deepEqual(topics, real.exam.distribution);
  }
});

test('a topic that runs short is topped up from the others', () => {
  const bank = syntheticBank();
  const short = { ...bank, questions: bank.questions.filter(q => q.topic !== 'cuidar' || q.id === 'cuidar-0') };
  const ids = drawExam(short);
  assert.equal(ids.length, 30);
  assert.equal(new Set(ids).size, 30);
});

test('answers can be chosen, changed and cleared, and the timer expires at the deadline', () => {
  const bank = syntheticBank();
  let attempt = newAttempt(drawExam(bank), { now: 1000, minutes: 60 });
  assert.equal(unanswered(attempt), 30);
  attempt = choose(attempt, 2);
  attempt = choose(goTo(attempt, 1), 0);
  assert.deepEqual(attempt.answers.slice(0, 2), [2, 0]);
  attempt = choose(attempt, 0);
  assert.equal(attempt.answers[1], null);
  assert.equal(goTo(attempt, 99).index, 29);
  assert.equal(goTo(attempt, -3).index, 0);
  assert.equal(remainingMs(attempt, 1000 + 59 * 60_000), 60_000);
  assert.equal(isExpired(attempt, 1000 + 60 * 60_000), true);
  assert.equal(finish(attempt, 1000 + 90 * 60_000).finishedAt, 1000 + 60 * 60_000);
});

test('scoring uses the pass mark, counts blanks as wrong and freezes after submit', () => {
  const bank = syntheticBank();
  const byId = new Map(bank.questions.map(q => [q.id, q]));
  let attempt = newAttempt(drawExam(bank), { now: 0, minutes: 60 });
  const pass = bank.exam.passScore;
  attempt = { ...attempt, answers: attempt.ids.map((id, i) => (i < pass ? byId.get(id).answer : null)) };
  let result = score(attempt, bank);
  assert.equal(result.correct, pass);
  assert.equal(result.passed, true);
  assert.equal(result.wrong.length, 30 - pass);
  attempt = { ...attempt, answers: attempt.answers.map((a, i) => (i === 0 ? (a + 1) % 4 : a)) };
  result = score(attempt, bank);
  assert.equal(result.passed, false);
  const done = finish(attempt, 5);
  assert.equal(choose(done, 1), done);
  const total = Object.values(result.byTopic).reduce((sum, t) => sum + t.total, 0);
  assert.equal(total, 30);
});

test('a review round has no timer and is judged by the exam percentage', () => {
  const bank = syntheticBank();
  const attempt = newAttempt(['placas-0', 'placas-1', 'placas-2'], { now: 0, kind: 'review' });
  assert.equal(attempt.deadline, null);
  assert.equal(isExpired(attempt, 10 ** 12), false);
  assert.equal(score(attempt, bank).needed, Math.ceil(3 * bank.exam.passScore / 30));
});

test('missed questions accumulate and leave once answered right', () => {
  const bank = syntheticBank();
  const ids = ['placas-0', 'placas-1'];
  let attempt = { ...newAttempt(ids, { now: 0, kind: 'review' }), answers: [0, 0] };
  let missed = updateMissed(['gone', 'cuidar-3'], attempt, bank);
  assert.deepEqual(missed.sort(), ['cuidar-3', 'placas-1']);
  attempt = { ...attempt, answers: [0, 1] };
  missed = updateMissed(missed, attempt, bank);
  assert.deepEqual(missed, ['cuidar-3']);
});

test('options are reshuffled per attempt but answers keep pointing at the original option', () => {
  const bank = syntheticBank();
  const ids = drawExam(bank);
  const orders = optionOrders(bank, ids, () => 0);
  for (const order of orders) assert.deepEqual([...order].sort(), [0, 1, 2, 3]);
  assert.notDeepEqual(orders[0], [0, 1, 2, 3]);
  const byId = new Map(bank.questions.map(q => [q.id, q]));
  const attempt = { ...rawAttempt(ids, { now: 0, minutes: 60, orders }), answers: ids.map(id => byId.get(id).answer) };
  assert.equal(score(attempt, bank).correct, 30);
});

test('the real bank keeps the right answer recoverable after its options are shuffled', () => {
  for (const question of real.questions) assert.equal(question.answer, 0, question.id);
  const withSign = real.questions.filter(q => q.image);
  assert.ok(withSign.length >= 100);
  for (const question of withSign) assert.match(question.sign, /^[AR]-/);
});

test('every sign image in the bank exists and no question asks about a sign it cannot show', async () => {
  for (const src of new Set(real.questions.filter(q => q.image).map(q => q.image.src))) {
    await access(new URL(`../public${src}`, import.meta.url));
  }
  for (const question of real.questions.filter(q => q.sign && !q.image)) {
    assert.match(question.text, /placa (azul|marrom|verde|“)/i, question.id);
  }
});

test('unseen questions are drawn before any repeat, for exams and study rounds', () => {
  const bank = syntheticBank(20);
  let seen = [];
  const drawnPlacas = new Set();
  for (let round = 0; round < 2; round++) {
    const ids = drawStudy(bank, 'placas', 10, Math.random, seen);
    assert.equal(ids.length, 10);
    for (const id of ids) {
      assert.ok(id.startsWith('placas-'));
      assert.ok(!drawnPlacas.has(id), 'repeated before the topic was exhausted');
      drawnPlacas.add(id);
    }
    const attempt = { ...newAttempt(ids, { now: 0, kind: 'study' }), answers: ids.map(() => 0) };
    seen = updateSeen(seen, attempt, bank);
  }
  assert.equal(coverage(bank, seen).placas.seen, 20);
  assert.equal(coverage(bank, seen).cuidar.seen, 0);
  const exam = drawExam(bank, Math.random, bank.questions.filter(q => q.topic !== 'cuidar' || Number(q.id.split('-')[1]) < 10).map(q => q.id));
  const cuidar = exam.filter(id => id.startsWith('cuidar-'));
  assert.ok(cuidar.every(id => Number(id.split('-')[1]) >= 10), 'exam picked a seen question while unseen ones remained');
});

test('blank answers do not count as seen and a study answer cannot be changed once revealed', () => {
  const bank = syntheticBank();
  const ids = ['placas-0', 'placas-1'];
  const exam = { ...newAttempt(ids, { now: 0, minutes: 60 }), answers: [2, null] };
  assert.deepEqual(updateSeen(['gone'], exam, bank), ['placas-0']);
  let study = newAttempt(ids, { now: 0, kind: 'study' });
  study = choose(study, 3);
  assert.equal(choose(study, 1).answers[0], 3);
  assert.equal(choose(study, 3).answers[0], 3);
  assert.equal(restoreAttempt(bank, JSON.parse(JSON.stringify(study))).kind, 'study');
});

test('a saved attempt survives reload and corrupted storage is discarded', () => {
  const bank = syntheticBank();
  const good = choose(newAttempt(drawExam(bank), { now: 0, minutes: 60 }), 1);
  assert.deepEqual(restoreAttempt(bank, JSON.parse(JSON.stringify(good))), good);
  for (const bad of [null, {}, { ...good, kind: 'x' }, { ...good, ids: [...good.ids.slice(1), 'gone'] }, { ...good, answers: good.answers.slice(1) }, { ...good, answers: good.answers.map(() => 9) }, { ...good, index: 30 }, { ...good, deadline: 'x' }, { ...good, orders: good.orders.map(() => [0, 0, 1, 2]) }, { ...good, orders: undefined }]) {
    assert.equal(restoreAttempt(bank, bad), null);
  }
});

test('broken banks are rejected before they reach the page', () => {
  const base = syntheticBank();
  const q = base.questions[0];
  for (const broken of [
    { ...q, answer: 4 }, { ...q, options: ['a'] }, { ...q, options: ['a', 'a'] }, { ...q, topic: 'outro' }, { ...q, image: 'https://x/y.png' },
  ]) {
    assert.throws(() => validateBank({ ...base, questions: [broken, ...base.questions.slice(1)] }));
  }
  assert.throws(() => validateBank({ ...base, exam: { ...base.exam, passScore: 31 } }));
  assert.throws(() => validateBank({ ...base, exam: { ...base.exam, distribution: { legislacao: 29 } } }));
});

test('a finished round kept in the history reopens with the same answers, order and score', () => {
  const bank = syntheticBank();
  const ids = drawExam(bank, () => 0.3);
  let attempt = newAttempt(ids, { now: 1000, minutes: 60, kind: 'exam' });
  const byId = new Map(bank.questions.map(q => [q.id, q]));
  ids.forEach((id, i) => { attempt = goTo(attempt, i); if (i % 3) attempt = choose(attempt, i % 2 ? byId.get(id).answer : (byId.get(id).answer + 1) % 4); });
  attempt = finish(attempt, 61_000);
  const entry = JSON.parse(JSON.stringify(historyEntry(attempt, bank)));
  assert.equal(entry.correct, score(attempt, bank).correct);
  const reopened = reviewFromHistory(bank, entry);
  assert.deepEqual(reopened.answers, attempt.answers);
  assert.deepEqual(reopened.orders, attempt.orders);
  assert.equal(reopened.finishedAt, 61_000);
  assert.deepEqual(score(reopened, bank), score(attempt, bank));

  const wrong = reviewPositions(reopened, bank, 'wrong');
  const right = reviewPositions(reopened, bank, 'right');
  assert.equal(wrong.length + right.length, ids.length);
  assert.equal(right.length, entry.correct);
  assert.ok(wrong.includes(0), 'a blank answer is listed with the misses');
  assert.deepEqual(reviewPositions(reopened, bank, 'all'), ids.map((_, i) => i));
});

test('history entries without answers, or with questions gone from the bank, cannot be reopened', () => {
  const bank = syntheticBank();
  assert.equal(reviewFromHistory(bank, { at: 5, kind: 'exam', correct: 20, total: 30, passed: true }), null);
  const ids = drawExam(bank, () => 0.4);
  const entry = historyEntry(finish(newAttempt(ids, { now: 1, kind: 'exam' }), 2), bank);
  assert.ok(reviewFromHistory(bank, entry));
  assert.equal(reviewFromHistory(bank, { ...entry, review: { ...entry.review, ids: ['gone', ...ids.slice(1)] } }), null);
  assert.equal(reviewFromHistory(bank, { ...entry, review: { ...entry.review, answers: entry.review.answers.slice(1) } }), null);
});
