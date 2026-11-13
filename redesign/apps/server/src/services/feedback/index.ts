import { randomBytes } from 'node:crypto';
import type { Feedback } from '@unite/shared';
import { feedbackPlan, isFinished, type FeedbackPlan } from '../../ai/feedback.js';
import { FEEDBACK_TOPICS } from '../../ai/prompts.js';
import { changesSince, loadReleases } from './releases.js';
import { publicSummaryText, toCsv } from './text.js';

/**
 * Feedback on Unite itself (sections 4, 6.5 and 7). The token is the only key to a record: it is
 * long and random, shown only to the person who started it, and never appears in the steward's
 * list or export.
 */

export type FeedbackStatus = Feedback['status'];

/** A new private token: 32 url-safe characters (192 random bits). */
export const newToken = () => randomBytes(24).toString('base64url');

export const STATUS_WORDS: Record<FeedbackStatus, { label: string; text: string }> = {
  draft: { label: 'Not sent yet', text: 'You have not sent this yet.' },
  received: { label: 'Received', text: 'We have received it and will read it.' },
  planned: { label: 'Planned', text: 'We plan to act on it.' },
  done: { label: 'Done', text: 'We have made a change because of it.' },
  declined: { label: 'Declined', text: 'We have decided not to act on it.' },
};

export const MODE_WORDS: Record<Feedback['mode'], string> = {
  guided: 'Answered a few questions',
  free: 'Told us something',
  changes: 'About what has changed',
};

/** The questions for a record, rebuilt from its mode and version. */
export function planFor(fb: Pick<Feedback, 'mode' | 'sinceVersion'>): FeedbackPlan {
  return feedbackPlan(fb.mode, fb.mode === 'changes' ? changesSince(loadReleases(), fb.sinceVersion) : [], fb.sinceVersion);
}

