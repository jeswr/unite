import request from 'supertest';
import { validateInterviewerReply, type MediationView } from '@unite/shared';
import { afterEach, describe, expect, it } from 'vitest';
import type { AiRequest, AiResponse } from '../src/ai/client.js';
import { checkExtracted, extractMediation, fixedQuestion } from '../src/ai/mediator.js';
import { DISTRESS_MESSAGE, MEDIATION_EXTRACT_SYSTEM, MEDIATOR_FIXED, MEDIATOR_SYSTEM } from '../src/ai/prompts.js';
import { fakeRunner, testEnv, type TestEnv } from './helpers.js';
import { answered, othersAnswer, reasonBy, startFor, town, turnOf } from './mediation.fixtures.js';

let env: TestEnv;
/** The environment a test opened, closed after it (the fixed-question tests open none). */
let open: TestEnv | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

const reply = (r: Partial<{ acknowledgement: string; question: string; step_complete: boolean; safety: string }>): AiResponse => ({
  stop_reason: 'end_turn',
  parsed_output: { acknowledgement: '', question: 'What happened then?', step_complete: false, safety: 'ok', ...r },
  usage: { input_tokens: 100, output_tokens: 20 },
});
const extract = (o: { reason: string | null; wording: string | null; question: string | null }): AiResponse => ({
  stop_reason: 'end_turn',
  parsed_output: o,
  usage: { input_tokens: 100, output_tokens: 20 },
});

async function withAi(answer: (req: AiRequest) => AiResponse) {
  const fake = fakeRunner(answer);
  env = open = await testEnv({ config: { anthropicKey: 'test-key' }, runner: fake.runner });
  await town(env);
  return fake;
}

const view = (res: { body: unknown }) => res.body as MediationView;
const mediatorTurns = (v: MediationView) => v.mediation.turns.filter((t) => t.role === 'mediator');

describe('the fixed questions', () => {
  it('two per step, and every one passes the interviewer’s check', () => {
    for (const step of [1, 2, 3, 4]) {
      expect(MEDIATOR_FIXED[step]).toHaveLength(2);
      for (const q of MEDIATOR_FIXED[step]!) expect(validateInterviewerReply({ acknowledgement: '', question: q }, step)).toEqual({ ok: true, failures: [] });
    }
    expect(fixedQuestion(2, 1)).toBe(MEDIATOR_FIXED[2]![1]);
  });
});

