import request from 'supertest';
import { stableId, type DecisionStatus } from '@unite/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeDecision, type SeedCtx } from '../src/seed/builders.js';
import { daysPast, onOrBefore } from '../src/services/delivery/dates.js';
import { testEnv, type TestEnv } from './helpers.js';
import { deliveryFixture, IDS, REASONS, roleCookie, TESTS } from './delivery.fixtures.js';

let env: TestEnv;
let ctx: SeedCtx;
beforeEach(async () => {
  env = await testEnv();
  ctx = await deliveryFixture(env);
});
afterEach(() => env.close());

const setStatus = async (id: string, status: DecisionStatus, answer?: { kind: 'accepted' | 'changed' | 'delayed' | 'refused'; answeredAt: string }) => {
  const d = (await env.deps.store.get('decisions', id))!;
  await env.deps.store.put('decisions', { ...d, status, ...(answer ? { answer: { ...answer, reasons: REASONS, answeredBy: 'Northern Network' } } : {}) });
};

describe('dates', () => {
  it('counts whole days late from the injected clock', () => {
    expect(daysPast('2026-11-01', new Date('2026-11-13T09:00:00Z'))).toBe(12);
    expect(daysPast('2026-11-13', new Date('2026-11-13T23:59:00Z'))).toBe(0);
    expect(daysPast('2026-12-18', new Date('2026-11-13T09:00:00Z'))).toBe(0);
    expect(onOrBefore('2026-11-01T18:00:00.000Z', '2026-11-01')).toBe(true);
    expect(onOrBefore('2026-11-02T00:00:01.000Z', '2026-11-01')).toBe(false);
  });
});

describe('the register', () => {
  it('lists every decision, by assembly title and then number, never by attention', async () => {
    await makeDecision(ctx, { id: stableId('dec', 'test/d0'), assemblyId: IDS.tool, statementId: IDS.statement, number: 3, rank: 3, title: 'Third', tests: [TESTS[0]!], dueDate: '2026-12-18', reviewDate: '2027-12-18' });
    const res = await request(env.app).get('/api/register');
    expect(res.status).toBe(200);
    expect(res.body.entries.map((e: { assembly: { slug: string }; number: number }) => `${e.assembly.slug} ${e.number}`)).toEqual(['alpha 1', 'tool 1', 'tool 2', 'tool 3']);
    expect(res.body.entries[1]).toMatchObject({ title: 'Prove who you are once', status: 'awaiting_answer', dueDate: '2026-11-01', daysLate: 12, host: { name: 'Northern Network', slug: 'northern-network' } });
    expect(res.body.filters.hosts).toEqual([
      { slug: 'alpha-council', name: 'Alpha Council' },
      { slug: 'northern-network', name: 'Northern Network' },
    ]);
  });

  it('days late follow the clock and stop once answered', async () => {
    env.clock.set('2026-11-20T09:00:00.000Z');
    let res = await request(env.app).get('/api/register?assembly=tool');
    expect(res.body.entries[0].daysLate).toBe(19);
    const host = await roleCookie(env, 'host');
    await request(env.app).post(`/api/decisions/${IDS.d1}/answer`).set('Cookie', host).send({ kind: 'accepted', reasons: REASONS });
    res = await request(env.app).get('/api/register?assembly=tool');
    expect(res.body.entries[0].daysLate).toBe(0);
  });

  it('filters by assembly, host and status', async () => {
    await setStatus(IDS.d2, 'in_progress');
    expect((await request(env.app).get('/api/register?assembly=alpha')).body.entries).toHaveLength(1);
    expect((await request(env.app).get('/api/register?host=northern-network')).body.entries).toHaveLength(2);
    const s = await request(env.app).get('/api/register?status=in_progress');
    expect(s.body.entries.map((e: { title: string }) => e.title)).toEqual(['Hours belong to the volunteer']);
    expect((await request(env.app).get('/api/register?status=nonsense')).status).toBe(400);
  });

  it('never counts in progress in a done figure', async () => {
    await setStatus(IDS.d1, 'in_progress');
    await setStatus(IDS.d2, 'in_progress');
    await setStatus(IDS.d3, 'delivered_minor_changes');
    const { summary } = (await request(env.app).get('/api/register')).body;
    expect(summary).toMatchObject({ total: 3, inProgress: 2, delivered: 1, deliveredAsDecided: 0 });
    expect(summary.byStatus.in_progress).toBe(2);
  });
});

describe('a host’s record', () => {
  it('counts answers on time and late, kinds, deliveries, and in progress apart', async () => {
    await setStatus(IDS.d1, 'delivered_as_decided', { kind: 'accepted', answeredAt: '2026-10-30T10:00:00.000Z' });
    await setStatus(IDS.d2, 'in_progress', { kind: 'changed', answeredAt: '2026-12-20T10:00:00.000Z' });
    for (const [i, status] of (['refused', 'delayed', 'not_delivered', 'delivered_substantial_changes'] as const).entries())
      await makeDecision(ctx, {
        id: stableId('dec', `test/h${i}`),
        assemblyId: IDS.tool,
        statementId: IDS.statement,
        number: 10 + i,
        rank: 10 + i,
        title: `Extra ${i}`,
        tests: [TESTS[0]!],
        dueDate: '2026-11-01',
        reviewDate: '2027-11-01',
        status,
        answer: { kind: status === 'delayed' ? 'delayed' : status === 'refused' ? 'refused' : 'accepted', reasons: REASONS, answeredAt: '2026-11-01T12:00:00.000Z', answeredBy: 'Northern Network' },
      });
    await makeDecision(ctx, { id: stableId('dec', 'test/late'), assemblyId: IDS.tool, statementId: IDS.statement, number: 20, rank: 20, title: 'Late', tests: [TESTS[0]!], dueDate: '2026-11-03', reviewDate: '2027-11-01' });
    const res = await request(env.app).get('/api/hosts/northern-network');
    expect(res.status).toBe(200);
    expect(res.body.host).toMatchObject({ name: 'Northern Network', slug: 'northern-network' });
    expect(res.body.assemblies).toEqual([{ slug: 'tool', title: 'Volunteering tool', stage: 'answered', isExample: false, decisions: 7 }]);
    expect(res.body.record).toEqual({
      decisions: 7,
      answeredOnTime: 5,
      answeredLate: 1,
      awaitingAnswer: 1,
      awaitingLate: 1,
      accepted: 3,
      changed: 1,
      delayed: 1,
      refused: 1,
      inProgress: 1,
      deliveredAsDecided: 1,
      deliveredWithChanges: 1,
      notDelivered: 1,
      replaced: 0,
    });
    expect(res.body.entries).toHaveLength(7);
  });

  it('404s a host with no assembly', async () => {
    expect((await request(env.app).get('/api/hosts/nobody')).status).toBe(404);
  });
});
