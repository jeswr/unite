import request from 'supertest';
import { MEDIATION_LIMITS, stableId, type MediationView, type StatementDetail } from '@unite/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MEDIATOR_FIXED, MEDIATOR_NO_OTHER_SIDE } from '../src/ai/prompts.js';
import { makeStatement } from '../src/seed/builders.js';
import { testEnv, type TestEnv } from './helpers.js';
import { answered, othersAnswer, reasonBy, S1, startFor, STATEMENT_TEXT, town, turnOf } from './mediation.fixtures.js';
import { asRole, ctxOf, newPerson, pid, TOWN } from './picture.fixtures.js';

let env: TestEnv;
beforeEach(async () => {
  env = await testEnv();
  await town(env);
});
afterEach(() => env.close());

const view = (res: { body: unknown }) => res.body as MediationView;
const lastMediator = (v: MediationView) => [...v.mediation.turns].reverse().find((t) => t.role === 'mediator')!;
const detail = async (cookie: string[]) => (await request(env.app).get(`/api/statements/${S1}`).set('Cookie', cookie)).body as StatementDetail;

/** Answers each step in turn: two answers in steps 1 to 3, one in step 4. */
async function talkThrough(cookie: string[], id: string, answers: Record<number, string[]>) {
  let v: MediationView | undefined;
  for (let guard = 0; guard < 12; guard++) {
    const current = v ?? view(await request(env.app).get(`/api/mediations/${id}`).set('Cookie', cookie));
    if (current.mediation.status !== 'active') return current;
    const step = current.mediation.step;
    const given = current.mediation.turns.filter((t) => t.role === 'person' && t.step === step).length;
    const text = answers[step]?.[given] ?? 'Nothing.';
    const res = await turnOf(env, cookie, id, { text });
    expect(res.status).toBe(200);
    v = view(res);
  }
  return v!;
}

describe('who may start one', () => {
  it('refuses someone who has not been heard (rule 1)', async () => {
    const { cookie } = await newPerson(env);
    const res = await startFor(env, cookie);
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: { code: 'not_heard' } });
    expect(await env.deps.store.count('mediations')).toBe(0);
  });

  it('asks a person to answer the statement first', async () => {
    const { heardPerson } = await import('./picture.fixtures.js');
    const me = await heardPerson(env);
    const res = await startFor(env, me.cookie);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: 'answer_first', message: 'Answer the statement first, then talk it through.' } });
  });

  it('refuses a retired or decided statement', async () => {
    const me = await answered(env);
    for (const status of ['retired', 'decided'] as const) {
      const st = await env.deps.store.get('statements', S1);
      await env.deps.store.put('statements', { ...st!, status });
      const res = await startFor(env, me.cookie);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatchObject({ code: 'statement_closed' });
    }
    expect(await env.deps.store.count('mediations')).toBe(0);
  });

  it('starts on fixed questions without an AI key, and starting again returns the same one', async () => {
    const me = await answered(env, 'disagree');
    const first = await startFor(env, me.cookie);
    expect(first.status).toBe(201);
    const m = view(first).mediation;
    expect(m).toMatchObject({ status: 'active', step: 1, answer: 'disagree', aiUsed: false, shownReasonIds: [], drafts: {} });
    expect(m.turns).toEqual([expect.objectContaining({ role: 'mediator', step: 1, text: MEDIATOR_FIXED[1]![0], fallback: true })]);
    expect(view(first).statement).toMatchObject({ id: S1, text: STATEMENT_TEXT });
    const again = await startFor(env, me.cookie);
    expect(again.status).toBe(200);
    expect(view(again).mediation.id).toBe(m.id);
    expect(await env.deps.store.count('mediations')).toBe(1);
  });
});

