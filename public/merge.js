// Merge rules for synced progress, shared by the app (sync.js) and the sync Worker. No DOM, no storage.
//
// Snapshot: { v: 1, history, seen, missed: { [questionId]: [at, isMissed] }, linhasBest }.
// Rounds and seen questions only grow, so they are united. Each miss carries the time it last changed,
// so a question fixed on one device and missed on another resolves per question, never per list.

const HISTORY_SIZE = 30;

const isRound = entry => entry && typeof entry === 'object' && Number.isFinite(entry.at) && Number.isFinite(entry.correct) && Number.isFinite(entry.total);
const strings = list => (Array.isArray(list) ? list.filter(item => typeof item === 'string') : []);

function missedLog(value) {
  const log = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return log;
  for (const [id, entry] of Object.entries(value)) {
    if (Array.isArray(entry) && Number.isFinite(entry[0]) && typeof entry[1] === 'boolean') log[id] = [entry[0], entry[1]];
  }
  return log;
}

export function normalize(snapshot) {
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const best = source.linhasBest;
  return {
    v: 1,
    history: Array.isArray(source.history) ? source.history.filter(isRound) : [],
    seen: strings(source.seen),
    missed: missedLog(source.missed),
    linhasBest: best && Number.isFinite(best.correct) && Number.isFinite(best.total) && best.total > 0 ? { correct: best.correct, total: best.total } : null,
  };
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
  for (const [id, [at, on]] of Object.entries(right.missed)) {
    const mine = missed[id];
    // On a tie the miss wins: better to review a question once more than to lose it.
    if (!mine || at > mine[0] || (at === mine[0] && on)) missed[id] = [at, on];
  }
  const bests = [left.linhasBest, right.linhasBest].filter(Boolean);
  return {
    v: 1,
    history: [...rounds.values()].sort((x, y) => y.at - x.at).slice(0, HISTORY_SIZE),
    seen: [...new Set([...left.seen, ...right.seen])].sort(),
    missed: Object.fromEntries(Object.entries(missed).sort(([x], [y]) => (x < y ? -1 : 1))),
    linhasBest: bests.length ? bests.reduce((x, y) => (y.correct / y.total > x.correct / x.total ? y : x)) : null,
  };
}

export function same(a, b) {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

export function missedIds(log) {
  return Object.entries(missedLog(log)).filter(([, [, on]]) => on).map(([id]) => id);
}

// Records what changed in the list of misses after a round. Questions missed before this log existed
// count as changed at time 0, so any real change elsewhere wins over them.
// The stamp never goes backwards, which keeps a device with a late clock from being ignored forever.
export function recordMissed(log, before, after, now) {
  const next = missedLog(log);
  for (const id of before) if (!next[id]) next[id] = [0, true];
  const latest = Math.max(0, ...Object.values(next).map(([at]) => at));
  const at = Math.max(now, latest + 1);
  const was = new Set(before);
  const is = new Set(after);
  for (const id of is) if (!was.has(id)) next[id] = [at, true];
  for (const id of was) if (!is.has(id)) next[id] = [at, false];
  return next;
}
