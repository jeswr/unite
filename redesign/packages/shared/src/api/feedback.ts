import type { Feedback } from '../schemas.js';

/** Response shapes of the feedback endpoints. */

export type FeedbackMode = Feedback['mode'];
export type FeedbackStatus = Feedback['status'];
export type FeedbackAnswer = Feedback['answers'][number];

/** What the person who holds the token sees: their own record, never its id or person id. */
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
  /** True once the interviewer has nothing more to ask. */
  done: boolean;
}

/** POST /api/feedback */
export interface FeedbackStartResponse {
  token: string;
  question: string;
  feedback: FeedbackView;
}

/** POST /api/feedback/:token/turns */
export interface FeedbackTurnResponse {
  reply: string;
  done: boolean;
  feedback: FeedbackView;
}

/** One record in the steward's list and export: no token, no person id, no transcript. */
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
  /** The public summary, only once the person has agreed to it. */
  publicSummary?: string;
  sinceVersion?: string;
  createdAt: string;
  submittedAt?: string;
}

export interface FeedbackTheme {
  key: string;
  question: string;
  /** Every answer on this topic, each with the record it came from. */
  answers: { feedbackId: string; question: string; answer: string }[];
}

/** GET /api/steward/feedback */
export interface StewardFeedbackList {
  items: StewardFeedbackItem[];
  counts: { total: number; byStatus: Record<FeedbackStatus, number>; byMode: Record<FeedbackMode, number> };
  themes: FeedbackTheme[];
}
