import Anthropic from '@anthropic-ai/sdk';
import { fixedClock } from '@unite/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { costOf, createAi } from '../src/ai/client.js';
import { memoryStore } from '../src/store/index.js';
import { fakeRunner } from './helpers.js';

const Schema = z.object({ answer: z.string() });
const config = { anthropicKey: 'test-key', model: 'claude-opus-5-5', aiDailyUsd: 5, aiMonthlyUsd: 40 };

async function setup(runner: ReturnType<typeof fakeRunner>['runner'], overrides: Partial<typeof config> = {}) {
  const clock = fixedClock('2026-11-13T09:00:00Z');
  const store = await memoryStore(clock);
  return { store, clock, ai: createAi({ config: { ...config, ...overrides }, store, clock, runner }) };
}
const call = (ai: Awaited<ReturnType<typeof setup>>['ai']) =>
  ai.withAi(
    'test',
    (c) => c.parse({ schema: Schema, system: 'SYSTEM', messages: [{ role: 'user', content: 'hello' }] }).then((o) => o.answer),
    () => 'fallback',
  );

describe('withAi', () => {
  it('uses the fallback with no key, without calling the runner', async () => {
    const f = fakeRunner([]);
    const { ai } = await setup(f.runner, { anthropicKey: undefined });
    expect(await call(ai)).toEqual({ value: 'fallback', source: 'fallback', reason: 'no_key' });
    expect(f.requests).toHaveLength(0);
    expect(ai.enabled).toBe(false);
  });

  it('sends exactly the allowed request shape and records the estimated spend', async () => {
    const f = fakeRunner([{ stop_reason: 'end_turn', parsed_output: { answer: 'yes' }, usage: { input_tokens: 1_000_000, output_tokens: 100_000 } }]);
    const { ai, store } = await setup(f.runner);
    expect(await call(ai)).toEqual({ value: 'yes', source: 'ai' });
    const req = f.requests[0]!;
    expect(Object.keys(req).sort()).toEqual(['max_tokens', 'messages', 'model', 'output_config', 'system']);
    expect(req.model).toBe('claude-opus-5-5');
    expect(req.max_tokens).toBe(16000);
    expect(req.system).toBe('SYSTEM');
    expect(Object.keys(req.output_config).sort()).toEqual(['effort', 'format']);
    expect(req.output_config.effort).toBe('low');
    expect(await store.get('spend', '2026-11-13')).toEqual({ id: '2026-11-13', usd: 6, calls: 1 });
  });

  it('prices input at $4 and output at $20 a million tokens', () => {
    expect(costOf({ input_tokens: 500_000, output_tokens: 50_000 })).toBeCloseTo(3);
  });

  it('falls back once the daily cap is reached', async () => {
    const f = fakeRunner([]);
    const { ai, store } = await setup(f.runner);
    await store.put('spend', { id: '2026-11-13', usd: 5, calls: 10 });
    expect(await call(ai)).toMatchObject({ value: 'fallback', reason: 'cap' });
    expect(f.requests).toHaveLength(0);
  });

  it('falls back once the monthly cap is reached', async () => {
    const f = fakeRunner([]);
    const { ai, store } = await setup(f.runner);
    await store.put('spend', { id: '2026-11-01', usd: 20, calls: 10 });
    await store.put('spend', { id: '2026-11-02', usd: 20, calls: 10 });
    await store.put('spend', { id: '2026-10-31', usd: 39, calls: 10 });
    expect(await call(ai)).toMatchObject({ reason: 'cap' });
    expect((await ai.spending()).month).toBe(40);
  });

  it('falls back on a refusal or no parsed output, still recording the cost', async () => {
    const f = fakeRunner([
      { stop_reason: 'refusal', parsed_output: null, usage: { input_tokens: 10, output_tokens: 0 } },
      { stop_reason: 'end_turn', parsed_output: null, usage: { input_tokens: 10, output_tokens: 10 } },
    ]);
    const { ai, store } = await setup(f.runner);
    expect(await call(ai)).toMatchObject({ value: 'fallback', reason: 'refusal' });
    expect(await call(ai)).toMatchObject({ value: 'fallback', reason: 'refusal' });
    expect((await store.get('spend', '2026-11-13'))?.calls).toBe(2);
  });

  it('falls back on any error, including the SDK’s typed errors', async () => {
    const errors = [new Error('network down'), new Anthropic.RateLimitError(429, undefined, 'slow down', new Headers())];
    for (const e of errors) {
      const { ai } = await setup(async () => {
        throw e;
      });
      expect(await call(ai)).toMatchObject({ value: 'fallback', source: 'fallback', reason: 'error' });
    }
  });
});
