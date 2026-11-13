import type {
  Assembly,
  BuildProposal,
  Check,
  Clock,
  Conversation,
  Decision,
  DeliveryItem,
  EvidenceCard,
  Invite,
  Membership,
  Objection,
  Person,
  Point,
  PointType,
  PriorityChoice,
  Reaction,
  Reason,
  Report,
  Room,
  RoomAnswer,
  RoomMessage,
  Statement,
  Theme,
  Turn,
} from '@unite/shared';
import type { Store } from '../store/types.js';

/**
 * Typed helpers that write seed and test records through the store. Every helper takes explicit
 * ids (use `stableId(prefix, key)` from @unite/shared for readable, reproducible ones) and takes
 * its timestamps from `ctx.clock` unless one is given. Every record is validated by the store.
 */
export interface SeedCtx {
  store: Store;
  clock: Clock;
}

type Opt<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export function makePerson(ctx: SeedCtx, p: Opt<Person, 'createdAt' | 'isExample' | 'about' | 'locale'>): Promise<Person> {
  return ctx.store.put('persons', { createdAt: ctx.clock.iso(), isExample: true, about: {}, locale: 'en-GB', ...p });
}

export function makeMembership(ctx: SeedCtx, m: Opt<Membership, 'role' | 'invited' | 'lookedAroundFirst' | 'joinedAt'>): Promise<Membership> {
  return ctx.store.put('memberships', { role: 'participant', invited: true, lookedAroundFirst: false, joinedAt: ctx.clock.iso(), ...m });
}

export function makeInvite(ctx: SeedCtx, i: Opt<Invite, 'createdAt' | 'uses' | 'label'>): Promise<Invite> {
  return ctx.store.put('invites', { createdAt: ctx.clock.iso(), uses: 0, label: '', ...i });
}

export function makeAssembly(
  ctx: SeedCtx,
  a: Opt<
    Assembly,
    'createdAt' | 'updatedAt' | 'version' | 'probes' | 'aboutQuestions' | 'affectedGroups' | 'pledge' | 'isExample' | 'isOpenListening' | 'summary' | 'hostDescription'
  >,
): Promise<Assembly> {
  const now = ctx.clock.iso();
  return ctx.store.put('assemblies', {
    createdAt: now,
    updatedAt: now,
    version: 1,
    probes: [],
    aboutQuestions: [],
    affectedGroups: [],
    pledge: null,
    isExample: true,
    isOpenListening: false,
    summary: '',
    hostDescription: '',
    ...a,
  });
}

export interface SeedPoint {
  id: string;
  type: PointType;
  text: string;
  textEn?: string;
  visibility?: Point['visibility'];
  /** Defaults to a person turn made from the point's own text. */
  sourceTurnIds?: string[];
  themeId?: string;
  status?: Point['status'];
}

export interface SeedConversation {
  id: string;
  personId: string;
  assemblyId: string;
  route?: Conversation['route'];
  mode?: Conversation['mode'];
  language?: string;
  status?: Conversation['status'];
  /** Turns to store. When absent, one person turn per point is made from the point's text. */
  turns?: { id: string; role: Turn['role']; text: string; stage: number }[];
  points: SeedPoint[];
  exit?: Conversation['exit'];
}

/**
 * A conversation with its turns and points. By default it is complete, in scripted mode, with
 * approved points; turn ids default to `trn_` ids derived from each point id.
 */
export async function makeConversationWithPoints(
  ctx: SeedCtx,
  c: SeedConversation,
): Promise<{ conversation: Conversation; turns: Turn[]; points: Point[] }> {
  const now = ctx.clock.iso();
  const status = c.status ?? 'complete';
  const conversation = await ctx.store.put('conversations', {
    id: c.id,
    personId: c.personId,
    assemblyId: c.assemblyId,
    route: c.route ?? 'ai',
    mode: c.mode ?? 'scripted',
    promptVersion: 'seed',
    language: c.language ?? 'en',
    stage: status === 'complete' ? 9 : 1,
    stageTurns: 0,
    status,
    consent: { conversation: true, at: now },
    ...(c.exit ? { exit: c.exit } : {}),
    startedAt: now,
    ...(status === 'complete' ? { completedAt: now } : {}),
  });
  const turnSpecs =
    c.turns ??
    c.points.map((p, i) => ({ id: p.sourceTurnIds?.[0] ?? turnIdFor(p.id), role: 'person' as const, text: p.text, stage: Math.min(8, i + 1) }));
  const turns: Turn[] = [];
  for (const t of turnSpecs) turns.push(await ctx.store.put('turns', { ...t, conversationId: c.id, createdAt: now }));
  const points: Point[] = [];
  for (const p of c.points) {
    const pStatus = p.status ?? (status === 'complete' ? 'approved' : 'draft');
    points.push(
      await ctx.store.put('points', {
        id: p.id,
        conversationId: c.id,
        personId: c.personId,
        assemblyId: c.assemblyId,
        type: p.type,
        text: p.text,
        ...(p.textEn ? { textEn: p.textEn } : {}),
        draftText: p.text,
        sourceTurnIds: p.sourceTurnIds ?? [turnIdFor(p.id)],
        status: pStatus,
        visibility: p.visibility ?? 'anonymous',
        ...(p.themeId ? { themeId: p.themeId } : {}),
        ...(pStatus === 'approved' ? { approvedAt: now } : {}),
      }),
    );
  }
  return { conversation, turns, points };
}

