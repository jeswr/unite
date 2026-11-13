import { describe, expect, it } from 'vitest';
import { STAGES, FOLLOW_UP_EXAMPLE, followUp, generalWord } from '../lib/interviewer';
import { extractPoints, type Answer } from '../lib/points';

describe('the interviewer follows general words down to an event', () => {
  it('asks for a time when an answer rests on a general word', () => {
    expect(followUp('Money, mostly.')).toBe('You said “money”. Can you tell me about a time that showed up in your day?');
    expect(followUp('The government.')).toMatch(/You said “the government”/);
    expect(followUp('Pesa tu.')).toMatch(/“pesa”/);
    expect(followUp('Rząd i ceny.')).toMatch(/“rząd”/);
    expect(followUp('El gobierno.')).toMatch(/“gobierno”/);
    expect(followUp('টাকা।')).toMatch(/“টাকা”/);
  });

  it('does not follow up when the answer already describes an event', () => {
    expect(followUp('Yesterday the government office closed before I got there.')).toBeNull();
    expect(followUp(FOLLOW_UP_EXAMPLE)).toBeNull();
    expect(followUp('Jana pesa ya basi iliisha.')).toBeNull();
  });

  it('does not follow up on ordinary answers', () => {
    expect(followUp('The rain and the mud on the road.')).toBeNull();
    expect(generalWord('My systematic approach')).toBeNull();
  });

  it('only ever asks questions', () => {
    for (const s of STAGES) expect(s.prompt.trim().endsWith('?')).toBe(true);
  });
});

describe('"Here is what I heard"', () => {
  const example: Answer[] = [
    ...STAGES.map((s) => ({ stage: s.id, text: s.example })),
    { stage: 'inway', text: FOLLOW_UP_EXAMPLE, followUp: true },
  ];

  it('picks three to five points in the visitor’s own words', () => {
    const pts = extractPoints(example);
    expect(pts.length).toBeGreaterThanOrEqual(3);
    expect(pts.length).toBeLessThanOrEqual(5);
    for (const p of pts) expect(example.some((a) => a.text.includes(p.text.replace(/…$/, '')))).toBe(true);
  });

  it('prefers the event over the general word', () => {
    const inway = extractPoints(example).find((p) => p.stage === 'inway');
    expect(inway?.text).toBe(FOLLOW_UP_EXAMPLE);
  });

  it('is deterministic and handles empty answers', () => {
    expect(extractPoints(example)).toEqual(extractPoints(example));
    expect(extractPoints([])).toEqual([]);
    expect(extractPoints([{ stage: 'mattered', text: '   ' }])).toEqual([]);
  });

  it('shortens long sentences without rewording them', () => {
    const long = 'I want ' + 'a calm morning with time for breakfast, '.repeat(8) + 'and nothing else.';
    const [p] = extractPoints([{ stage: 'goodday', text: long }]);
    expect(p.text.endsWith('…')).toBe(true);
    expect(long.startsWith(p.text.replace(/…$/, ''))).toBe(true);
  });
});