describe('rule 9: every mediator reply passes validateInterviewerReply', () => {
  it('asks again with the failure named, then uses the fixed question; the refused reply is never stored', async () => {
    const fake = await withAi(() => reply({ acknowledgement: 'Great answer, I think.', question: 'Have you considered night classes?' }));
    const me = await answered(env);
    const res = await startFor(env, me.cookie);
    expect(res.status).toBe(201);
    const v = view(res);
    expect(fake.requests).toHaveLength(3);
    expect(fake.requests.every((r) => r.system === MEDIATOR_SYSTEM)).toBe(true);
    expect(JSON.stringify(fake.requests[1]!.messages)).toContain('it uses words that judge or steer');
    expect(mediatorTurns(v)).toEqual([expect.objectContaining({ text: MEDIATOR_FIXED[1]![0], fallback: true })]);
    expect(JSON.stringify(v)).not.toContain('Great answer');
    // The AI is still on: one failed reply does not switch the conversation to fixed questions.
    expect(v.mediation.aiUsed).toBe(true);
  });

  it('stores a reply that passes, and moves on when the model says the step is complete', async () => {
    let n = 0;
    await withAi(() => reply({ acknowledgement: 'You said the scanners came in.', question: `What happened next ${++n}?`, step_complete: true }));
    const me = await answered(env);
    const id = view(await startFor(env, me.cookie)).mediation.id;
    expect(view(await request(env.app).get(`/api/mediations/${id}`).set('Cookie', me.cookie)).mediation.turns[0]!.text).toBe(
      'You said the scanners came in. What happened next 1?',
    );
    const v = view(await turnOf(env, me.cookie, id, { text: 'The scanners came in at work.' }));
    // Step 1 needs one answer; the model said complete, so step 2 is skipped (nobody gave a reason) and step 3's question is asked afresh.
    expect(v.mediation.step).toBe(3);
    expect(mediatorTurns(v).at(-1)).toMatchObject({ step: 3, text: 'You said the scanners came in. What happened next 3?' });
    expect(mediatorTurns(v).at(-1)!.fallback).toBeUndefined();
  });

  it('never gives the model the other side’s reasons, only how many were shown', async () => {
    const fake = await withAi(() => reply({ question: 'What is true in those reasons?', step_complete: true }));
    await othersAnswer(env, 'disagree');
    await reasonBy(env, 'ana', 'against', 2, 'Marmalade lighthouses never change.');
    await reasonBy(env, 'ben', 'against', 3, 'Porcupine spreadsheets are a fad.');
    const me = await answered(env);
    const id = view(await startFor(env, me.cookie)).mediation.id;
    const v = view(await turnOf(env, me.cookie, id, { text: 'I lost a job once.' }));
    expect(v.mediation.step).toBe(2);
    expect(v.shownReasons.map((r) => r.text)).toEqual(['Marmalade lighthouses never change.', 'Porcupine spreadsheets are a fad.']);
    await turnOf(env, me.cookie, id, { text: 'They have a point about change.' });
    const sent = JSON.stringify(fake.requests.map((r) => r.messages));
    expect(sent).not.toContain('Marmalade');
    expect(sent).not.toContain('Porcupine');
    expect(sent).toContain('The person was shown 2 reason(s) from people who answered differently. You have not seen them.');
  });

  it('shows the distress message and offers to stop, as the interview does', async () => {
    let calls = 0;
    await withAi(() => reply(++calls === 1 ? { question: 'What is behind your answer?' } : { safety: 'distress', question: 'What happened?' }));
    const me = await answered(env);
    const id = view(await startFor(env, me.cookie)).mediation.id;
    const res = await turnOf(env, me.cookie, id, { text: 'Something very hard.' });
    const v = view(res);
    expect(v.safety).toBe('distress');
    expect(v.pending).toBe('distress');
    expect(mediatorTurns(v).at(-1)!.text).toBe(DISTRESS_MESSAGE);
    expect(view(await turnOf(env, me.cookie, id, { stop: true })).mediation.status).toBe('reviewing');
  });

  it('moves to fixed questions when the AI cannot be used (a spending cap)', async () => {
    const fake = await withAi(() => reply({}));
    await env.deps.store.put('spend', { id: '2026-11-13', usd: 99, calls: 1 });
    const me = await answered(env);
    const v = view(await startFor(env, me.cookie));
    expect(fake.requests).toHaveLength(0);
    expect(v.mediation.aiUsed).toBe(false);
    expect(mediatorTurns(v)[0]!.text).toBe(MEDIATOR_FIXED[1]![0]);
  });
});

describe('extractMediation', () => {
  const turns = [
    { role: 'mediator' as const, step: 1 as const, text: 'Why?' },
    { role: 'person' as const, step: 1 as const, text: 'My shifts change every week so evening classes never work.' },
    { role: 'person' as const, step: 3 as const, text: 'Classes should fit around changing shifts.' },
    { role: 'person' as const, step: 4 as const, text: 'Which employers would give time off?' },
  ];

  it('keeps fields built from the person’s words and replaces any other with the fallback', () => {
    const out = checkExtracted(
      { reason: 'My shifts change every week.', wording: 'Employers must fund all training for everyone in the county.', question: null },
      turns,
    );
    expect(out).toEqual({
      reason: 'My shifts change every week.',
      // Not the person's words: the fallback, their last step 3 turn.
      wording: 'Classes should fit around changing shifts.',
      question: null,
    });
  });

  it('refuses a field over its limit', () => {
    const long = Array(40).fill('shifts').join(' ');
    expect(checkExtracted({ reason: null, wording: long, question: null }, turns).wording).toBe('Classes should fit around changing shifts.');
  });

  it('uses the fallback when the AI is off or fails, and calls the model with the person’s turns only', async () => {
    const fake = fakeRunner([extract({ reason: 'evening classes never work', wording: null, question: 'Which employers would give time off?' })]);
    env = open = await testEnv({ config: { anthropicKey: 'test-key' }, runner: fake.runner });
    const ai = await extractMediation(env.deps, turns, { aiUsed: true });
    expect(ai).toEqual({ source: 'ai', drafts: { reason: 'evening classes never work', wording: null, question: 'Which employers would give time off?' } });
    expect(fake.requests[0]!.system).toBe(MEDIATION_EXTRACT_SYSTEM);
    expect(JSON.stringify(fake.requests[0]!.messages)).not.toContain('Why?');
    const off = await extractMediation(env.deps, turns, { aiUsed: false });
    expect(off).toEqual({
      source: 'fallback',
      drafts: { reason: 'My shifts change every week so evening classes never work.', wording: 'Classes should fit around changing shifts.', question: 'Which employers would give time off?' },
    });
    // The runner has no more answers: the call fails and the fallback is used.
    expect((await extractMediation(env.deps, turns, { aiUsed: true })).source).toBe('fallback');
  });
});
