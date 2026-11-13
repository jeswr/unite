// Builds the five parts of the picture for any layer from the seed conversations.
import { LAYER, LAYERS } from './layers';
import { CONVERSATIONS } from './seed';
import { CARE_STATEMENTS, STANDING_STATEMENT, TENSIONS, THEMES, WORK_STATEMENTS, type Tension } from './themes';
import type { AgeBand, CareView, Conversation, Door, LayerId, Quote, Route, ThemeId, WorkView } from './types';

export type View = LayerId | 'world';

export interface Count {
  k: number;
  n: number;
}

export const pct = (c: Count) => (c.n === 0 ? 0 : Math.round((100 * c.k) / c.n));

export interface Finding {
  id: string;
  theme: ThemeId;
  title: string;
  people: Record<Door, Count>;
  /** Second count: places and circles (world) or areas (inside a layer). */
  spread: Count & { label: string; names: string[] };
  restsOn: Door;
  quotes: Quote[];
}

export interface SplitRow {
  key: string;
  statement: string;
  people: Record<Door, Count>;
  layers: string[];
}

export interface Split {
  id: 'work' | 'care';
  question: string;
  rows: SplitRow[];
}

export interface TensionView {
  tension: Tension;
  a: Finding;
  b: Finding;
}

export interface RetentionItem {
  label: string;
  from: string;
  survived: boolean;
  where: string;
}

export interface Picture {
  view: View;
  title: string;
  everywhere: Finding[];
  alsoHeard: Finding[];
  differently: Split[];
  here: Finding[];
  standing: boolean;
  tensions: TensionView[];
  notHeard: { group: string; items: string[] }[];
  retention: { survive: number; of: number; threshold: number; note: string; items?: RetentionItem[] };
  totals: Record<Door, number>;
}

const COMMON: ThemeId[] = ['time', 'move', 'respect', 'safe'];
const DISTINCT: ThemeId[] = ['ownlang', 'lonely', 'water', 'damp', 'lanes', 'youth', 'fish'];
/** Themes folded into another at world level (they fail the retention test unless people restore them). */
const FOLDED_AT_WORLD: Partial<Record<ThemeId, string>> = { fish: 'folded into "A fair price for a harvest"' };

export const WORLD_EVERYWHERE = { minLayers: 5, minShare: 40 };
export const PLACE_EVERYWHERE = { minAreas: 3, minShare: 50 };

export function layersOf(view: View): LayerId[] {
  return view === 'world' ? LAYERS.map((l) => l.id) : [view];
}

export function conversations(view: View, door?: Door): Conversation[] {
  const ids = layersOf(view);
  return CONVERSATIONS.filter((c) => ids.includes(c.layer) && (!door || c.door === door));
}

export function countWhere(view: View, door: Door, pred: (c: Conversation) => boolean): Count {
  const pool = conversations(view, door);
  return { k: pool.filter(pred).length, n: pool.length };
}

export function layersWithTheme(theme: ThemeId): LayerId[] {
  return LAYERS.filter((l) => CONVERSATIONS.some((c) => c.layer === l.id && c.themes.includes(theme))).map((l) => l.id);
}

function restsOn(view: View): Door {
  return conversations(view, 'drawn').length > 0 ? 'drawn' : 'open';
}

export function finding(view: View, theme: ThemeId): Finding {
  const has = (c: Conversation) => c.themes.includes(theme);
  const people = { open: countWhere(view, 'open', has), drawn: countWhere(view, 'drawn', has) };
  let spread: Finding['spread'];
  if (view === 'world') {
    const names = layersWithTheme(theme);
    spread = { k: names.length, n: LAYERS.length, label: 'places and circles', names: names.map((id) => LAYER[id].shortName) };
  } else {
    const layer = LAYER[view];
    const areas = [...new Set(conversations(view).filter(has).map((c) => c.area))].sort();
    spread = {
      k: areas.length,
      n: layer.areas.length,
      label: layer.kind === 'circle' ? 'groups in the circle' : 'areas',
      names: areas.map((a) => layer.areas[a]),
    };
  }
  const ids = layersOf(view);
  return {
    id: `${view}-${theme}`,
    theme,
    title: THEMES[theme].title,
    people,
    spread,
    restsOn: restsOn(view),
    quotes: THEMES[theme].quotes.filter((qt) => ids.includes(qt.layer)),
  };
}

function split<K extends string>(
  view: View,
  id: Split['id'],
  question: string,
  statements: Record<string, string>,
  pick: (c: Conversation) => K,
): Split {
  const rows: SplitRow[] = Object.entries(statements).map(([key, statement]) => {
    const said = (door: Door): Count => {
      const pool = conversations(view, door).filter((c) => pick(c) !== 'unsaid');
      return { k: pool.filter((c) => pick(c) === key).length, n: pool.length };
    };
    const layers = layersOf(view)
      .filter((l) => CONVERSATIONS.some((c) => c.layer === l && pick(c) === key))
      .map((l) => LAYER[l].shortName);
    return { key, statement, people: { open: said('open'), drawn: said('drawn') }, layers };
  });
  return { id, question, rows: rows.filter((r) => r.people.open.k + r.people.drawn.k > 0) };
}

