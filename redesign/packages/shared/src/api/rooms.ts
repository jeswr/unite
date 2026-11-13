import type { EvidenceCard, Room, RoomAnswer, RoomMessage } from '../schemas.js';

/** Response shapes of the rooms endpoints. */

export type RoomStatus = Room['status'];
export type AnswerValue = RoomAnswer['value'];
export type RoomOutcome = NonNullable<Room['outcome']>;

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
    minutes: number;
    startedAt: string | null;
    endsAt: string | null;
    members: MemberName[];
  } | null;
  others: { id: string; topic: string; status: RoomStatus; startedAt: string | null; endsAt: string | null; size: number }[];
  closed: { id: string; topic: string; wasMine: boolean; outcome: RoomOutcome; answers: AnswerTotals }[];
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
    minutes: number;
    startedAt: string | null;
    endsAt: string | null;
    statement: { id: string; text: string } | null;
    briefing: { summary: string; forSide: string[]; againstSide: string[]; evidence: EvidenceCard[] };
    outcome: RoomOutcome | null;
  };
  assembly: { slug: string };
  members: MemberName[];
  memberCount: number;
  isMember: boolean;
  canManage: boolean;
  myAnswer: { value: AnswerValue; note: string | null } | null;
  answerTotals: AnswerTotals | null;
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
  now: string;
}

/** POST /api/assemblies/:slug/rooms */
export interface RoomCreatedResponse {
  room: Room;
}
