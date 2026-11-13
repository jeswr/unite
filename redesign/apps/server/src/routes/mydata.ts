import { Router } from 'express';
import { DECISION_STATUS_WORDS, type Point, type StatementStatus, type TraceEntry } from '@unite/shared';
import { currentPerson, requirePerson, SID_COOKIE } from '../auth.js';
import type { Deps } from '../deps.js';
import { HttpError } from '../errors.js';
import type { Store } from '../store/types.js';
import { bumpVersion } from '../version.js';

/** A statement's status in words, for participants. */
export const STATEMENT_STATUS_WORDS: Record<StatementStatus, string> = {
  candidate: 'Waiting for people to react',
  common_ground: 'Common ground',
  differ: 'Where we differ',
  not_enough: 'Not enough voices yet',
  decided: 'Decided',
  no_agreement: 'No agreement',
  retired: 'No longer in use',
};

async function exportFor(store: Store, personId: string) {
  const person = await store.get('persons', personId);
  const conversations = await store.list('conversations', { personId });
  const turns = (await Promise.all(conversations.map((c) => store.list('turns', { conversationId: c.id })))).flat();
  const [memberships, points, reactions, reasons, objections, priorityChoices, roomAnswers, roomMessages, reports, feedback] = await Promise.all([
    store.list('memberships', { personId }),
    store.list('points', { personId }),
    store.list('reactions', { personId }),
    store.list('reasons', { personId }),
    store.list('objections', { personId }),
    store.list('priorityChoices', { personId }),
    store.list('roomAnswers', { personId }),
    store.list('roomMessages', { personId }),
    store.list('reports', { personId }),
    store.list('feedback', { personId }),
  ]);
  const mediations = await store.list('mediations', { personId });
  return { person, memberships, conversations, turns, points, reactions, reasons, objections, priorityChoices, roomAnswers, roomMessages, reports, feedback, mediations };
}

/**
 * Erases a person (section 7): the person, memberships, conversations, turns, points, reactions,
 * reasons, objections, priority choices, room answers and mediations. Their name is taken off statements
 * they wrote and reports and feedback they sent. Their point ids are taken out of themes
 * (and theme sentences) and statements; a sentence left with no source is dropped (rule 3), and a
 * theme left with no points is removed unless a statement or report refers to it. Every affected
 * assembly's version moves on.
 */
export async function erasePerson(deps: Pick<Deps, 'store' | 'clock'>, personId: string): Promise<{ assemblies: number }> {
  return deps.store.transaction(async (tx) => {
    const affected = new Set<string>();
    const points = await tx.list('points', { personId });
    const pointIds = new Set(points.map((p) => p.id));
    for (const p of points) affected.add(p.assemblyId);

    const conversations = await tx.list('conversations', { personId });
    for (const c of conversations) {
      for (const t of await tx.list('turns', { conversationId: c.id })) await tx.delete('turns', t.id);
      // Points another person made in this conversation do not exist; points are always the owner's.
      await tx.delete('conversations', c.id);
      affected.add(c.assemblyId);
    }
    for (const p of points) await tx.delete('points', p.id);

    for (const name of ['memberships', 'reactions', 'reasons', 'objections', 'priorityChoices', 'mediations'] as const) {
      for (const doc of await tx.list(name, { personId })) {
        await tx.delete(name, doc.id);
        affected.add(doc.assemblyId);
      }
    }
    for (const a of await tx.list('roomAnswers', { personId })) {
      await tx.delete('roomAnswers', a.id);
      const room = await tx.get('rooms', a.roomId);
      if (room) affected.add(room.assemblyId);
    }

    if (pointIds.size) {
      for (const assemblyId of affected) {
        const statements = await tx.list('statements', { assemblyId });
        for (const s of statements) {
          if (s.pointIds.some((id) => pointIds.has(id)))
            await tx.put('statements', { ...s, pointIds: s.pointIds.filter((id) => !pointIds.has(id)), updatedAt: deps.clock.iso() });
        }
        const reports = await tx.list('reports', { assemblyId, targetType: 'theme' });
        for (const t of await tx.list('themes', { assemblyId })) {
          if (!t.pointIds.some((id) => pointIds.has(id)) && !t.sentences.some((s) => s.pointIds.some((id) => pointIds.has(id)))) continue;
          const left = t.pointIds.filter((id) => !pointIds.has(id));
          const referenced = statements.some((s) => s.themeIds.includes(t.id)) || reports.some((r) => r.targetId === t.id);
          if (left.length === 0 && !referenced) {
            await tx.delete('themes', t.id);
            continue;
          }
          const sentences = t.sentences
            .map((s) => ({ text: s.text, pointIds: s.pointIds.filter((id) => !pointIds.has(id)) }))
            .filter((s) => s.pointIds.length > 0);
          await tx.put('themes', { ...t, pointIds: left, sentences, updatedAt: deps.clock.iso() });
        }
      }
    }

    // Statements a person wrote, and reports and feedback they sent, stay for others without their name on them.
    for (const s of await tx.list('statements', { authorPersonId: personId })) {
      const { authorPersonId: _drop, ...rest } = s;
      void _drop;
      await tx.put('statements', rest);
      affected.add(s.assemblyId);
    }
    for (const rp of await tx.list('reports', { personId })) {
      const { personId: _drop, ...rest } = rp;
      void _drop;
      await tx.put('reports', rest);
      affected.add(rp.assemblyId);
    }
    for (const f of await tx.list('feedback', { personId })) {
      const { personId: _drop, ...rest } = f;
      void _drop;
      await tx.put('feedback', rest);
    }

    await tx.delete('persons', personId);
    for (const assemblyId of affected) if (await tx.get('assemblies', assemblyId)) await bumpVersion({ store: tx, clock: deps.clock }, assemblyId);
    return { assemblies: affected.size };
  });
}

