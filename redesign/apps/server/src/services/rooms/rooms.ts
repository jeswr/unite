import {
  type AnswerTotals,
  type Assembly,
  type EvidenceCard,
  newId,
  opinionGroups,
  type Room,
  type RoomAnswer,
  type RoomMessage,
  type RoomMessageView,
  type RoomPace,
  type Statement,
  timeLeftWords,
} from '@unite/shared';
import { daysWords, wordFacilitator } from '../../ai/facilitator.js';
import type { Deps } from '../../deps.js';
import { HttpError } from '../../errors.js';
import type { Store } from '../../store/types.js';
import { bumpVersion } from '../../version.js';
import { drawRoom } from './draw.js';
import { dueTrigger, POLL_CHECK_MS } from './triggers.js';

export const FACILITATOR_NAME = 'Facilitator (AI)';
export const MESSAGE_MAX = 600;

/** "Amina", or "Member 3" for someone with no display name. */
export async function memberNames(store: Store, room: Pick<Room, 'memberIds'>): Promise<Map<string, string>> {
  const people = await Promise.all(room.memberIds.map((id) => store.get('persons', id)));
  return new Map(room.memberIds.map((id, i) => [id, people[i]?.displayName?.trim() || `Member ${i + 1}`]));
}

/** Only totals are ever shown, and only once the room is closed. */
export function answerTotals(answers: Pick<RoomAnswer, 'value'>[]): AnswerTotals {
  const t = { agree: 0, disagree: 0, unsure: 0, total: answers.length };
  for (const a of answers) t[a.value]++;
  return t;
}

/** People who may be drawn: invited participants with a completed conversation, not already in an unclosed room. */
export async function eligibleForRoom(store: Store, assemblyId: string): Promise<string[]> {
  const [members, done, rooms] = await Promise.all([
    store.list('memberships', { assemblyId, role: 'participant', invited: true }),
    store.list('conversations', { assemblyId, status: 'complete' }),
    store.list('rooms', { assemblyId }),
  ]);
  const heard = new Set(done.map((c) => c.personId));
  const busy = new Set(rooms.filter((r) => r.status !== 'closed').flatMap((r) => r.memberIds));
  return [...new Set(members.map((m) => m.personId))].filter((id) => heard.has(id) && !busy.has(id));
}

export interface CreateRoomInput {
  topic: string;
  statementId?: string;
  /** Absent means live. */
  pace?: RoomPace;
  /** The room's length; for a slow room, its days times 1,440. */
  minutes: number;
  size: number;
  seed?: string;
  briefing: Room['briefing'];
}

export async function createRoom(deps: Pick<Deps, 'store' | 'clock'>, assembly: Assembly, input: CreateRoomInput): Promise<Room> {
  const { store } = deps;
  if (input.statementId) {
    const st = await store.get('statements', input.statementId);
    if (!st || st.assemblyId !== assembly.id) throw new HttpError(400, 'bad_statement', 'That statement is not in this assembly.');
  }
  for (const id of input.briefing.evidenceIds) {
    const card = await store.get('evidenceCards', id);
    if (!card || card.assemblyId !== assembly.id) throw new HttpError(400, 'bad_evidence', 'One of the evidence cards is not in this assembly.');
  }
  const [eligible, reactions, statements, existing] = await Promise.all([
    eligibleForRoom(store, assembly.id),
    store.list('reactions', { assemblyId: assembly.id }),
    store.list('statements', { assemblyId: assembly.id }, { orderBy: 'created_at' }),
    store.count('rooms', { assemblyId: assembly.id }),
  ]);
  const { groups } = opinionGroups(
    reactions,
    statements.map((s) => s.id),
  );
  // The default seed comes from public facts, so anyone can repeat the draw.
  const seed = input.seed ?? `${assembly.id}:${existing + 1}:${input.topic}`;
  const memberIds = drawRoom(eligible, groups, input.size, seed);
  if (memberIds.length < 5)
    throw new HttpError(409, 'too_few_people', `A room needs at least 5 people. Only ${memberIds.length} invited people who have had their conversation are free to be drawn.`);
  const room: Room = {
    id: newId('room'),
    assemblyId: assembly.id,
    ...(input.statementId ? { statementId: input.statementId } : {}),
    topic: input.topic,
    briefing: input.briefing,
    status: 'scheduled',
    memberIds,
    ...(input.pace === 'slow' ? { pace: 'slow' as const } : {}),
    minutes: input.minutes,
  };
  await store.put('rooms', room);
  await bumpVersion(deps, assembly.id);
  return room;
}

/* ------------------------------------------------------------- the facilitator */

const lastCheck = new Map<string, number>();
const locks = new Map<string, Promise<unknown>>();

/** Runs `fn` after any earlier call for the same room, so two checks never post the same trigger twice. */
function withRoomLock<T>(roomId: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(roomId) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(
    roomId,
    next.catch(() => undefined),
  );
  return next;
}

/**
 * Checks the facilitator's triggers and posts its one due message, if any. Called on each new
 * message (`force`) and on polls, at most once every 15 seconds per room.
 */
