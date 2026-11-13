import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { MEDIATION_LIMITS, SCRIPTED_MODE_LABEL, mediationStep, type MediationTurn } from '@unite/shared';
import { api, ApiError, useApi } from '../../lib/api';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { inputClass } from '../../ui/Field';
import { Layout } from '../../ui/Layout';
import { NotHeard } from '../picture/parts';
import { ANSWER_WORDS } from '../statements/parts';
import { DraftsReview } from './Review';
import type { MediationTurnBody, MediationView, StatementDetail } from '@unite/shared';

/** The small actions under the message box: link-like, still 44px tall to tap. */
const COMPACT = 'inline-flex min-h-11 items-center px-2 text-sm font-bold text-accent underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

export const errorText = (e: unknown) => (e instanceof ApiError ? e.message : 'That did not go through. Please try again.');

/** Moves focus to the page's heading, as navigating to a new page does. */
function focusHeading() {
  document.querySelector<HTMLElement>('main h1')?.focus();
}

/** /a/:slug/statements/:id/talk: "Talk it through", a private conversation with the AI about one statement. */
export default function TalkItThrough() {
  const { slug = '', id = '' } = useParams();
  const { data: detail, error, reload } = useApi<StatementDetail>(`/api/statements/${encodeURIComponent(id)}`);
  const [view, setView] = useState<MediationView>();
  const [loadError, setLoadError] = useState<ApiError>();
  const mineId = detail?.mediation.mine?.id;

  useEffect(() => {
    if (!mineId || view) return;
    let live = true;
    api
      .get<MediationView>(`/api/mediations/${mineId}`)
      .then((v) => live && setView(v))
      .catch((e: unknown) => live && setLoadError(e instanceof ApiError ? e : new ApiError(0, 'error', errorText(e))));
    return () => {
      live = false;
    };
  }, [mineId, view]);

  // A new part of the conversation (the questions, the review, the thank-you) is like a new page: focus its heading.
  const phase = view?.mediation.status;
  const firstPhase = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!phase) return;
    if (firstPhase.current === undefined) firstPhase.current = phase;
    else if (firstPhase.current !== phase) {
      firstPhase.current = phase;
      focusHeading();
    }
  }, [phase]);

  const statementPath = `/a/${slug}/statements/${id}`;
  const page = (title: string, body: ReactNode) => (
    <Layout title={title} assembly={detail?.assembly ?? view?.assembly} kicker={detail?.assembly.title ?? view?.assembly.title}>
      {body}
    </Layout>
  );

  if (error?.code === 'not_heard') return page('Talk it through', <NotHeard slug={slug} what="the statements and talk them through" onLookedAround={reload} />);
  if (error && !detail) return page(error.status === 404 ? 'There is no statement here' : 'This could not be opened', <p>{error.message}</p>);
  if (loadError) return page(loadError.status === 403 ? 'This conversation is not yours' : 'This conversation could not be opened', <p>{loadError.message}</p>);
  if (!detail || (mineId && !view)) return page('Talk it through', <p aria-live="polite">Opening…</p>);

  if (!view) return page('Talk it through', <Intro detail={detail} statementPath={statementPath} onStarted={setView} />);
  if (view.mediation.status === 'reviewing') return page('Here is what I heard', <DraftsReview view={view} onChange={setView} />);
  if (view.mediation.status === 'complete') return page('Thank you', <ThankYou view={view} statementPath={statementPath} />);
  if (view.mediation.status === 'abandoned') return page('This conversation was left unfinished', <Button to={statementPath}>Back to the statement</Button>);
  return page('Talk it through', <Chat view={view} onChange={setView} />);
}

/** The statement, quietly, with the person's answer. */
function StatementBlock({ text, answer }: { text: string; answer?: keyof typeof ANSWER_WORDS | null }) {
  return (
    <div className="mb-5 rounded-ui border border-line bg-soft px-4 py-3">
      <p className="text-sm text-muted">The statement</p>
      <p className="font-bold">{text}</p>
      {answer && <p className="mt-1 text-sm">You answered: {ANSWER_WORDS[answer]}</p>}
    </div>
  );
}

