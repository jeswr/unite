import type { DecisionStatus } from '@unite/shared';
import { Tag } from '../../ui/Tag';
import type { DecisionCard } from '@unite/shared';
import { dueLine, STATUS_TONE, statusWords } from './words';

/** The status in words, in its meaning colour. */
export function StatusTag({ status }: { status: DecisionStatus }) {
  return <Tag tone={STATUS_TONE[status]}>{statusWords(status)}</Tag>;
}

/** "Answer due by …", or "12 days late" in the warning colour. Nothing once answered. */
export function DueLine({ d, className = '' }: { d: Pick<DecisionCard, 'status' | 'dueDate' | 'daysLate'>; className?: string }) {
  const due = dueLine(d);
  if (!due) return null;
  return <span className={`${due.late ? 'font-bold text-warn' : 'text-muted'} ${className}`}>{due.text}</span>;
}
