import type { Assembly, AssemblyCounts, StageFacts } from '@unite/shared';
import type { Deps } from '../deps.js';
import { notFound } from '../errors.js';
import type { Store } from '../store/types.js';

/** The assembly with this slug, or a 404. */
export async function getAssemblyBySlug(store: Store, slug: string): Promise<Assembly> {
  const [a] = await store.list('assemblies', { slug }, { limit: 1 });
  if (!a) throw notFound('That assembly');
  return a;
}

/** Distinct people with a completed conversation in the assembly. */
export async function heardPersonIds(store: Store, assemblyId: string): Promise<string[]> {
  const done = await store.list('conversations', { assemblyId, status: 'complete' });
  return [...new Set(done.map((c) => c.personId))];
}

export async function assemblyCounts(store: Store, assembly: Assembly): Promise<AssemblyCounts> {
  const [heard, members, statements, decisions] = await Promise.all([
    heardPersonIds(store, assembly.id),
    store.list('memberships', { assemblyId: assembly.id }),
    store.count('statements', { assemblyId: assembly.id }),
    store.count('decisions', { assemblyId: assembly.id }),
  ]);
  return {
    heard: heard.length,
    members: new Set(members.map((m) => m.personId)).size,
    invited: new Set(members.filter((m) => m.invited && m.role === 'participant').map((m) => m.personId)).size,
    statements,
    decisions,
  };
}

/** Counts every fact `stageChecklist()` needs from stored records. */
export async function gatherStageFacts(deps: Pick<Deps, 'store'>, assembly: Assembly): Promise<StageFacts> {
  const { store } = deps;
  const assemblyId = assembly.id;
  const [heard, reports, statements, rooms, objections, memberships, choices, decisions, proposals, items, checks] = await Promise.all([
    heardPersonIds(store, assemblyId),
    store.count('reports', { assemblyId, status: 'open' }),
    store.count('statements', { assemblyId, status: 'common_ground' }),
    store.list('rooms', { assemblyId }),
    store.count('objections', { assemblyId, status: 'open' }),
    store.list('memberships', { assemblyId, role: 'participant', invited: true }),
    store.list('priorityChoices', { assemblyId }),
    store.list('decisions', { assemblyId }),
    store.list('buildProposals', { assemblyId, status: 'chosen' }),
    store.list('deliveryItems', { assemblyId }),
    store.list('checks', { assemblyId }),
  ]);

  const heardByGroup: Record<string, number> = {};
  if (assembly.affectedGroups.length) {
    const people = await Promise.all(heard.map((id) => store.get('persons', id)));
    for (const g of assembly.affectedGroups)
      heardByGroup[g.key] = people.filter((p) => p && p.about[g.aboutKey] === g.aboutValue).length;
  }
  const accepted = decisions.filter((d) => d.answer && (d.answer.kind === 'accepted' || d.answer.kind === 'changed'));
  const chosen = new Set(proposals.map((p) => p.decisionId));
  const withItems = new Set(items.map((i) => i.decisionId));
  const checked = new Set(checks.map((c) => c.decisionId));

  return {
    completedConversations: heard.length,
    heardByGroup,
    openReports: reports,
    commonGroundStatements: statements,
    openRooms: rooms.filter((r) => r.status !== 'closed').length,
    openObjections: objections,
    invitedParticipants: new Set(memberships.map((m) => m.personId)).size,
    priorityChoosers: new Set(choices.filter((c) => c.statementIds.length > 0).map((c) => c.personId)).size,
    decisions: decisions.length,
    decisionsAwaitingAnswer: decisions.filter((d) => !d.answer).length,
    acceptedWithoutPlan: accepted.filter((d) => !chosen.has(d.id) || !withItems.has(d.id)).length,
    acceptedWithoutCheck: accepted.filter((d) => !checked.has(d.id)).length,
  };
}