function Intro({ detail, statementPath, onStarted }: { detail: StatementDetail; statementPath: string; onStarted: (v: MediationView) => void }) {
  const s = detail.statement;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const closed = s.status === 'retired' || s.status === 'decided';

  async function start() {
    setBusy(true);
    setError(undefined);
    try {
      onStarted(await api.post<MediationView>(`/api/statements/${s.id}/mediations`));
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <>
      <StatementBlock text={s.text} answer={s.myReaction} />
      {closed ? (
        <p className="mb-4">This statement is settled, so it can no longer be talked through.</p>
      ) : !s.myReaction ? (
        <p className="mb-4">Answer the statement first, then talk it through.</p>
      ) : (
        <>
          <p className="mb-3">
            This is a short private conversation with the AI about your answer. It has four steps and takes about five minutes.
          </p>
          <ol className="mb-4 list-decimal space-y-1 pl-6">
            <li>What is behind your answer, in something that happened to you.</li>
            <li>Reasons from people who answered differently, in their own words, and what you make of them.</li>
            <li>A wording you could agree with that they might agree with too.</li>
            <li>What you would want checked before deciding.</li>
          </ol>
          <p className="mb-5">
            The AI does not argue or take a side. At the end you see what it heard. Only what you approve is added to the statement. You can skip any step
            or stop at any time.
          </p>
          {error && (
            <Banner tone="warn" className="mb-4">
              {error}
            </Banner>
          )}
          <Button onClick={() => void start()} disabled={busy}>
            {busy ? 'Starting…' : 'Start'}
          </Button>
        </>
      )}
      <p className="mt-8">
        <Link to={statementPath}>Back to the statement</Link>
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ the conversation */

function Chat({ view, onChange }: { view: MediationView; onChange: (v: MediationView) => void }) {
  const m = view.mediation;
  const [text, setText] = useState('');
  const [waiting, setWaiting] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string>();
  const [announce, setAnnounce] = useState('');
  const [carryOn, setCarryOn] = useState(false);
  const [stopOpen, setStopOpen] = useState(false);
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
      // Scrolling to the newest message stops above the box, not behind it.
      if (end.current) end.current.style.scrollMarginBottom = `${el.offsetHeight + 16}px`;
    };
    apply();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : undefined;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      document.body.style.paddingBottom = '';
    };
  }, []);

  const turnCount = m.turns.length;
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [turnCount, waiting, thinking]);

  async function act(body: MediationTurnBody) {
    setError(undefined);
    setThinking(true);
    if ('text' in body) setWaiting(body.text);
    try {
      const next = await api.post<MediationView>(`/api/mediations/${m.id}/turns`, body);
      const last = next.mediation.turns[next.mediation.turns.length - 1];
      if (last?.role === 'mediator') setAnnounce(last.text);
      setWaiting(null);
      setCarryOn(false);
      if ('text' in body) setText('');
      onChange(next);
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

  const step = mediationStep(m.step);
  const distress = view.pending === 'distress' && !carryOn;
  const quotesAt = m.turns.findIndex((t) => t.step === 2 && t.role === 'mediator' && !t.skipped);

  return (
    <>
      <p className="mb-4">
        <span className="font-bold">
          Step {m.step} of 4:
        </span>{' '}
        {step?.title}
      </p>
      {!m.aiUsed && (
        <Banner className="mb-4">
          <p>{SCRIPTED_MODE_LABEL}</p>
        </Banner>
      )}
      <StatementBlock text={view.statement.text} answer={m.answer} />
      <ol className="space-y-5" aria-label="The conversation so far">
        {m.turns.map((t, i) => (
          <TurnItem key={`${t.createdAt}-${i}`} turn={t} quotes={i === quotesAt ? view.shownReasons : undefined} />
        ))}
        {waiting && <TurnItem turn={{ role: 'person', text: waiting }} />}
        {thinking && <li className="animate-pulse text-muted">The AI is thinking…</li>}
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
                <Button onClick={() => setCarryOn(true)} disabled={thinking}>
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
                  maxLength={MEDIATION_LIMITS.turn}
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
                <button type="button" className={COMPACT} onClick={() => void act({ skip: true })} disabled={thinking}>
                  Skip this
                </button>
                <button type="button" className={COMPACT} onClick={() => setStopOpen(true)} disabled={thinking}>
                  Stop here and review
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      <Dialog open={stopOpen} title="Stop here?" onClose={() => setStopOpen(false)}>
        <p className="mb-4">You will see what I heard from what you have said so far, and you can change or scrap any of it. The questions end here.</p>
        <Button
          onClick={() => {
            setStopOpen(false);
            void act({ stop: true });
          }}
        >
          Stop and see what you heard
        </Button>
      </Dialog>
    </>
  );
}

function TurnItem({ turn, quotes }: { turn: Pick<MediationTurn, 'role' | 'text' | 'skipped'>; quotes?: MediationView['shownReasons'] }) {
  if (turn.role === 'mediator')
    return (
      <li>
        {quotes && quotes.length > 0 && (
          <section aria-labelledby="other-side" className="mb-5 rounded-ui border border-line px-4 py-3">
            <h2 id="other-side" className="mb-2 text-lg">
              Reasons from people who answered differently
            </h2>
            <ul className="space-y-3">
              {quotes.map((q) => (
                <li key={q.id}>
                  <blockquote className="border-l-4 border-line pl-3">“{q.text}”</blockquote>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-muted">The earliest reason from each of a few different people. Nothing here is ranked.</p>
          </section>
        )}
        <p className="text-sm text-muted">The AI</p>
        <p className="whitespace-pre-wrap">{turn.text}</p>
      </li>
    );
  if (turn.skipped)
    return (
      <li className="ml-6 text-muted sm:ml-16">
        <p>You skipped this.</p>
      </li>
    );
  return (
    <li className="ml-6 rounded-ui border-l-4 border-accent bg-accent-soft px-3 py-2 sm:ml-16">
      <p className="text-sm font-bold">You</p>
      <p className="whitespace-pre-wrap">{turn.text}</p>
    </li>
  );
}

/* ------------------------------------------------------------------ the thank-you */

function ThankYou({ view, statementPath }: { view: MediationView; statementPath: string }) {
  const { approved, drafts } = view.mediation;
  const added = [
    approved?.reasonId && drafts.reason ? { label: drafts.reasonSide === 'against' ? 'A reason against' : 'A reason for', text: drafts.reason } : null,
    approved?.statementId && drafts.wording ? { label: 'A new wording', text: drafts.wording } : null,
    approved?.questionId && drafts.question ? { label: 'A question', text: drafts.question } : null,
  ].filter((x): x is { label: string; text: string } => !!x);
  return (
    <>
      <p className="mb-5">
        {added.length
          ? 'What you approved is now on the statement, with everyone else’s reasons, wordings and questions.'
          : 'Nothing was added to the statement. Thank you for taking the time to think it through.'}
      </p>
      {added.length > 0 && (
        <section aria-labelledby="added" className="mb-6">
          <h2 id="added" className="mb-3">
            What you added
          </h2>
          <ul className="space-y-3">
            {added.map((a) => (
              <li key={a.label} className="border-l-4 border-line pl-3">
                <span className="block text-sm text-muted">{a.label}</span>
                {a.text}
              </li>
            ))}
          </ul>
        </section>
      )}
      <Button to={statementPath}>Back to the statement</Button>
    </>
  );
}
