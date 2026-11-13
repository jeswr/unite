import { describe, expect, it } from 'vitest';
import {
  classifyStatement,
  countPeople,
  opinionGroups,
  statementSupport,
  stillNeeded,
  type OpinionGroups,
  type Reaction,
} from '../src/index.js';

type R = Pick<Reaction, 'personId' | 'statementId' | 'value'>;
const pledge = { groupThreshold: 0.6, minParticipants: 40 };

describe('countPeople', () => {
  it('counts distinct people among approved points only', () => {
    expect(
      countPeople([
        { personId: 'a', status: 'approved' },
        { personId: 'a', status: 'approved' },
        { personId: 'b', status: 'approved' },
        { personId: 'c', status: 'draft' },
        { personId: 'd', status: 'scrapped' },
      ]),
    ).toBe(2);
    expect(countPeople([])).toBe(0);
  });
});

/** Two clear camps over statements s1..s4: camp A agrees with s1, s2 and disagrees with s3, s4; camp B the opposite. */
function camps(a: number, b: number): R[] {
  const out: R[] = [];
  for (let i = 0; i < a; i++)
    for (const [s, v] of [['s1', 'agree'], ['s2', 'agree'], ['s3', 'disagree'], ['s4', 'disagree']] as const)
      out.push({ personId: `a${String(i).padStart(2, '0')}`, statementId: s, value: v });
  for (let i = 0; i < b; i++)
    for (const [s, v] of [['s1', 'disagree'], ['s2', 'disagree'], ['s3', 'agree'], ['s4', 'agree']] as const)
      out.push({ personId: `b${String(i).padStart(2, '0')}`, statementId: s, value: v });
  return out;
}
const S = ['s1', 's2', 's3', 's4'];

describe('opinionGroups', () => {
  it('finds two groups when people split clearly, the larger as a', () => {
    const g = opinionGroups(camps(6, 4), S);
    expect(g.groups).toHaveLength(2);
    expect(g.groups[0]!.key).toBe('a');
    expect(g.groups[0]!.personIds.every((p) => p.startsWith('a'))).toBe(true);
    expect(g.groups[0]!.personIds).toHaveLength(6);
    expect(g.groups[1]!.personIds.every((p) => p.startsWith('b'))).toBe(true);
  });

  it('is deterministic whatever the order of reactions', () => {
    const r = camps(5, 5);
    expect(opinionGroups([...r].reverse(), S)).toEqual(opinionGroups(r, S));
  });

  it('returns one group with fewer than 8 qualifying people', () => {
    const g = opinionGroups(camps(4, 3), S);
    expect(g.groups).toHaveLength(1);
    expect(g.groups[0]!.personIds).toHaveLength(7);
  });

  it('leaves out people with fewer than 3 reactions', () => {
    const r = [...camps(5, 5), { personId: 'z', statementId: 's1', value: 'agree' as const }, { personId: 'z', statementId: 's2', value: 'agree' as const }];
    const all = opinionGroups(r, S).groups.flatMap((g) => g.personIds);
    expect(all).not.toContain('z');
  });

  it('returns one group when everyone answers alike', () => {
    const r: R[] = [];
    for (let i = 0; i < 10; i++) for (const s of S) r.push({ personId: `p${i}`, statementId: s, value: i === 0 && s === 's1' ? 'unsure' : 'agree' });
    expect(opinionGroups(r, S).groups).toHaveLength(1);
  });

  it('returns one group when the centroids are less than 0.5 apart', () => {
    // Everyone agrees with s1..s3; half are unsure about s4: a gap of 1 on one statement in four, 0.25.
    const r: R[] = [];
    for (let i = 0; i < 10; i++)
      for (const s of S) r.push({ personId: `p${i}`, statementId: s, value: s === 's4' && i % 2 ? 'unsure' : 'agree' });
    expect(opinionGroups(r, S).groups).toHaveLength(1);
  });

  it('ignores reactions to statements not asked about', () => {
    const r = camps(6, 4).map((x) => ({ ...x, statementId: x.statementId === 's1' ? 'other' : x.statementId }));
    expect(opinionGroups(r, ['s2', 's3', 's4']).groups).toHaveLength(2);
  });
});

