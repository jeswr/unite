import type { RulesResponse } from '@unite/shared';
import { useApi } from '../../lib/api';
import { Banner } from '../../ui/Banner';
import { Layout } from '../../ui/Layout';

export default function Rules() {
  const { data, error } = useApi<RulesResponse>('/api/how/rules');
  return (
    <Layout title="The rules">
      <p className="mb-6">These ten rules are what make Unite different. Each one is enforced by the server and has a test.</p>
      {error && <Banner tone="warn">{error.message}</Banner>}
      {data && (
        <>
          <ol className="mb-10 space-y-4">
            {data.rules.map((r) => (
              <li key={r.n}>
                <h2 className="mb-1 text-[1.1rem]">
                  {r.n}. {r.title}
                </h2>
                <p>{r.text}</p>
              </li>
            ))}
          </ol>
          <h2 className="mb-2">How decisions are made</h2>
          <p className="mb-4">Every pledge names one of these levels. Higher stakes need a stronger rule.</p>
          <ul className="space-y-4">
            {data.levels.map((l) => (
              <li key={l.level} className="rounded-ui border border-line p-4">
                <h3 className="mb-1">
                  {l.name}
                  {!l.available && <span className="ml-2 text-sm font-normal text-muted">(not available in this version)</span>}
                </h3>
                <dl className="space-y-1">
                  <div>
                    <dt className="inline font-bold">Used for: </dt>
                    <dd className="inline">{l.usedFor}</dd>
                  </div>
                  <div>
                    <dt className="inline font-bold">Passes when: </dt>
                    <dd className="inline">{l.passesWhen}</dd>
                  </div>
                  <div>
                    <dt className="inline font-bold">If it does not pass: </dt>
                    <dd className="inline">{l.ifNot}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </Layout>
  );
}
