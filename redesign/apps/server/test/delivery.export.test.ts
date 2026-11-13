import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { stableId } from '@unite/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sessionMiddleware } from '../src/auth.js';
import { errorHandler } from '../src/errors.js';
import { deliveryRouter } from '../src/routes/delivery.js';
import { makeCheck, react } from '../src/seed/builders.js';
import { exportAssembly } from '../src/services/delivery/export.js';
import { testEnv, type TestEnv } from './helpers.js';
import { deliveryFixture, IDS, REASONS, roleCookie } from './delivery.fixtures.js';

let env: TestEnv;
beforeEach(async () => {
  env = await testEnv();
  const ctx = await deliveryFixture(env);
  const d = (await env.deps.store.get('decisions', IDS.d1))!;
  await env.deps.store.put('decisions', {
    ...d,
    status: 'delivered_minor_changes',
    answer: { kind: 'accepted', reasons: REASONS, answeredAt: '2026-10-30T10:00:00.000Z', answeredBy: 'Northern Network' },
  });
  await makeCheck(ctx, {
    id: stableId('chk', 'test/c'),
    decisionId: IDS.d1,
    assemblyId: IDS.tool,
    checkBody: 'The check panel',
    panel: ['Ade Panelist', 'Bea Panelist'],
    results: [
      { n: 1, met: true, note: 'Seen.' },
      { n: 2, met: false, note: 'Not yet for staff.' },
    ],
    classification: 'minor_changes',
    summary: 'Mostly there.',
  });
  for (const [i, p] of IDS.people.entries()) await react(ctx, { id: stableId('rx', `test/${i}`), statementId: IDS.statement, assemblyId: IDS.tool, personId: p, value: i === 1 ? 'disagree' : 'agree' });
  // A transcript turn that must never appear.
  await env.deps.store.put('turns', { id: stableId('trn', 'test/secret'), conversationId: stableId('con', 'test/c1'), role: 'person', text: 'My neighbour Joan at 4 Mill Lane', stage: 1, createdAt: env.clock.iso() });
});
afterEach(() => env.close());

describe('the assembly export', () => {
  it('holds the pledge, picture, statements with support, decisions, answers, checks and register', async () => {
    const out = await exportAssembly(env.deps, 'tool', { role: 'steward' });
    expect(out.pledge?.replyBy).toBe('2026-11-01');
    expect(out.picture?.people).toBe(3);
    expect(out.picture?.themes[0]).toMatchObject({ name: 'Proving who I am again and again', people: 3, sentences: [{ text: 'People repeat the same checks.', people: 2 }] });
    expect(out.statements?.[0]?.support).toEqual({ agree: 2, disagree: 1, unsure: 0, total: 3 });
    expect(out.decisions.map((d) => d.number)).toEqual([1, 2]);
    expect(out.decisions[0]).toMatchObject({ status: 'delivered_minor_changes', answer: { kind: 'accepted', reasons: REASONS }, check: { classification: 'minor_changes', panelSize: 2 } });
    expect(out.decisions[0]!.tests).toHaveLength(2);
    expect(out.register.entries).toHaveLength(2);
    expect(out.register.summary.delivered).toBe(1);
  });

  it('contains no person ids, no transcripts, and no names unless a point is named', async () => {
    const out = JSON.stringify(await exportAssembly(env.deps, 'tool', { role: 'steward' }));
    expect(out).not.toMatch(/per_/);
    expect(out).not.toMatch(/con_|trn_|pt_/);
    expect(out).not.toMatch(/Mill Lane/);
    expect(out).not.toMatch(/Secret1|Secret2/);
    expect(out).not.toMatch(/Panelist/);
    // Amina chose to have her point shown with her name.
    expect(out).toMatch(/"name":"Amina"/);
    // A point kept as a count only is not quoted.
    expect(out).not.toMatch(/same forms filled in/);
  });

  it('leaves out the picture and statements for someone not heard (rule 1)', async () => {
    const out = await exportAssembly(env.deps, 'tool');
    expect(out.picture).toBeNull();
    expect(out.statements).toBeNull();
    expect(out.withheld).toMatch(/rule 1/);
    expect(out.decisions).toHaveLength(2);
  });

  it('is served at GET /api/assemblies/:slug/export by the delivery router', async () => {
    const app = express();
    app.use(cookieParser(env.deps.config.secret));
    app.use(sessionMiddleware());
    app.use('/api', express.json(), deliveryRouter(env.deps));
    app.use(errorHandler);
    const steward = await roleCookie(env, 'steward');
    const res = await request(app).get('/api/assemblies/tool/export').set('Cookie', steward);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/tool-export\.json/);
    expect(res.body.format).toBe('unite-assembly-export/1');
    expect(res.body.picture.themes).toHaveLength(2);
    expect((await request(app).get('/api/assemblies/nope/export')).status).toBe(404);
  });
});
