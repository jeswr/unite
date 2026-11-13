import type { StageChecklist } from './checklist.js';
import type { Assembly, Conversation, Membership, Person } from './schemas.js';
import type { Rule, DecisionLevelInfo } from './stages.js';

/** Every error the API returns has this shape, with a plain-English message. */
export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export type Role = 'participant' | 'host' | 'steward';

/** GET /api/me */
export interface MeResponse {
  person: Person | null;
  memberships: Membership[];
  role: Role;
  demo: boolean;
}

/** The counts shown with an assembly. Every count is of people unless it says otherwise. */
export interface AssemblyCounts {
  /** People with a completed conversation in the assembly. */
  heard: number;
  members: number;
  invited: number;
  /** Number of statements, not people. */
  statements: number;
  /** Number of decisions, not people. */
  decisions: number;
}

/** One assembly in GET /api/assemblies */
export interface AssemblySummary {
  slug: string;
  title: string;
  question: string;
  summary: string;
  kind: Assembly['kind'];
  scale: Assembly['scale'];
  stage: Assembly['stage'];
  hostName: string;
  hostSlug: string;
  isExample: boolean;
  isOpenListening: boolean;
  replyBy?: string;
  heard: number;
}

/** GET /api/assemblies/:slug */
export interface AssemblyView {
  assembly: Assembly;
  membership: Membership | null;
  role: Role;
  /** Whether rule 1 lets me see the group's work in this assembly. */
  heard: boolean;
  /** My most recent conversation in this assembly, if I have one. */
  myConversation: { id: string; status: Conversation['status'] } | null;
  checklist: StageChecklist;
  counts: AssemblyCounts;
}

/** GET /api/how/prompts */
export interface PromptsResponse {
  promptVersion: string;
  model: string;
  /** 'claude' when an AI key is configured, otherwise 'scripted'. */
  mode: 'claude' | 'scripted';
  prompts: { name: string; kind: 'text' | 'data' | 'template'; text: string }[];
}

/** GET /api/how/rules */
export interface RulesResponse {
  rules: Rule[];
  levels: DecisionLevelInfo[];
}

export * from './api/picture.js';
export * from './api/statements.js';
export * from './api/conversation.js';
export * from './api/delivery.js';
export * from './api/feedback.js';
export * from './api/rooms.js';
export * from './api/deciding.js';
export * from './api/host.js';
