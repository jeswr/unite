import type { Decision, DecisionStatus } from './schemas.js';

export interface RegisterSummary {
  total: number;
  byStatus: Record<DecisionStatus, number>;
  /** Answered by the host: accepted, changed, delayed or refused, or anything after. */
  answered: number;
  awaitingAnswer: number;
  inProgress: number;
  /** Delivered as decided or with changes, as found by a check. Never includes in_progress. */
  delivered: number;
  deliveredAsDecided: number;
  notDelivered: number;
}

const DELIVERED: DecisionStatus[] = ['delivered_as_decided', 'delivered_minor_changes', 'delivered_substantial_changes'];

/** Counts of decisions by status. "In progress" is never counted in any "done" figure. */
export function registerSummary(decisions: Pick<Decision, 'status'>[]): RegisterSummary {
  const byStatus = {
    awaiting_answer: 0,
    accepted: 0,
    changed: 0,
    delayed: 0,
    refused: 0,
    in_progress: 0,
    delivered_as_decided: 0,
    delivered_minor_changes: 0,
    delivered_substantial_changes: 0,
    not_delivered: 0,
    replaced: 0,
  } satisfies Record<DecisionStatus, number>;
  for (const d of decisions) byStatus[d.status]++;
  return {
    total: decisions.length,
    byStatus,
    answered: decisions.length - byStatus.awaiting_answer,
    awaitingAnswer: byStatus.awaiting_answer,
    inProgress: byStatus.in_progress,
    delivered: DELIVERED.reduce((n, s) => n + byStatus[s], 0),
    deliveredAsDecided: byStatus.delivered_as_decided,
    notDelivered: byStatus.not_delivered,
  };
}
