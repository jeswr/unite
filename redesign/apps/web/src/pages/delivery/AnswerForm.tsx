import { useId, useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { useAction } from './useAction';

const MIN_REASONS = 40;

const KINDS = [
  { kind: 'accepted', label: 'Accepted', help: 'You will do what was decided.' },
  { kind: 'changed', label: 'Changed', help: 'You will do it differently. Say what you will do instead, and why.' },
  { kind: 'delayed', label: 'Delayed', help: 'You will answer or start later. Say until when, and why.' },
  { kind: 'refused', label: 'Refused', help: 'You will not do it. Say why, and what you will do instead, if anything.' },
] as const;

type Kind = (typeof KINDS)[number]['kind'];

/** The host's answer to one decision: one of four words, with reasons. It can be given once. */
export function AnswerForm({ decisionId, onDone }: { decisionId: string; onDone: () => void }) {
  const [kind, setKind] = useState<Kind>();
  const [reasons, setReasons] = useState('');
  const [changedTo, setChangedTo] = useState('');
  const [delayedUntil, setDelayedUntil] = useState('');
  const [tried, setTried] = useState(false);
  const { busy, error, run } = useAction();
  const legend = useId();

  const short = reasons.trim().length < MIN_REASONS;
  const problems = {
    kind: !kind ? 'Choose one of the four answers.' : undefined,
    reasons: short ? `Give your reasons in at least ${MIN_REASONS} characters (${reasons.trim().length} so far).` : undefined,
    changedTo: kind === 'changed' && !changedTo.trim() ? 'Say what you will do instead.' : undefined,
    delayedUntil: kind === 'delayed' && !delayedUntil ? 'Choose the date.' : undefined,
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (Object.values(problems).some(Boolean)) return;
    const body = { kind, reasons: reasons.trim(), ...(kind === 'changed' ? { changedTo: changedTo.trim() } : {}), ...(kind === 'delayed' ? { delayedUntil } : {}) };
    const ok = await run(() => api.post(`/api/decisions/${decisionId}/answer`, body));
    if (ok) onDone();
  };

  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      <fieldset className="mb-5" aria-describedby={tried && problems.kind ? `${legend}-err` : undefined}>
        <legend id={legend} className="mb-1 font-bold">
          Your answer
        </legend>
        {tried && problems.kind && (
          <p id={`${legend}-err`} className="mb-2 font-bold text-warn">
            {problems.kind}
          </p>
        )}
        <div className="space-y-2">
          {KINDS.map((k) => (
            <label key={k.kind} className="flex items-start gap-3">
              <input type="radio" name={`${legend}-kind`} value={k.kind} checked={kind === k.kind} onChange={() => setKind(k.kind)} className="mt-1.5 h-5 w-5 shrink-0" />
              <span>
                <span className="font-bold">{k.label}</span>
                <span className="block text-muted">{k.help}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {kind === 'changed' && (
        <Field label="What you will do instead" error={tried ? problems.changedTo : undefined}>
          <textarea className={inputClass} rows={3} value={changedTo} onChange={(e) => setChangedTo(e.target.value)} />
        </Field>
      )}
      {kind === 'delayed' && (
        <Field label="Delayed until" error={tried ? problems.delayedUntil : undefined}>
          <input type="date" className={inputClass} value={delayedUntil} onChange={(e) => setDelayedUntil(e.target.value)} />
        </Field>
      )}
      <Field label="Your reasons" hint="Everyone will read these. Write them so that someone who took part can follow them." error={tried ? problems.reasons : undefined}>
        <textarea className={inputClass} rows={5} value={reasons} onChange={(e) => setReasons(e.target.value)} />
      </Field>
      {error && (
        <Banner tone="warn" className="mb-4">
          {error}
        </Banner>
      )}
      <p className="mb-3 text-muted">An answer can be given once. It goes into the public register straight away.</p>
      <Button type="submit" disabled={busy}>
        {busy ? 'Sending…' : 'Send the answer'}
      </Button>
    </form>
  );
}
