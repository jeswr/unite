import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { Point, PointType } from '@unite/shared';
import { api, ApiError } from '../../lib/api';
import { useMe } from '../../lib/me';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Layout } from '../../ui/Layout';
import { AddPointForm, PointCard, type PointDraft } from './PointCard';
import type { ApproveLinkView, ConversationView } from '@unite/shared';

const errorText = (e: unknown) => (e instanceof ApiError ? e.message : 'That did not go through. Please try again.');

/**
 * /approve/:token: the one-time link a host gives to someone whose points they wrote down. The
 * person checks the points exactly as on the review page; nothing is shared until they approve.
 */
export default function ApproveByLink() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { refresh } = useMe();
  const [view, setView] = useState<ApproveLinkView>();
  const [drafts, setDrafts] = useState<Record<string, PointDraft>>({});
  const [added, setAdded] = useState<{ type: PointType; text: string; visibility: Point['visibility'] }[]>([]);
  const [loadError, setLoadError] = useState<ApiError>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<ApproveLinkView>(`/api/approve/${token}`)
      .then((v) => {
        setView(v);
        setDrafts(Object.fromEntries(v.points.map((p) => [p.id, { text: p.text, visibility: p.visibility, status: p.status }])));
      })
      .catch((e: unknown) => setLoadError(e instanceof ApiError ? e : new ApiError(0, 'error', errorText(e))));
  }, [token]);

  async function approve() {
    if (!view) return;
    setBusy(true);
    setError(undefined);
    try {
      const done = await api.post<ConversationView>(`/api/approve/${token}`, {
        points: view.points.map((p) => {
          const d = drafts[p.id]!;
          return { id: p.id, text: d.text.trim() || p.text, visibility: d.visibility, status: d.status === 'scrapped' ? 'scrapped' : 'draft' };
        }),
        added,
      });
      await refresh();
      navigate(`/talk/${done.conversation.id}/review`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  if (loadError)
    return (
      <Layout title="This link cannot be used">
        <p>{loadError.message}</p>
      </Layout>
    );
  if (!view)
    return (
      <Layout title="Check your points">
        <p aria-live="polite">Opening your points…</p>
      </Layout>
    );

  const set = (id: string, patch: Partial<PointDraft>) => setDrafts((d) => ({ ...d, [id]: { ...d[id]!, ...patch } }));

  return (
    <Layout title="Check your points" assembly={view.assembly} kicker={view.assembly.isOpenListening ? undefined : view.assembly.title}>
      <p className="mb-5">
        Someone from the host wrote these points down from what you told them. Check that they are in your words. Change anything that is not
        right and scrap anything you do not want shared. Nothing is shared until you say these are right.
      </p>
      <ol className="mb-5 space-y-4" aria-label="Your points">
        {view.points.map((p, i) => (
          <PointCard
            key={p.id}
            index={i}
            point={p}
            draft={drafts[p.id]!}
            sources={[]}
            onText={(text) => set(p.id, { text })}
            onVisibility={(visibility) => set(p.id, { visibility })}
            onStatus={(status) => set(p.id, { status })}
            disabled={busy}
          />
        ))}
        {added.map((a, i) => (
          <li key={`added-${i}`} className="rounded-ui border border-line p-4">
            <p className="mb-1 text-sm font-bold text-muted">Your own point</p>
            <p>{a.text}</p>
            <Button variant="quiet" className="-ml-4" onClick={() => setAdded(added.filter((_, j) => j !== i))}>
              Remove
            </Button>
          </li>
        ))}
      </ol>
      <div className="mb-8">
        <AddPointForm onAdd={(p) => setAdded([...added, { ...p, visibility: 'anonymous' }])} disabled={busy} />
      </div>
      {error && (
        <Banner tone="warn" className="mb-4">
          {error}
        </Banner>
      )}
      <Button onClick={() => void approve()} disabled={busy}>
        {busy ? 'Saving…' : 'These are right'}
      </Button>
    </Layout>
  );
}
