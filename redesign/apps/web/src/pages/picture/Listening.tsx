import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useApi } from '../../lib/api';
import { useLive } from '../../lib/useLive';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Layout } from '../../ui/Layout';
import { personCount } from '../../ui/PersonCount';
import { capitalise, Contents, peopleInWords, QuoteList, sectionLinks, ThemeSections } from './parts';
import type { ListeningResponse } from '@unite/shared';

const KIND_WORDS = { matters: 'What matters', barrier: 'What gets in the way', day: 'A good ordinary day', idea: 'An idea' } as const;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "60 people in 14 countries, writing in 8 languages." Counted on the server from each person's locale. */
export function reachLine(r: ListeningResponse['reach']): string {
  const people = count(r.people, 'person', 'people');
  const where = r.countries > 0 ? ` in ${count(r.countries, 'country', 'countries')}` : '';
  return `${capitalise(people)}${where}, writing in ${count(r.languages, 'language', 'languages')}.`;
}

/** /listening: the open-listening picture, themes nobody hosts yet, and good ordinary days. */
export default function Listening() {
  const [slug, setSlug] = useState<string>();
  const version = useLive(slug);
  const { data, error, reload } = useApi<ListeningResponse>('/api/listening', version);
  useEffect(() => setSlug(data?.assembly?.slug), [data?.assembly?.slug]);
  const assembly = data?.assembly ?? null;
  const title = 'Open listening';

  if (error && !data)
    return (
      <Layout title={title}>
        <p>{error.message}</p>
      </Layout>
    );
  if (!data)
    return (
      <Layout title={title}>
        <p aria-live="polite">Loading…</p>
      </Layout>
    );
  if (!assembly)
    return (
      <Layout title={title}>
        <EmptyState title="Open listening has not started">
          <p>When it starts, this page will show what people everywhere say about the lives they want.</p>
        </EmptyState>
      </Layout>
    );

  const hasThemes = data.sections.some((s) => s.themes.length > 0);
  const themed = data.sections.filter((s) => s.kind !== 'day');
  const contents = [
    { id: 'no-host', label: 'Themes with no host yet' },
    ...(hasThemes ? sectionLinks(themed.filter((s) => s.themes.length > 0)) : []),
    { id: 'days', label: 'Good ordinary days' },
  ];
  return (
    <Layout title={title} assembly={assembly} kicker={assembly.question}>
      <p className="mb-2 text-xl" aria-live="polite">
        {data.totals.people === 0 ? 'Nobody has spoken yet.' : data.reach.people > 0 ? reachLine(data.reach) : `${capitalise(peopleInWords(data.totals.people))} so far.`}
      </p>
      <p className="mb-6 text-muted">
        {data.totals.people > 0 && `${data.totals.people === 1 ? 'They have' : 'Each has'} said what a good ordinary life looks like for them. `}
        Anyone can take part, with no host and no deadline. Every count is of people.
      </p>
      <Contents items={contents} />

      {!data.heard && (
        <Banner className="mb-6">
          <p className="mb-3">
            You can see the themes and how many people are in each. To read what people said, have your own conversation first, so your answers stay your own.
          </p>
          <Button to={`/a/${assembly.slug}/talk`}>Start my conversation</Button>
        </Banner>
      )}

      <section aria-labelledby="no-host" className="mb-4">
        <h2 id="no-host" tabIndex={-1} className="mb-2 scroll-mt-4">
          Themes with no host yet
        </h2>
        <p className="mb-3 text-muted">Nobody has opened an assembly to act on these. That gap is public on purpose.</p>
        {data.noHost.length === 0 ? (
          <p className="text-muted">Every theme has an assembly answering it.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {data.noHost.map((t) => (
              <li key={t.id} className="py-2">
                <p>
                  <span className="font-bold">{capitalise(t.name)}</span> <span className="text-muted">({personCount(t.people)})</span>
                </p>
                <p className="flex flex-wrap justify-between gap-x-3 text-sm">
                  <span className="text-muted">{KIND_WORDS[t.kind]}</span>
                  <Link to={`/host?fromTheme=${encodeURIComponent(t.id)}`}>Host an assembly on this</Link>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {hasThemes ? (
        <ThemeSections sections={themed} canReport={data.heard} onChange={reload} />
      ) : (
        <EmptyState title="No themes yet">
          <p>Themes appear here as people approve their points.</p>
        </EmptyState>
      )}

      <section aria-labelledby="days" className="mt-10">
        <h2 id="days" tabIndex={-1} className="mb-2 scroll-mt-4">
          Good ordinary days
        </h2>
        <p className="mb-4 text-muted">Moments from the days people hope for, grouped by what matters in them. No names and no ranking.</p>
        {!data.heard ? (
          <>
            <ul className="mb-3 space-y-1">
              {data.sections
                .filter((s) => s.kind === 'day')
                .flatMap((s) => s.themes)
                .map((t) => (
                  <li key={t.id}>
                    {capitalise(t.name)} <span className="text-muted">({personCount(t.people)})</span>
                  </li>
                ))}
            </ul>
            <p className="text-muted">The moments themselves open once you have described your own good ordinary day.</p>
          </>
        ) : data.days.length === 0 ? (
          <p className="text-muted">None yet. They will appear as people describe their own.</p>
        ) : (
          <div className="space-y-6">
            {data.days.map((d) => (
              <section key={d.id} aria-labelledby={`day-${d.id}`}>
                <h3 id={`day-${d.id}`} className="mb-2">
                  {capitalise(d.name)}
                </h3>
                <QuoteList quotes={d.quotes.map((q) => ({ ...q, name: undefined }))} label={capitalise(d.name)} />
              </section>
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}
