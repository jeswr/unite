import { Link, useSearchParams } from 'react-router';
import { formatDate, type DecisionStatus } from '@unite/shared';
import { useApi } from '../../lib/api';
import { Card } from '../../ui/Card';
import { EmptyState } from '../../ui/EmptyState';
import { inputClass } from '../../ui/Field';
import { Layout } from '../../ui/Layout';
import { DueLine, StatusTag } from './StatusTag';
import type { RegisterEntry, RegisterResponse } from './types';
import { statusWords, summarySentence } from './words';

const FILTERS = ['assembly', 'host', 'status'] as const;

function Due({ e }: { e: RegisterEntry }) {
  if (e.status === 'awaiting_answer') return <DueLine d={e} />;
  if (e.answer?.kind === 'delayed' && e.answer.delayedUntil) return <span className="text-muted">Delayed until {formatDate(e.answer.delayedUntil)}</span>;
  return <span className="text-muted">Answered {e.answer ? formatDate(e.answer.answeredAt) : ''}</span>;
}

/** /register: every decision in every assembly, with three filters and a summary in words. */
export default function Register() {
  const [params, setParams] = useSearchParams();
  const query = new URLSearchParams();
  for (const f of FILTERS) if (params.get(f)) query.set(f, params.get(f)!);
  const qs = query.toString();
  const { data, error } = useApi<RegisterResponse>(`/api/register${qs ? `?${qs}` : ''}`);

  const setFilter = (key: (typeof FILTERS)[number], value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <Layout title="The register">
      <p className="mb-6">
        Every decision in every assembly, and what happened to it. A decision only counts as delivered when someone other than the host has
        checked it against its numbered tests.
      </p>

      {data && (
        <form className="mb-6 grid gap-3 sm:grid-cols-3" aria-label="Filter the register" onSubmit={(e) => e.preventDefault()}>
          <label className="block">
            <span className="mb-1 block font-bold">Assembly</span>
            <select className={inputClass} value={params.get('assembly') ?? ''} onChange={(e) => setFilter('assembly', e.target.value)}>
              <option value="">All assemblies</option>
              {data.filters.assemblies.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block font-bold">Host</span>
            <select className={inputClass} value={params.get('host') ?? ''} onChange={(e) => setFilter('host', e.target.value)}>
              <option value="">All hosts</option>
              {data.filters.hosts.map((h) => (
                <option key={h.slug} value={h.slug}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block font-bold">Status</span>
            <select className={inputClass} value={params.get('status') ?? ''} onChange={(e) => setFilter('status', e.target.value)}>
              <option value="">Any status</option>
              {data.filters.statuses.map((s: DecisionStatus) => (
                <option key={s} value={s}>
                  {statusWords(s)}
                </option>
              ))}
            </select>
          </label>
        </form>
      )}

      {error && !data && <p>{error.message}</p>}
      {!data && !error && <p aria-live="polite">Loading…</p>}

      {data && (
        <>
          <p className="mb-6 font-bold" aria-live="polite">
            {summarySentence(data.summary)}
          </p>
          {data.entries.length === 0 ? (
            <EmptyState title={qs ? 'No decisions match these filters' : 'No decisions yet'}>
              <p>
                {qs
                  ? 'Try another assembly, host or status, or clear the filters.'
                  : 'When an assembly decides its priorities, each decision appears here with the host’s answer and what happened next.'}
              </p>
              <p className="mt-2">
                <Link to="/assemblies">See the assemblies</Link>
              </p>
            </EmptyState>
          ) : (
            <>
              <table className="hidden w-full border-collapse text-left md:table">
                <caption className="sr-only">Decisions in the register</caption>
                <thead>
                  <tr className="border-b border-ink">
                    <th scope="col" className="py-2 pr-3">
                      Decision
                    </th>
                    <th scope="col" className="py-2 pr-3">
                      Assembly and host
                    </th>
                    <th scope="col" className="py-2 pr-3">
                      Status
                    </th>
                    <th scope="col" className="py-2">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((e) => (
                    <tr key={e.id} className="border-b border-line align-top">
                      <td className="py-3 pr-3">
                        <span className="block text-sm text-muted">Decision {e.number}</span>
                        <Link to={`/a/${e.assembly.slug}/decisions/${e.id}`}>{e.title}</Link>
                      </td>
                      <td className="py-3 pr-3">
                        <span className="block">{e.assembly.title}</span>
                        <Link to={`/hosts/${e.host.slug}`} className="text-sm">
                          {e.host.name}
                        </Link>
                      </td>
                      <td className="py-3 pr-3">
                        <StatusTag status={e.status} />
                      </td>
                      <td className="py-3 text-sm">
                        <Due e={e} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="space-y-3 md:hidden">
                {data.entries.map((e) => (
                  <Card as="li" key={e.id}>
                    <p className="text-sm text-muted">
                      {e.assembly.title} · Decision {e.number}
                    </p>
                    <p className="mb-2 font-bold">
                      <Link to={`/a/${e.assembly.slug}/decisions/${e.id}`}>{e.title}</Link>
                    </p>
                    <p className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <StatusTag status={e.status} />
                      <span className="text-sm">
                        <Due e={e} />
                      </span>
                    </p>
                    <p className="text-sm">
                      Host: <Link to={`/hosts/${e.host.slug}`}>{e.host.name}</Link>
                    </p>
                  </Card>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Layout>
  );
}
