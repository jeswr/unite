import request from 'supertest';
import { stableId } from '@unite/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fallbackWording } from '../src/ai/facilitator.js';
import { FACILITATOR_FALLBACK } from '../src/ai/prompts.js';
import { resetFacilitatorTimers } from '../src/services/rooms/rooms.js';
import { makeRoom } from '../src/seed/builders.js';
import { ASM, asRole, makeFixtureAssembly, person, SLUG, statement, type TestPerson } from './rooms.fixture.js';
import { testEnv, type TestEnv } from './helpers.js';

/** Slow rooms (section 12.2): open for days, and you write where you stand before you read the others. */

let env: TestEnv;
let people: TestPerson[];
let steward: string[];
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

beforeEach(async () => {
  env = await testEnv();
  resetFacilitatorTimers();
  await makeFixtureAssembly(env);
  people = [];
  for (const name of ['Amina', 'Bo', 'Carys', 'Dev', 'Ellie', 'Femi']) people.push(await person(env, { name }));
  steward = await asRole(env, 'steward');
});
afterEach(() => env.close());

const get = (path: string, cookie: string[]) => request(env.app).get(path).set('Cookie', cookie);
const post = (path: string, cookie: string[], body: object = {}) => request(env.app).post(path).set('Cookie', cookie).send(body);
const texts = (res: request.Response) => (res.body.messages as { text: string }[]).map((m) => m.text);

/** A scheduled room with these members, made directly. */
async function roomWith(members: TestPerson[], extra: { pace?: 'live' | 'slow'; days?: number; statementId?: string } = {}) {
  const id = stableId('room', `slow/${Math.random()}`);
  await makeRoom(
    { store: env.deps.store, clock: env.clock },
    {
      id,
      assemblyId: ASM,
      topic: 'Paid learning hours',
      briefing: { summary: 'Should time to learn be paid?', forSide: ['Nobody should lose pay'], againstSide: ['Employers bear the cost'], evidenceIds: [] },
      memberIds: members.map((m) => m.id),
      minutes: extra.pace === 'slow' ? (extra.days ?? 5) * 1440 : 40,
      ...(extra.pace ? { pace: extra.pace } : {}),
      ...(extra.statementId ? { statementId: extra.statementId } : {}),
    },
  );
  return id;
}

describe('drawing a slow room', () => {
  const briefing = { summary: 'Both sides', forSide: ['For'], againstSide: ['Against'] };

  it('takes its length in days, 2 to 14, five by default, and holds it in minutes', async () => {
    const five = await post(`/api/assemblies/${SLUG}/rooms`, steward, { topic: 'Paid learning hours', pace: 'slow', briefing, seed: 'a' });
    expect(five.status).toBe(201);
    expect(five.body.room).toMatchObject({ status: 'scheduled', pace: 'slow', minutes: 5 * 1440 });
    // The six people are now in an unclosed room, so free them for the next draw.
    await post(`/api/rooms/${five.body.room.id}/close`, steward);
    const three = await post(`/api/assemblies/${SLUG}/rooms`, steward, { topic: 'Paid learning hours', pace: 'slow', days: 3, briefing, seed: 'b' });
    expect(three.body.room).toMatchObject({ pace: 'slow', minutes: 3 * 1440 });
  });

  it('refuses a length outside 2 to 14 days, minutes for a slow room, and days for a live one', async () => {
    for (const days of [1, 15, 2.5]) expect((await post(`/api/assemblies/${SLUG}/rooms`, steward, { topic: 'T', pace: 'slow', days })).status).toBe(400);
    const minutes = await post(`/api/assemblies/${SLUG}/rooms`, steward, { topic: 'T', pace: 'slow', minutes: 45 });
    expect(minutes.status).toBe(400);
    expect(minutes.body.error.code).toBe('bad_length');
    expect((await post(`/api/assemblies/${SLUG}/rooms`, steward, { topic: 'T', days: 3 })).body.error.code).toBe('bad_length');
    expect((await post(`/api/assemblies/${SLUG}/rooms`, steward, { topic: 'T', pace: 'fast' })).status).toBe(400);
  });

  it('leaves a live room as it was: 45 minutes by default and no pace stored', async () => {
    const live = await post(`/api/assemblies/${SLUG}/rooms`, steward, { topic: 'Paid learning hours', briefing, seed: 'c' });
    expect(live.status).toBe(201);
    expect(live.body.room.minutes).toBe(45);
    expect(live.body.room).not.toHaveProperty('pace');
    const stored = (await env.deps.store.get('rooms', live.body.room.id))!;
    expect(stored.pace).toBeUndefined();
  });

  it('opens for its days, with the slow welcome', async () => {
    const id = await roomWith(people.slice(0, 3), { pace: 'slow', days: 5 });
    const opened = await post(`/api/rooms/${id}/open`, steward);
    expect(opened.body.room).toMatchObject({ status: 'open', startedAt: '2026-11-13T09:00:00.000Z', endsAt: '2026-11-18T09:00:00.000Z' });
    const msgs = await get(`/api/rooms/${id}/messages`, people[0]!.cookie);
    expect(texts(msgs)).toEqual([fallbackWording('welcome', undefined, { length: '5 days', timeLeft: '5 days left' })]);
    expect(texts(msgs)[0]).toContain('This room is open for 5 days.');
  });
});

