import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AssemblyView } from '@unite/shared';
import { MeProvider } from '../lib/me';
import AssemblyPage, { actionsFor } from '../pages/assembly/Assembly';

const view = (over: Partial<AssemblyView['assembly']> = {}, rest: Partial<AssemblyView> = {}): AssemblyView => ({
  assembly: {
    id: 'asm_AAAAAAAAAAAA',
    slug: 'earning-and-learning',
    title: 'Earning',
    question: 'What would let people here keep earning and keep learning as work changes?',
    summary: 'A summary.',
    kind: 'codecided',
    scale: 'local',
    hostName: 'Riverbend Council and Riverbend College',
    hostSlug: 'riverbend',
    hostDescription: '',
    stage: 'deciding',
    isExample: true,
    isOpenListening: false,
    probes: [],
    aboutQuestions: [],
    affectedGroups: [],
    pledge: {
      setAside: '£250,000 of the 2027–28 adult skills budget',
      remit: 'Adult learning',
      offTable: 'Wages',
      decisionLevel: 2,
      groupThreshold: 0.6,
      minParticipants: 40,
      capacity: 5,
      replyBy: '2026-12-18',
      checkBody: 'panel',
      reviewAfterDays: 365,
      publishedAt: '2026-09-01T09:00:00.000Z',
    },
    createdAt: '2026-11-13T09:00:00.000Z',
    updatedAt: '2026-11-13T09:00:00.000Z',
    version: 1,
    ...over,
  },
  membership: null,
  role: 'participant',
  heard: false,
  myConversation: null,
  checklist: { stage: 'deciding', next: 'answered', clear: false, items: [{ key: 'decisions_created', text: 'The top priorities have been written up as decisions', met: false }] },
  counts: { heard: 0, members: 0, invited: 0, statements: 0, decisions: 0 },
  ...rest,
});

function mockFetch(body: AssemblyView) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => new Response(JSON.stringify(String(url).endsWith('/version') ? { version: 1 } : body), { status: 200 })),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('assembly page', () => {
  it('shows the question, host, pledge in brief, tracker and the banner', async () => {
    mockFetch(view());
    render(
      <MemoryRouter initialEntries={['/a/earning-and-learning']}>
        <MeProvider initial={{ person: null, memberships: [], role: 'participant', demo: false }}>
          <Routes>
            <Route path="/a/:slug" element={<AssemblyPage />} />
          </Routes>
        </MeProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { level: 1, name: /keep earning and keep learning/ })).toBeTruthy();
    expect(screen.getByText('Hosted by Riverbend Council and Riverbend College')).toBeTruthy();
    expect(screen.getByText(/The host will answer the top 5 priorities by 18 December 2026/)).toBeTruthy();
    expect(screen.getByText(/invented so you can see how Unite works/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Start my conversation' }).getAttribute('href')).toBe('/a/earning-and-learning/talk');
    expect(screen.getByRole('button', { name: 'Look around the example first' })).toBeTruthy();
    expect(screen.getByText('The top priorities have been written up as decisions')).toBeTruthy();
  });
});

describe('actionsFor', () => {
  const labels = (v: AssemblyView) => actionsFor(v).actions.map((a) => a.label);
  it('offers priorities first to someone heard while deciding', () => {
    expect(labels(view({}, { heard: true }))[0]).toBe('Choose my priorities');
  });
  it('offers only the pledge before an assembly opens', () => {
    expect(labels(view({ stage: 'pledged' }))).toEqual(['Read the pledge']);
    expect(labels(view({ stage: 'proposed' }))).toEqual(['Read the draft pledge']);
  });
  it('puts the decisions first once answered', () => {
    expect(labels(view({ stage: 'delivering' }))[0]).toBe('Read the decisions and answers');
  });
  it('does not offer looking around in a real assembly', () => {
    expect(labels(view({ isExample: false }))).toEqual(['Start my conversation']);
  });
  it('says when someone chose to look around first', () => {
    const v = view({}, { heard: true, membership: { id: 'mem_AAAAAAAAAAAA', personId: 'per_AAAAAAAAAAAA', assemblyId: 'asm_AAAAAAAAAAAA', role: 'participant', invited: false, lookedAroundFirst: true, joinedAt: '2026-11-13T09:00:00.000Z' } });
    expect(actionsFor(v).note).toBe('You chose to look around the example first.');
  });
});
