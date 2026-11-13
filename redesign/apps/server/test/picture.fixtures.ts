import request from 'supertest';
import { stableId, type Pledge, type PointType } from '@unite/shared';
import type { AiRequest, AiResponse } from '../src/ai/client.js';
import { makeAssembly, makeConversationWithPoints, makeMembership, makePerson, type SeedCtx } from '../src/seed/builders.js';
import { cookiesOf, type TestEnv } from './helpers.js';

/** Shared fixtures for the picture and statements tests. */

export const PLEDGE: Pledge = {
  setAside: 'Money',
  remit: 'Learning',
  offTable: 'Wages',
  decisionLevel: 2,
  groupThreshold: 0.6,
  minParticipants: 4,
  capacity: 3,
  replyBy: '2026-12-18',
  checkBody: 'panel',
  reviewAfterDays: 365,
};

export const TOWN = stableId('asm', 'test/town');
export const ctxOf = (env: TestEnv): SeedCtx => ({ store: env.deps.store, clock: env.clock });

export async function makeTown(env: TestEnv, over: Partial<Parameters<typeof makeAssembly>[1]> = {}) {
  return makeAssembly(ctxOf(env), {
    id: TOWN,
    slug: 'town',
    title: 'Town',
    question: 'What would help people here keep learning?',
    kind: 'advisory',
    scale: 'local',
    hostName: 'Town Council',
    hostSlug: 'town-council',
    stage: 'picture',
    isExample: false,
    pledge: PLEDGE,
    affectedGroups: [
      { key: 'young', label: 'Under 25', aboutKey: 'age', aboutValue: 'under25', target: 4 },
      { key: 'old', label: 'Over 50', aboutKey: 'age', aboutValue: 'over50', target: 2 },
    ],
    ...over,
  });
}

export interface FixturePoint {
  key: string;
  type: PointType;
  text: string;
  visibility?: 'count' | 'anonymous' | 'named';
  status?: 'approved' | 'withdrawn' | 'draft' | 'scrapped';
}

/** A person (with `about` and an optional display name) and a completed conversation with these points. */
export async function speaker(
  env: TestEnv,
  key: string,
  points: FixturePoint[],
  opts: { assemblyId?: string; about?: Record<string, string>; displayName?: string; invited?: boolean } = {},
) {
  const ctx = ctxOf(env);
  const assemblyId = opts.assemblyId ?? TOWN;
  const personId = stableId('per', `test/${key}`);
  await makePerson(ctx, { id: personId, about: opts.about ?? {}, ...(opts.displayName ? { displayName: opts.displayName } : {}) });
  await makeMembership(ctx, { id: stableId('mem', `test/${key}/${assemblyId}`), personId, assemblyId, invited: opts.invited ?? true });
  await makeConversationWithPoints(ctx, {
    id: stableId('con', `test/${key}/${assemblyId}`),
    personId,
    assemblyId,
    points: points.map((p) => ({ id: pid(p.key), type: p.type, text: p.text, visibility: p.visibility, status: p.status })),
  });
  return personId;
}

export const pid = (key: string) => stableId('pt', `test/${key}`);

/** A new person through the API (so the session cookie is set). */
export async function newPerson(env: TestEnv, displayName = 'Tester') {
  const res = await request(env.app).patch('/api/me').send({ displayName });
  return { cookie: cookiesOf(res), id: res.body.person.id as string };
}

/** A person through the API, with a completed conversation in the assembly (so rule 1 lets them in). */
export async function heardPerson(env: TestEnv, points: FixturePoint[] = [], opts: { assemblyId?: string; invited?: boolean; about?: Record<string, string> } = {}) {
  const me = await newPerson(env);
  const ctx = ctxOf(env);
  const assemblyId = opts.assemblyId ?? TOWN;
  if (opts.about) {
    const p = await env.deps.store.get('persons', me.id);
    await env.deps.store.put('persons', { ...p!, about: opts.about });
  }
  if (opts.invited !== undefined)
    await makeMembership(ctx, { id: stableId('mem', `me/${me.id}/${assemblyId}`), personId: me.id, assemblyId, invited: opts.invited });
  await makeConversationWithPoints(ctx, {
    id: stableId('con', `me/${me.id}/${assemblyId}`),
    personId: me.id,
    assemblyId,
    points: points.map((p) => ({ id: pid(p.key), type: p.type, text: p.text, visibility: p.visibility })),
  });
  return me;
}

export async function asRole(env: TestEnv, role: 'host' | 'steward') {
  return cookiesOf(await request(env.app).post('/api/role').send({ role, code: role }));
}

/** A fake model answer. */
export const answer = (parsed_output: unknown): AiResponse => ({ stop_reason: 'end_turn', parsed_output, usage: { input_tokens: 10, output_tokens: 10 } });

/** The data a synthesis call sent (its user message is JSON). */
export const sentData = (req: AiRequest) => JSON.parse(String(req.messages[0]!.content)) as Record<string, unknown>;
