import request from 'supertest';
import { stableId } from '@unite/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeDeliveryItem, makeProposal, type SeedCtx } from '../src/seed/builders.js';
import { CHECK_ONLY_STATUSES, classificationProblem, uncoveredTests } from '../src/services/delivery/decisions.js';
import { testEnv, type TestEnv } from './helpers.js';
import { checker, deliveryFixture, heardPerson, IDS, newPerson, REASONS, roleCookie, TESTS } from './delivery.fixtures.js';

let env: TestEnv;
let ctx: SeedCtx;
let host: string[];
let steward: string[];
beforeEach(async () => {
  env = await testEnv();
  ctx = await deliveryFixture(env);
  host = await roleCookie(env, 'host');
  steward = await roleCookie(env, 'steward');
});
afterEach(() => env.close());

const answer = (body: object, cookie = host, id = IDS.d1) => request(env.app).post(`/api/decisions/${id}/answer`).set('Cookie', cookie).send(body);
const proposal = (over: object = {}) => ({
  proposerName: 'Priya',
  proposerRole: 'Developer at a volunteer centre',
  summary: 'A shared identity check.',
  plan: 'Build a check record the volunteer holds and can share.',
  testCoverage: TESTS.map((t) => ({ n: t.n, how: `Covered by step ${t.n}.` })),
  ...over,
});
const statusOf = async (id = IDS.d1) => (await env.deps.store.get('decisions', id))!.status;

describe('decisions are public', () => {
  it('lists an assembly’s decisions in number order with days late', async () => {
    const res = await request(env.app).get('/api/assemblies/tool/decisions');
    expect(res.status).toBe(200);
    expect(res.body.decisions.map((d: { number: number }) => d.number)).toEqual([1, 2]);
    expect(res.body.decisions[0]).toMatchObject({ title: 'Prove who you are once', status: 'awaiting_answer', daysLate: 12 });
    expect(res.body.decisions[1].daysLate).toBe(0);
  });

  it('shows the record with its trail back, to someone who has not been heard', async () => {
    const res = await request(env.app).get(`/api/decisions/${IDS.d1}`);
    expect(res.status).toBe(200);
    expect(res.body.statement.text).toMatch(/proves who they are once/);
    expect(res.body.trail.themes.map((t: { name: string }) => t.name)).toEqual(['Proving who I am again and again', 'One check I carry with me']);
    expect(res.body.trail.people).toBe(3);
    expect(res.body.viewer).toEqual({ role: 'participant', heard: false, isChecker: false });
    expect(res.body.assembly.checkBody).toBe('The check panel');
    expect(JSON.stringify(res.body)).not.toMatch(/per_/);
  });

  it('404s an unknown decision', async () => {
    expect((await request(env.app).get('/api/decisions/dec_AAAAAAAAAAAA')).status).toBe(404);
  });
});

describe('the host’s answer', () => {
  it('is for the host only', async () => {
    expect((await answer({ kind: 'accepted', reasons: REASONS }, [])).status).toBe(403);
    expect((await answer({ kind: 'accepted', reasons: REASONS }, steward)).status).toBe(403);
  });

  it('needs reasons of at least 40 characters for every kind', async () => {
    for (const kind of ['accepted', 'refused'])
      expect((await answer({ kind, reasons: 'Because we said so.' })).status, kind).toBe(400);
    expect((await answer({ kind: 'changed', reasons: 'Too short.', changedTo: 'Phone first' })).status).toBe(400);
    expect((await answer({ kind: 'delayed', reasons: 'Too short.', delayedUntil: '2027-03-01' })).status).toBe(400);
    expect(await statusOf()).toBe('awaiting_answer');
  });

  it('needs what it was changed to, or when it is delayed until', async () => {
    const changed = await answer({ kind: 'changed', reasons: REASONS });
    expect(changed.status).toBe(400);
    expect(changed.body.error.message).toMatch(/changedTo/);
    expect((await answer({ kind: 'delayed', reasons: REASONS })).status).toBe(400);
    expect((await answer({ kind: 'delayed', reasons: REASONS, delayedUntil: 'next spring' })).status).toBe(400);
  });

  it('sets the status, records who and when, and can be given only once', async () => {
    const res = await answer({ kind: 'changed', reasons: REASONS, changedTo: 'The phone version first, the desktop later.' });
    expect(res.status).toBe(200);
    expect(res.body.decision.status).toBe('changed');
    expect(res.body.decision.answer).toMatchObject({ kind: 'changed', reasons: REASONS, answeredBy: 'Northern Network', answeredAt: '2026-11-13T09:00:00.000Z' });
    const again = await answer({ kind: 'refused', reasons: REASONS });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('already_answered');
    expect(await statusOf()).toBe('changed');
  });

  it('accepts each of the four kinds', async () => {
    expect((await answer({ kind: 'delayed', reasons: REASONS, delayedUntil: '2027-03-01' }, host, IDS.d2)).body.decision.status).toBe('delayed');
    expect((await answer({ kind: 'refused', reasons: REASONS }, host, IDS.d3)).body.decision.status).toBe('refused');
    expect((await answer({ kind: 'accepted', reasons: REASONS })).body.decision.status).toBe('accepted');
  });
});

