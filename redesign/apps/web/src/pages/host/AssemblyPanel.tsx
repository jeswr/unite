import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { formatDate, stageInfo, type Invite } from '@unite/shared';
import { api, useApi } from '../../lib/api';
import { useAssembly } from '../../lib/useAssembly';
import { useLive } from '../../lib/useLive';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Field, inputClass } from '../../ui/Field';
import { StageTracker } from '../../ui/StageTracker';
import { AnswerForm } from '../delivery/AnswerForm';
import { DueLine } from '../delivery/StatusTag';
import type { DecisionsResponse } from '@unite/shared';
import { useAction } from '../delivery/useAction';
import { PledgeEditor, valuesFromAssembly } from './PledgeEditor';

function Invitations({ slug }: { slug: string }) {
  const { data, reload } = useApi<{ invites: Invite[] }>(`/api/host/assemblies/${slug}/invites`);
  const [label, setLabel] = useState('');
  const { busy, error, run } = useAction();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const make = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(() => api.post(`/api/host/assemblies/${slug}/invites`, { label: label.trim() }))) {
      setLabel('');
      reload();
    }
  };

  return (
    <section className="mb-8" aria-labelledby={`inv-${slug}`}>
      <h3 id={`inv-${slug}`} className="mb-2">
        Invitations
      </h3>
      <p className="mb-3 text-muted">People who join with an invitation code count toward decisions. Make one code for each group you invite, so you can see who came.</p>
      {data && data.invites.length > 0 && (
        <ul className="mb-4 space-y-2">
          {data.invites.map((i) => (
            <li key={i.id} className="rounded-ui border border-line p-3">
              <span className="block font-bold">{i.label || 'Invitation'}</span>
              <span className="block">
                Code: <code className="font-bold">{i.code}</code> · used {i.uses === 1 ? 'once' : `${i.uses} times`}
              </span>
              <span className="block break-all text-sm text-muted">
                {origin}/a/{slug}?invite={i.code}
              </span>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={(e) => void make(e)} className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-56">
          <Field label="Who this invitation is for" hint="For example: night-shift workers at the depot.">
            <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>
        </div>
        <div className="mb-5">
          <Button type="submit" variant="secondary" disabled={busy}>
            Make an invitation
          </Button>
        </div>
      </form>
      {error && <Banner tone="warn">{error}</Banner>}
    </section>
  );
}

function Awaiting({ slug, version }: { slug: string; version?: number }) {
  const { data, reload } = useApi<DecisionsResponse>(`/api/assemblies/${slug}/decisions`, version);
  const waiting = data?.decisions.filter((d) => d.status === 'awaiting_answer') ?? [];
  if (!data || data.decisions.length === 0) return null;
  return (
    <section className="mb-8" aria-labelledby={`await-${slug}`}>
      <h3 id={`await-${slug}`} className="mb-2">
        Decisions waiting for your answer
      </h3>
      {waiting.length === 0 ? (
        <p>
          Every decision has an answer. <Link to={`/a/${slug}/decisions`}>See the decisions</Link> to add plans and delivery work.
        </p>
      ) : (
        <ul className="space-y-4">
          {waiting.map((d) => (
            <Card as="li" key={d.id}>
              <p className="text-sm font-bold text-muted">Decision {d.number}</p>
              <p className="mb-1 font-bold">
                <Link to={`/a/${slug}/decisions/${d.id}`}>{d.title}</Link>
              </p>
              <p className="mb-3">
                <DueLine d={d} />
              </p>
              <details>
                <summary className="cursor-pointer font-bold text-accent">Answer this decision</summary>
                <div className="mt-3">
                  <AnswerForm decisionId={d.id} onDone={reload} />
                </div>
              </details>
            </Card>
          ))}
        </ul>
      )}
    </section>
  );
}

/** One assembly in the host console: the stage checklist with "Move on", invitations, and decisions to answer. */
export function AssemblyPanel({ slug }: { slug: string }) {
  const version = useLive(slug);
  const { data: view, reload } = useAssembly(slug, version);
  const { busy, error, details, run } = useAction();
  const [moved, setMoved] = useState<string>();

  if (!view) return <p aria-live="polite">Loading…</p>;
  const a = view.assembly;
  const unmet = (details as { unmet?: { key: string; text: string }[] } | undefined)?.unmet;

  const moveOn = async () => {
    setMoved(undefined);
    const res = await run(() => api.post<{ assembly: typeof a }>(`/api/assemblies/${slug}/stage`));
    if (res) {
      setMoved(`Moved on. This assembly is now at the stage “${stageInfo(res.assembly.stage).title}”.`);
      reload();
    }
  };

  return (
    <div>
      <p className="mb-4">
        <Link to={`/a/${slug}`}>Open the public page</Link>
        {a.pledge?.challengeEndsAt && a.stage === 'pledged' && ` · The challenge period ends on ${formatDate(a.pledge.challengeEndsAt)}.`}
      </p>

      {a.stage === 'proposed' ? (
        <PledgeEditor key={a.id} initial={valuesFromAssembly(a)} assembly={a} onSaved={reload} onPublished={reload} />
      ) : (
        <>
          <section className="mb-8" aria-labelledby={`stage-${slug}`}>
            <h3 id={`stage-${slug}`} className="mb-2">
              Where it is
            </h3>
            <StageTracker stage={a.stage} checklist={view.checklist} />
            {view.checklist.next && (
              <div className="mt-3" aria-live="polite">
                {error && (
                  <Banner tone="warn" className="mb-3">
                    <p>{unmet && unmet.length > 0 ? 'This assembly cannot move on yet. Still needed:' : error}</p>
                    {unmet && (
                      <ul className="mt-2 list-disc pl-6">
                        {unmet.map((i) => (
                          <li key={i.key}>{i.text}</li>
                        ))}
                      </ul>
                    )}
                  </Banner>
                )}
                {moved && <Banner className="mb-3">{moved}</Banner>}
                <Button onClick={() => void moveOn()} disabled={busy}>
                  Move on
                </Button>
              </div>
            )}
          </section>
          <Awaiting slug={slug} version={version} />
          <Invitations slug={slug} />
        </>
      )}
    </div>
  );
}
