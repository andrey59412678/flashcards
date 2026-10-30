// Spaced review of the missed questions, in Leitner boxes. A miss comes back the next day; each right answer
// on a day it is due moves it up a box (back in 3 days, then in 7); right in the last box takes it off the list.
// A miss anywhere starts it over. Answering right before the due day changes nothing: it has to stick.
import { missedLog } from './merge.js';

export const WAITS = [1, 3, 7];
export const REVIEW_SIZE = 20;

// Days are counted on the device's calendar, so "tomorrow" starts at midnight wherever she is.
export function addDays(ms, days) {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

// results: [{ id, right }] for every question of a finished round (blank counts as wrong).
// legacy: the plain list of misses kept before the log existed; those come in at time 0, due right away.
// The stamp never goes backwards, which keeps a device with a late clock from being ignored forever.
export function recordRound(log, legacy, results, now) {
  const next = missedLog(log);
  for (const id of legacy ?? []) if (typeof id === 'string' && !next[id]) next[id] = [0, true, 1, 0];
  const latest = Math.max(0, ...Object.values(next).map(([at]) => at));
  const at = Math.max(now, latest + 1);
  for (const { id, right } of results) {
    const entry = next[id];
    if (!right) next[id] = [at, true, 1, addDays(now, WAITS[0])];
    else if (entry?.[1] && entry[3] <= now) next[id] = entry[2] >= WAITS.length ? [at, false, 0, 0] : [at, true, entry[2] + 1, addDays(now, WAITS[entry[2]])];
  }
  return next;
}

// Due questions, the longest overdue first.
export function dueIds(log, now) {
  return Object.entries(missedLog(log)).filter(([, [, on, , due]]) => on && due <= now).sort(([x, a], [y, b]) => a[3] - b[3] || (x < y ? -1 : 1)).map(([id]) => id);
}

// Misses still waiting for their day, and the first day one comes back.
export function waiting(log, now) {
  const later = Object.values(missedLog(log)).filter(([, on, , due]) => on && due > now);
  return { count: later.length, next: later.length ? Math.min(...later.map(([, , , due]) => due)) : null };
}

// What a round did to the review list, for the result screen.
export function roundChanges(before, after, ids) {
  const old = missedLog(before);
  const now = missedLog(after);
  const changes = { up: 0, done: 0, back: 0 };
  for (const id of ids) {
    const was = old[id];
    const is = now[id];
    if (!is || (was && was[0] === is[0])) continue;
    if (!is[1]) { if (was?.[1]) changes.done++; } else if (is[2] === 1) changes.back++;
    else if (was?.[1] && is[2] > was[2]) changes.up++;
  }
  return changes;
}
