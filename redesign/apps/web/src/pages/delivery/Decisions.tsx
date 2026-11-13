import { Link, useParams } from 'react-router';
import { useApi } from '../../lib/api';
import { useLive } from '../../lib/useLive';
import { Card } from '../../ui/Card';
import { EmptyState } from '../../ui/EmptyState';
import { Layout } from '../../ui/Layout';
import { DueLine, StatusTag } from './StatusTag';
import type { DecisionsResponse } from './types';
import { answerLine } from './words';

/** /a/:slug/decisions: the decision cards in number order. */
export default function Decisions() {
  const { slug } = useParams();
  const version = useLive(slug);
  const { data, error } = useApi<DecisionsResponse>(slug ? `/api/assemblies/${encodeURIComponent(slug)}/decisions` : null, version);

  if (error && !data)
    return (
      <Layout title="Decisions">
        <p>{error.message}</p>
      </Layout>
    );
  if (!data)
    return (
      <Layout title="Decisions">
        <p aria-live="polite">Loading…</p>
      </Layout>
    );

  const a = data.assembly;
  return (
    <Layout title="Decisions" assembly={a} kicker={<Link to={`/a/${a.slug}`}>{a.question}</Link>}>
      <p className="mb-6">
        What this assembly decided, and what {a.hostName} has done about each one. Every decision is also in the{' '}
        <Link to={`/register?assembly=${encodeURIComponent(a.slug)}`}>public register</Link>.
      </p>
      {data.decisions.length === 0 ? (
        <EmptyState title="No decisions yet">
          <p>
            When people have chosen their priorities, the top ones are written up here as decisions, each with numbered tests for “done”. Then the
            host answers each one by the date in the pledge.
          </p>
          <p className="mt-2">
            <Link to={`/a/${a.slug}`}>See where this assembly is</Link>
          </p>
        </EmptyState>
      ) : (
        <ol className="space-y-4" aria-live="polite">
          {data.decisions.map((d) => (
            <Card as="li" key={d.id}>
              <p className="text-sm font-bold text-muted">Decision {d.number}</p>
              <h2 className="mb-2">
                <Link to={`/a/${a.slug}/decisions/${d.id}`} className="text-ink">
                  {d.title}
                </Link>
              </h2>
              <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <StatusTag status={d.status} />
                <DueLine d={d} />
              </p>
              <p>{answerLine(d.answer)}</p>
            </Card>
          ))}
        </ol>
      )}
    </Layout>
  );
}
