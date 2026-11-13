import type { Assembly, BuildProposal, Check, Decision, DecisionStatus, DeliveryItem, RegisterSummary, Role } from '@unite/shared';

/*
 * Response shapes of the delivery, register and host endpoints. They mirror the server's
 * services/delivery and services/host types; they belong in packages/shared/src/api.ts and are
 * kept here until that file is changed at merge.
 */

export interface DecisionCard {
  id: string;
  number: number;
  title: string;
  status: DecisionStatus;
  dueDate: string;
  daysLate: number;
  answer: Decision['answer'] | null;
}

export interface DecisionsResponse {
  assembly: Pick<Assembly, 'slug' | 'title' | 'question' | 'hostName' | 'hostSlug' | 'isExample' | 'stage'>;
  decisions: DecisionCard[];
}

export interface DecisionRecord {
  decision: Decision;
  daysLate: number;
  assembly: Pick<Assembly, 'slug' | 'title' | 'question' | 'hostName' | 'hostSlug' | 'isExample' | 'stage'> & { checkBody: string };
  statement: { id: string; text: string } | null;
  trail: { themes: { id: string; name: string }[]; people: number };
  proposals: BuildProposal[];
  deliveryItems: DeliveryItem[];
  check: Check | null;
  viewer: { role: Role; heard: boolean; isChecker: boolean };
}

export interface RegisterEntry extends DecisionCard {
  assembly: { slug: string; title: string; isExample: boolean };
  host: { name: string; slug: string };
}

export interface RegisterResponse {
  entries: RegisterEntry[];
  summary: RegisterSummary;
  filters: { assemblies: { slug: string; title: string }[]; hosts: { slug: string; name: string }[]; statuses: DecisionStatus[] };
}

export interface HostRecordResponse {
  host: { name: string; slug: string; description: string };
  assemblies: { slug: string; title: string; stage: Assembly['stage']; isExample: boolean; decisions: number }[];
  record: {
    decisions: number;
    answeredOnTime: number;
    answeredLate: number;
    awaitingAnswer: number;
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
