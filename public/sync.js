// Cross-device sync: the progress kept in localStorage is merged with one snapshot on the sync Worker.
// localStorage stays the source of truth; the app works the same without a code or without network.
import { merge, same, normalize, missedIds } from './merge.js';

export { merge, same, normalize };

export const SYNC_URL = 'https://flashcards-sync.andrey59412678.workers.dev';
export const KEYS = {
  code: 'sync.code.v1',
  status: 'sync.status.v1',
  endpoint: 'sync.endpoint',
  history: 'simulado.history.v1',
  seen: 'simulado.seen.v1',
  missed: 'simulado.missed.v1',
  missedLog: 'simulado.missed-log.v1',
  linhasBest: 'linhas.best.v1',
  bests: 'treino.best.v1',
};
// Crockford base32: no i, l, o or u, so a code copied by hand cannot be misread.
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';
const TIMEOUT_MS = 10_000;

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: the merge is lost, nothing else */ }
}

// 20 characters = 100 random bits; shown in groups of four to be copied or typed.
export function newCode(random = crypto.getRandomValues.bind(crypto)) {
  return [...random(new Uint8Array(20))].map(byte => ALPHABET[byte % 32]).join('');
}

export function formatCode(code) {
  return code.match(/.{1,4}/g).join('-');
}

// Accepts dashes, spaces and capitals, and the letters people type for look-alike digits.
export function parseCode(text) {
  const code = String(text ?? '').toLowerCase().replace(/o/g, '0').replace(/[il]/g, '1').replace(/[^0-9a-z]/g, '');
  return code.length === 20 && [...code].every(char => ALPHABET.includes(char)) ? code : null;
}

export function localSnapshot() {
  const log = { ...read(KEYS.missedLog, {}) };
  // Misses saved before the log existed are kept, dated 0 so any real change elsewhere wins.
  for (const id of read(KEYS.missed, [])) if (typeof id === 'string' && !log[id]) log[id] = [0, true];
  return normalize({ history: read(KEYS.history, []), seen: read(KEYS.seen, []), missed: log, linhasBest: read(KEYS.linhasBest, null), bests: read(KEYS.bests, {}) });
}

function writeLocal(snapshot) {
  write(KEYS.history, snapshot.history);
  write(KEYS.seen, snapshot.seen);
  write(KEYS.missedLog, snapshot.missed);
  write(KEYS.missed, missedIds(snapshot.missed));
  if (snapshot.linhasBest) write(KEYS.linhasBest, snapshot.linhasBest);
  write(KEYS.bests, snapshot.bests);
}

export function hasLocalProgress() {
  const local = localSnapshot();
  return local.history.length > 0 || local.seen.length > 0;
}

export function currentCode() {
  return parseCode(read(KEYS.code, null));
}

export function status() {
  return read(KEYS.status, null);
}

function endpoint() {
  // A local Worker (wrangler dev) can be pointed at for testing without touching the code.
  const override = read(KEYS.endpoint, null);
  return typeof override === 'string' && override ? override : SYNC_URL;
}

async function request(code, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${endpoint()}/v1/${code}`, { cache: 'no-store', ...init, signal: controller.signal });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`sync ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

// One sync at a time per page: a sync started while another runs waits for it.
let running = Promise.resolve();

export function syncNow(options) {
  const next = running.then(() => syncOnce(options));
  running = next.catch(() => {});
  return next;
}

// Pull; push this device's snapshot when it has something new (the Worker merges it with what it has and
// returns the result); then merge into whatever this device saved meanwhile. Failures are recorded, never thrown.
async function syncOnce({ code = currentCode(), create = false } = {}) {
  if (!code) return { changed: false, ok: false };
  try {
    let stored = create ? null : await request(code);
    if (stored === null && !create) return { changed: false, ok: false, unknown: true };
    // Writes are the scarce resource on the free plan: push only when this device has something new.
    if (create || !same(merge(localSnapshot(), stored), stored)) {
      stored = await request(code, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(localSnapshot()) });
    }
    // Read the device again right before writing, with no await in between, so nothing saved meanwhile is lost.
    const before = localSnapshot();
    const merged = merge(before, stored ?? {});
    const changed = !same(merged, before);
    if (changed) writeLocal(merged);
    write(KEYS.code, code);
    write(KEYS.status, { at: Date.now(), ok: true });
    return { changed, ok: true };
  } catch {
    write(KEYS.status, { at: Date.now(), ok: false });
    return { changed: false, ok: false };
  }
}

export function disconnect() {
  try {
    localStorage.removeItem(KEYS.code);
    localStorage.removeItem(KEYS.status);
  } catch { /* nothing to undo */ }
}
