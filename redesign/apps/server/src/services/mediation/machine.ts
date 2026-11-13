import { mediationStep, type MediationStep, type MediationTurn } from '@unite/shared';

/**
 * The step machine of talk it through (section 12.1), as pure functions. Steps 1 to 4 are why,
 * other_side, wording and question. A step ends when the person has given the minimum and the
 * model says its goal is met, or at the maximum, or at once on "Skip this". After step 4 comes the
 * review.
 */

export const FIRST_STEP: MediationStep = 1;
export const LAST_STEP: MediationStep = 4;
export const OTHER_SIDE_STEP: MediationStep = 2;

export function stepLimits(step: number): { min: number; max: number } {
  const s = mediationStep(step);
  return { min: s?.minTurns ?? 1, max: s?.maxTurns ?? 1 };
}

/** The step after this one, or 'review' after step 4. */
export function nextStep(step: MediationStep): MediationStep | 'review' {
  return step >= LAST_STEP ? 'review' : ((step + 1) as MediationStep);
}

/** The person's answers in a step (a skip is not an answer). */
export function personTurnsIn(turns: readonly Pick<MediationTurn, 'role' | 'step' | 'skipped'>[], step: number): number {
  return turns.filter((t) => t.role === 'person' && t.step === step && !t.skipped).length;
}

/** The advance rule: at the maximum, or at or past the minimum when the model says the step is complete. */
export function shouldAdvance(step: number, personTurns: number, stepComplete: boolean): boolean {
  const { min, max } = stepLimits(step);
  return personTurns >= max || (stepComplete && personTurns >= min);
}

/** True when the step must end now, whatever the model would say. */
export function mustAdvance(step: number, personTurns: number): boolean {
  return personTurns >= stepLimits(step).max;
}
