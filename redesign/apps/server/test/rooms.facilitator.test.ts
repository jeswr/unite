import { afterEach, describe, expect, it } from 'vitest';
import { checkFacilitatorMessage, fallbackWording, wordFacilitator } from '../src/ai/facilitator.js';
import { FACILITATOR_FALLBACK, FACILITATOR_SYSTEM } from '../src/ai/prompts.js';
import { fakeRunner, testEnv, type TestEnv } from './helpers.js';

const answer = (message: string) => ({ stop_reason: 'end_turn', parsed_output: { message }, usage: { input_tokens: 10, output_tokens: 10 } });
const ctx = { topic: 'Paid learning hours', minutesLeft: 30 };

let env: TestEnv | undefined;
afterEach(async () => {
  await env?.close();
  env = undefined;
});

describe('facilitator wording', () => {
  it('checks the banned phrases, the length and the name', () => {
    expect(checkFacilitatorMessage('We are half way through the time.', 'half_time')).toEqual([]);
    expect(checkFacilitatorMessage('Great point. Many people agree.', 'make_room').join(' ')).toMatch(/"great".*"many people"/);
    expect(checkFacilitatorMessage(Array(41).fill('word').join(' '), 'half_time')[0]).toMatch(/41 words/);
    expect(checkFacilitatorMessage('Would you like to add anything?', 'invite', 'Amina')[0]).toMatch(/display name/);
  });

  it('every fixed wording passes its own check', () => {
    for (const kind of Object.keys(FACILITATOR_FALLBACK) as (keyof typeof FACILITATOR_FALLBACK & string)[])
      expect(checkFacilitatorMessage(fallbackWording(kind as never, 'Amina'), kind as never, 'Amina')).toEqual([]);
  });

  it('uses the model wording when it passes, with the facilitator prompt', async () => {
    const fake = fakeRunner([answer('Amina, we have not heard from you yet. Would you like to add something? You can pass.')]);
    env = await testEnv({ config: { anthropicKey: 'test-key' }, runner: fake.runner });
    const out = await wordFacilitator(env.deps, 'invite', { ...ctx, name: 'Amina' });
    expect(out).toEqual({ source: 'ai', text: 'Amina, we have not heard from you yet. Would you like to add something? You can pass.' });
    expect(fake.requests[0]!.system).toBe(FACILITATOR_SYSTEM);
    expect(JSON.parse(String(fake.requests[0]!.messages[0]!.content))).toMatchObject({ do: 'invite', name: 'Amina', minutes_left: 30 });
  });

  it('falls back to the fixed wording when the model steers', async () => {
    const fake = fakeRunner([answer('Great point, Amina. I think the room agrees.')]);
    env = await testEnv({ config: { anthropicKey: 'test-key' }, runner: fake.runner });
    const out = await wordFacilitator(env.deps, 'invite', { ...ctx, name: 'Amina' });
    expect(out.source).toBe('fallback');
    expect(out.text).toBe('Amina, we have not heard from you yet. Would you like to add anything? It is fine to pass.');
  });

  it('falls back when the model refuses or fails, and without a key', async () => {
    const fake = fakeRunner([{ stop_reason: 'refusal', usage: { input_tokens: 1, output_tokens: 1 } }]);
    env = await testEnv({ config: { anthropicKey: 'test-key' }, runner: fake.runner });
    expect(await wordFacilitator(env.deps, 'half_time', ctx)).toEqual({ source: 'fallback', text: FACILITATOR_FALLBACK.half_time });
    expect(await wordFacilitator(env.deps, 'final', ctx)).toEqual({ source: 'fallback', text: FACILITATOR_FALLBACK.final });
    await env.close();
    env = await testEnv();
    expect(await wordFacilitator(env.deps, 'welcome', ctx)).toEqual({ source: 'fallback', text: FACILITATOR_FALLBACK.welcome });
  });
});