describe('the steps', () => {
  it('shows the other side’s reasons at step 2, chosen by arrival and distinct author (rule 8), then reviews', async () => {
    await othersAnswer(env, 'disagree');
    await reasonBy(env, 'ana', 'against', 5, 'Ana later reason against');
    await reasonBy(env, 'ben', 'against', 3, 'Ben reason against');
    await reasonBy(env, 'ana', 'against', 2, 'Ana first reason against');
    await reasonBy(env, 'cat', 'for', 1, 'Cat reason for');
    await reasonBy(env, 'cat', 'question', 1, 'Cat question');
    const me = await answered(env, 'agree');
    const id = view(await startFor(env, me.cookie)).mediation.id;

    let v = view(await turnOf(env, me.cookie, id, { text: 'My nephew lost his warehouse job when the scanners came in.' }));
    expect(v.mediation.step).toBe(1);
    expect(lastMediator(v).text).toBe(MEDIATOR_FIXED[1]![1]);
    v = view(await turnOf(env, me.cookie, id, { text: 'He would have kept it if he had been shown how.' }));
    expect(v.mediation.step).toBe(2);
    expect(v.shownReasons.map((r) => r.text)).toEqual(['Ana first reason against', 'Ben reason against']);
    expect(lastMediator(v).text).toBe(MEDIATOR_FIXED[2]![0]);

    v = await talkThrough(me.cookie, id, {
      2: ['They are right that the tools change.', 'They leave out the people already losing work.'],
      3: ['People should learn tools that help them keep their jobs.', 'Everyone should be offered a short course in checking AI tools at work.'],
      4: ['Who would pay for the courses?'],
    });
    expect(v.mediation.status).toBe('reviewing');
    expect(v.mediation.drafts).toEqual({
      reason: 'My nephew lost his warehouse job when the scanners came in.',
      reasonSide: 'for',
      wording: 'Everyone should be offered a short course in checking AI tools at work.',
      question: 'Who would pay for the courses?',
    });
  });

  it('skips step 2 with a fixed line when nobody who answered differently has given a reason', async () => {
    await reasonBy(env, 'cat', 'for', 1, 'Cat reason for, on my own side');
    const me = await answered(env, 'agree');
    const id = view(await startFor(env, me.cookie)).mediation.id;
    await turnOf(env, me.cookie, id, { text: 'It mattered when I lost my job.' });
    const v = view(await turnOf(env, me.cookie, id, { text: 'Nobody showed me the new system.' }));
    expect(v.mediation.step).toBe(3);
    expect(v.shownReasons).toEqual([]);
    const lines = v.mediation.turns.filter((t) => t.role === 'mediator').slice(-2);
    expect(lines[0]).toMatchObject({ step: 2, text: MEDIATOR_NO_OTHER_SIDE, skipped: true });
    expect(lines[1]).toMatchObject({ step: 3, text: MEDIATOR_FIXED[3]![0] });
  });

  it('"Skip this" moves on a step; "Stop here and review" goes to the review at once', async () => {
    const me = await answered(env, 'agree');
    const id = view(await startFor(env, me.cookie)).mediation.id;
    let v = view(await turnOf(env, me.cookie, id, { skip: true }));
    expect(v.mediation.step).toBe(3); // step 2 has nothing to show either
    expect(v.mediation.turns.find((t) => t.role === 'person')).toMatchObject({ step: 1, text: '', skipped: true });
    await turnOf(env, me.cookie, id, { text: 'Courses for people already in work.' });
    v = view(await turnOf(env, me.cookie, id, { stop: true }));
    expect(v.mediation.status).toBe('reviewing');
    // Step 1 was skipped, so there is no reason; the wording is the person's own words.
    expect(v.mediation.drafts).toEqual({ wording: 'Courses for people already in work.' });
    const after = await turnOf(env, me.cookie, id, { text: 'more' });
    expect(after.status).toBe(409);
    expect(after.body.error.code).toBe('not_active');
  });

  it('refuses a turn over 1,200 characters', async () => {
    const me = await answered(env);
    const id = view(await startFor(env, me.cookie)).mediation.id;
    const res = await turnOf(env, me.cookie, id, { text: 'x'.repeat(MEDIATION_LIMITS.turn + 1) });
    expect(res.status).toBe(400);
    expect((await turnOf(env, me.cookie, id, { text: 'x'.repeat(MEDIATION_LIMITS.turn) })).status).toBe(200);
  });
});

