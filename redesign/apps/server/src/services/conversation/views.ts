import type { Conversation, Point, Turn } from '@unite/shared';

/**
 * Response shapes of the conversation endpoints. The web app keeps a copy in
 * apps/web/src/pages/talk/types.ts until these move to packages/shared.
 */

export interface ConversationAssembly {
  slug: string;
  title: string;
  question: string;
  isExample: boolean;
  isOpenListening: boolean;
}

/** GET /api/conversations/:id (owner only), and the answer to every write on a conversation. */
export interface ConversationView {
  conversation: Conversation;
  assembly: ConversationAssembly;
  turns: Turn[];
  /** Every point except withdrawn ones, in creation order. */
  points: Point[];
  /** Written-questions route: the current stage's questions. Otherwise empty. */
  questions: string[];
  /** 'distress' when the last turn was the distress message and the person has not yet chosen to carry on or stop. */
  pending: 'distress' | null;
  /** Set on the answer to a turn: what the interviewer noticed. */
  safety?: 'ok' | 'distress' | 'identifying';
}

/** GET /api/conversations: my conversations, newest first. */
export interface MyConversation {
  id: string;
  route: Conversation['route'];
  status: Conversation['status'];
  stage: number;
  startedAt: string;
  completedAt?: string;
  assembly: Pick<ConversationAssembly, 'slug' | 'title' | 'isOpenListening'>;
}

/** GET /api/approve/:token */
export interface ApproveLinkView {
  assembly: ConversationAssembly;
  language: string;
  points: Point[];
}

/** POST /api/conversations (host route) */
export interface HostConversationCreated {
  conversationId: string;
  /** The one-time link path to give to the person, for example "/approve/abc…". */
  approvePath: string;
}

/** GET /api/talk/consent */
export interface ConsentInfo {
  lines: string[];
  /** False when the AI interviewer is not switched on: the conversation will use fixed questions. */
  aiEnabled: boolean;
}
