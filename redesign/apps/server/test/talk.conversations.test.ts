import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { DISTRESS_MESSAGE, IDENTIFYING_NOTE, SCRIPTED_QUESTIONS } from '../src/ai/prompts.js';
import { fakeRunner, testEnv, type TestEnv } from './helpers.js';
import { ASM, assemblies, reply, roleCookie, say, start } from './talk.helpers.js';

type View = {
  conversation: { id: string; stage: number; stageTurns: number; status: string; mode: string; route: string; personId: string };
  turns: { id: string; role: string; text: string; stage: number; meta?: { fallback?: boolean } }[];
  points: { id: string; text: string; status: string; type: string; visibility: string; sourceTurnIds: string[] }[];
  questions: string[];
  pending: string | null;
  safety?: string;
};

const lastTurn = (v: View) => v.turns[v.turns.length - 1]!;

describe('conversations in scripted mode', () => {
  let env: TestEnv;
  afterEach(() => env.close());

  it('starts at once with the scripted opener, moves through stages, skips, and goes to review', async () => {
    env = await testEnv();
    await assemblies(env);
    const { cookie, id, view } = await start(env);
    expect(view.conversation).toMatchObject({ stage: 1, mode: 'scripted', route: 'ai', status: 'active' });
    expect(view.conversation.consent.conversation).toBe(true);
    expect(view.turns).toHaveLength(1);
    expect(view.turns[0]).toMatchObject({ role: 'interviewer', text: SCRIPTED_QUESTIONS[1]![0], stage: 1 });

    let v: View = (await say(env, cookie, id, { text: 'I got off the night shift at six. Then I slept.' })).body;
    expect(v.conversation).toMatchObject({ stage: 1, stageTurns: 1 });
    expect(lastTurn(v).text).toBe(SCRIPTED_QUESTIONS[1]![1]);

    v = (await say(env, cookie, id, { text: 'I took my daughter to school. She was happy.' })).body;
    expect(v.conversation).toMatchObject({ stage: 2, stageTurns: 0 });
    expect(lastTurn(v)).toMatchObject({ text: SCRIPTED_QUESTIONS[2]![0], stage: 2 });

    v = (await say(env, cookie, id, { skip: true })).body;
    expect(v.conversation.stage).toBe(3);
    expect(lastTurn(v).text).toBe(SCRIPTED_QUESTIONS[3]![0]);

    v = (await say(env, cookie, id, { text: 'I wanted to go to the welding course but it runs at seven when I work.' })).body;
    v = (await say(env, cookie, id, { stop: true })).body;
    expect(v.conversation).toMatchObject({ stage: 9, status: 'reviewing' });
    expect(v.points.length).toBeGreaterThanOrEqual(2);
    expect(v.points.every((p) => p.status === 'draft' && p.sourceTurnIds.length === 1)).toBe(true);
    expect(v.points.map((p) => p.type)).toEqual(['moment', 'barrier']);

    // Turns are refused after review.
    expect((await say(env, cookie, id, { text: 'more' })).status).toBe(409);
  });

  it('goes through all eight stages to review at the end', async () => {
    env = await testEnv();
    await assemblies(env);
    const { cookie, id } = await start(env);
    let v: View | undefined;
    for (let i = 0; i < 16; i++) v = (await say(env, cookie, id, { text: `Answer number ${i}. More words here.` })).body;
    expect(v!.conversation).toMatchObject({ stage: 9, status: 'reviewing' });
    const stages = v!.turns.filter((t) => t.role === 'interviewer').map((t) => t.stage);
    expect(stages).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8]);
    expect(v!.points.map((p) => p.type)).toEqual(['moment', 'matters', 'barrier', 'wish', 'idea']);
  });

  it('asks each host probe in stage 7 before the stage can end', async () => {
    env = await testEnv();
    await assemblies(env, ['What would make evening classes possible for you?', 'Who should run them?']);
    const { cookie, id } = await start(env);
    for (let s = 1; s <= 6; s++) await say(env, cookie, id, { skip: true });
    let v: View = (await say(env, cookie, id, { text: 'Saturday classes.' })).body;
    expect(v.conversation.stage).toBe(7);
    expect(lastTurn(v).text).toBe('What would make evening classes possible for you?');
    v = (await say(env, cookie, id, { text: 'A crèche.' })).body;
    expect(v.conversation).toMatchObject({ stage: 7, stageTurns: 2 });
    expect(lastTurn(v).text).toBe('Who should run them?');
    v = (await say(env, cookie, id, { text: 'The college.' })).body;
    expect(v.conversation.stage).toBe(8);
  });

  it('starts the open-listening conversation when no assembly is named', async () => {
    env = await testEnv();
    await assemblies(env);
    const { view } = await start(env, { route: 'ai' });
    expect(view.assembly).toMatchObject({ slug: 'open', isOpenListening: true });
  });

  it('refuses a conversation in an assembly that is not open for them', async () => {
    env = await testEnv();
    await assemblies(env);
    await env.deps.store.put('assemblies', { ...(await env.deps.store.get('assemblies', ASM))!, stage: 'pledged' });
    const res = await request(env.app).post('/api/conversations').send({ assemblySlug: 'riverbend', route: 'ai' });
    expect(res.status).toBe(409);
  });

  it('starting again leaves the unfinished conversation behind', async () => {
    env = await testEnv();
    await assemblies(env);
    const first = await start(env);
    const second = await start(env, { assemblySlug: 'riverbend', route: 'freetext' }, first.cookie);
    expect((await env.deps.store.get('conversations', first.id))!.status).toBe('abandoned');
    const mine = await request(env.app).get('/api/conversations').set('Cookie', first.cookie);
    expect(mine.body.conversations.map((c: { id: string }) => c.id)).toEqual([second.id, first.id]);
  });
});

