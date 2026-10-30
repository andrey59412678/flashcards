// Merge rules for synced progress, shared by the app (sync.js) and the sync Worker. No DOM, no storage.
//
// Snapshot: { v: 1, history, seen, missed: { [questionId]: [at, isMissed, box, due] }, linhasBest, bests }.
// Rounds and seen questions only grow, so they are united. Each miss carries the time it last changed,
// so a question fixed on one device and missed on another resolves per question, never per list.
// box and due are the spaced-review state (srs.js) and travel with the change that set them.

const HISTORY_SIZE = 30;

const isRound = entry => entry && typeof entry === 'object' && Number.isFinite(entry.at) && Number.isFinite(entry.correct) && Number.isFinite(entry.total);
const strings = list => (Array.isArray(list) ? list.filter(item => typeof item === 'string') : []);

// Entries written before spaced review ([at, isMissed]) count as box 1, due right away.
export function missedLog(value) {
  const log = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return log;
  for (const [id, entry] of Object.entries(value)) {
    if (!Array.isArray(entry) || !Number.isFinite(entry[0]) || typeof entry[1] !== 'boolean') continue;
    const box = Number.isInteger(entry[2]) && entry[2] >= 1 && entry[2] <= 3 ? entry[2] : 1;
    const due = Number.isFinite(entry[3]) ? entry[3] : 0;
    log[id] = entry[1] ? [entry[0], true, box, due] : [entry[0], false, 0, 0];
  }
  return log;
}

const isScore = best => best && Number.isFinite(best.correct) && Number.isFinite(best.total) && best.total > 0;
const ratio = best => best.correct / best.total;
const better = (x, y) => (ratio(y) > ratio(x) || (ratio(y) === ratio(x) && y.correct > x.correct) ? y : x);

function bestScores(value) {
  const bests = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return bests;
  for (const [key, best] of Object.entries(value)) if (/^[a-z-]{1,20}$/.test(key) && isScore(best)) bests[key] = { correct: best.correct, total: best.total };
  return bests;
}

export function normalize(snapshot) {
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const best = source.linhasBest;
  return {
    v: 1,
    history: Array.isArray(source.history) ? source.history.filter(isRound) : [],
    seen: strings(source.seen),
    missed: missedLog(source.missed),
    linhasBest: isScore(best) ? { correct: best.correct, total: best.total } : null,
    bests: bestScores(source.bests),
  };
}

// The latest change wins. On a tie the miss wins (better to see a question once more than to lose it), then
// the later review: an app version from before spaced review sends the same change without box and due
// (read as due 0), and it must not reset the real one. Ties break the same way from both sides.
function newer([at, on, box, due], [oldAt, oldOn, oldBox, oldDue]) {
  if (at !== oldAt) return at > oldAt;
  if (on !== oldOn) return on;
  return due > oldDue || (due === oldDue && box > oldBox);
}

export function merge(a, b) {
  const left = normalize(a);
  const right = normalize(b);
  const rounds = new Map();
  for (const entry of [...left.history, ...right.history]) {
    const key = `${entry.at}|${entry.kind}`;
    if (!rounds.has(key) || (entry.review && !rounds.get(key).review)) rounds.set(key, entry);
  }
  const missed = { ...left.missed };
  for (const [id, entry] of Object.entries(right.missed)) if (!missed[id] || newer(entry, missed[id])) missed[id] = entry;
  const linhas = [left.linhasBest, right.linhasBest].filter(Boolean);
  const bests = { ...left.bests };
  for (const [key, best] of Object.entries(right.bests)) bests[key] = bests[key] ? better(bests[key], best) : best;
  return {
    v: 1,
    history: [...rounds.values()].sort((x, y) => y.at - x.at).slice(0, HISTORY_SIZE),
    seen: [...new Set([...left.seen, ...right.seen])].sort(),
    missed: Object.fromEntries(Object.entries(missed).sort(([x], [y]) => (x < y ? -1 : 1))),
    linhasBest: linhas.length ? linhas.reduce(better) : null,
    bests: Object.fromEntries(Object.entries(bests).sort(([x], [y]) => (x < y ? -1 : 1))),
  };
}

export function same(a, b) {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

export function missedIds(log) {
  return Object.entries(missedLog(log)).filter(([, [, on]]) => on).map(([id]) => id);
}
