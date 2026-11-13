import type { GroupKey, Objection, Reaction, Reason, Statement, Tally } from '@unite/shared';
import type { Quote, ReportView } from '../picture/types.js';

/**
 * Response shapes of the statements endpoints. The web keeps an identical copy in
 * apps/web/src/pages/statements/types.ts until these move to packages/shared.
 */

export interface GroupResult extends Tally {
  key: GroupKey;
  /** The group I am in, when I am in one. */
  mine: boolean;
}

/** Rule 5: present only when I have answered the statement, or I am a host or steward. */
export interface StatementResults {
  /** Everyone who answered. */
  overall: Tally;
  /** One entry when people have not split into groups. */
  groups: GroupResult[];
  /** Answers from people who joined with an invitation: these count toward the decision. */
  counted: number;
  stillNeeded: string[];
}

export interface StatementSummary {
  id: string;
  text: string;
  version: number;
  previousId?: string;
  status: Statement['status'];
  origin: Statement['origin'];
  /** I wrote this wording. */
  mine: boolean;
  createdAt: string;
  myReaction: Reaction['value'] | null;
  results?: StatementResults;
}

/** GET /api/assemblies/:slug/statements */
export interface StatementsResponse {
  statements: StatementSummary[];
  canSteward: boolean;
}

export interface ReasonView {
  id: string;
  side: Reason['side'];
  text: string;
  createdAt: string;
  mine: boolean;
}

export interface ObjectionView {
  id: string;
  text: string;
  status: Objection['status'];
  reply?: string;
  repliedBy?: string;
  createdAt: string;
  resolvedAt?: string;
  mine: boolean;
}

/** GET /api/statements/:id */
export interface StatementDetail {
  statement: StatementSummary;
  assembly: { slug: string; title: string; isExample: boolean };
  /** Earlier versions, oldest first. */
  earlier: { id: string; text: string; version: number; origin: Statement['origin'] }[];
  /** Rewordings and revisions made from this statement, oldest first. */
  later: { id: string; text: string; version: number; origin: Statement['origin'] }[];
  sources: { people: number; quotes: Quote[]; themes: { id: string; name: string }[] };
  /** In the order they arrived, never ranked. */
  reasons: { for: ReasonView[]; against: ReasonView[]; questions: ReasonView[] };
  objections: ObjectionView[];
  reports: ReportView[];
  canSteward: boolean;
}
