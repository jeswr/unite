import { stableId } from '@unite/shared';
import { afterEach, describe, expect, it } from 'vitest';
import {
  checkDrafts,
  checkLeading,
  checkSentences,
  describeTheme,
  draftStatements,
  greedyGroups,
  groupPoints,
  reviseStatement,
  type GroupPoint,
} from '../src/ai/synthesis.js';
import { DESCRIBE_THEME_SYSTEM, DRAFT_STATEMENTS_SYSTEM, GROUP_POINTS_SYSTEM } from '../src/ai/prompts.js';
import type { AiRequest } from '../src/ai/client.js';
import { fakeRunner, testEnv, type TestEnv } from './helpers.js';
import { answer, sentData } from './picture.fixtures.js';

const p = (key: string, type: GroupPoint['type'], text: string): GroupPoint => ({ id: stableId('pt', key), type, text });

let env: TestEnv | undefined;
afterEach(async () => {
  await env?.close();
  env = undefined;
});

describe('groupPoints', () => {
  it('falls back to greedy grouping by word overlap within a kind, named by the shortest point', async () => {
    env = await testEnv();
    const pts = [
      p('a', 'barrier', 'Courses run when I am at work on the night shift'),
      p('b', 'barrier', 'The night shift means I miss every course'),
      p('c', 'barrier', 'Childcare costs too much'),
      p('d', 'moment', 'Walked the dog by the river at dawn'),
      p('e', 'tradeoff', 'Money or time with my kids'),
      p('f', 'doubt', 'Not sure any course leads to a job'),
    ];
    const { groups, fallback } = await groupPoints(env.deps, [], pts);
    expect(fallback).toBe(true);
    expect(groups).toHaveLength(3);
    const shift = groups.find((g) => g.pointIds.includes(pts[0]!.id))!;
    expect(shift.pointIds).toEqual([pts[0]!.id, pts[1]!.id]);
    expect(shift.name).toBe('The night shift means I miss every course');
    expect(groups.find((g) => g.pointIds.includes(pts[3]!.id))!.kind).toBe('day');
    // Trade-offs and doubts are not themed.
    expect(groups.flatMap((g) => g.pointIds)).not.toContain(pts[4]!.id);
    expect(groups.flatMap((g) => g.pointIds)).not.toContain(pts[5]!.id);
  });

  it('adds to an existing theme when a point overlaps with its points', () => {
    const existing = [{ id: stableId('thm', 'x'), kind: 'barrier' as const, name: 'Night shifts', points: [p('a', 'barrier', 'Night shifts stop me learning')] }];
    const groups = greedyGroups('barrier', existing, [p('b', 'barrier', 'I work night shifts')]);
    expect(groups).toEqual([{ themeId: existing[0]!.id, kind: 'barrier', name: 'Night shifts', pointIds: [stableId('pt', 'b')] }]);
  });

  it('sends at most 100 points per call and keeps names taken from the points', async () => {
    const pts = Array.from({ length: 150 }, (_, i) => p(`m${i}`, 'matters', `Point number ${i} about family time`));
    const { runner, requests } = fakeRunner((req: AiRequest) => {
      const data = sentData(req) as { newPoints: { id: string }[] };
      return answer({
        groups: [
          { themeId: null, name: 'A label nobody said', pointIds: data.newPoints.slice(0, 50).map((x) => x.id) },
          { themeId: null, name: 'family time', pointIds: data.newPoints.slice(50).map((x) => x.id) },
        ],
      });
    });
    env = await testEnv({ config: { anthropicKey: 'test' }, runner });
    const { groups, fallback } = await groupPoints(env.deps, [], pts);
    expect(fallback).toBe(false);
    expect(requests).toHaveLength(2);
    expect(requests.every((r) => r.system === GROUP_POINTS_SYSTEM)).toBe(true);
    expect(requests.map((r) => (sentData(r).newPoints as unknown[]).length)).toEqual([100, 50]);
    // The second batch was offered the themes made by the first.
    expect((sentData(requests[1]!).existingThemes as unknown[]).length).toBe(2);
    expect(groups.flatMap((g) => g.pointIds).sort()).toEqual(pts.map((x) => x.id).sort());
    // A name not taken from the points is replaced by the shortest point.
    expect(groups.map((g) => g.name)).not.toContain('A label nobody said');
    expect(groups.map((g) => g.name)).toContain('family time');
  });

  it('groups by the fallback any points the model left out, and drops ids it invented', async () => {
    const pts = [p('a', 'idea', 'Evening classes in the library'), p('b', 'idea', 'Classes in the library at night')];
    const { runner } = fakeRunner([answer({ groups: [{ themeId: null, name: 'Evening classes', pointIds: [pts[0]!.id, 'pt_invented0000'] }] })]);
    env = await testEnv({ config: { anthropicKey: 'test' }, runner });
    const { groups } = await groupPoints(env.deps, [], pts);
    expect(groups).toEqual([{ themeId: null, kind: 'idea', name: 'Evening classes', pointIds: [pts[0]!.id, pts[1]!.id] }]);
  });
});

