import { describe, expect, it } from 'vitest';
import type { RoomMessage } from '@unite/shared';
import { dominantSpeaker, dueTrigger, firedTriggers, invitesOpen, makeRoomGapMs, phaseAt, wordingLeadMs } from '../src/services/rooms/triggers.js';

const START = Date.parse('2026-11-13T09:00:00.000Z');
const MIN = 60_000;
const members = ['per_A', 'per_B', 'per_C'];
const room = (minutes = 40) => ({
  status: 'open' as const,
  memberIds: members,
  startedAt: new Date(START).toISOString(),
  endsAt: new Date(START + minutes * MIN).toISOString(),
});

type Msg = Pick<RoomMessage, 'authorType' | 'personId' | 'createdAt'>;
const at = (m: number) => new Date(START + m * MIN).toISOString();
const say = (personId: string, m = 1): Msg => ({ authorType: 'person', personId, createdAt: at(m) });
const fac = (m: number, personId?: string): Msg => ({ authorType: 'facilitator', ...(personId ? { personId } : {}), createdAt: at(m) });
const welcomed = [fac(0)];

describe('facilitator triggers', () => {
  it('welcomes when the room opens, once', () => {
    expect(dueTrigger(room(), [], START)).toEqual({ kind: 'welcome' });
    expect(dueTrigger(room(), welcomed, START)).toBeUndefined();
  });

  it('does nothing in a room that is not open', () => {
    expect(dueTrigger({ ...room(), status: 'scheduled' }, [], START)).toBeUndefined();
    expect(dueTrigger({ ...room(), status: 'closed' }, [], START + 50 * MIN)).toBeUndefined();
  });

  it('invites the one person who has not spoken once everyone else has, once per person', () => {
    const msgs = [...welcomed, say('per_A'), say('per_B')];
    // Nobody has spoken yet: nobody is singled out.
    expect(dueTrigger(room(), welcomed, START + MIN)).toBeUndefined();
    expect(dueTrigger(room(), msgs, START + 2 * MIN)).toEqual({ kind: 'invite', personId: 'per_C' });
    const after = [...msgs, fac(2, 'per_C')];
    expect(firedTriggers(room(), after).invited.has('per_C')).toBe(true);
    expect(dueTrigger(room(), after, START + 3 * MIN)).toBeUndefined();
  });

  it('with several silent people, invites them one at a time', () => {
    // Only A has spoken: B and C are both silent, so B is invited first, then C.
    const msgs = [...welcomed, say('per_A')];
    expect(dueTrigger(room(), msgs, START + MIN)).toEqual({ kind: 'invite', personId: 'per_B' });
    expect(dueTrigger(room(), [...msgs, fac(1, 'per_B')], START + MIN)).toEqual({ kind: 'invite', personId: 'per_C' });
  });

  it('makes room when one person has more than 40% of the last 10 messages, at most once every five minutes', () => {
    const all = ['per_A', 'per_B', 'per_C'];
    const base = [...welcomed, ...all.map((p) => say(p))];
    const burst = [...base, say('per_A', 2), say('per_A', 2), say('per_B', 2), say('per_A', 2), say('per_A', 2)];
    expect(dominantSpeaker(burst)).toBe('per_A');
    expect(dueTrigger(room(), burst, START + 3 * MIN)).toEqual({ kind: 'make_room', personId: 'per_A' });
    const thanked = [...burst, fac(3, 'per_A'), say('per_A', 4)];
    expect(firedTriggers(room(), thanked).madeRoomAt).toHaveLength(1);
    expect(dueTrigger(room(), thanked, START + 4 * MIN)).toBeUndefined();
    expect(dueTrigger(room(), thanked, START + 8 * MIN)).toEqual({ kind: 'make_room', personId: 'per_A' });
  });

  it('does not make room for an even conversation', () => {
    const even = [...welcomed, ...Array.from({ length: 12 }, (_, i) => say(members[i % 3]!))];
    expect(dominantSpeaker(even)).toBeUndefined();
    expect(dueTrigger(room(), even, START + 5 * MIN)).toBeUndefined();
  });

  it('marks half time once', () => {
    const msgs = [...welcomed, ...members.map((p) => say(p))];
    expect(dueTrigger(room(40), msgs, START + 20 * MIN)).toEqual({ kind: 'half_time' });
    expect(dueTrigger(room(40), [...msgs, fac(20)], START + 21 * MIN)).toBeUndefined();
  });

  it('asks for wording with five minutes left, once', () => {
    const msgs = [...welcomed, ...members.map((p) => say(p)), fac(20)];
    expect(dueTrigger(room(40), msgs, START + 35 * MIN)).toEqual({ kind: 'wording' });
    expect(dueTrigger(room(40), [...msgs, fac(35)], START + 36 * MIN)).toBeUndefined();
  });

  it('asks for private final answers when time is up, once, and nothing else after', () => {
    const msgs = [...welcomed, say('per_A'), say('per_B')];
    expect(dueTrigger(room(40), msgs, START + 40 * MIN)).toEqual({ kind: 'final' });
    // per_C never spoke, but nobody is invited once time is up.
    expect(dueTrigger(room(40), [...msgs, fac(40)], START + 41 * MIN)).toBeUndefined();
  });

  it('does not announce a missed half time late, and skips half time in short rooms', () => {
    expect(phaseAt(room(8), START + 4 * MIN)).toBe('wording');
    const msgs = [...welcomed, ...members.map((p) => say(p))];
    expect(dueTrigger(room(40), msgs, START + 36 * MIN)).toEqual({ kind: 'wording' });
  });
});

