// The invented example conversations. Every count on the site is computed from these records,
// so the numbers agree with each other. Nothing here is random: the same records are built every time.
import { LAYERS } from './layers';
import type { AgeBand, CareView, Conversation, Door, LayerId, Route, ThemeId, WorkView } from './types';

type PerDoor = [open: number, drawn: number];

/** How many people in each layer and door raised each theme (example data). */
export const THEME_COUNTS: Record<ThemeId, Partial<Record<LayerId, PerDoor>>> = {
  time: { kisumu: [11, 8], krakow: [12, 8], medellin: [12, 7], dhaka: [10, 9], glasgow: [13, 6], cusco: [7, 0] },
  move: { kisumu: [13, 9], krakow: [9, 6], medellin: [12, 9], dhaka: [13, 11], glasgow: [11, 6], cusco: [5, 0] },
  respect: { kisumu: [9, 7], krakow: [8, 6], medellin: [9, 5], dhaka: [8, 8], glasgow: [7, 3], cusco: [8, 0] },
  safe: { kisumu: [7, 5], krakow: [3, 2], medellin: [10, 7], dhaka: [9, 8], glasgow: [8, 4] },
  water: { kisumu: [6, 5], dhaka: [5, 4], cusco: [6, 0] },
  ownlang: { kisumu: [2, 1], glasgow: [2, 1], cusco: [9, 0] },
  lonely: { krakow: [4, 3], glasgow: [3, 2] },
  damp: { glasgow: [5, 3] },
  lanes: { dhaka: [6, 5] },
  youth: { medellin: [5, 3] },
  fish: { kisumu: [3, 2] },
  fairprice: { kisumu: [8, 5], medellin: [5, 3], cusco: [6, 0] },
  cheapfood: { dhaka: [7, 6], glasgow: [5, 3], krakow: [4, 3] },
  newhomes: { krakow: [6, 4], medellin: [4, 3], glasgow: [5, 3] },
  green: { krakow: [5, 4], glasgow: [3, 2] },
};

type Split<K extends string> = Record<LayerId, Record<Door, Partial<Record<K, number>>>>;

/** "What place work has in a good day": one answer per person, or unsaid. */
export const WORK_SPLIT: Split<WorkView> = {
  kisumu: { open: { steady: 5, limit: 3, own: 7, unsaid: 3 }, drawn: { steady: 4, limit: 2, own: 4, unsaid: 2 } },
  krakow: { open: { steady: 5, limit: 7, own: 2, unsaid: 3 }, drawn: { steady: 4, limit: 5, own: 2, unsaid: 2 } },
  medellin: { open: { steady: 7, limit: 4, own: 4, unsaid: 3 }, drawn: { steady: 5, limit: 3, own: 2, unsaid: 2 } },
  dhaka: { open: { steady: 8, limit: 3, own: 2, unsaid: 3 }, drawn: { steady: 7, limit: 3, own: 2, unsaid: 2 } },
  glasgow: { open: { steady: 4, limit: 9, own: 2, unsaid: 4 }, drawn: { steady: 3, limit: 5, own: 1, unsaid: 2 } },
  cusco: { open: { steady: 1, own: 3, ayni: 7, unsaid: 1 }, drawn: {} },
};

/** "Who cares for older people". */
export const CARE_SPLIT: Split<CareView> = {
  kisumu: { open: { home: 9, places: 2, useful: 3, unsaid: 4 }, drawn: { home: 6, places: 2, useful: 2, unsaid: 2 } },
  krakow: { open: { home: 3, places: 7, useful: 3, unsaid: 4 }, drawn: { home: 2, places: 6, useful: 2, unsaid: 3 } },
  medellin: { open: { home: 8, places: 3, useful: 3, unsaid: 4 }, drawn: { home: 5, places: 2, useful: 2, unsaid: 3 } },
  dhaka: { open: { home: 10, places: 2, useful: 2, unsaid: 2 }, drawn: { home: 9, places: 2, useful: 1, unsaid: 2 } },
  glasgow: { open: { home: 2, places: 9, useful: 3, unsaid: 5 }, drawn: { home: 2, places: 5, useful: 2, unsaid: 2 } },
  cusco: { open: { home: 7, useful: 4, unsaid: 1 }, drawn: {} },
};

