import { describe, expect, it } from 'vitest';
import { drawRoom } from '../src/services/rooms/draw.js';

const a = Array.from({ length: 10 }, (_, i) => `per_a${String(i).padStart(11, '0')}`);
const b = Array.from({ length: 4 }, (_, i) => `per_b${String(i).padStart(11, '0')}`);
const loose = ['per_c00000000000', 'per_c00000000001'];
const everyone = [...a, ...b, ...loose];
const groups = [
  { key: 'a' as const, personIds: a },
  { key: 'b' as const, personIds: b },
];

describe('drawRoom', () => {
  it('is deterministic for a seed, whatever the input order', () => {
    const one = drawRoom(everyone, groups, 6, 'seed-1');
    const two = drawRoom([...everyone].reverse(), [...groups].reverse(), 6, 'seed-1');
    expect(one).toEqual(two);
    expect(new Set(one).size).toBe(6);
  });

  it('draws differently with a different seed', () => {
    const draws = new Set(['s1', 's2', 's3', 's4', 's5'].map((s) => drawRoom(everyone, groups, 6, s).join(',')));
    expect(draws.size).toBeGreaterThan(1);
  });

  it('alternates groups while both have people left', () => {
    const room = drawRoom(everyone, groups, 6, 'x');
    expect(room.filter((id) => a.includes(id))).toHaveLength(3);
    expect(room.filter((id) => b.includes(id))).toHaveLength(3);
    const room8 = drawRoom(everyone, groups, 8, 'x');
    // b has only 4: then the rest come from a.
    expect(room8.filter((id) => b.includes(id))).toHaveLength(4);
    expect(room8.filter((id) => a.includes(id))).toHaveLength(4);
  });

  it('fills from people in no group only when the groups run out', () => {
    const small = [
      { key: 'a' as const, personIds: a.slice(0, 2) },
      { key: 'b' as const, personIds: b.slice(0, 2) },
    ];
    const room = drawRoom([...a.slice(0, 2), ...b.slice(0, 2), ...loose], small, 6, 'y');
    expect(room).toHaveLength(6);
    expect(room.slice(4).sort()).toEqual([...loose].sort());
  });

  it('only draws eligible people and keeps the size between 5 and 8', () => {
    const room = drawRoom(a.slice(0, 3).concat(b), groups, 6, 'z');
    expect(room.every((id) => a.slice(0, 3).includes(id) || b.includes(id))).toBe(true);
    expect(drawRoom(everyone, groups, 20, 'z')).toHaveLength(8);
    expect(drawRoom(everyone, groups, 2, 'z')).toHaveLength(5);
  });
});
