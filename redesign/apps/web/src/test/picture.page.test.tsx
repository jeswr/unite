import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '@unite/shared';
import { MeProvider } from '../lib/me';
import Picture from '../pages/picture/Picture';
import type { PictureResponse } from '@unite/shared';

const picture = (over: Partial<PictureResponse> = {}): PictureResponse => ({
  totals: { people: 3, points: 6 },
  sections: [
    { kind: 'matters', title: 'What matters', themes: [] },
    {
      kind: 'barrier',
      title: 'What gets in the way',
      themes: [
        {
          id: 'thm_night',
          kind: 'barrier',
          name: 'night shift',
          people: 3,
          sentences: [{ text: 'Night shifts keep people from courses.', people: 2, quotes: [{ id: 'pt_a', text: 'I work nights' }] }],
          quotes: [
            { id: 'pt_a', text: 'I work nights' },
            { id: 'pt_b', text: 'Missed the class again', name: 'Ben' },
          ],
          reports: [],
          mine: [{ id: 'pt_me', text: 'My rota changes weekly' }],
        },
      ],
    },
    { kind: 'day', title: 'Good ordinary days', themes: [] },
    { kind: 'idea', title: 'Ideas', themes: [] },
  ],
  hardChoices: { people: 0, quotes: [] },
  missing: [{ key: 'young', label: 'Under 25', heard: 1, target: 10, underHeard: true }],
  confirmed: null,
  unthemed: 0,
  updating: false,
  canUpdate: false,
  canConfirm: false,
  ...over,
});

function mockApi(body: PictureResponse | 'not_heard') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = String(url);
      const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
      if (u.endsWith('/version')) return json({ version: 1 });
      if (u.endsWith('/picture'))
        return body === 'not_heard' ? json({ error: { code: 'not_heard', message: 'Have your own conversation first.' } }, 403) : json(body);
      return json({ assembly: { slug: 'town', question: 'What would help?', isExample: false } });
    }),
  );
}

const renderPage = (role: Role = 'participant') =>
  render(
    <MemoryRouter initialEntries={['/a/town/picture']}>
      <MeProvider initial={{ person: null, memberships: [], role, demo: false }}>
        <Routes>
          <Route path="/a/:slug/picture" element={<Picture />} />
        </Routes>
      </MeProvider>
    </MemoryRouter>,
  );

afterEach(() => vi.unstubAllGlobals());

describe('picture page', () => {
  it('explains rule 1 and offers my conversation instead of an error when I have not been heard', async () => {
    mockApi('not_heard');
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Have your own conversation first' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Start my conversation' }).getAttribute('href')).toBe('/a/town/talk');
  });

  it('shows the total in words, themes with people counts, sources, my point and who is missing', async () => {
    mockApi(picture());
    renderPage();
    expect(await screen.findByText('Three people have spoken so far.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Night shift' })).toBeTruthy();
    expect(screen.getByText('3 people')).toBeTruthy();
    expect(screen.getByText('Sources: 2 people')).toBeTruthy();
    expect(screen.getByText('Ben')).toBeTruthy();
    expect(screen.getByText('My rota changes weekly')).toBeTruthy();
    expect(screen.getByText('You said this')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'This is not what was said' })).toBeTruthy();
    expect(screen.getByText('1 of 10 hoped for')).toBeTruthy();
    expect(screen.getByText('Under-heard')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Update the picture' })).toBeNull();
  });

  it('shows the steward controls only to a steward', async () => {
    mockApi(picture({ canConfirm: true, canUpdate: true, unthemed: 2 }));
    renderPage('steward');
    expect(await screen.findByRole('button', { name: 'Update the picture' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirm the picture is faithful' })).toBeTruthy();
  });
});
