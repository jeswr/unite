import { useEffect, useRef, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import type { Assembly } from '@unite/shared';
import { ExampleBanner } from './ExampleBanner';
import { FeedbackButton } from './FeedbackButton';
import { RoleSwitcher } from './RoleSwitcher';

/** On phones the nav fits on one line: `more` is left off the label and `phone: false` items are left out (the name links home). */
const NAV = [
  { to: '/', label: 'Home', end: true, phone: false },
  { to: '/assemblies', label: 'Assemblies', end: false, phone: true },
  { to: '/register', label: 'Register', end: false, phone: true },
  { to: '/how', label: 'How', more: ' it works', end: false, phone: true },
  { to: '/me', label: 'Me', end: false, phone: true },
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
        <div className="mx-auto flex max-w-read items-baseline gap-x-4 px-4 py-1.5 sm:flex-wrap sm:gap-x-6 sm:gap-y-1 sm:py-3">
          <NavLink to="/" className="text-xl font-bold text-ink no-underline sm:text-2xl" aria-label="Unite, home">
            Unite
          </NavLink>
          <nav aria-label="Main" className="min-w-0 text-sm sm:text-base">
            <ul className="flex gap-x-3 sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
              {NAV.map((n) => (
                <li key={n.to} className={n.phone ? undefined : 'hidden sm:list-item'}>
                  <NavLink
                    to={n.to}
                    end={n.end}
                    className={({ isActive }) => `inline-block py-1 ${isActive ? 'font-bold text-ink no-underline' : 'text-accent'}`}
                  >
                    {n.label}
                    {n.more && <span className="hidden sm:inline">{n.more}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      {assembly?.isExample && <ExampleBanner />}
      <main id="main" className="mx-auto w-full max-w-read flex-1 px-4 pt-4 pb-12 sm:pt-6">
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
