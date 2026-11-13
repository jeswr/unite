import request from 'supertest';
import { stableId } from '@unite/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FACILITATOR_FALLBACK } from '../src/ai/prompts.js';
import { resetFacilitatorTimers } from '../src/services/rooms/rooms.js';
import { makeEvidenceCard, makeRoom } from '../src/seed/builders.js';
import { ASM, asRole, makeFixtureAssembly, person, reactAs, SLUG, statement, type TestPerson } from './rooms.fixture.js';
import { testEnv, type TestEnv } from './helpers.js';

let env: TestEnv;
let people: TestPerson[];
let steward: string[];
const EVD = stableId('evd', 'rt/1');

beforeEach(async () => {
  env = await testEnv();
  resetFacilitatorTimers();
  await makeFixtureAssembly(env);
  people = [];
  for (const name of ['Amina', 'Bo', 'Carys', 'Dev', 'Ellie', 'Femi', 'Gus', 'Hana']) people.push(await person(env, { name }));
  people.push(await person(env)); // no display name
  steward = await asRole(env, 'steward');
  await makeEvidenceCard(
    { store: env.deps.store, clock: env.clock },
    {
      id: EVD,
      assemblyId: ASM,
      question: 'Does paid learning time work?',
      answer: 'In some places.',
      sources: [{ title: 'A report', url: 'https://example.org/report' }],
      confidence: 'medium',
      disputed: 'Some experts say the effect is small.',
      expertName: 'Dr Lee',
      expertRole: 'Economist',
    },
  );
});
afterEach(() => env.close());

const get = (path: string, cookie: string[]) => request(env.app).get(path).set('Cookie', cookie);
const post = (path: string, cookie: string[], body: object = {}) => request(env.app).post(path).set('Cookie', cookie).send(body);

/** A scheduled room with these members, made directly. */
async function roomWith(members: TestPerson[], extra: { statementId?: string; minutes?: number } = {}) {
  const id = stableId('room', `rt/${Math.random()}`);
  await makeRoom(
    { store: env.deps.store, clock: env.clock },
    {
      id,
      assemblyId: ASM,
      topic: 'Paid learning hours',
      briefing: { summary: 'Should time to learn be paid?', forSide: ['Nobody should lose pay'], againstSide: ['Employers bear the cost'], evidenceIds: [EVD] },
      memberIds: members.map((m) => m.id),
      minutes: extra.minutes ?? 40,
      ...(extra.statementId ? { statementId: extra.statementId } : {}),
    },
  );
  return id;
}

describe('drawing a room', () => {
  it('draws 6 invited, heard people by lot, balanced across opinion groups, as scheduled', async () => {
    const outsider = await person(env, { name: 'Uninvited', invited: false });
    const notHeard = await person(env, { name: 'Not heard', heard: false });
    const sts = [];
    for (const k of ['1', '2', '3', '4']) sts.push(await statement(env, k, 'differ'));
    // First four agree with everything, the next four disagree: two opinion groups.
    for (const [i, p] of people.slice(0, 8).entries()) for (const s of sts) await reactAs(env, p.id, s.id, i < 4 ? 'agree' : 'disagree');

    const res = await post(`/api/assemblies/${SLUG}/rooms`, steward, {
      topic: 'Paid learning hours',
      statementId: sts[0]!.id,
      briefing: { summary: 'Both sides', forSide: ['For'], againstSide: ['Against'], evidenceIds: [EVD] },
      seed: 'fixed',
    });
    expect(res.status).toBe(201);
    const room = res.body.room;
    expect(room).toMatchObject({ status: 'scheduled', minutes: 45, topic: 'Paid learning hours' });
    expect(room.memberIds).toHaveLength(6);
    expect(room.memberIds).not.toContain(outsider.id);
    expect(room.memberIds).not.toContain(notHeard.id);
    const groupA = people.slice(0, 4).map((p) => p.id);
    const groupB = people.slice(4, 8).map((p) => p.id);
    expect(room.memberIds.filter((id: string) => groupA.includes(id))).toHaveLength(3);
    expect(room.memberIds.filter((id: string) => groupB.includes(id))).toHaveLength(3);
  });

  it('is for hosts and stewards only, and refuses when too few people are free', async () => {
    expect((await post(`/api/assemblies/${SLUG}/rooms`, people[0]!.cookie, { topic: 'x' })).status).toBe(403);
    expect((await post(`/api/assemblies/${SLUG}/rooms`, steward, { topic: 'One' })).status).toBe(201);
    const second = await post(`/api/assemblies/${SLUG}/rooms`, steward, { topic: 'Two' });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('too_few_people');
  });
});

