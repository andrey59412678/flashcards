import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../sync-worker/src/index.js';
import { merge, normalize, missedIds } from '../public/merge.js';
import { recordRound } from '../public/srs.js';
import { newCode, formatCode, parseCode, syncNow, localSnapshot, KEYS } from '../public/sync.js';

const round = (at, extra = {}) => ({ at, kind: 'exam', correct: 20, total: 30, passed: true, ...extra });

function fakeKv() {
  const data = new Map();
  return { data, get: async (key, type) => { const value = data.get(key) ?? null; return value !== null && type === 'json' ? JSON.parse(value) : value; }, put: async (key, value, options) => { data.set(key, value); data.set(`${key}#ttl`, options?.expirationTtl); } };
}

function fakeStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key), data };
}

const ORIGIN = 'https://andrey59412678.github.io';
const connect = env => { globalThis.fetch = async (url, init = {}) => worker.fetch(new Request(url, { ...init, headers: { ...init.headers, Origin: ORIGIN } }), env); };
const device = () => { const storage = fakeStorage(); return () => { globalThis.localStorage = storage; return storage; }; };

test('codes avoid look-alike characters and survive dashes, spaces, capitals and o/0, l/1 mix-ups', () => {
  const code = newCode();
  assert.match(code, /^[0-9a-hjkmnp-tv-z]{20}$/);
  assert.notEqual(newCode(), code);
  assert.equal(parseCode(` ${formatCode(code).toUpperCase()} `), code);
  assert.equal(parseCode('1o1o-abcd-efgh-jkmn-pqrs'), parseCode('l0I0 ABCD EFGH JKMN PQRS'));
  assert.equal(parseCode('abc'), null);
  assert.equal(parseCode('uuuu-uuuu-uuuu-uuuu-uuuu'), null);
});

test('rounds and seen questions are united; best drill score is kept', () => {
  const merged = merge(
    { history: [round(3), round(1)], seen: ['a', 'b'], linhasBest: { correct: 9, total: 12 } },
    { history: [round(2), round(1, { review: { ids: [] } })], seen: ['b', 'c'], linhasBest: { correct: 11, total: 12 } },
  );
  assert.deepEqual(merged.history.map(entry => entry.at), [3, 2, 1]);
  assert.ok(merged.history[2].review, 'the copy that can be reopened wins');
  assert.deepEqual(merged.seen, ['a', 'b', 'c']);
  assert.deepEqual(merged.linhasBest, { correct: 11, total: 12 });
  assert.equal(merge({ history: Array.from({ length: 40 }, (_, i) => round(i)) }, {}).history.length, 30);
});

test('misses merge question by question, so no device loses a miss or brings back a fixed one', () => {
  // Two devices with their own lists join: both lists survive (the reviewed "join" data loss).
  assert.deepEqual(missedIds(merge({ missed: { b1: [0, true], b2: [0, true] } }, { missed: { a1: [100, true] } }).missed).sort(), ['a1', 'b1', 'b2']);
  // Offline misses on two devices at different times: both kept.
  assert.deepEqual(missedIds(merge({ missed: { old: [1, true], e: [3000, true] } }, { missed: { old: [1, true], f: [4000, true] } }).missed), ['e', 'f', 'old']);
  // Fixed later on one device: stays fixed everywhere, whatever the merge order.
  const fixed = { missed: { q: [500, false] } };
  const missedBefore = { missed: { q: [200, true] } };
  assert.deepEqual(missedIds(merge(fixed, missedBefore).missed), []);
  assert.deepEqual(merge(fixed, missedBefore), merge(missedBefore, fixed));
  // Same stamp on both devices: the miss wins, then the full entry over the copy an old app version strips.
  const a = { missed: { t: [7, true, 2, 50] } };
  const b = { missed: { t: [7, true] } };
  assert.deepEqual(merge(a, b), merge(b, a));
  assert.deepEqual(merge(a, b).missed.t, [7, true, 2, 50]);
  assert.deepEqual(merge({ missed: { t: [7, false] } }, b).missed.t, [7, true, 1, 0]);
});

test('drill bests are kept per drill, the best rate winning from either side', () => {
  const x = { bests: { numeros: { correct: 9, total: 12 }, socorro: { correct: 3, total: 6 } } };
  const y = { bests: { numeros: { correct: 11, total: 12 }, preferencia: { correct: 6, total: 8 }, socorro: { correct: 6, total: 12 } } };
  assert.deepEqual(merge(x, y).bests, { numeros: { correct: 11, total: 12 }, preferencia: { correct: 6, total: 8 }, socorro: { correct: 6, total: 12 } });
  assert.deepEqual(merge(x, y), merge(y, x));
});

test('recording a round dates only what changed and never stamps backwards', () => {
  const first = recordRound({}, ['legacy'], [{ id: 'new', right: false }], 1000);
  assert.deepEqual(first.legacy, [0, true, 1, 0]);
  assert.equal(first.new[0], 1000);
  const late = recordRound({ x: [9000, true, 3, 0] }, [], [{ id: 'x', right: true }], 5000);
  assert.deepEqual(late.x, [9001, false, 0, 0], 'a device with a late clock still wins over its own past');
  assert.deepEqual(recordRound(first, [], [{ id: 'other', right: true }], 2000), first, 'an unrelated round changes nothing');
});