describe('conversations with the AI interviewer (fake runner)', () => {
  let env: TestEnv;
  afterEach(() => env.close());

  it('stays in a stage until the model says complete after the minimum, then asks the next stage’s question', async () => {
    const f = fakeRunner([
      reply({ acknowledgement: 'Night shift.', question: 'What happened after that?', stage_complete: true }),
      reply({ acknowledgement: 'The bus.', question: 'Who was on the bus?', stage_complete: true }),
      reply({ question: 'Which moment mattered most to you?' }),
    ]);
    env = await testEnv({ config: { anthropicKey: 'k' }, runner: f.runner });
    await assemblies(env);
    const { cookie, id, view } = await start(env);
    expect(view.conversation.mode).toBe('claude');
    expect(f.requests).toHaveLength(0); // The opener is scripted, so the conversation starts at once.
    let v: View = (await say(env, cookie, id, { text: 'I worked the night shift.' })).body;
    // Below the minimum: stage_complete is ignored.
    expect(v.conversation).toMatchObject({ stage: 1, stageTurns: 1 });
    expect(lastTurn(v).text).toBe('Night shift. What happened after that?');
    v = (await say(env, cookie, id, { text: 'I took the bus home.' })).body;
    expect(v.conversation).toMatchObject({ stage: 2, stageTurns: 0 });
    expect(lastTurn(v)).toMatchObject({ text: 'Which moment mattered most to you?', stage: 2 });
    expect(JSON.stringify(f.requests[2]!.messages)).toContain('Current stage: What mattered.');
  });

  it('records a scripted fallback after three refused replies', async () => {
    const bad = reply({ question: 'Have you considered evening classes?' });
    const f = fakeRunner([bad, bad, bad]);
    env = await testEnv({ config: { anthropicKey: 'k' }, runner: f.runner });
    await assemblies(env);
    const { cookie, id } = await start(env);
    const v: View = (await say(env, cookie, id, { text: 'I worked the night shift.' })).body;
    expect(lastTurn(v)).toMatchObject({ text: SCRIPTED_QUESTIONS[1]![1], meta: { regenerated: 2, fallback: true } });
    expect(v.conversation.mode).toBe('claude');
  });

  it('shows the distress message, then carries on or stops as the person chooses', async () => {
    const f = fakeRunner([reply({ safety: 'distress' }), reply({ question: 'What happened after that?' })]);
    env = await testEnv({ config: { anthropicKey: 'k' }, runner: f.runner });
    await assemblies(env);
    const { cookie, id } = await start(env);
    let v: View = (await say(env, cookie, id, { text: 'Everything is too much.' })).body;
    expect(v.safety).toBe('distress');
    expect(v.pending).toBe('distress');
    expect(lastTurn(v).text).toBe(DISTRESS_MESSAGE);
    const again: View = (await request(env.app).get(`/api/conversations/${id}`).set('Cookie', cookie)).body;
    expect(again.pending).toBe('distress');
    v = (await say(env, cookie, id, { resume: true })).body;
    expect(v.pending).toBeNull();
    expect(lastTurn(v).text).toBe('What happened after that?');
  });

  it('appends the note when identifying details are shared', async () => {
    const f = fakeRunner([reply({ acknowledgement: 'The bus.', question: 'What happened next?', safety: 'identifying' })]);
    env = await testEnv({ config: { anthropicKey: 'k' }, runner: f.runner });
    await assemblies(env);
    const { cookie, id } = await start(env);
    const v: View = (await say(env, cookie, id, { text: 'I live at 12 Mill Street.' })).body;
    expect(v.safety).toBe('identifying');
    expect(lastTurn(v).text).toBe(`The bus. What happened next? ${IDENTIFYING_NOTE}`);
  });

  it('moves to scripted mode when the spending cap is reached', async () => {
    env = await testEnv({ config: { anthropicKey: 'k', aiDailyUsd: 0 }, runner: fakeRunner([]).runner });
    await assemblies(env);
    const { cookie, id } = await start(env);
    const v: View = (await say(env, cookie, id, { text: 'I worked.' })).body;
    expect(v.conversation.mode).toBe('scripted');
    expect(lastTurn(v).text).toBe(SCRIPTED_QUESTIONS[1]![1]);
  });
});

