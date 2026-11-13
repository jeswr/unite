import { useState } from 'react';
import { Link } from 'react-router';
import { formatDate } from '@unite/shared';
import { api, ApiError, useApi } from '../../lib/api';
import { useMe } from '../../lib/me';
import { Banner } from '../../ui/Banner';
import { Button, buttonClass } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Dialog } from '../../ui/Dialog';
import { EmptyState } from '../../ui/EmptyState';
import { Layout } from '../../ui/Layout';
import type { MyConversation, TraceEntry } from '@unite/shared';
import { CONVERSATION_STATUS_WORDS, POINT_TYPE_LABELS, VISIBILITY_CHOICES } from '../talk/words';

const visibilityWords = (v: TraceEntry['point']['visibility']) => VISIBILITY_CHOICES.find((c) => c.value === v)?.label ?? '';

/** /me: what happened to what I said, my conversations, and my data. */
export default function Me() {
  const { me, refresh } = useMe();
  const [tick, setTick] = useState(0);
  const trace = useApi<{ points: TraceEntry[] }>('/api/me/trace', tick);
  const conversations = useApi<{ conversations: MyConversation[] }>('/api/conversations', tick);
  const [confirm, setConfirm] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function deleteEverything() {
    setBusy(true);
    setError(undefined);
    try {
      await api.del('/api/me');
      setConfirm(false);
      setDeleted(true);
      await refresh();
      setTick((t) => t + 1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Your data could not be deleted. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const points = trace.data?.points ?? [];
  const mine = (conversations.data?.conversations ?? []).filter((c) => c.status !== 'abandoned');
  const hasPerson = !!me?.person;

  return (
    <Layout title="What happened to what I said">
      {deleted && (
        <Banner className="mb-6">
          <p>Everything Unite held about you has been deleted. Your points have been taken out of the picture and the statements.</p>
        </Banner>
      )}
      {error && (
        <Banner tone="warn" className="mb-6">
          {error}
        </Banner>
      )}

      {trace.data && points.length === 0 ? (
        <div className="mb-10">
          <EmptyState title="Nothing to follow yet">
            <p className="mb-4">
              When you approve points at the end of a conversation, you can follow each one here: the theme it joins in the picture, the
              statements that rest on it, and any decision made from them.
            </p>
            <Button to="/talk">Start a conversation</Button>
          </EmptyState>
        </div>
      ) : (
        <ol className="mb-10 space-y-4" aria-label="Your points">
          {points.map((t) => (
            <TraceCard key={t.point.id} t={t} />
          ))}
        </ol>
      )}

      <h2 className="mb-3">My conversations</h2>
      {mine.length === 0 ? (
        <p className="mb-10 text-muted">You have no conversations yet. Your conversations will be listed here, to carry on or to check your points.</p>
      ) : (
        <ul className="mb-10 space-y-3">
          {mine.map((c) => (
            <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-3">
              <div>
                <p className="font-bold">{c.assembly.isOpenListening ? 'Open conversation' : c.assembly.title}</p>
                <p className="text-sm text-muted">
                  Started {formatDate(c.startedAt)}. {CONVERSATION_STATUS_WORDS[c.status]}.
                </p>
              </div>
              <Link to={c.status === 'active' ? `/talk/${c.id}` : `/talk/${c.id}/review`}>
                {c.status === 'active' ? 'Carry on' : c.status === 'reviewing' ? 'Check my points' : 'See my points'}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-3">My data</h2>
      {hasPerson ? (
        <>
          <p className="mb-4">
            You can download everything Unite holds about you, or delete it. Your conversations are private to you either way.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="/api/me/export" download="unite-my-data.json" className={buttonClass('secondary')}>
              Download my data
            </a>
            <Button variant="secondary" onClick={() => setConfirm(true)}>
              Delete my data
            </Button>
          </div>
        </>
      ) : (
        <p className="text-muted">Unite holds nothing about you yet. If you take part, you can download or delete everything from here.</p>
      )}

      <Dialog open={confirm} title="Delete everything about you?" onClose={() => setConfirm(false)}>
        <p className="mb-2">This removes, for good:</p>
        <ul className="mb-3 list-disc space-y-1 pl-6">
          <li>your conversations and everything you said in them</li>
          <li>your points, which are taken out of the picture and out of any statements</li>
          <li>your reactions, reasons, objections, priority choices and room answers</li>
          <li>your memberships of assemblies</li>
        </ul>
        <p className="mb-4">
          Counts go down by one where you were counted. Decisions already made stay as they are. This cannot be undone.
        </p>
        <button
          type="button"
          onClick={() => void deleteEverything()}
          disabled={busy}
          className="inline-flex min-h-11 items-center justify-center rounded-ui border border-warn bg-warn px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Deleting…' : 'Yes, delete everything'}
        </button>
      </Dialog>
    </Layout>
  );
}

function TraceCard({ t }: { t: TraceEntry }) {
  const slug = t.assembly?.slug;
  const pictureLink = t.assembly ? (t.assembly.isOpenListening ? '/listening' : `/a/${slug}/picture`) : undefined;
  return (
    <Card as="li">
      <p className="mb-1 text-sm text-muted">
        {POINT_TYPE_LABELS[t.point.type]}
        {t.assembly && <> · {t.assembly.isOpenListening ? 'Open conversation' : t.assembly.title}</>} · {visibilityWords(t.point.visibility)}
      </p>
      <blockquote className="mb-3 border-l-4 border-line pl-3 font-bold">“{t.point.text}”</blockquote>
      <dl className="space-y-2">
        <div>
          <dt className="text-sm font-bold">In the picture</dt>
          <dd>
            {t.theme ? (
              <>
                Part of the theme {pictureLink ? <Link to={pictureLink}>“{t.theme.name}”</Link> : <>“{t.theme.name}”</>}
              </>
            ) : (
              <span className="text-muted">Not in a theme yet. It joins one when the picture is next updated.</span>
            )}
          </dd>
        </div>
        {t.statements.length > 0 && (
          <div>
            <dt className="text-sm font-bold">Statements that rest on it</dt>
            <dd>
              <ul className="space-y-1">
                {t.statements.map((s) => (
                  <li key={s.id}>
                    {slug ? <Link to={`/a/${slug}/statements/${s.id}`}>{s.text}</Link> : s.text}
                    {s.statusWords ? <span className="text-muted"> ({s.statusWords})</span> : <span className="text-muted"> (answer it to see where it stands)</span>}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {t.decisions.length > 0 && (
          <div>
            <dt className="text-sm font-bold">Decisions made from them</dt>
            <dd>
              <ul className="space-y-1">
                {t.decisions.map((d) => (
                  <li key={d.id}>
                    {slug ? (
                      <Link to={`/a/${slug}/decisions/${d.id}`}>
                        Decision {d.number}: {d.title}
                      </Link>
                    ) : (
                      <>
                        Decision {d.number}: {d.title}
                      </>
                    )}{' '}
                    <span className="text-muted">({d.statusWords})</span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
      </dl>
    </Card>
  );
}
