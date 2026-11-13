import { fixedClock, type FixedClock } from '@unite/shared';
import type express from 'express';
import { createAi, type AiRequest, type AiResponse, type AiRunner } from '../src/ai/client.js';
import { createApp } from '../src/app.js';
import { loadConfig, type Config } from '../src/config.js';
import type { Deps } from '../src/deps.js';
import { memoryStore } from '../src/store/index.js';

export const TEST_NOW = '2026-11-13T09:00:00.000Z';

/** A fake AI runner: answers from a queue (or a function) and records every request. */
export function fakeRunner(answer: AiResponse[] | ((req: AiRequest) => AiResponse | Promise<AiResponse>)) {
  const requests: AiRequest[] = [];
  const queue = Array.isArray(answer) ? [...answer] : undefined;
  const runner: AiRunner = async (req) => {
    requests.push(req);
    if (queue) {
      const next = queue.shift();
      if (!next) throw new Error('fake runner: no more answers');
      return next;
    }
    return (answer as (req: AiRequest) => AiResponse | Promise<AiResponse>)(req);
  };
  return { runner, requests };
}

export interface TestEnv {
  deps: Deps;
  app: express.Express;
  clock: FixedClock;
  close: () => Promise<void>;
}

/** An app on a fresh in-memory store, a fixed clock and (optionally) a fake AI runner. No network. */
export async function testEnv(opts: { config?: Partial<Config>; runner?: AiRunner } = {}): Promise<TestEnv> {
  const config: Config = {
    ...loadConfig({ NODE_ENV: 'test' }),
    dataDir: 'memory',
    demo: false,
    rateLimits: false,
    anthropicKey: undefined,
    webDist: '/nonexistent',
    ...opts.config,
  };
  const clock = fixedClock(TEST_NOW);
  const store = await memoryStore(clock);
  const ai = createAi({ config, store, clock, runner: opts.runner ?? fakeRunner([]).runner });
  const deps: Deps = { store, clock, ai, config };
  return { deps, app: createApp(deps), clock, close: () => store.close() };
}

/** The value of a Set-Cookie header, for sending back. */
export function cookiesOf(res: { headers: Record<string, unknown> }): string[] {
  const set = res.headers['set-cookie'];
  return (Array.isArray(set) ? set : set ? [String(set)] : []).map((c: string) => c.split(';')[0]!);
}
