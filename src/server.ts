import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), '../public');
const port = Number(process.env.PORT ?? 47865);
const host = process.env.HOST ?? '127.0.0.1';
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

// Fail at startup if the initial deck cannot be loaded, rather than serving a broken app.
const initial = JSON.parse(await readFile(resolve(publicDir, 'decks.json'), 'utf8')) as {
  decks: Array<{ cards: unknown[] }>;
};
const cardCount = initial.decks.reduce((sum, deck) => sum + deck.cards.length, 0);
if (!cardCount) throw new Error('No flashcards found');

const server = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'same-origin');
  response.setHeader('X-Frame-Options', 'SAMEORIGIN');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'");
  if (!['GET', 'HEAD'].includes(request.method ?? '')) {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }
  try {
    const rawPath = (request.url ?? '/').split('?')[0];
    const pathname = decodeURIComponent(rawPath);
    if (pathname === '/health') {
      response.writeHead(200, { 'Content-Type': mime['.json'], 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ status: 'ok', app: 'flashcards', cards: cardCount, decks: initial.decks.length }));
      return;
    }
    if (pathname.includes('\0') || pathname.includes('\\')) {
      response.writeHead(400).end();
      return;
    }
    const target = resolve(publicDir, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!target.startsWith(publicDir + sep) || !mime[extname(target)]) {
      response.writeHead(404).end();
      return;
    }
    const file = await stat(target);
    if (!file.isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': mime[extname(target)],
      'Content-Length': file.size,
      'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache',
    });
    response.end(request.method === 'HEAD' ? undefined : await readFile(target));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    response.writeHead(error instanceof URIError ? 400 : code === 'ENOENT' || code === 'ENOTDIR' ? 404 : 500);
    response.end();
  }
});
server.listen(port, host, () => console.log(`flashcards listening on ${host}:${port} (${cardCount} cards)`));
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