describe('write before you read', () => {
  const said = 'I work nights, so paid hours only help me if I can take them in the day.';
  const outcomeText = 'Night workers need daytime hours they can use.';

  async function slowRoomWithOneMessage() {
    const id = await roomWith(people.slice(0, 3), { pace: 'slow' });
    await post(`/api/rooms/${id}/open`, steward);
    expect((await post(`/api/rooms/${id}/messages`, people[0]!.cookie, { text: said })).status).toBe(201);
    expect((await post(`/api/rooms/${id}/outcome`, people[0]!.cookie, { kind: 'for', text: outcomeText })).status).toBe(200);
    return id;
  }

  it('gives a member who has not written only the facilitator, with mustWriteFirst and the hidden count', async () => {
    const id = await slowRoomWithOneMessage();
    const bo = await get(`/api/rooms/${id}/messages`, people[1]!.cookie);
    expect(bo.status).toBe(200);
    expect(bo.body).toMatchObject({ mustWriteFirst: true, hiddenCount: 1, hiddenPeople: 1 });
    expect(bo.body.messages.every((m: { authorType: string }) => m.authorType === 'facilitator' || m.authorType === 'system')).toBe(true);
    expect(texts(bo)).not.toContain(said);
    // The writer sees everything.
    const amina = await get(`/api/rooms/${id}/messages`, people[0]!.cookie);
    expect(amina.body).toMatchObject({ mustWriteFirst: false, hiddenCount: 0, hiddenPeople: 0 });
    expect(texts(amina)).toContain(said);
  });

  it('no route leaks the held-back messages or what the others added', async () => {
    const id = await slowRoomWithOneMessage();
    const bo = people[1]!;
    const first = (await get(`/api/rooms/${id}/messages`, bo.cookie)).body.messages[0].id as string;
    const reads = [
      await get(`/api/rooms/${id}/messages`, bo.cookie),
      await get(`/api/rooms/${id}/messages?after=${first}`, bo.cookie),
      await get(`/api/rooms/${id}/messages?after=nothing`, bo.cookie),
      await get(`/api/rooms/${id}`, bo.cookie),
      await get(`/api/assemblies/${SLUG}/rooms`, bo.cookie),
      await get(`/api/assemblies/${SLUG}/evidence`, bo.cookie),
      await get(`/api/assemblies/${SLUG}`, bo.cookie),
      await get('/api/me/export', bo.cookie),
    ];
    for (const res of reads) {
      expect(res.status, res.req.path).toBeLessThan(400);
      const body = JSON.stringify(res.body);
      expect(body, res.req.path).not.toContain(said);
      expect(body, res.req.path).not.toContain(outcomeText);
    }
    const detail = reads[3]!.body;
    expect(detail).toMatchObject({ isMember: true, mustWriteFirst: true, hiddenCount: 1, hiddenPeople: 1 });
    expect(detail.room.outcome).toBeNull();
    // Adding to the outcome would answer with what the others added, so it waits too.
    const add = await post(`/api/rooms/${id}/outcome`, bo.cookie, { kind: 'against', text: 'Employers pay twice.' });
    expect(add.status).toBe(409);
    expect(add.body.error.code).toBe('write_first');
    expect(JSON.stringify(add.body)).not.toContain(outcomeText);
    // Answering privately and posting reply with only your own words.
    const answer = await post(`/api/rooms/${id}/answer`, bo.cookie, { value: 'unsure' });
    expect(JSON.stringify(answer.body)).not.toContain(said);
  });

  it('shows everything after the member’s first message', async () => {
    const id = await slowRoomWithOneMessage();
    const bo = people[1]!;
    const posted = await post(`/api/rooms/${id}/messages`, bo.cookie, { text: 'I run a small firm. Cover costs me as much as the wages.' });
    expect(posted.status).toBe(201);
    expect(JSON.stringify(posted.body)).not.toContain(said);
    const after = await get(`/api/rooms/${id}/messages`, bo.cookie);
    expect(after.body).toMatchObject({ mustWriteFirst: false, hiddenCount: 0 });
    expect(texts(after)).toContain(said);
    expect(texts(after).indexOf(said)).toBeLessThan(texts(after).indexOf('I run a small firm. Cover costs me as much as the wages.'));
    const detail = await get(`/api/rooms/${id}`, bo.cookie);
    expect(detail.body.mustWriteFirst).toBe(false);
    expect(detail.body.room.outcome.reasonsFor).toEqual([outcomeText]);
    expect((await post(`/api/rooms/${id}/outcome`, bo.cookie, { kind: 'against', text: 'Employers pay twice.' })).status).toBe(200);
  });

  it('counts people and messages held back separately', async () => {
    const id = await roomWith(people.slice(0, 4), { pace: 'slow' });
    await post(`/api/rooms/${id}/open`, steward);
    await post(`/api/rooms/${id}/messages`, people[0]!.cookie, { text: 'One.' });
    await post(`/api/rooms/${id}/messages`, people[0]!.cookie, { text: 'Two.' });
    await post(`/api/rooms/${id}/messages`, people[1]!.cookie, { text: 'Three.' });
    const res = await get(`/api/rooms/${id}/messages`, people[3]!.cookie);
    expect(res.body).toMatchObject({ mustWriteFirst: true, hiddenCount: 3, hiddenPeople: 2 });
  });

  it('keeps the outcome and messages from people outside the room as before, and shows the outcome once closed', async () => {
    const id = await slowRoomWithOneMessage();
    const outsider = people[5]!;
    expect((await get(`/api/rooms/${id}/messages`, outsider.cookie)).status).toBe(403);
    expect((await get(`/api/rooms/${id}`, outsider.cookie)).body.room.outcome).toBeNull();
    await post(`/api/rooms/${id}/close`, steward);
    const closed = await get(`/api/rooms/${id}`, people[1]!.cookie);
    expect(closed.body.room.outcome.reasonsFor).toEqual([outcomeText]);
    const list = await get(`/api/assemblies/${SLUG}/rooms`, outsider.cookie);
    expect(list.body.closed[0]).toMatchObject({ id, pace: 'slow' });
  });

  it('does not apply to a live room', async () => {
    const id = await roomWith(people.slice(0, 3));
    await post(`/api/rooms/${id}/open`, steward);
    await post(`/api/rooms/${id}/messages`, people[0]!.cookie, { text: said });
    const bo = await get(`/api/rooms/${id}/messages`, people[1]!.cookie);
    expect(bo.body).toMatchObject({ mustWriteFirst: false, hiddenCount: 0, hiddenPeople: 0 });
    expect(texts(bo)).toContain(said);
    const detail = await get(`/api/rooms/${id}`, people[1]!.cookie);
    expect(detail.body).toMatchObject({ mustWriteFirst: false, hiddenCount: 0 });
    expect(detail.body.room.pace).toBe('live');
  });
});

