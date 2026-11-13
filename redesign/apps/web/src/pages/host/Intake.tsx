import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { IntakeDraft, IntakeView } from '@unite/shared';
import { api } from '../../lib/api';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { inputClass } from '../../ui/Field';
import { useAction } from '../delivery/useAction';

/** "Open a new assembly": a short conversation of seven questions that fills a draft pledge. */
export function Intake({ onDone, onSkip }: { onDone: (draft: IntakeDraft, intakeId: string) => void; onSkip: () => void }) {
  const [view, setView] = useState<IntakeView>();
  const [text, setText] = useState('');
  const { busy, error, run } = useAction();
  const started = useRef(false);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run(() => api.post<IntakeView>('/api/host/intake')).then((v) => v && setView(v));
  }, [run]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!view || !text.trim()) return;
    const v = await run(() => api.post<IntakeView>(`/api/host/intake/${view.intake.id}/turns`, { text: text.trim() }));
    if (!v) return;
    setText('');
    setView(v);
    if (v.done && v.draft) onDone(v.draft, v.intake.id);
    else box.current?.focus();
  };

  return (
    <section aria-labelledby="intake-h">
      <h2 id="intake-h" className="mb-2">
        Seven questions before the pledge
      </h2>
      <p className="mb-4 text-muted">
        Your answers fill a draft pledge in your own words. You can change everything in the next step.
        {view && !view.done && ` Question ${view.topic.n} of ${view.topic.of}.`}
      </p>
      <ol className="mb-4 space-y-3" aria-live="polite">
        {view?.intake.messages.map((m, i) => (
          <li key={i} className={m.role === 'interviewer' ? 'rounded-ui bg-soft px-4 py-3' : 'ml-6 rounded-ui border border-line px-4 py-3'}>
            <span className="sr-only">{m.role === 'interviewer' ? 'Question: ' : 'You said: '}</span>
            {m.text}
          </li>
        ))}
      </ol>
      {error && (
        <Banner tone="warn" className="mb-4">
          {error}
        </Banner>
      )}
      {view && !view.done && (
        <form onSubmit={(e) => void send(e)}>
          <label htmlFor="intake-answer" className="mb-1 block font-bold">
            Your answer
          </label>
          <textarea id="intake-answer" ref={box} className={`${inputClass} mb-3`} rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={busy || !text.trim()}>
              {busy ? 'Sending…' : 'Send'}
            </Button>
            <Button variant="quiet" onClick={onSkip}>
              Skip to the pledge form
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
