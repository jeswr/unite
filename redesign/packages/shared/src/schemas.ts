import { z } from 'zod';

/**
 * Every record Unite stores, as zod schemas. These are the single source of types: each schema
 * `XSchema` has a type `X` inferred from it. Objects are strict, so a field that is not named
 * here is refused at write time rather than silently kept or dropped.
 */

/** `<prefix>_<12 url-safe chars>`. */
export const idOf = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9_-]{12}$`), `must be an id starting ${prefix}_`);

export const IsoDateTime = z.iso.datetime({ offset: true });
/** A calendar date (`2026-12-18`) or a full date-time. */
export const IsoDate = z.union([z.iso.date(), IsoDateTime]);

/* ---------------------------------------------------------------- People and access */

export const PersonSchema = z.strictObject({
  id: idOf('per'),
  createdAt: IsoDateTime,
  displayName: z.string().max(80).optional(),
  isExample: z.boolean(),
  /** Answers to an assembly's aboutQuestions, by key. */
  about: z.record(z.string(), z.string()),
  /** BCP 47, default 'en-GB'. */
  locale: z.string().min(2),
});
export type Person = z.infer<typeof PersonSchema>;

export const MembershipRole = z.enum(['participant', 'host', 'steward', 'checker']);
export type MembershipRole = z.infer<typeof MembershipRole>;

export const MembershipSchema = z.strictObject({
  id: idOf('mem'),
  personId: idOf('per'),
  assemblyId: idOf('asm'),
  role: MembershipRole,
  /** Joined with a valid invite code: counts toward decisions. */
  invited: z.boolean(),
  /** Rule 1 exception, example assemblies only. */
  lookedAroundFirst: z.boolean(),
  joinedAt: IsoDateTime,
});
export type Membership = z.infer<typeof MembershipSchema>;

export const InviteSchema = z.strictObject({
  id: idOf('inv'),
  assemblyId: idOf('asm'),
  code: z.string().min(1),
  label: z.string(),
  createdAt: IsoDateTime,
  uses: z.number().int().min(0),
});
export type Invite = z.infer<typeof InviteSchema>;

/* ---------------------------------------------------------------- Assemblies */

export const AssemblyKind = z.enum(['listening', 'advisory', 'codecided', 'community', 'technology']);
export type AssemblyKind = z.infer<typeof AssemblyKind>;
export const AssemblyScale = z.enum(['local', 'sector', 'global', 'platform']);
export type AssemblyScale = z.infer<typeof AssemblyScale>;
export const AssemblyStage = z.enum([
  'proposed',
  'pledged',
  'listening',
  'picture',
  'deliberating',
  'deciding',
  'answered',
  'delivering',
  'checked',
  'review',
]);
export type AssemblyStage = z.infer<typeof AssemblyStage>;

export const DecisionLevel = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
export type DecisionLevel = z.infer<typeof DecisionLevel>;

export const PledgeSchema = z.strictObject({
  setAside: z.string(),
  remit: z.string(),
  offTable: z.string(),
  decisionLevel: DecisionLevel,
  /** Share of each opinion group that must agree, e.g. 0.6. */
  groupThreshold: z.number().min(0).max(1),
  minParticipants: z.number().int().min(0),
  /** How many priorities the host will answer. */
  capacity: z.number().int().min(0),
  replyBy: IsoDate,
  checkBody: z.enum(['panel', 'independent']),
  checkBodyName: z.string().optional(),
  reviewAfterDays: z.number().int().min(0),
  publishedAt: IsoDateTime.optional(),
  challengeEndsAt: IsoDateTime.optional(),
});
export type Pledge = z.infer<typeof PledgeSchema>;

export const AboutQuestionSchema = z.strictObject({
  key: z.string().min(1),
  label: z.string().min(1),
  options: z.array(z.string()),
});
export type AboutQuestion = z.infer<typeof AboutQuestionSchema>;

export const AffectedGroupSchema = z.strictObject({
  key: z.string().min(1),
  label: z.string().min(1),
  aboutKey: z.string().min(1),
  aboutValue: z.string().min(1),
  target: z.number().int().min(0),
});
export type AffectedGroup = z.infer<typeof AffectedGroupSchema>;

export const AssemblySchema = z.strictObject({
  id: idOf('asm'),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  title: z.string(),
  question: z.string(),
  summary: z.string(),
  kind: AssemblyKind,
  scale: AssemblyScale,
  /** Empty for open listening, which has no host. */
  hostName: z.string(),
  hostSlug: z.string(),
  hostDescription: z.string(),
  stage: AssemblyStage,
  isExample: z.boolean(),
  isOpenListening: z.boolean(),
  /** At most 3, each passed the leading-wording check. */
  probes: z.array(z.string().min(1)).max(3),
  aboutQuestions: z.array(AboutQuestionSchema),
  affectedGroups: z.array(AffectedGroupSchema),
  pledge: PledgeSchema.nullable(),
  pictureConfirmedAt: IsoDateTime.optional(),
  pictureConfirmedBy: z.string().optional(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  /** Increments on any change under the assembly. */
  version: z.number().int().min(0),
});
export type Assembly = z.infer<typeof AssemblySchema>;

/* ---------------------------------------------------------------- Conversations */

export const ConversationSchema = z.strictObject({
  id: idOf('con'),
  personId: idOf('per'),
  assemblyId: idOf('asm'),
  route: z.enum(['ai', 'questions', 'freetext', 'host']),
  mode: z.enum(['claude', 'scripted']),
  modelId: z.string().optional(),
  promptVersion: z.string(),
  language: z.string(),
  stage: z.number().int().min(0).max(9),
  stageTurns: z.number().int().min(0),
  status: z.enum(['active', 'reviewing', 'complete', 'abandoned']),
  consent: z.strictObject({ conversation: z.boolean(), at: IsoDateTime }),
  exit: z
    .strictObject({
      soundsLikeMe: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      pushed: z.enum(['no', 'a_little', 'yes']),
      note: z.string().optional(),
    })
    .optional(),
  startedAt: IsoDateTime,
  completedAt: IsoDateTime.optional(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const TurnSchema = z.strictObject({
  id: idOf('trn'),
  conversationId: idOf('con'),
  role: z.enum(['interviewer', 'person']),
  text: z.string(),
  stage: z.number().int().min(0).max(9),
  createdAt: IsoDateTime,
  meta: z
    .strictObject({
      regenerated: z.number().int().min(0).optional(),
      fallback: z.boolean().optional(),
    })
    .optional(),
});
export type Turn = z.infer<typeof TurnSchema>;

export const PointType = z.enum(['moment', 'matters', 'barrier', 'wish', 'idea', 'tradeoff', 'doubt']);
export type PointType = z.infer<typeof PointType>;

export const PointSchema = z.strictObject({
  id: idOf('pt'),
  conversationId: idOf('con'),
  personId: idOf('per'),
  assemblyId: idOf('asm'),
  type: PointType,
  /** The person's approved wording, original language. */
  text: z.string(),
  /** English rendering when the original is not English. */
  textEn: z.string().optional(),
  draftText: z.string(),
  sourceTurnIds: z.array(idOf('trn')),
  status: z.enum(['draft', 'approved', 'scrapped', 'withdrawn']),
  visibility: z.enum(['count', 'anonymous', 'named']),
  themeId: idOf('thm').optional(),
  approvedAt: IsoDateTime.optional(),
});
export type Point = z.infer<typeof PointSchema>;

/* ---------------------------------------------------------------- Picture */

export const ThemeSchema = z.strictObject({
  id: idOf('thm'),
  assemblyId: idOf('asm'),
  kind: z.enum(['matters', 'barrier', 'idea', 'day']),
  /** Participants' words. */
  name: z.string(),
  sentences: z.array(z.strictObject({ text: z.string(), pointIds: z.array(idOf('pt')) })),
  /** People count is computed, never stored. */
  pointIds: z.array(idOf('pt')),
  updatedAt: IsoDateTime,
});
export type Theme = z.infer<typeof ThemeSchema>;

export const ReportSchema = z.strictObject({
  id: idOf('rpt'),
  assemblyId: idOf('asm'),
  targetType: z.enum(['theme', 'statement', 'decision']),
  targetId: z.string(),
  kind: z.enum(['missing', 'added', 'emphasis', 'count', 'other']),
  text: z.string(),
  personId: idOf('per').optional(),
  status: z.enum(['open', 'upheld', 'not_upheld']),
  outcomeNote: z.string().optional(),
  createdAt: IsoDateTime,
  resolvedAt: IsoDateTime.optional(),
});
export type Report = z.infer<typeof ReportSchema>;

/* ---------------------------------------------------------------- Statements */

export const StatementStatus = z.enum([
  'candidate',
  'common_ground',
  'differ',
  'not_enough',
  'decided',
  'no_agreement',
  'retired',
]);
export type StatementStatus = z.infer<typeof StatementStatus>;

export const StatementSchema = z.strictObject({
  id: idOf('st'),
  assemblyId: idOf('asm'),
  text: z.string(),
  version: z.number().int().min(1),
  previousId: idOf('st').optional(),
  themeIds: z.array(idOf('thm')),
  pointIds: z.array(idOf('pt')),
  origin: z.enum(['ai', 'reword', 'room', 'steward']),
  authorPersonId: idOf('per').optional(),
  status: StatementStatus,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type Statement = z.infer<typeof StatementSchema>;

export const ReactionValue = z.enum(['agree', 'disagree', 'unsure']);
export type ReactionValue = z.infer<typeof ReactionValue>;

/** One per person per statement; upsert. */
export const ReactionSchema = z.strictObject({
  id: idOf('rx'),
  statementId: idOf('st'),
  assemblyId: idOf('asm'),
  personId: idOf('per'),
  value: ReactionValue,
  counted: z.boolean(),
  createdAt: IsoDateTime,
});
export type Reaction = z.infer<typeof ReactionSchema>;

export const ReasonSchema = z.strictObject({
  id: idOf('rsn'),
  statementId: idOf('st'),
  assemblyId: idOf('asm'),
  personId: idOf('per'),
  side: z.enum(['for', 'against', 'question']),
  text: z.string().min(1).max(280),
  createdAt: IsoDateTime,
});
export type Reason = z.infer<typeof ReasonSchema>;

export const ObjectionSchema = z.strictObject({
  id: idOf('obj'),
  statementId: idOf('st'),
  assemblyId: idOf('asm'),
  personId: idOf('per'),
  text: z.string().min(1),
  status: z.enum(['open', 'answered', 'sustained', 'withdrawn']),
  reply: z.string().optional(),
  repliedBy: z.string().optional(),
  createdAt: IsoDateTime,
  resolvedAt: IsoDateTime.optional(),
});
export type Objection = z.infer<typeof ObjectionSchema>;

/* ---------------------------------------------------------------- Rooms */

export const EvidenceCardSchema = z.strictObject({
  id: idOf('evd'),
  assemblyId: idOf('asm'),
  question: z.string(),
  answer: z.string(),
  sources: z.array(z.strictObject({ title: z.string(), url: z.string() })),
  confidence: z.enum(['low', 'medium', 'high']),
  disputed: z.string().optional(),
  expertName: z.string(),
  expertRole: z.string(),
});
export type EvidenceCard = z.infer<typeof EvidenceCardSchema>;

export const RoomSchema = z.strictObject({
  id: idOf('room'),
  assemblyId: idOf('asm'),
  statementId: idOf('st').optional(),
  topic: z.string(),
  briefing: z.strictObject({
    summary: z.string(),
    forSide: z.array(z.string()),
    againstSide: z.array(z.string()),
    evidenceIds: z.array(idOf('evd')),
  }),
  status: z.enum(['scheduled', 'open', 'closed']),
  memberIds: z.array(idOf('per')),
  minutes: z.number().int().min(1),
  startedAt: IsoDateTime.optional(),
  endsAt: IsoDateTime.optional(),
  outcome: z
    .strictObject({
      reasonsFor: z.array(z.string()),
      reasonsAgainst: z.array(z.string()),
      proposedWording: z.string().optional(),
      questionsForExperts: z.array(z.string()),
    })
    .optional(),
});
export type Room = z.infer<typeof RoomSchema>;

export const RoomMessageSchema = z.strictObject({
  id: idOf('msg'),
  roomId: idOf('room'),
  authorType: z.enum(['person', 'facilitator', 'system']),
  personId: idOf('per').optional(),
  text: z.string(),
  createdAt: IsoDateTime,
});
export type RoomMessage = z.infer<typeof RoomMessageSchema>;

export const RoomAnswerSchema = z.strictObject({
  id: idOf('ra'),
  roomId: idOf('room'),
  personId: idOf('per'),
  value: ReactionValue,
  note: z.string().optional(),
});
export type RoomAnswer = z.infer<typeof RoomAnswerSchema>;

/* ---------------------------------------------------------------- Deciding and delivering */

export const PriorityChoiceSchema = z.strictObject({
  id: idOf('pc'),
  assemblyId: idOf('asm'),
  personId: idOf('per'),
  /** At most 3. */
  statementIds: z.array(idOf('st')).max(3),
  updatedAt: IsoDateTime,
});
export type PriorityChoice = z.infer<typeof PriorityChoiceSchema>;

export const DecisionStatus = z.enum([
  'awaiting_answer',
  'accepted',
  'changed',
  'delayed',
  'refused',
  'in_progress',
  'delivered_as_decided',
  'delivered_minor_changes',
  'delivered_substantial_changes',
  'not_delivered',
  'replaced',
]);
export type DecisionStatus = z.infer<typeof DecisionStatus>;

export const DecisionSchema = z.strictObject({
  id: idOf('dec'),
  assemblyId: idOf('asm'),
  statementId: idOf('st'),
  /** Shown as "Decision 3". */
  number: z.number().int().min(1),
  title: z.string(),
  why: z.string(),
  options: z.array(z.string()),
  dissent: z.string(),
  tests: z.array(z.strictObject({ n: z.number().int().min(1), text: z.string() })),
  delivery: z.array(z.enum(['technology', 'social'])),
  rank: z.number().int().min(1),
  dueDate: IsoDate,
  reviewDate: IsoDate,
  status: DecisionStatus,
  answer: z
    .strictObject({
      kind: z.enum(['accepted', 'changed', 'delayed', 'refused']),
      reasons: z.string(),
      changedTo: z.string().optional(),
      delayedUntil: IsoDate.optional(),
      answeredAt: IsoDateTime,
      answeredBy: z.string(),
    })
    .optional(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type Decision = z.infer<typeof DecisionSchema>;

export const BuildProposalSchema = z.strictObject({
  id: idOf('prop'),
  decisionId: idOf('dec'),
  assemblyId: idOf('asm'),
  proposerName: z.string(),
  proposerRole: z.string(),
  summary: z.string(),
  plan: z.string(),
  cost: z.string().optional(),
  testCoverage: z.array(z.strictObject({ n: z.number().int().min(1), how: z.string() })),
  status: z.enum(['proposed', 'chosen', 'not_chosen']),
  faithfulConfirmedAt: IsoDateTime.optional(),
});
export type BuildProposal = z.infer<typeof BuildProposalSchema>;

export const DeliveryItemSchema = z.strictObject({
  id: idOf('dlv'),
  decisionId: idOf('dec'),
  assemblyId: idOf('asm'),
  title: z.string(),
  kind: z.enum(['technology', 'social']),
  owner: z.string(),
  dueDate: IsoDate,
  status: z.enum(['planned', 'in_progress', 'done']),
  link: z.string().optional(),
  updates: z.array(z.strictObject({ at: IsoDateTime, text: z.string() })),
});
export type DeliveryItem = z.infer<typeof DeliveryItemSchema>;

export const CheckSchema = z.strictObject({
  id: idOf('chk'),
  decisionId: idOf('dec'),
  assemblyId: idOf('asm'),
  checkBody: z.string(),
  panel: z.array(z.string()),
  results: z.array(z.strictObject({ n: z.number().int().min(1), met: z.boolean(), note: z.string() })),
  classification: z.enum(['as_decided', 'minor_changes', 'substantial_changes', 'not_delivered']),
  summary: z.string(),
  checkedAt: IsoDateTime,
});
export type Check = z.infer<typeof CheckSchema>;

/* ---------------------------------------------------------------- Feedback on Unite */

/** A screenshot is a data URL of at most 400 KB. */
export const MAX_SCREENSHOT_CHARS = 400 * 1024;

export const FeedbackSchema = z.strictObject({
  id: idOf('fb'),
  token: z.string().min(16),
  personId: idOf('per').optional(),
  path: z.string(),
  mode: z.enum(['guided', 'free', 'changes']),
  messages: z.array(z.strictObject({ role: z.enum(['interviewer', 'person']), text: z.string() })),
  answers: z.array(z.strictObject({ key: z.string(), question: z.string(), answer: z.string() })),
  name: z.string().optional(),
  contact: z.string().optional(),
  screenshot: z
    .string()
    .max(MAX_SCREENSHOT_CHARS)
    .regex(/^data:image\//, 'must be an image data URL')
    .optional(),
  status: z.enum(['draft', 'received', 'planned', 'done', 'declined']),
  statusReason: z.string().optional(),
  publicIssue: z.strictObject({
    state: z.enum(['none', 'previewed', 'agreed', 'withdrawn']),
    text: z.string().optional(),
  }),
  sinceVersion: z.string().optional(),
  createdAt: IsoDateTime,
  submittedAt: IsoDateTime.optional(),
});
export type Feedback = z.infer<typeof FeedbackSchema>;

export const SpendSchema = z.strictObject({
  /** The UTC day, YYYY-MM-DD. */
  id: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  usd: z.number().min(0),
  calls: z.number().int().min(0),
});
export type Spend = z.infer<typeof SpendSchema>;

/**
 * A host intake session (section 6.5). The spec names the collection but not the record, so this
 * holds only what the intake interview needs: the conversation so far, the answers by topic, and
 * the draft pledge it fills.
 */
export const IntakeSchema = z.strictObject({
  id: idOf('ink'),
  messages: z.array(z.strictObject({ role: z.enum(['interviewer', 'person']), text: z.string() })),
  answers: z.array(z.strictObject({ key: z.string(), question: z.string(), answer: z.string() })),
  /** Index into HOST_INTAKE_TOPICS of the topic being asked. */
  topicIndex: z.number().int().min(0),
  followUpAsked: z.boolean(),
  status: z.enum(['active', 'complete']),
  draftPledge: PledgeSchema.partial().optional(),
  assemblyId: idOf('asm').optional(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type Intake = z.infer<typeof IntakeSchema>;

/* ---------------------------------------------------------------- Releases (RELEASES.json) */

export const ReleaseSchema = z.strictObject({
  version: z.string(),
  date: IsoDate,
  changes: z.array(
    z.strictObject({ text: z.string(), affects: z.array(z.string()), question: z.string().optional() }),
  ),
});
export type Release = z.infer<typeof ReleaseSchema>;
export const ReleasesSchema = z.array(ReleaseSchema);
