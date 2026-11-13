import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router';
import { formatDate } from '@unite/shared';
import { api, ApiError, useApi } from '../../lib/api';
import { useAssembly } from '../../lib/useAssembly';
import { useLive } from '../../lib/useLive';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Layout } from '../../ui/Layout';
import { NotHeardOrError } from '../rooms/parts';
import type { PrioritiesResponse } from './types';

export const MAX_CHOICES = 3;

/** "The host has pledged to answer the top 5 by 18 December 2026". */
export function capacityLine(capacity: number | null, replyBy: string | null): string | null {
  if (!capacity) return null;
  return `The host has pledged to answer the top ${capacity}${replyBy ? ` by ${formatDate(replyBy)}` : ''}`;
}

export default function Priorities() {
  const { slug = '' } = useParams();
  const version = useLive(slug);
  const { data: view } = useAssembly(slug, version);
  const { data, error, reload } = useApi<PrioritiesResponse>(`/api/assemblies/${encodeURIComponent(slug)}/priorities`, version);
  const a = view?.assembly;
  const [picked, setPicked] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string>();
  const [err, setErr] = useState<string>();

  // My saved choices fill the boxes once; live refreshes never undo what I am in the middle of choosing.
  useEffect(() => {
    if (data && picked === null) setPicked(data.myChoices);
  }, [data, picked]);

  const shown = data;

  if (error && !data)
    return (
      <Layout title="Which three matter most to you?" assembly={a} kicker={a?.question}>
        <NotHeardOrError error={error} slug={slug} what="Choosing priorities" />
      </Layout>
    );
  if (!shown)
    return (
      <Layout title="Which three matter most to you?" assembly={a} kicker={a?.question}>
        <p aria-live="polite">Loading…</p>
      </Layout>
    );

  const chosen = picked ?? shown.myChoices;
  const full = chosen.length >= MAX_CHOICES;
  const toggle = (id: string) => {
    setSaved(undefined);
    setPicked(chosen.includes(id) ? chosen.filter((x) => x !== id) : full ? chosen : [...chosen, id]);
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(undefined);
    try {
      const r = await api.put<PrioritiesResponse>(`/api/assemblies/${encodeURIComponent(slug)}/priorities`, { statementIds: chosen });
      reload();
      setPicked(r.myChoices);
      setSaved(r.myChoices.length ? 'Your choices are saved. You can change them until the list closes.' : 'Your choices are cleared.');
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'That did not work. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const top = shown.ranked.length ? Math.max(...shown.ranked.map((r) => r.score)) : 0;
  const capLine = capacityLine(shown.capacity, shown.replyBy);
  const statements = shown.statements;

  return (
    <Layout title="Which three matter most to you?" assembly={a} kicker={a?.question}>
      {shown.statements.length === 0 ? (
        <EmptyState title="Nothing to choose from yet">
          <p>When a statement reaches common ground, it will appear here and you can choose the three that matter most to you.</p>
        </EmptyState>
      ) : shown.closed ? (
        <Banner className="mb-8">The list has closed. The top priorities have gone to the host for an answer.</Banner>
      ) : (
        <form onSubmit={(e) => void save(e)} className="mb-10">
          <fieldset>
            <legend className="mb-3">These statements reached common ground. Choose up to three.</legend>
            <ul className="mb-3 space-y-2">
              {statements.map((s) => {
                const on = chosen.includes(s.id);
                return (
                  <li key={s.id}>
                    <label className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-ui border p-3 ${on ? 'border-accent bg-accent-soft' : 'border-line'}`}>
                      <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={on} disabled={!on && full} onChange={() => toggle(s.id)} />
                      <span>{s.text}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
          <p aria-live="polite" className="mb-3 font-bold">
            {chosen.length} of {MAX_CHOICES} chosen{full ? '. To choose another, untick one first.' : ''}
          </p>
          {!shown.myChoicesCount && (
            <p className="mb-3 text-muted">You joined without an invitation, so your choices are saved but not counted in the list below.</p>
          )}
          {err && <Banner tone="warn" className="mb-3">{err}</Banner>}
          {saved && (
            <p role="status" className="mb-3 text-agree">
              {saved}
            </p>
          )}
          <Button type="submit" disabled={saving}>
            Save my choices
          </Button>
        </form>
      )}

      {shown.statements.length > 0 && (
        <section aria-labelledby="ranked">
          <h2 id="ranked" className="mb-2">
            The list so far
          </h2>
          <p className="mb-2">
            Once a large group’s first choice is placed, the other choices of the people who picked it count for less. That way smaller groups’ priorities reach the top too, not only the
            largest group’s.
          </p>
          <p className="mb-4 font-bold">
            {shown.chosen} of {shown.invited} invited {shown.invited === 1 ? 'person has' : 'people have'} chosen.
            {shown.uninvitedChosen > 0 && (
              <span className="font-normal text-muted">
                {' '}
                {shown.uninvitedChosen} more {shown.uninvitedChosen === 1 ? 'person' : 'people'} without an invitation chose too; they are not counted.
              </span>
            )}
          </p>
          <ol className="space-y-3" aria-live="polite">
            {shown.ranked.map((r, i) => (
              <li key={r.statementId}>
                <div className="flex gap-3">
                  <span className="w-6 shrink-0 text-right font-bold">{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <p>{r.text}</p>
                    <div className="mt-1 h-2 w-full rounded-ui bg-soft" aria-hidden="true">
                      <div className="h-2 rounded-ui bg-accent" style={{ width: `${top > 0 ? Math.max(2, Math.round((r.score / top) * 100)) : 0}%` }} />
                    </div>
                    {r.score === 0 && <p className="text-sm text-muted">Nobody has chosen this yet.</p>}
                  </div>
                </div>
                {capLine && i + 1 === shown.capacity && i + 1 < shown.ranked.length && (
                  <p className="mt-3 border-t-2 border-dashed border-ink pt-2 text-sm font-bold" data-testid="capacity-line">
                    {capLine}. Those above this line go to the host.
                  </p>
                )}
              </li>
            ))}
          </ol>
          {capLine && shown.ranked.length <= (shown.capacity ?? 0) && <p className="mt-4 text-sm font-bold">{capLine}.</p>}
        </section>
      )}
    </Layout>
  );
}
