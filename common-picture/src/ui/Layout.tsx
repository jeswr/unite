import { useEffect, useRef, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';

export const OVERVIEW_URL: string =
  (import.meta.env.VITE_OVERVIEW_URL as string | undefined) || 'https://unite-overview.vercel.app/#common-picture';

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/listen', label: 'Listen' },
  { to: '/picture', label: 'Picture' },
  { to: '/room', label: 'Room' },
  { to: '/answers', label: 'Answers' },
  { to: '/about', label: 'About' },
];

export const EXAMPLE_NOTE = 'Demonstration on invented examples. No real people, places’ views or results.';

function Mark() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true" focusable="false">
      <circle cx="17" cy="17" r="15" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
      <circle cx="17" cy="17" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
      <circle cx="17" cy="17" r="4.5" fill="var(--accent)" />
    </svg>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { pathname, search } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const first = useRef(true);

  // On each page change: back to the top, and focus the main region so screen readers start at the new page.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo(0, 0);
    mainRef.current?.focus();
  }, [pathname]);

  const from = encodeURIComponent(pathname + search);

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="strip" role="note" aria-label="Example data">
        <strong>{EXAMPLE_NOTE}</strong>
      </div>
      <header className="site-header">
        <div className="wrap header-row">
          <Link to="/" className="brand" aria-label="The Common Picture, home">
            <Mark />
            <span className="brand-name">
              The Common Picture
              <span className="brand-sub">Edition 0 · demonstration</span>
            </span>
          </Link>
          <nav className="nav" aria-label="Main">
            <ul>
              {NAV.map((n) => (
                <li key={n.to}>
                  <NavLink to={n.to} end={n.to === '/'}>
                    {n.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          {pathname !== '/feedback' && (
            <Link className="btn secondary small" to={`/feedback?from=${from}`}>
              Give feedback
            </Link>
          )}
        </div>
      </header>
      <main id="main" ref={mainRef} tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <div className="wrap footer-grid">
          <div>
            <p>
              <strong>{EXAMPLE_NOTE}</strong> Every count on this site is example data computed from invented
              conversations. None of it is a finding about any real place or people.
            </p>
            <p>No institution, government or assembly has pledged to, endorsed or taken part in this demonstration. Hosts shown are invented examples.</p>
            <p>‘The Common Picture’ is a working name.</p>
          </div>
          <nav aria-label="More pages">
            <ul>
              <li>
                <Link to="/days">Good days from elsewhere</Link>
              </li>
              <li>
                <Link to="/route">One person’s route</Link>
              </li>
              <li>
                <Link to="/editions">Editions</Link>
              </li>
              <li>
                <Link to="/about">What this is and is not</Link>
              </li>
              <li>
                <Link to={`/feedback?from=${from}`}>Give feedback</Link>
              </li>
            </ul>
          </nav>
          <div>
            <p>
              <a href={OVERVIEW_URL}>Watch the walkthrough</a>
            </p>
            <p className="small">A demonstration of method and nothing more.</p>
          </div>
        </div>
      </footer>
    </>
  );
}

export function PageHead({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="section" style={{ marginTop: 0 }}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {children && <div className="lede">{children}</div>}
    </header>
  );
}
