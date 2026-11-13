import { z } from 'zod';
import {
  AboutQuestionSchema,
  AffectedGroupSchema,
  AssemblyScale,
  newId,
  PledgeSchema,
  slugify,
  type Assembly,
  type Invite,
} from '@unite/shared';
import type { Deps } from '../../deps.js';
import { HttpError } from '../../errors.js';
import type { Store } from '../../store/types.js';
import { parseBody } from '../../validate.js';
import { bumpVersion } from '../../version.js';
import { getAssemblyBySlug } from '../assemblies.js';

/**
 * The host console's writes (section 7, Hosts): open an assembly in `proposed`, edit its question,
 * probes, groups and pledge while it is still proposed, and make invitation codes. Publishing the
 * pledge goes through POST /api/assemblies/:slug/stage, where rule 6 is enforced by the checklist.
 */

/** The pledge as a host writes it: the publication dates are set when it is published. */
export const PledgeInput = PledgeSchema.omit({ publishedAt: true, challengeEndsAt: true });

const text = (max: number) => z.string().trim().max(max);
const editable = {
  title: text(200).min(1, 'must not be empty'),
  question: text(500).min(1, 'must not be empty'),
  summary: text(2000),
  hostDescription: text(2000),
  probes: z.array(text(300).min(1)).max(3, 'can be at most 3'),
  aboutQuestions: z.array(AboutQuestionSchema).max(10),
  affectedGroups: z.array(AffectedGroupSchema).max(20),
  pledge: PledgeInput.nullable(),
};

export const CreateAssemblyBody = z.strictObject({
  question: editable.question,
  hostName: text(200).min(1, 'must name the host'),
  title: editable.title.optional(),
  summary: editable.summary.optional(),
  hostDescription: editable.hostDescription.optional(),
  kind: z.enum(['advisory', 'codecided', 'community', 'technology']).default('advisory'),
  scale: AssemblyScale.default('local'),
  probes: editable.probes.optional(),
  aboutQuestions: editable.aboutQuestions.optional(),
  affectedGroups: editable.affectedGroups.optional(),
  pledge: editable.pledge.optional(),
  intakeId: z.string().optional(),
  fromThemeId: z.string().optional(),
});

export const PatchAssemblyBody = z
  .strictObject({
    title: editable.title.optional(),
    question: editable.question.optional(),
    summary: editable.summary.optional(),
    hostDescription: editable.hostDescription.optional(),
    probes: editable.probes.optional(),
    aboutQuestions: editable.aboutQuestions.optional(),
    affectedGroups: editable.affectedGroups.optional(),
    pledge: editable.pledge.optional(),
  })
  .refine((b) => Object.keys(b).length > 0, 'must change something');

/** Each affected group is counted from people's answers, so it must match an option of an about question. */
function checkGroups(groups: Assembly['affectedGroups'], about: Assembly['aboutQuestions']) {
  const unknown = groups.filter((g) => !about.some((q) => q.key === g.aboutKey && q.options.includes(g.aboutValue)));
  if (unknown.length)
    throw new HttpError(400, 'group_without_question', `Each affected group must match an answer to one of the questions about people. Not matched: ${unknown.map((g) => g.label).join(', ')}.`);
}

async function freeSlug(store: Store, base: string): Promise<string> {
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    if ((await store.count('assemblies', { slug })) === 0) return slug;
  }
}

/** POST /api/host/assemblies: a new assembly in `proposed`. */
export async function createAssembly(deps: Pick<Deps, 'store' | 'clock'>, raw: unknown): Promise<Assembly> {
  const body = parseBody(CreateAssemblyBody, raw);
  const { store, clock } = deps;
  if (body.fromThemeId && !(await store.get('themes', body.fromThemeId)))
    throw new HttpError(400, 'unknown_theme', 'The theme this assembly is meant to answer could not be found.');
  const intake = body.intakeId ? await store.get('intakes', body.intakeId) : undefined;
  if (body.intakeId && !intake) throw new HttpError(400, 'unknown_intake', 'That intake interview could not be found.');
  checkGroups(body.affectedGroups ?? [], body.aboutQuestions ?? []);
  const title = body.title ?? body.question;
  const now = clock.iso();
  const assembly = await store.transaction(async (tx) => {
    const saved = await tx.put('assemblies', {
      id: newId('asm'),
      slug: await freeSlug(tx, slugify(title)),
      title,
      question: body.question,
      summary: body.summary ?? '',
      kind: body.kind,
      scale: body.scale,
      hostName: body.hostName,
      hostSlug: slugify(body.hostName),
      hostDescription: body.hostDescription ?? '',
      stage: 'proposed',
      isExample: false,
      isOpenListening: false,
      probes: body.probes ?? [],
      aboutQuestions: body.aboutQuestions ?? [],
      affectedGroups: body.affectedGroups ?? [],
      pledge: body.pledge ?? null,
      ...(body.fromThemeId ? { fromThemeId: body.fromThemeId } : {}),
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
    if (intake) await tx.put('intakes', { ...intake, assemblyId: saved.id, updatedAt: now });
    return saved;
  });
  return assembly;
}

/** PATCH /api/host/assemblies/:slug: only while the assembly is still proposed. */
export async function patchAssembly(deps: Pick<Deps, 'store' | 'clock'>, slug: string, raw: unknown): Promise<Assembly> {
  const body = parseBody(PatchAssemblyBody, raw);
  const a = await getAssemblyBySlug(deps.store, slug);
  if (a.stage !== 'proposed')
    throw new HttpError(409, 'already_published', 'The pledge has been published, so the question and the pledge can no longer be changed here.');
  checkGroups(body.affectedGroups ?? a.affectedGroups, body.aboutQuestions ?? a.aboutQuestions);
  const saved = await deps.store.put('assemblies', { ...a, ...body, updatedAt: deps.clock.iso() });
  await bumpVersion(deps, a.id);
  return (await deps.store.get('assemblies', saved.id))!;
}

export const InviteBody = z.strictObject({ label: text(120).default('') });

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** An invitation code people can read aloud: eight characters with no 0, O, 1 or I. */
export function inviteCode(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/** POST /api/host/assemblies/:slug/invites */
export async function createInvite(deps: Pick<Deps, 'store' | 'clock'>, slug: string, raw: unknown): Promise<Invite> {
  const { label } = parseBody(InviteBody, raw);
  const a = await getAssemblyBySlug(deps.store, slug);
  const invite = await deps.store.put('invites', { id: newId('inv'), assemblyId: a.id, code: inviteCode(), label, createdAt: deps.clock.iso(), uses: 0 });
  await bumpVersion(deps, a.id);
  return invite;
}

/** GET /api/host/assemblies/:slug/invites (host): the codes made so far, oldest first. */
export async function listInvites(store: Store, slug: string): Promise<Invite[]> {
  const a = await getAssemblyBySlug(store, slug);
  return store.list('invites', { assemblyId: a.id });
}