/** What the person who holds the token sees: their own record, never its id or person id. */
export interface FeedbackView {
  token: string;
  path: string;
  mode: Feedback['mode'];
  messages: Feedback['messages'];
  answers: Feedback['answers'];
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

export function personView(fb: Feedback): FeedbackView {
  const words = STATUS_WORDS[fb.status];
  return {
    token: fb.token,
    path: fb.path,
    mode: fb.mode,
    messages: fb.messages,
    answers: fb.answers,
    name: fb.name,
    contact: fb.contact,
    screenshot: fb.screenshot,
    status: fb.status,
    statusLabel: words.label,
    statusText: words.text,
    statusReason: fb.statusReason,
    publicIssue: fb.publicIssue,
    sinceVersion: fb.sinceVersion,
    createdAt: fb.createdAt,
    submittedAt: fb.submittedAt,
    done: isFinished(fb),
  };
}

/** Keeps the prepared public summary in step with the answers. An agreement is to exact text, so a change asks again. */
export function refreshPublicIssue(fb: Feedback): Feedback['publicIssue'] {
  const { state } = fb.publicIssue;
  if (state !== 'previewed' && state !== 'agreed') return fb.publicIssue;
  const text = publicSummaryText(fb.answers);
  if (text === fb.publicIssue.text) return fb.publicIssue;
  return { state: 'previewed', text };
}

/* ------------------------------------------------------------------ steward */

/** One record in the steward's list and export: no token, no person id, no transcript. */
export interface StewardFeedbackItem {
  id: string;
  path: string;
  mode: Feedback['mode'];
  modeLabel: string;
  status: FeedbackStatus;
  statusLabel: string;
  statusReason?: string;
  answers: Feedback['answers'];
  name?: string;
  contact?: string;
  screenshot?: string;
  /** The public summary, only once the person has agreed to it. */
  publicSummary?: string;
  sinceVersion?: string;
  createdAt: string;
  submittedAt?: string;
}

export function stewardItem(fb: Feedback, withScreenshot = true): StewardFeedbackItem {
  return {
    id: fb.id,
    path: fb.path,
    mode: fb.mode,
    modeLabel: MODE_WORDS[fb.mode],
    status: fb.status,
    statusLabel: STATUS_WORDS[fb.status].label,
    statusReason: fb.statusReason,
    answers: fb.answers.filter((a) => a.answer.trim()),
    name: fb.name,
    contact: fb.contact,
    ...(withScreenshot && fb.screenshot ? { screenshot: fb.screenshot } : {}),
    publicSummary: fb.publicIssue.state === 'agreed' ? fb.publicIssue.text : undefined,
    sinceVersion: fb.sinceVersion,
    createdAt: fb.createdAt,
    submittedAt: fb.submittedAt,
  };
}

export interface FeedbackTheme {
  key: string;
  question: string;
  /** Every answer on this topic, each with the record it came from. */
  answers: { feedbackId: string; question: string; answer: string }[];
}

export interface StewardFeedbackList {
  items: StewardFeedbackItem[];
  counts: { total: number; byStatus: Record<FeedbackStatus, number>; byMode: Record<Feedback['mode'], number> };
  themes: FeedbackTheme[];
}

const TOPIC_ORDER = new Map(FEEDBACK_TOPICS.map((t, i) => [t.key, i]));

/** Answers grouped by topic key, guided topics first in their order, then the rest by key. No AI summary in this build. */
export function themesOf(items: Feedback[]): FeedbackTheme[] {
  const byKey = new Map<string, FeedbackTheme>();
  for (const fb of items)
    for (const a of fb.answers) {
      if (!a.answer.trim()) continue;
      let t = byKey.get(a.key);
      if (!t) {
        t = { key: a.key, question: FEEDBACK_TOPICS.find((x) => x.key === a.key)?.question ?? a.question, answers: [] };
        byKey.set(a.key, t);
      }
      t.answers.push({ feedbackId: fb.id, question: a.question, answer: a.answer });
    }
  return [...byKey.values()].sort((a, b) => {
    const x = TOPIC_ORDER.get(a.key) ?? Infinity;
    const y = TOPIC_ORDER.get(b.key) ?? Infinity;
    return x !== y ? x - y : a.key.localeCompare(b.key);
  });
}

/** The steward's list: sent feedback only (a draft has not been given yet), newest first. Counts include drafts as a number. */
export function stewardList(all: Feedback[]): StewardFeedbackList {
  const sent = all.filter((f) => f.status !== 'draft').sort((a, b) => (b.submittedAt ?? b.createdAt).localeCompare(a.submittedAt ?? a.createdAt));
  const byStatus: Record<FeedbackStatus, number> = { draft: 0, received: 0, planned: 0, done: 0, declined: 0 };
  const byMode: Record<Feedback['mode'], number> = { guided: 0, free: 0, changes: 0 };
  for (const f of all) byStatus[f.status]++;
  for (const f of sent) byMode[f.mode]++;
  return { items: sent.map((f) => stewardItem(f)), counts: { total: sent.length, byStatus, byMode }, themes: themesOf(sent) };
}

export const CSV_HEADER = [
  'feedback_id',
  'submitted_at',
  'mode',
  'path',
  'status',
  'status_reason',
  'name',
  'contact',
  'since_version',
  'has_screenshot',
  'question_key',
  'question',
  'answer',
  'public_summary',
];

/** One row per answer (a record with no answers still gets one row). Never includes tokens or person ids. */
export function feedbackCsv(all: Feedback[]): string {
  const sent = stewardList(all).items;
  const source = new Map(all.map((f) => [f.id, f]));
  const rows: unknown[][] = [];
  for (const item of sent) {
    const base = [item.id, item.submittedAt, item.mode, item.path, item.status, item.statusReason, item.name, item.contact, item.sinceVersion, source.get(item.id)?.screenshot ? 'yes' : 'no'];
    const answers = item.answers.length ? item.answers : [{ key: '', question: '', answer: '' }];
    for (const a of answers) rows.push([...base, a.key, a.question, a.answer, item.publicSummary]);
  }
  return toCsv(CSV_HEADER, rows);
}

/** The JSON export: the steward's records without screenshots (which are only shown in the console). */
export function feedbackJson(all: Feedback[]) {
  const list = stewardList(all);
  const items = list.items.map(({ screenshot, ...rest }) => ({ ...rest, hasScreenshot: !!screenshot }));
  return { items, counts: list.counts, themes: list.themes };
}
