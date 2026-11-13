import { afterEach, describe, expect, it } from 'vitest';
import { checkFacilitatorMessage, daysWords, fallbackWording, wordFacilitator } from '../src/ai/facilitator.js';
import { FACILITATOR_FALLBACK, FACILITATOR_FALLBACK_SLOW, FACILITATOR_SLOW_NOTE, FACILITATOR_SYSTEM } from '../src/ai/prompts.js';
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

  describe('in a slow room', () => {
    const slow = { length: '14 days', timeLeft: '13 days left' };
    const slowCtx = { ...ctx, pace: 'slow' as const, timeLeft: '3 days left', length: '5 days' };

    it('has fixed wording for every trigger a live room has, each passing its own check', () => {
      expect(Object.keys(FACILITATOR_FALLBACK_SLOW).sort()).toEqual(Object.keys(FACILITATOR_FALLBACK).sort());
      for (const kind of Object.keys(FACILITATOR_FALLBACK_SLOW)) {
        const text = fallbackWording(kind as never, 'Amina', slow);
        expect(text).not.toMatch(/[{}]/);
        expect(checkFacilitatorMessage(text, kind as never, 'Amina')).toEqual([]);
      }
    });

    it('welcomes with how long the room is open, write before you read, and coming back', () => {
      const text = fallbackWording('welcome', undefined, { length: '5 days', timeLeft: '5 days left' });
      expect(text).toContain('open for 5 days');
      expect(text).toMatch(/write where you stand before you read the others/i);
      expect(text).toMatch(/come back whenever it suits you/i);
      expect(text).toMatch(/AI/);
    });

    it('puts the time left in words', () => {
      expect(fallbackWording('wording', undefined, { length: '5 days', timeLeft: '1 day left' })).toBe(
        '1 day left. Does anyone want to suggest a different wording for the statement?',
      );
      expect(fallbackWording('half_time', undefined, { length: '4 days', timeLeft: '2 days left' })).toMatch(/half way through the time, with 2 days left\./);
      expect(daysWords(5 * 1440)).toBe('5 days');
      expect(daysWords(1440)).toBe('1 day');
    });

    it('tells the model the pace and the time left in words', async () => {
      const fake = fakeRunner([answer('Welcome. This room is open for 5 days, with 3 days left. Write where you stand first.')]);
      env = await testEnv({ config: { anthropicKey: 'test-key' }, runner: fake.runner });
      const out = await wordFacilitator(env.deps, 'welcome', slowCtx);
      expect(out.source).toBe('ai');
      expect(fake.requests[0]!.system).toBe(`${FACILITATOR_SYSTEM}\n\n${FACILITATOR_SLOW_NOTE}`);
      const data = JSON.parse(String(fake.requests[0]!.messages[0]!.content));
      expect(data).toMatchObject({ do: 'welcome', pace: 'slow', time_left: '3 days left', open_for: '5 days' });
      expect(data).not.toHaveProperty('minutes_left');
    });

    it('falls back to the slow wording without a key', async () => {
      env = await testEnv();
      expect(await wordFacilitator(env.deps, 'welcome', slowCtx)).toEqual({ source: 'fallback', text: fallbackWording('welcome', undefined, { length: '5 days', timeLeft: '3 days left' }) });
      expect((await wordFacilitator(env.deps, 'invite', { ...slowCtx, name: 'Bo' })).text).toMatch(/^Bo, we have not read anything from you yet/);
    });

    it('leaves a live room\'s request to the model as it was', async () => {
      const fake = fakeRunner([answer('We are half way through the time.')]);
      env = await testEnv({ config: { anthropicKey: 'test-key' }, runner: fake.runner });
      await wordFacilitator(env.deps, 'half_time', ctx);
      expect(fake.requests[0]!.system).toBe(FACILITATOR_SYSTEM);
      expect(JSON.parse(String(fake.requests[0]!.messages[0]!.content))).toEqual({ do: 'half_time', topic: 'Paid learning hours', minutes_left: 30 });
    });
  });
});
