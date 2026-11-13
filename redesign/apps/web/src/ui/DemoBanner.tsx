import { Link, useLocation } from 'react-router';
import { useMe } from '../lib/me';

/** Where "Watch the walkthrough" goes. Set VITE_OVERVIEW_URL at build time to change it. */
export const OVERVIEW_URL: string = import.meta.env.VITE_OVERVIEW_URL || 'https://unite-overview.vercel.app/#unite';

/** Shown on every page when the server reports demo mode: the data is invented and may be reset. */
export function DemoBanner() {
  const { me } = useMe();
  const { pathname, search } = useLocation();
  if (!me?.demo) return null;
  return (
    <div role="note" aria-label="Demonstration" className="border-b border-line bg-accent-soft text-ink">
      <p className="mx-auto max-w-read px-4 py-1 text-xs sm:py-1.5 sm:text-sm">
        This is a demonstration with invented examples. Anything you add may be reset.{' '}
        <span className="whitespace-nowrap">
          <a href={OVERVIEW_URL}>Watch the walkthrough</a>
          <span aria-hidden="true"> · </span>
          <Link to={`/feedback?from=${encodeURIComponent(pathname + search)}`}>Give feedback</Link>
        </span>
      </p>
    </div>
  );
}
