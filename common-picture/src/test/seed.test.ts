import { describe, expect, it } from 'vitest';
import { HISTORIES } from '../data/content';
import { LAYERS } from '../data/layers';
import { buildPicture, finding, layersWithTheme, pct } from '../data/picture';
import { CONVERSATIONS, THEME_COUNTS, WORK_SPLIT } from '../data/seed';
import type { ThemeId } from '../data/types';

describe('seed conversations', () => {
  it('has about thirty per place and a smaller circle', () => {
    for (const l of LAYERS) {
      const n = CONVERSATIONS.filter((c) => c.layer === l.id).length;
      expect(n).toBe(l.size.open + l.size.drawn);
      if (l.kind === 'place') expect(n).toBe(30);
    }
    expect(new Set(CONVERSATIONS.map((c) => c.id)).size).toBe(CONVERSATIONS.length);
  });

  it('reproduces every theme count exactly from the records', () => {
    for (const [theme, perLayer] of Object.entries(THEME_COUNTS) as [ThemeId, Record<string, [number, number]>][]) {
      for (const l of LAYERS) {
        const [o, d] = perLayer[l.id] ?? [0, 0];
        const has = (door: string) => CONVERSATIONS.filter((c) => c.layer === l.id && c.door === door && c.themes.includes(theme)).length;
        expect([has('open'), has('drawn')], `${theme} in ${l.id}`).toEqual([o, d]);
      }
    }
  });

  it('gives each person exactly one view on work', () => {
    for (const l of LAYERS) {
      const want = WORK_SPLIT[l.id].open.steady ?? 0;
      expect(CONVERSATIONS.filter((c) => c.layer === l.id && c.door === 'open' && c.work === 'steady').length).toBe(want);
    }
  });
});

describe('the picture', () => {
  it('computes both counts for a world finding from the seed data', () => {
    const f = finding('world', 'time');
    const drawn = CONVERSATIONS.filter((c) => c.door === 'drawn');
    expect(f.people.drawn).toEqual({ k: drawn.filter((c) => c.themes.includes('time')).length, n: drawn.length });
    expect(pct(f.people.drawn)).toBe(61);
    expect(f.spread).toMatchObject({ k: 6, n: 6 });
    expect(f.restsOn).toBe('drawn');
  });

  it('puts the planted minority theme in the world picture and passes the retention test', () => {
    const w = buildPicture('world');
    expect(w.here.map((f) => f.theme)).toContain('ownlang');
    expect(layersWithTheme('ownlang')).toHaveLength(3);
    expect(pct(finding('world', 'ownlang').people.drawn)).toBeLessThan(10);
    expect(w.retention).toMatchObject({ survive: 7, of: 8, threshold: 6 });
    expect(w.everywhere.map((f) => f.theme)).toEqual(['time', 'move', 'respect', 'safe']);
  });

  it('builds five parts for every layer, with the standing statement only where it belongs', () => {
    for (const l of LAYERS) {
      const p = buildPicture(l.id);
      expect(p.totals.open + p.totals.drawn).toBe(l.size.open + l.size.drawn);
      expect(p.standing).toBe(l.id === 'cusco');
      expect(p.notHeard.length).toBeGreaterThan(0);
    }
  });

  it('keeps edition histories consistent with the picture', () => {
    for (const h of HISTORIES.filter((x) => x.theme)) {
      expect(h.edition0, h.id).toBe(pct(finding('world', h.theme!).people.drawn));
      for (const e of h.events) {
        const m = e.what.match(/to (\d+)%/);
        if (m) expect(Number(m[1])).toBe(h.edition0);
      }
    }
  });
});
