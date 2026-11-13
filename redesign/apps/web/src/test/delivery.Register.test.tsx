import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerSummary, type DecisionStatus } from '@unite/shared';
import { MeProvider } from '../lib/me';
import HostRecord, { recordSentences } from '../pages/delivery/HostRecord';
import Register from '../pages/delivery/Register';
import type { RegisterEntry, RegisterResponse } from '@unite/shared';
import { summarySentence } from '../pages/delivery/words';

const of = (statuses: DecisionStatus[]) => registerSummary(statuses.map((status) => ({ status })));

const entry = (n: number, status: DecisionStatus, daysLate = 0): RegisterEntry => ({
  id: `dec_${n}AAAAAAAAAAA`,
  number: n,
  title: `Decision title ${n}`,
  status,
  dueDate: '2026-11-01',
  daysLate,
  answer: null,
  assembly: { slug: 'tool', title: 'Volunteering tool', isExample: true },
  host: { name: 'Northern Network', slug: 'northern' },
});

afterEach(() => vi.unstubAllGlobals());

describe('the register summary sentence', () => {
  it('is written out in words and never counts in progress as done', () => {
    expect(summarySentence(of(['delivered_minor_changes', 'in_progress', 'in_progress', 'delayed', 'refused']))).toBe(
      '5 decisions: 1 delivered with small changes, 2 in progress, 1 delayed, 1 refused. In progress is not counted as done.',
    );
    expect(summarySentence(of(['awaiting_answer']))).toBe('1 decision: 1 awaiting an answer. In progress is not counted as done.');
    expect(summarySentence(of([]))).toBe('No decisions yet.');
  });
});

describe('the register page', () => {
  it('shows the summary, a table and cards, and filters through the address', async () => {
    const body: RegisterResponse = {
      entries: [entry(1, 'awaiting_answer', 12), entry(2, 'in_progress')],
      summary: of(['awaiting_answer', 'in_progress']),
      filters: { assemblies: [{ slug: 'tool', title: 'Volunteering tool' }], hosts: [{ slug: 'northern', name: 'Northern Network' }], statuses: ['awaiting_answer', 'in_progress'] },
    };
    const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    render(
      <MemoryRouter initialEntries={['/register']}>
        <MeProvider initial={{ person: null, memberships: [], role: 'participant', demo: false }}>
          <Routes>
            <Route path="/register" element={<Register />} />
          </Routes>
        </MeProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('2 decisions: 1 in progress, 1 awaiting an answer. In progress is not counted as done.')).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getAllByText('12 days late')).toHaveLength(2); // table row and phone card
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'in_progress' } });
    await waitFor(() => expect(fetch.mock.calls.map((c) => String((c as unknown[])[0]))).toContain('/api/register?status=in_progress'));
    expect(screen.getByRole('option', { name: 'In progress' })).toBeTruthy();
  });
});

describe('the host record', () => {
  it('says the record in words, with in progress apart from done', async () => {
    const record = { decisions: 5, answeredOnTime: 4, answeredLate: 0, awaitingAnswer: 1, awaitingLate: 1, accepted: 2, changed: 1, delayed: 1, refused: 0, inProgress: 2, deliveredAsDecided: 0, deliveredWithChanges: 1, notDelivered: 0, replaced: 0 };
    expect(recordSentences(record)).toEqual([
      '5 decisions have been put to this host.',
      '4 have been answered: 4 on time and 0 late.',
      '1 is still waiting for an answer, and 1 is past the date the host promised.',
    ]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ host: { name: 'Northern Network', slug: 'northern', description: '' }, assemblies: [{ slug: 'tool', title: 'Volunteering tool', stage: 'delivering', isExample: true, decisions: 5 }], record, entries: [] }), { status: 200 })),
    );
    render(
      <MemoryRouter initialEntries={['/hosts/northern']}>
        <MeProvider initial={{ person: null, memberships: [], role: 'participant', demo: false }}>
          <Routes>
            <Route path="/hosts/:hostSlug" element={<HostRecord />} />
          </Routes>
        </MeProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Northern Network' })).toBeTruthy();
    expect(screen.getByText('In progress: 2.')).toBeTruthy();
    expect(screen.getByText(/In progress is not counted as done/)).toBeTruthy();
  });
});
