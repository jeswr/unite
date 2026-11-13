import { Link } from 'react-router';
import { formatDate } from '@unite/shared';
import { useApi } from '../../lib/api';
import { EmptyState } from '../../ui/EmptyState';
import { Layout } from '../../ui/Layout';
import { listInWords, type Release } from './types';

/** The link to feedback on one release: the changes after the release before it, or all of them for the first. */
export function changesFeedbackLink(previous?: Release): string {
  return `/feedback?mode=changes${previous ? `&since=${encodeURIComponent(previous.version)}` : ''}`;
}

/** Releases newest first, each change in plain words with who it affects. */
export default function Changes() {
  const { data, error } = useApi<{ releases: Release[] }>('/releases');
  const releases = data?.releases;
  return (
    <Layout title="What has changed">
      <p className="mb-6">Each version of Unite, newest first, and what changed in it.</p>
      {error && <p role="alert">{error.message}</p>}
      {!releases && !error && <p aria-live="polite">Loading…</p>}
      {releases && !releases.length && (
        <EmptyState title="Nothing is listed yet">
          <p>
            Each new version will be listed here with what changed. You can still <Link to="/feedback">give feedback</Link>.
          </p>
        </EmptyState>
      )}
      {releases?.map((r, i) => (
        <section key={r.version} aria-labelledby={`release-${r.version}`} className="mb-10">
          <h2 id={`release-${r.version}`} className="mb-1">
            Version {r.version}
          </h2>
          <p className="mb-4 text-muted">{formatDate(r.date)}</p>
          <ul className="mb-4 space-y-4">
            {r.changes.map((c, j) => (
              <li key={j} className="border-t border-line pt-3">
                <p>{c.text}</p>
                <p className="mt-1 text-sm text-muted">Affects {listInWords(c.affects)}.</p>
              </li>
            ))}
          </ul>
          <p>
            <Link to={changesFeedbackLink(releases[i + 1])} className="font-bold">
              Tell us what you think of these changes
            </Link>
          </p>
        </section>
      ))}
    </Layout>
  );
}
