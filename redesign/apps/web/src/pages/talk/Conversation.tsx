import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { INTERVIEW_STAGES, SCRIPTED_MODE_LABEL, type Turn } from '@unite/shared';
import { api, ApiError } from '../../lib/api';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Field, inputClass } from '../../ui/Field';
import { Layout } from '../../ui/Layout';
import { MicButton } from './MicButton';
import { StageSteps } from './StageSteps';
import type { ConversationView } from '@unite/shared';

type TurnBody = { text: string } | { skip: true } | { stop: true } | { resume: true } | { answers: string[] };

/** The small actions under the message box: link-like, still 44px tall to tap. */
const COMPACT = 'inline-flex min-h-11 items-center px-2 text-sm font-bold text-accent underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

const errorText = (e: unknown) => (e instanceof ApiError ? e.message : 'That did not go through. Please try again.');

/** /talk/:id: the conversation, on whichever route the person chose. */
export default function Conversation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [view, setView] = useState<ConversationView>();
  const [loadError, setLoadError] = useState<ApiError>();

  useEffect(() => {
    let live = true;
    api
      .get<ConversationView>(`/api/conversations/${id}`)
      .then((v) => live && setView(v))
      .catch((e: unknown) => live && setLoadError(e instanceof ApiError ? e : new ApiError(0, 'error', errorText(e))));
    return () => {
      live = false;
    };
  }, [id]);

  const status = view?.conversation.status;
  useEffect(() => {
    if (status === 'reviewing' || status === 'complete') navigate(`/talk/${id}/review`, { replace: true });
  }, [status, id, navigate]);

  const send = useCallback(
    async (body: TurnBody) => {
      const next = await api.post<ConversationView>(`/api/conversations/${id}/turns`, body);
      setView(next);
      return next;
    },
    [id],
  );

  if (loadError)
    return (
      <Layout title={loadError.status === 403 ? 'This conversation is not yours' : 'This conversation could not be opened'}>
        <p>{loadError.message}</p>
      </Layout>
    );
  if (!view)
    return (
      <Layout title="Your conversation">
        <p aria-live="polite">Opening your conversation…</p>
      </Layout>
    );

  const { conversation: c, assembly } = view;
  const kicker = assembly.isOpenListening ? 'A private conversation' : assembly.title;

  if (c.status === 'abandoned')
    return (
      <Layout title="This conversation was left unfinished" assembly={assembly} kicker={kicker}>
        <p className="mb-4">You started a newer conversation, so this one was put aside.</p>
        <Button to="/me">See my conversations</Button>
      </Layout>
    );

  if (!c.consent.conversation)
    return (
      <Layout title="Your conversation" assembly={assembly} kicker={kicker}>
        <p className="mb-4">You have not started yet.</p>
        <Button
          onClick={async () => {
            setView(await api.post<ConversationView>(`/api/conversations/${id}/consent`));
          }}
        >
          Start
        </Button>
      </Layout>
    );

  if (c.route === 'questions') return <QuestionsForm view={view} send={send} kicker={kicker} />;
  if (c.route === 'freetext') return <FreeWrite view={view} send={send} kicker={kicker} />;
  return <Chat view={view} send={send} kicker={kicker} />;
}

interface RouteProps {
  view: ConversationView;
  send: (body: TurnBody) => Promise<ConversationView>;
  kicker: string;
}

