import { SCRIPTED_QUESTIONS } from './prompts.js';

/**
 * Scripted mode (section 6.1): two fixed questions per stage, an opener and a follow-up, used when
 * the AI is not switched on, when the caps are reached, and when a reply fails the rules three
 * times. In stage 7 a host probe, when one is due, is asked as the host wrote it (it has already
 * passed the leading-wording check).
 */

export { SCRIPTED_QUESTIONS };

/** The fixed question for this point in a stage: the opener before any answer, then the follow-up. */
export function scriptedQuestion(stage: number, personTurnsInStage: number, probe?: string): string {
  if (probe) return probe;
  const pair = SCRIPTED_QUESTIONS[stage];
  if (!pair) throw new Error(`There is no scripted question for stage ${stage}`);
  return personTurnsInStage === 0 ? pair[0] : pair[1];
}

/** The scripted questions of a stage, for the written-questions route: opener, then any probes, then the follow-up. */
export function scriptedStageQuestions(stage: number, probes: readonly string[] = []): string[] {
  const pair = SCRIPTED_QUESTIONS[stage];
  if (!pair) return [];
  return stage === 7 && probes.length ? [pair[0], ...probes] : [pair[0], pair[1]];
}

/**
 * Scripted mode has no model to say a stage is complete: a stage is complete once both of its
 * questions (or its opener and every probe) have been answered.
 */
export function scriptedStageComplete(personTurnsInStage: number): boolean {
  return personTurnsInStage >= 2;
}
