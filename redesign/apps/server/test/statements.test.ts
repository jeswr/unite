import request from 'supertest';
import { stableId } from '@unite/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeObjection, makeReason, makeStatement, makeTheme, react } from '../src/seed/builders.js';
import type { StatementDetail, StatementsResponse, StatementSummary } from '@unite/shared';
import { DRAFT_STATEMENTS_SYSTEM, REVISE_STATEMENT_SYSTEM } from '../src/ai/prompts.js';
import type { AiRequest } from '../src/ai/client.js';
import { fakeRunner, testEnv, type TestEnv } from './helpers.js';
import { answer, asRole, ctxOf, heardPerson, makeTown, newPerson, pid, speaker, TOWN } from './picture.fixtures.js';

let env: TestEnv;
const S1 = stableId('st', 'test/s1');
const THEME = stableId('thm', 'test/t1');
const others = ['ana', 'ben', 'cat'];

async function setup(e: TestEnv) {
  env = e;
  await makeTown(env);
  for (const k of others) await speaker(env, k, [{ key: `${k}1`, type: 'idea', text: `Classes at night, says ${k}` }]);
  await makeTheme(ctxOf(env), { id: THEME, assemblyId: TOWN, kind: 'idea', name: 'Classes at night', pointIds: others.map((k) => pid(`${k}1`)) });
  await makeStatement(ctxOf(env), { id: S1, assemblyId: TOWN, text: 'Classes should run at night.', pointIds: [pid('ana1'), pid('ben1')], themeIds: [THEME] });
}

beforeEach(async () => setup(await testEnv()));
afterEach(() => env.close());

const list = async (cookie: string[]) => {
  const res = await request(env.app).get('/api/assemblies/town/statements').set('Cookie', cookie);
  expect(res.status).toBe(200);
  return res.body as StatementsResponse;
};
const one = (body: StatementsResponse, id = S1) => body.statements.find((s) => s.id === id) as StatementSummary;
const reactAll = async (value: 'agree' | 'disagree' | 'unsure') => {
  for (const k of others)
    await react(ctxOf(env), { id: stableId('rx', `test/${k}/${S1}`), statementId: S1, assemblyId: TOWN, personId: stableId('per', `test/${k}`), value });
};

describe('rule 1 on the statements endpoints', () => {
  it('refuses someone not heard on every read and write', async () => {
    const { cookie } = await newPerson(env);
    const calls = [
      request(env.app).get('/api/assemblies/town/statements'),
      request(env.app).get(`/api/statements/${S1}`),
      request(env.app).post(`/api/statements/${S1}/reactions`).send({ value: 'agree' }),
      request(env.app).post(`/api/statements/${S1}/rewordings`).send({ text: 'Classes should run in the evening.' }),
      request(env.app).post(`/api/statements/${S1}/reasons`).send({ side: 'for', text: 'I work days' }),
      request(env.app).post(`/api/statements/${S1}/objections`).send({ text: 'Unsafe at night' }),
    ];
    for (const c of calls) {
      const res = await c.set('Cookie', cookie);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('not_heard');
    }
    expect(await env.deps.store.count('reactions')).toBe(0);
  });
});