describe('build proposals', () => {
  beforeEach(async () => {
    await answer({ kind: 'accepted', reasons: REASONS });
  });

  it('can be added by someone heard, or the host, but not by someone not heard', async () => {
    const stranger = await newPerson(env);
    expect((await request(env.app).post(`/api/decisions/${IDS.d1}/proposals`).set('Cookie', stranger.cookie).send(proposal())).status).toBe(403);
    const heard = await heardPerson(env, ctx);
    const res = await request(env.app).post(`/api/decisions/${IDS.d1}/proposals`).set('Cookie', heard.cookie).send(proposal());
    expect(res.status).toBe(201);
    expect(res.body.proposal).toMatchObject({ status: 'proposed', proposerName: 'Priya' });
    expect((await request(env.app).post(`/api/decisions/${IDS.d1}/proposals`).set('Cookie', host).send(proposal())).status).toBe(201);
  });

  it('must say how every numbered test will be met', async () => {
    const one = await request(env.app).post(`/api/decisions/${IDS.d1}/proposals`).set('Cookie', host).send(proposal({ testCoverage: [{ n: 1, how: 'Step one.' }] }));
    expect(one.status).toBe(400);
    expect(one.body.error.code).toBe('tests_not_covered');
    expect(one.body.error.message).toMatch(/test 2/);
    const blank = await request(env.app).post(`/api/decisions/${IDS.d1}/proposals`).set('Cookie', host).send(proposal({ testCoverage: [{ n: 1, how: 'Step one.' }, { n: 2, how: '  ' }] }));
    expect(blank.status).toBe(400);
    const extra = await request(env.app).post(`/api/decisions/${IDS.d1}/proposals`).set('Cookie', host).send(proposal({ testCoverage: [...proposal().testCoverage, { n: 9, how: 'x' }] }));
    expect(extra.body.error.code).toBe('unknown_test');
    expect(uncoveredTests({ tests: TESTS }, [{ n: 2, how: 'yes' }])).toEqual([1]);
  });

  it('are only for accepted or changed decisions', async () => {
    await answer({ kind: 'refused', reasons: REASONS }, host, IDS.d2);
    const res = await request(env.app).post(`/api/decisions/${IDS.d2}/proposals`).set('Cookie', host).send(proposal({ testCoverage: [{ n: 1, how: 'x' }] }));
    expect(res.status).toBe(409);
    expect((await request(env.app).post(`/api/decisions/${IDS.d3}/proposals`).set('Cookie', host).send(proposal({ testCoverage: [{ n: 1, how: 'x' }] }))).status).toBe(409);
  });

  it('the host chooses one, the others are not chosen, and a steward confirms it is faithful', async () => {
    const a = (await request(env.app).post(`/api/decisions/${IDS.d1}/proposals`).set('Cookie', host).send(proposal())).body.proposal;
    const b = (await request(env.app).post(`/api/decisions/${IDS.d1}/proposals`).set('Cookie', host).send(proposal({ proposerName: 'Tom' }))).body.proposal;
    expect((await request(env.app).patch(`/api/proposals/${b.id}`).set('Cookie', steward).send({ status: 'chosen' })).status).toBe(403);
    expect((await request(env.app).patch(`/api/proposals/${b.id}`).set('Cookie', host).send({ status: 'chosen' })).body.proposal.status).toBe('chosen');
    expect((await env.deps.store.get('buildProposals', a.id))!.status).toBe('not_chosen');
    expect((await request(env.app).patch(`/api/proposals/${a.id}`).set('Cookie', steward).send({ faithful: true })).status).toBe(409);
    expect((await request(env.app).patch(`/api/proposals/${b.id}`).set('Cookie', host).send({ faithful: true })).status).toBe(403);
    const ok = await request(env.app).patch(`/api/proposals/${b.id}`).set('Cookie', steward).send({ faithful: true });
    expect(ok.body.proposal.faithfulConfirmedAt).toBe('2026-11-13T09:00:00.000Z');
    const record = await request(env.app).get(`/api/decisions/${IDS.d1}`);
    expect(record.body.proposals.map((p: { proposerName: string }) => p.proposerName)).toEqual(['Tom', 'Priya']);
    // Once confirmed, the host cannot switch to another plan.
    expect((await request(env.app).patch(`/api/proposals/${a.id}`).set('Cookie', host).send({ status: 'chosen' })).status).toBe(409);
  });
});

