import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MeResponse } from '@unite/shared';
import { MeProvider } from '../lib/me';
import Me from '../pages/me/Me';
import type { MyConversation, TraceEntry } from '../pages/talk/types';
import { mockApi } from './talk.fixtures';

const me: MeResponse = {
  person: { id: 'per_AAAAAAAAAAAA', createdAt: '2026-11-13T09:00:00.000Z', isExample: false, about: {}, locale: 'en-GB' },
  memberships: [],
  role: 'participant',
  demo: false,
};

const trace: TraceEntry[] = [
  {
    point: { id: 'pt_AAAAAAAAAAAA', type: 'barrier', text: 'The course runs at seven when I work', visibility: 'anonymous' },
    assembly: { slug: 'riverbend', title: 'Earning and learning', isOpenListening: false },
    theme: { id: 'thm_AAAAAAAAAAAA', name: 'Courses run when I am at work' },
    statements: [{ id: 'st_AAAAAAAAAAAA', text: 'Courses should fit around shifts.', status: 'common_ground', statusWords: 'Common ground' }],
    decisions: [{ id: 'dec_AAAAAAAAAAAA', number: 3, title: 'Courses at any time', status: 'in_progress', statusWords: 'In progress' }],
  },
];
const conversations: MyConversation[] = [
  { id: 'con_AAAAAAAAAAAA', route: 'ai', status: 'complete', stage: 9, startedAt: '2026-11-13T09:00:00.000Z', assembly: { slug: 'riverbend', title: 'Earning and learning', isOpenListening: false } },
  { id: 'con_BBBBBBBBBBBB', route: 'ai', status: 'active', stage: 2, startedAt: '2026-11-13T09:00:00.000Z', assembly: { slug: 'open', title: 'Open', isOpenListening: true } },
];

function show(initial: MeResponse = me) {
  return render(
    <MemoryRouter>
      <MeProvider initial={initial}>
        <Me />
      </MeProvider>
    </MemoryRouter>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('/me', () => {
  it('traces each point to its theme, statements and decisions, with statuses in words and links', async () => {
    mockApi((c) => (c.url === '/api/me/trace' ? { points: trace } : c.url === '/api/conversations' ? { conversations } : me));
    show();
    expect(await screen.findByText('“The course runs at seven when I work”')).toBeTruthy();
    expect(screen.getByRole('link', { name: '“Courses run when I am at work”' }).getAttribute('href')).toBe('/a/riverbend/picture');
    expect(screen.getByRole('link', { name: 'Courses should fit around shifts.' }).getAttribute('href')).toBe('/a/riverbend/statements/st_AAAAAAAAAAAA');
    expect(screen.getByText('(Common ground)')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Decision 3: Courses at any time' })).toBeTruthy();
    expect(screen.getByText('(In progress)')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Carry on' }).getAttribute('href')).toBe('/talk/con_BBBBBBBBBBBB');
    expect(screen.getByRole('link', { name: 'See my points' }).getAttribute('href')).toBe('/talk/con_AAAAAAAAAAAA/review');
    expect(screen.getByRole('link', { name: 'Download my data' }).getAttribute('href')).toBe('/api/me/export');
  });

  it('deletes my data only after a clear confirmation', async () => {
    const calls = mockApi((c) => (c.url === '/api/me/trace' ? { points: trace } : c.url === '/api/conversations' ? { conversations } : c.method === 'DELETE' ? { deleted: true } : me));
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete my data' }));
    expect(screen.getByText(/your points, which are taken out of the picture/)).toBeTruthy();
    expect(screen.getByText(/This cannot be undone/)).toBeTruthy();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete everything' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'DELETE')?.url).toBe('/api/me'));
    expect(await screen.findByText(/has been deleted/)).toBeTruthy();
  });

  it('says what will appear when there is nothing yet', async () => {
    mockApi((c) => (c.url === '/api/me/trace' ? { points: [] } : c.url === '/api/conversations' ? { conversations: [] } : me));
    show({ ...me, person: null });
    expect(await screen.findByText('Nothing to follow yet')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Start a conversation' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete my data' })).toBeNull();
  });
});
