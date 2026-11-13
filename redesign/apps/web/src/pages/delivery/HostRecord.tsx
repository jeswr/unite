import { Link, useParams } from 'react-router';
import { stageInfo } from '@unite/shared';
import { useApi } from '../../lib/api';
import { Card } from '../../ui/Card';
import { Layout } from '../../ui/Layout';
import type { HostRecordResponse } from './types';

const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** The host's record in plain sentences, from the counts. In progress is said on its own, never as done. */
export function recordSentences(r: HostRecordResponse['record']): string[] {
  if (r.decisions === 0) return ['No decisions have been put to this host yet.'];
  const out = [`${n(r.decisions, 'decision has', 'decisions have')} been put to this host.`];
  const answered = r.answeredOnTime + r.answeredLate;
  out.push(
    answered === 0
      ? 'None has been answered yet.'
      : `${answered} ${answered === 1 ? 'has' : 'have'} been answered: ${r.answeredOnTime} on time and ${r.answeredLate} late.`,
  );
  if (r.awaitingAnswer > 0)
    out.push(`${n(r.awaitingAnswer, 'is', 'are')} still waiting for an answer${r.awaitingLate > 0 ? `, and ${n(r.awaitingLate, 'is', 'are')} past the date the host promised` : ''}.`);
  return out;
}

function Row({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2">
      <dt>{label}</dt>
      <dd className={`font-bold ${tone ?? ''}`}>{value}</dd>
    </div>
  );
}

/** /hosts/:hostSlug: the host's record in words and simple counts. */
export default function HostRecord() {
  const { hostSlug } = useParams();
  const { data, error } = useApi<HostRecordResponse>(hostSlug ? `/api/hosts/${encodeURIComponent(hostSlug)}` : null);

  if (error && !data)
    return (
      <Layout title={error.status === 404 ? 'There is no host here' : 'This record could not be loaded'}>
        <p>{error.message}</p>
        <p className="mt-2">
          <Link to="/register">Go to the register</Link>
        </p>
      </Layout>
    );
  if (!data)
    return (
      <Layout title="A host’s record">
        <p aria-live="polite">Loading…</p>
      </Layout>
    );

  const r = data.record;
  const example = data.assemblies.some((a) => a.isExample);
  return (
    <Layout title={data.host.name} kicker="A host’s record" assembly={example ? { isExample: true } : null}>
      {data.host.description && <p className="mb-4">{data.host.description}</p>}
      <div className="mb-8 space-y-2">
        {recordSentences(r).map((s) => (
          <p key={s}>{s}</p>
        ))}
      </div>

      <section className="mb-8" aria-labelledby="answers">
        <h2 id="answers" className="mb-2">
          How the host answered
        </h2>
        <dl>
          <Row label="Answered on time" value={r.answeredOnTime} />
          <Row label="Answered late" value={r.answeredLate} tone={r.answeredLate ? 'text-warn' : ''} />
          <Row label="Still waiting, past the date" value={r.awaitingLate} tone={r.awaitingLate ? 'text-warn' : ''} />
          <Row label="Accepted" value={r.accepted} />
          <Row label="Changed" value={r.changed} />
          <Row label="Delayed" value={r.delayed} />
          <Row label="Refused" value={r.refused} />
        </dl>
      </section>

      <section className="mb-8" aria-labelledby="delivered">
        <h2 id="delivered" className="mb-2">
          What was delivered
        </h2>
        <p className="mb-2 text-muted">Only a check by someone other than the host counts here.</p>
        <dl>
          <Row label="Delivered as decided" value={r.deliveredAsDecided} />
          <Row label="Delivered with changes" value={r.deliveredWithChanges} />
          <Row label="Not delivered" value={r.notDelivered} />
        </dl>
        <p className="mt-3">
          <span className="font-bold">In progress: {r.inProgress}.</span> Work has started on these. In progress is not counted as done.
        </p>
      </section>

      <section aria-labelledby="assemblies">
        <h2 id="assemblies" className="mb-2">
          Assemblies
        </h2>
        <ul className="space-y-3">
          {data.assemblies.map((a) => (
            <Card as="li" key={a.slug}>
              <p className="font-bold">
                <Link to={`/a/${a.slug}`}>{a.title}</Link>
              </p>
              <p className="text-muted">
                {stageInfo(a.stage).title} · {n(a.decisions, 'decision', 'decisions')}
              </p>
              {a.decisions > 0 && (
                <p>
                  <Link to={`/register?host=${encodeURIComponent(data.host.slug)}&assembly=${encodeURIComponent(a.slug)}`}>See them in the register</Link>
                </p>
              )}
            </Card>
          ))}
        </ul>
      </section>
    </Layout>
  );
}
