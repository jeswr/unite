import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MeProvider } from '../lib/me';
import Statements from '../pages/statements/Statements';
import type { StatementResults, StatementSummary } from '@unite/shared';

const results = (agree: number, disagree: number, unsure: number): StatementResults => {
  const total = agree + disagree + unsure;
  return {
    overall: { agree, disagree, unsure, total, share: total ? agree / total : 0 },
    groups: [{ key: 'a', mine: false, agree, disagree, unsure, total, share: total ? agree / total : 0 }],
    counted: total,
    stillNeeded: [],
  };
};

const st = (id: string, text: string, over: Partial<StatementSummary> = {}): StatementSummary => ({
  id,
  text,
  version: 1,
  origin: 'ai',
  mine: false,
  createdAt: '2026-11-13T09:00:00.000Z',
  myReaction: null,
  ...over,
});

function mockApi(initial: StatementSummary[]) {
  let statements = initial;
  const posts: { url: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
      if (u.endsWith('/version')) return json({ version: 1 });
      if (init?.method === 'POST' && u.includes('/reactions')) {
        const id = u.split('/')[3]!;
        const body = JSON.parse(String(init.body));
        posts.push({ url: u, body });
        statements = statements.map((s) => (s.id === id ? { ...s, myReaction: body.value, results: results(4, 1, 0) } : s));
        return json({ statement: statements.find((s) => s.id === id) });
      }
      if (u.endsWith('/statements')) return json({ statements, canSteward: false });
      if (u.includes('/api/assemblies/'))
        return json({ assembly: { slug: 'town', question: 'What would help?', isExample: false }, heard: true, role: 'participant' });
      return json({ error: { code: 'not_found', message: 'Not found' } }, 404);
    }),
  );
  return posts;
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/a/town/statements']}>
      <MeProvider initial={{ person: null, memberships: [], role: 'participant', demo: false }}>
        <Routes>
          <Route path="/a/:slug/statements" element={<Statements />} />
        </Routes>
      </MeProvider>
    </MemoryRouter>,
  );

afterEach(() => vi.unstubAllGlobals());

describe('statements: one at a time', () => {
  it('asks one statement at a time, shows how others answered after each answer, then moves on', async () => {
    const posts = mockApi([st('st_one', 'Classes should run at night.'), st('st_two', 'Childcare during any funded class.')]);
    renderPage();
    const first = await screen.findByText('Classes should run at night.', { selector: 'p.text-2xl' });
    expect(first).toBeTruthy();
    expect(screen.getByText('2 statements for you to answer')).toBeTruthy();
    expect(screen.queryByText('How others answered')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Agree' }));
    expect(await screen.findByRole('heading', { name: 'How others answered' })).toBeTruthy();
    expect(posts).toEqual([{ url: '/api/statements/st_one/reactions', body: { value: 'agree' } }]);
    const card = screen.getByRole('heading', { name: 'How others answered' }).closest('section')!;
    expect(within(card).getByText('You answered: Agree')).toBeTruthy();
    expect(within(card).getByText('5 people have answered')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Next statement' }));
    expect(await screen.findByText('Childcare during any funded class.', { selector: 'p.text-2xl' })).toBeTruthy();
    expect(screen.getByText('1 statement for you to answer')).toBeTruthy();
  });

  it('opens a box to say it better', async () => {
    mockApi([st('st_one', 'Classes should run at night.')]);
    renderPage();
    await screen.findByText('Classes should run at night.', { selector: 'p.text-2xl' });
    fireEvent.click(screen.getByRole('button', { name: 'Say it better' }));
    expect(screen.getByLabelText(/Your wording/)).toBeTruthy();
  });
});

describe('statements: totals and status hidden until answered (rule 5)', () => {
  it('shows totals only on statements I have answered, and lists the rest plainly with no tags', async () => {
    mockApi([
      st('st_one', 'Classes should run at night.'),
      st('st_two', 'Childcare during any funded class.', { status: 'common_ground', myReaction: 'agree', results: results(9, 1, 0) }),
    ]);
    renderPage();
    const common = await screen.findByRole('heading', { name: 'Common ground' });
    const commonSection = common.closest('section')!;
    expect(within(commonSection).getByText('10 people have answered')).toBeTruthy();
    expect(within(commonSection).getByText('You answered: Agree')).toBeTruthy();
    expect(within(commonSection).queryByText('Classes should run at night.')).toBeNull();

    const toAnswer = screen.getByRole('heading', { name: 'Still to answer' }).closest('section')!;
    expect(within(toAnswer).getByRole('link', { name: 'Classes should run at night.' })).toBeTruthy();
    expect(within(toAnswer).queryByText(/Common ground|Where we differ|Not enough voices|people have answered/)).toBeNull();

    for (const name of ['Where we differ', 'Not enough voices yet']) {
      const section = screen.getByRole('heading', { name }).closest('section')!;
      expect(within(section).queryByText('Classes should run at night.')).toBeNull();
    }
  });
});