export async function checkFacilitator(deps: Deps, roomId: string, opts: { force?: boolean } = {}): Promise<RoomMessage | undefined> {
  const now = deps.clock.now().getTime();
  if (!opts.force) {
    const last = lastCheck.get(roomId);
    if (last !== undefined && now - last < POLL_CHECK_MS) return undefined;
  }
  lastCheck.set(roomId, now);
  return withRoomLock(roomId, async () => {
    const room = await deps.store.get('rooms', roomId);
    if (!room) return undefined;
    const messages = await deps.store.list('roomMessages', { roomId }, { orderBy: 'created_at' });
    const due = dueTrigger(room, messages, now);
    if (!due) return undefined;
    const names = await memberNames(deps.store, room);
    const statement = room.statementId ? await deps.store.get('statements', room.statementId) : undefined;
    const msLeft = Date.parse(room.endsAt!) - now;
    const minutesLeft = Math.max(0, Math.ceil(msLeft / 60000));
    const { text } = await wordFacilitator(deps, due.kind, {
      topic: room.topic,
      ...(statement ? { statement: statement.text } : {}),
      minutesLeft,
      ...(due.kind === 'invite' && due.personId ? { name: names.get(due.personId) } : {}),
      ...(room.pace === 'slow' ? { pace: 'slow' as const, timeLeft: timeLeftWords(msLeft), length: daysWords(room.minutes) } : {}),
    });
    const msg: RoomMessage = {
      id: newId('msg'),
      roomId,
      authorType: 'facilitator',
      ...(due.personId ? { personId: due.personId } : {}),
      text,
      createdAt: deps.clock.iso(),
    };
    await deps.store.put('roomMessages', msg);
    await bumpVersion(deps, room.assemblyId);
    return msg;
  });
}

/** Forgets the poll timings (tests). */
export function resetFacilitatorTimers(): void {
  lastCheck.clear();
}

/* ------------------------------------------------------------- views */

/** A room's pace, with live for rooms stored before slow rooms existed. */
export const paceOf = (room: Pick<Room, 'pace'>): RoomPace => room.pace ?? 'live';

export interface WriteFirst {
  /** True for a member of a slow room who has not posted a message yet. */
  mustWriteFirst: boolean;
  /** The person messages held back from them. */
  hiddenCount: number;
  /** How many different people wrote those messages. */
  hiddenPeople: number;
}

/**
 * Write before you read (rule 5 widened, section 12.2): in a slow room, a member who has not posted
 * sees only facilitator and system messages. Everyone else, and every live room, sees everything.
 */
export function writeFirst(room: Pick<Room, 'pace'>, messages: Pick<RoomMessage, 'authorType' | 'personId'>[], me: string | undefined): WriteFirst {
  const people = messages.filter((m) => m.authorType === 'person');
  const must = paceOf(room) === 'slow' && !people.some((m) => !!me && m.personId === me);
  if (!must) return { mustWriteFirst: false, hiddenCount: 0, hiddenPeople: 0 };
  return { mustWriteFirst: true, hiddenCount: people.length, hiddenPeople: new Set(people.map((m) => m.personId)).size };
}

/** The messages a person may read: without other people's messages while they must write first. */
export function visibleMessages<T extends Pick<RoomMessage, 'authorType'>>(messages: T[], gate: WriteFirst): T[] {
  return gate.mustWriteFirst ? messages.filter((m) => m.authorType !== 'person') : messages;
}

export function messageView(m: RoomMessage, names: Map<string, string>, me: string | undefined): RoomMessageView {
  return {
    id: m.id,
    authorType: m.authorType,
    author: m.authorType === 'facilitator' ? FACILITATOR_NAME : m.authorType === 'system' ? 'Unite' : (names.get(m.personId ?? '') ?? 'Someone who has left'),
    mine: m.authorType === 'person' && !!me && m.personId === me,
    text: m.text,
    createdAt: m.createdAt,
  };
}

export async function evidenceFor(store: Store, ids: string[]): Promise<EvidenceCard[]> {
  const cards = await Promise.all(ids.map((id) => store.get('evidenceCards', id)));
  return cards.filter((c): c is EvidenceCard => !!c);
}

/* ------------------------------------------------------------- closing */

/**
 * Closes a room. When the members proposed a wording and the room worked on a statement, a new
 * candidate statement is created from it, as the next version of that statement with the same
 * sources (written through the store directly).
 */
export async function closeRoom(deps: Pick<Deps, 'store' | 'clock'>, room: Room): Promise<{ room: Room; statement?: Statement }> {
  const result = await deps.store.transaction(async (tx) => {
    const closed: Room = { ...room, status: 'closed' };
    await tx.put('rooms', closed);
    const wording = room.outcome?.proposedWording?.trim();
    if (!wording || !room.statementId) return { room: closed };
    const prev = await tx.get('statements', room.statementId);
    if (!prev) return { room: closed };
    const now = deps.clock.iso();
    const statement = await tx.put('statements', {
      id: newId('st'),
      assemblyId: prev.assemblyId,
      text: wording,
      version: prev.version + 1,
      previousId: prev.id,
      themeIds: prev.themeIds,
      pointIds: prev.pointIds,
      origin: 'room',
      status: 'candidate',
      createdAt: now,
      updatedAt: now,
    });
    return { room: closed, statement };
  });
  await bumpVersion(deps, room.assemblyId);
  return result;
}
