import { formatDate, levelName, requiredCounted, type Assembly, type Pledge } from '@unite/shared';

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** The decision rule in one plain paragraph. */
export function ruleParagraph(p: Pledge): string {
  const level = levelName(p.decisionLevel);
  const base =
    `Listening carries on until at least ${p.minParticipants} people have had their own conversation. ` +
    `A statement becomes common ground when at least ${pct(p.groupThreshold)} of the people in each opinion group agree with it, ` +
    `with at least ${requiredCounted(p)} people answering. Opinion groups are worked out from how people answered, so nothing can pass on the votes of one side alone.`;
  switch (p.decisionLevel) {
    case 0:
      return `The rule is “${level}”: those affected are asked and the decision is logged. ${base}`;
    case 1:
      return `The rule is “${level}”: a statement passes unless someone raises a reasoned objection in time. ${base}`;
    case 2:
      return `The rule is “${level}”. ${base} Every reasoned objection must have an answer, and the dissent that remains is recorded.`;
    case 3:
      return `The rule is “${level}”. ${base} If a panel drawn by lot cannot reach consent, a ranked vote must beat “no change” two to one.`;
  }
}

export function checkBodyWords(p: Pledge): string {
  return p.checkBody === 'independent'
    ? `${p.checkBodyName ?? 'An independent body named in the pledge'} checks what was delivered against each decision’s numbered tests.`
    : 'A panel of participants, drawn by lot, checks what was delivered against each decision’s numbered tests.';
}

export function replyWords(p: Pledge): string {
  return `The host will answer the top ${p.capacity} ${p.capacity === 1 ? 'priority' : 'priorities'} by ${formatDate(p.replyBy)}.`;
}

/** A pledge the host has not published yet is a draft. */
export function draftNote(a: Pick<Assembly, 'pledge' | 'hostName' | 'stage'>): string | undefined {
  if (!a.pledge || a.pledge.publishedAt) return undefined;
  const host = a.hostName.replace(/^The /, 'the ');
  return `Draft. Not yet confirmed by ${host}.`;
}
