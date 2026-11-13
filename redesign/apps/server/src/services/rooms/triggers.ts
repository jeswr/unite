import type { Room, RoomMessage } from '@unite/shared';

/**
 * When the facilitator speaks (section 6.4). Code decides; the model only words it. Everything in
 * this file is pure, so each trigger has its own test.
 *
 * Which triggers have already fired is worked out from the stored messages, so it survives a
 * restart and needs no extra field:
 * - a facilitator message addressed to nobody is the time marker for the phase it was written in
 *   (welcome, half time, wording, time up);
 * - a facilitator message addressed to a person (`personId`) is an invitation when that person had
 *   not spoken before it, and a "make room" otherwise.
 *
 * Slow rooms (section 12.2) run the same triggers on stretched timings: the wording phase starts
 * when a fifth of the time is left, "make room" fires at most once every six hours, and nobody is
 * invited until a day has passed since the room opened.
 */

export type TriggerKind = 'welcome' | 'invite' | 'make_room' | 'half_time' | 'wording' | 'final';

export interface Trigger {
  kind: TriggerKind;
  /** The person invited, or the person thanked before others are asked to speak. */
  personId?: string;
}

export const FIVE_MINUTES_MS = 5 * 60 * 1000;
export const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;
/** How often polling may re-check the triggers. */
export const POLL_CHECK_MS = 15 * 1000;
/** Make room when one person wrote at least this many of the last `RECENT_WINDOW` messages (more than 40%). */
export const RECENT_WINDOW = 10;
export const DOMINANT_COUNT = 5;

type TimePhase = 'welcome' | 'half_time' | 'wording' | 'final';
type RoomTimes = Pick<Room, 'startedAt' | 'endsAt'> & Partial<Pick<Room, 'pace'>>;
type Msg = Pick<RoomMessage, 'authorType' | 'personId' | 'createdAt'>;

const isSlow = (room: Partial<Pick<Room, 'pace'>>) => room.pace === 'slow';

/** How long before the end the wording phase starts: five minutes live, a fifth of the time in a slow room. */
export function wordingLeadMs(room: Partial<Pick<Room, 'pace'>>, lengthMs: number): number {
  return isSlow(room) ? lengthMs / 5 : FIVE_MINUTES_MS;
}

/** The shortest gap between two "make room" messages: five minutes live, six hours in a slow room. */
export function makeRoomGapMs(room: Partial<Pick<Room, 'pace'>>): number {
  return isSlow(room) ? SIX_HOURS_MS : FIVE_MINUTES_MS;
}

/** Whether silent members may be invited yet: at once live, and only once a day has passed in a slow room. */
export function invitesOpen(room: RoomTimes, now: number): boolean {
  if (!isSlow(room)) return true;
  const start = Date.parse(room.startedAt ?? '');
  return !Number.isNaN(start) && now - start >= ONE_DAY_MS;
}

/** The time phase a moment falls in. Half time is skipped when it would fall in the wording phase. */
export function phaseAt(room: RoomTimes, at: number): TimePhase {
  const start = Date.parse(room.startedAt ?? '');
  const end = Date.parse(room.endsAt ?? '');
  if (Number.isNaN(start) || Number.isNaN(end)) return 'welcome';
  const half = start + (end - start) / 2;
  const wordingFrom = end - wordingLeadMs(room, end - start);
  if (at >= end) return 'final';
  if (at >= wordingFrom) return 'wording';
  if (at >= half) return 'half_time';
  return 'welcome';
}

export interface Fired {
  markers: Set<TimePhase>;
  invited: Set<string>;
  /** When each "make room" message was written (ms). */
  madeRoomAt: number[];
}

/** Which triggers have already fired, from the messages in the order they were written. */
export function firedTriggers(room: RoomTimes, messages: Msg[]): Fired {
  const fired: Fired = { markers: new Set(), invited: new Set(), madeRoomAt: [] };
  const spoken = new Set<string>();
  for (const m of messages) {
    if (m.authorType === 'person' && m.personId) spoken.add(m.personId);
    if (m.authorType !== 'facilitator') continue;
    const at = Date.parse(m.createdAt);
    if (!m.personId) fired.markers.add(phaseAt(room, at));
    else if (!spoken.has(m.personId)) fired.invited.add(m.personId);
    else fired.madeRoomAt.push(at);
  }
  return fired;
}

/**
 * The silent member to invite, if any: the first member (in room order) who has not spoken and
 * has not been invited, once every other member has spoken or been invited, and someone has
 * spoken. With one silent member this is exactly "everyone else has spoken once"; with several,
 * they are invited one at a time.
 */
export function inviteDue(memberIds: string[], messages: Msg[], invited: Set<string>): string | undefined {
  const spoken = new Set(messages.filter((m) => m.authorType === 'person' && m.personId).map((m) => m.personId!));
  if (spoken.size === 0) return undefined;
  const waiting = memberIds.filter((id) => !spoken.has(id) && !invited.has(id));
  return waiting[0];
}

/** The person who wrote more than 40% of the last ten person messages, if anyone did. */
export function dominantSpeaker(messages: Msg[]): string | undefined {
  const recent = messages.filter((m) => m.authorType === 'person' && m.personId).slice(-RECENT_WINDOW);
  const counts = new Map<string, number>();
  for (const m of recent) counts.set(m.personId!, (counts.get(m.personId!) ?? 0) + 1);
  for (const [id, n] of counts) if (n >= DOMINANT_COUNT) return id;
  return undefined;
}

/**
 * The trigger that is due now, if any; at most one per check, so the facilitator never speaks
 * twice at once. Time markers come first (each once per room, and only the current phase's, so a
 * missed half time is not announced late), then invitations (once per person; in a slow room only
 * after the first day), then making room (at most once every five minutes, or six hours in a slow
 * room). Nothing but "time up" fires once the time is over.
 */
export function dueTrigger(
  room: Pick<Room, 'status' | 'memberIds' | 'startedAt' | 'endsAt'> & Partial<Pick<Room, 'pace'>>,
  messages: Msg[],
  now: number,
): Trigger | undefined {
  if (room.status !== 'open' || !room.startedAt || !room.endsAt) return undefined;
  const fired = firedTriggers(room, messages);
  const phase = phaseAt(room, now);
  if (!fired.markers.has(phase)) return { kind: phase };
  if (phase === 'final') return undefined;

  const invite = invitesOpen(room, now) ? inviteDue(room.memberIds, messages, fired.invited) : undefined;
  if (invite) return { kind: 'invite', personId: invite };

  const dominant = dominantSpeaker(messages);
  const last = fired.madeRoomAt.length ? Math.max(...fired.madeRoomAt) : -Infinity;
  if (dominant && now - last >= makeRoomGapMs(room)) {
    // Only when they have written since the last "make room", so one burst is answered once.
    const lastMakeRoomIndex = lastIndex(messages, (m) => m.authorType === 'facilitator' && Date.parse(m.createdAt) === last);
    const since = messages.slice(lastMakeRoomIndex + 1).filter((m) => m.authorType === 'person' && m.personId === dominant).length;
    if (since > 0) return { kind: 'make_room', personId: dominant };
  }
  return undefined;
}

function lastIndex<T>(items: T[], test: (t: T) => boolean): number {
  for (let i = items.length - 1; i >= 0; i--) if (test(items[i]!)) return i;
  return -1;
}
