import { useEffect, useRef, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import type { Assembly } from '@unite/shared';
import { ExampleBanner } from './ExampleBanner';
import { FeedbackButton } from './FeedbackButton';
import { RoleSwitcher } from './RoleSwitcher';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/assemblies', label: 'Assemblies', end: false },
  { to: '/register', label: 'Register', end: false },
  { to: '/how', label: 'How it works', end: false },
  { to: '/me', label: 'Me', end: false },
];

/** The last path a page was shown for, so focus moves to the heading on navigation but not on first load. */
let lastPath: string | null = null;

interface Props {
  /** The page's one h1. Focus moves to it on navigation. */
  title: ReactNode;
  children?: ReactNode;
  /** The assembly this page belongs to: an example one shows the example banner (rule 10). */
  assembly?: Pick<Assembly, 'isExample'> | null;
  /** A short line above the heading, for example the host's name. */
  kicker?: ReactNode;
}

/** Every page: header, the example banner where it applies, one h1, the page, the footer with "Give feedback". */
export function Layout({ title, children, assembly, kicker }: Props) {
  const { pathname } = useLocation();
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (lastPath !== null && lastPath !== pathname) h1.current?.focus();
    lastPath = pathname;
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-white text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-20 focus:bg-white focus:p-2">
        Skip to the page
      </a>
      <RoleSwitcher />
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-read flex-wrap items-baseline gap-x-6 gap-y-1 px-4 py-3">
          <NavLink to="/" className="text-2xl font-bold text-ink no-underline" aria-label="Unite, home">
            Unite
          </NavLink>
          <nav aria-label="Main">
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {NAV.map((n) => (
                <li key={n.to}>
                  <NavLink
                    to={n.to}
                    end={n.end}
                    className={({ isActive }) => (isActive ? 'font-bold text-ink no-underline' : 'text-accent')}
                  >
                    {n.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      {assembly?.isExample && <ExampleBanner />}
      <main id="main" className="mx-auto w-full max-w-read flex-1 px-4 pt-6 pb-12">
        {kicker && <p className="mb-1 text-muted">{kicker}</p>}
        <h1 ref={h1} tabIndex={-1} className="mb-5">
          {title}
        </h1>
        {children}
      </main>
      <footer className="border-t border-line bg-soft">
        <div className="mx-auto flex max-w-read flex-wrap items-center justify-between gap-3 px-4 py-4">
          <p className="text-sm text-muted">Unite is run by its own loop. Its rules and prompts are published.</p>
          <FeedbackButton />
        </div>
      </footer>
    </div>
  );
}
