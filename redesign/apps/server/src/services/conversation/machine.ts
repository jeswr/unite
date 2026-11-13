import { INTERVIEW_STAGES } from '@unite/shared';

/**
 * The interviewer's stage machine (section 6.1), as pure functions. Stage 0 is the consent screen
 * and stage 9 the points review; neither is an AI turn. Stages 1 to 8 each have a minimum and a
 * maximum number of person turns. A stage ends when the person has given the minimum and the
 * model says the goal is met, or at the maximum, or at once when the person chooses "Skip this".
 *
 * Host probes are asked in stage 7 ("What would help"), one per turn, after the stage's own first
 * question: the question that follows the person's k-th answer in stage 7 is probe k. Stage 7
 * cannot end until every probe has been asked and answered, even past its maximum.
 */

export const FIRST_STAGE = 1;
export const LAST_AI_STAGE = 8;
export const REVIEW_STAGE = 9;
export const PROBE_STAGE = 7;

export function isAiStage(stage: number): boolean {
  return !!INTERVIEW_STAGES[stage]?.aiTurn;
}

export function stageLimits(stage: number): { min: number; max: number } {
  const s = INTERVIEW_STAGES[stage];
  return { min: s?.minTurns ?? 0, max: s?.maxTurns ?? 0 };
}

/** The stage after this one; after stage 8 comes the review. */
export function nextStage(stage: number): number {
  return stage >= LAST_AI_STAGE ? REVIEW_STAGE : stage + 1;
}

/** Probes still to be asked or answered, given the person's answers so far in this stage. */
export function probesRemaining(stage: number, personTurnsInStage: number, probes: readonly string[]): number {
  if (stage !== PROBE_STAGE || probes.length === 0) return 0;
  // The k-th probe follows the k-th answer and is answered by answer k + 1.
  const answered = Math.max(0, Math.min(probes.length, personTurnsInStage - 1));
  return probes.length - answered;
}

/** The host probe the next question must ask, if any. */
export function probeForNextQuestion(stage: number, personTurnsInStage: number, probes: readonly string[]): string | undefined {
  if (stage !== PROBE_STAGE) return undefined;
  if (personTurnsInStage < 1 || personTurnsInStage > probes.length) return undefined;
  return probes[personTurnsInStage - 1];
}

export interface AdvanceInput {
  stage: number;
  /** Person turns in this stage, including the one just given. */
  personTurnsInStage: number;
  /** What the model said (or the scripted rule decided). */
  stageComplete: boolean;
  probes?: readonly string[];
}

/** True when the stage must end now, whatever the model says (the maximum is reached and no probe is waiting). */
export function mustAdvance({ stage, personTurnsInStage, probes = [] }: Omit<AdvanceInput, 'stageComplete'>): boolean {
  if (probesRemaining(stage, personTurnsInStage, probes) > 0) return false;
  return personTurnsInStage >= stageLimits(stage).max;
}

/** True when the stage may end because the model said its goal is met. */
export function mayAdvance({ stage, personTurnsInStage, probes = [] }: Omit<AdvanceInput, 'stageComplete'>): boolean {
  if (probesRemaining(stage, personTurnsInStage, probes) > 0) return false;
  return personTurnsInStage >= stageLimits(stage).min;
}

/** The advance rule: at the maximum, or past the minimum when the stage is complete; never while a probe waits. */
export function shouldAdvance(input: AdvanceInput): boolean {
  return mustAdvance(input) || (input.stageComplete && mayAdvance(input));
}

/** "Skip this": the stage ends at once. */
export function skipStage(stage: number): number {
  return nextStage(stage);
}