describe('statementSupport and classifyStatement', () => {
  const groups: OpinionGroups = {
    groups: [
      { key: 'a', personIds: ['a1', 'a2', 'a3', 'a4', 'a5'] },
      { key: 'b', personIds: ['b1', 'b2', 'b3', 'b4', 'b5'] },
    ],
  };
  const answers = (st: string, a: R['value'][], b: R['value'][]): R[] => [
    ...a.map((value, i) => ({ personId: `a${i + 1}`, statementId: st, value })),
    ...b.map((value, i) => ({ personId: `b${i + 1}`, statementId: st, value })),
  ];

  it('tallies overall and per group', () => {
    const s = statementSupport({ id: 'x' }, [...answers('x', ['agree', 'agree', 'disagree'], ['unsure', 'agree']), ...answers('y', ['agree'], [])], groups);
    expect(s.overall).toEqual({ agree: 3, disagree: 1, unsure: 1, total: 5, share: 0.6 });
    expect(s.groups[0]).toMatchObject({ key: 'a', agree: 2, disagree: 1, total: 3 });
    expect(s.groups[1]).toMatchObject({ key: 'b', agree: 1, unsure: 1, total: 2, share: 0.5 });
  });

  it('share is 0 when nobody has answered', () => {
    expect(statementSupport({ id: 'x' }, [], groups).overall.share).toBe(0);
  });

  it('common ground needs every group at the threshold, 3 each, and enough counted', () => {
    const s = statementSupport({ id: 'x' }, answers('x', ['agree', 'agree', 'agree', 'disagree'], ['agree', 'agree', 'unsure']), groups);
    expect(classifyStatement(s, pledge, 10)).toBe('common_ground');
    expect(classifyStatement(s, pledge, 9)).toBe('not_enough');
    expect(classifyStatement(s, { groupThreshold: 0.6, minParticipants: 7 }, 7)).toBe('common_ground');
  });

  it('a group with fewer than 3 reactions blocks common ground', () => {
    const s = statementSupport({ id: 'x' }, answers('x', ['agree', 'agree', 'agree'], ['agree', 'agree']), groups);
    expect(classifyStatement(s, pledge, 10)).toBe('not_enough');
  });

  it('differ when one group is below 0.4 and another at the threshold', () => {
    const s = statementSupport({ id: 'x' }, answers('x', ['agree', 'agree', 'agree'], ['disagree', 'disagree', 'agree']), groups);
    expect(classifyStatement(s, pledge, 20)).toBe('differ');
  });

  it('a group nobody in has answered does not make a split', () => {
    const s = statementSupport({ id: 'x' }, answers('x', ['agree', 'agree', 'agree'], []), groups);
    expect(classifyStatement(s, pledge, 20)).toBe('not_enough');
  });
});

describe('stillNeeded', () => {
  const groups: OpinionGroups = {
    groups: [
      { key: 'a', personIds: ['a1', 'a2', 'a3', 'a4', 'a5'] },
      { key: 'b', personIds: ['b1', 'b2', 'b3', 'b4', 'b5'] },
    ],
  };
  const r = (p: string, value: R['value']): R => ({ personId: p, statementId: 'x', value });

  it('is empty when the rule is met', () => {
    const reactions = [r('a1', 'agree'), r('a2', 'agree'), r('a3', 'agree'), r('b1', 'agree'), r('b2', 'agree'), r('b3', 'agree')];
    const s = statementSupport({ id: 'x' }, reactions, groups);
    expect(stillNeeded({ id: 'x' }, s, [], pledge, 10)).toEqual([]);
    expect(classifyStatement(s, pledge, 10)).toBe('common_ground');
  });

  it('lists what is missing in plain words, in order', () => {
    const reactions = [r('a1', 'agree'), r('a2', 'agree'), r('a3', 'agree'), r('b1', 'agree'), r('b2', 'disagree'), r('b3', 'disagree'), r('b4', 'unsure'), r('b5', 'agree')];
    const s = statementSupport({ id: 'x' }, reactions, groups);
    const out = stillNeeded({ id: 'x' }, s, [{ statementId: 'x', status: 'open' }, { statementId: 'y', status: 'open' }, { statementId: 'x', status: 'answered' }], pledge, 8);
    expect(out).toEqual([
      '2 more people need to answer',
      'People who answered differently from the majority are below the level the pledge set (40% agree, 60% needed)',
      '1 objection is waiting for a reply',
    ]);
  });

  it('names a group that has too few answers', () => {
    const s = statementSupport({ id: 'x' }, [r('a1', 'agree'), r('a2', 'agree'), r('a3', 'agree'), r('b1', 'agree')], groups);
    expect(stillNeeded({ id: 'x' }, s, [], { groupThreshold: 0.6, minParticipants: 4 }, 4)).toEqual([
      '2 more people who answered differently from the majority need to answer',
    ]);
  });

  it('with one group shows a single count', () => {
    const one: OpinionGroups = { groups: [{ key: 'a', personIds: ['a1'] }] };
    const s = statementSupport({ id: 'x' }, [r('a1', 'agree')], one);
    expect(stillNeeded({ id: 'x' }, s, [], pledge, 9)).toEqual(['2 more people need to answer']);
    expect(stillNeeded({ id: 'x' }, s, [], pledge, 1)).toEqual(['9 more people need to answer']);
  });

  it('counts plural objections', () => {
    const s = statementSupport({ id: 'x' }, [], { groups: [{ key: 'a', personIds: [] }] });
    expect(stillNeeded({ id: 'x' }, s, [{ statementId: 'x', status: 'open' }, { statementId: 'x', status: 'open' }], { groupThreshold: 0.6, minParticipants: 1 }, 1).at(-1)).toBe(
      '2 objections are waiting for a reply',
    );
  });
});
