import { z } from 'zod';
import { MEDIATION_LIMITS } from '../mediation.js';
import { countWords } from '../interviewer.js';
import type { Mediation, Statement } from '../schemas.js';

/** Bodies and views of the talk-it-through endpoints (section 12.1). */

const turnText = z.string().trim().min(1, 'cannot be empty').max(MEDIATION_LIMITS.turn, `is at most ${MEDIATION_LIMITS.turn} characters`);

/** POST /api/mediations/:id/turns */
export const MediationTurnBody = z.union([
  z.strictObject({ text: turnText }),
  z.strictObject({ skip: z.literal(true) }),
  z.strictObject({ stop: z.literal(true) }),
]);
export type MediationTurnBody = z.infer<typeof MediationTurnBody>;

/** PATCH /api/mediations/:id/drafts. An empty string scraps the item. */
export const MediationDraftsBody = z.strictObject({
  reason: z.string().trim().max(MEDIATION_LIMITS.reason, `A reason is at most ${MEDIATION_LIMITS.reason} characters`).optional(),
  reasonSide: z.enum(['for', 'against']).optional(),
  wording: z
    .string()
    .trim()
    .max(MEDIATION_LIMITS.wordingChars, `A wording is at most ${MEDIATION_LIMITS.wordingChars} characters`)
    .refine((s) => countWords(s) <= MEDIATION_LIMITS.wordingWords, `A wording is at most ${MEDIATION_LIMITS.wordingWords} words`)
    .optional(),
  question: z.string().trim().max(MEDIATION_LIMITS.question, `A question is at most ${MEDIATION_LIMITS.question} characters`).optional(),
});
export type MediationDraftsBody = z.infer<typeof MediationDraftsBody>;

/** One of the other side's reasons, shown by code as a quotation at step 2. */
export interface MediationQuote {
  id: string;
  side: 'for' | 'against';
  text: string;
}

/** Everything the owner sees of a mediation: GET /api/mediations/:id and the answer to every write. */
export interface MediationView {
  mediation: Mediation;
  statement: { id: string; text: string; status: Statement['status'] };
  assembly: { slug: string; title: string; isExample: boolean };
  /** The quotations shown at step 2, in arrival order. */
  shownReasons: MediationQuote[];
  /** 'distress' when the last mediator turn is the distress message: the page offers to stop. */
  pending: 'distress' | null;
  safety?: 'ok' | 'distress' | 'identifying';
}

/** On GET /api/statements/:id. `completed` is the number of people who have finished one, counted by code. */
export interface StatementMediation {
  mine?: { id: string; status: Mediation['status'] };
  completed: number;
}
