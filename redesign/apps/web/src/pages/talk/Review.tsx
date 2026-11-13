import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import type { Conversation, Point } from '@unite/shared';
import { api, ApiError } from '../../lib/api';
import { useMe } from '../../lib/me';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { Layout } from '../../ui/Layout';
import { AddPointForm, PointCard, type PointDraft } from './PointCard';
import type { ConversationView } from '@unite/shared';
import { picturePath, PUSHED, SOUNDS_LIKE_ME } from './words';

const errorText = (e: unknown) => (e instanceof ApiError ? e.message : 'That did not go through. Please try again.');

const draftOf = (p: Point): PointDraft => ({ text: p.text, visibility: p.visibility, status: p.status });

/** /talk/:id/review: "Here is what I heard." Check the points, approve them, then the two exit questions. */
export default function Review() {
  const { id } = useParams();
  const { refresh } = useMe();
  const [view, setView] = useState<ConversationView>();
  const [drafts, setDrafts] = useState<Record<string, PointDraft>>({});
  const [loadError, setLoadError] = useState<ApiError>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [exitDone, setExitDone] = useState(false);

  function take(v: ConversationView) {
    setView(v);
    setDrafts(Object.fromEntries(v.points.map((p) => [p.id, draftOf(p)])));
  }

  useEffect(() => {
    api
      .get<ConversationView>(`/api/conversations/${id}`)
      .then(take)
      .catch((e: unknown) => setLoadError(e instanceof ApiError ? e : new ApiError(0, 'error', errorText(e))));
  }, [id]);

  async function patch(pointId: string, body: Partial<PointDraft>) {
    setError(undefined);
    try {
      const { point } = await api.patch<{ point: Point }>(`/api/points/${pointId}`, body);
      setView((v) => (v ? { ...v, points: v.points.map((p) => (p.id === point.id ? point : p)) } : v));
      setDrafts((d) => ({ ...d, [point.id]: { ...d[point.id]!, visibility: point.visibility, status: point.status } }));
    } catch (e) {
      setError(errorText(e));
    }
  }

  function saveText(p: Point) {
    const text = drafts[p.id]?.text.trim();
    if (text && text !== p.text) void patch(p.id, { text });
  }

  async function addPoint(body: { type: Point['type']; text: string }) {
    setError(undefined);
    try {
      const { point } = await api.post<{ point: Point }>(`/api/conversations/${id}/points`, body);
      setView((v) => (v ? { ...v, points: [...v.points, point] } : v));
      setDrafts((d) => ({ ...d, [point.id]: draftOf(point) }));
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function approve() {
    if (!view) return;
    setBusy(true);
    setError(undefined);
    try {
      // Words still being typed are saved first.
      for (const p of view.points) {
        const text = drafts[p.id]?.text.trim();
        if (p.status === 'draft' && text && text !== p.text) await api.patch(`/api/points/${p.id}`, { text });
      }
      take(await api.post<ConversationView>(`/api/conversations/${id}/approve`));
      await refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (loadError)
    return (
      <Layout title={loadError.status === 403 ? 'These points are not yours' : 'Your points could not be opened'}>
        <p>{loadError.message}</p>
      </Layout>
    );
  if (!view)
    return (
      <Layout title="Here is what I heard">
        <p aria-live="polite">Opening your points…</p>
      </Layout>
    );

  const { conversation: c, assembly } = view;
  const kicker = assembly.isOpenListening ? 'A private conversation' : assembly.title;

  if (c.status === 'active' || c.status === 'abandoned')
    return (
      <Layout title="Here is what I heard" assembly={assembly} kicker={kicker}>
        <p className="mb-4">
          {c.status === 'active' ? 'Your conversation is still going. Your points will be here when it ends.' : 'This conversation was left unfinished.'}
        </p>
        <Button to={c.status === 'active' ? `/talk/${c.id}` : '/me'}>{c.status === 'active' ? 'Back to the conversation' : 'See my conversations'}</Button>
      </Layout>
    );

  if (c.status === 'complete')
    return (
      <Layout title={exitDone || c.exit ? 'Thank you' : 'Your points are shared'} assembly={assembly} kicker={kicker}>
        {exitDone || c.exit ? (
          <>
            <p className="mb-5">
              Your points are now part of the picture, shown the way you chose. You can follow what happens to each of them on your own page.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button to={picturePath(assembly)}>See the picture</Button>
              <Link to="/me">What happened to what I said</Link>
            </div>
          </>
        ) : (
          <ExitQuestions conversation={c} onDone={(v) => (v ? take(v) : setExitDone(true))} />
        )}
        <KeptPoints points={view.points} />
      </Layout>
    );

  const kept = view.points.filter((p) => drafts[p.id]?.status !== 'scrapped');
  const sourceTurns = (p: Point) => view.turns.filter((t) => t.role === 'person' && p.sourceTurnIds.includes(t.id));

  return (
    <Layout title="Here is what I heard" assembly={assembly} kicker={kicker}>
      <p className="mb-5">
        These are the points I took from what you said, in your words. Change anything that is not right, and scrap anything you do not want
        shared. Nothing leaves this page until you say these are right.
      </p>
      {view.points.length === 0 && (
        <p className="mb-5 rounded-ui border border-dashed border-muted px-4 py-4">
          There were no points to draw from what you said. You can add a point of your own below, or say these are right with none.
        </p>
      )}
      <ol className="mb-5 space-y-4" aria-label="Your points">
        {view.points.map((p, i) => (
          <PointCard
            key={p.id}
            index={i}
            point={p}
            draft={drafts[p.id] ?? draftOf(p)}
            sources={sourceTurns(p)}
            onText={(text) => setDrafts((d) => ({ ...d, [p.id]: { ...d[p.id]!, text } }))}
            onTextDone={() => saveText(p)}
            onVisibility={(visibility) => void patch(p.id, { visibility })}
            onStatus={(status) => void patch(p.id, { status })}
            disabled={busy}
          />
        ))}
      </ol>
      <div className="mb-8">
        <AddPointForm onAdd={addPoint} disabled={busy} />
      </div>
      {error && (
        <Banner tone="warn" className="mb-4">
          {error}
        </Banner>
      )}
      {kept.length === 0 && view.points.length > 0 && (
        <p className="mb-3">You have scrapped every point. Nothing you said will be shared, and you will still count as having taken part.</p>
      )}
      <Button onClick={() => void approve()} disabled={busy}>
        {busy ? 'Saving…' : 'These are right'}
      </Button>
    </Layout>
  );
}

function KeptPoints({ points }: { points: Point[] }) {
  const kept = points.filter((p) => p.status === 'approved');
  if (!kept.length) return null;
  return (
    <section className="mt-10">
      <h2 className="mb-3">Your points</h2>
      <ul className="space-y-2">
        {kept.map((p) => (
          <li key={p.id} className="border-l-4 border-line pl-3">
            {p.text}
          </li>
        ))}
      </ul>
    </section>
  );
}

const PUSHED_QUESTION: Record<Conversation['route'], string> = {
  ai: 'Did the interviewer push you in any direction?',
  questions: 'Did the questions push you in any direction?',
  freetext: 'Did anything here push you in any direction?',
  host: 'Did the person who wrote down your points push you in any direction?',
};

/** "Do these points sound like you?" and "Did the interviewer push you in any direction?" */
function ExitQuestions({ conversation, onDone }: { conversation: Conversation; onDone: (v?: ConversationView) => void }) {
  const [sounds, setSounds] = useState<1 | 2 | 3 | 4>();
  const [pushed, setPushed] = useState<'no' | 'a_little' | 'yes'>();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const soundsName = useId();
  const pushedName = useId();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!sounds || !pushed) return setError('Choose an answer to both questions, or skip them.');
    setBusy(true);
    setError(undefined);
    try {
      onDone(await api.post<ConversationView>(`/api/conversations/${conversation.id}/exit`, { soundsLikeMe: sounds, pushed, ...(note.trim() ? { note: note.trim() } : {}) }));
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <p className="mb-5">Thank you. Two last questions help us check that the conversation is fair. They are optional.</p>
      <fieldset className="mb-5">
        <legend className="mb-2 font-bold">Do these points sound like you?</legend>
        <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-5">
          {SOUNDS_LIKE_ME.map((o) => (
            <label key={o.value} className="flex items-center gap-2 py-1">
              <input type="radio" name={soundsName} checked={sounds === o.value} onChange={() => setSounds(o.value)} className="h-5 w-5" />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="mb-5">
        <legend className="mb-2 font-bold">{PUSHED_QUESTION[conversation.route]}</legend>
        <div className="flex flex-wrap gap-x-5">
          {PUSHED.map((o) => (
            <label key={o.value} className="flex items-center gap-2 py-1">
              <input type="radio" name={pushedName} checked={pushed === o.value} onChange={() => setPushed(o.value)} className="h-5 w-5" />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Anything you want to add (optional)">
        <textarea rows={3} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      </Field>
      {error && (
        <Banner tone="warn" className="mb-4">
          {error}
        </Banner>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={busy}>
          Send my answers
        </Button>
        <Button variant="quiet" onClick={() => onDone()}>
          Skip these questions
        </Button>
      </div>
    </form>
  );
}
