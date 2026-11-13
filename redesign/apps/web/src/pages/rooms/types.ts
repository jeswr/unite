import type { EvidenceCard } from '@unite/shared';

/**
 * Response shapes of the rooms endpoints, as the server sends them (apps/server/src/routes/rooms.ts).
 * Kept here until they move to packages/shared.
 */

export type RoomStatus = 'scheduled' | 'open' | 'closed';
export type AnswerValue = 'agree' | 'disagree' | 'unsure';

export interface RoomOutcome {
  reasonsFor: string[];
  reasonsAgainst: string[];
  proposedWording?: string;
  questionsForExperts: string[];
}

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
  authorType: 'person' | 'facilitator' | 'system';
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
