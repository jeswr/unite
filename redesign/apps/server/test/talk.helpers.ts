import request from 'supertest';
import { stableId } from '@unite/shared';
import type { AiResponse } from '../src/ai/client.js';
import { makeAssembly } from '../src/seed/builders.js';
import { cookiesOf, type TestEnv } from './helpers.js';

/** A model answer for the fake runner. */
export const reply = (r: Partial<{ acknowledgement: string; question: string; stage_complete: boolean; safety: string }>): AiResponse => ({
  stop_reason: 'end_turn',
  parsed_output: { acknowledgement: '', question: 'What happened next?', stage_complete: false, safety: 'ok', ...r },
  usage: { input_tokens: 100, output_tokens: 20 },
});

export const ASM = stableId('asm', 'talk/riverbend');
export const OPEN = stableId('asm', 'talk/open');

/** A listening assembly with a question and probes, and the open-listening assembly. */
export async function assemblies(env: TestEnv, probes: string[] = []) {
  const ctx = { store: env.deps.store, clock: env.clock };
  await makeAssembly(ctx, {
    id: ASM,
    slug: 'riverbend',
    title: 'Earning and learning',
    question: 'What would let people here keep earning and keep learning as work changes?',
    kind: 'codecided',
    scale: 'local',
    hostName: 'Riverbend Council',
    hostSlug: 'riverbend-council',
    stage: 'listening',
    isExample: false,
    probes,
  });
  await makeAssembly(ctx, {
    id: OPEN,
    slug: 'open',
    title: 'The lives people want',
    question: 'What does a good ordinary life look like for you?',
    kind: 'listening',
    scale: 'global',
    hostName: 'Unite',
    hostSlug: 'unite',
    stage: 'listening',
    isOpenListening: true,
  });
}

/** Starts a conversation as a new person and gives consent. Returns the person's cookie and the view. */
export async function start(env: TestEnv, body: Record<string, unknown> = { assemblySlug: 'riverbend', route: 'ai' }, cookie?: string[]) {
  const req = request(env.app).post('/api/conversations');
  const created = await (cookie ? req.set('Cookie', cookie) : req).send(body);
  if (created.status !== 201) throw new Error(`start failed: ${created.status} ${JSON.stringify(created.body)}`);
  const jar = cookie ?? cookiesOf(created);
  const id = created.body.conversation.id as string;
  const consent = await request(env.app).post(`/api/conversations/${id}/consent`).set('Cookie', jar);
  return { cookie: jar, id, view: consent.body };
}

export const say = (env: TestEnv, cookie: string[], id: string, body: Record<string, unknown>) =>
  request(env.app).post(`/api/conversations/${id}/turns`).set('Cookie', cookie).send(body);

/** A host or steward cookie (on a person of their own). */
export async function roleCookie(env: TestEnv, role: 'host' | 'steward'): Promise<string[]> {
  const res = await request(env.app).post('/api/role').send({ role, code: role });
  return cookiesOf(res);
}