/** The default source turn id for a seeded point: `pt_xxxx` gives `trn_xxxx`. */
export function turnIdFor(pointId: string): string {
  return `trn_${pointId.slice(pointId.indexOf('_') + 1)}`;
}

/** A theme; also sets `themeId` on each of its points. */
export async function makeTheme(ctx: SeedCtx, t: Opt<Theme, 'updatedAt' | 'sentences'>): Promise<Theme> {
  const theme = await ctx.store.put('themes', { updatedAt: ctx.clock.iso(), sentences: [], ...t });
  for (const id of theme.pointIds) {
    const p = await ctx.store.get('points', id);
    if (p && p.themeId !== theme.id) await ctx.store.put('points', { ...p, themeId: theme.id });
  }
  return theme;
}

export function makeReport(ctx: SeedCtx, r: Opt<Report, 'createdAt' | 'status'>): Promise<Report> {
  return ctx.store.put('reports', { createdAt: ctx.clock.iso(), status: 'open', ...r });
}

export function makeStatement(
  ctx: SeedCtx,
  s: Opt<Statement, 'createdAt' | 'updatedAt' | 'version' | 'origin' | 'status' | 'themeIds'>,
): Promise<Statement> {
  const now = ctx.clock.iso();
  return ctx.store.put('statements', { createdAt: now, updatedAt: now, version: 1, origin: 'ai', status: 'candidate', themeIds: [], ...s });
}

/** A reaction (one per person per statement). */
export function react(ctx: SeedCtx, r: Opt<Reaction, 'createdAt' | 'counted'>): Promise<Reaction> {
  return ctx.store.put('reactions', { createdAt: ctx.clock.iso(), counted: true, ...r });
}

export function makeReason(ctx: SeedCtx, r: Opt<Reason, 'createdAt'>): Promise<Reason> {
  return ctx.store.put('reasons', { createdAt: ctx.clock.iso(), ...r });
}

export function makeObjection(ctx: SeedCtx, o: Opt<Objection, 'createdAt' | 'status'>): Promise<Objection> {
  return ctx.store.put('objections', { createdAt: ctx.clock.iso(), status: 'open', ...o });
}

export function makeEvidenceCard(ctx: SeedCtx, e: Opt<EvidenceCard, 'sources' | 'confidence'>): Promise<EvidenceCard> {
  return ctx.store.put('evidenceCards', { sources: [], confidence: 'medium', ...e });
}

export function makeRoom(ctx: SeedCtx, r: Opt<Room, 'status' | 'memberIds' | 'minutes'>): Promise<Room> {
  return ctx.store.put('rooms', { status: 'scheduled', memberIds: [], minutes: 45, ...r });
}

export function makeRoomMessage(ctx: SeedCtx, m: Opt<RoomMessage, 'createdAt'>): Promise<RoomMessage> {
  return ctx.store.put('roomMessages', { createdAt: ctx.clock.iso(), ...m });
}

export function makeRoomAnswer(ctx: SeedCtx, a: RoomAnswer): Promise<RoomAnswer> {
  return ctx.store.put('roomAnswers', a);
}

export function choosePriorities(ctx: SeedCtx, c: Opt<PriorityChoice, 'updatedAt'>): Promise<PriorityChoice> {
  return ctx.store.put('priorityChoices', { updatedAt: ctx.clock.iso(), ...c });
}

export function makeDecision(
  ctx: SeedCtx,
  d: Opt<Decision, 'createdAt' | 'updatedAt' | 'status' | 'options' | 'dissent' | 'delivery' | 'why'>,
): Promise<Decision> {
  const now = ctx.clock.iso();
  return ctx.store.put('decisions', {
    createdAt: now,
    updatedAt: now,
    status: 'awaiting_answer',
    options: [],
    dissent: '',
    delivery: [],
    why: '',
    ...d,
  });
}

export function makeProposal(ctx: SeedCtx, p: Opt<BuildProposal, 'status' | 'testCoverage'>): Promise<BuildProposal> {
  return ctx.store.put('buildProposals', { status: 'proposed', testCoverage: [], ...p });
}

export function makeDeliveryItem(ctx: SeedCtx, i: Opt<DeliveryItem, 'status' | 'updates'>): Promise<DeliveryItem> {
  return ctx.store.put('deliveryItems', { status: 'planned', updates: [], ...i });
}

export function makeCheck(ctx: SeedCtx, c: Opt<Check, 'checkedAt'>): Promise<Check> {
  return ctx.store.put('checks', { checkedAt: ctx.clock.iso(), ...c });
}
