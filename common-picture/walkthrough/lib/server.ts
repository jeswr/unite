/**
 * Serves the built demonstration (common-picture/dist) on a free loopback port, the way
 * Vercel does: files as they are, and index.html for any other path (the SPA fallback).
 * /api/* is left unanswered here; the recorder answers /api/feedback in the browser.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

export interface Site {
  url: string;
  stop(): Promise<void>;
}

export async function serveDist(dist: string): Promise<Site> {
  const root = path.resolve(dist);
  if (!existsSync(path.join(root, 'index.html'))) throw new Error(`No build at ${root}. Run "pnpm build" in common-picture first.`);
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    if (pathname.startsWith('/api/')) {
      res.writeHead(404, { 'content-type': 'application/json' }).end('{"ok":false}');
      return;
    }
    let file = path.join(root, path.normalize(pathname));
    if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) file = path.join(root, 'index.html');
    const type = TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'cache-control': file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache' });
    createReadStream(file).pipe(res);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    stop: () => new Promise<void>((r) => server.close(() => r())),
  };
}
