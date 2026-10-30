// Sync store for the simulado: one JSON snapshot per sync code, kept in Workers KV.
// The code (100 random bits, made in the browser) is the only key; there are no accounts.
// A PUT is merged with what is stored, so two devices writing at once never erase each other.
import { merge, normalize } from '../../public/merge.js';

const CODE = /^[0-9a-hjkmnp-tv-z]{20}$/;
// 30 rounds with answers, every seen question and the misses log stay well under this.
const MAX_BYTES = 128 * 1024;
// Codes nobody opens for a year disappear; every sync renews the clock.
const TTL_SECONDS = 365 * 24 * 60 * 60;
// Browsers only accept answers for these pages; local dev servers are allowed for testing.
const ORIGINS = ['https://andrey59412678.github.io', 'https://flashcards.apps.home.arpa'];
const LOCAL = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;

function cors(origin) {
  const allowed = origin && (ORIGINS.includes(origin) || LOCAL.test(origin));
  return allowed ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : { Vary: 'Origin' };
}

function reply(status, body, headers) {
  return new Response(body === null ? null : JSON.stringify(body), { status, headers: { ...headers, 'Cache-Control': 'no-store', ...(body === null ? {} : { 'Content-Type': 'application/json' }) } });
}

async function handle(request, env, headers) {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return reply(204, null, headers);
  if (url.pathname === '/health') return reply(200, { ok: true }, headers);
  const match = url.pathname.match(/^\/v1\/([^/]+)$/);
  if (!match || !CODE.test(match[1])) return reply(404, { error: 'not_found' }, headers);
  const key = `sync:${match[1]}`;

  if (request.method === 'GET') {
    const stored = await env.SYNC.get(key, 'json');
    return stored === null ? reply(404, { error: 'unknown_code' }, headers) : reply(200, normalize(stored), headers);
  }

  if (request.method === 'PUT') {
    if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BYTES) return reply(413, { error: 'too_large' }, headers);
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_BYTES) return reply(413, { error: 'too_large' }, headers);
    let data;
    try { data = JSON.parse(text); } catch { return reply(400, { error: 'bad_json' }, headers); }
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.v !== 1) return reply(400, { error: 'bad_snapshot' }, headers);
    const merged = merge(await env.SYNC.get(key, 'json'), data);
    const body = JSON.stringify(merged);
    if (new TextEncoder().encode(body).length > MAX_BYTES) return reply(413, { error: 'too_large' }, headers);
    await env.SYNC.put(key, body, { expirationTtl: TTL_SECONDS });
    return reply(200, merged, headers);
  }

  return reply(405, { error: 'method_not_allowed' }, headers);
}

export default {
  async fetch(request, env) {
    const headers = cors(request.headers.get('Origin'));
    try {
      return await handle(request, env, headers);
    } catch {
      // KV out of daily quota or unavailable: answer with CORS so the app shows "offline" instead of a blank error.
      return reply(503, { error: 'unavailable' }, headers);
    }
  },
};
