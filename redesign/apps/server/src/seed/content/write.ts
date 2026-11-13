import { addDays, fixedClock, stableId, type Point } from '@unite/shared';
import { makeConversationWithPoints, makeMembership, makePerson, makeTheme, type SeedCtx, type SeedPoint } from '../builders.js';
import type { PersonSpec, ThemeSpec, Vis } from './types.js';

const VIS: Record<Vis, Point['visibility']> = { a: 'anonymous', c: 'count', n: 'named' };

/** A seed context whose clock stands at `iso`, so a record gets a believable time of its own. */
export function at(ctx: SeedCtx, iso: string): SeedCtx {
  return { store: ctx.store, clock: fixedClock(iso) };
}

/** `iso` plus some hours, as an ISO date-time. */
export function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString();
}

/** Ids for one seeded assembly's records, all derived from readable keys. */
export function idsFor(scope: string) {
  return {
    person: (key: string) => stableId('per', `${scope}/${key}`),
    membership: (key: string) => stableId('mem', `${scope}/${key}`),
    conversation: (key: string) => stableId('con', `${scope}/${key}`),
    point: (ref: string) => stableId('pt', `${scope}/${ref}`),
    turn: (key: string, i: number) => stableId('trn', `${scope}/${key}/t${i}`),
    theme: (key: string) => stableId('thm', `${scope}/${key}`),
    statement: (key: string) => stableId('st', `${scope}/${key}`),
    reaction: (st: string, person: string) => stableId('rx', `${scope}/${st}/${person}`),
    reason: (key: string) => stableId('rsn', `${scope}/${key}`),
    choice: (person: string) => stableId('pc', `${scope}/${person}`),
  };
}

/** A person's points as `key/n` references with their theme, whichever way they were written. */
export function pointRefs(p: PersonSpec): { ref: string; theme: string | null; text: string; textEn?: string }[] {
  if (p.transcript) return p.transcript.points.map((pt, i) => ({ ref: `${p.key}/${i + 1}`, theme: pt.theme, text: pt.text }));
  return p.points.map(([, , theme, text, textEn], i) => ({ ref: `${p.key}/${i + 1}`, theme, text, ...(textEn ? { textEn } : {}) }));
}

/** When person `i` of `n` finished their conversation: spread evenly from `start` to `end`, at varied hours. */
export function finishedAt(i: number, n: number, start: string, end: string): string {
  const span = new Date(end).getTime() - new Date(start).getTime();
  const base = new Date(new Date(start).getTime() + Math.floor(((i + 0.5) / n) * span));
  base.setUTCHours(0, 0, 0, 0);
  const hours = [7.25, 12.5, 19.75, 21.5, 9.5, 14.25, 22.75, 6.5, 17.5, 11.25, 20.25, 13.5];
  return addHours(base.toISOString(), hours[i % hours.length]!);
}

export interface WritePeopleOptions {
  scope: string;
  assemblyId: string;
  people: PersonSpec[];
  start: string;
  end: string;
  /** Joined with an invitation code (hosted assemblies). */
  invited: boolean;
}

/**
 * Writes each person with a membership and one completed conversation with approved points.
 * People with a transcript get its turns, and each point cites the turns it came from; the others
 * get points only, with no stored turns (their transcripts are private and never shown anyway).
 */
export async function writePeople(ctx: SeedCtx, o: WritePeopleOptions): Promise<void> {
  const ids = idsFor(o.scope);
  for (const [i, p] of o.people.entries()) {
    const c = at(ctx, finishedAt(i, o.people.length, o.start, o.end));
    const personId = ids.person(p.key);
    await makePerson(c, { id: personId, displayName: p.name, about: p.about, locale: p.locale ?? 'en-GB' });
    await makeMembership(c, { id: ids.membership(p.key), personId, assemblyId: o.assemblyId, invited: o.invited });
    const theme = (key: string | null) => (key ? { themeId: ids.theme(key) } : {});
    let points: SeedPoint[];
    let turns: { id: string; role: 'interviewer' | 'person'; text: string; stage: number }[] = [];
    if (p.transcript) {
      turns = p.transcript.turns.map(([stage, role, text], t) => ({ id: ids.turn(p.key, t), role, text, stage }));
      points = p.transcript.points.map((pt, n) => ({
        id: ids.point(`${p.key}/${n + 1}`),
        type: pt.type,
        text: pt.text,
        visibility: VIS[pt.vis],
        sourceTurnIds: pt.from.map((t) => ids.turn(p.key, t)),
        ...theme(pt.theme),
      }));
    } else {
      points = p.points.map(([type, vis, th, text, textEn], n) => ({
        id: ids.point(`${p.key}/${n + 1}`),
        type,
        text,
        ...(textEn ? { textEn } : {}),
        visibility: VIS[vis],
        sourceTurnIds: [],
        ...theme(th),
      }));
    }
    await makeConversationWithPoints(c, {
      id: ids.conversation(p.key),
      personId,
      assemblyId: o.assemblyId,
      route: 'ai',
      mode: 'scripted',
      language: p.language ?? 'en',
      turns,
      points,
      ...(p.transcript?.exit ? { exit: p.transcript.exit } : {}),
    });
  }
}

/** Writes the themes, each with every point that names it and sentences citing points of its own. */
export async function writeThemes(ctx: SeedCtx, o: { scope: string; assemblyId: string; people: PersonSpec[]; themes: ThemeSpec[]; at: string }): Promise<void> {
  const ids = idsFor(o.scope);
  const refs = o.people.flatMap(pointRefs);
  for (const t of o.themes) {
    const pointIds = refs.filter((r) => r.theme === t.key).map((r) => ids.point(r.ref));
    await makeTheme(at(ctx, o.at), {
      id: ids.theme(t.key),
      assemblyId: o.assemblyId,
      kind: t.kind,
      name: t.name,
      pointIds,
      sentences: t.sentences.map((s) => ({ text: s.text, pointIds: s.from.map((r) => ids.point(r)) })),
    });
  }
}

export { addDays };
