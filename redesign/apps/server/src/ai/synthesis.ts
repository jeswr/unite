import { z } from 'zod';
import { contentWords, wordOverlap, type Point, type PointType, type Statement, type Theme } from '@unite/shared';
import type { Deps } from '../deps.js';
import { checkLeadingFallback } from '../services/host/checkLeading.js';
import {
  CHECK_LEADING_SYSTEM,
  DESCRIBE_THEME_SYSTEM,
  DRAFT_STATEMENTS_SYSTEM,
  GROUP_POINTS_SYSTEM,
  REVISE_STATEMENT_SYSTEM,
} from './prompts.js';

/**
 * Synthesis (section 6.3). Every call goes through `deps.ai.withAi` with a prompt from prompts.ts
 * and a zod schema for the model's output, and every output is checked in code before it is used:
 * a sentence or statement whose sources are not real points is dropped (rule 3). The user message
 * of each call carries only data (JSON); every instruction is in the published prompt.
 */

type AiDeps = Pick<Deps, 'ai'>;
export type ThemeKind = Theme['kind'];

/** The theme kind each point type goes into. `tradeoff` and `doubt` are not themed. */
export const THEME_KIND_OF: Partial<Record<PointType, ThemeKind>> = {
  matters: 'matters',
  barrier: 'barrier',
  idea: 'idea',
  moment: 'day',
  wish: 'day',
};

export const themeKindOf = (type: PointType): ThemeKind | undefined => THEME_KIND_OF[type];

/** At most this many points go to the model in one grouping call. */
export const GROUP_BATCH = 100;
/** The fallback puts two points together when this share of one's content words is in the other. */
export const FALLBACK_OVERLAP = 0.34;
/** A theme name must be taken from its points: at least this share of its words must be in them. */
export const NAME_OVERLAP = 0.6;
export const MAX_SENTENCES = 3;
export const MAX_STATEMENTS = 12;
export const MAX_STATEMENT_WORDS = 30;

/** The text used for grouping and describing: the English rendering when there is one. */
export const pointText = (p: Pick<Point, 'text' | 'textEn'>) => p.textEn ?? p.text;
const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const userData = (data: unknown) => [{ role: 'user' as const, content: JSON.stringify(data, null, 1) }];

/* ------------------------------------------------------------------ groupPoints */

export type GroupPoint = Pick<Point, 'id' | 'type' | 'text' | 'textEn'>;

/** A theme the grouping can add to: its id, name and the points already in it. */
export interface ExistingGroup {
  id: string;
  kind: ThemeKind;
  name: string;
  points: GroupPoint[];
}

/** One result group: an existing theme (`themeId`) gaining points, or a new theme (`themeId` null). */
export interface PointGroup {
  themeId: string | null;
  kind: ThemeKind;
  name: string;
  pointIds: string[];
}

export const GroupOutputSchema = z.object({
  groups: z.array(
    z.object({
      themeId: z.string().nullable(),
      name: z.string(),
      pointIds: z.array(z.string()),
    }),
  ),
});

/** The shortest point's text: the fallback name of a new theme. */
const shortest = (ps: GroupPoint[]) => [...ps].sort((a, b) => pointText(a).length - pointText(b).length)[0]!;

/** Whether two texts share enough content words to be put together by the fallback. */
const close = (a: string, b: string) => wordOverlap(a, b) >= FALLBACK_OVERLAP || wordOverlap(b, a) >= FALLBACK_OVERLAP;

/**
 * Fallback grouping: greedy, within one kind. Each point joins the first group (existing or new, in
 * order) holding a point it overlaps with by at least 0.34; otherwise it starts a new group named
 * after its shortest point.
 */