test('a damaged snapshot is cleaned instead of breaking the merge', () => {
  const clean = normalize({ history: [null, 3, round(1), { at: 'x' }], seen: 'nope', missed: { a: [1, true], b: 'x', c: [1], d: [2, true, 9, 'x'], e: [3, false, 2, 5] }, linhasBest: { correct: 'x' }, bests: { numeros: { correct: 3, total: 4 }, 'X!': { correct: 1, total: 1 }, socorro: { correct: 1, total: 0 } } });
  assert.deepEqual(clean, { v: 1, history: [round(1)], seen: [], missed: { a: [1, true, 1, 0], d: [2, true, 1, 0], e: [3, false, 0, 0] }, linhasBest: null, bests: { numeros: { correct: 3, total: 4 } } });
});

test('the worker merges every write with what it has, and answers only the app origins', async () => {
  const env = { SYNC: fakeKv() };
  const code = newCode();
  const call = (method, body, origin = ORIGIN, path = `/v1/${code}`) => worker.fetch(new Request(`https://w.dev${path}`, { method, body, headers: { Origin: origin } }), env);
  assert.equal((await call('GET')).status, 404);
  const first = await call('PUT', JSON.stringify({ v: 1, history: [round(1)] }));
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.equal(env.SYNC.data.get(`sync:${code}#ttl`), 365 * 24 * 60 * 60);
  // A second device writes without having seen the first: nothing is erased.
  const second = await (await call('PUT', JSON.stringify({ v: 1, history: [round(2)] }))).json();
  assert.deepEqual(second.history.map(entry => entry.at), [2, 1]);
  assert.deepEqual((await (await call('GET')).json()).history.map(entry => entry.at), [2, 1]);
  assert.equal((await call('GET', undefined, 'https://evil.example')).headers.get('Access-Control-Allow-Origin'), null);
  assert.equal((await call('PUT', '{"v":2}')).status, 400);
  assert.equal((await call('PUT', 'not json')).status, 400);
  assert.equal((await call('PUT', JSON.stringify({ v: 1, pad: 'x'.repeat(200_000) }))).status, 413);
  assert.equal((await call('GET', undefined, ORIGIN, '/v1/uuuuuuuuuuuuuuuuuuuu')).status, 404);
  assert.equal((await call('DELETE')).status, 405);
  const broken = await worker.fetch(new Request(`https://w.dev/v1/${code}`, { headers: { Origin: ORIGIN } }), { SYNC: { get: async () => { throw new Error('quota'); } } });
  assert.equal(broken.status, 503);
  assert.equal(broken.headers.get('Access-Control-Allow-Origin'), ORIGIN, 'errors still reach the app');
});

test('two devices end up with the same progress, offline never loses data, and a round saved mid-sync survives', async () => {
  const env = { SYNC: fakeKv() };
  connect(env);
  const phone = device();
  const laptop = device();

  phone().setItem(KEYS.history, JSON.stringify([round(100)]));
  phone().setItem(KEYS.missed, JSON.stringify(['legacy-phone']));
  const code = newCode();
  assert.equal((await syncNow({ code, create: true })).ok, true);

  laptop().setItem(KEYS.history, JSON.stringify([round(200)]));
  laptop().setItem(KEYS.missed, JSON.stringify(['legacy-laptop']));
  assert.equal((await syncNow({ code: newCode() })).unknown, true, 'a mistyped code is not created silently');
  const joined = await syncNow({ code });
  assert.equal(joined.ok, true);
  assert.deepEqual(localSnapshot().history.map(entry => entry.at), [200, 100]);
  assert.deepEqual(JSON.parse(laptop().getItem(KEYS.missed)).sort(), ['legacy-laptop', 'legacy-phone']);

  phone();
  await syncNow();
  assert.deepEqual(localSnapshot().history.map(entry => entry.at), [200, 100]);
  assert.deepEqual(JSON.parse(phone().getItem(KEYS.missed)).sort(), ['legacy-laptop', 'legacy-phone']);

  // A round finished while the pull is still in flight is not overwritten by the late answer.
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  globalThis.fetch = async (url, init = {}) => { await gate; return worker.fetch(new Request(url, { ...init, headers: { ...init.headers, Origin: ORIGIN } }), env); };
  const pending = syncNow();
  phone().setItem(KEYS.history, JSON.stringify([round(300), round(200), round(100)]));
  release();
  await pending;
  connect(env);
  await syncNow();
  assert.deepEqual(localSnapshot().history.map(entry => entry.at), [300, 200, 100]);
  laptop();
  await syncNow();
  assert.deepEqual(localSnapshot().history.map(entry => entry.at), [300, 200, 100], 'and it reaches the other device');

  globalThis.fetch = async () => { throw new Error('offline'); };
  phone();
  assert.equal((await syncNow()).ok, false);
  assert.equal(JSON.parse(phone().getItem(KEYS.status)).ok, false);
  assert.deepEqual(localSnapshot().history.map(entry => entry.at), [300, 200, 100], 'offline never loses local data');
});

test('a sync with nothing new does not spend a write', async () => {
  const env = { SYNC: fakeKv() };
  let puts = 0;
  globalThis.fetch = async (url, init = {}) => { if (init.method === 'PUT') puts++; return worker.fetch(new Request(url, { ...init, headers: { ...init.headers, Origin: ORIGIN } }), env); };
  device()().setItem(KEYS.history, JSON.stringify([round(1)]));
  const code = newCode();
  await syncNow({ code, create: true });
  await syncNow();
  await syncNow();
  assert.equal(puts, 1);
});