const AGE_LABEL: Record<AgeBand, string> = { '18–29': 'aged 18 to 29', '30–44': 'aged 30 to 44', '45–64': 'aged 45 to 64', '65+': 'over 65' };
export const ROUTE_LABEL: Record<Route, string> = {
  web: 'web',
  voice: 'voice notes',
  phone: 'phone call',
  listener: 'human listener',
};

function gapsFor(id: LayerId): string[] {
  const layer = LAYER[id];
  const out: string[] = [];
  for (const door of ['open', 'drawn'] as Door[]) {
    const pool = conversations(id, door);
    if (!pool.length) continue;
    for (const age of ['18–29', '65+'] as AgeBand[]) {
      const k = pool.filter((c) => c.age === age).length;
      if (k / pool.length < 0.1) out.push(`People ${AGE_LABEL[age]}: ${k} of ${pool.length} on the ${door === 'open' ? 'open door' : 'drawn sample'}`);
    }
  }
  if (layer.kind === 'place') {
    for (const route of ['voice', 'phone', 'listener'] as Route[]) {
      const k = conversations(id).filter((c) => c.route === route).length;
      if (k === 0) out.push(`Nobody yet by ${ROUTE_LABEL[route]}`);
    }
  }
  return out;
}

const WORLD_RETENTION_THRESHOLD = 6;

function worldRetention(): Picture['retention'] {
  const items: RetentionItem[] = DISTINCT.map((t) => {
    const from = layersWithTheme(t).map((l) => LAYER[l].shortName).join(', ');
    const folded = FOLDED_AT_WORLD[t];
    return { label: THEMES[t].title, from, survived: !folded, where: folded ?? 'kept whole in "Said here"' };
  });
  items.push({
    label: 'Work shared turn by turn (ayni)',
    from: LAYER.cusco.shortName,
    survived: true,
    where: 'kept as its own statement in "Said differently"',
  });
  const survive = items.filter((i) => i.survived).length;
  return {
    survive,
    of: items.length,
    threshold: WORLD_RETENTION_THRESHOLD,
    note: 'Distinct minority themes from the layers below that survive into the world picture, judged by people and not only a model.',
    items,
  };
}

export function buildPicture(view: View): Picture {
  const ids = layersOf(view);
  const totals = { open: conversations(view, 'open').length, drawn: conversations(view, 'drawn').length };

  const common = COMMON.filter((t) => layersWithTheme(t).some((l) => ids.includes(l))).map((t) => finding(view, t));
  const isEverywhere = (f: Finding) => {
    const share = pct(f.people[f.restsOn]);
    return view === 'world'
      ? f.spread.k >= WORLD_EVERYWHERE.minLayers && share >= WORLD_EVERYWHERE.minShare
      : f.spread.k >= PLACE_EVERYWHERE.minAreas && share >= PLACE_EVERYWHERE.minShare;
  };
  const everywhere = common.filter(isEverywhere);
  const alsoHeard = common.filter((f) => !isEverywhere(f));

  const differently = [
    split<WorkView>(view, 'work', 'What place work has in a good day', WORK_STATEMENTS, (c) => c.work),
    split<CareView>(view, 'care', 'Who cares for older people', CARE_STATEMENTS, (c) => c.care),
  ];

  const here = DISTINCT.filter((t) => layersWithTheme(t).some((l) => ids.includes(l)))
    .filter((t) => !(view === 'world' && FOLDED_AT_WORLD[t]))
    .map((t) => finding(view, t));

  const tensions = TENSIONS.filter((t) =>
    [t.a, t.b].some((th) => layersWithTheme(th).some((l) => ids.includes(l))),
  ).map((t) => ({ tension: t, a: finding(view, t.a), b: finding(view, t.b) }));

  const notHeard: Picture['notHeard'] =
    view === 'world'
      ? [
          {
            group: 'By place',
            items: [
              'Everywhere else. Five places and one circle are a demonstration, not the world.',
              ...LAYERS.flatMap((l) => l.missing.slice(0, 1).map((m) => `${l.shortName}: ${m}`)),
            ],
          },
          {
            group: 'By language',
            items: ['Dholuo, Ukrainian, Arabic and Urdu are not yet offered', 'Quechua runs only with a human listener; Bengali only with a person reviewing every summary'],
          },
          { group: 'By age', items: LAYERS.flatMap((l) => gapsFor(l.id).filter((g) => g.startsWith('People')).map((g) => `${l.shortName}: ${g}`)) },
          { group: 'By route', items: LAYERS.flatMap((l) => gapsFor(l.id).filter((g) => g.startsWith('Nobody')).map((g) => `${l.shortName}: ${g}`)).concat(['Radio call-in is not running anywhere in this demonstration']) },
        ]
      : [
          { group: 'Named by the people running it here', items: LAYER[view].missing },
          { group: 'From the counts', items: gapsFor(view).length ? gapsFor(view) : ['No gaps by age or route found by the simple checks used here'] },
        ];

  return {
    view,
    title: view === 'world' ? 'The world picture' : LAYER[view].name,
    everywhere,
    alsoHeard,
    differently,
    here,
    standing: ids.includes(STANDING_STATEMENT.layer),
    tensions,
    notHeard,
    retention: view === 'world' ? worldRetention() : LAYER[view].retention,
    totals,
  };
}

export function countsLine(f: Finding, door: Door): string {
  const c = f.people[door];
  if (c.n === 0) return 'Not drawn here';
  return `${pct(c)}% of people · ${f.spread.k} of ${f.spread.n} ${f.spread.label}`;
}
