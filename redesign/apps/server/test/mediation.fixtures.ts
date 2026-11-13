import request from 'supertest';
import { stableId, type MediationView, type Reason } from '@unite/shared';
import { makeReason, makeStatement, react } from '../src/seed/builders.js';
import { at } from '../src/seed/content/write.js';
import type { TestEnv } from './helpers.js';
import { ctxOf, heardPerson, makeTown, pid, speaker, TOWN } from './picture.fixtures.js';

/** Shared fixtures for the talk-it-through tests. */

export const S1 = stableId('st', 'med/s1');
export const STATEMENT_TEXT = 'Everyone should be taught to use AI tools as a basic skill.';

/** The town, three people heard with points, and one statement resting on their points. */
export async function town(env: TestEnv) {
  await makeTown(env);
  for (const k of ['ana', 'ben', 'cat']) await speaker(env, k, [{ key: `${k}1`, type: 'idea', text: `Teach the tools, says ${k}` }]);
  await makeStatement(ctxOf(env), { id: S1, assemblyId: TOWN, text: STATEMENT_TEXT, pointIds: [pid('ana1'), pid('ben1')], themeIds: [] });
}

let n = 0;
/** A reason from one of the fixture people (or anyone by id), at a given day in October. */
export async function reasonBy(env: TestEnv, key: string, side: Reason['side'], day: number, text: string) {
  const personId = key.startsWith('per_') ? key : stableId('per', `test/${key}`);
  return makeReason(
    at(ctxOf(env), `2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z`),
    { id: stableId('rsn', `med/${n++}`), statementId: S1, assemblyId: TOWN, personId, side, text },
  );
}

/** A heard person who has answered the statement (through the API, so the session cookie is set). */
export async function answered(env: TestEnv, value: 'agree' | 'disagree' | 'unsure' = 'agree') {
  const me = await heardPerson(env);
  const res = await request(env.app).post(`/api/statements/${S1}/reactions`).set('Cookie', me.cookie).send({ value });
  if (res.status !== 200) throw new Error(`answer failed: ${res.status} ${JSON.stringify(res.body)}`);
  return me;
}

export async function startFor(env: TestEnv, cookie: string[]) {
  const res = await request(env.app).post(`/api/statements/${S1}/mediations`).set('Cookie', cookie).send({});
  return res as typeof res & { body: MediationView };
}

export const turnOf = (env: TestEnv, cookie: string[], id: string, body: Record<string, unknown>) =>
  request(env.app).post(`/api/mediations/${id}/turns`).set('Cookie', cookie).send(body);

/** Others' answers on the statement, so the fixture people count as having answered. */
export async function othersAnswer(env: TestEnv, value: 'agree' | 'disagree') {
  for (const k of ['ana', 'ben', 'cat'])
    await react(ctxOf(env), { id: stableId('rx', `med/${k}`), statementId: S1, assemblyId: TOWN, personId: stableId('per', `test/${k}`), value });
}