describe('other routes', () => {
  let env: TestEnv;
  afterEach(() => env.close());

  it('written questions: one stage per screen, with the questions shown', async () => {
    env = await testEnv();
    await assemblies(env);
    const { cookie, id, view } = await start(env, { assemblySlug: 'riverbend', route: 'questions' });
    expect(view.turns).toHaveLength(0);
    expect(view.questions).toEqual(SCRIPTED_QUESTIONS[1]);
    let v: View = (await say(env, cookie, id, { answers: ['I worked nights. It was long.', ''] })).body;
    expect(v.conversation.stage).toBe(2);
    expect(v.questions).toEqual(SCRIPTED_QUESTIONS[2]);
    expect(v.turns.map((t) => t.role)).toEqual(['interviewer', 'person']);
    v = (await say(env, cookie, id, { skip: true })).body;
    expect(v.conversation.stage).toBe(3);
    v = (await say(env, cookie, id, { stop: true })).body;
    expect(v.conversation.status).toBe('reviewing');
    expect(v.points).toHaveLength(1);
    expect(v.points[0]).toMatchObject({ type: 'moment', text: 'I worked nights.' });
  });

  it('free writing: one box, then points drawn from it', async () => {
    env = await testEnv();
    await assemblies(env);
    const { cookie, id } = await start(env, { assemblySlug: 'riverbend', route: 'freetext' });
    const v: View = (await say(env, cookie, id, { text: 'The bus is late every day. I miss the start of my shift. I want evening classes.' })).body;
    expect(v.conversation.status).toBe('reviewing');
    expect(v.points.map((p) => p.text)).toEqual(['The bus is late every day.', 'I miss the start of my shift.', 'I want evening classes.']);
  });
});

