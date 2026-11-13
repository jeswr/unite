/**
 * Boots a fresh, offline Unite for a recording: the production server from apps/server,
 * serving the built web app and the API from one origin, on a free port. It runs on an
 * in-memory store seeded with the example assemblies, with the clock fixed and no AI key
 * (so the interviewer asks its fixed questions and the `ai` feature is off).
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** The `redesign/` folder. */
export const ROOT = path.resolve(import.meta.dirname, '..', '..');

/** "Now", as far as the recorded app and browser are concerned, so dates on screen never drift. */
export const EPOCH = '2026-11-13T09:00:00Z';

export interface Unite {
  url: string;
  /** Signs a session cookie value, so the recording can act as a seeded person through the app's own endpoints. */
  secret: string;
  /** Opens the live-room fixture (see unite-server.ts). */
  fixtureToken: string;
  stop(): void;
}

/** The value of a signed cookie as cookie-parser checks it ("s:" + value + "." + HMAC-SHA256, base64 without padding). */
export function signCookie(value: string, secret: string): string {
  return `s:${value}.${createHmac('sha256', secret).update(value).digest('base64').replace(/=+$/, '')}`;
}

/** A port nothing is listening on right now. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const port = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(port));
    });
  });
}

async function waitFor(url: string, ms: number, proc: ChildProcess, log: () => string) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (proc.exitCode !== null) throw new Error(`Unite exited early (${proc.exitCode}).\n${log().slice(-2000)}`);
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timed out waiting for ${url}.\n${log().slice(-2000)}`);
}

/** The environment the recorded server runs with (exported for the tests). */
export function serverEnv(port: number, base: NodeJS.ProcessEnv = process.env, keys: { secret?: string; fixtureToken?: string } = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...base,
    PORT: String(port),
    // A secret of this run's own, so the recording can sign the session of a seeded person.
    ...(keys.secret ? { UNITE_SECRET: keys.secret } : {}),
    ...(keys.fixtureToken ? { WALKTHROUGH_FIXTURE_TOKEN: keys.fixtureToken } : {}),
    UNITE_DATA_DIR: 'memory',
    UNITE_DEMO: '1',
    UNITE_NOW: EPOCH,
    // No AI key, so the interviewer is in fixed-question mode and nothing leaves the machine.
    ANTHROPIC_API_KEY: '',
    // The same ids on every recording, and Node's own clock starting at EPOCH (see deterministic.mjs).
    NODE_OPTIONS: `${base.NODE_OPTIONS ?? ''} --import ${pathToFileURL(path.join(import.meta.dirname, 'deterministic.mjs')).href}`.trim(),
    WALKTHROUGH_EPOCH: EPOCH,
    WALKTHROUGH_SEED: 'unite-walkthrough',
  };
  // A recording is never a production server, and never talks to a real database.
  delete env.NODE_ENV;
  delete env.DATABASE_URL;
  return env;
}

/** Builds the web app if there is no build yet. */
export function ensureBuilt(log: (s: string) => void = () => {}) {
  if (existsSync(path.join(ROOT, 'apps/web/dist/index.html'))) return;
  log('Building the web app…');
  const r = spawnSync('pnpm', ['--filter', '@unite/web', 'build'], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) throw new Error('Building the web app failed');
}

export async function startUnite(o: { log?: (s: string) => void } = {}): Promise<Unite> {
  ensureBuilt(o.log);
  const port = await freePort();
  let out = '';
  const secret = randomBytes(24).toString('hex');
  const fixtureToken = randomBytes(24).toString('hex');
  // The app's own server, plus the live-room fixture (unite-server.ts), run with the server's tsx.
  const proc = spawn('pnpm', ['--filter', '@unite/server', 'exec', 'tsx', path.join(import.meta.dirname, 'unite-server.ts')], {
    cwd: ROOT,
    env: serverEnv(port, process.env, { secret, fixtureToken }),
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  proc.stdout!.on('data', (d) => (out += d));
  proc.stderr!.on('data', (d) => (out += d));
  const stop = () => {
    try {
      process.kill(-proc.pid!, 'SIGTERM');
    } catch {
      /* gone */
    }
  };
  process.on('exit', stop);
  const url = `http://localhost:${port}`;
  try {
    await waitFor(`${url}/healthz`, 120_000, proc, () => out);
  } catch (e) {
    stop();
    throw e;
  }
  return { url, secret, fixtureToken, stop };
}
