import type { EvidenceCard, Room, RoomAnswer, RoomMessage } from '../schemas.js';

/** Response shapes of the rooms endpoints. */

export type RoomStatus = Room['status'];
export type AnswerValue = RoomAnswer['value'];
export type RoomOutcome = NonNullable<Room['outcome']>;
/** How a room runs: live for minutes, or slow for days (section 12.2). */
export type RoomPace = 'live' | 'slow';

export interface AnswerTotals {
  agree: number;
  disagree: number;
  unsure: number;
  total: number;
}

export interface MemberName {
  name: string;
  isMe: boolean;
}

/** GET /api/assemblies/:slug/rooms */
export interface RoomsResponse {
  myRoom: {
    id: string;
    topic: string;
    status: RoomStatus;
    pace: RoomPace;
    minutes: number;
    startedAt: string | null;
    endsAt: string | null;
    members: MemberName[];
  } | null;
  others: { id: string; topic: string; status: RoomStatus; pace: RoomPace; minutes: number; startedAt: string | null; endsAt: string | null; size: number }[];
  closed: { id: string; topic: string; pace: RoomPace; wasMine: boolean; outcome: RoomOutcome; answers: AnswerTotals }[];
  canManage: boolean;
  /** The server's time, for the timers. */
  now: string;
}

/** GET /api/rooms/:id */
export interface RoomResponse {
  room: {
    id: string;
    topic: string;
    status: RoomStatus;
    pace: RoomPace;
    minutes: number;
    startedAt: string | null;
    endsAt: string | null;
    statement: { id: string; text: string } | null;
    briefing: { summary: string; forSide: string[]; againstSide: string[]; evidence: EvidenceCard[] };
    /** Hidden from a member of a slow room until they have written (`mustWriteFirst`). */
    outcome: RoomOutcome | null;
  };
  assembly: { slug: string };
  members: MemberName[];
  memberCount: number;
  isMember: boolean;
  canManage: boolean;
  myAnswer: { value: AnswerValue; note: string | null } | null;
  answerTotals: AnswerTotals | null;
  /** A member of a slow room who has not written yet: others' messages and the outcome are held back. */
  mustWriteFirst: boolean;
  /** How many messages from other people are held back from you; 0 when nothing is. */
  hiddenCount: number;
  /** How many different people the held-back messages are from. */
  hiddenPeople: number;
  now: string;
}

export interface RoomMessageView {
  id: string;
  authorType: RoomMessage['authorType'];
  author: string;
  mine: boolean;
  text: string;
  createdAt: string;
}

/** GET /api/rooms/:id/messages */
export interface MessagesResponse {
  messages: RoomMessageView[];
  status: RoomStatus;
  endsAt: string | null;
  /**
   * Write before you read (section 12.2): true for a member of a slow room who has not posted.
   * `messages` then holds only facilitator and system messages.
   */
  mustWriteFirst: boolean;
  /** How many people's messages are held back from you; 0 when nothing is. */
  hiddenCount: number;
  /** How many different people the held-back messages are from. */
  hiddenPeople: number;
  now: string;
}

/** POST /api/assemblies/:slug/rooms */
export interface RoomCreatedResponse {
  room: Room;
}
