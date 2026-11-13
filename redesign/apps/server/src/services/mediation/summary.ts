import type { Mediation, StatementMediation } from '@unite/shared';

/**
 * The `mediation` field of a statement's detail: the viewer's own mediation, if any, and how many
 * people have finished one, counted by code. Nothing of anyone's turns or drafts (rule 2).
 */
export function mediationSummary(mediations: readonly Pick<Mediation, 'id' | 'personId' | 'status'>[], personId: string | undefined): StatementMediation {
  const completed = new Set(mediations.filter((m) => m.status === 'complete').map((m) => m.personId)).size;
  const mine = personId ? mediations.find((m) => m.personId === personId) : undefined;
  return { ...(mine ? { mine: { id: mine.id, status: mine.status } } : {}), completed };
}