export function greedyGroups(kind: ThemeKind, existing: ExistingGroup[], points: GroupPoint[]): PointGroup[] {
  const groups: { themeId: string | null; name: string; members: GroupPoint[]; added: GroupPoint[] }[] = existing.map((e) => ({
    themeId: e.id,
    name: e.name,
    members: [...e.points],
    added: [],
  }));
  for (const p of points) {
    const t = pointText(p);
    const g = groups.find((x) => x.members.some((m) => close(t, pointText(m))));
    if (g) {
      g.members.push(p);
      g.added.push(p);
    } else groups.push({ themeId: null, name: '', members: [p], added: [p] });
  }
  return groups
    .filter((g) => g.added.length > 0)
    .map((g) => ({ themeId: g.themeId, kind, name: g.themeId ? g.name : pointText(shortest(g.members)), pointIds: g.added.map((p) => p.id) }));
}

/**
 * Checks the model's grouping of one batch: unknown point ids and repeats are dropped, an unknown
 * theme id makes a new theme, a new theme's name must come from its points (otherwise its shortest
 * point names it), and points the model left out are grouped by the fallback.
 */
export function checkGroups(kind: ThemeKind, existing: ExistingGroup[], points: GroupPoint[], output: z.infer<typeof GroupOutputSchema>): PointGroup[] {
  const byId = new Map(points.map((p) => [p.id, p]));
  const existingIds = new Set(existing.map((e) => e.id));
  const placed = new Set<string>();
  const out: PointGroup[] = [];
  for (const g of output.groups) {
    const ids = g.pointIds.filter((id) => byId.has(id) && !placed.has(id));
    if (ids.length === 0) continue;
    ids.forEach((id) => placed.add(id));
    const members = ids.map((id) => byId.get(id)!);
    if (g.themeId && existingIds.has(g.themeId)) {
      const prev = out.find((o) => o.themeId === g.themeId);
      if (prev) prev.pointIds.push(...ids);
      else out.push({ themeId: g.themeId, kind, name: existing.find((e) => e.id === g.themeId)!.name, pointIds: ids });
      continue;
    }
    const name = g.name.trim();
    const fromPoints = name && contentWords(name).length > 0 && wordOverlap(name, members.map(pointText)) >= NAME_OVERLAP;
    out.push({ themeId: null, kind, name: fromPoints ? name : pointText(shortest(members)), pointIds: ids });
  }
  const left = points.filter((p) => !placed.has(p.id));
  if (left.length) {
    // Points the model left out: grouped by the fallback, against the existing themes and the new groups.
    const pool: ExistingGroup[] = [
      ...existing,
      ...out.flatMap((g, i) => (g.themeId ? [] : [{ id: `new:${i}`, kind, name: g.name, points: g.pointIds.map((id) => byId.get(id)!) }])),
    ];
    for (const e of greedyGroups(kind, pool, left)) {
      const target = e.themeId?.startsWith('new:') ? out[Number(e.themeId.slice(4))] : e.themeId ? out.find((o) => o.themeId === e.themeId) : undefined;
      if (target) target.pointIds.push(...e.pointIds);
      else out.push(e);
    }
  }
  return out;
}

/**
 * Assigns each point to a theme of its kind (`matters`, `barrier`, `idea`, and `day` for `moment`
 * and `wish`), adding to existing themes or making new ones, in batches of at most 100 points.
 * Points of other types are ignored. Themes made in one batch are offered to the next.
 */
