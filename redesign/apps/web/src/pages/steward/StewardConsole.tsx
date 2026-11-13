import { useState } from 'react';
import { Link } from 'react-router';
import { stageInfo, type AssemblySummary } from '@unite/shared';
import { useApi } from '../../lib/api';
import { useAssembly } from '../../lib/useAssembly';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { EmptyState } from '../../ui/EmptyState';
import { Layout } from '../../ui/Layout';
import { PasscodeGate } from '../host/PasscodeGate';
import { FeedbackAdminSlot } from './FeedbackAdminSlot';
import { StewardJobs } from './StewardJobs';

function AssemblyJobs({ slug }: { slug: string }) {
  const { data } = useAssembly(slug);
  if (!data) return <p aria-live="polite">Loading…</p>;
  const a = data.assembly;
  return (
    <section aria-labelledby="jobs-h">
      <p className="mb-1 text-muted">
        {a.hostName || 'Open listening'} · {stageInfo(a.stage).title}
      </p>
      <h2 id="jobs-h" className="mb-2">
        Jobs for {a.title}
      </h2>
      <p className="mb-2">
        <Link to={`/a/${a.slug}`}>Open the public page</Link>
      </p>
      <StewardJobs key={slug} slug={slug} capacity={a.pledge?.capacity ?? 5} />
    </section>
  );
}

/** /steward: passcode gate, then per assembly a simple list of jobs. */
export default function StewardConsole() {
  const [slug, setSlug] = useState<string>();
  const { data } = useApi<{ assemblies: AssemblySummary[] }>('/api/assemblies');
  const all = [...(data?.assemblies ?? [])].sort((x, y) => x.title.localeCompare(y.title, 'en-GB'));
  return (
    <Layout title="For stewards">
      <PasscodeGate role="steward">
        {slug ? (
          <>
            <p className="mb-6">
              <Button variant="quiet" className="!px-0" onClick={() => setSlug(undefined)}>
                Back to all assemblies
              </Button>
            </p>
            <AssemblyJobs slug={slug} />
          </>
        ) : (
          <>
            <p className="mb-4">Stewards keep each assembly faithful to what people said: they confirm the picture, answer reports and objections, write up decisions and record checks.</p>
            <h2 className="mb-3">Assemblies</h2>
            {all.length === 0 ? (
              <EmptyState title="No assemblies yet">
                <p>Assemblies appear here once a host opens one.</p>
              </EmptyState>
            ) : (
              <ul className="space-y-3">
                {all.map((a) => (
                  <Card as="li" key={a.slug}>
                    <p className="font-bold">{a.title}</p>
                    <p className="mb-2 text-muted">
                      {a.hostName || 'Open listening'} · {stageInfo(a.stage).title}
                    </p>
                    <Button variant="secondary" onClick={() => setSlug(a.slug)}>
                      See the jobs<span className="sr-only"> for {a.title}</span>
                    </Button>
                  </Card>
                ))}
              </ul>
            )}
          </>
        )}
        <FeedbackAdminSlot />
      </PasscodeGate>
    </Layout>
  );
}