/** For each approved point: its theme, the statements that rest on it or its theme, and the decisions made from those statements. */
export async function traceFor(store: Store, personId: string): Promise<TraceEntry[]> {
  const points = (await store.list('points', { personId, status: 'approved' }, { orderBy: 'created_at' })) as Point[];
  const assemblies = new Map<string, Awaited<ReturnType<typeof loadAssembly>>>();
  async function loadAssembly(assemblyId: string) {
    const [assembly, themes, statements, decisions] = await Promise.all([
      store.get('assemblies', assemblyId),
      store.list('themes', { assemblyId }),
      store.list('statements', { assemblyId }),
      store.list('decisions', { assemblyId }),
    ]);
    return { assembly, themes, statements, decisions };
  }
  // Rule 5: a statement's status says how others answered, so it is shown only once I have answered (or it is decided).
  const answered = new Set((await store.list('reactions', { personId })).map((r) => r.statementId));
  const out: TraceEntry[] = [];
  for (const p of points) {
    if (!assemblies.has(p.assemblyId)) assemblies.set(p.assemblyId, await loadAssembly(p.assemblyId));
    const { assembly, themes, statements, decisions } = assemblies.get(p.assemblyId)!;
    const theme = themes.find((t) => t.id === p.themeId) ?? themes.find((t) => t.pointIds.includes(p.id));
    const mine = statements.filter((s) => s.status !== 'retired' && (s.pointIds.includes(p.id) || (theme && s.themeIds.includes(theme.id))));
    const ids = new Set(mine.map((s) => s.id));
    out.push({
      point: { id: p.id, type: p.type, text: p.text, visibility: p.visibility, ...(p.approvedAt ? { approvedAt: p.approvedAt } : {}) },
      assembly: assembly ? { slug: assembly.slug, title: assembly.title, isOpenListening: assembly.isOpenListening } : null,
      theme: theme ? { id: theme.id, name: theme.name } : null,
      statements: mine.map((s) =>
        s.status === 'decided' || answered.has(s.id)
          ? { id: s.id, text: s.text, status: s.status, statusWords: STATEMENT_STATUS_WORDS[s.status] }
          : { id: s.id, text: s.text },
      ),
      decisions: decisions
        .filter((d) => ids.has(d.statementId))
        .sort((a, b) => a.number - b.number)
        .map((d) => ({ id: d.id, number: d.number, title: d.title, status: d.status, statusWords: DECISION_STATUS_WORDS[d.status] })),
    });
  }
  return out;
}

/**
 * My data. Mounted under /api.
 *
 *   GET /api/me/export — everything held about me, as JSON
 *   DELETE /api/me — erases me (see erasePerson)
 *   GET /api/me/trace — what happened to each of my approved points
 */
export function myDataRouter(deps: Deps): Router {
  const r = Router();

  r.get('/me/export', requirePerson(deps), async (req, res) => {
    const data = await exportFor(deps.store, req.person!.id);
    res.setHeader('Content-Disposition', 'attachment; filename="unite-my-data.json"');
    res.json({ exportedAt: deps.clock.iso(), ...data });
  });

  r.delete('/me', async (req, res) => {
    const person = await currentPerson(deps, req);
    if (!person) throw new HttpError(404, 'no_person', 'There is nothing held about you.');
    await erasePerson(deps, person.id);
    res.clearCookie(SID_COOKIE, { httpOnly: true, sameSite: 'lax', secure: deps.config.production, path: '/' });
    res.json({ deleted: true });
  });

  r.get('/me/trace', async (req, res) => {
    const person = await currentPerson(deps, req);
    res.json({ points: person ? await traceFor(deps.store, person.id) : [] });
  });

  return r;
}