describe('rule 3: theme sentences need sources in the theme', () => {
  const theme = { name: 'Night shifts', kind: 'barrier' as const, pointIds: [stableId('pt', 'a'), stableId('pt', 'b')] };
  const pts = [p('a', 'barrier', 'Night shifts'), p('b', 'barrier', 'Shifts change every week')];

  it('drops a sentence with no sources or with a source outside the theme', () => {
    expect(
      checkSentences(
        [
          { text: 'Shifts get in the way.', pointIds: [stableId('pt', 'a')] },
          { text: 'No source.', pointIds: [] },
          { text: 'Outside.', pointIds: [stableId('pt', 'a'), stableId('pt', 'zzz')] },
          { text: '  ', pointIds: [stableId('pt', 'b')] },
        ],
        theme.pointIds,
      ),
    ).toEqual([{ text: 'Shifts get in the way.', pointIds: [stableId('pt', 'a')] }]);
  });

  it('applies the check to what the model wrote', async () => {
    const { runner, requests } = fakeRunner([
      answer({
        sentences: [
          { text: 'Shifts change every week.', pointIds: [stableId('pt', 'b')] },
          { text: 'Invented.', pointIds: ['pt_notinthemeX'] },
        ],
      }),
    ]);
    env = await testEnv({ config: { anthropicKey: 'test' }, runner });
    const { sentences } = await describeTheme(env.deps, theme, pts);
    expect(requests[0]!.system).toBe(DESCRIBE_THEME_SYSTEM);
    expect(requests[0]!.output_config.effort).toBe('medium');
    expect(sentences).toEqual([{ text: 'Shifts change every week.', pointIds: [stableId('pt', 'b')] }]);
  });

  it('has no sentences without the AI', async () => {
    env = await testEnv();
    expect(await describeTheme(env.deps, theme, pts)).toEqual({ sentences: [], fallback: true });
  });
});

describe('draftStatements', () => {
  it('keeps only statements with real sources, at most 30 words, at most 12', async () => {
    const real = stableId('pt', 'a');
    const long = Array.from({ length: 31 }, () => 'word').join(' ');
    const drafts = [
      { text: 'Classes should run at night.', pointIds: [real] },
      { text: 'No sources.', pointIds: ['pt_nope00000000'] },
      { text: long, pointIds: [real] },
      ...Array.from({ length: 15 }, (_, i) => ({ text: `Statement ${i}`, pointIds: [real] })),
    ];
    const kept = checkDrafts(drafts, [real]);
    expect(kept).toHaveLength(12);
    expect(kept[0]).toEqual({ text: 'Classes should run at night.', pointIds: [real] });
    expect(kept.map((d) => d.text)).not.toContain('No sources.');
    expect(kept.map((d) => d.text)).not.toContain(long);
  });

  it('drafts none without the AI, and uses the published prompt with it', async () => {
    env = await testEnv();
    const input = { question: 'Q?', themes: [], points: [p('a', 'idea', 'Night classes')] };
    expect(await draftStatements(env.deps, input)).toEqual({ statements: [], fallback: true });
    await env.close();
    env = undefined;
    const { runner, requests } = fakeRunner([answer({ statements: [{ text: 'Classes should run at night.', pointIds: [stableId('pt', 'a')] }] })]);
    env = await testEnv({ config: { anthropicKey: 'test' }, runner });
    expect((await draftStatements(env.deps, input)).statements).toHaveLength(1);
    expect(requests[0]!.system).toBe(DRAFT_STATEMENTS_SYSTEM);
  });
});

describe('reviseStatement and checkLeading', () => {
  it('returns the original unchanged without the AI', async () => {
    env = await testEnv();
    const r = await reviseStatement(env.deps, { text: 'Classes at night.' }, ['Classes in the evening.'], []);
    expect(r).toMatchObject({ text: 'Classes at night.', changed: false, fallback: true });
  });

  it('checks leading wording against the phrase list without the AI', async () => {
    env = await testEnv();
    expect(await checkLeading(env.deps, "Wouldn't you agree that buses are too slow?")).toMatchObject({ leading: true, fallback: true });
    expect(await checkLeading(env.deps, 'What gets in the way of learning?')).toMatchObject({ leading: false, fallback: true });
  });
});
