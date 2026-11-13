import { Router, type Request } from 'express';
import { z } from 'zod';
import { newId, type Assembly, type Room, type RoomAnswer } from '@unite/shared';
import { requireHeard, requirePerson, requireRole } from '../auth.js';
import type { Deps } from '../deps.js';
import { HttpError, notFound } from '../errors.js';
import { getAssemblyBySlug } from '../services/assemblies.js';
import { ROOM_SIZE } from '../services/rooms/draw.js';
import {
  answerTotals,
  checkFacilitator,
  closeRoom,
  createRoom,
  evidenceFor,
  memberNames,
  MESSAGE_MAX,
  messageView,
} from '../services/rooms/rooms.js';
import { parseBody } from '../validate.js';
import { bumpVersion } from '../version.js';

const line = z.string().trim().min(1).max(280);

const CreateBody = z.strictObject({
  topic: z.string().trim().min(1).max(200),
  statementId: z.string().optional(),
  minutes: z.number().int().min(10).max(120).default(45),
  size: z.number().int().min(ROOM_SIZE.min).max(ROOM_SIZE.max).default(ROOM_SIZE.default),
  seed: z.string().min(1).max(200).optional(),
  briefing: z
    .strictObject({
      summary: z.string().trim().max(2000).default(''),
      forSide: z.array(line).max(10).default([]),
      againstSide: z.array(line).max(10).default([]),
      evidenceIds: z.array(z.string()).max(10).default([]),
    })
    .default({ summary: '', forSide: [], againstSide: [], evidenceIds: [] }),
});

const MessageBody = z.strictObject({
  text: z.string().trim().min(1, 'is empty').max(MESSAGE_MAX, `must be at most ${MESSAGE_MAX} characters`),
});

const AnswerBody = z.strictObject({
  value: z.enum(['agree', 'disagree', 'unsure']),
  note: z.string().trim().max(280).optional(),
});

const OutcomeBody = z.strictObject({
  kind: z.enum(['for', 'against', 'wording', 'question']),
  text: line,
});

const isManager = (req: Request) => req.role === 'host' || req.role === 'steward';

/**
 * Rooms (sections 6.4 and 7): drawing a room by lot, its lifecycle, messages with the
 * facilitator, private final answers, the members' outcome, and evidence cards.
 * Everything here is behind rule 1 (heard alone first).
 */
