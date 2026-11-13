import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Statement } from '@unite/shared';
import { asRole, makeFixtureAssembly, person, SLUG, statement, type TestPerson } from './rooms.fixture.js';
import { testEnv, type TestEnv } from './helpers.js';

let env: TestEnv;
let A: Statement, B: Statement, C: Statement, D: Statement, differ: Statement;

beforeEach(async () => {
  env = await testEnv();
  await makeFixtureAssembly(env);
  await person(env, { name: 'Seed' }); // gives the statements a source point
  A = await statement(env, 'A', 'common_ground', 'Courses at night');
  B = await statement(env, 'B', 'common_ground', 'Childcare in class');
  C = await statement(env, 'C', 'common_ground', 'Count what people already know');
  D = await statement(env, 'D', 'common_ground', 'Teach in community halls');
  differ = await statement(env, 'X', 'differ', 'Teach AI to everyone');
});
afterEach(() => env.close());

const path = `/api/assemblies/${SLUG}/priorities`;
const choose = (p: TestPerson, ids: string[]) => request(env.app).put(path).set('Cookie', p.cookie).send({ statementIds: ids });
const view = (cookie: string[]) => request(env.app).get(path).set('Cookie', cookie);

/** Six people choose A and B; four choose only C. */
async function workedExample() {
  const majority: TestPerson[] = [];
  const minority: TestPerson[] = [];
  for (let i = 0; i < 6; i++) majority.push(await person(env));
  for (let i = 0; i < 4; i++) minority.push(await person(env));
  for (const p of majority) expect((await choose(p, [A.id, B.id])).status).toBe(200);
  for (const p of minority) expect((await choose(p, [C.id])).status).toBe(200);
  return { majority, minority };
}

describe('priorities', () => {
  it('ranks proportionally: a minority’s first choice outranks the majority’s second', async () => {
    const { minority } = await workedExample();
    const res = await view(minority[0]!.cookie);
    expect(res.status).toBe(200);
    expect(res.body.ranked.map((r: { statementId: string }) => r.statementId)).toEqual([A.id, C.id, B.id, D.id]);
    expect(res.body.ranked.map((r: { score: number }) => r.score)).toEqual([6, 4, 3, 0]);
    expect(res.body.myChoices).toEqual([C.id]);
    expect(res.body.chosen).toBe(10);
    expect(res.body.invited).toBe(11);
    expect(res.body.capacity).toBe(2);
    expect(res.body.replyBy).toBe('2026-12-18');
    // Only common-ground statements are offered.
    expect(res.body.statements.map((s: { id: string }) => s.id)).toEqual([A.id, B.id, C.id, D.id]);
  });

  it('allows at most three, and only common-ground or decided statements', async () => {
    const p = await person(env);
    expect((await choose(p, [A.id, B.id, C.id, D.id])).status).toBe(400);
    const bad = await choose(p, [differ.id]);
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('not_common_ground');
    const ok = await choose(p, [A.id, A.id, B.id]);
    expect(ok.body.myChoices).toEqual([A.id, B.id]);
    const cleared = await choose(p, []);
    expect(cleared.body.myChoices).toEqual([]);
    expect(cleared.body.chosen).toBe(0);
  });

  it('is behind rule 1 for reading and choosing', async () => {
    const notHeard = await person(env, { heard: false });
    expect((await view(notHeard.cookie)).body.error.code).toBe('not_heard');
    expect((await choose(notHeard, [A.id])).body.error.code).toBe('not_heard');
  });

  it('stores uninvited choices but does not count them', async () => {
    const invited = await person(env);
    const visitor = await person(env, { invited: false });
    await choose(invited, [B.id]);
    const res = await choose(visitor, [A.id, C.id]);
    expect(res.status).toBe(200);
    expect(res.body.myChoices).toEqual([A.id, C.id]);
    expect(res.body.myChoicesCount).toBe(false);
    expect(res.body.chosen).toBe(1);
    expect(res.body.uninvitedChosen).toBe(1);
    expect(res.body.ranked[0]).toMatchObject({ statementId: B.id, score: 1 });
    expect(res.body.ranked.find((r: { statementId: string }) => r.statementId === A.id).score).toBe(0);
  });
});

describe('decide', () => {
  const entry = (title: string, tests = ['It is offered by September']) => ({ title, why: 'People asked for it', options: ['Do it', 'Wait'], dissent: 'Some worry about cost', tests, delivery: ['social'] });
  const decide = (cookie: string[], decisions: object) => request(env.app).post(`/api/assemblies/${SLUG}/decide`).set('Cookie', cookie).send({ decisions });

  it('turns the top capacity priorities into numbered decisions awaiting an answer', async () => {
    await workedExample();
    const steward = await asRole(env, 'steward');
    const res = await decide(steward, { [A.id]: entry('Night courses'), [C.id]: entry('Prior learning', ['One', 'Two']) });
    expect(res.status).toBe(201);
    expect(res.body.decisions).toHaveLength(2);
    expect(res.body.decisions[0]).toMatchObject({
      statementId: A.id,
      number: 1,
      rank: 1,
      title: 'Night courses',
      status: 'awaiting_answer',
      dueDate: '2026-12-18',
      reviewDate: '2027-11-13T09:00:00.000Z',
      tests: [{ n: 1, text: 'It is offered by September' }],
      delivery: ['social'],
    });
    expect(res.body.decisions[1]).toMatchObject({ statementId: C.id, number: 2, tests: [{ n: 1, text: 'One' }, { n: 2, text: 'Two' }] });
    expect((await env.deps.store.get('statements', A.id))?.status).toBe('decided');
    expect((await env.deps.store.get('statements', C.id))?.status).toBe('decided');
    expect((await env.deps.store.get('statements', B.id))?.status).toBe('common_ground');

    // Idempotent: refused the second time.
    const again = await decide(steward, { [A.id]: entry('Night courses'), [C.id]: entry('Prior learning') });
    expect(again.status).toBe(409);
    expect(await env.deps.store.count('decisions')).toBe(2);
    // The list has closed.
    const p = await person(env);
    expect((await choose(p, [B.id])).status).toBe(409);
  });

  it('refuses when a top priority has no write-up or no test, and is for stewards only', async () => {
    await workedExample();
    const steward = await asRole(env, 'steward');
    const host = await asRole(env, 'host');
    expect((await decide(host, { [A.id]: entry('a'), [C.id]: entry('c') })).status).toBe(403);
    const missing = await decide(steward, { [A.id]: entry('a') });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('missing_decision');
    const untested = await decide(steward, { [A.id]: entry('a'), [C.id]: entry('c', ['  ']) });
    expect(untested.status).toBe(400);
    expect(untested.body.error.code).toBe('missing_tests');
    expect(await env.deps.store.count('decisions')).toBe(0);
    expect((await env.deps.store.get('statements', A.id))?.status).toBe('common_ground');
  });
});
