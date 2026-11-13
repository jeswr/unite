import { describe, expect, it } from 'vitest';
import { mustAdvance, nextStep, personTurnsIn, shouldAdvance, stepLimits } from '../src/services/mediation/machine.js';

describe('the step machine', () => {
  it('steps 1 to 3 take 1 to 2 answers, step 4 takes one, then the review', () => {
    expect([1, 2, 3, 4].map(stepLimits)).toEqual([
      { min: 1, max: 2 },
      { min: 1, max: 2 },
      { min: 1, max: 2 },
      { min: 1, max: 1 },
    ]);
    expect([1, 2, 3, 4].map((s) => nextStep(s as 1 | 2 | 3 | 4))).toEqual([2, 3, 4, 'review']);
  });

  it('advances at the maximum, or at the minimum when the model says the step is complete', () => {
    expect(shouldAdvance(1, 1, false)).toBe(false);
    expect(shouldAdvance(1, 1, true)).toBe(true);
    expect(shouldAdvance(1, 2, false)).toBe(true);
    expect(shouldAdvance(1, 0, true)).toBe(false);
    expect(mustAdvance(4, 1)).toBe(true);
    expect(mustAdvance(3, 1)).toBe(false);
  });

  it('counts answers in a step, not skips', () => {
    const t = (role: 'mediator' | 'person', step: number, skipped?: boolean) => ({ role, step: step as 1, skipped });
    expect(personTurnsIn([t('mediator', 1), t('person', 1), t('person', 1, true), t('person', 2)], 1)).toBe(1);
  });
});
