// What the history says about her: hit rate per topic, the weakest one, and how the last exams went.
// Pure functions over the saved rounds (and the ones synced from other devices). No DOM, no storage.
import { TOPICS } from './exam.js';

// A topic needs this many answers before it can be called weak; fewer is noise.
export const MIN_ANSWERS = 8;

// Every answer kept in the history counts, newest rounds first, at most `limit` per topic so old habits fade.
export function topicStats(bank, history, limit = 60) {
  const byId = new Map(bank.questions.map(q => [q.id, q]));
  const stats = Object.fromEntries(Object.keys(TOPICS).map(topic => [topic, { right: 0, total: 0 }]));
  for (const entry of [...history].sort((x, y) => y.at - x.at)) {
    const { ids, answers } = entry.review ?? {};
    if (!Array.isArray(ids) || !Array.isArray(answers)) continue;
    ids.forEach((id, i) => {
      const question = byId.get(id);
      const topic = question && stats[question.topic];
      if (!topic || topic.total >= limit) return;
      topic.total++;
      if (answers[i] === question.answer) topic.right++;
    });
  }
  return stats;
}

// The topic with the lowest hit rate among those with enough answers; null while there is too little to say.
export function weakest(stats) {
  const ranked = Object.entries(stats).filter(([, { total }]) => total >= MIN_ANSWERS).sort(([x, a], [y, b]) => a.right / a.total - b.right / b.total || (x < y ? -1 : 1));
  return ranked.length ? ranked[0][0] : null;
}

// The last full exams, oldest first, to show the trend.
export function examTrend(history, size = 5) {
  return history.filter(entry => entry.kind === 'exam').sort((x, y) => y.at - x.at).slice(0, size).reverse().map(({ at, correct, total, passed }) => ({ at, correct, total, passed }));
}

// One honest sentence about the trend.
export function readiness(trend, passScore) {
  if (!trend.length) return 'Faça uma prova completa para ver como está.';
  const last = trend.slice(-3);
  const passed = last.filter(entry => entry.passed).length;
  if (last.length === 3 && passed === 3) return 'Passou nas 3 últimas provas. Bom sinal para o dia.';
  if (trend.length === 1) return trend[0].passed ? 'Passou na primeira prova. Faça mais algumas para confirmar.' : `Precisa de ${passScore}. Cada prova sorteia questões novas: continue.`;
  return `Passou em ${passed} das ${last.length} últimas provas. A meta é passar em 3 seguidas.`;
}
