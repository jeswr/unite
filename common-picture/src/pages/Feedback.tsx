import { useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PageHead } from '../ui/Layout';

type Mode = 'choose' | 'guided' | 'free';
type Status = 'idle' | 'sending' | 'sent' | 'failed';

interface Q {
  id: string;
  label: string;
  kind: 'choice' | 'text' | 'scale' | 'trust';
  options?: string[];
}

export const GUIDED: Q[] = [
  {
    id: 'role',
    label: 'Which of these is closest to you?',
    kind: 'choice',
    options: [
      'Someone who might take part',
      'Public service or government',
      'An international organisation',
      'Research or a university',
      'A funder',
      'Journalism',
      'Community organising',
      'Something else',
    ],
  },
  { id: 'clearest', label: 'What was clearest?', kind: 'text' },
  { id: 'confusing', label: 'What was most confusing?', kind: 'text' },
  {
    id: 'fiveParts',
    label: 'Does the picture with five parts make sense? (1 = not at all, 5 = completely)',
    kind: 'scale',
  },
  { id: 'trust', label: 'Would you trust it if it were real? Why, or why not?', kind: 'trust', options: ['Yes', 'Perhaps', 'No'] },
  { id: 'missing', label: 'Is anything missing?', kind: 'text' },
];

const WHO_READS =
  'The people building this demonstration can read everything you send, including your name and email if you give them. Nobody else.';

function WhoReads({ id }: { id?: string }) {
  return (
    <aside className="who-reads" id={id} aria-label="Who can read your feedback">
      <strong>Who can read your feedback.</strong> {WHO_READS}
    </aside>
  );
}

export function Feedback() {
  const [params] = useSearchParams();
  const from = params.get('from') || '/';
  const [mode, setMode] = useState<Mode>('choose');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [copied, setCopied] = useState(false);
  const copyRef = useRef<HTMLTextAreaElement>(null);

  const answered = Object.values(answers).some((v) => v.trim());
  const isLast = step === GUIDED.length - 1;

  const plainText = () =>
    mode === 'free'
      ? message
      : GUIDED.filter((q) => answers[q.id] || answers[q.id + 'Why'])
          .map((q) => `${q.label}\n${[answers[q.id], answers[q.id + 'Why']].filter(Boolean).join(' — ')}`)
          .join('\n\n');

  const send = async (partial: boolean) => {
    setStatus('sending');
    const body = {
      kind: mode === 'free' ? 'free' : 'guided',
      partial,
      page: from,
      answers: mode === 'guided' ? answers : undefined,
      message: mode === 'free' ? message : undefined,
      name: name.trim() || undefined,
      email: email.trim() || undefined,
    };
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      setStatus(res.ok ? 'sent' : 'failed');
    } catch {
      setStatus('failed');
    }
  };

  const reset = () => {
    setMode('choose');
    setStep(0);
    setAnswers({});
    setMessage('');
    setStatus('idle');
    setCopied(false);
  };

  const copy = async () => {
    const text = plainText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      copyRef.current?.select();
    }
  };

  if (status === 'sent') {
    return (
      <div className="wrap narrow">
        <section className="section card" role="status" aria-labelledby="thanks">
          <h1 id="thanks">Thank you</h1>
          <p>Your feedback reached the people building this demonstration.</p>
          <div className="btn-row">
            <Link className="btn" to="/picture">
              Back to the picture
            </Link>
            <button type="button" className="btn secondary" onClick={reset}>
              Tell us something else
            </button>
          </div>
        </section>
      </div>
    );
  }

  const contact = (
    <fieldset>
      <legend>About you (optional)</legend>
      <div className="field">
        <label htmlFor="fb-name">Name</label>
        <input id="fb-name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="fb-email">
          Email <span className="hint">Only if you would like a reply.</span>
        </label>
        <input id="fb-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
    </fieldset>
  );

  const failed =
    status === 'failed' ? (
      <div className="notice" role="alert" style={{ marginTop: '1rem' }}>
        <p>
          <strong>Your feedback could not be sent.</strong> Nothing was lost: copy your text and send it another way, or try again
          later.
        </p>
        <div className="btn-row">
          <button type="button" className="btn small" onClick={copy}>
            Copy my text
          </button>
          {copied && <span role="status">Copied.</span>}
        </div>
        <label htmlFor="fb-copy" className="sr-only">
          Your text
        </label>
        <textarea id="fb-copy" ref={copyRef} readOnly value={plainText()} rows={4} style={{ marginTop: '0.6rem' }} />
      </div>
    ) : null;

  return (
    <div className="wrap narrow">
      <PageHead eyebrow="Feedback" title="Give feedback">
        Tell us what made sense, what did not, and what you would need to trust something like this.
      </PageHead>
      <WhoReads />

      {mode === 'choose' && (
        <section className="section grid two" aria-label="Choose how to give feedback">
          <button type="button" className="card entry" style={{ textAlign: 'left', font: 'inherit', cursor: 'pointer' }} onClick={() => setMode('guided')}>
            <span className="entry-title">A few guided questions (about 4 minutes)</span>
            <span className="muted">Six short questions. You can send what you have said at any point.</span>
            <span className="go">Start →</span>
          </button>
          <button type="button" className="card entry" style={{ textAlign: 'left', font: 'inherit', cursor: 'pointer' }} onClick={() => setMode('free')}>
            <span className="entry-title">Just tell us something</span>
            <span className="muted">One box, in your own words.</span>
            <span className="go">Write →</span>
          </button>
        </section>
      )}

      {mode === 'free' && (
        <form
          className="section"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (message.trim()) void send(false);
          }}
        >
          <div className="field">
            <label htmlFor="fb-message">What would you like to tell us?</label>
            <textarea id="fb-message" rows={7} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={8000} />
          </div>
          {contact}
          <div className="submit-area">
            <div className="btn-row">
              <button type="submit" className="btn" disabled={!message.trim() || status === 'sending'}>
                {status === 'sending' ? 'Sending…' : 'Send feedback'}
              </button>
              <button type="button" className="btn quiet" onClick={() => setMode('choose')}>
                Back
              </button>
            </div>
            <WhoReads />
          </div>
          {failed}
        </form>
      )}

      {mode === 'guided' && (
        <form
          className="section"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (isLast) void send(false);
            else setStep(step + 1);
          }}
        >
          <p className="eyebrow">
            Question {step + 1} of {GUIDED.length}
          </p>
          <GuidedQuestion q={GUIDED[step]} answers={answers} setAnswers={setAnswers} />
          {isLast && contact}
          <div className="submit-area">
            <div className="btn-row">
              {step > 0 && (
                <button type="button" className="btn quiet" onClick={() => setStep(step - 1)}>
                  Back
                </button>
              )}
              <button type="submit" className="btn" disabled={status === 'sending' || (isLast && !answered)}>
                {isLast ? (status === 'sending' ? 'Sending…' : 'Send feedback') : 'Next question'}
              </button>
              {!isLast && (
                <button type="button" className="btn secondary" disabled={!answered || status === 'sending'} onClick={() => void send(true)}>
                  Send what I’ve said so far
                </button>
              )}
            </div>
            <WhoReads />
          </div>
          {failed}
        </form>
      )}
    </div>
  );
}

