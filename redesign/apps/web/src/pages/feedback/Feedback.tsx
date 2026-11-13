import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Layout } from '../../ui/Layout';
import { AnswersPanel } from './AnswersPanel';
import { FeedbackChat } from './FeedbackChat';
import { AboutYou, PrivateLink, PublicSummary, Screenshot } from './FeedbackExtras';
import type { FeedbackMode, FeedbackView, FeedbackStartResponse as StartResponse, FeedbackTurnResponse as TurnResponse } from '@unite/shared';

/** The three ways in, in the words the person sees. */
export const WAYS_IN: { mode: FeedbackMode; label: string; detail: string }[] = [
  { mode: 'guided', label: 'Answer a few questions, about eight minutes', detail: 'Ten short questions about what you did and how it went. Skip any you like.' },
  { mode: 'free', label: 'Just tell us something', detail: 'Something that went wrong, something confusing, an idea. As long or short as you like.' },
  { mode: 'changes', label: 'See what has changed and tell us what you think', detail: 'We list what is new and ask about it.' },
];

const TITLES: Record<FeedbackMode, string> = {
  guided: 'A few questions about Unite',
  free: 'Tell us something',
  changes: 'What has changed',
};

const MODES = new Set<string>(['guided', 'free', 'changes']);
const VERSION = /^\d+\.\d+\.\d+$/;

/** Only a path inside Unite is shown as what the feedback is about. */
function aboutPath(from: string | null): string | undefined {
  return from && from.startsWith('/') && !from.startsWith('//') ? from.slice(0, 500) : undefined;
}

export default function Feedback() {
  const [params] = useSearchParams();
  const from = aboutPath(params.get('from'));
  const [view, setView] = useState<FeedbackView>();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [turnError, setTurnError] = useState<string>();
  const [submitError, setSubmitError] = useState<string>();
  const autoStarted = useRef(false);

  const start = useCallback(
    async (mode: FeedbackMode, sinceVersion?: string) => {
      setStarting(true);
      setStartError(undefined);
      try {
        const r = await api.post<StartResponse>('/feedback', { path: from ?? '/', mode, ...(sinceVersion ? { sinceVersion } : {}) });
        setView(r.feedback);
      } catch (e) {
        setStartError((e as Error).message);
      } finally {
        setStarting(false);
      }
    },
    [from],
  );

  // /changes links here with ?mode=changes&since=…: start straight away.
  useEffect(() => {
    const mode = params.get('mode');
    if (autoStarted.current || !mode || !MODES.has(mode)) return;
    autoStarted.current = true;
    const since = params.get('since');
    void start(mode as FeedbackMode, since && VERSION.test(since) ? since : undefined);
  }, [params, start]);

  const send = async (text: string) => {
    if (!view) return;
    const before = view;
    setTurnError(undefined);
    setPending(true);
    setView({ ...view, messages: [...view.messages, { role: 'person', text }] });
    try {
      const r = await api.post<TurnResponse>(`/feedback/${view.token}/turns`, { text });
      setView(r.feedback);
    } catch (e) {
      setView(before);
      setTurnError(`${(e as Error).message} What you wrote was not sent.`);
    } finally {
      setPending(false);
    }
  };

  const patch = async (body: Record<string, unknown>) => {
    if (!view) return;
    const r = await api.patch<{ feedback: FeedbackView }>(`/feedback/${view.token}`, body);
    setView(r.feedback);
  };

  const submit = async () => {
    if (!view) return;
    setSubmitError(undefined);
    try {
      const r = await api.post<{ feedback: FeedbackView }>(`/feedback/${view.token}/submit`);
      setView(r.feedback);
    } catch (e) {
      setSubmitError((e as Error).message);
    }
  };

  const about = from && (
    <p className="mb-4 text-muted">
      About: <span className="font-bold text-ink">{from}</span>
    </p>
  );

  if (!view)
    return (
      <Layout title="Give feedback">
        {about}
        <p className="mb-6">Tell us what works and what does not. You do not need to sign in. Type, or speak if your browser lets you.</p>
        {startError && (
          <Banner tone="warn" className="mb-5">
            {startError}
          </Banner>
        )}
        {starting && autoStarted.current ? (
          <p aria-live="polite">Getting the list of changes…</p>
        ) : (
          <ul className="mb-8 space-y-4">
            {WAYS_IN.map((w) => (
              <li key={w.mode}>
                <Button variant="secondary" className="w-full !justify-start !text-left" onClick={() => void start(w.mode)} disabled={starting}>
                  {w.label}
                </Button>
                <p className="mt-1 text-muted">{w.detail}</p>
              </li>
            ))}
          </ul>
        )}
        <p>
          <Link to="/changes">Read what has changed in each release</Link>
        </p>
      </Layout>
    );

  const sent = view.status !== 'draft';

  return (
    <Layout title={TITLES[view.mode]}>
      {about}
      <div className="lg:relative lg:left-1/2 lg:grid lg:w-[min(60rem,calc(100vw-2rem))] lg:-translate-x-1/2 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-8">
        <FeedbackChat feedback={view} pending={pending} error={turnError} onSend={(t) => void send(t)} />
        <aside className="mt-10 lg:mt-0" aria-label="Your answers">
          <div className="rounded-ui border border-line p-4 lg:sticky lg:top-4">
            <AnswersPanel answers={view.answers} onSave={(index, answer) => patch({ answers: [{ index, answer }] })} />
            <div className="mt-5 border-t border-line pt-4">
              {sent ? (
                <Banner>
                  Thank you. We have received your feedback. <Link to={`/feedback/${view.token}`}>See your feedback</Link>.
                </Banner>
              ) : (
                <>
                  <Button variant={view.done ? 'primary' : 'secondary'} className="w-full" onClick={() => void submit()}>
                    Submit what I have said so far
                  </Button>
                  <p className="mt-2 text-sm text-muted">You can send it at any point. Half a conversation is still useful.</p>
                </>
              )}
              {submitError && (
                <p role="alert" className="mt-2 font-bold text-warn">
                  {submitError}
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>

      <div className="mt-12 border-t border-line pt-8">
        <AboutYou feedback={view} onPatch={patch} />
        <Screenshot feedback={view} onPatch={patch} />
        <PublicSummary feedback={view} onPatch={patch} />
        <PrivateLink token={view.token} />
      </div>
    </Layout>
  );
}