describe('delivery items', () => {
  beforeEach(async () => {
    await answer({ kind: 'accepted', reasons: REASONS });
  });
  const item = { title: 'Shared check record', kind: 'technology', owner: 'Dana Okafor, product owner', dueDate: '2027-02-01' };

  it('the host adds items; the first moving to in progress moves the decision to in progress', async () => {
    expect((await request(env.app).post(`/api/decisions/${IDS.d1}/delivery`).send(item)).status).toBe(403);
    const created = await request(env.app).post(`/api/decisions/${IDS.d1}/delivery`).set('Cookie', host).send(item);
    expect(created.status).toBe(201);
    expect(created.body.item.status).toBe('planned');
    const res = await request(env.app).patch(`/api/delivery/${created.body.item.id}`).set('Cookie', host).send({ status: 'in_progress', update: 'Work has started on the record.' });
    expect(res.status).toBe(200);
    expect(res.body.item.updates).toEqual([{ at: '2026-11-13T09:00:00.000Z', text: 'Work has started on the record.' }]);
    expect(res.body.decision.status).toBe('in_progress');
    expect(await statusOf()).toBe('in_progress');
  });

  it('cannot be added to a decision awaiting an answer', async () => {
    expect((await request(env.app).post(`/api/decisions/${IDS.d2}/delivery`).set('Cookie', host).send(item)).status).toBe(409);
  });
});

describe('rule 7: the host cannot mark its own work done', () => {
  it('no host-writable endpoint can set a delivered or not-delivered status', async () => {
    // The answer: only the four answer kinds exist.
    for (const kind of [...CHECK_ONLY_STATUSES, 'in_progress'])
      expect((await answer({ kind, reasons: REASONS })).status, kind).toBe(400);
    expect((await answer({ kind: 'accepted', reasons: REASONS, status: 'delivered_as_decided' })).status).toBe(400);
    expect((await answer({ kind: 'accepted', reasons: REASONS })).status).toBe(200);

    // Proposals: create and choose, with a status smuggled in.
    const create = await request(env.app).post(`/api/decisions/${IDS.d1}/proposals`).set('Cookie', host).send({ ...proposal(), status: 'delivered_as_decided' });
    expect(create.status).toBe(400);
    const p = (await request(env.app).post(`/api/decisions/${IDS.d1}/proposals`).set('Cookie', host).send(proposal())).body.proposal;
    for (const status of CHECK_ONLY_STATUSES)
      expect((await request(env.app).patch(`/api/proposals/${p.id}`).set('Cookie', host).send({ status })).status, status).toBe(400);

    // Delivery items: create and update, with every decision status tried.
    const item = { title: 'Record', kind: 'technology', owner: 'Dana', dueDate: '2027-02-01' };
    for (const status of CHECK_ONLY_STATUSES)
      expect((await request(env.app).post(`/api/decisions/${IDS.d1}/delivery`).set('Cookie', host).send({ ...item, status })).status, status).toBe(400);
    const i = (await request(env.app).post(`/api/decisions/${IDS.d1}/delivery`).set('Cookie', host).send(item)).body.item;
    for (const status of CHECK_ONLY_STATUSES) {
      expect((await request(env.app).patch(`/api/delivery/${i.id}`).set('Cookie', host).send({ status })).status, status).toBe(400);
      expect((await request(env.app).patch(`/api/delivery/${i.id}`).set('Cookie', host).send({ update: 'x', decisionStatus: status })).status, status).toBe(400);
    }
    // Marking every item done does not deliver the decision.
    await request(env.app).patch(`/api/delivery/${i.id}`).set('Cookie', host).send({ status: 'done' });
    expect(await statusOf()).toBe('accepted');

    // The check itself is refused to the host.
    const check = await request(env.app)
      .post(`/api/decisions/${IDS.d1}/check`)
      .set('Cookie', host)
      .send({ results: TESTS.map((t) => ({ n: t.n, met: true, note: '' })), classification: 'as_decided', summary: 'Done.', panel: ['Host'] });
    expect(check.status).toBe(403);

    // The host's assembly edits cannot reach decisions either.
    expect((await request(env.app).patch('/api/host/assemblies/tool').set('Cookie', host).send({ status: 'delivered_as_decided' })).status).toBe(400);

    expect(await statusOf()).toBe('accepted');
    const all = await env.deps.store.list('decisions');
    expect(all.some((d) => CHECK_ONLY_STATUSES.includes(d.status))).toBe(false);
  });
});