function GuidedQuestion({
  q,
  answers,
  setAnswers,
}: {
  q: Q;
  answers: Record<string, string>;
  setAnswers: (a: Record<string, string>) => void;
}) {
  const set = (k: string, v: string) => setAnswers({ ...answers, [k]: v });
  if (q.kind === 'text') {
    return (
      <div className="field">
        <label htmlFor={`q-${q.id}`} style={{ fontSize: '1.2rem', fontFamily: 'var(--serif)' }}>
          {q.label}
        </label>
        <textarea id={`q-${q.id}`} rows={5} value={answers[q.id] ?? ''} onChange={(e) => set(q.id, e.target.value)} maxLength={4000} />
      </div>
    );
  }
  if (q.kind === 'scale') {
    return (
      <fieldset>
        <legend style={{ fontSize: '1.2rem', fontFamily: 'var(--serif)' }}>{q.label}</legend>
        <div className="scale">
          {['1', '2', '3', '4', '5'].map((v) => (
            <label key={v}>
              <input type="radio" name={q.id} value={v} checked={answers[q.id] === v} onChange={() => set(q.id, v)} />
              {v}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  return (
    <fieldset>
      <legend style={{ fontSize: '1.2rem', fontFamily: 'var(--serif)' }}>{q.label}</legend>
      {q.options!.map((o) => (
        <label key={o} className="choice">
          <input type="radio" name={q.id} value={o} checked={answers[q.id] === o} onChange={() => set(q.id, o)} />
          <span>{o}</span>
        </label>
      ))}
      {q.kind === 'trust' && (
        <div className="field" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
          <label htmlFor={`q-${q.id}-why`}>Why?</label>
          <textarea id={`q-${q.id}-why`} rows={4} value={answers[q.id + 'Why'] ?? ''} onChange={(e) => set(q.id + 'Why', e.target.value)} maxLength={4000} />
        </div>
      )}
    </fieldset>
  );
}
