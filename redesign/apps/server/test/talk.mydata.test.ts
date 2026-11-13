import { stableId } from '@unite/shared';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import {
  choosePriorities,
  makeConversationWithPoints,
  makeDecision,
  makeObjection,
  makePerson,
  makeReason,
  makeRoom,
  makeRoomAnswer,
  makeStatement,
  makeTheme,
  react,
} from '../src/seed/builders.js';
import { testEnv, type TestEnv } from './helpers.js';
import { ASM, assemblies, say, start } from './talk.helpers.js';

const OTHER = stableId('per', 'talk/other');
const OTHER_PT = stableId('pt', 'talk/other-1');
const THEME = stableId('thm', 'talk/evenings');
const LONELY_THEME = stableId('thm', 'talk/lonely');
const S1 = stableId('st', 'talk/s1');
const S2 = stableId('st', 'talk/s2');
const DEC = stableId('dec', 'talk/d1');
const ROOM = stableId('room', 'talk/r1');

/** Me (through the API, with approved points) and another person, a theme, statements and a decision. */
async function fixture(env: TestEnv) {
  await assemblies(env);
  const ctx = { store: env.deps.store, clock: env.clock };
  const { cookie, id } = await start(env, { assemblySlug: 'riverbend', route: 'freetext' });
  await say(env, cookie, id, { text: 'The classes are at seven when I work. I want Saturday classes. I am tired.' });
  const done = (await request(env.app).post(`/api/conversations/${id}/approve`).set('Cookie', cookie)).body;
  const me = done.conversation.personId as string;
  const [p1, p2, p3] = done.points.map((p: { id: string }) => p.id) as string[];

  await makePerson(ctx, { id: OTHER });
  await makeConversationWithPoints(ctx, {
    id: stableId('con', 'talk/other'),
    personId: OTHER,
    assemblyId: ASM,
    points: [{ id: OTHER_PT, type: 'barrier', text: 'Night classes clash with my shifts' }],
  });
  await makeTheme(ctx, {
    id: THEME,
    assemblyId: ASM,
    kind: 'barrier',
    name: 'Courses run when I am at work',
    pointIds: [p1!, OTHER_PT],
    sentences: [
      { text: 'Classes clash with shifts.', pointIds: [p1!, OTHER_PT] },
      { text: 'Only my words.', pointIds: [p1!] },
    ],
  });
  await makeTheme(ctx, { id: LONELY_THEME, assemblyId: ASM, kind: 'matters', name: 'I am tired', pointIds: [p3!] });
  await makeStatement(ctx, { id: S1, assemblyId: ASM, text: 'Courses should fit around shifts.', pointIds: [p1!, OTHER_PT], themeIds: [THEME], status: 'common_ground' });
  await makeStatement(ctx, { id: S2, assemblyId: ASM, text: 'Saturday classes for all.', pointIds: [p2!], status: 'differ', origin: 'reword', authorPersonId: me });
  await makeDecision(ctx, { id: DEC, assemblyId: ASM, statementId: S1, number: 3, title: 'Courses at any time', tests: [], rank: 1, dueDate: '2026-12-18', reviewDate: '2027-12-18', status: 'in_progress' });
  await react(ctx, { id: stableId('rx', 'talk/r'), statementId: S1, assemblyId: ASM, personId: me, value: 'agree' });
  await makeReason(ctx, { id: stableId('rsn', 'talk/r'), statementId: S1, assemblyId: ASM, personId: me, side: 'for', text: 'I work nights' });
  await makeObjection(ctx, { id: stableId('obj', 'talk/o'), statementId: S2, assemblyId: ASM, personId: me, text: 'Too broad' });
  await choosePriorities(ctx, { id: stableId('pc', 'talk/pc'), assemblyId: ASM, personId: me, statementIds: [S1] });
  await makeRoom(ctx, { id: ROOM, assemblyId: ASM, topic: 'Saturdays', briefing: { summary: '', forSide: [], againstSide: [], evidenceIds: [] } });
  await makeRoomAnswer(ctx, { id: stableId('ra', 'talk/ra'), roomId: ROOM, personId: me, value: 'agree' });
  return { cookie, me, conversationId: id as string, points: [p1!, p2!, p3!] };
}

