import { countPeople, type Assembly, type Person, type Point, type Report, type Role, type Theme } from '@unite/shared';
import type { Deps } from '../../deps.js';
import type { Store } from '../../store/types.js';
import { heardPersonIds } from '../assemblies.js';
import type { MissingGroup, Quote, ReportView, SentenceView, ThemeSection, ThemeView } from '@unite/shared';

/**
 * Builds what the picture shows from stored records. Every count is of people and is computed
 * here (rule 4). Only points shown anonymously or with a name are quoted; `count` points are
 * counted and never quoted. No person id leaves this file.
 */

export const SECTION_ORDER: { kind: Theme['kind']; title: string }[] = [
  { kind: 'matters', title: 'What matters' },
  { kind: 'barrier', title: 'What gets in the way' },
  { kind: 'day', title: 'Good ordinary days' },
  { kind: 'idea', title: 'Ideas' },
];

export const MAX_THEME_QUOTES = 3;

export interface Viewer {
  personId?: string;
  role: Role;
}

/** Time order: when a point was approved, then its place in the store. */
const byTime = (points: Point[]) =>
  points
    .map((p, i) => ({ p, i }))
    .sort((x, y) => (x.p.approvedAt ?? '').localeCompare(y.p.approvedAt ?? '') || x.i - y.i)
    .map((x) => x.p);

export const quotable = (p: Point) => p.status === 'approved' && (p.visibility === 'anonymous' || p.visibility === 'named');

/** Display names for the people behind `named` points. */
export async function namesFor(store: Store, points: Point[]): Promise<Map<string, string>> {
  const ids = [...new Set(points.filter((p) => p.visibility === 'named').map((p) => p.personId))];
  const people = await Promise.all(ids.map((id) => store.get('persons', id)));
  return new Map(people.filter((p): p is Person => !!p?.displayName).map((p) => [p.id, p.displayName!]));
}

export function quoteOf(p: Point, names: Map<string, string>, viewer: Viewer, opts: { withNames?: boolean } = {}): Quote {
  const name = opts.withNames !== false && p.visibility === 'named' ? names.get(p.personId) : undefined;
  return {
    id: p.id,
    text: p.text,
    ...(p.textEn ? { textEn: p.textEn } : {}),
    ...(name ? { name } : {}),
    ...(viewer.personId && p.personId === viewer.personId ? { mine: true } : {}),
  };
}

/** Quotes from these points, in time order: only `anonymous` and `named` points. */
export function quotesOf(points: Point[], names: Map<string, string>, viewer: Viewer, limit?: number, opts?: { withNames?: boolean }): Quote[] {
  const q = byTime(points.filter(quotable)).map((p) => quoteOf(p, names, viewer, opts));
  return limit === undefined ? q : q.slice(0, limit);
}

export function reportView(r: Report, viewer: Viewer): ReportView {
  return {
    id: r.id,
    kind: r.kind,
    text: r.text,
    status: r.status,
    ...(r.outcomeNote ? { outcomeNote: r.outcomeNote } : {}),
    createdAt: r.createdAt,
    ...(r.resolvedAt ? { resolvedAt: r.resolvedAt } : {}),
    mine: !!viewer.personId && r.personId === viewer.personId,
  };
}

export interface PictureData {
  points: Point[];
  themes: Theme[];
  reports: Report[];
  names: Map<string, string>;
}

export async function loadPictureData(store: Store, assemblyId: string): Promise<PictureData> {
  const [points, themes, reports] = await Promise.all([
    store.list('points', { assemblyId, status: 'approved' }),
    store.list('themes', { assemblyId }),
    store.list('reports', { assemblyId }),
  ]);
  return { points, themes, reports, names: await namesFor(store, points) };
}

/** One theme as the picture shows it. `full` false gives the name and count only. */
export function themeView(theme: Theme, data: PictureData, viewer: Viewer, full = true): ThemeView {
  const byId = new Map(data.points.map((p) => [p.id, p]));
  const pts = theme.pointIds.map((id) => byId.get(id)).filter((p): p is Point => !!p);
  const sentences: SentenceView[] = full
    ? theme.sentences.flatMap((s) => {
        const src = s.pointIds.map((id) => byId.get(id)).filter((p): p is Point => !!p);
        // Rule 3: a sentence whose sources are gone is not shown.
        if (src.length === 0 || src.length < s.pointIds.length) return [];
        return [{ text: s.text, people: countPeople(src), quotes: quotesOf(src, data.names, viewer) }];
      })
    : [];
  return {
    id: theme.id,
    kind: theme.kind,
    name: theme.name,
    people: countPeople(pts),
    sentences,
    quotes: full ? quotesOf(pts, data.names, viewer, MAX_THEME_QUOTES) : [],
    reports: !full ? [] : data.reports.filter((r) => r.targetType === 'theme' && r.targetId === theme.id).map((r) => reportView(r, viewer)),
    mine: full && viewer.personId ? pts.filter((p) => p.personId === viewer.personId).map((p) => ({ id: p.id, text: p.text })) : [],
  };
}

/** Themes in the fixed order of kinds; within a kind, in the order they were made (rule 8). */
export function sections(data: PictureData, viewer: Viewer, full = true): ThemeSection[] {
  return SECTION_ORDER.map(({ kind, title }) => ({
    kind,
    title,
    themes: data.themes.filter((t) => t.kind === kind).map((t) => themeView(t, data, viewer, full)),
  }));
}

/** Trade-offs and doubts are not themed: they appear as quotes only. */
export function hardChoices(data: PictureData, viewer: Viewer): { people: number; quotes: Quote[] } {
  const pts = data.points.filter((p) => p.type === 'tradeoff' || p.type === 'doubt');
  return { people: countPeople(pts), quotes: quotesOf(pts, data.names, viewer) };
}

/**
 * Who we have not heard from: for each affected group, the people with a completed conversation
 * whose answers about themselves put them in it, against the group's target. Under-heard below half.
 */
export async function whoIsMissing(deps: Pick<Deps, 'store'>, assembly: Assembly): Promise<MissingGroup[]> {
  if (!assembly.affectedGroups.length) return [];
  const heard = await heardPersonIds(deps.store, assembly.id);
  const people = (await Promise.all(heard.map((id) => deps.store.get('persons', id)))).filter((p): p is Person => !!p);
  return assembly.affectedGroups.map((g) => {
    const n = people.filter((p) => p.about[g.aboutKey] === g.aboutValue).length;
    return { key: g.key, label: g.label, heard: n, target: g.target, underHeard: n < g.target / 2 };
  });
}