export async function groupPoints(deps: AiDeps, existing: ExistingGroup[], points: GroupPoint[]): Promise<{ groups: PointGroup[]; fallback: boolean }> {
  const result: PointGroup[] = [];
  let fallback = false;
  const kinds: ThemeKind[] = ['matters', 'barrier', 'day', 'idea'];
  for (const kind of kinds) {
    const ofKind = points.filter((p) => themeKindOf(p.type) === kind);
    // Themes known so far for this kind: the stored ones and those made by earlier batches.
    const known: ExistingGroup[] = existing.filter((e) => e.kind === kind).map((e) => ({ ...e, points: [...e.points] }));
    const kindGroups: PointGroup[] = [];
    let newCount = 0;
    for (let i = 0; i < ofKind.length; i += GROUP_BATCH) {
      const batch = ofKind.slice(i, i + GROUP_BATCH);
      const outcome = await deps.ai.withAi(
        'groupPoints',
        async (ai) => {
          const output = await ai.parse({
            schema: GroupOutputSchema,
            system: GROUP_POINTS_SYSTEM,
            effort: 'medium',
            messages: userData({
              kind,
              existingThemes: known.map((k) => ({ id: k.id, name: k.name, examplePoints: k.points.slice(0, 5).map(pointText) })),
              newPoints: batch.map((p) => ({ id: p.id, text: pointText(p) })),
            }),
          });
          return checkGroups(kind, known, batch, output);
        },
        () => greedyGroups(kind, known, batch),
      );
      if (outcome.source === 'fallback') fallback = true;
      for (const g of outcome.value) {
        const members = g.pointIds.map((id) => batch.find((p) => p.id === id)!);
        if (g.themeId) {
          const k = known.find((x) => x.id === g.themeId)!;
          k.points.push(...members);
          const prev = kindGroups.find((x) => x.themeId === g.themeId);
          if (prev) prev.pointIds.push(...g.pointIds);
          else kindGroups.push({ ...g });
        } else {
          // A new theme: later batches see it under a temporary id and can add to it.
          const tempId = `new:${kind}:${newCount++}`;
          known.push({ id: tempId, kind, name: g.name, points: members });
          kindGroups.push({ ...g, themeId: tempId });
        }
      }
    }
    for (const g of kindGroups) result.push(g.themeId?.startsWith('new:') ? { ...g, themeId: null } : g);
  }
  return { groups: result, fallback };
}

/* ------------------------------------------------------------------ describeTheme */

export interface Sentence {
  text: string;
  pointIds: string[];
}

export const DescribeOutputSchema = z.object({
  sentences: z.array(z.object({ text: z.string(), pointIds: z.array(z.string()) })),
});

/**
 * Rule 3: keeps only sentences that have text and at least one source, every one of which is a
 * point in the theme. At most three.
 */
export function checkSentences(sentences: Sentence[], themePointIds: Iterable<string>): Sentence[] {
  const allowed = new Set(themePointIds);
  return sentences
    .map((s) => ({ text: s.text.trim(), pointIds: [...new Set(s.pointIds)] }))
    .filter((s) => s.text.length > 0 && s.pointIds.length > 0 && s.pointIds.every((id) => allowed.has(id)))
    .slice(0, MAX_SENTENCES);
}

/** 1 to 3 sentences describing a theme, each with its source points. Fallback: none (quotes only). */
export async function describeTheme(
  deps: AiDeps,
  theme: Pick<Theme, 'name' | 'kind' | 'pointIds'>,
  points: GroupPoint[],
): Promise<{ sentences: Sentence[]; fallback: boolean }> {
  const inTheme = points.filter((p) => theme.pointIds.includes(p.id));
  if (inTheme.length === 0) return { sentences: [], fallback: false };
  const outcome = await deps.ai.withAi(
    'describeTheme',
    async (ai) => {
      const out = await ai.parse({
        schema: DescribeOutputSchema,
        system: DESCRIBE_THEME_SYSTEM,
        effort: 'medium',
        messages: userData({ theme: theme.name, kind: theme.kind, points: inTheme.map((p) => ({ id: p.id, text: pointText(p) })) }),
      });
      return checkSentences(out.sentences, theme.pointIds);
    },
    () => [] as Sentence[],
  );
  return { sentences: outcome.value, fallback: outcome.source === 'fallback' };
}

/* ------------------------------------------------------------------ draftStatements */

export interface DraftInput {
  question: string;
  offTable?: string;
  themes: { id: string; kind: ThemeKind; name: string; people: number; pointIds: string[] }[];
  points: GroupPoint[];
}

export interface DraftStatement {
  text: string;
  pointIds: string[];
}

export const DraftOutputSchema = z.object({
  statements: z.array(z.object({ text: z.string(), pointIds: z.array(z.string()) })),
});

