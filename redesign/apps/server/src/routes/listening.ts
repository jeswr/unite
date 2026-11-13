import { Router } from 'express';
import { countPeople, type ListeningReach, type Person } from '@unite/shared';
import { isHeard } from '../auth.js';
import type { Deps } from '../deps.js';
import type { ListeningResponse } from '@unite/shared';
import type { Store } from '../store/types.js';
import { loadPictureData, quotesOf, sections } from '../services/picture/view.js';

/** Good ordinary days show at most this many quotes per theme. */
export const DAY_QUOTES = 6;

/**
 * How many countries and languages the people who have spoken come from, counted from each
 * person's locale: the language subtag ("es" in "es-MX") and the region subtag ("MX").
 * A locale with no region counts toward languages only.
 */
export function reachOf(locales: string[]): ListeningReach {
  const countries = new Set<string>();
  const languages = new Set<string>();
  for (const raw of locales) {
    const parts = raw.trim().split(/[-_]/);
    const lang = parts[0]?.toLowerCase();
    if (lang) languages.add(lang);
    const region = parts.slice(1).find((x) => /^([A-Za-z]{2}|\d{3})$/.test(x));
    if (region) countries.add(region.toUpperCase());
  }
  return { people: locales.length, countries: countries.size, languages: languages.size };
}

async function reachOfPeople(store: Store, personIds: string[]): Promise<ListeningReach> {
  const people = await Promise.all([...new Set(personIds)].map((id) => store.get('persons', id)));
  return reachOf(people.filter((p): p is Person => !!p).map((p) => p.locale));
}

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
      const empty: ListeningResponse = { assembly: null, heard: false, totals: { people: 0, points: 0 }, reach: { people: 0, countries: 0, languages: 0 }, sections: [], noHost: [], days: [] };
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
      reach: await reachOfPeople(store, data.points.map((p) => p.personId)),
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