describe('the review and approval', () => {
  async function reviewing(answer: 'agree' | 'disagree' | 'unsure' = 'agree') {
    const me = await answered(env, answer);
    const id = view(await startFor(env, me.cookie)).mediation.id;
    const v = await talkThrough(me.cookie, id, {
      1: ['Night classes let me keep my shift.', 'I could not have trained otherwise.'],
      3: ['Everyone in work should get time to learn AI tools.', 'Everyone in work should get paid time to learn AI tools.'],
      4: ['How much would it cost the council?'],
    });
    expect(v.mediation.status).toBe('reviewing');
    return { me, id };
  }

  it('creates a reason, a question and a rewording through the statement functions', async () => {
    const { me, id } = await reviewing('agree');
    const version = (await env.deps.store.get('assemblies', TOWN))!.version;
    const res = await request(env.app).post(`/api/mediations/${id}/approve`).set('Cookie', me.cookie);
    expect(res.status).toBe(200);
    const m = view(res).mediation;
    expect(m.status).toBe('complete');
    expect(m.completedAt).toBeTruthy();
    const reason = await env.deps.store.get('reasons', m.approved!.reasonId!);
    expect(reason).toMatchObject({ side: 'for', text: 'Night classes let me keep my shift.', personId: me.id, statementId: S1 });
    expect(await env.deps.store.get('reasons', m.approved!.questionId!)).toMatchObject({ side: 'question', text: 'How much would it cost the council?' });
    const reworded = await env.deps.store.get('statements', m.approved!.statementId!);
    expect(reworded).toMatchObject({ origin: 'reword', previousId: S1, version: 2, authorPersonId: me.id, status: 'candidate', text: 'Everyone in work should get paid time to learn AI tools.' });
    expect(reworded!.pointIds).toEqual([pid('ana1'), pid('ben1')]);
    expect((await env.deps.store.get('assemblies', TOWN))!.version).toBeGreaterThan(version);

    const d = await detail(me.cookie);
    expect(d.reasons.for).toEqual([expect.objectContaining({ text: 'Night classes let me keep my shift.', mine: true })]);
    expect(d.reasons.questions.map((q) => q.text)).toEqual(['How much would it cost the council?']);
    expect(d.later.map((l) => l.text)).toEqual(['Everyone in work should get paid time to learn AI tools.']);
    expect(d.mediation).toEqual({ mine: { id, status: 'complete' }, completed: 1 });

    // Approving again changes nothing.
    await request(env.app).post(`/api/mediations/${id}/approve`).set('Cookie', me.cookie);
    expect(await env.deps.store.count('reasons', { statementId: S1 })).toBe(2);
  });

  it('allows approving with everything scrapped, and creates nothing', async () => {
    const { me, id } = await reviewing('disagree');
    const statements = await env.deps.store.count('statements');
    const patched = await request(env.app).patch(`/api/mediations/${id}/drafts`).set('Cookie', me.cookie).send({ reason: '', wording: '', question: '' });
    expect(patched.status).toBe(200);
    expect(view(patched).mediation.drafts).toEqual({ reasonSide: 'against' });
    const res = await request(env.app).post(`/api/mediations/${id}/approve`).set('Cookie', me.cookie);
    expect(res.status).toBe(200);
    expect(view(res).mediation).toMatchObject({ status: 'complete', approved: {} });
    expect(await env.deps.store.count('reasons')).toBe(0);
    expect(await env.deps.store.count('statements')).toBe(statements);
    expect((await detail(me.cookie)).mediation.completed).toBe(1);
  });

  it('asks a person who answered "not sure" to choose the side of their reason', async () => {
    const { me, id } = await reviewing('unsure');
    const v = view(await request(env.app).get(`/api/mediations/${id}`).set('Cookie', me.cookie));
    expect(v.mediation.drafts.reason).toBe('Night classes let me keep my shift.');
    expect(v.mediation.drafts.reasonSide).toBeUndefined();
    const refused = await request(env.app).post(`/api/mediations/${id}/approve`).set('Cookie', me.cookie);
    expect(refused.status).toBe(400);
    expect(refused.body.error.code).toBe('side_needed');
    expect(await env.deps.store.count('reasons')).toBe(0);
    await request(env.app).patch(`/api/mediations/${id}/drafts`).set('Cookie', me.cookie).send({ reasonSide: 'against', reason: 'My own words now.' });
    const ok = await request(env.app).post(`/api/mediations/${id}/approve`).set('Cookie', me.cookie);
    expect(ok.status).toBe(200);
    expect(await env.deps.store.get('reasons', view(ok).mediation.approved!.reasonId!)).toMatchObject({ side: 'against', text: 'My own words now.' });
  });

  it('applies the rewording route’s checks to the wording', async () => {
    const { me, id } = await reviewing();
    const same = await request(env.app).patch(`/api/mediations/${id}/drafts`).set('Cookie', me.cookie).send({ wording: STATEMENT_TEXT });
    expect(same.status).toBe(400);
    expect(same.body.error.code).toBe('same_wording');
    const long = await request(env.app).patch(`/api/mediations/${id}/drafts`).set('Cookie', me.cookie).send({ wording: Array(31).fill('word').join(' ') });
    expect(long.status).toBe(400);
  });

  it('drafts can only change during the review', async () => {
    const me = await answered(env);
    const id = view(await startFor(env, me.cookie)).mediation.id;
    const res = await request(env.app).patch(`/api/mediations/${id}/drafts`).set('Cookie', me.cookie).send({ reason: 'x' });
    expect(res.status).toBe(409);
    expect((await request(env.app).post(`/api/mediations/${id}/approve`).set('Cookie', me.cookie)).status).toBe(409);
  });
});

