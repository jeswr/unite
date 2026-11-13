import { countPeople, opinionGroups, statementSupport, type Assembly, type Check, type Decision, type Pledge, type RegisterSummary, type Role } from '@unite/shared';
import { isHeard } from '../../auth.js';
import type { Deps } from '../../deps.js';
import { getAssemblyBySlug } from '../assemblies.js';
import { checkBodyName } from './decisions.js';
import { register, type RegisterEntry } from './register.js';

/**
 * GET /api/assemblies/:slug/export: an assembly's public record in an open format. The pledge,
 * the picture (theme names, people counts, sentences), statements with support totals, decisions
 * with their tests, the host's answers, checks and register entries.
 *
 * Never included: transcripts, person ids, or anyone's name unless they chose to have a point
 * shown with their name. Check panels are given as a number of people, not names. The picture and
 * statements follow rule 1: they are left out for someone who has not been heard in the assembly.
 */

export const EXPORT_FORMAT = 'unite-assembly-export/1';

export interface AssemblyExport {
  format: string;
  exportedAt: string;
  assembly: Pick<
    Assembly,
    'slug' | 'title' | 'question' | 'summary' | 'kind' | 'scale' | 'stage' | 'hostName' | 'hostSlug' | 'hostDescription' | 'isExample' | 'probes'
  > & { affectedGroups: { label: string; target: number }[] };
  pledge: Pledge | null;
  /** Null when withheld under rule 1; `withheld` then says why. */
  picture: {
    people: number;
    themes: {
      kind: string;
      name: string;
      people: number;
      sentences: { text: string; people: number }[];
      /** Only points their authors chose to show; a name only when they chose to be named. */
      quotes: { text: string; name?: string }[];
    }[];
  } | null;
  statements: {
    text: string;
    version: number;
    status: string;
    support: { agree: number; disagree: number; unsure: number; total: number };
  }[] | null;
  withheld?: string;
  decisions: (Pick<Decision, 'number' | 'title' | 'why' | 'options' | 'dissent' | 'tests' | 'delivery' | 'dueDate' | 'reviewDate' | 'status'> & {
    statement: string | null;
    answer: Omit<NonNullable<Decision['answer']>, 'answeredBy'> | null;
    check: (Pick<Check, 'checkBody' | 'results' | 'classification' | 'summary' | 'checkedAt'> & { panelSize: number }) | null;
  })[];
  register: { entries: Omit<RegisterEntry, 'id' | 'answer'>[]; summary: RegisterSummary };
}

export async function exportAssembly(deps: Pick<Deps, 'store' | 'clock'>, slug: string, viewer: { role: Role; personId?: string } = { role: 'participant' }): Promise<AssemblyExport> {
  const { store, clock } = deps;
  const a = await getAssemblyBySlug(store, slug);
  const [heard, decisions, checks, statements, reg] = await Promise.all([
    isHeard(deps, a, viewer.personId, viewer.role),
    store.list('decisions', { assemblyId: a.id }),
    store.list('checks', { assemblyId: a.id }),
    store.list('statements', { assemblyId: a.id }),
    register(deps, { assembly: a.slug }),
  ]);
  const statementText = new Map(statements.map((s) => [s.id, s.text]));

  let picture: AssemblyExport['picture'] = null;
  let statementsOut: AssemblyExport['statements'] = null;
  if (heard) {
    const [themes, points, reactions] = await Promise.all([
      store.list('themes', { assemblyId: a.id }),
      store.list('points', { assemblyId: a.id, status: 'approved' }),
      store.list('reactions', { assemblyId: a.id, counted: true }),
    ]);
    const pointById = new Map(points.map((p) => [p.id, p]));
    const named = points.filter((p) => p.visibility === 'named');
    const names = new Map<string, string>();
    for (const p of named) {
      if (names.has(p.personId)) continue;
      const person = await store.get('persons', p.personId);
      if (person?.displayName) names.set(p.personId, person.displayName);
    }
    const of = (ids: string[]) => ids.map((id) => pointById.get(id)).filter((p) => !!p);
    picture = {
      people: countPeople(points),
      themes: themes.map((t) => ({
        kind: t.kind,
        name: t.name,
        people: countPeople(of(t.pointIds)),
        sentences: t.sentences.map((s) => ({ text: s.text, people: countPeople(of(s.pointIds)) })),
        quotes: of(t.pointIds)
          .filter((p) => p.visibility !== 'count')
          .map((p) => ({ text: p.textEn ?? p.text, ...(p.visibility === 'named' && names.has(p.personId) ? { name: names.get(p.personId)! } : {}) })),
      })),
    };
    const groups = opinionGroups(reactions, statements.map((s) => s.id));
    statementsOut = statements.map((s) => {
      const { agree, disagree, unsure, total } = statementSupport(s, reactions, groups).overall;
      return { text: s.text, version: s.version, status: s.status, support: { agree, disagree, unsure, total } };
    });
  }

  return {
    format: EXPORT_FORMAT,
    exportedAt: clock.iso(),
    assembly: {
      slug: a.slug,
      title: a.title,
      question: a.question,
      summary: a.summary,
      kind: a.kind,
      scale: a.scale,
      stage: a.stage,
      hostName: a.hostName,
      hostSlug: a.hostSlug,
      hostDescription: a.hostDescription,
      isExample: a.isExample,
      probes: a.probes,
      affectedGroups: a.affectedGroups.map((g) => ({ label: g.label, target: g.target })),
    },
    pledge: a.pledge,
    picture,
    statements: statementsOut,
    ...(heard ? {} : { withheld: 'The picture and the statements are shown only to people who have had their own conversation in this assembly (rule 1).' }),
    decisions: decisions
      .sort((x, y) => x.number - y.number)
      .map((d) => {
        const c = checks.find((k) => k.decisionId === d.id);
        const answer = d.answer ? (({ answeredBy: _by, ...rest }) => (void _by, rest))(d.answer) : null;
        return {
          number: d.number,
          title: d.title,
          why: d.why,
          options: d.options,
          dissent: d.dissent,
          tests: d.tests,
          delivery: d.delivery,
          dueDate: d.dueDate,
          reviewDate: d.reviewDate,
          status: d.status,
          statement: statementText.get(d.statementId) ?? null,
          answer,
          check: c
            ? { checkBody: c.checkBody || checkBodyName(a), results: c.results, classification: c.classification, summary: c.summary, checkedAt: c.checkedAt, panelSize: c.panel.length }
            : null,
        };
      }),
    register: {
      entries: reg.entries.map(({ id: _id, answer: _answer, ...rest }) => (void _id, void _answer, rest)),
      summary: reg.summary,
    },
  };
}
