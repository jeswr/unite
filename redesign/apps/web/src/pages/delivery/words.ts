import { DECISION_STATUS_WORDS, formatDate, type Decision, type DecisionStatus, type RegisterSummary } from '@unite/shared';
import type { TagTone } from '../../ui/Tag';
import type { DecisionCard } from './types';

/** A decision's status in words, for participants. */
export const statusWords = (s: DecisionStatus) => DECISION_STATUS_WORDS[s];

/** Meaning colours: green where it was done as decided, amber where it changed or waits, red where it was refused or not done. */
export const STATUS_TONE: Record<DecisionStatus, TagTone> = {
  awaiting_answer: 'neutral',
  accepted: 'agree',
  changed: 'unsure',
  delayed: 'unsure',
  refused: 'disagree',
  in_progress: 'accent',
  delivered_as_decided: 'agree',
  delivered_minor_changes: 'agree',
  delivered_substantial_changes: 'unsure',
  not_delivered: 'disagree',
  replaced: 'neutral',
};

/** The phrase used for each status in a summary sentence, and the order they are listed in. */
const SENTENCE: [DecisionStatus, string][] = [
  ['delivered_as_decided', 'delivered as decided'],
  ['delivered_minor_changes', 'delivered with small changes'],
  ['delivered_substantial_changes', 'delivered with large changes'],
  ['not_delivered', 'not delivered'],
  ['in_progress', 'in progress'],
  ['accepted', 'accepted'],
  ['changed', 'changed by the host'],
  ['delayed', 'delayed'],
  ['refused', 'refused'],
  ['awaiting_answer', 'awaiting an answer'],
  ['replaced', 'replaced'],
];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The register's summary in words: "5 decisions: 1 delivered with small changes, 2 in progress,
 * 1 delayed, 1 refused. In progress is not counted as done."
 */
export function summarySentence(s: RegisterSummary): string {
  if (s.total === 0) return 'No decisions yet.';
  const parts = SENTENCE.filter(([k]) => s.byStatus[k] > 0).map(([k, words]) => `${s.byStatus[k]} ${words}`);
  return `${plural(s.total, 'decision', 'decisions')}: ${parts.join(', ')}. In progress is not counted as done.`;
}

const firstSentence = (t: string, max = 140) => {
  const s = t.trim().split(/(?<=[.!?])\s/)[0] ?? t;
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
};

/** One line on the host's answer, for a decision card. */
export function answerLine(answer: Decision['answer'] | null | undefined): string {
  if (!answer) return 'The host has not answered yet.';
  switch (answer.kind) {
    case 'accepted':
      return `Accepted. ${firstSentence(answer.reasons)}`;
    case 'changed':
      return `Changed: ${firstSentence(answer.changedTo ?? answer.reasons)}`;
    case 'delayed':
      return `Delayed until ${answer.delayedUntil ? formatDate(answer.delayedUntil) : 'a later date'}. ${firstSentence(answer.reasons)}`;
    case 'refused':
      return `Refused. ${firstSentence(answer.reasons)}`;
  }
}

/** The due line: "12 days late" (late), "Answer due by 18 December 2026", or nothing once answered. */
export function dueLine(d: Pick<DecisionCard, 'status' | 'dueDate' | 'daysLate'>): { text: string; late: boolean } | null {
  if (d.status !== 'awaiting_answer') return null;
  if (d.daysLate > 0) return { text: `${plural(d.daysLate, 'day', 'days')} late`, late: true };
  return { text: `Answer due by ${formatDate(d.dueDate)}`, late: false };
}

export const ANSWER_KIND_WORDS = { accepted: 'Accepted', changed: 'Changed', delayed: 'Delayed', refused: 'Refused' } as const;

export const CLASSIFICATION_WORDS = {
  as_decided: 'Delivered as decided',
  minor_changes: 'Delivered with small changes',
  substantial_changes: 'Delivered with large changes',
  not_delivered: 'Not delivered',
} as const;

export const ITEM_STATUS_WORDS = { planned: 'Planned', in_progress: 'In progress', done: 'Done' } as const;
export const KIND_WORDS = { technology: 'Technology', social: 'Social arrangement' } as const;