describe('rule 5: others’ answers are hidden until you answer', () => {
  it('hides totals, groups and what is still needed until I react, then shows them', async () => {
    await reactAll('agree');
    const me = await heardPerson(env);
    const before = one(await list(me.cookie));
    expect(before.myReaction).toBeNull();
    expect(before.results).toBeUndefined();
    const detail = (await request(env.app).get(`/api/statements/${S1}`).set('Cookie', me.cookie)).body as StatementDetail;
    expect(detail.statement.results).toBeUndefined();
    expect(JSON.stringify(detail)).not.toContain('"agree":');

    const res = await request(env.app).post(`/api/statements/${S1}/reactions`).set('Cookie', me.cookie).send({ value: 'disagree' });
    expect(res.status).toBe(200);
    expect(res.body.statement.myReaction).toBe('disagree');
    expect(res.body.statement.results.overall).toMatchObject({ agree: 3, disagree: 1, total: 4 });
    const after = one(await list(me.cookie));
    expect(after.results?.overall.total).toBe(4);
    expect(after.results?.stillNeeded).toBeInstanceOf(Array);
  });

  it('shows totals to a steward or host who has not reacted', async () => {
    await reactAll('agree');
    for (const role of ['steward', 'host'] as const) {
      const s = one(await list(await asRole(env, role)));
      expect(s.results?.overall).toMatchObject({ agree: 3, total: 3 });
      expect(s.status).toBe('candidate');
    }
  });

  it('hides the status of a statement I have not answered, on the list and the statement page', async () => {
    const st = await env.deps.store.get('statements', S1);
    for (const status of ['common_ground', 'differ', 'not_enough', 'no_agreement', 'candidate'] as const) {
      await env.deps.store.put('statements', { ...st!, status });
      const me = await heardPerson(env);
      const s = one(await list(me.cookie));
      expect(s).not.toHaveProperty('status');
      expect(s).not.toHaveProperty('results');
      const detail = (await request(env.app).get(`/api/statements/${S1}`).set('Cookie', me.cookie)).body as StatementDetail;
      expect(detail.statement).not.toHaveProperty('status');
      expect(JSON.stringify(detail)).not.toMatch(/common_ground|differ|not_enough|no_agreement|stillNeeded/);
    }
  });

  it('shows the status once I have answered', async () => {
    await reactAll('agree');
    const me = await heardPerson(env, [], { invited: true });
    const res = await request(env.app).post(`/api/statements/${S1}/reactions`).set('Cookie', me.cookie).send({ value: 'agree' });
    expect(res.body.statement.status).toBe('common_ground');
    expect(one(await list(me.cookie)).status).toBe('common_ground');
    const detail = (await request(env.app).get(`/api/statements/${S1}`).set('Cookie', me.cookie)).body as StatementDetail;
    expect(detail.statement.status).toBe('common_ground');
  });

  it('shows the status of a decided statement to everyone, but not its totals', async () => {
    await reactAll('agree');
    const st = await env.deps.store.get('statements', S1);
    await env.deps.store.put('statements', { ...st!, status: 'decided' });
    const me = await heardPerson(env);
    const s = one(await list(me.cookie));
    expect(s.status).toBe('decided');
    expect(s.results).toBeUndefined();
  });

  it('hides the status in my trace until I answer', async () => {
    await reactAll('agree');
    const me = await heardPerson(env, [{ key: 'mine1', type: 'idea', text: 'Classes at night for carers' }]);
    const theme = await env.deps.store.get('themes', THEME);
    await env.deps.store.put('themes', { ...theme!, pointIds: [...theme!.pointIds, pid('mine1')] });
    const st = await env.deps.store.get('statements', S1);
    await env.deps.store.put('statements', { ...st!, status: 'common_ground' });
    const trace = async () => (await request(env.app).get('/api/me/trace').set('Cookie', me.cookie)).body.points as { statements: { id: string; status?: string }[] }[];
    const before = (await trace()).flatMap((p) => p.statements).find((s) => s.id === S1);
    expect(before).toBeDefined();
    expect(before).not.toHaveProperty('status');
    await request(env.app).post(`/api/statements/${S1}/reactions`).set('Cookie', me.cookie).send({ value: 'agree' });
    const after = (await trace()).flatMap((p) => p.statements).find((s) => s.id === S1);
    expect(after?.status).toBeDefined();
  });
});