describe('my data', () => {
  let env: TestEnv;
  afterEach(() => env.close());

  it('traces each approved point to its theme, statements and decisions, with statuses in words', async () => {
    env = await testEnv();
    const { cookie, points } = await fixture(env);
    const res = await request(env.app).get('/api/me/trace').set('Cookie', cookie);
    expect(res.status).toBe(200);
    const [first, second, third] = res.body.points;
    expect(first).toMatchObject({
      point: { id: points[0], text: 'The classes are at seven when I work.' },
      assembly: { slug: 'riverbend' },
      theme: { id: THEME, name: 'Courses run when I am at work' },
      statements: [{ id: S1, statusWords: 'Common ground' }],
      decisions: [{ id: DEC, number: 3, title: 'Courses at any time', statusWords: 'In progress' }],
    });
    expect(second).toMatchObject({ theme: null, statements: [{ id: S2, statusWords: 'Where we differ' }], decisions: [] });
    expect(third).toMatchObject({ theme: { name: 'I am tired' }, statements: [], decisions: [] });
    // Nobody yet: an empty trace, not an error.
    expect((await request(env.app).get('/api/me/trace')).body).toEqual({ points: [] });
  });

  it('exports everything held about me, and nothing about anyone else', async () => {
    env = await testEnv();
    const { cookie, me, conversationId } = await fixture(env);
    const res = await request(env.app).get('/api/me/export').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    const d = res.body;
    expect(d.person.id).toBe(me);
    expect(d.conversations.map((c: { id: string }) => c.id)).toEqual([conversationId]);
    expect(d.turns).toHaveLength(1);
    expect(d.points).toHaveLength(3);
    for (const k of ['memberships', 'reactions', 'reasons', 'objections', 'priorityChoices', 'roomAnswers']) expect(d[k]).toHaveLength(1);
    expect(JSON.stringify(d)).not.toContain(OTHER);
    expect((await request(env.app).get('/api/me/export')).status).toBe(401);
  });

  it('deletes me, everything I made, and my point ids from themes and statements', async () => {
    env = await testEnv();
    const { cookie, me, conversationId, points } = await fixture(env);
    const { store } = env.deps;
    const before = (await store.get('assemblies', ASM))!.version;
    const res = await request(env.app).delete('/api/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(String(res.headers['set-cookie'])).toMatch(/unite_sid=;/);

    expect(await store.get('persons', me)).toBeUndefined();
    expect(await store.get('conversations', conversationId)).toBeUndefined();
    expect(await store.count('turns', { conversationId })).toBe(0);
    for (const c of ['points', 'memberships', 'reactions', 'reasons', 'objections', 'priorityChoices', 'roomAnswers'] as const)
      expect(await store.count(c, { personId: me })).toBe(0);

    const theme = (await store.get('themes', THEME))!;
    expect(theme.pointIds).toEqual([OTHER_PT]);
    expect(theme.sentences).toEqual([{ text: 'Classes clash with shifts.', pointIds: [OTHER_PT] }]);
    expect(await store.get('themes', LONELY_THEME)).toBeUndefined();
    expect((await store.get('statements', S1))!.pointIds).toEqual([OTHER_PT]);
    const s2 = (await store.get('statements', S2))!;
    expect(s2.pointIds).toEqual([]);
    expect(s2.authorPersonId).toBeUndefined();
    expect(JSON.stringify(await store.list('themes'))).not.toContain(points[0]!);

    // The other person is untouched.
    expect(await store.get('persons', OTHER)).toBeDefined();
    expect(await store.get('points', OTHER_PT)).toBeDefined();
    expect((await store.get('assemblies', ASM))!.version).toBeGreaterThan(before);
    expect((await request(env.app).get('/api/me/trace').set('Cookie', cookie)).body).toEqual({ points: [] });
  });
});
