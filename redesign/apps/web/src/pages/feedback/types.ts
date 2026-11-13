import type { Feedback } from '@unite/shared';

/**
 * The shapes the feedback endpoints answer with. They mirror `apps/server/src/services/feedback`
 * and belong in `packages/shared/src/api.ts` (requested at merge).
 */

export type FeedbackMode = Feedback['mode'];
export type FeedbackStatus = Feedback['status'];
export type FeedbackAnswer = Feedback['answers'][number];

/** GET /api/feedback/:token, and every write's `feedback`. */
export interface FeedbackView {
  token: string;
  path: string;
  mode: FeedbackMode;
  messages: Feedback['messages'];
  answers: FeedbackAnswer[];
  name?: string;
  contact?: string;
  screenshot?: string;
  status: FeedbackStatus;
  statusLabel: string;
  statusText: string;
  statusReason?: string;
  publicIssue: Feedback['publicIssue'];
  sinceVersion?: string;
  createdAt: string;
  submittedAt?: string;
  done: boolean;
}

export interface StartResponse {
  token: string;
  question: string;
  feedback: FeedbackView;
}

export interface TurnResponse {
  reply: string;
  done: boolean;
  feedback: FeedbackView;
}

export interface Release {
  version: string;
  date: string;
  changes: { text: string; affects: string[]; question?: string }[];
}

export interface StewardFeedbackItem {
  id: string;
  path: string;
  mode: FeedbackMode;
  modeLabel: string;
  status: FeedbackStatus;
  statusLabel: string;
  statusReason?: string;
  answers: FeedbackAnswer[];
  name?: string;
  contact?: string;
  screenshot?: string;
  publicSummary?: string;
  sinceVersion?: string;
  createdAt: string;
  submittedAt?: string;
}

export interface StewardFeedbackList {
  items: StewardFeedbackItem[];
  counts: { total: number; byStatus: Record<FeedbackStatus, number>; byMode: Record<FeedbackMode, number> };
  themes: { key: string; question: string; answers: { feedbackId: string; question: string; answer: string }[] }[];
}

/** "participants, hosts and stewards" */
export function listInWords(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