describe('reactions', () => {
  it('upserts one reaction per person, counted only with an invitation', async () => {
    const me = await heardPerson(env, [], { invited: false });
    await request(env.app).post(`/api/statements/${S1}/reactions`).set('Cookie', me.cookie).send({ value: 'agree' });
    await request(env.app).post(`/api/statements/${S1}/reactions`).set('Cookie', me.cookie).send({ value: 'unsure' });
    const mine = await env.deps.store.list('reactions', { personId: me.id });
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ value: 'unsure', counted: false });

    const invited = await heardPerson(env, [], { invited: true });
    await request(env.app).post(`/api/statements/${S1}/reactions`).set('Cookie', invited.cookie).send({ value: 'agree' });
    expect((await env.deps.store.list('reactions', { personId: invited.id }))[0]?.counted).toBe(true);
    expect((await request(env.app).post(`/api/statements/${S1}/reactions`).set('Cookie', invited.cookie).send({ value: 'maybe' })).status).toBe(400);
  });

  it('reclassifies from counted reactions after each answer', async () => {
    await reactAll('agree');
    const me = await heardPerson(env, [], { invited: true });
    expect((await env.deps.store.get('statements', S1))?.status).toBe('candidate');
    await request(env.app).post(`/api/statements/${S1}/reactions`).set('Cookie', me.cookie).send({ value: 'agree' });
    expect((await env.deps.store.get('statements', S1))?.status).toBe('common_ground');
    const s = one(await list(me.cookie));
    expect(s.results?.stillNeeded).toEqual([]);
    // Changing my answer moves the status again: 3 of 4 is still above the pledge's 60%, 2 of 4 is not.
    await request(env.app).post(`/api/statements/${S1}/reactions`).set('Cookie', me.cookie).send({ value: 'disagree' });
    expect((await env.deps.store.get('statements', S1))?.status).toBe('common_ground');
    const [ana] = await env.deps.store.list('reactions', { personId: stableId('per', 'test/ana') });
    await env.deps.store.put('reactions', { ...ana!, value: 'disagree' });
    await request(env.app).post(`/api/statements/${S1}/reactions`).set('Cookie', me.cookie).send({ value: 'disagree' });
    expect((await env.deps.store.get('statements', S1))?.status).toBe('not_enough');
  });

  it('does not count uninvited answers toward the status', async () => {
    await reactAll('agree');
    const me = await heardPerson(env, [], { invited: false });
    await request(env.app).post(`/api/statements/${S1}/reactions`).set('Cookie', me.cookie).send({ value: 'agree' });
    const s = await env.deps.store.get('statements', S1);
    expect(s?.status).toBe('not_enough');
    expect(one(await list(me.cookie)).results).toMatchObject({ counted: 3, overall: { total: 4 }, stillNeeded: ['1 more person needs to answer'] });
  });

  it('never changes a decided, no-agreement or retired statement', async () => {
    const st = await env.deps.store.get('statements', S1);
    await env.deps.store.put('statements', { ...st!, status: 'decided' });
    await reactAll('disagree');
    const me = await heardPerson(env, [], { invited: true });
    await request(env.app).post(`/api/statements/${S1}/reactions`).set('Cookie', me.cookie).send({ value: 'disagree' });
    expect((await env.deps.store.get('statements', S1))?.status).toBe('decided');
    await env.deps.store.put('statements', { ...st!, status: 'retired' });
    expect((await request(env.app).post(`/api/statements/${S1}/reactions`).set('Cookie', me.cookie).send({ value: 'agree' })).status).toBe(409);
    expect((await list(me.cookie)).statements.map((s) => s.id)).not.toContain(S1);
  });
});