/** "Stop here and review", with a short confirmation. */
function StopButton({ onStop, disabled, compact }: { onStop: () => void; disabled?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {compact ? (
        <button type="button" className={COMPACT} onClick={() => setOpen(true)} disabled={disabled}>
          Stop here and review
        </button>
      ) : (
        <Button variant="quiet" onClick={() => setOpen(true)} disabled={disabled}>
          Stop here and review
        </Button>
      )}
      <Dialog open={open} title="Stop here?" onClose={() => setOpen(false)}>
        <p className="mb-4">You will see the points from what you have said so far, and you can change or scrap any of them. The questions end here.</p>
        <Button
          onClick={() => {
            setOpen(false);
            onStop();
          }}
        >
          Stop and see my points
        </Button>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------------ the AI route */

function Chat({ view, send, kicker }: RouteProps) {
  const { conversation: c, assembly } = view;
  const [text, setText] = useState('');
  const [waiting, setWaiting] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string>();
  const [announce, setAnnounce] = useState('');
  const boxId = useId();
  const composer = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  // The message box is fixed to the bottom of the screen; the page gets room beneath so nothing hides behind it.
  useLayoutEffect(() => {
    const el = composer.current;
    if (!el) return;
    const apply = () => {
      document.body.style.paddingBottom = `${el.offsetHeight}px`;
    };
    apply();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : undefined;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      document.body.style.paddingBottom = '';
    };
  }, []);

  const turnCount = view.turns.length;
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [turnCount, waiting, thinking]);

  async function act(body: TurnBody) {
    setError(undefined);
    setThinking(true);
    if ('text' in body) setWaiting(body.text);
    try {
      const next = await send(body);
      const last = next.turns[next.turns.length - 1];
      if (last?.role === 'interviewer') setAnnounce(last.text);
      setWaiting(null);
      if ('text' in body) setText('');
    } catch (e) {
      setError(errorText(e));
      if ('text' in body) setText(body.text);
      setWaiting(null);
    } finally {
      setThinking(false);
      box.current?.focus();
    }
  }

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const t = text.trim();
    if (!t || thinking) return;
    setText('');
    void act({ text: t });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  const distress = view.pending === 'distress';

  return (
    <Layout title="Your conversation" assembly={assembly} kicker={kicker}>
      <StageSteps stage={c.stage} />
      {c.mode === 'scripted' && (
        <Banner className="mb-4">
          <p>{SCRIPTED_MODE_LABEL}</p>
        </Banner>
      )}
      <ol className="space-y-5" aria-label="The conversation so far">
        {view.turns.map((t) => (
          <TurnItem key={t.id} turn={t} />
        ))}
        {waiting && <TurnItem turn={{ role: 'person', text: waiting }} />}
        {thinking && (
          <li className="animate-pulse text-muted">The interviewer is thinking…</li>
        )}
      </ol>
      <div ref={end} />
      <div aria-live="polite" className="sr-only">
        {announce}
      </div>

      <div ref={composer} className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white">
        <div className="mx-auto max-w-read px-4 pt-3 pb-1">
          {error && (
            <Banner tone="warn" className="mb-2">
              {error}
            </Banner>
          )}
          {distress ? (
            <div>
              <p className="mb-2 font-bold">Would you like to carry on, or stop here?</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void act({ resume: true })} disabled={thinking}>
                  Carry on
                </Button>
                <Button variant="secondary" onClick={() => void act({ stop: true })} disabled={thinking}>
                  Stop here and review
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit}>
              <label htmlFor={boxId} className="sr-only">
                Your answer
              </label>
              <div className="flex items-end gap-2">
                <textarea
                  id={boxId}
                  ref={box}
                  rows={2}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Type your answer"
                  aria-describedby={`${boxId}-hint`}
                  maxLength={4000}
                  className={`${inputClass} min-h-[3.2rem] flex-1 resize-y`}
                />
                <Button type="submit" disabled={thinking || !text.trim()}>
                  Send
                </Button>
              </div>
              <p id={`${boxId}-hint`} className="sr-only">
                Enter sends. Shift and Enter starts a new line.
              </p>
              <div className="-ml-2 flex flex-wrap items-center">
                <MicButton className={COMPACT} lang={c.language} onText={(t) => setText((s) => (s ? `${s} ${t}` : t))} onError={setError} />
                <button type="button" className={COMPACT} onClick={() => void act({ skip: true })} disabled={thinking}>
                  Skip this
                </button>
                <StopButton compact onStop={() => void act({ stop: true })} disabled={thinking} />
              </div>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
}

function TurnItem({ turn }: { turn: Pick<Turn, 'role' | 'text'> }) {
  if (turn.role === 'interviewer')
    return (
      <li>
        <p className="text-sm text-muted">Interviewer</p>
        <p className="whitespace-pre-wrap">{turn.text}</p>
      </li>
    );
  return (
    <li className="ml-6 rounded-ui border-l-4 border-accent bg-accent-soft px-3 py-2 sm:ml-16">
      <p className="text-sm font-bold">You</p>
      <p className="whitespace-pre-wrap">{turn.text}</p>
    </li>
  );
}

/* ------------------------------------------------------------------ written questions */

function QuestionsForm({ view, send, kicker }: RouteProps) {
  const { conversation: c, assembly } = view;
  const [answers, setAnswers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const stage = INTERVIEW_STAGES[c.stage];

  async function act(body: TurnBody) {
    setBusy(true);
    setError(undefined);
    try {
      await send(body);
      setAnswers([]);
      window.scrollTo?.(0, 0);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout title="Your answers" assembly={assembly} kicker={kicker}>
      <StageSteps stage={c.stage} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void act({ answers });
        }}
      >
        <h2 className="mb-3">{stage?.title}</h2>
        {view.questions.map((q, i) => (
          <Field key={`${c.stage}-${i}`} label={q}>
            <textarea
              rows={4}
              className={inputClass}
              value={answers[i] ?? ''}
              maxLength={4000}
              onChange={(e) => {
                const next = [...answers];
                next[i] = e.target.value;
                setAnswers(next);
              }}
            />
          </Field>
        ))}
        {error && (
          <Banner tone="warn" className="mb-4">
            {error}
          </Banner>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={busy}>
            {c.stage >= 8 ? 'Finish and see my points' : 'Next'}
          </Button>
          <Button variant="quiet" onClick={() => void act({ skip: true })} disabled={busy}>
            Skip this
          </Button>
          <StopButton onStop={() => void act({ stop: true })} disabled={busy} />
        </div>
      </form>
    </Layout>
  );
}

/* ------------------------------------------------------------------ free writing */

function FreeWrite({ view, send, kicker }: RouteProps) {
  const { conversation: c, assembly } = view;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function finish(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      setError('Write something first, even a few lines.');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await send({ text: text.trim() });
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <Layout title="Write freely" assembly={assembly} kicker={kicker}>
      <form onSubmit={finish}>
        <Field
          label="Write about a real, recent day"
          hint="What happened, what mattered, what got in the way, and what an ordinary good day would look like a few years from now. Write as much or as little as you like."
        >
          <textarea rows={12} className={inputClass} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} />
        </Field>
        <div className="mb-4">
          <MicButton lang={c.language} onText={(t) => setText((s) => (s ? `${s} ${t}` : t))} onError={setError} />
        </div>
        {error && (
          <Banner tone="warn" className="mb-4">
            {error}
          </Banner>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? 'Finding your points…' : 'I have finished'}
        </Button>
      </form>
    </Layout>
  );
}
