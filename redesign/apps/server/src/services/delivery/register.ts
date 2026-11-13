import { type Assembly, DecisionStatus, type HostRecordResponse, type RegisterEntry, type RegisterResponse, registerSummary } from '@unite/shared';
import type { Deps } from '../../deps.js';
import { HttpError, notFound } from '../../errors.js';
import { cardOf } from './decisions.js';
import { onOrBefore } from './dates.js';

/**
 * The public register (section 7, Register): every decision in every assembly, ordered by
 * assembly (alphabetically by title) and then by decision number. Never by attention (rule 8).
 */

export interface RegisterQuery {
  assembly?: string;
  host?: string;
  status?: string;
}

const byTitle = (a: Pick<Assembly, 'title'>, b: Pick<Assembly, 'title'>) => a.title.localeCompare(b.title, 'en-GB');

export async function register(deps: Pick<Deps, 'store' | 'clock'>, q: RegisterQuery): Promise<RegisterResponse> {
  const { store, clock } = deps;
  if (q.status && !DecisionStatus.safeParse(q.status).success)
    throw new HttpError(400, 'invalid', 'That status is not one the register knows.');
  const assemblies = (await store.list('assemblies')).filter((a) => !a.isOpenListening).sort(byTitle);
  const decisions = await store.list('decisions');
  const now = clock.now();

  const all: RegisterEntry[] = [];
  for (const a of assemblies) {
    const mine = decisions.filter((d) => d.assemblyId === a.id).sort((x, y) => x.number - y.number);
    for (const d of mine)
      all.push({
        ...cardOf(d, now),
        assembly: { slug: a.slug, title: a.title, isExample: a.isExample },
        host: { name: a.hostName, slug: a.hostSlug },
      });
  }
  const entries = all.filter(
    (e) => (!q.assembly || e.assembly.slug === q.assembly) && (!q.host || e.host.slug === q.host) && (!q.status || e.status === q.status),
  );
  const hosts = new Map<string, string>();
  for (const a of assemblies) if (a.hostSlug) hosts.set(a.hostSlug, a.hostName);
  return {
    entries,
    summary: registerSummary(entries),
    filters: {
      assemblies: assemblies.map((a) => ({ slug: a.slug, title: a.title })),
      hosts: [...hosts].map(([slug, name]) => ({ slug, name })).sort((x, y) => x.name.localeCompare(y.name, 'en-GB')),
      statuses: [...DecisionStatus.options],
    },
  };
}

export async function hostRecord(deps: Pick<Deps, 'store' | 'clock'>, hostSlug: string): Promise<HostRecordResponse> {
  const { store } = deps;
  const assemblies = (await store.list('assemblies', { hostSlug })).filter((a) => !a.isOpenListening).sort(byTitle);
  if (!hostSlug || assemblies.length === 0) throw notFound('That host');
  const ids = new Set(assemblies.map((a) => a.id));
  const decisions = (await store.list('decisions')).filter((d) => ids.has(d.assemblyId));
  const { entries } = await register(deps, { host: hostSlug });
  const s = registerSummary(decisions);
  const answered = decisions.filter((d) => d.answer);
  const kind = (k: string) => answered.filter((d) => d.answer!.kind === k).length;
  const first = assemblies[0]!;
  return {
    host: { name: first.hostName, slug: hostSlug, description: first.hostDescription },
    assemblies: assemblies.map((a) => ({
      slug: a.slug,
      title: a.title,
      stage: a.stage,
      isExample: a.isExample,
      decisions: decisions.filter((d) => d.assemblyId === a.id).length,
    })),
    record: {
      decisions: decisions.length,
      answeredOnTime: answered.filter((d) => onOrBefore(d.answer!.answeredAt, d.dueDate)).length,
      answeredLate: answered.filter((d) => !onOrBefore(d.answer!.answeredAt, d.dueDate)).length,
      awaitingAnswer: s.awaitingAnswer,
      awaitingLate: entries.filter((e) => e.daysLate > 0).length,
      accepted: kind('accepted'),
      changed: kind('changed'),
      delayed: kind('delayed'),
      refused: kind('refused'),
      inProgress: s.inProgress,
      deliveredAsDecided: s.deliveredAsDecided,
      deliveredWithChanges: s.byStatus.delivered_minor_changes + s.byStatus.delivered_substantial_changes,
      notDelivered: s.notDelivered,
      replaced: s.byStatus.replaced,
    },
    entries,
  };
}