describe('rewordings and versions', () => {
  it('creates a reword candidate with the same sources, the previous id and the next version', async () => {
    const me = await heardPerson(env);
    const res = await request(env.app).post(`/api/statements/${S1}/rewordings`).set('Cookie', me.cookie).send({ text: 'Core courses should run in the evening.' });
    expect(res.status).toBe(201);
    const id = res.body.statement.id;
    const stored = await env.deps.store.get('statements', id);
    expect(stored).toMatchObject({ origin: 'reword', version: 2, previousId: S1, pointIds: [pid('ana1'), pid('ben1')], themeIds: [THEME], status: 'candidate', authorPersonId: me.id });
    expect(res.body.statement.mine).toBe(true);
    const detail = (await request(env.app).get(`/api/statements/${id}`).set('Cookie', me.cookie)).body as StatementDetail;
    expect(detail.earlier).toEqual([{ id: S1, text: 'Classes should run at night.', version: 1, origin: 'ai' }]);
    const original = (await request(env.app).get(`/api/statements/${S1}`).set('Cookie', me.cookie)).body as StatementDetail;
    expect(original.later.map((l) => l.id)).toEqual([id]);
    const long = Array.from({ length: 31 }, () => 'word').join(' ');
    expect((await request(env.app).post(`/api/statements/${S1}/rewordings`).set('Cookie', me.cookie).send({ text: long })).status).toBe(400);
  });
});

describe('rule 3: statements need existing source points', () => {
  it('refuses a statement written by hand with no existing source point', async () => {
    const steward = await asRole(env, 'steward');
    const none = await request(env.app).post('/api/assemblies/town/statements').set('Cookie', steward).send({ text: 'Buses should be free.', pointIds: [] });
    expect(none.status).toBe(422);
    expect(none.body.error.code).toBe('no_sources');
    const fake = await request(env.app).post('/api/assemblies/town/statements').set('Cookie', steward).send({ text: 'Buses should be free.', pointIds: [stableId('pt', 'nope')] });
    expect(fake.status).toBe(422);
    const ok = await request(env.app)
      .post('/api/assemblies/town/statements')
      .set('Cookie', steward)
      .send({ text: 'Classes should be in the library.', pointIds: [pid('cat1'), stableId('pt', 'nope')] });
    expect(ok.status).toBe(201);
    expect(await env.deps.store.get('statements', ok.body.statement.id)).toMatchObject({ origin: 'steward', pointIds: [pid('cat1')], themeIds: [THEME] });
    const me = await heardPerson(env);
    expect((await request(env.app).post('/api/assemblies/town/statements').set('Cookie', me.cookie).send({ text: 'x', pointIds: [pid('cat1')] })).status).toBe(403);
  });

  it('drafts nothing without the AI', async () => {
    const res = await request(env.app).post('/api/assemblies/town/statements/draft').set('Cookie', await asRole(env, 'steward'));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ created: [], fallback: true });
  });
});

describe('with the AI switched on', () => {
  beforeEach(async () => {
    await env.close();
    const { runner } = fakeRunner((req: AiRequest) => {
      if (req.system === DRAFT_STATEMENTS_SYSTEM)
        return answer({
          statements: [
            { text: 'Classes should run at night.', pointIds: [pid('ana1')] },
            { text: 'An invented proposal.', pointIds: ['pt_invented0000'] },
          ],
        });
      if (req.system === REVISE_STATEMENT_SYSTEM) return answer({ text: 'Core classes should run at night and at weekends.', note: 'Adds weekends.' });
      throw new Error('unexpected call');
    });
    await setup(await testEnv({ config: { anthropicKey: 'test' }, runner }));
  });

  it('drafts only statements that rest on real points', async () => {
    const res = await request(env.app).post('/api/assemblies/town/statements/draft').set('Cookie', await asRole(env, 'steward'));
    expect(res.body.created.map((s: StatementSummary) => s.text)).toEqual(['Classes should run at night.']);
    expect(res.body.fallback).toBe(false);
  });

  it('revises into a new version with the same sources', async () => {
    const res = await request(env.app).post(`/api/statements/${S1}/revise`).set('Cookie', await asRole(env, 'steward'));
    expect(res.status).toBe(201);
    expect(await env.deps.store.get('statements', res.body.statement.id)).toMatchObject({
      text: 'Core classes should run at night and at weekends.',
      version: 2,
      previousId: S1,
      pointIds: [pid('ana1'), pid('ben1')],
    });
  });
});