describe('rule 2: only the owner sees a mediation', () => {
  it('refuses anyone else, a host or steward included, on every endpoint', async () => {
    const me = await answered(env);
    const id = view(await startFor(env, me.cookie)).mediation.id;
    const other = await answered(env);
    const steward = await asRole(env, 'steward');
    for (const cookie of [other.cookie, steward, []]) {
      const calls = [
        request(env.app).get(`/api/mediations/${id}`),
        request(env.app).post(`/api/mediations/${id}/turns`).send({ text: 'hello' }),
        request(env.app).patch(`/api/mediations/${id}/drafts`).send({ reason: 'x' }),
        request(env.app).post(`/api/mediations/${id}/approve`),
      ];
      for (const c of calls) {
        const res = await c.set('Cookie', cookie);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('not_yours');
      }
    }
    expect((await env.deps.store.get('mediations', id))!.turns).toHaveLength(1);
  });

  it('no statement, picture or export endpoint for another person contains mediation turns or drafts', async () => {
    await reasonBy(env, 'ana', 'against', 2, 'Ana reason against');
    const me = await answered(env);
    const id = view(await startFor(env, me.cookie)).mediation.id;
    await talkThrough(me.cookie, id, {
      1: ['Zebracrossing marmalade story from my life.', 'Quixotic lighthouse memory.'],
      2: ['Saffron teapot thoughts.', 'Velvet tangerine thoughts.'],
      3: ['Everyone should learn the Wobblesprocket method.', 'Everyone should learn the Wobblesprocket method together.'],
      4: ['Who checks the Fandangle budget?'],
    });
    const other = await answered(env, 'disagree');
    const urls = [`/api/statements/${S1}`, '/api/assemblies/town/statements', '/api/assemblies/town/picture', '/api/me/export', '/api/me/trace', '/api/assemblies/town'];
    for (const url of urls) {
      const res = await request(env.app).get(url).set('Cookie', other.cookie);
      expect(res.status, url).toBe(200);
      const text = JSON.stringify(res.body);
      for (const marker of ['Zebracrossing', 'Quixotic', 'Saffron', 'Velvet', 'Wobblesprocket', 'Fandangle', id]) expect(text, `${url} ${marker}`).not.toContain(marker);
    }
    const d = await detail(other.cookie);
    expect(d.mediation).toEqual({ completed: 0 });
  });
});

describe('my data', () => {
  it('exports my mediations and deletes them with me', async () => {
    const me = await answered(env);
    const id = view(await startFor(env, me.cookie)).mediation.id;
    await turnOf(env, me.cookie, id, { text: 'My own reason, in my words.' });
    const other = await answered(env);
    const otherId = view(await startFor(env, other.cookie)).mediation.id;

    const exported = await request(env.app).get('/api/me/export').set('Cookie', me.cookie);
    expect(exported.body.mediations).toEqual([expect.objectContaining({ id, statementId: S1 })]);
    expect(exported.body.mediations[0].turns.map((t: { text: string }) => t.text)).toContain('My own reason, in my words.');

    expect((await request(env.app).delete('/api/me').set('Cookie', me.cookie)).status).toBe(200);
    expect(await env.deps.store.get('mediations', id)).toBeUndefined();
    expect(await env.deps.store.get('mediations', otherId)).toBeTruthy();
  });
});

describe('the statement detail', () => {
  it('counts people who finished, by code, and shows only my own', async () => {
    const extra = stableId('st', 'med/other');
    await makeStatement(ctxOf(env), { id: extra, assemblyId: TOWN, text: 'Another statement.', pointIds: [pid('cat1')], themeIds: [] });
    const me = await answered(env);
    expect((await detail(me.cookie)).mediation).toEqual({ completed: 0 });
    const id = view(await startFor(env, me.cookie)).mediation.id;
    expect((await detail(me.cookie)).mediation).toEqual({ mine: { id, status: 'active' }, completed: 0 });
  });
});
