import http from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import { createHandler } from '../src/vercel.js';

const PROD = { NODE_ENV: 'production', UNITE_SECRET: 's3cret' };

describe('production configuration', () => {
  it('needs the passcodes when demo mode is off', () => {
    expect(() => loadConfig(PROD)).toThrow('UNITE_HOST_CODE must be set in production.');
    expect(() => loadConfig({ ...PROD, UNITE_DEMO: '1' }).secret).not.toThrow();
    expect(() => loadConfig({ NODE_ENV: 'production', UNITE_DEMO: '1' })).toThrow('UNITE_SECRET must be set in production.');
  });

  it('in demo mode uses the public demo passcodes the role switcher sends, unless others are set', () => {
    const c = loadConfig({ ...PROD, UNITE_DEMO: '1' });
    expect(c).toMatchObject({ production: true, demo: true, hostCode: 'host', stewardCode: 'steward', testRoutes: false });
    expect(loadConfig({ ...PROD, UNITE_DEMO: '1', UNITE_HOST_CODE: 'h2' }).hostCode).toBe('h2');
  });

  it('reads the Blob token', () => {
    expect(loadConfig({ BLOB_READ_WRITE_TOKEN: ' tok ' }).blobToken).toBe('tok');
    expect(loadConfig({}).blobToken).toBeUndefined();
  });
});

describe('the Vercel handler', () => {
  const saved = { ...process.env };
  let server: http.Server | undefined;
  afterEach(() => {
    process.env = { ...saved };
    server?.close();
    server = undefined;
    vi.restoreAllMocks();
  });

  const serve = () => {
    server = http.createServer(createHandler());
    return new Promise<string>((resolve) => server!.listen(0, () => resolve(`http://127.0.0.1:${(server!.address() as AddressInfo).port}`)));
  };

  it('refuses to start without DATABASE_URL when demo mode is off', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env = { ...saved, ...PROD, UNITE_HOST_CODE: 'h', UNITE_STEWARD_CODE: 's', UNITE_DEMO: '0', DATABASE_URL: '' };
    const res = await request(await serve()).get('/api/me');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('starting');
  });

  it('in demo mode with no DATABASE_URL runs on a seeded in-memory store, and the role switcher works', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    process.env = { ...saved, ...PROD, UNITE_DEMO: '1', DATABASE_URL: '', UNITE_DATA_DIR: '/nonexistent-should-not-be-used' };
    const agent = request.agent(await serve());
    const me = await agent.get('/api/me');
    expect(me.status).toBe(200);
    expect(me.body.demo).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('in memory'));
    const list = await agent.get('/api/assemblies');
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).toContain('isExample');
    const role = await agent.post('/api/role').send({ role: 'steward', code: 'steward' });
    expect(role.status).toBe(200);
    // The cookie is Secure in production; supertest's agent does not send it over http, so check the header.
    expect(String(role.headers['set-cookie'])).toMatch(/unite_role=.*Secure/);
  }, 60_000);
});

describe('the Vercel entry', () => {
  it('names every package the server and shared code import, so file tracing includes them', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const root = path.resolve(import.meta.dirname, '../../..');
    const namedIn = (file: string) => new Set([...fs.readFileSync(path.join(root, file), 'utf8').matchAll(/import\('([^.'][^']*)'\)/g)].map((m) => m[1]));
    const usedIn = (dir: string) => {
      const used = new Set<string>();
      for (const file of fs.readdirSync(path.join(root, dir), { recursive: true, encoding: 'utf8' })) {
        if (!file.endsWith('.ts')) continue;
        const text = fs.readFileSync(path.join(root, dir, file), 'utf8');
        for (const m of text.matchAll(/(?:^import (?!type )[^;]*?from|import\()\s*'([^.'][^']*)'/gm)) if (!m[1]!.startsWith('node:')) used.add(m[1]!);
      }
      return used;
    };
    for (const [dir, hints] of [
      ['apps/server/src', 'apps/server/vercel-entry.mjs'],
      ['packages/shared/src', 'packages/shared/vercel-trace.mjs'],
    ] as const) {
      const used = usedIn(dir);
      const named = namedIn(hints);
      expect(used.size, dir).toBeGreaterThan(0);
      expect([...used].filter((u) => !named.has(u)), `${hints} is missing`).toEqual([]);
    }
  });
});
