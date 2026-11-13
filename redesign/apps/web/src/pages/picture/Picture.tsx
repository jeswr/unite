import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { api, ApiError, useApi } from '../../lib/api';
import { useAssembly } from '../../lib/useAssembly';
import { useLive } from '../../lib/useLive';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { EmptyState } from '../../ui/EmptyState';
import { Layout } from '../../ui/Layout';
import { personCount } from '../../ui/PersonCount';
import { capitalise, ConfirmedLine, Contents, MissingBars, NotHeard, peopleInWords, QuoteList, sectionLinks, ThemeSections } from './parts';
import type { PictureResponse } from '@unite/shared';

/** The steward's two controls: update the picture, and confirm it is faithful. */
function StewardPanel({ slug, data, onDone }: { slug: string; data: PictureResponse; onDone: () => void }) {
  const [busy, setBusy] = useState<'update' | 'confirm'>();
  const [message, setMessage] = useState<string>();
  const run = async (what: 'update' | 'confirm') => {
    setBusy(what);
    setMessage(undefined);
    try {
      if (what === 'update') {
        const { result } = await api.post<{ result: { themed: number; created: number; fallback: boolean } }>(`/api/assemblies/${encodeURIComponent(slug)}/picture/update`);
        setMessage(
          `${result.themed === 1 ? '1 point was' : `${result.themed} points were`} put into themes, with ${result.created === 1 ? '1 new theme' : `${result.created} new themes`}.` +
            (result.fallback ? ' The AI is not switched on, so themes were grouped by shared words and show quotes only.' : ''),
        );
      } else {
        await api.post(`/api/assemblies/${encodeURIComponent(slug)}/picture/confirm`);
        setMessage('You have confirmed the picture. Everyone can see that you did.');
      }
      onDone();
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : 'That did not work. Please try again.');
    } finally {
      setBusy(undefined);
    }
  };
  return (
    <Card as="section" className="mb-8">
      <h2 className="mb-2">For stewards</h2>
      <p className="mb-3">
        {data.unthemed === 0
          ? 'Every approved point is in the picture.'
          : `${data.unthemed === 1 ? '1 approved point is' : `${data.unthemed} approved points are`} not in a theme yet.`}{' '}
        Read every theme against its sources before you confirm. Updating the picture clears the confirmation.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" disabled={!!busy} onClick={() => void run('update')}>
          {busy === 'update' ? 'Updating…' : 'Update the picture'}
        </Button>
        {data.canConfirm && (
          <Button disabled={!!busy || data.updating} onClick={() => void run('confirm')}>
            Confirm the picture is faithful
          </Button>
        )}
      </div>
      {message && (
        <p className="mt-3" role="status">
          {message}
        </p>
      )}
    </Card>
  );
}

/** /a/:slug/picture: what everyone said, every summary open to checking. Live. */
export default function Picture() {
  const { slug = '' } = useParams();
  const version = useLive(slug);
  const { data: view, reload: reloadView } = useAssembly(slug, version);
  const { data, error, reload } = useApi<PictureResponse>(`/api/assemblies/${encodeURIComponent(slug)}/picture`, version);
  const assembly = view?.assembly;
  const layout = (body: ReactNode, title = 'The picture') => (
    <Layout title={title} assembly={assembly} kicker={assembly?.question}>
      {body}
    </Layout>
  );

  if (error?.code === 'not_heard')
    return layout(
      <NotHeard
        slug={slug}
        isExample={assembly?.isExample}
        what="what everyone said"
        onLookedAround={() => {
          reloadView();
          reload();
        }}
      />,
    );
  if (error && !data) return layout(<p>{error.message}</p>, error.status === 404 ? 'There is no assembly here' : 'The picture could not be loaded');
  if (!data) return layout(<p aria-live="polite">Loading the picture…</p>);

  const themeCount = data.sections.reduce((n, s) => n + s.themes.length, 0);
  const contents = [
    ...(themeCount > 0 ? sectionLinks(data.sections) : []),
    ...(data.hardChoices.people > 0 ? [{ id: 'hard', label: 'Hard choices and doubts' }] : []),
    ...(data.missing.length > 0 ? [{ id: 'missing', label: 'Who we have not heard from' }] : []),
  ];
  return layout(
    <>
      <p className="mb-2 text-xl" aria-live="polite">
        {data.totals.people === 0 ? 'Nobody has spoken yet.' : `${capitalise(peopleInWords(data.totals.people))} ${data.totals.people === 1 ? 'has' : 'have'} spoken so far.`}
      </p>
      <p className="mb-4 text-muted">
        Every count is of people, worked out from the points they approved. Open “Sources” under any sentence to see what it rests on.
      </p>
      <ConfirmedLine confirmed={data.confirmed} />
      <Contents items={contents} />
      {data.updating && (
        <Banner className="mb-6">
          <p aria-live="polite">The picture is being updated with new points. It will refresh by itself.</p>
        </Banner>
      )}
      {data.canConfirm && <StewardPanel slug={slug} data={data} onDone={reload} />}

      {data.myUnthemed.length > 0 && (
        <Card as="section" aria-labelledby="mine-waiting" className="mb-8">
          <h2 id="mine-waiting" className="mb-2">
            What you said
          </h2>
          <p className="mb-3 text-muted">
            {data.myUnthemed.length === 1 ? 'This point joins' : 'These points join'} a theme the next time the picture is updated. Until then they are counted
            in the totals above.
          </p>
          <ul className="space-y-2">
            {data.myUnthemed.map((m) => (
              <li key={m.id} className="border-l-2 border-accent pl-3">
                <q>{m.text}</q>
                <span className="block text-sm font-bold text-accent">You said this</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {themeCount === 0 ? (
        <EmptyState title="No themes yet">
          <p>
            Themes appear here as people approve their points{data.unthemed > 0 ? ' and the picture is updated' : ''}. Come back soon, or{' '}
            <Link to={`/a/${slug}`}>go back to the assembly</Link>.
          </p>
        </EmptyState>
      ) : (
        <ThemeSections sections={data.sections} canReport onChange={reload} />
      )}

      {data.hardChoices.people > 0 && (
        <section aria-labelledby="hard" className="mt-10">
          <h2 id="hard" className="mb-2">
            Hard choices and doubts
          </h2>
          <p className="mb-3 text-muted">
            What {personCount(data.hardChoices.people)} said they would have to choose between, or are unsure of. These are not summarised.
          </p>
          {data.hardChoices.quotes.length > 0 ? (
            <>
              <QuoteList quotes={data.hardChoices.quotes.slice(0, 1)} label="Hard choices and doubts" />
              {data.hardChoices.quotes.length > 1 && (
                <details className="mt-2">
                  <summary className="min-h-11 cursor-pointer py-2 text-accent underline underline-offset-2">
                    {data.hardChoices.quotes.length === 2 ? 'Show 1 more quote' : `Show ${data.hardChoices.quotes.length - 1} more quotes`}
                  </summary>
                  <QuoteList quotes={data.hardChoices.quotes.slice(1)} label="More hard choices and doubts" />
                </details>
              )}
            </>
          ) : (
            <p className="text-muted">The people behind these chose to be counted without their words shown.</p>
          )}
        </section>
      )}

      <MissingBars groups={data.missing} />

      <p className="mt-10">
        <Link to={`/a/${slug}/statements`}>Go to the statements drafted from this picture</Link>
      </p>
    </>,
  );
}