describe('facilitator triggers in a slow room', () => {
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  const slow = (days = 5) => ({ ...room(days * 1440), pace: 'slow' as const });
  const atH = (h: number) => new Date(START + h * HOUR).toISOString();
  const sayH = (personId: string, h: number): Msg => ({ authorType: 'person', personId, createdAt: atH(h) });
  const facH = (h: number, personId?: string): Msg => ({ authorType: 'facilitator', ...(personId ? { personId } : {}), createdAt: atH(h) });

  it('welcomes when the room opens, as a live room does', () => {
    expect(dueTrigger(slow(), [], START)).toEqual({ kind: 'welcome' });
    expect(dueTrigger(slow(), [facH(0)], START)).toBeUndefined();
  });

  it('starts the wording phase when a fifth of the time is left, not five minutes before the end', () => {
    // Five days: the last fifth is the last day.
    expect(wordingLeadMs({ pace: 'slow' }, 5 * DAY)).toBe(DAY);
    expect(phaseAt(slow(5), START + 4 * DAY - MIN)).toBe('half_time');
    expect(phaseAt(slow(5), START + 4 * DAY)).toBe('wording');
    expect(phaseAt(slow(5), START + 5 * DAY - 6 * MIN)).toBe('wording');
    // Two days: the last 9.6 hours.
    expect(phaseAt(slow(2), START + 2 * DAY - 10 * HOUR)).toBe('half_time');
    expect(phaseAt(slow(2), START + 2 * DAY - 9 * HOUR)).toBe('wording');
    const msgs = [facH(0), ...members.map((p) => sayH(p, 1)), facH(60)];
    expect(dueTrigger(slow(5), msgs, START + 4 * DAY)).toEqual({ kind: 'wording' });
    expect(dueTrigger(slow(5), [...msgs, facH(96)], START + 4 * DAY + HOUR)).toBeUndefined();
  });

  it('marks half time half way through the days, and time up at the end', () => {
    const msgs = [facH(0), ...members.map((p) => sayH(p, 1))];
    expect(dueTrigger(slow(4), msgs, START + 2 * DAY)).toEqual({ kind: 'half_time' });
    expect(dueTrigger(slow(4), [...msgs, facH(48)], START + 4 * DAY)).toEqual({ kind: 'final' });
  });

  it('invites a silent member only once a day has passed since the room opened', () => {
    const msgs = [facH(0), sayH('per_A', 1), sayH('per_B', 2)];
    expect(invitesOpen(slow(), START + DAY - MIN)).toBe(false);
    expect(dueTrigger(slow(), msgs, START + 23 * HOUR)).toBeUndefined();
    expect(dueTrigger(slow(), msgs, START + DAY - MIN)).toBeUndefined();
    expect(invitesOpen(slow(), START + DAY)).toBe(true);
    expect(dueTrigger(slow(), msgs, START + DAY)).toEqual({ kind: 'invite', personId: 'per_C' });
    expect(dueTrigger(slow(), [...msgs, facH(24, 'per_C')], START + DAY + HOUR)).toBeUndefined();
  });

  it('makes room at most once every six hours', () => {
    const base = [facH(0), ...members.map((p) => sayH(p, 1))];
    const burst = [...base, sayH('per_A', 2), sayH('per_A', 2), sayH('per_B', 2), sayH('per_A', 2), sayH('per_A', 2)];
    expect(makeRoomGapMs({ pace: 'slow' })).toBe(6 * HOUR);
    expect(dueTrigger(slow(), burst, START + 3 * HOUR)).toEqual({ kind: 'make_room', personId: 'per_A' });
    const thanked = [...burst, facH(3, 'per_A'), sayH('per_A', 4)];
    // Five minutes is enough in a live room, but not here.
    expect(dueTrigger(slow(), thanked, START + 3 * HOUR + 10 * MIN)).toBeUndefined();
    expect(dueTrigger(slow(), thanked, START + 9 * HOUR - MIN)).toBeUndefined();
    expect(dueTrigger(slow(), thanked, START + 9 * HOUR)).toEqual({ kind: 'make_room', personId: 'per_A' });
  });

  it('leaves live rooms on their own timings', () => {
    expect(wordingLeadMs({}, 40 * MIN)).toBe(5 * MIN);
    expect(wordingLeadMs({ pace: 'live' }, 40 * MIN)).toBe(5 * MIN);
    expect(makeRoomGapMs({})).toBe(5 * MIN);
    expect(invitesOpen(room(), START)).toBe(true);
    expect(phaseAt({ ...room(40), pace: 'live' }, START + 35 * MIN)).toBe('wording');
    expect(phaseAt({ ...room(40), pace: 'live' }, START + 34 * MIN)).toBe('half_time');
  });
});
