import { useState, type FormEvent } from 'react';
import { formatDate } from '@unite/shared';
import { api, useApi } from '../../lib/api';
import { Button, buttonClass } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { EmptyState } from '../../ui/EmptyState';
import { Field, inputClass } from '../../ui/Field';
import { Tag } from '../../ui/Tag';
import type { FeedbackStatus, StewardFeedbackItem, StewardFeedbackList } from './types';

/**
 * The steward's feedback view, to be placed in the steward page: counts, the answers grouped by
 * question (each linking to its record), a status control that needs a reason the person will
 * see, and export. Headings start at h2, under the steward page's h1.
 */

const STATUS_CHOICES: { value: Exclude<FeedbackStatus, 'draft'>; label: string }[] = [
  { value: 'received', label: 'Received' },
  { value: 'planned', label: 'Planned' },
  { value: 'done', label: 'Done' },
  { value: 'declined', label: 'Declined' },
];

const anchor = (id: string) => `feedback-${id}`;

function StatusControl({ item, onSaved }: { item: StewardFeedbackItem; onSaved: () => void }) {
  const [status, setStatus] = useState<FeedbackStatus>(item.status);
  const [reason, setReason] = useState(item.statusReason ?? '');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return setError('Give a reason. The person who sent this will see it.');
    setSaving(true);
    setError(undefined);
    try {
      await api.patch(`/steward/feedback/${item.id}`, { status, reason: reason.trim() });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={(e) => void save(e)} className="mt-4 border-t border-line pt-4">
      <Field label="Status">
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as FeedbackStatus)}>
          {STATUS_CHOICES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Reason" hint="Required. The person who sent this sees it on their feedback page." error={error}>
        <textarea className={inputClass} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} required />
      </Field>
      <Button type="submit" variant="secondary" disabled={saving}>
        {saving ? 'Saving…' : 'Save the status'}
      </Button>
    </form>
  );
}

export function FeedbackAdmin() {
  const [tick, setTick] = useState(0);
  const { data, error, loading } = useApi<StewardFeedbackList>('/steward/feedback', tick);

  if (error)
    return (
      <section aria-labelledby="fa-heading">
        <h2 id="fa-heading" className="mb-3">
          Feedback on Unite
        </h2>
        <p role="alert">{error.status === 403 ? 'Enter the steward passcode to see feedback.' : error.message}</p>
      </section>
    );
  if (!data)
    return (
      <section aria-labelledby="fa-heading">
        <h2 id="fa-heading" className="mb-3">
          Feedback on Unite
        </h2>
        <p aria-live="polite">{loading ? 'Loading feedback…' : ''}</p>
      </section>
    );

  const { counts, themes, items } = data;
  return (
    <section aria-labelledby="fa-heading">
      <h2 id="fa-heading" className="mb-3">
        Feedback on Unite
      </h2>
      <p className="mb-2">
        {counts.total === 1 ? '1 piece of feedback has been sent.' : `${counts.total} pieces of feedback have been sent.`}{' '}
        {counts.byStatus.draft > 0 && `${counts.byStatus.draft} more ${counts.byStatus.draft === 1 ? 'was' : 'were'} started and not sent.`}
      </p>
      <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1">
        {STATUS_CHOICES.map((s) => (
          <li key={s.value}>
            {s.label}: <span className="font-bold">{counts.byStatus[s.value]}</span>
          </li>
        ))}
      </ul>
      <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-muted">
        <li>Answered questions: {counts.byMode.guided}</li>
        <li>Told us something: {counts.byMode.free}</li>
        <li>About what changed: {counts.byMode.changes}</li>
      </ul>
      <div className="mb-8 flex flex-wrap gap-2">
        <a className={buttonClass('secondary')} href="/api/steward/feedback/export?format=csv" download>
          Download as CSV
        </a>
        <a className={buttonClass('secondary')} href="/api/steward/feedback/export?format=json" download>
          Download as JSON
        </a>
      </div>

      {!items.length ? (
        <EmptyState title="No feedback has been sent yet">
          <p>When someone sends feedback from the “Give feedback” button, their answers appear here, grouped by question.</p>
        </EmptyState>
      ) : (
        <>
          <h3 className="mb-1 text-lg">What people said, by question</h3>
          <p className="mb-4 text-muted">Every answer, in the person’s own words. Each one links to the feedback it came from.</p>
          {themes.map((t) => (
            <div key={t.key} className="mb-6">
              <h4 className="mb-2 font-bold">
                {t.question} <span className="font-normal text-muted">({t.answers.length === 1 ? '1 answer' : `${t.answers.length} answers`})</span>
              </h4>
              <ul className="space-y-2">
                {t.answers.map((a, i) => (
                  <li key={i} className="border-l-2 border-line pl-3">
                    <a href={`#${anchor(a.feedbackId)}`} className="text-ink">
                      {a.answer}
                    </a>
                    {a.question !== t.question && <span className="block text-sm text-muted">Asked: {a.question}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <h3 className="mt-10 mb-4 text-lg">Each piece of feedback</h3>
          <ul className="space-y-6">
            {items.map((item) => (
              <li key={item.id} id={anchor(item.id)} tabIndex={-1}>
                <Card as="article">
                  <h4 className="mb-1 flex flex-wrap items-center gap-2 font-bold">
                    {item.modeLabel} <Tag tone={item.status === 'done' ? 'agree' : item.status === 'received' ? 'neutral' : 'accent'}>{item.statusLabel}</Tag>
                  </h4>
                  <p className="text-sm text-muted">
                    Sent on {formatDate(item.submittedAt ?? item.createdAt)}. From the page {item.path}
                    {item.sinceVersion && `. Changes since version ${item.sinceVersion}`}
                  </p>
                  {item.statusReason && <p className="mt-2">Reason given: {item.statusReason}</p>}
                  {item.answers.length ? (
                    <dl className="mt-3 space-y-2">
                      {item.answers.map((a, i) => (
                        <div key={i}>
                          <dt className="font-bold">{a.question}</dt>
                          <dd className="whitespace-pre-line">{a.answer}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="mt-3 text-muted">Sent with no answers.</p>
                  )}
                  {(item.name || item.contact) && (
                    <p className="mt-3">
                      {item.name && <>From {item.name}. </>}
                      {item.contact && <>Contact: {item.contact}</>}
                    </p>
                  )}
                  {item.screenshot && <img src={item.screenshot} alt="Screenshot sent with this feedback" className="mt-3 max-h-48 max-w-full rounded-ui border border-line" />}
                  {item.publicSummary && (
                    <div className="mt-3">
                      <p className="font-bold">Agreed public summary</p>
                      <blockquote className="rounded-ui border border-line bg-soft px-3 py-2 whitespace-pre-line">{item.publicSummary}</blockquote>
                    </div>
                  )}
                  <StatusControl item={item} onSaved={() => setTick((t) => t + 1)} />
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export default FeedbackAdmin;
