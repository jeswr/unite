import type { StatementDetail } from '@unite/shared';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';

/**
 * "Talk it through" (section 12.1), on a statement the person has answered: what it is and how
 * long it takes, and a way in (or back to their own).
 */
export function TalkCard({ slug, detail }: { slug: string; detail: StatementDetail }) {
  const s = detail.statement;
  const mine = detail.mediation.mine;
  const closed = s.status === 'retired' || s.status === 'decided';
  if (!s.myReaction || (closed && !mine)) return null;
  const label = !mine ? 'Talk it through' : mine.status === 'complete' ? 'See what you added' : 'Carry on talking it through';
  const others = detail.mediation.completed;
  return (
    <Card as="section" className="mb-8">
      <h2 id="talk" className="mb-2">
        Talk it through
      </h2>
      <p className="mb-2">
        A short private conversation with the AI about your answer and the reasons of people who answered differently. It takes about five minutes, and only
        what you approve is added here.
      </p>
      {others > 0 && (
        <p className="mb-3 text-sm text-muted">
          {others === 1 ? '1 person has' : `${others} people have`} talked this statement through.
        </p>
      )}
      <Button variant="secondary" to={`/a/${slug}/statements/${s.id}/talk`}>
        {label}
      </Button>
    </Card>
  );
}
