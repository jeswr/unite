import request from 'supertest';
import { stableId, type Pledge } from '@unite/shared';
import { makeAssembly, makeConversationWithPoints, makeMembership, makeStatement, react } from '../src/seed/builders.js';
import { cookiesOf, type TestEnv } from './helpers.js';

export const SLUG = 'rooms-test';
export const ASM = stableId('asm', 'rooms-test');

export const PLEDGE: Pledge = {
  setAside: 'A budget',
  remit: 'Adult learning',
  offTable: 'Wages',
  decisionLevel: 2,
  groupThreshold: 0.6,
  minParticipants: 10,
  capacity: 2,
  replyBy: '2026-12-18',
  checkBody: 'panel',
  reviewAfterDays: 365,
};

export interface TestPerson {
  id: string;
  cookie: string[];
  name?: string;
}

export async function makeFixtureAssembly(env: TestEnv) {
  const ctx = { store: env.deps.store, clock: env.clock };
  return makeAssembly(ctx, {
    id: ASM,
    slug: SLUG,
    title: 'Rooms test',
    question: 'What should happen?',
    kind: 'codecided',
    scale: 'local',
    hostName: 'Test host',
    hostSlug: 'test-host',
    stage: 'deliberating',
    isExample: false,
    pledge: PLEDGE,
  });
}

let n = 0;
/** A person with a session cookie; heard (completed conversation) and invited unless told otherwise. */
export async function person(env: TestEnv, opts: { name?: string; heard?: boolean; invited?: boolean } = {}): Promise<TestPerson> {
  const res = opts.name
    ? await request(env.app).patch('/api/me').send({ displayName: opts.name })
    : await request(env.app).patch('/api/me').send({ locale: 'en-GB' });
  const id = res.body.person.id as string;
  const ctx = { store: env.deps.store, clock: env.clock };
  n++;
  await makeMembership(ctx, { id: stableId('mem', `rt/${n}/${id}`), personId: id, assemblyId: ASM, invited: opts.invited ?? true });
  if (opts.heard ?? true)
    await makeConversationWithPoints(ctx, {
      id: stableId('con', `rt/${n}/${id}`),
      personId: id,
      assemblyId: ASM,
      points: [{ id: stableId('pt', `rt/${n}/${id}`), type: 'matters', text: 'Being able to learn at night.' }],
    });
  return { id, cookie: cookiesOf(res), name: opts.name };
}

export const asRole = async (env: TestEnv, role: 'host' | 'steward') =>
  cookiesOf(await request(env.app).post('/api/role').send({ role, code: role }));

/** A statement with the given status and the first fixture point as its source. */
export async function statement(env: TestEnv, key: string, status: 'candidate' | 'common_ground' | 'differ' | 'decided' = 'common_ground', text = `Statement ${key}`) {
  const ctx = { store: env.deps.store, clock: env.clock };
  const [pt] = await env.deps.store.list('points', { assemblyId: ASM }, { limit: 1 });
  return makeStatement(ctx, { id: stableId('st', `rt/${key}`), assemblyId: ASM, text, status, pointIds: pt ? [pt.id] : [] });
}

export async function reactAs(env: TestEnv, personId: string, statementId: string, value: 'agree' | 'disagree' | 'unsure') {
  const ctx = { store: env.deps.store, clock: env.clock };
  return react(ctx, { id: stableId('rx', `${personId}/${statementId}`), statementId, assemblyId: ASM, personId, value });
}