describe('checks', () => {
  const results = (met: boolean[]) => met.map((m, i) => ({ n: i + 1, met: m, note: m ? 'Seen working.' : 'Not yet for staff.' }));
  const body = (over: object = {}) => ({ results: results([true, true]), classification: 'as_decided', summary: 'Both tests were met.', panel: ['Ade', 'Bea', 'Cal'], ...over });
  const check = (cookie: string[], over: object = {}) => request(env.app).post(`/api/decisions/${IDS.d1}/check`).set('Cookie', cookie).send(body(over));

  const startWork = async () => {
    await answer({ kind: 'accepted', reasons: REASONS });
    await makeDeliveryItem(ctx, { id: stableId('dlv', 'test/i1'), decisionId: IDS.d1, assemblyId: IDS.tool, title: 'Record', kind: 'technology', owner: 'Dana', dueDate: '2027-02-01', status: 'in_progress' });
    await env.deps.store.put('decisions', { ...(await env.deps.store.get('decisions', IDS.d1))!, status: 'in_progress' });
  };

  it('is refused before work is in progress', async () => {
    expect((await check(steward)).body.error.code).toBe('not_ready');
    await answer({ kind: 'accepted', reasons: REASONS });
    expect((await check(steward)).body.error.code).toBe('not_ready');
  });

  it('is allowed for an accepted decision once every delivery item is done', async () => {
    await answer({ kind: 'accepted', reasons: REASONS });
    await makeDeliveryItem(ctx, { id: stableId('dlv', 'test/i2'), decisionId: IDS.d1, assemblyId: IDS.tool, title: 'Record', kind: 'technology', owner: 'Dana', dueDate: '2027-02-01', status: 'done' });
    const res = await check(steward);
    expect(res.status).toBe(201);
    expect(res.body.decision.status).toBe('delivered_as_decided');
  });

  it('a checker on the panel can record it; a participant who is not cannot', async () => {
    await startWork();
    const stranger = await newPerson(env);
    expect((await check(stranger.cookie)).status).toBe(403);
    const panel = await checker(env, ctx);
    const res = await check(panel.cookie, { results: results([true, false]), classification: 'minor_changes', summary: 'Test 2 is met for groups but not yet for individual staff.' });
    expect(res.status).toBe(201);
    expect(res.body.check).toMatchObject({ classification: 'minor_changes', checkBody: 'The check panel', panel: ['Ade', 'Bea', 'Cal'] });
    expect(res.body.decision.status).toBe('delivered_minor_changes');
    const record = await request(env.app).get(`/api/decisions/${IDS.d1}`).set('Cookie', panel.cookie);
    expect(record.body.viewer.isChecker).toBe(true);
    expect(record.body.check.results).toHaveLength(2);
  });

  it('needs a result for every numbered test', async () => {
    await startWork();
    const res = await check(steward, { results: [{ n: 1, met: true, note: '' }] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('results_incomplete');
  });

  it('is refused when the classification contradicts the results', async () => {
    await startWork();
    const asDecided = await check(steward, { results: results([true, false]) });
    expect(asDecided.status).toBe(400);
    expect(asDecided.body.error.code).toBe('classification_contradicts');
    expect((await check(steward, { classification: 'not_delivered' })).body.error.code).toBe('classification_contradicts');
    expect((await check(steward, { results: results([false, false]), classification: 'substantial_changes' })).body.error.code).toBe('classification_contradicts');
    expect(await statusOf()).toBe('in_progress');
    expect(classificationProblem('not_delivered', [{ met: false }, { met: true }])).toBeUndefined();
    const res = await check(steward, { results: results([false, false]), classification: 'not_delivered', summary: 'Neither test was met.' });
    expect(res.body.decision.status).toBe('not_delivered');
  });

  it('is recorded once', async () => {
    await startWork();
    expect((await check(steward)).status).toBe(201);
    expect((await check(steward)).body.error.code).toBe('already_checked');
  });

  it('names the independent body from the pledge', async () => {
    const a = (await env.deps.store.get('assemblies', IDS.tool))!;
    await env.deps.store.put('assemblies', { ...a, pledge: { ...a.pledge!, checkBody: 'independent', checkBodyName: 'Volunteer Standards Trust' } });
    await startWork();
    expect((await check(steward)).body.check.checkBody).toBe('Volunteer Standards Trust');
  });

  it('shows the chosen proposal first in the record', async () => {
    await answer({ kind: 'accepted', reasons: REASONS });
    await makeProposal(ctx, { id: stableId('prop', 'test/a'), decisionId: IDS.d1, assemblyId: IDS.tool, proposerName: 'A', proposerRole: 'r', summary: 's', plan: 'p', status: 'not_chosen' });
    await makeProposal(ctx, { id: stableId('prop', 'test/b'), decisionId: IDS.d1, assemblyId: IDS.tool, proposerName: 'B', proposerRole: 'r', summary: 's', plan: 'p', status: 'chosen' });
    const record = await request(env.app).get(`/api/decisions/${IDS.d1}`);
    expect(record.body.proposals.map((p: { proposerName: string }) => p.proposerName)).toEqual(['B', 'A']);
  });
});
