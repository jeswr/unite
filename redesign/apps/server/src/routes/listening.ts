import { Router } from 'express';
import { countPeople } from '@unite/shared';
import { isHeard } from '../auth.js';
import type { Deps } from '../deps.js';
import type { ListeningResponse } from '../services/picture/types.js';
import { loadPictureData, quotesOf, sections } from '../services/picture/view.js';

/** Good ordinary days show at most this many quotes per theme. */
export const DAY_QUOTES = 6;

/**
 * Open listening (section 7): GET /api/listening. Theme names and people counts are open to
 * everyone; sentences, quotes and good ordinary days only to someone heard there (or who chose to
 * look around the example first), by rule 1. "Themes with no host yet" are the open-listening
 * themes that no assembly's `fromThemeId` points to.
 */
export function listeningRouter(deps: Deps): Router {
  const r = Router();
  const { store } = deps;

  r.get('/listening', async (req, res) => {
    const [assembly] = await store.list('assemblies', { isOpenListening: true }, { limit: 1 });
    if (!assembly) {
      const empty: ListeningResponse = { assembly: null, heard: false, totals: { people: 0, points: 0 }, sections: [], noHost: [], days: [] };
      return void res.json(empty);
    }
    const heard = await isHeard(deps, assembly, req.personId, req.role);
    const viewer = { personId: req.personId, role: req.role };
    const [data, all] = await Promise.all([loadPictureData(store, assembly.id), store.list('assemblies')]);
    const hosts = new Map<string, { slug: string; title: string }[]>();
    for (const a of all)
      if (a.fromThemeId && a.id !== assembly.id) hosts.set(a.fromThemeId, [...(hosts.get(a.fromThemeId) ?? []), { slug: a.slug, title: a.title }]);

    const secs = sections(data, viewer, heard).map((s) => ({
      ...s,
      themes: s.themes.map((t) => (hosts.has(t.id) ? { ...t, hostedBy: hosts.get(t.id)! } : t)),
    }));
    const byId = new Map(data.points.map((p) => [p.id, p]));
    const body: ListeningResponse = {
      assembly: { slug: assembly.slug, title: assembly.title, question: assembly.question, isExample: assembly.isExample },
      heard,
      totals: { people: countPeople(data.points), points: data.points.length },
      sections: secs,
      noHost: data.themes
        .filter((t) => !hosts.has(t.id))
        .map((t) => ({ id: t.id, kind: t.kind, name: t.name, people: countPeople(t.pointIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []))) })),
      // Good ordinary days: moments grouped by what matters in them, no names, no ranking (alphabetical).
      days: heard
        ? data.themes
            .filter((t) => t.kind === 'day')
            .map((t) => {
              const pts = t.pointIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
              return { id: t.id, name: t.name, people: countPeople(pts), quotes: quotesOf(pts, data.names, viewer, DAY_QUOTES, { withNames: false }) };
            })
            .filter((d) => d.quotes.length > 0)
            .sort((a, b) => a.name.localeCompare(b.name))
        : [],
    };
    res.json(body);
  });

  return r;
}
