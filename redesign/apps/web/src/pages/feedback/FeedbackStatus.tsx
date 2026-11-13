import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { formatDate } from '@unite/shared';
import { api, useApi } from '../../lib/api';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Layout } from '../../ui/Layout';
import { Tag, type TagTone } from '../../ui/Tag';
import type { FeedbackStatus as Status, FeedbackView } from './types';

const TONE: Record<Status, TagTone> = { draft: 'neutral', received: 'accent', planned: 'accent', done: 'agree', declined: 'neutral' };

/** "Your feedback": reached only from the private link. */
export default function FeedbackStatus() {
  const { token } = useParams();
  const loaded = useApi<{ feedback: FeedbackView }>(token ? `/feedback/${encodeURIComponent(token)}` : null);
  const [view, setView] = useState<FeedbackView>();
  const [error, setError] = useState<string>();
  const fb = view ?? loaded.data?.feedback;

  if (!fb)
    return (
      <Layout title={loaded.error ? 'We could not find this feedback' : 'Your feedback'}>
        {loaded.error ? (
          <>
            <p className="mb-4">{loaded.error.status === 404 ? 'There is no feedback at this link. Check that the whole link was copied.' : loaded.error.message}</p>
            <p>
              <Link to="/feedback">Give feedback</Link>
            </p>
          </>
        ) : (
          <p aria-live="polite">Loading your feedback…</p>
        )}
      </Layout>
    );

  const act = async (path: string, body?: unknown) => {
    setError(undefined);
    try {
      const r = body === undefined ? await api.post<{ feedback: FeedbackView }>(path) : await api.patch<{ feedback: FeedbackView }>(path, body);
      setView(r.feedback);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const base = `/feedback/${encodeURIComponent(fb.token)}`;
  const answered = fb.answers.filter((a) => a.answer.trim());
  const { state, text } = fb.publicIssue;

  return (
    <Layout title="Your feedback">
      <Card as="section" className="mb-8">
        <h2 className="mb-2 flex flex-wrap items-center gap-3">
          What is happening with it <Tag tone={TONE[fb.status]}>{fb.statusLabel}</Tag>
        </h2>
        <p>{fb.statusText}</p>
        {fb.statusReason && (
          <p className="mt-2">
            <span className="font-bold">Why: </span>
            {fb.statusReason}
          </p>
        )}
        <p className="mt-3 text-muted">
          {fb.submittedAt ? `Sent on ${formatDate(fb.submittedAt)}.` : `Started on ${formatDate(fb.createdAt)}.`}
          {fb.path !== '/' && ` About: ${fb.path}`}
        </p>
        {fb.status === 'draft' && (
          <Button className="mt-3" onClick={() => void act(`${base}/submit`)}>
            Send what I have said
          </Button>
        )}
      </Card>

      <section className="mb-8" aria-labelledby="fb-said">
        <h2 id="fb-said" className="mb-3">
          What you told us
        </h2>
        {answered.length ? (
          <ul className="space-y-4">
            {answered.map((a, i) => (
              <li key={i} className="border-t border-line pt-3">
                <h3 className="mb-1 text-base">{a.question}</h3>
                <p className="whitespace-pre-line">{a.answer}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">No answers were recorded. That is fine: we still know you came to tell us something.</p>
        )}
        {fb.screenshot && <img src={fb.screenshot} alt="The screenshot you added" className="mt-4 max-h-64 max-w-full rounded-ui border border-line" />}
      </section>

      <section className="mb-8" aria-labelledby="fb-public">
        <h2 id="fb-public" className="mb-3">
          The public summary
        </h2>
        {state === 'agreed' && text ? (
          <>
            <p className="mb-1">You agreed to publish this summary. In this test version nothing is published yet.</p>
            <blockquote className="mb-3 rounded-ui border border-line bg-soft px-3 py-2 whitespace-pre-line">{text}</blockquote>
            <Button variant="secondary" onClick={() => void act(base, { publicIssue: { state: 'withdrawn' } })}>
              Withdraw the public summary
            </Button>
          </>
        ) : (
          <p className="text-muted">
            {state === 'withdrawn' ? 'You withdrew the public summary. Nothing will be published.' : 'You kept your feedback private. Nothing will be published.'}
          </p>
        )}
      </section>
      {error && (
        <p role="alert" className="font-bold text-warn">
          {error}
        </p>
      )}
    </Layout>
  );
}
