import request from 'supertest';
import { pickOtherSide, type StatementDetail } from '@unite/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EARNING_IDS } from '../src/seed/earning.js';
import { seed } from '../src/seed/index.js';
import { cookiesOf, testEnv, type TestEnv } from './helpers.js';

let env: TestEnv;
beforeAll(async () => {
  env = await testEnv();
  await seed(env.deps);
});
afterAll(() => env.close());

const S5 = EARNING_IDS.statement('S5');

describe('the Riverbend mediations (section 12.3)', () => {
  it('has four completed mediations on the AI-tools statement, each approving a reason already in the seed', async () => {
    const all = await env.deps.store.list('mediations');
    expect(all).toHaveLength(4);
    const reasons = await env.deps.store.list('reasons', { statementId: S5 });
    expect(reasons).toHaveLength(10);
    for (const m of all) {
      expect(m).toMatchObject({ statementId: S5, status: 'complete', aiUsed: false });
      const reason = reasons.find((r) => r.id === m.approved?.reasonId);
      expect(reason, m.id).toBeDefined();
      expect(reason!.personId).toBe(m.personId);
      expect(reason!.side).toBe(m.answer === 'agree' ? 'for' : 'against');
      expect(m.approved).toEqual({ reasonId: reason!.id });
      expect(m.completedAt).toBe(reason!.createdAt);
      // What step 2 showed is what pickOtherSide chooses from the reasons there were then.
      expect(m.shownReasonIds).toEqual(pickOtherSide(reasons.filter((r) => r.createdAt < m.startedAt), m.answer, m.personId).map((r) => r.id));
      const [rx] = await env.deps.store.list('reactions', { statementId: S5, personId: m.personId });
      expect(rx?.value).toBe(m.answer);
    }
    // At least one had nobody on the other side to show yet.
    expect(all.some((m) => m.shownReasonIds.length === 0)).toBe(true);
  });

  it('counts them on the statement for a person who can see it', async () => {
    const res = await request(env.app).post('/api/test/sign-in').send({ personId: EARNING_IDS.person('liam') });
    const cookie = cookiesOf(res);
    const detail = (await request(env.app).get(`/api/statements/${S5}`).set('Cookie', cookie)).body as StatementDetail;
    expect(detail.mediation).toEqual({ completed: 4 });
  });
});