describe('review and approval', () => {
  let env: TestEnv;
  afterEach(() => env.close());

  it('edits, scraps and adds points; approving creates the membership and bumps the version', async () => {
    env = await testEnv();
    await assemblies(env);
    const { cookie, id } = await start(env, { assemblySlug: 'riverbend', route: 'freetext' });
    const v: View = (await say(env, cookie, id, { text: 'The bus is late every day. I miss the start of my shift. I want evening classes.' })).body;
    const [a, b] = v.points;
    const edited = await request(env.app).patch(`/api/points/${a!.id}`).set('Cookie', cookie).send({ text: 'The 5am bus is late most days', visibility: 'named' });
    expect(edited.body.point).toMatchObject({ text: 'The 5am bus is late most days', draftText: 'The bus is late every day.', visibility: 'named' });
    await request(env.app).patch(`/api/points/${b!.id}`).set('Cookie', cookie).send({ status: 'scrapped' });
    const added = await request(env.app).post(`/api/conversations/${id}/points`).set('Cookie', cookie).send({ type: 'idea', text: 'Record the classes', visibility: 'count' });
    expect(added.status).toBe(201);
    expect(added.body.point).toMatchObject({ sourceTurnIds: [], status: 'draft' });

    const before = (await env.deps.store.get('assemblies', ASM))!.version;
    const personId = v.conversation.personId;
    expect(await env.deps.store.count('memberships', { personId })).toBe(0);
    // Exit questions come after approval.
    expect((await request(env.app).post(`/api/conversations/${id}/exit`).set('Cookie', cookie).send({ soundsLikeMe: 3, pushed: 'no' })).status).toBe(409);

    const done: View = (await request(env.app).post(`/api/conversations/${id}/approve`).set('Cookie', cookie)).body;
    expect(done.conversation.status).toBe('complete');
    expect(done.points.map((p) => [p.text, p.status])).toEqual([
      ['The 5am bus is late most days', 'approved'],
      ['I miss the start of my shift.', 'scrapped'],
      ['I want evening classes.', 'approved'],
      ['Record the classes', 'approved'],
    ]);
    expect(await env.deps.store.list('memberships', { personId })).toMatchObject([{ assemblyId: ASM, role: 'participant', invited: false }]);
    expect((await env.deps.store.get('assemblies', ASM))!.version).toBe(before + 1);

    // Rule 1 now lets them in.
    const view = await request(env.app).get('/api/assemblies/riverbend').set('Cookie', cookie);
    expect(view.body.heard).toBe(true);

    const exit = await request(env.app).post(`/api/conversations/${id}/exit`).set('Cookie', cookie).send({ soundsLikeMe: 3, pushed: 'a_little', note: 'It asked about my daughter twice.' });
    expect(exit.body.conversation.exit).toEqual({ soundsLikeMe: 3, pushed: 'a_little', note: 'It asked about my daughter twice.' });

    // Once shared, words are fixed but the point can be withdrawn.
    expect((await request(env.app).patch(`/api/points/${a!.id}`).set('Cookie', cookie).send({ text: 'new words' })).status).toBe(409);
    const w = await request(env.app).patch(`/api/points/${a!.id}`).set('Cookie', cookie).send({ status: 'withdrawn' });
    expect(w.body.point.status).toBe('withdrawn');
  });
});

describe('rule 2: only the owner can read a conversation', () => {
  let env: TestEnv;
  afterEach(() => env.close());

  it('refuses another person, a host and a steward', async () => {
    env = await testEnv();
    await assemblies(env);
    const owner = await start(env);
    await say(env, owner.cookie, owner.id, { text: 'Something private about my day.' });
    const reviewed: View = (await say(env, owner.cookie, owner.id, { stop: true })).body;
    const pointId = reviewed.points[0]!.id;

    const other = (await start(env)).cookie;
    const host = [...(await start(env)).cookie, ...(await roleCookie(env, 'host'))];
    const steward = [...(await start(env)).cookie, ...(await roleCookie(env, 'steward'))];
    const roleOnly = await roleCookie(env, 'steward');

    for (const cookie of [other, host, steward, roleOnly]) {
      const get = await request(env.app).get(`/api/conversations/${owner.id}`).set('Cookie', cookie);
      expect(get.status).toBe(403);
      expect(JSON.stringify(get.body)).not.toContain('Something private');
      expect((await say(env, cookie, owner.id, { text: 'hijack' })).status).toBe(403);
      expect((await request(env.app).patch(`/api/points/${pointId}`).set('Cookie', cookie).send({ text: 'changed' })).status).toBe(403);
      expect((await request(env.app).post(`/api/conversations/${owner.id}/points`).set('Cookie', cookie).send({ type: 'idea', text: 'x' })).status).toBe(403);
      expect((await request(env.app).post(`/api/conversations/${owner.id}/approve`).set('Cookie', cookie)).status).toBe(403);
      expect((await request(env.app).post(`/api/conversations/${owner.id}/consent`).set('Cookie', cookie)).status).toBe(403);
    }
    expect((await request(env.app).get(`/api/conversations/${owner.id}`)).status).toBe(403);
    const mine = await request(env.app).get(`/api/conversations/${owner.id}`).set('Cookie', owner.cookie);
    expect(mine.status).toBe(200);
  });
});

