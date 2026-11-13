import { describe, expect, it } from 'vitest';
import { timeLeftWords } from '../src/index.js';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('timeLeftWords', () => {
  it('says days, hours or minutes, in words', () => {
    expect(timeLeftWords(3 * DAY)).toBe('3 days left');
    expect(timeLeftWords(3 * DAY + 20 * HOUR)).toBe('3 days left');
    expect(timeLeftWords(DAY)).toBe('1 day left');
    expect(timeLeftWords(DAY + 5 * HOUR)).toBe('1 day left');
    expect(timeLeftWords(5 * HOUR)).toBe('5 hours left');
    expect(timeLeftWords(5 * HOUR + 59 * MIN)).toBe('5 hours left');
    expect(timeLeftWords(HOUR)).toBe('1 hour left');
    expect(timeLeftWords(20 * MIN)).toBe('20 minutes left');
    expect(timeLeftWords(19 * MIN + 1)).toBe('20 minutes left');
    expect(timeLeftWords(59 * MIN + 30_000)).toBe('1 hour left');
    expect(timeLeftWords(MIN)).toBe('1 minute left');
    expect(timeLeftWords(1)).toBe('1 minute left');
  });

  it('says the time is up at or after the end', () => {
    expect(timeLeftWords(0)).toBe('Time is up');
    expect(timeLeftWords(-5 * MIN)).toBe('Time is up');
    expect(timeLeftWords(Number.NaN)).toBe('Time is up');
  });
});
