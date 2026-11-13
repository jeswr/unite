import { describe, expect, it } from 'vitest';
import {
  mayAdvance,
  mustAdvance,
  nextStage,
  probeForNextQuestion,
  probesRemaining,
  shouldAdvance,
  skipStage,
  stageLimits,
} from '../src/services/conversation/machine.js';
import { scriptedQuestion, scriptedStageQuestions } from '../src/ai/scripted.js';
import { SCRIPTED_QUESTIONS } from '../src/ai/prompts.js';

describe('the stage machine (section 6.1)', () => {
  it('has the minimum and maximum person turns from the table', () => {
    for (const s of [1, 2, 3, 4]) expect(stageLimits(s)).toEqual({ min: 2, max: 3 });
    for (const s of [5, 6, 7, 8]) expect(stageLimits(s)).toEqual({ min: 1, max: 2 });
  });

  it('does not end a stage before the minimum, even when the model says it is complete', () => {
    expect(shouldAdvance({ stage: 1, personTurnsInStage: 1, stageComplete: true })).toBe(false);
    expect(shouldAdvance({ stage: 1, personTurnsInStage: 2, stageComplete: true })).toBe(true);
    expect(shouldAdvance({ stage: 5, personTurnsInStage: 1, stageComplete: true })).toBe(true);
  });

  it('stays in a stage past the minimum while the model says it is not complete, and ends at the maximum', () => {
    expect(shouldAdvance({ stage: 2, personTurnsInStage: 2, stageComplete: false })).toBe(false);
    expect(shouldAdvance({ stage: 2, personTurnsInStage: 3, stageComplete: false })).toBe(true);
    expect(mustAdvance({ stage: 6, personTurnsInStage: 2 })).toBe(true);
    expect(mustAdvance({ stage: 6, personTurnsInStage: 1 })).toBe(false);
  });

  it('skip moves straight on, and after stage 8 comes the review', () => {
    expect(skipStage(3)).toBe(4);
    expect(nextStage(8)).toBe(9);
    expect(skipStage(8)).toBe(9);
  });

  it('asks the host probes in stage 7, one per turn, after the stage’s own first question', () => {
    const probes = ['What would make evening classes possible for you?', 'Who should run them?'];
    expect(probeForNextQuestion(7, 0, probes)).toBeUndefined();
    expect(probeForNextQuestion(7, 1, probes)).toBe(probes[0]);
    expect(probeForNextQuestion(7, 2, probes)).toBe(probes[1]);
    expect(probeForNextQuestion(7, 3, probes)).toBeUndefined();
    expect(probeForNextQuestion(6, 1, probes)).toBeUndefined();
  });

  it('cannot end stage 7 while a probe waits, even past the maximum or when complete', () => {
    const probes = ['One?', 'Two?'];
    expect(probesRemaining(7, 1, probes)).toBe(2);
    expect(shouldAdvance({ stage: 7, personTurnsInStage: 1, stageComplete: true, probes })).toBe(false);
    expect(probesRemaining(7, 2, probes)).toBe(1);
    expect(shouldAdvance({ stage: 7, personTurnsInStage: 2, stageComplete: true, probes })).toBe(false);
    expect(mayAdvance({ stage: 7, personTurnsInStage: 3, probes })).toBe(true);
    expect(shouldAdvance({ stage: 7, personTurnsInStage: 3, stageComplete: false, probes })).toBe(true);
    // Probes only count in stage 7.
    expect(shouldAdvance({ stage: 5, personTurnsInStage: 2, stageComplete: false, probes })).toBe(true);
  });

  it('scripted mode asks the opener, then the follow-up, and a due probe as written', () => {
    expect(scriptedQuestion(1, 0)).toBe(SCRIPTED_QUESTIONS[1]![0]);
    expect(scriptedQuestion(1, 1)).toBe(SCRIPTED_QUESTIONS[1]![1]);
    expect(scriptedQuestion(7, 1, 'Who should run them?')).toBe('Who should run them?');
    expect(scriptedStageQuestions(3)).toEqual(SCRIPTED_QUESTIONS[3]);
    expect(scriptedStageQuestions(7, ['P1?'])).toEqual([SCRIPTED_QUESTIONS[7]![0], 'P1?']);
  });
});
