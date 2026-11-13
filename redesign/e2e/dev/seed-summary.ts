// Seeds an in-memory store and prints a plain summary of the example data.
// Run from redesign/: pnpm --filter @unite/server exec tsx ../../e2e/dev/seed-summary.ts
import { countPeople, fixedClock, opinionGroups, rankPriorities, registerSummary, statementSupport } from '../../packages/shared/src/index.js';
import { SEED_NOW } from '../../apps/server/src/seed/assemblies.js';
import { seed } from '../../apps/server/src/seed/index.js';
import { memoryStore } from '../../apps/server/src/store/index.js';

const store = await memoryStore(fixedClock(SEED_NOW));
await seed({ store });

const KIND_ORDER = ['matters', 'barrier', 'day', 'idea'];
const pct = (x: number) => `${Math.round(x * 100)}%`;

for (const a of await store.list('assemblies')) {
  console.log(`\n=== ${a.title} (${a.slug}) — stage ${a.stage}${a.isExample ? ', example' : ''}`);
  const members = await store.list('memberships', { assemblyId: a.id });
  const points = await store.list('points', { assemblyId: a.id });
  const persons = await Promise.all(members.map((m) => store.get('persons', m.personId)));
  const countries = new Set(persons.map((p) => p?.locale.split('-')[1]).filter(Boolean));
  const languages = new Set((await store.list('conversations', { assemblyId: a.id })).map((c) => c.language));
  console.log(`People: ${members.length} (heard: ${countPeople(points)}); points: ${points.length}; countries: ${countries.size}; languages: ${[...languages].sort().join(', ')}`);
  if (a.pledge?.challengeEndsAt && a.stage === 'pledged') {
    const days = Math.round((new Date(a.pledge.challengeEndsAt).getTime() - new Date(SEED_NOW).getTime()) / 86_400_000);
    console.log(`Challenge period: ${days} days left`);
  }
  for (const g of a.affectedGroups) {
    const n = persons.filter((p) => p?.about[g.aboutKey] === g.aboutValue).length;
    console.log(`  Group ${g.label}: ${n} of ${g.target}`);
  }

  const themes = (await store.list('themes', { assemblyId: a.id })).sort((x, y) => KIND_ORDER.indexOf(x.kind) - KIND_ORDER.indexOf(y.kind));
  if (themes.length) console.log('Themes:');
  for (const t of themes) {
    const pts = points.filter((p) => t.pointIds.includes(p.id));
    const answered = (await store.list('assemblies')).some((x) => x.fromThemeId === t.id);
    console.log(`  [${t.kind}] ${t.name} — ${countPeople(pts)} people${a.isOpenListening && !answered ? ' (no host yet)' : ''}`);
  }

  const statements = await store.list('statements', { assemblyId: a.id });
  const reactions = (await store.list('reactions', { assemblyId: a.id })).filter((r) => r.counted);
  const groups = opinionGroups(reactions, statements.map((s) => s.id));
  if (statements.length) console.log(`Statements (opinion groups: ${groups.groups.map((g) => g.personIds.length).join(' and ')} people):`);
  for (const s of statements) {
    const sup = statementSupport(s, reactions, groups);
    console.log(`  ${s.status.padEnd(13)} v${s.version} ${s.text} [${sup.overall.total} answered; agree ${sup.groups.map((g) => pct(g.share)).join(' / ')}]`);
  }

  const rooms = await store.list('rooms', { assemblyId: a.id });
  for (const r of rooms) console.log(`Room (${r.status}, ${r.memberIds.length} members): ${r.topic}${r.outcome?.proposedWording ? `\n    proposed: ${r.outcome.proposedWording}` : ''}`);

  const choices = await store.list('priorityChoices', { assemblyId: a.id });
  if (choices.length) {
    const candidates = statements.filter((s) => s.status === 'common_ground' || s.status === 'decided').map((s) => s.id);
    console.log(`Priorities: ${choices.length} people chose`);
    for (const r of rankPriorities(choices, candidates)) console.log(`  ${r.round}. ${statements.find((s) => s.id === r.statementId)!.text} (score ${r.score})`);
  }

  const decisions = (await store.list('decisions', { assemblyId: a.id })).sort((x, y) => x.number - y.number);
  for (const d of decisions) console.log(`Decision ${d.number}: ${d.status} — ${d.title}`);
  if (decisions.length) {
    const r = registerSummary(decisions);
    console.log(`Register: ${r.total} decisions, ${r.answered} answered, ${r.inProgress} in progress, ${r.delivered} delivered (in progress is not counted as done)`);
  }
}
await store.close();
