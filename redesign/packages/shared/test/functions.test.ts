import { describe, expect, it } from 'vitest';
import {
  BANNED_PHRASES,
  findBannedPhrases,
  findLeadingPhrases,
  formatDate,
  INTERVIEW_STAGES,
  newId,
  rankPriorities,
  registerSummary,
  replyText,
  stableId,
  validateInterviewerReply,
  wordOverlap,
  fixedClock,
  addDays,
  type DecisionStatus,
} from '../src/index.js';

describe('ids', () => {
  it('makes <prefix>_<12 url-safe chars>', () => {
    for (let i = 0; i < 50; i++) expect(newId('per')).toMatch(/^per_[A-Za-z0-9_-]{12}$/);
    expect(new Set(Array.from({ length: 200 }, () => newId('pt'))).size).toBe(200);
  });
  it('stableId is stable, well formed and spread out', () => {
    expect(stableId('asm', 'open')).toBe(stableId('asm', 'open'));
    expect(stableId('asm', 'open')).toMatch(/^asm_[A-Za-z0-9_-]{12}$/);
    const many = new Set(Array.from({ length: 2000 }, (_, i) => stableId('per', `person-${i}`)));
    expect(many.size).toBe(2000);
  });
});

describe('clock', () => {
  it('a fixed clock stands still until moved', () => {
    const c = fixedClock('2026-11-13T09:00:00Z');
    expect(c.iso()).toBe('2026-11-13T09:00:00.000Z');
    expect(c.iso()).toBe('2026-11-13T09:00:00.000Z');
    c.advance(60_000);
    expect(c.iso()).toBe('2026-11-13T09:01:00.000Z');
    expect(addDays('2026-11-13T09:00:00.000Z', 9)).toBe('2026-11-22T09:00:00.000Z');
  });
});

describe('rankPriorities', () => {
  it('places the most chosen first, then discounts the voters it already served', () => {
    // 6 people choose X and Y; 4 choose Z. Round 1: X 6, Y 6, Z 4: X (earlier). Round 2: Y 3, Z 4: Z.
    const choices = [
      ...Array.from({ length: 6 }, (_, i) => ({ personId: `a${i}`, statementIds: ['X', 'Y'] })),
      ...Array.from({ length: 4 }, (_, i) => ({ personId: `b${i}`, statementIds: ['Z'] })),
    ];
    expect(rankPriorities(choices, ['X', 'Y', 'Z'])).toEqual([
      { statementId: 'X', score: 6, round: 1 },
      { statementId: 'Z', score: 4, round: 2 },
      { statementId: 'Y', score: 3, round: 3 },
    ]);
  });
  it('breaks ties by earlier creation and places unchosen statements last', () => {
    const out = rankPriorities([{ personId: 'p', statementIds: ['B', 'A'] }], ['A', 'B', 'C']);
    expect(out.map((r) => r.statementId)).toEqual(['A', 'B', 'C']);
    expect(out.map((r) => r.score)).toEqual([1, 0.5, 0]);
  });
  it('ignores choices of statements that are not candidates', () => {
    expect(rankPriorities([{ personId: 'p', statementIds: ['Q'] }], ['A']).map((r) => r.score)).toEqual([0]);
  });
});