export const AGE_SPLIT: Split<AgeBand> = {
  kisumu: { open: { '18–29': 7, '30–44': 6, '45–64': 4, '65+': 1 }, drawn: { '18–29': 3, '30–44': 4, '45–64': 3, '65+': 2 } },
  krakow: { open: { '18–29': 6, '30–44': 6, '45–64': 4, '65+': 1 }, drawn: { '18–29': 3, '30–44': 4, '45–64': 4, '65+': 2 } },
  medellin: { open: { '18–29': 8, '30–44': 6, '45–64': 3, '65+': 1 }, drawn: { '18–29': 3, '30–44': 4, '45–64': 3, '65+': 2 } },
  dhaka: { open: { '18–29': 6, '30–44': 6, '45–64': 3, '65+': 1 }, drawn: { '18–29': 4, '30–44': 4, '45–64': 4, '65+': 2 } },
  glasgow: { open: { '18–29': 7, '30–44': 6, '45–64': 5, '65+': 1 }, drawn: { '18–29': 2, '30–44': 4, '45–64': 3, '65+': 2 } },
  cusco: { open: { '18–29': 2, '30–44': 3, '45–64': 4, '65+': 3 }, drawn: {} },
};

export const ROUTE_SPLIT: Split<Route> = {
  kisumu: { open: { web: 4, voice: 6, phone: 7, listener: 1 }, drawn: { web: 1, voice: 3, phone: 7, listener: 1 } },
  krakow: { open: { web: 15, voice: 1, phone: 1 }, drawn: { web: 9, phone: 3, listener: 1 } },
  medellin: { open: { web: 9, voice: 6, phone: 3 }, drawn: { web: 4, voice: 4, phone: 4 } },
  dhaka: { open: { web: 3, voice: 8, phone: 4, listener: 1 }, drawn: { web: 1, voice: 5, phone: 6, listener: 2 } },
  glasgow: { open: { web: 16, voice: 1, phone: 2 }, drawn: { web: 7, phone: 3, listener: 1 } },
  cusco: { open: { listener: 12 }, drawn: {} },
};

/** Spread k marks evenly over n slots, starting at an offset, so themes do not all land on the same people. */
export function spread(k: number, n: number, offset: number): number[] {
  if (k > n) throw new Error(`cannot place ${k} in ${n}`);
  const out: number[] = [];
  for (let i = 0; i < k; i++) out.push((Math.floor((i * n) / k) + offset) % n);
  return out;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Lay out categories by their counts, then interleave with a fixed stride. */
function deal<K extends string>(counts: Partial<Record<K, number>>, n: number, stride: number): K[] {
  const flat: K[] = [];
  for (const [k, c] of Object.entries(counts) as [K, number][]) for (let i = 0; i < c; i++) flat.push(k);
  if (flat.length !== n) throw new Error(`split adds to ${flat.length}, expected ${n}`);
  let s = stride;
  while (n > 1 && gcd(s, n) !== 1) s++;
  return flat.map((_, j) => flat[(j * s) % n]);
}

function build(): Conversation[] {
  const out: Conversation[] = [];
  const themeIds = Object.keys(THEME_COUNTS) as ThemeId[];
  for (const layer of LAYERS) {
    for (const door of ['open', 'drawn'] as Door[]) {
      const n = layer.size[door];
      if (n === 0) continue;
      const work = deal(WORK_SPLIT[layer.id][door], n, 5);
      const care = deal(CARE_SPLIT[layer.id][door], n, 7);
      const age = deal(AGE_SPLIT[layer.id][door], n, 3);
      const route = deal(ROUTE_SPLIT[layer.id][door], n, 11);
      const themes: ThemeId[][] = Array.from({ length: n }, () => []);
      themeIds.forEach((t, ti) => {
        const pair = THEME_COUNTS[t][layer.id];
        if (!pair) return;
        const k = pair[door === 'open' ? 0 : 1];
        for (const idx of spread(k, n, ti * 3)) themes[idx].push(t);
      });
      for (let i = 0; i < n; i++) {
        out.push({
          id: `${layer.id}-${door}-${String(i + 1).padStart(2, '0')}`,
          layer: layer.id,
          door,
          route: route[i],
          age: age[i],
          area: (i + (door === 'drawn' ? 2 : 0)) % layer.areas.length,
          themes: themes[i],
          work: work[i],
          care: care[i],
        });
      }
    }
  }
  return out;
}

export const CONVERSATIONS: Conversation[] = build();
