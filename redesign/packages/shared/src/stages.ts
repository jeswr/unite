import type { AssemblyKind, AssemblyStage, DecisionLevel, DecisionStatus, PointType } from './schemas.js';

/* ------------------------------------------------------------- the interview (section 6.1) */

export interface InterviewStage {
  n: number;
  key: string;
  title: string;
  /** False for stage 0 (the consent screen) and stage 9 (points review). */
  aiTurn: boolean;
  /** Person turns before the stage may end (when the model says it is complete). */
  minTurns: number;
  /** Person turns after which the stage ends regardless. */
  maxTurns: number;
}

/** The interviewer's stage machine. Titles for stages 1 to 8 match STAGE_GOALS in the server's prompts. */
export const INTERVIEW_STAGES: readonly InterviewStage[] = [
  { n: 0, key: 'welcome', title: 'Welcome', aiTurn: false, minTurns: 0, maxTurns: 0 },
  { n: 1, key: 'real_day', title: 'A real day', aiTurn: true, minTurns: 2, maxTurns: 3 },
  { n: 2, key: 'mattered', title: 'What mattered', aiTurn: true, minTurns: 2, maxTurns: 3 },
  { n: 3, key: 'in_the_way', title: 'What got in the way', aiTurn: true, minTurns: 2, maxTurns: 3 },
  { n: 4, key: 'good_day', title: 'A good ordinary day', aiTurn: true, minTurns: 2, maxTurns: 3 },
  { n: 5, key: 'circle', title: 'Other people', aiTurn: true, minTurns: 1, maxTurns: 2 },
  { n: 6, key: 'tradeoff', title: 'When two things pull apart', aiTurn: true, minTurns: 1, maxTurns: 2 },
  { n: 7, key: 'how', title: 'What would help', aiTurn: true, minTurns: 1, maxTurns: 2 },
  { n: 8, key: 'unsure', title: 'What you are unsure of', aiTurn: true, minTurns: 1, maxTurns: 2 },
  { n: 9, key: 'heard', title: 'What I heard', aiTurn: false, minTurns: 0, maxTurns: 0 },
];

/** Point types in words, for participants. */
export const POINT_TYPE_WORDS: Record<PointType, string> = {
  moment: 'Something that happened',
  matters: 'What matters to me',
  barrier: 'What gets in the way',
  wish: 'A good ordinary day',
  idea: 'An idea that would help',
  tradeoff: 'A trade-off',
  doubt: 'Something I am unsure of',
};

/* ------------------------------------------------------------- the life of an assembly */

export interface AssemblyStageInfo {
  key: AssemblyStage;
  title: string;
  /** What happens in this stage, in one plain sentence. */
  description: string;
}

export const ASSEMBLY_STAGES: readonly AssemblyStageInfo[] = [
  { key: 'proposed', title: 'Proposed', description: 'A host has drafted a question and a pledge.' },
  { key: 'pledged', title: 'Pledged', description: 'The question and the pledge are published and can be challenged.' },
  { key: 'listening', title: 'Listening', description: 'People have their own conversations, one at a time.' },
  { key: 'picture', title: 'Picture', description: 'Everyone can see the shared picture of what was said.' },
  { key: 'deliberating', title: 'Deliberating', description: 'People react to statements and work through differences in rooms.' },
  { key: 'deciding', title: 'Deciding', description: 'People choose the priorities that matter most to them.' },
  { key: 'answered', title: 'Answered', description: 'The host has answered every priority.' },
  { key: 'delivering', title: 'Delivering', description: 'Accepted decisions have plans and owners, and work is under way.' },
  { key: 'checked', title: 'Checked', description: 'A check panel has tested what was delivered.' },
  { key: 'review', title: 'Review', description: 'The review date has come and the question can be opened again.' },
];

export function stageInfo(stage: AssemblyStage): AssemblyStageInfo {
  return ASSEMBLY_STAGES.find((s) => s.key === stage)!;
}

export function nextStage(stage: AssemblyStage): AssemblyStage | undefined {
  const i = ASSEMBLY_STAGES.findIndex((s) => s.key === stage);
  return ASSEMBLY_STAGES[i + 1]?.key;
}

export function stageIndex(stage: AssemblyStage): number {
  return ASSEMBLY_STAGES.findIndex((s) => s.key === stage);
}

