import { describe, expect, it } from 'vitest';
import type { RoomMessage } from '@unite/shared';
import { dominantSpeaker, dueTrigger, firedTriggers, phaseAt } from '../src/services/rooms/triggers.js';

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