describe('the facilitator in a slow room', () => {
  it('invites a silent member only after the first day, and asks for wording when a fifth of the time is left', async () => {
    const st = await statement(env, 'slow', 'differ');
    const id = await roomWith(people.slice(0, 3), { pace: 'slow', days: 5, statementId: st.id });
    await post(`/api/rooms/${id}/open`, steward);
    await post(`/api/rooms/${id}/messages`, people[0]!.cookie, { text: 'First.' });
    await post(`/api/rooms/${id}/messages`, people[1]!.cookie, { text: 'Second.' });
    const reader = people[0]!.cookie;
    env.clock.advance(23 * HOUR);
    expect(texts(await get(`/api/rooms/${id}/messages`, reader)).at(-1)).toBe('Second.');
    env.clock.advance(HOUR);
    expect(texts(await get(`/api/rooms/${id}/messages`, reader)).at(-1)).toBe(fallbackWording('invite', 'Carys', { length: '5 days', timeLeft: '4 days left' }));
    env.clock.advance(DAY + 12 * HOUR); // two and a half days in: half time
    expect(texts(await get(`/api/rooms/${id}/messages`, reader)).at(-1)).toBe('We are half way through the time, with 2 days left. Come back to write, and to read what others wrote.');
    env.clock.advance(DAY + 12 * HOUR); // four days in: a fifth of the time is left
    expect(texts(await get(`/api/rooms/${id}/messages`, reader)).at(-1)).toBe('1 day left. Does anyone want to suggest a different wording for the statement?');
    env.clock.advance(DAY);
    expect(texts(await get(`/api/rooms/${id}/messages`, reader)).at(-1)).toBe(FACILITATOR_FALLBACK.final);
  });

  it('labels each room live or slow in the list', async () => {
    const slow = await roomWith(people.slice(0, 2), { pace: 'slow' });
    const live = await roomWith(people.slice(2, 4));
    const mine = await get(`/api/assemblies/${SLUG}/rooms`, people[0]!.cookie);
    expect(mine.body.myRoom).toMatchObject({ id: slow, pace: 'slow', minutes: 5 * 1440 });
    expect(mine.body.others).toEqual([expect.objectContaining({ id: live, pace: 'live', minutes: 40 })]);
  });
});
