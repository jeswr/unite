import { newId, type PictureUpdateResult, type Point, type Theme } from '@unite/shared';
import { checkSentences, describeTheme, groupPoints, themeKindOf } from '../../ai/synthesis.js';
import type { Deps } from '../../deps.js';
import { bumpVersion } from '../../version.js';

/**
 * Updating the picture (section 6.3): themes every approved point that is not in a theme yet,
 * takes withdrawn, scrapped or deleted points out of their themes, describes the themes that
 * changed, and deletes a theme left with no points only when nothing is attached to it (a report
 * or a statement). Any update clears the steward's confirmation.
 */

/** GET .../picture updates the picture by itself when at least this many approved points have no theme. */
export const LAZY_UPDATE_THRESHOLD = 5;

/** One update at a time per assembly: a second call while one runs gets the running one. */
const running = new Map<string, Promise<PictureUpdateResult>>();

export function updatePicture(deps: Deps, assemblyId: string): Promise<PictureUpdateResult> {
  const now = running.get(assemblyId);
  if (now) return now;
  const run = runUpdate(deps, assemblyId).finally(() => running.delete(assemblyId));
  running.set(assemblyId, run);
  return run;
}

export const isUpdating = (assemblyId: string) => running.has(assemblyId);

/** Resolves when the update running for this assembly (if any) has ended. For tests and scripts. */
export async function waitForUpdate(assemblyId: string): Promise<void> {
  await running.get(assemblyId)?.catch(() => undefined);
}

/** Approved points that can be themed and are in no theme. */
export function unthemedPoints(points: Point[], themes: Pick<Theme, 'pointIds'>[]): Point[] {
  const inTheme = new Set(themes.flatMap((t) => t.pointIds));
  return points.filter((p) => p.status === 'approved' && themeKindOf(p.type) !== undefined && !inTheme.has(p.id));
}

async function runUpdate(deps: Deps, assemblyId: string): Promise<PictureUpdateResult> {
  const { store, clock } = deps;
  const [points, themes, reports, statements] = await Promise.all([
    store.list('points', { assemblyId }),
    store.list('themes', { assemblyId }),
    store.list('reports', { assemblyId, targetType: 'theme' }),
    store.list('statements', { assemblyId }),
  ]);
  const byId = new Map(points.map((p) => [p.id, p]));
  const attached = new Set([...reports.map((r) => r.targetId), ...statements.flatMap((s) => s.themeIds)]);

  // 1. Keep only approved points in each theme (a point in two themes stays in the first).
  const placed = new Set<string>();
  const work = themes.map((theme) => {
    const keep = theme.pointIds.filter((id) => byId.get(id)?.status === 'approved' && !placed.has(id));
    keep.forEach((id) => placed.add(id));
    return { theme, keep, added: [] as string[], removed: theme.pointIds.filter((id) => !keep.includes(id)) };
  });

  // 2. Group the approved points that are in no theme.
  const unthemed = points.filter((p) => p.status === 'approved' && themeKindOf(p.type) !== undefined && !placed.has(p.id));
  const { groups, fallback: groupFallback } = await groupPoints(
    deps,
    work.map((w) => ({ id: w.theme.id, kind: w.theme.kind, name: w.theme.name, points: w.keep.map((id) => byId.get(id)!) })),
    unthemed,
  );
  const now = clock.iso();
  const created: Theme[] = [];
  for (const g of groups) {
    const w = g.themeId ? work.find((x) => x.theme.id === g.themeId) : undefined;
    if (w) w.added.push(...g.pointIds);
    else created.push({ id: newId('thm'), assemblyId, kind: g.kind, name: g.name, sentences: [], pointIds: g.pointIds, updatedAt: now });
  }

  // 3. Describe what changed. Without the AI a theme keeps those of its sentences that still hold.
  let fallback = groupFallback;
  const writes: Theme[] = [];
  const deletes: string[] = [];
  let keptEmpty = 0;
  for (const w of work) {
    const pointIds = [...w.keep, ...w.added];
    if (w.added.length === 0 && w.removed.length === 0) continue;
    if (pointIds.length === 0) {
      if (attached.has(w.theme.id)) {
        keptEmpty++;
        writes.push({ ...w.theme, pointIds, sentences: [], updatedAt: now });
      } else deletes.push(w.theme.id);
      continue;
    }
    const next = { ...w.theme, pointIds, updatedAt: now };
    const described = await describeTheme(deps, next, pointIds.map((id) => byId.get(id)!));
    if (described.fallback) fallback = true;
    next.sentences = described.fallback ? checkSentences(w.theme.sentences, pointIds) : described.sentences;
    writes.push(next);
  }
  for (const t of created) {
    const described = await describeTheme(deps, t, t.pointIds.map((id) => byId.get(id)!));
    if (described.fallback) fallback = true;
    t.sentences = described.sentences;
    writes.push(t);
  }

  // 4. Store it all at once, with each point's theme, and clear the confirmation.
  const removedIds = work.flatMap((w) => w.removed.map((id) => [id, w.theme.id] as const));
  await store.transaction(async (tx) => {
    for (const t of writes) await tx.put('themes', { ...t, sentences: checkSentences(t.sentences, t.pointIds) });
    for (const id of deletes) await tx.delete('themes', id);
    for (const t of writes)
      for (const id of t.pointIds) {
        const p = await tx.get('points', id);
        if (p && p.themeId !== t.id) await tx.put('points', { ...p, themeId: t.id });
      }
    for (const [id, themeId] of removedIds) {
      const p = await tx.get('points', id);
      if (p && p.themeId === themeId && !writes.some((t) => t.pointIds.includes(id))) {
        const { themeId: _old, ...rest } = p;
        void _old;
        await tx.put('points', rest);
      }
    }
    const a = await tx.get('assemblies', assemblyId);
    if (a) {
      const { pictureConfirmedAt: _at, pictureConfirmedBy: _by, ...rest } = a;
      void _at;
      void _by;
      await tx.put('assemblies', { ...rest, updatedAt: now });
    }
  });
  await bumpVersion(deps, assemblyId);
  return {
    themed: unthemed.filter((p) => groups.some((g) => g.pointIds.includes(p.id))).length,
    created: created.length,
    removed: removedIds.length,
    deleted: deletes.length,
    keptEmpty,
    fallback,
  };
}
