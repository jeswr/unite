import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { stableId } from '@unite/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { requireHeard, sessionMiddleware } from '../src/auth.js';
import { errorHandler } from '../src/errors.js';
import { getAssemblyBySlug } from '../src/services/assemblies.js';
import { makeConversationWithPoints, makeMembership } from '../src/seed/builders.js';
import { ASSEMBLY_IDS, INVITE_CODES } from '../src/seed/assemblies.js';
import { seed } from '../src/seed/index.js';
import { cookiesOf, testEnv, type TestEnv } from './helpers.js';

let env: TestEnv;
beforeEach(async () => {
  env = await testEnv();
  await seed(env.deps);
});
afterEach(() => env.close());

const asRole = async (role: 'host' | 'steward') => cookiesOf(await request(env.app).post('/api/role').send({ role, code: role }));
const newPerson = async () => {
  const res = await request(env.app).patch('/api/me').send({ displayName: 'Tester' });
  return { cookie: cookiesOf(res), id: res.body.person.id as string };
};

describe('assemblies', () => {
  it('lists every assembly, grouped by stage in order', async () => {
    const res = await request(env.app).get('/api/assemblies');
    expect(res.status).toBe(200);
    expect(res.body.assemblies.map((a: { slug: string }) => a.slug)).toEqual([
      'making-unite-better',
      'ai-and-care',
      'open',
      'earning-and-learning',
      'volunteering-tool',
    ]);
  });

  it('shows one assembly with its checklist and counts', async () => {
    const res = await request(env.app).get('/api/assemblies/earning-and-learning');
    expect(res.status).toBe(200);
    expect(res.body.assembly.question).toBe('What would let people here keep earning and keep learning as work changes?');
    expect(res.body.membership).toBeNull();
    expect(res.body.heard).toBe(false);
    expect(res.body.checklist.stage).toBe('deciding');
    expect(res.body.checklist.next).toBe('answered');
    expect(res.body.counts).toMatchObject({ heard: 0, statements: 0, decisions: 0 });
  });

  it('404s an unknown slug in the error shape', async () => {
    const res = await request(env.app).get('/api/assemblies/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'not_found', message: 'That assembly could not be found.' } });
  });

  it('joins with an invite code, bumping the version', async () => {
    const before = (await request(env.app).get('/api/assemblies/earning-and-learning/version')).body.version;
    const res = await request(env.app).post('/api/assemblies/earning-and-learning/join').send({ inviteCode: INVITE_CODES.earning });
    expect(res.status).toBe(200);
    expect(res.body.membership).toMatchObject({ role: 'participant', invited: true, lookedAroundFirst: false });
    const after = (await request(env.app).get('/api/assemblies/earning-and-learning/version')).body.version;
    expect(after).toBe(before + 1);
    expect((await env.deps.store.get('invites', stableId('inv', 'earning')))?.uses).toBe(1);
    const view = await request(env.app).get('/api/assemblies/earning-and-learning').set('Cookie', cookiesOf(res));
    expect(view.body.membership.invited).toBe(true);
    expect(view.body.counts.invited).toBe(1);
  });

  it('refuses a wrong invite code and does not create a membership', async () => {
    const res = await request(env.app).post('/api/assemblies/earning-and-learning/join').send({ inviteCode: 'WRONG' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('bad_invite');
    expect(await env.deps.store.count('memberships')).toBe(0);
  });
});

describe('rule 1: heard alone first', () => {
  /** A route guarded by requireHeard, as the picture and statements routes will be. */
  const guarded = () => {
    const app = express();
    app.use(cookieParser(env.deps.config.secret));
    app.use(sessionMiddleware());
    app.get('/group/:slug', async (req, res) => {
      const a = await getAssemblyBySlug(env.deps.store, String(req.params.slug));
      await requireHeard(env.deps, req, a);
      res.json({ ok: true });
    });
    app.use(errorHandler);
    return app;
  };

  it('refuses someone who has not been heard', async () => {
    const res = await request(guarded()).get('/group/earning-and-learning');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('not_heard');
    const { cookie } = await newPerson();
    expect((await request(guarded()).get('/group/earning-and-learning').set('Cookie', cookie)).status).toBe(403);
  });

  it('lets in someone with a completed conversation in that assembly only', async () => {
    const { cookie, id } = await newPerson();
    const ctx = { store: env.deps.store, clock: env.clock };
    await makeConversationWithPoints(ctx, {
      id: stableId('con', 'r1'),
      personId: id,
      assemblyId: ASSEMBLY_IDS.earning,
      points: [{ id: stableId('pt', 'r1'), type: 'barrier', text: 'Courses run when I am asleep.' }],
    });
    expect((await request(guarded()).get('/group/earning-and-learning').set('Cookie', cookie)).status).toBe(200);
    expect((await request(guarded()).get('/group/volunteering-tool').set('Cookie', cookie)).status).toBe(403);
    expect((await request(env.app).get('/api/assemblies/earning-and-learning').set('Cookie', cookie)).body.heard).toBe(true);
  });

  it('does not count a conversation that is not complete', async () => {
    const { cookie, id } = await newPerson();
    await makeConversationWithPoints(
      { store: env.deps.store, clock: env.clock },
      { id: stableId('con', 'r2'), personId: id, assemblyId: ASSEMBLY_IDS.earning, status: 'active', points: [] },
    );
    expect((await request(guarded()).get('/group/earning-and-learning').set('Cookie', cookie)).status).toBe(403);
  });

  it('lets in someone who chose to look around an example first, and records it', async () => {
    const join = await request(env.app).post('/api/assemblies/earning-and-learning/join').send({ lookAroundFirst: true });
    expect(join.body.membership.lookedAroundFirst).toBe(true);
    expect((await request(guarded()).get('/group/earning-and-learning').set('Cookie', cookiesOf(join))).status).toBe(200);
  });

  it('does not allow looking around first outside example assemblies', async () => {
    const res = await request(env.app).post('/api/assemblies/making-unite-better/join').send({ lookAroundFirst: true });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('not_example');
    // Even a membership flagged by hand does not open a real assembly.
    const { cookie, id } = await newPerson();
    await makeMembership({ store: env.deps.store, clock: env.clock }, { id: stableId('mem', 'x'), personId: id, assemblyId: ASSEMBLY_IDS.feedback, lookedAroundFirst: true });
    expect((await request(guarded()).get('/group/making-unite-better').set('Cookie', cookie)).status).toBe(403);
  });

  it('exempts hosts and stewards', async () => {
    for (const role of ['host', 'steward'] as const)
      expect((await request(guarded()).get('/group/earning-and-learning').set('Cookie', await asRole(role))).status).toBe(200);
  });
});

describe('rule 6 and the stage endpoint', () => {
  it('is for hosts and stewards only', async () => {
    const res = await request(env.app).post('/api/assemblies/making-unite-better/stage');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('role_required');
  });

  it('refuses to leave proposed without a complete pledge, naming what is missing', async () => {
    const a = await env.deps.store.get('assemblies', ASSEMBLY_IDS.feedback);
    await env.deps.store.put('assemblies', { ...a!, pledge: null });
    const res = await request(env.app).post('/api/assemblies/making-unite-better/stage').set('Cookie', await asRole('host'));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('checklist_not_clear');
    expect(res.body.error.message).toMatch(/pledge is complete/);
    expect(res.body.error.details.unmet[0].key).toBe('pledge_complete');
    expect((await env.deps.store.get('assemblies', ASSEMBLY_IDS.feedback))?.stage).toBe('proposed');

    await env.deps.store.put('assemblies', { ...a!, pledge: { ...a!.pledge!, offTable: '' } });
    expect((await request(env.app).post('/api/assemblies/making-unite-better/stage').set('Cookie', await asRole('host'))).status).toBe(409);
  });

  it('moves on when the checklist is clear, publishing the pledge', async () => {
    const res = await request(env.app).post('/api/assemblies/making-unite-better/stage').set('Cookie', await asRole('steward'));
    expect(res.status).toBe(200);
    expect(res.body.assembly.stage).toBe('pledged');
    expect(res.body.assembly.pledge.publishedAt).toBe('2026-11-13T09:00:00.000Z');
    expect(res.body.assembly.pledge.challengeEndsAt).toBe('2026-11-27T09:00:00.000Z');
    expect(res.body.checklist.items[0]).toMatchObject({ key: 'challenge_over', met: false });
  });

  it('refuses a pledged assembly whose challenge period is still open, then allows it once it ends', async () => {
    const cookie = await asRole('host');
    expect((await request(env.app).post('/api/assemblies/ai-and-care/stage').set('Cookie', cookie)).status).toBe(409);
    env.clock.set('2026-11-22T09:00:00.000Z');
    const res = await request(env.app).post('/api/assemblies/ai-and-care/stage').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.assembly.stage).toBe('listening');
  });
});
