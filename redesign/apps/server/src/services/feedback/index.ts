import { randomBytes } from 'node:crypto';
import type { Feedback, FeedbackStatus, FeedbackTheme, FeedbackView, StewardFeedbackItem, StewardFeedbackList } from '@unite/shared';
import { feedbackPlan, isFinished, type FeedbackPlan } from '../../ai/feedback.js';
import { FEEDBACK_TOPICS } from '../../ai/prompts.js';
import { changesSince, loadReleases } from './releases.js';
import { publicSummaryText, toCsv } from './text.js';

/**
 * Feedback on Unite itself (sections 4, 6.5 and 7). The token is the only key to a record: it is
 * long and random, shown only to the person who started it, and never appears in the steward's
 * list or export.
 */

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