export function roomsRouter(deps: Deps): Router {
  const r = Router();
  const { store, clock } = deps;

  /** The room and its assembly, after the rule 1 check. */
  async function loadRoom(req: Request): Promise<{ room: Room; assembly: Assembly; isMember: boolean }> {
    const room = await store.get('rooms', String(req.params.id));
    if (!room) throw notFound('That room');
    const assembly = await store.get('assemblies', room.assemblyId);
    if (!assembly) throw notFound('That room');
    await requireHeard(deps, req, assembly);
    return { room, assembly, isMember: !!req.personId && room.memberIds.includes(req.personId) };
  }

  const membersOnly = (isMember: boolean) => {
    if (!isMember) throw new HttpError(403, 'not_member', 'Only the people drawn for this room can take part in it.');
  };
  const timeUp = (room: Room) => !!room.endsAt && clock.now().getTime() >= Date.parse(room.endsAt);

  r.get('/assemblies/:slug/rooms', async (req, res) => {
    const assembly = await getAssemblyBySlug(store, String(req.params.slug));
    await requireHeard(deps, req, assembly);
    const rooms = await store.list('rooms', { assemblyId: assembly.id }, { orderBy: 'created_at' });
    const me = req.personId;
    const mine = rooms.filter((x) => me && x.memberIds.includes(me));
    const current = mine.find((x) => x.status !== 'closed');
    const myRoom = current
      ? {
          id: current.id,
          topic: current.topic,
          status: current.status,
          minutes: current.minutes,
          startedAt: current.startedAt ?? null,
          endsAt: current.endsAt ?? null,
          members: [...(await memberNames(store, current)).entries()].map(([id, name]) => ({ name, isMe: id === me })),
        }
      : null;
    const others = rooms
      .filter((x) => x.status !== 'closed' && x.id !== current?.id)
      .map((x) => ({ id: x.id, topic: x.topic, status: x.status, startedAt: x.startedAt ?? null, endsAt: x.endsAt ?? null, size: x.memberIds.length }));
    const closed = await Promise.all(
      rooms
        .filter((x) => x.status === 'closed')
        .map(async (x) => ({
          id: x.id,
          topic: x.topic,
          wasMine: !!me && x.memberIds.includes(me),
          outcome: x.outcome ?? { reasonsFor: [], reasonsAgainst: [], questionsForExperts: [] },
          answers: answerTotals(await store.list('roomAnswers', { roomId: x.id })),
        })),
    );
    res.json({ myRoom, others, closed, canManage: isManager(req), now: clock.iso() });
  });

  r.post('/assemblies/:slug/rooms', requireRole('host', 'steward'), async (req, res) => {
    const body = parseBody(CreateBody, req.body);
    const assembly = await getAssemblyBySlug(store, String(req.params.slug));
    const room = await createRoom(deps, assembly, body);
    res.status(201).json({ room });
  });

  r.get('/rooms/:id', async (req, res) => {
    const { room, assembly, isMember } = await loadRoom(req);
    const [statement, evidence, answers] = await Promise.all([
      room.statementId ? store.get('statements', room.statementId) : undefined,
      evidenceFor(store, room.briefing.evidenceIds),
      store.list('roomAnswers', { roomId: room.id }),
    ]);
    const names = isMember ? await memberNames(store, room) : undefined;
    const mine = answers.find((a) => a.personId === req.personId);
    const closed = room.status === 'closed';
    res.json({
      room: {
        id: room.id,
        topic: room.topic,
        status: room.status,
        minutes: room.minutes,
        startedAt: room.startedAt ?? null,
        endsAt: room.endsAt ?? null,
        statement: statement ? { id: statement.id, text: statement.text } : null,
        briefing: { summary: room.briefing.summary, forSide: room.briefing.forSide, againstSide: room.briefing.againstSide, evidence },
        // The members' outcome is shown once the room has closed, or to its members while it runs.
        outcome: closed || isMember ? (room.outcome ?? null) : null,
      },
      assembly: { slug: assembly.slug },
      // Names only to the people in the room.
      members: names ? [...names.entries()].map(([id, name]) => ({ name, isMe: id === req.personId })) : [],
      memberCount: room.memberIds.length,
      isMember,
      canManage: isManager(req),
      myAnswer: isMember && mine ? { value: mine.value, note: mine.note ?? null } : null,
      // Private final answers: only totals, and only after the room is closed.
      answerTotals: closed ? answerTotals(answers) : null,
      now: clock.iso(),
    });
  });

  r.post('/rooms/:id/open', requireRole('host', 'steward'), async (req, res) => {
    const { room } = await loadRoom(req);
    if (room.status !== 'scheduled') throw new HttpError(409, 'not_scheduled', room.status === 'open' ? 'This room is already open.' : 'This room has closed.');
    const start = clock.now().getTime();
    const opened: Room = {
      ...room,
      status: 'open',
      startedAt: new Date(start).toISOString(),
      endsAt: new Date(start + room.minutes * 60000).toISOString(),
    };
    await store.put('rooms', opened);
    await bumpVersion(deps, room.assemblyId);
    await checkFacilitator(deps, room.id, { force: true });
    res.json({ room: opened });
  });

  r.get('/rooms/:id/messages', async (req, res) => {
    const { room, isMember } = await loadRoom(req);
    membersOnly(isMember);
    if (room.status === 'open') await checkFacilitator(deps, room.id);
    const all = await store.list('roomMessages', { roomId: room.id }, { orderBy: 'created_at' });
    const after = typeof req.query.after === 'string' ? req.query.after : undefined;
    const from = after ? all.findIndex((m) => m.id === after) + 1 : 0;
    const names = await memberNames(store, room);
    const fresh = await store.get('rooms', room.id);
    res.set('Cache-Control', 'no-store').json({
      messages: all.slice(from).map((m) => messageView(m, names, req.personId)),
      status: fresh?.status ?? room.status,
      endsAt: fresh?.endsAt ?? null,
      now: clock.iso(),
    });
  });

  r.post('/rooms/:id/messages', requirePerson(deps), async (req, res) => {
    const { room, isMember } = await loadRoom(req);
    membersOnly(isMember);
    const { text } = parseBody(MessageBody, req.body);
    if (room.status !== 'open') throw new HttpError(409, 'not_open', room.status === 'scheduled' ? 'This room has not opened yet.' : 'This room has closed.');
    if (timeUp(room)) throw new HttpError(409, 'time_up', 'Time is up. Please give your private final answer instead.');
    const msg = await store.put('roomMessages', {
      id: newId('msg'),
      roomId: room.id,
      authorType: 'person',
      personId: req.personId!,
      text,
      createdAt: clock.iso(),
    });
    await bumpVersion(deps, room.assemblyId);
    await checkFacilitator(deps, room.id, { force: true });
    const names = await memberNames(store, room);
    res.status(201).json({ message: messageView(msg, names, req.personId) });
  });

  r.post('/rooms/:id/answer', requirePerson(deps), async (req, res) => {
    const { room, isMember } = await loadRoom(req);
    membersOnly(isMember);
    const body = parseBody(AnswerBody, req.body);
    if (room.status !== 'open') throw new HttpError(409, 'not_open', room.status === 'scheduled' ? 'This room has not opened yet.' : 'This room has closed.');
    const [existing] = await store.list('roomAnswers', { roomId: room.id, personId: req.personId! }, { limit: 1 });
    const answer: RoomAnswer = {
      id: existing?.id ?? newId('ra'),
      roomId: room.id,
      personId: req.personId!,
      value: body.value,
      ...(body.note ? { note: body.note } : {}),
    };
    await store.put('roomAnswers', answer);
    await bumpVersion(deps, room.assemblyId);
    res.json({ myAnswer: { value: answer.value, note: answer.note ?? null } });
  });

  r.post('/rooms/:id/outcome', requirePerson(deps), async (req, res) => {
    const { room, isMember } = await loadRoom(req);
    membersOnly(isMember);
    const body = parseBody(OutcomeBody, req.body);
    if (room.status !== 'open') throw new HttpError(409, 'not_open', room.status === 'scheduled' ? 'This room has not opened yet.' : 'This room has closed.');
    const outcome = await store.transaction(async (tx) => {
      const now = (await tx.get('rooms', room.id)) ?? room;
      const o = now.outcome ?? { reasonsFor: [], reasonsAgainst: [], questionsForExperts: [] };
      const next = {
        ...o,
        reasonsFor: body.kind === 'for' ? [...o.reasonsFor, body.text] : o.reasonsFor,
        reasonsAgainst: body.kind === 'against' ? [...o.reasonsAgainst, body.text] : o.reasonsAgainst,
        questionsForExperts: body.kind === 'question' ? [...o.questionsForExperts, body.text] : o.questionsForExperts,
        ...(body.kind === 'wording' ? { proposedWording: body.text } : {}),
      };
      await tx.put('rooms', { ...now, outcome: next });
      return next;
    });
    await bumpVersion(deps, room.assemblyId);
    res.json({ outcome });
  });

  r.post('/rooms/:id/close', async (req, res) => {
    const { room, isMember } = await loadRoom(req);
    if (!isManager(req) && !(isMember && timeUp(room)))
      throw new HttpError(403, 'cannot_close', 'Only a host or steward can close a room before its time is up.');
    if (room.status === 'closed') throw new HttpError(409, 'closed', 'This room has already closed.');
    const { room: closed, statement } = await closeRoom(deps, room);
    res.json({ room: closed, statement: statement ? { id: statement.id, text: statement.text } : null });
  });

  r.get('/assemblies/:slug/evidence', async (req, res) => {
    const assembly = await getAssemblyBySlug(store, String(req.params.slug));
    await requireHeard(deps, req, assembly);
    res.json({ evidence: await store.list('evidenceCards', { assemblyId: assembly.id }) });
  });

  return r;
}
