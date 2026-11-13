import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { formatDate, type BuildProposal, type Decision as DecisionT } from '@unite/shared';
import { api, useApi } from '../../lib/api';
import { useLive } from '../../lib/useLive';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Layout } from '../../ui/Layout';
import { personCount } from '../../ui/PersonCount';
import { Tag } from '../../ui/Tag';
import { AnswerForm } from './AnswerForm';
import { CheckForm } from './CheckForm';
import { AddDeliveryItem, UpdateDeliveryItem } from './DeliveryForms';
import { ProposalForm } from './ProposalForm';
import { DueLine, StatusTag } from './StatusTag';
import type { DecisionRecord } from './types';
import { useAction } from './useAction';
import { ANSWER_KIND_WORDS, CLASSIFICATION_WORDS, ITEM_STATUS_WORDS, KIND_WORDS } from './words';

const ANSWER_TONE = { accepted: 'agree', changed: 'unsure', delayed: 'unsure', refused: 'disagree' } as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-2">{title}</h2>
      {children}
    </section>
  );
}

/** A host or steward control, set apart from the record and labelled for whom it is. */
function Control({ who, title, children, open = false }: { who: string; title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="mt-4 rounded-ui border border-accent bg-accent-soft p-4">
      <summary className="cursor-pointer font-bold text-accent">
        {title} <span className="font-normal text-muted">({who})</span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

/** True when a check can be recorded now: work in progress, or accepted or changed with every item done. */
export function checkable(r: Pick<DecisionRecord, 'decision' | 'deliveryItems' | 'check'>): boolean {
  if (r.check) return false;
  const s = r.decision.status;
  return s === 'in_progress' || ((s === 'accepted' || s === 'changed') && r.deliveryItems.length > 0 && r.deliveryItems.every((i) => i.status === 'done'));
}

const buildable = (d: DecisionT) => (d.answer?.kind === 'accepted' || d.answer?.kind === 'changed') && ['accepted', 'changed', 'in_progress'].includes(d.status);

function ProposalCard({ p, d, role, locked, onDone }: { p: BuildProposal; d: DecisionT; role: string; locked: boolean; onDone: () => void }) {
  const { busy, error, run } = useAction();
  const patch = (body: object) => void run(() => api.patch(`/api/proposals/${p.id}`, body)).then((ok) => ok && onDone());
  return (
    <Card as="li">
      <p className="mb-1 flex flex-wrap gap-2">
        {p.status === 'chosen' && <Tag tone="agree">Chosen plan</Tag>}
        {p.status === 'not_chosen' && <Tag>Not chosen</Tag>}
        {p.faithfulConfirmedAt && <Tag tone="agree">Confirmed faithful to the decision</Tag>}
      </p>
      <h3 className="mb-1">{p.summary}</h3>
      <p className="mb-2 text-muted">
        Proposed by {p.proposerName}, {p.proposerRole}
        {p.cost ? `. Cost: ${p.cost}` : ''}
      </p>
      <details className="mb-2">
        <summary className="cursor-pointer text-accent underline underline-offset-2">The plan</summary>
        <p className="mt-2 whitespace-pre-line">{p.plan}</p>
      </details>
      <h4 className="font-bold">How it meets each test</h4>
      <ol className="mb-2 space-y-1">
        {p.testCoverage.map((c) => (
          <li key={c.n}>
            <span className="font-bold">Test {c.n}.</span> {c.how}
          </li>
        ))}
      </ol>
      {error && <Banner tone="warn">{error}</Banner>}
      {role === 'host' && p.status !== 'chosen' && buildable(d) && !locked && (
        <Button variant="secondary" disabled={busy} onClick={() => patch({ status: 'chosen' })}>
          Choose this plan
        </Button>
      )}
      {role === 'steward' && p.status === 'chosen' && !p.faithfulConfirmedAt && (
        <Button variant="secondary" disabled={busy} onClick={() => patch({ faithful: true })}>
          Confirm it is faithful to the decision
        </Button>
      )}
    </Card>
  );
}

/** /a/:slug/decisions/:id: the decision record as a readable document, with host and steward controls in place. */
export default function Decision() {
  const { slug, id } = useParams();
  const version = useLive(slug);
  const { data: r, error, reload } = useApi<DecisionRecord>(id ? `/api/decisions/${encodeURIComponent(id)}` : null, version);

  if (error && !r)
    return (
      <Layout title={error.status === 404 ? 'There is no decision here' : 'This decision could not be loaded'}>
        <p>{error.message}</p>
      </Layout>
    );
  if (!r)
    return (
      <Layout title="A decision">
        <p aria-live="polite">Loading…</p>
      </Layout>
    );

  const d = r.decision;
  const a = r.assembly;
  const role = r.viewer.role;
  const canCheck = (role === 'steward' || r.viewer.isChecker) && checkable(r);

  return (
    <Layout
      title={d.title}
      assembly={a}
      kicker={
        <>
          Decision {d.number} · <Link to={`/a/${a.slug}/decisions`}>{a.title}</Link>
        </>
      }
    >
      <p className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-1" aria-live="polite">
        <StatusTag status={d.status} />
        <DueLine d={{ ...d, daysLate: r.daysLate }} />
      </p>

      {d.why && (
        <Section title="Why">
          <p className="whitespace-pre-line">{d.why}</p>
        </Section>
      )}
      {d.options.length > 0 && (
        <Section title="The options that were considered">
          <ul className="list-disc space-y-1 pl-6">
            {d.options.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </Section>
      )}
      {d.dissent && (
        <Section title="The disagreement that remains">
          <p className="whitespace-pre-line">{d.dissent}</p>
        </Section>
      )}
      <Section title="Tests for “done”">
        <p className="mb-2 text-muted">Anyone who took part should be able to check each of these.</p>
        <ol className="space-y-2">
          {d.tests.map((t) => (
            <li key={t.n} className="flex gap-3">
              <span className="w-6 shrink-0 font-bold">{t.n}.</span>
              <span>{t.text}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Where this came from">
        {r.statement && (
          <blockquote className="mb-3 border-l-4 border-line pl-4">
            <p>{r.statement.text}</p>
          </blockquote>
        )}
        {r.trail.themes.length > 0 && (
          <p className="mb-1">
            From the {r.trail.themes.length === 1 ? 'theme' : 'themes'} {r.trail.themes.map((t) => `“${t.name}”`).join(' and ')} in the picture.
          </p>
        )}
        <p>From what {personCount(r.trail.people)} said.</p>
      </Section>

      <Section title={`The answer from ${a.hostName}`}>
        {d.answer ? (
          <div>
            <p className="mb-2">
              <Tag tone={ANSWER_TONE[d.answer.kind]}>{ANSWER_KIND_WORDS[d.answer.kind]}</Tag>
              <span className="ml-2 text-muted">on {formatDate(d.answer.answeredAt)}</span>
            </p>
            {d.answer.changedTo && (
              <p className="mb-2">
                <span className="font-bold">What they will do instead: </span>
                {d.answer.changedTo}
              </p>
            )}
            {d.answer.delayedUntil && (
              <p className="mb-2">
                <span className="font-bold">Delayed until </span>
                {formatDate(d.answer.delayedUntil)}
              </p>
            )}
            <h3 className="mb-1">Their reasons</h3>
            <p className="whitespace-pre-line">{d.answer.reasons}</p>
          </div>
        ) : (
          <p>
            {a.hostName} has not answered yet.{' '}
            {r.daysLate > 0 ? <span className="font-bold text-warn">The answer is {r.daysLate === 1 ? '1 day' : `${r.daysLate} days`} late.</span> : `The answer is due by ${formatDate(d.dueDate)}.`}
          </p>
        )}
        {role === 'host' && d.status === 'awaiting_answer' && (
          <Control who="host" title="Answer this decision" open>
            <AnswerForm decisionId={d.id} onDone={reload} />
          </Control>
        )}
      </Section>

      {(buildable(d) || r.proposals.length > 0) && (
        <Section title="How it will be built">
          {r.proposals.length === 0 ? (
            <p className="text-muted">No one has proposed how to build this yet. Practitioners and people who took part can propose a plan that meets every test.</p>
          ) : (
            <ul className="space-y-4">
              {r.proposals.map((p) => (
                <ProposalCard key={p.id} p={p} d={d} role={role} locked={r.proposals.some((x) => x.status === 'chosen' && !!x.faithfulConfirmedAt)} onDone={reload} />
              ))}
            </ul>
          )}
          {buildable(d) && (role === 'host' || r.viewer.heard) && (
            <Control who={role === 'host' ? 'host' : 'people who took part'} title="Propose how to build it">
              <ProposalForm decision={d} onDone={reload} />
            </Control>
          )}
        </Section>
      )}

      {(buildable(d) || r.deliveryItems.length > 0) && (
        <Section title="Delivery">
          {r.deliveryItems.length === 0 ? (
            <p className="text-muted">No delivery work has been added yet. Each piece of work will have a named owner and a date.</p>
          ) : (
            <ul className="space-y-4">
              {r.deliveryItems.map((i) => (
                <Card as="li" key={i.id}>
                  <h3 className="mb-1">{i.title}</h3>
                  <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Tag tone={i.status === 'done' ? 'neutral' : i.status === 'in_progress' ? 'accent' : 'neutral'}>{ITEM_STATUS_WORDS[i.status]}</Tag>
                    <span className="text-muted">
                      {KIND_WORDS[i.kind]} · Owner: {i.owner} · Due by {formatDate(i.dueDate)}
                    </span>
                  </p>
                  {i.link && (
                    <p className="mb-2">
                      <a href={i.link} rel="noreferrer">
                        Where to see it
                      </a>
                    </p>
                  )}
                  {i.updates.length > 0 && (
                    <ol className="space-y-2 border-l-2 border-line pl-4">
                      {i.updates.map((u, k) => (
                        <li key={k}>
                          <span className="block text-sm text-muted">{formatDate(u.at)}</span>
                          {u.text}
                        </li>
                      ))}
                    </ol>
                  )}
                  {role === 'host' && buildable(d) && <UpdateDeliveryItem item={i} onDone={reload} />}
                </Card>
              ))}
            </ul>
          )}
          {r.deliveryItems.some((i) => i.status === 'done') && !r.check && (
            <p className="mt-3 text-muted">“Done” is the host’s word for its own work. Only the check says whether the decision was delivered.</p>
          )}
          {role === 'host' && buildable(d) && (
            <Control who="host" title="Add delivery work">
              <AddDeliveryItem decisionId={d.id} onDone={reload} />
            </Control>
          )}
        </Section>
      )}

      {(r.check || buildable(d)) && (
        <Section title="The check">
          {r.check ? (
            <div>
              <p className="mb-3">
                <Tag tone={r.check.classification === 'not_delivered' ? 'disagree' : r.check.classification === 'substantial_changes' ? 'unsure' : 'agree'}>
                  {CLASSIFICATION_WORDS[r.check.classification]}
                </Tag>
                <span className="ml-2 text-muted">
                  {r.check.checkBody}, {formatDate(r.check.checkedAt)}
                </span>
              </p>
              <ol className="mb-3 space-y-2">
                {r.check.results.map((res) => (
                  <li key={res.n} className="flex gap-3">
                    <span aria-hidden="true" className={`w-6 shrink-0 font-bold ${res.met ? 'text-agree' : 'text-warn'}`}>
                      {res.met ? '✓' : '✗'}
                    </span>
                    <span>
                      <span className="font-bold">
                        Test {res.n}: {res.met ? 'met' : 'not met'}.
                      </span>{' '}
                      {d.tests.find((t) => t.n === res.n)?.text}
                      {res.note && <span className="block text-muted">{res.note}</span>}
                    </span>
                  </li>
                ))}
              </ol>
              <h3 className="mb-1">What the panel said</h3>
              <p className="mb-2 whitespace-pre-line">{r.check.summary}</p>
              <p className="text-muted">On the panel: {r.check.panel.join(', ')}.</p>
            </div>
          ) : (
            <p>Not checked yet. Only {a.checkBody.replace(/^The /, 'the ')} can say whether this was delivered. The host cannot mark its own work done.</p>
          )}
          {canCheck && (
            <Control who={role === 'steward' ? 'steward' : 'check panel'} title="Record the check">
              <CheckForm decision={d} onDone={reload} />
            </Control>
          )}
        </Section>
      )}
    </Layout>
  );
}