export const KIND_WORDS: Record<AssemblyKind, { title: string; promise: string }> = {
  listening: { title: 'Listening only', promise: 'Your words are counted and shown faithfully. You are told when an assembly opens on something you raised.' },
  advisory: { title: 'Advisory', promise: 'The host gives a reasoned answer to every priority by a date.' },
  codecided: { title: 'Co-decided', promise: 'The host carries out what passes within the remit and budget, or comes back with reasons.' },
  community: { title: 'Community-run', promise: 'Named members take on each decision.' },
  technology: { title: 'Technology co-design', promise: 'The host builds what is decided, in the open, against numbered tests.' },
};

/* ------------------------------------------------------------- decisions */

export interface DecisionLevelInfo {
  level: 0 | 1 | 2 | 3 | 4;
  name: string;
  usedFor: string;
  passesWhen: string;
  ifNot: string;
  /** Level 4 is out of scope for this build: no pledge can choose it. */
  available: boolean;
}

export const DECISION_LEVELS: readonly DecisionLevelInfo[] = [
  { level: 0, name: 'Do', usedFor: "Small, reversible things inside one group's remit", passesWhen: 'Those affected are asked and it is logged', ifNot: 'Not applicable', available: true },
  { level: 1, name: 'No objection', usedFor: 'Routine, reversible changes', passesWhen: 'Nobody raises a reasoned objection within a set number of days', ifNot: 'Goes up a level', available: true },
  { level: 2, name: 'Consent', usedFor: 'Most assembly statements', passesWhen: 'Common ground among people who answer differently, and every reasoned objection answered to the satisfaction of a named facilitator, with dissent recorded', ifNot: 'A time-limited trial with a review date', available: true },
  { level: 3, name: 'Deliberated supermajority', usedFor: 'Priorities that affect many people', passesWhen: 'A panel drawn by lot deliberates. If it cannot reach consent, a ranked vote must beat "no change" two to one', ifNot: 'No change', available: true },
  { level: 4, name: 'Constitutional', usedFor: "Unite's own rules", passesWhen: 'Three to one, a quorum, a cooling-off period, and ratification by a panel drawn by lot', ifNot: 'No change', available: false },
];

export function levelName(level: DecisionLevel): string {
  return DECISION_LEVELS[level]!.name;
}

export const DECISION_STATUS_WORDS: Record<DecisionStatus, string> = {
  awaiting_answer: 'Awaiting answer',
  accepted: 'Accepted',
  changed: 'Changed',
  delayed: 'Delayed',
  refused: 'Refused',
  in_progress: 'In progress',
  delivered_as_decided: 'Delivered as decided',
  delivered_minor_changes: 'Delivered with minor changes',
  delivered_substantial_changes: 'Delivered with substantial changes',
  not_delivered: 'Not delivered',
  replaced: 'Replaced',
};

/* ------------------------------------------------------------- the rules (section 1) */

export interface Rule {
  n: number;
  title: string;
  text: string;
}

export const RULES: readonly Rule[] = [
  { n: 1, title: 'Heard alone first', text: "You cannot see an assembly's picture, statements, reactions, reasons, rooms or priorities until you have finished your own conversation in that assembly. In an example assembly you can choose to look around first, and that choice is recorded and shown. Hosts and stewards are exempt. The server enforces this." },
  { n: 2, title: 'Only approved points leave a conversation', text: 'Only you can read your conversation. Nothing returns another person\'s words from their conversation.' },
  { n: 3, title: 'Every summary sentence has sources', text: 'A sentence in the picture, or a statement, that does not rest on points people approved is refused when it is written.' },
  { n: 4, title: 'Counts are computed by code', text: 'Every number is counted from stored records, as numbers of people.' },
  { n: 5, title: "Others' answers are hidden until you answer", text: 'You see how others reacted to a statement only after you have reacted to it yourself.' },
  { n: 6, title: 'No pledge, no assembly', text: 'An assembly cannot move past "proposed" without a complete pledge from its host.' },
  { n: 7, title: 'The host cannot mark its own work done', text: 'Only a check, by the check panel or the independent body named in the pledge, can say a decision was delivered or not delivered.' },
  { n: 8, title: 'Nothing is ranked by attention', text: 'No like counts, no view counts, no trending. Lists are ordered by time, by the proportional rule for priorities, or alphabetically.' },
  { n: 9, title: 'The interviewer never argues', text: 'Every reply from the AI interviewer is checked against fixed rules before it is stored or shown. A reply that gives an opinion, a fact or an example is not shown.' },
  { n: 10, title: 'Example data is labelled', text: 'Every page of an example assembly says that its people and host are invented.' },
];

export const EXAMPLE_BANNER_TEXT =
  'Example. The people and the host in this assembly are invented so you can see how Unite works.';

export const SCRIPTED_MODE_LABEL = 'This conversation uses fixed questions. The AI interviewer is not switched on.';
