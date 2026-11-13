import { stableId, type Turn } from '@unite/shared';
import { afterEach, describe, expect, it } from 'vitest';
import type { AiResponse } from '../src/ai/client.js';
import { extractPoints, filterPoints, scriptedPoints } from '../src/ai/points.js';
import { EXTRACT_POINTS_SYSTEM } from '../src/ai/prompts.js';
import { fakeRunner, testEnv, type TestEnv } from './helpers.js';

const t = (key: string, stage: number, text: string, role: Turn['role'] = 'person') => ({ id: stableId('trn', key), role, stage, text });

const turns = [
  t('q1', 1, 'Tell me about yesterday?', 'interviewer'),
  t('a1', 1, 'I got off the night shift at six. Then I took the 5am bus home and slept until two.'),
  t('a1b', 1, 'Short one.'),
  t('a2', 2, 'Seeing my daughter after school mattered most. She tells me about her day.'),
  t('a3', 3, 'I wanted to go to the welding course but it only runs at seven in the evening when I am at work.'),
  t('a4', 4, 'I would finish work at four and pick her up from school myself.'),
  t('a7', 7, 'Run the course on Saturday mornings. Or record it so I can watch it later.'),
];

const out = (points: { type: string; text: string; source_turn_ids: string[] }[]): AiResponse => ({
  stop_reason: 'end_turn',
  parsed_output: { points },
  usage: { input_tokens: 10, output_tokens: 10 },
});

describe('extractPoints (section 6.2)', () => {
  let env: TestEnv | undefined;
  afterEach(async () => {
    await env?.close();
    env = undefined;
  });

  it('drops points that are not in the person’s words, have no real source, or are over 30 words', () => {
    const kept = filterPoints(
      [
        { type: 'barrier', text: 'The welding course only runs at seven in the evening when I am at work', sourceTurnIds: [turns[4]!.id] },
        { type: 'barrier', text: 'Public transport and the cost of living make retraining difficult', sourceTurnIds: [turns[4]!.id] },
        { type: 'moment', text: 'I took the 5am bus home', sourceTurnIds: [] },
        { type: 'moment', text: 'I took the 5am bus home', sourceTurnIds: ['trn_notarealturn'] },
        { type: 'moment', text: 'Tell me about yesterday', sourceTurnIds: [turns[0]!.id] },
        { type: 'idea', text: Array.from({ length: 31 }, () => 'saturday').join(' '), sourceTurnIds: [turns[6]!.id] },
      ],
      turns,
    );
    expect(kept).toEqual([{ type: 'barrier', text: 'The welding course only runs at seven in the evening when I am at work', sourceTurnIds: [turns[4]!.id] }]);
  });

  it('the scripted extractor takes the first sentence of the longest turn in stages 1, 2, 3, 4 and 7', () => {
    expect(scriptedPoints(turns)).toEqual([
      { type: 'moment', text: 'I got off the night shift at six.', sourceTurnIds: [turns[1]!.id] },
      { type: 'matters', text: 'Seeing my daughter after school mattered most.', sourceTurnIds: [turns[3]!.id] },
      { type: 'barrier', text: turns[4]!.text, sourceTurnIds: [turns[4]!.id] },
      { type: 'wish', text: turns[5]!.text, sourceTurnIds: [turns[5]!.id] },
      { type: 'idea', text: 'Run the course on Saturday mornings.', sourceTurnIds: [turns[6]!.id] },
    ]);
  });

  it('fills in from the scripted extractor when fewer than three points pass', async () => {
    const f = fakeRunner([
      out([
        { type: 'barrier', text: 'The welding course only runs at seven in the evening', source_turn_ids: [turns[4]!.id] },
        { type: 'matters', text: 'Family time is a core value', source_turn_ids: [turns[3]!.id] },
      ]),
    ]);
    env = await testEnv({ config: { anthropicKey: 'k' }, runner: f.runner });
    const r = await extractPoints(env!.deps, turns, { mode: 'claude' });
    expect(f.requests[0]!.system).toBe(EXTRACT_POINTS_SYSTEM);
    expect(JSON.stringify(f.requests[0]!.messages)).toContain(turns[4]!.id);
    expect(r.source).toBe('ai');
    expect(r.points.map((p) => p.text)).toEqual([
      'The welding course only runs at seven in the evening',
      'I got off the night shift at six.',
      'Seeing my daughter after school mattered most.',
    ]);
  });

  it('keeps at most seven points', async () => {
    const many = Array.from({ length: 9 }, () => ({ type: 'moment', text: 'I took the 5am bus home', source_turn_ids: [turns[1]!.id] }));
    env = await testEnv({ config: { anthropicKey: 'k' }, runner: fakeRunner([out(many)]).runner });
    expect((await extractPoints(env!.deps, turns, { mode: 'claude' })).points).toHaveLength(7);
  });

  it('draws up to three points from a single written answer', () => {
    const one = [t('f', 1, 'The bus is late every day. I miss the start of my shift. My manager docks my pay. I want a car.')];
    expect(scriptedPoints(one, { freetext: true }).map((p) => [p.type, p.text])).toEqual([
      ['moment', 'The bus is late every day.'],
      ['matters', 'I miss the start of my shift.'],
      ['barrier', 'My manager docks my pay.'],
    ]);
  });
});
