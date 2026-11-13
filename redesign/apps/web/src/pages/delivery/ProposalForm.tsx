import { useState, type FormEvent } from 'react';
import type { Decision } from '@unite/shared';
import { api } from '../../lib/api';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { useAction } from './useAction';

/** "Propose how to build it": a short plan that says how each numbered test will be met. */
export function ProposalForm({ decision, onDone }: { decision: Pick<Decision, 'id' | 'tests'>; onDone: () => void }) {
  const [f, setF] = useState({ proposerName: '', proposerRole: '', summary: '', plan: '', cost: '' });
  const [how, setHow] = useState<Record<number, string>>({});
  const [tried, setTried] = useState(false);
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useAction();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const missing = decision.tests.filter((t) => !how[t.n]?.trim()).map((t) => t.n);
  const required = (['proposerName', 'proposerRole', 'summary', 'plan'] as const).filter((k) => !f[k].trim());
  const need = (k: (typeof required)[number]) => (tried && required.includes(k) ? 'This is needed.' : undefined);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (missing.length || required.length) return;
    const body = {
      proposerName: f.proposerName.trim(),
      proposerRole: f.proposerRole.trim(),
      summary: f.summary.trim(),
      plan: f.plan.trim(),
      ...(f.cost.trim() ? { cost: f.cost.trim() } : {}),
      testCoverage: decision.tests.map((t) => ({ n: t.n, how: how[t.n]!.trim() })),
    };
    if (await run(() => api.post(`/api/decisions/${decision.id}/proposals`, body))) {
      // Empty the form, so the plan just sent is not sent twice.
      setF({ proposerName: '', proposerRole: '', summary: '', plan: '', cost: '' });
      setHow({});
      setTried(false);
      setSent(true);
      onDone();
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      <Field label="Your name" error={need('proposerName')}>
        <input className={inputClass} value={f.proposerName} onChange={set('proposerName')} />
      </Field>
      <Field label="What you do" hint="For example your job, or the group you build things with." error={need('proposerRole')}>
        <input className={inputClass} value={f.proposerRole} onChange={set('proposerRole')} />
      </Field>
      <Field label="Your plan in one or two sentences" error={need('summary')}>
        <textarea className={inputClass} rows={2} value={f.summary} onChange={set('summary')} />
      </Field>
      <Field label="The plan" hint="What would be made or changed, by whom, and in what steps." error={need('plan')}>
        <textarea className={inputClass} rows={5} value={f.plan} onChange={set('plan')} />
      </Field>
      <Field label="What it would cost (optional)">
        <input className={inputClass} value={f.cost} onChange={set('cost')} />
      </Field>
      <h4 className="mb-2 font-bold">How the plan meets each test</h4>
      {decision.tests.map((t) => (
        <Field key={t.n} label={`Test ${t.n}: ${t.text}`} error={tried && missing.includes(t.n) ? 'Say how the plan will meet this test.' : undefined}>
          <textarea className={inputClass} rows={2} value={how[t.n] ?? ''} onChange={(e) => setHow({ ...how, [t.n]: e.target.value })} />
        </Field>
      ))}
      {error && (
        <Banner tone="warn" className="mb-4">
          {error}
        </Banner>
      )}
      {sent && !error && (
        <p role="status" className="mb-4 font-bold text-agree">
          Your proposal is sent. It is listed above for the host to consider.
        </p>
      )}
      <Button type="submit" variant="secondary" disabled={busy}>
        {busy ? 'Sending…' : 'Send the proposal'}
      </Button>
    </form>
  );
}