describe('reasons and objections', () => {
  it('returns reasons in two columns in the order they arrived, with questions apart', async () => {
    const ctx = ctxOf(env);
    const ana = stableId('per', 'test/ana');
    await makeReason(ctx, { id: stableId('rsn', 'a'), statementId: S1, assemblyId: TOWN, personId: ana, side: 'against', text: 'Unsafe streets' });
    env.clock.advance(1000);
    await makeReason(ctx, { id: stableId('rsn', 'b'), statementId: S1, assemblyId: TOWN, personId: ana, side: 'for', text: 'I work days' });
    const me = await heardPerson(env);
    env.clock.advance(1000);
    const add = await request(env.app).post(`/api/statements/${S1}/reasons`).set('Cookie', me.cookie).send({ side: 'against', text: 'Buses stop at ten' });
    expect(add.status).toBe(201);
    await request(env.app).post(`/api/statements/${S1}/reasons`).set('Cookie', me.cookie).send({ side: 'question', text: 'Which classes?' });
    expect((await request(env.app).post(`/api/statements/${S1}/reasons`).set('Cookie', me.cookie).send({ side: 'for', text: 'x'.repeat(281) })).status).toBe(400);
    const d = (await request(env.app).get(`/api/statements/${S1}`).set('Cookie', me.cookie)).body as StatementDetail;
    expect(d.reasons.for.map((r) => r.text)).toEqual(['I work days']);
    expect(d.reasons.against.map((r) => [r.text, r.mine])).toEqual([
      ['Unsafe streets', false],
      ['Buses stop at ten', true],
    ]);
    expect(d.reasons.questions.map((r) => r.text)).toEqual(['Which classes?']);
    expect(JSON.stringify(d)).not.toContain(ana);
  });

  it('takes an objection with a reason and lets a steward reply', async () => {
    const me = await heardPerson(env);
    expect((await request(env.app).post(`/api/statements/${S1}/objections`).set('Cookie', me.cookie).send({ text: '  ' })).status).toBe(400);
    const res = await request(env.app).post(`/api/statements/${S1}/objections`).set('Cookie', me.cookie).send({ text: 'Night classes leave carers out' });
    expect(res.status).toBe(201);
    const id = res.body.objection.id;
    expect((await request(env.app).patch(`/api/objections/${id}`).set('Cookie', me.cookie).send({ reply: 'x', status: 'answered' })).status).toBe(403);
    const reply = await request(env.app)
      .patch(`/api/objections/${id}`)
      .set('Cookie', await asRole(env, 'steward'))
      .send({ reply: 'Daytime runs too.', status: 'answered', name: 'Rosa' });
    expect(reply.status).toBe(200);
    await makeObjection(ctxOf(env), { id: stableId('obj', 'o2'), statementId: S1, assemblyId: TOWN, personId: stableId('per', 'test/ana'), text: 'Open one' });
    const d = (await request(env.app).get(`/api/statements/${S1}`).set('Cookie', await asRole(env, 'steward'))).body as StatementDetail;
    expect(d.objections).toEqual([
      expect.objectContaining({ text: 'Night classes leave carers out', reply: 'Daytime runs too.', repliedBy: 'Rosa', status: 'answered' }),
      expect.objectContaining({ text: 'Open one', status: 'open' }),
    ]);
    expect(d.statement.results?.stillNeeded).toContain('1 objection is waiting for a reply');
  });

  it('shows the sources with people counted and only quotable points', async () => {
    const me = await heardPerson(env);
    const d = (await request(env.app).get(`/api/statements/${S1}`).set('Cookie', me.cookie)).body as StatementDetail;
    expect(d.sources).toMatchObject({ people: 2, themes: [{ id: THEME, name: 'Classes at night' }] });
    expect(d.sources.quotes.map((q) => q.text)).toEqual(['Classes at night, says ana', 'Classes at night, says ben']);
  });
});