describe('room lifecycle and messages', () => {
  it('opens with times from the clock and the facilitator welcome', async () => {
    const id = await roomWith(people.slice(0, 3));
    const opened = await post(`/api/rooms/${id}/open`, steward);
    expect(opened.status).toBe(200);
    expect(opened.body.room).toMatchObject({ status: 'open', startedAt: '2026-11-13T09:00:00.000Z', endsAt: '2026-11-13T09:40:00.000Z' });
    const msgs = await get(`/api/rooms/${id}/messages`, people[0]!.cookie);
    expect(msgs.body.messages).toEqual([
      expect.objectContaining({ authorType: 'facilitator', author: 'Facilitator (AI)', text: FACILITATOR_FALLBACK.welcome, mine: false }),
    ]);
  });

  it('only members can post and read messages; 600 characters at most', async () => {
    const id = await roomWith(people.slice(0, 3));
    await post(`/api/rooms/${id}/open`, steward);
    const outsider = people[5]!;
    expect((await post(`/api/rooms/${id}/messages`, outsider.cookie, { text: 'Hello' })).status).toBe(403);
    expect((await get(`/api/rooms/${id}/messages`, outsider.cookie)).status).toBe(403);
    expect((await get(`/api/rooms/${id}/messages`, steward)).status).toBe(403);
    expect((await post(`/api/rooms/${id}/messages`, people[0]!.cookie, { text: 'x'.repeat(601) })).status).toBe(400);
    const ok = await post(`/api/rooms/${id}/messages`, people[0]!.cookie, { text: 'I work nights.' });
    expect(ok.status).toBe(201);
    expect(ok.body.message).toMatchObject({ author: 'Amina', mine: true, text: 'I work nights.' });

    const all = await get(`/api/rooms/${id}/messages`, people[1]!.cookie);
    const first = all.body.messages[0].id;
    const after = await get(`/api/rooms/${id}/messages?after=${first}`, people[1]!.cookie);
    expect(after.body.messages.map((m: { text: string }) => m.text)[0]).toBe('I work nights.');
    // A person never sees another person's id.
    expect(JSON.stringify(all.body)).not.toContain(people[0]!.id);
  });

  it('invites the silent member by name after the others have spoken', async () => {
    const id = await roomWith([people[0]!, people[1]!, people[8]!]);
    await post(`/api/rooms/${id}/open`, steward);
    await post(`/api/rooms/${id}/messages`, people[0]!.cookie, { text: 'First.' });
    const msgs = await get(`/api/rooms/${id}/messages`, people[0]!.cookie);
    // Bo and Member 3 are both silent: Bo is invited first.
    expect(msgs.body.messages.at(-1)).toMatchObject({ author: 'Facilitator (AI)', text: FACILITATOR_FALLBACK.invite!.replace('{name}', 'Bo') });
    await post(`/api/rooms/${id}/messages`, people[1]!.cookie, { text: 'Second.' });
    const again = await get(`/api/rooms/${id}/messages`, people[0]!.cookie);
    expect(again.body.messages.at(-1).text).toBe(FACILITATOR_FALLBACK.invite!.replace('{name}', 'Member 3'));
  });

  it('checks time triggers on polls, no more often than every 15 seconds', async () => {
    const id = await roomWith(people.slice(0, 3), { minutes: 40 });
    await post(`/api/rooms/${id}/open`, steward);
    for (const p of people.slice(0, 3)) await post(`/api/rooms/${id}/messages`, p.cookie, { text: 'Hello.' });
    env.clock.advance(20 * 60_000);
    const half = await get(`/api/rooms/${id}/messages`, people[0]!.cookie);
    expect(half.body.messages.at(-1).text).toBe(FACILITATOR_FALLBACK.half_time);
    env.clock.advance(15 * 60_000); // 35 minutes in: five minutes left
    const five = await get(`/api/rooms/${id}/messages`, people[0]!.cookie);
    expect(five.body.messages.at(-1).text).toBe(FACILITATOR_FALLBACK.wording);
    env.clock.advance(5 * 60_000 - 5_000); // 39:55, checked: nothing due
    const n = (await get(`/api/rooms/${id}/messages`, people[0]!.cookie)).body.messages.length;
    env.clock.advance(10_000); // 40:05: time is up, but the last check was 10 seconds ago
    expect((await get(`/api/rooms/${id}/messages`, people[0]!.cookie)).body.messages.length).toBe(n);
    env.clock.advance(10_000); // 40:15
    const final = await get(`/api/rooms/${id}/messages`, people[0]!.cookie);
    expect(final.body.messages.length).toBe(n + 1);
    expect(final.body.messages.at(-1).text).toBe(FACILITATOR_FALLBACK.final);
    expect((await post(`/api/rooms/${id}/messages`, people[0]!.cookie, { text: 'Late' })).body.error.code).toBe('time_up');
  });

  it('shows the room, names (or "Member 9"), the briefing with its evidence, and whether I am a member', async () => {
    const id = await roomWith([people[0]!, people[8]!]);
    const me = await get(`/api/rooms/${id}`, people[8]!.cookie);
    expect(me.status).toBe(200);
    expect(me.body.isMember).toBe(true);
    expect(me.body.members).toEqual([
      { name: 'Amina', isMe: false },
      { name: 'Member 2', isMe: true },
    ]);
    expect(me.body.room.briefing.evidence[0]).toMatchObject({ question: 'Does paid learning time work?', expertName: 'Dr Lee' });
    const other = await get(`/api/rooms/${id}`, people[3]!.cookie);
    expect(other.body.isMember).toBe(false);
    expect(other.body.members).toEqual([]);
  });

  it('is behind rule 1', async () => {
    const id = await roomWith(people.slice(0, 2));
    const notHeard = await person(env, { name: 'New', heard: false });
    expect((await get(`/api/rooms/${id}`, notHeard.cookie)).body.error.code).toBe('not_heard');
    expect((await get(`/api/assemblies/${SLUG}/rooms`, notHeard.cookie)).status).toBe(403);
    expect((await get(`/api/assemblies/${SLUG}/evidence`, notHeard.cookie)).status).toBe(403);
    const ev = await get(`/api/assemblies/${SLUG}/evidence`, people[0]!.cookie);
    expect(ev.body.evidence[0].sources[0].url).toBe('https://example.org/report');
  });
});

