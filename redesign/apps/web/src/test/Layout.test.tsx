import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, Link } from 'react-router';
import { describe, expect, it } from 'vitest';
import { MeProvider } from '../lib/me';
import { Layout } from '../ui/Layout';

const me = { person: null, memberships: [], role: 'participant' as const, demo: false };

function renderAt(path: string, demo = false) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MeProvider initial={{ ...me, demo }}>
        <Routes>
          <Route path="/" element={<Layout title="Home page"><Link to="/how">Go</Link></Layout>} />
          <Route path="/how" element={<Layout title="How page" />} />
          <Route path="/a/x" element={<Layout title="Example page" assembly={{ isExample: true }} />} />
        </Routes>
      </MeProvider>
    </MemoryRouter>,
  );
}

describe('Layout', () => {
  it('has the word Unite, the main links, one h1 and the feedback button with the path', () => {
    renderAt('/how');
    expect(screen.getByRole('link', { name: 'Unite, home' })).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect([...nav.querySelectorAll('a')].map((a) => a.textContent)).toEqual(['Home', 'Assemblies', 'Register', 'How it works', 'Me']);
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['How page']);
    expect(screen.getByRole('link', { name: 'Give feedback' }).getAttribute('href')).toBe('/feedback?from=%2Fhow');
  });

  it('moves focus to the h1 on navigation', async () => {
    renderAt('/');
    await act(async () => fireEvent.click(screen.getByRole('link', { name: 'Go' })));
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'How page' }));
  });

  it('shows the example banner only on example assemblies', () => {
    renderAt('/a/x');
    expect(screen.getByText(/invented so you can see how Unite works/)).toBeTruthy();
  });

  it('shows the role switcher only in demo mode', () => {
    const { unmount } = renderAt('/how');
    expect(screen.queryByRole('group', { name: /view as/i })).toBeNull();
    unmount();
    renderAt('/how', true);
    expect(screen.getByRole('button', { name: 'Steward' })).toBeTruthy();
  });

  it('shows the demonstration banner, with the walkthrough and feedback links, only in demo mode', () => {
    const { unmount } = renderAt('/how');
    expect(screen.queryByRole('note', { name: 'Demonstration' })).toBeNull();
    unmount();
    renderAt('/how', true);
    const banner = screen.getByRole('note', { name: 'Demonstration' });
    expect(banner.textContent).toContain('This is a demonstration with invented examples. Anything you add may be reset.');
    const links = [...banner.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href')]);
    expect(links).toEqual([
      ['Watch the walkthrough', 'https://unite-overview.vercel.app/#unite'],
      ['Give feedback', '/feedback?from=%2Fhow'],
    ]);
  });
});