describe('the host route and its one-time link', () => {
  let env: TestEnv;
  afterEach(() => env.close());

  it('a host enters draft points; the person approves them once through the link', async () => {
    env = await testEnv();
    await assemblies(env);
    const points = [
      { type: 'barrier', text: 'The classes are at seven when I work' },
      { type: 'idea', text: 'Saturday mornings' },
    ];
    const refused = await request(env.app).post('/api/conversations').send({ assemblySlug: 'riverbend', route: 'host', points });
    expect(refused.status).toBe(403);

    const host = await roleCookie(env, 'host');
    const created = await request(env.app).post('/api/conversations').set('Cookie', host).send({ assemblySlug: 'riverbend', route: 'host', language: 'en-GB', points });
    expect(created.status).toBe(201);
    const { conversationId, approvePath } = created.body;
    expect(approvePath).toMatch(/^\/approve\/[A-Za-z0-9_-]{32}$/);
    expect(approvePath).not.toContain(conversationId.slice(4));
    const stored = await env.deps.store.list('points', { conversationId });
    expect(stored.map((p) => p.status)).toEqual(['draft', 'draft']);
    // The host cannot read it back.
    expect((await request(env.app).get(`/api/conversations/${conversationId}`).set('Cookie', host)).status).toBe(403);

    const token = approvePath.split('/').pop();
    const look = await request(env.app).get(`/api/approve/${token}`);
    expect(look.status).toBe(200);
    expect(look.body.points.map((p: { text: string }) => p.text)).toEqual(points.map((p) => p.text));
    expect(look.body.assembly.slug).toBe('riverbend');
    expect((await request(env.app).get('/api/approve/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')).status).toBe(404);

    const before = (await env.deps.store.get('assemblies', ASM))!.version;
    const done = await request(env.app)
      .post(`/api/approve/${token}`)
      .send({ points: [{ id: stored[1]!.id, status: 'scrapped' }, { id: stored[0]!.id, text: 'Classes are at seven, when I am at work', visibility: 'count' }], added: [{ type: 'wish', text: 'Home by four' }] });
    expect(done.status).toBe(200);
    const personId = done.body.conversation.personId;
    expect(done.body.conversation).toMatchObject({ status: 'complete', route: 'host' });
    expect(done.body.points.map((p: { text: string; status: string; personId: string }) => [p.text, p.status, p.personId])).toEqual([
      ['Classes are at seven, when I am at work', 'approved', personId],
      ['Saturday mornings', 'scrapped', personId],
      ['Home by four', 'approved', personId],
    ]);
    expect(await env.deps.store.count('memberships', { personId, assemblyId: ASM })).toBe(1);
    expect((await env.deps.store.get('assemblies', ASM))!.version).toBe(before + 1);
    // The person now owns it.
    const cookie = String(done.headers['set-cookie']).split(';')[0]!;
    expect((await request(env.app).get(`/api/conversations/${conversationId}`).set('Cookie', cookie)).status).toBe(200);

    // One time only.
    expect((await request(env.app).get(`/api/approve/${token}`)).status).toBe(404);
    expect((await request(env.app).post(`/api/approve/${token}`).send({})).status).toBe(404);
  });
});
