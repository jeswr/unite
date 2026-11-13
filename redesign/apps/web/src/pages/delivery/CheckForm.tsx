import { useId, useState, type FormEvent } from 'react';
import type { Check, Decision } from '@unite/shared';
import { api } from '../../lib/api';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { useAction } from './useAction';
import { CLASSIFICATION_WORDS } from './words';

type Classification = Check['classification'];

/** Why a classification does not fit the results, or undefined. Mirrors the server's rule. */
export function classificationProblem(c: Classification, met: boolean[]): string | undefined {
  const n = met.filter(Boolean).length;
  if (c === 'as_decided' && n < met.length) return '“Delivered as decided” needs every test to be met.';
  if (c === 'not_delivered' && n === met.length) return 'Every test is marked as met, so it cannot be “not delivered”.';
  if ((c === 'minor_changes' || c === 'substantial_changes') && n === 0) return 'No test is marked as met. Choose “not delivered”.';
  return undefined;
}

/** The check: each numbered test met or not, with a note; a classification; a summary; the panel's names. */
export function CheckForm({ decision, onDone }: { decision: Pick<Decision, 'id' | 'tests'>; onDone: () => void }) {
  const [results, setResults] = useState<Record<number, { met?: boolean; note: string }>>({});
  const [classification, setClassification] = useState<Classification>();
  const [summary, setSummary] = useState('');
  const [panel, setPanel] = useState('');
  const [tried, setTried] = useState(false);
  const { busy, error, run } = useAction();
  const base = useId();

  const unmarked = decision.tests.filter((t) => results[t.n]?.met === undefined).map((t) => t.n);
  const names = panel
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const contradiction = classification && unmarked.length === 0 ? classificationProblem(classification, decision.tests.map((t) => !!results[t.n]?.met)) : undefined;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (unmarked.length || !classification || contradiction || !summary.trim() || names.length === 0) return;
    const body = {
      results: decision.tests.map((t) => ({ n: t.n, met: !!results[t.n]!.met, note: results[t.n]!.note.trim() })),
      classification,
      summary: summary.trim(),
      panel: names,
    };
    if (await run(() => api.post(`/api/decisions/${decision.id}/check`, body))) onDone();
  };

  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      {decision.tests.map((t) => {
        const r = results[t.n] ?? { note: '' };
        const set = (next: Partial<typeof r>) => setResults({ ...results, [t.n]: { ...r, ...next } });
        return (
          <fieldset key={t.n} className="mb-5">
            <legend className="mb-1 font-bold">
              Test {t.n}: {t.text}
            </legend>
            {tried && r.met === undefined && <p className="mb-1 font-bold text-warn">Mark this test met or not met.</p>}
            <div className="mb-2 flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input type="radio" name={`${base}-t${t.n}`} checked={r.met === true} onChange={() => set({ met: true })} className="h-5 w-5" /> Met
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name={`${base}-t${t.n}`} checked={r.met === false} onChange={() => set({ met: false })} className="h-5 w-5" /> Not met
              </label>
            </div>
            <label className="block">
              <span className="sr-only">Note on test {t.n}</span>
              <input className={inputClass} placeholder="What the panel saw" value={r.note} onChange={(e) => set({ note: e.target.value })} />
            </label>
          </fieldset>
        );
      })}
      <Field label="What the panel found" error={tried && !classification ? 'Choose one.' : contradiction}>
        <select className={inputClass} value={classification ?? ''} onChange={(e) => setClassification((e.target.value || undefined) as Classification | undefined)}>
          <option value="">Choose…</option>
          {(Object.keys(CLASSIFICATION_WORDS) as Classification[]).map((c) => (
            <option key={c} value={c}>
              {CLASSIFICATION_WORDS[c]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="The panel’s summary" error={tried && !summary.trim() ? 'This is needed.' : undefined}>
        <textarea className={inputClass} rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </Field>
      <Field label="Who was on the panel" hint="Names, separated by commas." error={tried && names.length === 0 ? 'Name at least one person.' : undefined}>
        <input className={inputClass} value={panel} onChange={(e) => setPanel(e.target.value)} />
      </Field>
      {error && (
        <Banner tone="warn" className="mb-4">
          {error}
        </Banner>
      )}
      <Button type="submit" disabled={busy}>
        Record the check
      </Button>
    </form>
  );
}