describe('final answers and the outcome', () => {
  it('keeps final answers private: only totals, only once closed', async () => {
    const members = people.slice(0, 3);
    const id = await roomWith(members);
    await post(`/api/rooms/${id}/open`, steward);
    await post(`/api/rooms/${id}/answer`, members[0]!.cookie, { value: 'agree', note: 'My secret note' });
    await post(`/api/rooms/${id}/answer`, members[1]!.cookie, { value: 'disagree' });
    await post(`/api/rooms/${id}/answer`, members[1]!.cookie, { value: 'unsure' }); // changes, not adds
    expect((await post(`/api/rooms/${id}/answer`, people[5]!.cookie, { value: 'agree' })).status).toBe(403);

    const mine = await get(`/api/rooms/${id}`, members[0]!.cookie);
    expect(mine.body.myAnswer).toEqual({ value: 'agree', note: 'My secret note' });
    expect(mine.body.answerTotals).toBeNull();
    const theirs = await get(`/api/rooms/${id}`, members[1]!.cookie);
    expect(JSON.stringify(theirs.body)).not.toContain('My secret note');

    await post(`/api/rooms/${id}/close`, steward);
    for (const who of [members[2]!, people[6]!]) {
      const after = await get(`/api/rooms/${id}`, who.cookie);
      expect(after.body.answerTotals).toEqual({ agree: 1, disagree: 0, unsure: 1, total: 2 });
      expect(JSON.stringify(after.body)).not.toContain('My secret note');
    }
    const list = await get(`/api/assemblies/${SLUG}/rooms`, people[6]!.cookie);
    expect(list.body.closed[0].answers).toEqual({ agree: 1, disagree: 0, unsure: 1, total: 2 });
    expect(JSON.stringify(list.body)).not.toContain('My secret note');
    // Non-members can read the outcome, never the messages.
    expect((await get(`/api/rooms/${id}/messages`, people[6]!.cookie)).status).toBe(403);
  });

  it('members add to the outcome; closing with a wording creates a room candidate statement', async () => {
    const s = await statement(env, 'S2', 'differ', 'Nobody should lose pay to retrain.');
    const members = people.slice(0, 3);
    const id = await roomWith(members, { statementId: s.id });
    await post(`/api/rooms/${id}/open`, steward);
    await post(`/api/rooms/${id}/outcome`, members[0]!.cookie, { kind: 'for', text: 'People cannot afford to stop.' });
    await post(`/api/rooms/${id}/outcome`, members[1]!.cookie, { kind: 'against', text: 'Who pays?' });
    await post(`/api/rooms/${id}/outcome`, members[2]!.cookie, { kind: 'question', text: 'What does it cost?' });
    await post(`/api/rooms/${id}/outcome`, members[2]!.cookie, { kind: 'wording', text: 'Paid learning hours, cost shared.' });
    expect((await post(`/api/rooms/${id}/outcome`, people[6]!.cookie, { kind: 'for', text: 'x' })).status).toBe(403);
    // A member cannot close before time is up.
    expect((await post(`/api/rooms/${id}/close`, members[0]!.cookie)).status).toBe(403);

    const closed = await post(`/api/rooms/${id}/close`, steward);
    expect(closed.status).toBe(200);
    expect(closed.body.room.outcome).toEqual({
      reasonsFor: ['People cannot afford to stop.'],
      reasonsAgainst: ['Who pays?'],
      questionsForExperts: ['What does it cost?'],
      proposedWording: 'Paid learning hours, cost shared.',
    });
    const created = await env.deps.store.get('statements', closed.body.statement.id);
    expect(created).toMatchObject({ origin: 'room', status: 'candidate', version: 2, previousId: s.id, pointIds: s.pointIds, themeIds: s.themeIds, text: 'Paid learning hours, cost shared.' });
    // No facilitator text in the outcome.
    expect(JSON.stringify(closed.body.room.outcome)).not.toContain('Facilitator');
    expect((await post(`/api/rooms/${id}/outcome`, members[0]!.cookie, { kind: 'for', text: 'late' })).status).toBe(409);
  });

  it('a member may close once time is up; no statement without a wording', async () => {
    const s = await statement(env, 'S5', 'differ');
    const id = await roomWith(people.slice(0, 2), { statementId: s.id, minutes: 10 });
    await post(`/api/rooms/${id}/open`, steward);
    env.clock.advance(10 * 60_000);
    const res = await post(`/api/rooms/${id}/close`, people[0]!.cookie);
    expect(res.status).toBe(200);
    expect(res.body.statement).toBeNull();
    expect(await env.deps.store.count('statements', { origin: 'room' })).toBe(0);
  });

  it('lists my room first, then closed summaries', async () => {
    const mine = await roomWith([people[0]!, people[1]!]);
    const list = await get(`/api/assemblies/${SLUG}/rooms`, people[0]!.cookie);
    expect(list.body.myRoom).toMatchObject({ id: mine, status: 'scheduled', members: [{ name: 'Amina', isMe: true }, { name: 'Bo', isMe: false }] });
    const other = await get(`/api/assemblies/${SLUG}/rooms`, people[4]!.cookie);
    expect(other.body.myRoom).toBeNull();
    expect(other.body.others[0]).toMatchObject({ id: mine, status: 'scheduled' });
  });
});
