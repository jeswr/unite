import type { Conversation, Point, PointType, Turn } from '@unite/shared';

/**
 * Response shapes of the conversation and my-data endpoints, copied from
 * apps/server/src/services/conversation/views.ts and routes/mydata.ts until they move to
 * packages/shared.
 */

export interface ConversationAssembly {
  slug: string;
  title: string;
  question: string;
  isExample: boolean;
  isOpenListening: boolean;
}

export interface ConversationView {
  conversation: Conversation;
  assembly: ConversationAssembly;
  turns: Turn[];
  points: Point[];
  questions: string[];
  pending: 'distress' | null;
  safety?: 'ok' | 'distress' | 'identifying';
}

export interface MyConversation {
  id: string;
  route: Conversation['route'];
  status: Conversation['status'];
  stage: number;
  startedAt: string;
  completedAt?: string;
  assembly: Pick<ConversationAssembly, 'slug' | 'title' | 'isOpenListening'>;
}

export interface ApproveLinkView {
  assembly: ConversationAssembly;
  language: string;
  points: Point[];
}

export interface ConsentInfo {
  lines: string[];
  aiEnabled: boolean;
}

export interface TraceEntry {
  point: { id: string; type: PointType; text: string; visibility: Point['visibility']; approvedAt?: string };
  assembly: { slug: string; title: string; isOpenListening: boolean } | null;
  theme: { id: string; name: string } | null;
  statements: { id: string; text: string; status: string; statusWords: string }[];
  decisions: { id: string; number: number; title: string; status: string; statusWords: string }[];
}