/** Rule 3 and the size rules: text, at most 30 words, at least one source that is a real point. At most 12. */
export function checkDrafts(drafts: DraftStatement[], pointIds: Iterable<string>): DraftStatement[] {
  const allowed = new Set(pointIds);
  return drafts
    .map((d) => ({ text: d.text.trim(), pointIds: [...new Set(d.pointIds)].filter((id) => allowed.has(id)) }))
    .filter((d) => d.text.length > 0 && wordCount(d.text) <= MAX_STATEMENT_WORDS && d.pointIds.length > 0)
    .slice(0, MAX_STATEMENTS);
}

/** Up to 12 candidate statements, each resting on points. Fallback: none; a steward writes them. */
export async function draftStatements(deps: AiDeps, input: DraftInput): Promise<{ statements: DraftStatement[]; fallback: boolean }> {
  if (input.points.length === 0) return { statements: [], fallback: false };
  const outcome = await deps.ai.withAi(
    'draftStatements',
    async (ai) => {
      const out = await ai.parse({
        schema: DraftOutputSchema,
        system: DRAFT_STATEMENTS_SYSTEM,
        effort: 'medium',
        messages: userData({
          question: input.question,
          offTable: input.offTable ?? '',
          themes: input.themes.map((t) => ({
            kind: t.kind,
            name: t.name,
            people: t.people,
            points: t.pointIds.flatMap((id) => {
              const p = input.points.find((x) => x.id === id);
              return p ? [{ id: p.id, text: pointText(p) }] : [];
            }),
          })),
        }),
      });
      return checkDrafts(out.statements, input.points.map((p) => p.id));
    },
    () => [] as DraftStatement[],
  );
  return { statements: outcome.value, fallback: outcome.source === 'fallback' };
}

/* ------------------------------------------------------------------ reviseStatement */

export const ReviseOutputSchema = z.object({ text: z.string(), note: z.string() });

export interface Revision {
  text: string;
  note: string;
  changed: boolean;
  fallback: boolean;
}

/**
 * One revised wording of a statement, from the rewordings and reasons people gave. The sources stay
 * the same (the caller copies them). Fallback, or an answer over 30 words: the original, unchanged.
 */
export async function reviseStatement(
  deps: AiDeps,
  statement: Pick<Statement, 'text'>,
  rewordings: string[],
  reasons: { side: 'for' | 'against' | 'question'; text: string }[],
): Promise<Revision> {
  const unchanged = (note: string) => ({ text: statement.text, note });
  const outcome = await deps.ai.withAi(
    'reviseStatement',
    async (ai) => {
      const out = await ai.parse({
        schema: ReviseOutputSchema,
        system: REVISE_STATEMENT_SYSTEM,
        effort: 'medium',
        messages: userData({ statement: statement.text, rewordings, reasons }),
      });
      const text = out.text.trim();
      if (!text || wordCount(text) > MAX_STATEMENT_WORDS) return unchanged('The suggested wording was too long, so the statement is unchanged.');
      return { text, note: out.note.trim() };
    },
    () => unchanged('The AI is not switched on, so no revised wording was drafted. A steward can write one by hand.'),
  );
  const v = outcome.value;
  return { ...v, changed: v.text.trim() !== statement.text.trim(), fallback: outcome.source === 'fallback' };
}

/* ------------------------------------------------------------------ checkLeading */

export const LeadingOutputSchema = z.object({ leading: z.boolean(), why: z.string(), suggestion: z.string() });
export type LeadingCheck = z.infer<typeof LeadingOutputSchema>;

/** Whether a host's question or probe leads people toward an answer. Fallback: a phrase list. */
export async function checkLeading(deps: AiDeps, text: string): Promise<LeadingCheck & { fallback: boolean }> {
  const outcome = await deps.ai.withAi(
    'checkLeading',
    (ai) => ai.parse({ schema: LeadingOutputSchema, system: CHECK_LEADING_SYSTEM, messages: userData({ wording: text }) }),
    () => checkLeadingFallback(text),
  );
  return { ...outcome.value, fallback: outcome.source === 'fallback' };
}