describe('validateInterviewerReply', () => {
  const ok = { acknowledgement: 'You said the bus was late again.', question: 'What happened after that?' };
  it('passes a plain reply', () => {
    expect(validateInterviewerReply(ok, 1)).toEqual({ ok: true, failures: [] });
    expect(replyText(ok)).toBe('You said the bus was late again. What happened after that?');
  });
  it('needs exactly one question mark in the question', () => {
    expect(validateInterviewerReply({ ...ok, question: 'Tell me more.' }, 1).ok).toBe(false);
    expect(validateInterviewerReply({ ...ok, question: 'Why? And when?' }, 1).ok).toBe(false);
  });
  it('fails over 70 words', () => {
    const reply = (n: number) => ({ acknowledgement: Array.from({ length: n }, () => 'word').join(' '), question: 'What happened next then?' });
    expect(validateInterviewerReply(reply(66), 2).ok).toBe(true);
    expect(validateInterviewerReply(reply(67), 2).failures.join()).toMatch(/71 words/);
  });
  it('fails every banned phrase, case-insensitively', () => {
    for (const p of BANNED_PHRASES) {
      const r = validateInterviewerReply({ acknowledgement: `${p.toUpperCase()} indeed.`, question: 'What happened then?' }, 3);
      expect(r.ok, p).toBe(false);
    }
  });
  it('matches on word boundaries only', () => {
    expect(findBannedPhrases('That was a greater distance than usual.')).toEqual([]);
    expect(findBannedPhrases('Great, thanks.')).toEqual(['great']);
    expect(findBannedPhrases('so, e.g. the bus')).toEqual(['e.g.']);
    expect(findBannedPhrases('I  think so')).toEqual(['I think']);
    expect(findBannedPhrases('Things such as these')).toEqual(['such as']);
    expect(findBannedPhrases('I thinking')).toEqual([]);
  });
  it('fails a URL or a percentage', () => {
    expect(validateInterviewerReply({ ...ok, acknowledgement: 'See https://example.org first.' }, 1).ok).toBe(false);
    expect(validateInterviewerReply({ ...ok, acknowledgement: 'About 40% of the day.' }, 1).ok).toBe(false);
    expect(validateInterviewerReply({ ...ok, acknowledgement: 'About 40 % of the day.' }, 1).ok).toBe(false);
  });
  it('fails in stages where the interviewer does not speak', () => {
    expect(validateInterviewerReply(ok, 0).ok).toBe(false);
    expect(validateInterviewerReply(ok, 9).ok).toBe(false);
  });
});

describe('stage table', () => {
  it('has ten stages with the turn limits of section 6.1', () => {
    expect(INTERVIEW_STAGES.map((s) => s.key)).toEqual(['welcome', 'real_day', 'mattered', 'in_the_way', 'good_day', 'circle', 'tradeoff', 'how', 'unsure', 'heard']);
    expect(INTERVIEW_STAGES.slice(1, 5).every((s) => s.minTurns === 2 && s.maxTurns === 3)).toBe(true);
    expect(INTERVIEW_STAGES.slice(5, 9).every((s) => s.minTurns === 1 && s.maxTurns === 2)).toBe(true);
  });
});

describe('wordOverlap', () => {
  it('is the share of content words of a found in b', () => {
    expect(wordOverlap('The 5am bus is always late', 'the bus at 5am was late again')).toBe(3 / 4);
    expect(wordOverlap('I cannot afford the course', ['I could never afford a course like that'])).toBe(2 / 3);
  });
  it('ignores case, punctuation and stop words', () => {
    expect(wordOverlap('Childcare!!', 'CHILDCARE, during classes')).toBe(1);
    expect(wordOverlap('the and of', 'anything')).toBe(0);
  });
  it('works for other scripts', () => {
    expect(wordOverlap('mi madre trabaja', 'Mi madre trabaja de noche')).toBe(1);
  });
});

describe('registerSummary', () => {
  it('never counts in progress as done', () => {
    const ds: { status: DecisionStatus }[] = [
      { status: 'in_progress' },
      { status: 'in_progress' },
      { status: 'delivered_as_decided' },
      { status: 'delivered_minor_changes' },
      { status: 'awaiting_answer' },
      { status: 'refused' },
      { status: 'not_delivered' },
    ];
    const s = registerSummary(ds);
    expect(s.total).toBe(7);
    expect(s.inProgress).toBe(2);
    expect(s.delivered).toBe(2);
    expect(s.deliveredAsDecided).toBe(1);
    expect(s.awaitingAnswer).toBe(1);
    expect(s.answered).toBe(6);
    expect(s.notDelivered).toBe(1);
    expect(s.byStatus.in_progress).toBe(2);
  });
});

describe('leading wording fallback and dates', () => {
  it('finds leading phrases', () => {
    expect(findLeadingPhrases("Wouldn't you agree that buses matter?")).toEqual(["wouldn't you agree"]);
    expect(findLeadingPhrases('What would help you get to work?')).toEqual([]);
  });
  it('formats dates in British style', () => {
    expect(formatDate('2026-12-18')).toBe('18 December 2026');
    expect(formatDate('2026-11-22T09:00:00.000Z')).toBe('22 November 2026');
  });
});
