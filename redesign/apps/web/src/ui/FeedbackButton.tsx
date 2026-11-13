import { Link, useLocation } from 'react-router';

/** "Give feedback", on every page: bottom right on wide screens (where it cannot cover the reading column), in the footer bar on phones. */
export function FeedbackButton() {
  const { pathname, search } = useLocation();
  const from = encodeURIComponent(pathname + search);
  return (
    <Link
      to={`/feedback?from=${from}`}
      className="inline-flex min-h-11 items-center rounded-ui border border-accent bg-white px-4 py-2 font-bold text-accent no-underline hover:bg-accent-soft xl:fixed xl:right-4 xl:bottom-4 xl:z-10"
    >
      Give feedback
    </Link>
  );
}
