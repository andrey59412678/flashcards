import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordRound, dueIds, waiting, roundChanges, addDays, WAITS } from '../public/srs.js';
import { topicStats, weakest, examTrend, readiness, MIN_ANSWERS } from '../public/stats.js';

const DAY = 86_400_000;
// Noon, so the device's calendar never puts it at a day boundary.
const day0 = new Date(2026, 9, 1, 12).getTime();
const at = days => day0 + days * DAY;

test('a miss comes back the next day, then in 3 and 7 days, and leaves after the last right answer', () => {
  let log = recordRound({}, [], [{ id: 'q', right: false }], at(0));
  assert.equal(log.q[2], 1);
  assert.deepEqual(dueIds(log, at(0)), [], 'not again on the same day');
  assert.equal(log.q[3], addDays(at(0), 1));
  assert.deepEqual(dueIds(log, at(1)), ['q']);
  // Right before its day: nothing moves, it has to stick.
  assert.deepEqual(recordRound(log, [], [{ id: 'q', right: true }], at(0) + 1000), log);
  for (const [box, wait, when] of [[2, WAITS[1], 1], [3, WAITS[2], 4]]) {
    log = recordRound(log, [], [{ id: 'q', right: true }], at(when));
    assert.equal(log.q[2], box);
    assert.equal(log.q[3], addDays(at(when), wait));
  }
  assert.deepEqual(dueIds(log, at(10)), []);
  assert.deepEqual(dueIds(log, at(11)), ['q']);
  log = recordRound(log, [], [{ id: 'q', right: true }], at(11));
  assert.equal(log.q[1], false, 'three right answers on their days take it off the list');
});

test('a miss in any box starts the question over', () => {
  const log = recordRound({ q: [1, true, 3, 0] }, [], [{ id: 'q', right: false }], at(0));
  assert.equal(log.q[2], 1);
  assert.equal(log.q[3], addDays(at(0), 1));
});

test('legacy misses are due right away and the longest overdue come first', () => {
  const log = recordRound({ late: [5, true, 2, at(-3)], soon: [6, true, 1, at(-1)], fixed: [7, false] }, ['legacy'], [], at(0));
  assert.deepEqual(dueIds(log, at(0)), ['legacy', 'late', 'soon']);
  const later = recordRound(log, [], [{ id: 'x', right: false }], at(0));
  assert.deepEqual(waiting(later, at(0)), { count: 1, next: addDays(at(0), 1) });
});

test('a round reports what moved: back to tomorrow, up a box, off the list', () => {
  const before = { up: [1, true, 1, 0], done: [1, true, 3, 0], back: [1, true, 2, 0], early: [1, true, 1, at(5)] };
  const after = recordRound(before, [], [{ id: 'up', right: true }, { id: 'done', right: true }, { id: 'back', right: false }, { id: 'early', right: true }, { id: 'new', right: false }], at(0));
  assert.deepEqual(roundChanges(before, after, ['up', 'done', 'back', 'early', 'new']), { up: 1, done: 1, back: 2 });
});

const bank = { questions: ['placas', 'escolhas', 'seguranca', 'cuidar'].flatMap(topic => Array.from({ length: 10 }, (_, i) => ({ id: `${topic}-${i}`, topic, answer: 0 }))) };
const round = (at, kind, ids, answers, extra = {}) => ({ at, kind, correct: 0, total: ids.length, passed: false, review: { ids, answers }, ...extra });

test('the panel counts answers per topic and names the weakest only with enough answers', () => {
  const placas = Array.from({ length: 10 }, (_, i) => `placas-${i}`);
  const cuidar = Array.from({ length: 10 }, (_, i) => `cuidar-${i}`);
  const history = [round(2, 'study', placas, placas.map((_, i) => (i < 9 ? 0 : 1))), round(1, 'study', cuidar, cuidar.map((_, i) => (i < 4 ? 0 : null))), round(0, 'exam', ['escolhas-0'], [0])];
  const stats = topicStats(bank, history);
  assert.deepEqual(stats.placas, { right: 9, total: 10 });
  assert.deepEqual(stats.cuidar, { right: 4, total: 10 });
  assert.deepEqual(stats.escolhas, { right: 1, total: 1 });
  assert.equal(weakest(stats), 'cuidar');
  assert.equal(weakest({ placas: { right: 0, total: MIN_ANSWERS - 1 } }), null);
  // Old rounds fade: only the newest `limit` answers per topic count.
  assert.deepEqual(topicStats(bank, history, 5).placas, { right: 5, total: 5 });
  assert.deepEqual(topicStats(bank, [{ at: 1, kind: 'exam', correct: 1, total: 1 }, round(2, 'exam', ['gone'], [0])]).placas, { right: 0, total: 0 });
});

test('the trend lists the last exams oldest first and says one honest thing', () => {
  const exams = [24, 18, 22, 25, 21, 15].map((correct, i) => ({ at: i, kind: 'exam', correct, total: 30, passed: correct >= 21 }));
  const trend = examTrend([...exams, { at: 9, kind: 'study', correct: 3, total: 10 }]);
  assert.deepEqual(trend.map(entry => entry.correct), [18, 22, 25, 21, 15]);
  assert.match(readiness(trend, 21), /2 das 3/);
  assert.match(readiness(trend.slice(1, 4), 21), /3 últimas/);
  assert.match(readiness([], 21), /prova completa/);
});
