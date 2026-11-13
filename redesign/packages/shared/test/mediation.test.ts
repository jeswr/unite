import { describe, expect, it } from 'vitest';
import {
  defaultReasonSide,
  isNothingAnswer,
  MEDIATION_STEPS,
  MediationDraftsBody,
  MediationSchema,
  mediationFallback,
  pickOtherSide,
  stableId,
  trimToLimit,
  type MediationTurn,
  type Reason,
} from '../src/index.js';

const ME = stableId('per', 'me');
const per = (k: string) => stableId('per', k);
let n = 0;
const reason = (author: string, side: Reason['side'], day: number, text = `${author} ${side} ${day}`): Reason => ({
  id: stableId('rsn', `r${n++}`),
  statementId: stableId('st', 's'),
  assemblyId: stableId('asm', 'a'),
  personId: author === 'me' ? ME : per(author),
  side,
  text,
  createdAt: `2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z`,
});

describe('pickOtherSide (rule 8: by arrival and distinct author, never by count)', () => {
  const reasons = [
    reason('ana', 'against', 5),
    reason('ben', 'for', 1),
    reason('cat', 'against', 3),
    reason('cat', 'against', 2), // cat's earliest
    reason('me', 'against', 1), // my own: never shown to me
    reason('dan', 'question', 1), // questions are not a side
    reason('eve', 'against', 9),
    reason('fay', 'against', 7),
    reason('gus', 'for', 4),
    reason('hal', 'for', 6),
  ];

  it('agree sees against: the earliest of each author, first three by arrival', () => {
    const picked = pickOtherSide(reasons, 'agree', ME);
    expect(picked.map((r) => r.text)).toEqual(['cat against 2', 'ana against 5', 'fay against 7']);
  });

  it('disagree sees for', () => {
    expect(pickOtherSide(reasons, 'disagree', ME).map((r) => r.text)).toEqual(['ben for 1', 'gus for 4', 'hal for 6']);
  });

  it('not sure sees the first two of each side, in arrival order', () => {
    expect(pickOtherSide(reasons, 'unsure', ME).map((r) => r.text)).toEqual(['ben for 1', 'cat against 2', 'gus for 4', 'ana against 5']);
  });

  it('does not depend on the order reasons are given in', () => {
    const shuffled = [...reasons].reverse();
    expect(pickOtherSide(shuffled, 'agree', ME)).toEqual(pickOtherSide(reasons, 'agree', ME));
  });

  it('returns nothing when nobody who answered differently has given a reason', () => {
    expect(pickOtherSide([reason('me', 'against', 1), reason('ben', 'for', 2)], 'agree', ME)).toEqual([]);
  });
});

describe('defaultReasonSide', () => {
  it('agree is for, disagree is against, not sure has none', () => {
    expect(defaultReasonSide('agree')).toBe('for');
    expect(defaultReasonSide('disagree')).toBe('against');
    expect(defaultReasonSide('unsure')).toBeUndefined();
  });
});

describe('the fallback drafts', () => {
  const t = (step: 1 | 2 | 3 | 4, text: string, skipped = false): MediationTurn => ({ role: 'person', step, text, skipped, createdAt: '2026-11-13T09:00:00.000Z' });
  const asked = (step: 1 | 2 | 3 | 4): MediationTurn => ({ role: 'mediator', step, text: 'What happened?', createdAt: '2026-11-13T09:00:00.000Z' });

  it('uses the first step 1 turn, the last step 3 turn and the step 4 turn, in the person’s words', () => {
    const turns = [asked(1), t(1, 'My lad lost his job to a machine.'), t(1, 'He was gutted.'), asked(3), t(3, 'first try'), t(3, 'Teach people to check the tools.'), asked(4), t(4, 'Who pays for it?')];
    expect(mediationFallback(turns)).toEqual({ reason: 'My lad lost his job to a machine.', wording: 'Teach people to check the tools.', question: 'Who pays for it?' });
  });

  it('gives nothing for a skipped step or one answered "no", "none" or "nothing"', () => {
    const turns = [t(1, '', true), t(1, 'Nothing.'), t(3, 'None'), t(4, 'no')];
    expect(mediationFallback(turns)).toEqual({ reason: null, wording: null, question: null });
    expect(mediationFallback([t(1, 'skip me', true), t(1, 'Real reason here')]).reason).toBe('Real reason here');
  });

  it('trims each field to its limit at a word boundary', () => {
    const long = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ');
    const out = mediationFallback([t(1, long), t(3, long), t(4, long)]);
    expect(out.reason!.length).toBeLessThanOrEqual(280);
    expect(out.reason!.endsWith(' ')).toBe(false);
    expect(out.wording!.split(' ')).toHaveLength(30);
    expect(out.question!.length).toBeLessThanOrEqual(280);
  });

  it('isNothingAnswer and trimToLimit', () => {
    expect(isNothingAnswer(' No! ')).toBe(true);
    expect(isNothingAnswer('No, because it costs too much')).toBe(false);
    expect(trimToLimit('one two three', 7)).toBe('one two');
    expect(trimToLimit('one two three', 100, 2)).toBe('one two');
  });
});

describe('the step limits and the schema', () => {
  it('has four steps with 1 to 2 turns, and 1 for the question', () => {
    expect(MEDIATION_STEPS.map((s) => [s.key, s.minTurns, s.maxTurns])).toEqual([
      ['why', 1, 2],
      ['other_side', 1, 2],
      ['wording', 1, 2],
      ['question', 1, 1],
    ]);
  });

  it('refuses a mediation with an unknown field or a step out of range', () => {
    const ok = {
      id: stableId('med', 'x'),
      assemblyId: stableId('asm', 'a'),
      statementId: stableId('st', 's'),
      personId: ME,
      status: 'active',
      step: 1,
      answer: 'agree',
      turns: [],
      shownReasonIds: [],
      drafts: {},
      aiUsed: false,
      startedAt: '2026-11-13T09:00:00.000Z',
      updatedAt: '2026-11-13T09:00:00.000Z',
    };
    expect(MediationSchema.safeParse(ok).success).toBe(true);
    expect(MediationSchema.safeParse({ ...ok, step: 5 }).success).toBe(false);
    expect(MediationSchema.safeParse({ ...ok, extra: 1 }).success).toBe(false);
  });

  it('a wording draft keeps a statement’s word limit; an empty string is allowed (it scraps)', () => {
    expect(MediationDraftsBody.safeParse({ wording: '' }).success).toBe(true);
    expect(MediationDraftsBody.safeParse({ wording: Array(31).fill('w').join(' ') }).success).toBe(false);
  });
});
