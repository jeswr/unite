import type { Decision, Statement } from '../schemas.js';

/** Response shapes of the priorities and decide endpoints. */

export interface RankedItem {
  statementId: string;
  text: string;
  status: Statement['status'];
  round: number;
  /** The statement's score in the round it was placed. Shown as a bar, never as a number. */
  score: number;
}

/** GET and PUT /api/assemblies/:slug/priorities */
export interface PrioritiesResponse {
  statements: { id: string; text: string; status: Statement['status'] }[];
  ranked: RankedItem[];
  myChoices: string[];
  /** Whether my choices count in the ranking (my membership is invited). */
  myChoicesCount: boolean;
  /** Invited people who have chosen at least one statement. */
  chosen: number;
  invited: number;
  /** People who are not invited but have chosen: stored, reported, not counted. */
  uninvitedChosen: number;
  capacity: number | null;
  replyBy: string | null;
  /** True once decisions have been made from the list. */
  closed: boolean;
}

/** What the steward supplies for one decision in POST /api/assemblies/:slug/decide. */
export interface DecisionInput {
  title: string;
  why: string;
  options: string[];
  dissent: string;
  tests: string[];
  delivery: Decision['delivery'];
}

/** POST /api/assemblies/:slug/decide */
export interface DecideResponse {
  decisions: Decision[];
}
