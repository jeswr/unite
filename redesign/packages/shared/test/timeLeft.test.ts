import { describe, expect, it } from 'vitest';
import { timeLeftWords } from '../src/index.js';

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('timeLeftWords', () => {
  it('says days, hours or minutes, in words', () => {
    expect(timeLeftWords(3 * DAY)).toBe('3 days left');
    expect(timeLeftWords(3 * DAY + 20 * HOUR)).toBe('3 days left');
    expect(timeLeftWords(DAY)).toBe('1 day left');
    expect(timeLeftWords(DAY + 5 * HOUR)).toBe('1 day left');
    expect(timeLeftWords(5 * HOUR)).toBe('5 hours left');
    expect(timeLeftWords(5 * HOUR + 50 * MIN)).toBe('5 hours left');
    expect(timeLeftWords(HOUR)).toBe('1 hour left');
    expect(timeLeftWords(20 * MIN)).toBe('20 minutes left');
    expect(timeLeftWords(19 * MIN + 1)).toBe('20 minutes left');
    expect(timeLeftWords(MIN)).toBe('1 minute left');
    expect(timeLeftWords(1)).toBe('1 minute left');
  });

  it('keeps saying "3 days left" in the first hour of a three-day room, and so on down', () => {
    expect(timeLeftWords(3 * DAY - 30 * SEC)).toBe('3 days left');
    expect(timeLeftWords(3 * DAY - 59 * MIN)).toBe('3 days left');
    expect(timeLeftWords(3 * DAY - 61 * MIN)).toBe('2 days left');
    expect(timeLeftWords(2 * DAY + 12 * HOUR)).toBe('2 days left');
    expect(timeLeftWords(23 * HOUR + 30 * MIN)).toBe('1 day left');
    expect(timeLeftWords(22 * HOUR + 50 * MIN)).toBe('22 hours left');
    expect(timeLeftWords(5 * HOUR - 2 * MIN)).toBe('5 hours left');
    expect(timeLeftWords(5 * HOUR - 6 * MIN)).toBe('4 hours left');
    expect(timeLeftWords(56 * MIN)).toBe('1 hour left');
    expect(timeLeftWords(54 * MIN)).toBe('54 minutes left');
  });

  it('says the time is up at or after the end', () => {
    expect(timeLeftWords(0)).toBe('Time is up');
    expect(timeLeftWords(-5 * MIN)).toBe('Time is up');
    expect(timeLeftWords(Number.NaN)).toBe('Time is up');
  });
});
