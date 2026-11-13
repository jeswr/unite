import type { RegisterSummary } from '../register.js';
import type { Assembly, BuildProposal, Check, Decision, DecisionStatus, DeliveryItem } from '../schemas.js';
import type { Role } from '../api.js';

/** Response shapes of the decisions, register and host-record endpoints. */

/** The fields shown on a decision card and in the register. */
export interface DecisionCard {
  id: string;
  number: number;
  title: string;
  status: DecisionStatus;
  dueDate: string;
  /** Days past the due date while still awaiting an answer; 0 otherwise. */
  daysLate: number;
  answer: Decision['answer'] | null;
}

export type DecisionAssembly = Pick<Assembly, 'slug' | 'title' | 'question' | 'hostName' | 'hostSlug' | 'isExample' | 'stage'>;

/** GET /api/assemblies/:slug/decisions */
export interface DecisionsResponse {
  assembly: DecisionAssembly;
  decisions: DecisionCard[];
}

/** GET /api/decisions/:id */
export interface DecisionRecord {
  decision: Decision;
  daysLate: number;
  assembly: DecisionAssembly & { checkBody: string };
  statement: { id: string; text: string } | null;
  /** The trail back: the statement's themes by name and how many people's points stand behind it. */
  trail: { themes: { id: string; name: string }[]; people: number };
  /** The chosen proposal first, then the rest in the order they came. */
  proposals: BuildProposal[];
  deliveryItems: DeliveryItem[];
  check: Check | null;
  viewer: { role: Role; heard: boolean; isChecker: boolean };
}

export interface RegisterEntry extends DecisionCard {
  assembly: { slug: string; title: string; isExample: boolean };
  host: { name: string; slug: string };
}

/** GET /api/register */
export interface RegisterResponse {
  entries: RegisterEntry[];
  summary: RegisterSummary;
  /** What the three filters can be set to. */
  filters: {
    assemblies: { slug: string; title: string }[];
    hosts: { slug: string; name: string }[];
    statuses: DecisionStatus[];
  };
}

/** GET /api/hosts/:hostSlug. In progress is shown on its own, never as done. */
export interface HostRecordResponse {
  host: { name: string; slug: string; description: string };
  assemblies: { slug: string; title: string; stage: Assembly['stage']; isExample: boolean; decisions: number }[];
  record: {
    decisions: number;
    answeredOnTime: number;
    answeredLate: number;
    awaitingAnswer: number;
    /** Awaiting an answer and past the due date. */
    awaitingLate: number;
    accepted: number;
    changed: number;
    delayed: number;
    refused: number;
    inProgress: number;
    deliveredAsDecided: number;
    deliveredWithChanges: number;
    notDelivered: number;
    replaced: number;
  };
  entries: RegisterEntry[];
}
